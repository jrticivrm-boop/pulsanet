# UPnP via SOAP directo al IGD (bypass COM HNetCfg, falla en dual-NIC / Deco).
# Dot-source tras Sync-PublicIp.ps1 o solo.

function Get-TpxIgds {
  $found = New-Object System.Collections.Generic.List[string]
  try {
    $udp = New-Object System.Net.Sockets.UdpClient 0
    $udp.Client.ReceiveTimeout = 2500
    $udp.EnableBroadcast = $true
    $payload = [Text.Encoding]::ASCII.GetBytes(
      "M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 2`r`nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1`r`n`r`n"
    )
    $udp.Send($payload, $payload.Length, (New-Object Net.IPEndPoint([Net.IPAddress]::Parse('239.255.255.250'), 1900))) | Out-Null
    $deadline = [datetime]::UtcNow.AddSeconds(3)
    while ([datetime]::UtcNow -lt $deadline) {
      try {
        $ep = New-Object Net.IPEndPoint([Net.IPAddress]::Any, 0)
        $bytes = $udp.Receive([ref]$ep)
        $txt = [Text.Encoding]::ASCII.GetString($bytes)
        if ($txt -match 'LOCATION:\s*(\S+)') {
          $loc = $Matches[1].Trim()
          if (-not $found.Contains($loc)) { [void]$found.Add($loc) }
        }
      } catch { break }
    }
    $udp.Close()
  } catch {}
  return @($found)
}

function Get-TpxIgdsControl {
  param([string]$RootDescUrl)
  try {
    $raw = (Invoke-WebRequest -Uri $RootDescUrl -TimeoutSec 6 -UseBasicParsing).Content
  } catch { return $null }
  if ($raw -notmatch 'WANIPConnection:1') { return $null }
  if ($raw -notmatch '<controlURL>([^<]*IPConn[^<]*)</controlURL>' -and
      $raw -notmatch '(?s)WANIPConnection:1.*?<controlURL>([^<]+)</controlURL>') {
    # fallback: known Deco path relative
    if ($RootDescUrl -match '^(https?://[^/]+)') {
      return [pscustomobject]@{
        Base = $Matches[1]
        Control = "$($Matches[1])/hdiee/ctl/IPConn"
        Service = 'urn:schemas-upnp-org:service:WANIPConnection:1'
      }
    }
    return $null
  }
  $ctrlPath = $null
  if ($raw -match '(?s)serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType>.*?<controlURL>([^<]+)</controlURL>') {
    $ctrlPath = $Matches[1]
  } elseif ($raw -match '<controlURL>(/[^<]*IPConn[^<]*)</controlURL>') {
    $ctrlPath = $Matches[1]
  }
  if (-not $ctrlPath) { return $null }
  if ($RootDescUrl -notmatch '^(https?://[^/]+)') { return $null }
  $base = $Matches[1]
  $ctrl = if ($ctrlPath -match '^https?://') { $ctrlPath } else { "$base$ctrlPath" }
  return [pscustomobject]@{
    Base = $base
    Control = $ctrl
    Service = 'urn:schemas-upnp-org:service:WANIPConnection:1'
  }
}

function Invoke-TpxUpnpAction {
  param(
    [string]$ControlUrl,
    [string]$ServiceType,
    [string]$Action,
    [string]$InnerXml = ''
  )
  $envelope = @"
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
<s:Body>
<u:$Action xmlns:u="$ServiceType">
$InnerXml
</u:$Action>
</s:Body>
</s:Envelope>
"@
  $headers = @{
    'Content-Type' = 'text/xml; charset="utf-8"'
    SOAPAction     = "`"$ServiceType#$Action`""
  }
  try {
    $r = Invoke-WebRequest -Uri $ControlUrl -Method POST -Headers $headers -Body $envelope -TimeoutSec 10 -UseBasicParsing
    return [pscustomobject]@{ Ok = $true; Status = [int]$r.StatusCode; Body = $r.Content }
  } catch {
    $code = 0
    $errBody = ''
    try {
      if ($_.Exception.Response) {
        $code = [int]$_.Exception.Response.StatusCode
        $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
      }
    } catch {}
    return [pscustomobject]@{ Ok = $false; Status = $code; Body = $errBody; Error = $_.Exception.Message }
  }
}

function Set-TpxSoapPortMaps {
  param(
    [string]$LanIp,
    [hashtable[]]$Maps
  )
  if (-not $LanIp) { return $false }
  $igds = Get-TpxIgds
  if (-not $igds -or $igds.Count -eq 0) {
    Write-Host 'SOAP-UPnP: no se descubrio IGD por SSDP' -ForegroundColor Yellow
    return $false
  }
  $okAny = $false
  foreach ($loc in $igds) {
    Write-Host "SOAP-UPnP IGD: $loc" -ForegroundColor Cyan
    $ctl = Get-TpxIgdsControl -RootDescUrl $loc
    if (-not $ctl) {
      Write-Host '  sin WANIPConnection' -ForegroundColor Yellow
      continue
    }
    $ext = Invoke-TpxUpnpAction -ControlUrl $ctl.Control -ServiceType $ctl.Service -Action 'GetExternalIPAddress'
    if ($ext.Body -match 'NewExternalIPAddress>([^<]*)') {
      Write-Host ("  ExternalIP={0}" -f $Matches[1]) 
    }
    foreach ($m in $Maps) {
      $proto = $m.Proto
      $port = [int]$m.Ext
      $desc = $m.Desc
      $del = "<NewRemoteHost></NewRemoteHost><NewExternalPort>$port</NewExternalPort><NewProtocol>$proto</NewProtocol>"
      [void](Invoke-TpxUpnpAction -ControlUrl $ctl.Control -ServiceType $ctl.Service -Action 'DeletePortMapping' -InnerXml $del)
      $add = @"
<NewRemoteHost></NewRemoteHost>
<NewExternalPort>$port</NewExternalPort>
<NewProtocol>$proto</NewProtocol>
<NewInternalPort>$port</NewInternalPort>
<NewInternalClient>$LanIp</NewInternalClient>
<NewEnabled>1</NewEnabled>
<NewPortMappingDescription>$desc</NewPortMappingDescription>
<NewLeaseDuration>0</NewLeaseDuration>
"@
      $r = Invoke-TpxUpnpAction -ControlUrl $ctl.Control -ServiceType $ctl.Service -Action 'AddPortMapping' -InnerXml $add
      if ($r.Ok) {
        Write-Host "  OK $proto/$port -> ${LanIp}:$port" -ForegroundColor Green
        $okAny = $true
      } else {
        Write-Host "  FAIL $proto/$port ($($r.Status))" -ForegroundColor Yellow
      }
    }
  }
  return $okAny
}
