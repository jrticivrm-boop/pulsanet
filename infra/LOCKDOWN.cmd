@echo off
:: Lockdown host TacticalPtx (firewall + UPnP + detener servicios)
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0LOCKDOWN.ps1" -Reason "manual_cmd"
echo.
pause
endlocal
