# Changelog — TacticalPtx

Registro de versiones y cambios relevantes del producto (TacticalPtx). 
Bitácora narrativa (día a día): [BITACORA_DESARROLLO.md](BITACORA_DESARROLLO.md)

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
- **Configuración → Eventos (timeline):** sesión, presencia, geocerca, mensajes (uno a uno), llamadas, radio/PTT, pánico y cuenta. Botón **Ver** abre el chat DM/grupo en **solo lectura**.
- **Configuración → Eventos:** historial legible por operador (select persona + tipo + fechas). Incluye enter/exit de geocerca y creación/desactivación/reactivación de cuenta.
- **Consola — geocerca:** notificación flotante + campanita al entrar/salir de zona.
- **Chat directo APK — selección múltiple:** mantener pulsado entra en modo selección (check, contador, borrar / compartir / copiar). Borrar solo mensajes propios con el delete ya existente; compartir solo texto y archivos que ya están en el teléfono.

### Changed
- **Consola — tooltip radio:** se quitó «Oír es aparte» del tooltip del canal de Hablar.
- **Consola KPI:** Canales → Grupos, Con GPS → Operadores, Alertas activas → Alertas; se quitó el KPI «Al aire ahora».
- **Consola / Sitios — color:** doble clic en la bolita abre una paleta propia; **doble clic en el color de esa paleta** confirma y cierra (ya no depende de la ventanita nativa del SO).
- **Zumbido APK — notificación:** canal `tacticalptx_nudge_v5` con vibración alternada (el shade de Android no desplaza el banner). En primer plano, fuera de ese chat, la UI y el globo se sacuden.
- **Consola Ruta — calendario:** la etiqueta del tope dice «Máx. 30 días» (antes «Máx. 30 d»).
- **Consola mapa — leyenda de presencia:** las pastillas (En línea, Ausente, Desconectado, Fuera de línea) siguen el filtro ESTADO: lo desmarcado no se muestra. Los conteos son de los pines que siguen en el mapa.
- **Consola — maximizado:** «Ocultar panel» / «Mostrar panel» abajo al centro del mapa (ya no en las pestañas ni junto a las capas).
- **Consola — barra ops (maximizado):** pulido a11y/chrome; colapso solo en maximizado.

### Fixed
- **Consola ops — toolbar:** la franja de paneles ya no cambia de alto al pasar entre Sitios / Operadores / Ruta / Geocerca (altura fija de una fila label+control).
- **Consola / Sitios — color:** se quitó el cuadro intermedio del portal; doble clic en la bolita abre solo la paleta nativa.
- **Consola / Sitios — paleta nativa:** al doble clic en la bolita vuelve a abrirse el selector de color (antes solo se veía el swatch del portal y se cerraba al interactuar).
- **Consola Geocerca — Guardar/Cancelar:** misma altura que los inputs del panel (`--map-ops-ctrl-min-h`); ya no agrandan la barra.
- **Consola / Sitios — paleta de color:** al doble clic en la bolita la paleta ya se ve fija (portal); no se oculta detrás del toolbar ni se cierra sola al abrir.
- **Consola Geocerca — ancho del select:** el multi-select de geocercas queda al mismo ancho (11rem) que Persona/Grupo/Sitios; el desplegable ya no abre más ancho que el resto.
- **Llamada móvil:** el timbre/ringback sigue sonando, y al conectar se reafirma el audio de voz (el `ToneGenerator` de ringback ya no deja la llamada en silencio; la radio no pisa `MODE_NORMAL` durante la llamada).
- **Zumbido APK:** el aviso de espera ya no muestra el prefijo `Exception:` (solo «Espera 10s para otro zumbido»). El chat se sacude al enviar y al recibir, como en la web.
- **Consola ops — toggles:** «Fijar en mapa» y «Ruta probable» (`.map-fix-toggle`) usan la misma altura que select / trigger / `.cc-btn` (`--map-ops-ctrl-min-h`), alineados al pie de la fila. La fila Ruta no se mueve.
- **Consola Ruta — fila de controles:** Ruta · Desde · Hasta · Ruta probable vuelven a una sola fila compacta a la izquierda (`nowrap`; el rango ya no wrappea ni ocupa 100%).
- **Consola mapa maximizado — tipo de mapa:** Natural / Satélite / Claro no cambiaban tras reparent a `body`; delegación nativa `data-map-layer` (mismo listener que el panel).
- **Consola mapa maximizado — pestañas ops:** el clic no llegaba tras reparent a `body`; delegación nativa `data-ops-tab-id`.
- **Consola mapa maximizado — leyenda y capas:** vuelven a verse con la barra abierta (chrome por encima de Leaflet).
- **Consola Ruta — «Ruta probable»:** el check queda junto a Hasta (sin hueco a la derecha); se quitó el `flex-grow` de `.map-track-range` en el panel Ruta.
- **Consola Ruta:** la selección de operador ya no se borra al clic/pan en el mapa ni en el siguiente poll; se quitó la poda de `trackUserIds` contra pines filtrados (`visibleLocations`); Ruta sigue el universo `gpsPeople`.
- **Geocerca color:** la bolita seleccionada muestra anillo visible (`is-active` compartido con Sitios).
- **Ruta — radio singleSelect:** sin caja/anillo cuadrado alrededor del radio seleccionado (solo el círculo); checkboxes multi-select intactos.
- **Cluster mapa — over-zoom:** al picar un cluster con miembros cercanos, el encuadre ya no acerca de más (pines fuera de frame); tope 16.5, padding 96 y soft +1 en web/mobile.
- **Consola Geocerca:** el poll del mapa ya no deja KPI/lista en 0 por un `ReferenceError` (`loc` tras renombrar a `allLoc`) ni por `Promise.all` acoplado; geocercas se aplican con `allSettled` y no se vacían si falla GPS/overview.
- **Ruta probable — cuerdas rectas sin sentido:** al perder GPS, el hueco ya no se deja como atajo verde; se pide OSRM (multi-base) y, si falla, un corredor estimado multi-punto naranja punteado (nunca A→B de 2 puntos). Saltos post-RDP ≥700 m también se tratan como hueco.

