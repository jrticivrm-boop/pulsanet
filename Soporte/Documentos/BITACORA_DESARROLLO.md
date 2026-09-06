## 2026-09-06 — Fix Ver cámara splash + SafeArea Llamadas (1.8.81+91)

- **Tipo:** fix
- **Área:** mobile | web
- **Qué:**
  - FCM `private_remote_camera` ya no usa `IncomingCallWake`/`launchApp` si auto-accept (evita recrear Activity → splash).
  - Boot: si hay pending remote cam, se acepta en silencio y se difiere OTA forzada ~4 s.
  - FGS: al activar cámara se hace `forceRestart` para aplicar tipo `camera` (Android 14+).
  - Wake background: persist + bring UI; FGS camera lo arranca el isolate principal.
  - `PrivateCallHost`: si despacho marca `handled`, no abre overlay 1:1.
  - Cabecera **Llamadas**: `SafeArea` para no montarse bajo la barra de estado.
- **Archivos / refs:** main.dart, push_service.dart, remote_camera_wake.dart, incoming_call_wake.dart, background_radio.dart, radio_shell.dart, call_history_pane.dart, PrivateCallHost.jsx

## 2026-09-04 — Aislamiento video/monitor + estabilidad control (APK 1.8.72)

## 2026-09-06 — Rediseño web: Personas y llamadas

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Paleta Personas global (Ctrl+K) + ficha de acciones (mensaje / llamada / video / ver cámara).
  - Host único de llamadas (`PrivateCallHost`) entrantes y salientes; inbox con pestaña Personas y acciones rápidas.
  - DM: iconos de llamada visibles; grupo: roster completo + acciones por miembro; Radio “En línea” abre ficha.
  - Despacho alineado (layout, consola, video, seguimiento, usuarios → Contactar).
- **Archivos / refs:** peerActions.js, PrivateCallHost.jsx, PeoplePalette.jsx, PeerActionSheet.jsx, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, RadioPage.jsx, DispatchLayout.jsx, CommandCenter.jsx, DispatchVideo.jsx

## 2026-09-06 — UI llamada web: avatar + banner entrante

- **Tipo:** fix | ux | feature
- **Área:** web | mobile
- **Qué:**
  - Overlay de llamada muestra foto del usuario (`PersonAvatar`); avatar ya no se monta encima del texto (CSS `absolute` corregido).
  - Estados cortos («En llamada») sin repetir el nombre en cabecera y cuerpo.
  - Banner flotante global de llamada entrante (arriba/derecha) para Contestar/Rechazar sin abrir el panel de chat.
- **Archivos / refs:** IncomingCallHost.jsx, PrivateCallOverlay.jsx, DirectChat.jsx, App.jsx, styles.css, private_call_screen.dart

## 2026-09-06 — Fix OTA automática (APK 1.8.79+89)

- **Tipo:** fix | release
- **Área:** mobile | backend
- **Qué:**
  - OTA forzada vuelve a bloquear el arranque al detectar versión nueva (no solo al terminar).
  - Reintento tras login; timeout manifiesto 12s + 1 reintento; token descarga 1h.
  - Publicada **1.8.79+89**.
- **Archivos / refs:** main.dart, app_update.dart, appUpdate.js, Soporte/APK/TacticalPtx-1.8.79+89.apk

## 2026-09-06 — APK 1.8.78+88 (llamadas nítidas + E2EE + Alertas)

- **Tipo:** release
- **Área:** mobile
- **Qué:** Publicada OTA **1.8.78+88** (audio llamadas sin NS/DTX agresivo; sala+E2EE v3 por sesión; botón Alertas; timeout 5 timbres / llamada perdida; pantalla Contestar).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.78+88.apk

## 2026-09-06 — Llamadas: nitidez, E2EE e integridad

- **Tipo:** mejora | security | fix
- **Área:** mobile | web | backend
- **Qué:**
  - Audio de llamadas alineado con PTT (sin noise suppression/DTX/RED agresivos) → voz más nítida.
  - Sala LiveKit **única por llamada** + clave E2EE **v3** por sesión; fail-closed si `e2ee: true` sin clave.
  - Video ~2.8 Mbps + adaptiveStream + preferir framerate bajo congestión; token LiveKit TTL 1h.
- **Archivos / refs:** voiceE2ee.js, dm.js, livekit.js, video_streaming_config.dart, videoStreaming.js, livekitE2ee.js, private_call_screen.dart, PrivateCallOverlay.jsx

## 2026-09-06 — APK 1.8.77+87: botón Alertas + llamadas

- **Tipo:** release | ux
- **Área:** mobile | backend
- **Qué:** Publicada APK con botón Radio **Alertas** (ya no «PÁNICO»), textos de overlay/chat/FCM alineados; incluye fixes de llamada entrante y timeout 5 timbres.
- **Archivos / refs:** radio_screen.dart, radio_shell.dart, panic.js, Soporte/APK/TacticalPtx-1.8.77+87.apk

## 2026-09-06 — Llamada entrante a pantalla + 5 timbres / perdida

- **Tipo:** fix | feature | ux
- **Área:** mobile | backend | web
- **Qué:**
  - Entrante: abre pantalla Contestar (trae app al frente); FCM data-only sin banner del sistema; full-screen intent solo de respaldo en segundo plano.
  - Sin respuesta tras **5 timbres (~25 s)**: el servidor cuelga y manda push «Llamada perdida» al destino (estilo WhatsApp); el llamante ve «Sin respuesta».
- **Archivos / refs:** calls.js (sweeper), dm.js, server.js, incoming_call_wake.dart, MainActivity.kt, channel_session.dart, push_service.dart, radio_shell.dart

## 2026-09-06 — Botón Pánico → Alertas

- **Tipo:** ux
- **Área:** mobile | web
- **Qué:** La etiqueta del botón de pánico en Radio pasa de «PÁNICO» a «Alertas» (app y web).
- **Archivos / refs:** mobile/lib/screens/radio_screen.dart, web/src/pages/RadioPage.jsx

## 2026-09-06 — Contraste pantalla de llamada

- **Tipo:** ux
- **Area:** mobile
- **Que:** Fondos y botones de llamada mas claros/visibles; colgar en rojo vivo; titulo y etiquetas con mayor contraste.
- **Archivos / refs:** theme.dart (kInstCall*), private_call_screen.dart

## 2026-09-06 — APK 1.8.76+86 (arranke rapido + nav llamadas)

- **Tipo:** release
- **Area:** mobile
- **Que:** Publicada OTA **1.8.76+86** (splash sesion no bloquea por OTA; nav Chats/Llamadas/Radio abajo; timbre llamadas).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.76+86.apk

## 2026-09-06 — Nav inferior: Chats / Llamadas / Radio

- **Tipo:** ux
- **Area:** mobile
- **Que:** Llamadas pasan a la barra inferior junto a Chats y Radio; se quita el toggle Chats|Llamadas de arriba en el inbox.
- **Archivos / refs:** radio_shell.dart, chat_inbox_screen.dart, call_history_pane.dart

## 2026-09-06 — Reabrir app: sin splash «Cargando sesion» lento

- **Tipo:** fix | ux
- **Area:** mobile
- **Que:**
  - Arranque: carga sesion local primero y muestra home; OTA/Push/Shorebird en segundo plano.
  - RadioShell libera UI al tener grupos (LiveKit/FGS no bloquean).
  - Timeouts cortos en loadSession (4s) y fetchGroups (8s).
- **Archivos / refs:** mobile/lib/main.dart, mobile/lib/screens/radio_shell.dart

## 2026-09-06 — Timbre/vibracion llamadas + ciclo de vida

- **Tipo:** feature | fix
- **Area:** mobile | web | backend
- **Que:**
  - Timbre nativo Android (ringtone del sistema) + vibracion en bucle al recibir voz/video.
  - Canal FCM/local 	acticalptx_calls_v2 con USAGE_NOTIFICATION_RINGTONE + fullScreenIntent.
  - Tope de reconexion/connect; endPrivateCall en salidas fallidas; mensaje si la llamada ya expiro.
- **Archivos / refs:** MainActivity.kt, call_ringtone.dart, incoming_call_screen.dart, push_service.dart, private_call_screen.dart, PrivateCallOverlay.jsx, fcm.js — APK **1.8.75+85**

## 2026-09-06 — Eliminar Radio personal 1:1 (app + web)

- **Tipo:** feature | breaking
- **Area:** mobile | web | backend
- **Que:**
  - Retirada la opcion de iniciar Radio personal / PTT 1:1 en APK y Web.
  - API rechaza mode=radio en llamadas privadas.
  - Invitaciones residuales se rechazan automaticamente.
- **Archivos / refs:** peer_actions.dart, direct_pane.dart, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, calls.js

## 2026-09-04 — Mensaje permiso de camaras (APK)

- **Tipo:** ux
- **Area:** mobile
- **Que:**
  - Dialogo y textos de permiso de camara reducidos a: «Permiso de camaras unicamente».
- **Archivos / refs:** mobile/lib/screens/radio_shell.dart
- **APK:** 1.8.73+83

## 2026-09-04 — Reordenar modulos del menu lateral

- **Tipo:** feature | ux
- **Area:** web
- **Que:**
  - Arrastrar (asa ⋮⋮) los modulos del rail para reacomodarlos.
  - El orden se guarda en localStorage.
- **Archivos / refs:** DispatchLayout.jsx, institutional.css

## 2026-09-04 — Sin etiqueta de nombre bajo pins del mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Quitada la pastilla de nombre bajo el marcador; el detalle solo al seleccionar (panel/popup).
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

## 2026-09-04 — Indicativo desde Cargo / puesto

- **Tipo:** feature | ux
- **Area:** web | backend
- **Que:**
  - Eliminados campos Indicativo al aire y Detalle/expansion.
  - El nombre visible se arma solo: Grado + Apellido[, cargo] (ej. Sgto. 1/o. Gomez, desarrollador).
  - Quitados textos/ayudas del formulario de usuarios.
- **Archivos / refs:** rfcUsername.js, DispatchUsers.jsx, admin.js

## 2026-09-04 — Mas zoom en mapas de despacho

- **Tipo:** mejora | ux
- **Area:** web
- **Que:**
  - Zoom maximo del mapa sube a **22** (antes ~18), con overzoom sobre tiles nativos 19.
  - Ajuste automatico al grupo de operadores permite acercar mas (hasta 18).
- **Archivos / refs:** web/src/dispatch/mapTiles.js, LiveTrackMap, DispatchMap, CommandCenter, mapLeafletUtils

## 2026-09-04 — Formato de matricula (letra-guion-numeros)

- **Tipo:** feature | fix
- **Area:** web | backend
- **Que:**
  - Matricula siempre en formato Letra-Numeros (ej. A-1234, B-2048).
  - Mascara en el formulario de usuarios; validacion en API al crear/editar.
- **Archivos / refs:** web/src/matricula.js, backend/src/services/matricula.js, DispatchUsers.jsx, admin.js

## 2026-09-04 — Pins de ubicacion redondos (gota)

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Correccion: ubicaciones en mapa como pin gota redondo (foto circular), no cuadrado.
  - Se conservan colores, live, panico y avatar de cada usuario.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

## 2026-09-04 — Forma de pins de ubicacion en mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Marcadores de ubicacion: silueta gota/teardrop sustituida por badge cuadrado redondeado + punta triangular.
  - Colores (verde / en vivo / panico) y foto circular del usuario sin cambios.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

- **Tipo:** fix | security | mejora
- **Área:** web | mobile | backend
- **Qué:**
  - Ver cámara y videollamada ya no comparten flags ni pelean por la cámara (CameraSessionGate).
  - Control remoto deduplicado + cola de facing; fallos no cuelgan la sesión.
  - Conferencia Expandir sin remount LiveKit; monitor sin mic del puesto ni privateCallUi.
  - Exclusión mutua mismo peer (Ver cámara ↔ videollamada).
  - APK **1.8.72+82**.
- **Archivos / refs:** camera_session_gate.dart, 
emote_camera_session.dart, RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, privateCallUi.js

## 2026-09-03 — Fix cambio cámara frontal/trasera (APK 1.8.71)

- **Tipo:** fix
- **Área:** mobile | web
- **Qué:**
  - Control remoto también por socket principal + data packet LiveKit.
  - Cambio de cámara reinicia el track (off→on con facing nuevo); setCameraPosition no bastaba en FGS.
  - APK **1.8.71+80**.
- **Archivos / refs:** 
emote_camera_session.dart, channel_session.dart, PrivateCallOverlay.jsx

## 2026-09-03 — Conferencia multi-cámara + dock centrado

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Varias «Ver cámara» en un mosaico tipo conferencia (RemoteMonitorConference).
  - Dock del monitor: barra a ancho completo; EN VIVO a la izquierda y controles centrados (ya no el bloque de 26rem a la izquierda).
- **Archivos / refs:** RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, DispatchVideo.jsx, CommandCenter.jsx, command-center.css, styles.css

## 2026-09-03 — Multi-monitor + control frontal/trasera/mic

- **Tipo:** feature
- **Área:** web | backend | mobile
- **Qué:**
  - Varias «Ver cámara» a la vez, apiladas en el panel (Video y Command Center).
  - Control remoto: cámara frontal/trasera y micrófono ON/OFF del dispositivo.
  - API POST /private/:id/remote-control + socket call:remote_control.
  - APK **1.8.70+79** (FGS microphone al activar mic remoto).
- **Archivos / refs:** DispatchVideo.jsx, CommandCenter.jsx, PrivateCallOverlay.jsx, calls.js, 
emote_camera_session.dart

## 2026-09-03 — Monitor: centrado real + pantalla completa usable

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Corregido el colapso del stage (tile absolute → barra fea arriba).
  - Un solo video centrado en X/Y con flex; sin caja horizontal ancha.
  - **Pantalla completa** = alto completo del stage (marco vertical centrado).
- **Archivos / refs:** `styles.css`, `PrivateCallOverlay.jsx`

## 2026-09-03 — Monitor: centrado en pantalla + tamaño pantalla completa

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Un solo video queda **centrado en la pantalla** (absolute 50%/50%).
  - Nuevo tamaño **Pantalla completa** (`fill`) que ocupa todo el stage.
  - Tamaño solo en Expandir; al abrir Expandir arranca en pantalla completa.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`

## 2026-09-03 — Monitor Expandir: video centrado + tamaño funcional

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Un solo video queda **centrado** (Expandir y panel).
  - **Tamaño** solo en Expandir; escala real vía `--vc-solo-h` (40→84vh).
  - Quitado el control del panel normal; al Expandir arranca en Máximo.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 — UI monitor cámara: pantalla completa redistribuida

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Vista Expandir de «Cámara del dispositivo» tipo sala de monitoreo: chrome superior, stage a pantalla completa, dock inferior con estado EN VIVO + acciones; video portrait/landscape centrado y más usable.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `styles.css`

## 2026-09-03 — Ver cámara con app cerrada / suspendida (APK 1.8.69)

- **Tipo:** fix
- **Área:** mobile | backend
- **Qué:**
  - FCM en background ya no se ignora: guarda la solicitud, arranca FGS `camera` y **reabre la app** (sin Contestar) para publicar LiveKit.
  - Al reanudar/arranque se drena el pending y activa la cámara en silencio.
- **Archivos / refs:** `remote_camera_wake.dart`, `push_service.dart`, `radio_shell.dart`, `fcm.js`

## 2026-09-03 — Cámara remota con pantalla bloqueada (APK 1.8.68)

- **Tipo:** fix | feature
- **Área:** mobile | backend
- **Qué:**
  - FGS Android con tipo **`camera`** + wake/wifi lock para que «Ver cámara» no se suspenda al bloquear el teléfono.
  - Watchdog republica la cámara si el SO la apaga; FCM data-only (sin banner) para despertar con pantalla bloqueada.
- **Archivos / refs:** `background_radio.dart`, `remote_camera_session.dart`, `AndroidManifest.xml`, `fcm.js`, `calls.js`

## 2026-09-03 — Emoji/Stickers: safe area barra de navegación (APK 1.8.67)

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:** Los tabs Emoji/Stickers ya no se montan sobre los botones del sistema; padding inferior con `viewPadding`.
- **Archivos / refs:** `chat_emoji_panel.dart`

## 2026-09-03 — Chat: emojis y adjuntos mejorados (APK 1.8.66)

- **Tipo:** mejora | ux
- **Área:** web | mobile
- **Qué:**
  - Panel de emojis con tipografía color-emoji más nítida, acentos tácticos (sin verde WhatsApp), sin pestaña GIF vacía; móvil gana **búsqueda + recientes**.
  - Menú adjuntar tipo iconos (Galería / Cámara / Video / Documento); en móvil, vista previa + leyenda antes de enviar; fotos a mayor calidad.
- **Archivos / refs:** `WaEmojiPicker.jsx`, `styles.css`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_emoji_panel.dart`, `chat_attach_sheet.dart`, `emoji_data.dart`

## 2026-09-03 — Ver cámara silenciosa (sin aviso en el móvil) APK 1.8.65

- **Tipo:** fix | ux
- **Área:** mobile | backend
- **Qué:**
  - Con permiso previo, **Ver cámara** solo publica el feed a LiveKit: **sin push FCM, sin notificación local, sin vibración, sin snackbar y sin abrir panel de video** en el teléfono.
  - Sesión headless `RemoteCameraSession`; al colgar desde despacho se apaga sola.
- **Archivos / refs:** `remote_camera_session.dart`, `radio_shell.dart`, `channel_session.dart`, `backend/src/routes/calls.js`

## 2026-09-03 — Video nítido 720p + Expandir sin perder imagen (APK 1.8.64)

- **Tipo:** fix | mejora | ux
- **Área:** web | mobile
- **Qué:**
  - Codificación a **720p / ~3.2 Mbps / 30 FPS / VP8** (antes 540p “estable” se veía pixelada).
  - **Expandir** ya no deja el video negro: un solo mosaico enganchado al track (panel o fullscreen).
  - Panel de video en despacho: tamaños **Compacto / Mediano / Grande / Máximo** + pantalla completa más grande; `object-fit: contain` en 1 tile.
- **Archivos / refs:** `videoStreaming.js`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 — Cámara remota: permiso inicial + auto-aceptar (APK 1.8.63)

- **Tipo:** feature
- **Área:** mobile | web
- **Qué:**
  - Al entrar a la app (primera vez): diálogo para permitir que **despacho active la cámara** + permiso del SO.
  - Con eso activo, **Ver cámara** desde el panel web acepta sola (sin Contestar); snackbar «Despacho activó tu cámara».
  - Interruptor en perfil del móvil para activar/desactivar.
- **Archivos / refs:** `remote_camera_prefs.dart`, `radio_shell.dart`, `channel_session.dart`, `DispatchVideo.jsx`

## 2026-09-03 — Intermitencia video: ICE/UPnP + bitrate + reconnect (APK 1.8.62)

- **Tipo:** fix | infra
- **Área:** infra | web | mobile
- **Qué:**
  - LiveKit usaba puertos UDP altos (50000+) **sin UPnP** → media 4G inestable; vuelto a **UDP mux 7882** + relays TURN 30000–30010 mapeados.
  - Video a **540p / 1.2 Mbps / VP8 / sin simulcast** (prioridad continuidad en 4G).
  - Stabilizer deja de spamear “Reconectando…” en microcortes; LiveKit reiniciado.
  - APK **1.8.62+71** OTA.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `Reinforce-UPnP.ps1`, `videoStreaming.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`

## 2026-09-03 — Video negro: VP8 + attach srcObject (APK 1.8.61)

- **Tipo:** fix
- **Área:** web | mobile
- **Qué:**
  - Causa típica de tiles negros con audio OK: **H.264 + E2EE** entre web y APK.
  - Codec de publicación vuelve a **VP8**; attach del mosaico vía `MediaStream`/`srcObject`; dynacast off; monitor sin tile local vacío.
  - APK **1.8.61+70** OTA.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`

## 2026-09-03 — APK 1.8.60+69 (estabilidad video)

- **Tipo:** fix | release
- **Área:** mobile
- **Qué:**
  - Compilada y publicada OTA **APK 1.8.60+69** con fixes de parpadeo/intermitencia de video (simulcast 480/720, adaptiveStream off, reconnect suave).
  - `API_BASE=https://pulsanet.duckdns.org`; `APP_VERSION` backend → **1.8.60**.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.60+69.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-09-03 — Estabilidad video (fin de parpadeo / intermitencia)

- **Tipo:** fix
- **Área:** web | mobile
- **Qué:**
  - Baja carga de uplink: simulcast 480p+720p (~6 Mbps) en lugar de 480+720+1080 (~14.5 Mbps) que saturaba la red.
  - `adaptiveStream` desactivado (evitaba resubscribe al redimensionar tiles).
  - No republicar cámara en cada `Reconnected` salvo track muerto; debounce de unsubscribes; mosaico mantiene último frame.
  - Stabilizer: no fuerza `connect` encima de la reconexión interna de LiveKit; delays más largos.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `usePrivateCallTiles.js`, `useGroupVideo.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`, `private_call_screen.dart`, `group_video_screen.dart`

## 2026-09-03 — Perfiles video RTMP-like (480/720/1080 @ 30 FPS)

- **Tipo:** mejora
- **Área:** web | mobile
- **Qué:**
  - Publicación LiveKit con perfiles tipo RTMP externo: H.264, 30 FPS, techos CBR-like **480p/1500 Kbps**, **720p/4500 Kbps**, **1080p/8500 Kbps** (simulcast + captura 1080).
  - Audio de sala a Opus HQ stereo (~AAC 128 kbps); captura con fallback 1080→720→540 si el dispositivo no abre Full HD.
- **Por qué / notas:** WebRTC no tiene CBR estricto ni AAC en el peer; el techo de bitrate + `maintain-framerate` aproximan el perfil pedido. AAC real solo en egress RTMP externo.
- **Archivos / refs:** `web/src/videoStreaming.js`, `web/src/useGroupVideo.js`, `web/src/PrivateCallOverlay.jsx`, `mobile/lib/video_streaming_config.dart`

## 2026-09-03 — Ver cámara del dispositivo desde consola Video

- **Tipo:** feature
- **Área:** web | backend | mobile
- **Qué:**
  - Desde **Despacho → Video** (y Operaciones): botón **Ver cámara** solicita activar la cámara del dispositivo de campo y proyecta el feed en el panel (sin publicar cam del puesto por defecto).
  - Intent `remote_camera`: FCM/socket «Solicitud de cámara»; en el móvil se muestra «Despacho solicita ver tu cámara» y se prioriza cámara **trasera**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `dm.js`, `DispatchVideo.jsx`, `CommandCenter.jsx`, `PrivateCallOverlay.jsx`, `incoming_call_screen.dart`, `private_call_screen.dart`, `radio_shell.dart`

