# iOS — listo para compilar (pendiente solo Apple / un clic)

El código y la configuración del repo ya permiten generar el IPA. **No hace falta más desarrollo** para el primer build.
Lo único que falta es cuenta Apple + secretos (Firebase iOS) y lanzar Codemagic o `build-ios.sh` en una Mac con Xcode 16+.

**Bundle:** `com.tacticalptx.app` · **Nombre en dispositivo:** SICOM · **Versión app:** ver `mobile/pubspec.yaml`

---

## Estado del repo (ya hecho)

| Pieza | Dónde |
|-------|--------|
| Proyecto Xcode / Flutter iOS | `mobile/ios/` |
| Script Mac | `mobile/scripts/build-ios.sh` (`API_BASE` → `https://pulsanet.duckdns.org`) |
| CI Codemagic | `codemagic.yaml` (TestFlight + solo IPA) |
| Export IPA | `mobile/ios/ExportOptions-appstore.plist`, `ExportOptions-ad-hoc.plist` |
| Plantilla Firebase | `mobile/ios/Runner/GoogleService-Info.plist.example` |
| AppDelegate + push | `mobile/ios/Runner/AppDelegate.swift` (Firebase si hay plist) |
| Canales Android no crashean en iPhone | `mobile/lib/android_native.dart` + usos |
| Sonidos notificación | `tactical_msg.wav`, `nudge_buzz.wav` en Runner |
| Guías detalladas | este archivo + `C:\pulsanet_soporte\Documentos\IOS_*.md` |

**Tu MacBook Pro 2017 / Ventura 13.7 no sirve para el build final** (Flutter actual pide Xcode 16+; App Store pide SDK reciente). Usa **Codemagic** o otra Mac.

---

## Checklist: lo que solo tú puedes completar

### 1. Apple Developer Program

- [ ] Cuenta en [developer.apple.com](https://developer.apple.com) (individual u organización, ~99 USD/año).
- [ ] Aceptar acuerdos en App Store Connect.
- [ ] Anotar el **Team ID** (Membership details).

### 2. App en App Store Connect

- [ ] Nueva app iOS, bundle **`com.tacticalptx.app`**, nombre visible «SICOM» (o el que apruebe Apple).
- [ ] Completar ficha mínima (categoría, privacidad, capturas se pueden después del primer TestFlight interno).

### 3. Llave API para Codemagic (recomendado)

En App Store Connect → Users and Access → Integrations → App Store Connect API:

- [ ] Crear llave con acceso a App Manager / Admin.
- [ ] Guardar el `.p8`, **Issuer ID** y **Key ID** (el `.p8` solo se descarga una vez).
- [ ] En Codemagic: Team settings → Integrations → Developer Portal → añadir esa llave (nombre exacto: `Codemagic TacticalPtx` como en `codemagic.yaml`).

### 4. Firebase iOS + APNs

- [ ] Firebase Console → mismo proyecto que Android → Add app → iOS → bundle `com.tacticalptx.app`.
- [ ] Descargar **`GoogleService-Info.plist`**.
- [ ] Apple Developer → Keys → crear llave **Apple Push Notifications service (APNs)** → subir el `.p8` a Firebase → Project settings → Cloud Messaging → Apple app configuration.
- [ ] En el PC de build / Codemagic:
  - Local: copiar a `mobile/ios/Runner/GoogleService-Info.plist` (**no** commits del plist; está en `.gitignore`).
  - **Una sola vez en Mac:** abrir `ios/Runner.xcworkspace` → arrastrar el plist al target **Runner** (Copy Bundle Resources) → **sí** hacer commit del cambio en `project.pbxproj` (sin el plist). Así Codemagic encuentra el archivo en el bundle cuando lo escribe desde el secreto.
  - Codemagic: variable `GOOGLE_SERVICE_INFO_PLIST_BASE64` = contenido del plist en base64 (grupo `tacticalptx_ios`).

### 5. Dispositivos de prueba

- [ ] Registrar UDID del iPhone (si Ad Hoc) **o** invitar testers en TestFlight.

### 6. Compilar (elige una vía)

**A) Codemagic (desde Windows, sin Mac)**

1. Repo conectado a Codemagic; grupo de variables `tacticalptx_ios`.
2. Variables mínimas: `GOOGLE_SERVICE_INFO_PLIST_BASE64`, opcional `APP_UPDATE_SECRET` (OTA Android; en iOS no instala APK).
3. Workflow: `tacticalptx-ios-testflight` o `tacticalptx-ios-build-only`.
4. Start new build → esperar IPA / TestFlight.

**B) Mac con Xcode 16+ (Tahoe / Sequoia reciente)**

```bash
cd mobile
./scripts/build-ios.sh
# o solo comprobar: ./scripts/build-ios.sh --no-codesign
```

Abrir `ios/Runner.xcworkspace` → firmar con tu Team → Archive / Distribute.

Guía paso a paso: `C:\pulsanet_soporte\Documentos\IOS_BUILD_MAC.md` y `IOS_TESTFLIGHT_CHECKLIST.md`.

---

## Limitaciones conocidas en el primer IPA (no bloquean compilar)

Estas funciones **Android** quedan degradadas o pendientes en iOS (no impiden abrir sesión, PTT básico, chat, mapa, push FCM):

- Bind a datos móviles (`ApiNetwork`) — no aplica en iOS.
- Timbre/ringback nativo ToneGenerator — fallback a haptic / assets.
- Pantalla completa sobre bloqueo / FSI Samsung — no aplica.
- Actualización OTA de APK — no aplica (TestFlight / App Store).
- Radio que «despierta» con CallKit/PushKit — mejora futura; FCM + `remote-notification` ya están en Info.plist.

---

## Cuando tengas Apple Developer

Avisa y (en Agent) se puede: revisar el primer fallido de Codemagic, poner el Team ID en Xcode, o subir el `GoogleService-Info.plist` a la máquina de build. **No hace falta más código para el primer compile.**
