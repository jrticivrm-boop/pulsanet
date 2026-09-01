@echo off
:: Refuerza firewall Windows canonico TacticalPtx-* (API, Web, LiveKit)
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Ensure-Firewall.ps1"
set "EC=%ERRORLEVEL%"
echo.
pause
exit /b %EC%
