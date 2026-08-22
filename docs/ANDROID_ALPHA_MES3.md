# PulsaNet — Android alpha (Mes 3)

App Flutter en [`mobile/`](../mobile/). Proyecto en **`D:\pulsanet`**.

## Incluido

- Login JWT + sesión local
- Lista de grupos
- Canal: botón PTT, presencia online, chat
- LiveKit audio + Socket.IO floor/presencia

## Entorno

| Pieza | Ruta |
|-------|------|
| Proyecto | `D:\pulsanet` |
| Android SDK | `D:\Android\Sdk` |
| AVD | `pulsanet_api35` |
| Flutter | `C:\tools\flutter` |

## Instalar en un móvil Android (recomendado)

1. Teléfono y PC en la **misma Wi‑Fi**.
2. En el móvil: **Ajustes → Opciones de desarrollador → Depuración USB** (activar).
3. Cable USB → acepta “Permitir depuración USB”.
4. API + Redis + LiveKit corriendo en el PC (`infra/start-services.ps1` + `backend npm run dev`).
5. Firewall: permitir **TCP 4000** y **7880**.

```powershell
cd D:\pulsanet\mobile
adb devices
# debe aparecer tu móvil como "device"

# Usa la IP LAN de tu PC (ejemplo actual Wi‑Fi):
flutter run --dart-define=API_BASE=http://192.168.1.66:4000
```

Login demo: `op1@pulsanet.local` / `demo1234`

### Solo APK (sin `flutter run`)

```powershell
cd D:\pulsanet\mobile
flutter build apk --debug --dart-define=API_BASE=http://192.168.1.66:4000
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

Si cambia la IP del PC, hay que recompilar.

## Emulador

```powershell
flutter emulators --launch pulsanet_api35
flutter run --dart-define=API_BASE=http://10.0.2.2:4000
```
