# Actualización APK en la app (estilo BanjeCel)

Sin Google Play. Al abrir TacticalPtx la app muestra **«Cargando configuración…»**, consulta el servidor y, si hay versión nueva, descarga e instala la APK.

Shorebird (parches Dart) sigue siendo opcional y solo aplica si el APK se publicó con Shorebird; el flujo principal es **APK completa**.

---

## Cómo funciona

1. Al arrancar, la app llama `GET /api/app/android`.
2. Compara `versionCode` del manifiesto con el de la app instalada (`build-number` de `pubspec.yaml`).
3. Si el servidor es mayor: descarga la APK, verifica `sha256` (si está), y abre el instalador del sistema.
4. El usuario confirma la instalación (Android no permite instalación totalmente silenciosa sin privilegios de dispositivo/MDM).

Pantalla de arranque: mensaje del manifiesto (por defecto «Cargando configuración…») + progreso.

---

## Publicar una actualización (ops)

### A) Script recomendado

1. Sube `version` en `mobile/pubspec.yaml` (ej. `1.8.4+13` → el número tras `+` es `versionCode`).
2. Doble clic o ejecuta:

```text
C:\pulsanet\mobile\scripts\PUBLISH-APK-UPDATE.cmd
```

Eso:

- Genera la APK release
- La copia a `backend\app-updates\files\TacticalPtx.apk`
- Escribe `backend\app-updates\android.json` con el `versionCode` / `versionName` nuevos
- Calcula SHA-256

3. Reinicia la API solo si no estaba corriendo (el manifiesto se lee en cada petición).
4. En el teléfono: cierra TacticalPtx por completo y ábrelo de nuevo.

### B) Manual

1. Build:

```bat
cd /d C:\pulsanet\mobile
flutter build apk --release --dart-define=API_BASE=https://TU_HOST:4000
```

2. Copia:

```text
mobile\build\app\outputs\flutter-apk\app-release.apk
  → backend\app-updates\files\TacticalPtx.apk
```

(Opcional: también a `Soporte\APK\` para archivo local; esa carpeta no se versiona.)

3. Crea/edita `backend\app-updates\android.json`:

```json
{
  "package": "com.tacticalptx.app",
  "versionCode": 13,
  "versionName": "1.8.4",
  "apkFile": "TacticalPtx.apk",
  "force": true,
  "message": "Cargando configuración…",
  "sha256": "HASH_EN_MINUSCULAS_64_HEX"
}
```

`sha256` vacío o ausente = no verificar hash.

Plantilla: `backend\app-updates\android.json.example`

4. Comprueba en el navegador o curl:

```text
GET https://TU_HOST:4000/api/app/android
```

Debe devolver `apkUrl`, `versionCode` y `configured: true`.

### Variable de entorno

```env
APP_UPDATES_DIR=D:\pulsanet\backend\app-updates
```

Puedes apuntar a otra carpeta que tenga `android.json` + `files\*.apk`.

---

## Primera instalación en un teléfono nuevo

Sigue haciendo falta una APK base (WhatsApp / USB). Las siguientes actualizaciones van por la app.

Firma: usa siempre el mismo keystore (`mobile/android/key.properties`). Si cambia la firma, Android no actualiza encima.

---

## Permisos en el teléfono

La primera vez Android pedirá **permitir instalar apps de esta fuente** (TacticalPtx). Si el usuario niega, la pantalla de arranque ofrece **Reintentar**.

---

## Shorebird (opcional)

Solo para parches Dart sobre un release Shorebird previo. Sin `shorebird.yaml` / release Shorebird no hace nada. Documentación histórica: `docs/SHOREBIRD_WHATSAPP.md`.

Para cambios de plugins nativos, permisos o versión de Flutter: **publica APK nueva** con este flujo.
