# Sincroniza IP publica, .env, livekit.dev.yaml, DuckDNS (dominio estable) y LiveKit ICE.
# Dot-source: . (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

function Get-TpxRepoRoot {
  param([string]$Hint = $PSScriptRoot)
  foreach ($cand in @(
    (Split-Path -Parent $Hint),
    'C:\pulsanet',
    'D:\pulsanet'
  )) {
    if ($cand -and (Test-Path (Join-Path $cand 'backend\package.json'))) {
      return (Resolve-Path $cand).Path
    }
  }
  return (Split-Path -Parent $Hint)
}

function Get-TpxCurrentPublicIp {
  try {
    $ip = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim()
    if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { return $ip }
  } catch {}
  return $null
}

function Get-TpxStoredPublicIp {
  param([string]$Root)
  $ipFile = Join-Path $Root 'infra\caddy\public-ip.txt'
  if (Test-Path $ipFile) {
    $ip = (Get-Content $ipFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { return $ip }
  }
  $envFile = Join-Path $Root 'backend\.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -ErrorAction SilentlyContinue) {
      if ($line -match '^LIVEKIT_PUBLIC_HOST=(.+)$') {
        $v = $Matches[1].Trim().Trim('"').Trim("'")
        if ($v -match '^\d{1,3}(\.\d{1,3}){3}$') { return $v }
      }
    }
  }
  return $null
}

function Get-TpxEnvValue {
  param(
    [string]$Root,
    [string]$Key
  )
  $files = @(
    (Join-Path $Root 'infra\secrets\stable-domain.env'),
    (Join-Path $Root 'Soporte\Secrets\stable-domain.env'),
    (Join-Path $Root 'backend\.env')
  )
  foreach ($envFile in $files) {
    if (-not (Test-Path $envFile)) { continue }
    foreach ($line in Get-Content $envFile -ErrorAction SilentlyContinue) {
      if ($line -match "^$([regex]::Escape($Key))=(.*)$") {
        $v = $Matches[1].Trim().Trim('"').Trim("'")
        if ($v) { return $v }
      }
    }
  }
  return $null
}

function Get-TpxPublicDomainFromEnv {
  param([string]$Root)
  return Get-TpxEnvValue -Root $Root -Key 'PUBLIC_DOMAIN'
}

# Dominio permanente (DuckDNS u otro). No cambia cuando el ISP rota la IP.
function Get-TpxStablePublicDomain {
  param([string]$Root = (Get-TpxRepoRoot))
  $stable = Get-TpxEnvValue -Root $Root -Key 'STABLE_PUBLIC_DOMAIN'
  if ($stable) { return $stable.ToLowerInvariant() }
  $file = Join-Path $Root 'infra\caddy\stable-domain.txt'
  if (Test-Path $file) {
    $v = (Get-Content $file -Raw -ErrorAction SilentlyContinue).Trim()
    if ($v) { return $v.ToLowerInvariant() }
  }
  return $null
}

function Get-TpxPreferredPublicDomain {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [string]$PublicIp = ''
  )
  $stable = Get-TpxStablePublicDomain -Root $Root
  if ($stable) { return $stable }
  if (-not $PublicIp) { $PublicIp = Get-TpxCurrentPublicIp }
  if ($PublicIp) { return "$PublicIp.sslip.io" }
  return Get-TpxPublicDomainFromEnv -Root $Root
}

function Get-TpxLiveKitYamlNodeIp {
  param([string]$Root)
  $lkYaml = Join-Path $Root 'infra\livekit.dev.yaml'
  if (-not (Test-Path $lkYaml)) { return $null }
  $yk = Get-Content $lkYaml -Raw -ErrorAction SilentlyContinue
  if ($yk -match '(?m)^\s*node_ip:\s*(\S+)') {
    return $Matches[1].Trim().Trim('"').Trim("'")
  }
  return $null
}

