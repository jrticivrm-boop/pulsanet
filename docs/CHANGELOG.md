# Changelog — TacticalPtx

Registro de versiones y cambios relevantes del producto (TacticalPtx). 
Bitácora narrativa (día a día): [BITACORA_DESARROLLO.md](BITACORA_DESARROLLO.md)

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
- **Dominio permanente (DuckDNS):** `SETUP-STABLE-DOMAIN.ps1` + sync automático del A-record; el APK deja de romperse al rotar la IP del ISP.
- **Módulo Video en despacho:** entrada en el menú lateral (`/despacho/video`) con transmisiones de canal, videollamadas 1:1 y activación de cámara web del puesto.
- **Pánico en mapa:** el anillo del pin del operador pasa a rojo y parpadea mientras el pánico esté activo.
- **Video en menú + cámara frontal/trasera:** opción Video en menús Radio/chat; en llamada y transmisión grupal se puede cambiar entre cámara frontal y trasera (web + mobile).

### Fixed
- **APK 1.8.59+68:** ancla permanente `https://pulsanet.duckdns.org` (DuckDNS); deja de romperse al rotar la IP del ISP.
- **APK 1.8.58+67:** `API_BASE` alineado a IP pública actual (`189.152.160.81.sslip.io`); login con override de servidor.
- **Radio PTT «Video en vivo»:** ahora pasa `groupId` al abrir la transmisión (antes no iniciaba).
- **Video grupal — cierre y aceptar:** `group:video_ended` a todos los miembros; panel web estable al unirse; mobile abre video sin parpadeo al aceptar.
- **Video grupal — notificaciones:** entrega por socket `user:*`, `group:*` y FCM por miembro; mobile respeta silencio/vibrador/sonido del teléfono.
- **Grado Mayor:** abreviatura corregida de `May.` a `Myr.` (catálogo, usuarios y UI).
- **Llamadas / videollamadas:** iconos ya no se montan sobre el video (mobile); botón **Apagar cam** funciona en web y app (ya no se reactiva solo).

### Added
- **Estabilizadores de llamada:** periodo de gracia ante caídas de red, ping de sesión, refresh de token LiveKit y reconexión automática (web + mobile).
- **Consola web — videoconferencia en mosaico:** grid adaptativo de participantes, panel embebido en despacho (mapa + canales siguen visibles), botón expandir a pantalla completa.
- **Transmisión de video grupal** (web + mobile + despacho): notificaciones push + invitación entrante con tono/vibración según modo del teléfono.

## [1.8.57] — 2026-09-01

### Added
- **Transmisión de video grupal** (web + mobile + despacho): sala LiveKit `gvid_*` paralela al PTT; botón en chat de grupo; mosaico multi-participante; E2EE.
- API `GET/POST /api/group-video/:groupId/*` (start, join, leave, end, ping, status).

### Changed
- **Videollamadas 1:1:** resolución **720p** con simulcast (capas 180/360/720) y `adaptiveStream`/`dynacast` en web y mobile.

### Mobile (APK 1.8.57+66)
- OTA actualizado en `backend/app-updates/`.

## [1.8.56] — 2026-09-01

### Fixed
- UI videollamada: controles sin solapamiento; **Apagar cam** operativo.
- Estabilizadores de llamada ante caídas breves de red.

### Mobile (APK 1.8.56+65)
- OTA actualizado en `backend/app-updates/`.

## [1.8.55] — 2026-09-01

### Added
- **Historial de llamadas** (mobile): pestaña Llamadas en inbox con registro de voz, videollamadas y radio; filtros Todas/Perdidas; callback desde cada fila.
- Persistencia en PostgreSQL (`private_call_logs`) vía `GET /api/calls/history`.

### Changed
- Pantalla de llamada entrante con gradiente y badge de modo (VOZ / VIDEO / RADIO).

### Mobile (APK 1.8.55+64)
- OTA actualizado en `backend/app-updates/`.

## [1.8.54] — 2026-09-01

### Fixed
- **Videollamada:** cámara automática al contestar (estilo WhatsApp); colgar cierra en ambos usuarios; menú Llamar con opción Video en web/despacho.

## [1.8.53] — 2026-09-01

