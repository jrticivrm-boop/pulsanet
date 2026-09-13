# Watch-Stack.ps1 - mantiene API, Web Vite y borde publico vivos.
# Una sola instancia (mutex). Lo arranca LEVANTAR-TACTICALPTX.
# Motivo: procesos de Cursor/agente mueren; Caddy/UPnP tambien cae.

param(
  [int]$IntervalSec = 15,
  [int]$EdgeEveryN = 4,
  [switch]$Once
)

$ErrorActionPreference = 'SilentlyContinue'

function Resolve-RepoRoot {
  foreach ($cand in @('C:\pulsanet', 'D:\pulsanet', (Split-Path -Parent $PSScriptRoot))) {
    if (-not $cand) { continue }
    if ((Test-Path (Join-Path $cand 'frontend\package.json')) -or (Test-Path (Join-Path $cand 'web\package.json'))) {
      return (Resolve-Path $cand).Path
    }
  }
  throw 'Repo TacticalPtx no encontrado'
}

function Write-Log([string]$msg) {
  $ts = Get-Date -Format 'HH:mm:ss'
  $line = "[$ts] $msg"
  Write-Host $line
  try {
    $resolveAux = Join-Path $script:Root 'infra\Resolve-AuxRoot.ps1'
    $aux = $null
    if (Test-Path $resolveAux) {
      $aux = & $resolveAux -RepoRoot $script:Root -EnsureLogs
    }
    if (-not $aux) { $aux = Join-Path $script:Root 'var' }
    $logDir = Join-Path $aux 'Logs'
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
    Add-Content -Path (Join-Path $logDir 'watch-stack.log') -Value $line -Encoding utf8
  } catch {}
}

function Test-CurlOk([string[]]$Urls) {
  foreach ($u in $Urls) {
    $code = & curl.exe -sk --connect-timeout 2 --max-time 6 -o NUL -w '%{http_code}' $u 2>$null
    if ($LASTEXITCODE -eq 0 -and $code -match '^[23]') { return $true }
  }
  return $false
}

function Test-PortListen([int]$Port) {
  $c = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  return ($c.Count -gt 0)
}

function Free-Port([int]$Port) {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {}
    }
  Start-Sleep -Seconds 1
}

function Test-WebUp {
  if (Test-CurlOk @(
      'https://127.0.0.1:5173/',
      'https://localhost:5173/'
    )) { return $true }
  return $false
}

function Test-ApiUp {
  foreach ($u in @('https://127.0.0.1:4000/api/health', 'http://127.0.0.1:4000/api/health')) {
    $body = & curl.exe -sk --connect-timeout 3 --max-time 10 $u 2>$null
    if ($LASTEXITCODE -eq 0 -and $body -match 'tacticalptx-api|"ok"\s*:\s*true') { return $true }
  }
  return $false
}

function Test-LiveKitUp {
  return (Test-PortListen 7880)
}

function Get-PublicDomain {
  $dom = Get-TpxPublicDomainFromEnv -Root $script:Root
  if ($dom) { return $dom }
  $ip = Get-TpxStoredPublicIp -Root $script:Root
  if ($ip) { return "$ip.sslip.io" }
  $current = Get-TpxCurrentPublicIp
  if ($current) { return "$current.sslip.io" }
  return $null
}

function Test-EdgeUp {
  $dom = Get-PublicDomain
  if (-not $dom) { return $false }
  $code = & curl.exe -sk --connect-timeout 6 --max-time 10 -o NUL -w '%{http_code}' "https://$dom/api/health" 2>$null
  return ($code -eq '200')
}

