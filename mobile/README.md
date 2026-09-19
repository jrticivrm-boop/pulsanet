# TacticalPtx â€” App mÃ³vil Flutter

## Estado (v1.8.117+127)

- **Android:** login, grupos, PTT (LiveKit + E2EE), presencia, chat/DM, GPS, pÃ¡nico, llamadas 1:1 / video, cÃ¡mara remota, FCM, OTA APK in-app
- **applicationId / iOS bundle:** `com.tacticalptx.app`
- **iOS:** mismo cÃ³digo Dart; proyecto `ios/` listo. **Build IPA solo en Mac** â€” `scripts/build-ios.sh`
- **Nota versiones:** el techo en Soporte era `1.8.116+126`; git/`pubspec` se habÃ­a quedado en `1.8.84+94` (bumps 95â€“126 no commitados). Esta lÃ­nea retoma en **+127**.

## Requisitos

1. Flutter SDK
2. **JDK 17** (no JBR Java 25 de Android Studio)
3. Android SDK
4. Backend + Redis + LiveKit
5. **`android/app/google-services.json`** (Firebase) â€” estÃ¡ gitignored; usar la copia local de desarrollo o `google-services.json.example` + consola Firebase para un equipo nuevo

## Configurar API

Por defecto la app apunta a `https://pulsanet.duckdns.org` (`lib/config.dart`).

```powershell
# Emulador (HTTP LAN; cleartext permitido solo a 10.0.2.2 / localhost)
flutter run --dart-define=API_BASE=http://10.0.2.2:4000

# TelÃ©fono (HTTPS LAN)
flutter run --dart-define=API_BASE=https://192.168.1.77:4000

# ProducciÃ³n
flutter run --dart-define=API_BASE=https://pulsanet.duckdns.org
```

`LIVEKIT_PUBLIC_HOST` en el backend debe ser alcanzable desde el telÃ©fono (WSS).

Cleartext (HTTP/ws) solo en hosts de `network_security_config.xml` (emulador / 192.168.1.77). ProducciÃ³n = HTTPS.

## Build APK

```bat
# Script del repo (ajusta API_BASE / secret OTA segÃºn entorno)
mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

Publicar OTA: `mobile\scripts\PUBLISH-APK-UPDATE.cmd` â†’ manifiesto en `backend\app-updates\` y copia a `C:\pulsanet_soporte\APK\`.

## Actualizaciones

1. **En la app:** `GET /api/app/android` + descarga/instalaciÃ³n APK (`app_update.dart` + FileProvider).
2. **Shorebird (opcional):** parches Dart â€” ver docs Shorebird del repo.

## Nativo Android (MethodChannels)

`MainActivity.kt` implementa:

| Channel | MÃ©todos |
|---------|---------|
| `â€¦/installer` | `installApk` |
| `â€¦/notifications` | cancel*, `getRingerMode`, ringtone/ringback, `bringToFrontForCall` |
| `â€¦/audio` | `getMode`, `ensureNormalMode` |

FGS: `mediaPlayback|location|camera|microphone` (radio + Â«Ver cÃ¡maraÂ»).

## Cuentas demo

`op1@tacticalptx.local` â€¦ `op4` / `demo1234` (si el seed estÃ¡ activo).