function Test-TpxPublicIpDrift {
  param([string]$Root = (Get-TpxRepoRoot))
  $current = Get-TpxCurrentPublicIp
  if (-not $current) {
    return [ordered]@{ Drift = $false; Reason = 'no-ipify'; Current = $null; Stored = $null }
  }
  $stored = Get-TpxStoredPublicIp -Root $Root
  $yamlIp = Get-TpxLiveKitYamlNodeIp -Root $Root
  if (-not $stored) {
    return [ordered]@{ Drift = $true; Reason = 'no-stored'; Current = $current; Stored = $null; YamlIp = $yamlIp }
  }
  if ($current -ne $stored) {
    return [ordered]@{ Drift = $true; Reason = 'ip-changed'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
  }
  if ($yamlIp -and $yamlIp -ne $current) {
    return [ordered]@{ Drift = $true; Reason = 'yaml-stale'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
  }
  return [ordered]@{ Drift = $false; Reason = 'ok'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
}

function Set-TpxEnvValue {
  param(
    [string]$EnvFile,
    [string]$Key,
    [string]$Value
  )
  if (-not (Test-Path $EnvFile)) {
    $dir = Split-Path $EnvFile -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content $EnvFile "$Key=$Value" -Encoding UTF8
    return
  }
  $lines = @(Get-Content $EnvFile)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") { $found = $true; "$Key=$Value" } else { $line }
  }
  if (-not $found) { $out += "$Key=$Value" }
  Set-Content $EnvFile $out -Encoding UTF8
}

function Sync-TpxLiveKitYaml {
  param(
    [string]$Root,
    [string]$PublicIp
  )
  if (-not $PublicIp) { return $false }
  $lkYaml = Join-Path $Root 'infra\livekit.dev.yaml'
  if (-not (Test-Path $lkYaml)) { return $false }
  $yk = Get-Content $lkYaml -Raw
  $yk2 = $yk
  $yk2 = [regex]::Replace($yk2, '(?m)^(\s*node_ip:\s*).+$', "`${1}$PublicIp")
  $yk2 = [regex]::Replace($yk2, '(?m)^(\s*domain:\s*).+$', "`${1}$PublicIp")
  if ($yk2 -ne $yk) {
    Set-Content -Path $lkYaml -Value $yk2 -NoNewline -Encoding UTF8
    return $true
  }
  return $false
}

# Actualiza registro A en DuckDNS (ancla permanente para el APK).
function Update-TpxDuckDns {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [string]$PublicIp = ''
  )
  if (-not $PublicIp) { $PublicIp = Get-TpxCurrentPublicIp }
  if (-not $PublicIp) { return $false }

  $token = Get-TpxEnvValue -Root $Root -Key 'DUCKDNS_TOKEN'
  $sub = Get-TpxEnvValue -Root $Root -Key 'DUCKDNS_SUBDOMAIN'
  if (-not $token -or -not $sub) { return $false }

  $sub = $sub.Trim().ToLowerInvariant() -replace '\.duckdns\.org$', ''
  try {
    $fqdn = "$sub.duckdns.org"
    $aaaa = $null
    try {
      $aaaa = @(Resolve-DnsName -Name $fqdn -Type AAAA -Server 8.8.8.8 -DnsOnly -ErrorAction SilentlyContinue |
        Where-Object { $_.Type -eq 'AAAA' -or $_.IPAddress })
    } catch {}
    # `&ipv6=` vacío NO borra un AAAA ya publicado. clear=true sí, luego reponer A.
    if ($aaaa -and $aaaa.Count -gt 0) {
      $clearUrl = "https://www.duckdns.org/update?domains=$sub&token=$token&clear=true"
      $null = & curl.exe -4 -s --max-time 15 $clearUrl 2>$null
    }
    $url = "https://www.duckdns.org/update?domains=$sub&token=$token&ip=$PublicIp"
    $resp = (& curl.exe -4 -s --max-time 15 $url 2>$null).ToString().Trim()
    if ($resp -eq 'OK') {
      Write-Host "DuckDNS OK: $fqdn -> $PublicIp (sin AAAA)" -ForegroundColor Green
      return $true
    }
    Write-Host "DuckDNS respuesta: $resp" -ForegroundColor Yellow
  } catch {
    Write-Host "DuckDNS error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  return $false
}

function Sync-TpxApkApiBaseHint {
  param(
    [string]$Root,
    [string]$Origin
  )
  if (-not $Origin) { return }
  $hint = Join-Path $Root 'infra\caddy\apk-api-base.txt'
  $dir = Split-Path $hint -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $hint -Value $Origin.TrimEnd('/') -Encoding ascii
}

function Sync-TpxMobileConfigDefault {
  param(
    [string]$Root,
    [string]$Origin
  )
  if (-not $Origin) { return $false }
  $cfg = Join-Path $Root 'mobile\lib\config.dart'
  if (-not (Test-Path $cfg)) { return $false }
  $raw = Get-Content $cfg -Raw
  $escaped = $Origin.TrimEnd('/')
  $next = [regex]::Replace(
    $raw,
    "defaultValue:\s*'https?://[^']+'",
    "defaultValue: '$escaped'"
  )
  if ($next -eq $raw) { return $false }
  Set-Content -Path $cfg -Value $next -NoNewline -Encoding UTF8
  Write-Host "mobile/lib/config.dart default -> $escaped" -ForegroundColor Green
  return $true
}

function Sync-TpxPublicEnv {
  param(
    [string]$Root,
    [string]$PublicIp,
    [string]$Domain = ''
  )
  if (-not $PublicIp) { return $false }
  [void](Update-TpxDuckDns -Root $Root -PublicIp $PublicIp)
  if (-not $Domain) {
    $Domain = Get-TpxPreferredPublicDomain -Root $Root -PublicIp $PublicIp
  }
  $envFile = Join-Path $Root 'backend\.env'
  $origin = "https://$Domain"
  Set-TpxEnvValue -EnvFile $envFile -Key 'PUBLIC_HOST' -Value $PublicIp
  Set-TpxEnvValue -EnvFile $envFile -Key 'PUBLIC_DOMAIN' -Value $Domain
  Set-TpxEnvValue -EnvFile $envFile -Key 'WEB_PUBLIC_URL' -Value $origin
  Set-TpxEnvValue -EnvFile $envFile -Key 'LIVEKIT_PUBLIC_HOST' -Value $PublicIp
  Set-TpxEnvValue -EnvFile $envFile -Key 'LIVEKIT_PUBLIC_URL' -Value "wss://$Domain"
  $stable = Get-TpxStablePublicDomain -Root $Root
  if ($stable) {
    Set-TpxEnvValue -EnvFile $envFile -Key 'STABLE_PUBLIC_DOMAIN' -Value $stable
  }
  $ipFile = Join-Path $Root 'infra\caddy\public-ip.txt'
  $ipDir = Split-Path $ipFile -Parent
  if (-not (Test-Path $ipDir)) { New-Item -ItemType Directory -Force -Path $ipDir | Out-Null }
  Set-Content -Path $ipFile -Value $PublicIp -Encoding ascii
  Sync-TpxApkApiBaseHint -Root $Root -Origin $origin
  [void](Sync-TpxLiveKitYaml -Root $Root -PublicIp $PublicIp)
  # Solo reescribe default del APK si hay ancla estable (evita churn git en cada IP).
  if ($stable) {
    [void](Sync-TpxMobileConfigDefault -Root $Root -Origin $origin)
  }
  return $true
}

function Restart-TpxLiveKit {
  param(
    [string]$Root,
    [string]$PublicIp
  )
  $lk = Join-Path $Root 'infra\livekit\livekit-server.exe'
  if (-not (Test-Path $lk)) { return $false }
  & taskkill.exe /F /IM livekit-server.exe 2>$null | Out-Null
  Start-Sleep -Milliseconds 600
  $lkCfg = Join-Path $Root 'infra\livekit.dev.yaml'
  $lkArgs = @('--dev', '--bind', '0.0.0.0', '--udp-port', '7882')
  if (Test-Path $lkCfg) {
    $lkArgs = @('--config', $lkCfg, '--dev', '--udp-port', '7882')
  }
  if ($PublicIp) { $lkArgs += @('--node-ip', $PublicIp) }
  Start-Process -FilePath $lk -ArgumentList $lkArgs -WorkingDirectory (Split-Path $lk) -WindowStyle Hidden
  Start-Sleep -Milliseconds 500
  return [bool](Get-Process -Name livekit-server -ErrorAction SilentlyContinue)
}

function Invoke-TpxPublicIpRealign {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [switch]$FullEdge
  )
  $current = Get-TpxCurrentPublicIp
  if (-not $current) {
    Write-Host 'Sync-PublicIp: no se pudo obtener IP publica (ipify)' -ForegroundColor Yellow
    return $false
  }
  if ($FullEdge) {
    $edge = Join-Path $Root 'infra\START-PUBLIC-EDGE.ps1'
    if (-not (Test-Path $edge)) { return $false }
    $stable = Get-TpxStablePublicDomain -Root $Root
    if ($stable) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge -Domain $stable
    } else {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge
    }
    return ($LASTEXITCODE -eq 0)
  }
  [void](Sync-TpxPublicEnv -Root $Root -PublicIp $current)
  $ok = Restart-TpxLiveKit -Root $Root -PublicIp $current
  if ($ok) {
    $dom = Get-TpxPreferredPublicDomain -Root $Root -PublicIp $current
    Write-Host "Sync-PublicIp: alineado node-ip=$current domain=$dom (LiveKit reiniciado)" -ForegroundColor Green
  }
  return $ok
}

