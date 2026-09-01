@echo off
:: Firewall + UPnP (reenvio virtual) para 4G/5G sin Tailscale en el movil
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"\"%~dp0EXPOSE-UPNP.ps1\"\"\"'"
