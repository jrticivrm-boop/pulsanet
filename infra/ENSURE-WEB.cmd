@echo off
REM Asegura Web Vite :5173 (HTTPS). Si esta caida, abre ventana persistente + watchdog.
setlocal EnableExtensions
chcp 65001 >nul
set "ROOT="
if exist "C:\pulsanet\infra\Watch-Stack.ps1" set "ROOT=C:\pulsanet"
if not defined ROOT if exist "D:\pulsanet\infra\Watch-Stack.ps1" set "ROOT=D:\pulsanet"
if not defined ROOT set "ROOT=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\infra\Watch-Stack.ps1" -Once
REM Dejar watchdog en segundo plano (minimizado) si no hay uno
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m=[System.Threading.Mutex]::new($false,'Global\TacticalPtxWatchStack'); if(-not $m.WaitOne(0)){ exit 0 }; $m.ReleaseMutex(); $m.Dispose(); Start-Process powershell.exe -WindowStyle Minimized -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%ROOT%\infra\Watch-Stack.ps1'"
echo.
echo Web: https://127.0.0.1:5173
echo (Usa HTTPS; http:// rechaza conexion con certs LAN)
endlocal
