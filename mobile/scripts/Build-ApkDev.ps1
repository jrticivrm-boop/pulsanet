# APK de DESARROLLO: apunta al Vite de la PC (proxy /api, /socket.io, /rtc).
# Sin APP_UPDATE_SECRET (no se autoactualiza a la APK de produccion) ni SERVER_LAN_IP.
# Uso: powershell -File mobile\scripts\Build-ApkDev.ps1 [-ApiBase https://IP:5173]
# Por defecto: IP de la PC en el Wi-Fi de los telefonos (mesh 192.168.68.x); la Ethernet
# 192.168.1.77 no es alcanzable desde ese Wi-Fi.
# Requiere el stack dev con Vite en la red: LEVANTAR con NO_EDGE=1 y TPX_LISTEN_ALL=1.
param(
  [string]$ApiBase = ''
)
if (-not $ApiBase) {
  $wifiIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.68.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if (-not $wifiIp) { throw 'Sin IP 192.168.68.x en esta PC; indica -ApiBase https://IP:5173' }
  $ApiBase = "https://${wifiIp}:5173"
}

$ErrorActionPreference = 'Stop'
$root = 'C:\pulsanet'
$mobile = Join-Path $root 'mobile'
Set-Location $mobile

$flutterBin = 'C:\tools\flutter\bin'
$androidSdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, 'C:\Android\Sdk', "$env:LOCALAPPDATA\Android\Sdk") |
  Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$javaHome = @('C:\Program Files\Microsoft\jdk-17*', 'C:\Program Files\Eclipse Adoptium\jdk-17*', $env:JAVA_HOME, 'C:\Program Files\Android\Android Studio\jbr') |
  Where-Object { $_ } | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue } |
  Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1 -ExpandProperty FullName
if (-not (Test-Path "$flutterBin\flutter.bat")) { throw 'Flutter no encontrado en C:\tools\flutter' }
if (-not $androidSdk) { throw 'Android SDK no encontrado' }
if (-not $javaHome) { throw 'JDK 17 no encontrado' }

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:PATH = "$flutterBin;$(Join-Path $javaHome 'bin');$(Join-Path $androidSdk 'platform-tools');" + $env:PATH

$verLine = (Select-String -Path 'pubspec.yaml' -Pattern '^version:\s*(\S+)').Matches[0].Groups[1].Value
$verName, $verCode = $verLine -split '\+', 2
$devName = "$verName-dev"

Write-Host "=== APK DESARROLLO $devName+$verCode ===" -ForegroundColor Cyan
Write-Host "API_BASE=$ApiBase"

& flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed' }
& flutter build apk --release "--dart-define=API_BASE=$ApiBase" "--build-name=$devName" "--build-number=$verCode"
if ($LASTEXITCODE -ne 0) { throw 'flutter build apk failed' }

$apkSrc = Join-Path $mobile 'build\app\outputs\flutter-apk\app-release.apk'
if (-not (Test-Path $apkSrc)) { throw "No APK: $apkSrc" }
$dest = 'C:\pulsanet_soporte\APK'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$out = Join-Path $dest "TacticalPtx-DEV-$devName+$verCode.apk"
Copy-Item -Force $apkSrc $out
Write-Host "APK DEV listo: $out" -ForegroundColor Green
