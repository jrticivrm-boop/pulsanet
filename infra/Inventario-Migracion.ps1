# Inventario de migracion SICOM/TacticalPtx (PC origen -> PC destino).
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File infra\Inventario-Migracion.ps1
#   powershell -File infra\Inventario-Migracion.ps1 -OutHtml
# No imprime secretos; solo nombres de claves y rutas.

param(
  [string]$RepoRoot = 'C:\pulsanet',
  [string]$AuxRoot = 'C:\pulsanet_soporte',
  [switch]$OutHtml
)

$ErrorActionPreference = 'Continue'
$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Test-Item([string]$Path) {
  return [bool](Test-Path -LiteralPath $Path)
}

function Size-Of([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $i = Get-Item -LiteralPath $Path -Force
  if ($i.PSIsContainer) {
    return (Get-ChildItem -LiteralPath $Path -Force -Recurse -File -EA SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
  }
  return $i.Length
}

function Fmt-Size($bytes) {
  if ($null -eq $bytes) { return '-' }
  if ($bytes -ge 1GB) { return '{0:N1} GB' -f ($bytes / 1GB) }
  if ($bytes -ge 1MB) { return '{0:N1} MB' -f ($bytes / 1MB) }
  if ($bytes -ge 1KB) { return '{0:N0} KB' -f ($bytes / 1KB) }
  return "$bytes B"
}

$rows = New-Object System.Collections.Generic.List[object]

function Add-Row([string]$Group, [string]$Item, [string]$Path, [string]$Level, [string]$Notes = '') {
  $ok = Test-Item $Path
  $sz = if ($ok) { Fmt-Size (Size-Of $Path) } else { '-' }
  $status = if ($ok) { 'OK' } else { 'FALTA' }
  $rows.Add([pscustomobject]@{
      Grupo  = $Group
      Item   = $Item
      Ruta   = $Path
      Estado = $status
      Nivel  = $Level
      Tamano = $sz
      Notas  = $Notes
    }) | Out-Null
}

Write-Host "=== Inventario migracion SICOM/TacticalPtx ===" -ForegroundColor Cyan
Write-Host "Fecha: $now"
Write-Host "Repo:  $RepoRoot"
Write-Host "Aux:   $AuxRoot"
Write-Host ''

# --- Carpetas raiz ---
Add-Row 'Raiz' 'Producto (repo)' $RepoRoot 'OBLIGATORIO' 'Copiar completa'
Add-Row 'Raiz' 'Soporte auxiliar' $AuxRoot 'OBLIGATORIO' 'Documentos, APK, Respaldos, Logs'
Add-Row 'Raiz' 'pulsanet-dev (opcional)' 'C:\pulsanet-dev' 'OPCIONAL' 'Solo si usas arbol DEV paralelo'

# --- Secretos / config ---
Add-Row 'Secretos' 'backend\.env' (Join-Path $RepoRoot 'backend\.env') 'OBLIGATORIO' 'Gitignored; sin esto chat cifrado ilegible si regeneras claves'
Add-Row 'Secretos' 'backend\.env.example' (Join-Path $RepoRoot 'backend\.env.example') 'RECOMENDADO' ''
Add-Row 'Secretos' 'Firebase Admin JSON' (Join-Path $RepoRoot 'infra\secrets\tacticalptx-firebase-adminsdk.json') 'OBLIGATORIO-FCM' 'Ruta tipica FIREBASE_SERVICE_ACCOUNT'
Add-Row 'Secretos' 'google-services.json (APK)' (Join-Path $RepoRoot 'mobile\android\app\google-services.json') 'OBLIGATORIO-FCM' 'Gitignored'
Add-Row 'Secretos' 'upload-keystore.jks' (Join-Path $RepoRoot 'mobile\android\upload-keystore.jks') 'OBLIGATORIO-APK' 'Firma release; mismo alias upload'
Add-Row 'Secretos' 'key.properties' (Join-Path $RepoRoot 'mobile\android\key.properties') 'OBLIGATORIO-APK' 'Gitignored'
Add-Row 'Secretos' 'infra\certs LAN' (Join-Path $RepoRoot 'infra\certs') 'RECOMENDADO' 'TLS Vite/API LAN'
Add-Row 'Secretos' 'Caddy data (LE certs)' (Join-Path $RepoRoot 'infra\caddy\data') 'RECOMENDADO' 'Evita re-ACME; puede estar vacio'

# --- Runtime binarios / datos ---
Add-Row 'Runtime' 'Caddy exe' (Join-Path $RepoRoot 'infra\caddy\caddy.exe') 'RECOMENDADO' 'Borde HTTPS publico'
Add-Row 'Runtime' 'LiveKit server' (Join-Path $RepoRoot 'infra\livekit\livekit-server.exe') 'OBLIGATORIO' 'PTT/voz'
Add-Row 'Runtime' 'backend\uploads' (Join-Path $RepoRoot 'backend\uploads') 'OBLIGATORIO' 'Multimedia; o restaurar desde ZIP'
Add-Row 'Runtime' 'backend\data\backups' (Join-Path $RepoRoot 'backend\data\backups') 'RECOMENDADO' 'Zips automaticos BD+uploads'
Add-Row 'Runtime' 'frontend\' (Join-Path $RepoRoot 'frontend') 'OBLIGATORIO' 'UI canonica (no web\)'
Add-Row 'Runtime' '.cursor\rules' (Join-Path $RepoRoot '.cursor\rules') 'RECOMENDADO' 'Anti-regresion / docs / APK'

# --- Auxiliar ---
Add-Row 'Auxiliar' 'APK' (Join-Path $AuxRoot 'APK') 'RECOMENDADO' 'SICOM-latest.apk etc.'
Add-Row 'Auxiliar' 'Documentos' (Join-Path $AuxRoot 'Documentos') 'RECOMENDADO' 'Bitacora copia, guias'
Add-Row 'Auxiliar' 'Respaldos' (Join-Path $AuxRoot 'Respaldos') 'RECOMENDADO' ''
Add-Row 'Auxiliar' 'Logs' (Join-Path $AuxRoot 'Logs') 'OPCIONAL' ''
Add-Row 'Auxiliar' 'Brand' (Join-Path $AuxRoot 'Brand') 'OPCIONAL' ''
Add-Row 'Auxiliar' 'Cursor rules copia' (Join-Path $AuxRoot 'Cursor') 'OPCIONAL' ''
Add-Row 'Auxiliar' 'Secrets externo' (Join-Path $AuxRoot 'Secrets') 'OPCIONAL' 'Si existe, copiar'

# --- Claves .env (solo nombres) ---
$envFile = Join-Path $RepoRoot 'backend\.env'
$envKeys = @()
$criticalKeys = @(
  'JWT_SECRET', 'CONTENT_ENCRYPTION_KEY', 'WIRE_ENCRYPTION_KEY', 'LIVEKIT_E2EE_SECRET',
  'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'DATABASE_URL', 'REDIS_URL',
  'PUBLIC_DOMAIN', 'STABLE_PUBLIC_DOMAIN', 'APP_UPDATE_SECRET', 'FIREBASE_SERVICE_ACCOUNT'
)
$keyStatus = @()
if (Test-Item $envFile) {
  $envKeys = @(
    Select-String -Path $envFile -Pattern '^[A-Z0-9_]+=' |
      ForEach-Object { ($_.Line -split '=', 2)[0] } |
      Sort-Object -Unique
  )
  foreach ($k in $criticalKeys) {
    $keyStatus += [pscustomobject]@{
      Clave  = $k
      Estado = if ($envKeys -contains $k) { 'OK' } else { 'FALTA' }
    }
  }
}

# --- Ultimo ZIP backup ---
$backupDir = Join-Path $RepoRoot 'backend\data\backups'
$latestZip = $null
if (Test-Item $backupDir) {
  $latestZip = Get-ChildItem -LiteralPath $backupDir -Filter 'tacticalptx_*.zip' -EA SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

# --- Software destino (solo info en origen) ---
$soft = @(
  [pscustomobject]@{ Soft = 'Node.js'; Ok = [bool](Get-Command node -EA SilentlyContinue); Hint = 'LTS 18+' }
  [pscustomobject]@{ Soft = 'Git'; Ok = [bool](Get-Command git -EA SilentlyContinue); Hint = 'recomendado' }
  [pscustomobject]@{ Soft = 'Flutter'; Ok = [bool](Get-Command flutter -EA SilentlyContinue); Hint = 'solo si compilas APK' }
  [pscustomobject]@{ Soft = 'PostgreSQL servicio'; Ok = [bool](Get-Service *postgres* -EA SilentlyContinue | Where-Object { $_.Status -eq 'Running' }); Hint = ':5432' }
  [pscustomobject]@{ Soft = 'Redis'; Ok = [bool](Get-NetTCPConnection -LocalPort 6379 -State Listen -EA SilentlyContinue); Hint = ':6379' }
)

# --- Salida consola ---
Write-Host '--- Checklist archivos/carpetas ---' -ForegroundColor Yellow
$rows | Format-Table Grupo, Estado, Nivel, Item, Tamano -AutoSize

$faltanObl = @($rows | Where-Object { $_.Estado -eq 'FALTA' -and $_.Nivel -like 'OBLIGATORIO*' })
$faltanRec = @($rows | Where-Object { $_.Estado -eq 'FALTA' -and $_.Nivel -eq 'RECOMENDADO' })

Write-Host '--- Claves criticas en backend\.env (nombres) ---' -ForegroundColor Yellow
if ($keyStatus.Count) { $keyStatus | Format-Table -AutoSize } else { Write-Host 'Sin .env' -ForegroundColor Red }

Write-Host '--- Ultimo respaldo ZIP ---' -ForegroundColor Yellow
if ($latestZip) {
  Write-Host ("{0}  {1}  {2}" -f $latestZip.Name, (Fmt-Size $latestZip.Length), $latestZip.LastWriteTime)
} else {
  Write-Host 'NO hay tacticalptx_*.zip en backend\data\backups — genera uno desde Config > Respaldos' -ForegroundColor Red
}

Write-Host '--- Software en ESTE PC (referencia) ---' -ForegroundColor Yellow
$soft | Format-Table Soft, @{N = 'Presente'; E = { if ($_.Ok) { 'OK' } else { 'NO' } } }, Hint -AutoSize

Write-Host ''
Write-Host '=== RESUMEN COPIA ===' -ForegroundColor Cyan
Write-Host '1) C:\pulsanet  (incluye .env, uploads, infra\secrets, keystore, google-services, .cursor\rules)'
Write-Host '2) C:\pulsanet_soporte  (APK, Documentos, Respaldos)'
Write-Host '3) Llevar aparte el ZIP mas reciente de backend\data\backups (o generar uno fresco)'
Write-Host 'NO basta con git clone: .env, keystore, google-services y secrets estan en .gitignore'
Write-Host ''

if ($faltanObl.Count -gt 0) {
  Write-Host 'FALTAN OBLIGATORIOS:' -ForegroundColor Red
  $faltanObl | ForEach-Object { Write-Host (" - [{0}] {1} -> {2}" -f $_.Nivel, $_.Item, $_.Ruta) }
} else {
  Write-Host 'Obligatorios de archivo: OK en este PC' -ForegroundColor Green
}
if ($faltanRec.Count -gt 0) {
  Write-Host 'Faltan recomendados:' -ForegroundColor Yellow
  $faltanRec | ForEach-Object { Write-Host (" - {0} -> {1}" -f $_.Item, $_.Ruta) }
}

# --- Export ---
$outDir = Join-Path $AuxRoot 'Documentos'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$csvPath = Join-Path $outDir "INVENTARIO_MIGRACION_$stamp.csv"
$rows | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host ''
Write-Host "CSV: $csvPath" -ForegroundColor Green

$mdPath = Join-Path $outDir "INVENTARIO_MIGRACION_$stamp.md"
$zipLine = if ($latestZip) { $latestZip.FullName } else { 'NO ENCONTRADO' }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Inventario migracion - $now")
[void]$sb.AppendLine('')
[void]$sb.AppendLine("- Repo: ``$RepoRoot``")
[void]$sb.AppendLine("- Aux: ``$AuxRoot``")
[void]$sb.AppendLine("- Ultimo ZIP: $zipLine")
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Archivos / carpetas')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Grupo | Estado | Nivel | Item | Ruta | Tamano |')
[void]$sb.AppendLine('|-------|--------|-------|------|------|--------|')
foreach ($r in $rows) {
  [void]$sb.AppendLine(("| {0} | **{1}** | {2} | {3} | ``{4}`` | {5} |" -f $r.Grupo, $r.Estado, $r.Nivel, $r.Item, $r.Ruta, $r.Tamano))
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Tres paquetes a copiar')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('1. **Producto:** ``C:\pulsanet`` (completo, no solo git)')
[void]$sb.AppendLine('2. **Soporte:** ``C:\pulsanet_soporte``')
[void]$sb.AppendLine('3. **Respaldo fresco:** ZIP ``backend\data\backups\tacticalptx_*.zip``')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Que suele olvidarse (gitignore)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('- ``backend\.env``')
[void]$sb.AppendLine('- ``mobile\android\upload-keystore.jks`` + ``key.properties``')
[void]$sb.AppendLine('- ``mobile\android\app\google-services.json``')
[void]$sb.AppendLine('- ``infra\secrets\*.json`` (Firebase)')
[void]$sb.AppendLine('- ``infra\certs\*.pem``')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Software en PC destino')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('- Node.js LTS, PostgreSQL 15-18, Redis, Git')
[void]$sb.AppendLine('- Flutter/Android SDK solo si compilas APK')
[void]$sb.AppendLine('- Luego: CREAR-O-ACTUALIZAR-BD.bat -> LEVANTAR-TACTICALPTX.bat -> restaurar ZIP')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('Ver: docs\INSTALAR_OTRA_MAQUINA.md y PROMPT_AGENTE_OTRA_MAQUINA.md.')
[System.IO.File]::WriteAllText($mdPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host "MD:  $mdPath" -ForegroundColor Green

if ($OutHtml) {
  $htmlPath = Join-Path $outDir "INVENTARIO_MIGRACION_$stamp.html"
  $rows | ConvertTo-Html -Title "Inventario migracion $stamp" | Set-Content $htmlPath -Encoding UTF8
  Write-Host "HTML: $htmlPath" -ForegroundColor Green
}

# exit code: 2 si falta algo obligatorio
if ($faltanObl.Count -gt 0 -or -not $latestZip) { exit 2 }
exit 0
