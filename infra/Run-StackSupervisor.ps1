# Run-StackSupervisor.ps1
# Una sola consola visible: API/Web corren ocultos vía start-api/start-web (con
# su propio loop de reinicio). Aquí solo se vigila health y se repara.

param(
  [int]$IntervalSec = 12,
  [int]$EdgeEveryN = 5,
  [switch]$Once,
  [switch]$SkipEdge,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'SilentlyContinue'
$script:BrowserOpened = $false

function Resolve-RepoRoot {
  foreach ($cand in @('C:\pulsanet', 'D:\pulsanet', (Split-Path -Parent $PSScriptRoot))) {
    if (-not $cand) { continue }
    if (Test-Path (Join-Path $cand 'backend\package.json')) {
      return (Resolve-Path $cand).Path
    }
  }
  throw 'Repo TacticalPtx no encontrado'
}

function Get-AuxLogsDir {
  $aux = 'C:\pulsanet_soporte'
  if (-not (Test-Path $aux)) { $aux = Join-Path $script:Root 'var' }
  $logDir = Join-Path $aux 'Logs'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
  return $logDir
}

function Write-Log([string]$msg) {
  $ts = Get-Date -Format 'HH:mm:ss'
  $line = "[$ts] $msg"
  Write-Host $line
  try {
    Add-Content -Path (Join-Path (Get-AuxLogsDir) 'watch-stack.log') -Value $line -Encoding utf8
  } catch {}
}

function Test-PortListen([int]$Port) {
  $hit = netstat -ano 2>$null | Select-String -Pattern (':{0}\s+.+\s+LISTENING' -f $Port)
  return [bool]$hit
}

function Free-Port([int]$Port) {
  $lines = netstat -ano 2>$null | Select-String -Pattern (':{0}\s+.+\s+LISTENING' -f $Port)
  foreach ($l in $lines) {
    if ($l -match '(\d+)\s*$') {
      $procId = [int]$Matches[1]
      if ($procId -gt 4) {
        & taskkill.exe /F /T /PID $procId 2>$null | Out-Null
      }
    }
  }
  Start-Sleep -Seconds 1
}

function Test-ApiUp {
  foreach ($u in @('https://127.0.0.1:4000/api/health', 'http://127.0.0.1:4000/api/health')) {
    $body = & curl.exe -sk --connect-timeout 3 --max-time 10 $u 2>$null
    if ($LASTEXITCODE -eq 0 -and $body -match 'tacticalptx-api|"ok"\s*:\s*true') { return $true }
  }
  return $false
}

function Test-WebUp {
  foreach ($u in @('https://127.0.0.1:5173/', 'https://localhost:5173/')) {
    $code = & curl.exe -sk --connect-timeout 2 --max-time 6 -o NUL -w '%{http_code}' $u 2>$null
    if ($LASTEXITCODE -eq 0 -and $code -match '^[23]') { return $true }
  }
  return $false
}

function Test-LiveKitUp { return (Test-PortListen 7880) }

function Stop-StackOrphans {
  $me = $PID
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessId -ne $me -and
      $_.CommandLine -and (
        $_.CommandLine -match 'start-api\.cmd|start-web\.cmd|Watch-Stack\.ps1|Run-StackSupervisor\.ps1|TacticalPtx API|TacticalPtx Web|TacticalPtx Watch|TacticalPtx Stack'
      )
    } |
    ForEach-Object {
      try {
        Write-Log "Cerrando huerfano PID=$($_.ProcessId)"
        & taskkill.exe /F /T /PID $_.ProcessId 2>$null | Out-Null
      } catch {}
    }
  # Liberar mutex de instancias previas (proceso ya muerto)
  Start-Sleep -Milliseconds 400
}

