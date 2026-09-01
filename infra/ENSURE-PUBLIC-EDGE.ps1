# Si Caddy (borde publico :80/:443) no escucha, lo reactiva.
# Uso: powershell -File infra\ENSURE-PUBLIC-EDGE.ps1

$ErrorActionPreference = 'Continue'

function Test-PortListen([int]$Port) {
  try {
    $out = & netstat.exe -ano 2>$null | Select-String -Pattern 'LISTENING' | Select-String -Pattern ":$Port\s"
    return [bool]$out
  } catch {
    return $false
  }
}

function Get-PublicDomain {
  $dom = '189.152.200.238.sslip.io'
  $ipFile = Join-Path $PSScriptRoot 'caddy\public-ip.txt'
  if (Test-Path $ipFile) {
    $ip = (Get-Content $ipFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($ip) { return "$ip.sslip.io" }
  }
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend\.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -ErrorAction SilentlyContinue) {
      if ($line -match '^PUBLIC_DOMAIN=(.+)$') {
        $v = $Matches[1].Trim().Trim('"').Trim("'")
        if ($v) { return $v }
      }
      if ($line -match '^LIVEKIT_PUBLIC_HOST=(.+)$') {
        $ip = $Matches[1].Trim().Trim('"').Trim("'")
        if ($ip -and $dom -eq '189.152.200.238.sslip.io') { $dom = "$ip.sslip.io" }
      }
    }
  }
  return $dom
}

try {
  # Apache/XAMPP no debe servir el dominio publico (deja "Apache/MariaDB caido").
  $httpd = @(Get-Process -Name httpd -ErrorAction SilentlyContinue)
  if ($httpd.Count -gt 0) {
    Write-Host 'Deteniendo Apache/XAMPP (httpd) en 80/443...' -ForegroundColor Yellow
    $httpd | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
  }

  if ((Test-PortListen 443) -and (Get-Process -Name caddy -ErrorAction SilentlyContinue)) {
    $dom = Get-PublicDomain
    $code = & curl.exe -sk --connect-timeout 8 --max-time 12 -o NUL -w '%{http_code}' "https://$dom/api/health" 2>$null
    if ($code -eq '200') {
      Write-Host "Edge OK https://$dom (443)" -ForegroundColor Green
      exit 0
    }
    Write-Host "Edge escucha pero health=$code - reiniciando..." -ForegroundColor Yellow
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
