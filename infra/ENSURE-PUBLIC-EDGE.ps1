# Si Caddy (borde publico :80/:443) no escucha, o la IP publica cambio, realinea todo.
# Uso: powershell -File infra\ENSURE-PUBLIC-EDGE.ps1

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')
. (Join-Path $PSScriptRoot 'Fix-WanTlsOffload.ps1')
$root = Get-TpxRepoRoot -Hint $PSScriptRoot
try { [void](Invoke-TpxWanTlsOffloadFix) } catch {
  Write-Host "Fix-WanTlsOffload: $($_.Exception.Message)" -ForegroundColor Yellow
}

function Test-PortListen([int]$Port) {
  try {
    $out = & netstat.exe -ano 2>$null | Select-String -Pattern 'LISTENING' | Select-String -Pattern ":$Port\s"
    return [bool]$out
  } catch {
    return $false
  }
}

function Get-PublicDomain {
  $dom = Get-TpxPublicDomainFromEnv -Root $root
  if ($dom) { return $dom }
  $ip = Get-TpxStoredPublicIp -Root $root
  if ($ip) { return "$ip.sslip.io" }
  $current = Get-TpxCurrentPublicIp
  if ($current) { return "$current.sslip.io" }
  return $null
}

try {
  $httpd = @(Get-Process -Name httpd -ErrorAction SilentlyContinue)
  if ($httpd.Count -gt 0) {
    Write-Host 'Deteniendo Apache/XAMPP (httpd) en 80/443...' -ForegroundColor Yellow
    $httpd | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
  }

  # Siempre alinear hosts → LAN actual (si queda IP vieja .77 el navegador no abre el dominio).
  $hairpin = Join-Path $PSScriptRoot 'Fix-DuckdnsHairpin.ps1'
  if (Test-Path $hairpin) {
    $dom0 = Get-PublicDomain
    $lan0 = Get-TpxPreferredLanIp
    if ($dom0 -match 'duckdns\.org') {
      try { & $hairpin -LanIp $lan0 -Domain $dom0 } catch {
        Write-Host "Fix-DuckdnsHairpin: $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }
  }

  $drift = Test-TpxPublicIpDrift -Root $root
  if ($drift.Drift) {
    Write-Host "IP publica desalineada ($($drift.Reason): stored=$($drift.Stored) yaml=$($drift.YamlIp) current=$($drift.Current))" -ForegroundColor Yellow
    Write-Host 'START-PUBLIC-EDGE (re-cert + UPnP + LiveKit)...' -ForegroundColor Cyan
    $edgeScript = Join-Path $PSScriptRoot 'START-PUBLIC-EDGE.ps1'
    if (-not (Test-Path $edgeScript)) {
      Write-Host "AVISO: falta $edgeScript" -ForegroundColor Yellow
      exit 1
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edgeScript
    exit $LASTEXITCODE
  }

  if ((Test-PortListen 443) -and (Get-Process -Name caddy -ErrorAction SilentlyContinue)) {
    $dom = Get-PublicDomain
    if (-not $dom) {
      Write-Host 'Sin PUBLIC_DOMAIN - START-PUBLIC-EDGE...' -ForegroundColor Yellow
    } else {
      $lan = Get-TpxPreferredLanIp
      if (Test-TpxLocalEdgeHealth -Domain $dom -LanIp $lan) {
        Write-Host "Edge LOCAL OK https://$dom (443) lan=$lan" -ForegroundColor Green
        # Local OK suele ser hosts→LAN; sin reafirmar UPnP/DuckDNS el acceso desde
        # otro equipo por Internet puede quedar caído aunque Caddy siga vivo.
        $ipNow = Get-TpxCurrentPublicIp
        if ($ipNow) {
          try { [void](Update-TpxDuckDns -Root $root -PublicIp $ipNow) } catch {
            Write-Host "DuckDNS: $($_.Exception.Message)" -ForegroundColor Yellow
          }
        }
        $reinforce = Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1'
        if (Test-Path $reinforce) {
          & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reinforce
          if ($LASTEXITCODE -notin @(0, $null)) {
            Write-Host "AVISO: Reinforce-UPnP exit=$LASTEXITCODE (otro equipo puede no ver :80/:443)" -ForegroundColor Yellow
          }
        }
        if (-not (Test-TpxUPnPAvailable)) {
          Write-Host "AVISO: UPnP IGD null - APK 4G / otro equipo necesita port-forward 80/443 -> $lan" -ForegroundColor Yellow
          exit 3
        }
        exit 0
      }
      $code = & curl.exe -sk --connect-timeout 8 --max-time 12 -o NUL -w '%{http_code}' "https://$dom/api/health" 2>$null
      if ($code -eq '200') {
        Write-Host "Edge WAN OK https://$dom (443)" -ForegroundColor Green
        $reinforce2 = Join-Path $PSScriptRoot 'Reinforce-UPnP.ps1'
        if (Test-Path $reinforce2) {
          & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reinforce2 | Out-Null
        }
        exit 0
      }
      Write-Host "Edge escucha pero health local/WAN fallo (wan=$code) - reiniciando..." -ForegroundColor Yellow
    }
  } else {
    Write-Host 'Edge caido o inactivo - START-PUBLIC-EDGE...' -ForegroundColor Yellow
  }

  $edgeScript = Join-Path $PSScriptRoot 'START-PUBLIC-EDGE.ps1'
  if (-not (Test-Path $edgeScript)) {
    Write-Host "AVISO: falta $edgeScript" -ForegroundColor Yellow
    exit 1
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edgeScript
  exit $LASTEXITCODE
} catch {
  Write-Host ("AVISO edge: " + $_.Exception.Message) -ForegroundColor Yellow
  exit 1
}
