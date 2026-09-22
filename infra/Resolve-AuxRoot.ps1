# Resuelve carpeta auxiliar (docs/APK/logs de archivo).
# Preferencia: C:\pulsanet_soporte si existe.
# Fallback portable: <repo>\var  (el producto funciona SIN pulsanet_soporte).
param(
  [string]$RepoRoot = '',
  [switch]$EnsureLogs,
  [switch]$EnsureApk,
  [switch]$EnsureRespaldos
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $here = $PSScriptRoot
  $RepoRoot = Split-Path -Parent $here
  if (-not (Test-Path (Join-Path $RepoRoot 'backend\package.json'))) {
    foreach ($c in @('C:\pulsanet', 'C:\pulsanet-dev')) {
      if (Test-Path (Join-Path $c 'backend\package.json')) { $RepoRoot = $c; break }
    }
  }
}

$external = 'C:\pulsanet_soporte'
if (Test-Path $external) {
  $aux = $external
} else {
  $aux = Join-Path $RepoRoot 'var'
}

foreach ($sub in @('Logs', 'APK', 'Documentos', 'Respaldos', 'Temp', 'Brand', 'Scripts', 'Cursor')) {
  $p = Join-Path $aux $sub
  $need = $false
  if ($EnsureLogs -and $sub -eq 'Logs') { $need = $true }
  if ($EnsureApk -and $sub -eq 'APK') { $need = $true }
  if ($EnsureRespaldos -and $sub -eq 'Respaldos') { $need = $true }
  if ($need -or $sub -eq 'Logs') {
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
  }
}

$logs = Join-Path $aux 'Logs'
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs -Force | Out-Null }

Write-Output $aux
