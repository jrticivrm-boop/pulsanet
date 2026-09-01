# TacticalPtx — Build iOS en Mac (Tahoe / actual)

**Producto:** TacticalPtx · Bundle: `com.tacticalptx.app`  
**PC Windows (código):** `C:\pulsanet`  
**En la Mac:** copia/clona el repo → carpeta `mobile/`

**macOS objetivo:** Tahoe **26.x** (p. ej. 26.6.2) — sustituye la guía Monterey.

Con Tahoe puedes usar **Xcode actual** (App Store), depurar iPhones recientes y generar IPA / TestFlight **en local** (Codemagic queda como respaldo CI).

---

## 0. Tras terminar la actualización

1. Reinicio completo y login.  
2. Comprobar versión:

```bash
sw_vers
# ProductVersion debería ser 26.x (Tahoe)
```

3. Si algo falló a mitad (pantalla negra, loops): modo recuperación / volver a intentar update. No instales Xcode hasta que el sistema esté estable.

---

## 1. Instalar herramientas (orden)

### 1.1 Xcode (App Store)

1. Abre **App Store** → busca **Xcode** → Instalar (última estable).  
2. Abrir Xcode una vez → aceptar licencia → dejar que instale componentes.  
3. Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version
xcodebuild -downloadPlatform iOS
```

### 1.2 Homebrew (recomendado)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Sigue las instrucciones de PATH que imprime el instalador (Apple Silicon vs Intel)
```

### 1.3 Flutter + CocoaPods

```bash
brew install flutter cocoapods
# o Flutter por git:
# git clone https://github.com/flutter/flutter.git -b stable ~/flutter
# export PATH="$HOME/flutter/bin:$PATH"

flutter doctor
flutter doctor -v
```

Corrige lo que marque en rojo (Xcode, CocoaPods, firma, etc.).

### 1.4 Apple Developer

Xcode → Settings → Accounts → Apple ID con membresía **Developer Program**.  
Bundle a firmar: `com.tacticalptx.app`.

---

## 2. Proyecto en la Mac

Desde Windows (`C:\pulsanet`): USB, red compartida o **Git**.

```bash
cd ~/pulsanet/mobile   # ajusta la ruta
flutter pub get
cd ios && pod install --repo-update && cd ..
open ios/Runner.xcworkspace
```

En Xcode: **Signing & Capabilities** → Team + bundle `com.tacticalptx.app`.

---

## 3. Firebase iOS (push)

1. Firebase → Add app iOS → `com.tacticalptx.app`.  
2. Archivo en:

```text
mobile/ios/Runner/GoogleService-Info.plist
```

3. APNs (.p8) en Firebase Cloud Messaging.  
Plantilla: `GoogleService-Info.plist.example` (no subir el real a git).

---

## 4. Probar y empaquetar

**Simulador / dispositivo:**

```bash
flutter devices
flutter run --dart-define=API_BASE=https://189.152.200.238.sslip.io
```

**IPA release:**

```bash
chmod +x scripts/build-ios.sh
API_BASE=https://189.152.200.238.sslip.io ./scripts/build-ios.sh
```

Salida: `mobile/build/ios/ipa/*.ipa` → Xcode Organizer → TestFlight / Ad Hoc.

---

## 5. Checklist post-Tahoe

```bash
sw_vers
xcodebuild -version
flutter --version
flutter doctor -v
pod --version
ls ios/Runner/GoogleService-Info.plist
```

| Listo | Item |
|-------|------|
| ☐ | macOS 26.x estable |
| ☐ | Xcode App Store + licencia |
| ☐ | `flutter doctor` en verde (o solo avisos menores) |
| ☐ | Apple Team en Signing |
| ☐ | `GoogleService-Info.plist` |
| ☐ | `flutter run` en simulador o iPhone |
| ☐ | (Opcional) IPA + TestFlight |

---

## 6. Codemagic

Sigue siendo útil para builds CI desde Windows. Checklist: [IOS_TESTFLIGHT_CHECKLIST.md](IOS_TESTFLIGHT_CHECKLIST.md).  
Con Tahoe **ya no es obligatorio** para un primer IPA local.

---

## Referencias

- Script: `mobile/scripts/build-ios.sh`  
- Histórico Monterey: [IOS_BUILD_MAC_MONTEREY.md](IOS_BUILD_MAC_MONTEREY.md)  
- Bundle: `com.tacticalptx.app`

*Actualizado: 2026-08-31 — macOS Tahoe 26.x*
