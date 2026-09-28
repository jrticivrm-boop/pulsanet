<#
  Verificacion automatica ANTES de subir a produccion (la llama PROMOVER.ps1 -A produccion).
  Solo lectura: no modifica la PC ni la VM.

  Revisa:
    - Que el ambiente de pruebas corre EXACTAMENTE el commit de la rama pruebas (el que se va a subir).
    - API :4200 (BD conectada, sin FCM) y web :5180 respondiendo.
    - Sintaxis de los .js de backend que cambian (node --check).
    - Migraciones de BD nuevas (se ensayaron en pruebas; en produccion requieren -Migrate).
    - Antiguedad de la copia de BD de pruebas.
    - Produccion sana y ultimo despliegue OK; usuarios conectados ahora (para elegir el momento).

  Uso:  .\infra\VERIFICAR-PRUEBAS.ps1
  Salida: 0 = listo para subir | 1 = hay fallas (no subir)
#>
# Continue: en PowerShell 5 el stderr de git/ssh con 'Stop' aborta; cada resultado se evalua a mano.
$ErrorActionPreference = 'Continue'

$Repo = Split-Path -Parent $PSScriptRoot
$Wt = 'C:\pulsanet-pruebas'
$ApiPort = 4200
$WebPort = 5180
$MaxDiasBd = 7
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10')
$LogDir = 'C:\pulsanet_soporte\Pruebas'

$script:fails = 0
$script:warns = 0
$script:lines = @()
function Report([string]$level, [string]$msg) {
  $color = @{ OK = 'Green'; AVISO = 'Yellow'; FALLA = 'Red'; INFO = 'Cyan' }[$level]
  Write-Host ("[{0,-5}] {1}" -f $level, $msg) -ForegroundColor $color
  $script:lines += "[$level] $msg"
  if ($level -eq 'FALLA') { $script:fails++ }
  if ($level -eq 'AVISO') { $script:warns++ }
}

function Get-Health([string]$url) {
  $raw = cmd /c "curl.exe -sk -m 6 $url 2>nul"
  if (-not $raw) { return $null }
  try { return ($raw | Out-String | ConvertFrom-Json) } catch { return $null }
}

Write-Host '== Verificacion de pruebas antes de produccion ==' -ForegroundColor Cyan

# 1) Rama y worktree
$pruebasSha = (git -C $Repo rev-parse pruebas).Trim()
$mainSha = (git -C $Repo rev-parse main).Trim()
$pending = @(git -C $Repo log --oneline "main..pruebas")
if ($pending.Count -eq 0) {
  Report 'INFO' 'pruebas no tiene commits nuevos respecto a produccion (main).'
} else {
  Report 'INFO' "Commits a subir: $($pending.Count)"
  $pending | ForEach-Object { Write-Host "         $_" }
}
git -C $Repo merge-base --is-ancestor main pruebas
if ($LASTEXITCODE -ne 0) { Report 'FALLA' 'main tiene commits que no estan en pruebas (no seria fast-forward).' }

if (-not (Test-Path $Wt)) {
  Report 'FALLA' "No existe $Wt. Corre .\infra\PRUEBAS.ps1"
} else {
  $wtHead = (git -C $Wt rev-parse HEAD).Trim()
  if ($wtHead -ne $pruebasSha) { Report 'FALLA' "La carpeta de pruebas no esta en la punta de la rama pruebas. Corre .\infra\PRUEBAS.ps1" }
  $wtDirty = git -C $Wt status --porcelain --untracked-files=no
  if ($wtDirty) { Report 'FALLA' "$Wt tiene cambios locales (en pruebas no se edita codigo)." }

  $stampPath = Join-Path $Wt 'backend\data\pruebas-estado.json'
  $stamp = $null
  if (Test-Path $stampPath) { try { $stamp = Get-Content $stampPath -Raw | ConvertFrom-Json } catch { } }
  if (-not $stamp) {
    Report 'FALLA' 'No hay registro de que pruebas se haya levantado con este codigo. Corre .\infra\PRUEBAS.ps1'
  } elseif ($stamp.commit -ne $pruebasSha) {
    Report 'FALLA' "Pruebas corre $($stamp.commit.Substring(0,7)), pero la rama pruebas esta en $($pruebasSha.Substring(0,7)). Corre .\infra\PRUEBAS.ps1 y vuelve a revisar."
  } else {
    Report 'OK' "Pruebas corre el commit a subir ($($pruebasSha.Substring(0,7))), levantado $($stamp.levantado)."
  }

  if ($stamp -and $stamp.bdRefrescada) {
    $age = (Get-Date) - [datetime]$stamp.bdRefrescada
    if ($age.TotalDays -gt $MaxDiasBd) {
      Report 'AVISO' ("Copia de BD de produccion con {0:N0} dias. Recomendado: .\infra\PRUEBAS.ps1 -RefrescarBD" -f $age.TotalDays)
    } else {
      Report 'OK' "Copia de BD de produccion del $($stamp.bdRefrescada)."
    }
  } else {
    Report 'AVISO' 'Fecha de la copia de BD desconocida. Recomendado: .\infra\PRUEBAS.ps1 -RefrescarBD'
  }
}

