<#
  Flujo de 3 fases:
    desarrollo (C:\pulsanet)  ->  pruebas (C:\pulsanet-pruebas, en la PC)  ->  main (VM SICOM, produccion)

  Uso:
    .\infra\PROMOVER.ps1 -A pruebas                 # lleva lo commiteado en desarrollo a pruebas
    .\infra\PROMOVER.ps1 -A produccion              # lleva pruebas a main y despliega en la VM
    .\infra\PROMOVER.ps1 -A produccion -Migrate     # idem, permitiendo migraciones de BD
    .\infra\PROMOVER.ps1 -A produccion -SinDesplegar
    .\infra\PROMOVER.ps1 -A produccion -Forzar      # EMERGENCIA: sube aunque VERIFICAR-PRUEBAS falle

  Solo avanza ramas (fast-forward): nunca reescribe ni revierte historia.
  A produccion: corre VERIFICAR-PRUEBAS.ps1, pide confirmar la lista docs\CHECKLIST_PRUEBAS.md,
  avisa si es fuera de la ventana de despliegue y, si todo sale bien, etiqueta la version
  (prod-v<version>-<fecha>) para poder volver a ella con REVERTIR-PRODUCCION.ps1.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('pruebas', 'produccion')][string]$A,
  [switch]$Migrate,
  [switch]$SinDesplegar,
  [switch]$Forzar,
  [switch]$Si
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$PruebasDir = 'C:\pulsanet-pruebas'
# Ventana de despliegue a produccion (hora local): de 21:00 a 07:00.
$VentanaInicio = 21
$VentanaFin = 7
$LogDir = 'C:\pulsanet_soporte\Pruebas'

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
  if ($to -eq 'main') {
    $migs = @(git -C $Repo diff --name-only --diff-filter=A "main..pruebas" -- 'database/migrations/*.sql')
    if ($migs.Count -and -not $Migrate -and -not $SinDesplegar) {
      Write-Host "Hay migraciones de BD nuevas: $($migs -join ', ')" -ForegroundColor Yellow
      Write-Host 'Repite con -Migrate (respalda la BD de produccion antes de aplicarlas).' -ForegroundColor Yellow
      exit 3
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'VERIFICAR-PRUEBAS.ps1')
    if ($LASTEXITCODE -ne 0) {
      if (-not $Forzar) { throw 'La verificacion de pruebas fallo: NO se sube a produccion. (Solo en emergencia: -Forzar)' }
      Write-Host 'AVISO: verificacion fallida, se continua por -Forzar.' -ForegroundColor Red
    }

    Write-Host ''
    Write-Host "Lista de verificacion manual: $(Join-Path $Repo 'docs\CHECKLIST_PRUEBAS.md')" -ForegroundColor Cyan
    Confirm-Step 'Revisaste en pruebas (https://localhost:5180) los puntos de la lista que aplican a estos cambios?'

    $hour = (Get-Date).Hour
    $enVentana = ($hour -ge $VentanaInicio -or $hour -lt $VentanaFin)
    if (-not $enVentana -and -not $SinDesplegar) {
      Write-Host ("Fuera de la ventana de despliegue ({0:00}:00-{1:00}:00): se cortan PTT/video unos segundos a quien este conectado." -f $VentanaInicio, $VentanaFin) -ForegroundColor Yellow
      if (-not $Si) {
        $r = Read-Host 'Escribe FUERA DE HORARIO para continuar de todos modos'
        if ($r -ne 'FUERA DE HORARIO') { Write-Host 'Cancelado.'; exit 1 }
      }
    }

    Confirm-Step 'Esto se publicara en PRODUCCION.'
  }

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
$code = $LASTEXITCODE

if ($code -eq 0 -and $pending) {
  $pkg = (git -C $Repo show main:backend/package.json | Out-String) | ConvertFrom-Json
  $tag = "prod-v$($pkg.version)-$(Get-Date -Format 'yyyyMMdd-HHmm')"
  git -C $Repo tag $tag main
  if ($LASTEXITCODE -eq 0) { git -C $Repo push -q origin "refs/tags/$tag" }
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Version etiquetada: $tag (punto de regreso para REVERTIR-PRODUCCION.ps1)" -ForegroundColor Green
  } else {
    Write-Host "AVISO: no se pudo crear/subir la etiqueta $tag; crearla a mano: git tag $tag main; git push origin $tag" -ForegroundColor Yellow
  }
  try {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $sha = (git -C $Repo rev-parse --short main).Trim()
    Add-Content -Path (Join-Path $LogDir 'despliegues.log') -Encoding UTF8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm') PRODUCCION $sha $tag commits=$(@($pending).Count) migrate=$([bool]$Migrate) forzado=$([bool]$Forzar)"
  } catch { }
}
exit $code
