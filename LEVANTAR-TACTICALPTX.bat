@echo off
:: Levanta stack local TacticalPtx: Postgres + Redis + LiveKit + API + Web
setlocal EnableExtensions
title TacticalPtx - Levantar servicios
cd /d D:\pulsanet

:: Node visible al hacer doble clic (Explorer no hereda PATH de Cursor)
set "PATH=C:\Program Files\nodejs;%PATH%"

echo === TacticalPtx: levantando servicios ===
echo.

:: 1) PostgreSQL
echo [1/4] PostgreSQL...
sc.exe query postgresql-x64-17 | find "RUNNING" >nul
if errorlevel 1 (
  sc.exe config postgresql-x64-17 start= demand >nul 2>&1
  net start postgresql-x64-17 >nul 2>&1
  sc.exe query postgresql-x64-17 | find "RUNNING" >nul
  if errorlevel 1 (
    echo   AVISO: no se pudo iniciar postgresql-x64-17
    echo          Abre servicios.msc o ejecuta este BAT como Administrador.
  ) else (
    echo   OK: PostgreSQL iniciado
  )
) else (
  echo   OK: ya corria
)

:: 2) Redis + LiveKit
echo [2/4] Redis + LiveKit...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\pulsanet\infra\start-services.ps1"
if errorlevel 1 (
  echo   AVISO: start-services.ps1 fallo
) else (
  echo   OK
)

:: 3) API
echo [3/4] API :4000...
curl.exe -s --connect-timeout 3 --max-time 8 http://127.0.0.1:4000/api/health >nul 2>&1
if errorlevel 1 (
  if not exist "D:\pulsanet\backend\node_modules\" (
    echo   Instalando dependencias API...
    pushd D:\pulsanet\backend
    call npm.cmd install
    popd
  )
  start "TacticalPtx API" cmd /k "D:\pulsanet\infra\start-api.cmd"
  echo   Ventana API abierta
) else (
  echo   OK: API ya respondia en :4000
)

:: 4) Web
echo [4/4] Web :5173...
curl.exe -s --connect-timeout 3 --max-time 8 http://127.0.0.1:5173/ >nul 2>&1
if errorlevel 1 (
  if not exist "D:\pulsanet\web\node_modules\" (
    echo   Instalando dependencias Web...
    pushd D:\pulsanet\web
    call npm.cmd install
    popd
  )
  start "TacticalPtx Web" cmd /k "D:\pulsanet\infra\start-web.cmd"
  echo   Ventana API/Web: se abrio una ventana "TacticalPtx Web"
) else (
  echo   OK: Web ya respondia en :5173
)

echo.
echo Esperando health API...
set /a n=0
:wait_api
curl.exe -s --connect-timeout 3 --max-time 8 http://127.0.0.1:4000/api/health 2>nul | find "ok" >nul
if not errorlevel 1 goto api_ok
set /a n+=1
if %n% GEQ 20 (
  echo AVISO: API aun no responde. Mira la ventana "TacticalPtx API".
  goto fin
)
ping -n 3 127.0.0.1 >nul
goto wait_api

:api_ok
echo Esperando web :5173...
set /a n=0
:wait_web
curl.exe -s --connect-timeout 3 --max-time 8 http://127.0.0.1:5173/ >nul 2>&1
if not errorlevel 1 goto web_ok
set /a n+=1
if %n% GEQ 20 (
  echo AVISO: Web aun no responde. Mira la ventana "TacticalPtx Web".
  goto fin
)
ping -n 3 127.0.0.1 >nul
goto wait_web

:web_ok
echo.
echo ========== LISTO ==========
echo   API:  http://127.0.0.1:4000/api/health
echo   Web:  http://127.0.0.1:5173
echo   Movil Wi-Fi:     API_BASE=http://192.168.1.66:4000
echo   Movil Tailscale: (ver salida de start-services.ps1, IP 100.x)
echo.
start "" "http://127.0.0.1:5173"

:fin
echo.
pause
endlocal
