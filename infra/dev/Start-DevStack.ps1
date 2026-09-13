# Arranca stack DESARROLLO (API 4100 + Web 5273 + LiveKit 7980).
# NO levanta Caddy / DuckDNS / OTA. No toca puertos de produccion 4000/5173/7880.
param(
  [string]$RepoRoot = '',
  [switch]$NoLiveKit,
  [switch]$NoWeb,
  [switch]$NoApi
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) {
  $here = $PSScriptRoot
  if ((Split-Path -Leaf $here) -eq 'dev') {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $here)
  } else {
    $RepoRoot = $here
  }
}
if (-not (Test-Path (Join-Path $RepoRoot 'backend\package.json'))) {
  if (Test-Path 'C:\pulsanet-dev\backend\package.json') { $RepoRoot = 'C:\pulsanet-dev' }
  else { throw "RepoRoot invalido: $RepoRoot" }
}

Write-Host '=== TacticalPtx DEV stack ===' -ForegroundColor Cyan
Write-Host "Root: $RepoRoot"
Write-Host 'API :4100  Web :5273  LiveKit :7980'
Write-Host 'SIN Caddy / SIN DuckDNS / SIN OTA flota'
Write-Host ''

$envFile = Join-Path $RepoRoot 'backend\.env'
if (-not (Test-Path $envFile)) {
  throw "Falta $envFile - ejecuta primero infra\dev\Initialize-DevWorktree.ps1"
}

function Test-PortListen([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# --- LiveKit aislado ---
if (-not $NoLiveKit) {
  if (Test-PortListen 7980) {
    Write-Host 'LiveKit :7980 ya escucha.' -ForegroundColor Green
  } else {
    $lkBin = $null
    foreach ($c in @(
      (Join-Path $RepoRoot 'infra\livekit\livekit-server.exe'),
      (Join-Path $RepoRoot 'infra\livekit-server.exe'),
      (Join-Path $RepoRoot 'infra\bin\livekit-server.exe'),
      'C:\pulsanet\infra\livekit\livekit-server.exe',
      'C:\pulsanet\infra\livekit-server.exe'
    )) {
      if (Test-Path $c) { $lkBin = $c; break }
    }
    $cfg = Join-Path $RepoRoot 'infra\livekit.dev-isolated.yaml'
    if (-not (Test-Path $cfg)) { $cfg = 'C:\pulsanet\infra\livekit.dev-isolated.yaml' }
    if ($lkBin -and (Test-Path $cfg)) {
      $resolveAux = Join-Path $RepoRoot 'infra\Resolve-AuxRoot.ps1'
      if (-not (Test-Path $resolveAux)) { $resolveAux = 'C:\pulsanet\infra\Resolve-AuxRoot.ps1' }
      $aux = & $resolveAux -RepoRoot $RepoRoot -EnsureLogs
      $log = Join-Path $aux 'Logs'
      if (-not (Test-Path $log)) { New-Item -ItemType Directory -Path $log -Force | Out-Null }
      $out = Join-Path $log 'livekit-dev-out.txt'
      $err = Join-Path $log 'livekit-dev-err.txt'
      Start-Process -FilePath $lkBin -ArgumentList @('--config', $cfg, '--dev') -WorkingDirectory (Split-Path $lkBin) `
        -WindowStyle Minimized -RedirectStandardOutput $out -RedirectStandardError $err
      Start-Sleep -Seconds 1
      if (Test-PortListen 7980) {
        Write-Host "LiveKit DEV iniciado ($cfg)" -ForegroundColor Green
      } else {
        Write-Warning "LiveKit no escucha en :7980 - revisa $err"
      }
    } else {
      Write-Warning 'No se encontro livekit-server.exe o config aislada. Continuo sin LiveKit nuevo.'
    }
  }
}

# --- API ---
if (-not $NoApi) {
  if (Test-PortListen 4100) {
    Write-Host 'API :4100 ya escucha.' -ForegroundColor Green
  } else {
    $backend = Join-Path $RepoRoot 'backend'
    if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
      Write-Host 'Instalando dependencias backend (npm install)...' -ForegroundColor Yellow
      & npm.cmd install --prefix $backend
      if ($LASTEXITCODE -ne 0) { throw 'npm install backend fallo' }
    }
    # cmd /k con & (no &&) para compatibilidad; title + npm en una linea
    $apiCmd = "cd /d `"$backend`" & title TacticalPtx-DEV-API-4100 & npm run dev"
    Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $apiCmd) -WorkingDirectory $backend
    Write-Host 'API DEV lanzada (npm run dev) - puerto segun .env (4100)' -ForegroundColor Green
  }
}

# --- Web ---
if (-not $NoWeb) {
  if (Test-PortListen 5273) {
    Write-Host 'Web :5273 ya escucha.' -ForegroundColor Green
  } else {
    $web = Join-Path $RepoRoot 'frontend'
    if (-not (Test-Path (Join-Path $web 'package.json'))) {
      $webAlt = Join-Path $RepoRoot 'web'
      if (Test-Path (Join-Path $webAlt 'package.json')) { $web = $webAlt }
      else { throw "No existe frontend\ ni web\ en $RepoRoot" }
    }
    if (-not (Test-Path (Join-Path $web 'node_modules'))) {
      Write-Host 'Instalando dependencias frontend (npm install)...' -ForegroundColor Yellow
      & npm.cmd install --prefix $web
      if ($LASTEXITCODE -ne 0) { throw 'npm install frontend fallo' }
    }
    $webCmd = "cd /d `"$web`" & title TacticalPtx-DEV-WEB-5273 & set VITE_DEV_PORT=5273& set VITE_API_PROXY=https://127.0.0.1:4100& set VITE_LIVEKIT_PROXY=http://127.0.0.1:7980& npm run dev -- --host 0.0.0.0 --port 5273 --strictPort"
    Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $webCmd) -WorkingDirectory $web
    Write-Host 'Web DEV lanzada en :5273 (proxy API :4100)' -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'URLs DEV:'
Write-Host '  Consola:  http://127.0.0.1:5273'
Write-Host '  API:      http://127.0.0.1:4100/api/health'
Write-Host '  LiveKit:  ws://127.0.0.1:7980'
Write-Host ''
Write-Host 'Produccion sigue en C:\pulsanet (:4000/:5173/:7880) - no la reinicies desde aqui.'
