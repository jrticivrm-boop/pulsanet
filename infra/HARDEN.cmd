@echo off
:: Endurecimiento TacticalPtx (Admin UAC)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0HARDEN.ps1"
pause
