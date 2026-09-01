# TacticalPtx — endurecimiento operativo (Admin recomendado)
# - Postgres Automatic + Start
# - Firewall canónico (+ TURN 3478)
# - UPnP (API/Web/LiveKit/TURN)
# - Asegura APP_UPDATE_SECRET y ALLOW_HOST_LOCKDOWN en backend\.env
#
# Uso: powershell -ExecutionPolicy Bypass -File infra\HARDEN.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\backend")) { $root = $PSScriptRoot }
$envFile = Join-Path $root 'backend\.env'

Write-Host '=== TacticalPtx HARDEN ===' -ForegroundColor Cyan

function Ensure-EnvLine([string]$Key, [string]$Value, [switch]$Overwrite) {
  if (-not (Test-Path $envFile)) {
    Set-Content -Path $envFile -Value "$Key=$Value" -Encoding UTF8
    return
  }
  $lines = Get-Content $envFile -ErrorAction SilentlyContinue
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^(\s*)#?\s*$([regex]::Escape($Key))\s*=") {
      $found = $true
      if ($Overwrite -or ($line -match '^\s*#' ) -or ($line -match '=\s*$') -or ($line -match 'cambia-este|cambiar-|dev-secret')) {
        "$Key=$Value"
      } else {
        $line
      }
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$Key=$Value" }
  Set-Content -Path $envFile -Value $out -Encoding UTF8
}

function Get-EnvValue([string]$Key) {
  if (-not (Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

# 1) PostgreSQL Automatic + Running
try {
  $svc = Get-Service postgresql-x64-17 -ErrorAction Stop
  if ($svc.StartType -ne 'Automatic') {
    Write-Host 'Postgres: StartType -> Automatic'
    Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
      '-NoProfile', '-Command',
      "Set-Service -Name postgresql-x64-17 -StartupType Automatic; Start-Service postgresql-x64-17"
    )
  } else {
    Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
      '-NoProfile', '-Command',
      'Start-Service postgresql-x64-17 -ErrorAction SilentlyContinue'
    )
  }
  Start-Sleep -Seconds 2
  $svc2 = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
  Write-Host "Postgres: $($svc2.Status) / $($svc2.StartType)"
} catch {
  Write-Host "Postgres: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2) Secrets / flags en .env
$upd = Get-EnvValue 'APP_UPDATE_SECRET'
if (-not $upd -or $upd.Length -lt 32) {
  $upd = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  Ensure-EnvLine -Key 'APP_UPDATE_SECRET' -Value $upd -Overwrite
  Write-Host 'APP_UPDATE_SECRET: generado (≥32 chars)' -ForegroundColor Green
} else {
  Write-Host 'APP_UPDATE_SECRET: ya configurado'
}

Ensure-EnvLine -Key 'ALLOW_HOST_LOCKDOWN' -Value '1' -Overwrite
Ensure-EnvLine -Key 'PUBLIC_HOST' -Value '189.175.38.29'
Ensure-EnvLine -Key 'RATE_LIMIT_MAX' -Value '400'
Ensure-EnvLine -Key 'LOGIN_RATE_MAX' -Value '25'
Ensure-EnvLine -Key 'APP_UPDATE_RATE_MAX' -Value '40'
$web = Get-EnvValue 'WEB_PUBLIC_URL'
if (-not $web -or $web -match '^http://') {
  Ensure-EnvLine -Key 'WEB_PUBLIC_URL' -Value 'https://189.175.38.29:5173' -Overwrite
}
Write-Host 'ALLOW_HOST_LOCKDOWN=1 · rate limits · WEB_PUBLIC_URL HTTPS'

# Export para builds APK en esta sesión
$env:APP_UPDATE_SECRET = Get-EnvValue 'APP_UPDATE_SECRET'
Set-Content -Path (Join-Path $root 'Soporte\Secrets\app-update-secret.env') -Value "APP_UPDATE_SECRET=$($env:APP_UPDATE_SECRET)" -Encoding UTF8
Write-Host 'Secreto OTA también en Soporte\Secrets\app-update-secret.env (no compartir)'

# 3) Firewall + UPnP
. (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -DisableLegacy
& (Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1')

Write-Host ''
Write-Host 'Siguiente: LEVANTAR-TACTICALPTX.bat  |  publicar APK con APP_UPDATE_SECRET' -ForegroundColor Cyan
Write-Host 'Guía: Soporte\Documentos\SEGURIDAD_HARDENING.md'
