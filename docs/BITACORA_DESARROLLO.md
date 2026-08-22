# PulsaNet / TacticalPtx — Bitácora de desarrollo

**Producto:** TacticalPtx  
**Ubicación canónica (Soporte):** `D:\pulsanet\Soporte\Documentos\BITACORA_DESARROLLO.md`  
**Copia en repo:** `D:\pulsanet\docs\BITACORA_DESARROLLO.md`  
**Changelog por versión:** `D:\pulsanet\docs\CHANGELOG.md`

Documento **vivo**: cada cambio, mejora, corrección, despliegue o decisión relevante se añade **arriba** (más reciente primero), con fecha.

### Cómo registrar una entrada

```markdown
## YYYY-MM-DD — Título corto

- **Tipo:** feature | fix | mejora | docs | infra | ux | security | otro
- **Área:** backend | web | mobile | database | infra | docs | ops
- **Qué:** …
- **Por qué / notas:** …
- **Archivos / refs:** …
```

---

## 2026-08-22 — Plan escalonado 1→4 (validación · Git · APK · deploy)

- **Tipo:** ops | docs
- **Área:** ops | docs | mobile
- **Qué:**
  - Escalón 1: PC/API/web OK; checklist Pedro actualizado (voz/GPS pendientes humano).
  - Escalón 2: `git init` + commit `027fb0d` (287 archivos, sin secretos).
  - Escalón 3: rebuild APK 1.8.1+5 en curso/pendiente salida.
  - Escalón 4: Docker/Play documentados, **no** ejecutados aún.
- **Archivos / refs:** `VALIDACION_CAMPO_1_8_0.md`, `PLAN_ESCALONADO_1_8.md`, `.gitignore`, `docs/DOCKER_PROD.md`, `docs/PLAY_STORE.md`

---

## 2026-08-22 — Iconos en menú de módulos

- **Tipo:** ux
- **Área:** web
- **Qué:** Iconos SVG en Operaciones, Seguimiento, Mapa, Catálogos (y sub), Radio y Salir; visibles también en modo miniatura.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---

## 2026-08-22 — Menú miniatura con sola flecha (sin montajes)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Menú en flujo flex (ya no overlay): el mapa/consola no se montan encima.
  - Solo flecha para contraer/expandir; al contraer queda barra miniatura (OP/SEG/MAP…).
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `command-center.css`

---

## 2026-08-22 — Menú módulos con flecha acordeón

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Pestaña lateral con flecha para ocultar/mostrar el menú (sin desplazar el contenido).
  - Flecha también en topbar y en Catálogos (acordeón).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---

## 2026-08-22 — Mapa en vivo a pantalla completa equilibrada

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Quitado el tope de 1200px; toolbar en rejilla equitativa; mapa ocupa el alto restante.
  - KPIs alineados a la derecha del encabezado; sin franjas vacías laterales.
- **Archivos / refs:** `web/src/dispatch/DispatchMap.jsx`, `command-center.css`, `dispatch.css`

---

## 2026-08-22 — Menú despacho a la izquierda (ocultable)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Rail de módulos a la **izquierda**, como overlay (el mapa/consola no se desplaza al ocultar).
  - Botón **Menú / Ocultar** en la topbar; se recuerda en `localStorage`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---

## 2026-08-22 — Acceso directo sin Tailscale

- **Tipo:** infra | docs
- **Área:** ops | mobile
- **Qué:**
  - Guía IP pública + reenvío de puertos (4G sin Tailscale ni dominio).
  - Script `infra/EXPOSE-PUBLIC.ps1` (firewall + detección IP).
  - Build APK ya **no** fuerza Tailscale; LAN por defecto; `API_BASE` / `FORCE_TAILSCALE=1` opcionales.
- **Archivos / refs:** `Soporte/Documentos/ACCESO_DIRECTO_SIN_TAILSCALE.md`, `infra/EXPOSE-PUBLIC.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---

## 2026-08-22 — APK más robusta (cifrado, datos, UI)

- **Tipo:** security | ux | mejora
- **Área:** mobile
- **Qué:**
  - Tokens JWT en **Flutter Secure Storage** (migración desde SharedPreferences).
  - HTTP con timeout 18 s y cabecera de cliente; login limpia contraseña en memoria.
  - Tema institucional oliva/oro (claro, plano); login y radio más presentables.
  - E2EE LiveKit ya cableado; versión **1.8.1+5**.
- **Archivos / refs:** `mobile/lib/secure_store.dart`, `api_client.dart`, `theme.dart`, `screens/login_screen.dart`, `pubspec.yaml`

---

## 2026-08-22 — Cifrado reforzado voz + texto

- **Tipo:** security
- **Área:** backend | web | mobile
- **Qué:**
  - Chat/DM: cuerpos con **AES-256-GCM** en base de datos (`CONTENT_ENCRYPTION_KEY`); mensajes viejos en claro siguen legibles.
  - Voz PTT y llamadas: **E2EE LiveKit** por room (`LIVEKIT_E2EE_SECRET` + `e2eeKey` al cliente), encima de DTLS-SRTP.
- **Por qué / notas:** Reiniciar API tras añadir secretos en `.env`. Clientes web/APK deben actualizarse para E2EE de voz.
- **Archivos / refs:** `backend/src/services/contentCrypto.js`, `voiceE2ee.js`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`

---

## 2026-08-22 — Seguimiento estilo WhatsApp (bolitas en vivo)

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:**
  - Mapa de seguimiento con bolitas tipo Live Location (pulso, nombre, deslizamiento suave).
  - Rastro permanente que se actualiza por socket; opción “Seguir” al operador seleccionado.
  - GPS móvil por stream continuo (+ latido) para actualizar de forma permanente.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `command-center.css`, `mobile/lib/location_heartbeat.dart`, `useGpsReporter.js`

---

## 2026-08-22 — Chat limpio (sin iconos sobre burbujas)

