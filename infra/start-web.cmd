@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d D:\pulsanet\web
title TacticalPtx Web
echo Web en http://127.0.0.1:5173
call npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
echo.
echo La web se detuvo. Revisa el error de arriba.
pause
