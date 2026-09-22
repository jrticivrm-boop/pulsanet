# TacticalPtx — firewall Windows + UPnP (reenvío virtual en el router)
# Ejecutar en la PC del servidor. Preferible como Administrador.
# Preferir START-PUBLIC-EDGE / Reinforce-UPnP (LAN canónica Ethernet .1.x).
# APK en 4G: https://PUBLIC_DOMAIN (Caddy :443), no abrir :4000/:5173 a Internet.
# Override completo (dev): $env:TPX_UPNP_FULL='1'

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

Write-Host "=== TacticalPtx · firewall + UPnP (4G/5G) ===" -ForegroundColor Cyan
$lan = Get-TpxPreferredLanIp
if (-not $lan) { throw 'No se detectó IP LAN' }
Write-Host "LAN: $lan"

# Misma política que Reinforce-UPnP (edge + media; sin API/Web directos).
& (Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1')
$upnpOk = ($LASTEXITCODE -eq 0)

$public = $null
try { $public = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 10).Trim() } catch {}
$domain = Get-TpxPublicDomainFromEnv -Root (Split-Path $PSScriptRoot -Parent)
if (-not $domain) { $domain = 'pulsanet.duckdns.org' }

if ($public) {
  Write-Host "IP pública: $public" -ForegroundColor Cyan
  if ($public -match '^(10\.|100\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)') {
    Write-Host "AVISO: parece CGNAT — 4G puede fallar." -ForegroundColor Red
  }
}

Start-Sleep -Seconds 1
$code = & curl.exe -sk --connect-timeout 12 -o NUL -w '%{http_code}' "https://$domain/api/health" 2>$null
Write-Host "Health publico https://$domain/api/health -> $code"
if ($code -eq '200') {
  Write-Host ""
  Write-Host "LISTO para 4G/5G. APK:" -ForegroundColor Green
  Write-Host " set API_BASE=https://$domain"
  Write-Host " Health: https://$domain/api/health"
  Write-Host " Consola: https://$domain"
} else {
  Write-Host "Aun no responde health WAN (ISP/firewall/hairpin). Prueba LOCAL o 4G." -ForegroundColor Yellow
}

if (-not $upnpOk) { exit 2 }
exit 0
