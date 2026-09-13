@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title TacticalPtx DEV - worktree (puertos 4100 / 5273 / 7980)

REM =============================================================================
REM Stack DESARROLLO. No levanta Caddy / DuckDNS / OTA. No toca :4000/:5173/:7880.
REM UI de este worktree: frontend\  (NO uses web\ de C:\pulsanet)
REM Uso: LEVANTAR-DEV.bat
REM      LEVANTAR-DEV.bat /nopause
REM =============================================================================

set "NO_PAUSE="
if /I "%~1"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="-nopause" set "NO_PAUSE=1"

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\backend\package.json" (
  if exist "C:\pulsanet-dev\backend\package.json" set "ROOT=C:\pulsanet-dev"
)

if not exist "%ROOT%\backend\package.json" (
  echo ERROR: no se encontro C:\pulsanet-dev ni backend\package.json junto a este .bat
  if not defined NO_PAUSE pause
  exit /b 1
)

set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;%SystemRoot%\System32;%PATH%"

echo.
echo === TacticalPtx DESARROLLO ===
echo Root: %ROOT%
echo UI:   frontend\  ^(Vite :5273^)
echo API:  backend\   ^(:4100^)
echo LiveKit :7980   Redis DB1   BD tacticalptx_dev
echo NO se toca produccion C:\pulsanet  ^(:4000 / :5173 / :7880 / DuckDNS^)
echo.

where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta en PATH.
  if not defined NO_PAUSE pause
  exit /b 1
)
echo Node:
node.exe -v
echo.

if not exist "%ROOT%\backend\.env" (
  echo Falta backend\.env de desarrollo.
  echo Ejecuta primero:
  echo   powershell -File C:\pulsanet\infra\dev\Initialize-DevWorktree.ps1
  if not defined NO_PAUSE pause
  exit /b 1
)

if exist "%ROOT%\CREAR-O-ACTUALIZAR-BD.bat" (
  echo --- Base de datos DEV ^(idempotente, no borra datos^) ---
  call "%ROOT%\CREAR-O-ACTUALIZAR-BD.bat" /nopause
  echo.
)

set "STACK_PS=%ROOT%\infra\dev\Start-DevStack.ps1"
if exist "C:\pulsanet\infra\dev\Start-DevStack.ps1" set "STACK_PS=C:\pulsanet\infra\dev\Start-DevStack.ps1"
if not exist "%STACK_PS%" (
  echo ERROR: falta infra\dev\Start-DevStack.ps1
  if not defined NO_PAUSE pause
  exit /b 1
)

echo Script: %STACK_PS%
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%STACK_PS%" -RepoRoot "%ROOT%"
if errorlevel 1 (
  echo.
  echo ERROR: Start-DevStack fallo. Revisa mensajes arriba.
  if not defined NO_PAUSE pause
  exit /b 1
)

echo.
echo URLs DEV:
echo   Consola:  http://127.0.0.1:5273   ^(o https si hay certs^)
echo   API:      http://127.0.0.1:4100/api/health
echo   LiveKit:  ws://127.0.0.1:7980
echo.
echo Deja las ventanas API/Web DEV abiertas. Produccion sigue en C:\pulsanet.
if not defined NO_PAUSE pause
endlocal & exit /b 0
