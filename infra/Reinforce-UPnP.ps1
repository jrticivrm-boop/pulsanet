# Refuerza UPnP (reenvios virtuales) con descripciones TacticalPtx-* fijas
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -Quiet -DisableLegacy
Write-Host 'Firewall canonico OK'

$lan = $null
foreach ($line in (& ipconfig.exe 2>$null)) {
  if ($line -match 'IPv4.*:\s*(192\.168\.\d+\.\d+)') {
    $lan = $Matches[1]
    break
  }
}
if (-not $lan) {
  Write-Host 'UPnP: sin IP LAN 192.168.x' -ForegroundColor Yellow
  exit 1
}
Write-Host "LAN: $lan"

try {
  $nat = New-Object -ComObject HNetCfg.NATUPnP
  $col = $nat.StaticPortMappingCollection
  if ($null -eq $col) { throw 'UPnP no disponible (activa UPnP/IGD en el router)' }

  $maps = @(
    @{ Ext = 4000; Proto = 'TCP'; Desc = 'TacticalPtx-API' }
    @{ Ext = 5173; Proto = 'TCP'; Desc = 'TacticalPtx-Web' }
    @{ Ext = 7880; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-Signal' }
    @{ Ext = 7881; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-RTC' }
    @{ Ext = 7882; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-Media' }
    @{ Ext = 3478; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-TURN' }
  )
  foreach ($m in $maps) {
    try { $col.Remove([int]$m.Ext, $m.Proto) } catch {}
    $col.Add([int]$m.Ext, $m.Proto, [int]$m.Ext, $lan, $true, $m.Desc) | Out-Null
    Write-Host "UPnP OK $($m.Proto)/$($m.Ext) -> ${lan}:$($m.Ext)" -ForegroundColor Green
  }
  Write-Host '--- mapeos TacticalPtx ---'
  foreach ($p in $col) {
    if ($p.Description -like 'TacticalPtx*') {
      Write-Host "$($p.Protocol) $($p.ExternalPort) -> $($p.InternalClient):$($p.InternalPort) [$($p.Description)]"
    }
  }
} catch {
  Write-Host "UPnP FALLO: $($_.Exception.Message)" -ForegroundColor Red
  exit 2
}
