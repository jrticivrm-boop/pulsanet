# Watch-Stack.ps1 — compat: delega al supervisor de una sola ventana.
# Preferir LEVANTAR-TACTICALPTX.bat (limpia cache y arranca todo).

param(
  [int]$IntervalSec = 12,
  [int]$EdgeEveryN = 5,
  [switch]$Once,
  [switch]$SkipEdge
)

$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
$sup = Join-Path $here 'Run-StackSupervisor.ps1'
if (-not (Test-Path $sup)) {
  Write-Host "ERROR: falta $sup"
  exit 1
}

$argsList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $sup, '-IntervalSec', $IntervalSec, '-EdgeEveryN', $EdgeEveryN)
if ($Once) { $argsList += '-Once' }
if ($SkipEdge) { $argsList += '-SkipEdge' }

# Misma consola (sin Start-Process / ventanas nuevas).
& powershell.exe @argsList
exit $LASTEXITCODE