### Added
- **Videollamadas 1:1** (web + mobile): modo `video` en llamadas privadas LiveKit con preview local/remoto y E2EE.
- **Solicitud de cámara** durante llamada de voz: el peer debe aceptar explícitamente (`/video/request`, `/video/respond`).
- Botón **Video** en chat directo (web), inbox de canal y menú de miembros (mobile).

### Mobile (APK 1.8.53+62)
- `PrivateCallScreen` con tracks de video, permisos cámara y notificaciones FCM `private_video` / `private_video_request`.

## [1.8.52] — 2026-09-01

### Mobile (APK 1.8.52+61)
- Nueva IP pública / dominio: `https://189.152.222.98.sslip.io` (la anterior dejó de responder).
- OTA obligatoria si el PTT/LiveKit fallaba tras cambio de IP del ISP.

### Fixed
- **Infra IP/LiveKit:** auto-sync de IP pública (`Sync-PublicIp.ps1`); drift de ISP realinea `.env`, Caddy, UPnP y `node-ip` sin intervención manual.
- **Web LiveKit:** señal siempre por `wss://` mismo origen (proxy `/rtc`); evita error «No se pudo conectar el audio» en consola local HTTPS.
- **Mobile LiveKit 4G:** `node_ip` fija (`189.152.222.98`) tras cambio de IP del ISP; corrige `MediaConnectException` / ICE timeout en PTT.

## [1.8.51] — 2026-09-01

### Mobile (APK 1.8.51+60)
- Audio: al silenciar la escucha de radio se libera la sesión de audio del sistema (no invade Spotify/otras apps en mute).
- Incluye fixes de MEJORAS.txt (pánico despacho, llamadas, chat scroll, avatares web vía API).

## [1.8.50] — 2026-09-01

### Mobile (APK 1.8.50+59)
- Rollback visual: tema claro oliva/oro restaurado (equivalente a 1.8.48); retira el rediseño oscuro/camo de 1.8.49.

## [1.8.49] — 2026-08-31

### Mobile (APK 1.8.49+58)
- UI táctica oscura (camo digital + burbujas olive) en chat, inbox, DM, canales, login y Configuración.
- Seguridad: bloqueo de capturas de pantalla (`FLAG_SECURE`) con interruptor en Configuración (activo por defecto).

## [1.8.48] — 2026-08-31

### Mobile (APK 1.8.48+57)
- Nuevo sonido `tactical_msg` y canal Android `tacticalptx_alerts_radio`.

## [1.8.47] — 2026-08-31

### Mobile (APK 1.8.47+56)
- Canales visibles únicamente donde el usuario es miembro (`/api/groups?membersOnly=1`).
- Pitido al liberar canal PTT (otro operador, no al soltar el propio botón).

### Added
- **APK 1.8.47+56:** lista de canales solo con membresía real; pitido breve cuando otro operador suelta el PTT.

### Changed
- **Web despacho:** chat y seguimiento en vivo filtrados al canal «Hablar en» + escucha; pánico «Ver en mapa» con zoom suave.

---

### Added (backlog)
- **APK pánico:** en la alerta, **Ver ubicación** y **Cómo llegar** (Google/Apple Maps) con coords del emisor (**1.8.39+48**).
- **Chat web — pegar imágenes (estilo WhatsApp):** Ctrl+V abre compositor con preview, caption, multi-imagen y herramientas (recortar/rotar, dibujar, texto, formas, mosaico, emoji, HD, deshacer). Grupo y DM.
- **Galería de imagen:** Copiar / Descargar en la vista ampliada (toolbar + clic derecho).

