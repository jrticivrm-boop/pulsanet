# Registra tarea programada: reafirma UPnP/DuckDNS/Caddy sin matar API/Web.
# Uso (admin recomendado): powershell -File infra\Register-EdgeKeepalive.ps1
# Quitar: powershell -File infra\Register-EdgeKeepalive.ps1 -Unregister

param(
  [switch]$Unregister,
  [int]$EveryMinutes = 20
)

$ErrorActionPreference = 'Stop'
$taskName = 'TacticalPtx-EdgeKeepalive'
$root = if (Test-Path 'C:\pulsanet\infra\ENSURE-PUBLIC-EDGE.ps1') {
  'C:\pulsanet'
} elseif (Test-Path 'D:\pulsanet\infra\ENSURE-PUBLIC-EDGE.ps1') {
  'D:\pulsanet'
} else {
  Split-Path -Parent $PSScriptRoot
}
$ensure = Join-Path $root 'infra\ENSURE-PUBLIC-EDGE.ps1'
if (-not (Test-Path $ensure)) { throw "No existe $ensure" }

if ($Unregister) {
  schtasks.exe /Delete /TN $taskName /F 2>$null | Out-Null
  Write-Host "Eliminada (si existía): $taskName"
  exit 0
}

$mins = [Math]::Max(10, [Math]::Min(120, $EveryMinutes))
$ps = "powershell.exe"
$args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ensure`""

# /SC MINUTE es compatible; no reinicia API ni Vite.
schtasks.exe /Create /F /TN $taskName /TR "`"$ps`" $args" /SC MINUTE /MO $mins /RL LIMITED /NP
if ($LASTEXITCODE -ne 0) {
  throw "schtasks falló ($LASTEXITCODE). Ejecuta PowerShell como Administrador."
}

Write-Host "OK $taskName cada $mins min → ENSURE-PUBLIC-EDGE (sin tocar API/Web)" -ForegroundColor Green
schtasks.exe /Query /TN $taskName /FO LIST /V | Select-String -Pattern 'Nombre|Estado|Hora|Tarea|Repetir|To run'
