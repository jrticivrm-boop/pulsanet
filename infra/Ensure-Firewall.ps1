# TacticalPtx - firewall Windows canonico (sin variantes de nombre)
# Solo netsh (Get-NetFirewall* cuelga en algunos Windows).
# Fuente unica: start-services, EXPOSE-UPNP, EXPOSE-PUBLIC, LEVANTAR.
#
# Uso:
# powershell -File infra\Ensure-Firewall.ps1
# . .\Ensure-Firewall.ps1 ; Ensure-TacticalPtxFirewall -DisableLegacy

$ErrorActionPreference = 'Continue'

# Nombres FIJOS - no inventar otros en scripts nuevos
$script:TacticalPtxFirewallRules = @(
 @{ Name = 'TacticalPtx-TCP-4000'; Proto = 'TCP'; Port = '4000'; Desc = 'API HTTPS/HTTP' }
 @{ Name = 'TacticalPtx-TCP-5173'; Proto = 'TCP'; Port = '5173'; Desc = 'Web Vite LAN' }
 @{ Name = 'TacticalPtx-TCP-80'; Proto = 'TCP'; Port = '80'; Desc = 'Caddy ACME HTTP-01' }
 @{ Name = 'TacticalPtx-TCP-443'; Proto = 'TCP'; Port = '443'; Desc = 'Caddy HTTPS edge' }
 @{ Name = 'TacticalPtx-TCP-7880'; Proto = 'TCP'; Port = '7880'; Desc = 'LiveKit signal' }
 @{ Name = 'TacticalPtx-TCP-7881'; Proto = 'TCP'; Port = '7881'; Desc = 'LiveKit RTC TCP' }
 @{ Name = 'TacticalPtx-UDP-7882'; Proto = 'UDP'; Port = '7882'; Desc = 'LiveKit media UDP' }
 @{ Name = 'TacticalPtx-UDP-3478'; Proto = 'UDP'; Port = '3478'; Desc = 'LiveKit TURN UDP' }
 @{ Name = 'TacticalPtx-UDP-50000-50200'; Proto = 'UDP'; Port = '50000-50200'; Desc = 'LiveKit ICE/RTC range' }
)

# Variantes antiguas de DisplayName en Windows Firewall (solo para borrarlas)
$script:TacticalPtxFirewallLegacy = @(
  'TacticalPtx API TCP 4000'
  'TacticalPtx LiveKit TCP 7880'
  'TacticalPtx LiveKit TCP 7881'
  'TacticalPtx LiveKit UDP 7882'
  'TacticalPtx LiveKit UDP RTC'
  'PulsaNet API 4000'
  'PulsaNet LiveKit 7880'
  'PulsaNet LiveKit TCP 7881'
  'PulsaNet LiveKit UDP 7882'
  'PulsaNet LiveKit UDP RTC'
  'livekit-server'
)

function Test-TacticalPtxFwRuleExists([string]$Name) {
 $out = & netsh.exe advfirewall firewall show rule name="$Name" 2>$null | Out-String
 if ($LASTEXITCODE -ne 0) { return $false }
 if ($out -match 'No se encontraron reglas|No rules match') { return $false }
 return ($out -match [regex]::Escape($Name))
}

function Ensure-TacticalPtxFirewall {
 param(
 [switch]$Quiet,
 [switch]$DisableLegacy
 )

 $ok = 0
 $fail = 0

 foreach ($r in $script:TacticalPtxFirewallRules) {
 # Recrear siempre: mismo nombre, mismo puerto, enable=yes, profile=any (sin variaciones)
 & netsh.exe advfirewall firewall delete rule name="$($r.Name)" >$null 2>&1
 $add = & netsh.exe advfirewall firewall add rule name="$($r.Name)" dir=in action=allow enable=yes profile=any protocol=$($r.Proto) localport=$($r.Port) 2>&1 | Out-String
 if ($LASTEXITCODE -eq 0 -or $add -match 'Ok\.|Correcto') {
 $ok++
 if (-not $Quiet) {
 Write-Host "Firewall OK $($r.Name) ($($r.Proto)/$($r.Port)) - $($r.Desc)" -ForegroundColor Green
 }
 } else {
 $fail++
 if (-not $Quiet) {
 Write-Host "Firewall FAIL $($r.Name): $($add.Trim())" -ForegroundColor Yellow
 Write-Host " Ejecuta como Administrador si hace falta." -ForegroundColor Yellow
 }
 }
 }

 if ($DisableLegacy) {
 foreach ($name in $script:TacticalPtxFirewallLegacy) {
 & netsh.exe advfirewall firewall delete rule name="$name" >$null 2>&1
 if (-not $Quiet -and $LASTEXITCODE -eq 0) {
 Write-Host "Legacy REMOVED $name" -ForegroundColor DarkGray
 }
 }
 }

 return [pscustomobject]@{ Ok = $ok; Fail = $fail }
}

# Auto-aplicar al ejecutar el .ps1 directamente (no al dot-source)
$dotSourced = $MyInvocation.InvocationName -eq '.' -or $MyInvocation.Line -match '^\s*\.\s+'
if (-not $dotSourced) {
 Write-Host "=== TacticalPtx firewall canonico ===" -ForegroundColor Cyan
 $r = Ensure-TacticalPtxFirewall -DisableLegacy
 Write-Host ""
 Write-Host "Resumen: Ok=$($r.Ok) Fail=$($r.Fail)"
 Write-Host "Reglas canonicas:"
 foreach ($x in $script:TacticalPtxFirewallRules) {
 $exists = Test-TacticalPtxFwRuleExists $x.Name
 Write-Host (" {0,-32} {1}" -f $x.Name, $(if ($exists) { 'OK' } else { 'MISSING' }))
 }
 if ($r.Fail -gt 0) { exit 1 }
 exit 0
}
