# Genera keystore de upload para Play Store (NO commitear el .jks)
# Uso:
#   powershell -File mobile/android/create-keystore.ps1
# Luego: flutter build appbundle --release

$ErrorActionPreference = 'Stop'
$androidDir = $PSScriptRoot
$keystore = Join-Path $androidDir 'upload-keystore.jks'
$props = Join-Path $androidDir 'key.properties'

if (Test-Path $keystore) {
  Write-Host "Ya existe: $keystore" -ForegroundColor Yellow
} else {
  $keytool = $null
  $candidates = @(
    "$env:JAVA_HOME\bin\keytool.exe",
    'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot\bin\keytool.exe',
    'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { $keytool = $c; break }
  }
  if (-not $keytool) {
    throw 'No se encontró keytool. Instala JDK 17 y define JAVA_HOME.'
  }

  $pass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  Write-Host "Creando keystore (guarda la contraseña en un gestor seguro)..." -ForegroundColor Cyan
  & $keytool -genkey -v `
    -keystore $keystore `
    -storetype JKS `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -alias upload `
    -storepass $pass `
    -keypass $pass `
    -dname 'CN=PulsaNet, OU=Mobile, O=PulsaNet, L=MX, ST=MX, C=MX'

  @"
storePassword=$pass
keyPassword=$pass
keyAlias=upload
storeFile=upload-keystore.jks
"@ | Set-Content -Path $props -Encoding ASCII

  Write-Host "Creado: $keystore" -ForegroundColor Green
  Write-Host "Creado: $props (gitignored)" -ForegroundColor Green
  Write-Host "IMPORTANTE: respalda el .jks y las contraseñas fuera del repo." -ForegroundColor Yellow
}

if (-not (Test-Path $props)) {
  Write-Host "Falta key.properties. Ejemplo:" -ForegroundColor Yellow
  Write-Host @"
storePassword=***
keyPassword=***
keyAlias=upload
storeFile=upload-keystore.jks
"@
}