### Release
- **APK 1.8.177+187:** Radio — nombre de canal en encabezado y chip lateral; selector inferior con números; sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.176+186:** zumbido 1.8.175 más el fix de audio de llamada (ringback / voz tras el timbre); sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.175+185:** zumbido sin prefijo `Exception:`, shake del chat y vibración alternada en la notificación; sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.174+184:** sideload con código mobile pendiente tras 1.8.173; sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.173+183:** volumen «llamadas» solo PTT/llamada/video; al salir de Radio / minimizar / cerrar → multimedia. Sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.172+182:** fix volumen «llamadas» en segundo plano (`MODE_IN_COMMUNICATION`); sin OTA. Artefactos en `pulsanet_soporte\APK\`.
- **APK 1.8.171+181:** PTT Pulsación Corta/Larga, tonos Walkie Talkie, composer +/🙂/🫨; `SERVER_LAN_IP=192.168.1.77`; sin OTA. Artefactos en `pulsanet_soporte\APK\`.

### Changed
- **Routing huecos:** `ROUTING_OSRM_FALLBACKS`, `ROUTING_OSRM_ALLOW_PUBLIC`; timeout default 20 s; `TRACK_POST_SIMPLIFY_JUMP_M` default 700; `TRACK_GAP_JUMP_METERS` default 1000.

### Added
- **Consola — maximizado + barra ops:** al maximizar se mantienen Operadores/Ruta/Geocerca/Sitios; solo ahí «Ocultar» / «Mostrar» para mapa a pantalla completa (preferencia local).
- **Consola — pin «Ver ruta»:** selecciona ese operador en Ruta; conserva Desde/Hasta si ya había periodo/ruta; si no, hoy 00:00→ahora.
- **Consola Ruta — check «Ruta probable»:** activa/desactiva huecos GPS (naranja) en mapa y leyenda; preferencia en localStorage.
- **Ruta — periodo calendario (120 h):** atajos 8/24/48/120 h + Desde/Hasta; sin futuro ni más atrás de 130 h; API `from`/`to`; N operadores vía multi-select.
- **Geocercas — color en mapa:** selector de color (swatches como sitios tácticos) en alta/edición; campo `color` en API/BD; círculos Leaflet y catálogo usan el hex elegido (default `#243d20`).
- **PTT mapa — Individual/Múltiple:** selector compacto en el menú flotante (Escuchar/Hablar/Video/Alerta), sincronizado con Radio vía las mismas claves localStorage.
- **Geocercas — editar en Consola:** mismo formulario de alta para PATCH (`updateGeofence`); acciones compactas ✎/× en multi-select alineadas a catálogos y temas.
- **PTT mapa — Videollamada:** en el menú flotante (pestaña Video), botón de acción que abre videollamada de grupo con los canales seleccionados (`tacticalptx:open-group-video`), igual que Radio.
- **Chat web — punto de presencia:** avatares de Contactos/DM y cabecera 1:1 con semáforo (paridad APK); colores `PRESENCE_CLUSTER_COLORS`.

