# Sincroniza IP publica, .env, livekit.dev.yaml, DuckDNS (dominio estable) y LiveKit ICE.
# Dot-source: . (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

function Get-TpxRepoRoot {
  param([string]$Hint = $PSScriptRoot)
  foreach ($cand in @(
    (Split-Path -Parent $Hint),
    'C:\pulsanet',
    'D:\pulsanet'
  )) {
    if ($cand -and (Test-Path (Join-Path $cand 'backend\package.json'))) {
      return (Resolve-Path $cand).Path
    }
  }
  return (Split-Path -Parent $Hint)
}

function Get-TpxCurrentPublicIp {
  try {
    $ip = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim()
    if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { return $ip }
  } catch {}
  return $null
}

function Get-TpxStoredPublicIp {
  param([string]$Root)
  $ipFile = Join-Path $Root 'infra\caddy\public-ip.txt'
  if (Test-Path $ipFile) {
    $ip = (Get-Content $ipFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { return $ip }
  }
  $envFile = Join-Path $Root 'backend\.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -ErrorAction SilentlyContinue) {
      if ($line -match '^LIVEKIT_PUBLIC_HOST=(.+)$') {
        $v = $Matches[1].Trim().Trim('"').Trim("'")
        if ($v -match '^\d{1,3}(\.\d{1,3}){3}$') { return $v }
      }
    }
  }
  return $null
}

function Get-TpxEnvValue {
  param(
    [string]$Root,
    [string]$Key
  )
  $files = @(
    (Join-Path $Root 'Soporte\Secrets\stable-domain.env'),
    (Join-Path $Root 'backend\.env')
  )
  foreach ($envFile in $files) {
    if (-not (Test-Path $envFile)) { continue }
    foreach ($line in Get-Content $envFile -ErrorAction SilentlyContinue) {
      if ($line -match "^$([regex]::Escape($Key))=(.*)$") {
        $v = $Matches[1].Trim().Trim('"').Trim("'")
        if ($v) { return $v }
      }
    }
  }
  return $null
}

function Get-TpxPublicDomainFromEnv {
  param([string]$Root)
  return Get-TpxEnvValue -Root $Root -Key 'PUBLIC_DOMAIN'
}

# Dominio permanente (DuckDNS u otro). No cambia cuando el ISP rota la IP.
function Get-TpxStablePublicDomain {
  param([string]$Root = (Get-TpxRepoRoot))
  $stable = Get-TpxEnvValue -Root $Root -Key 'STABLE_PUBLIC_DOMAIN'
  if ($stable) { return $stable.ToLowerInvariant() }
  $file = Join-Path $Root 'infra\caddy\stable-domain.txt'
  if (Test-Path $file) {
    $v = (Get-Content $file -Raw -ErrorAction SilentlyContinue).Trim()
    if ($v) { return $v.ToLowerInvariant() }
  }
  return $null
}

function Get-TpxPreferredPublicDomain {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [string]$PublicIp = ''
  )
  $stable = Get-TpxStablePublicDomain -Root $Root
  if ($stable) { return $stable }
  if (-not $PublicIp) { $PublicIp = Get-TpxCurrentPublicIp }
  if ($PublicIp) { return "$PublicIp.sslip.io" }
  return Get-TpxPublicDomainFromEnv -Root $Root
}

function Get-TpxLiveKitYamlNodeIp {
  param([string]$Root)
  $lkYaml = Join-Path $Root 'infra\livekit.dev.yaml'
  if (-not (Test-Path $lkYaml)) { return $null }
  $yk = Get-Content $lkYaml -Raw -ErrorAction SilentlyContinue
  if ($yk -match '(?m)^\s*node_ip:\s*(\S+)') {
    return $Matches[1].Trim().Trim('"').Trim("'")
  }
  return $null
}

