# Test enter/exit de geocerca (simula GPS de un operador).
# Uso:
#   powershell -NoExit -File infra\Test-GeofenceEnterExit.ps1 -Username OPERADOR -Password '***'
#   o doble clic en infra\Test-GeofenceEnterExit.cmd
# Opcional:
#   -BaseUrl https://pulsanet.duckdns.org
#   -CenterLat 26.83655 -CenterLng -98.47531 -RadiusM 200
#
# Deja la Consola → Mapa abierta para ver «entró / salió».

param(
  [string]$BaseUrl = 'https://pulsanet.duckdns.org',
  [string]$Username = '',
  [string]$Password = '',
  [double]$CenterLat = 26.83655,
  [double]$CenterLng = -98.47531,
  [double]$RadiusM = 200,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$exitCode = 0

try {
  $BaseUrl = $BaseUrl.TrimEnd('/')

  if (-not $Username) {
    $Username = Read-Host 'Usuario operador'
  }
  if (-not $Password) {
    $secure = Read-Host 'Contraseña' -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
  }
  if (-not $Username -or -not $Password) {
    throw 'Faltan usuario o contraseña.'
  }

  function Post-Json($Path, $Body, $Token = $null) {
    $headers = @{ 'Content-Type' = 'application/json; charset=utf-8' }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $json = $Body | ConvertTo-Json -Compress
    try {
      return Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $headers -Body $json
    } catch {
      $resp = $_.Exception.Response
      $detail = $_.ErrorDetails.Message
      if (-not $detail -and $resp) {
        try {
          $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
          $detail = $reader.ReadToEnd()
        } catch { }
      }
      throw "HTTP $Path falló: $($_.Exception.Message)$(if ($detail) { "`n$detail" })"
    }
  }

  # Punto ~ fuera del radio (hacia el norte) y el centro (dentro)
  $degLat = $RadiusM * 2.5 / 111320.0
  $outsideLat = [Math]::Round($CenterLat + $degLat, 6)
  $outsideLng = $CenterLng
  $insideLat = $CenterLat
  $insideLng = $CenterLng

  Write-Host "Login $Username @ $BaseUrl ..."
  $login = Post-Json '/api/auth/login' @{ username = $Username; password = $Password }
  $token = $login.token
  if (-not $token) { throw "Login sin token: $($login | ConvertTo-Json -Compress -Depth 6)" }
  Write-Host "OK $($login.user.displayName) ($($login.user.id))"

  Write-Host ""
  Write-Host "1) GPS FUERA  lat=$outsideLat lng=$outsideLng"
  $r1 = Post-Json '/api/locations' @{
    latitude  = $outsideLat
    longitude = $outsideLng
    accuracyM = 10
  } $token
  $ev1 = if ($r1.geofenceEvents) { $r1.geofenceEvents | ConvertTo-Json -Compress -Depth 6 } else { '[]' }
  Write-Host "   geofenceEvents: $ev1"

  Start-Sleep -Seconds 1

  Write-Host "2) GPS DENTRO lat=$insideLat lng=$insideLng  (ENTER esperado)"
  $r2 = Post-Json '/api/locations' @{
    latitude  = $insideLat
    longitude = $insideLng
    accuracyM = 10
  } $token
  $ev2 = if ($r2.geofenceEvents) { $r2.geofenceEvents | ConvertTo-Json -Compress -Depth 6 } else { '[]' }
  Write-Host "   geofenceEvents: $ev2"

  Start-Sleep -Seconds 1

  Write-Host "3) GPS FUERA  lat=$outsideLat lng=$outsideLng  (EXIT esperado)"
  $r3 = Post-Json '/api/locations' @{
    latitude  = $outsideLat
    longitude = $outsideLng
    accuracyM = 10
  } $token
  $ev3 = if ($r3.geofenceEvents) { $r3.geofenceEvents | ConvertTo-Json -Compress -Depth 6 } else { '[]' }
  Write-Host "   geofenceEvents: $ev3"

  Write-Host ""
  Write-Host "Listo. Mira la Consola → Mapa (lista lateral) o el feed del overview."
  Write-Host "Ajusta -CenterLat/Lng/RadiusM al de tu geocerca si no coincide."
} catch {
  $exitCode = 1
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ScriptStackTrace) {
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
  }
}

if (-not $NoPause) {
  Write-Host ""
  Read-Host 'Enter para cerrar'
}

exit $exitCode
