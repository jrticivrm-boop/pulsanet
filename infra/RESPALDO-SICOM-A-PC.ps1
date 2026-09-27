<#
  Copia fuera del ProLiant: trae a esta PC los ZIP de respaldo diarios de SICOM
  (BD + multimedia) desde la VM y conserva los ultimos 14.

    Destino: C:\pulsanet_soporte\Respaldos\SICOM\
    Log:     C:\pulsanet_soporte\Respaldos\SICOM\respaldo.log

  Uso:
    .\infra\RESPALDO-SICOM-A-PC.ps1              # copia lo que falte
    .\infra\RESPALDO-SICOM-A-PC.ps1 -Registrar   # crea la tarea programada diaria (03:30 y al iniciar sesion)
#>
param(
  [switch]$Registrar,
  [int]$Conservar = 14
)
$ErrorActionPreference = 'Stop'

$Dest = 'C:\pulsanet_soporte\Respaldos\SICOM'
$Log = Join-Path $Dest 'respaldo.log'
$VmHost = 'pulsanet@192.168.1.150'
$RemoteDir = '/opt/pulsanet/backend/data/backups'
$Key = Join-Path $env:USERPROFILE '.ssh\id_ed25519_sicom'
$SshOpts = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
$TaskName = 'SICOM-Respaldo-a-PC'

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $Log -Value $line
  Write-Host $line
}

if ($Registrar) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $triggers = @(
    (New-ScheduledTaskTrigger -Daily -At '03:30'),
    (New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME")
  )
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings `
    -Description 'Copia diaria de respaldos SICOM (VM ProLiant) a C:\pulsanet_soporte\Respaldos\SICOM' -Force | Out-Null
  Write-Host "Tarea programada '$TaskName' registrada (03:30 diario y al iniciar sesion)." -ForegroundColor Green
  exit 0
}

try {
  if (-not (Test-Path $Key)) { throw "Falta la llave SSH $Key" }
  $listing = & ssh @SshOpts $VmHost "cd $RemoteDir && stat -c '%n %s' tacticalptx_*.zip 2>/dev/null"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo listar los respaldos en la VM (sin red o VM apagada).' }

  $remote = @{}
  foreach ($l in $listing) {
    $name, $size = $l.Trim() -split ' ', 2
    if ($name -match '^tacticalptx_\d{8}_\d{6}\.zip$') { $remote[$name] = [int64]$size }
  }
  if ($remote.Count -eq 0) { throw 'La VM no tiene ZIP de respaldo.' }

  $copied = 0
  foreach ($name in ($remote.Keys | Sort-Object)) {
    $local = Join-Path $Dest $name
    if ((Test-Path $local) -and (Get-Item $local).Length -eq $remote[$name]) { continue }
    $tmp = "$local.part"
    & scp @SshOpts -q "${VmHost}:$RemoteDir/$name" $tmp
    if ($LASTEXITCODE -ne 0 -or (Get-Item $tmp).Length -ne $remote[$name]) {
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      throw "Fallo la copia de $name"
    }
    Move-Item $tmp $local -Force
    $copied++
    Write-Log ("OK copiado {0} ({1:N0} MB)" -f $name, ($remote[$name] / 1MB))
  }

  $all = Get-ChildItem $Dest -Filter 'tacticalptx_*.zip' | Sort-Object Name -Descending
  $old = $all | Select-Object -Skip $Conservar
  foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Log "Retencion: borrado $($f.Name)" }

  $newest = ($all | Select-Object -First 1).Name
  Write-Log "OK sincronizado: $copied nuevo(s); en PC $([Math]::Min($all.Count, $Conservar)) ZIP; mas reciente $newest"
} catch {
  Write-Log "ERROR $($_.Exception.Message)"
  exit 1
}