## 2026-09-03 — Video negro en consola / tras reconectar

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Vista previa de cámara: stream se enganchaba a un `<video>` que luego se desmontaba.
  - Videollamada en consola: mosaico sin altura útil + tile local no se refrescaba; tras «Conexión restaurada» no se republicaba la cámara (frame negro con «Apagar cam» activo).
- **Archivos / refs:** `DispatchVideo.jsx`, `PrivateCallOverlay.jsx`, `usePrivateCallTiles.js`, `VideoConferenceMosaic.jsx`, `useGroupVideo.js`, CSS

## 2026-09-03 — Vista previa cámara consola negra

- **Tipo:** fix
- **Área:** web
- **Qué:** En módulo Video, al activar cámara web el preview quedaba negro porque el stream se enganchaba a un `<video>` que luego se desmontaba. Ahora el elemento es estable y se re-engancha el stream.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `command-center.css`

## 2026-09-03 — Ancla DuckDNS pulsanet + APK 1.8.59

- **Tipo:** infra | fix
- **Área:** infra | mobile
- **Qué:**
  - Dominio permanente **`pulsanet.duckdns.org`** configurado (DuckDNS A → IP pública; Sync/Watch lo mantienen).
  - Caddy + Let's Encrypt en ese host; `.env` / APK default apuntan ahí.
  - APK **1.8.59+68** OTA con `API_BASE=https://pulsanet.duckdns.org`.
- **Por qué / notas:** Ya no hace falta republicar APK cuando el ISP cambie la IP.
- **Archivos / refs:** `Soporte/Secrets/stable-domain.env`, `infra/caddy/stable-domain.txt`, `mobile/lib/config.dart`

## 2026-09-03 — APK ancla dominio permanente (anti-desfase IP)

- **Tipo:** fix | infra | feature
- **Área:** mobile | infra
- **Qué:**
  - Causa: APK apuntaba a `189.152.222.98.sslip.io` (IP vieja); el ISP ahora es `189.152.160.81`.
  - APK **1.8.58+67** OTA con `API_BASE=https://189.152.160.81.sslip.io`; borde Caddy realineado.
  - Ancla permanente: DuckDNS vía `infra\SETUP-STABLE-DOMAIN.ps1` + `Sync-PublicIp` (actualiza A-record al cambiar IP; el APK ya no depende de `IP.sslip.io`).
  - Login móvil: opción **Servidor** para fijar URL si aún no hay OTA.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `SETUP-STABLE-DOMAIN.ps1`, `START-PUBLIC-EDGE.ps1`, `mobile/lib/config.dart`, `login_screen.dart`, `Publish-ApkUpdate.ps1`

## 2026-09-03 — Módulo Video en despacho + cámara consola

- **Tipo:** feature | fix | ux
- **Área:** web
- **Qué:**
  - Menú **Video** en el rail de despacho (junto a Operaciones / Seguimiento) → `/despacho/video`.
  - Consola con canales (iniciar/unirse a transmisión), operadores en línea (videollamada 1:1) y botón **Activar cámara web** del puesto (vista previa + permiso del navegador).
  - Controles de cámara con texto claro en panel de consola; fix Radio PTT: el botón «Video en vivo» ahora envía `groupId`.
- **Por qué / notas:** Faltaba un módulo dedicado y una opción explícita de cámara en consola; el botón de Radio no abría la sesión.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `DispatchLayout.jsx`, `App.jsx`, `GroupVideoPanel.jsx`, `RadioPage.jsx`

## 2026-09-03 — Marcador en mapa: anillo rojo parpadeante en pánico

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** Al activar pánico, el círculo verde del pin del operador en el mapa pasa a rojo y parpadea (Centro de mando, Mapa en vivo y Mapa de despacho) hasta que el evento se cierra.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `command-center.css`, `CommandCenter.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`

## 2026-09-03 — Sin pin de pánico en (0,0)

- **Tipo:** fix | ux
- **Área:** web | mobile
- **Qué:** El mapa ya no dibuja «Punto de pánico» en coordenadas `0,0` (Null Island). Se trata como sin GPS; botones de mapa solo con ubicación válida.
- **Por qué / notas:** Ese pin no era un operador real: pánico enviado sin GPS fijado.
- **Archivos / refs:** `web/src/panicMaps.js`, `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/DispatchPanicHost.jsx`, `mobile/lib/panic_maps.dart`

## 2026-09-02 — Acceso LAN por IP + stack caído / IP pública nueva

- **Tipo:** fix | infra
- **Área:** infra
- **Qué:**
  - Causa de «no entra» por `192.168.68.51`: esa IP **no es** del servidor (LAN actual `192.168.1.216`); además API/Web/Caddy estaban caídos.
  - Borde Caddy ahora sirve también **`https://192.168.1.216`** (cert interno).
  - IP pública del ISP cambió a **`189.152.160.81`** → dominio `https://189.152.160.81.sslip.io`.
  - LiveKit no arrancaba por YAML corrupto (`control characters`); reescrito `livekit.dev.yaml`.
- **Archivos / refs:** `infra/Caddyfile.edge.template`, `infra/START-PUBLIC-EDGE.ps1`, `infra/livekit.dev.yaml`

## 2026-09-02 — Menú Video + cambio cámara frontal/trasera

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:**
  - Opción **Video en vivo** en menú Radio (☰), menú del chat de grupo y menú de Directos (Videollamada).
  - En videollamada 1:1 y transmisión grupal: botón para alternar **cámara frontal ↔ trasera** (web + mobile); preview local sin espejo en trasera.
- **Por qué / notas:** Equipos institucionales con permisos de cámara; el agente debe poder mostrar entorno (trasera) o rostro (frontal) sin salir de la llamada.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `private_call_screen.dart`, `group_video_screen.dart`, `web/src/PrivateCallOverlay.jsx`, `web/src/useGroupVideo.js`, `web/src/videoStreaming.js`

## 2026-09-01 — Video grupal: cierre global + aceptar sin parpadeo

- **Tipo:** fix
- **Área:** backend | web | mobile
- **Qué:**
  - **`group:video_ended`** llega a todos los miembros por sala `user:*` (no solo canal PTT) — al colgar/terminar cierra video e invitación en web y mobile.
  - **Web:** panel único en `App` al aceptar invitación (sin navegación retrasada ni doble conexión LiveKit).
  - **Mobile:** al aceptar o tocar notificación abre video directo (sin cambiar canal PTT); evita pop accidental del diálogo sobre la pantalla de video.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/GroupVideoSessionHost.jsx`, `web/src/useGroupVideo.js`, `mobile/lib/screens/radio_shell.dart`

## 2026-09-01 — Fix entrega notificaciones video grupal + modo teléfono

- **Tipo:** fix
- **Área:** backend | mobile
- **Qué:**
  - Invitación grupal por **tres vías**: socket `user:*`, socket `group:*` (canal PTT) y FCM **por miembro** (`notifyUserDevices`, igual que llamadas 1:1).
  - Join explícito a sala `user:{id}` en cada conexión socket del servidor.
  - Mobile: escucha también `group:video_started`; deduplica invitaciones; notificación local respeta **silencio / vibrador / sonido** del teléfono.
- **Por qué / notas:** La invitación solo iba a `user:*` y el batch FCM podía no entregar; miembros en el canal del grupo no recibían evento si fallaba la sala personal.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/server.js`, `backend/src/services/fcm.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 — Notificaciones transmisión grupal (FCM + socket + tono/vibración)

- **Tipo:** feature | fix
- **Área:** backend | web | mobile
- **Qué:**
  - Al iniciar video grupal: push FCM a miembros + evento `group:video_incoming` por sala `user:*` (llega aunque no estén en el canal PTT).
  - Web: pantalla **Unirse/Ignorar** con tono de llamada; mobile: pantalla entrante estilo llamada + canal `tacticalptx_calls`.
  - Vibración respeta modo **silencio** del teléfono (Android); sonido usa tono del sistema (respeta vibrador/silencio).
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/services/fcm.js`, `web/src/GroupVideoIncomingHost.jsx`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 — Fix video grupal: cámara local no se mostraba

- **Tipo:** fix
- **Área:** web
- **Qué:** Corregido bug donde el mosaico quedaba en «Sin cámara» aunque LiveKit publicara video (rebuild de tiles antes de actualizar estado); lectura de track desde `camRef`/publicación local; warmup de permisos; fallback 720→540.
- **Archivos / refs:** `web/src/useGroupVideo.js`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 — UX video grupal web: botones visibles en Radio y Despacho

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Botón **Video en vivo** con etiqueta (ya no solo emoji) en header del chat de grupo; mismo control en panel PTT de Radio; botón por canal en consola **Operaciones** (Despacho).
- **Por qué / notas:** El acceso solo estaba en chat y era fácil de no ver; Operaciones no tenía chat integrado.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 — Streaming video grupal + HD 720p (1.8.57)

- **Tipo:** feature | mejora
- **Área:** backend | web | mobile | database
- **Qué:**
  - **Video grupal en vivo:** sala LiveKit paralela `gvid_*` (no interrumpe PTT audio); API `/api/group-video`, eventos socket `group:video_*`.
  - **Web/despacho:** botón 📹 en chat de grupo, panel mosaico `GroupVideoPanel`, E2EE + simulcast/adaptiveStream.
  - **Mobile:** pantalla `GroupVideoScreen`, botón en header del chat de grupo; videollamada 1:1 sube a **720p**.
  - APK **1.8.57+66** publicada OTA.
- **Por qué / notas:** PTT sigue en `grp_*` audio-only; video es opt-in en segunda conexión.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/useGroupVideo.js`, `web/src/GroupVideoPanel.jsx`, `mobile/lib/screens/group_video_screen.dart`, `database/migrations/022_group_video_sessions.sql`

## 2026-09-01 — APK 1.8.56+65 (fixes llamadas + estabilizadores)

- **Tipo:** release | ops
- **Área:** mobile | backend
- **Qué:** Compilada y publicada APK **1.8.56+65** (UI llamadas, apagar cámara, estabilizadores de red, historial).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.56+65.apk`, `backend/app-updates/files/TacticalPtx.apk`

## 2026-09-01 — Abreviatura Mayor: Myr.

- **Tipo:** fix
- **Área:** backend | web
- **Qué:** Corregida abreviatura de **Mayor** de `May.` a `Myr.` en catálogo y UI; migración actualiza registros existentes.
- **Archivos / refs:** `backend/src/data/defaultGrades.js`, `web/src/dispatch/armyGrades.js`, `database/migrations/021_mayor_abbreviation_myr.sql`

## 2026-09-01 — Fix UI llamadas: iconos + apagar cámara

- **Tipo:** fix | ux
- **Área:** web | mobile
- **Qué:**
  - Web: eliminado auto-reencendido de cámara cada 400 ms al apagarla en videollamada; toggle respeta elección del usuario.
  - Web/mobile: apagar cámara vía unpublish/`setCameraEnabled(false)` con fallback por publicación.
  - Mobile: dock de controles fijo abajo (sin montarse sobre video); PiP local arriba-derecha.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`, `mobile/lib/screens/private_call_screen.dart`

## 2026-09-01 — Estabilizadores virtuales llamadas (voz / radio / video)

- **Tipo:** mejora | fix
- **Área:** backend | web | mobile
- **Qué:**
  - Periodo de gracia (~28 s) ante caídas LiveKit: no cuelga al instante si el peer se desconecta brevemente.
  - Ping cada 15 s (`POST /private/:id/ping`) + refresh de token LiveKit (`POST /private/:id/refresh`).
  - Web: `privateCallStabilizer.js` en overlay, radio bar y opciones resilientes en `livekitE2ee.js`.
  - Mobile: `PrivateCallStabilizer` en llamada privada y radio personal; reintento automático al fallar connect.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/privateCallStabilizer.js`, `mobile/lib/private_call_stabilizer.dart`

## 2026-09-01 — Consola web: panel videoconferencia en mosaico

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Nuevo componente `VideoConferenceMosaic` con grid adaptativo (1–N participantes) y attach/detach estable por tile.
  - `PrivateCallOverlay` usa mosaico en videollamadas; modo `console` embebido en despacho con mapa/canales visibles.
  - Panel **Videoconferencia** en Command Center: expandir a pantalla completa, controles integrados.
- **Archivos / refs:** `web/src/VideoConferenceMosaic.jsx`, `web/src/usePrivateCallTiles.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/dispatch/CommandCenter.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`

## 2026-09-01 — Historial de llamadas + UI profesional (APK 1.8.55)

- **Tipo:** feature | ux
- **Área:** backend | mobile | database
- **Qué:**
  - Tabla `private_call_logs` y API `GET /api/calls/history` (voz, video, radio; perdidas/completadas).
  - Inbox mobile con pestaña **Chats | Llamadas** e historial agrupado por fecha (estilo WhatsApp).
  - Pantalla entrante con gradiente y badge de modo (VOZ / VIDEO / RADIO).
  - APK **1.8.55+64** compilada y publicada OTA.
- **Archivos / refs:** `database/migrations/020_private_call_logs.sql`, `backend/src/services/dm.js`, `backend/src/routes/calls.js`, `mobile/lib/screens/call_history_pane.dart`, `mobile/lib/screens/chat_inbox_screen.dart`, `mobile/lib/screens/incoming_call_screen.dart`

## 2026-09-01 — Fix videollamada: cámara auto, colgar ambos lados, menú web

- **Tipo:** fix | ux
- **Área:** web | mobile
- **Qué:**
  - Cámara se activa sola al contestar/iniciar videollamada (permisos en gesto del usuario + fix mobile `_room` null).
  - Colgar cierra en ambos extremos: teardown LiveKit + `call:ended` en inbox/despacho.
  - Menú **Llamar ▾** en chat directo (voz / video / radio); videollamada en panel Seguimiento y menú de canal.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/callMedia.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`, `mobile/lib/screens/private_call_screen.dart`


- **Tipo:** release | ops
- **Área:** mobile | backend
- **Qué:**
  - Compilada y publicada APK **1.8.53+62** con `API_BASE=https://189.152.222.98.sslip.io`.
  - Copias: `Soporte/APK/TacticalPtx-1.8.53+62.apk`, OTA `backend/app-updates/files/TacticalPtx.apk`, manifest `android.json` actualizado.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`

## 2026-09-01 — Videollamadas 1:1 + solicitud de cámara (web + mobile)

- **Tipo:** feature
- **Área:** backend | web | mobile
- **Qué:**
  - Modo `video` en llamadas privadas LiveKit (salas `video_*`, E2EE igual que voz).
  - API REST + sockets: `/video/request`, `/video/respond`, `/video/stop` con consentimiento explícito.
  - Web: overlay con preview local/remoto, botón videollamada en DM e inbox; solicitud de cámara en llamada de voz.
  - Mobile: `PrivateCallScreen` con `VideoTrackRenderer`, permisos cámara, FCM `private_video` / `private_video_request`.
  - Versión **1.8.53+62**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/DirectChat.jsx`, `mobile/lib/screens/private_call_screen.dart`, `mobile/lib/api_client.dart`

## 2026-09-01 — Resiliencia IP pública + LiveKit ICE (auto-sync)

- **Tipo:** infra | fix
- **Área:** infra | ops
- **Qué:**
  - Nuevo `infra/Sync-PublicIp.ps1`: detecta cambio de IP (ipify vs `.env`/`public-ip.txt`/`livekit.dev.yaml`) y realinea `.env`, YAML y `--node-ip`.
  - `ENSURE-PUBLIC-EDGE` y `Watch-Stack` fuerzan `START-PUBLIC-EDGE` ante **drift** aunque Caddy responda 200.
  - `START-PUBLIC-EDGE` sincroniza `node_ip` + reinicia LiveKit; `start-services` prefiere ipify sobre `.env` viejo.
  - `check-integrity` valida alineación IP + health del borde público; quitados fallbacks a IP `189.152.200.238`.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `ENSURE-PUBLIC-EDGE.ps1`, `START-PUBLIC-EDGE.ps1`, `start-services.ps1`, `Watch-Stack.ps1`, `check-integrity.ps1`

## 2026-09-01 — LiveKit ICE móvil 4G: node-ip fija tras cambio ISP

- **Tipo:** fix | infra
- **Área:** infra | mobile
- **Qué:**
  - Tras instalar APK 1.8.52, móvil conectaba API pero fallaba audio: `MediaConnectException` (ICE timeout).
  - Causa: LiveKit seguía anunciando candidatos con IP vieja vía STUN; puertos media/TURN ya reenviados por UPnP.
  - Fix: `livekit.dev.yaml` → `node_ip: 189.152.222.98`, `use_external_ip: false`, `advertise_internal_ip: true`; `start-services.ps1` pasa `--node-ip` desde `LIVEKIT_PUBLIC_HOST`; UPnP/firewall refrescados.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `infra/Reinforce-UPnP.ps1`

## 2026-09-01 — Fix LiveKit: IP pública nueva + señal wss same-origin

- **Tipo:** fix | infra | release
- **Área:** web | infra | mobile | backend
- **Qué:**
  - IP pública cambió **189.152.200.238 → 189.152.222.98**; Caddy/borde caído → «No se pudo conectar el audio (LiveKit)».
  - `ENSURE-PUBLIC-EDGE`: Caddy + cert LE en `https://189.152.222.98.sslip.io`; LiveKit reiniciado.
  - Web: `livekitUrl.js` usa **siempre** `wss://mismo-origen` bajo HTTPS (proxy `/rtc`, sin hairpin al dominio viejo).
  - `.env` alineado; APK **1.8.52+61** OTA con `API_BASE=https://189.152.222.98.sslip.io`.
- **Archivos / refs:** `web/src/livekitUrl.js`, `backend/.env`, `mobile/lib/config.dart`, `infra/ENSURE-PUBLIC-EDGE.ps1`

## 2026-09-01 — APK 1.8.51+60 OTA (MEJORAS.txt + audio)

- **Tipo:** release | fix
- **Área:** mobile | backend
- **Qué:**
  - Publicada **APK 1.8.51+60** OTA con fix de audio (libera sesión al silenciar escucha de radio).
  - Incluye también los fixes web/backend de MEJORAS.txt del mismo día (pánico, llamadas, chat, PTT).
  - `APP_VERSION` backend → **1.8.51**; `TacticalPtx-latest.apk` actualizado.
- **Archivos / refs:** pubspec.yaml, version.js, android.json, channel_session.dart, Publish-ApkUpdate.ps1

## 2026-09-01 — MEJORAS.txt: pánico, llamadas, chat, PTT y audio

- **Tipo:** fix | mejora | ux
- **Área:** web | backend | mobile
- **Qué:**
  - **Pánico en Seguimiento:** `DispatchPanicHost` en portal a `body`, botón «Silenciar alarma», fallback con `ptt.incomingPanic`, sale de pantalla completa al recibir alerta.
  - **Llamadas:** overlay portaled; atrás/Esc minimiza (no cuelga); banner `dm:notify` durante llamada/radio privada; `peerId` en sesión de llamada.
  - **Chat Radio:** conserva scroll al volver desde Seguimiento (`chatActive`); avatares de perfil en burbujas (`senderAvatarUrl` en API).
  - **Mapa maximizado:** botón PTT flotante también en Mapa en vivo (`DispatchMap`).
  - **Mobile:** suelta sesión de audio del SO cuando radio en mute de escucha.
