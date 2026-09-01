# TacticalPtx — preparar acceso por IP pública (sin Tailscale)
# Ejecutar como Administrador.

$ErrorActionPreference = 'Stop'

Write-Host "=== TacticalPtx · exposición directa ===" -ForegroundColor Cyan

function Get-LanIPv4 {
 Get-NetIPAddress -AddressFamily IPv4 |
 Where-Object {
 $_.IPAddress -like '192.168.*' -and
 $_.PrefixOrigin -ne 'WellKnown'
 } |
 Select-Object -ExpandProperty IPAddress -First 1
}

$lan = Get-LanIPv4
if (-not $lan) {
 $lan = (Get-NetIPAddress -AddressFamily IPv4 |
 Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
 Select-Object -ExpandProperty IPAddress -First 1)
}

Write-Host "IP LAN (PC): $lan"

$public = $null
try {
 $public = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim()
} catch {
 try {
 $public = (Invoke-RestMethod -Uri 'https://ifconfig.me/ip' -TimeoutSec 8).ToString().Trim()
 } catch {
 Write-Host "No se pudo consultar IP pública (sin Internet o bloqueado)." -ForegroundColor Yellow
 }
}

if ($public) {
 Write-Host "IP pública (vista desde Internet): $public" -ForegroundColor Green
 if ($public -match '^(10\.|100\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)') {
 Write-Host "AVISO: parece CGNAT / privada. El reenvío desde 4G probablemente NO funcione." -ForegroundColor Red
 }
}

. (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -DisableLegacy

Write-Host ""
Write-Host "En el ROUTER, reenvia a $lan :" -ForegroundColor Cyan
 Write-Host " TCP 4000 -> $lan:4000 (API HTTPS)"
 Write-Host " TCP 5173 -> $lan:5173 (Web Vite HTTPS — PTT/mic requiere HTTPS)"
 Write-Host " TCP 7880 -> $lan:7880 (LiveKit senal)"
 Write-Host " TCP 7881 -> $lan:7881 (LiveKit RTC TCP)"
 Write-Host " UDP 7882 -> $lan:7882 (LiveKit media)"
 Write-Host ""
 if ($public) {
 Write-Host "APK / prueba 4G (HTTPS si TLS está activo):" -ForegroundColor Green
 Write-Host " set API_BASE=https://${public}:4000"
 Write-Host " D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd"
 Write-Host " Health: https://${public}:4000/api/health"
 Write-Host " Consola web remota (PTT): https://${public}:5173"
 Write-Host " (cert autofirmado: aceptar excepción en el navegador; regenerar con"
 Write-Host "  node infra/generate-lan-certs.mjs $lan $public)"
 } else {
 Write-Host "Cuando sepas la IP pública del modem:" -ForegroundColor Yellow
 Write-Host " set API_BASE=https://IP_PUBLICA:4000"
}
Write-Host ""
Write-Host "Guía: D:\pulsanet\Soporte\Documentos\ACCESO_DIRECTO_SIN_TAILSCALE.md"
Write-Host ""
pause