### Changed
- **Selects vacíos:** placeholder «— elegir —» → «— Seleccionar —» (Ruta, Grupo, etc.).
- **Ruta — Desde/Hasta calendario:** popover más compacto (padding/gaps/celdas/steppers/footer densos); menos huella sobre el mapa; temas intactos.
- **PTT mapa — Videollamada:** misma altura que Alerta en el menú flotante (padding/borde e icono alineados).
- **Ruta — Cancelar/Aceptar:** mismo ancho, outline a intensidad plena y hover con relleno (fill) en lugar de solo opacity; disabled claramente muted.
- **Consola Operadores:** caret del select nativo (Por operador / Por grupo) alineado al ▾ de los multi-select (Grupo / En grupo / Estado).
- **PTT mapa — Videollamada:** botón del menú flotante con colores fijos de Radio (fondo `#f4f6f2`, texto `#1f2a1c`); deja de fundirse con el menú Obscuro.
- **Ruta radio — clic fuera = Aceptar:** fuera del panel y cierre exclusivo ms confirman el borrador; Cancelar/Esc siguen descartando.
- **Ruta select:** Cancelar en rojo suave (`--cc-danger`); Cancelar/Esc descartan borrador; clic fuera y cierre exclusivo confirman como Aceptar. `trackUserIds` no se restaura de localStorage al cargar (cada sesión «— elegir —»).
- **Dock radio (consola/mapa):** chip solo informativo (sin enlace a Config); texto de Hablar multi-canal (`talkIds`) + Oír X/Y aparte; tooltip con lista completa.
- **Ruta — Aceptar/Cancelar:** pie del panel (Cancelar izq. / Aceptar der.); Ascendente solo en cabecera.- **Consola Operadores:** se elimina el modo «Todos»; solo **Por operador** | **Por grupo**. Persistido `all` migra a `operator` con Persona re-sembrada (todos marcados ≈ UX anterior).
- **Consola multi-select (Grupo / En grupo / Sitios / Estado / Ruta):** fila seleccionada y checkbox con tint sutil vía `--cc-accent` / `--cc-panel` (estilo Vehículos PV); elimina el azul saturado `#1e3a8a` en Obscuro.
- **Operadores / Ruta:** Por operador|Por grupo (+ subfiltro en grupo); Ruta radio 1 operador independiente; historial hasta 30 días (lookback 31).
- **Sitios (consola):** desplegable de capas homologado al de Ruta (ordenar / marcar / buscar / resize).
- **Consola KPI:** reordenables por arrastre (orden persistido), igual que pestañas Sitios/Operadores/Ruta/Geocerca.
- **Ruta — periodo:** sin chips 8/24/48/120 h; calendario/hora propio (popover clicable) en Desde/Hasta.
- **Radio — arrastre de canales:** pointer DnD en asa grande (umbral 8px, patrón nav/catálogo PV); ya no HTML5 en toda la fila.
- **Tonos PTT Walkie Talkie:** press/release sustituidos por extractos del MP3 (app + web). Respaldo `ptt_sounds_20260920_145944`.
- **PTT Mantén / Toque:** el usuario elige modo (sostener vs alternar) en app y web; se guarda la preferencia. Respaldo `ptt_modo_20260920_141721`.
- **Clusters GPS:** el pastel muestra solo cifras por color (sin total solapado); un color = total al centro.
- **Contactos APK:** semáforo de presencia + orden en línea → ausente → fuera de línea.
- **Canales radio APK:** selector inferior solo iconos centrados (sin nombre repetido).

### Fixed
- **Consola — Persona select «mocho»:** ellipsis + caret siempre visible en multi-selects ops; con 1 seleccionado, Grado+Cargo compacto + tooltip (como Ruta).
- **Consola — pines Por grupo:** el pin vuelve a mostrar la foto del grupo (fallback a la del usuario); Por operador sigue con foto individual.
- **Operadores «En grupo»:** Marcar/Desmarcar con ids explícitos (vacío = ninguno en mapa; 1.ª vez todos); sin bolitas de color de ruta en Persona/En grupo (`showColorDots`).
- **Ruta panel multi-select:** esquina permite resize horizontal y vertical; tooltip del nombre completo si hay ellipsis; en modo radio (1 operador) no se muestra la bolita de color.
- **Ruta select:** si el nombre no cabe → Grado + Cargo visibles; tooltip con el indicativo completo; sin solape con Desde/Hasta.
- **Operadores Persona/Grupo:** la selección se guarda por modo (1.ª vez todos los checks; no se pierde al cambiar de modo ni al cerrar el panel).
- **APK volumen llamadas:** al cambiar a Chats/Llamadas/GPS, minimizar o cerrar → `MODE_NORMAL`; VoIP solo PTT/llamada/video; FGS reafirma media si LiveKit lo pisa.
- **Ops pestañas:** cursor al reordenar = manita abierta (`grab`); Operadores refuerza altura frente a `.cc-tactical-ms-trigger` base.
- **Radio APK lag:** el rescate de audio rearmaba LiveKit en FGS/lifecycle y congelaba botones; ahora solo actúa si el modo no es normal + setState coalescido.
- **APK GPS — iconos de sitios:** marcadores usan el icono de agrupación (`groupIconUrl` + Bearer), no la banderita fija; sin icono → círculo de color.
- **APK audio segundo plano:** LiveKit manual + reclaim `MODE_NORMAL` al minimizar/FGS; ya no deja «Volumen de llamadas» colgado sin PTT/llamada.
- **Mapa maximizar → fullscreen real:** `requestFullscreen` en la página del mapa (oculta pestañas Edge + barra de tareas); reparent/`html.map-viewport-max` se mantiene; Restaurar/Esc hace `exitFullscreen` + cleanup; `invalidateSize` escalonado mitiga freeze Leaflet.
- **Mapa maximizar:** full-bleed real — reparent a `document.body` + `html.map-viewport-max` (el solo-CSS `:has`/overflow no bastaba); oculta chrome ops/rail; Restaurar/Esc recupera.
- **Login/favicon Obscuro:** círculo azul/plata al mismo tamaño aparente que Verde (escala del glifo en PNGs; cache-bust `v=3` / `v=2`).
- **APK composer chat:** barra con `+` / `🙂` / `🫨` (zumbido solo DM) como en web; antes sticky_note + vibration poco reconocibles.
- **Cluster GPS clic:** al tocar el círculo encuadra a todos los miembros (`fitBounds`/`fitCamera`); evita zoom al centroide con mapa vacío.
- **PTT bip APK/web:** cue fiable (lowLatency, bip antes de voz); remitente y destinatarios oyen press/release.

