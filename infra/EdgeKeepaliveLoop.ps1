# Bucle ligero: reafirma borde cada N minutos SIN matar API/Web/Vite.
# Arranque: Start-Process ... -WindowStyle Minimized (ver Register-EdgeKeepalive.cmd)
# Mutex Global\TacticalPtxEdgeKeepalive — una sola instancia.

param([int]$EveryMinutes = 20)

$ErrorActionPreference = 'Continue'
$root = if (Test-Path 'C:\pulsanet\infra\ENSURE-PUBLIC-EDGE.ps1') { 'C:\pulsanet' }
  elseif (Test-Path 'D:\pulsanet\infra\ENSURE-PUBLIC-EDGE.ps1') { 'D:\pulsanet' }
  else { Split-Path -Parent $PSScriptRoot }
$ensure = Join-Path $root 'infra\ENSURE-PUBLIC-EDGE.ps1'
$logDir = if (Test-Path 'C:\pulsanet_soporte\Logs') { 'C:\pulsanet_soporte\Logs' } else { Join-Path $root 'var\Logs' }
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'edge-keepalive.log'

$mutex = $null
try {
  $mutex = New-Object System.Threading.Mutex($false, 'Global\TacticalPtxEdgeKeepalive')
  if (-not $mutex.WaitOne(0)) {
    Add-Content $log "[$(Get-Date -Format o)] ya hay una instancia; salgo"
    exit 0
  }
} catch {}

$mins = [Math]::Max(10, [Math]::Min(120, $EveryMinutes))
Add-Content $log "[$(Get-Date -Format o)] start cada ${mins}m → $ensure"

while ($true) {
  try {
    $ts = Get-Date -Format 'HH:mm:ss'
    Add-Content $log "[$ts] ENSURE-PUBLIC-EDGE"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensure *>> $log
  } catch {
    Add-Content $log "[$(Get-Date -Format o)] error: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds ($mins * 60)
}
