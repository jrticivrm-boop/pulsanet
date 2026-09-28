<#
  REVERSION de emergencia: regresa PRODUCCION (VM SICOM) a una version anterior etiquetada (prod-*).

  Uso:
    .\infra\REVERTIR-PRODUCCION.ps1               # a la etiqueta anterior a lo desplegado
    .\infra\REVERTIR-PRODUCCION.ps1 -A prod-v1.8.107-20260928-0840
    .\infra\REVERTIR-PRODUCCION.ps1 -DryRun       # solo muestra que haria
    .\infra\REVERTIR-PRODUCCION.ps1 -Listar       # etiquetas disponibles

  Que hace:
    - Reconstruye en la VM solo lo que cambia respecto a esa version (api / web / caddy / stack).
    - NO toca la BD: las migraciones posteriores quedan aplicadas (se anotan para no repetirlas).
    - No reescribe git: main sigue igual en origin; la VM queda "atras" y se bloquea volver a
      desplegar la version revertida hasta que llegue una correccion por desarrollo -> pruebas -> produccion.
  Siempre pide confirmacion (no tiene -Si).
#>
param(
  [string]$A,
  [switch]$DryRun,
  [switch]$Listar
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15')
$LogDir = 'C:\pulsanet_soporte\Pruebas'

if (-not (Test-Path $Key)) { throw "Falta la llave SSH $Key" }

cmd /c "git -C `"$Repo`" fetch -q origin main --tags 2>&1" | Out-Null
$deployed = (& ssh @SshOpts $VmHost 'git -C /opt/pulsanet rev-parse HEAD').Trim()
if ($deployed -notmatch '^[0-9a-f]{40}$') { throw 'No se pudo leer el commit desplegado en la VM.' }
Write-Host "Desplegado en produccion: $(git -C $Repo log -1 --format='%h %s (%cd)' --date=format:'%Y-%m-%d %H:%M' $deployed)" -ForegroundColor Cyan

$tags = @(git -C $Repo tag --list 'prod-*' --sort=-creatordate)
$older = @()
foreach ($t in $tags) {
  $sha = (git -C $Repo rev-parse "$t^{commit}").Trim()
  if ($sha -eq $deployed) { continue }
  git -C $Repo merge-base --is-ancestor $sha $deployed
  if ($LASTEXITCODE -eq 0) { $older += $t }
}

if ($Listar -or -not $older.Count) {
  Write-Host 'Etiquetas anteriores a lo desplegado:'
  if ($older.Count) { $older | ForEach-Object { Write-Host "  $_" } } else { Write-Host '  (ninguna)' }
  if (-not $older.Count) { exit 1 }
  exit 0
}

if (-not $A) { $A = $older[0] }
if ($older -notcontains $A) { throw "$A no es una etiqueta prod-* anterior a lo desplegado. Usa -Listar." }

Write-Host ''
Write-Host "== Se REVIERTE produccion a $A ==" -ForegroundColor Yellow
Write-Host 'Commits que se retiran de produccion:'
git -C $Repo log --oneline "$A..$deployed" | ForEach-Object { Write-Host "  $_" }
$migs = @(git -C $Repo diff --name-only --diff-filter=A $A $deployed -- 'database/migrations/*.sql')
if ($migs.Count) {
  Write-Host "Migraciones que QUEDAN aplicadas en la BD: $($migs -join ', ')" -ForegroundColor Yellow
  Write-Host 'Si la version anterior no funciona con ellas, restaurar el respaldo /opt/respaldos/pre_deploy_*.dump (ver docs\FLUJO_DESPLIEGUE.md).' -ForegroundColor Yellow
}

$args2 = @('auto', "--ref=$A")
if ($DryRun) { $args2 += '--dry-run' }
else {
  $r = Read-Host 'Escribe REVERTIR para continuar'
  if ($r -ne 'REVERTIR') { Write-Host 'Cancelado.'; exit 1 }
}

$remote = "cd /opt/pulsanet && git fetch -q origin main && git show origin/main:infra/sicom-deploy.sh | bash -s -- $($args2 -join ' ')"
& ssh @SshOpts $VmHost $remote
$code = $LASTEXITCODE
if ($code -eq 0 -and -not $DryRun) {
  Write-Host "Produccion revertida a $A." -ForegroundColor Green
  Write-Host 'Siguiente: corregir en desarrollo -> PROMOVER -A pruebas -> PRUEBAS.ps1 -> PROMOVER -A produccion.' -ForegroundColor Cyan
  try {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    Add-Content -Path (Join-Path $LogDir 'despliegues.log') -Encoding UTF8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm') REVERSION $($deployed.Substring(0,7)) -> $A"
  } catch { }
} elseif ($code -ne 0) {
  Write-Host "La reversion fallo (codigo $code). Revisa la salida de arriba." -ForegroundColor Red
}
exit $code
