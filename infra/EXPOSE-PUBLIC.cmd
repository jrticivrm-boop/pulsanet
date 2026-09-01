@echo off
:: Abre PowerShell como Admin para firewall + IP publica
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"\"%~dp0EXPOSE-PUBLIC.ps1\"\"\"'"