- **Notas (#6 indicativos):** `display_name` en BD ya es el indicativo (`SGTO GOMEZ`, etc.) vía admin; usuarios viejos pueden regenerarse con `rebuild-callsigns.js`.
- **Archivos / refs:** DispatchPanicHost.jsx, PrivateCallOverlay.jsx, WhatsAppChat.jsx, DispatchMap.jsx, chat.js, channel_session.dart, userDisplay.js

## 2026-09-01 — Limpieza post-rollback 1.8.49 + housekeeping

- **Tipo:** fix | ops | security
- **Área:** mobile | backend | ops
- **Qué:**
  - Eliminados `screen_security.dart`, `settings_screen.dart` y canal `FLAG_SECURE` en Android (restos del rediseño 1.8.49).
  - Imports muertos en `radio_shell.dart`; `APP_VERSION` backend alineado a **1.8.50**.
  - `Usuario y contra.txt` movido a `Soporte/Secrets/`; `TacticalPtx-latest.apk` apunta a **1.8.50+59**.
- **Archivos / refs:** MainActivity.kt, radio_shell.dart, version.js, .gitignore

## 2026-09-01 — Rollback UI: APK 1.8.50 (tema claro, como 1.8.48)

- **Tipo:** fix | release
- **Área:** mobile
- **Qué:**
  - Revertido tema táctico oscuro/camo de 1.8.49; restaurado look institucional claro (oliva/oro) como 1.8.48.
  - APK **1.8.50+59** publicada OTA; reemplaza 1.8.49+58 en el servidor.
- **Por qué / notas:** El usuario no aprobó el rediseño 1.8.49; OTA no puede bajar versionCode, por eso se publica 1.8.50 con el aspecto anterior.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, chat_bubble_style.dart, pubspec.yaml, Publish-ApkUpdate.ps1

## 2026-08-31 — Coordenadas clicables → Google Maps en detalles GPS

- **Tipo:** feature | ux
- **Área:** web
- **Qué:** En popup del marcador y panel de detalle (Seguimiento / Consola / Mapa) se muestran lat/lng; al hacer clic abren Google Maps en esa posición.
- **Archivos / refs:** MapCoordsLink.jsx, LiveTrackMap.jsx, DispatchMap.jsx, CommandCenter.jsx, panicMaps.js

## 2026-08-31 — APK tema táctico camo + seguridad (1.8.49)

- **Tipo:** ux | security | release
- **Área:** mobile
- **Qué:**
  - Tema oscuro olive/camo digital en chat, inbox, DM, canales, login y **Configuración**.
  - Bloqueo de capturas (`FLAG_SECURE`) activable en Configuración (activo por defecto).
  - APK **1.8.49+58** publicada OTA.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, settings_screen.dart, screen_security.dart, MainActivity.kt, chat_panel.dart, Publish-ApkUpdate.ps1

## 2026-08-31 — Marcadores mapa estilo pin/gota verde

- **Tipo:** ux
- **Área:** web
- **Qué:** Iconos de ubicación en Seguimiento/Mapa pasan a pin teardrop verde (borde + aro claro + punta); siguen mostrando foto de perfil o inicial.
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

\n## 2026-08-31 — Seguimiento: panel lista colapsable (acordeón)

- **Tipo:** ux
- **Área:** web
- **Qué:** Botón Ocultar/Lista en Seguimiento en vivo; al colapsar queda franja estrecha y el mapa gana espacio. Preferencia en localStorage.
- **Archivos / refs:** LiveTrackMap.jsx, command-center.css

\## 2026-08-31 — Maximizar en Mapa en vivo

- **Tipo:** ux
- **Área:** web
- **Qué:** Botón Maximizar/Reducir (pantalla completa + Esc) en Mapa en vivo, igual que Seguimiento.
- **Archivos / refs:** DispatchMap.jsx, command-center.css

\nn## 2026-08-31 — Parpadeo «en vivo» estable en todos los Host PC

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Anillos del mapa ya no usan 	ransform (conflicto con Leaflet/GPU en otras PCs); pulso por ox-shadow.
  - isFresh tolera desfase de reloj entre Hosts (hasta ~2 min) para no perder el estado en vivo.
- **Archivos / refs:** web/src/dispatch/command-center.css, liveTiming.js

\## 2026-08-31 — Tono de mensaje táctico (web + APK 1.8.48)

- **Tipo:** ux | release
- **Área:** web | mobile | backend
- **Qué:**
  - Reemplazado tono Nokia SMS por chirp radio (doble pip 980/1320 Hz), acorde a TacticalPtx.
  - APK **1.8.48+57** OTA; canal Android 	acticalptx_alerts_radio; FCM usa 	actical_msg.
- **Archivos / refs:** web/public/sounds/message.wav, mobile/assets/sounds/tactical_msg.wav, push_service.dart, cm.js

\nn## 2026-08-31 — Seguimiento en vivo filtrado por canal activo

- **Tipo:** ux | fix
- **Área:** web | backend
- **Qué:** Mapa de seguimiento muestra GPS y presencia solo de miembros del canal «Hablar en» + canales en escucha; API /api/locations?groupIds=.
- **Archivos / refs:** LiveTrackMap.jsx, ackend/src/routes/locations.js, web/src/api.js

\## 2026-08-31 — APK 1.8.47+56 (canales miembro + pitido PTT)

- **Tipo:** release | mobile
- **Área:** mobile | ops
- **Qué:**
  - APK publicada OTA: solo canales con membresía (membersOnly=1), pitido al liberar PTT ajeno.
  - Copias: Soporte/APK/TacticalPtx-1.8.47+56.apk, ackend/app-updates/files/TacticalPtx.apk.
- **Notas:** Chat/seguimiento filtrados por canal son solo web; backend debe estar reiniciado para membersOnly.

\nn## 2026-08-31 — Móvil: solo canales con membresía real

- **Tipo:** fix
- **Área:** backend | mobile
- **Qué:** GET /api/groups?membersOnly=1 devuelve únicamente grupos en group_members; la app Android usa ese filtro en el selector de canales.
- **Por qué / notas:** Despacho web sigue con listado ampliado por privilegios (can_see_region, etc.).
- **Archivos / refs:** ackend/src/services/orgUnits.js, ackend/src/routes/groups.js, mobile/lib/api_client.dart

\## 2026-08-31 — Radio web: chat filtrado al canal activo

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** En Radio/Despacho el panel Chats muestra solo el canal «Hablar en» y canales en escucha; oculta DMs y otros grupos. Con un solo canal, la lista lateral se oculta.
- **Archivos / refs:** web/src/ChatInbox.jsx, web/src/pages/RadioPage.jsx, web/src/styles.css

\nn## 2026-08-31 — Acercamiento suave al pánico en mapa (estilo Earth)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Reemplazado flyTo por zoom/pan suave en línea recta (~2.2 s); evita doble movimiento al cargar Seguimiento desde pánico.
- **Archivos / refs:** web/src/dispatch/mapLeafletUtils.jsx, LiveTrackMap.jsx

\## 2026-08-31 — Pitido al liberar canal PTT (web)

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** Tono breve (playChannelFreeTone) cuando otro operador suelta el PTT; no suena al soltar el propio botón.
- **Archivos / refs:** web/src/appNotify.js, web/src/usePtt.js

\nn## 2026-08-31 — Mac actualizando a Tahoe 26.x (build iOS local)

- **Tipo:** docs | ops
- **Área:** mobile | docs
- **Qué:**
  - Mac pasa de Monterey a **Tahoe 26.6.2** → ya viable Xcode actual + IPA/TestFlight local.
  - Nueva guía IOS_BUILD_MAC_TAHOE.md; Monterey queda como histórico.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_TAHOE.md, docs/APP_IOS.md

\## 2026-08-31 — Ver en mapa acerca al punto de pánico

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - «Ver en mapa» navega a Seguimiento con lat/lng y hace flyTo (zoom ~18) al punto del evento.
  - Overlay de pánico se compacta arriba para no tapar el mapa; marcador rojo del punto.
- **Archivos / refs:** web/src/dispatch/DispatchPanicHost.jsx, LiveTrackMap.jsx, command-center.css

\nn## 2026-08-31 — Guía build iOS en Mac Monterey 12.7.6

- **Tipo:** docs
- **Área:** mobile | docs
- **Qué:** Documentado build local iOS (Xcode 14.2 máx.), límites Monterey, Firebase plist y ruta híbrida Codemagic para TestFlight.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_MONTEREY.md, docs/APP_IOS.md

\n# TacticalPtx — Bitácora de desarrollo

**Producto:** TacticalPtx 
**Ubicación canónica (Soporte):** `C:\pulsanet\Soporte\Documentos\BITACORA_DESARROLLO.md` 
**Copia en repo:** `C:\pulsanet\docs\BITACORA_DESARROLLO.md` 
**Changelog por versión:** `C:\pulsanet\docs\CHANGELOG.md`

Documento **vivo**: cada cambio, mejora, corrección, despliegue o decisión relevante se añade **arriba** (más reciente primero), con fecha.

### Cómo registrar una entrada

```markdown
## 2026-08-31 — PPT: reseña por fase en cada semana

- **Tipo:** docs
- **Área:** docs
- **Qué:** Cada diapositiva S1–S5 incluye una reseña breve de la etapa CVDS (Análisis… Mantenimiento).
- **Archivos / refs:** uild_plan_5_semanas_pptx.py, TACTICALPTX_CVDS_5_SEMANAS.pptx


## 2026-08-31 — PPT CVDS: menos texto + flujo completo

- **Tipo:** docs | ux
- **Área:** docs
- **Qué:** Presentación reducida a 11 diapositivas visuales; ciclo A→F con retorno G/H como diagrama de flujo; chips de navegación.
- **Archivos / refs:** cvds_flujo_completo.png, TACTICALPTX_CVDS_5_SEMANAS*.pptx


## 2026-08-31 — PPT CVDS: capturas UI, ER, flujos e ilustración pruebas

- **Tipo:** docs | ux
- **Área:** docs
- **Qué:** Presentación enriquecida con galería Web/Android, diagrama ER, flujos PTT/pánico e ilustración 2D soldados (Chat/GPS/Pánico/PTT); navegación interactiva ampliada.
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, _pptx_assets_cvds_exec/, uild_plan_5_semanas_pptx.py


## 2026-08-31 — PPT CVDS ejecutivo blanco institucional Defensa

- **Tipo:** docs | ux
- **Área:** docs
- **Qué:** Presentación 5 semanas rediseñada: fondo blanco federal, verdes Defensa, oro institucional; menú y chips con hipervínculos; versiones APK/API alineadas (1.8.46+55 / 1.8.21).
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py, PLAN_5_SEMANAS.md


## 2026-08-31 — PPT/plan 5 semanas alineado al CVDS

- **Tipo:** docs
- **Área:** docs
- **Qué:** Plan y PowerPoint reestructurados al Ciclo de Vida (Análisis, Diseño, Desarrollo, Pruebas, Implementación+Mantenimiento) en 5 semanas; incluye marco 184-185 y ciclo G/H.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py


## 2026-08-31 — Plan ejecutivo 5 semanas + PowerPoint

- **Tipo:** docs
- **Área:** docs
- **Qué:** Ciclo de 5 semanas (Planeación con alcances, Desarrollo, Pruebas, Entrega, Retro). PPT ejecutivo con gráficos e imágenes de marca.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, Soporte/Scripts/build_plan_5_semanas_pptx.py


## 2026-08-29 — Edge: XAMPP Apache quitaba Caddy (sslip mostraba Apache/MariaDB)

- **Tipo:** fix | ops
- **Área:** infra
- **Qué:** Detenido `httpd` (XAMPP) en 80/443; Caddy vuelve a servir TacticalPtx. START/ENSURE-PUBLIC-EDGE ahora matan httpd antes de arrancar.
- **Por qué / notas:** Misma URL pública mostraba dashboard XAMPP Apache/MariaDB caído.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.ps1`


## YYYY-MM-DD — Título corto

- **Tipo:** feature | fix | mejora | docs | infra | ux | security | otro
- **Área:** backend | web | mobile | database | infra | docs | ops
- **Qué:** …
- **Por qué / notas:** …
- **Archivos / refs:** …
```

---

---

---

## 2026-08-28 — Radio 1:1: mic del canal + PTT usable en ambos

- **Tipo:** fix
- **Área:** mobile
- **Qué:** Antes de conectar radio 1:1 se libera el mic del canal grupal; PTT con setMicrophoneEnabled; receptor abre el chat con barra visible; reintento si falla audio; ya no se cierra por disconnect breve.
- **Por qué / notas:** Un lado hablaba y el otro no podía ni pulsar el mic (mic ocupado / barra tapada / ready=false).
- **Archivos / refs:** personal_radio_bar.dart, channel_session.dart, 
adio_shell.dart, direct_pane.dart — APK **1.8.46+55**

## 2026-08-28 — Radio 1:1 otra vez con barra PTT (no pantalla de llamada)

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:** Radio personal vuelve a ser barra PTT arriba del chat (DirectPane / RadioShell); la pantalla fullscreen queda solo para llamada de voz.
- **Por qué / notas:** En 1.8.44 el radio 1:1 se había abierto como PrivateCallScreen.
- **Archivos / refs:** `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart` — APK **1.8.45+54**

## 2026-08-28 — Llamadas: foto de perfil + contestar desde push

- **Tipo:** fix
- **Área:** mobile | backend
- **Qué:** Avatar con foto en pantalla de llamada/entrante; al tocar la notificación de llamada se abre Contestar/Rechazar (antes se ignoraba y la llamada se perdía). FCM canal `tacticalptx_calls` también para radio 1:1; GET `/api/calls/private/:id`.
- **Archivos / refs:** `private_call_screen.dart`, `incoming_call_screen.dart`, `radio_shell.dart`, `push_service.dart`, `calls.js`, `fcm.js` — APK **1.8.44+53**

## 2026-08-28 — Edge publico levantado (APK sin conexion)

- **Tipo:** infra | fix
- **Área:** infra | ops
- **Qué:** APK no conectaba a `https://189.152.200.238.sslip.io` porque Caddy 80/443 estaba caido; se ejecuto `ENSURE-PUBLIC-EDGE` → health 200.
- **Por qué / notas:** UPnP reporto fallo; si 4G sigue fallando, abrir 80/443 en el router hacia la PC.
- **Archivos / refs:** `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/START-PUBLIC-EDGE.ps1`

## 2026-08-28 — BAT reforzado + stack levantado

- **Tipo:** infra
- **Área:** infra | ops
- **Qué:** Refuerzo de `LEVANTAR-TACTICALPTX.bat` (preflight, espera LiveKit, chequeo post-edge, `/strict`, logs con timestamp); arreglo UTF-8/em-dash en `start-api.cmd` / `start-web.cmd` que rompía el parseo de cmd; stack verificado (API/Web/Redis/LiveKit).
- **Por qué / notas:** Caracteres Unicode y parentesis en `echo` rompen etiquetas/batch en Windows. Scripts en ASCII puro.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-28 — Plan de trabajo en PDF

- **Tipo:** docs
- **Área:** docs
- **Qué:** Exportación PDF de `PLAN_DE_TRABAJO.md`; script reutilizable `Soporte/Scripts/md_plan_to_pdf.py`.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.pdf`

## 2026-08-28 — Plan de trabajo maestro (sprints + roadmap)

- **Tipo:** docs
- **Área:** docs
- **Qué:** Documento PLAN_DE_TRABAJO: plan desde cero en 13 sprints (2 sem), roadmap pendiente vs estado actual, seguimiento MEJORAS.txt y escalones 1.8.x.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.md`, `docs/PLAN_DE_TRABAJO.md`, `README.md`

## 2026-08-28 — Web chat: avatares en burbujas + banner en llamada

- **Tipo:** ux
- **Área:** web
- **Qué:** Chat grupal (Radio) muestra foto de perfil junto a mensajes ajenos (como la APK); globo de mensaje vuelve a aparecer durante llamada privada.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `web/src/chatNotify.js`

## 2026-08-28 — Seguimiento: nombres en mapa solo al seleccionar

- **Tipo:** ux
- **Área:** web
- **Qué:** Marcadores de ubicación ya no muestran etiqueta bajo el avatar; al seleccionar operador se ve nombre, popup y panel lateral como antes.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `web/src/dispatch/command-center.css`

## 2026-08-28 — APK 1.8.43+52 publicada (fix burbujas chat)

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Build release + OTA (`force`) con fix de burbujas recibidas; copia en `Soporte\APK\`.
- **Archivos / refs:** `Soporte\APK\TacticalPtx-1.8.43+52.apk`, `backend\app-updates\files\TacticalPtx.apk`

## 2026-08-28 — APK chat: burbujas recibidas sin recorte (hora visible)

- **Tipo:** fix
- **Área:** mobile
- **Qué:** Mensajes entrantes ya no quedan cortados en el borde izquierdo; la hora y el contenido corto (p. ej. «.») se ven completos en DM y grupo.
- **Por qué / notas:** `IntrinsicWidth` + `Stack`/`Positioned` no reservaba ancho para la meta; ahora `Column` + ancho mínimo y más padding horizontal.
- **Archivos / refs:** `mobile/lib/chat_bubble_style.dart`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart` — **1.8.43+52**

## 2026-08-28 — Seguimiento: colores Tamaulipas rojo / SLP verde

- **Tipo:** ux
- **Área:** web
- **Qué:** En mapa IV R.M., **Tamaulipas** rojo tenue (`#c97070`); **San Luis Potosí** verde (el que tenía Tamaulipas, `#1f8a4c`).
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`

## 2026-08-28 — Chat abierto: tono suave WhatsApp (sin notificación fuerte)

- **Tipo:** fix | ux
- **Área:** mobile | web
- **Qué:**
  - Con el **hilo abierto**, solo tono tenue (estilo WhatsApp); sin bandeja ni sirena Nokia a volumen completo.
  - **APK:** FCM en primer plano ya no duplica el push (socket maneja UI/tono); iOS sin sonido de sistema en foreground.
  - **Web:** `playMessageTone({ soft: true })` al leer el chat activo (grupo y DM).
- **Versión:** 1.8.42+51 (APK)
- **Archivos / refs:** `message_tone.dart`, `push_service.dart`, `chat_message_banner.dart`, `appNotify.js`, `ChatInbox.jsx`, `DirectChat.jsx`

## 2026-08-28 — Fix Error 500: API inestable + BAT reforzado

- **Tipo:** fix | infra
- **Área:** infra | backend | ops
- **Qué:**
  - **Causa:** la API caía o reiniciaba (`--watch`) y Watch-Stack **mataba el puerto :4000** cada 15 s → bucle de muerte → consola/APK veían "Error del servidor (500)".
  - **Watch-Stack:** no mata proceso si :4000 escucha; 4 fallos + cooldown 120 s antes de reiniciar; health con timeout mayor.
  - **start-api.cmd:** si health OK, espera 20 s sin relanzar npm (como Web).
  - **LEVANTAR-TACTICALPTX.bat:** chequeo Redis, espera API 60 s, no libera :4000 hasta confirmar zombie, log en `Soporte\Logs\levantar-*.log`, aviso explícito del 500.
  - **API:** logs de ruta en errores 500; try/catch en listado de pánico.
- **Archivos / refs:** `infra/Watch-Stack.ps1`, `infra/start-api.cmd`, `LEVANTAR-TACTICALPTX.bat`, `backend/src/server.js`, `routes/panic.js`

## 2026-08-28 — Pánico: silenciar sirena al abrir mapa

- **Tipo:** fix
- **Área:** mobile | web
- **Qué:**
  - **APK:** al pulsar **Ver ubicación** / **Cómo llegar** se detiene sirena y vibración en el dispositivo (overlay sigue hasta Enterado).
  - **Web:** mismo comportamiento en Radio (modal) y Despacho (`DispatchPanicHost`); botones **Ver ubicación** y **Cómo llegar** en consola.
- **Versión:** 1.8.41+50 (APK)
- **Archivos / refs:** `channel_session.dart`, `radio_shell.dart`, `DispatchPanicHost.jsx`, `RadioPage.jsx`, `usePtt.js`, `panicMaps.js`

## 2026-08-28 — Fix overlay Ubicación GPS transparente

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Panel **Ubicación** y **Canales** con fondo opaco (`Material` + `kInstPaper`) para no superponerse sobre Radio.
  - Texto GPS con padding horizontal para evitar solapamiento visual.
- **Versión:** 1.8.40+49
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

## 2026-08-28 — Pánico APK: ver ubicación y cómo llegar

- **Tipo:** feature
- **Área:** mobile | backend
- **Qué:**
  - Overlay de pánico con botones **Ver ubicación** y **Cómo llegar** (Maps / navegación externa).
  - Guarda lat/lng del `panic:alert`; sync de pánico activo al abrir/reanudar; push FCM con coords; `GET /api/panic/:id`.
- **Versión:** 1.8.39+48
- **Archivos / refs:** `mobile/lib/panic_maps.dart`, `radio_shell.dart`, `channel_session.dart`, `push_service.dart`, `backend/src/services/panic.js`, `routes/panic.js`

## 2026-08-28 — Fix mensajes al estar inactivo (historial + sync)

- **Tipo:** fix
- **Área:** mobile | backend
- **Qué:**
  - DM: historial pedía los mensajes **más viejos** (`ORDER BY ASC LIMIT`); ahora trae los **últimos** N.
  - Grupo/DM: al volver de inactividad o abrir el chat se re-sincroniza historial desde el servidor (no solo memoria/socket).
  - Push FCM con preview del texto y `title`/`body` también en `data`.
- **Versión:** 1.8.38+47
- **Archivos / refs:** `backend/src/services/dm.js`, `fcm.js`, `socket/chat.js`, `socket/dm.js`, `mobile/lib/channel_session.dart`, `direct_pane.dart`, `radio_shell.dart`

## 2026-08-28 — Fix envío de mensajes APK (DM join + eco socket)

- **Tipo:** fix
- **Área:** mobile | backend
- **Qué:**
  - DM: `dm:join` al conectar/reconectar y antes de cada envío (el join se perdía si el socket aún no conectaba).
  - DM/grupo: eco `dm:message` / `chat:message` al emisor; handler `dm:error`; mensajes optimistas en chat grupal con `clientMsgId`.
  - Scroll del chat solo salta al llegar mensajes nuevos (no en cada rebuild).
- **Versión:** 1.8.37+46
- **Archivos / refs:** `mobile/lib/screens/direct_pane.dart`, `channel_session.dart`, `chat_panel.dart`, `backend/src/socket/dm.js`, `chat.js`

## 2026-08-28 — APK MEJORAS.txt (globo, pánico, scroll, avatares, PTT, audio)

- **Tipo:** fix | ux | mejora
- **Área:** mobile
- **Qué:**
  - Globo de mensajes global (`ChatMessageBanner`) en shell y durante llamada/radio 1:1.
  - Alerta de pánico como overlay en cualquier pestaña (Seguimiento incluido), no solo diálogo tapado.
  - Atrás en llamada minimiza (PopScope); radio 1:1 abre pantalla completa con PTT visible al expandir y en barra mini.
  - `IndexedStack` + overlays en stack (Seguimiento/Grupos) preservan estado; scroll de chat más estable.
  - Avatares en burbujas de chat grupal y DM; formato indicativo en cabecera DM.
  - Audio: altavoz forzado solo si radio no está en mute; menos invasión al colgar llamada.
- **Versión:** 1.8.36+45
- **Archivos / refs:** `mobile/lib/chat_message_banner.dart`, `radio_shell.dart`, `private_call_screen.dart`, `chat_panel.dart`, `direct_pane.dart`, `channel_session.dart`, `peer_actions.dart`

## 2026-08-28 — Globo de chat global (cualquier página)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Globo tipo WhatsApp Web centralizado (`GlobalChatNotifyHost` + `chatNotify.js`) visible en Radio, Despacho, Seguimiento, Config, etc.
  - z-index 15000 para quedar encima del despacho/mapa.
  - Al salir del panel de chat (otro módulo) ya no se suprime el aviso; clic abre Radio con el hilo correcto.
- **Archivos / refs:** `web/src/GlobalChatNotifyHost.jsx`, `web/src/chatNotify.js`, `web/src/App.jsx`, `web/src/ChatInbox.jsx`, `web/src/styles.css`

---

## 2026-08-28 — Notificaciones SO con permiso activo (service worker)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Notificaciones del sistema vía `sw-notify.js` + `registration.showNotification()` (Chrome/Edge no muestran bien `new Notification()` con pestaña minimizada aunque el permiso esté en «Permitir»).
  - Banner in-app siempre que no estés leyendo ese chat (también respaldo al volver a la pestaña).
  - Registro automático del service worker al iniciar sesión.
- **Por qué / notas:** Usuario con notificaciones permitidas solo oía el tono; el aviso visual no aparecía en segundo plano.
- **Archivos / refs:** `web/public/sw-notify.js`, `web/src/appNotify.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/App.jsx`

---

## 2026-08-28 — Web DM: lecturas en vivo + banner de notificación

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Chat 1:1 web marca mensajes como leídos al abrir el hilo y al recibir mensajes (`markDmRead`).
  - Escucha `dm:receipts` por socket para actualizar palomitas sin recargar la página.
  - Corregida detección de “chat visible” (`visiblePeerId` + `active`) para no suprimir avisos al cambiar a grupo/radio.
  - Banner in-app de mensaje en `ChatInbox` (portal a `document.body`); fallback visual si no hay permiso de Notification del SO.
- **Por qué / notas:** En web los mensajes enviados no pasaban a “leído” hasta F5; el sonido sonaba pero no aparecía el banner tipo WhatsApp Web.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/api.js`, `web/src/appNotify.js`

---

## 2026-08-27 — LEVANTAR reforzado (reintentos + edge + Watch-Stack)

- **Tipo:** infra | mejora
- **Área:** infra | ops
- **Qué:**
  - `LEVANTAR-TACTICALPTX.bat` en 7 pasos: PG, Redis/LiveKit, firewall, API, Web, Watch-Stack, borde público.
  - Reintento automático si API/Web no dan health; scorecard final [OK]/[!!].
  - Watch-Stack también vigila LiveKit y el edge HTTPS (log en `Soporte\Logs\watch-stack.log`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/Watch-Stack.ps1`

## 2026-08-27 — Fix mensaje OTA “Actualizandoâ€¦”

- **Tipo:** fix
- **Área:** mobile | backend
- **Qué:** El ellipsis Unicode se corrompía en el manifiesto JSON; ahora usa `Actualizando...` (ASCII) y se sanitiza en API/app.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `appUpdate.js`, `app_update.dart`, `main.dart`

## 2026-08-27 — APK UI profesional (tipografía institucional)

- **Tipo:** ux
- **Área:** mobile
- **Qué:**
  - Tipografía Oswald + Source Sans 3 (como la web); tema Material refinado.
  - Login y Radio PTT más presentables (cabecera, estado, PTT, pánico, canales).
  - Barra Chats/Radio con iconos redondeados y tipografía clara.
  - APK **1.8.35+44**.
- **Archivos / refs:** `theme.dart`, `login_screen.dart`, `radio_screen.dart`, `radio_shell.dart`, `google_fonts`

## 2026-08-27 — PTT radio grupal por toque (abre / libera)

- **Tipo:** ux
- **Área:** mobile | web
- **Qué:** En radio de canal/grupo, un toque pone al aire y el segundo libera (ya no hay que mantener). Espacio en web también es toggle. APK **1.8.34+43**.
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `LiveTrackMap.jsx`

## 2026-08-27 — Lightbox: copiar / descargar imagen (como WhatsApp)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** En la galería a pantalla completa: botones Copiar y Descargar; clic derecho con las mismas opciones. El menú del navegador estaba bloqueado y la toolbar oculta.
- **Archivos / refs:** `ImageGalleryLightbox.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-27 — Web Vite: por qué caía y watchdog anti-caída

- **Tipo:** infra | fix
- **Área:** infra | web | ops
- **Qué:**
  - Causa: Vite arrancado desde shell de Cursor muere al abortar la sesión; `http://127.0.0.1:5173` falla (solo **HTTPS** con certs LAN).
  - `start-web.cmd` / `start-api.cmd` reinician solos si el proceso sale.
  - `Watch-Stack.ps1` + `ENSURE-WEB.cmd`; LEVANTAR lanza el watchdog en segundo plano.
- **Por qué / notas:** Usar siempre https://127.0.0.1:5173; no depender del terminal del agente.
- **Archivos / refs:** `infra/start-web.cmd`, `infra/start-api.cmd`, `infra/Watch-Stack.ps1`, `infra/ENSURE-WEB.cmd`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-27 — Pegar / editar imágenes en chat (estilo WhatsApp Web)

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Ctrl+V (o Cmd+V) pega imágenes en chat grupal y DM y abre vista previa.
  - Adjuntar foto también abre el compositor (no envía al instante).
  - Herramientas: recortar/rotar, mejorar, dibujar, texto, formas, mosaico, emoji, HD, deshacer/rehacer, descargar; caption; varias imágenes (+).
- **Por qué / notas:** Paridad con WhatsApp Web al pegar; “ver una vez” no incluido (sin backend).
- **Archivos / refs:** `MediaComposerModal.jsx`, `mediaComposerUtils.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 — Radio 1:1: toggle PTT, más rápido y nueva forma

- **Tipo:** ux | mejora
- **Área:** mobile | web
- **Qué:**
  - PTT por toque: 1.º abre el canal, 2.º libera (ya no hay que mantener pulsado).
  - Conexión más rápida: audio/E2EE y LiveKit + mic en paralelo; socket solo WebSocket.
  - Nueva forma: tarjeta redondeada con mic circular (app + web).
  - APK **1.8.33+42**.
- **Archivos / refs:** `personal_radio_bar.dart`, `PrivateRadioBar.jsx`, `styles.css`, `pubspec.yaml`

## 2026-08-27 — Textos OTA sin “BanjeCel”

- **Tipo:** ux
- **Área:** mobile | backend
- **Qué:** Al actualizar la APK el mensaje visible es **Actualizando…** / **Descargando configuración…**; se eliminó “BanjeCel” del manifiesto y de la publicación; API y app filtran ese texto si aparece.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `app_update.dart`, `appUpdate.js`, `main.dart`

## 2026-08-27 — Uploads por jerarquía y carpetas de grupo

- **Tipo:** mejora | infra
- **Área:** backend
- **Qué:**
  - Media de chat/PTT y avatares se guardan bajo `uploads/orgs/{orgId}/…` con jerarquía región/zona/unidad cuando el grupo tiene `unit_id`, y carpeta por grupo.
  - DM → `orgs/{orgId}/dm/`; avatares → `orgs/{orgId}/avatars/`.
  - Archivos planos previos siguen resolviéndose (compatibilidad).
- **Archivos / refs:** `backend/src/services/uploads.js`, `messages.js`, `dm.js`, `recordings.js`, `me.js`, `admin.js`

## 2026-08-27 — Radio 1:1 arriba (PTT) sin tapar el chat

- **Tipo:** ux | fix
- **Área:** mobile | web
- **Qué:**
  - Radio personal deja de usar `bottomSheet` / barra inferior grande; franja superior compacta con un botón **PTT** + cerrar.
  - Se puede escribir en el chat y usar el teclado con la radio activa.
  - Web: barra bajo el header del DM (mismo patrón).
- **Archivos / refs:** `personal_radio_bar.dart`, `direct_pane.dart`, `radio_shell.dart`, `peer_actions.dart`, `PrivateRadioBar.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 — Layout Historial / Auditoría a ancho completo

- **Tipo:** ux
- **Área:** web
- **Qué:** La pantalla de auditoría usa todo el ancho del panel; columnas de tabla reequilibradas; detalle legible (no JSON cortado en 22 rem).
- **Archivos / refs:** `ConfigAudit.jsx`, `command-center.css`

## 2026-08-27 — Fix foto de perfil en APK (Bearer → Image.memory)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - `UserAvatar` ya no usa `Image.network` (falla con URL autenticada); descarga con `http.get` + Bearer y muestra `Image.memory`.
  - Icono de grupo en cabecera del chat también usa `UserAvatar` con auth.
  - APK **1.8.31+40** OTA force.
- **Archivos / refs:** `user_avatar.dart`, `api_client.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`, `pubspec.yaml`

## 2026-08-27 — Historial / Auditoría en Configuración

- **Tipo:** feature
- **Área:** web | backend
- **Qué:**
  - Pantalla **Configuración → Historial / Auditoría** (quién, qué, cuándo) solo para root/admin.
  - `GET /api/admin/activity` restringido a admin; filtros por acción/búsqueda y paginación.
- **Archivos / refs:** `ConfigAudit.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`, `api.js`, `admin.js`, `command-center.css`

## 2026-08-27 — Delimitación IV R.M. detallada (NL / TM / SLP)

- **Tipo:** mejora | ux
- **Área:** web
- **Qué:** Polígonos de Nuevo León, Tamaulipas y San Luis Potosí regenerados con frontera de alta resolución (fuente estados México); deja de cortar ciudades (p. ej. Nuevo Laredo) por simplificación excesiva.
- **Archivos / refs:** `web/src/dispatch/data/ivRmStates.json`, `LiveTrackMap.jsx`

## 2026-08-27 — Pánico solo al grupo del operador

- **Tipo:** security | mejora
- **Área:** backend | web | docs
- **Qué:**
  - La alerta de pánico ya no escala a todo el proyecto (admins/despacho/`canReceivePanic` fuera del canal).
  - Socket, FCM y listado `GET /api/panic` quedan acotados a **miembros del grupo** del canal activo; la consola solo recibe `dispatch:panic` si el operador pertenece a ese grupo.
  - Enterado / Resolver / Cancelar: solo miembros del mismo grupo.
- **Por qué / notas:** Evitar impacto org-wide; el alcance lo define `group_members`.
- **Archivos / refs:** `backend/src/services/panic.js`, `backend/src/routes/panic.js`, `docs/V1_7_PANIC.md`, `DispatchPanicHost.jsx`

## 2026-08-27 — Radio PTT antes de Catálogos en el menú

- **Tipo:** ux
- **Área:** web
- **Qué:** En el rail del despacho, **Radio PTT** queda arriba de Catálogos (después de Mapa en vivo).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 — Delimitación estados IV R.M. en Seguimiento

- **Tipo:** feature / ux
- **Área:** web
- **Qué:** En Seguimiento en vivo se muestran polígonos tenues de **Nuevo León**, **Tamaulipas** y **San Luis Potosí** (relleno semitransparente + borde suave) sin tapar el fondo del mapa; leyenda en el chrome del mapa.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`, `command-center.css`

---

## 2026-08-27 — PTT visible al maximizar

- **Tipo:** fix / ux
- **Área:** web
- **Qué:**
  - Corregido layout Radio keep-alive (outlet aparcado con `display:none`) que al maximizar ocultaba/recortaba el PTT.
  - Botón PTT mini siempre en la franja de radio del despacho.
  - En Seguimiento maximizado: PTT flotante encima del mapa.
- **Archivos / refs:** `DispatchLayout.jsx`, `LiveTrackMap.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 — Indicativo al aire (SGTO GOMEZ, S.O. IV R.M.)

- **Tipo:** feature / ux
- **Área:** backend | web
- **Qué:**
  - Indicativo visible en chat/PTT: grado + apellido en MAYÚSCULAS (SGTO GOMEZ) o libre (B.O. LINARES).
  - Detalle opcional entre paréntesis: `S.O. IV R.M. (SALA DE OPERACIONES IV R.M.)`.
  - Campo editable en alta/edición de usuarios; login (ggomezd2) no cambia.
  - Grados/puestos: SGTO, B.O., S.O., C.G. Script `npm run rebuild:callsigns` para regenerar display_name existentes.
- **Archivos / refs:** `backend/src/services/rfcUsername.js`, `admin.js`, `catalogs.js`, `defaultGrades.js`, `scripts/rebuild-callsigns.js`; `web/src/dispatch/DispatchUsers.jsx`, `armyGrades.js`

---

## 2026-08-27 — Scroll del chat al volver de Seguimiento

- **Tipo:** fix / ux
- **Área:** web
- **Qué:** Radio PTT en despacho permanece montado (oculto) al ir a Seguimiento/u otros módulos; se conserva conversación y posición de scroll. Auto-scroll del chat solo si estás al final.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `command-center.css`, `App.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`

---

## 2026-08-27 — Banner de mensaje visible en llamada

- **Tipo:** fix / ux
- **Área:** mobile | web
- **Qué:**
  - Web: banner WhatsApp por encima del overlay de llamada (`z-index`); no silenciar aviso si el chat está tapado por la llamada.
  - App: tarjeta emergente sobre la pantalla de llamada (también minimizada); evita SnackBar detrás de la llamada.
- **Por qué / notas:** En llamada los mensajes no se veían (overlay / chat abierto = “ya estás viendo”).
- **Archivos / refs:** `web/src/appNotify.js`, `privateCallUi.js`, `PrivateCallOverlay.jsx`, `styles.css`; `mobile/lib/screens/private_call_screen.dart`, `radio_shell.dart`

---

## 2026-08-27 — Atrás en llamada minimiza (no cuelga)

- **Tipo:** fix / ux
- **Área:** mobile | web
- **Qué:**
  - App: flecha atrás / gesto atrás minimiza la llamada a una barra superior; el audio sigue; Colgar corta.
  - Web: flecha ← y Esc minimizan; solo «Colgar» / botón rojo cierra la llamada.
- **Por qué / notas:** Evitar colgar al salir de la UI de llamada (comportamiento tipo WhatsApp).
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`; `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`

---

## 2026-08-27 — Recuperación DispatchLayout moderno

- **Tipo:** fix
- **Área:** web
- **Qué:** Reconstruido `DispatchLayout.jsx` tras revert accidental a versión antigua: `listenIds`/`onListenChange`, menú Configuración (Canales/Respaldos), catálogos actuales, outlet embebido para Radio/ConfigChannels, roles zona/unidad, mute oculto en `/despacho/radio`, Salir solo con `canManageUsers`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 — Alerta de pánico visible en toda la consola

- **Tipo:** fix
- **Área:** web
- **Qué:** La ventana emergente de pánico (Enterado / Resolver) y la sirena viven en el layout de despacho, no solo en Operaciones. En **Seguimiento**, Mapa, Catálogos, etc. también aparece y se puede detener.
- **Por qué / notas:** Al salir de Operaciones se desmontaba el CommandCenter y cortaba sirena/UI.
- **Archivos / refs:** `web/src/dispatch/DispatchPanicHost.jsx`, `DispatchLayout.jsx`, `CommandCenter.jsx`

---

## 2026-08-27 — Editar usuarios (admins unidad/zona/región/root)

- **Tipo:** feature
- **Área:** backend | web
- **Qué:** Botón **Editar** en Catálogos → Usuarios (solo `canManageUsers`: admin unidad, zona, región y Superadmin). Permite cambiar grado, nombre, matrícula, cargo, rol, adscripción y visibilidad. El usuario de acceso no se regenera.
- **Archivos / refs:** `backend/src/routes/admin.js` (PATCH identidad), `web/src/dispatch/DispatchUsers.jsx`

---

## 2026-08-27 — Foto de perfil no se veía en Radio (app)

- **Tipo:** fix
- **Área:** mobile
- **Qué:** El avatar en cabecera/perfil se carga con **Bearer** (como la web), no solo con ticket `?atk=` de 1 h. Si la descarga falla, muestra iniciales en lugar de círculo blanco vacío.
- **Por qué / notas:** El ticket corto expiraba y `NetworkImage` dejaba el `CircleAvatar` en blanco aunque el archivo existiera en el servidor.
- **Archivos / refs:** `mobile/lib/api_client.dart`, `widgets/user_avatar.dart`, `radio_screen.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 — Salir solo para admins (unidad/zona/región/root)

- **Tipo:** ux | security
- **Área:** mobile | web
- **Qué:** Opción «Salir» visible solo para `unit_admin`, `zone_admin`, `admin` (Región) y `root` (Superadmin). Operadores y despacho no la ven. En la app: perfil (avatar) + overlay de canales. En web: radio y consola de despacho.
- **Por qué / notas:** Evitar cierre de sesión accidental en radios de campo. Sigue disponible en error de carga y en cambio de clave temporal.
- **Archivos / refs:** `mobile/lib/roles.dart`, `radio_shell.dart`, `groups_screen.dart`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 — Ojito ver/ocultar contraseña

- **Tipo:** ux
- **Área:** mobile | web
- **Qué:** En «Cambiar contraseña» (APK) cada campo tiene icono de ojo para mostrar/ocultar; mismo patrón en login y cambio de clave de la web. El botón de salida dice «Salir» (antes «Cerrar sesión»).
- **Archivos / refs:** `mobile/lib/screens/change_password_screen.dart`, `web/src/App.jsx`, `web/src/institutional.css`

---

## 2026-08-27 — Sin Altavoz duplicado en menú Radio

- **Tipo:** ux
- **Área:** web
- **Qué:** En `/despacho/radio` se oculta el botón Altavoz/MUTE de la barra superior (ya está «Silenciar» abajo); en el resto de menús se mantiene.
- **Archivos / refs:** `DispatchLayout.jsx`

---

## 2026-08-27 — Imagen de grupo/canal

- **Tipo:** feature
- **Área:** backend | web | mobile | database
- **Qué:** `groups.avatar_url` (migración 020); admin sube/quita icono en Catálogos → Grupos; se muestra en bandeja y cabecera de chat (web + APK).
- **Archivos / refs:** `020_group_avatar.sql`, `admin.js`, `groups.js`, `me.js`, `DispatchGroups.jsx`, `PersonAvatar.jsx`, `ChatInbox.jsx`, `WhatsAppChat.jsx`, `user_avatar.dart`

---

## 2026-08-27 — Mute radio sin mover botones

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitado el aviso extra «Radio silenciada…» que empujaba el layout; el estado va en la línea «Canal libre». Botones Altavoz/MUTE con ancho fijo.
- **Archivos / refs:** `RadioPage.jsx`, `DispatchLayout.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 — Configuración → Canales (oír / hablar)

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** Selector multi-canal movido a Configuración → Canales; barra superior solo muestra canal PTT + «Oye N/M» con enlace. Respaldos sigue solo admin.
- **Archivos / refs:** `ConfigChannels.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

---

## 2026-08-27 — KPI despacho: textos centrados

- **Tipo:** ux
- **Área:** web
- **Qué:** Números/etiquetas centrados **dentro** de cada tarjeta; la fila de cuadros vuelve a la izquierda y «Conexión en vivo» a la derecha.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

## 2026-08-27 — Avatares en lista de chats (web + APK)

- **Tipo:** feature | ux
- **Área:** backend | web | mobile
- **Qué:** API DM devuelve `avatarUrl` en contactos y conversaciones; componente `PersonAvatar` / `UserAvatar` en bandeja de chats.
- **Archivos / refs:** `backend/src/services/dm.js`, `web/src/PersonAvatar.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/user_avatar.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 — Despacho: actividad y grabaciones en columnas

- **Tipo:** ux
- **Área:** web
- **Qué:** Panel inferior en 2 columnas (actividad | grabaciones) a igual altura; más espacio al bloque inferior (~55%); KPI compacto.
- **Por qué / notas:** Apiladas verticalmente, grabaciones quedaban fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 — Despacho: layout viewport sin cortar grabaciones

- **Tipo:** ux
- **Área:** web
- **Qué:** `cc-workspace-grid` envuelve mapa + panel inferior; KPI/banners fijos arriba; todo cabe en `100dvh` con scroll interno en actividad/grabaciones.
- **Por qué / notas:** El grid de 2 filas trataba KPI como fila 1 y empujaba grabaciones fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 — Despacho: panel actividad/grabaciones menos comprimido

- **Tipo:** ux
- **Área:** web
- **Qué:** Más altura mínima al bloque inferior (actividad, grabaciones PTT, detalle); más padding en filas y cabeceras; columna detalle más ancha.
- **Por qué / notas:** El usuario reportó el apartado «muy comprimido» en el centro de mando.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

- **Tipo:** fix
- **Área:** backend | mobile | infra
- **Qué:** LiveKit no escuchaba UDP 7882 (usaba rango 50000+ sin UPnP). Simplificado `livekit.dev.yaml`; `--udp-port 7882` explícito; STUN sin `--node-ip` fijo. LAN → `ws://IP_LAN:7880`; 4G → `wss://dominio`. Móvil no reescribe `ws://192.168.x` a wss.
- **Por qué / notas:** `MediaConnectException` / ICE timeout en PTT. Causa raíz: puerto media UDP no abierto en el servidor.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `Caddyfile.edge.template`

---

## 2026-08-26 — PTT móvil: una URL para Wi‑Fi y 4G (sin obligar LAN)

- **Tipo:** fix
- **Área:** backend | infra
- **Qué:** LiveKit siempre `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). Quitado atajo `ws://LAN:7880` y `--node-ip` fijo; STUN + candidatos LAN + TURN. `LIVEKIT_PUBLIC_URL` en borde público.
- **Por qué / notas:** El fix anterior solo funcionaba en la misma Wi‑Fi; 4G seguía roto. Ahora LAN y datos móviles usan la misma señal HTTPS.
- **Archivos / refs:** `backend/src/services/livekit.js`, `infra/start-services.ps1`, `infra/Caddyfile.edge`, `START-PUBLIC-EDGE.ps1`

---

## 2026-08-26 — Fix audio PTT móvil (LiveKit ICE timeout)

- **Tipo:** fix
- **Área:** backend | mobile | infra
- **Qué:** URL LiveKit según contexto: LAN → `ws://IP_LAN:7880`; remoto HTTPS → `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). `LIVEKIT_LAN_HOST` auto-sync en `start-services.ps1`. Móvil reescribe `wss` cuando API es HTTPS. UPnP/firewall LiveKit reforzados.
- **Por qué / notas:** La app recibía `ws://IP_PUBLICA:7880`; en Wi‑Fi fallaba ICE (hairpin NAT) y en 4G el puerto 7880 no siempre alcanza. Error: `MediaConnectException` / PeerConnection timeout.
- **Archivos / refs:** `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `infra/start-services.ps1`, `Reinforce-UPnP.ps1`

---

## 2026-08-26 — Fix error 500 detrás de Caddy (trust proxy)

- **Tipo:** fix
- **Área:** backend | infra
- **Qué:** `trust proxy` activo en dev cuando hay `PUBLIC_DOMAIN` o `TRUST_PROXY=1`; `.env.example` actualizado; `TRUST_PROXY=1` en `.env` local.
- **Por qué / notas:** Tráfico vía Caddy envía `X-Forwarded-For` y `express-rate-limit` lanzaba `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` → 500 en login y demás rutas públicas.
- **Archivos / refs:** `backend/src/config.js`, `backend/.env.example`

---

## 2026-08-26 — Codemagic iOS + checklist TestFlight

- **Tipo:** infra | docs
- **Área:** mobile | ops
- **Qué:** `codemagic.yaml` con workflows TestFlight y solo IPA; checklist Apple+Firebase; plantilla plist; script base64 para Codemagic.
- **Por qué / notas:** Build iOS sin Mac local. Ver `Soporte/Documentos/IOS_TESTFLIGHT_CHECKLIST.md`.
- **Archivos / refs:** `codemagic.yaml`, `IOS_TESTFLIGHT_CHECKLIST.md`, `GoogleService-Info.plist.example`, `Encode-GoogleServicePlist.ps1`

## 2026-08-26 — Fix .cmd/.bat rotos en Windows (LF vs CRLF)

- **Tipo:** fix
- **Área:** infra | ops
- **Qué:** `start-api.cmd`, `start-web.cmd` y `LEVANTAR-TACTICALPTX.bat` tenian saltos LF (Unix); cmd.exe rompia bloques `if` y ejecutaba palabras sueltas (`Preferir`, `exist`, `not`). Reescritos con CRLF y sintaxis por etiquetas.
- **Archivos / refs:** `infra/start-api.cmd`, `infra/start-web.cmd`, `LEVANTAR-TACTICALPTX.bat`, resto `infra/*.cmd`

## 2026-08-26 — LEVANTAR-TACTICALPTX.bat mas robusto

- **Tipo:** fix | infra
- **Área:** infra | ops
- **Qué:** Bat detecta PostgreSQL 18, fallback puerto 5432, borde publico via `.cmd` sin romper el script, dominio desde `.env`, Redis con rutas alternativas.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.cmd`, `infra/start-services.ps1`

## 2026-08-26 — APK 1.8.30+39 (emojis/stickers OTA)

- **Tipo:** ops
- **Área:** mobile
- **Qué:** OTA BanjeCel force `1.8.30+39` con emojis y stickers estilo WhatsApp (grupal + personal).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.30+39.apk`, `backend/app-updates/android.json`

## 2026-08-26 — Emojis y stickers estilo WhatsApp (web + APK)

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:**
  - Web: panel flotante tipo WhatsApp Web (categorías, búsqueda, pestañas Emoji / GIF / Stickers) en chat grupal y DM.
  - APK: panel inferior con emojis + stickers; el icono 🙂 / ⌨️ alterna panel y teclado (grupal y personal).
- **Por qué / notas:** GIF tab placeholder (próximamente). Stickers DM vía `POST /api/dm/:id/messages/sticker`.
- **Archivos / refs:** `web/src/WaEmojiPicker.jsx`, `web/src/emojiData.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/chat_emoji_panel.dart`, `chat_panel.dart`, `direct_pane.dart`

## 2026-08-26 — Fix lightbox «Cargando imagen…» infinito

- **Tipo:** fix
- **Área:** web
- **Qué:** Al abrir imagen a pantalla completa ya no se queda colgado en carga. El efecto de React Strict Mode cancelaba el fetch y no reintentaba.
- **Por qué / notas:** Miniatura OK; lightbox con «Cargando imagen…» + nombre de archivo. Ahora libera el slot al cancelar, muestra error claro y botón Reintentar.
- **Archivos / refs:** `web/src/ImageGalleryLightbox.jsx`, `web/src/api.js` (`fetchMediaBlobUrl`)

## 2026-08-26 — APK 1.8.29+38 (ortografía + BanjeCel)

- **Tipo:** fix | ops
- **Área:** mobile
- **Qué:** Corregidos textos mojibake (Galería, Cámara, etc.). OTA BanjeCel force `1.8.29+38`.
- **Archivos / refs:** `direct_pane.dart`, `Soporte/APK/TacticalPtx-1.8.29+38.apk`

## 2026-08-26 — APK 1.8.28+37 (radio personal PTT)

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Publicado OTA force con radio personal tipo grupal (barra PTT, sin UI de llamada).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.28+37.apk`

## 2026-08-26 — Radio personal = PTT (como radio grupal)

- **Tipo:** ux | feature
- **Área:** web | mobile
- **Qué:** Radio personal ya no abre UI de llamada: barra PTT `MANTÉN PARA HABLAR`, auto-unión del destinatario, botón Radio del chat sirve para transmitir. Llamar sigue siendo full-duplex.
- **Archivos / refs:** `web/src/PrivateRadioBar.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `mobile/.../personal_radio_bar.dart`

## 2026-08-26 — Proyecto iOS preparado (IPA requiere Mac)

- **Tipo:** infra | docs
- **Área:** mobile
- **Qué:** Listo el target iOS `com.tacticalptx.app`: Podfile, Info.plist (mic/cámara/fotos/ubicación/Bluetooth), entitlements push, iconos, script `scripts/build-ios.sh` y guía `Soporte/Documentos/APP_IOS.md`. El `.ipa` no se puede generar en Windows.
- **Por qué / notas:** Pedido de app iOS; falta Mac + Apple Developer + `GoogleService-Info.plist` para FCM.
- **Archivos / refs:** `mobile/ios/`, `mobile/scripts/build-ios.sh`, `Soporte/Documentos/APP_IOS.md`

## 2026-08-26 — App no secuestra volumen/cámara del móvil

- **Tipo:** fix | security
- **Área:** mobile
- **Qué:** Audio solo al radio/llamada (volumen multimedia + mayDuck); mic se libera al callar; FGS sin tipo microphone; pausa sesión al abrir cámara. APK **1.8.27+36** OTA force.
- **Por qué / notas:** La sesión voiceCommunication + mic siempre abierto interfería con volumen, notificaciones y cámara de otras apps.
- **Archivos / refs:** `audio_session_setup.dart`, `channel_session.dart`, `background_radio.dart`, `AndroidManifest.xml`

## 2026-08-26 — APK 1.8.26+35 (radio 1:1 + controles llamada)

- **Tipo:** feature | ops
- **Área:** mobile
- **Qué:** Publicado OTA force: radio personal 1:1 + controles de llamada estilo WhatsApp (altavoz, silenciar, teclado, mensaje).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.26+35.apk`, `backend/app-updates/android.json`, `mobile/pubspec.yaml`

## 2026-08-26 — Controles de llamada estilo teléfono/WhatsApp (app)

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:** En llamada privada: **Silenciar**, **Teclado**, **Altavoz/Auricular**, **Mensaje** (DM sin colgar), **Más** (audio entrante), temporizador y colgar. Radio 1:1: PTT + altavoz + mensaje.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`

## 2026-08-26 — Controles de llamada estilo teléfono/WhatsApp (app)

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:** En llamada privada: **Silenciar**, **Teclado**, **Altavoz/Auricular**, **Mensaje** (DM sin colgar), **Más** (audio entrante), temporizador y colgar. Radio 1:1: PTT + altavoz + mensaje.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`

## 2026-08-26 — Radio personal 1:1 (además de llamada y mensaje)

- **Tipo:** feature
- **Área:** backend | web | mobile
- **Qué:**
  - Entre usuarios: **Mensaje**, **Radio personal** (PTT 1:1) y **Llamada** (full-duplex).
  - Backend: `mode: call|radio` en `/api/calls/private`; rooms `radio_*` vs `call_*`; FCM `private_radio`.
  - Web: menú peer + botón Radio en DM; overlay con PTT (mantener).
  - Móvil: menú peer, iconos en chat DM, pantalla entrante/activa con PTT.
- **Por qué / notas:** Pedido: radio entre usuarios además de llamadas y mensajes.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `WhatsAppChat.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/peer_actions.dart`, `direct_pane.dart`, `incoming_call_screen.dart`, `radio_shell.dart`

## 2026-08-26 — Llamada entrante web visible (portal)

- **Tipo:** fix
- **Área:** web
- **Qué:** La UI de llamada entrante vivía dentro de DirectChat con `display:none` (vista grupos) → sonaba pero no se veía. Ahora se renderiza con `createPortal` en `document.body` (z-index alto).
- **Archivos / refs:** `web/src/DirectChat.jsx`, `appNotify.js`, `styles.css`

## 2026-08-26 — Diálogos prompt del proyecto (sin window.prompt)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** `AppDialog` con campo de texto; renombrar dependencias/grados/empleos y confirmar restauración usan modal del producto (no el prompt del navegador).
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchDependencias.jsx`, `CatalogGradesEmpleos.jsx`, `ConfigBackups.jsx`, `institutional.css`

## 2026-08-26 — Notificaciones web estilo WhatsApp

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** Tono `/sounds/message.wav`, banner oscuro con acento verde, Notification del SO al ir a segundo plano, título `(N) TacticalPtx`, silencio si el chat está abierto. Grupos también notifican con pestaña oculta.
- **Archivos / refs:** `web/src/appNotify.js`, `ChatInbox.jsx`, `styles.css`, `public/sounds/message.wav`

## 2026-08-26 — Mute de escucha radio (móvil + web)

- **Tipo:** feature | ux
- **Área:** mobile | web
- **Qué:** Botón visible **Silenciar / MUTE** en Radio (también menú ☰). Corta audio remoto al silenciar. Web RadioPage: mismo control. APK **1.8.25+34**.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `channel_session.dart`, `web/src/pages/RadioPage.jsx`, `styles.css`

## 2026-08-26 — Publicar APK OTA 1.8.24+33

- **Tipo:** release
- **Área:** mobile | ops
- **Qué:** Build/release APK con Socket.IO `:443`, E2EE sin fallback silencioso, tono chat, etc. Manifiesto OTA `force: true`.
- **Archivos / refs:** `mobile/pubspec.yaml` 1.8.24+33, `backend/app-updates/`, `Soporte/APK/`

## 2026-08-26 — SIN RED móvil: Caddy edge caído + endurecer arranque

- **Tipo:** fix | infra
- **Área:** ops | mobile | infra
- **Qué:**
  - Causa: borde público Caddy (:80/:443) apagado → timeout/`SIN RED` en app 4G; API/DB/Redis locales OK.
  - Edge reiniciado (health 200 + Socket.IO polling OK). APK **1.8.23+32** ya publicada (fix `:0`).
  - `START-PUBLIC-EDGE` detecta API HTTP vs HTTPS (evita 502 TLS handshake); `ENSURE-PUBLIC-EDGE`; `LEVANTAR` llama al ensure.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `ENSURE-PUBLIC-EDGE.*`, `Caddyfile.edge.template`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-26 — Mapas: quitar watermark CARTO «API KEY REQUIRED»

- **Tipo:** fix
- **Área:** web
- **Qué:** CARTO raster ahora exige API key; se reemplazó por Esri World Street Map / OSM / satélite Esri (sin key). Capas centralizadas en `mapTiles.js`.
- **Archivos / refs:** `web/src/dispatch/mapTiles.js`, `CommandCenter.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`

## 2026-08-26 — Dependencias: árbol contraído por defecto

- **Tipo:** ux
- **Área:** web
- **Qué:** Regiones/zonas del catálogo Dependencias inician colapsadas (`NestedRow` defaultOpen=false).
- **Archivos / refs:** `web/src/dispatch/DispatchDependencias.jsx`

## 2026-08-26 — Fix Socket.IO móvil `:0` (sslip.io sin puerto)

- **Tipo:** fix
- **Área:** mobile
- **Qué:** `socket_io_client` usaba `Uri.port == 0` con `https://host` (sin puerto) → `…sslip.io:0/socket.io` y fallo de upgrade WebSocket. `AppConfig.socketUrl` fuerza `:443`/`:80`; todas las conexiones IO usan `socketUrl`.
- **Archivos / refs:** `mobile/lib/config.dart`, `channel_session.dart` (ya usaba socketUrl), `direct_pane.dart`, `chat_inbox_screen.dart`, `test/widget_test.dart`
- **Nota:** APK **1.8.23+32** en publicación OTA (force). Reabrir app o actualizar cuando termine el build.

## 2026-08-26 — Integridad: paths C:, TLS/FCM, cifrado, firewall

- **Tipo:** security | fix | infra
- **Área:** backend | web | mobile | infra | docs | ops
- **Qué:**
  - Raíz canónica documentada como `C:\pulsanet` (evita fracturas D: ausente).
  - `FIREBASE_SERVICE_ACCOUNT` corregido a C:; health reporta TLS real + flags wire/content/voice; FCM vuelve a `configured`.
  - Despacho: no degradar payloads sealed a texto en claro si falla unwrap; voz E2EE no cae en silencio a SRTP-only si hay clave.
  - Firewall canónico reforzado (9 reglas `TacticalPtx-*`); script `infra/check-integrity.ps1`.
- **Por qué / notas:** Tras el 500 por TLS en D:, auditoría completa de estructura App/Web/proyecto.
- **Archivos / refs:** `backend/src/routes/health.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`, `infra/check-integrity.ps1`, `infra/Ensure-Firewall.ps1`, `docs/UBICACION_PROYECTO.md`, `backend/.env` (paths)

## 2026-08-26 — Fix API TLS (certs D: → C:) y 500 por proxy

- **Tipo:** fix | infra
- **Área:** backend | ops
- **Qué:** `.env` apuntaba `TLS_CERT/KEY` a `D:\pulsanet\…` (inexistente); la API caía a HTTP y Vite/proxy HTTPS devolvía fallos (500 / conexión). Certs corregidos a `C:\pulsanet\infra\certs\` y API reiniciada con TLS on. Alta sin cargo verificada (201).
- **Archivos / refs:** `backend/.env` (TLS_*), `infra/certs/lan-*.pem`

## 2026-08-26 — Tono tenue si el chat está abierto (móvil)

- **Tipo:** ux | fix
- **Área:** mobile
- **Qué:** Con el hilo abierto en primer plano ya no suena la notificación Nokia de bandeja; se reproduce un tono al ~16% de volumen (estilo WhatsApp). Si el chat es otro o la app está en segundo plano, se mantiene el aviso completo.
- **Archivos / refs:** `mobile/lib/message_tone.dart`, `app_focus.dart`, `push_service.dart`, `radio_shell.dart`, `channel_session.dart`, `direct_pane.dart`

## 2026-08-26 — Cargo opcional en alta de usuarios

- **Tipo:** ux | fix
- **Área:** web | backend
- **Qué:** «Cargo / puesto» deja de ser obligatorio en el alta; el indicativo usa grado + apellido y solo añade cargo si se captura.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-08-26 — Acelerar abrir chat desde notificación (móvil)

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:** Al tocar «Abrir» en la notificación, el hilo DM se abre al instante (sin esperar contactos/LiveKit/FGS). Cambio de canal y limpieza de avisos ya no bloquean la navegación; bootstrap paralelo.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/direct_pane.dart`, `mobile/lib/push_service.dart`

## 2026-08-26 — Fix formularios Grupos (alineación)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Formularios «Nuevo grupo» / «Asignar miembro» dejaron de usar `.admin-form` (que los empujaba a la derecha). Ahora son paneles verticales con campos a ancho completo.
- **Archivos / refs:** `web/src/dispatch/DispatchGroups.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 — Purga canales PTT del import PV

- **Tipo:** ops | fix
- **Área:** backend
- **Qué:** Eliminados 48 grupos creados automáticamente al importar Dependencias (`Canal operativo · PV-O-*`). El import ya no crea canales PTT.
- **Archivos / refs:** `backend/src/scripts/purge-import-groups.js`, `backend/src/scripts/import-pv-dependencias.js`

## 2026-08-26 — UX compacta Dependencias / Usuarios / Grupos

- **Tipo:** ux
- **Área:** web
- **Qué:** Mismo criterio que Grados/empleos: contenedor max ~820px; Dependencias más densa; Usuarios en tarjetas de una columna; Grupos con formularios en paneles y lista/miembros en chips (sin tablas a todo el ancho).
- **Archivos / refs:** `DispatchDependencias.jsx`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `command-center.css`

## 2026-08-26 — UX Grados/empleos más compactos

- **Tipo:** ux
- **Área:** web
- **Qué:** Paneles Grados/Empleos dejan de estirarse a todo el ancho; columnas ~300–380px y elementos en chips (abreviatura + nombre juntos a las acciones).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 — Dependencias idénticas a ParqueVehicular

- **Tipo:** feature | data
- **Área:** backend | web | database
- **Qué:**
  - Importado el árbol live de PV (`catalogos.html#dependencias`): 6 RR.MM., 15 ZZ.MM., 48 organismos (`PV-*`).
  - UI Dependencias alineada a PV: labels RR.MM.→ZZ.MM.→Organismos, placeholders, chips de organismos, botones «+ Región / + Zona / + Organismo».
  - Script `npm run import:pv-dependencias` (desactiva org_units no `PV-*`).
- **Por qué / notas:** Sustituye el seed parcial IV R.M. (`ivRmUnits.js`) por la estructura real de ParqueVehicular.
- **Archivos / refs:** `backend/src/data/pvDependenciasTree.js`, `backend/src/scripts/import-pv-dependencias.js`, `web/src/dispatch/DispatchDependencias.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 — Fix scroll Catálogos / Configuración

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** El cuerpo de Catálogos/Configuración tenía `overflow: hidden` sin scroll; Grados/empleos, Dependencias, Usuarios, Grupos y Respaldos se cortaban abajo. Ahora `.cc-catalogs-body` hace scroll vertical.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

## 2026-08-26 — Fix pantalla en negro (web App.jsx)

- **Tipo:** fix
- **Área:** web
- **Qué:** Crash al renderizar rutas: `isAdminUser(session.user)` con `session === null` (menú Configuración/Respaldos). Ahora usa `session?.user`.
- **Archivos / refs:** `web/src/App.jsx`

## 2026-08-26 — APK OTA 1.8.22+31 desde C:\pulsanet

- **Tipo:** ops | fix
- **Área:** mobile | infra | ops
- **Qué:**
  - `Publish-ApkUpdate.ps1` resuelve repo en `C:\pulsanet` (fallback D:), Flutter/SDK/JDK reales; reescribe `local.properties` y `org.gradle.java.home`.
  - Reinstalados Flutter (`C:\tools\flutter`), Android SDK (`C:\Android\Sdk`) y Microsoft OpenJDK 17.
  - Publicada APK **1.8.22+31** a `backend/app-updates` + `Soporte/APK`; `LEVANTAR-TACTICALPTX.bat` prioriza C:\.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.22+31.apk`

## 2026-08-26 — Catálogo PV (grados/empleos/dependencias) + Respaldos

- **Tipo:** feature | ux
- **Área:** web | backend | database
- **Qué:**
  - Catálogos al estilo ParqueVehicular: **Grados y empleos** (chips, alta/renombre/baja; bloqueo si están en uso) y **Dependencias** (árbol Región → Zona → Unidad).
  - Menú **Configuración → Respaldos**: programación, retención, manual, descarga, borrado, restauración (.zip/.sql) y subida; ZIP `tacticalptx_*.zip` con `database.sql` + `meta.json`.
  - Migración `019_catalog_grades_empleos.sql`; seed LOEFAM al primer listado; Usuarios consume grados/empleos del API.
  - Arranque `infra/start-api.cmd` / `start-web.cmd` prioriza `C:\pulsanet`.
- **Por qué / notas:** Importar forma e información de PV adaptada a TacticalPtx (`users.grade` / `specialty`, `org_units`).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `DispatchDependencias.jsx`, `ConfigBackups.jsx`, `ConfigLayout.jsx`, `backend/src/services/catalogs.js`, `backup.js`, `routes/catalogs.js`, `routes/backups.js`, `database/migrations/019_catalog_grades_empleos.sql`

## 2026-08-25 — ZIP respaldo completo TacticalPtx

- **Tipo:** ops
- **Área:** ops | docs
- **Qué:** Respaldo ZIP del trabajo en `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip` (~1.42 GB). Incluye código, docs, Soporte/APK/OTA; excluye `node_modules`, `mobile/build`, `.dart_tool` y Respaldos anidados.
- **Archivos / refs:** `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip`

## 2026-08-25 — Proyecto solo en D:\pulsanet (nada fuera)

- **Tipo:** ops | docs
- **Área:** docs | ops
- **Qué:**
  - Eliminada la junction externa `D:\PulsaNet_Soporte` (apuntaba a `D:\pulsanet\Soporte`).
  - Logos/variantes TacticalPtx movidos de Documentos → `Soporte\Brand\from-Documents\`.
  - Docs: ubicación única y stack completo bajo `D:\pulsanet` (`UBICACION_PROYECTO.md`, README).
- **Por qué / notas:** El producto no debe vivir fuera de esa carpeta; SDKs del sistema (Flutter/Android/JDK/PG) siguen en sus rutas de instalación.
- **Archivos / refs:** `docs/UBICACION_PROYECTO.md`, `README.md`, `Soporte/Brand/from-Documents/`

## 2026-08-25 — APK 1.8.21+30 publicada (OTA)

- **Tipo:** feature | ux | ops
- **Área:** mobile | ops
- **Qué:** APK **1.8.21+30** — vaciar/borrar chats, miniaturas de imagen en DM, burbujas estilo WhatsApp. OTA `versionCode` 30, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.21+30.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 — GPS mapa: «Hace X h» no implica en vivo

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - Aclara que «Hace 21 h / 72 h» = última señal recibida por el servidor (suele pasar fuera de red/API).
  - Parseo UTC de `recordedAt` sin zona; API siempre envía ISO con `Z`.
  - Popup/ficha: «desactualizado» + hora local; ya no dice «rastro en vivo» si la señal es vieja.
- **Archivos / refs:** `liveTiming.js`, `LiveTrackMap.jsx`, `locations.js`

## 2026-08-25 — Burbujas de chat estilo WhatsApp

- **Tipo:** ux | mejora
- **Área:** mobile
- **Qué:** Mensajes DM y grupo más estéticos: radios/cola tipo WhatsApp, agrupación por remitente, hora+palomas en esquina, tipografía y sombra suaves, composer redondeado sin borde tosco.
- **Archivos / refs:** `chat_bubble_style.dart`, `direct_pane.dart`, `chat_panel.dart`

## 2026-08-25 — Vaciar/borrar chats + miniatura imagen DM

- **Tipo:** feature | ux
- **Área:** mobile | backend
- **Qué:**
  - Inbox: pulsación larga → Vaciar chat/grupo, Borrar chat (ocultar de la lista; reaparece con mensaje nuevo) y favorito.
  - API `POST /api/dm/:userId/messages/clear` y `POST /api/groups/:id/messages/clear`; eventos `dm:cleared` / `chat:cleared`.
  - Menú ⋮ en DM y grupo para vaciar.
  - Chat personal: imágenes en miniatura dentro de la burbuja (estilo WhatsApp).
- **Archivos / refs:** `dm.js`, `chat.js`, `messages.js`, `chat_inbox_screen.dart`, `direct_pane.dart`, `api_client.dart`, `channel_session.dart`

## 2026-08-25 — APK 1.8.20+29 publicada (OTA)

- **Tipo:** feature | ops
- **Área:** mobile | ops
- **Qué:** APK **1.8.20+29** — DM con palomas/hora/swipe reply/envío rápido/atrás al inbox; también presencia multi-device y ticket avatar. OTA `versionCode` 29.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.20+29.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 — DM móvil: palomas, hora, swipe reply, atrás al inbox

- **Tipo:** feature | ux | fix
- **Área:** mobile
- **Qué:** Chat personal con hora + palomas (✓✓ / azules al leer); envío optimista (menos latencia); deslizar derecha para responder; opciones alineadas (descargar); atrás/sistema vuelve al inicio (inbox) de un toque.
- **Archivos / refs:** `direct_pane.dart`, `api_client.dart` (`markDmRead`), `peer_actions.dart`, `radio_shell.dart`

## 2026-08-25 — Avatar sin JWT en URL + presencia multi-device

- **Tipo:** security | fix
- **Área:** backend | web | mobile
- **Qué:**
  - #1 Presencia por socket (cerrar web no saca al móvil del radio).
  - #2 Avatares: ticket corto HMAC (`?atk=`) en login/refresh; mapas web usan blob+Bearer; app deja de poner el JWT en `Image.network`.
- **Archivos / refs:** `presence.js`, `ptt.js`, `avatarTicket.js`, `me.js`, `auth.js`, `avatarBlobCache` / mapas despacho, `api_client.dart`, `secure_store.dart`

## 2026-08-25 — Presencia multi-dispositivo (socket refcount)

- **Tipo:** fix
- **Área:** backend
- **Qué:** Presencia PTT por `socket.id` en Redis (`presence:sockets:*`). Cerrar web/otra pestaña ya no marca offline al móvil ni suelta el floor si otro dispositivo sigue en el canal. Floor solo se libera si ese socket tenía PTT o el usuario no tiene más sockets.
- **Archivos / refs:** `presence.js`, `socket/ptt.js`, `redis.js`

## 2026-08-25 — Restaurado borde HTTPS (app sin conexión)

- **Tipo:** fix | infra | ops
- **Área:** infra | ops
- **Qué:** App mostraba “No hay conexión con el servidor (…sslip.io)”: Caddy no escuchaba en 443 (Apache/Laragon ocupaba 80). Se relanzó `START-PUBLIC-EDGE.ps1`; health público 200.
- **Por qué / notas:** No reiniciar Laragon Apache en 80 mientras se use el borde LE; 80/443 deben quedar para Caddy.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/Caddyfile.edge`

## 2026-08-25 — Auditoría completa + remediación segura

- **Tipo:** security | fix | docs | ops
- **Área:** backend | mobile | database | docs
- **Qué:**
  - Auditoría versiones/seguridad/datos/sockets; BD viva OK para DM.
  - Migración `018_dm_messages.sql`; `BUILD-APK-WHATSAPP.cmd` → Publish OTA; `clearFloor` atómico; reject secretos OTA/unlock de ejemplo; versiones 1.8.19 en package.json; `.env.example` host actual + lockdown off por defecto.
- **Por qué / notas:** Evitar regresiones OTA y desfases; hallazgos abiertos: presence multi-device, JWT en query avatar, web DM sin delete/react, calls in-memory.
- **Archivos / refs:** `018_dm_messages.sql`, `config.js`, `presence.js`, `BUILD-APK-WHATSAPP.cmd`, canvas `auditoria-tacticalptx`

## 2026-08-25 — APK 1.8.19+28 publicada (OTA)

- **Tipo:** feature | ops
- **Área:** mobile | ops
- **Qué:** APK **1.8.19+28** con galería swipe de imágenes (estilo WhatsApp) y links clicables en chat; OTA `versionCode` 28, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.19+28.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`, `backend/src/version.js`

## 2026-08-25 — Chat: galería swipe de imágenes (estilo WhatsApp)

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:** En vista ampliada, deslizar izquierda/derecha (app) o flechas/swipe/teclado (web) entre todas las imágenes del mismo chat (grupo y DM). Contador `n / total`.
- **Por qué / notas:** Igual que WhatsApp; antes solo se veía la imagen tocada.
- **Archivos / refs:** `chat_image_gallery.dart`, `chat_panel.dart`, `direct_pane.dart`, `ImageGalleryLightbox.jsx`, `ChatMedia.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-25 — Chat: links clicables (web + app)

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:** URLs en mensajes (http/https, www, geo, mailto, tel) se muestran como enlace y abren el navegador / app correspondiente. Grupo y DM.
- **Archivos / refs:** `LinkifiedText.jsx`, `linkified_text.dart`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_panel.dart`, `direct_pane.dart`, `AndroidManifest.xml` queries

## 2026-08-25 — APK 1.8.18+27 publicada (OTA)

- **Tipo:** ops | release
- **Área:** mobile | backend
- **Qué:** Release **1.8.18+27** con icono verde, mute radio, adjuntos video/docs, colgado bilateral de llamadas, arranque más rápido. APK en OTA + Soporte.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.18+27.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-08-25 — Web chat: lightbox sin menú duplicado + Esc

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Vista ampliada de imagen sin barra superior de acciones (solo menú contextual del centro). Esc cierra **menú de opciones y lightbox** a la vez. Nombres de media: conserva el original si es legible; si no → `Img.jpg` / `Video.mp4` / `Archivo.ext`.
- **Archivos / refs:** `ChatMedia.jsx`, `WhatsAppChat.jsx`, `GlobalEscapeClose.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 — App Radio: mute de escucha (altavoz)

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:** Botón de altavoz en el panel Radio silencia el **audio entrante** del canal (`listenMuted`); estado **MUTE** + icono `volume_off`. Persiste en SharedPreferences. PTT propio sigue funcionando. Se aplica a tracks LiveKit remotos (disable/enable).
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`

## 2026-08-25 — Auditoría: desfases corregidos

- **Tipo:** fix | docs
- **Área:** backend | web | mobile | docs
- **Qué:** Alineación versiones **1.8.17** (API `version.js`/`package.json`, web `package.json`, OTA example `versionCode` 26). Bitácora: eliminadas ~94 entradas duplicadas de «PostgreSQL reiniciado». Fix fuga LiveKit si falla conectar llamada; preview DM de video en app; límites media en `V1_1_MEDIA_GPS.md`.
- **Archivos / refs:** `version.js`, `package.json` (backend/web), `android.json.example`, `BITACORA_*`, `direct_pane.dart`, `channel_session.dart`, `V1_1_MEDIA_GPS.md`

## 2026-08-25 — Llamada personal: colgar en ambos lados

- **Tipo:** fix
- **Área:** mobile | web | backend
- **Qué:** Si uno cuelga la llamada 1:1, el otro también cierra la UI (app ya no se quedaba en pantalla de llamada). Escucha `call:ended` + salida del peer en LiveKit; API emite el evento a ambos usuarios.
- **Archivos / refs:** `PrivateCallScreen` (`direct_pane.dart`), `channel_session.dart`, `calls.js`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`

## 2026-08-25 — Chat: videos, documentos y archivos (web + app)

- **Tipo:** feature | ux
- **Área:** backend | web | mobile
- **Qué:** Adjuntar como WhatsApp: **video**, **documentos** (PDF/Office) y **archivos** (ZIP/RAR/7z…). Menú Foto / Video / Documento en grupo y DM (web y app). Reproductor de video y tarjeta de archivo con abrir/descargar. Límites: imagen 10 MB, audio 15 MB, docs 25 MB, video 50 MB. Bloqueo de ejecutables.
- **Archivos / refs:** `uploads.js`, `messages.js`, `dm.js`; `WhatsAppChat.jsx`, `DirectChat.jsx`, `ChatMedia.jsx`, `mediaKind.js`; `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`, `media_kind.dart`

## 2026-08-25 — App: arranque más rápido + icono verde

- **Tipo:** mejora | ux
- **Área:** mobile
- **Qué:** Splash ya no espera Firebase/mic/Shorebird antes de pintar; check de APK con timeout 3 s y mensajes claros. Icono launcher regenerado con fondo oliva `#243D20` (`tacticalptx.png`); splash nativo y boot screen con papel institucional + logo.
- **Por qué / notas:** «Cargando configuración…» se sentía lento por awaits encadenados. Hace falta **APK nueva** para ver el icono en el launcher.
- **Archivos / refs:** `main.dart`, `app_update.dart`, `colors.xml`, `launch_background.xml`, mipmaps via `flutter_launcher_icons`

## 2026-08-25 — Chat canal: mensaje/llamada personal entre miembros

- **Tipo:** feature | ux
- **Área:** mobile | web
- **Qué:** Desde el chat de grupo/canal se puede contactar a otro miembro: **mensaje personal** (DM) o **llamada personal**. App: tocar nombre del mensaje, cabecera del canal o chips en Radio. Web: tocar nombre, cabecera «en línea» o lista de en línea en Radio.
- **Archivos / refs:** `peer_actions.dart`, `chat_panel.dart`, `chat_inbox_screen.dart`, `radio_screen.dart`; `WhatsAppChat.jsx`, `ChatInbox.jsx`, `RadioPage.jsx`, `styles.css`

## 2026-08-25 — App: tono SMS Nokia (Morse) en notificaciones

- **Tipo:** feature | ux
- **Área:** mobile | backend
- **Qué:** Notificaciones de **mensajes** usan tono **SMS Nokia** (código Morse SMS), fuerte y claro. Canal Android nuevo `tacticalptx_alerts_nokia` + `res/raw/nokia_sms.wav`; FCM apunta a ese sonido.
- **Por qué / notas:** Android no cambia el sonido de un canal ya creado → canal nuevo. Requiere **reinstalar/actualizar APK**. Llamadas siguen con tono por defecto del sistema.
- **Archivos / refs:** `mobile/android/.../res/raw/nokia_sms.wav`, `push_service.dart`, `fcm.js`, `assets/sounds/nokia_sms.wav`, iOS `Runner/nokia_sms.wav`

## 2026-08-25 — Radio: un solo botón PTT (sin duplicar)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** En **Radio PTT** ya no se muestra el PTT mini del dock superior (quedaba duplicado junto al PTT grande). El mini sigue en el resto de pestañas (Seguimiento, mapa, etc.).
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-08-25 — App: menú WhatsApp en chat grupal y DM

- **Tipo:** feature | ux
- **Área:** mobile | backend
- **Qué:** Mantener pulsado un mensaje abre menú estilo WhatsApp: **reaccionar**, **responder**, **copiar**, **reenviar**, **fijar/desfijar**, **editar** (grupo), **eliminar**. Chat personal (DM) con reply, reacciones y borrado; fijado local por conversación.
- **Por qué / notas:** Paridad con la consola web y UX pedida en app. Fijar es local (dispositivo). Reenviar manda el texto/preview a un contacto DM.
- **Archivos / refs:** `mobile/lib/chat_message_actions.dart`, `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`; `backend/src/services/dm.js`, `routes/dm.js`

## 2026-08-25 — Centro de mando: panel inferior visible (grabaciones)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Actividad reciente y **Grabaciones PTT** ya no se cortan: mitad inferior con `min-height:0`, reparto 50/50 con mapa, scroll interno en actividad y grabaciones.
- **Por qué / notas:** `.cc-lower` no encogía en flex (`min-height` implícito del contenido) y `.cc-activity` usaba `max-height:40%` sin alto fijo del padre.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 — Mapas: foto real en marcador + cursor visible

- **Tipo:** fix
- **Área:** web
- **Qué:** Marcadores usan URL HTTP `/api/avatars/:id?token=` (igual que la lista) con `background-image` en lugar de `<img>` (Leaflet rompía el tamaño con `width:auto!important`). Cursor `move` forzado en tiles/paneles; círculos de precisión no interceptan el puntero.
- **Por qué / notas:** Círculo blanco = foto cargada pero img colapsada por CSS de Leaflet; cursor invisible = `grab` no soportado en Windows + overlays SVG interactivos.
- **Archivos / refs:** `api.js`, `mapAvatarIcon.js`, `mapLeafletUtils.jsx`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 — Mapas: misma foto en marcador y cursor de arrastre

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Marcadores usan la **misma foto** que la lista lateral (ya no miniatura separada que fallaba). Claves estables evitan marcadores duplicados al cargar avatares. Cursor **grab/grabbing** se mantiene al pasar sobre iconos en Seguimiento, Centro de mando y Geocercas.
- **Por qué / notas:** La miniatura circular a veces quedaba `null` con la foto completa OK; las claves con `avatarReady` remontaban todos los markers. Los `pointer-events` del icono quitaban el cursor de mano al hover.
- **Archivos / refs:** `avatarBlobCache.js`, `useMapAvatarPhotos.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `mapLeafletUtils.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 — Mapa: foto de perfil en marcador (data URL)

- **Tipo:** fix
- **Área:** web
- **Qué:** Leaflet no pintaba `blob:` en divIcon (círculo blanco). Avatares en mapa usan **data URL** + `background-image`; marcador se recrea al cargar la foto.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 — APK 1.8.17+26 publicada (OTA)

- **Tipo:** release | ops
- **Área:** mobile
- **Qué:** Publicada **1.8.17+26** vía `PUBLISH-APK-UPDATE.cmd`: fix teclado en chat/DM (`resizeToAvoidBottomInset`), manifiesto `android.json` versionCode **26**, APK en `backend/app-updates/files/` y `Soporte/APK/`.
- **Por qué / notas:** La OTA no avisaba porque servidor y clientes seguían en **25** (mismo `versionCode`). Quien tenga ≤25 verá actualización al abrir la app si la API pública responde.
- **Archivos / refs:** `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.17+26.apk`

## 2026-08-25 — Lightbox chat: un solo menú de acciones

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Al ampliar imagen ya no aparecen **dos** menús (barra superior + cuadro flotante); solo la barra fija Responder / Copiar / Descargar. Clic derecho ya no abre menú duplicado.
- **Archivos / refs:** `ChatMedia.jsx`

## 2026-08-25 — Mapa: misma foto de perfil en marcador

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Marcadores del mapa cargan el avatar con **Bearer** (blob en memoria), igual que la lista lateral — sin superponer inicial “G” sobre la foto ni fondo verde encima. Marcador seleccionado queda por encima si hay solape.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 — Seguimiento en vivo: layout y mapa acotado

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Panel **Seguimiento en vivo** redistribuido: KPIs en chips, capas del mapa sobre el mapa, lista con scroll interno, detalle del operador abajo. Mapa con borde/sombra y alto limitado al viewport (sin “scroll infinito”); `ResizeObserver` recalcula Leaflet al cambiar el panel.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 — Mapa: icono con foto de perfil del usuario

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Marcadores de Seguimiento / Mapa en vivo cargan la **foto de perfil** vía `/api/avatars/:userId` (con fallback a inicial si no hay foto). Se preserva `avatarUrl` al fusionar GPS por socket/poll; Leaflet actualiza el icono al cambiar.
- **Archivos / refs:** `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `liveTiming.js`, `api.js`, `command-center.css`

## 2026-08-25 — Web chat: menú contextual estilo WhatsApp

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** En Radio PTT / chat de grupo: clic derecho o ⋯ abre menú propio (Reaccionar, Responder, Copiar, Copiar imagen, Descargar, Copiar nombre, Editar, Eliminar). Lightbox de imagen con barra de acciones y menú contextual (sin menú del navegador).
- **Archivos / refs:** `WhatsAppChat.jsx`, `ChatMedia.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 — Web: catálogos y mapas acotados al viewport

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Usuarios y mapas ya no “cuelgan” sin fin: scroll interno en lista de usuarios; **Seguimiento** y **Mapa en vivo** ocupan el alto visible con borde inferior claro.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 — Web: lista de usuarios en tarjetas

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Panel Usuarios pasa de tabla ancha a **tarjetas** por operador: avatar, indicativo, datos en columnas y acciones en fila inferior.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 — Móvil: teclado no tapa cuadro de chat

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:** DM y chat de grupo usan `Scaffold` con `resizeToAvoidBottomInset` para que el composer quede visible al escribir.
- **Archivos / refs:** `direct_pane.dart`, `chat_inbox_screen.dart` (`GroupChatScreen`)

## 2026-08-25 — Web: sin borde amarillo en campos pendientes (alta usuario)

- **Tipo:** ux
- **Área:** web
- **Qué:** Eliminado resaltado ámbar (`.cc-field-pending`) en inputs del alta de usuario; se mantiene el checklist de faltantes.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 — Web: grado Subteniente → Sbtte.

- **Tipo:** mejora | ux
- **Área:** web
- **Qué:** Abreviatura **Subteniente** corregida a `Sbtte.` (antes `Subtte.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 — Alta usuario: Especialidad tras Grado, Cargo al final

- **Tipo:** feature | ux
- **Área:** web | backend | database
- **Qué:** Formulario separa **Especialidad** (opcional, tras grado) y **Cargo** (obligatorio, al final del paso Generales). Nueva columna `users.cargo`; indicativo usa cargo.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `rfcUsername.js`, `017_user_cargo.sql`

## 2026-08-25 — Web: abreviaturas grado Sld. y Gral. Brig.

- **Tipo:** mejora | ux
- **Área:** web
- **Qué:** Catálogo de grados: **Soldado** → `Sld.`; **General Brigadier** → `Gral. Brig.` (antes `Gral. Brigr.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 — Web: selector de grado solo abreviatura

- **Tipo:** ux
- **Área:** web
- **Qué:** Desplegable de grado en alta de usuario muestra solo la abreviatura (ej. `Cap. 1/o.`), sin el nombre largo.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 — Web: pantalla en blanco en Usuarios (roleLabel)

- **Tipo:** fix
- **Área:** web
- **Qué:** Restaurada función `roleLabel` en panel Usuarios; sin ella React crasheaba al pintar la tabla. Eliminado CSS huérfano en `styles.css`.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/styles.css`

## 2026-08-25 — Web: estrella favorito sin mojibake (SVG)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Botón favorito (junto a **Llamar** y en lista de chats) usa icono SVG en lugar de carácter ★ corrupto (`â˜…`).
- **Archivos / refs:** `web/src/StarIcon.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `styles.css`

## 2026-08-25 — Web: ticks de lectura sin mojibake en DM

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Corregidos caracteres corruptos (`âœ"`) en mensajes directos: palomitas ✓/✓✓, estrella favorito, enviar, llamada entrante.
- **Por qué / notas:** El archivo `DirectChat.jsx` tenía UTF-8 mal interpretado; ahora usa escapes `\u2713` etc.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/WhatsAppChat.jsx`

## 2026-08-25 — Web: alta de usuario reorganizada con checklist

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Modal **Alta de usuario** en 3 pasos con stepper visual, secciones (Identidad militar, Nombre completo, Vista previa, Ubicación orgánica), checklist “Falta completar” y borde ámbar en campos pendientes.
- **Por qué / notas:** Ver de un vistazo qué falta antes de avanzar; grado+cargo juntos, nombres agrupados, región/zona/unidad en cascada.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 — Móvil: inbox Chats tipo WhatsApp + pestaña Radio

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:** Dos pestañas inferiores (**Chats** | **Radio**). Chats unifica grupos + DM con filtros Todos / No leídos / Favoritos / Grupos, búsqueda, favoritos locales y badges. Al tocar conversación se abre pantalla completa; Radio conserva PTT, pánico y canales (Mapa/Canales en menú ⋮).
- **Por qué / notas:** Flujo principal estilo WhatsApp; radio como segunda pestaña sin saturar la barra inferior.
- **Archivos / refs:** `mobile/lib/screens/chat_inbox_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `radio_screen.dart`, `api_client.dart`; APK **1.8.16+25**

## 2026-08-25 — Alta usuario: generales → adscripción; indicativo con cargo

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:** Formulario de usuarios en 3 pasos (Generales → Región/Zona/Unidad → Grupos). Campo «Cargo / puesto» (ej. Jfe. Rgnl. TIC). Indicativo en chat/radio: `Grado Apellido, Cargo` (ej. Cap. Luna, Jfe. Rgnl. TIC).
- **Por qué / notas:** Orden institucional claro; el cargo viaja en `display_name` para móvil y web.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/services/rfcUsername.js`, `backend/src/routes/admin.js`

## 2026-08-25 — Navegación móvil más clara (sin cámara suelta)

- **Tipo:** ux | mejora
- **Área:** mobile
- **Qué:** Barra inferior con etiquetas (Mensajes, Mapa, Directos, Canales); se quitó el botón Cámara que mandaba fotos al chat sin contexto. En el chat, un solo botón **+** abre menú Galería / Cámara / Archivo.
- **Por qué / notas:** Flujo más entendible estilo WhatsApp; fotos solo desde el chat.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/chat_panel.dart`; APK **1.8.15+24**

## 2026-08-25 — Panel Usuarios rediseñado (web despacho)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Lista de usuarios como vista principal con skeleton al cargar, búsqueda/filtros, actualización en segundo plano sin vaciar la tabla, y alta de usuario en modal (+ Nuevo usuario) en lugar del formulario fijo arriba.
- **Por qué / notas:** Mejor flujo de carga y menos scroll; la tabla queda visible de inmediato tras la carga.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 — Flecha pasos alta de usuario (web)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Corregido carácter roto `â†'` entre «1. Datos» y «2. Grupos» en el formulario de alta de usuario del despacho; ahora muestra `→`.
- **Por qué / notas:** Mojibake por codificación incorrecta del símbolo Unicode en el JSX.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 — APK 1.8.14 tap notificación abre chat/DM

- **Tipo:** fix | ux | ops
- **Área:** mobile | ops
- **Qué:**
  - Tap en notificación de mensaje de grupo → pane Chat del canal correcto, foco en compositor; cold start consume `pendingGroupId` tras bootstrap.
  - Tap en notificación DM → pane Directos y abre el hilo del peer (`initialPeerId`).
  - `RadioShell` registra `onNotificationOpen` / `onNotificationData`; `PushService` guarda `pendingMessageId` y cold start de notificación local.
  - Publicada APK **1.8.14+23** (OTA `android.json` versionCode 23); copias en `Soporte/APK/`.
- **Por qué / notas:** PushService ya dejaba pending al tocar, pero el shell no consumía ni navegaba (quedaba en radio).
- **Archivos / refs:** `radio_shell.dart`, `push_service.dart`, `direct_pane.dart`, `chat_panel.dart`, `pubspec.yaml`

## 2026-08-25 — APK 1.8.13 vibración fuerte en pánico

- **Tipo:** feature | ux | ops
- **Área:** mobile | ops
- **Qué:**
  - Alerta de pánico entrante: vibración nativa en bucle (500 ms on / 200 ms off, amplitud máxima si el hardware lo permite) junto con la sirena; se cancela al pulsar **Enterado** / stop.
  - Botón PÁNICO (emisor): ráfaga fuerte de confirmación vía API `Vibrator` (`package:vibration` 3.2), no solo `HapticFeedback`.
  - Publicada APK **1.8.13+22** (OTA `android.json` versionCode 22); copias en `Soporte/APK/`.
- **Por qué / notas:** El haptic corto no se sentía como vibración real en muchos equipos.
- **Archivos / refs:** `panic_vibration.dart`, `channel_session.dart`, `radio_screen.dart`, `pubspec.yaml`, `Publish-ApkUpdate.ps1`

## 2026-08-25 — APK 1.8.12 presencia + pánico circular

- **Tipo:** feature | ux | ops
- **Área:** mobile | backend | ops
- **Qué:**
  - Publicada APK **1.8.12+21** (OTA `android.json` versionCode 21) con presencia Skype (verde/amarillo) y botón Pánico circular.
  - Copias en `Soporte/APK/TacticalPtx-1.8.12+21.apk` y `TacticalPtx-latest.apk`.
  - API reiniciada (`infra/start-api.cmd`); health TLS `:4000` ok (presence Redis JSON live).
- **Archivos / refs:** `mobile/pubspec.yaml`, `Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`, `presence.js`, `radio_screen.dart`

## 2026-08-25 — Presencia tipo Skype (verde / amarillo / rojo)

- **Tipo:** feature | ux
- **Área:** mobile | backend | web
- **Qué:**
  - Puntos de color en chips de presencia del canal radio: **verde** = en la app (foreground); **amarillo** = conectado pero minimizado/bloqueado (background); **rojo** reservado para offline (v1: al salir/stale desaparecen del listado).
  - Redis presence guarda JSON `{displayName,focus}`; `ptt:join` / `presence:ping` envían `focus`; broadcast al cambiar foco.
  - Chips con `StadiumBorder`; web RadioPage con puntos active/away.
- **Por qué / notas:** Entra en el próximo APK (sin bump de versión en este cambio). Roster offline con chips rojos = mejora futura.
- **Archivos / refs:** `presence.js`, `ptt.js`, `channel_session.dart`, `radio_screen.dart`, `radio_shell.dart`, `usePtt.js`, `RadioPage.jsx`

## 2026-08-25 — Botón Pánico circular (sin esquinas)

- **Tipo:** ux
- **Área:** mobile
- **Qué:** Esquinas del botón Pánico redondeadas/circulares (`CircleBorder` + clip); sin fondo/splash cuadrado.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart` (`_PanicButton`)

## 2026-08-25 — Foto de perfil con recorte estilo WhatsApp

- **Tipo:** feature | ux | fix
- **Área:** mobile | backend
- **Qué:**
  - Tras elegir/tomar foto: pantalla de recorte circular (mover + zoom), export JPEG 800×800 ~85% y subida con `Content-Type: image/jpeg`.
  - Backend `/api/me/avatar` acepta mime vacío/`octet-stream` con extensión válida y valida magic bytes; mensajes de error en español.
  - SnackBar ya no muestra `Exception: …`; APK **1.8.11+20**.
- **Por qué / notas:** Android enviaba HEIC/octet-stream y multer rechazaba; falta de recorte tipo WhatsApp.
- **Archivos / refs:** `radio_shell.dart`, `api_client.dart`, `es_msg.dart`, `me.js`, `image_cropper`, `AndroidManifest.xml`, `Soporte/APK/`

## 2026-08-25 — Notificaciones se limpian al leer (estilo WhatsApp)

- **Tipo:** fix | ux
- **Área:** mobile | backend
- **Qué:**
  - Al abrir chat de canal o un DM, se cancelan las notificaciones de esa conversación (tag `g:` / `dm:`) y también `cancelAll` para avisos viejos sin tag.
  - Resume de la app con chat/DM abierto vuelve a limpiar bandeja; `markRead` ya no borra avisos si la app está en segundo plano.
  - FCM/Android ya usan `tag` + `collapseKey`; MethodChannel nativo `cancelTag` / `cancelAll`.
  - APK **1.8.10+19**.
- **Por qué / notas:** Las push de chat quedaban en la bandeja tras leer (comportamiento distinto a WhatsApp).
- **Archivos / refs:** `push_service.dart`, `radio_shell.dart`, `direct_pane.dart`, `channel_session.dart`, `MainActivity.kt`, `fcm.js`, `Soporte/APK/`

## 2026-08-25 — UX: chat móvil estilo WhatsApp (sin huecos)

- **Tipo:** ux | mejora
- **Área:** mobile
- **Qué:**
  - Chat de canal y DM: fondo tipo WA, burbujas compactas (colas, agrupación), lista `reverse`, hora + ticks, compositor redondo.
  - En chat/DM se oculta la barra inferior para quitar espacio vacío / doble chrome.
  - APK **1.8.9+18**.
- **Archivos / refs:** `chat_panel.dart`, `direct_pane.dart`, `radio_shell.dart`, `Soporte/APK/`

## 2026-08-25 — Fix UX: timeout por IP antigua en APK

- **Tipo:** fix | ux
- **Área:** mobile | ops
- **Qué:**
  - Causa: APK vieja apuntaba a `189.175.38.29:4000` (IP ya no responde); el host actual es `https://189.152.200.238.sslip.io`.
  - Mensaje de bootstrap más claro ante Timeout/Socket; usuario debe instalar `TacticalPtx-1.8.8+17.apk` (OTA no llega si la API vieja está caída).
- **Archivos / refs:** `radio_shell.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.8+17.apk`

## 2026-08-25 — Dominio HTTPS publico (Caddy + Let's Encrypt / sslip.io)

- **Tipo:** security | infra | ops
- **Área:** infra | mobile | docs
- **Qué:**
  - Borde Caddy en :80/:443 con cert **Let's Encrypt** para `https://189.152.200.238.sslip.io` (sin comprar dominio).
  - Scripts `START-PUBLIC-EDGE.ps1`, `Caddyfile.edge`, guía `DOMINIO_Y_CERTIFICADO.md`.
  - IP publica actualizada (`189.152.200.238`); UPnP 80/443 + stack; APK **1.8.8+17** con `API_BASE` al dominio.
  - Nota: si el ISP cambia la IP, re-ejecutar edge y republicar APK (o usar dominio propio).
- **Archivos / refs:** `infra/Caddyfile.edge`, `infra/START-PUBLIC-EDGE.ps1`, `infra/caddy/`, `Soporte/Documentos/DOMINIO_Y_CERTIFICADO.md`

## 2026-08-25 — Ops: UPnP reaplicado (+ TURN 3478)

- **Tipo:** ops
- **Área:** infra
- **Qué:**
  - `Reinforce-UPnP.ps1`: mapeos OK 4000/5173/7880/7881/7882/**3478** → `192.168.1.66`.
  - API/Web locales OK; Postgres Running/Automatic. Curl a IP pública desde el propio host = `000` (hairpin NAT típico; validar desde 4G).
- **Archivos / refs:** `infra/Reinforce-UPnP.ps1`

## 2026-08-25 — Endurecimiento completo (ops + seguridad + TURN)

- **Tipo:** security | infra | ops
- **Área:** backend | mobile | infra | docs
- **Qué:**
  - Script `infra/HARDEN.ps1` / `.cmd`: Postgres **Automatic**, firewall (+UDP 3478), UPnP, `APP_UPDATE_SECRET`, `ALLOW_HOST_LOCKDOWN=1`, rate limits.
  - OTA: clave `X-App-Update-Key` + token HMAC de descarga; rate-limit dedicado; prod exige secreto.
  - Metrics/admin: Redis **SCAN** (sin `KEYS`).
  - LiveKit TURN embebido UDP 3478; Caddy `/rtc`; versiones API **1.8.6**; APK **1.8.7+16** (publicar con secreto).
  - Guía `Soporte/Documentos/SEGURIDAD_HARDENING.md`.
- **Archivos / refs:** `appUpdate.js`, `config.js`, `auth.js`, `redis.js`, `livekit.dev.yaml`, `Ensure-Firewall.ps1`, `HARDEN.ps1`, `mobile/lib/config.dart`, `PUBLISH-APK-UPDATE.cmd`

## 2026-08-24 — Fix: Enterado en pánico cerraba la APK

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Al pulsar **Enterado** en la alerta de pánico la app se cerraba: doble `Navigator.pop` (botón + listener tras `ackIncomingPanic`/`notifyListeners`) y posible error no manejado al `stop()` de la sirena.
  - Enterado ahora cierra solo el diálogo; la app permanece en radio/chat. Versión **1.8.6+15** publicada (Soporte + OTA).
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/channel_session.dart`, `mobile/pubspec.yaml`, `Soporte/APK/`, `backend/app-updates/`

## 2026-08-24 — Fix: xhr poll error Socket.IO en consola HTTPS

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - Causa: Socket.IO caía a long-polling XHR (a veces por proxy Vite / orden de transports) y el banner rojo «xhr poll error» **no se limpiaba** aunque el enlace reconectara («Enlace ok» / «Audio ok»).
  - Cliente: mismo origen vía proxy Vite `/socket.io` (bloquea `http://` bajo página HTTPS); transports `websocket` → `polling`; limpia error al `connect`.
  - Vite: timeouts del proxy socket; DirectChat unificado a `socketConfig`.
  - Mensaje UI en español si vuelve a fallar el transporte.
- **Por qué / notas:** Verificar: Ctrl+F5 en `https://189.175.38.29:5173` — sin banner rojo; `/socket.io/?EIO=4&transport=polling` debe responder `0{…}` por HTTPS.
- **Archivos / refs:** `web/src/socketConfig.js`, `web/src/usePtt.js`, `web/src/DirectChat.jsx`, `web/src/esMsg.js`, `web/vite.config.js`, `backend/src/server.js`

## 2026-08-24 — Fix: LiveKit PTT bajo HTTPS remoto (mixed content)

- **Tipo:** fix | infra
- **Área:** web | backend | infra
- **Qué:**
  - Causa: consola `https://IP:5173` recibía `ws://IP:7880` → el navegador bloqueaba la señal (mixed content) → «No se pudo conectar el audio (LiveKit)».
  - Web: `publicLiveKitUrl` usa `wss://mismo-origen`; Vite proxy `/rtc` → `http://127.0.0.1:7880`.
  - LiveKit reiniciado con `--node-ip 189.175.38.29`; UPnP 4000/5173/7880/7881 + UDP 7882 reaplicado.
  - Docs ACCESO_DIRECTO + `.env.example` aclaran señal vs media.
- **Por qué / notas:** URL resultante consola: **`wss://189.175.38.29:5173`** (proxy). API/móvil: **`ws://189.175.38.29:7880`**. Media ICE: TCP 7881 / UDP 7882.
- **Archivos / refs:** `web/src/livekitUrl.js`, `web/vite.config.js`, `backend/src/services/livekit.js`, `infra/livekit.dev.yaml`, `infra/Reinforce-UPnP.ps1`, `infra/EXPOSE-UPNP.ps1`

## 2026-08-24 — Fix: consola web HTTPS para PTT remoto

- **Tipo:** fix | infra | ux
- **Área:** web | infra | backend
- **Qué:**
  - Vite `:5173` usa TLS con `infra/certs/lan-*.pem` (mismo cert que la API).
  - Guardas si no hay `navigator.mediaDevices` (mensaje en español; sin crash).
  - `WEB_PUBLIC_URL=https://189.175.38.29:5173`; CORS incluye orígenes HTTPS públicos.
  - Docs/arranque (`start-web`, `LEVANTAR`, ACCESO_DIRECTO, EXPOSE-*) actualizados.
- **Por qué / notas:** Abrir `http://IP:5173` desde 4G → `getUserMedia` undefined. Remoto: **https://189.175.38.29:5173** (aceptar cert autofirmado).
- **Archivos / refs:** `web/vite.config.js`, `web/src/voiceRecord.js`, `web/src/usePtt.js`, `web/src/esMsg.js`, `backend/.env`, `infra/start-web.cmd`

## 2026-08-24 — Fix: GET / API redirige a consola web

- **Tipo:** fix | ux
- **Área:** backend
- **Qué:**
  - `GET /` en la API (:4000) deja de devolver `{"ok":false,"error":"Ruta no encontrada"}` y responde **302** a la consola (`WEB_PUBLIC_URL`, default `http://189.175.38.29:5173`).
  - `/api/health` sin cambios. Raíz permitida también bajo lockdown (solo redirect).
  - Documentado en `.env.example`; en host: `WEB_PUBLIC_URL=http://189.175.38.29:5173`.
  - Con TLS activo no hay listener HTTP en :4000: `http://…:4000` no llega a Express (usar `https://…:4000/` o ir directo a `:5173`). Clientes APK `https://…:4000` intactos.
- **Por qué / notas:** Usuario abrió la raíz de la API desde el móvil esperando “entrar” a la app web.
- **Archivos / refs:** `backend/src/server.js`, `backend/src/config.js`, `backend/src/services/intrusion.js`, `backend/.env.example`

## 2026-08-24 — Ops: PostgreSQL reiniciado (login/despacho)

- **Tipo:** ops | fix
- **Área:** database | ops
- **Qué:**
  - Servicio `postgresql-x64-17` estaba **Stopped** (StartType Manual); provocaba fallos de login/despacho aunque API/web/OTA respondieran.
  - Arranque elevado OK → **Running**; `tacticalptx_db` accesible (psql; 8 usuarios).
  - Health API: `ready:true`, `db:connected` en `https://127.0.0.1:4000/api/health` y `https://189.175.38.29:4000/api/health`. Web `5173` y Redis OK; no hizo falta reiniciar API.
- **Por qué / notas:** `Start-Service` sin Admin falla (“No se puede abrir el servicio”). Comando elevado: `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-Command','Start-Service postgresql-x64-17'`. Conviene valorar StartType **Automatic** para que no quede caído tras reinicio.
- **Archivos / refs:** servicio Windows `postgresql-x64-17`; data `C:\Program Files\PostgreSQL\17\data`


## 2026-08-24 — APK OTA 1.8.5+14 (host público)

- **Tipo:** ops | feature
- **Área:** mobile | backend | infra
- **Qué:**
  - Versión móvil `1.8.5+14`; `API_BASE` por defecto `https://189.175.38.29:4000` (pubspec/scripts/`config.dart`).
  - Publicación OTA: manifiesto + APK en `backend/app-updates/`; copia `Soporte/APK/TacticalPtx-1.8.5+14-4G.apk`.
  - UPnP reaplicado (incl. TCP **5173** web): health/OTA públicos alcanzables; web remota `http://189.175.38.29:5173`.
- **Por qué / notas:** Acceso PC remota vía IP pública (no LAN). PostgreSQL quedó detenido (hace falta Admin para `Start-Service`); API responde pero `db:disconnected` hasta reiniciar PG.
- **Archivos / refs:** `mobile/pubspec.yaml`, `PUBLISH-APK-UPDATE.cmd`, `BUILD-APK-WHATSAPP.cmd`, `backend/app-updates/`, `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`

## 2026-08-24 — Mapas: capas institucionales + zoom al cursor

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Se mantienen las capas **Natural** (Carto Voyager), **Satélite** (Esri) y **Claro** (OSM); default `natural`. No se cambió el basemap al pedir “como Google Maps”.
  - Se conserva **CursorZoom** (rueda hacia el punto bajo el cursor) en Seguimiento.
  - Fondo del contenedor Leaflet en Seguimiento alineado al tono institucional Voyager (tema claro); oscuro solo en tema dark.
- **Por qué / notas:** “Como Maps” = solo la función de zoom, no el estilo de teselas.
- **Archivos / refs:** `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-08-24 — Actualización APK en la app (estilo BanjeCel)

- **Tipo:** feature | ops | ux
- **Área:** mobile | backend | docs
- **Qué:**
  - Al abrir Android: pantalla «Cargando configuración…»; `GET /api/app/android`; si `versionCode` del servidor es mayor, descarga APK e instala (FileProvider / instalador del sistema).
  - Manifiesto + APK en `backend/app-updates/`; `PUBLISH-APK-UPDATE.cmd`; guía `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`.
  - Shorebird queda como parche Dart opcional; flujo principal = APK completa (sin Play Store).
- **Por qué / notas:** Distribución institucional directa, UX equivalente a BanjeCel.
- **Archivos / refs:** `backend/src/routes/appUpdate.js`, `mobile/lib/app_update.dart`, `mobile/lib/main.dart`, `MainActivity.kt`, `PUBLISH-APK-UPDATE.cmd`


## 2026-08-24 — Config APK 1.8.4+13 (API 4G + OTA)

- **Tipo:** release | mejora | ops
- **Área:** mobile | docs
- **Qué:**
  - `pubspec` → **1.8.4+13** (`versionName` / `versionCode`).
  - Build WhatsApp por defecto `API_BASE=https://189.175.38.29:4000`; `FORCE_LAN=1` para HTTPS LAN.
  - Copia a `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk` (+ `TacticalPtx-latest.apk`) y manifiesto OTA `backend/app-updates/`.
  - `network_security_config`: dominio IP pública; README/run-usb alineados a HTTPS.
- **Por qué / notas:** Alineado a `LIVEKIT_PUBLIC_HOST` y al flujo de actualización en app (REQUEST_INSTALL_PACKAGES / FileProvider ya en paralelo).
- **Archivos / refs:** `mobile/pubspec.yaml`, `scripts/BUILD-APK-WHATSAPP.cmd`, `network_security_config.xml`, `run-usb.ps1`, `mobile/README.md`, `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk`

## 2026-08-24 — Diálogos in-app (sin window.confirm)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Componente `AppDialog` (estilo `sys-modal`) para confirmar / avisar dentro de la app.
  - Sustituidos `window.confirm` / `alert` en grupos, chat WhatsApp, mapa y catálogo de geocercas.
- **Por qué / notas:** Los diálogos nativos del navegador no coinciden con la UI institucional.
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchGroups.jsx`, `WhatsAppChat.jsx`, `DispatchMap.jsx`, `GeofenceCatalog.jsx`

## 2026-08-24 — PTT circular y pánico al primer toque (móvil)

- **Tipo:** ux | mejora
- **Área:** mobile | web
- **Qué:**
  - Botón PTT circular táctil (oliva/oro, etiqueta PTT / AL AIRE); hold-to-talk sin cambios.
  - Pánico más visible (rojo urgente) y **dispara al primer toque** — sin diálogo «¿confirmas?».
  - Web alineada: pánico al primer clic; PTT institucional vuelve a ser círculo (no cuadrado redondeado).
- **Por qué / notas:** Captura de radio: PTT poco llamativo y pánico con confirmación.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `radio_shell.dart`, `web/src/pages/RadioPage.jsx`, `web/src/institutional.css`

## 2026-08-24 — Corrección de textos UTF-8 (mojibake)

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:** Corregidos acentos rotos (`SESIÃ³N` → `SESIÓN`, contraseña, vacío, etc.) en login, chat DM y mensajes de error del socket de chat.
- **Archivos / refs:** `web/src/App.jsx`, `web/src/DirectChat.jsx`, `backend/src/socket/chat.js`

## 2026-08-24 — Lockdown ante intrusión + endurecimiento

- **Tipo:** security | infra
- **Área:** backend | infra | docs
- **Qué:**
  - Servicio de lockdown: fallos de login → fuera de servicio (503), revoca sesiones, corta sockets, aviso FCM a root/admin, incidente en Soporte/Respaldos.
  - `POST /api/security/unlock` con `LOCKDOWN_UNLOCK_SECRET`; lockdown manual por root.
  - `infra/LOCKDOWN.ps1` / `.cmd`: cierra firewall/UPnP y detiene API/Web/LiveKit.
  - `/api/metrics` solo con rol despacho; sin backdoors detectados en auditoría.
- **Archivos / refs:** `backend/src/services/intrusion.js`, `routes/security.js`, `LOCKDOWN.ps1`, `SEGURIDAD_LOCKDOWN.md`

## 2026-08-23 — Marca única TacticalPtx

- **Tipo:** docs | mejora | infra
- **Área:** backend | web | mobile | database | docs | infra
- **Qué:**
  - Producto y docs solo bajo marca TacticalPtx (sin nombre anterior).
  - BD `tacticalptx_db`; package web `tacticalptx-web`; localStorage `tacticalptx_*`.
  - iOS bundle `com.tacticalptx.app`; display name TacticalPtx.
  - Carpeta de disco `D:\pulsanet` es solo ruta; el producto es TacticalPtx.
- **Archivos / refs:** `backend/.env`, `config.js`, `schema.sql`, `README.md`, `docs/UBICACION_PROYECTO.md`, iOS `Info.plist` / `project.pbxproj`

## 2026-08-23 — Firewall Windows canónico (sin variantes)

- **Tipo:** infra | security | ops
- **Área:** infra
- **Qué:**
 - Fuente única `infra/Ensure-Firewall.ps1` (solo `netsh`; evita colgar `Get-NetFirewall*`).
 - 6 reglas fijas: TCP 4000/5173/7880/7881 + UDP 7882 + UDP 50000-50200.
 - Elimina variTacticalPtx / “TacticalPtx API TCP…” / livekit-server Any.
 - Integrado en `start-services.ps1`, `EXPOSE-UPNP.ps1`, `EXPOSE-PUBLIC.ps1`; launcher `ENSURE-FIREWALL.cmd`.
 - UPnP: `Reinforce-UPnP.ps1` / `EXPOSE-UPNP.ps1` (hoy el IGD del router no respondió; reintentar con UPnP activo).
- **Archivos / refs:** `infra/Ensure-Firewall.ps1`, `infra/ENSURE-FIREWALL.cmd`, `infra/Reinforce-UPnP.ps1`, `infra/start-services.ps1`

## 2026-08-23 — LEVANTAR-TACTICALPTX.bat corregido y reforzado

- **Tipo:** infra | ops | fix
- **Área:** infra
- **Qué:**
 - BAT en ASCII; `/nopause`; preflight Node/npm; LAN vía `ipconfig` (sin `Get-NetIPAddress`).
 - Health API sin `findstr` con comillas escapadas (rompía `>nul`); detecta `tacticalptx-api`.
 - Solo libera :4000/:5173 si hay listener zombie; no mata API/Web sanos.
 - Postgres 17/16/15; espera ~45 s; abre navegador solo si Web responde.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 — Seguimiento acotado Región / C.G.–Zona / Unidad

- **Tipo:** feature | security | ux
- **Área:** backend | web
- **Qué:**
 - Modelo: Región maestro; C.G. Región con unidades subordinadas directas; Zonas administran unidades; Unidades administran servicios desplegados (usuarios).
 - GPS / seguimiento / pánico / geocerca filtrados por alcance (`loadTrackScope` + salas `dispatch:track:*`).
 - Textos de privilegios y catálogo Unidades alineados a esa jerarquía.
- **Archivos / refs:** `orgUnits.js`, `locations.js`, `dispatch.js`, `panic.js`, `geofences.js`, `LiveTrackMap.jsx`, `DispatchUsers.jsx`, `DispatchUnits.jsx`

## 2026-08-23 — Jerarquía Región / Zonas / Unidades + multi-canal

- **Tipo:** feature | security | ux
- **Área:** backend | web | database
- **Qué:**
 - Rol `unit_admin`; privilegios `can_see_region` / `can_see_zones` / `can_see_units`.
 - Región (root/admin) = maestro; zona controla sus unidades/usuarios; unidad solo los suyos.
 - Lista de canales filtrada por privilegios; radio/despacho con multi-selección (oír varios / hablar en uno).
 - Alta y tabla de usuarios: checkboxes R/Z/U y alcance de zona/unidad.
- **Archivos / refs:** `016_unit_admin_visibility.sql`, `roles.js`, `orgUnits.js`, `admin.js`, `groups.js`, `DispatchUsers.jsx`, `ChannelMultiSelect.jsx`, `RadioPage.jsx`, `DispatchLayout.jsx`

## 2026-08-23 — LEVANTAR-TACTICALPTX.bat reforzado

- **Tipo:** infra | ops
- **Área:** infra
- **Qué:**
 - BAT detecta API HTTP/HTTPS, espera health, libera puertos zombies, lee IP LAN y `LIVEKIT_PUBLIC_HOST`.
 - `start-api.cmd` / `start-web.cmd` más robustos (PATH, npm install, mensajes claros).
 - Stack verificado: API HTTPS ok, Web, LiveKit (`node-ip` pública), Redis.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 — Seguimiento: zoom al cursor (tipo Maps)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** En Seguimiento, la rueda acerca/aleja el punto bajo el cursor (como Google Maps), no el centro del mapa.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-23 — APK 1.8.3+12 (logo oliva/oro)

- **Tipo:** release | ux
- **Área:** mobile
- **Qué:** APK con logo recoloreado; fix sintaxis `panic:update` en `channel_session.dart`. API `https://189.175.38.29:4000`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.3+12-4G-logo.apk`, `pubspec.yaml` `1.8.3+12`

## 2026-08-23 — Logo: rojo → oliva/oro institucional

- **Tipo:** ux | mejora
- **Área:** web | mobile
- **Qué:** Recoloración de `tacticalptx.png` (web + móvil): acentos rojos a oliva `#243d20` y oro `#9a7b2f`; marco del logo alineado a la marca.
- **Por qué / notas:** Respaldo en `Soporte/Respaldos/logo-tacticalptx-*`. Ctrl+F5 en login.
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `mobile/assets/brand/tacticalptx.png`, `styles.css`, `institutional.css`

## 2026-08-23 — Revisión seguridad: cifrado y authz

- **Tipo:** security | fix
- **Área:** backend | web | mobile
- **Qué:**
 - Wire AES también en `dispatch:panic` / `panic_update`; CC descifra.
 - `GET /locations` y tracks solo roles de despacho (incl. `zone_admin`).
 - Ya no se exporta `contentKey`; `wireKey` no se guarda en `localStorage`.
 - FCM de chat/DM sin cuerpo en claro; pánico en chat sin coords.
 - Prod rechaza secretos de ejemplo (content/wire/E2EE); health sin detalle crypto en prod.
 - `zone_admin` entra a despacho / usuarios; LAN TLS solo confía el host de API.
- **Archivos / refs:** `dispatch.js`, `locations.js`, `auth.js`, `contentCrypto.js`, `config.js`, `api.js`, `CommandCenter.jsx`, `lan_tls.dart`

## 2026-08-23 — Chat inbox estilo WhatsApp

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
 - Inbox unificado (grupos + DM) con pestañas Todos / No leídos / Favoritos / Grupos.
 - Favoritos en `localStorage`; badges de no leídos; búsqueda de chats.
 - Banner superior al llegar mensaje fuera del chat abierto; tono doble tipo WhatsApp.
 - DM: ticks de lectura, botón enviar circular; panel sin sidebar duplicada.
- **Por qué / notas:** Recargar Radio con Ctrl+F5.
- **Archivos / refs:** `ChatInbox.jsx`, `RadioPage.jsx`, `DirectChat.jsx`, `styles.css`, `appNotify.js`

## 2026-08-23 — Pánico: Enterado silencia solo este dispositivo

- **Tipo:** fix
- **Área:** web | mobile | backend
- **Qué:** Enterado ya no apaga la sirena en los demás; cada equipo la cancela por su cuenta. Resuelto/cancelado sí cierra en todos.
- **Archivos / refs:** `panic.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

## 2026-08-23 — Organigrama IV R.M. (Región → zonas → unidades)

- **Tipo:** feature
- **Área:** database | backend | web
- **Qué:**
 - Jerarquía operativa: Región → C.G. / 4 Z.M. (+ Sanidad, Aéreas, Justicia) → 70 unidades.
 - Fuente: catálogo institucional IV R.M. (Control Tóner); ParqueVehicular no está en esta PC.
 - Rol `zone_admin` (admin de zona: usuarios en su alcance).
 - Seed: `npm run seed:units` crea unidades + canal PTT por unidad.
 - Catálogo web **Unidades** en despacho.
- **Archivos / refs:** `015_org_units.sql`, `ivRmUnits.js`, `seed-units.js`, `orgUnits.js`, `admin.js`, `DispatchUnits.jsx`

## 2026-08-23 — PTT mini en Seguimiento y resto de despacho

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
 - Botón PTT compacto en la franja de radio (visible en Seguimiento, mapa, catálogos, etc.).
 - Espacio para hablar en toda la consola de despacho.
- **Archivos / refs:** `DispatchLayout.jsx`, `RadioPage.jsx`, `institutional.css`

## 2026-08-22 — Chat: altura fija (2.ª pasada)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
 - Causa real: `.shell` con `min-height: 100dvh` dentro de despacho + `.cc-shell` solo `min-height` → la página crecía con los mensajes.
 - Consola: `height/max-height: 100dvh` + `overflow: hidden` en shell/body/main.
 - Radio embebido: anula min-height del shell; grid/chat en flex con `min-height: 0`; scroll solo en `.wa-log`.
- **Por qué / notas:** Recargar Radio con Ctrl+F5 (hard refresh).
- **Archivos / refs:** `styles.css`, `command-center.css`, `institutional.css` (`.cc-main` tenía `overflow:auto`)

## 2026-08-22 — jlunag2: oía pero no lo oían (LiveKit)

- **Tipo:** fix
- **Área:** backend | web | mobile | infra
- **Qué:**
 - Cap. Luna (`jlunag2`) reportó en chat: escucha pero no sabe si lo oyen; PTT OK, audio de subida fallaba.
 - `LIVEKIT_PUBLIC_HOST` unifica URL LiveKit (web + 4G); LiveKit reiniciado con `--node-ip` pública.
 - Web: re-play audio al `TrackUnmuted`; móvil: `setMicrophoneEnabled` en PTT.
- **Por qué / notas:** Cuenta OK en BD. Fallo de medios ICE (LAN vs pública). Web: Ctrl+F5 + reentrar canal. Móvil: ideal APK nuevo; sin APK, salir/entrar canal tras reinicio LiveKit.
- **Archivos / refs:** `livekit.js`, `.env`, `start-services.ps1`, `usePtt.js`, `channel_session.dart`

## 2026-08-22 — Chat: scroll interno (estilo WhatsApp)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
 - El panel de radio ya no crece con los mensajes; altura fija al viewport.
 - El historial (grupo y DM) hace scroll interno; cabecera y composer quedan fijos.
- **Por qué / notas:** `max-height: none` en `.wa-chat` hacía alargar toda la página. Recargar con Ctrl+F5.
- **Archivos / refs:** `web/src/styles.css`

## 2026-08-22 — Credenciales: modal del sistema (sin alert)

- **Tipo:** ux
- **Área:** web
- **Qué:** Alta/restablecer clave ya no usan `window.alert`/`confirm`; modal institucional con copiar y Esc.
- **Archivos / refs:** `DispatchUsers.jsx`, `institutional.css`

## 2026-08-22 — Fix voz de regreso (LiveKit ICE / URL)

- **Tipo:** fix
- **Área:** backend | web | infra
- **Qué:**
 - LiveKit `use_external_ip: true` + `--node-ip` LAN para que el audio RTP vuelva en LAN y 4G.
 - Token ya no fuerza IP pública desde Vite/localhost; usa `LIVEKIT_LAN_HOST`.
 - Clientes web reescriben `127.0.0.1` en URL LiveKit (`livekitUrl.js`).
 - UPnP 7880–7882 reaplicado.
- **Por qué / notas:** Señal OK pero medios ICE mal anunciados → se oía PTT propio / no el de regreso. Recargar Radio (Ctrl+F5); en app salir y entrar al canal.
- **Archivos / refs:** `livekit.js`, `livekit.dev.yaml`, `usePtt.js`, `livekitUrl.js`

## 2026-08-22 — Pánico: tono más centrado (780/980 Hz)

- **Tipo:** ux
- **Área:** web | mobile
- **Qué:** Sirena hi-lo media (~780↔980 Hz) en lugar del barrido agudo wail; WAV regenerado.
- **Archivos / refs:** `panicSound.js`, `public/sounds/panic_siren.wav`, `mobile/assets/sounds/panic_siren.wav`

## 2026-08-22 — Nuevo sonido de pánico (sirena wail)

- **Tipo:** ux | mejora
- **Área:** web | mobile
- **Qué:** Sirena de emergencia tipo barrido (wail) en lugar del beep 880/1175; asset `panic_siren.wav` en web y app.
- **Archivos / refs:** `web/src/panicSound.js`, `web/public/sounds/panic_siren.wav`, `mobile/assets/sounds/`, `channel_session.dart`

## 2026-08-22 — Grado: desplegable Ejército Mexicano

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Campo Grado en alta de usuarios pasa a `<select>` con grados Art. 129 LOEFAM (Generales → Tropa), abreviatura al aire.
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`, `DispatchUsers.jsx`

## 2026-08-22 — UPnP + firewall para 4G/5G (sin Tailscale móvil)

- **Tipo:** infra | ops
- **Área:** infra | mobile
- **Qué:**
 - Firewall Windows + mapeo UPnP automático (4000/7880/7881/7882) → health pública HTTPS **200**.
 - Script `infra/EXPOSE-UPNP.cmd` / `.ps1`.
 - `LIVEKIT_PUBLIC_URL=ws://189.175.38.29:7880`.
 - APK **1.8.3+10** 4G: `Soporte/APK/TacticalPtx-1.8.3+10-4G.apk`.
- **Por qué / notas:** En el celular solo la APK; sin Tailscale. Tras reiniciar el router, volver a ejecutar EXPOSE-UPNP.
- **Archivos / refs:** `EXPOSE-UPNP.ps1`, `ACCESO_DIRECTO_SIN_TAILSCALE.md`

## 2026-08-22 — Revisión 4G/IP pública (sin Tailscale)

- **Tipo:** ops | infra
- **Área:** infra | mobile | docs
- **Qué:**
 - IP pública `189.175.38.29` (sin CGNAT); LAN `192.168.1.66`.
 - Firewall Windows: TCP 4000/7880/7881 + UDP 7882.
 - Cert TLS regenerado con SAN LAN + IP pública; API reiniciada.
 - Acceso Internet aún pendiente de **reenvío en el router**.
- **Archivos / refs:** `ACCESO_DIRECTO_SIN_TAILSCALE.md`, `EXPOSE-PUBLIC.ps1`, `infra/certs/`

## 2026-08-22 — Fix xhr poll error (socket vía proxy Vite)

- **Tipo:** fix
- **Área:** web
- **Qué:** En DEV el socket ya no apunta a `https://127.0.0.1:4000` (cert autofirmado → xhr poll error); usa mismo origen y el proxy Vite (`secure:false`).
- **Archivos / refs:** `web/src/socketConfig.js`

## 2026-08-22 — Fix CERTIFICATE_VERIFY_FAILED (APK 1.8.3+9)

- **Tipo:** fix | security
- **Área:** mobile
- **Qué:**
 - Flutter confía el cert LAN vía `LanTls` + asset `assets/certs/lan-cert.pem` (HttpOverrides).
 - Allowlist de hosts privados como respaldo; mensaje de error en español.
 - APK **1.8.3+9** con `API_BASE=https://192.168.1.66:4000`.
- **Por qué / notas:** `network_security_config` de Android no aplica al HttpClient de Dart; por eso fallaba el login HTTPS.
- **Archivos / refs:** `lan_tls.dart`, `main.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.3+9.apk`

## 2026-08-22 — Escalón TLS LAN + APK HTTPS 1.8.3+8

- **Tipo:** security | ops
- **Área:** backend | web | mobile | infra
- **Qué:**
 - Escalón 1: API reiniciada; health OK; GPS exige auth; LiveKit :7880 OK; wire on.
 - Escalón 2: `TLS_CERT`/`TLS_KEY` activos; CORS HTTPS; Vite proxy `https://127.0.0.1:4000` (secure:false); LiveKit sigue en `ws://` (no forzar wss).
 - Escalón 3: APK **1.8.3+8** con `API_BASE=https://192.168.1.66:4000` + `network_security_config` (cert LAN embebido).
- **Por qué / notas:** HTTP plano a :4000 ya no responde. Reiniciar Vite. En navegador aceptar cert autofirmado si abres la API directo.
- **Archivos / refs:** `backend/.env`, `vite.config.js`, `socketConfig.js`, `network_security_config.xml`, `Soporte/APK/TacticalPtx-1.8.3+8.apk`

## 2026-08-22 — APK 1.8.3+7

- **Tipo:** ops
- **Área:** mobile
- **Qué:**
 - Build release `1.8.3+7` con `API_BASE=http://192.168.1.66:4000`.
 - Copia en `Soporte/APK/TacticalPtx-1.8.3+7.apk` y `TacticalPtx-latest.apk`.
- **Por qué / notas:** Actualización de campo tras cifrado wire/TLS y fixes de indicativo.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/build/app/outputs/flutter-apk/app-release.apk`

## 2026-08-22 — Cifrado en tránsito + fix indicativo JWT

- **Tipo:** security | fix
- **Área:** backend | web | infra
- **Qué:**
 - Perfil vivo desde BD en auth REST y sockets (indicativo/rol ya no quedan congelados en el JWT).
 - TLS opcional (`TLS_CERT`/`TLS_KEY`) + generador LAN de certificados PEM.
 - Cifrado wire AES-256-GCM de GPS/geocerca en socket; login/`/me` entregan `crypto.wireKey`.
 - LiveKit wss si la API va por HTTPS; prod exige claves de contenido, voz y wire.
 - Índice de matrícula alineado en `schema.sql`.
- **Por qué / notas:** Refuerza tráfico entre hosts; descomentar TLS en `.env` para HTTPS total. Reiniciar API; en despacho se refresca la clave wire vía `/api/auth/me`.
- **Archivos / refs:** `userProfile.js`, `wireCrypto.js`, `tls.js`, `server.js`, `auth.js`, `generate-lan-certs.mjs`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 — Contraste tema oscuro en todo el web

- **Tipo:** fix
- **Área:** web | mobile
- **Qué:**
 - Capa `theme-contrast.css` al final: selects, botones, chat, pánico, badges, popups Leaflet, tablas y formularios legibles en claro/oscuro.
 - Corregidos texto perdido en selector de canal, botones primary/WA, banner al aire y chips.
- **Archivos / refs:** `theme-contrast.css`, `main.jsx`, `DispatchLayout.jsx`, `styles.css`, `command-center.css`, `chat_panel.dart`

## 2026-08-22 — Selects legibles en tema oscuro

- **Tipo:** fix
- **Área:** web
- **Qué:** Opciones del selector de canal/grupos con contraste correcto (fondo oscuro + texto claro; evita letras blancas sobre blanco).
- **Archivos / refs:** `institutional.css`, `command-center.css`

## 2026-08-22 — Usuarios: grado, especialidad, nombres, matrícula e indicativo

- **Tipo:** feature
- **Área:** backend | web | database
- **Qué:**
 - Alta pide Grado, Especialidad, Nombre(s), Apellidos y Matrícula.
 - Al hablar/publicar el `display_name` es el indicativo **Grado + apellido paterno** (ej. Cap. Gomez); el canal se muestra aparte (ej. B.O. «Las Granaditas»).
- **Archivos / refs:** `014_user_identity.sql`, `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `DispatchLayout.jsx`

## 2026-08-22 — Geocercas fuera de Catálogos

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitada la entrada Geocercas de Catálogos (menú y pestañas); las zonas se gestionan en Mapa en vivo. URL antigua redirige a `/despacho/mapa`.
- **Archivos / refs:** `CatalogsLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

## 2026-08-22 — Sin textos “como WhatsApp” en la UI

- **Tipo:** ux
- **Área:** web | mobile
- **Qué:** Eliminadas frases de comparación con WhatsApp en Seguimiento, perfil y comentarios visibles al producto.
- **Archivos / refs:** `LiveTrackMap.jsx`, `radio_shell.dart`

## 2026-08-22 — Login más presentable (web + móvil)

- **Tipo:** ux
- **Área:** web | mobile
- **Qué:** Login con más presencia de marca, atmósfera oliva/oro, animaciones suaves y tarjeta con acento dorado (misma identidad institucional).
- **Archivos / refs:** `App.jsx`, `institutional.css`, `mobile/lib/screens/login_screen.dart`

## 2026-08-22 — Colores app alineados a web institucional

- **Tipo:** ux
- **Área:** mobile | web
- **Qué:**
 - App móvil: paleta oliva/oro (login, radio, chat, llamadas, cambio de clave).
 - Seguimiento y llamadas web: sin verde/azul WhatsApp; usan `--cc-live` / oliva institucional.
- **Archivos / refs:** `mobile/lib/theme.dart`, `incoming_call_screen.dart`, `direct_pane.dart`, `command-center.css`, `styles.css`, `LiveTrackMap.jsx`

## 2026-08-22 — Seguimiento maximizar + Esc cierra overlays

- **Tipo:** ux
- **Área:** web
- **Qué:**
 - Botón Maximizar / Reducir en Seguimiento (pantalla completa; Esc o clic).
 - Esc global cierra fullscreen, lightbox, llamada entrante/privada y overlays `data-esc-close`.
- **Archivos / refs:** `GlobalEscapeClose.jsx`, `LiveTrackMap.jsx`, `ChatMedia.jsx`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`

## 2026-08-22 — Seguimiento: ubicaciones se refrescan solas (~5 s)

- **Tipo:** mejora
- **Área:** web
- **Qué:**
 - Seguimiento / Mapa / Consola refrescan GPS y rastro automáticamente al ritmo del latido (5 s).
 - Merge socket+poll sin pisar fixes más nuevos; rejoin al reconectar; refresh al volver a la pestaña.
- **Archivos / refs:** `web/src/dispatch/liveTiming.js`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 — Radio, mensajes y GPS con pantalla bloqueada

- **Tipo:** feature
- **Área:** mobile
- **Qué:**
 - Servicio en primer plano incluye `location` además de micrófono/reproducción.
 - Sesión de audio (voice) para seguir oyendo el canal bloqueado.
 - GPS pide ubicación “siempre”; stream iOS con background updates.
 - FCM en background muestra aviso local si el push es solo `data`.
- **Por qué / notas:** Mantener el aviso persistente “TacticalPtx activo”; aceptar ubicación siempre y no optimizar batería.
- **Archivos / refs:** `background_radio.dart`, `location_heartbeat.dart`, `audio_session_setup.dart`, `AndroidManifest.xml`, `Info.plist`, `push_service.dart`

## 2026-08-22 — Icono de perfil (estilo WhatsApp en seguimiento)

- **Tipo:** feature
- **Área:** mobile | backend | web
- **Qué:**
 - El usuario cambia su foto en la app (perfil → galería/cámara).
 - El icono se muestra en Seguimiento web como bolita con foto (WhatsApp).
- **Archivos / refs:** `backend/src/routes/me.js`, `locations.js`, `auth.js`, `LiveTrackMap.jsx`, `radio_shell.dart`, `api_client.dart`

---
## 2026-08-22 — UI más suave (radios e iconos)

- **Tipo:** ux
- **Área:** web | mobile
- **Qué:** Quitados bordes cuadrados agresivos; login, botones, paneles, menú e iconos con radio suave y “pozos” redondeados para iconos.
- **Archivos / refs:** `web/src/institutional.css`, `mobile/lib/theme.dart`, `mobile/lib/screens/login_screen.dart`

---
## 2026-08-22 — Mensajes de error en español

- **Tipo:** ux | fix
- **Área:** web | mobile
- **Qué:** Traducción de errores técnicos del navegador/LiveKit/red (`Permission denied`, etc.) a español claro; Offline → Fuera de línea.
- **Archivos / refs:** `web/src/esMsg.js`, `usePtt.js`, `api.js`, `RadioPage.jsx`, `mobile/lib/es_msg.dart`

---
## 2026-08-22 — Radio mantiene menú de despacho

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Radio pasa a `/despacho/radio` dentro del layout; el rail no desaparece. PTT compartido (sin doble LiveKit). Operadores sin despacho siguen en `/radio`.
- **Archivos / refs:** `App.jsx`, `DispatchLayout.jsx`, `RadioPage.jsx`, `styles.css`

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
 - `D:\Soporte` es unión → `D:\pulsanet\Soporte` (compat Firebase/bitácora).
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
 - Etapa 4: Checklist de campo en `Soporte\Documentos\VALIDACION_CAMPO_1_8_0.md`.
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
 - Guía: `D:\Soporte\Documentos\TACTICALPTX_4G_TAILSCALE.md`
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
 - Se borra el alias `LEVANTAR-TACTICALPTX.bat` y los lanzadores duplicados de Shorebird/diagnóstico (nunca hubo `shorebird.yaml`).
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
- **Archivos / refs:** `backend/.env`, `mobile/android/app/google-services.json`, `D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json`, `docs/FCM_PUSH.md`

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
- **Por qué / notas:** Carpeta de trabajo `D:\pulsanet` y BD `tacticalptx_db` se mantienen (rutas/datos); el producto se llama TacticalPtx. Package Android nuevo: hay que **desinstalar** la app anterior `com.tacticalptx.*` e instalar esta.
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`, `main.dart`, `BrandName.jsx`, `LEVANTAR-TACTICALPTX.bat`

---
## 2026-08-12 — Rebrand TacticalPtx + paleta táctica

- **Tipo:** ux
- **Área:** web | mobile | backend
- **Qué:**
 - Marca visible **TacticalPtx** (logo + wordmark plata/rojo).
 - Paleta negro / rojo / ámbar-dorado según logo; tema oscuro por defecto en web.
 - App Android: label, login con logo, tema dark táctico.
- **Por qué / notas:** No se renombró el repo ni el package `com.tacticalptx.*` (interno).
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
- **Qué:** Sustituido el marcador vacío por SVG micrófono + ondas (marca TacticalPtx) en la cabecera del centro de operaciones.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`

---
## 2026-08-12 — Consola admin más profesional (sin demo)

- **Tipo:** ux
- **Área:** web
- **Qué:**
 - Centro de operaciones: cabecera, badges de rol, formularios/tablas pulidos.
 - Usuarios/Grupos con etiquetas en español; sin contraseñas ni textos demo.
 - Login sin cuentas de demostración; sesión `tacticalptx_session`.
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
 - Seed + UI despacho: `root@tacticalptx.local` / `demo1234`.
- **Archivos / refs:** `admin.js`, `groups.js`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `api.js`, `seed.js`

---
## 2026-08-12 — BAT + stack local levantado

- **Tipo:** ops
- **Área:** infra / ops
- **Qué:**
 - Creado `LEVANTAR-TACTICALPTX.bat` (Postgres + Redis/LiveKit + API + Web).
 - Stack arrancado: PG Running, Redis, LiveKit (`node-ip=192.168.1.66`), API health OK.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`

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
- **Qué:** Canal `tacticalptx_alerts`, notificaciones foreground, re-registro token, `GET/POST /api/devices/me|test`. Checklist Soporte.
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
 - Rebuild APK `TacticalPtx-LAN.apk` (Gradle en D: por C: lleno).
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

## 2026-08-26 — Controles de llamada estilo teléfono/WhatsApp (app)

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:** En llamada privada: **Silenciar**, **Teclado**, **Altavoz/Auricular**, **Mensaje** (DM sin colgar), **Más** (audio entrante), temporizador y colgar. Radio 1:1: PTT + altavoz + mensaje.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`

*Fin de entradas históricas iniciales. Las nuevas van encima de esta línea de separación (después del encabezado “Cómo registrar”).*