function Ensure-Service {
  param(
    [string]$Label,
    [scriptblock]$IsUp,
    [int]$Port,
    [string]$CmdPath,
    [string]$WorkDir,
    [ref]$FailStreak,
    [ref]$LastRestart,
    [int]$FailThreshold = 3,
    [int]$CooldownSec = 90
  )
  if (& $IsUp) {
    if ($null -ne $FailStreak) { $FailStreak.Value = 0 }
    return
  }

  if ($null -ne $FailStreak) {
    $FailStreak.Value++
    if ($FailStreak.Value -lt $FailThreshold) {
      Write-Log "$Label no responde ($($FailStreak.Value)/$FailThreshold) — esperando..."
      return
    }
    if ($null -ne $LastRestart) {
      $elapsed = ((Get-Date) - $LastRestart.Value).TotalSeconds
      if ($elapsed -lt $CooldownSec) {
        Write-Log "$Label en enfriamiento ($([int]$elapsed)s/$CooldownSec) — no reiniciar aun"
        return
      }
      $LastRestart.Value = Get-Date
    }
    $FailStreak.Value = 0
  }

  Write-Log "$Label CAIDA - reparando..."
  if ($Port -gt 0 -and (Test-PortListen $Port)) {
    Write-Log "  :$Port escucha pero health fallo — no matar (puede ser --watch reiniciando)"
    return
  }
  if (-not (Test-Path $CmdPath)) {
    Write-Log "  Falta: $CmdPath"
    return
  }
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/k', 'call', "`"$CmdPath`"") `
    -WorkingDirectory $WorkDir `
    -WindowStyle Minimized
  Start-Sleep -Seconds 4
}

function Ensure-Edge {
  $drift = Test-TpxPublicIpDrift -Root $script:Root
  if ($drift.Drift) {
    Write-Log "IP publica desalineada ($($drift.Reason): $($drift.Stored) -> $($drift.Current)) - ENSURE-PUBLIC-EDGE..."
    $ensure = Join-Path $script:Root 'infra\ENSURE-PUBLIC-EDGE.ps1'
    if (Test-Path $ensure) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensure | Out-Null
    }
    return
  }
  if (Test-EdgeUp) { return }
  Write-Log 'Borde publico CAIDO - ENSURE-PUBLIC-EDGE...'
  $ensure = Join-Path $script:Root 'infra\ENSURE-PUBLIC-EDGE.ps1'
  if (-not (Test-Path $ensure)) {
    Write-Log "  Falta $ensure"
    return
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensure | Out-Null
}

$script:Root = Resolve-RepoRoot
. (Join-Path $script:Root 'infra\Sync-PublicIp.ps1')
$webCmd = Join-Path $script:Root 'infra\start-web.cmd'
$apiCmd = Join-Path $script:Root 'infra\start-api.cmd'
$webDir = Join-Path $script:Root 'web'
$apiDir = Join-Path $script:Root 'backend'

$mutex = New-Object System.Threading.Mutex($false, 'Global\TacticalPtxWatchStack')
if (-not $mutex.WaitOne(0)) {
  Write-Host 'Watch-Stack ya esta en ejecucion (otra instancia).'
  exit 0
}

try {
  $host.UI.RawUI.WindowTitle = 'TacticalPtx Watch-Stack'
  Write-Log '=== TacticalPtx Watch-Stack ==='
  Write-Log "Root: $($script:Root)"
  Write-Log "Intervalo: ${IntervalSec}s | Edge cada ${EdgeEveryN} ciclos"
  Write-Log 'Web https://127.0.0.1:5173 | API :4000 | Edge PUBLIC_DOMAIN'
  Write-Log 'Cierra esta ventana para dejar de vigilar.'
  Write-Host ''

  $cycle = 0
  $apiFail = 0
  $webFail = 0
  $apiLastRestart = [datetime]::MinValue
  $webLastRestart = [datetime]::MinValue
  do {
    $cycle++
    Ensure-Service -Label 'API :4000' -IsUp { Test-ApiUp } -Port 4000 -CmdPath $apiCmd -WorkDir $apiDir `
      -FailStreak ([ref]$apiFail) -LastRestart ([ref]$apiLastRestart) -FailThreshold 4 -CooldownSec 120
    Ensure-Service -Label 'Web :5173' -IsUp { Test-WebUp } -Port 5173 -CmdPath $webCmd -WorkDir $webDir `
      -FailStreak ([ref]$webFail) -LastRestart ([ref]$webLastRestart) -FailThreshold 3 -CooldownSec 90
    if (-not (Test-LiveKitUp)) {
      Write-Log 'LiveKit :7880 no escucha - start-services.ps1'
      $svc = Join-Path $script:Root 'infra\start-services.ps1'
      if (Test-Path $svc) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svc | Out-Null
      }
    } else {
      $yamlIp = Get-TpxLiveKitYamlNodeIp -Root $script:Root
      $storedIp = Get-TpxStoredPublicIp -Root $script:Root
      $currentIp = Get-TpxCurrentPublicIp
      if ($currentIp -and (($storedIp -and $currentIp -ne $storedIp) -or ($yamlIp -and $yamlIp -ne $currentIp))) {
        Write-Log "IP publica desalineada (stored=$storedIp yaml=$yamlIp current=$currentIp) - Sync + LiveKit"
        [void](Invoke-TpxPublicIpRealign -Root $script:Root)
        $svc = Join-Path $script:Root 'infra\start-services.ps1'
        if (Test-Path $svc) {
          & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svc | Out-Null
        }
      } else {
        # Refresco periodico DuckDNS aunque no haya drift detectado en disco.
        [void](Update-TpxDuckDns -Root $script:Root -PublicIp $currentIp)
      }
    }
    if (($cycle % [Math]::Max(1, $EdgeEveryN)) -eq 0) {
      Ensure-Edge
    }
    if ($Once) {
      Ensure-Edge
      break
    }
    Start-Sleep -Seconds $IntervalSec
  } while ($true)
} finally {
  try { $mutex.ReleaseMutex() | Out-Null } catch {}
  try { $mutex.Dispose() } catch {}
}