- **Tipo:** ux | fix
- **Área:** web | mobile
- **Qué:**
  - Web: menú `⋯` al lado de la burbuja (no encima del texto); toast DM elevado sobre el compositor.
  - Móvil: ancho máximo en DM, clip en burbujas, audio flexible, ticks alineados a la derecha.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart`

---

## 2026-08-22 — Sin notificaciones en cada PTT

- **Tipo:** fix | ux
- **Área:** mobile | backend
- **Qué:**
  - El backend ya no envía FCM al otorgar el floor PTT.
  - La APK no muestra notificación local al oír a alguien al aire (solo mensajes y llamadas).
- **Por qué / notas:** Evitar spam de notificaciones en cada transmisión de radio.
- **Archivos / refs:** `backend/src/socket/ptt.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`

---

## 2026-08-22 — UI institucional estilo Reclutamiento

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Tema oliva `#243d20` + oro `#9a7b2f`, tipografía Oswald + Source Sans 3, paneles planos.
  - Despacho: topbar clara + rail derecho de módulos (como Reclutamiento IV R.M.).
  - Login, Radio y consola alineados al mismo sistema; tema por defecto claro.
- **Por qué / notas:** Unificar look institucional con el resto de sistemas de la dependencia.
- **Archivos / refs:** `web/src/institutional.css`, `web/src/dispatch/DispatchLayout.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`, `web/index.html`

---

## 2026-08-22 — Revisión completa 1.8.0

- **Tipo:** docs | otro
- **Área:** docs | ops
- **Qué:**
  - Auditoría de stack, features, riesgos y huecos (iOS, Docker prod, Git, Play Store).
  - Health API OK (db/redis/livekit/fcm). Ubicación única D:\pulsanet verificada.
  - Ajustes menores: texto GPS 5 s; limpieza de archivos basura en raíz (`start`, `query`, `favicon.ico/`).
- **Archivos / refs:** canvas revisión, `docs/UBICACION_PROYECTO.md`, `mobile/lib/screens/radio_shell.dart`

---

## 2026-08-22 — Ubicación única D:\pulsanet

