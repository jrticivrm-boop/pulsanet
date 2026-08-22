@echo off
:: Abre PowerShell como Admin para firewall + IP pública
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"D:\pulsanet\infra\EXPOSE-PUBLIC.ps1\"'"