### Changed
- **Web chat grupal:** avatares de perfil en burbujas ajenas (estilo APK); banner de mensaje visible también durante llamada privada.
- **Seguimiento mapa:** etiqueta bajo marcador solo al seleccionar operador; mapa más limpio por defecto.
- **APK UI:** tipografía Oswald + Source Sans 3; Login/Radio/nav más profesionales. **1.8.39+48** (pánico con mapa/ruta).
- **APK UI:** tipografía Oswald + Source Sans 3; Login/Radio/nav más profesionales. **1.8.38+47** (fix historial inactivo).
- **APK UI:** tipografía Oswald + Source Sans 3; Login/Radio/nav más profesionales. **1.8.37+46** (fix envío mensajes DM/grupo).
- **APK UI:** tipografía Oswald + Source Sans 3; Login/Radio/nav más profesionales. **1.8.36+45** (MEJORAS.txt: globo chat, pánico en Seguimiento, scroll estable, avatares, PTT en pantalla completa, audio menos invasivo).
- **APK UI:** tipografía Oswald + Source Sans 3; Login/Radio/nav más profesionales. **1.8.35+44**.
- **PTT radio grupal:** toque para hablar / toque para soltar (app + web; Espacio = toggle). APK **1.8.34+43**.
- **Radio 1:1:** PTT por toque (abre / libera), conexión más rápida (LiveKit + mic en paralelo) y barra rediseñada (tarjeta + mic circular). APK **1.8.33+42**.
- **Seguimiento:** delimitación NL / Tamaulipas / SLP con frontera detallada (sin cortes falsos en ciudades).
- **Pánico acotado al grupo:** alertas (socket/FCM/consola/listado) solo a miembros del canal activo; sin escalada org-wide a admins o `canReceivePanic`.
- Consola: selector multi-canal en **Configuración → Canales**; barra superior muestra canal PTT + enlace.

### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- **APK llamadas:** foto de perfil en UI de llamada; al tocar el push se abre Contestar (antes se perdía la llamada) (**1.8.44+53**).
- **APK chat recibido:** burbujas ya no se recortan en el borde izquierdo; hora visible en mensajes cortos (DM + grupo, **1.8.43+52**).
- **Chat abierto:** tono suave tipo WhatsApp al leer el hilo; sin notificación fuerte duplicada (web + APK **1.8.42+51**).
- **Error 500 consola/APK:** API caída por bucle Watch-Stack vs `--watch`; BAT y watchdog reforzados (no matar :4000 si escucha, cooldown, log `levantar-*.log`).
- **Pánico mapa/ruta:** sirena no se detenía al pulsar Ver ubicación / Cómo llegar (web + APK **1.8.41+50**).
- **APK Ubicación GPS:** panel transparente se montaba sobre Radio; fondo opaco en overlay (**1.8.40+49**).
- **APK mensajes inactivo:** historial DM traía los más viejos; sync al volver/abrir chat; push con preview (**1.8.38+47**).
- **APK mensajes:** envío DM/grupo se confirmaba mal (join socket perdido + sin eco); corrección + optimistas (**1.8.37+46**).
- **APK MEJORAS.txt:** globo de mensajes en llamada y otras pestañas; pánico visible en Seguimiento; atrás minimiza llamada; scroll estable al volver a Radio; avatares en chat; indicativo en cabecera DM; PTT visible al maximizar radio 1:1; audio menos invasivo (**1.8.36+45**).
- **Web globo de chat:** banner global estilo WhatsApp en cualquier módulo (Despacho, Seguimiento, etc.); clic abre el chat correspondiente.
- **Web notificaciones:** con permiso activo, avisos del SO vía service worker (`sw-notify.js`); banner in-app de respaldo al volver a la pestaña.
- **Web chat DM:** palomitas de leído se actualizan en vivo (`markDmRead` + `dm:receipts`); banner de mensaje visible (no solo sonido) al recibir en otro chat.
- **Radio 1:1:** franja superior compacta (PTT); ya no invade el composer/teclado; chat usable en paralelo.
- **Foto de perfil APK:** el círculo verde era fallo de carga con `Image.network` + auth; ahora descarga con Bearer y muestra la imagen (1.8.31+40).
- **PTT al maximizar:** botón visible en Radio (layout) y flotante en Seguimiento a pantalla completa; PTT mini en la franja del despacho.
- **Despacho:** al volver de Seguimiento (u otro módulo) a Radio PTT, la conversación ya no salta de scroll; Radio queda montado en segundo plano.
- **Mensajes en llamada:** banner emergente visible encima de la UI de llamada (web + app); no se silencia por tener el chat abierto detrás.
- **Llamada / radio 1:1:** atrás (app) y ← / Esc (web) **minimizan** en lugar de colgar; solo Colgar corta.
- **API 500 vía borde público (Caddy):** `trust proxy` en dev cuando `PUBLIC_DOMAIN` o `TRUST_PROXY=1`; evita crash de rate-limit con `X-Forwarded-For`.
- **PTT móvil sin audio (LiveKit ICE):** UDP 7882 no escuchaba (rango 50000+ sin UPnP); config simplificada + rutas LAN/4G.

