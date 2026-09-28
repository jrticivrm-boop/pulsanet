<#
  Despliega origin/main en PRODUCCION (VM SICOM 192.168.1.150, /opt/pulsanet).
  Normalmente lo llama PROMOVER.ps1 -A produccion; se puede usar solo para re-desplegar.

  Uso:
    .\infra\DEPLOY-SICOM.ps1                 # auto: reconstruye solo lo que cambio
    .\infra\DEPLOY-SICOM.ps1 -Target web     # forzar solo web (api | web | all)
    .\infra\DEPLOY-SICOM.ps1 -Migrate        # permitir migraciones de BD (respalda antes)
    .\infra\DEPLOY-SICOM.ps1 -DryRun         # solo muestra que haria
#>
param(
  [ValidateSet('auto', 'api', 'web', 'all')][string]$Target = 'auto',
  [switch]$Migrate,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15')

if (-not (Test-Path $Key)) { throw "Falta la llave SSH $Key" }

git -C $Repo fetch -q origin main
$localMain = (git -C $Repo rev-parse main).Trim()
$remoteMain = (git -C $Repo rev-parse origin/main).Trim()
if ($localMain -ne $remoteMain) {
  git -C $Repo merge-base --is-ancestor origin/main main
  if ($LASTEXITCODE -ne 0) { throw 'main local y origin/main divergieron; revisar a mano.' }
  Write-Host 'main local tiene commits sin subir: git push origin main' -ForegroundColor Yellow
  git -C $Repo push -q origin main
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir main a origin.' }
}

$args2 = @($Target)
if ($Migrate) { $args2 += '--migrate' }
if ($DryRun) { $args2 += '--dry-run' }

Write-Host "== Desplegando main ($($remoteMain.Substring(0,7))) en SICOM: $($args2 -join ' ') ==" -ForegroundColor Cyan
# El script se toma de origin/main para que un deploy use siempre su version mas nueva.
$remote = "cd /opt/pulsanet && git fetch -q origin main && git show origin/main:infra/sicom-deploy.sh | bash -s -- $($args2 -join ' ')"
& ssh @SshOpts $VmHost $remote
$code = $LASTEXITCODE
switch ($code) {
  0 { Write-Host 'Produccion actualizada.' -ForegroundColor Green }
  3 { Write-Host 'Detenido: hay migraciones de BD. Repite con -Migrate.' -ForegroundColor Yellow }
  5 { Write-Host 'Detenido: produccion esta revertida y main sigue en la version retirada; sube una correccion.' -ForegroundColor Yellow }
  default { Write-Host "Fallo el despliegue (codigo $code)." -ForegroundColor Red }
}
exit $code
