# Shorebird sin PowerShell

> **2026-08-17:** scripts `DIAGNOSTICO.cmd` / `INSTALAR-SHOREBIRD.cmd` eliminados. APK: `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.

Si PowerShell no abre o se cuelga, usa **solo CMD**.

## 1) Diagnóstico

Doble clic:

`D:\pulsanet\mobile\scripts\DIAGNOSTICO.cmd`

Genera: `D:\pulsanet\mobile\scripts\diagnostico.txt`  
(Si puedes, mándanos ese archivo.)

## 2) Instalar Shorebird

Doble clic:

`D:\pulsanet\mobile\scripts\INSTALAR-SHOREBIRD.cmd`

Requisito: **Git for Windows**. Si no lo tienes: https://git-scm.com/download/win

## 3) Después (ventana cmd NUEVA)

Pulsa `Windows + R`, escribe `cmd`, Enter:

```bat
shorebird login
cd /d D:\pulsanet\mobile
shorebird init
shorebird release android --artifact apk -- --dart-define=API_BASE=http://192.168.1.66:4000
```

APK → WhatsApp:

`D:\pulsanet\mobile\build\app\outputs\flutter-apk\app-release.apk`

## Parche OTA (más adelante)

```bat
cd /d D:\pulsanet\mobile
shorebird patch android -- --dart-define=API_BASE=http://192.168.1.66:4000
```

## Si PowerShell vuelve a funcionar

Puedes usar los scripts `.ps1`, pero **no son necesarios**.