# --- LAN preferida: host estable por Ethernet (cable); mesh/Wi‑Fi solo si no hay cable ---
function Get-TpxPreferredLanIp {
  $ips = New-Object System.Collections.Generic.List[string]
  try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -like '192.168.*' -and
        $_.PrefixOrigin -ne 'WellKnown' -and
        $_.IPAddress -notlike '169.254.*'
      } |
      ForEach-Object { [void]$ips.Add($_.IPAddress) }
  } catch {}
  if ($ips.Count -eq 0) {
    foreach ($line in (& ipconfig.exe 2>$null)) {
      if ($line -match 'IPv4.*:\s*(192\.168\.\d+\.\d+)') {
        [void]$ips.Add($Matches[1])
      }
    }
  }
  # 1) Ethernet cableado (política host: LAN fija, no Wi‑Fi del PC).
  try {
    $eth = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet' -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -like '192.168.*' -and
        $_.IPAddress -notlike '169.254.*'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($eth) { return $eth }
  } catch {}
  # 2) Cualquier 192.168.1.x (LAN ISP típica del cable).
  $isp = $ips | Where-Object { $_ -like '192.168.1.*' } | Select-Object -First 1
  if ($isp) { return $isp }
  # 3) Mesh Deco solo si el host está cableado ahí (sin Ethernet 1.x). Legacy.
  # Preferir Set-StableLanIp (192.168.1.77) en el PC servidor.
  if ($ips -contains '192.168.68.58') { return '192.168.68.58' }
  if ($ips -contains '192.168.68.51') { return '192.168.68.51' }
  $mesh = $ips | Where-Object { $_ -like '192.168.68.*' } | Select-Object -First 1
  if ($mesh) { return $mesh }
  return ($ips | Select-Object -First 1)
}

