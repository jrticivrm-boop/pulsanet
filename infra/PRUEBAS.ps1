<#
  Ambiente de ANALISIS Y PRUEBAS en la PC (rama pruebas, carpeta C:\pulsanet-pruebas).
  Replica produccion con un build real del frontend y una copia de la BD de la VM SICOM.

    Web:  https://localhost:5180   (o https://<IP-de-la-PC>:5180 desde la LAN)
    API:  puerto 4200   | BD local: tacticalptx_pruebas | Redis db 2
    Sin push FCM (no molesta a los telefonos reales) y sin respaldos automaticos.

  Uso:
    .\infra\PRUEBAS.ps1                    # reconstruye y (re)levanta con el codigo de la rama pruebas
    .\infra\PRUEBAS.ps1 -RefrescarBD       # ademas trae una copia fresca de la BD de produccion
    .\infra\PRUEBAS.ps1 -RefrescarBD -ConMedia   # + fotos/audios (backend/uploads, ~230 MB)
    .\infra\PRUEBAS.ps1 -Detener           # apaga el ambiente de pruebas
#>
param(
  [switch]$RefrescarBD,
  [switch]$ConMedia,
  [switch]$Detener
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$Wt = 'C:\pulsanet-pruebas'
$ApiPort = 4200
$WebPort = 5180
$DbName = 'tacticalptx_pruebas'
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$VmHost = 'pulsanet@192.168.1.150'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshCmd = "ssh -i `"$Key`" -o BatchMode=yes -o ConnectTimeout=10 $VmHost"

function Stop-Port([int]$port) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    if ($p -gt 4) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
  }
}

function Set-EnvKeys([string]$path, [hashtable]$values) {
  $lines = [System.Collections.Generic.List[string]]([IO.File]::ReadAllLines($path))
  foreach ($k in $values.Keys) {
    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*$k=") { $idx = $i; break } }
    $line = "$k=$($values[$k])"
    if ($idx -ge 0) { $lines[$idx] = $line } else { $lines.Add($line) }
  }
  [IO.File]::WriteAllLines($path, $lines)
}

function Get-EnvValue([string]$path, [string]$key) {
  $m = Select-String -Path $path -Pattern "^\s*$key=(.*)$" | Select-Object -First 1
  if ($m) { return $m.Matches[0].Groups[1].Value.Trim().Trim('"') }
  return ''
}

if ($Detener) {
  Stop-Port $ApiPort; Stop-Port $WebPort
  Write-Host 'Ambiente de pruebas detenido.' -ForegroundColor Green
  exit 0
}

# 1) Worktree en la rama pruebas
if (-not (Test-Path $Wt)) {
  Write-Host "Creando worktree $Wt (rama pruebas)..." -ForegroundColor Cyan
  git -C $Repo worktree add $Wt pruebas
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el worktree de pruebas.' }
}
$branch = (git -C $Wt rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'pruebas') { throw "$Wt esta en '$branch', se esperaba 'pruebas'." }
Write-Host "Codigo en pruebas: $(git -C $Wt log -1 --format='%h %s')" -ForegroundColor Cyan

# 2) Configuracion propia (se crea una vez desde la de desarrollo)
$envPath = Join-Path $Wt 'backend\.env'
$srcEnv = Join-Path $Repo 'backend\.env'
$devDbUrl = Get-EnvValue $srcEnv 'DATABASE_URL'
$u = [Uri]($devDbUrl -replace '^postgres(ql)?:', 'http:')
$pgUser = [Uri]::UnescapeDataString($u.UserInfo.Split(':')[0])
$pgPass = [Uri]::UnescapeDataString(($u.UserInfo.Split(':', 2) + '')[1])
$pgHost = $u.Host; $pgPort = if ($u.Port -gt 0) { $u.Port } else { 5432 }

if (-not (Test-Path $envPath)) {
  Copy-Item $srcEnv $envPath
  $lanIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -ExpandProperty IPAddress
  $origins = @("http://localhost:$WebPort", "https://localhost:$WebPort", "http://127.0.0.1:$WebPort", "https://127.0.0.1:$WebPort")
  foreach ($ip in $lanIps) { $origins += "https://${ip}:$WebPort" }
  $pruebasUrl = $devDbUrl -replace '/[^/?]+(\?|$)', "/$DbName`$1"
  Set-EnvKeys $envPath @{
    PORT                     = "$ApiPort"
    DATABASE_URL             = $pruebasUrl
    REDIS_URL                = 'redis://127.0.0.1:6379/2'
    CORS_ORIGINS             = ($origins -join ',')
    WEB_PUBLIC_URL           = "https://localhost:$WebPort"
    PUBLIC_DOMAIN            = ''
    FIREBASE_SERVICE_ACCOUNT = ''
    FIREBASE_PROJECT_ID      = ''
    FIREBASE_CLIENT_EMAIL    = ''
    FIREBASE_PRIVATE_KEY     = ''
    ALLOW_HOST_LOCKDOWN      = '0'
  }
  Write-Host "Creado $envPath (puerto $ApiPort, BD $DbName, sin FCM)." -ForegroundColor Green
}

$dataDir = Join-Path $Wt 'backend\data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$bkCfg = Join-Path $dataDir 'backup-config.json'
if (-not (Test-Path $bkCfg)) {
  '{ "enabled": false, "intervalHours": 24, "retentionCount": 3 }' | Set-Content -Path $bkCfg -Encoding ascii
}

$certSrc = Join-Path $Repo 'infra\certs'
$certDst = Join-Path $Wt 'infra\certs'
if ((Test-Path $certSrc) -and -not (Test-Path (Join-Path $certDst 'lan-cert.pem'))) {
  New-Item -ItemType Directory -Force -Path $certDst | Out-Null
  Copy-Item (Join-Path $certSrc '*.pem') $certDst
}

