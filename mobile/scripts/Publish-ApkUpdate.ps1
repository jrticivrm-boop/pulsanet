# Publica APK endurecida (lee versión de pubspec + APP_UPDATE_SECRET)
# Uso: powershell -File mobile\scripts\Publish-ApkUpdate.ps1
#      powershell -File mobile\scripts\Publish-ApkUpdate.ps1 -Ota   # solo si se pide OTA
param(
  [switch]$Ota
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $scriptRoot = Split-Path -Parent $PSScriptRoot  # .../mobile
  $fromScript = Split-Path -Parent $scriptRoot      # repo root
  foreach ($cand in @(
    'C:\pulsanet',
    'D:\pulsanet',
    $fromScript
  )) {
    if ($cand -and (Test-Path (Join-Path $cand 'mobile\pubspec.yaml'))) {
      return (Resolve-Path $cand).Path
    }
  }
  throw 'No se encontró el repo (C:\pulsanet, D:\pulsanet ni carpeta del script).'
}

function Resolve-FlutterBin {
  foreach ($cand in @(
    'C:\tools\flutter\bin',
    'D:\tools\flutter\bin',
    "$env:LOCALAPPDATA\flutter\bin",
    "$env:USERPROFILE\flutter\bin"
  )) {
    if (Test-Path (Join-Path $cand 'flutter.bat')) { return $cand }
  }
  $cmd = Get-Command flutter -ErrorAction SilentlyContinue
  if ($cmd) { return (Split-Path -Parent $cmd.Source) }
  return $null
}

function Resolve-AndroidSdk {
  foreach ($cand in @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    'C:\Android\Sdk',
    'D:\Android\Sdk',
    "$env:LOCALAPPDATA\Android\Sdk"
  )) {
    if ($cand -and (Test-Path $cand)) { return $cand }
  }
  return $null
}

function Resolve-JavaHome {
  foreach ($cand in @(
    'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot',
    'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot',
    'C:\Program Files\Eclipse Adoptium\jdk-17*',
    'C:\Program Files\Microsoft\jdk-17*',
    $env:JAVA_HOME,
    'C:\Program Files\Android\Android Studio\jbr'
  )) {
    if (-not $cand) { continue }
    $resolved = $cand
    if ($cand -match '\*') {
      $hit = Get-Item $cand -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($hit) { $resolved = $hit.FullName } else { continue }
    }
    if (Test-Path (Join-Path $resolved 'bin\java.exe')) { return $resolved }
  }
  return $null
}

$root = Resolve-RepoRoot
$mobile = Join-Path $root 'mobile'
Set-Location $mobile

