@echo off
taskkill /F /IM caddy.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start "TacticalPtx Caddy" /MIN cmd /c "C:\pulsanet\infra\caddy\run-edge.cmd"