### Added
- **Configuración → Historial / Auditoría:** quién / qué / cuándo (solo admins); filtros y paginación sobre `activity_logs`.
- **Seguimiento:** delimitación tenue de NL, Tamaulipas y SLP sobre el mapa (fondo visible).
- **Indicativo al aire editable:** formato `SGTO GOMEZ`, `B.O. LINARES`, `S.O. IV R.M. (SALA…)`; login separado; grados SGTO/B.O./S.O./C.G.
- **Icono de grupo/canal:** foto en Catálogos → Grupos; visible en lista de chats y cabecera (web + APK).
- **Codemagic iOS:** `codemagic.yaml` (TestFlight + build IPA), checklist `IOS_TESTFLIGHT_CHECKLIST.md`, build sin Mac local.
- **Emojis y stickers** estilo WhatsApp en chat grupal y personal (web + APK): panel con categorías/búsqueda; APK alterna teclado ↔ panel.
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- **Radio personal 1:1** entre usuarios (PTT mantener-para-hablar), además de mensaje y llamada de voz; web + móvil + API `mode: radio`.
- Móvil: controles de llamada estilo WhatsApp/teléfono (altavoz, silenciar, teclado, mensaje en llamada, más).
- Consola Catálogos: **Grados y empleos** y **Dependencias** (forma ParqueVehicular; CRUD admin).
- Catálogo **Dependencias** importado idéntico a ParqueVehicular live: 6 RR.MM. / 15 ZZ.MM. / 48 organismos (`npm run import:pv-dependencias`).
- Consola **Configuración → Respaldos**: programados, manuales, descarga/restauración ZIP SQL.

### Changed
- **Uploads en disco:** organizados por org → jerarquía (región/zona/unidad) → carpeta de grupo; DM y avatares por org. Legado plano sigue sirviendo.
- Móvil: APK **1.8.32+41** — radio 1:1 arriba (PTT) sin tapar chat; OTA force.
- Móvil: APK **1.8.31+40** — fix avatar perfil (Bearer/`Image.memory`); OTA force.
- Móvil: APK **1.8.30+39** — emojis/stickers WhatsApp (grupal + DM); OTA force BanjeCel.
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- UI Dependencias: misma jerarquía y copy que PV (`Región Militar → Zona Militar → Organismos`, chips).
- Móvil: APK **1.8.25+34** — mute de radio (Silenciar) para no oír el canal; OTA force.
- Web chats: notificaciones estilo WhatsApp (tono, banner, título `(N)`, aviso SO al minimizar).

### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
- App: WebSocket Socket.IO fallaba con `…sslip.io:0/socket.io` (Dart `Uri.port == 0`); `AppConfig.socketUrl` fuerza `:443`.
- Web mapas: watermark CARTO «API KEY REQUIRED» — tiles sin key sustituidos por Esri Street / OSM (`mapTiles.js`).

### Security
- **Integridad host:** raíz canónica `C:\pulsanet`; health con TLS real + wire/content/voice; FCM path en C:; firewall `TacticalPtx-*` (9 reglas); `infra/check-integrity.ps1`. Despacho no degrada sealed→claro; voz E2EE no cae en silencio a SRTP-only.
- **HTTPS publico:** borde Caddy + Let's Encrypt (`*.sslip.io` o dominio propio) vía `infra/START-PUBLIC-EDGE.ps1`; guía `Soporte/Documentos/DOMINIO_Y_CERTIFICADO.md`.
- **Endurecimiento:** OTA con `APP_UPDATE_SECRET` + token HMAC; rate-limit login/OTA; Redis SCAN (no KEYS); LiveKit TURN UDP 3478; `ALLOW_HOST_LOCKDOWN=1`; script `infra/HARDEN.ps1`; guía `Soporte/Documentos/SEGURIDAD_HARDENING.md`.
- **Lockdown ante intrusión:** tras N fallos de login (IP/usuario) el servicio queda fuera de servicio, revoca sesiones, avisa por FCM y puede cerrar firewall/UPnP (`infra/LOCKDOWN.ps1`).
- `/api/metrics` deja de ser público (requiere rol despacho).
- Wire AES-GCM ampliado a pánico; GPS REST solo despacho; sin `contentKey` en cliente; `wireKey` solo en memoria; FCM de chat genérico; prod rechaza secretos de ejemplo; health sin detalle crypto en production; TLS móvil solo host API.

