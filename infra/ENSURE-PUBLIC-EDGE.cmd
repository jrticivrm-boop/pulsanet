@echo off
setlocal EnableExtensions
chcp 65001 >nul
REM Wrapper seguro para el borde publico (no rompe LEVANTAR-TACTICALPTX.bat)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ENSURE-PUBLIC-EDGE.ps1"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo AVISO: borde publico HTTPS no confirmado ^(codigo %EC%^)
  echo        Si falta infra\caddy\caddy.exe, START-PUBLIC-EDGE lo descarga solo.
)
exit /b %EC%
