@echo off
setlocal EnableExtensions
chcp 65001 >nul
REM Wrapper seguro para el borde publico (no rompe LEVANTAR-TACTICALPTX.bat)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ENSURE-PUBLIC-EDGE.ps1"
if errorlevel 1 (
  echo AVISO: borde publico HTTPS no confirmado - revisa infra\START-PUBLIC-EDGE.ps1
)
exit /b 0
