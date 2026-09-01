@echo off
:: Wrapper estable (evita roturas de parentesis/pipe en .cmd)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-ApkUpdate.ps1"
if errorlevel 1 exit /b 1
