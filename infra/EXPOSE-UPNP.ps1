# TacticalPtx — firewall Windows + UPnP (reenvío virtual en el router)
# Ejecutar en la PC del servidor. Preferible como Administrador.
# No instala nada en el celular: solo la APK apunta a https://IP_PUBLICA:4000

$ErrorActionPreference = 'Continue'

function Get-LanIPv4 {
 $ip = Get-NetIPAddress -AddressFamily IPv4 |
 Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
 Select-Object -ExpandProperty IPAddress -First 1
 if (-not $ip) {
 $ip = Get-NetIPAddress -AddressFamily IPv4 |
 Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
 Select-Object -ExpandProperty IPAddress -First 1
 }
 return $ip
}

Write-Host "=== TacticalPtx · firewall + UPnP (4G/5G) ===" -ForegroundColor Cyan
$lan = Get-LanIPv4
if (-not $lan) { throw 'No se detectó IP LAN' }
Write-Host "LAN: $lan"

# --- Firewall canónico (misma fuente que LEVANTAR / Ensure-Firewall.ps1) ---
. (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -DisableLegacy

# --- UPnP (reenvio virtual en el router) ---
$upnpOk = $false
try {
 $nat = New-Object -ComObject HNetCfg.NATUPnP
 $col = $nat.StaticPortMappingCollection
 if ($null -eq $col) { throw 'UPnP no disponible (activa UPnP/IGD en el router)' }

 $maps = @(
 @{ Ext = 4000; Proto = 'TCP'; Desc = 'TacticalPtx-API' }
 @{ Ext = 5173; Proto = 'TCP'; Desc = 'TacticalPtx-Web' }
 @{ Ext = 7880; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-Signal' }
 @{ Ext = 7881; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-RTC' }
 @{ Ext = 7882; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-Media' }
 @{ Ext = 3478; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-TURN' }
 )
 foreach ($m in $maps) {
 try { $col.Remove([int]$m.Ext, $m.Proto) } catch {}
 $col.Add([int]$m.Ext, $m.Proto, [int]$m.Ext, $lan, $true, $m.Desc) | Out-Null
 Write-Host "UPnP OK $($m.Proto)/$($m.Ext) -> ${lan}:$($m.Ext)" -ForegroundColor Green
 $upnpOk = $true
 }
} catch {
 Write-Host "UPnP FALLO: $($_.Exception.Message)" -ForegroundColor Red
 Write-Host "Configura reenvio manual en el router o activa UPnP." -ForegroundColor Yellow
}

$public = $null
try { $public = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 10).Trim() } catch {}
if ($public) {
 Write-Host "IP pública: $public" -ForegroundColor Cyan
 if ($public -match '^(10\.|100\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)') {
 Write-Host "AVISO: parece CGNAT — 4G puede fallar." -ForegroundColor Red
 }
 Start-Sleep -Seconds 1
 $code = curl.exe -sk --connect-timeout 12 -o NUL -w "%{http_code}" "https://${public}:4000/api/health"
 Write-Host "Health pública HTTPS: $code"
 if ($code -eq '200') {
 Write-Host ""
 Write-Host "LISTO para 4G/5G. APK:" -ForegroundColor Green
 Write-Host " set API_BASE=https://${public}:4000"
 Write-Host " D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd"
 Write-Host " Health: https://${public}:4000/api/health"
 Write-Host " Consola web remota (PTT/mic): https://${public}:5173"
 Write-Host " (aceptar certificado autofirmado en el navegador)"
 } else {
 Write-Host "Aun no responde desde Internet (ISP/firewall/UPnP)." -ForegroundColor Yellow
 }
}

if (-not $upnpOk) { exit 2 }
