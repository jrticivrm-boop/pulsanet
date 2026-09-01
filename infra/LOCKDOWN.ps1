# TacticalPtx — lockdown de host (Windows)
# Cierra exposicion de red y detiene API/Web/LiveKit.
# Uso:
#   powershell -File infra\LOCKDOWN.ps1
#   powershell -File infra\LOCKDOWN.ps1 -Reason "intrusion"
# Preferible como Administrador.

param(
  [string]$Reason = 'manual'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Write-Host "=== TacticalPtx HOST LOCKDOWN ===" -ForegroundColor Red
Write-Host "Reason: $Reason"
Write-Host "Root: $root"

# 1) Borrar reglas firewall canonicas (dejar el host sin puertos TacticalPtx abiertos)
$fwNames = @(
  'TacticalPtx-TCP-4000'
  'TacticalPtx-TCP-5173'
  'TacticalPtx-TCP-7880'
  'TacticalPtx-TCP-7881'
  'TacticalPtx-UDP-7882'
  'TacticalPtx-UDP-3478'
  'TacticalPtx-UDP-50000-50200'
)
foreach ($n in $fwNames) {
  netsh advfirewall firewall delete rule name="$n" >$null 2>&1
  Write-Host "Firewall removed: $n"
}

# 2) Intentar quitar UPnP (si el router lo permite)
try {
  $nat = New-Object -ComObject HNetCfg.NATUPnP
  $col = $nat.StaticPortMappingCollection
  if ($col) {
    foreach ($pair in @(
      @{ P = 4000; T = 'TCP' },
      @{ P = 5173; T = 'TCP' },
      @{ P = 7880; T = 'TCP' },
      @{ P = 7881; T = 'TCP' },
      @{ P = 7882; T = 'UDP' },
      @{ P = 3478; T = 'UDP' }
    )) {
      try {
        $col.Remove([int]$pair.P, $pair.T)
        Write-Host "UPnP removed $($pair.T)/$($pair.P)"
      } catch {}
    }
  }
} catch {
  Write-Host "UPnP: no disponible ($($_.Exception.Message))" -ForegroundColor Yellow
}

# 3) Detener procesos del stack (API / Web / LiveKit)
function Stop-Listeners([int[]]$Ports) {
  foreach ($p in $Ports) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        try {
          Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop
          Write-Host "Killed PID $($_.OwningProcess) on :$p"
        } catch {
          Write-Host "No se pudo matar puerto $p (permisos?)" -ForegroundColor Yellow
        }
      }
  }
}

Stop-Listeners @(4000, 5173, 7880, 7881)
Get-Process -Name 'livekit-server' -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    Stop-Process -Id $_.Id -Force
    Write-Host "LiveKit stopped PID $($_.Id)"
  } catch {}
}

# 4) Senal / flag
$dataDir = Join-Path $root 'backend\data'
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
$flag = Join-Path $dataDir 'LOCKDOWN.flag'
if (-not (Test-Path $flag)) {
  @{
    active = $true
    at = (Get-Date).ToUniversalTime().ToString('o')
    reason = $Reason
    source = 'LOCKDOWN.ps1'
  } | ConvertTo-Json | Set-Content -Path $flag -Encoding UTF8
  Write-Host "Flag escrito: $flag"
}

$incRoot = Join-Path $root 'Soporte\Respaldos'
if (-not (Test-Path $incRoot)) { New-Item -ItemType Directory -Path $incRoot | Out-Null }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$incDir = Join-Path $incRoot "incident-host-$stamp"
New-Item -ItemType Directory -Path $incDir | Out-Null
@"
TacticalPtx host lockdown
UTC: $((Get-Date).ToUniversalTime().ToString('o'))
Reason: $Reason
Firewall TacticalPtx-* eliminado
UPnP 4000/5173/7880/7881/7882/3478 intentado eliminar
Procesos API/Web/LiveKit detenidos
"@ | Set-Content -Path (Join-Path $incDir 'README.txt') -Encoding UTF8
Write-Host "Incidente: $incDir" -ForegroundColor Yellow
Write-Host "=== LOCKDOWN HOST COMPLETADO ===" -ForegroundColor Red
Write-Host "Desbloqueo API: POST /api/security/unlock { unlockSecret }"
Write-Host "Luego: LEVANTAR-TACTICALPTX.bat y Ensure-Firewall.ps1"
