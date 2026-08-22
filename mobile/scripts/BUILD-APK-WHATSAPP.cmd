@echo off
:: APK release — por defecto LAN (sin Tailscale).
:: 4G directo:  set API_BASE=http://TU.IP.PUBLICA:4000
:: Tailscale:   set FORCE_TAILSCALE=1
chcp 65001 >nul
setlocal EnableDelayedExpansion
title TacticalPtx - Build APK
cd /d D:\pulsanet\mobile

set "PATH=C:\tools\flutter\bin;C:\Program Files\Git\cmd;D:\Android\Sdk\platform-tools;%PATH%"
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
set "ANDROID_HOME=D:\Android\Sdk"

:: --- Resolver API_BASE ---
if defined API_BASE goto :have_base

set "API_BASE=http://192.168.1.66:4000"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LANIP=%%I"
if defined LANIP if not "!LANIP!"=="" set "API_BASE=http://!LANIP!:4000"

if /I "%FORCE_TAILSCALE%"=="1" (
  set "TS=C:\Program Files\Tailscale\tailscale.exe"
  if exist "%TS%" (
    for /f "usebackq delims=" %%I in (`"%TS%" ip -4`) do set "TSIP=%%I"
  )
  if defined TSIP if not "!TSIP!"=="" set "API_BASE=http://!TSIP!:4000"
)

:have_base
echo === Build APK (Flutter) ===
echo API_BASE=%API_BASE%
echo (LAN por defecto. 4G sin Tailscale: set API_BASE=http://IP_PUBLICA:4000)
echo.

if not exist "C:\tools\flutter\bin\flutter.bat" (
  echo ERROR: no esta Flutter en C:\tools\flutter
  pause
  exit /b 1
)

call flutter pub get
if errorlevel 1 (
  echo pub get fallo
  pause
  exit /b 1
)

call flutter build apk --release --dart-define=API_BASE=%API_BASE%
if errorlevel 1 (
  echo build fallo
  pause
  exit /b 1
)

set "APK=D:\pulsanet\mobile\build\app\outputs\flutter-apk\app-release.apk"
echo.
echo ========== LISTO ==========
echo Envia por WhatsApp:
echo   %APK%
echo.
if exist "%APK%" explorer /select,"%APK%"
echo.
echo NOTA: cada cambio = nueva APK. Instala o envia por WhatsApp.
echo Guía sin Tailscale: D:\pulsanet\Soporte\Documentos\ACCESO_DIRECTO_SIN_TAILSCALE.md
pause
endlocal