### Security
- **Chat sin APK:** uploads bloquean `.apk`/`.aab`/`.jar`/`.dex` (y MIME Android); distribución solo OTA. Cliente alineado.
- **Listen + XFF:** con production/PUBLIC_DOMAIN no se acepta `LISTEN_HOST` no-loopback (salvo `TPX_LISTEN_UNSAFE=1`); `X-Forwarded-For` solo si el peer es loopback.
- **Presence HTTP:** `/presence/heartbeat` solo `focus=service` (FGS); foreground/background por socket.
- **Backup zip-slip:** restore valida entradas `tar` y rutas/symlinks dentro de staging.
- **Wire keys por socket:** GPS/pánico se sellan con AES por conexión de despacho (`dispatch:joined`); login/`/me` ya no exportan `wireKey` org-wide (solo `wireEnabled` a despacho).

### Added
- **APK 1.8.162 clusters pastel:** misma gráfica de pastel por presencia/pánico que web (colores, orden, radio 55, tamaño 44/48/52).
- **Clusters GPS pastel:** el círculo de agrupación se divide por colores de presencia/pánico (verde/amarillo/gris/rojo), web + APK.
- **Semáforo presencia configurable:** checks en Config → Presencia para mostrar/ocultar Ausente (amarillo) y Desconectado (gris); verde y rojo siempre. Leyenda, pines y filtro Estado se adaptan. Manual: `docs/MANUAL_SEMAFORO_PRESENCIA.md`.
- **Presencia Ausente:** pin amarillo tras N min minimizada/2º plano (configurable); fuera de línea (rojo) tras gris; filtro Estado multi-check en Consola Operadores; 0 desactiva amarillo o fuerza rojo inmediato.
- **FGS presencia (APK):** heartbeat `focus: service` con app cerrada → mapa Ausente (no gris) mientras el servicio vive.
- **Sonidos APK:** menú para elegir tono de mensajes, llamadas, videollamadas y zumbidos (`SoundPrefs` + canales Android v4); sin desfase entre notificación y AudioPlayer.
- **Clusters GPS (APK + web):** pines cercanos se agrupan en círculo azul con conteo y anillos de pulso; al tocar se acerca el zoom.
- **Pitido PTT:** tono suave al pulsar y soltar el PTT (APK + web).
- **Canal abierto (APK):** con ≥2 membresías, canal virtual que escucha todos los grupos; PTT en un solo talk; chip «Último: grupo — quién» cambia el destino de habla.
- **PTT por rol (web + APK):** operadores hold-to-talk; root/admin/zona/unidad latch (toggle); takeover `ptt:taken` corta mic y avisa «Canal tomado por …».
- **Tercer tema web:** **Claro** | **Verde** (ex-Obscuro oliva/HUD) | **Obscuro** (paleta slate/azul de ParqueVehicular). Chip cicla los tres; `localStorage` migra `dark`→`verde`.

### Changed
- **APK 1.8.166 UX:** chat con APK/ZIP y confirmación; Contestar más claro; Radio con nombre de canal; PTT bip fuerte press/release; GPS con etiquetas, Este grupo/Todos y asa para ocultar lista.
- **Pitido PTT (APK 1.8.165 + web):** chirp ascendente al pulsar y descendente al soltar (claro, volumen moderado).

