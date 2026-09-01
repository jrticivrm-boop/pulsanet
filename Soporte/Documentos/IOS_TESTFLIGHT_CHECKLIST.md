# TacticalPtx — Checklist iOS + TestFlight (desde Windows)

Build en la nube con **Codemagic** (Mac real, sin emulador).  

**Mac local (Tahoe 26.x):** ver [IOS_BUILD_MAC_TAHOE.md](IOS_BUILD_MAC_TAHOE.md). Histórico Monterey: [IOS_BUILD_MAC_MONTEREY.md](IOS_BUILD_MAC_MONTEREY.md).
Repo ya incluye `codemagic.yaml` en la raiz y `mobile/ios/` listo.

---

## 1. Apple Developer (obligatorio)

1. Alta en [Apple Developer Program](https://developer.apple.com/programs/) (~99 USD/año).
2. [App Store Connect](https://appstoreconnect.apple.com/) → **Apps** → **+** → New App.
   - Plataforma: iOS
   - Nombre: **TacticalPtx**
   - Bundle ID: **com.tacticalptx.app** (crear antes en [Identifiers](https://developer.apple.com/account/resources/identifiers/list))
   - SKU: `tacticalptx-ios` (cualquier identificador unico)
3. En el Identifier `com.tacticalptx.app` activar:
   - **Push Notifications**
   - (Opcional) Background Modes ya van en Info.plist del proyecto

### Clave API App Store Connect (para Codemagic)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. **+** → nombre `Codemagic TacticalPtx` → rol **App Manager** (o Admin).
3. Descargar **.p8** (solo una vez). Anotar **Issuer ID** y **Key ID**.

---

## 2. Firebase (push iOS)

Ya tienes proyecto Firebase para Android. Falta la app iOS:

1. [Firebase Console](https://console.firebase.google.com/) → tu proyecto TacticalPtx.
2. **Add app** → **iOS**.
3. Bundle ID: **com.tacticalptx.app** (exacto).
4. Descargar **GoogleService-Info.plist**.
5. **No subas el plist al repo** (secreto). Usalo en Codemagic (paso 4).

### APNs (Apple Push Notification service)

1. [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → **+**.
2. Nombre: `TacticalPtx APNs`, marcar **Apple Push Notifications service (APNs)**.
3. Descargar **.p8** (guardar Key ID).
4. Firebase → **Project settings** → **Cloud Messaging** → **Apple app configuration**.
5. Subir la clave APNs (.p8), Team ID, Key ID.

Guia oficial: [Firebase — iOS setup](https://firebase.google.com/docs/ios/setup)

---

## 3. Codemagic

1. Crear cuenta: [codemagic.io](https://codemagic.io/signup) (plan free incluye minutos Mac limitados).
2. **Add application** → conectar repo Git (GitHub/GitLab/Bitbucket) o subir repo Cursor.
3. Seleccionar **Flutter** y apuntar al archivo **`codemagic.yaml`** en la raiz del repo.

### Integracion Apple

1. **Team settings** → **Integrations** → **Developer Portal** → conectar Apple ID.
2. **App Store Connect** → anadir API key (.p8, Issuer ID, Key ID).

### Grupo de variables `tacticalptx_ios`

**Team settings** → **Global variables and groups** → **Add group** → nombre: `tacticalptx_ios`

| Variable | Secreto | Valor |
|----------|---------|--------|
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Si | Contenido de `GoogleService-Info.plist` en base64 (ver abajo) |
| `APP_UPDATE_SECRET` | Si | Mismo que `APP_UPDATE_SECRET` del backend (opcional) |

Generar base64 del plist en **PowerShell** (Windows):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\GoogleService-Info.plist"))
```

Pegar el resultado en Codemagic como variable secreta.

### Firma automatica

1. En la app Codemagic → **Distribution** → **iOS code signing**.
2. Metodo: **Automatic**.
3. Bundle: `com.tacticalptx.app`.
4. Codemagic crea certificado y perfil via App Store Connect API.

---

## 4. Primer build

1. Codemagic → workflow **TacticalPtx iOS → TestFlight** (o **solo IPA** para probar sin subir).
2. **Start new build** → rama `main` (o la que uses).
3. Esperar ~15–25 min (pods + Xcode + firma).
4. Artefacto: `build/ios/ipa/*.ipa`.
5. Si publicacion activa: aparece en **TestFlight** en 5–30 min.

### Probar en iPhone

1. App Store Connect → **TestFlight** → **Internal Testing** → anadir testers (Apple ID).
2. Instalar app **TestFlight** en el iPhone → aceptar invitacion → instalar TacticalPtx.

---

## 5. Variables de build

| Variable | Donde | Default |
|----------|--------|---------|
| `API_BASE` | `codemagic.yaml` vars | `https://189.152.200.238.sslip.io` |
| `APP_UPDATE_SECRET` | grupo Codemagic | vacio (OTA iOS no aplica como APK) |

Cambiar API publica: editar `vars.API_BASE` en `codemagic.yaml` o sobreescribir en Codemagic UI.

---

## 6. Build local (si algun dia tienes Mac)

```bash
cd mobile
export API_BASE=https://189.152.200.238.sslip.io
cp /ruta/GoogleService-Info.plist ios/Runner/
./scripts/build-ios.sh
```

---

## 7. Problemas frecuentes

| Error | Solucion |
|-------|----------|
| Signing failed | Revisar integracion Apple + bundle `com.tacticalptx.app` en Codemagic |
| Push no llega | APNs key en Firebase + plist en build |
| No conecta API | `API_BASE` debe ser HTTPS publico (sslip.io o dominio propio) |
| Pod install falla | `pod repo update` en Mac; en Codemagic reintentar build |

---

## Referencias fiables

- [Codemagic — Flutter iOS sin Mac](https://blog.codemagic.io/how-to-build-and-distribute-ios-apps-without-mac-with-flutter-codemagic/)
- [Codemagic — iOS code signing](https://docs.codemagic.io/flutter-code-signing/ios-code-signing/)
- [Firebase iOS setup](https://firebase.google.com/docs/ios/setup)
- [Apple — TestFlight](https://developer.apple.com/testflight/)