# 2) Servicios de pruebas
$h = Get-Health "https://127.0.0.1:$ApiPort/api/health"
if (-not $h) { $h = Get-Health "http://127.0.0.1:$ApiPort/api/health" }
if (-not $h -or -not $h.ok) {
  Report 'FALLA' "API de pruebas (:$ApiPort) no responde."
} else {
  if ($h.db -ne 'connected') { Report 'FALLA' "API de pruebas sin BD (db=$($h.db))." } else { Report 'OK' "API de pruebas responde (v$($h.version), BD conectada)." }
  if ($h.fcm -and $h.fcm -ne 'off') { Report 'FALLA' "Pruebas tiene FCM activo ($($h.fcm)): podria notificar telefonos reales." }
}
$web = cmd /c "curl.exe -sk -m 6 -o nul -w %{http_code} https://127.0.0.1:$WebPort/ 2>nul"
if ($web -eq '200') { Report 'OK' "Web de pruebas (:$WebPort) responde." } else { Report 'FALLA' "Web de pruebas (:$WebPort) no responde (HTTP $web)." }

# 3) Sintaxis backend de lo que cambia
$changed = @(git -C $Repo diff --name-only --diff-filter=AM "main..pruebas" -- 'backend/src/*.js' 'backend/src/**/*.js')
$bad = @()
foreach ($f in $changed) {
  $p = Join-Path $Wt $f
  if (-not (Test-Path $p)) { continue }
  cmd /c "node --check `"$p`" >nul 2>&1"
  if ($LASTEXITCODE -ne 0) { $bad += $f }
}
if ($bad.Count) { Report 'FALLA' "Errores de sintaxis en: $($bad -join ', ')" }
elseif ($changed.Count) { Report 'OK' "Sintaxis OK en $($changed.Count) archivo(s) de backend." }

# 4) Migraciones
$migs = @(git -C $Repo diff --name-only --diff-filter=A "main..pruebas" -- 'database/migrations/*.sql')
if ($migs.Count) {
  Report 'AVISO' "Migraciones de BD nuevas ($($migs.Count)): subir con -Migrate (respalda la BD antes). $($migs -join ', ')"
}

# 5) Produccion
if (Test-Path $Key) {
  $ph = Get-Health 'https://192.168.1.150/api/health'
  if ($ph -and $ph.ok) { Report 'OK' "Produccion responde (v$($ph.version))." } else { Report 'AVISO' 'Produccion no responde ahora mismo.' }

  $last = & ssh @SshOpts $VmHost 'tail -n 1 /opt/respaldos/deploys.log 2>/dev/null; test -f /opt/respaldos/ROLLBACK_ACTIVO && echo ROLLBACK_ACTIVO' 2>$null
  if ($last) {
    foreach ($l in @($last)) {
      if ($l -eq 'ROLLBACK_ACTIVO') { Report 'AVISO' 'Produccion esta en una version revertida; lo que subas debe incluir la correccion.' }
      elseif ($l -match ' OK ') { Report 'OK' "Ultimo despliegue: $l" }
      else { Report 'AVISO' "Ultimo despliegue: $l" }
    }
  }
  $sql = "select count(*) from users where last_seen_at > now() - interval '5 minutes';"
  $online = $sql | & ssh @SshOpts $VmHost 'cd /opt/pulsanet/infra && set -a && . ./.env.prod && set +a && docker compose -f docker-compose.sicom.yml --env-file .env.prod exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -At' 2>$null
  if ("$online".Trim() -match '^\d+$') {
    Report 'INFO' "Usuarios activos en produccion (ultimos 5 min): $("$online".Trim()). El despliegue corta PTT/video unos segundos."
  }
} else {
  Report 'AVISO' "Falta la llave SSH $Key; no se reviso produccion."
}

Write-Host ''
if ($script:fails) {
  Write-Host "RESULTADO: NO SUBIR ($script:fails falla(s), $script:warns aviso(s))." -ForegroundColor Red
} else {
  Write-Host "RESULTADO: listo para subir ($script:warns aviso(s)). Revisa ademas docs\CHECKLIST_PRUEBAS.md" -ForegroundColor Green
}

try {
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $head = "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm') pruebas=$($pruebasSha.Substring(0,7)) main=$($mainSha.Substring(0,7)) fallas=$script:fails avisos=$script:warns"
  Add-Content -Path (Join-Path $LogDir 'verificaciones.log') -Value (@($head) + $script:lines + '') -Encoding UTF8
} catch { }

if ($script:fails) { exit 1 }
exit 0
