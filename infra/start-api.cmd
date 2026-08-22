@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d D:\pulsanet\backend
title TacticalPtx API
echo API en http://127.0.0.1:4000
call npm.cmd run dev
echo.
echo La API se detuvo. Revisa el error de arriba.
pause
