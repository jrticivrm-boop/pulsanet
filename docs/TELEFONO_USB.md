# CÃ³mo correr TacticalPtx en el telÃ©fono (USB)

## QuÃ© significa

El **telÃ©fono no es el servidor**. El servidor (API + Redis + LiveKit) corre en **tu PC**.

El cable USB solo sirve para **instalar y depurar** la app Flutter en el Android.

`--dart-define=API_BASE=http://192.168.1.77:4000` le dice a la app:

> â€œHabla con la API en la IP Wiâ€‘Fi de mi PC, puerto 4000â€

`192.168.1.77` es la IP de **esta** PC en la Wiâ€‘Fi (puede cambiar si el router la renueva).

```mermaid
flowchart LR
 Phone[Telefono_Android] -->|WiFi_HTTP| API[PC_API_4000]
 Phone -->|WiFi_WebSocket_audio| LK[PC_LiveKit_7880]
 USB[Cable_USB] -.->|solo_instalar_app| Phone
```

## Pasos

1. PC: Redis + LiveKit + `cd backend && npm run dev`
2. TelÃ©fono y PC en **la misma Wiâ€‘Fi**
3. TelÃ©fono: Opciones de desarrollador â†’ **DepuraciÃ³n USB** ON 
4. Conecta USB y acepta â€œÂ¿Permitir depuraciÃ³n?â€
5. En el PC:

```powershell
powershell -File D:\pulsanet\mobile\run-usb.ps1
```

El script detecta la IP actual y lanza `flutter run`.

Firewall: ya se abrieron TCP **4000**, **7880**, **7881** en esta mÃ¡quina.

## Si no hay telÃ©fono

`adb devices` vacÃ­o = no se puede hacer `flutter run` hasta que conectes uno.
