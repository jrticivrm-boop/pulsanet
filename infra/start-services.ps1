# Arranque local TacticalPtx (Windows) — sin cmdlets Net* (cuelgan el BAT)
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\backend")) { $root = $PSScriptRoot }

Write-Host '== TacticalPtx start ==' -ForegroundColor Cyan

function Get-LanIPv4 {
  foreach ($line in (& ipconfig.exe 2>$null)) {
    if ($line -match 'IPv4.*:\s*(192\.168\.\d+\.\d+)') {
      return $Matches[1]
    }
  }
  return $null
}

function Get-TailscaleIPv4 {
  $exe = 'C:\Program Files\Tailscale\tailscale.exe'
  if (-not (Test-Path $exe)) { return $null }
  try {
    $ip = (& $exe ip -4 2>$null | Select-Object -First 1)
    if ($ip -match '^100\.') { return $ip.Trim() }
  } catch { }
  return $null
}

function Stop-LiveKit {
  # taskkill tolera mejor procesos elevados que Stop-Process
  & taskkill.exe /F /IM livekit-server.exe 2>$null | Out-Null
  Start-Sleep -Milliseconds 600
  $left = Get-Process -Name livekit-server -ErrorAction SilentlyContinue
  if ($left) {
    Write-Host 'LiveKit: no se pudo detener (prueba LEVANTAR como Administrador)' -ForegroundColor Yellow
    return $false
  }
  return $true
}

$lanIp = Get-LanIPv4
$tsIp = Get-TailscaleIPv4
# Una sola node-ip (Tailscale) deja sin audio a teléfonos en Wi‑Fi.
# Con LAN + Tailscale dejamos que LiveKit anuncie ambas en ICE.
$nodeIp = $null
if ($tsIp -and $lanIp) {
  $nodeIp = $null
} elseif ($tsIp) {
  $nodeIp = $tsIp
} elseif ($lanIp) {
  $nodeIp = $lanIp
}

# Redis (Laragon)
$redis = 'C:\laragon\bin\redis\redis-x64-5.0.14.1\redis-server.exe'
if (Test-Path $redis) {
  if (Get-Process -Name redis-server -ErrorAction SilentlyContinue) {
    Write-Host 'Redis: ya corria'
  } else {
    Start-Process -FilePath $redis -WorkingDirectory (Split-Path $redis) -WindowStyle Hidden
    Write-Host 'Redis: iniciado (6379)'
  }
} else {
  Write-Host 'Redis: no encontrado en Laragon' -ForegroundColor Yellow
}

# LiveKit — reiniciar siempre para alinear ICE (Wi‑Fi + Tailscale)
$lk = Join-Path $root 'infra\livekit\livekit-server.exe'
if (-not (Test-Path $lk)) {
  Write-Host "LiveKit: falta $lk" -ForegroundColor Yellow
} else {
  [void](Stop-LiveKit)
  $lkArgs = @('--dev', '--bind', '0.0.0.0', '--udp-port', '7882')
  $lkCfg = Join-Path $root 'infra\livekit.dev.yaml'
  if (Test-Path $lkCfg) {
    $lkArgs = @('--config', $lkCfg, '--dev')
  }
  if ($tsIp -and $lanIp) {
    Write-Host "LiveKit: ICE dual LAN $lanIp + Tailscale $tsIp (sin --node-ip)" -ForegroundColor Cyan
  } elseif ($nodeIp) {
    $lkArgs += @('--node-ip', $nodeIp)
    Write-Host "LiveKit: node-ip=$nodeIp udp=7882" -ForegroundColor Cyan
  } else {
    Write-Host 'LiveKit: sin IP anunciable — audio a moviles puede fallar' -ForegroundColor Yellow
  }
  Start-Process -FilePath $lk -ArgumentList $lkArgs -WorkingDirectory (Split-Path $lk) -WindowStyle Hidden
  Start-Sleep -Milliseconds 500
  if (Get-Process -Name livekit-server -ErrorAction SilentlyContinue) {
    Write-Host 'LiveKit: iniciado (ws://0.0.0.0:7880)'
  } else {
    Write-Host 'LiveKit: no arranco — revisa infra\livekit\livekit-server.exe' -ForegroundColor Red
  }
}

# Firewall (TCP API/señal + UDP RTC) — silencioso si ya existen
foreach ($rule in @(
  @{ Name = 'TacticalPtx API TCP 4000'; Proto = 'TCP'; Port = 4000 },
  @{ Name = 'TacticalPtx LiveKit TCP 7880'; Proto = 'TCP'; Port = 7880 },
  @{ Name = 'TacticalPtx LiveKit TCP 7881'; Proto = 'TCP'; Port = 7881 },
  @{ Name = 'TacticalPtx LiveKit UDP 7882'; Proto = 'UDP'; Port = 7882 }
)) {
  netsh advfirewall firewall show rule name="$($rule.Name)" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule name="$($rule.Name)" dir=in action=allow protocol=$($rule.Proto) localport=$($rule.Port) | Out-Null
  }
}

if ($tsIp) {
  Write-Host "4G/5G (Tailscale): API_BASE=http://${tsIp}:4000" -ForegroundColor Green
}
if ($lanIp) {
  Write-Host "Wi-Fi local:       API_BASE=http://${lanIp}:4000" -ForegroundColor Green
}
exit 0
