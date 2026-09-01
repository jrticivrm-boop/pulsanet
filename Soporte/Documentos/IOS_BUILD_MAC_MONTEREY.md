# TacticalPtx — Build iOS en Mac (Monterey 12.7.6)

**Producto:** TacticalPtx · Bundle: `com.tacticalptx.app`  
**PC Windows (código):** `C:\pulsanet`  
**En la Mac:** copia/clona el repo y trabaja en `mobile/`

---

## 1. Límite de Monterey (importante)

| | En Monterey 12.7.6 |
|--|--|
| **Xcode máximo** | **14.2** (Xcode 15+ requiere Ventura/Sonoma) |
| **SDK iOS** | hasta ~16.2 |
| **iPhone con iOS 17/18** | no se puede depurar bien con Xcode 14.2 |
| **Subir a TestFlight / App Store** | Apple exige toolchain reciente → **mejor Codemagic** o Mac con Ventura+ |

**Estrategia recomendada**

1. **Mac Monterey:** instalar dependencias, abrir proyecto, probar en **simulador iOS 16** (o iPhone ≤ iOS 16).  
2. **IPA de producción / TestFlight:** Codemagic (`codemagic.yaml`) o Mac con macOS más nuevo + Xcode 15+.

Si el Mac puede actualizarse a **Ventura 13** o **Sonoma 14**, hazlo: simplifica todo.

---

## 2. Qué instalar en la Mac

### 2.1 Xcode 14.2

1. [Apple Developer → Downloads](https://developer.apple.com/download/all/) (con Apple ID).  
2. Buscar **Xcode 14.2** e instalar en `/Applications`.  
3. Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version
```

### 2.2 Flutter (compatible)

En Monterey conviene un Flutter estable reciente y aceptar el aviso de “Xcode 15 recommended”, o fijar un canal/versión que compile con 14.2.

```bash
# Opción A — instalar Flutter estable
git clone https://github.com/flutter/flutter.git -b stable ~/flutter
export PATH="$HOME/flutter/bin:$PATH"
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.zshrc

flutter doctor
flutter doctor --android-licenses   # si aplica
```

Si `flutter doctor` exige Xcode 15 de forma bloqueante, usa **Codemagic** para el IPA y la Mac solo para abrir el proyecto / revisar.

### 2.3 CocoaPods

```bash
sudo gem install cocoapods
# o: brew install cocoapods
pod --version
```

### 2.4 Apple Developer + firma

1. Cuenta **Apple Developer** activa.  
2. En Xcode → Settings → Accounts → añadir Apple ID.  
3. Abrir `mobile/ios/Runner.xcworkspace` → Signing & Capabilities → Team + bundle `com.tacticalptx.app`.

---

## 3. Traer el proyecto a la Mac

Desde la PC Windows el código está en `C:\pulsanet`. Opciones:

- **USB / red:** copiar la carpeta `pulsanet` (o al menos `mobile/` + `codemagic.yaml`).  
- **Git:** ideal (push desde Windows → clone en Mac).

En la Mac:

```bash
cd ~/pulsanet/mobile   # o la ruta donde copiaste
```

---

## 4. Firebase iOS (push)

1. Firebase Console → Add app **iOS** → bundle `com.tacticalptx.app`.  
2. Descargar `GoogleService-Info.plist`.  
3. Colocar en:

```text
mobile/ios/Runner/GoogleService-Info.plist
```

**No** subir el plist a git público.  
APNs: clave .p8 en Apple Developer → subir a Firebase Cloud Messaging.

Plantilla: `mobile/ios/Runner/GoogleService-Info.plist.example`

---

## 5. Primer build (simulador / dispositivo)

```bash
cd ~/pulsanet/mobile
flutter pub get
cd ios && pod install --repo-update && cd ..
open ios/Runner.xcworkspace
```

O script:

```bash
cd ~/pulsanet/mobile
chmod +x scripts/build-ios.sh
API_BASE=https://189.152.200.238.sslip.io ./scripts/build-ios.sh
```

Debug en simulador:

```bash
flutter devices
flutter run -d "iPhone 14" --dart-define=API_BASE=https://189.152.200.238.sslip.io
```

(Ajusta el nombre del simulador según `flutter devices`.)

---

## 6. IPA release (si Xcode lo permite)

```bash
API_BASE=https://189.152.200.238.sslip.io ./scripts/build-ios.sh
```

Salida: `mobile/build/ios/ipa/*.ipa`  
Luego Xcode Organizer → Distribute App → TestFlight (si el Mac/Xcode cumplen requisitos de Apple).

Si el build release falla por versión de Xcode → usar workflow **Codemagic** (mismo repo).

---

## 7. Checklist rápido en la Mac

```bash
sw_vers
xcodebuild -version          # esperado: 14.2
flutter --version
flutter doctor -v
pod --version
ls ios/Runner/GoogleService-Info.plist
```

---

## 8. Problemas frecuentes (Monterey)

| Problema | Qué hacer |
|----------|-----------|
| Solo ofrece Xcode 14.2 | Normal en Monterey |
| iPhone iOS 17 no aparece / no corre | Usa simulador iOS 16 o Mac/Xcode más nuevo / Codemagic |
| `flutter doctor` pide Xcode 15 | Aviso; prueba build; IPA tienda → Codemagic |
| CocoaPods / ffi | `sudo gem install ffi` o CocoaPods vía Homebrew |
| Sin firma | Apple Developer + Team en Xcode |

---

## Referencias

- Checklist TestFlight / Codemagic: [IOS_TESTFLIGHT_CHECKLIST.md](IOS_TESTFLIGHT_CHECKLIST.md)  
- Script: `mobile/scripts/build-ios.sh`  
- Bundle: `com.tacticalptx.app`

*Actualizado: 2026-08-31 — Mac Monterey 12.7.6*
