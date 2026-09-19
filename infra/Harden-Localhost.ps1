# Harden-Localhost.ps1 — Postgres/Redis solo en 127.0.0.1 (idempotente).
# Requiere Admin. Rollback: restaurar .conf desde
#   C:\pulsanet_soporte\Respaldos\harden-localhost-*
#
# Uso: powershell -File infra\Harden-Localhost.ps1

$ErrorActionPreference = 'Stop'
$pg = 'C:\Program Files\PostgreSQL\18\data\postgresql.conf'
$rd = 'C:\Program Files\Redis\redis.windows-service.conf'

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  Write-Host 'Elevando a Administrador...' -ForegroundColor Yellow
  $p = Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath
  ) -PassThru -Wait
  exit $p.ExitCode
}

if (-not (Test-Path $pg)) { throw "Falta $pg" }
if (-not (Test-Path $rd)) { throw "Falta $rd" }

$bakRoot = 'C:\pulsanet_soporte\Respaldos'
New-Item -ItemType Directory -Force -Path $bakRoot | Out-Null
$bak = Join-Path $bakRoot ("harden-localhost-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $bak | Out-Null
Copy-Item $pg (Join-Path $bak 'postgresql.conf')
Copy-Item $rd (Join-Path $bak 'redis.windows-service.conf')
Write-Host "Backup: $bak"

$pgLines = [IO.File]::ReadAllLines($pg)
$pgOut = foreach ($line in $pgLines) {
  if ($line -match '^\s*#?\s*listen_addresses\s*=') {
    "listen_addresses = 'localhost'		# TacticalPtx harden: solo loopback"
  } else { $line }
}
[IO.File]::WriteAllLines($pg, $pgOut)
Write-Host "OK Postgres listen_addresses=localhost"

$rdLines = [IO.File]::ReadAllLines($rd)
$hasBind = $false
$rdOut = foreach ($line in $rdLines) {
  if ($line -match '^\s*#?\s*bind\s+') {
    if (-not $hasBind) {
      $hasBind = $true
      'bind 127.0.0.1'
    }
  } else { $line }
}
if (-not $hasBind) {
  $list = New-Object System.Collections.Generic.List[string]
  foreach ($line in $rdOut) {
    [void]$list.Add($line)
    if ($line -match '^\s*port\s+6379') { [void]$list.Add('bind 127.0.0.1') }
  }
  $rdOut = $list
}
[IO.File]::WriteAllLines($rd, [string[]]$rdOut)
Write-Host 'OK Redis bind 127.0.0.1'

Restart-Service -Name 'postgresql-x64-18' -Force
$redisSvc = Get-Service | Where-Object { $_.Name -match 'Redis' -or $_.DisplayName -match 'Redis' } | Select-Object -First 1
if (-not $redisSvc) { throw 'Servicio Redis no encontrado' }
Restart-Service -Name $redisSvc.Name -Force
Start-Sleep 3

$pgNet = netstat -ano | Select-String ':5432.+LISTENING'
$rdNet = netstat -ano | Select-String ':6379.+LISTENING'
Write-Host "PG: $pgNet"
Write-Host "RD: $rdNet"
if ("$pgNet$rdNet" -match '0\.0\.0\.0:(5432|6379)') {
  Write-Host 'AVISO: aun aparece 0.0.0.0 — revisa conf/servicio' -ForegroundColor Yellow
  exit 2
}
Write-Host 'Listo: DB/cache solo localhost' -ForegroundColor Green
exit 0
