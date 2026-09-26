<#
  Flujo de 3 fases:
    desarrollo (C:\pulsanet)  ->  pruebas (C:\pulsanet-pruebas, en la PC)  ->  main (VM SICOM, produccion)

  Uso:
    .\infra\PROMOVER.ps1 -A pruebas                 # lleva lo commiteado en desarrollo a pruebas
    .\infra\PROMOVER.ps1 -A produccion              # lleva pruebas a main y despliega en la VM
    .\infra\PROMOVER.ps1 -A produccion -Migrate     # idem, permitiendo migraciones de BD
    .\infra\PROMOVER.ps1 -A produccion -SinDesplegar

  Solo avanza ramas (fast-forward): nunca reescribe ni revierte historia.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('pruebas', 'produccion')][string]$A,
  [switch]$Migrate,
  [switch]$SinDesplegar,
  [switch]$Si
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$PruebasDir = 'C:\pulsanet-pruebas'

function Invoke-Git { git -C $Repo @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') fallo" } }

function Test-Ancestor([string]$old, [string]$new) {
  git -C $Repo merge-base --is-ancestor $old $new
  return ($LASTEXITCODE -eq 0)
}

function Confirm-Step([string]$msg) {
  if ($Si) { return }
  $r = Read-Host "$msg Escribe SI para continuar"
  if ($r -ne 'SI') { Write-Host 'Cancelado.'; exit 1 }
}

if ($A -eq 'pruebas') {
  $from = 'desarrollo'; $to = 'pruebas'
} else {
  $from = 'pruebas'; $to = 'main'
}

$dirty = git -C $Repo status --porcelain --untracked-files=no
if ($from -eq 'desarrollo' -and $dirty) {
  Write-Host 'Aviso: hay cambios SIN commit en C:\pulsanet; no se incluyen en la promocion:' -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" }
}

if (-not (Test-Ancestor $to $from)) {
  throw "'$to' tiene commits que no estan en '$from'. Integra primero (merge de $to en $from) y vuelve a intentar."
}

$pending = git -C $Repo log --oneline "$to..$from"
if (-not $pending) {
  Write-Host "'$to' ya esta al dia con '$from'." -ForegroundColor Green
} else {
  Write-Host "== Commits que pasan de $from a $to ==" -ForegroundColor Cyan
  $pending | ForEach-Object { Write-Host "  $_" }
  if ($to -eq 'main') { Confirm-Step 'Esto se publicara en PRODUCCION.' }

  $wtLine = git -C $Repo worktree list --porcelain | Select-String -SimpleMatch "branch refs/heads/$to"
  if ($to -eq 'pruebas' -and (Test-Path $PruebasDir) -and $wtLine) {
    $wtDirty = git -C $PruebasDir status --porcelain --untracked-files=no
    if ($wtDirty) { throw "$PruebasDir tiene cambios locales; en pruebas no se edita codigo." }
    git -C $PruebasDir merge -q --ff-only $from
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo avanzar pruebas.' }
  } elseif ($wtLine) {
    throw "La rama $to esta abierta en otro worktree; avanzala ahi."
  } else {
    Invoke-Git fetch -q . "${from}:${to}"
  }
}

Invoke-Git push -q origin $from $to
Write-Host "Ramas $from y $to subidas a origin." -ForegroundColor Green

if ($A -eq 'pruebas') {
  Write-Host ''
  Write-Host 'Siguiente: .\infra\PRUEBAS.ps1   (reconstruye y levanta el ambiente de pruebas)' -ForegroundColor Cyan
  exit 0
}

if ($SinDesplegar) {
  Write-Host 'main actualizado; despliegue omitido (-SinDesplegar).'
  exit 0
}

$dp = @{}
if ($Migrate) { $dp.Migrate = $true }
& (Join-Path $PSScriptRoot 'DEPLOY-SICOM.ps1') @dp
exit $LASTEXITCODE