### Fixed
- **APK 1.8.164 Enviar imagen:** botones Cancelar/Enviar ya no quedan bajo la barra del sistema en tablet.
- **Web llamada — avatar:** la foto del peer vuelve a mostrarse en el overlay (antes caía a iniciales por cache/mapa).
- **APK 1.8.163 Zumbido:** el botón de enviar zumbido volvió al composer DM (se había perdido al unificar `ChatComposer`).
- **Consola Operaciones — pines:** en filtro «Por grupo» ya no se pinta el emblema del grupo en cada operador; cada pin usa la foto del usuario.
- **APK 1.8.161 Contestar con pantalla encendida (Galaxy Tab):** wake nativo en el receiver FCM (`IncomingCallWakeService` CallStyle + `startActivity` desde FGS). El FSI se degrada a heads-up con pantalla ON por diseño Android; el MethodChannel de MainActivity no existe en el isolate FCM.
- **APK 1.8.160 llamada Contestar (Galaxy Tab):** FCM de llamada ya no lleva payload `notification` (bloqueaba FSI); data-only + FGS/`launchApp` abren pantalla Contestar aunque el permiso FSI esté dado.
- **APK 1.8.159 llamada Galaxy Tab:** full-screen intent + `launchApp`/bring-to-front reforzados para que Contestar salte a pantalla completa (no solo heads-up).
- **Integridad 2026-09-17:** TLS DuckDNS sin bypass de cert; LiveKit LAN solo por Host privado; XFF solo con TRUST_PROXY; FCM private; refresh/media hairpin; delivery acks móvil; video multi web ya no llama API inexistente.
- **APK 1.8.154 login HTTPS:** quitado `connectionFactory` que enviaba HTTP plano a :443 (`Client sent an HTTP request to an HTTPS server` / Broken pipe).
- **APK 1.8.153 login 4G:** el failover ya no fuerza `192.168.1.77` sin probe; override LAN inalcanzable vuelve a DuckDNS.
- **APK 1.8.152 Wi‑Fi Radio/Chats:** LiveKit ya no usa DuckDNS:41260 en LAN; API/audio van a `192.168.1.77`. DuckDNS AAAA obsoleto se borra; el APK resuelve solo IPv4 en 4G.
- **Mic PTT multi-sesión (admin):** varias apps abiertas OK; al pulsar PTT en un cliente se corta el mic en los demás del mismo usuario (`socketId` en floor + `ptt:taken` / `same_user_other_client`).
- **Calls HTML 404 (APK 1.8.135):** historial de llamadas soft-fail si el borde sirve HTML en vez de JSON; auth sigue visible. Caddy LAN recarga hosts `.51`/`.57`/`.58` con `/api*` → Node.
- **Socket APK `:0`:** URL Socket.IO ya no usa puerto 0 (rompe upgrade WebSocket); fuerza 443/80 y omite default en la URL.
- **DM HTML 404:** inbox tolera fallo de `/api/dm/conversations` sin tumbar la app; mensaje si Caddy sirve HTML en lugar de JSON API.
- **Audio post-PTT:** tras soltar/takeover se restaura sesión radio + `MODE_NORMAL` (evita bloquear notas de voz de WhatsApp).
- **Alerta APK:** círculo rojo sólido, icono/ondas amarillos, etiqueta blanca.

### Changed
- **Presencia activa:** ping cada 15 s (APK + web) + heartbeat HTTP de refuerzo; GPS FGS también refresca presencia.
- **Geocerca (Consola):** «Nueva geocerca» abre el formulario; el clic en mapa es toggle opcional **«Fijar en mapa»** (ya no el botón «Clic en mapa…»).
- **Rail marca Tactical 1/2:** expandido usa `tactical_rail_expanded.png` (logo+texto en imagen); contraído/tablet/teléfono usa `tactical_rail_collapsed.png`. Sin texto HTML duplicado en el rail.
- **Marca en rail de módulos:** emblema SICOM + lema partido (arriba/abajo) dentro del panel; al minimizar solo queda el logo pequeño. Topbar libre de banner.
- **GPS APK → completo:** paridad con seguimiento web — avatares con latido, ficha al seleccionar, estados IV R.M., sitios tácticos, ruta + huecos OSRM.
- **Rebrand SICOM:** nombre visible **SICOM** (*Sistema de Comunicaciones para Operaciones Militares*); logo nuevo; paleta bronce/oliva/HUD alineada al logotipo (Web + APK). Sin cambiar package id, crypto, BD ni IDs FCM.

### Added
- **Menú PTT mapa (pestañas/encabezado):** click derecho en PTT maximizado → Escuchar/Hablar/Video/Alerta; preferencia en Configuración → Canales.
- **PTT flotante en mapa maximizado:** arrastrable; click izquierdo hablar/soltar; click derecho menú Hablar/Oír + alarma + reset de posición (Despacho y Seguimiento).
- **GPS en APK (mando):** pestaña **GPS** junto a Radio para root / admin región / zona / unidad — lista + mapa en vivo de compañeros (`GET /api/locations`), sin consola de despacho.
- **Foto de perfil/grupo en grande (APK):** tocar el avatar abre visor a pantalla completa con zoom (estilo WhatsApp).
- **Menú ⋮ móvil (estilo WhatsApp):** a la derecha en Chats/Llamadas/Radio — canales, foto de perfil, datos, configuraciones, GPS; en Llamadas, borrar registro (`DELETE /api/calls/history`). Icono de stickers renovado.
- **UI móvil tipografía + video + canales:** Oswald/Source Sans 3; videollamada entrante más clara; PiP arrastrable/intercambiable; canales de radio seleccionables por tap.
- **Notificaciones alta prioridad + llamadas WhatsApp-like:** canales FCM/locales v3 (prioridad max); Contestar/Rechazar en bandeja; minimizar y seguir hablando (FGS + mic); timbre/ringback.

