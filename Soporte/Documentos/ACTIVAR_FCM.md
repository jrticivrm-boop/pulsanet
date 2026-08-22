# Activar FCM — checklist (PulsaNet)

Fecha: 2026-08-11

## Por qué hace falta tu cuenta Firebase

El código ya envía pushes (chat + PTT) y la app registra tokens.
Sin proyecto Firebase real, health sigue en `"fcm":"off"`.

## Pasos (15–20 min)

### A. Firebase Console

1. Entra a https://console.firebase.google.com y crea/abre un proyecto.
2. Añade app **Android** con package: `com.pulsanet.pulsanet_mobile`
3. Descarga `google-services.json`
4. Project settings → Service accounts → **Generate new private key** (JSON admin)

### B. Archivos en este PC

| Archivo | Destino |
|---------|---------|
| `google-services.json` | `D:\pulsanet\mobile\android\app\google-services.json` |
| Service account JSON | `D:\PulsaNet_Soporte\Secrets\pulsanet-firebase-adminsdk.json` (crea carpeta Secrets) |

### C. backend/.env

```env
FIREBASE_SERVICE_ACCOUNT=D:\PulsaNet_Soporte\Secrets\pulsanet-firebase-adminsdk.json
```

Reinicia API (`npm run dev` en backend).

Comprueba: http://127.0.0.1:4000/api/health → `"fcm":"configured"`

### D. Reinstalar app

```powershell
cd D:\pulsanet\mobile
flutter pub get
# USB:
powershell -File D:\pulsanet\mobile\run-usb.ps1
# o rebuild APK LAN
```

Al abrir la app: aceptar notificaciones + login.

### E. Probar push

Con JWT del móvil (o login admin y token del op):

```
POST http://127.0.0.1:4000/api/devices/test
Authorization: Bearer … 
Content-Type: application/json

{ "title": "PulsaNet", "body": "Prueba OK" }
```

Doc completa: `D:\pulsanet\docs\FCM_PUSH.md`
