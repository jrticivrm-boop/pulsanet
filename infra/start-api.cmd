@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PATH=C:\Program Files\nodejs;%SystemRoot%\System32;%PATH%"

REM Resolver carpeta backend: C:\pulsanet, D:\pulsanet o relativa a infra
set "API_DIR="
if exist "C:\pulsanet\backend\package.json" set "API_DIR=C:\pulsanet\backend"
if not defined API_DIR if exist "D:\pulsanet\backend\package.json" set "API_DIR=D:\pulsanet\backend"
if not defined API_DIR if exist "%~dp0..\backend\package.json" set "API_DIR=%~dp0..\backend"
if not defined API_DIR goto api_no_dir
cd /d "%API_DIR%"
if errorlevel 1 goto api_no_cd

title TacticalPtx API
echo.
echo === TacticalPtx API ===
echo Carpeta: %CD%
echo Health: https://127.0.0.1:4000/api/health
echo Reinicio automatico si la API se cae. Cierra esta ventana para detener.
echo.

where.exe node.exe >nul 2>&1
if errorlevel 1 goto api_no_node
echo Node:
node.exe -v
echo.

if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm.cmd install --no-fund --no-audit
  if errorlevel 1 goto api_npm_fail
)

if not exist ".env" (
  if exist ".env.example" (
    echo AVISO: no hay .env - copia .env.example a .env
  ) else (
    echo AVISO: falta backend\.env
  )
)

set "N=0"
:api_loop
set /a N+=1
REM Si la API ya responde, no reiniciar npm
curl.exe -sk --connect-timeout 2 --max-time 8 "https://127.0.0.1:4000/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
  echo [%DATE% %TIME%] API ya responde - esperando 20 s
  ping -n 21 127.0.0.1 >nul
  goto api_loop
)
curl.exe -s --connect-timeout 2 --max-time 8 "http://127.0.0.1:4000/api/health" 2>nul | findstr /I "tacticalptx-api" >nul
if not errorlevel 1 (
  echo [%DATE% %TIME%] API ya responde http - esperando 20 s
  ping -n 21 127.0.0.1 >nul
  goto api_loop
)
echo.
echo [%DATE% %TIME%] Arranque API #%N%
call npm.cmd run dev
set "EC=%ERRORLEVEL%"
echo.
echo [%DATE% %TIME%] API se detuvo codigo %EC%. Reinicio en 3 s...
ping -n 4 127.0.0.1 >nul
goto api_loop

:api_no_dir
echo ERROR: no se encontro backend en C:\pulsanet, D:\pulsanet ni infra\..\backend
pause
exit /b 1

:api_no_cd
echo ERROR: no se pudo entrar a %API_DIR%
pause
exit /b 1

:api_no_node
echo ERROR: node.exe no encontrado
pause
exit /b 1

:api_npm_fail
echo ERROR: npm install fallo
pause
exit /b 1