function Test-TpxPublicIpDrift {
  param([string]$Root = (Get-TpxRepoRoot))
  $current = Get-TpxCurrentPublicIp
  if (-not $current) {
    return [ordered]@{ Drift = $false; Reason = 'no-ipify'; Current = $null; Stored = $null }
  }
  $stored = Get-TpxStoredPublicIp -Root $Root
  $yamlIp = Get-TpxLiveKitYamlNodeIp -Root $Root
  if (-not $stored) {
    return [ordered]@{ Drift = $true; Reason = 'no-stored'; Current = $current; Stored = $null; YamlIp = $yamlIp }
  }
  if ($current -ne $stored) {
    return [ordered]@{ Drift = $true; Reason = 'ip-changed'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
  }
  if ($yamlIp -and $yamlIp -ne $current) {
    return [ordered]@{ Drift = $true; Reason = 'yaml-stale'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
  }
  return [ordered]@{ Drift = $false; Reason = 'ok'; Current = $current; Stored = $stored; YamlIp = $yamlIp }
}

function Set-TpxEnvValue {
  param(
    [string]$EnvFile,
    [string]$Key,
    [string]$Value
  )
  if (-not (Test-Path $EnvFile)) {
    $dir = Split-Path $EnvFile -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content $EnvFile "$Key=$Value" -Encoding UTF8
    return
  }
  $lines = @(Get-Content $EnvFile)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") { $found = $true; "$Key=$Value" } else { $line }
  }
  if (-not $found) { $out += "$Key=$Value" }
  Set-Content $EnvFile $out -Encoding UTF8
}

function Sync-TpxLiveKitYaml {
  param(
    [string]$Root,
    [string]$PublicIp
  )
  if (-not $PublicIp) { return $false }
  $lkYaml = Join-Path $Root 'infra\livekit.dev.yaml'
  if (-not (Test-Path $lkYaml)) { return $false }
  $yk = Get-Content $lkYaml -Raw
  $yk2 = $yk
  $yk2 = [regex]::Replace($yk2, '(?m)^(\s*node_ip:\s*).+$', "`${1}$PublicIp")
  $yk2 = [regex]::Replace($yk2, '(?m)^(\s*domain:\s*).+$', "`${1}$PublicIp")
  if ($yk2 -ne $yk) {
    Set-Content -Path $lkYaml -Value $yk2 -NoNewline -Encoding UTF8
    return $true
  }
  return $false
}

# Actualiza registro A en DuckDNS (ancla permanente para el APK).
function Update-TpxDuckDns {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [string]$PublicIp = ''
  )
  if (-not $PublicIp) { $PublicIp = Get-TpxCurrentPublicIp }
  if (-not $PublicIp) { return $false }

  $token = Get-TpxEnvValue -Root $Root -Key 'DUCKDNS_TOKEN'
  $sub = Get-TpxEnvValue -Root $Root -Key 'DUCKDNS_SUBDOMAIN'
  if (-not $token -or -not $sub) { return $false }

  $sub = $sub.Trim().ToLowerInvariant() -replace '\.duckdns\.org$', ''
  try {
    $url = "https://www.duckdns.org/update?domains=$sub&token=$token&ip=$PublicIp"
    $resp = (Invoke-RestMethod -Uri $url -TimeoutSec 15).ToString().Trim()
    if ($resp -eq 'OK') {
      Write-Host "DuckDNS OK: $sub.duckdns.org -> $PublicIp" -ForegroundColor Green
      return $true
    }
    Write-Host "DuckDNS respuesta: $resp" -ForegroundColor Yellow
  } catch {
    Write-Host "DuckDNS error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  return $false
}

function Sync-TpxApkApiBaseHint {
  param(
    [string]$Root,
    [string]$Origin
  )
  if (-not $Origin) { return }
  $hint = Join-Path $Root 'infra\caddy\apk-api-base.txt'
  $dir = Split-Path $hint -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $hint -Value $Origin.TrimEnd('/') -Encoding ascii
}

function Sync-TpxMobileConfigDefault {
  param(
    [string]$Root,
    [string]$Origin
  )
  if (-not $Origin) { return $false }
  $cfg = Join-Path $Root 'mobile\lib\config.dart'
  if (-not (Test-Path $cfg)) { return $false }
  $raw = Get-Content $cfg -Raw
  $escaped = $Origin.TrimEnd('/')
  $next = [regex]::Replace(
    $raw,
    "defaultValue:\s*'https?://[^']+'",
    "defaultValue: '$escaped'"
  )
  if ($next -eq $raw) { return $false }
  Set-Content -Path $cfg -Value $next -NoNewline -Encoding UTF8
  Write-Host "mobile/lib/config.dart default -> $escaped" -ForegroundColor Green
  return $true
}

function Sync-TpxPublicEnv {
  param(
    [string]$Root,
    [string]$PublicIp,
    [string]$Domain = ''
  )
  if (-not $PublicIp) { return $false }
  [void](Update-TpxDuckDns -Root $Root -PublicIp $PublicIp)
  if (-not $Domain) {
    $Domain = Get-TpxPreferredPublicDomain -Root $Root -PublicIp $PublicIp
  }
  $envFile = Join-Path $Root 'backend\.env'
  $origin = "https://$Domain"
  Set-TpxEnvValue -EnvFile $envFile -Key 'PUBLIC_HOST' -Value $PublicIp
  Set-TpxEnvValue -EnvFile $envFile -Key 'PUBLIC_DOMAIN' -Value $Domain
  Set-TpxEnvValue -EnvFile $envFile -Key 'WEB_PUBLIC_URL' -Value $origin
  Set-TpxEnvValue -EnvFile $envFile -Key 'LIVEKIT_PUBLIC_HOST' -Value $PublicIp
  Set-TpxEnvValue -EnvFile $envFile -Key 'LIVEKIT_PUBLIC_URL' -Value "wss://$Domain"
  $stable = Get-TpxStablePublicDomain -Root $Root
  if ($stable) {
    Set-TpxEnvValue -EnvFile $envFile -Key 'STABLE_PUBLIC_DOMAIN' -Value $stable
  }
  $ipFile = Join-Path $Root 'infra\caddy\public-ip.txt'
  $ipDir = Split-Path $ipFile -Parent
  if (-not (Test-Path $ipDir)) { New-Item -ItemType Directory -Force -Path $ipDir | Out-Null }
  Set-Content -Path $ipFile -Value $PublicIp -Encoding ascii
  Sync-TpxApkApiBaseHint -Root $Root -Origin $origin
  [void](Sync-TpxLiveKitYaml -Root $Root -PublicIp $PublicIp)
  # Solo reescribe default del APK si hay ancla estable (evita churn git en cada IP).
  if ($stable) {
    [void](Sync-TpxMobileConfigDefault -Root $Root -Origin $origin)
  }
  return $true
}

function Restart-TpxLiveKit {
  param(
    [string]$Root,
    [string]$PublicIp
  )
  $lk = Join-Path $Root 'infra\livekit\livekit-server.exe'
  if (-not (Test-Path $lk)) { return $false }
  & taskkill.exe /F /IM livekit-server.exe 2>$null | Out-Null
  Start-Sleep -Milliseconds 600
  $lkCfg = Join-Path $Root 'infra\livekit.dev.yaml'
  $lkArgs = @('--dev', '--bind', '0.0.0.0', '--udp-port', '7882')
  if (Test-Path $lkCfg) {
    $lkArgs = @('--config', $lkCfg, '--dev', '--udp-port', '7882')
  }
  if ($PublicIp) { $lkArgs += @('--node-ip', $PublicIp) }
  Start-Process -FilePath $lk -ArgumentList $lkArgs -WorkingDirectory (Split-Path $lk) -WindowStyle Hidden
  Start-Sleep -Milliseconds 500
  return [bool](Get-Process -Name livekit-server -ErrorAction SilentlyContinue)
}

function Invoke-TpxPublicIpRealign {
  param(
    [string]$Root = (Get-TpxRepoRoot),
    [switch]$FullEdge
  )
  $current = Get-TpxCurrentPublicIp
  if (-not $current) {
    Write-Host 'Sync-PublicIp: no se pudo obtener IP publica (ipify)' -ForegroundColor Yellow
    return $false
  }
  if ($FullEdge) {
    $edge = Join-Path $Root 'infra\START-PUBLIC-EDGE.ps1'
    if (-not (Test-Path $edge)) { return $false }
    $stable = Get-TpxStablePublicDomain -Root $Root
    if ($stable) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge -Domain $stable
    } else {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge
    }
    return ($LASTEXITCODE -eq 0)
  }
  [void](Sync-TpxPublicEnv -Root $Root -PublicIp $current)
  $ok = Restart-TpxLiveKit -Root $Root -PublicIp $current
  if ($ok) {
    $dom = Get-TpxPreferredPublicDomain -Root $Root -PublicIp $current
    Write-Host "Sync-PublicIp: alineado node-ip=$current domain=$dom (LiveKit reiniciado)" -ForegroundColor Green
  }
  return $ok
}
