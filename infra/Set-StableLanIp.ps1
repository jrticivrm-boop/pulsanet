# Fija IP LAN del host TacticalPtx (Ethernet) para que no cambie con DHCP.
# Canonico del proyecto / APK: 192.168.1.77 (gateway Telmex 192.168.1.254).
#
# Uso (Admin):
#   powershell -File infra\Set-StableLanIp.ps1
#   powershell -File infra\Set-StableLanIp.ps1 -Ip 192.168.1.77
#   powershell -File infra\Set-StableLanIp.ps1 -CheckOnly

param(
  [string]$Ip = '192.168.1.77',
  [string]$Prefix = '24',
  [string]$Gateway = '192.168.1.254',
  [string]$DnsPrimary = '192.168.1.254',
  [string]$DnsSecondary = '8.8.8.8',
  [string]$Adapter = 'Ethernet',
  [switch]$CheckOnly,
  [switch]$SkipEdge
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$nic = Get-NetAdapter -Name $Adapter -ErrorAction SilentlyContinue
if (-not $nic) {
  throw "No hay adaptador '$Adapter'. Adapters: $((Get-NetAdapter | Select-Object -ExpandProperty Name) -join ', ')"
}

$current = Get-NetIPAddress -InterfaceAlias $Adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1

Write-Host "Adaptador: $Adapter (Status=$($nic.Status))"
Write-Host "Actual:    $(if ($current) { $current.IPAddress } else { '(sin IPv4)' })  PrefixOrigin=$(if ($current) { $current.PrefixOrigin } else { '-' })"
Write-Host "Objetivo:  $Ip/$Prefix  gw=$Gateway  dns=$DnsPrimary,$DnsSecondary"

if ($CheckOnly) {
  $ok = ($current -and $current.IPAddress -eq $Ip -and $current.PrefixOrigin -ne 'Dhcp')
  if ($ok) {
    Write-Host 'OK: IP ya fija' -ForegroundColor Green
    exit 0
  }
  Write-Host 'NO fija / distinta - ejecuta sin -CheckOnly (como Admin)' -ForegroundColor Yellow
  exit 2
}

if ($current -and $current.IPAddress -eq $Ip -and $current.PrefixOrigin -ne 'Dhcp') {
  Write-Host 'Ya esta fija en el objetivo - nada que cambiar.' -ForegroundColor Green
} else {
  if (-not (Test-IsAdmin)) {
    Write-Host 'Se requieren privilegios de Administrador. Relanzando elevado...' -ForegroundColor Yellow
    $args = @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', $PSCommandPath,
      '-Ip', $Ip, '-Prefix', $Prefix, '-Gateway', $Gateway,
      '-DnsPrimary', $DnsPrimary, '-DnsSecondary', $DnsSecondary,
      '-Adapter', $Adapter
    )
    if ($SkipEdge) { $args += '-SkipEdge' }
    $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $args -PassThru -Wait
    exit $p.ExitCode
  }

  # netsh: estable en Windows 10/11 para pasar de DHCP -> estática sin dejar la NIC a medias.
  $mask = switch ($Prefix) {
    '24' { '255.255.255.0' }
    '22' { '255.255.252.0' }
    '16' { '255.255.0.0' }
    default { '255.255.255.0' }
  }

  Write-Host "Aplicando IP estatica $Ip ..." -ForegroundColor Cyan
  & netsh.exe interface ip set address name="$Adapter" static $Ip $mask $Gateway 1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "netsh set address fallo (code $LASTEXITCODE)" }
  & netsh.exe interface ip set dns name="$Adapter" static $DnsPrimary primary | Out-Null
  if ($DnsSecondary) {
    & netsh.exe interface ip add dns name="$Adapter" $DnsSecondary index=2 2>$null | Out-Null
  }

  Start-Sleep -Seconds 2
  $after = Get-NetIPAddress -InterfaceAlias $Adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq $Ip } | Select-Object -First 1
  if (-not $after) {
    throw "No se confirmo $Ip en $Adapter tras netsh"
  }
  Write-Host "OK Ethernet fija: $Ip/$Prefix (PrefixOrigin=$($after.PrefixOrigin))" -ForegroundColor Green
}

# Alinear hosts hairpin + UPnP/edge a la IP fija
$hairpin = Join-Path $PSScriptRoot 'Fix-DuckdnsHairpin.ps1'
if (Test-Path $hairpin) {
  try { & $hairpin -LanIp $Ip } catch {
    Write-Host "Hairpin: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

if (-not $SkipEdge) {
  $edge = Join-Path $PSScriptRoot 'START-PUBLIC-EDGE.ps1'
  if (Test-Path $edge) {
    Write-Host 'Realineando borde publico (UPnP -> IP fija)...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge
  }
}

# Smoke
try {
  $gwOk = Test-Connection -ComputerName $Gateway -Count 1 -Quiet -ErrorAction SilentlyContinue
  Write-Host ("Gateway {0}: {1}" -f $Gateway, $(if ($gwOk) { 'OK' } else { 'sin ping (puede ser normal)' }))
} catch {}
Write-Host "Listo. IP estable del host: $Ip"
exit 0