- **Tipo:** infra | docs
- **Área:** ops | docs
- **Qué:**
  - Todo el proyecto queda bajo `D:\pulsanet` (código + `Soporte\`).
  - `D:\PulsaNet_Soporte` es unión → `D:\pulsanet\Soporte` (compat Firebase/bitácora).
  - Logos movidos a `Soporte\Brand\`; doc `docs/UBICACION_PROYECTO.md`.
- **Archivos / refs:** `Soporte\`, `.env` (`FIREBASE_SERVICE_ACCOUNT`), `.cursor/rules/documentar-cambios.mdc`, `README.md`

---

## 2026-08-22 — Release 1.8.0 (escalonado)

- **Tipo:** otro | infra | docs
- **Área:** mobile | infra | docs | web | backend
- **Qué:**
  - Etapa 1: APK móvil **1.8.0+4** (GPS 5 s + fixes radio) vía `BUILD-APK-WHATSAPP.cmd`.
  - Etapa 2: LiveKit ICE dual Wi‑Fi + Tailscale; `LIVEKIT_PUBLIC_URL` vacío; reinicio con `taskkill`.
  - Etapa 3: Changelog cerrado como **[1.8.0]**; API/web `1.8.0`.
  - Etapa 4: Checklist de campo en `PulsaNet_Soporte\Documentos\VALIDACION_CAMPO_1_8_0.md`.
- **Por qué / notas:** Si LiveKit no reinicia, ejecutar `LEVANTAR-TACTICALPTX.bat` como Administrador.
- **Archivos / refs:** `mobile/pubspec.yaml`, `infra/start-services.ps1`, `docs/CHANGELOG.md`, `backend/src/version.js`

---

## 2026-08-22 — Rediseño despacho: menú izquierdo, catálogos y seguimiento

- **Tipo:** ux | feature
- **Área:** web
- **Qué:**
  - Shell de despacho con menú lateral (Operaciones, Seguimiento, Mapa en vivo, Catálogos, Radio).
  - Nueva vista Seguimiento estilo WhatsApp (lista de operadores + mapa en tiempo real, capas Natural/Satélite/Claro).
  - Catálogos: Usuarios, Grupos y Geocercas bajo `/despacho/catalogos/…`.
  - Mapa operativo con selector de capas naturales.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `LiveTrackMap.jsx`, `CatalogsLayout.jsx`, `GeofenceCatalog.jsx`, `App.jsx`, `command-center.css`

---

## 2026-08-18 — Corrección LiveKit duplicado en Consola

- **Tipo:** fix
- **Área:** web | backend
- **Qué:**
  - La escucha extra de canales usaba la misma identidad LiveKit que el PTT y se expulsaban mutuamente (error de participante duplicado / audio cortado).
  - La escucha extra ahora entra como `:listen:` (solo oír) y espera a que el dock tenga canal.
- **Archivos / refs:** `backend/src/routes/livekit.js`, `web/src/useDispatchListen.js`, `web/src/api.js`

---

## 2026-08-18 — Voz PTT de otro canal no llegaba a Consola

- **Tipo:** fix
- **Área:** web | backend | infra
- **Qué:**
  - Pedro Sanchez Torres solo está en «Jfa. T.I.C.»; el altavoz de Consola sintonizaba «General» (otro LiveKit) y el PTT «al aire» no llevaba audio.
  - Despacho ahora escucha LiveKit de todos los canales; el selector es el canal por el que habla el despachador.
  - LiveKit URL sigue al host de la API (LAN o Tailscale); ICE ya no se fuerza solo a 100.x.
- **Por qué / notas:** El floor PTT (socket) es independiente del audio (LiveKit, un room por grupo).
- **Archivos / refs:** `web/src/useDispatchListen.js`, `web/src/dispatch/DispatchLayout.jsx`, `backend/src/services/livekit.js`, `infra/start-services.ps1`

---

## 2026-08-18 — GPS en consola y envío cada 5 s

- **Tipo:** fix | mejora
- **Área:** backend | web | mobile
- **Qué:**
  - El mapa decía «aún no hay GPS» con todo en ceros: si fallaba el listado de grabaciones (p. ej. cuenta **root**), se vaciaba también canales y ubicaciones.
  - `root` ahora entra al socket de despacho y puede listar grabaciones.
  - GPS se envía cada **5 s** (antes ~20 s) desde la app al abrirla, Radio web y Consola.
- **Por qué / notas:** «En línea» es presencia PTT (radio), no GPS. El chat no publica coordenadas. 1 s drenaría batería; se dejó 5 s.
- **Archivos / refs:** `backend/src/routes/recordings.js`, `backend/src/socket/dispatch.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/useGpsReporter.js`, `mobile/lib/location_heartbeat.dart`

---

## 2026-08-18 — Pruebas 4G/5G con Tailscale

- **Tipo:** infra
- **Área:** infra | mobile | ops
- **Qué:**
  - Tailscale en la PC (`100.127.12.44`); LiveKit anuncia esa IP para ICE.
  - APK de WhatsApp usa `API_BASE` Tailscale si `tailscale ip -4` existe.
  - Guía: `D:\PulsaNet_Soporte\Documentos\TACTICALPTX_4G_TAILSCALE.md`
- **Por qué / notas:** Desde datos móviles no se alcanza `192.168.1.66`. El celular debe instalar Tailscale con la misma cuenta.
- **Archivos / refs:** `infra/start-services.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`, `backend/.env` (`LIVEKIT_PUBLIC_URL`)

---

## 2026-08-18 — Mic flotante tapaba el chat móvil

- **Tipo:** fix
- **Área:** mobile
- **Qué:** El FAB de Radio (micrófono) se superponía al cuadro «Mensaje…». En Chat y Directos ya no se muestra; se vuelve a Radio con la flecha atrás.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

---

## 2026-08-18 — Radio en vivo en Consola / despacho

- **Tipo:** ux
- **Área:** web
- **Qué:** El audio PTT sigue sonando en Consola, Mapa, Usuarios y Grupos. Barra de canal + **Silenciada / En altavoz**.
- **Por qué / notas:** Antes solo había LiveKit en `/radio`; al entrar a Consola se cortaba.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/usePtt.js`, `web/src/dispatch/command-center.css`

---

## 2026-08-17 — Icono APK TacticalPtx

- **Tipo:** ux
- **Área:** mobile
- **Qué:** Icono launcher Android sustituido por el logo TacticalPtx (mipmaps + adaptive icon fondo negro). Splash de arranque en negro.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/android/app/src/main/res/mipmap-*`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---

## 2026-08-17 — BAT de arranque reparado

- **Tipo:** ops
- **Área:** infra | ops
- **Qué:**
  - `LEVANTAR-TACTICALPTX.bat` no arrancaba bien: PowerShell se colgaba en `Get-NetIPAddress`/firewall; la web iba a `:5174` o no escuchaba; `curl`/`start` poco fiables.
  - `start-services.ps1` ahora usa `ipconfig` (rápido) y no reinicia LiveKit si ya corre.
  - API/Web se lanzan con `infra/start-api.cmd` y `infra/start-web.cmd` (PATH de Node + Vite en `0.0.0.0:5173`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`, `infra/start-api.cmd`, `infra/start-web.cmd`

---

## 2026-08-17 — Error 500: Postgres deshabilitado / API caída

- **Tipo:** ops
- **Área:** infra | backend
- **Qué:**
  - PostgreSQL `postgresql-x64-17` estaba **Disabled/Stopped**; la API no escuchaba en :4000 (la web Vite devolvía 500 al proxy).
  - Servicio habilitado y arrancado; Redis/LiveKit/API de nuevo con health `ready` y `fcm: configured`.
  - `LEVANTAR-TACTICALPTX.bat` ahora re-habilita el servicio Postgres si viene Disabled.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`

---

## 2026-08-17 — Limpieza de BAT/CMD

- **Tipo:** ops
- **Área:** ops | mobile
- **Qué:**
  - Se dejan: `LEVANTAR-TACTICALPTX.bat` (stack local) y `mobile/scripts/BUILD-APK-WHATSAPP.cmd` (APK).
  - Se borra el alias `LEVANTAR-PULSANET.bat` y los lanzadores duplicados de Shorebird/diagnóstico (nunca hubo `shorebird.yaml`).
- **Por qué / notas:** Había varios `.cmd` equivalentes (instalar Shorebird 2 veces, setup, parche, diagnóstico, reparar PowerShell) y logs temporales.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---

## 2026-08-13 — Firebase FCM activado (proyecto tacticalptx)

- **Tipo:** infra
- **Área:** backend | mobile | ops
- **Qué:**
  - Proyecto Firebase `tacticalptx` + app Android `com.tacticalptx.app`
  - `google-services.json` en `mobile/android/app/`
  - Service account en Soporte; `FIREBASE_SERVICE_ACCOUNT` en `backend/.env`
  - API health: `"fcm":"configured"`
- **Por qué / notas:** Login CLI falló; configuración vía Consola. Credenciales fuera de git.
- **Archivos / refs:** `backend/.env`, `mobile/android/app/google-services.json`, `D:\PulsaNet_Soporte\Secrets\tacticalptx-firebase-adminsdk.json`, `docs/FCM_PUSH.md`

---

## 2026-08-12 — Lightbox imágenes chat móvil

- **Tipo:** fix
- **Área:** mobile
- **Qué:** Pulsar una imagen del chat grupal la abre a pantalla completa (zoom con pellizco, cerrar con X o atrás).
- **Archivos / refs:** `mobile/lib/screens/chat_panel.dart`

---

## 2026-08-12 — Plan UI PTT Radio verificado

- **Tipo:** mejora
- **Área:** mobile
- **Qué:** Confirmado plan “UI móvil estilo PTT Radio”: theme azul, `RadioShell` home, `RadioScreen` READY/mic, `ChatPanel`, atajos Chat/GPS/Cámara/Directos/Grupos. Pulido: nombre de canal en chat, nav con return explícito, `GroupsScreen` legacy al theme.
- **Archivos / refs:** `theme.dart`, `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `groups_screen.dart`, `main.dart`

---

## 2026-08-12 — Prioridad en segundo plano (radio/mensajes/llamadas)

- **Tipo:** feature
- **Área:** mobile | web | backend
- **Qué:**
  - Android: foreground service (`microphone|mediaPlayback`) + wake/wifi lock + pedir ignorar optimización de batería; notificación persistente “Radio activa”.
  - Móvil: avisos locales de chat/PTT/DM/llamada con app minimizada o pantalla bloqueada.
  - Web: keepalive de audio + Media Session + notificaciones del navegador si la pestaña está oculta.
  - FCM: canal de llamadas `tacticalptx_calls` con prioridad máxima.
- **Archivos / refs:** `background_radio.dart`, `AndroidManifest.xml`, `radio_shell.dart`, `channel_session.dart`, `backgroundKeepalive.js`, `RadioPage.jsx`, `usePtt.js`, `fcm.js`

---

## 2026-08-12 — Rebrand total TacticalPtx + APK

- **Tipo:** feature
- **Área:** web | mobile | backend | ops
- **Qué:**
  - Identificadores visibles e internos a **TacticalPtx** (`com.tacticalptx.app`, claves `tacticalptx_*`, API `tacticalptx-api`, emails `@tacticalptx.local`).
  - Script `LEVANTAR-TACTICALPTX.bat`.
  - APK release con marca nueva (~88.3 MB): `mobile/build/app/outputs/flutter-apk/app-release.apk`
- **Por qué / notas:** Carpeta de trabajo `D:\pulsanet` y BD `pulsanet_db` se mantienen (rutas/datos); el producto se llama TacticalPtx. Package Android nuevo: hay que **desinstalar** la app anterior `com.pulsanet.*` e instalar esta.
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`, `main.dart`, `BrandName.jsx`, `LEVANTAR-TACTICALPTX.bat`

---

## 2026-08-12 — Rebrand TacticalPtx + paleta táctica

- **Tipo:** ux
- **Área:** web | mobile | backend
- **Qué:**
  - Marca visible **TacticalPtx** (logo + wordmark plata/rojo).
  - Paleta negro / rojo / ámbar-dorado según logo; tema oscuro por defecto en web.
  - App Android: label, login con logo, tema dark táctico.
- **Por qué / notas:** No se renombró el repo ni el package `com.pulsanet.*` (interno).
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `BrandName.jsx`, `styles.css`, `theme.dart`, `login_screen.dart`

---

## 2026-08-12 — Revisión: rollback mensaje optimista

- **Tipo:** fix
- **Área:** web | backend
- **Qué:** Si `chat:error` / `dm:error`, se elimina el mensaje local pendiente (`clientMsgId`).
- **Archivos / refs:** `usePtt.js`, `DirectChat.jsx`, `socket/chat.js`, `socket/dm.js`

---

## 2026-08-12 — Envío de mensajes más rápido

- **Tipo:** fix
- **Área:** backend | web
- **Qué:**
  - Tras INSERT ya no se consultan reacciones/lecturas (inútiles en mensaje nuevo).
  - Nombre del emisor desde el token/socket (sin SELECT extra).
  - UI optimista en chat grupal y DM (aparece al instante; se confirma por socket).
- **Por qué / notas:** `hydrateMessage` hacía 3–4 queries (incl. COUNT de lecturas) por cada envío.
- **Archivos / refs:** `socket/chat.js`, `services/dm.js`, `socket/dm.js`, `usePtt.js`, `DirectChat.jsx`

---

## 2026-08-12 — Vista Radio web reorganizada

- **Tipo:** ux
- **Área:** web
- **Qué:** Radio en un solo layout: franja superior con canal/online + **PTT a la derecha**, abajo chat grupal (izq) y Directos (der). Sin pestañas Canal/Directos.
- **Archivos / refs:** `RadioPage.jsx`, `DirectChat.jsx` (`embedded`), `styles.css`

---

## 2026-08-12 — APK UI llamada estilo WhatsApp

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Build release `app-release.apk` (~87.8 MB) con UI de llamada entrante fullscreen + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 2026-08-12 — UI llamada entrante estilo WhatsApp

- **Tipo:** ux
- **Área:** web | mobile
- **Qué:** Llamada entrante a pantalla completa (avatar, anillos, Contestar verde / Rechazar rojo); en llamada con el mismo look.
- **Archivos / refs:** `incoming_call_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `styles.css`

---

## 2026-08-12 — APK con notificaciones DM/llamadas

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Build release `app-release.apk` (~87.8 MB) con avisos DM/llamada + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 2026-08-12 — Notificaciones DM y llamadas

- **Tipo:** mejora
- **Área:** web | mobile | backend
- **Qué:**
  - Web: tono + Notification del navegador + toast al recibir DM; ringtone en llamada privada.
  - Móvil: SnackBar + badge Directos + notificación local por socket (independiente de FCM).
  - Backend: FCM también en `dm:send` por socket y en sticker/media DM.
- **Por qué / notas:** FCM suele estar `off` sin Firebase; con la app abierta las señales socket ahora avisan. Push en background sigue requiriendo configurar Firebase.
- **Archivos / refs:** `web/src/appNotify.js`, `DirectChat.jsx`, `RadioPage.jsx`, `mobile/lib/push_service.dart`, `channel_session.dart`, `radio_shell.dart`, `backend/src/socket/dm.js`, `routes/dm.js`

---

## 2026-08-12 — UI Directos reorganizada

- **Tipo:** ux
- **Área:** web
- **Qué:** Pantalla Directos con avatares, roles en español, chat a altura completa, burbujas y vacíos claros; contactos sin duplicar recientes.
- **Archivos / refs:** `DirectChat.jsx`, `styles.css`

---

## 2026-08-12 — APK con fix llamadas privadas

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Build release `app-release.apk` (~87.8 MB) con `API_BASE=http://192.168.1.66:4000` (incluye fix LiveKit LAN + señal de llamada global).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 2026-08-12 — Fix llamadas privadas

- **Tipo:** fix
- **Área:** backend | web | mobile
- **Qué:**
  - URL LiveKit pública según host del cliente (no `127.0.0.1` en móvil).
  - Web: DirectChat permanece montado para recibir `call:incoming` fuera de la pestaña.
  - Móvil: señal de llamada en `ChannelSession` + diálogo global; PrivateCall usa host LAN.
- **Archivos / refs:** `livekit.js`, `calls.js`, `RadioPage.jsx`, `PrivateCallOverlay.jsx`, `channel_session.dart`, `radio_shell.dart`, `direct_pane.dart`

---

## 2026-08-12 — 5 usuarios de prueba

- **Tipo:** ops
- **Área:** backend | database
- **Qué:** Creados 5 usuarios de prueba (4 operadores + 1 despacho) en canal General, con contraseña temporal y cambio obligatorio en 1er ingreso.
- **Archivos / refs:** `create-test-users.js` — usuarios: `jramirezl2`, `mhernandezg2`, `psanchezt2`, `amartinezr2`, `lfernandezd2`

---

## 2026-08-12 — Usuario estilo ggomezd2 (no RFC)

- **Tipo:** feature
- **Área:** backend | web | mobile | docs
- **Qué:**
  - Generación de usuario: inicial nombre + apellido paterno + inicial materno + número desde 2 (ej. `ggomezd2`).
  - Se omite fecha de nacimiento / formato RFC.
  - Login en minúsculas; migrado `GODG900516` → `ggomezd2`.
- **Archivos / refs:** `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `migrate-usernames-style.js`

---

## 2026-08-12 — APK Android actualización

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Build release `app-release.apk` (~87.7 MB) con `API_BASE=http://192.168.1.66:4000` (incluye login RFC, cambio de clave, radio PTT, etc.).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 2026-08-12 — Limpieza usuarios demo/prueba

- **Tipo:** ops
- **Área:** backend | database | docs
- **Qué:**
  - Purgados 90 usuarios demo/loadtest de la BD (`npm run seed:purge-demo`).
  - Seed pasa a bootstrap mínimo: 1 root + canal General (sin operadores de prueba).
  - Manual sin cuentas demo; `seed:load` requiere `ALLOW_LOAD_SEED=1`.
- **Archivos / refs:** `purge-demo-users.js`, `seed.js`, `seed-load.js`, `MANUAL_USUARIO.md`

---

## 2026-08-12 — Contraseña temporal + cambio en 1er ingreso

- **Tipo:** feature
- **Área:** backend | web | mobile | database
- **Qué:**
  - Al crear/restablecer usuario se genera contraseña temporal (se muestra una vez al admin).
  - Flag `must_change_password`; en el primer login web/móvil obliga a cambiarla (mín. 8, letras y números).
- **Archivos / refs:** `tempPassword.js`, `auth.js`, `admin.js`, `App.jsx`, `DispatchUsers.jsx`, `change_password_screen.dart`, `013_must_change_password.sql`

---

## 2026-08-12 — Alta usuario: paso de grupos

- **Tipo:** feature
- **Área:** web | backend
- **Qué:** Tras los datos del alta, paso 2 para elegir grupos; sugiere «General». API acepta `groupIds` al crear usuario.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `command-center.css`

---

## 2026-08-12 — Login por usuario tipo RFC

- **Tipo:** feature
- **Área:** backend | web | mobile | database
- **Qué:**
  - Login con **usuario + contraseña** (ya no correo).
  - Usuario generado tipo RFC: 4 letras (apellidos/nombre) + fecha YYMMDD.
  - Alta en despacho pide nombre(s), apellidos y fecha; previsualiza el usuario.
  - Migración `012_user_username.sql`; seed demo con cuentas RFC.
- **Archivos / refs:** `rfcUsername.js`, `auth.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `seed.js`

---

## 2026-08-12 — Icono marca consola despacho

- **Tipo:** ux
- **Área:** web
- **Qué:** Sustituido el marcador vacío por SVG micrófono + ondas (marca PulsaNet) en la cabecera del centro de operaciones.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`

---

## 2026-08-12 — Consola admin más profesional (sin demo)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Centro de operaciones: cabecera, badges de rol, formularios/tablas pulidos.
  - Usuarios/Grupos con etiquetas en español; sin contraseñas ni textos demo.
  - Login sin cuentas de demostración; sesión `pulsanet_session`.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `App.jsx`

---

## 2026-08-12 — DM 1:1 + llamada privada

- **Tipo:** feature
- **Área:** backend / web / mobile
- **Qué:**
  - Chat directo entre usuarios de la misma org (`/api/dm`, sockets `dm:*`) además de chat de grupo/canal.
  - Llamada privada 1:1 vía LiveKit (`/api/calls/private`, signaling `call:incoming|accepted|ended`).
  - Web Radio: pestaña **Directos / llamada**; móvil: ícono Directos en barra inferior.
- **Archivos / refs:** `services/dm.js`, `routes/dm.js`, `routes/calls.js`, `socket/dm.js`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `direct_pane.dart`

---

## 2026-08-12 — UI móvil estilo PTT Radio

- **Tipo:** ux
- **Área:** mobile
- **Qué:**
  - Home post-login = `RadioShell`: READY / AL AIRE, mic anillo azul, selector de canales, pánico lateral.
  - Barra inferior: Chat · GPS · Cámara · Grabaciones (stub) · Grupos/cuenta.
  - Tema blanco/azul (`theme.dart`); chat extraído a `chat_panel.dart`.
- **Archivos / refs:** `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `main.dart`, `theme.dart`

---

## 2026-08-12 — Chat: imágenes con vista previa (estilo WhatsApp)

- **Tipo:** ux / fix
- **Área:** web / backend
- **Qué:**
  - Clasificación de media por mime + extensión (PNG/JPG ya no quedan como “archivo”).
  - Vista previa inline + lightbox al clic (ampliar / Escape / cerrar).
  - Mensajes antiguos `type=file` que eran imagen se reclasificaron a `image`.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`, `uploads.js`, `messages.js`

---

## 2026-08-12 — Rol root (superadmin) permisos totales

- **Tipo:** feature / security
- **Área:** backend / web / database
- **Qué:**
  - Enum `user_role` + migración `011_role_root.sql`; helpers `services/roles.js`.
  - Root: CRUD usuarios (incl. delete/reset password), grupos (desactivar/hard delete), quitar miembros, purge chat; ve todos los grupos; modera mensajes sin ser miembro.
  - Seed + UI despacho: `root@pulsanet.local` / `demo1234`.
- **Archivos / refs:** `admin.js`, `groups.js`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `api.js`, `seed.js`

---

## 2026-08-12 — BAT + stack local levantado

- **Tipo:** ops
- **Área:** infra / ops
- **Qué:**
  - Creado `LEVANTAR-PULSANET.bat` (Postgres + Redis/LiveKit + API + Web).
  - Stack arrancado: PG Running, Redis, LiveKit (`node-ip=192.168.1.66`), API health OK.
- **Archivos / refs:** `LEVANTAR-PULSANET.bat`, `infra/start-services.ps1`

---

## 2026-08-12 — Consola OK + APK release WhatsApp

- **Tipo:** ops
- **Área:** mobile / ops
- **Qué:**
  - Consola/PowerShell volvió a responder (`PS_OK`).
  - Build `flutter build apk --release` con `API_BASE=http://192.168.1.66:4000`.
  - APK lista: `mobile/build/app/outputs/flutter-apk/app-release.apk` (~87 MB).
- **Por qué / notas:** Sin Shorebird OTA; para distribuir por WhatsApp. Si Cursor vuelve a colgar, usar `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.
- **Archivos / refs:** `app-release.apk`, `BUILD-APK-WHATSAPP.cmd`

---

## 2026-08-12 — Guía: consola Windows colgada

- **Tipo:** docs / ops
- **Área:** ops
- **Qué:** Diagnóstico cuando cmd/PowerShell/Cursor cuelgan; build APK por cmd o Android Studio; Shorebird solo si PS responde.
- **Archivos / refs:** `docs/CONSOLA_COLGADA.md`

---

## 2026-08-12 — Shorebird: flujo solo CMD (sin PowerShell)

- **Tipo:** infra / fix
- **Área:** mobile / ops
- **Qué:** Shorebird ya clonado en `%USERPROFILE%\.shorebird`. Scripts `INSTALAR-SHOREBIRD.cmd`, `SHOREBIRD-WHATSAPP.cmd`, `SHOREBIRD-PARCHE.cmd`, `DIAGNOSTICO.cmd` sin depender de PowerShell.
- **Archivos / refs:** `mobile/scripts/*.cmd`, `docs/SHOREBIRD_SIN_POWERSHELL.md`

---

## 2026-08-12 — Shorebird: instalador CMD sin UAC

- **Tipo:** fix / infra
- **Área:** mobile / ops
- **Qué:** Reescrito `install-shorebird-windows.cmd` (sin Admin anidado); PS1 con log; fallback ZIP si falla git.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.cmd`, `.ps1`, `shorebird-whatsapp-setup.cmd`

---

## 2026-08-12 — Shorebird: instalador anti-Defender

- **Tipo:** infra
- **Área:** mobile / ops
- **Qué:** Scripts Admin `install-shorebird-windows.ps1/.cmd` (exclusiones Defender + clone git). Guía WhatsApp actualizada.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.*`, `docs/SHOREBIRD_WHATSAPP.md`

---

## 2026-08-12 — Paridad chat Android (lote 1)

- **Tipo:** feature
- **Área:** mobile
- **Qué:**
  - Modelo de mensaje completo (reply, reactions, sticker, ticks, edit/delete).
  - Sockets: `chat:edited|deleted|reaction|receipts|typing` + APIs REST.
  - UI: responder, reacciones, stickers, editar/borrar, typing, ticks ✓/✓✓.
- **Pendiente:** notas de voz (grabar/reproducir) en móvil.
- **Archivos / refs:** `channel_session.dart`, `channel_screen.dart`, `api_client.dart`

---

## 2026-08-12 — Shorebird OTA + WhatsApp

- **Tipo:** infra / docs
- **Área:** mobile
- **Qué:**
  - Guía `docs/SHOREBIRD_WHATSAPP.md`: APK base por WhatsApp + parches OTA.
  - Scripts `mobile/scripts/shorebird-release-whatsapp.ps1` y `shorebird-patch.ps1`.
  - App: `shorebird_code_push` + aviso al tener parche listo.
- **Archivos / refs:** `SHOREBIRD_WHATSAPP.md`, `shorebird_update.dart`, `main.dart`, `pubspec.yaml`, scripts/

---

## 2026-08-11 — PTT: bajar latencia de voz

- **Tipo:** mejora
- **Área:** web / mobile / backend / infra
- **Qué:**
  - Mic se publica **muteado al entrar** al canal; al grant solo unmute.
  - `ptt:granted` se emite **antes** del INSERT en `ptt_sessions`.
  - RED desactivado; preset speech; NS off en móvil.
  - Mute no espera la subida de grabación; LiveKit `livekit.dev.yaml` + `--node-ip`.
- **Archivos / refs:** `usePtt.js`, `channel_session.dart`, `socket/ptt.js`, `infra/livekit.dev.yaml`, `start-services.ps1`

---

## 2026-08-11 — Móvil: pánico ya no tapa el chat

- **Tipo:** ux / fix
- **Área:** mobile
- **Qué:** Se quitó el FAB de pánico que tapaba Enviar; el botón queda bajo el PTT (y el icono del AppBar).
- **Archivos / refs:** `mobile/lib/screens/channel_screen.dart`

---

## 2026-08-11 — Build Android: core library desugaring

- **Tipo:** fix
- **Área:** mobile
- **Qué:** Habilitado `coreLibraryDesugaring` en `android/app/build.gradle.kts` (requerido por `flutter_local_notifications`).
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`

---

## 2026-08-11 — Pánico: sirena hasta Enterado

- **Tipo:** feature / ux
- **Área:** web / mobile / backend
- **Qué:**
  - Sirena en bucle hasta **Enterado** (Radio, Despacho) o **Resolver**.
  - Miembros del canal pueden hacer PATCH `acked`.
  - Móvil: alarma periódica + diálogo hasta Enterado; se silencia también si otro acusa.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`, `panic.js` (routes), `channel_session.dart`, `channel_screen.dart`, `V1_7_PANIC.md`

---

## 2026-08-11 — Mapa despacho: estilo Voyager (no black)

- **Tipo:** ux
- **Área:** web
- **Qué:** TileLayer del mapa de unidades pasó de Carto `dark_all` a `voyager` (calles a color).
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-11 — Fix sirena de pánico (no sonaba)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - El emisor ahora oye la sirena al confirmar pánico (antes solo receptores).
  - Se quitó `window.confirm` (bloqueaba autoplay); confirmación por doble pulsación.
  - Audio más robusto: WAV HTMLAudio + Web Audio; unlock en cada gesto.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`

---

## 2026-08-11 — Fix pantalla en blanco al PTT (Radio)

- **Tipo:** fix
- **Área:** web
- **Qué:** Se restauró `usePtt(...)` en `RadioPage` (se había borrado al cablear audio de pánico).
- **Archivos / refs:** `RadioPage.jsx`

---

## 2026-08-11 — Sonido al recibir pánico

- **Tipo:** feature / ux
- **Área:** web / mobile
- **Qué:** Sirena Web Audio en Radio/Despacho al `panic:alert`; en móvil SystemSound + vibración + diálogo.
- **Notas:** El navegador requiere un clic/PTT previo para permitir audio.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

---

## 2026-08-11 — Ticks de lectura (v1.7.1)

- **Tipo:** feature / ux
- **Área:** web / backend / database
- **Qué:** ✓✓ enviado → leído (alguien del canal) → azul si todos; mark-read al ver el chat.
- **Archivos / refs:** `010_message_reads.sql`, `chat.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_7_1_READ_RECEIPTS.md`

---

## 2026-08-11 — Botón de pánico también en Radio web

- **Tipo:** feature / ux
- **Área:** web
- **Qué:** Botón rojo **PÁNICO** bajo el PTT en Radio web (misma API que móvil); confirma antes de enviar.
- **Archivos / refs:** `RadioPage.jsx`, `usePtt.js`, `styles.css`

---

## 2026-08-11 — Botón de pánico (v1.7)

- **Tipo:** feature / security
- **Área:** mobile / backend / web / database
- **Qué:** SOS desde canal móvil → grupo + admin/despacho + `canReceivePanic`; banner en consola; mensaje sistema en chat.
- **Archivos / refs:** `009_panic_button.sql`, `panic.js`, `channel_screen.dart`, `CommandCenter.jsx`, `V1_7_PANIC.md`

---

## 2026-08-11 — Stickers en chat (v1.6.1)

- **Tipo:** feature / ux
- **Área:** web / backend / database
- **Qué:** Packs de stickers en Radio (botón 🎭); tipo `sticker`; catálogo API.
- **Archivos / refs:** `008_message_stickers.sql`, `stickers.js`, `chat.js`, `WhatsAppChat.jsx`, `V1_6_STICKERS.md`

---

## 2026-08-11 — Reacciones en mensajes (v1.6)

- **Tipo:** feature / ux
- **Área:** web / backend / database
- **Qué:** Reacciones emoji en chat Radio (toggle una por usuario); chips con contador en vivo.
- **Archivos / refs:** `007_message_reactions.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_6_REACTIONS.md`

---

## 2026-08-11 — Calidad de voz menos “robótica”

- **Tipo:** fix / mejora
- **Área:** web
- **Qué:** Notas de voz y PTT: Opus a 128 kbps, sin noiseSuppression agresivo, sampleRate 48 kHz; helper `voiceRecord.js`.
- **Por qué / notas:** La NS + bitrate bajo deformaba formantes (voz metálica/IA).
- **Archivos / refs:** `voiceRecord.js`, `WhatsAppChat.jsx`, `usePtt.js`

---

## 2026-08-11 — Reproductor de audio más presentable

- **Tipo:** ux / mejora
- **Área:** web
- **Qué:** Rediseño del player de notas de voz: botón SVG play/pausa, forma de onda clicable, chip “Audio”, tipografía de marca, sin pulso ni control nativo.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---

## 2026-08-11 — Reproductor de notas de voz en chat

- **Tipo:** ux / mejora
- **Área:** web
- **Qué:** Sustituye el `<audio controls>` nativo por un player estilo nota de voz: botón play/pausa grande, onda + seek, duración; solo una nota suena a la vez.
- **Por qué / notas:** El control nativo se veía desfasado y poco usable dentro de las burbujas.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---

## 2026-08-11 — Editar / eliminar mensajes (v1.5.1)

- **Tipo:** feature / ux
- **Área:** web / backend / database
- **Qué:** Menú del mensaje (⋯ o clic derecho): Editar (solo texto) y Eliminar para autor, admin o despacho. Soft-delete para todos; etiqueta “editado”.
- **Por qué / notas:** Completa el chat estilo WhatsApp con gestión básica de mensajes.
- **Archivos / refs:** `006_message_edit_delete.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `api.js`

---

## 2026-08-11 — Chat estilo WhatsApp (v1.5)

- **Tipo:** feature / ux
- **Área:** web / backend / database
- **Qué:** Chat Radio rediseñado: burbujas, hora, responder, buscar, emojis, foto/doc, notas de voz, “escribiendo…”, ticks enviados.
- **Notas:** No es clon completo (sin llamadas 1:1, ticks lectura, E2E, estados). Doc límites en `V1_5_CHAT_WHATSAPP.md`.
- **Archivos:** `WhatsAppChat.jsx`, `chat.js`, `005_chat_whatsapp.sql`, `RadioPage.jsx`, `ChatMedia.jsx`

---

## 2026-08-11 — Sistema de documentación continua

- **Tipo:** docs / proceso
- **Área:** docs
- **Qué:** Bitácora + CHANGELOG + regla Cursor para documentar todo lo que se realice de aquí en adelante.
- **Archivos:** `BITACORA_DESARROLLO.md`, `CHANGELOG.md`, `.cursor/rules/documentar-cambios.mdc`

---

## 2026-08-11 — Informe desarrollo por mes

- **Tipo:** docs
- **Área:** docs
- **Qué:** Informe Mes 1–6 + v1.1–v1.4 (entregas, análisis, pendientes).
- **Archivos:** `Documentos/INFORME_DESARROLLO_POR_MES.md`, `docs/INFORME_DESARROLLO_POR_MES.md`

---

## 2026-08-11 — Tema claro/oscuro + Radio mejorada

- **Tipo:** ux / mejora
- **Área:** web
- **Qué:** Toggle Claro/Oscuro (persistente) en Login, Radio y Despacho. Radio con tarjeta PTT y estados más claros.
- **Archivos:** `web/src/theme.jsx`, `styles.css`, `RadioPage.jsx`, `command-center.css`, `DispatchLayout.jsx`, `index.html`

---

## 2026-08-11 — Grabación PTT v1.4

- **Tipo:** feature
- **Área:** backend / web
- **Qué:** Al soltar PTT en Radio web se sube audio; API `/api/recordings`; consola reproduce grabaciones 24 h.
- **Archivos:** `migrations/004_ptt_recordings.sql`, `routes/recordings.js`, `usePtt.js`, `CommandCenter.jsx`, `docs/V1_4_RECORDINGS.md`
- **Notas:** Móvil aún no graba (mismo endpoint listo).

---

## 2026-08-11 — FCM: gaps de código (Firebase pendiente)

- **Tipo:** feature / docs
- **Área:** mobile / backend
- **Qué:** Canal `pulsanet_alerts`, notificaciones foreground, re-registro token, `GET/POST /api/devices/me|test`. Checklist Soporte.
- **Notas:** Usuario dejó Firebase/JSON pendiente → health sigue `fcm: off`.
- **Archivos:** `push_service.dart`, `fcm.js`, `devices.js`, `ACTIVAR_FCM.md`, `docs/FCM_PUSH.md`

---

## 2026-08-11 — Consola Command + geocercas + login

- **Tipo:** feature / ux
- **Área:** web / backend
- **Qué:**
  - Consola tipo CommandCentral (mapa, canales, actividad, detalle); luego rediseño por legibilidad.
  - Geocercas v1.3 (CRUD + enter/exit).
  - Login split con marca dominante.
  - Stack arrancado post-cambio disco C; script `start-services.ps1` corregido (encoding).
- **Archivos:** `CommandCenter.jsx`, `command-center.css`, `geofences.js`, `003_geofences.sql`, `App.jsx` login

---

## 2026-08-10 — Audio LAN + APK + respaldo disco D

- **Tipo:** fix / infra / ops
- **Área:** mobile / infra / ops
- **Qué:**
  - Pérdidas de voz: LiveKit `--node-ip` + UDP 7882, mute/unmute PTT, DTX off.
  - Rebuild APK `PulsaNet-192.168.1.66.apk` (Gradle en D: por C: lleno).
  - Proyecto confirmado en `D:\pulsanet`; respaldo `Respaldos\pulsanet_pre_cambio_C_*`.
- **Archivos:** `channel_session.dart`, `usePtt.js`, `start-services.ps1`, Soporte APK/Respaldos

---

## 2026-08-10 — v1.1 Media/GPS y v1.2 FCM cableado (sesión previa)

- **Tipo:** feature
- **Área:** backend / web / mobile
- **Qué:** Chat multimedia, GPS/rutas despacho; pipeline FCM (sin credenciales).
- **Docs:** `V1_1_MEDIA_GPS.md`, `FCM_PUSH.md`

---

## 2026-08 (Mes 1–6 consolidados)

Ver informe detallado: [INFORME_DESARROLLO_POR_MES.md](INFORME_DESARROLLO_POR_MES.md)

| Mes | Resumen |
|-----|---------|
| 1 | Auth, grupos, PTT web, LiveKit |
| 2 | Redis floor/presencia, chat, reconnect |
| 3 | Android Flutter alpha |
| 4 | Panel despacho (overview, mapa, users, groups) |
| 5 | Loadtest / piloto señalización |
| 6 | Compose prod, harden API, prep Play Store |

---

*Fin de entradas históricas iniciales. Las nuevas van encima de esta línea de separación (después del encabezado “Cómo registrar”).*
