# Arranque local TacticalPtx (Windows) — sin cmdlets Net* (cuelgan el BAT)
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\backend")) { $root = $PSScriptRoot }
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

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

# Mantener LIVEKIT_LAN_HOST alineado con la IP Wi‑Fi actual (PTT en LAN).
if ($lanIp) {
  $envFile = Join-Path $root 'backend\.env'
  if (Test-Path $envFile) {
    $lines = @(Get-Content $envFile)
    $found = $false
    $out = foreach ($line in $lines) {
      if ($line -match '^LIVEKIT_LAN_HOST=') {
        $found = $true
        "LIVEKIT_LAN_HOST=$lanIp"
      } else { $line }
    }
    if (-not $found) { $out += "LIVEKIT_LAN_HOST=$lanIp" }
    Set-Content $envFile $out -Encoding UTF8
    Write-Host "LiveKit LAN host: $lanIp" -ForegroundColor Cyan
  }
}

# IP pública (UPnP / 4G / ICE): ipify manda; .env se corrige si quedó viejo.
$publicIp = Get-TpxCurrentPublicIp
$storedIp = Get-TpxStoredPublicIp -Root $root
if ($publicIp -and $storedIp -and $publicIp -ne $storedIp) {
  Write-Host "IP publica cambio: $storedIp -> $publicIp (sincronizando .env + yaml + UPnP)" -ForegroundColor Yellow
  [void](Sync-TpxPublicEnv -Root $root -PublicIp $publicIp)
  try { & (Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1') } catch {}
} elseif ($publicIp -and -not $storedIp) {
  [void](Sync-TpxPublicEnv -Root $root -PublicIp $publicIp)
} elseif (-not $publicIp) {
  $publicIp = $storedIp
  if (-not $publicIp) {
    Write-Host 'LiveKit: sin IP publica (ipify fallo y .env vacio)' -ForegroundColor Yellow
  }
}

# Redis (Laragon u otras rutas comunes)
$redisCandidates = @(
  'C:\laragon\bin\redis\redis-x64-5.0.14.1\redis-server.exe',
  'C:\laragon\bin\redis\redis-x64-5.0.14\redis-server.exe',
  'C:\Program Files\Redis\redis-server.exe'
)
$redis = $null
foreach ($c in $redisCandidates) {
  if (Test-Path $c) { $redis = $c; break }
}
if (-not $redis) {
  $found = Get-ChildItem 'C:\laragon\bin\redis' -Filter 'redis-server.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $redis = $found.FullName }
}
if ($redis) {
  if (Get-Process -Name redis-server -ErrorAction SilentlyContinue) {
    Write-Host 'Redis: ya corria'
  } else {
    Start-Process -FilePath $redis -WorkingDirectory (Split-Path $redis) -WindowStyle Hidden
    Write-Host 'Redis: iniciado (6379)'
  }
} else {
  Write-Host 'Redis: no encontrado en Laragon' -ForegroundColor Yellow
}

# LiveKit — reiniciar siempre para alinear ICE (Wi‑Fi + 4G)
$lk = Join-Path $root 'infra\livekit\livekit-server.exe'
if (-not (Test-Path $lk)) {
  Write-Host "LiveKit: falta $lk" -ForegroundColor Yellow
} else {
  [void](Stop-LiveKit)
  $lkArgs = @('--dev', '--bind', '0.0.0.0', '--udp-port', '7882')
  $lkCfg = Join-Path $root 'infra\livekit.dev.yaml'
  if (Test-Path $lkCfg) {
    $lkArgs = @('--config', $lkCfg, '--dev', '--udp-port', '7882')
  }
  if ($publicIp) {
    $yamlIp = Get-TpxLiveKitYamlNodeIp -Root $root
    if ($yamlIp -and $yamlIp -ne $publicIp) {
      [void](Sync-TpxLiveKitYaml -Root $root -PublicIp $publicIp)
    }
    $lkArgs += @('--node-ip', $publicIp)
    Write-Host "LiveKit: node-ip=$publicIp udp=7882 tcp=7881 turn=3478" -ForegroundColor Cyan
  } elseif ($lanIp) {
    Write-Host "LiveKit: solo LAN $lanIp (sin IP publica)" -ForegroundColor Yellow
  } else {
    Write-Host 'LiveKit: sin IP anunciable — 4G puede fallar' -ForegroundColor Yellow
  }
  Start-Process -FilePath $lk -ArgumentList $lkArgs -WorkingDirectory (Split-Path $lk) -WindowStyle Hidden
  Start-Sleep -Milliseconds 500
  if (Get-Process -Name livekit-server -ErrorAction SilentlyContinue) {
    Write-Host 'LiveKit: iniciado (ws://0.0.0.0:7880)'
  } else {
    Write-Host 'LiveKit: no arranco — revisa infra\livekit\livekit-server.exe' -ForegroundColor Red
  }
}

# Firewall canónico (sin variantes de nombre) — API + Web LAN + LiveKit
try {
  . (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
  $fw = Ensure-TacticalPtxFirewall -Quiet -DisableLegacy
  if ($fw.Fail -gt 0) {
    Write-Host "Firewall: $($fw.Fail) regla(s) no aplicadas (prueba como Administrador)" -ForegroundColor Yellow
  } else {
    Write-Host 'Firewall: reglas canonicas TacticalPtx-* OK'
  }
} catch {
  Write-Host "Firewall: $($_.Exception.Message)" -ForegroundColor Yellow
}

if ($tsIp) {
  Write-Host "4G/5G (Tailscale): API_BASE=http://${tsIp}:4000" -ForegroundColor Green
}
if ($lanIp) {
  Write-Host "Wi-Fi local:       API_BASE=http://${lanIp}:4000" -ForegroundColor Green
}
exit 0