function Get-TpxPreferredLanIpv6 {
  try {
    $dhcp = Get-NetIPAddress -AddressFamily IPv6 -InterfaceAlias 'Ethernet' -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike 'fe80*' -and $_.PrefixOrigin -eq 'Dhcp' } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($dhcp) { return $dhcp }
    $stable = Get-NetIPAddress -AddressFamily IPv6 -InterfaceAlias 'Ethernet' -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike 'fe80*' -and $_.SuffixOrigin -ne 'Random' } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($stable) { return $stable }
  } catch {}
  return $null
}

function Start-TpxUPnPServices {
  foreach ($name in @('SSDPSRV', 'upnphost')) {
    try {
      $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
      if (-not $svc) { continue }
      if ($svc.StartType -eq 'Disabled') {
        Set-Service -Name $name -StartupType Manual -ErrorAction SilentlyContinue
      }
      if ($svc.Status -ne 'Running') {
        Start-Service -Name $name -ErrorAction SilentlyContinue
      }
    } catch {}
  }
  Start-Sleep -Milliseconds 800
}

# $true si hay colección IGD; $false si router no expone UPnP.
function Test-TpxUPnPAvailable {
  Start-TpxUPnPServices
  try {
    $nat = New-Object -ComObject HNetCfg.NATUPnP
    if ($null -ne $nat.StaticPortMappingCollection) { return $true }
  } catch {}
  # Fallback: SSDP encuentra IGD aunque COM falle (Deco / dual-NIC)
  try {
    . (Join-Path $PSScriptRoot 'Soap-UPnP.ps1')
    $igds = @(Get-TpxIgds)
    return ($igds.Count -gt 0)
  } catch {
    return $false
  }
}

