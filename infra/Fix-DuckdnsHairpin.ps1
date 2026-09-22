# Solo hosts locales para el PC (navegador). NO asigna IP fija al NIC
# (eso rompe internet / DHCP). El APK hace bypass hairpin solo.
# Actualiza la entrada del dominio DuckDNS a la LAN actual (Ethernet 1.x preferida).
param(
  [string]$LanIp = '',
  [string]$Domain = 'pulsanet.duckdns.org'
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = ($Domain.Trim().ToLowerInvariant() -replace '^https?://', '' -replace '/.*$', '')
if (-not $marker) { $marker = 'pulsanet.duckdns.org' }

$lan = $LanIp
if (-not $lan) { $lan = Get-TpxPreferredLanIp }
if (-not $lan) { $lan = '127.0.0.1' }
$line = "$lan $marker"

try {
  $raw = Get-Content -Path $hostsPath -ErrorAction Stop
} catch {
  Write-Host "Fix-DuckdnsHairpin: no se pudo leer hosts - $($_.Exception.Message)" -ForegroundColor Yellow
  exit 1
}

$out = @()
foreach ($l in $raw) {
  if ($l -match [regex]::Escape($marker)) { continue }
  $out += $l
}
$out += $line

$prev = ($raw | Where-Object { $_ -match [regex]::Escape($marker) } | Select-Object -First 1)
if ($prev -eq $line) {
  Write-Host "OK hosts ya apunta a $lan ($marker)"
} else {
  try {
    Set-Content -Path $hostsPath -Value $out -Encoding ASCII -ErrorAction Stop
    Write-Host "OK hosts → $lan ($marker)" -ForegroundColor Green
  } catch {
    Write-Host "Fix-DuckdnsHairpin: sin permiso para escribir hosts (ejecuta como Admin): $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
  }
}

try { ipconfig /flushdns | Out-Null } catch {}

try {
  $code = & curl.exe -sk --connect-timeout 8 -o NUL -w '%{http_code}' "https://$marker/api/health"
  Write-Host "health $code"
} catch {}
exit 0
