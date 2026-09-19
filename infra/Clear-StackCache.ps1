# Clear-StackCache.ps1 — limpia logs viejos y cachés Vite al levantar.
param(
  [string]$RepoRoot = ''
)

$ErrorActionPreference = 'SilentlyContinue'

function Resolve-Root {
  if ($RepoRoot -and (Test-Path (Join-Path $RepoRoot 'backend\package.json'))) {
    return (Resolve-Path $RepoRoot).Path
  }
  foreach ($cand in @('C:\pulsanet', 'D:\pulsanet', (Split-Path -Parent $PSScriptRoot))) {
    if ($cand -and (Test-Path (Join-Path $cand 'backend\package.json'))) {
      return (Resolve-Path $cand).Path
    }
  }
  throw 'Repo no encontrado'
}

function Clear-OrRotateLog([System.IO.FileInfo]$f) {
  $name = $f.Name
  $rotate = ($name -match '^(api|web)-(out|err)\.log$') -or
    ($name -eq 'watch-stack.log') -or
    ($name -match '^caddy.*\.log$')
  if ($rotate -and $f.Length -gt 4MB) {
    Clear-Content -Path $f.FullName -ErrorAction SilentlyContinue
    return $true
  }
  if ($f.LastWriteTime -lt $script:cutoff) {
    if ($rotate) {
      Clear-Content -Path $f.FullName -ErrorAction SilentlyContinue
    } else {
      Remove-Item -Force $f.FullName -ErrorAction SilentlyContinue
    }
    return $true
  }
  if ($rotate -and $f.Length -gt 5MB) {
    Clear-Content -Path $f.FullName -ErrorAction SilentlyContinue
    return $true
  }
  # APK.bak / dumps en Logs\fases > 7 días
  if ($f.Extension -match '\.(apk|zip|bak)$' -and $f.LastWriteTime -lt (Get-Date).AddDays(-7)) {
    Remove-Item -Force $f.FullName -ErrorAction SilentlyContinue
    return $true
  }
  return $false
}

$root = Resolve-Root
$aux = 'C:\pulsanet_soporte'
if (-not (Test-Path $aux)) { $aux = Join-Path $root 'var' }
$logDirs = @(
  (Join-Path $aux 'Logs'),
  (Join-Path $root 'var\logs'),
  (Join-Path $root 'infra\caddy')
)

$script:cutoff = (Get-Date).AddDays(-2)
$removed = 0
foreach ($dir in $logDirs) {
  if (-not (Test-Path $dir)) {
    if ($dir -notmatch 'caddy') {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    continue
  }
  # Incluye subcarpetas (fases, restore-*, _archive)
  Get-ChildItem -Path $dir -File -Recurse -ErrorAction SilentlyContinue |
    ForEach-Object {
      try {
        if (Clear-OrRotateLog $_) { $removed++ }
      } catch {}
    }
}

$cachePaths = @(
  (Join-Path $root 'frontend\node_modules\.vite'),
  (Join-Path $root 'frontend\.vite'),
  (Join-Path $root 'frontend\dist\.vite'),
  (Join-Path $root 'backend\node_modules\.cache')
)
foreach ($p in $cachePaths) {
  if (Test-Path $p) {
    try {
      Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
      $removed++
      Write-Host "Cache borrado: $p"
    } catch {}
  }
}

Write-Host "Limpieza OK (root=$root, items=$removed)"
exit 0
