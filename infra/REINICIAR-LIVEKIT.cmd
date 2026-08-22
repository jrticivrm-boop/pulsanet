@echo off
:: Reinicia LiveKit con ICE dual (Wi-Fi + Tailscale). Ejecutar como Administrador si falla.
setlocal
title TacticalPtx - Reiniciar LiveKit
cd /d D:\pulsanet
echo Reiniciando LiveKit...
taskkill /F /IM livekit-server.exe >nul 2>&1
ping -n 2 127.0.0.1 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\pulsanet\infra\start-services.ps1"
echo.
pause
endlocal
