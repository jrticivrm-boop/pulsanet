# Inicializa worktree C:\pulsanet-dev y .env de desarrollo (puertos aislados).
# Uso:
#   powershell -File infra\dev\Initialize-DevWorktree.ps1
#   powershell -File infra\dev\Initialize-DevWorktree.ps1 -SkipDb
param(
  [string]$ProdRoot = 'C:\pulsanet',
  [string]$DevRoot = 'C:\pulsanet-dev',
  [string]$Branch = 'develop',
  [switch]$SkipDb,
  [switch]$SkipWorktree
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$m) { Write-Host $m -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host $m -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host $m -ForegroundColor Yellow }

if (-not (Test-Path (Join-Path $ProdRoot 'backend\package.json'))) {
  throw "No se encontro prod en $ProdRoot"
}

if (-not $SkipWorktree) {
  Push-Location $ProdRoot
  try {
    $branchHit = git branch --list $Branch 2>$null
    if (-not $branchHit) {
      Write-Info "Creando rama $Branch desde HEAD..."
      git branch $Branch
    }
    $listed = git worktree list
    if ($listed -match [regex]::Escape($DevRoot)) {
      Write-Ok "Worktree ya existe: $DevRoot"
    } elseif (Test-Path $DevRoot) {
      Write-Warn "La carpeta $DevRoot existe pero no es worktree. Abortando."
      throw "Carpeta $DevRoot ya existe"
    } else {
      Write-Info "git worktree add $DevRoot $Branch"
      git worktree add $DevRoot $Branch
      Write-Ok 'Worktree creado.'
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $DevRoot 'backend\package.json'))) {
  throw "Dev root incompleto: $DevRoot"
}

