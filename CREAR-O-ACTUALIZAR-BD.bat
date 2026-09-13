@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title TacticalPtx - Crear o actualizar base de datos

REM =============================================================================
REM Idempotente: si la BD existe NO la borra; si faltan tablas/columnas las añade.
REM Nunca DROP. Reutiliza backend\src\scripts\apply-*.js + database\migrations\*.sql
REM Uso: CREAR-O-ACTUALIZAR-BD.bat
REM      CREAR-O-ACTUALIZAR-BD.bat /nopause
REM =============================================================================

set "NO_PAUSE="
if /I "%~1"=="/nopause" set "NO_PAUSE=1"
if /I "%~1"=="-nopause" set "NO_PAUSE=1"

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\backend\package.json" (
  echo ERROR: no parece un repo TacticalPtx - falta backend\package.json
  if not defined NO_PAUSE pause
  exit /b 1
)

set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;%SystemRoot%\System32;%PATH%"

echo.
echo === TacticalPtx: crear o actualizar PostgreSQL ===
echo Root: %ROOT%
echo Lee DATABASE_URL de backend\.env  (no se muestra la contraseña)
echo.

where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta en PATH. Instala LTS ^(C:\Program Files\nodejs^)
  if not defined NO_PAUSE pause
  exit /b 1
)
echo Node: 
node.exe -v

if not exist "%ROOT%\backend\.env" (
  echo AVISO: falta backend\.env - copia backend\.env.example a backend\.env
  echo        El nombre de BD por defecto en el ejemplo es tacticalptx_db
)

if not exist "%ROOT%\backend\node_modules\" (
  echo Instalando dependencias API ^(npm install^)...
  pushd "%ROOT%\backend"
  call npm.cmd install --no-fund --no-audit
  if errorlevel 1 (
    echo ERROR: npm install en backend fallo
    popd
    if not defined NO_PAUSE pause
    exit /b 1
  )
  popd
)

echo.
node.exe "%ROOT%\backend\src\scripts\apply-all-migrations.js"
set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo FALLO al aplicar la base de datos. Codigo %EC%
  if not defined NO_PAUSE pause
  exit /b %EC%
)
echo Listo. La API puede usar esta base.
if not defined NO_PAUSE pause
endlocal & exit /b 0