# 3) Copia de la BD de produccion
$env:PGPASSWORD = $pgPass
$pgArgs = @('-h', $pgHost, '-p', "$pgPort", '-U', $pgUser)
$exists = & "$PgBin\psql.exe" @pgArgs -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ($RefrescarBD -or -not $exists) {
  if (-not (Test-Path $Key)) { throw "Falta la llave SSH $Key" }
  $dump = Join-Path $env:TEMP "sicom_prod_$(Get-Date -Format yyyyMMdd_HHmmss).dump"
  Write-Host 'Descargando copia de la BD de produccion...' -ForegroundColor Cyan
  $remoteDump = 'cd /opt/pulsanet/infra && set -a && . ./.env.prod && set +a && docker compose -f docker-compose.sicom.yml --env-file .env.prod exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'
  # cmd.exe para que la redireccion binaria no se corrompa (PowerShell 5 re-codifica pipes).
  cmd /c "$SshCmd `"$remoteDump`" > `"$dump`""
  if ($LASTEXITCODE -ne 0 -or (Get-Item $dump).Length -lt 1024) { throw 'Fallo la descarga del respaldo de produccion.' }
  Write-Host ("  {0:N1} MB" -f ((Get-Item $dump).Length / 1MB))

  Stop-Port $ApiPort
  & "$PgBin\psql.exe" @pgArgs -d postgres -qc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DbName'" | Out-Null
  & "$PgBin\dropdb.exe" @pgArgs --if-exists $DbName
  & "$PgBin\createdb.exe" @pgArgs $DbName
  if ($LASTEXITCODE -ne 0) { throw "No se pudo crear $DbName" }
  & "$PgBin\pg_restore.exe" @pgArgs -d $DbName --no-owner --no-privileges $dump
  if ($LASTEXITCODE -gt 1) { throw 'pg_restore fallo.' }
  Remove-Item $dump -Force
  Write-Host "BD $DbName restaurada desde produccion." -ForegroundColor Green
}

if ($ConMedia) {
  Write-Host 'Copiando multimedia de produccion (backend/uploads)...' -ForegroundColor Cyan
  $upl = Join-Path $Wt 'backend'
  cmd /c "$SshCmd `"tar -C /opt/pulsanet/backend -cf - uploads`" | tar -xf - -C `"$upl`""
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la copia de multimedia.' }
}

# 4) Migraciones del codigo en pruebas sobre la copia (asi se ensayan antes de produccion)
Push-Location (Join-Path $Wt 'backend')
try {
  $lockHash = (Get-FileHash package-lock.json).Hash
  $stamp = 'node_modules\.pruebas-lock'
  if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
    Write-Host 'npm ci (backend)...' -ForegroundColor Cyan
    npm ci --omit=dev --no-audit --no-fund | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'npm ci backend fallo' }
    Set-Content $stamp $lockHash
  }
  Write-Host 'Aplicando migraciones sobre la copia...' -ForegroundColor Cyan
  node src/scripts/apply-all-migrations.js | Select-String -Pattern 'ERROR|RESUMEN|Migraciones' | ForEach-Object { Write-Host "  $_" }
  if ($LASTEXITCODE -ne 0) { throw 'Las migraciones fallaron en pruebas: NO promover a produccion.' }
} finally { Pop-Location }

# 5) Build real del frontend (igual que el contenedor web de produccion)
Push-Location (Join-Path $Wt 'frontend')
try {
  $lockHash = (Get-FileHash package-lock.json).Hash
  $stamp = 'node_modules\.pruebas-lock'
  if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
    Write-Host 'npm ci (frontend)...' -ForegroundColor Cyan
    npm ci --no-audit --no-fund | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'npm ci frontend fallo' }
    Set-Content $stamp $lockHash
  }
  Write-Host 'Compilando frontend...' -ForegroundColor Cyan
  $env:VITE_API_URL = ''; $env:VITE_SOCKET_URL = ''
  npm run build 2>&1 | Select-String -Pattern 'error|built in' | ForEach-Object { Write-Host "  $_" }
  if ($LASTEXITCODE -ne 0) { throw 'El build del frontend fallo: NO promover a produccion.' }
} finally { Pop-Location }

# 6) Levantar API + web (ventanas propias)
Stop-Port $ApiPort; Stop-Port $WebPort
$tlsCert = Get-EnvValue $envPath 'TLS_CERT'
$apiScheme = if ($tlsCert -and (Test-Path $tlsCert)) { 'https' } else { 'http' }
Start-Process cmd -ArgumentList '/k', "title PRUEBAS API :$ApiPort && cd /d `"$Wt\backend`" && node src/server.js"
Start-Process cmd -ArgumentList '/k', "title PRUEBAS WEB :$WebPort && cd /d `"$Wt\frontend`" && set VITE_API_PROXY=${apiScheme}://127.0.0.1:$ApiPort&& npx vite preview --port $WebPort --strictPort --host"

$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = & curl.exe -sk -m 3 -o NUL -w '%{http_code}' "${apiScheme}://127.0.0.1:$ApiPort/api/health"
    if ($r -eq '200') { $ok = $true; break }
  } catch { }
}
if ($ok) {
  Write-Host ''
  Write-Host "PRUEBAS arriba: https://localhost:$WebPort  (API :$ApiPort, BD $DbName)" -ForegroundColor Green
  Write-Host 'Cuando quede validado: .\infra\PROMOVER.ps1 -A produccion' -ForegroundColor Cyan
} else {
  Write-Host "La API de pruebas no respondio en :$ApiPort; revisa la ventana 'PRUEBAS API'." -ForegroundColor Red
  exit 1
}
