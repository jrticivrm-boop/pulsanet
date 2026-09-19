@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PATH=C:\Program Files\nodejs;%SystemRoot%\System32;%PATH%"

REM UI produccion = frontend\ (Vite :5173). Primero relativa a infra (portable).
set "WEB_DIR="
if exist "%~dp0..\frontend\package.json" set "WEB_DIR=%~dp0..\frontend"
if not defined WEB_DIR if exist "C:\pulsanet\frontend\package.json" set "WEB_DIR=C:\pulsanet\frontend"
if not defined WEB_DIR if exist "D:\pulsanet\frontend\package.json" set "WEB_DIR=D:\pulsanet\frontend"
REM Fallback legacy si quedara una carpeta web\ antigua
if not defined WEB_DIR if exist "%~dp0..\web\package.json" set "WEB_DIR=%~dp0..\web"
if not defined WEB_DIR if exist "C:\pulsanet\web\package.json" set "WEB_DIR=C:\pulsanet\web"
if not defined WEB_DIR goto web_no_dir
cd /d "%WEB_DIR%"
if errorlevel 1 goto web_no_cd

title TacticalPtx Web
echo.
echo === TacticalPtx Web ===
echo Carpeta: %CD%
echo URL: https://127.0.0.1:5173  - NO uses http:// TLS LAN
echo Reinicio automatico si Vite se cae. Cierra esta ventana para detener.
echo.

where.exe node.exe >nul 2>&1
if errorlevel 1 goto web_no_node
echo Node:
node.exe -v
echo.

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm.cmd install --no-fund --no-audit
  if errorlevel 1 goto web_npm_fail
)

set "N=0"
:web_loop
set /a N+=1
curl.exe -sk --connect-timeout 2 --max-time 5 "https://127.0.0.1:5173/" >nul 2>&1
if not errorlevel 1 (
  echo [%DATE% %TIME%] Web ya responde en https://127.0.0.1:5173 - esperando 20 s
  ping -n 21 127.0.0.1 >nul
  goto web_loop
)
echo.
echo [%DATE% %TIME%] Arranque Vite #%N%
REM Production/edge: solo loopback (Caddy). Dev LAN directo: set TPX_LISTEN_ALL=1
if /I "%TPX_LISTEN_ALL%"=="1" (
  echo Host: 0.0.0.0:5173 ^(TPX_LISTEN_ALL^)
  call npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
) else (
  echo Host: 127.0.0.1:5173 ^(loopback; acceso publico via Caddy :443^)
  call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
)
set "EC=%ERRORLEVEL%"
echo.
echo [%DATE% %TIME%] Vite se detuvo codigo %EC%. Reinicio en 3 s...
ping -n 4 127.0.0.1 >nul
goto web_loop

:web_no_dir
echo ERROR: no se encontro frontend\package.json en C:\pulsanet, D:\pulsanet ni infra\..\frontend
echo Produccion y DEV usan frontend\ (prod :5173, worktree C:\pulsanet-dev :5273).
pause
exit /b 1

:web_no_cd
echo ERROR: no se pudo entrar a %WEB_DIR%
pause
exit /b 1

:web_no_node
echo ERROR: node.exe no encontrado
pause
exit /b 1

:web_npm_fail
echo ERROR: npm install fallo
pause
exit /b 1
