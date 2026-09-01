# Changelog — TacticalPtx

Registro de versiones y cambios relevantes del producto (TacticalPtx). 
Bitácora narrativa (día a día): [BITACORA_DESARROLLO.md](BITACORA_DESARROLLO.md)

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
### Changed
### Fixed

---

## [1.8.0] — 2026-08-22

### Added
- Vista **Seguimiento** en vivo (lista + mapa natural/satélite, avatares, precisión, ruta 2 h)
- Sección **Catálogos** (Usuarios, Grupos, Geocercas) en despacho
- Pruebas **4G/5G** vía Tailscale (API/LiveKit en `100.x`, APK con esa `API_BASE`)
- Despacho: **radio PTT en altavoz** en Consola/Mapa/Usuarios/Grupos, con mute explícito
- **Firebase Cloud Messaging (FCM)** activo: proyecto `tacticalptx`, pushes de chat/PTT/DM/llamadas con la app en segundo plano o cerrada
- Prioridad en segundo plano: radio PTT, mensajes y llamadas siguen activos/avisando con app minimizada o pantalla bloqueada (FGS Android + keepalive web)
- Avisos de **mensaje directo** y **llamada privada** en web (tono + Notification API + toast) y móvil (SnackBar + notificación local aunque FCM esté off)
- Login por **usuario** generado del nombre (ej. `ggomezd2`) + contraseña
- Columna `users.username`; alta admin con vista previa del usuario generado
- Alta de usuario en **2 pasos**: datos → selección/sugerencia de grupos (p. ej. General)
- Contraseña **temporal automática** al alta/restablecer; cambio obligatorio en el primer ingreso
- Chat **directo 1:1** (contactos de la org) + **llamada privada** LiveKit (web y móvil)
- Rol **root** (superadministrador): permisos totales — usuarios (crear/editar/eliminar/restablecer clave), grupos (crear/desactivar/eliminar), miembros, vaciar chats; ve todos los canales
- Shorebird OTA + guía WhatsApp (`docs/SHOREBIRD_WHATSAPP.md`, scripts release/patch)
- Chat Android: reply, reacciones, stickers, ticks, editar/borrar, typing (paridad parcial con web)

### Changed
- Despacho: interfaz con **menú izquierdo**, catálogos y mapa de seguimiento en vivo (estilo WhatsApp)
- GPS a despacho cada **5 s** (antes ~20 s) en app móvil, Radio web y Consola
- LiveKit: ICE dual Wi‑Fi + Tailscale (sin forzar una sola `node-ip` / `LIVEKIT_PUBLIC_URL`)
- Icono de la app Android: logo **TacticalPtx** (reemplaza el icono Flutter)
- Rebranding a **TacticalPtx** (logo + colores negro/rojo/ámbar); tema oscuro por defecto en web
- Vista **Radio** web: PTT arriba a la derecha, chat grupal y Directos visibles a la vez (sin pestañas)
- Llamada privada entrante: UI a pantalla completa estilo WhatsApp/teléfono (Contestar / Rechazar)
- Login web/móvil: campo **Usuario** (estilo `ggomezd2`); seed bootstrap sin cuentas demo
- Consola de operaciones: UI más profesional; login sin cuentas demo
- App Android: home estilo **PTT Radio** (botón mic central, READY, canales, barra inferior Chat/GPS/Cámara/Grupos)
- Chat web: imágenes en vista previa inline + ampliar (lightbox), no solo enlace de descarga
- Alarma de pánico en bucle hasta **Enterado** (Radio / Despacho / móvil); un Enterado silencia al resto del canal
- PTT: menor latencia (mic precalentado, grant sin esperar DB, sin RED, LiveKit LAN)
- Consola despacho: acciones root en Usuarios y Grupos; `admin`/`dispatcher` incluyen a `root` en permisos de despacho
- APK móvil **1.8.0+4**

### Removed
- Cuentas demo por correo (`root@…`, `op1@…`) como método de acceso (sustituidas por usuario RFC)
- Usuarios de prueba/seed/loadtest del entorno; seed solo deja un root de arranque