$flutterBin = Resolve-FlutterBin
if (-not $flutterBin) {
  throw "Flutter no encontrado. Instale en C:\tools\flutter (ver docs/UBICACION_PROYECTO.md)."
}
$androidSdk = Resolve-AndroidSdk
if (-not $androidSdk) {
  throw "Android SDK no encontrado. Esperado en C:\Android\Sdk o D:\Android\Sdk."
}
$javaHome = Resolve-JavaHome
if (-not $javaHome) {
  throw 'JAVA_HOME / JDK 17 no encontrado (Android Studio jbr o Microsoft JDK 17).'
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:PATH = "$flutterBin;$(Join-Path $javaHome 'bin');$(Join-Path $androidSdk 'platform-tools');C:\Program Files\Git\cmd;" + $env:PATH

# local.properties alineado al SDK real
$flutterSdkDir = (Resolve-Path (Join-Path $flutterBin '..')).Path
$lpContent = "flutter.sdk=$($flutterSdkDir -replace '\\','/')`nsdk.dir=$($androidSdk -replace '\\','/')`n"
[System.IO.File]::WriteAllText((Join-Path $mobile 'android\local.properties'), $lpContent, [System.Text.UTF8Encoding]::new($false))

# gradle.properties: org.gradle.java.home debe existir en esta máquina
$gpPath = Join-Path $mobile 'android\gradle.properties'
if (Test-Path $gpPath) {
  $gp = Get-Content $gpPath -Raw
  $javaHomeProp = ($javaHome -replace '\\', '\\')
  if ($gp -match '(?m)^org\.gradle\.java\.home=') {
    $gp = $gp -replace '(?m)^org\.gradle\.java\.home=.*$', "org.gradle.java.home=$javaHomeProp"
  } else {
    $gp = $gp.TrimEnd() + "`norg.gradle.java.home=$javaHomeProp`n"
  }
  [System.IO.File]::WriteAllText($gpPath, $gp, [System.Text.UTF8Encoding]::new($false))
}

$apiBase = if ($env:API_BASE) { $env:API_BASE } else {
  $dom = $null
  $envFile = Join-Path $root 'backend\.env'
  $hint = Join-Path $root 'infra\caddy\apk-api-base.txt'
  if (Test-Path $hint) {
    $h = (Get-Content $hint -Raw -ErrorAction SilentlyContinue).Trim()
    if ($h -match '^https?://') { $dom = $h }
  }
  if (-not $dom -and (Test-Path $envFile)) {
    . (Join-Path $root 'infra\Sync-PublicIp.ps1')
    $stable = Get-TpxStablePublicDomain -Root $root
    if ($stable) {
      $dom = "https://$stable"
    } else {
      $line = Get-Content $envFile | Where-Object { $_ -match '^PUBLIC_DOMAIN=' } | Select-Object -First 1
      if ($line) { $dom = 'https://' + (($line -split '=', 2)[1].Trim().Trim('"').Trim("'")) }
    }
  }
  if ($dom) {
    $dom.TrimEnd('/')
  } else {
    . (Join-Path $root 'infra\Sync-PublicIp.ps1')
    $ip = Get-TpxCurrentPublicIp
    if (-not $ip) { throw 'Sin PUBLIC_DOMAIN en .env y sin IP publica (ipify). Ejecuta infra\START-PUBLIC-EDGE.ps1' }
    "https://$ip.sslip.io"
  }
}

function Read-Secret {
  foreach ($f in @(
    (Join-Path $root 'Soporte\Secrets\app-update-secret.env'),
    (Join-Path $root 'backend\.env')
  )) {
    if (-not (Test-Path $f)) { continue }
    $line = Get-Content $f | Where-Object { $_ -match '^APP_UPDATE_SECRET=' } | Select-Object -First 1
    if ($line) {
      return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
    }
  }
  return $env:APP_UPDATE_SECRET
}

$secret = Read-Secret
if (-not $secret) { Write-Warning 'Sin APP_UPDATE_SECRET — la app no podrá OTA si el API lo exige' }

$verLine = (Select-String -Path 'pubspec.yaml' -Pattern '^version:\s*(\S+)').Matches[0].Groups[1].Value
$verName, $verCode = $verLine -split '\+', 2
if (-not $verCode) { throw "version inválida: $verLine" }

Write-Host "=== Publicar APK $verName+$verCode ===" -ForegroundColor Cyan
Write-Host "Root:    $root"
Write-Host "Flutter: $flutterBin"
Write-Host "SDK:     $androidSdk"
Write-Host "Java:    $javaHome"
Write-Host "API_BASE=$apiBase"
Write-Host "APP_UPDATE_SECRET=$([bool]$secret)"

& flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed' }

$defines = @("--dart-define=API_BASE=$apiBase")
if ($secret) { $defines += "--dart-define=APP_UPDATE_SECRET=$secret" }

# LAN del host para bypass hairpin en el APK (teléfono en Wi‑Fi / subred cruzada).
$serverLan = $env:SERVER_LAN_IP
if (-not $serverLan) {
  . (Join-Path $root 'infra\Sync-PublicIp.ps1')
  $serverLan = Get-TpxPreferredLanIp
  if (-not $serverLan) {
    $line = Get-Content (Join-Path $root 'backend\.env') -EA SilentlyContinue |
      Where-Object { $_ -match '^PUBLIC_LAN_IP=' } | Select-Object -First 1
    if ($line) { $serverLan = (($line -split '=', 2)[1].Trim().Trim('"').Trim("'")) }
  }
}
if ($serverLan) {
  $defines += "--dart-define=SERVER_LAN_IP=$serverLan"
  # Solo Ethernet canónico (+ override). Sin mesh 68.x legacy.
  $extras = @($serverLan, '192.168.1.77') |
    Where-Object { $_ -and $_.Trim() } |
    Select-Object -Unique
  $defines += ("--dart-define=SERVER_LAN_IPS=" + ($extras -join ','))
  Write-Host "SERVER_LAN_IP=$serverLan"
}

& flutter build apk --release @defines
if ($LASTEXITCODE -ne 0) { throw 'flutter build apk failed' }

$apkSrc = Join-Path $mobile 'build\app\outputs\flutter-apk\app-release.apk'
if (-not (Test-Path $apkSrc)) { throw "No APK: $apkSrc" }

$resolveAux = Join-Path $root 'infra\Resolve-AuxRoot.ps1'
$auxRoot = $null
if (Test-Path $resolveAux) {
  $auxRoot = & $resolveAux -RepoRoot $root -EnsureApk
}
if (-not $auxRoot) { $auxRoot = Join-Path $root 'var' }
$soporte = Join-Path $auxRoot 'APK'
New-Item -ItemType Directory -Force -Path $soporte | Out-Null

Copy-Item -Force $apkSrc (Join-Path $soporte "TacticalPtx-$verName+$verCode.apk")
Copy-Item -Force $apkSrc (Join-Path $soporte 'TacticalPtx-latest.apk')

Write-Host '========== APK LISTO ==========' -ForegroundColor Green
Write-Host "Archivo: $soporte\TacticalPtx-$verName+$verCode.apk"
Write-Host "Latest:  $soporte\TacticalPtx-latest.apk"

if (-not $Ota) {
  Write-Host 'OTA: no publicada (usa -Ota solo si lo pides).' -ForegroundColor Yellow
  exit 0
}

$upDir = Join-Path $root 'backend\app-updates'
$filesDir = Join-Path $upDir 'files'
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
$apkDst = Join-Path $filesDir 'TacticalPtx.apk'
Copy-Item -Force $apkSrc $apkDst

$sha = (Get-FileHash -Algorithm SHA256 -Path $apkDst).Hash.ToLower()
$manifest = @{
  package = 'com.tacticalptx.app'
  versionCode = [int]$verCode
  versionName = $verName
  apkFile = 'TacticalPtx.apk'
  force = $false
  message = 'Actualización disponible (opcional).'
  sha256 = $sha
} | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $upDir 'android.json'), $manifest + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host 'OTA publicada (force=false).' -ForegroundColor Cyan
Write-Host "OTA:     $apkDst"
Write-Host "SHA256:  $sha"
Write-Host "API:     $apiBase/api/app/android"
