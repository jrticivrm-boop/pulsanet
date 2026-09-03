# Si Caddy (borde publico :80/:443) no escucha, o la IP publica cambio, realinea todo.
# Uso: powershell -File infra\ENSURE-PUBLIC-EDGE.ps1

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')
$root = Get-TpxRepoRoot -Hint $PSScriptRoot

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
      $code = & curl.exe -sk --connect-timeout 8 --max-time 12 -o NUL -w '%{http_code}' "https://$dom/api/health" 2>$null
      if ($code -eq '200') {
        Write-Host "Edge OK https://$dom (443)" -ForegroundColor Green
        exit 0
      }
      Write-Host "Edge escucha pero health=$code - reiniciando..." -ForegroundColor Yellow
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
  Write-Host "AVISO edge: $($_.Exception.Message)" -ForegroundColor Yellow
  exit 1
}
