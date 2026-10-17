<#
  Restablece acceso WAN (4G) a la VM SICOM cuando el router solo deja UPnP
  hacia la PC (no a .150).

  1) UPnP 80/443 (+ LiveKit media TCP/UDP) -> IP LAN de ESTA PC
  2) netsh portproxy TCP 443 (y 80 si libre) -> 192.168.1.150
  3) Regla firewall TCP 443

  Uso (Admin recomendado):
    powershell -File infra\ENSURE-SICOM-WAN.ps1
#>
param(
  [string]$VmIp = '192.168.1.150'
)
$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
. (Join-Path $here 'Sync-PublicIp.ps1')
. (Join-Path $here 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -Quiet -DisableLegacy

Write-Host '=== ENSURE-SICOM-WAN (UPnP PC + portproxy -> VM) ===' -ForegroundColor Cyan

# 1) UPnP hacia esta PC (el IGD suele rechazar InternalClient ajeno).
& (Join-Path $here 'Reinforce-UPnP.ps1')
$upnpCode = $LASTEXITCODE

$lan = Get-TpxPreferredLanIp
Write-Host "PC LAN=$lan  VM=$VmIp"

# 2) Portproxy TCP hacia la VM (HTTPS / API / señal LiveKit por Caddy).
foreach ($port in @(443, 80)) {
  $listenBusy = [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -gt 4 })
  if ($port -eq 80 -and $listenBusy) {
    Write-Host "Puerto 80 ocupado en PC (p.ej. Laragon): sin portproxy 80. Usa 443." -ForegroundColor Yellow
    continue
  }
  netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
  netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$VmIp | Out-Null
  Write-Host "portproxy 0.0.0.0:$port -> ${VmIp}:$port" -ForegroundColor Green
}

netsh advfirewall firewall delete rule name='TacticalPtx-PortProxy-443' 2>$null | Out-Null
netsh advfirewall firewall add rule name='TacticalPtx-PortProxy-443' dir=in action=allow protocol=TCP localport=443 | Out-Null

Start-Sleep -Seconds 1
$code = & curl.exe -sk --connect-timeout 10 -o NUL -w '%{http_code}' --resolve "pulsanet.duckdns.org:443:$lan" 'https://pulsanet.duckdns.org/api/health' 2>$null
Write-Host "Health via PC LAN ($lan) -> HTTP $code"
if ($code -eq '200') {
  Write-Host 'LISTO: APK en 4G debe usar https://pulsanet.duckdns.org' -ForegroundColor Green
} else {
  Write-Host 'Aviso: health via PC no fue 200. Revisa Caddy en la VM y el portproxy (Admin).' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Nota LiveKit media (UDP 7882/3478): UPnP apunta a la PC; si el audio 4G falla,'
Write-Host "  configura en el router reenvio UDP 7882 y 3478 -> $VmIp (manual)."
if ($upnpCode -ne 0) { exit $upnpCode }
exit 0
