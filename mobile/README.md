# TacticalPtx — App móvil Flutter

## Estado (v1.8.27+)

- **Android:** login, grupos, PTT (LiveKit), presencia, chat, GPS, pánico; actualización APK en app; Prep Play
- **applicationId / iOS bundle:** `com.tacticalptx.app`
- **iOS:** mismo código Dart; proyecto `ios/` listo (Podfile, permisos, iconos, entitlements). **Build IPA solo en Mac** — guía: [Soporte/Documentos/APP_IOS.md](../Soporte/Documentos/APP_IOS.md) / `scripts/build-ios.sh`

## Requisitos

1. Flutter SDK (`C:\tools\flutter`)
2. **JDK 17** (no el JBR Java 25 de Android Studio)
3. Android SDK en **`D:\Android\Sdk`**
4. Backend + Redis + LiveKit

## Configurar API

```powershell
# Emulador
flutter run --dart-define=API_BASE=http://10.0.2.2:4000

# Teléfono (HTTPS LAN del PC)
flutter run --dart-define=API_BASE=https://192.168.1.66:4000

# 4G / IP pública (piloto actual)
flutter run --dart-define=API_BASE=https://189.175.38.29:4000
```

`LIVEKIT_PUBLIC_HOST` en el backend debe coincidir con el host alcanzable (hoy `189.175.38.29`).

## Build APK (WhatsApp / 4G)

```bat
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

Por defecto: `API_BASE=https://189.175.38.29:4000`, versión **1.8.5+14**.  
Copia a `Soporte\APK\` y publica manifiesto OTA en `backend\app-updates\`.

```bat
:: Solo LAN
set FORCE_LAN=1
D:\pulsanet\mobile\scripts\BUILD-APK-WHATSAPP.cmd
```

## Actualizaciones

1. **En la app (recomendado, sin Play Store):** al abrir muestra «Cargando configuración…», consulta `GET /api/app/android` y descarga/instala la APK si hay `versionCode` mayor.
   - Publicar: `scripts\PUBLISH-APK-UPDATE.cmd`
   - Guía: [Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md](../Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md)
2. **Shorebird (parches Dart, opcional):** solo builds Shorebird — [docs/SHOREBIRD_WHATSAPP.md](../docs/SHOREBIRD_WHATSAPP.md).

## Release / Play Store

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
powershell -File android\create-keystore.ps1 # una vez; respaldar .jks
flutter build appbundle --release --dart-define=API_BASE=https://189.175.38.29:4000
```

Ver [docs/PRODUCCION_MES6.md](../docs/PRODUCCION_MES6.md).

Cuentas demo: `op1@tacticalptx.local` … `op4` / `demo1234`
