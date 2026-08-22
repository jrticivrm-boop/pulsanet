# Shorebird + WhatsApp (PulsaNet móvil)

> **2026-08-17:** los `.cmd` de Shorebird se eliminaron del repo (nunca hubo `shorebird.yaml`). Para APK usa `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.

Actualizaciones **OTA de código Dart** sin reinstalar.  
La APK base se reparte **una vez por WhatsApp**; los siguientes cambios van por Shorebird.

## Flujo

```
1) Una vez: release APK → mandar por WhatsApp → instalar en teléfonos
2) Cada fix/feature Dart: shorebird patch → al reabrir la app, se aplica
```

| Qué | Cómo se actualiza |
|-----|-------------------|
| UI, chat, PTT Dart, bugs de lógica | `shorebird patch` (OTA) |
| Plugins nativos, permisos, icono, LiveKit nativo | Nueva APK (otra vez WhatsApp) |

## Requisitos (PC de desarrollo)

1. Cuenta en [console.shorebird.dev](https://console.shorebird.dev) (gratis para empezar)
2. CLI Shorebird — **si Defender bloquea** el instalador oficial, usa el script con Admin:

```powershell
# Opción A (recomendada en este PC): doble clic / Ejecutar como administrador
#   D:\pulsanet\mobile\scripts\install-shorebird-windows.cmd

# Opción B: PowerShell Admin
powershell -ExecutionPolicy Bypass -File D:\pulsanet\mobile\scripts\install-shorebird-windows.ps1
```

Eso añade exclusiones de Defender, clona Shorebird con git y deja `shorebird` en el PATH.

Instalador oficial (si no hay bloqueo):

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
iwr -UseBasicParsing 'https://raw.githubusercontent.com/shorebirdtech/install/main/install.ps1' | iex
```

Luego (terminal **nueva**):

```powershell
shorebird login
```

3. En `D:\pulsanet\mobile`:

```powershell
cd D:\pulsanet\mobile
shorebird init   # nombre: pulsanet_mobile
flutter pub get
```

Eso crea `shorebird.yaml` (con `app_id`) y lo añade a assets en `pubspec.yaml`.

## Checklist rápida

| Paso | Acción |
|------|--------|
| 1 | Doble clic: `D:\pulsanet\mobile\scripts\install-shorebird-windows.cmd` |
| 2 | Si falla, abre el log: `mobile\scripts\shorebird-install-log.txt` |
| 3 | Terminal **nueva**: `shorebird login` |
| 4 | `cd D:\pulsanet\mobile` → `shorebird init` |
| 5 | `powershell -File scripts\shorebird-release-whatsapp.ps1` |
| 6 | Enviar APK por WhatsApp |
| 7 | Después: `powershell -File scripts\shorebird-patch.ps1` |

**Todo-en-uno (después de que el paso 1 funcione):**  
`D:\pulsanet\mobile\scripts\shorebird-whatsapp-setup.cmd`

> El `.cmd` **ya no pide Admin**. Si Defender molesta, ejecuta PowerShell como Admin solo para añadir exclusiones, o usa el log para ver el error exacto.

## 1) Release base (mandar por WhatsApp)

```powershell
cd D:\pulsanet\mobile
powershell -File scripts\shorebird-release-whatsapp.ps1
```

Por defecto usa API LAN `http://192.168.1.66:4000`. Cambiar:

```powershell
powershell -File scripts\shorebird-release-whatsapp.ps1 -ApiBase "https://api.tudominio.com"
```

Salida típica: `build\app\outputs\flutter-apk\app-release.apk`

**WhatsApp:** enviar ese APK a operadores → “Instalar” (orígenes desconocidos).

## 2) Parche OTA (sin reinstalar)

```powershell
cd D:\pulsanet\mobile
powershell -File scripts\shorebird-patch.ps1
```

En el teléfono: cerrar PulsaNet por completo y volver a abrir (a veces 2 veces).

## App

Al iniciar, comprueba parches (`ShorebirdUpdate`) y avisa si hay que reiniciar.

## Límites

- `API_BASE` queda compilado en el release.
- Cambios nativos → nueva APK, no solo patch.

## Troubleshooting

| Problema | Qué hacer |
|----------|-----------|
| Defender / “virus” | `install-shorebird-windows.cmd` como Admin |
| `shorebird` no encontrado | Cerrar terminal; PATH `%USERPROFILE%\.shorebird\bin` |
| Patch no llega | Misma versión release; internet; reiniciar app 2 veces |

Docs: [docs.shorebird.dev](https://docs.shorebird.dev/code-push/)