### Changed
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- Móvil: APK **1.8.21+30** — vaciar/borrar chats, miniatura imagen DM, burbujas WhatsApp; OTA `versionCode` 30.
- Móvil: APK **1.8.20+29** — chat personal (palomas, hora, swipe reply, envío optimista, atrás al inbox); presencia multi-dispositivo; OTA `versionCode` 29.
- Móvil: APK **1.8.19+28** — galería swipe de imágenes + links clicables en chat; OTA `versionCode` 28.
- Móvil: APK **1.8.18+27** — mute radio, adjuntos video/docs, colgado bilateral, icono verde, arranque más rápido; OTA `versionCode` 27.
- Móvil: APK **1.8.17+26** — chat/DM no queda tapado por el teclado; OTA activa (`versionCode` 26).
- Web **Seguimiento en vivo**: layout redistribuido (KPIs, capas sobre mapa, scroll interno en lista) y mapa acotado al viewport con borde inferior visible.
- Web mapas (Seguimiento / Mapa en vivo): marcadores muestran **foto de perfil** del operador en lugar de solo la inicial.
- Móvil: navegación en **2 pestañas** — **Chats** (inbox WhatsApp: Todos / No leídos / Favoritos / Grupos, favoritos locales, badges) y **Radio** (PTT, pánico, canales); Mapa y selector de canales en menú ⋮ del radio; pestaña inicial **Chats**; APK **1.8.16+25**.
- Web despacho — alta de usuario: **Especialidad** (tras grado) y **Cargo** (al final); columna `cargo` en BD; indicativo con cargo.
- Móvil: barra inferior con etiquetas (Mensajes, Mapa, Directos, Canales); cámara quitada del menú; adjuntos unificados en chat (+ → Galería/Cámara/Archivo); APK **1.8.15+24**.
- Web despacho — panel Usuarios: lista principal con skeleton, búsqueda/filtros, refresh suave y alta en modal.

### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
- Mapa seguimiento: «Hace X h» aclara GPS desactualizado (última señal al servidor); timestamps ISO UTC.
- Llamada personal: al colgar en un lado, la UI se cierra también en el otro (app y web); señal `call:ended` + desconexión LiveKit.
- Web despacho — **Usuarios** dejaba pantalla en blanco: faltaba `roleLabel()` al renderizar la tabla.
- Web DM: palomitas de lectura y iconos (favorito, enviar, llamada) ya no muestran `âœ"` por mojibake UTF-8.
- Móvil: tap en notificación de mensaje abre el chat de grupo o el DM correspondiente para responder (cold start tras bootstrap); APK **1.8.14+23**.
- Móvil/API: rechazo de avatar por MIME HEIC/`octet-stream`/vacío; multer + sniff magic bytes y `Content-Type: image/jpeg` en cliente; errores en español sin prefijo `Exception:`.
- Móvil: notificaciones de chat/DM se limpian al abrir/leer la conversación (estilo WhatsApp); APK **1.8.10+19**.
- Móvil: **Enterado** en alerta de pánico ya no cierra la app (doble `Navigator.pop` + stop de sirena seguro); APK **1.8.6+15**.

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Móvil: burbujas de chat (DM/grupo) más estéticas estilo WhatsApp.
- Inbox móvil: vaciar/borrar chats y vaciar grupos (estilo WhatsApp); miniaturas de imagen en chat personal (DM).
- Chat (web + app): galería de imágenes estilo WhatsApp — en vista ampliada, swipe / flechas entre todas las fotos del mismo chat (grupo y DM), con contador.
- App Radio: **mute de escucha** (botón altavoz) — silencia el audio del canal hasta desactivar; PTT propio no se afecta.
- Chat (web + app): envío de **videos**, **documentos** (PDF/Office) y **archivos** (ZIP/RAR/7z…) en grupos y DM; menú Foto/Video/Documento; reproductor de video y abrir/descargar archivo. Límites 10/15/25/50 MB (imagen/audio/docs/video).
- Web chat (Radio PTT): menú contextual estilo WhatsApp en mensajes (copiar, copiar imagen, descargar, responder, reaccionar) y barra de acciones en visor de imagen.
- Móvil: vibración fuerte nativa en pánico (sirena + patrón 500/200 en bucle hasta Enterado; ráfaga al pulsar PÁNICO); APK **1.8.13+22**.
- Móvil/web: puntos de presencia tipo Skype en la fila del canal — **verde** (en la app), **amarillo** (segundo plano / pantalla bloqueada), **rojo** reservado (offline; v1 quita el chip al desconectar). Backend `focus` en presence Redis + ping/join; APK **1.8.12+21**.
- Móvil: botón Pánico con `CircleBorder` + clip (sin highlight Material cuadrado); APK **1.8.12+21**.
- Móvil: recorte circular de foto de perfil (estilo WhatsApp: mover/zoom → JPEG) antes de subir; APK **1.8.11+20**.
- **Actualización APK en la app** (sin Google Play): al abrir muestra «Cargando configuración…», consulta `GET /api/app/android`, descarga e instala; ops con `PUBLISH-APK-UPDATE.cmd` y `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`.
- Jerarquía operativa: **Región** (admin maestro) → **Zonas / C.G.** (unidades subordinadas) → **Unidades** (servicios desplegados / usuarios); rol `unit_admin`.
- Privilegios de usuario **Ver Región / Zonas / Unidades** (`can_see_*`); canales y **seguimiento GPS** filtrados por privilegio/alcance.
- Multi-selección de canales en radio y despacho (escuchar varios; PTT en uno).
- Chat radio estilo WhatsApp: inbox unificado con pestañas **Todos / No leídos / Favoritos / Grupos**, favoritos locales y badges de no leídos.
- Banner de notificación in-app (arriba) al recibir DM o mensaje de grupo fuera del chat abierto.
- Organigrama **IV R.M.**: Región → zonas (C.G. + 4 Z.M. + apoyo) → 70 unidades; rol `zone_admin`; catálogo Unidades; `npm run seed:units`.
- **TLS opcional** en la API (`TLS_CERT` / `TLS_KEY`) + generador `infra/generate-lan-certs.mjs` / `npm run certs:lan`.
- **Cifrado wire** AES-256-GCM de eventos socket GPS/geocerca/pánico (`WIRE_ENCRYPTION_KEY`); login entrega `crypto.wireKey` (solo memoria).
- Sonido de **pánico**: tono hi-lo centrado (~780/980 Hz), menos agudo que la sirena wail.
- Alta de usuarios: **Grado** en desplegable con grados del Ejército Mexicano (Art. 129 LOEFAM).
- Alta de usuarios con **Grado, Especialidad, Nombre(s), Apellidos y Matrícula**; al aire figura indicativo (ej. Cap. Gomez) + nombre de canal.
- App móvil: con **pantalla bloqueada** sigue el radio (audio), notificaciones de mensajes y difusión GPS.
- Icono de perfil en app móvil; aparece en Seguimiento (mapa).

### Security
- **Lockdown ante intrusión:** tras N fallos de login (IP/usuario) el servicio queda fuera de servicio, revoca sesiones, avisa por FCM y puede cerrar firewall/UPnP (`infra/LOCKDOWN.ps1`).
- `/api/metrics` deja de ser público (requiere rol despacho).
- Wire AES-GCM ampliado a pánico; GPS REST solo despacho; sin `contentKey` en cliente; `wireKey` solo en memoria; FCM de chat genérico; prod rechaza secretos de ejemplo; health sin detalle crypto en production; TLS móvil solo host API.

### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
- Consola HTTPS remota: banner **xhr poll error** (Socket.IO) — mismo origen `/socket.io` vía Vite, WebSocket primero, limpia error al reconectar; mensaje en español si falla el transporte.
- Consola HTTPS remota: PTT LiveKit ya no falla por **mixed content** (`ws://:7880`); señal vía `wss://mismo-origen` + proxy Vite `/rtc`, media en 7881/7882 con `LIVEKIT_PUBLIC_HOST` / `--node-ip`.
- Rol `zone_admin` puede entrar a despacho/usuarios (`canDispatch` / `canManageUsers`).
- Pánico: **Enterado** silencia solo el dispositivo local; ya no cancela la alarma en todos los equipos.