# Health del borde SIN depender de hairpin NAT (resolve a LAN o 127.0.0.1).
function Test-TpxLocalEdgeHealth {
  param(
    [string]$Domain,
    [string]$LanIp = ''
  )
  if (-not $Domain) { return $false }
  $targets = @()
  if ($LanIp) { $targets += $LanIp }
  $targets += '127.0.0.1'
  foreach ($ip in $targets) {
    $code = & curl.exe -sk --connect-timeout 5 --max-time 10 `
      --resolve "${Domain}:443:${ip}" `
      -o NUL -w '%{http_code}' "https://${Domain}/api/health" 2>$null
    if ($code -eq '200') { return $true }
    $code = & curl.exe -sk --connect-timeout 4 --max-time 8 `
      -H "Host: $Domain" `
      -o NUL -w '%{http_code}' "https://${ip}/api/health" 2>$null
    if ($code -eq '200') { return $true }
  }
  return $false
}

# Estado resumido del borde (local vs WAN/UPnP).
function Get-TpxEdgeStatus {
  param(
    [string]$Root = (Get-TpxRepoRoot)
  )
  $dom = Get-TpxPublicDomainFromEnv -Root $Root
  if (-not $dom) { $dom = Get-TpxStablePublicDomain -Root $Root }
  $lan = Get-TpxPreferredLanIp
  $caddyUp = [bool](Get-Process -Name caddy -ErrorAction SilentlyContinue)
  $listen443 = $false
  try {
    $listen443 = [bool](& netstat.exe -ano 2>$null | Select-String -Pattern 'LISTENING' | Select-String -Pattern ':443\s')
  } catch {}
  $localOk = $false
  if ($dom -and ($caddyUp -or $listen443)) {
    $localOk = Test-TpxLocalEdgeHealth -Domain $dom -LanIp $lan
  }
  $upnp = Test-TpxUPnPAvailable
  $wanCode = '000'
  if ($dom) {
    $wanCode = & curl.exe -sk --connect-timeout 6 --max-time 10 `
      -o NUL -w '%{http_code}' "https://${dom}/api/health" 2>$null
  }
  return [pscustomobject]@{
    Domain     = $dom
    LanIp      = $lan
    Caddy      = $caddyUp
    Listen443  = $listen443
    LocalOk    = $localOk
    UPnP       = $upnp
    WanCode    = $wanCode
    WanOk      = ($wanCode -eq '200')
  }
}