### Fixed
- Consola: identidad LiveKit duplicada al escuchar varios canales (expulsaba la sesión y cortaba el audio)
- Consola: no se oía a operadores de otro canal (p. ej. Pedro en «Jfa. T.I.C.» con el dock en General). Despacho escucha todos los canales.
- LiveKit: la URL Tailscale ya no se fuerza a teléfonos en Wi‑Fi (el audio PTT no llegaba)
- Consola: cuenta **root** ya puede unirse al canal en vivo de despacho y listar grabaciones (antes 403 y mapa vacío)
- Consola: un error en grabaciones ya no deja el mapa/canales en ceros
- Chat móvil: el micrófono flotante de Radio ya no tapa el cuadro «Mensaje…»
- Envío de mensajes lento: menos queries al insertar + UI optimista (web)
- Chat Android: tocar imagen abre lightbox a pantalla completa (zoom)
- PNG/JPG mal clasificados como `file` (ahora `image` por mime/extensión)
- Llamadas privadas: URL LiveKit LAN + señal entrante aunque no estés en Directos

---

## [1.7.1] — 2026-08-11

### Added
- Ticks de lectura en chat Radio (✓✓ enviado / leído / leído por todos)
- Tabla `message_reads`, socket `chat:read` / `chat:receipts`
- Doc `V1_7_1_READ_RECEIPTS.md`

### Changed
- Botón de pánico también en Radio web (bajo PTT)

---

## [1.7.0] — 2026-08-11

### Added
- Botón de pánico en app móvil (canal)
- Tabla `panic_events` + flag `users.can_receive_panic`
- Notifica grupo + admin/despacho + usuarios con permiso
- Consola: banner de pánicos activos (enterado / resolver)
- Doc `V1_7_PANIC.md`

---

## [1.6.0] — 2026-08-11

### Added
- Reacciones y stickers en chat
- Docs `V1_6_REACTIONS.md`, `V1_6_STICKERS.md`

---

## [1.5.0] — 2026-08-11

### Added
- Chat Radio estilo WhatsApp: burbujas, reply, búsqueda, emojis, adjuntos, notas de voz, typing
- Tipo de mensaje `audio` + `reply_to_id`
- Doc `V1_5_CHAT_WHATSAPP.md`

### Changed
- UI chat sustituye el panel plano anterior en Radio

---

## [1.4.0] — 2026-08-11

### Added
- Grabación PTT desde Radio web (MediaRecorder → `POST /api/recordings/groups/:id`)
- Listado y reproducción en Consola de despacho
- Tabla `ptt_recordings` (migración `004`)
- Tema claro/oscuro global (Login, Radio, Despacho)
- Bitácora de desarrollo y este CHANGELOG

### Changed
- Radio: layout con tarjeta PTT y copy de estados más claro
- Consola despacho: respeta tema claro/oscuro

---

## [1.3.0] — 2026-08-11

### Added
- Geocercas circulares (CRUD + evaluación enter/exit en GPS)
- Consola Command (mapa, canales, actividad, detalle)
- Login rediseñado (split marca / formulario)
- Mejoras FCM app: canal Android, foreground, token refresh

### Fixed
- Script `start-services.ps1` (encoding PowerShell)
- Socket.IO web: URL directa a API + polling primero

---

## [1.2.0] — 2026-08-10

### Added
- Pipeline FCM (Firebase Admin + registro devices + push en chat/PTT)
- Documentación `FCM_PUSH.md`

---

## [1.1.0] — 2026-08-10

### Added
- Chat multimedia (imagen/archivo)
- GPS live + historial de rutas en mapa despacho
- Migración `002_media_fields`

---

## [1.0.x] — Mes 1–6 (2026)

### Mes 6
- Docker Compose producción, endurecer API, activity logs, JWT refresh, prep Play Store

### Mes 5
- Seed carga + `npm run loadtest`, checklist piloto

### Mes 4
- Panel despacho web (overview, mapa, usuarios, grupos, CSV)

### Mes 3
- App Android Flutter alpha (PTT, chat, presencia)

### Mes 2
- Redis floor/presencia, chat texto, reconnect

### Mes 1
- Auth JWT, grupos, PTT web + LiveKit demo

---

## Enlaces

- [Bitácora](BITACORA_DESARROLLO.md)
- [Alcance v1](ALCANCE_V1.md)
- [Arquitectura](ARQUITECTURA.md)