### Changed
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- APK **1.8.9+18**: chat móvil estilo WhatsApp (burbujas/compositor/sin huecos); `API_BASE` sslip.io.
- APK **1.8.8+17**: `API_BASE=https://189.152.200.238.sslip.io` (cert LE, sin aviso de cert).
- APK **1.8.7+16**: OTA con secreto + endurecimiento; `API_BASE` 4G; `Soporte/APK/` + OTA `versionCode` 16.
- API / package **1.8.6** (alineado con línea móvil).
- APK **1.8.6+15**: fix Enterado en pánico; config 4G `https://189.175.38.29:4000`; `Soporte/APK/TacticalPtx-1.8.6+15.apk` + OTA `backend/app-updates/` (`versionCode` 15).
- APK **1.8.5+14**: config 4G `https://189.175.38.29:4000`; copia `Soporte/APK/TacticalPtx-1.8.5+14-4G.apk` + OTA `backend/app-updates/` (`versionCode` 14).
- APK **1.8.4+13**: config 4G `https://189.175.38.29:4000`; copia `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk` + OTA `backend/app-updates/`.
- Confirmaciones web con modal in-app (`AppDialog` / `sys-modal`) en lugar de `window.confirm` / `alert` (grupos, chat, geocercas).
- Radio móvil: PTT **circular** oliva/oro más táctil; pánico rojo urgente **sin confirmación** (primer toque).
- Radio web: mismo criterio de pánico al primer clic; PTT institucional circular.
- Marca unificada **TacticalPtx**; BD `tacticalptx_db`.
- Seguimiento: zoom con rueda **hacia el cursor** (estilo Google Maps).
- APK **1.8.3+12**: logo oliva/oro; API 4G `https://189.175.38.29:4000`; copia `Soporte/APK/TacticalPtx-1.8.3+12-4G-logo.apk`.
- Logo `tacticalptx.png`: acentos rojos → oliva/oro institucional (web + móvil).
- Composer DM con botón circular de envío y ticks de lectura; tono de aviso tipo WhatsApp.
- Despacho: **PTT mini** en la franja superior (Seguimiento, mapa, catálogos…) + Espacio para contestar sin ir a Radio.
- Chat radio: 2.ª corrección de scroll — anula `min-height:100dvh` del `.shell` embebido y fija la consola a viewport (`overflow` interno en `.wa-log`).
- APK **1.8.3+11**: fix PTT móvil (`setMicrophoneEnabled`) + API 4G; copia `Soporte/APK/TacticalPtx-1.8.3+11-4G-voicefix.apk`.
- LiveKit: `LIVEKIT_PUBLIC_HOST` unifica señal/ICE para web LAN y móvil 4G (evita “oigo pero no me oyen”).
- Chat de radio (grupo y DM): altura fija al viewport con **scroll interno** del historial (como WhatsApp); ya no alarga la página.
- LiveKit: bajo HTTPS web la señal va por proxy Vite (`wss` same-origin); `LIVEKIT_FORCE_WSS=1` solo si LiveKit termina TLS en :7880.
- Producción exige `CONTENT_ENCRYPTION_KEY`, `LIVEKIT_E2EE_SECRET` y `WIRE_ENCRYPTION_KEY` (≥32 chars).
- Catálogos: solo Usuarios y Grupos (Geocercas se gestionan en Mapa en vivo).
- Quitadas frases tipo “como WhatsApp” de la interfaz (Seguimiento, perfil).
- Login web/móvil más presentable: marca hero, atmósfera oliva/oro y tarjeta con acento dorado.
- Colores de la **app móvil** y de Seguimiento/llamadas web alineados a la paleta institucional (oliva `#243D20` / oro `#9A7B2F`).
- Seguimiento: botón **Maximizar** (pantalla completa); **Esc** o **Reducir** para salir. Esc también cierra lightbox y pantallas de llamada.
- Seguimiento en vivo: ubicaciones y rastro se actualizan solos cada **5 s** (alineado al GPS de la app); merge socket/poll y refresh al volver a la pestaña.
- APK **1.8.3+10**: 4G/5G vía IP pública `https://189.175.38.29:4000` (UPnP + firewall; sin Tailscale en el móvil).
- APK **1.8.3+9**: trust del certificado LAN en Dart (`LanTls`); corrige `CERTIFICATE_VERIFY_FAILED` al login HTTPS.
- APK **1.8.3+8**: `API_BASE` HTTPS LAN + trust cert autofirmado; TLS API activo.
- APK **1.8.3+7**: build LAN (`http://192.168.1.66:4000`); copia en `Soporte/APK/`.
- APK **1.8.2+6**: radio/GPS/mensajes en segundo plano reforzados.
- Interfaz web **institucional** (oliva/oro, Oswald, topbar + rail derecho) alineada a Reclutamiento IV R.M.
- Notificaciones móviles: **sin push/local en cada PTT**; solo mensajes y llamadas (pánico/geocerca se mantienen).
- Chat web/móvil: menú y controles **fuera** del texto de burbuja; DM con ancho máximo; toast DM no tapa el compositor.
- Seguimiento: bolitas de ubicación en vivo, rastro continuo y “seguir” operador; GPS stream en APK.
- **Cifrado:** AES-256-GCM de chat/DM en reposo; E2EE LiveKit de voz (PTT/llamadas) por room; wire GPS + TLS entre hosts.
- APK **1.8.1+5**: secure storage de sesión, tema institucional claro, HTTP con timeouts.
### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
- Voz PTT de regreso: LiveKit ICE/URL (LAN + IP externa); el proxy Vite ya no devolvía mal la IP de audio.
- Indicativo/`displayName` en PTT, sockets y GPS ya no queda congelado en el JWT: se lee de BD en cada request/conexión.
- Índice único de matrícula alineado en `schema.sql` (migración 014).
- Contraste en **tema oscuro** en toda la web (selects, botones, chat, tablas, pánico, popups del mapa).

