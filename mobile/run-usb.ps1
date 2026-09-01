# Ejecuta la app TacticalPtx en un teléfono Android por USB.
# Requisitos:
# 1) Cable USB + "Depuración USB" activada en el teléfono
# 2) API + Redis + LiveKit corriendo en este PC
# 3) Teléfono y PC en la misma Wi‑Fi (para API/audio)
#
# Uso: powershell -File C:\pulsanet\mobile\run-usb.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $PSScriptRoot

$env:JAVA_HOME = if (Test-Path 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot') {
  'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
} elseif ($env:JAVA_HOME) {
  $env:JAVA_HOME
} else {
  'C:\Program Files\Android\Android Studio\jbr'
}
$env:ANDROID_HOME = if (Test-Path 'C:\Android\Sdk') {
  'C:\Android\Sdk'
} elseif (Test-Path "$env:LOCALAPPDATA\Android\Sdk") {
  "$env:LOCALAPPDATA\Android\Sdk"
} elseif (Test-Path 'D:\Android\Sdk') {
  'D:\Android\Sdk'
} else {
  $env:ANDROID_HOME
}
$flutterBin = if (Test-Path 'C:\tools\flutter\bin\flutter.bat') {
  'C:\tools\flutter\bin'
} else {
  ''
}
$env:Path = "$env:JAVA_HOME\bin;$flutterBin;$env:ANDROID_HOME\platform-tools;$env:Path"

# IP LAN actual (Wi‑Fi)
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
 Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
 Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) {
 throw "No hay IP 192.168.x — conéctate a Wi‑Fi."
}

# HTTPS LAN (cert autofirmado + LanTls). Para HTTP: $env:API_BASE='http://...'
if (-not $env:API_BASE) {
  $api = "https://${ip}:4000"
} else {
  $api = $env:API_BASE
}
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

cd $PSScriptRoot
flutter run --dart-define=API_BASE=$api
