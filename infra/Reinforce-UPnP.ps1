# Refuerza UPnP (reenvios) con descripciones TacticalPtx-* fijas.
# Por defecto solo borde Caddy (80/443) + media LiveKit (WebRTC 4G).
# NO abre :4000 / :5173 / :7880 a Internet (van por Caddy /rtc en 443).
# Override completo (dev): $env:TPX_UPNP_FULL='1'
# Exit: 0 OK | 1 sin LAN | 2 UPnP no disponible
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')
. (Join-Path $PSScriptRoot 'Soap-UPnP.ps1')
. (Join-Path $PSScriptRoot 'Ensure-Firewall.ps1')
$null = Ensure-TacticalPtxFirewall -Quiet -DisableLegacy
Write-Host 'Firewall canonico OK'

Start-TpxUPnPServices
$lan = Get-TpxPreferredLanIp
if (-not $lan) {
  Write-Host 'UPnP: sin IP LAN 192.168.x' -ForegroundColor Yellow
  exit 1
}
Write-Host "LAN: $lan"

$edgeMaps = @(
  @{ Ext = 80; Proto = 'TCP'; Desc = 'TacticalPtx-HTTPS-80' }
  @{ Ext = 443; Proto = 'TCP'; Desc = 'TacticalPtx-HTTPS-443' }
)
# Media WebRTC (signal LiveKit va por wss://dominio/rtc en Caddy :443)
$livekitMediaMaps = @(
  @{ Ext = 7881; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-RTC' }
  @{ Ext = 7882; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-Media' }
  @{ Ext = 3478; Proto = 'UDP'; Desc = 'TacticalPtx-LiveKit-TURN' }
)
$devExtraMaps = @(
  @{ Ext = 4000; Proto = 'TCP'; Desc = 'TacticalPtx-API' }
  @{ Ext = 5173; Proto = 'TCP'; Desc = 'TacticalPtx-Web' }
  @{ Ext = 7880; Proto = 'TCP'; Desc = 'TacticalPtx-LiveKit-Signal' }
)

$full = ($env:TPX_UPNP_FULL -eq '1') -or ($args -contains '-Full')
$maps = @($edgeMaps + $livekitMediaMaps)
if ($full) {
  Write-Host 'UPnP FULL (dev): incluye 4000/5173/7880' -ForegroundColor Yellow
  $maps = @($maps + $devExtraMaps)
} else {
  Write-Host 'UPnP edge: 80/443 + LiveKit media (sin 4000/5173/7880)' -ForegroundColor Cyan
}

# Quitar mapeos legacy expuestos si existen (API/Web/signal directos)
$stale = @(
  @{ Ext = 4000; Proto = 'TCP' }
  @{ Ext = 5173; Proto = 'TCP' }
  @{ Ext = 7880; Proto = 'TCP' }
)
if (-not $full) {
  try {
    $nat0 = New-Object -ComObject HNetCfg.NATUPnP
    $col0 = $nat0.StaticPortMappingCollection
    if ($col0) {
      foreach ($s in $stale) {
        try { $col0.Remove([int]$s.Ext, $s.Proto) } catch {}
      }
    }
  } catch {}
}

$comOk = $false
try {
  $nat = New-Object -ComObject HNetCfg.NATUPnP
  $col = $nat.StaticPortMappingCollection
  if ($null -ne $col) {
    foreach ($m in $maps) {
      try { $col.Remove([int]$m.Ext, $m.Proto) } catch {}
      $col.Add([int]$m.Ext, $m.Proto, [int]$m.Ext, $lan, $true, $m.Desc) | Out-Null
      Write-Host "COM-UPnP OK $($m.Proto)/$($m.Ext) -> ${lan}:$($m.Ext)" -ForegroundColor Green
    }
    $comOk = $true
  } else {
    Write-Host 'COM-UPnP: StaticPortMappingCollection NULL (usando SOAP)...' -ForegroundColor Yellow
  }
} catch {
  Write-Host "COM-UPnP: $($_.Exception.Message) (usando SOAP)..." -ForegroundColor Yellow
}

$soapOk = $false
if (-not $comOk) {
  $soapOk = Set-TpxSoapPortMaps -LanIp $lan -Maps $maps
}

if (-not ($comOk -or $soapOk)) {
  Write-Host "UPnP FALLO: no se pudo mapear. Abre TCP 80/443 -> $lan en el router." -ForegroundColor Red
  exit 2
}

Write-Host 'UPnP mapeos aplicados (COM o SOAP).' -ForegroundColor Green
exit 0