### Fixed
- **PTT flotante trabado AL AIRE:** al estar transmitiendo, el click izquierdo no soltaba; ahora vuelve a hacer toggle/release. Click derecho abre menú también al aire.
- **Ruta probable naranja no visible (Orión / Hwy 54):** al cancelar el efecto de huecos (Strict Mode / cambio de traza), claves quedaban atrapadas en `pendingRef` y OSRM no se reintentaba; con ~37 huecos en 48 h el naranja nunca aparecía. Fetch en paralelo (6), reintentos más rápidos, contraste naranja subido (`#e87812` opacity 0.58 / weight 14) y marcas temporales en extremos mientras OSRM responde (sin recta por campo).

### Added
- **Respaldos con multimedia:** el ZIP de Config → Respaldos incluye `database.sql`, `meta.json` y el árbol `uploads/` (avatares, chat, grabaciones, etc.). Al restaurar se reemplaza también la multimedia; el uploads previo queda en `uploads_pre_restore_*`. Respaldos `.sql`/ZIP sin media siguen restaurando solo BD y conservan uploads actuales. Límite de subida por defecto `BACKUP_UPLOAD_MAX_MB=2048` (override por env).
- **Guía otra máquina:** `docs/INSTALAR_OTRA_MAQUINA.md` (checklist software, `.env`, respaldo ZIP con media, flags `/noedge`).

### Changed
- **LEVANTAR-TACTICALPTX.bat v3:** root portable, sin IP LAN inventada, espera Web más larga + soft-retry, ventanas API/Web visibles, `netstat` en lugar de `Get-NetTCPConnection`, flag `/noedge`, detección PG ampliada. `start-api`/`start-web`/`Watch-Stack` alineados.
- **Ruta probable solo por calles (sin cuerda recta):** los huecos y saltos post-simplificar (≥1200 m) se resuelven con OSRM; el mapa **no dibuja** la recta A→B. Si el routing aún no responde, el tramo queda pendiente (reintentos) en lugar de atravesar campo/bases. Verificado con Cor. Hernández Orión y Desarrollador de chiludas.
- **Huecos de señal — un solo concepto «ruta probable» (naranja):** el mapa unifica los antiguos «ruta probable» (ámbar) y «ruta estimada» (naranja punteada) en una única **ruta probable** en **naranja `#e87812`**. La leyenda deja solo «Ruta recorrida» y «Sin señal · ruta probable».
- **Routing OSRM `driving`:** `continue_straight=false`, `snapping=any`; timeout por defecto 25 s. Con `ROUTING_OSRM_URL` propio la ruta es más estable que el demo público.

### Restored
- **Panel despacho (11-sep ~15:41):** consola con mapa de inicio, catálogos (jerarquías/grados/empleos), administración (usuarios/grupos/sitios tácticos), config (canales Escuchar/Hablar/Video/Alerta, grabaciones, presencia) y PTT Individual/Múltiple. Evita que un merge de `main` viejo vuelva a servir la consola del 6-sep.

### Added
- **Marcadores Consola según Operadores:** en modo **Todos** / **Uno** el pin muestra la foto del usuario; en **Por grupo**, la foto del grupo (si no hay, fallback a la del usuario).
- **Mini reproductor en Grabaciones PTT:** cada fila de grabación trae reproductor embebido con play/pausa, barra de progreso arrastrable con tiempo transcurrido/total, saltos −10 s / +10 s, velocidad 0.5×–2× y **realce de voz ×1/×2/×3** (Web Audio: compresor + gain) para escuchar lo que se habla bajito. Descarga del audio desde el mismo menú. El endpoint de audio ahora soporta peticiones parciales (HTTP 206 / `Accept-Ranges`).
- **Estados en mapa — en qué mapas se dibujan:** en Configuración → Estados, bloque **Mostrar en mapas** con checks Consola / Seguimiento / Radio (`surfaces` en `tacticalptx_iv_rm_states_v1`, default los tres activos). Cada mapa solo pinta delimitaciones si su check está on.
- **Estados en mapa — los 32 estados de México (Configuración → Estados):** la pantalla pasa de las 3 filas fijas de la IV R.M. a los 32 estados, con buscador por nombre o sigla insensible a acentos («michoacan», «queretaro»), orden Ascendente/Descendente, Marcar/Desmarcar sobre lo filtrado y atajo **Solo IV R.M.**, con el mismo patrón de lista que Escuchar/Hablar. Cada estado conserva su color editable; los 29 nuevos entran apagados y descargan su geometría solo al habilitarse, así que el bundle no crece y las preferencias ya guardadas (NL/TM/SLP) se mantienen.
- **Ruta histórica tipo marcatextos (Consola de Operaciones):** trazo verde translúcido y grueso que deja leer las calles debajo; los tramos recorridos varias veces se ven más intensos (5 capas por número de pasadas). Leyenda de ruta en el mapa.
- **Tramos predictivos sin señal:** cuando un operador pierde cobertura y reaparece lejos, el hueco se pinta en amarillo siguiendo la **ruta real por calles** (OSRM propio o público, `ROUTING_OSRM_URL`); sin servicio cae a una estimación punteada. Umbrales configurables (`TRACK_GAP_*`).
- **Panel web progresivo (móvil/tablet/desktop):** shell phone con bottom nav; inbox lista XOR hilo; llamadas/PTT con `100dvh` y unlock de audio unificado; Command Center (Mapa|Actividad) y LiveTrack bottom sheet en ≤960; Video limitado a 2 monitores en phone; PWA (`manifest` + offline shell + SW cache estático).
- **Personas (web):** paleta global Ctrl+K / botón Personas; ficha Mensaje · Llamada · Video · Ver cámara; pestaña Personas en inbox; contactar desde mapa/usuarios/en línea.
- **Banner de llamada entrante (web):** notificación flotante arriba/derecha para Contestar/Rechazar sin abrir el chat.
- **Llamada perdida:** tras 5 timbres (~25 s) sin contestar, el servidor cuelga y notifica «Llamada perdida» al destino.
- **Multi Ver cámara:** varias pantallas apiladas; control remoto frontal/trasera y mic del dispositivo. APK **1.8.70+79**.

