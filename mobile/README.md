# PulsaNet — App móvil Flutter

## Estado (v1.0)

- **Android:** login, grupos, PTT (LiveKit), presencia, chat; prep Play (AAB firmado)
- **iOS:** mismo código; build requiere Mac + Apple Developer

## Requisitos

1. Flutter SDK (`C:\tools\flutter`)
2. **JDK 17** (no el JBR Java 25 de Android Studio)
3. Android SDK en **`D:\Android\Sdk`**
4. Backend + Redis + LiveKit

## Configurar API

```powershell
# Emulador
flutter run --dart-define=API_BASE=http://10.0.2.2:4000

# Teléfono (IP LAN del PC)
flutter run --dart-define=API_BASE=http://192.168.1.66:4000
```

## Actualizaciones sin reinstalar (Shorebird + WhatsApp)

1. Una vez: generar APK con Shorebird y enviarla por WhatsApp.  
2. Luego: `scripts\shorebird-patch.ps1` → el móvil toma el parche al reabrir.

Guía: [docs/SHOREBIRD_WHATSAPP.md](../docs/SHOREBIRD_WHATSAPP.md)

```powershell
# Primera vez (cuenta Shorebird + init)
shorebird login
shorebird init

# APK para WhatsApp
powershell -File scripts\shorebird-release-whatsapp.ps1

# Parche OTA
powershell -File scripts\shorebird-patch.ps1
```

## Release / Play Store

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
powershell -File android\create-keystore.ps1   # una vez; respaldar .jks
flutter build appbundle --release --dart-define=API_BASE=https://TU-API
```

Ver [docs/PRODUCCION_MES6.md](../docs/PRODUCCION_MES6.md).

Cuentas demo: `op1@pulsanet.local` … `op4` / `demo1234`
