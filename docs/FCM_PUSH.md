# TacticalPtx — Push FCM

## Qué hace

- Al enviar **chat** (texto/media), **DM**, **llamada privada** o al tomar el **PTT**, el backend notifica vía FCM.
- La app Android usa canales `tacticalptx_alerts_nokia` (mensajes, tono SMS Nokia/Morse) / `tacticalptx_calls`, muestra pushes en primer plano y re-registra el token si Firebase lo rota.
- Sin credenciales Firebase, la API sigue (`fcm: "off"`); no envía pushes.

## Estado actual (2026-08-13)

- Proyecto Firebase: **`tacticalptx`**
- Paquete Android: **`com.tacticalptx.app`**
- API: `"fcm":"configured"` con `FIREBASE_SERVICE_ACCOUNT`

## Checklist

1. [x] Proyecto Firebase + app Android `com.tacticalptx.app`
2. [x] `google-services.json` → `mobile/android/app/`
3. [x] Service account → `D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json`
4. [x] `FIREBASE_SERVICE_ACCOUNT=...` en `backend/.env`
5. [x] Reiniciar API → health `"fcm":"configured"`
6. [ ] Rebuild/instalar APK, login, conceder notificaciones
7. [ ] `POST /api/devices/test` con JWT → push al teléfono

## Backend

```env
FIREBASE_SERVICE_ACCOUNT=D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json
```

**No** subas el JSON a Git.

## App Android

```
D:\pulsanet\mobile\android\app\google-services.json
```

Tras login, el token se registra solo. Comprobar:

```sql
SELECT user_id, platform, left(fcm_token,20), is_active FROM devices;
```

## Probar

```http
POST /api/devices/test
Authorization: Bearer <token>
{ "title": "Prueba", "body": "Hola desde TacticalPtx" }
```

O: dos usuarios en el mismo grupo; chat/PTT con el teléfono en background.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/devices` | Registrar token |
| DELETE | `/api/devices` | Desactivar (logout) |
| GET | `/api/devices/me` | Mis dispositivos + si FCM está on |
| POST | `/api/devices/test` | Push de prueba a mis tokens |

## Límites

- iOS: hace falta `GoogleService-Info.plist` + APNs en Firebase
- Web push: no cableado (usa Notification API local vía socket)
