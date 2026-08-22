# Ejecuta la app PulsaNet en un teléfono Android por USB.
# Requisitos:
# 1) Cable USB + "Depuración USB" activada en el teléfono
# 2) API + Redis + LiveKit corriendo en este PC
# 3) Teléfono y PC en la misma Wi‑Fi (para API/audio)
#
# Uso: powershell -File D:\pulsanet\mobile\run-usb.ps1

$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;C:\tools\flutter\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# IP LAN actual (Wi‑Fi)
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) {
  throw "No hay IP 192.168.x — conéctate a Wi‑Fi."
}

$api = "http://${ip}:4000"
Write-Host "API_BASE = $api" -ForegroundColor Cyan
Write-Host "Asegúrate de que el firewall permite TCP 4000 y 7880." -ForegroundColor Yellow

Write-Host "`nDispositivos adb:" -ForegroundColor Cyan
adb devices -l
$lines = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $lines) {
  Write-Host @"

NO hay teléfono en modo 'device'.
1. Conecta el USB.
2. En el teléfono: Ajustes → Opciones de desarrollador → Depuración USB = ON.
3. Acepta el diálogo '¿Permitir depuración USB?'.
4. Vuelve a ejecutar este script.

"@ -ForegroundColor Red
  exit 1
}

cd D:\pulsanet\mobile
flutter run --dart-define=API_BASE=$api