function Start-HiddenCmd {
  param(
    [string]$Label,
    [string]$CmdPath,
    [string]$WorkDir,
    [int]$Port
  )
  if (-not (Test-Path $CmdPath)) {
    Write-Log "Falta $CmdPath"
    return $false
  }
  if (Test-PortListen $Port) {
    # Puerto ocupado sin health = zombie
    Free-Port $Port
  }
  $logDir = Get-AuxLogsDir
  $outLog = Join-Path $logDir ("{0}-out.log" -f $Label.ToLower())
  # Sin RedirectStandard* de Start-Process (rompe node --watch).
  # Redirección dentro del cmd: estable en Windows.
  $inner = "call `"$CmdPath`" >> `"$outLog`" 2>&1"
  Write-Log "Arrancando $Label oculto (log: $outLog)"
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/d', '/c', $inner) `
    -WorkingDirectory $WorkDir `
    -WindowStyle Hidden |
    Out-Null
  return $true
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
    [int]$CooldownSec = 70
  )
  if (& $IsUp) {
    $FailStreak.Value = 0
    return
  }
  $FailStreak.Value++
  if ($FailStreak.Value -lt $FailThreshold) {
    Write-Log "$Label no responde ($($FailStreak.Value)/$FailThreshold) - esperando..."
    return
  }
  $elapsed = ((Get-Date) - $LastRestart.Value).TotalSeconds
  if ($LastRestart.Value -gt [datetime]::MinValue -and $elapsed -lt $CooldownSec) {
    Write-Log "$Label enfriamiento ($([int]$elapsed)s/$CooldownSec)"
    return
  }
  Write-Log "$Label CAIDA - reinicio oculto"
  # Matar wrappers start-api/start-web viejos de este servicio
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        ($Label -eq 'API' -and $_.CommandLine -match 'start-api\.cmd') -or
        ($Label -eq 'Web' -and $_.CommandLine -match 'start-web\.cmd')
      )
    } |
    ForEach-Object {
      try { & taskkill.exe /F /T /PID $_.ProcessId 2>$null | Out-Null } catch {}
    }
  if (Test-PortListen $Port) { Free-Port $Port }

  if ($Label -eq 'API') {
    if (-not (Test-PortListen 6379) -or -not (Test-LiveKitUp)) {
      $svc = Join-Path $script:Root 'infra\start-services.ps1'
      if (Test-Path $svc) {
        Write-Log '  start-services.ps1 (Redis/LiveKit)'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svc | Out-Null
      }
    }
    $nm = Join-Path $WorkDir 'node_modules'
    if (-not (Test-Path $nm)) {
      Write-Log '  npm install backend'
      Push-Location $WorkDir
      try { & npm.cmd install --no-fund --no-audit 2>&1 | Out-Null } finally { Pop-Location }
    }
  }
  if ($Label -eq 'Web') {
    $nm = Join-Path $WorkDir 'node_modules'
    if (-not (Test-Path $nm)) {
      Write-Log '  npm install frontend'
      Push-Location $WorkDir
      try { & npm.cmd install --no-fund --no-audit 2>&1 | Out-Null } finally { Pop-Location }
    }
  }
  [void](Start-HiddenCmd -Label $Label -CmdPath $CmdPath -WorkDir $WorkDir -Port $Port)
  $LastRestart.Value = Get-Date
  $FailStreak.Value = 0
  Start-Sleep -Seconds 4
}

function Ensure-Edge {
  if ($SkipEdge) { return }
  try {
    $drift = Test-TpxPublicIpDrift -Root $script:Root
    if ($drift -and $drift.Drift) {
      Write-Log "IP publica desalineada - ENSURE-PUBLIC-EDGE"
      $ensure = Join-Path $script:Root 'infra\ENSURE-PUBLIC-EDGE.ps1'
      if (Test-Path $ensure) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensure | Out-Null
      }
      return
    }
  } catch {}
  try {
    $st = Get-TpxEdgeStatus -Root $script:Root
    if ($st -and $st.LocalOk) {
      if (-not $st.UPnP) {
        $re = Join-Path $script:Root 'infra\Reinforce-UPnP.ps1'
        if (Test-Path $re) {
          Write-Log 'UPnP debil - Reinforce-UPnP'
          & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $re | Out-Null
        }
      }
      return
    }
  } catch {}
  Write-Log 'Borde publico CAIDO - ENSURE-PUBLIC-EDGE'
  $ensure = Join-Path $script:Root 'infra\ENSURE-PUBLIC-EDGE.ps1'
  if (Test-Path $ensure) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensure | Out-Null
  }
}

$script:Root = Resolve-RepoRoot
. (Join-Path $script:Root 'infra\Sync-PublicIp.ps1')

$apiCmd = Join-Path $script:Root 'infra\start-api.cmd'
$webCmd = Join-Path $script:Root 'infra\start-web.cmd'
$apiDir = Join-Path $script:Root 'backend'
$webDir = Join-Path $script:Root 'frontend'
if (-not (Test-Path (Join-Path $webDir 'package.json'))) {
  $webDir = Join-Path $script:Root 'web'
}

# Matar instancias previas ANTES del mutex (evita "ya activo" fantasma)
Stop-StackOrphans

$mutex = $null
try {
  $mutex = New-Object System.Threading.Mutex($false, 'Global\TacticalPtxWatchStack')
  if (-not $mutex.WaitOne(1500)) {
    Write-Log 'Mutex ocupado - forzando liberacion de huerfanos...'
    Stop-StackOrphans
    Start-Sleep -Seconds 1
    if (-not $mutex.WaitOne(2000)) {
      Write-Host 'ERROR: no se pudo tomar el mutex del supervisor. Cierra otros LEVANTAR/Watch y reintenta.'
      exit 1
    }
  }
} catch {
  Write-Log "Mutex: $($_.Exception.Message) - continuo sin exclusividad"
}

try {
  try { $host.UI.RawUI.WindowTitle = 'TacticalPtx Stack' } catch {}
  Write-Log '=== TacticalPtx Stack (1 ventana) ==='
  Write-Log "Root: $($script:Root)"
  Write-Log 'API/Web ocultos + autorearranque. Ctrl+C detiene la vigilancia.'
  Write-Log ("Logs: {0}" -f (Get-AuxLogsDir))
  Write-Host ''

  $apiFail = 0
  $webFail = 0
  $apiLast = [datetime]::MinValue
  $webLast = [datetime]::MinValue

  if (-not (Test-ApiUp)) {
    [void](Start-HiddenCmd -Label 'api' -CmdPath $apiCmd -WorkDir $apiDir -Port 4000)
    $apiLast = Get-Date
  } else {
    Write-Log 'API ya respondia'
  }
  if (-not (Test-WebUp)) {
    [void](Start-HiddenCmd -Label 'web' -CmdPath $webCmd -WorkDir $webDir -Port 5173)
    $webLast = Get-Date
  } else {
    Write-Log 'Web ya respondia'
  }

  for ($i = 0; $i -lt 45; $i++) {
    $a = Test-ApiUp
    $w = Test-WebUp
    if ($a -and $w) { break }
    if (($i % 5) -eq 0) {
      Write-Log ("Esperando health... API={0} Web={1}" -f ($(if ($a) {'OK'} else {'--'})), ($(if ($w) {'OK'} else {'--'})))
    }
    Start-Sleep -Seconds 2
  }

  $apiOk = Test-ApiUp
  $webOk = Test-WebUp
  Write-Log ("Estado: API={0} Web={1} LiveKit={2}" -f ($(if ($apiOk) {'OK'} else {'FAIL'})), ($(if ($webOk) {'OK'} else {'FAIL'})), ($(if (Test-LiveKitUp) {'OK'} else {'FAIL'})))

  if ($apiOk -and $webOk -and -not $NoBrowser -and -not $script:BrowserOpened) {
    try {
      Start-Process 'https://127.0.0.1:5173' | Out-Null
      $script:BrowserOpened = $true
      Write-Log 'Navegador: https://127.0.0.1:5173'
    } catch {}
  }

  if (-not $SkipEdge) { Ensure-Edge }

  if ($Once) {
    Write-Log 'Modo -Once: saliendo (API/Web siguen en background)'
    exit ($(if ($apiOk -and $webOk) { 0 } else { 1 }))
  }

  $cycle = 0
  do {
    $cycle++
    Ensure-Service -Label 'API' -IsUp { Test-ApiUp } -Port 4000 -CmdPath $apiCmd -WorkDir $apiDir `
      -FailStreak ([ref]$apiFail) -LastRestart ([ref]$apiLast)
    Ensure-Service -Label 'Web' -IsUp { Test-WebUp } -Port 5173 -CmdPath $webCmd -WorkDir $webDir `
      -FailStreak ([ref]$webFail) -LastRestart ([ref]$webLast)

    if (-not (Test-LiveKitUp)) {
      Write-Log 'LiveKit :7880 caido - start-services'
      $svc = Join-Path $script:Root 'infra\start-services.ps1'
      if (Test-Path $svc) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svc | Out-Null
      }
    } else {
      try {
        $yamlIp = Get-TpxLiveKitYamlNodeIp -Root $script:Root
        $storedIp = Get-TpxStoredPublicIp -Root $script:Root
        $currentIp = Get-TpxCurrentPublicIp
        if ($currentIp -and (($storedIp -and $currentIp -ne $storedIp) -or ($yamlIp -and $yamlIp -ne $currentIp))) {
          Write-Log "IP publica drift - Sync + LiveKit"
          [void](Invoke-TpxPublicIpRealign -Root $script:Root)
          $svc = Join-Path $script:Root 'infra\start-services.ps1'
          if (Test-Path $svc) {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svc | Out-Null
          }
        } else {
          [void](Update-TpxDuckDns -Root $script:Root -PublicIp $currentIp)
        }
      } catch {}
    }

    if (($cycle % [Math]::Max(1, $EdgeEveryN)) -eq 0) { Ensure-Edge }
    Start-Sleep -Seconds $IntervalSec
  } while ($true)
} finally {
  try { if ($mutex) { $mutex.ReleaseMutex() | Out-Null } } catch {}
  try { if ($mutex) { $mutex.Dispose() } } catch {}
}