---

## [1.8.0] — 2026-08-22

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
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
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
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
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
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
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Ticks de lectura en chat Radio (✓✓ enviado / leído / leído por todos)
- Tabla `message_reads`, socket `chat:read` / `chat:receipts`
- Doc `V1_7_1_READ_RECEIPTS.md`

### Changed
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- Botón de pánico también en Radio web (bajo PTT)

---

## [1.7.0] — 2026-08-11

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Botón de pánico en app móvil (canal)
- Tabla `panic_events` + flag `users.can_receive_panic`
- Notifica grupo + admin/despacho + usuarios con permiso
- Consola: banner de pánicos activos (enterado / resolver)
- Doc `V1_7_PANIC.md`

---

## [1.6.0] — 2026-08-11

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Reacciones y stickers en chat
- Docs `V1_6_REACTIONS.md`, `V1_6_STICKERS.md`

---

## [1.5.0] — 2026-08-11

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Chat Radio estilo WhatsApp: burbujas, reply, búsqueda, emojis, adjuntos, notas de voz, typing
- Tipo de mensaje `audio` + `reply_to_id`
- Doc `V1_5_CHAT_WHATSAPP.md`

### Changed
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- UI chat sustituye el panel plano anterior en Radio

---

## [1.4.0] — 2026-08-11

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Grabación PTT desde Radio web (MediaRecorder → `POST /api/recordings/groups/:id`)
- Listado y reproducción en Consola de despacho
- Tabla `ptt_recordings` (migración `004`)
- Tema claro/oscuro global (Login, Radio, Despacho)
- Bitácora de desarrollo y este CHANGELOG

### Changed
- Móvil: APK **1.8.26+35** — radio personal 1:1 + controles llamada WhatsApp; OTA force.
- Radio: layout con tarjeta PTT y copy de estados más claro
- Consola despacho: respeta tema claro/oscuro

---

## [1.3.0] — 2026-08-11

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Geocercas circulares (CRUD + evaluación enter/exit en GPS)
- Consola Command (mapa, canales, actividad, detalle)
- Login rediseñado (split marca / formulario)
- Mejoras FCM app: canal Android, foreground, token refresh

### Fixed
- **APK radio 1:1:** vuelve barra PTT arriba del chat (sin pantalla de llamada); llamada de voz sigue fullscreen (**1.8.45+54**).
- Móvil: ya no secuestra volumen/cámara (audio solo en radio/llamada; mic liberado; APK **1.8.27+36**).
- Script `start-services.ps1` (encoding PowerShell)
- Socket.IO web: URL directa a API + polling primero

---

## [1.2.0] — 2026-08-10

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
- Pipeline FCM (Firebase Admin + registro devices + push en chat/PTT)
- Documentación `FCM_PUSH.md`

---

## [1.1.0] — 2026-08-10

### Added
- Proyecto **iOS** preparado (bundle `com.tacticalptx.app`); IPA requiere Mac — ver `Soporte/Documentos/APP_IOS.md`.
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
