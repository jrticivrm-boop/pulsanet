# Evita black-hole TLS (handshake OK, HTTP cuelga) al pasar por doble NAT Telmex+Deco.
# Causa tipica: Large Send Offload / checksum offload en el NIC del PC servidor.
# Uso (elevado): powershell -File infra\Fix-WanTlsOffload.ps1
# Lo invocan START-PUBLIC-EDGE / ENSURE-PUBLIC-EDGE.

$ErrorActionPreference = 'Continue'

function Invoke-TpxWanTlsOffloadFix {
  $adapters = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object {
    $_.Status -eq 'Up' -and $_.Name -match 'Ethernet|Wi-Fi|WiFi'
  })
  if ($adapters.Count -eq 0) {
    Write-Host 'Fix-WanTlsOffload: sin adaptadores Up Ethernet/Wi-Fi' -ForegroundColor Yellow
    return $false
  }
  foreach ($a in $adapters) {
    Write-Host "Fix-WanTlsOffload: $($a.Name) ($($a.InterfaceDescription))" -ForegroundColor Cyan
    try { Disable-NetAdapterLso -Name $a.Name -Confirm:$false -ErrorAction Stop } catch {
      Write-Host "  LSO: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
    try { Disable-NetAdapterChecksumOffload -Name $a.Name -Confirm:$false -ErrorAction Stop } catch {
      Write-Host "  ChecksumOffload: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
    try { Disable-NetAdapterRsc -Name $a.Name -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    try {
      Set-NetIPInterface -InterfaceAlias $a.Name -AddressFamily IPv4 -NlMtuBytes 1400 -ErrorAction SilentlyContinue
    } catch {}
  }
  Write-Host 'Fix-WanTlsOffload: aplicado (LSO/Checksum off; MTU 1400)' -ForegroundColor Green
  return $true
}

# Si se ejecuta como script (no dot-source), aplicar y salir.
if ($MyInvocation.InvocationName -ne '.' -and $MyInvocation.Line -notmatch '^\s*\.') {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Host 'Se requieren privilegios de administrador; relanzando elevado...' -ForegroundColor Yellow
    $p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath
    )
    exit $p.ExitCode
  }
  [void](Invoke-TpxWanTlsOffloadFix)
  exit 0
}
