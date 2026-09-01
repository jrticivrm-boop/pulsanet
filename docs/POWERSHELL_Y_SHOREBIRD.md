# PowerShell no funciona — qué hacer

> **2026-08-17:** `REPARAR-POWERSHELL.cmd` y `SHOREBIRD-WHATSAPP.cmd` se eliminaron. Para generar APK: `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.

## Hecho importante

En Windows, el comando `shorebird` **usa PowerShell por dentro** (`shorebird.bat` → `shorebird.ps1`). 
Si PowerShell está roto, **Shorebird OTA no puede correr** hasta repararlo.

## Paso A — Reparar PowerShell

Doble clic:

`D:\pulsanet\mobile\scripts\REPARAR-POWERSHELL.cmd`

- Prueba `powershell -NoProfile`
- Renombra el perfil si está colgando el inicio

Luego abre **cmd** y prueba:

```bat
powershell -NoProfile -Command "Write-Output OK"
```

Si imprime `OK`, ya puedes usar Shorebird:

`D:\pulsanet\mobile\scripts\SHOREBIRD-WHATSAPP.cmd`

## Paso B — Mientras tanto: APK por WhatsApp (sin OTA)

Doble clic:

`D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd`

Usa solo `flutter.bat` (sin PowerShell). 
Cada actualización = nueva APK por WhatsApp (no parche OTA).

## Shorebird ya está descargado

En tu PC existe:

`C:\Users\INFORMATICA\.shorebird\bin\shorebird.bat`

Solo falta que PowerShell arranque para poder hacer `login` / `release` / `patch`.