### Changed
- **Consola mapa / grabaciones (UI):** sin selector MAPAS (basemap Natural fijo); leyenda de rutas con `·` centrado y puntos estimados naranja; leyenda de estados en 2 filas colapsable a la derecha; mini reproductor PTT estilo nota de voz ≈ 1.5×, play alineado con la onda.
- **Llamadas web unificadas:** salida/entrada vía `PrivateCallHost`; DM con iconos directos (sin menú «Llamar ▾»).

### Fixed
- **Selects del mapa al maximizar:** los MultiSelect (Sitios / Grupos / Ruta) y el PTT flotante portaleaban fuera del elemento en `requestFullscreen`, así que el panel no se veía ni recibía clics. Ahora el portal va al host fullscreen / página maximizada.
- **Mini reproductor Grabaciones PTT no reproducía:** el `src` del `<audio>` se asigna de forma imperativa (sin esperar a React), el blob fuerza MIME `audio/webm` si el servidor manda vacío/octet-stream, se espera `canplay` antes de `play()`, y el realce Web Audio solo se arma al pedir ×2/×3. Quitado el botón duplicado **Escuchar**; la duración de la fila va en `m:ss` para no montarse sobre el player.
- **Delimitaciones de estados desfasadas respecto al mapa base (causa raíz):** el desfase no era de render sino de **datos**: se mezclaban dos fuentes distintas — NL/TM/SLP detallados y los otros 29 en `mexicoHigh`, desviado hasta **32 km** — así que cada frontera compartida se dibujaba dos veces en sitios distintos y dejaba rendijas y solapes (visibles entre Nuevo León y Coahuila, y entre San Luis Potosí y Zacatecas). Ahora los **32 estados** salen de una **fuente única INEGI** (geoBoundaries gbOpen MEX ADM1) simplificada preservando topología, de modo que los vecinos comparten vértices idénticos. El área mal etiquetada baja de **4.47 % a 0.02 %** y los solapes a **cero**. Supersede la entrada anterior de «Delimitación IV R.M. (relleno + precisión)».
- **Delimitación IV R.M. (relleno + precisión):** se mantiene `L.svg` (fill fiable) y se restaura el MultiPolygon **detallado** de NL/TM/SLP en el bundle; los demás estados siguen en `mxEstados` (mexicoHigh). Dedupe por id: el detallado IV R.M. gana; stroke ~1.15 px.
- **El rango de horas de la ruta recortaba el recorrido:** el historial se pedía con `LIMIT 5000` sobre puntos ordenados de más antiguo a más nuevo, así que con el latido GPS de 5 s elegir **48 h** mostraba solo las primeras ~6 h de la ventana y ocultaba todo el trayecto reciente. Ahora la ventana se lee completa y se reduce de forma consciente (colapso de paradas + Douglas–Peucker por tramo) en vez de truncarse.
- **Llamadas APK:** no re-marcar Contestar encima de llamada activa; auricular por defecto en voz (no altavoz); radio ya no fuerza altavoz durante 1:1. APK **1.8.84+94**.
- **Calidad de video:** prioriza resolución sobre FPS (`maintain-resolution`) y 3.2 Mbps en móvil y web; ya no baja a 360p borroso en LAN. APK **1.8.83+93**.
- **Ver cámara frontal/trasera:** el switch ya no usa mute/unmute; recrea el track con la facing pedida. APK **1.8.82+92**.
- **Ver cámara (APK splash) + cabecera Llamadas:** FCM remote cam ya no relaunch/Contestar con auto-accept; OTA no bloquea accept pendiente; FGS tipo `camera` con forceRestart; SafeArea en historial de llamadas. APK **1.8.81+91**.
- **UI llamada de voz (web):** foto de perfil del interlocutor; texto y avatar ya no se solapan.

