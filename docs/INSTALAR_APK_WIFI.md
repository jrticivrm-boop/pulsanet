# Instalar TacticalPtx en el teléfono (misma Wi‑Fi)

No hace falta `flutter run` cada vez. El **APK** es la app instalable.

## Cómo funciona

| Pieza | Rol |
|-------|-----|
| Cable USB / archivo APK | Solo para **instalar** la app |
| Wi‑Fi (misma red que el PC) | Login, chat, PTT, GPS, audio |

El APK se compiló con `API_BASE=http://192.168.1.66:4000` (IP de este PC). Si cambia la IP del PC, hay que generar otro APK o usar `run-usb.ps1`.

## Antes de abrir la app

En el PC deben estar corriendo:

1. Redis + LiveKit (`infra/start-services.ps1`)
2. API: `cd D:\pulsanet\backend` → `npm run dev`
3. Firewall: TCP **4000** y **7880** (ya se abrieron antes)

Teléfono y PC en la **misma Wi‑Fi**.

## Instalar el APK

Archivo:

`D:\Soporte\APK\TacticalPtx-LAN.apk`

### Opción A — USB (rápido)

```powershell
adb install -r "D:\Soporte\APK\TacticalPtx-LAN.apk"
```

### Opción B — sin cable de depuración

1. Copia el `.apk` al teléfono (USB almacenamiento, Drive, WhatsApp a ti mismo…).
2. En el teléfono: permitir **instalar apps de orígenes desconocidos** para ese gestor de archivos.
3. Abre el APK e instala.

## Cuentas demo

`op1@tacticalptx.local` … `op4` / `demo1234`

## Si no conecta

- ¿Misma Wi‑Fi? (no datos móviles)
- ¿API arriba? Prueba en el PC: http://192.168.1.66:4000/api/health
- ¿IP del PC cambió? Regenera APK o usa `powershell -File D:\pulsanet\mobile\run-usb.ps1`
