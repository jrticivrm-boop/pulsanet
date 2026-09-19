# Arranca Caddy como borde HTTPS publico (Let's Encrypt via sslip.io o dominio propio).
# Requiere: stack LEVANTAR (API:4000, Web:5173, LiveKit:7880), puertos 80/443 abiertos.
#
# Uso:
#   powershell -File infra\START-PUBLIC-EDGE.ps1
#   powershell -File infra\START-PUBLIC-EDGE.ps1 -Domain app.midominio.mx -Email admin@midominio.mx

param(
  [string]$Domain = '',
  [string]$Email = ''
)

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')
. (Join-Path $PSScriptRoot 'Fix-WanTlsOffload.ps1')
try { [void](Invoke-TpxWanTlsOffloadFix) } catch {
  Write-Host "Fix-WanTlsOffload: $($_.Exception.Message)" -ForegroundColor Yellow
}
$caddyDir = Join-Path $PSScriptRoot 'caddy'
$caddy = Join-Path $caddyDir 'caddy.exe'
$caddyfile = Join-Path $PSScriptRoot 'Caddyfile.edge'
$dataDir = Join-Path $caddyDir 'data'

function Install-TpxCaddyBinary([string]$DestExe) {
  if (Test-Path $DestExe) { return $true }
  $dir = Split-Path $DestExe -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $zipUrl = 'https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_windows_amd64.zip'
  $zip = Join-Path $dir '_caddy.zip'
  Write-Host "Falta caddy.exe - descargando Caddy 2.10.2 (windows/amd64)..." -ForegroundColor Yellow
  try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing -TimeoutSec 120
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tmp = Join-Path $dir '_caddy_extract'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
    $found = Get-ChildItem -Path $tmp -Filter 'caddy.exe' -Recurse | Select-Object -First 1
    if (-not $found) { throw 'El ZIP de Caddy no trae caddy.exe' }
    Copy-Item -Force $found.FullName $DestExe
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "OK: $DestExe" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "No se pudo descargar Caddy: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

if (-not (Install-TpxCaddyBinary $caddy)) {
  throw "Falta $caddy - descarga Caddy en infra\caddy"
}

$publicIp = $null
try { $publicIp = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim() } catch {}
if (-not $publicIp) { throw 'No se pudo obtener IP publica' }
Set-Content -Path (Join-Path $caddyDir 'public-ip.txt') -Value $publicIp -Encoding ascii

if (-not $Domain) {
  $Domain = Get-TpxPreferredPublicDomain -Root $root -PublicIp $publicIp
  if (-not $Domain) { $Domain = "$publicIp.sslip.io" }
}
[void](Update-TpxDuckDns -Root $root -PublicIp $publicIp)
[void](Sync-TpxPublicEnv -Root $root -PublicIp $publicIp -Domain $Domain)

Write-Host '=== TacticalPtx PUBLIC EDGE ===' -ForegroundColor Cyan
Write-Host "PUBLIC_IP=$publicIp"
Write-Host "PUBLIC_DOMAIN=$Domain"
if ($Email) { Write-Host "ACME_EMAIL=$Email" }

foreach ($r in @(
  @{ N = 'TacticalPtx-TCP-80'; P = '80' },
  @{ N = 'TacticalPtx-TCP-443'; P = '443' }
)) {
  netsh advfirewall firewall delete rule name="$($r.N)" >$null 2>&1
  netsh advfirewall firewall add rule name="$($r.N)" dir=in action=allow enable=yes profile=any protocol=TCP localport=$($r.P) >$null 2>&1
  Write-Host "Firewall OK $($r.N)"
}

$lan = Get-TpxPreferredLanIp
if (-not $lan) {
  foreach ($line in (& ipconfig.exe 2>$null)) {
    if ($line -match 'IPv4.*:\s*(192\.168\.\d+\.\d+)') { $lan = $Matches[1]; break }
  }
}
# Hairpin local: hosts debe apuntar al LAN actual (si queda .77 viejo, el navegador no abre el dominio).
$hairpin = Join-Path $PSScriptRoot 'Fix-DuckdnsHairpin.ps1'
if ((Test-Path $hairpin) -and $Domain -match 'duckdns\.org') {
  try {
    & $hairpin -LanIp $lan -Domain $Domain
  } catch {
    Write-Host "Fix-DuckdnsHairpin: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
$upnpOk = $false
if ($lan) {
  Start-TpxUPnPServices
  try {
    $nat = New-Object -ComObject HNetCfg.NATUPnP
    $col = $nat.StaticPortMappingCollection
    if ($col) {
      foreach ($p in @(80, 443)) {
        try { $col.Remove([int]$p, 'TCP') } catch {}
        $col.Add([int]$p, 'TCP', [int]$p, $lan, $true, "TacticalPtx-HTTPS-$p") | Out-Null
        Write-Host "UPnP OK TCP/$p -> ${lan}:$p" -ForegroundColor Green
        $upnpOk = $true
      }
    } else {
      Write-Host "UPnP IGD NULL - port-forward manual 80/443 -> ${lan}" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "UPnP 80/443: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

$reinforceExit = 0
& (Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1')
$reinforceExit = $LASTEXITCODE
if ($reinforceExit -eq 0) { $upnpOk = $true }

$envFile = Join-Path $root 'backend\.env'
function Set-Env([string]$K, [string]$V) {
  if (-not (Test-Path $envFile)) { Set-Content $envFile "$K=$V" -Encoding UTF8; return }
  $lines = @(Get-Content $envFile)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($K))=") { $found = $true; "$K=$V" } else { $line }
  }
  if (-not $found) { $out += "$K=$V" }
  Set-Content $envFile $out -Encoding UTF8
}

$origin = "https://$Domain"
Set-Env 'PUBLIC_HOST' $publicIp
Set-Env 'PUBLIC_DOMAIN' $Domain
Set-Env 'WEB_PUBLIC_URL' $origin
Set-Env 'LIVEKIT_PUBLIC_HOST' $publicIp
Set-Env 'LIVEKIT_PUBLIC_URL' "wss://$Domain"
if ($lan) {
  Set-Env 'PUBLIC_LAN_IP' $lan
  Set-Env 'LIVEKIT_LAN_HOST' $lan
}
$lan6 = Get-TpxPreferredLanIpv6
if ($lan6) {
  Set-Env 'PUBLIC_LAN_IPV6' $lan6
}

$corsLine = Get-Content $envFile | Where-Object { $_ -match '^CORS_ORIGINS=' } | Select-Object -First 1
$corsVal = if ($corsLine) { ($corsLine -split '=', 2)[1] } else { '' }
$corsAdd = @('http://localhost:5173', 'https://localhost:5173', 'https://127.0.0.1:5173', $origin)
if ($lan) {
  $corsAdd += @(
    "https://$lan",
    "http://$lan",
    "https://${lan}:5173",
    "http://${lan}:5173",
    "https://${lan}:4000"
  )
}
if ($lan6) {
  $corsAdd += @(
    "https://[$lan6]",
    "http://[$lan6]"
  )
}
foreach ($o in $corsAdd) {
  if ($corsVal -notlike "*$o*") {
    $corsVal = if ($corsVal) { "$corsVal,$o" } else { $o }
  }
}
Set-Env 'CORS_ORIGINS' $corsVal

$lkYaml = Join-Path $PSScriptRoot 'livekit.dev.yaml'
if (Test-Path $lkYaml) {
  if (Sync-TpxLiveKitYaml -Root $root -PublicIp $publicIp) {
    Write-Host "livekit.dev.yaml node_ip/turn.domain=$publicIp"
  }
}

Get-Process -Name caddy -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
# XAMPP/Apache en 80/443 pelea con Caddy y muestra "Apache / MariaDB caído".
$httpd = @(Get-Process -Name httpd -ErrorAction SilentlyContinue)
if ($httpd.Count -gt 0) {
  Write-Host "Deteniendo Apache/XAMPP (httpd) que ocupaba 80/443..." -ForegroundColor Yellow
  $httpd | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 600
}
Start-Sleep -Milliseconds 800
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# Detectar si API/Web locales hablan TLS (evita 502 "first record does not look like TLS").
function Test-LocalHealth([string]$Url) {
  $code = & curl.exe -sk --connect-timeout 3 --max-time 5 -o NUL -w '%{http_code}' $Url 2>$null
  return ($code -eq '200')
}

# Esperar API antes de Caddy (si LEVANTAR/edge se adelanta, evita 502 y try 000).
$apiReady = $false
for ($w = 1; $w -le 20; $w++) {
  if ((Test-LocalHealth 'https://127.0.0.1:4000/api/health') -or (Test-LocalHealth 'http://127.0.0.1:4000/api/health')) {
    $apiReady = $true
    break
  }
  if ($w -eq 1) {
    Write-Host 'Esperando API :4000 antes de Caddy...' -ForegroundColor Yellow
  }
  if ($w -eq 5) {
    $apiCmd = Join-Path $root 'infra\start-api.cmd'
    $apiDir = Join-Path $root 'backend'
    if ((Test-Path $apiCmd) -and (Test-Path $apiDir)) {
      Write-Host 'API ausente - arranque oculto start-api.cmd' -ForegroundColor Yellow
      $log = Join-Path (Join-Path 'C:\pulsanet_soporte' 'Logs') 'api-out.log'
      if (-not (Test-Path (Split-Path $log))) { New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null }
      Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', "call `"$apiCmd`" >> `"$log`" 2>&1") -WorkingDirectory $apiDir -WindowStyle Hidden | Out-Null
    }
  }
  Start-Sleep -Seconds 3
}

$apiUpstream = 'https://127.0.0.1:4000'
$apiTls = $true
if (-not (Test-LocalHealth 'https://127.0.0.1:4000/api/health')) {
  if (Test-LocalHealth 'http://127.0.0.1:4000/api/health') {
    $apiUpstream = 'http://127.0.0.1:4000'
    $apiTls = $false
    Write-Host 'API upstream: HTTP (sin TLS local)' -ForegroundColor Yellow
  } else {
    Write-Host 'AVISO: API :4000 no responde health; Caddy usara HTTPS upstream' -ForegroundColor Yellow
  }
} else {
  Write-Host 'API upstream: HTTPS (TLS local OK)' -ForegroundColor Green
}

$webUpstream = 'https://127.0.0.1:5173'
$webTls = $true
if (-not (Test-LocalHealth 'https://127.0.0.1:5173/')) {
  if (Test-LocalHealth 'http://127.0.0.1:5173/') {
    $webUpstream = 'http://127.0.0.1:5173'
    $webTls = $false
    Write-Host 'Web upstream: HTTP' -ForegroundColor Yellow
  }
} else {
  Write-Host 'Web upstream: HTTPS' -ForegroundColor Green
}

$tlsTransport = @"
transport http {
				tls_insecure_skip_verify
			}
"@
$tplPath = Join-Path $PSScriptRoot 'Caddyfile.edge.template'
if (-not (Test-Path $tplPath)) { $tplPath = $caddyfile }
$cfg = Get-Content -Raw $tplPath
$cfg = $cfg -replace '# PLACEHOLDER_API_TRANSPORT', $(if ($apiTls) { $tlsTransport } else { '' })
$cfg = $cfg -replace '# PLACEHOLDER_WEB_TRANSPORT', $(if ($webTls) { $tlsTransport } else { '' })
if ($lan6) {
  $cfg = $cfg -replace '\$\{PUBLIC_LAN_IPV6\}', "[$lan6]"
} else {
  $cfg = $cfg -replace '\$\{PUBLIC_LAN_IPV6\},\s*', ''
}
if (-not $lan) {
  # Sin LAN: quitar bloque de IP (evita {$PUBLIC_LAN_IP} vacío).
  $cfg = [regex]::Replace($cfg, '(?ms)\r?\n# Acceso por IP LAN.*\z', "`n")
}
$activeCaddy = Join-Path $caddyDir 'Caddyfile.edge.active'
Set-Content -Path $activeCaddy -Value $cfg -Encoding UTF8

$launch = Join-Path $caddyDir 'run-edge.cmd'
$launchLines = @(
  '@echo off'
  "set PUBLIC_DOMAIN=$Domain"
  "set API_UPSTREAM=$apiUpstream"
  "set WEB_UPSTREAM=$webUpstream"
)
if ($lan) {
  $launchLines += "set PUBLIC_LAN_IP=$lan"
}
if ($lan6) {
  $launchLines += "set PUBLIC_LAN_IPV6=[$lan6]"
}
if ($Email) {
  $launchLines += "set CADDY_ACME_EMAIL=$Email"
}
$launchLines += @(
  "cd /d `"$caddyDir`""
  "`"$caddy`" run --config `"$activeCaddy`" --adapter caddyfile > `"$caddyDir\caddy.out.log`" 2>&1"
)
Set-Content -Path $launch -Value $launchLines -Encoding ASCII

Write-Host 'Arrancando Caddy (ACME 30-90s)...' -ForegroundColor Cyan
Start-Process -FilePath $launch -WorkingDirectory $caddyDir -WindowStyle Minimized

$okLocal = $false
$okWan = $false
for ($i = 0; $i -lt 18; $i++) {
  Start-Sleep -Seconds 5
  if (Test-TpxLocalEdgeHealth -Domain $Domain -LanIp $lan) {
    $okLocal = $true
    Write-Host ("try {0}: LOCAL edge OK (--resolve / LAN)" -f ($i + 1)) -ForegroundColor Green
    break
  }
  $code = & curl.exe -sk --connect-timeout 8 -o NUL -w '%{http_code}' "https://$Domain/api/health" 2>$null
  Write-Host ("try {0}: https://{1}/api/health -> {2}" -f ($i + 1), $Domain, $code)
  if ($code -eq '200') { $okLocal = $true; $okWan = $true; break }
}

if (-not $okWan -and $okLocal) {
  $wanCode = & curl.exe -sk --connect-timeout 6 --max-time 10 -o NUL -w '%{http_code}' "https://$Domain/api/health" 2>$null
  if ($wanCode -eq '200') { $okWan = $true }
}

Write-Host ''
if ($okLocal -and $okWan) {
  Write-Host 'LISTO borde HTTPS (local + WAN)' -ForegroundColor Green
} elseif ($okLocal) {
  Write-Host 'LOCAL edge OK (Caddy + cert). WAN/4G NO verificado.' -ForegroundColor Yellow
  if (-not $upnpOk) {
    Write-Host "Falta UPnP/port-forward: en el router abre TCP 80 y 443 -> $lan" -ForegroundColor Red
    Write-Host 'Sin eso la APK en datos moviles falla (No route to host).' -ForegroundColor Red
  } else {
    Write-Host 'UPnP mapeo OK pero hairpin/WAN puede tardar; prueba desde 4G.' -ForegroundColor Yellow
  }
} else {
  Write-Host 'FALLO: Caddy no responde health local - revisa caddy.out.log' -ForegroundColor Red
}
Write-Host "Consola: $origin"
Write-Host "API:     $origin/api/health"
Write-Host "APK:     API_BASE=$origin"
if ($lan) {
  Write-Host "LAN:     https://$lan  (aceptar aviso de certificado interno)" -ForegroundColor Cyan
}
Write-Host 'Guia:    Soporte\Documentos\DOMINIO_Y_CERTIFICADO.md'

Set-Content -Path (Join-Path $caddyDir 'RESTART-API.flag') -Value '1' -Encoding ascii

Write-Host 'Reiniciando LiveKit con node-ip alineado...' -ForegroundColor Cyan
if (Restart-TpxLiveKit -Root $root -PublicIp $publicIp) {
  Write-Host "LiveKit OK node-ip=$publicIp" -ForegroundColor Green
} else {
  Write-Host 'LiveKit: no arranco tras edge - ejecuta infra\start-services.ps1' -ForegroundColor Yellow
}

# Exit codes: 0 = local+wan | 0 with warning if only local (APK LAN ok) | 2 = local fail | 3 = local ok but no UPnP
if (-not $okLocal) { exit 2 }
if ($okLocal -and -not $upnpOk -and -not $okWan) { exit 3 }
exit 0
