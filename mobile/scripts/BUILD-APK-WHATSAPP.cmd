@echo off
:: DEPRECATED: no publicar OTA desde aqui (version/IP hardcodeados = riesgo de regresion).
:: Usa siempre: mobile\scripts\PUBLISH-APK-UPDATE.cmd  (lee pubspec + PUBLIC_DOMAIN)
chcp 65001 >nul
title TacticalPtx - Redirige a Publish-ApkUpdate
echo.
echo Este script quedo obsoleto (hardcodeaba 1.8.7+16 e IP vieja).
echo Redirigiendo a Publish-ApkUpdate.ps1 ...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-ApkUpdate.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
pause
