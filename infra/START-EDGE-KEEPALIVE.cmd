@echo off
REM Keepalive borde (UPnP/DuckDNS) en segundo plano — no reinicia API/Web.
REM Opcional admin: Register-EdgeKeepalive.ps1 (tarea programada).
setlocal
set "ROOT=C:\pulsanet"
if not exist "%ROOT%\infra\EdgeKeepaliveLoop.ps1" set "ROOT=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%ROOT%\infra\EdgeKeepaliveLoop.ps1" -EveryMinutes 20
echo Keepalive edge iniciado (minimizado). Log: pulsanet_soporte\Logs\edge-keepalive.log
endlocal
