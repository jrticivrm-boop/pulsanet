# Codifica GoogleService-Info.plist para variable Codemagic GOOGLE_SERVICE_INFO_PLIST_BASE64
param(
  [Parameter(Mandatory = $true)]
  [string]$PlistPath
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $PlistPath)) { throw "No existe: $PlistPath" }
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $PlistPath)))
Write-Host "Copia esto en Codemagic -> grupo tacticalptx_ios -> GOOGLE_SERVICE_INFO_PLIST_BASE64 (marcar Secret):"
Write-Host ""
Write-Host $b64
Write-Host ""
Write-Host "Longitud: $($b64.Length) caracteres"
