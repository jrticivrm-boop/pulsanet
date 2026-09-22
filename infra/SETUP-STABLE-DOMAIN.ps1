# Configura dominio permanente (DuckDNS) para que el APK no se rompa al cambiar la IP del ISP.
#
# 1) Crea cuenta gratis en https://www.duckdns.org
# 2) Crea un subdominio (ej. tacticalptx) y copia el token
# 3) Ejecuta:
#    powershell -File infra\SETUP-STABLE-DOMAIN.ps1 -Subdomain tacticalptx -Token TU_TOKEN
#
# Tras esto, PUBLIC_DOMAIN queda fijo (tacticalptx.duckdns.org). Watch-Stack / Sync-PublicIp
# actualizan el A-record cuando cambie la IP; no hace falta republicar APK por IP.

param(
  [Parameter(Mandatory = $true)][string]$Subdomain,
  [Parameter(Mandatory = $true)][string]$Token,
  [switch]$SkipEdge,
  [switch]$SkipApkHint
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'Sync-PublicIp.ps1')

$sub = $Subdomain.Trim().ToLowerInvariant() -replace '\.duckdns\.org$', ''
if ($sub -notmatch '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$') {
  throw "Subdominio DuckDNS invalido: $Subdomain"
}
$domain = "$sub.duckdns.org"
$ip = Get-TpxCurrentPublicIp
if (-not $ip) { throw 'No se pudo obtener IP publica (ipify)' }

$secretsDir = Join-Path $root 'Soporte\Secrets'
New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
$secretFile = Join-Path $secretsDir 'stable-domain.env'
@(
  "STABLE_PUBLIC_DOMAIN=$domain"
  "DUCKDNS_SUBDOMAIN=$sub"
  "DUCKDNS_TOKEN=$Token"
) | Set-Content -Path $secretFile -Encoding UTF8

$stableFile = Join-Path $root 'infra\caddy\stable-domain.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $stableFile) | Out-Null
Set-Content -Path $stableFile -Value $domain -Encoding ascii

$envFile = Join-Path $root 'backend\.env'
Set-TpxEnvValue -EnvFile $envFile -Key 'STABLE_PUBLIC_DOMAIN' -Value $domain
Set-TpxEnvValue -EnvFile $envFile -Key 'DUCKDNS_SUBDOMAIN' -Value $sub
# Token solo en Secrets (no lo duplicamos en backend/.env si se puede evitar)
# pero Sync lee ambos; dejamos referencia en .env sin token si no existe.
if (-not (Get-TpxEnvValue -Root $root -Key 'DUCKDNS_TOKEN')) {
  Set-TpxEnvValue -EnvFile $secretFile -Key 'DUCKDNS_TOKEN' -Value $Token
}

Write-Host "=== Ancla permanente ===" -ForegroundColor Cyan
Write-Host "Dominio: $domain"
Write-Host "IP:      $ip"
Write-Host "Secrets: $secretFile"

$okDns = Update-TpxDuckDns -Root $root -PublicIp $ip
if (-not $okDns) { throw 'DuckDNS no actualizo el registro (revisa token/subdominio)' }

[void](Sync-TpxPublicEnv -Root $root -PublicIp $ip -Domain $domain)
[void](Sync-TpxMobileConfigDefault -Root $root -Origin "https://$domain")

if (-not $SkipEdge) {
  $edge = Join-Path $PSScriptRoot 'START-PUBLIC-EDGE.ps1'
  Write-Host "Arrancando borde HTTPS con $domain ..." -ForegroundColor Cyan
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $edge -Domain $domain
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'START-PUBLIC-EDGE termino con error; revisa puertos 80/443 y DNS propagado.'
  }
}

Write-Host ''
Write-Host "Listo. APK debe usar: API_BASE=https://$domain" -ForegroundColor Green
Write-Host 'Publica OTA: mobile\scripts\PUBLISH-APK-UPDATE.cmd (lee PUBLIC_DOMAIN del .env)'
Write-Host 'Cuando el ISP cambie la IP, Sync/Watch actualizan DuckDNS; el APK sigue igual.'
