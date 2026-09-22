# Instalar TacticalPtx en el telÃ©fono (misma Wiâ€‘Fi)

No hace falta `flutter run` cada vez. El **APK** es la app instalable.

## CÃ³mo funciona

| Pieza | Rol |
|-------|-----|
| Cable USB / archivo APK | Solo para **instalar** la app |
| Wiâ€‘Fi (misma red que el PC) | Login, chat, PTT, GPS, audio |

El APK se compilÃ³ con `API_BASE=http://192.168.1.77:4000` (IP de este PC). Si cambia la IP del PC, hay que generar otro APK o usar `run-usb.ps1`.

## Antes de abrir la app

En el PC deben estar corriendo:

1. Redis + LiveKit (`infra/start-services.ps1`)
2. API: `cd D:\pulsanet\backend` â†’ `npm run dev`
3. Firewall: TCP **4000** y **7880** (ya se abrieron antes)

TelÃ©fono y PC en la **misma Wiâ€‘Fi**.

## Instalar el APK

Archivo:

`D:\Soporte\APK\TacticalPtx-LAN.apk`

### OpciÃ³n A â€” USB (rÃ¡pido)

```powershell
adb install -r "D:\Soporte\APK\TacticalPtx-LAN.apk"
```

### OpciÃ³n B â€” sin cable de depuraciÃ³n

1. Copia el `.apk` al telÃ©fono (USB almacenamiento, Drive, WhatsApp a ti mismoâ€¦).
2. En el telÃ©fono: permitir **instalar apps de orÃ­genes desconocidos** para ese gestor de archivos.
3. Abre el APK e instala.

## Cuentas demo

`op1@tacticalptx.local` â€¦ `op4` / `demo1234`

## Si no conecta

- Â¿Misma Wiâ€‘Fi? (no datos mÃ³viles)
- Â¿API arriba? Prueba en el PC: http://192.168.1.77:4000/api/health
- Â¿IP del PC cambiÃ³? Regenera APK o usa `powershell -File D:\pulsanet\mobile\run-usb.ps1`
