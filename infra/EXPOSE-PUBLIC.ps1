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

$portsTcp = @(4000, 7880, 7881)
$portsUdp = @(7882)

foreach ($p in $portsTcp) {
  $name = "TacticalPtx-TCP-$p"
  if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p | Out-Null
    Write-Host "Firewall TCP $p OK" -ForegroundColor Green
  } else {
    Write-Host "Firewall TCP $p ya existe"
  }
}
foreach ($p in $portsUdp) {
  $name = "TacticalPtx-UDP-$p"
  if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol UDP -LocalPort $p | Out-Null
    Write-Host "Firewall UDP $p OK" -ForegroundColor Green
  } else {
    Write-Host "Firewall UDP $p ya existe"
  }
}

Write-Host ""
Write-Host "En el ROUTER, reenvía a $lan :" -ForegroundColor Cyan
Write-Host "  TCP 4000  -> $lan:4000   (API)"
Write-Host "  TCP 7880  -> $lan:7880   (LiveKit señal)"
Write-Host "  TCP 7881  -> $lan:7881   (LiveKit RTC TCP)"
Write-Host "  UDP 7882  -> $lan:7882   (LiveKit media)"
Write-Host ""
if ($public) {
  Write-Host "APK / prueba 4G:" -ForegroundColor Green
  Write-Host "  set API_BASE=http://${public}:4000"
  Write-Host "  D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd"
  Write-Host "  Health: http://${public}:4000/api/health"
} else {
  Write-Host "Cuando sepas la IP pública del modem:" -ForegroundColor Yellow
  Write-Host "  set API_BASE=http://IP_PUBLICA:4000"
}
Write-Host ""
Write-Host "Guía: D:\pulsanet\Soporte\Documentos\ACCESO_DIRECTO_SIN_TAILSCALE.md"
Write-Host ""
pause