$syncPaths = @(
  'infra\dev',
  'infra\Resolve-AuxRoot.ps1',
  'infra\livekit.dev-isolated.yaml',
  'LEVANTAR-DEV.bat',
  'CREAR-O-ACTUALIZAR-BD.bat',
  'docs\FASES_PROYECTO.md',
  'docs\SOPORTE.md'
)
foreach ($rel in $syncPaths) {
  $src = Join-Path $ProdRoot $rel
  $dst = Join-Path $DevRoot $rel
  if (-not (Test-Path $src)) { continue }
  $dstParent = Split-Path -Parent $dst
  if (-not (Test-Path $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }
  if (Test-Path $src -PathType Container) {
    Copy-Item -Path $src -Destination (Split-Path -Parent $dst) -Recurse -Force
  } else {
    Copy-Item -Path $src -Destination $dst -Force
  }
}
Write-Ok 'Scaffolding sync Prod -> Dev OK.'

$prodEnv = Join-Path $ProdRoot 'backend\.env'
$devEnv = Join-Path $DevRoot 'backend\.env'
$example = Join-Path $DevRoot 'backend\.env.example'
if (-not (Test-Path $devEnv)) {
  if (Test-Path $prodEnv) {
    Copy-Item $prodEnv $devEnv -Force
    Write-Info 'Copiado backend/.env desde produccion (se reescriben puertos y BD).'
  } elseif (Test-Path $example) {
    Copy-Item $example $devEnv -Force
    Write-Warn 'Creado .env desde .env.example - completa secretos si hace falta.'
  } else {
    throw 'No hay .env ni .env.example para clonar'
  }
}

$raw = Get-Content $devEnv -Raw -Encoding UTF8
function Set-EnvKey([string]$text, [string]$key, [string]$value) {
  $pattern = '(?m)^' + [regex]::Escape($key) + '=.*$'
  if ($text -match $pattern) {
    return [regex]::Replace($text, $pattern, ($key + '=' + $value))
  }
  return $text.TrimEnd() + "`r`n$key=$value`r`n"
}

if ($raw -match '(?m)^DATABASE_URL=(.+)$') {
  $dbUrl = $Matches[1].Trim()
  $dbUrl2 = $dbUrl -replace '/tacticalptx_db(\?|$)', '/tacticalptx_dev$1'
  if ($dbUrl2 -eq $dbUrl -and $dbUrl -notmatch 'tacticalptx_dev') {
    $dbUrl2 = $dbUrl -replace '/([^/\s]+)(\?|$)', '/tacticalptx_dev$2'
  }
  $raw = Set-EnvKey $raw 'DATABASE_URL' $dbUrl2
}

$raw = Set-EnvKey $raw 'PORT' '4100'
$raw = Set-EnvKey $raw 'REDIS_URL' 'redis://127.0.0.1:6379/1'
$raw = Set-EnvKey $raw 'LIVEKIT_URL' 'ws://127.0.0.1:7980'
$cors = 'http://localhost:5273,https://localhost:5273,http://127.0.0.1:5273,https://127.0.0.1:5273,http://localhost:4100,https://localhost:4100'
$raw = Set-EnvKey $raw 'CORS_ORIGINS' $cors
$raw = Set-EnvKey $raw 'PUBLIC_DOMAIN' ''
$raw = Set-EnvKey $raw 'WEB_PUBLIC_URL' ''
$raw = Set-EnvKey $raw 'TACTICALPTX_ENV' 'desarrollo'

Set-Content -Path $devEnv -Value $raw -Encoding UTF8
Write-Ok 'backend/.env DEV listo (4100, tacticalptx_dev, Redis DB1, LiveKit 7980).'

$faseDir = Join-Path $DevRoot 'infra\fases'
if (-not (Test-Path $faseDir)) { New-Item -ItemType Directory -Path $faseDir -Force | Out-Null }
Set-Content -Path (Join-Path $faseDir 'FASE_ACTUAL.txt') -Value 'desarrollo' -Encoding UTF8
Write-Ok 'FASE_ACTUAL=desarrollo en worktree.'

if (-not $SkipDb) {
  $psql = $null
  foreach ($c in @(
    'C:\Program Files\PostgreSQL\18\bin\psql.exe',
    'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    'C:\Program Files\PostgreSQL\16\bin\psql.exe'
  )) {
    if (Test-Path $c) { $psql = $c; break }
  }
  if (-not $psql) {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { $psql = $cmd.Source }
  }

  if ($psql) {
    $envLine = (Get-Content $devEnv | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
    $url = $envLine -replace '^DATABASE_URL=', ''
    $pgUser = 'postgres'
    $pgPass = $null
    $pgHost = '127.0.0.1'
    $pgPort = '5432'
    if ($url -match 'postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/') {
      $pgUser = $Matches[1]
      $pgPass = $Matches[2]
      $pgHost = $Matches[3]
      if ($Matches[4]) { $pgPort = $Matches[4] }
    }
    $env:PGPASSWORD = $pgPass
    $exists = & $psql -h $pgHost -p $pgPort -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='tacticalptx_dev'" 2>$null
    if ($exists -match '1') {
      Write-Ok 'BD tacticalptx_dev ya existe.'
    } else {
      Write-Info 'Creando BD tacticalptx_dev...'
      & $psql -h $pgHost -p $pgPort -U $pgUser -d postgres -c 'CREATE DATABASE tacticalptx_dev;'
      Write-Ok 'BD creada.'
    }
    $hasUsers = (& $psql -h $pgHost -p $pgPort -U $pgUser -d tacticalptx_dev -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>$null | Select-Object -First 1).Trim()
    $tableCount = 0
    [void][int]::TryParse($hasUsers, [ref]$tableCount)
    if ($tableCount -lt 1) {
      $schema = Join-Path $ProdRoot 'database\schema.sql'
      if (-not (Test-Path $schema)) { $schema = Join-Path $DevRoot 'database\schema.sql' }
      if (Test-Path $schema) {
        Write-Info 'Aplicando database/schema.sql a tacticalptx_dev...'
        & $psql -h $pgHost -p $pgPort -U $pgUser -d tacticalptx_dev -f $schema | Out-Null
        Write-Ok 'Esquema base aplicado.'
      }
    } else {
      Write-Ok "BD tacticalptx_dev ya tiene tablas ($tableCount)."
    }
    $applyJs = Join-Path $DevRoot 'backend\src\scripts\apply-all-migrations.js'
    if (Test-Path $applyJs) {
      Write-Info 'Migraciones idempotentes (apply-all-migrations.js)...'
      Push-Location (Join-Path $DevRoot 'backend')
      try {
        & node.exe $applyJs
      } finally {
        Pop-Location
      }
    }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  } else {
    Write-Warn 'psql no encontrado: crea manualmente la BD tacticalptx_dev.'
  }
}

Write-Host ''
Write-Ok "Listo. Desarrollo: $DevRoot"
Write-Host "Produccion (no tocar al probar): $ProdRoot"
Write-Host ''
Write-Host 'Puertos DEV: API 4100 | Web 5273 | LiveKit 7980'
Write-Host "Arranque DEV:  $DevRoot\LEVANTAR-DEV.bat"
Write-Host "OTA / DuckDNS / Caddy: solo desde $ProdRoot (fase produccion)."
Write-Host ''
Write-Warn 'Nota: cambios SIN commit siguen en C:\pulsanet. Trabaja codigo nuevo en el worktree o haz commit.'
