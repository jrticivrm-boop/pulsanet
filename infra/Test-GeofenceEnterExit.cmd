@echo off
REM Lanza la prueba de geocerca y deja la ventana abierta.
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-GeofenceEnterExit.ps1" %*