### Fixed
- **Llamada entrante:** abre pantalla Contestar (no solo banner); FCM data-only + wake a primer plano.
- **Aislamiento Ver cámara / videollamada:** sin dependencia cruzada; control robusto. APK **1.8.72+82**.
- **Cambio frontal/trasera (Ver cámara):** reinicio de track + señal por socket/LiveKit. APK **1.8.71+80**.
- **Ver cámara app cerrada/suspendida:** FCM background despierta FGS+app y activa cámara en silencio. APK **1.8.69+78**.
- **Cámara remota con pantalla bloqueada:** FGS tipo `camera` + wake lock; no se corta al bloquear. APK **1.8.68+77**.
- **Emoji/Stickers tapables:** tabs dejan de quedar bajo la barra de navegación Android. APK **1.8.67+76**.

### Changed
- **Botón Radio:** etiqueta **Alertas** (antes PÁNICO). APK **1.8.78+88**.
- **Llamadas (nitidez/seguridad):** audio sin NS/DTX agresivo; sala+E2EE por sesión (v3); fail-closed E2EE; video 2.8 Mbps + adaptiveStream; token LiveKit 1h. APK **1.8.78+88**.
- **Llamadas entrantes:** timbre nativo + vibración (estilo WhatsApp); canal `tacticalptx_calls_v2`. APK **1.8.75+85**.
- **Radio personal 1:1:** eliminada de app y web; API ya no permite iniciarla.
- **Indicativo:** se arma con grado + apellido + cargo (sin campos editables de indicativo/detalle).
- **Mapa despacho:** zoom máximo **22** (antes ~18) con overzoom en satélite/calles.
- **Matrícula:** formato obligatorio `Letra-Números` (ej. `A-1234`, `B-2048`) en alta/edición de usuarios.
- **Monitor Expandir:** video centrado en X/Y; **Pantalla completa** = alto completo del stage (marco vertical, sin barra horizontal).
- **Monitor Expandir:** un solo video centrado; **Tamaño** solo en pantalla completa (sm→xl real); quitado del panel normal.
- **Monitor cámara (Expandir):** layout de sala de monitoreo — stage a pantalla completa, dock con EN VIVO y controles mejor distribuidos.
- **Chat emojis/adjuntos:** panel más nítido (web+APK), búsqueda/recientes en móvil; menú adjuntar con iconos + preview/leyenda. APK **1.8.66+75**.
- **Ver cámara (silenciosa):** con permiso previo no notifica ni abre UI en el móvil; solo proyecta en el panel web. APK **1.8.65+74**.

### Added
- **Panel video redimensionable:** tamaños Compacto → Máximo + Expandir a pantalla completa sin perder el feed.

### Changed
- **Calidad video despacho:** captura/publicación **720p @ ~3.2 Mbps @ 30 FPS (VP8)**; APK **1.8.64+73**.

### Fixed
- **Expandir dejaba el video negro:** dos mosaicos enganchaban el mismo track; ahora solo uno activo.
- **Video pixelado / sin nitidez:** el perfil 540p de estabilidad se sube a 720p con bitrate suficiente.

### Added
- **Cámara remota auto:** permiso inicial en el móvil; luego despacho puede activar la cámara sin Contestar (APK **1.8.63+72**).

### Fixed
- **Video intermitente / “reconectando”:** ICE en puertos sin UPnP + uplink alto; LiveKit otra vez en UDP **7882**, video 540p estable, reconnect suave. APK **1.8.62+71**.
- **Video tiles negros (audio OK):** H.264+E2EE → **VP8**; attach por `srcObject`; APK **1.8.61+70**.
- **Video inestable / parpadeo:** simulcast demasiado pesado + adaptiveStream + republicación agresiva de cámara; ahora ladder 480/720 estable, hold de frame y reconnect suave.
- **APK 1.8.60+69:** OTA con estabilidad de video; ancla `https://pulsanet.duckdns.org`.

### Changed
- **Video streaming:** perfiles tipo RTMP — H.264 @ 30 FPS con capas **480p (1500 Kbps)** + **720p (4500 Kbps)** estables (1080 reservado; no se emiten las 3 a la vez).

### Added
- **Ver cámara del dispositivo (despacho):** desde el módulo Video / Operaciones se puede solicitar la cámara del teléfono de campo y proyectarla en el panel (intent `remote_camera`, cámara trasera preferida en el móvil).
- **Dominio permanente (DuckDNS):** `SETUP-STABLE-DOMAIN.ps1` + sync automático del A-record; el APK deja de romperse al rotar la IP del ISP.
- **Módulo Video en despacho:** entrada en el menú lateral (`/despacho/video`) con transmisiones de canal, videollamadas 1:1 y activación de cámara web del puesto.
- **Pánico en mapa:** el anillo del pin del operador pasa a rojo y parpadea mientras el pánico esté activo.
- **Video en menú + cámara frontal/trasera:** opción Video en menús Radio/chat; en llamada y transmisión grupal se puede cambiar entre cámara frontal y trasera (web + mobile).

### Fixed
- **Video consola negro:** preview y mosaico de videollamada; republicación de cámara tras reconectar LiveKit.
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
