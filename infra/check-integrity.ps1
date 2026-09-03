# TacticalPtx - chequeo de integridad (paths, TLS, firewall, crypto flags)
# No imprime secretos. Uso: powershell -File infra\check-integrity.ps1

$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Root 'backend\package.json'))) {
  $Root = 'C:\pulsanet'
}
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

Write-Host "Root: $Root" -ForegroundColor Cyan
$script:fail = 0

function Ok([string]$m) { Write-Host " OK  $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "WARN $m" -ForegroundColor Yellow }
function Bad([string]$m) { Write-Host "FAIL $m" -ForegroundColor Red; $script:fail++ }

# --- Paths canonico ---
if ($Root -match '^[Cc]:\\') { Ok 'Workspace en C: (canonico)' }
else { Warn "Workspace no esta en C:\pulsanet ($Root)" }

$certs = @(
  (Join-Path $Root 'infra\certs\lan-cert.pem'),
  (Join-Path $Root 'infra\certs\lan-key.pem')
)
foreach ($c in $certs) {
  if (Test-Path $c) { Ok ("Cert " + (Split-Path $c -Leaf)) }
  else { Bad ("Falta $c - generar: node infra\generate-lan-certs.mjs") }
}

# --- .env paths (solo existencia / drive) ---
$envFile = Join-Path $Root 'backend\.env'
if (-not (Test-Path $envFile)) {
  Bad 'Falta backend\.env'
} else {
  Ok 'backend\.env presente'
  $lines = Get-Content $envFile
  foreach ($key in @('TLS_CERT','TLS_KEY','FIREBASE_SERVICE_ACCOUNT','APP_UPDATES_DIR')) {
    $line = $lines | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if (-not $line) {
      if ($key -eq 'APP_UPDATES_DIR') { continue }
      if ($key -eq 'FIREBASE_SERVICE_ACCOUNT') { Warn "$key no definido (FCM off)"; continue }
      Warn "$key no definido"
      continue
    }
    $val = ($line -split '=',2)[1].Trim().Trim('"')
    if (-not $val) {
      if ($key -eq 'FIREBASE_SERVICE_ACCOUNT') { Warn 'FCM path vacio' }
      continue
    }
    if ($val -match '^[Dd]:\\') {
      Bad "$key apunta a D: (fragil) - usar C:\pulsanet\..."
    }
    if (Test-Path $val) { Ok "$key existe en disco" }
    else { Bad "$key path no existe en disco" }
  }
  $hasWire = ($lines | Where-Object { $_ -match '^WIRE_ENCRYPTION_KEY=.+' }) -ne $null
  $hasContent = ($lines | Where-Object { $_ -match '^CONTENT_ENCRYPTION_KEY=.+' }) -ne $null
  $hasVoice = ($lines | Where-Object { $_ -match '^LIVEKIT_E2EE_SECRET=.+' }) -ne $null
  if ($hasWire) { Ok 'WIRE_ENCRYPTION_KEY definido' } else { Warn 'WIRE_ENCRYPTION_KEY ausente' }
  if ($hasContent) { Ok 'CONTENT_ENCRYPTION_KEY definido' } else { Warn 'CONTENT_ENCRYPTION_KEY ausente' }
  if ($hasVoice) { Ok 'LIVEKIT_E2EE_SECRET definido' } else { Warn 'LIVEKIT_E2EE_SECRET ausente' }
}

# --- Firewall ---
$rules = @(
  'TacticalPtx-TCP-4000','TacticalPtx-TCP-5173','TacticalPtx-TCP-80','TacticalPtx-TCP-443',
  'TacticalPtx-TCP-7880','TacticalPtx-TCP-7881','TacticalPtx-UDP-7882',
  'TacticalPtx-UDP-3478','TacticalPtx-UDP-50000-50200'
)
$missing = @()
foreach ($n in $rules) {
  $out = & netsh.exe advfirewall firewall show rule name="$n" 2>$null | Out-String
  if ($out -match 'No se encontraron|No rules match' -or $LASTEXITCODE -ne 0) { $missing += $n }
}
if ($missing.Count -eq 0) { Ok ("Firewall: " + $rules.Count + " reglas TacticalPtx-*") }
else {
  Warn ("Firewall faltan: " + ($missing -join ', '))
  Write-Host '     Ejecutar como Admin: infra\ENSURE-FIREWALL.cmd' -ForegroundColor Yellow
}

# --- Health ---
try {
  add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TpxTrustAll : ICertificatePolicy {
  public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
  [System.Net.ServicePointManager]::CertificatePolicy = New-Object TpxTrustAll
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
  $h = Invoke-RestMethod -Uri 'https://127.0.0.1:4000/api/health' -TimeoutSec 8
  if ($h.ok) {
    Ok ("API health ok tls=$($h.tls) redis=$($h.redis) livekit=$($h.livekit) fcm=$($h.fcm)")
    if ($null -ne $h.wireEncryption) {
      Ok ("wire=$($h.wireEncryption) content=$($h.contentEncryption) voice=$($h.voiceE2ee)")
    }
    if ($h.tls -ne 'on') { Bad 'API health tls=off (Vite/Caddy esperan HTTPS)' }
  } else { Bad 'API health ok=false' }
} catch {
  Warn ("API no responde en https://127.0.0.1:4000/api/health: " + $_.Exception.Message)
}

# --- IP publica / borde / LiveKit ICE ---
$drift = Test-TpxPublicIpDrift -Root $Root
if ($drift.Current) {
  if ($drift.Drift) {
    Bad ("IP publica desalineada ($($drift.Reason)): stored=$($drift.Stored) yaml=$($drift.YamlIp) current=$($drift.Current). Ejecuta infra\ENSURE-PUBLIC-EDGE.ps1")
  } else {
    Ok ("IP publica alineada: $($drift.Current)")
  }
} else {
  Warn 'No se pudo consultar ipify (comprobar red)'
}

$pubDom = Get-TpxPublicDomainFromEnv -Root $Root
if ($pubDom) {
  $code = & curl.exe -sk --connect-timeout 8 --max-time 12 -o NUL -w '%{http_code}' "https://$pubDom/api/health" 2>$null
  if ($code -eq '200') { Ok "Edge publico OK https://$pubDom/api/health" }
  else { Bad "Edge publico health=$code en https://$pubDom (Caddy/UPnP?)" }
} elseif ($drift.Current) {
  Warn 'PUBLIC_DOMAIN ausente en .env'
}

if (Test-Path (Join-Path $Root 'infra\livekit\livekit-server.exe')) {
  if (Test-NetConnection -ComputerName 127.0.0.1 -Port 7880 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded) {
    Ok 'LiveKit :7880 escuchando'
  } else {
    Bad 'LiveKit :7880 no escucha. Ejecuta infra\start-services.ps1'
  }
}

Write-Host ''
if ($script:fail -gt 0) {
  Write-Host ("Integridad: " + $script:fail + " fallo(s)") -ForegroundColor Red
  exit 1
}
Write-Host 'Integridad: OK' -ForegroundColor Green
exit 0
