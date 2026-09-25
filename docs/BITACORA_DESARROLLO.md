## 2026-09-25 — FORMATO_CAMBIOS_25_09_2026 (Word)

- **Tipo:** docs
- **Área:** docs
- **Qué:** Registro de control de cambios del 22–25/09 (12 ítems). Desarrollador: Sld. Inftca. Miguel Zeferino Pérez Hernández. Word en Escritorio y `pulsanet_soporte\Documentos`.
- **Archivos / refs:** `infra/_gen_formato_cambios_25.py`, `FORMATO_CAMBIOS_25_09_2026.docx`

## 2026-09-25 — Radio: restaurar layout clásico (barra de voz archivada)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Radio vuelve al layout anterior (controles clásicos 4+PTT; sin barra de voz montada).
  - `PttVoiceBar.jsx` + `PttVoiceBar.css` quedan guardados sin importar, listos para reactivar.
- **Por qué / notas:** Pedido explícito de revertir el rediseño; conservar la barra por si se pide después.
- **Archivos / refs:** pages/RadioPage.jsx, styles.css, PttVoiceBar.jsx, PttVoiceBar.css

## 2026-09-25 — Radio: botones izq, PTT centrado

- **Tipo:** ux
- **Área:** web
- **Qué:** Enviar alerta / Audio / Videollamada apilados a la izquierda; botón PTT centrado; estado del canal a la derecha.
- **Archivos / refs:** styles.css

## 2026-09-25 — Radio: estilo visual de la barra de voz

- **Tipo:** ux
- **Área:** web
- **Qué:** Neón más limpio (más barras, segmentos finos, halo/eje con gradiente, fade en extremos, sin shadowBlur por segmento). Colores por tema afinados.
- **Archivos / refs:** PttVoiceBar.jsx, styles.css

## 2026-09-25 — Radio: barra de voz reacciona al mic

- **Tipo:** mejora
- **Área:** web
- **Qué:** Al transmitir (PTT), la onda lee el nivel real del micrófono (AnalyserNode sobre el track LiveKit). Ya no es solo animación fija.
- **Archivos / refs:** PttVoiceBar.jsx, usePtt.js, RadioPage.jsx

## 2026-09-25 — Radio: onda a ancho completo arriba

- **Tipo:** ux
- **Área:** web
- **Qué:** La barra de voz queda en el borde superior del panel Radio, de extremo a extremo (sin caja), solo al transmitir.
- **Archivos / refs:** RadioPage.jsx, styles.css

## 2026-09-25 — Radio: ondas sin caja, solo al transmitir

- **Tipo:** ux
- **Área:** web
- **Qué:** Barra de voz sin contenedor ni fondo negro; solo las ondas neón y únicamente visible al transmitir (PTT / al aire).
- **Archivos / refs:** PttVoiceBar.jsx, styles.css

## 2026-09-25 — Radio: neón por tema en barra de voz

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** La barra PTT ya no usa --accent oscuro (parecía negra). Neón explícito por tema: Claro verde/teal/oro; Verde oro/lima/cian; Obscuro magenta/cian/azul + glow.
- **Archivos / refs:** PttVoiceBar.jsx, styles.css

## 2026-09-25 — Radio: barra de voz sobre PTT

- **Tipo:** ux | feature
- **Área:** web
- **Qué:** Ecualizador simétrico encima de los controles PTT; se anima al hablar (holding/speaking). Colores desde variables del tema (Claro/Verde/Obscuro).
- **Archivos / refs:** PttVoiceBar.jsx, RadioPage.jsx, styles.css

## 2026-09-25 — Radio: columnas solo mitad inferior

- **Tipo:** ux
- **Área:** web
- **Qué:** Las 4 columnas Escuchar/Hablar/Video/Alerta ocupan solo la mitad de abajo; controles PTT en la mitad de arriba.
- **Archivos / refs:** styles.css

## 2026-09-25 — Radio: controles arriba, columnas abajo

- **Tipo:** ux
- **Área:** web
- **Qué:** En Radio PTT, barra de controles (alerta/audio/video/PTT) arriba; Escuchar/Hablar/Video/Alerta ocupan el resto del alto. Se quitó el hueco «Mensajes / Ir a Chats».
- **Archivos / refs:** RadioPage.jsx, styles.css

## 2026-09-25 — Solo escucha: video con imagen, sin micrófono

- **Tipo:** mejora
- **Área:** backend | web | mobile
- **Qué:** Rol listen_only puede iniciar/unirse a video de grupo y publicar cámara; LiveKit solo permite fuente CAMERA (sin mic). PTT radio sigue sin publicar. UI mic bloqueada.
- **Archivos / refs:** livekit.js, groupVideo.js, useGroupVideo.js, GroupVideoPanel.jsx, group_video_screen.dart

## 2026-09-24 — Configuración: sin pestaña Grabaciones

- **Tipo:** ux
- **Área:** web | backend
- **Qué:** Se quitó la pestaña Grabaciones de Configuración (ya está en RESERVADO). URL antigua `/despacho/configuracion/grabaciones` redirige a RESERVADO. Se eliminó la pestaña del catálogo de permisos de perfil.
- **Archivos / refs:** `ConfigLayout.jsx`, `App.jsx`, `DispatchLayout.jsx`, `profiles.js`

## 2026-09-24 — Grupos: sin pastillas Región/Zona/Unidad en Alcance

- **Tipo:** ux
- **Área:** web
- **Qué:** Columna Alcance vuelve a mostrar solo el nombre (sin pastilla de nivel).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: scrollbar no cierra el drawer

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Clic en la scrollbar (tabla / body de admin) ya no cierra el panel lateral del grupo.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-24 — Grupos: clic en rail no cierra el drawer

- **Tipo:** ux
- **Área:** web
- **Qué:** Clic en el menú lateral de módulos (incl. Contraer/Expandir) ya no cierra el panel del grupo; solo cierra fuera de filas/rail.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-24 — Grupos: drawer empuja topbar y radio PTT

- **Tipo:** ux
- **Área:** web
- **Qué:** Al abrir el panel de grupo, `.cc-shell-main` cede el ancho del drawer (topbar, franja PTT y contenido), no solo la tabla.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: tabla cede espacio al drawer

- **Tipo:** ux
- **Área:** web
- **Qué:** Con el panel lateral abierto, la página de Grupos añade `padding-right` del ancho del drawer para que las columnas no queden tapadas.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: sin columna Acciones; Eliminar en drawer

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitados Editar/Eliminar de la tabla y la columna Acciones. Clic en fila abre el panel; Eliminar permanente (root) va en el pie del drawer.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-24 — Grupos: flechas teclado + clic fuera cierra drawer

- **Tipo:** ux
- **Área:** web
- **Qué:** Con el panel lateral abierto: ↑/↓ del teclado recorre grupos (lista filtrada) y actualiza el drawer; clic fuera de las filas de la tabla (rail, cabecera, etc.) cierra el panel. Escape sigue cerrando.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-24 — Filtro Alcance: sin texto de ayuda del árbol

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitado el párrafo de ayuda del menú filtro Alcance («Check = tipo de canal…»).
- **Archivos / refs:** `ThFilterMulti.jsx`

## 2026-09-24 — Filtros columna: etiqueta completa (1 selección)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Botón de filtro multi (Grupos/Usuarios): al seleccionar una sola opción ya no se corta a 24 caracteres; truncado solo si >56 y `title` siempre con el texto completo.
  - CSS: el botón puede envolver hasta 2 líneas y `min-width` un poco mayor.
- **Archivos / refs:** `ThFilterMulti.jsx`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Filtros columna: resize esquina (Grupos/Usuarios)

- **Tipo:** ux
- **Área:** web
- **Qué:** Menú de filtro multi redimensionable (`resize: both`) como los multi-select del mapa; aplica a Grupos (`ThFilterMulti`) y Usuarios (`UsrThFilterMulti`).
- **Archivos / refs:** `command-center.css`, `ThFilterMulti.jsx`, `DispatchUsers.jsx`

## 2026-09-24 — Grupos: filtro Alcance en árbol + pastillas + textos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Filtro Alcance por región: carpeta región → «Grupos (de todas las zonas y unidades)» → zonas → «Grupos (de todas las unidades)» + unidades (solo si hay canales).
  - Columna Alcance con pastilla Región/Zona/Unidad + nombre.
  - Alta/edición: opción «Todas las zonas y unidades…».
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`, `command-center.css`

## 2026-09-24 — Filtro Alcance: 3 listas (Regiones/Zonas/Unidades)

- **Tipo:** ux
- **Área:** web
- **Qué:** Sustituido el árbol por tres secciones planas (tipo de canal). Etiquetas con padre (`zona · región`, `unidad · zona`) y «toda la región/zona».
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`

## 2026-09-24 — Filtros: al ocultar se limpian (Grupos/Usuarios)

- **Tipo:** fix
- **Área:** web
- **Qué:** Segundo clic en «Filtros» quita también el estado de filtrado (antes solo ocultaba la UI y la lista seguía filtrada).
- **Archivos / refs:** `DispatchGroups.jsx`, `DispatchUsers.jsx`

## 2026-09-24 — Filtro/alta Alcance: «toda la región/zona»

- **Tipo:** ux
- **Área:** web
- **Qué:** En el filtro, regiones/zonas se etiquetan como al crear (`… (toda la región/zona)`). Ayuda en el menú: el check no arrastra hijas. Opciones «Todas las zonas/unidades» alineadas en el alta/edición.
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`, `command-center.css`

## 2026-09-24 — Filtro Alcance: etiquetas Región / Zonas / Unidades

- **Tipo:** ux
- **Área:** web
- **Qué:** Barras de nivel (Región, Zonas, Unidades) sobre el desglose expandible; el check sigue siendo solo del nodo.
- **Archivos / refs:** `ThFilterMulti.jsx`, `command-center.css`

## 2026-09-24 — Filtro Alcance: check solo del nodo

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** En el árbol Región→Zona→Unidad, marcar «IV R.M.» (u otra región/zona) selecciona solo ese alcance, no todas las zonas/unidades hijas.
- **Archivos / refs:** `ThFilterMulti.jsx`

## 2026-09-24 — Perfiles: nombres de módulos como en el rail

- **Tipo:** ux
- **Área:** backend | web
- **Qué:** Labels del editor de permisos alineados al menú (Seguimiento, Grupos, Usuarios, Avisos, Catálogos, Configuración) con el mismo hint del rail.
- **Archivos / refs:** `profiles.js` (MODULES), `DispatchProfiles.jsx`

## 2026-09-24 — RESERVADO solo Administrador (sin opción en perfiles)

- **Tipo:** security | ux
- **Área:** backend | web
- **Qué:** Quitado RESERVADO del editor de módulos en Perfiles. El módulo solo es visible para rol Administrador (`root`); admins de región/zona/unidad no lo ven aunque el JSON viejo tuviera `video.ver`.
- **Archivos / refs:** `profiles.js` (MODULES), `modulePermissions.js`, `moduleAccess.js`

## 2026-09-24 — Menú filtro multi: cabecera estilo Parque Vehicular

- **Tipo:** ux
- **Área:** web
- **Qué:** Contador «N de N» en color accent; filas Ascendente/Marcar y meta con separadores; paddings y `?` alineados a PV.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Filtro Alcance: Expandir/Contraer 2 en 1

- **Tipo:** ux
- **Área:** web
- **Qué:** Un solo enlace que alterna Expandir ↔ Contraer (igual que Marcar ↔ Desmarcar).
- **Archivos / refs:** `ThFilterMulti.jsx`

## 2026-09-24 — Filtro Alcance: quitar botón Contraer

- **Tipo:** ux
- **Área:** web
- **Qué:** Eliminado el enlace global «Contraer» del menú árbol (basta ▶/▼ por nodo). Quedan Expandir y Marcar/Desmarcar.
- **Archivos / refs:** `ThFilterMulti.jsx`

## 2026-09-24 — Filtro Alcance en árbol Región→Zona→Unidad

- **Tipo:** feature | ux
- **Área:** web
- **Qué:** El filtro de Alcance en Grupos es árbol orgánico (región con sus zonas y cada zona con sus unidades), con ▶/▼ expandir-contraer, Expandir/Contraer todo, y check en padre que marca el subárbol.
- **Archivos / refs:** `ThFilterMulti.jsx` (`optionTree`), `DispatchGroups.jsx` (`buildScopeFilterTree`), `command-center.css`

## 2026-09-24 — Sin caja en fila de título sortable

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitado fondo/borde/sombra rectangular al pasar o enfocar el título de columna (estilo limpio como Parque Vehicular).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Indicador orden ▲/▼ estilo Parque Vehicular

- **Tipo:** ux
- **Área:** web
- **Qué:** Flecha de orden pegada al nombre de columna, mismo color del título (sin accent azul). Antes quedaba grande y azul al borde derecho.
- **Archivos / refs:** `command-center.css`, `DispatchGroups.jsx`, `DispatchUsers.jsx`

## 2026-09-24 — Fix orden ▲/▼ solo funcionaba una vez

- **Tipo:** fix
- **Área:** web
- **Qué:** El segundo clic no invertía el orden: `setSortDir` iba dentro del updater de `setSortCol` y Strict Mode lo ejecutaba 2× (−1×−1). Ahora el toggle es directo.
- **Archivos / refs:** `DispatchGroups.jsx`, `DispatchUsers.jsx`

## 2026-09-24 — Fix ordenar por clic en encabezado (Grupos/Usuarios)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** El orden ▲/▼ queda en la fila del título (clic fiable). Solo el ⠿ es `draggable` (como separación clara respecto a PV, donde el th entero es draggable pero los filtros van en otra fila).
- **Archivos / refs:** `DispatchGroups.jsx`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Filtros de columna: colores según tema Claro/Verde

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** El menú multi-filtro (portal) hereda vars de `.cc-shell` (antes iba a `body` y quedaba oscuro en Claro/Verde). Botones parcial/ninguno y secciones Región/Zona/Unidad usan `--cc-accent` del tema.
- **Archivos / refs:** `ThFilterMulti.jsx`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Grupos: filtro Alcance + ordenar columnas (fix)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Encabezados Región/Zona/Unidad del filtro Alcance como barra de sección (fondo, borde, contador) para no confundirlos con nombres.
  - Ordenar por clic: solo el ⠿ es arrastrable; clic en el título ordena ▲/▼ (el `draggable` del th bloqueaba el click).
- **Archivos / refs:** `ThFilterMulti.jsx`, `DispatchGroups.jsx`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Grupos/Usuarios: clic en encabezado ordena (▲/▼)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Además de arrastrar columnas, un clic en el encabezado ordena asc/desc (estilo Parque Vehicular). Tooltip «Arrastra para mover · Clic para ordenar»; el drag no dispara orden.
- **Archivos / refs:** `DispatchGroups.jsx`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Grupos: Alcance sin prefijo + filtro Región/Zona/Unidad

- **Tipo:** ux | mejora
- **Área:** web | backend
- **Qué:**
  - Columna Alcance muestra solo el nombre (sin `Región ·` / `Zona ·` / `Unidad ·`).
  - Filtro de Alcance agrupado en 3 secciones (Región → Zona → Unidad), con marcar/desmarcar por sección.
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`, `command-center.css`, `admin.js` (`scopeLabel`)

## 2026-09-24 — Alcance 5 (doc usuarios / grupos / mapa)

- **Tipo:** docs
- **Área:** docs
- **Qué:** Documento de referencia del estado vigente: alta de usuarios (pertenencia), creación de grupos/canales (jerarquía + geo) y visualización en mapa (matriz + territorio). Word en Escritorio y `pulsanet_soporte\Documentos`; Markdown en `docs/ALCANCE_5.md`.
- **Archivos / refs:** `infra/_gen_alcance5.py`, `docs/ALCANCE_5.md`, `Alcance 5.docx`

## 2026-09-24 — Grupos: usuario de zona no en canal de unidad (selector)

- **Tipo:** fix
- **Área:** web
- **Qué:** En canales de unidad, «Agregar persona…» ya no lista usuarios de zona (solo admin de zona si su zona contiene la unidad), alineado con la API.
- **Archivos / refs:** `DispatchGroups.jsx` (`memberFitsGroupGeoClient`)

## 2026-09-24 — Grupos: no listar miembros ya asignados al agregar

- **Tipo:** fix
- **Área:** web
- **Qué:** En «Agregar persona…» del drawer de canal se ocultan usuarios que ya son miembros del grupo.
- **Archivos / refs:** `DispatchGroups.jsx` (`assignableUsers`)

## 2026-09-24 — Fix pantalla en blanco (CatalogsLayout sintaxis)

- **Tipo:** fix
- **Área:** web
- **Qué:** Template string roto en `CatalogsLayout.jsx` impedía compilar el frontend (pantalla blanca). Corregido y rebuild.
- **Archivos / refs:** `CatalogsLayout.jsx`, `frontend/dist`

## 2026-09-24 — Permisos: Catálogos/Avisos/Config alineados a perfil (UI + API)

- **Tipo:** feature | security
- **Área:** backend | web
- **Qué:**
  - Helper `moduleAccess.js` (`requireModuleAction` / `userHasModuleAction`).
  - Catálogos y Dependencias: UI con agregar/editar/eliminar del perfil; API deja de usar solo `isAdmin`.
  - Avisos: listar=`ver`, enviar=`agregar` (UI + API). Config org-settings=`ver`/`editar`. CSV usuarios=`usuarios.ver`. Purge grupos=`grupos.eliminar`.
- **Archivos / refs:** `moduleAccess.js`, `catalogs.js`, `admin.js`, `announcements.js`, catálogos UI, `DispatchAnnouncements.jsx`

## 2026-09-24 — Perfiles: permisos por módulo, pestaña y acción

- **Tipo:** feature
- **Área:** backend | web
- **Qué:**
  - Editor de perfiles con tarjetas: Visible → Pestañas → Agregar/Editar/Eliminar; modal más ancho; labels alineados al rail (p. ej. RESERVADO).
  - Catálogo `MODULES` con `tabs`/`actions`/`group`; JSON normalizado; sesión lleva `user.modules` (login/me/refresh).
  - Enforcement: rail, pestañas (RESERVADO/Catálogos/Config/Admin), rutas App, botones Usuarios/Grupos.
- **Por qué / notas:** Sin enforcement el UI no servía. Root sigue con acceso total. Perfiles viejos sin `tabs`: si el módulo está visible, se asumen todas las pestañas.
- **Archivos / refs:** `profiles.js`, `userProfile.js`, `auth.js`, `modulePermissions.js`, `DispatchProfiles.jsx`, layouts, `DispatchLayout.jsx`, `App.jsx`

## 2026-09-24 — Grupos/Usuarios: encabezados opacos al scrollear

- **Tipo:** fix
- **Área:** web
- **Qué:** Al bajar el scroll, pastillas/botones de las filas ya no se ven detrás de ESTADO/ACCIONES (y resto de columnas). Fondo opaco en `thead th` sticky + z-index por encima del tbody.
- **Archivos / refs:** `command-center.css` (sticky thead Grupos/Usuarios)

## 2026-09-24 — Rail: logo SICOM no se desborda al achicar ventana

- **Tipo:** fix
- **Área:** web
- **Qué:** En viewport ≤960px el rail ya forzaba ancho mini, pero el PNG expandido (casco + tipografía «SICOM») podía seguir viéndose y salirse. Ahora se oculta con `!important`, solo el emblema circular, y el brand tiene `overflow: hidden`.
- **Por qué / notas:** Las letras «SICOM» van dibujadas en el asset expandido; no es un texto HTML aparte.
- **Archivos / refs:** `institutional.css` (`.cc-mod-rail-brand`, media `max-width: 960px`)

## 2026-09-24 — Grupos/Usuarios: toolbar sticky sin contraerse

- **Tipo:** fix
- **Área:** web
- **Qué:** La barra (título + Buscar/Filtros/Columnas/Nuevo) ya no pierde aire ni se encoge al scrollear: `flex-shrink: 0` y el padding vertical va en el sticky (no en el `gap` del page).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos/Usuarios: quitar línea bajo toolbar

- **Tipo:** ux
- **Área:** web
- **Qué:** Eliminada la línea clara bajo la barra sticky (título + Buscar/Filtros/Columnas) en Grupos y Usuarios (`box-shadow` del toolbar).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: zona/unidad opcionales según rol

- **Tipo:** fix | mejora
- **Área:** web
- **Qué:**
  - **Administrador / admin de región:** Región obligatoria; **Zona** y **Unidad** opcionales.
    - Solo región → canal de región (todos los usuarios de esa región).
    - Región + zona → canal de zona (unidad puede quedar en —).
    - Región + zona + unidad → canal de unidad.
  - **Admin de zona:** unidad opcional (— = toda su zona).
  - Corregido filtro de «Asignar miembro»: usuarios de unidad bajo una región/zona sí aparecen (alineado a `memberFitsGroupGeo`).
- **Por qué / notas:** El formulario HTML forzaba zona/unidad (`required`) aunque el modelo de alcance ya soportaba región/zona/unidad.
- **Archivos / refs:** `DispatchGroups.jsx` (`resolveGroupScope`, formularios create/edit, `memberFitsGroupGeoClient`)

## 2026-09-24 — Nota de voz: bolita alineada con la onda

- **Tipo:** fix
- **Área:** web
- **Qué:** La bolita de progreso ya no va desfasada respecto a las barras azules (onda a ancho completo + thumb centrado con `translate(-50%)`).
- **Archivos / refs:** `styles.css` (`.wa-voice-*`), `ChatMedia.jsx`, `command-center.css` / `RecordingPlayer.jsx`

## 2026-09-24 — App: guardar PTT en RESERVADO / Grabaciones

- **Tipo:** feature
- **Área:** mobile, web
- **Qué:**
  - Al soltar PTT en la **app**, se graba y sube a `/api/recordings` (igual que la consola web) → aparece en RESERVADO → Grabaciones → Radio.
  - Notas de voz de chat (app/web) ya van por mensajes y se listan en «Chat (notas de voz)».
  - Textos de UI: «app y consola web».
- **Archivos / refs:** `mobile/lib/channel_session.dart`, `mobile/lib/api_client.dart`, `ReservedGrabaciones.jsx`, `ConfigRecordings.jsx`

## 2026-09-24 — Grabaciones RESERVADO en dos columnas

- **Tipo:** ux
- **Área:** web
- **Qué:** Radio (PTT) y Chat (notas de voz) lado a lado en dos columnas (apiladas en pantallas angostas).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — RESERVADO: auto-actualización sin botón

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Quitados botones «Actualizar» en Grabaciones y Conversaciones.
  - Listas se refrescan solas cada ~12 s (y al volver a la pestaña / module-refresh); radio PTT sigue por socket + poll de respaldo.
- **Archivos / refs:** `ReservedGrabaciones.jsx`, `ReservedChats.jsx`

## 2026-09-24 — Grabaciones chat: admin puede oír notas de voz ajenas

- **Tipo:** fix
- **Área:** backend, web
- **Qué:**
  - `/api/media/:id` permite a **admin** de la misma org (auditoría RESERVADO) descargar media aunque no sea participante del chat.
  - Mensaje de error genérico: «Sin permiso para ver el archivo» (antes decía «imagen» también en audios).
- **Por qué / notas:** En Grabaciones aparecía «Sin permiso para ver la imagen» en notas de voz de chats ajenos.
- **Archivos / refs:** `backend/src/routes/messages.js`, `frontend/src/api.js`

## 2026-09-24 — RESERVADO: subtítulo «Confidencial»

- **Tipo:** ux
- **Área:** web
- **Qué:** En el rail, la etiqueta bajo RESERVADO pasa de «Video, grabaciones y conversaciones» a **Confidencial**.
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-09-24 — RESERVADO solo rol Administrador (root)

- **Tipo:** security | ux
- **Área:** web
- **Qué:**
  - Módulo RESERVADO (`/despacho/video` y pestañas) visible y accesible **solo** con rol/perfil **Administrador** (`root`).
  - Rail y menú móvil «Más» ocultan el ítem; ruta redirige a `/despacho` si no es root.
- **Por qué / notas:** Contenido confidencial (video, grabaciones, conversaciones auditables).
- **Archivos / refs:** `DispatchLayout.jsx`, `App.jsx`

## 2026-09-24 — Fix 429 en RESERVADO (Grabaciones / Conversaciones)

- **Tipo:** fix
- **Área:** web, backend
- **Qué:**
  - Grabaciones de chat: de ~45 peticiones paralelas (escaneo por grupo/DM) a **una** consulta admin `GET /api/admin/chat-audio`.
  - Rate-limit global: skip en GET de grabaciones PTT, listado admin de usuarios, grupos/DM auditables y chat-audio (evita 429 con `RATE_LIMIT_MAX` bajo).
  - Conversaciones: sin recarga en bucle al terminar de cargar la lista de operadores.
- **Por qué / notas:** Usuario veía «Demasiadas solicitudes» al abrir pestañas de RESERVADO.
- **Archivos / refs:** `ReservedGrabaciones.jsx`, `ReservedChats.jsx`, `userEventsTimeline.js`, `admin.js`, `server.js`, `api.js`

## 2026-09-24 — RESERVADO: icono escudo + candado

- **Tipo:** ux
- **Área:** web
- **Qué:** Icono del módulo RESERVADO en el rail: de cámara de video a **escudo con candado** (privado / confidencial).
- **Archivos / refs:** `DispatchLayout.jsx` (`ModIcon` case `video`)

## 2026-09-24 — RESERVADO: nombre y conversaciones solo lectura

- **Tipo:** ux
- **Área:** web, backend
- **Qué:**
  - Módulo del rail renombrado a **RESERVADO** (sin «Confidencial»).
  - Pestaña **Conversaciones**: selector de operador → hilos DM + grupos → modal solo lectura (auditoría); ya no integra ChatInbox.
  - `/despacho/chats` vuelve a ser la mensajería operativa (ChatInbox); tab bar móvil apunta ahí.
  - API admin `GET /api/admin/users/:userId/dm/conversations` para listar pares DM auditables.
- **Por qué / notas:** Aclaración del usuario: «Chats» en Reservado = ver conversaciones, no chatear.
- **Archivos / refs:** `ReservedLayout.jsx`, `ReservedChats.jsx`, `AuditConversationPeek.jsx`, `DispatchLayout.jsx`, `App.jsx`, `DispatchChatsPage.jsx`, `ConfigEvents.jsx`, `userEventsTimeline.js`, `admin.js`, `api.js`, `command-center.css`

## 2026-09-24 — Módulo «Reservado o Confidencial» (Video + Grabaciones + Chats)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Rail renombrado de «Video» a **Reservado o Confidencial** (`/despacho/video` conservado).
  - Tres pestañas reordenables (patrón Admin): **Video** (DispatchVideo intacto), **Grabaciones** (radio PTT + audios de chat), **Chats** (ChatInbox 1:1 y grupos).
  - `/despacho/chats` redirige a `/despacho/video/chats`; ítem Chats retirado del rail (sigue en tab bar móvil).
- **Por qué / notas:** Reestructuración solicitada; sin tocar mosaic / cámara remota / keepalive de Radio.
- **Archivos / refs:** `ReservedLayout.jsx`, `ReservedGrabaciones.jsx`, `ReservedChats.jsx`, `DispatchLayout.jsx`, `App.jsx`, `DispatchChatsPage.jsx`, `command-center.css`

## 2026-09-24 — Video: quitar panel Canales

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Retirada la columna «Canales» (Iniciar video / Sin transmisión) del módulo Video.
  - «Operadores en línea» (Ver cámara / Videollamada) queda a ancho completo; subtítulo sin “Transmisiones de canal”.
- **Por qué / notas:** Petición explícita; stack de cámara remota / mosaic / GroupVideoPanel intacto.
- **Archivos / refs:** `DispatchVideo.jsx`, `command-center.css`

## 2026-09-24 — Sticky toolbar + thead (Grupos / Usuarios)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Al hacer scroll en Administración, la barra (título + Buscar/Filtros/Columnas/Nuevo) y los encabezados de columna quedan fijos.
  - Scroll en `.cc-catalogs-body`; `overflow: visible` en el wrap de tabla para que el thead pegue al viewport del body.
- **Archivos / refs:** `command-center.css`, `useAdminStickyToolbarHeight.js`, `DispatchGroups.jsx`, `DispatchUsers.jsx`

## 2026-09-24 — Pastillas Activo/Inactivo ancho más justado

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `min-width` de pastillas Activo/Inactivo bajado de `6.25rem` a `5.25rem` (mismo ancho para ambos, centrado).
- **Archivos / refs:** `command-center.css` (`.status-pill`, `.usr-status`, drawer-head `.status-pill`)

## 2026-09-24 — Pastillas Activo/Inactivo mismo ancho

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `min-width: 6.25rem` + centrado en pastillas Activo/Inactivo (tablas Grupos/Usuarios y drawer).
- **Archivos / refs:** `command-center.css` (`.status-pill`, `.usr-status`, drawer-head `.status-pill`)

## 2026-09-24 — Pastilla Inactivo en rojo (Grupos/Usuarios)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Pastilla «Inactivo» con texto, borde y fondo suave en `--cc-danger` (mismo patrón que Activo con `--cc-ok`).
- **Archivos / refs:** `command-center.css` (`.status-pill.off`, `.usr-status.off`, `.cc-user-status.off`)

## 2026-09-24 — Grupos/Usuarios: aire igual arriba y abajo de la toolbar

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Ritmo vertical unificado: `gap: 1rem` en `.cc-groups-page` y `.cc-users-page` (= `padding-top` de catálogos).
  - Quitado `margin-bottom` de `.cc-groups-toolbar` que duplicaba el gap bajo Buscar/Filtros/Columnas/Nuevo.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Usuarios: mismo espacio toolbar→tabla que Grupos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `.cc-users-page` con `gap: 0.65rem` como `.cc-groups-page` (aire entre barra de búsqueda/botones y la tabla).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Usuarios: barra Buscar/Filtros/Columnas/Nuevo como Grupos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Misma barra que Grupos: Buscar + Filtros + Columnas + «Nuevo usuario» (icono + / contorno neón); sin panel envolvente ni botón «Agregar» suelto en el título.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-24 — Mapa: foto de grupo vs perfil si filtra varios grupos

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - En «Por grupo»: si el operador pertenece a exactamente 1 de los grupos filtrados → foto de ese grupo; si pertenece a 2+ de los filtrados → foto de perfil (evita el “último grupo”).
- **Archivos / refs:** `mapAvatarIcon.js` (`resolveOperatorGroupForMarker`), `useMapAvatarPhotos.js`

## 2026-09-24 — Grupos: contorno neón según tema (claro / verde / obscuro)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Contorno y luces de «Nuevo canal» con tokens por tema: azul (obscuro), oliva/verde (verde), verde oscuro (claro).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: difuminado por tramos en cada luz

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Cada luz del contorno = punta + medio + cola (degradado espacial); el difuminado temporal apaga primero la cola, luego el medio y después la punta.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: prueba difuminado en luces del borde

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Difuminado de las luces del contorno más lento (`3.6s`).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: dos luces opuestas en el contorno

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Dos destellos blancos enfrentados (encontrados) que recorren el borde de «Nuevo canal» en el mismo sentido.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: borde neón un poco más fino

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Contorno de «Nuevo canal» con stroke más delgado (base ~1.15, luz ~1.55).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: neón fuera del relleno del botón

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - SVG del contorno neón detrás del botón (wrapper); el relleno opaco tapa el centro — la luz solo se ve en el contorno exterior.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: contorno neón tipo referencia en Nuevo canal

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - «Nuevo canal» con borde neón azul (SVG stroke) y segmento brillante que recorre solo el contorno, como la imagen de referencia.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: luz solo en contorno exterior del botón

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - La luz de «Nuevo canal» queda detrás y un poco más grande que el botón; el relleno tapa el centro y solo se ve el puntito en el contorno exterior.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: luz puntual recorriendo el contorno

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Efecto de «Nuevo canal»: punto de luz pequeño (~15°) que rodea el borde; ya no un abanico/glow amplio.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: icono limpio y haz solo en contorno

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Icono de «Nuevo canal» = círculo con + (mismo estilo que Filtros/Columnas).
  - Haz de luz sutil solo en el anillo del contorno (`mask-composite`), sin glow sobre el botón.
- **Archivos / refs:** `ThFilterMulti.jsx`, `command-center.css`

## 2026-09-24 — Grupos: icono y haz de luz en Nuevo canal

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Botón «Nuevo canal» con icono de ondas de radio + «+».
  - Haz de luz animado (conic-gradient giratorio + glow) alrededor del botón.
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`, `command-center.css`

## 2026-09-24 — Grupos: buscador ancho = 3 botones

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - El cuadro «Buscar…» tiene el mismo ancho que abarcan Filtros + Columnas + Nuevo canal (grid 1fr/1fr).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: toolbar controles misma altura

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Buscar, Filtros, Columnas y Nuevo canal con altura fija común (`2.15rem`, +1pt) y contenido centrado en vertical.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: celdas centradas en vertical

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Contenido de filas de la tabla Grupos con `vertical-align: middle` (no pegado arriba); sin centrar texto en horizontal.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: buscador misma altura que botones

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Cuadro «Buscar…» con la misma altura/padding que Filtros, Columnas y Nuevo canal.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: Filtros/Columnas mismo tamaño que Nuevo canal

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Botones Filtros y Columnas en la barra de Grupos con el mismo padding/altura tipográfica que «Nuevo canal» (`cc-btn-sm`).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: título mismo tamaño/estilo que Usuarios

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - «Grupos y canales» alineado a Usuarios: `1.35rem`, peso 700 y `text-transform: uppercase`.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Usuarios: quitar subtítulo de alcance

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Eliminado el texto bajo el título («Designa Admin de región…» / variantes por rol).
- **Archivos / refs:** `DispatchUsers.jsx`

## 2026-09-24 — Grupos: encabezados de tabla como Usuarios

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Tabla de Grupos usa `usr-table-wrap` / `usr-users-table` y los mismos estilos de `th` que Usuarios.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: buscador/Filtros/Columnas junto a Nuevo canal

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Buscador, Filtros y Columnas en la misma fila del título, a la izquierda de «Nuevo canal» (sin panel envolvente).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-24 — Grupos: buscador/Filtros/Columnas a la derecha sin panel

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Buscador + Filtros + Columnas juntos alineados a la derecha; sin caja/panel envolvente.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: cerrar lightbox con clic en la foto

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Clic en la imagen (o el marco) del visor ampliado también cierra el lightbox (`zoom-out`), igual que clic fuera.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-24 — Grupos: buscador + Filtros/Columnas juntos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Barra de búsqueda con Filtros y Columnas juntos (mismo panel que Usuarios); sin empujar los botones al extremo derecho.
  - Se mantiene el ancho del cuadro de búsqueda (`min(16rem, 42vw)`).
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: lightbox de foto semitransparente

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Fondo del visor de foto del canal: negro semitransparente (se ve el UI detrás); sin blur opaco.
  - Cursor lupa: `zoom-in` en el avatar del drawer, `zoom-out` en el overlay / imagen.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: Filtros / Columnas + persistencia

- **Tipo:** mejora | ux
- **Área:** web
- **Qué:**
  - En Grupos: botones Filtros y Columnas (patrón Usuarios / Parque Vehicular), filtros por encabezado (`ThFilterMulti`) y persistencia de columnas en `localStorage`.
  - Acciones siempre fija (no ocultable); «Nuevo canal» en la fila del título.
- **Por qué / notas:** Alinear catálogo de canales con Usuarios.
- **Archivos / refs:** `DispatchGroups.jsx`, `ThFilterMulti.jsx`, `command-center.css`; key `tacticalptx.groups.colConfig.v1`

## 2026-09-24 — Usuarios: quitar botón Actualizar

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Eliminado el botón «Actualizar» del encabezado; alta/edición/baja ya refrescan la lista con `reload({ silent: true })`.
- **Archivos / refs:** `DispatchUsers.jsx`

## 2026-09-24 — Usuarios: pastilla Activo como en Grupos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `.usr-status` (tabla Usuarios) alineado al `status-pill` de Grupos: borde + fondo suave + texto con `--cc-ok` / muted.
- **Archivos / refs:** `command-center.css`

## 2026-09-24 — Grupos: vista ampliada de foto del canal

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Clic en la foto del drawer abre lightbox elegante (blur, marco redondeado, nombre y alcance).
  - Cerrar con ×, Esc o clic fuera; sin foto no es clicable.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Obscuro: tonos Editar/Eliminar en Usuarios y Grupos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Tema obscuro: botones Editar (azul navy) y Eliminar (rojo apagado) con los tonos de la referencia, en tablas Usuarios (`.usr-actions`) y Grupos (`.cc-gt-act-btns`).
- **Archivos / refs:** `command-center.css`

## 2026-09-23 — Grupos: «Cambiar foto» un poco más abajo del avatar

- **Tipo:** ux
- **Área:** web
- **Qué:** Más aire entre avatar y «Cambiar foto» sin crecer el header (gap + padding/avatar compensados).
- **Archivos / refs:** `command-center.css`

## 2026-09-23 — Grupos: alinear bolita Activo/Inactivo en cabecera

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Bolita y texto centrados en la pill (dot explícito + `align-items: center` / `line-height: 1`).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: Activo/Inactivo verde·rojo en cabecera del drawer

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - El drawer (portal a `body`) no heredaba `--cc-ok`; Activo salía en color de texto.
  - Tokens `--cc-ok` en el drawer + pill con bolita y texto/fondo verde (Activo) o rojo (Inactivo).
- **Archivos / refs:** `command-center.css`

## 2026-09-23 — Grupos: panel lateral sin backdrop (clic en otro canal)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Quitado el bloqueo/overlay negro del drawer de edición; la tabla queda usable con el panel abierto.
  - Un clic en otro canal cambia el contenido del panel; cerrar con × o Escape.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: quitar Eliminar del footer del drawer

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Quitado el botón **Eliminar** del footer del drawer de edición (`cc-groups-drawer-foot`).
  - Se mantienen Vaciar chat / Desactivar / Reactivar; **Eliminar** solo en la tabla (`.cc-gt-col-act`).
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-23 — Grupos: ESTADO y Acciones sin solape

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Columna Acciones ampliada (14%→23%, `min-width: 13.5rem`); desc/alcance reducidos; total 100%.
  - Quitado `display:flex` del `<td>` (rompía celdas); botones en `.cc-gt-act-btns` (inline-flex).
  - Pill Activo solo en Estado; Editar/Eliminar solo en Acciones, sin solape.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: Acciones Editar/Eliminar alineados

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Orden en columna Acciones: **Editar** izquierda, **Eliminar** derecha (solo `root`).
  - Mismo ancho/alto via flex + `min-width`/`height` en `.cc-gt-col-act .cc-btn`.
  - Colores con tokens de tema (`--cc-danger`, `--cc-border`, `--cc-text`) para claro/verde/obscuro.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: Eliminar en columna Acciones

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En la tabla de Grupos, botón **Eliminar** a la izquierda de **Editar** (solo `root`, mismo `hardDeleteGroup` + confirmación del drawer).
  - Columna `.cc-gt-col-act` ampliada ligeramente para caber ambos botones.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: contraer sección Miembros en drawer

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En el drawer de edición de Grupos, la sección Miembros se puede contraer/expandir (chevron + Contraer/Expandir; `aria-expanded`).
  - Al contraer se ocultan formulario de alta y tabla; queda visible «MIEMBROS (N)». Abierto por defecto; estado en memoria de sesión.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: Activo/Inactivo en cabecera del drawer

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En el header del drawer de edición, el `status-pill` muestra bolita + texto verde (`--cc-ok`) si Activo, o rojo (`--cc-danger`) si Inactivo.
  - Estilos acotados a `.cc-groups-drawer-head` (tabla sin cambio).
- **Archivos / refs:** `command-center.css`

## 2026-09-23 — Corrección: tipografía título Grupos (= Canales de radio)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - «Grupos y canales» solo toma `font-family: var(--cc-font)` como el h2 «Canales de radio» (`.cc-units-head h2`).
  - Revertidos color acento, mayúsculas, letter-spacing y el tamaño 1.15rem del estilo ADMINISTRACIÓN; tamaño normal `1.05rem`, color `var(--cc-text)`.
  - Quitado `.cc-groups-toolbar-start h1` del bloque institucional de títulos ADMIN.
- **Por qué / notas:** el cambio previo aplicó por error el look de ADMINISTRACIÓN; el pedido era solo la cara tipográfica de Configuración → Canales.
- **Archivos / refs:** `command-center.css`, `institutional.css`

## 2026-09-23 — Fix: tip recortado del logo SICOM (login obscuro)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - `tactical_login_obscuro.png` ampliado a 1003×396 con padding transparente; reconstruido el chaflán metálico/azul superior-derecho (antes cortado en x=970).
  - Script reproducible `infra/_fix_login_obscuro_corner.py`; `sicom.png` paddeado a la misma caja; `aspect-ratio` 1003/396; cache `?v=9` / `sicom?v=5`.
- **Por qué / notas:** el recorte venía del arte RGB fuente, no del flood-fill de transparencia.
- **Archivos / refs:** `tactical_login_obscuro.png`, `sicom.png`, `_fix_login_obscuro_corner.py`, `App.jsx`, `institutional.css`, `styles.css`

## 2026-09-23 — Grupos: rol de miembro editable en drawer

- **Tipo:** feature
- **Área:** web | backend
- **Qué:**
  - En el panel Editar de Grupos, la columna de rol deja de ser texto fijo: `<select>` (Miembro / Líder / Solo escucha) si `canManage`.
  - Nuevo `PATCH /api/admin/groups/:id/members/:userId` (mismo alcance que alta/baja) + helper `patchGroupMember`.
- **Archivos / refs:** `admin.js`, `api.js`, `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: «Cambiar foto» en cabecera del drawer

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Control de foto del canal movido de Identidad a la cabecera del panel (bajo el avatar): «Cambiar foto» / «Quitar».
  - Quitado el enlace «Foto» del encabezado de Identidad (redundante).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: paginación del listado (usr-pager)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Listado de canales en Administración → Grupos con paginación cliente (mismo patrón que Usuarios: `usr-pager`, 15 por página).
  - Al cambiar la búsqueda se vuelve a la página 1.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`

## 2026-09-23 — Fix: Grupos drawer transparente + inputs + UTF-8

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Panel lateral «Editar» (portal a `body`) con fondo opaco y tokens CC por tema (incl. obscuro).
  - Inputs/selects del modal «Nuevo canal» y del drawer con borde, fondo contrastado y texto legible.
  - Reparados caracteres españoles corruptos (mojibake) en `DispatchGroups.jsx` (—, →, ×, …, etc.); sin BOM.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Fix: login en blanco (BOM en DispatchGroups.jsx)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Carácter BOM/corrupto al inicio de `DispatchGroups.jsx` rompía el bundle Vite → pantalla blanca en `/login`.
  - Archivo reparado; `npm run build` OK.
- **Archivos / refs:** `DispatchGroups.jsx`

## 2026-09-23 — Grupos: tabla densa + panel lateral (v2)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Listado tipo catálogo (tabla a ancho completo, búsqueda, sin panel vacío).
  - Edición en panel lateral deslizante (identidad, alcance, miembros, acciones).
  - Alta en modal; miembros en tabla compacta con fila de asignación inline.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Grupos: descripción visible bajo el nombre

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - La descripción del canal se muestra en la tarjeta del listado, justo debajo del nombre (alta sin cambios).
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Login obscuro: restaurar arte original + transparencia (v8)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Se descartó el recolor sobre `sicom.png` (artefactos, texto duplicado, colores falsos).
  - Restaurado el PNG azul original del repo (971×390) con fondo negro → transparente por flood-fill (`threshold=8`, ~22.8% alpha ≈ `sicom.png`).
  - Script correcto: `infra/_make_login_obscuro_transparent.py`; cache `?v=8`.
- **Archivos / refs:** `tactical_login_obscuro.png`, `_make_login_obscuro_transparent.py`, `App.jsx`

## 2026-09-23 — Login obscuro: colores exactos del PNG/JPG de referencia (v7)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Recolor desde la imagen de referencia del usuario (cian eléctrico, plata/cromo, azul marino): muestreo directo + curvas por luminancia; misma transparencia de `sicom.png`.
  - Ref guardada en `infra/_ref_login_obscuro_target.png`; cache `?v=7`.
- **Archivos / refs:** `infra/_recolor_login_obscuro.py`, `tactical_login_obscuro.png`, `App.jsx`

## 2026-09-23 — Login obscuro: más plata/blanco en logo (v6)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Segundo pase de recolor: highlights más plateados/blancos sin quemar; respaldo v5 en `_tactical_login_obscuro_v5_backup.png`.
  - Cache bust `?v=6`.
- **Archivos / refs:** `infra/_recolor_login_obscuro.py`, `tactical_login_obscuro.png`, `App.jsx`

## 2026-09-23 — Grupos: tarjeta de canal más clara (UX)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Tarjeta de grupo reorganizada: identidad + acciones en fila superior; foto del canal bajo el avatar (Cambiar / Quitar); alcance y miembros en secciones separadas con encabezados.
  - Botón «Miembros» pasa a «Ocultar» al expandir.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Login obscuro: paleta alineada al logo de referencia

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Recolor de `tactical_login_obscuro.png` con curvas extraídas del PNG obscuro anterior (azul marino, plateado, hielo); misma composición/transparencia de `sicom.png`.
  - Cache bust `?v=5`.
- **Archivos / refs:** `infra/_recolor_login_obscuro.py`, `infra/_ref_login_obscuro_old.png`, `tactical_login_obscuro.png`, `App.jsx`

## 2026-09-23 — Grupos: ocultar ID técnico de sala LiveKit

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En el catálogo de Grupos ya no se muestra `livekit_room` (`grp_…`); solo nombre, estado, miembros y alcance.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Login obscuro: logo azul con fondo transparente

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - `tactical_login_obscuro.png` se regeneró desde `sicom.png` (971×390) con paleta azul/blanco/plateado; misma composición y transparencia que el logo verde (sin cuadro negro).
  - Cache bust `?v=4` en login tema Obscuro.
- **Archivos / refs:** `infra/_recolor_login_obscuro.py`, `frontend/public/brand/tactical_login_obscuro.png`, `App.jsx`

## 2026-09-23 — Administrador (root) exento de bloqueo por intentos

- **Tipo:** security | fix
- **Área:** backend
- **Qué:**
  - Perfil **Administrador** (`role=root`) ya no se bloquea por intentos fallidos de login (temporal). Si estaba bloqueado, se libera al intentar entrar.
- **Archivos / refs:** `intrusion.js` (`isLoginLockExempt`), `auth.js`

## 2026-09-23 — Login obscuro: ENTRAR sin verde oliva al hover

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - En tema Obscuro, `.btn.primary` / ENTRAR usan azul del tema también en hover/active (antes el hover volvía al verde institucional).
- **Archivos / refs:** `institutional.css`, `theme-contrast.css`

## 2026-09-23 — UX: editar alcance de grupo más claro y compacto

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En Grupos, el panel muestra **Alcance actual** (lo guardado) y solo al pulsar «Cambiar» abre selects compactos; si está incompleto, avisa y abre la edición.
- **Archivos / refs:** `DispatchGroups.jsx`, `command-center.css`

## 2026-09-23 — Perfiles asignados en lote + editar alcance de grupos

- **Tipo:** fix | feature
- **Área:** backend | web | ops
- **Qué:**
  - Asignados 25 `profile_id` vacíos (alcance ya completo) vía `_assign_missing_profiles.js` (p. ej. mperezh3 → Administrador de zona).
  - Grupos: se puede **editar el alcance** (región/zona/unidad) después de creado; PATCH admin acepta `unitId` + `scopeLevel`.
- **Archivos / refs:** `_assign_missing_profiles.js`, `admin.js`, `DispatchGroups.jsx`

## 2026-09-23 — Alcance 4 ajustes: solo perfil vacío u org faltante

- **Tipo:** docs
- **Área:** docs
- **Qué:**
  - Word regenerado: lista solo pendientes reales (perfil vacío con alcance OK; región/zona/unidad faltante; canales sin ancla). Sin el texto confuso de «pertenencia vacía» en admin de zona.
- **Archivos / refs:** `Desktop\Alcance 4 — ajustes manuales.docx`, `_alcance4_manual_dump.js`, `_gen_alcance4_manuales.py`

## 2026-09-23 — Alcance 4 ajustes manuales: más claro (cómo está vs debe)

- **Tipo:** docs
- **Área:** docs
- **Qué:**
  - Reescrito el Word de ajustes manuales: explica que Rol/Adscripción ≠ Perfil; tablas «CÓMO ESTÁ» / «CÓMO DEBE»; datos vivos (25 sin perfil, 2 canales sin ancla, región OK).
- **Archivos / refs:** `Desktop\Alcance 4 — ajustes manuales.docx`, `_gen_alcance4_manuales.py`, `_alcance4_manual_dump.js`

## 2026-09-23 — Pestañas: recordar la última al F5 / cambiar de módulo

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Admin, Configuración y Catálogos vuelven a la última pestaña (no siempre la primera) al F5 o al reentrar desde el rail.
  - Chats: recuerda filtro Contactos/Grupos/No leídos/Favoritos; tablet Command Center recuerda Mapa/Actividad.
  - Mapa ops y panel de canales ya persistían; sin cambios ahí.
- **Archivos / refs:** `rememberModuleTab.js`, `AdminLayout.jsx`, `ConfigLayout.jsx`, `CatalogsLayout.jsx`, `DispatchLayout.jsx`, `ChatInbox.jsx`, `inboxTabOrder.js`, `CommandCenter.jsx`

## 2026-09-23 — Alcance 4 ajustes manuales como Word (.docx)

- **Tipo:** docs | fix
- **Área:** docs
- **Qué:**
  - El listado «Alcance 4 — ajustes manuales» estaba en Markdown (`.md`); Word no lo abría bien.
  - Ahora hay `.docx` en Escritorio y `pulsanet_soporte\Documentos`; generador `infra/_gen_alcance4_manuales.py`; el audit JS también dispara el Word.
- **Archivos / refs:** `Desktop\Alcance 4 — ajustes manuales.docx`, `_gen_alcance4_manuales.py`, `_alcance3_manual_audit.js`

## 2026-09-23 — Fix: apagar amarillo ya no esconde el verde en el mapa

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Al desactivar «Ausente (amarillo)» el filtro ESTADO remapea `away` → `online` (y `offline` → `stale` si se apaga el gris), en lugar de borrar el estado y dejar pines verdes fuera del mapa.
- **Archivos / refs:** `presenceStatus.js` (`reconcilePresenceFilterIds`), `DispatchMap.jsx`

## 2026-09-23 — Implementación Alcance 3 + documento Alcance 4

- **Tipo:** feature | fix | docs
- **Área:** backend | web | docs
- **Qué:**
  - Sin ocultar ubicación (API/UI); mapa solo por jerarquía.
  - Alta region_*: pertenencia solo región; track de region_user acotado a su región; matriz mapa ve zona/unidad.
  - Textos grupos admin región (misma lógica de niveles). Documentos: `Alcance 4.docx` + listado ajustes manuales.
- **Archivos / refs:** `visibility.js`, `orgUnits.js`, `DispatchUsers.jsx`, `Desktop\Alcance 4.docx`

## 2026-09-23 — Documento Alcance 3 (Reglas de pertenencia y canales)

- **Tipo:** docs
- **Área:** docs
- **Qué:**
  - Nuevo `Alcance 3.docx`: sin ocultar ubicación; Punto 1 (alta admin región = solo región) y Punto 2 (canales región = misma lógica que zona) integrados; nombre oficial propuesto «Reglas de pertenencia y canales».
- **Archivos / refs:** `Desktop\Alcance 3.docx`, `pulsanet_soporte\Documentos\Alcance 3.docx`

## 2026-09-23 — Documento Alcance 2 (guía roles vs sistema)

- **Tipo:** docs
- **Área:** docs
- **Qué:**
  - Nuevo `Alcance 2.docx` en Escritorio y `pulsanet_soporte\Documentos`: versión clara del Alcance original, con verde/rojo según cumplimiento del código.
- **Archivos / refs:** `Desktop\Alcance 2.docx`, `pulsanet_soporte\Documentos\Alcance 2.docx`

## 2026-09-23 — Usuarios: editar alcance de admins + perfil en el alta

- **Tipo:** feature | fix
- **Área:** backend | web
- **Qué:**
  - Editar a otro admin (región/zona/unidad) ya permite corregir **perfil y alcance** (antes solo datos básicos). Uno mismo sigue en solo identidad.
  - Alta/edición asigna `profile_id` (selector Perfil de acceso); el rol ACL se deriva del perfil. Sin perfil explícito se usa el de sistema del rol.
- **Pendiente (recordar):** visibilidad `can_see_*` decorativa en el alta; `region_user` GPS orgWide vs cascada UI; radio de `region_user` solo por membresía.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `profiles.js`

## 2026-09-23 — region_admin solo asigna roles hacia abajo

- **Tipo:** fix | security
- **Área:** backend | web
- **Qué:**
  - `region_admin` ya no puede crear/asignar otro `region_admin` (ni `root`); solo `region_user`, zona y unidad.
  - Misma regla en UI (selector de rol) y backend (`canAssignRole`).
- **Por qué / notas:** Escalera consistente con zone_admin (no designa pares).
- **Archivos / refs:** `roles.js`, `DispatchUsers.jsx`, `_test_visibility.js`

## 2026-09-23 — Admin: pestañas usables en móvil

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Pestañas Administración/Catálogos/Config: scroll horizontal táctil en pantallas estrechas.
  - Menú **Más** (teléfono): accesos directos a Usuarios, Perfiles, Avisos, Grupos y Sitios.
- **Archivos / refs:** `command-center.css`, `DispatchLayout.jsx`, `institutional.css`

## 2026-09-23 — Avisos: usuarios específicos y canales/grupos

- **Tipo:** feature
- **Área:** backend | web | database
- **Qué:**
  - Destinatarios nuevos: **Usuario(s) específico(s)** y **Canal(es) / grupo(s)** (con búsqueda), además de subordinados/zona/unidad/admins.
  - Migración `038_announcement_users_groups.sql` (`target_ids` + audience `users`/`groups`).
- **Archivos / refs:** `announcements.js`, `DispatchAnnouncements.jsx`, `038_*.sql`

## 2026-09-22 — Fix duro: vibración aviso no para tras Enterado

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Alarma de aviso/pánico vía **Vibrator nativo** Android (cancel fiable); stop con reintentos.
  - IDs Enterado normalizados + persistidos; cortar vibración antes del ack de red.
- **Archivos / refs:** `MainActivity.kt`, `panic_vibration.dart`, `channel_session.dart` → APK **1.8.182+192**

## 2026-09-22 — Fix: volumen bajo / baja en llamadas 1:1

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Llamada: altavoz por defecto; foco de audio exclusivo; silencia radio en paralelo (no pelea AGC).
  - No reclaim multimedia al volver de segundo plano durante llamada; reafirma voz al resume.
- **Archivos / refs:** `private_call_screen.dart`, `audio_session_setup.dart`, `channel_session.dart`, `radio_shell.dart` → APK **1.8.181+191**

## 2026-09-22 — Fix: Enterado invisible en celulares (avisos largos)

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:** Modal AVISO: texto con scroll y tope de altura; botón **Enterado** siempre visible en pantallas chicas (en tablet cabía).
- **Archivos / refs:** `radio_shell.dart` → APK **1.8.180+190** sideload

## 2026-09-22 — Fix: avisos no dejan de vibrar tras Enterado

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Vibración de aviso deja de usar `vibrate(repeat)` hardware (no se cancelaba bien); ahora pulsos Dart + stop con sesión.
  - Enterado `await` stop, ignora FCM/socket tardío del mismo id, limpia notificación `ann:<id>`.
  - APK **1.8.179+189** sideload sin OTA.
- **Archivos / refs:** `panic_vibration.dart`, `channel_session.dart`, `push_service.dart`, `pubspec.yaml`

## 2026-09-22 — APK sideload 1.8.178+188 (Avisos)

- **Tipo:** release
- **Área:** mobile
- **Qué:**
  - APK **1.8.178+188** sin OTA: avisos globales (modal Enterado), fix overlay; `API_BASE=https://pulsanet.duckdns.org`.
  - → `C:\pulsanet_soporte\APK\TacticalPtx-1.8.178+188.apk` (+ latest).
- **Archivos / refs:** `mobile/pubspec.yaml`, `radio_shell.dart`, `channel_session.dart`

## 2026-09-22 — Avisos: fix enum role en SQL

- **Tipo:** fix
- **Área:** backend
- **Qué:** `users.role` es enum `user_role`; las consultas de destinatarios usan `role::text = ANY(...)` (antes fallaba «operador no existe»).
- **Archivos / refs:** `backend/src/services/announcements.js`

## 2026-09-22 — Avisos globales (warning crítico)

- **Tipo:** feature
- **Área:** backend | web | mobile | database
- **Qué:**
  - **Administración → Avisos:** envío con alcance jerárquico (todos subordinados / zona / unidad / solo admins + opción incluir admins).
  - Modal **AVISO** obligatorio hasta **Enterado**; no es mensaje de chat. Socket + FCM + pendientes al login (30 días).
  - Permiso en **Perfiles** módulo `avisos` (admins por defecto).
  - Sin OTA/APK en este cambio (código móvil listo para próximo build).
- **Archivos / refs:** `037_announcements.sql`, `announcements.js`, `DispatchAnnouncements.jsx`, `GlobalAnnouncementHost.jsx`, `channel_session.dart`

## 2026-09-22 — Renombre UI: pánico → Alerta

- **Tipo:** ux
- **Área:** web | mobile | backend | docs
- **Qué:** Etiquetas visibles «pánico/Pánico» pasan a **Alerta** (Usuarios, eventos, consola, mapa, perfiles, timeline, overlays). Identificadores técnicos (`panic`, `canReceivePanic`, claves API) sin cambio.
- **Archivos / refs:** `DispatchUsers.jsx`, `DispatchPanicHost.jsx`, `CommandCenter.jsx`, `ConfigEvents.jsx`, `profiles.js`, `userEventsTimeline.js`, `gps_cluster_pin.dart`, …

## 2026-09-22 — Despacho: Chats como página (sin flotante)

- **Tipo:** feature | ux
- **Área:** web
- **Qué:** Se quitó el panel flotante; **Chats** es módulo de página (`/despacho/chats`) con keepalive (mismo patrón que Radio). Notificaciones/Contactar navegan a Chats.
- **Archivos / refs:** `DispatchChatsPage.jsx`, `DispatchLayout.jsx`, `App.jsx`, `chatsPanel.js`, `command-center.css`

## 2026-09-22 — Despacho: menú Chats + panel flotante

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Ítem **Chats** en el rail (aparte de Radio PTT) abre un panel flotante para ver/responder mensajes sin cambiar de módulo.
  - Una sola instancia de `ChatInbox` (keepalive parked); Radio embebido muestra acceso «Abrir chats».
  - Notificaciones y Contactar abren el panel (ya no obligan a ir a Radio).
- **Por qué / notas:** Separar mensajería del PTT sin duplicar sockets ni tocar keepalive de voz.
- **Archivos / refs:** `DispatchChatsFloat.jsx`, `chatsPanel.js`, `DispatchLayout.jsx`, `RadioPage.jsx`, `GlobalChatNotifyHost.jsx`, `command-center.css`

## 2026-09-22 — Usuarios: Ver grupos (solo lectura)

- **Tipo:** feature | ux
- **Área:** backend | web
- **Qué:**
  - `GET /api/admin/users/:id/groups`: lista grupos del usuario filtrados al alcance del gestor.
  - En Usuarios → Más → **Ver grupos** (modal: nombre, rol en canal, dependencia).
- **Por qué / notas:** Consulta sin tocar membresías; no reinicio de stack.
- **Archivos / refs:** `backend/src/routes/admin.js`, `frontend/src/api.js`, `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Grupos: guía de alcance sin estilo de error

- **Tipo:** ux
- **Área:** web
- **Qué:** El aviso «Siguiente paso…» del alcance del canal se muestra como ayuda (hint), no en rojo de error.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`

## 2026-09-22 — Asignar miembro: admin de zona entra en canales de Cías. vinculadas

- **Tipo:** fix
- **Área:** web
- **Qué:** En «Asignar miembro», el filtro de usuarios ya reconoce el alcance de un `zone_admin` (incl. vínculos Coord. → Cías. G.N.), p. ej. `jhernandezb2` en canales 200/264/265.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`

## 2026-09-22 — 8/a. Z.M. ve Coord. Unidad 23 y 29 (vínculo de alcance)

- **Tipo:** feature
- **Área:** backend | database | web
- **Qué:**
  - Tabla `org_unit_scope_links`: una zona anfitriona incluye otras zonas/unidades (y descendientes) en su alcance.
  - Vinculadas **23/a.** y **29/a. Coord. Unidad** a **8/a. Z.M.** (siguen existiendo como zonas propias).
  - Dependencias muestra los vínculos bajo 8 con etiqueta «vínculo».
- **Archivos / refs:** `036_org_unit_scope_links.sql`, `orgUnits.js`, `DispatchDependencias.jsx`, `apply-036-scope-links.js`

## 2026-09-22 — Usuarios/Grupos: alcance por jerarquía (opción 2)

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - **Usuarios:** `region_*` y `zone_*` ya no bajan a unidad (región→zona; zona=toda la zona). Solo `unit_*` elige organismo.
  - **Grupos:** miembros por alcance geográfico del canal (toda región / zona / unidad); admin de zona puede canal de toda la zona o una unidad; admin de zona no agrega perfiles de región; región sí puede entrar en canal zona/unidad.
  - Asignar miembro: etiqueta `nombre — rol · adscripción`.
- **Archivos / refs:** `DispatchUsers.jsx`, `DispatchGroups.jsx`, `groupPolicy.js`, `groups.js`, `admin.js`

## 2026-09-22 — Grupos: asignar miembro en cascada

- **Tipo:** ux
- **Área:** web
- **Qué:** Formulario «Asignar miembro» escalonado: Grupo → Usuario → Rol en canal (y botón Asignar solo al final).
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`

## 2026-09-22 — Grupos: cascada clara + límite admin de zona

- **Tipo:** feature | ux | security
- **Área:** web | backend
- **Qué:**
  - Alcance del canal alineado con Usuarios (Región → todas zonas / zona → todos org. / unidad) y textos en lenguaje sencillo.
  - Admin de zona solo crea canales de una unidad; no puede asignar `region_admin` / `region_user` (API + filtro en Asignar miembro).
- **Archivos / refs:** `DispatchGroups.jsx`, `groupPolicy.js`, `admin.js`

## 2026-09-22 — Usuarios: menú Más sin Contactar ni Perfil

- **Tipo:** ux
- **Área:** web
- **Qué:** En el menú «Más» de la tabla se quitaron Contactar y el selector de Perfil (se valora volver a ponerlos después). Quedan Restablecer clave y el resto de acciones.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-22 — Usuarios: textos claros de radio/mapa por rol

- **Tipo:** ux
- **Área:** web
- **Qué:** Explicación en lenguaje sencillo de qué oye/ve cada rol en radio y mapa (según designación; no se elige a mano).
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-22 — Usuarios: alcance en cascada (estilo Parque Vehicular)

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Adscripción con selects progresivos: Región → Zona (o «todas las zonas») → Unidad (o «todos los organismos»).
  - `region_*`: puede elegir toda la región o acotar a zona/unidad; `zone_*`: zona fija + todos org. o una unidad; `unit_*`: unidad obligatoria; root = todas las regiones.
  - Persistencia vía `unit_id` / `admin_scope_unit_id`; create/patch de `region_admin` acepta ancla región/zona/unidad.
- **Por qué / notas:** Misma lógica de alcance que Parque Vehicular para evitar confusión en perfiles de región.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-09-22 — Error de edición visible dentro del modal

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - Los errores de Guardar en Usuarios se muestran dentro del modal (ya no detrás en la lista).
  - Refuerzo al persistir `Usuario de zona` con Zona seleccionada (unidad opcional).
- **Archivos / refs:** `DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-09-22 — Admins región/zona/unidad: Editar solo datos básicos

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Botón **Editar** disponible para Admin de región / zona / unidad (también sobre la propia cuenta).
  - Modal «Editar datos básicos»: grado, nombres, matrícula, cargo — sin cambiar rol ni alcance orgánico.
  - El cambio de perfil vía Más queda solo para root en esos casos.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-22 — Editar usuario: Región/Zona ya no se vacían

- **Tipo:** fix
- **Área:** web | backend
- **Qué:**
  - Al guardar, `zone_user` persiste la zona elegida (`unit_id` = unidad || zona); antes solo mandaba `unitId` vacío y se perdía la adscripción.
  - Rehidratación de cascada al abrir Editar cuando el árbol org llega o el ancla es zona/región.
  - API create/patch valida y guarda ancla de `zone_user`; listado muestra `zoneName` también desde `admin_scope`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-09-22 — Login web: mensaje claro si el usuario es solo app

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - Login consola envía `client: 'web'`; si el rol no es admin de despacho, API responde 403 `WEB_APP_ONLY` sin emitir sesión.
  - Formulario muestra aviso: ingresar solo desde la app móvil (sin pantalla vacía).
  - Ruta `/solo-app` con aviso + botón para volver al login (evita el blank por redirect circular).
  - `POST /api/admin/users/:id/force-logout` + cierre de sesión de `mperezh4` en este equipo.
- **Archivos / refs:** `backend/src/routes/auth.js`, `admin.js`, `sessionPolicy.js`, `frontend/src/App.jsx`, `api.js`

## 2026-09-22 — LiveKit: revisión de estabilidad y reinicio

- **Tipo:** ops | infra
- **Área:** infra | backend
- **Qué:**
  - Comprobado health API (`ready`, LiveKit configured), IP pública = `node_ip`/`LIVEKIT_PUBLIC_HOST` (189.175.60.174).
  - Señalización `/rtc` OK vía directo :7880, Caddy :443 y Vite :5173 (401 sin token = esperado).
  - Reinicio elevado de `livekit-server` (nuevo PID; UDP 7882 + TURN 3478 + TCP 7880/7881).
- **Por qué / notas:** Error de consola «No se pudo conectar el audio (LiveKit)»; el servicio estaba vivo pero se reinició para limpiar estado ICE.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, Caddy `/rtc*`

## 2026-09-22 — Alta usuario: aviso inmediato si matrícula ya existe

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Endpoint `POST /api/admin/users/check-matricula` (valida formato + `taken` en la org; respeta `excludeUserId` en edición).
  - En el campo Matrícula del alta/edición: verificación en vivo (~350 ms) con mensajes Disponible / Ya registrada / Formato inválido; bloquea Continuar/Guardar si está tomada.
- **Archivos / refs:** `backend/src/routes/admin.js`, `frontend/src/api.js`, `frontend/src/dispatch/DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Alta usuario: grupos opcionales de verdad

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - Paso Grupos ya no pre-marca canales; botones «Marcar sugeridos» / «Ninguno».
  - Se quitó el auto-ingreso al canal de la unidad cuando `groupIds` venía vacío (impedía «Crear sin grupos»).
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-09-22 — Radio PTT: admins pueden oír/hablar sin ser miembros explícitos

- **Tipo:** fix
- **Área:** backend | web
- **Qué:**
  - `ptt:join` / `ptt:request` aceptan root y admins de consola en canales activos de su org aunque no estén en `group_members` (rol efectivo `leader`), alineado con el bypass LiveKit.
  - Dock muestra el mensaje real del error (`esMsg`) en lugar de siempre «Error de audio».
- **Por qué / notas:** Al actualizar, Escuchar restauraba canales visibles por privilegio; el socket rechazaba join → banner engañoso y «Conectando…».
- **Archivos / refs:** `backend/src/services/presence.js`, `backend/src/socket/ptt.js`, `frontend/src/dispatch/DispatchLayout.jsx`

## 2026-09-22 — Grupos: cascada Región → Zona → Unidad al crear

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Alta de grupo con cascada orgánica (como Usuarios): Región → Zona / C.G. → Unidad opcional.
  - Se envía `scopeLevel` explícito (`region` | `zone` | `unit`); ancla en `unit_id` (región/zona/unidad).
  - API valida `kind` del ancla; admin de zona sigue exigiendo unidad; admin de unidad queda fijado.
  - Listado muestra `scopeLabel` (Región/Zona/Unidad · nombre).
- **Por qué / notas:** El nivel define membresía (`groupPolicy`) y visibilidad radio; «Sin unidad» ambiguo se reemplaza por alcance claro.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`, `frontend/src/dispatch/command-center.css`, `backend/src/routes/groups.js`, `backend/src/routes/admin.js`

## 2026-09-22 — Fix 502: admin.js SyntaxError (effectiveRole duplicado)

- **Tipo:** fix | ops
- **Área:** backend
- **Qué:** En `PATCH /users/:id` se declaró `effectiveRole` dos veces → la API no arrancaba (`SyntaxError`) y Caddy devolvía 502 al no poder conectar a `:4000`. Se eliminó la redeclaración; health público vuelve a OK.
- **Archivos / refs:** `backend/src/routes/admin.js`

## 2026-09-22 — Usuarios: filtros vacíos conservan encabezados de tabla

- **Tipo:** fix | ux
- **Área:** web
- **Qué:** Si «Desmarcar» en un filtro deja 0 filas, la tabla ya no se sustituye por un vacío: se mantienen encabezados/filtros y el mensaje va en una fila del tbody (como Parque Vehicular).
- **Por qué / notas:** Antes `filteredUsers.length === 0` ocultaba toda la tabla, incluidos los th.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-22 — Alcance radio/mapa fijado por rol (sin checks editables)

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - En Alta/Editar Adscripción, los privilegios R/Z/U ya no se eligen a mano: se muestran solo los del rol (Admin unidad → solo Unidades; Admin zona → Zonas+Unidades; Admin región → los tres).
  - Chips de visibilidad en listado solo informativos; se quitó el toggle manual.
  - API create/update fuerza `can_see_*` con `defaultVisibilityFlags(role)` e ignora el body.
- **Por qué / notas:** El alcance ya lo define el perfil/rol; Admin de unidad no debe poder marcar Región ni Zona.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`, `backend/src/routes/admin.js`

## 2026-09-22 — Usuario de unidad: Unidad obligatoria + footer Grupos en una fila

- **Tipo:** fix | ux
- **Área:** web | backend
- **Qué:**
  - En Alta/Editar usuario, rol `unit_user` exige Unidad (asterisco, checklist, bloqueo Continuar/Guardar), igual que `unit_admin`.
  - Backend create/update rechaza `unit_user` sin `unit_id` (unidad `kind=unit` válida).
  - Paso Grupos: botones «Atrás» y «Crear e ingresar…» en una sola fila (`cc-form-actions` + `flex-wrap: nowrap`).
- **Por qué / notas:** Paridad con Admin de unidad; footer del modal se apilaba por `.field` en columna y wrap.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`, `backend/src/routes/admin.js`

## 2026-09-22 — Alta de usuario: placeholders Selecciona (rol / unidad)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - En Adscripción, «Rol / designación» ya no arranca en «Usuario de unidad»; muestra «— Selecciona —» y exige elección antes de continuar (Alta).
  - Placeholder de «Unidad» pasa de «— Opcional —» a «— Selecciona —» (misma etiqueta que Región/Zona); sigue opcional salvo Admin de unidad.
  - Edición conserva el rol del usuario; Admin de unidad sigue bloqueado en `unit_user`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-22 — Usuarios: nombres de perfil desde Perfiles

- **Tipo:** fix
- **Área:** web | backend
- **Qué:**
  - Usuarios deja de mostrar solo labels fijos de `ROLE_OPTIONS`; carga `access_profiles` y usa el `name` por `code` (columna Perfil, filtros, selects de asignación).
  - `GET /api/admin/profiles` legible para gestores de usuarios (escritura sigue solo Administrador).
- **Por qué / notas:** Renombrar en Perfiles no se veía en Usuarios porque el listado referenciaba el rol por código y pintaba texto hardcodeado.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/profiles.js`

## 2026-09-22 — Usuarios: filtros multi estilo Parque Vehicular

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Botón **Filtros** (junto a Columnas) muestra/oculta los filtros bajo cada columna (default oculto).
  - Cada filtro pasa de `<select>` simple a panel multi estilo PV: **Ascendente/Descendente**, **Marcar/Desmarcar**, búsqueda en lista y checkboxes (selección múltiple).
  - Badge con columnas filtradas activas; drag de columnas y Columnas sin cambios.
- **Por qué / notas:** Paridad UX con Parque Vehicular Usuarios (`th-filter-multi`).
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-22 — Usuarios: botón Filtros (mostrar/ocultar encabezado)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Se restaura el botón **Filtros** en el toolbar de Usuarios (junto a Columnas), estilo PV.
  - Solo muestra/oculta los selects «— Todos —» bajo cada columna; sin panel/popover de Perfil/Estado/Zona.
  - Badge opcional con cantidad de filtros de columna activos; default oculto (como PV).
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-22 — Orden del dropdown de roles (Usuarios)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `ROLE_OPTIONS` en Usuarios (modal Adscripción y demás consumidores) reordenado: root → region_admin → region_user → zone_admin → zone_user → unit_admin → unit_user.
  - Labels de `ROLE_LABEL` en Perfiles alineados a la misma nomenclatura; `allowedRoleOptions` sin cambios de lógica.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `DispatchProfiles.jsx`

## 2026-09-22 — Acceso público desde otro equipo (UPnP + DuckDNS)

- **Tipo:** fix | ops
- **Área:** infra
- **Qué:**
  - Reafirmados mapeos UPnP TCP/80+443 (+ media LiveKit) → `192.168.1.77`; DuckDNS `pulsanet.duckdns.org` → WAN `189.175.60.174`.
  - `ENSURE-PUBLIC-EDGE.ps1`: si el edge local está OK (hosts→LAN), ahora también refresca DuckDNS y `Reinforce-UPnP` (antes salía sin tocar el camino Internet).
- **Por qué / notas:** Caddy/API/Web seguían vivos; el health “público” desde este PC iba por hosts→LAN y ocultaba UPnP vacío. URL correcta: `https://pulsanet.duckdns.org` (no `tacticalptx.duckdns.org`).
- **Archivos / refs:** `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/Reinforce-UPnP.ps1`

## 2026-09-22 — Escalera de roles en alta/edición de usuarios

- **Tipo:** security | fix
- **Área:** web | backend
- **Qué:**
  - UI (`allowedRoleOptions`): escalera root → region_admin → zone_admin → unit_admin; alias legacy `admin`/`dispatcher`/`operator` normalizados (no aparecen como opción root).
  - API PATCH `/users/:id`: `canAssignRole` siempre (antes solo si `!orgWide`); rol normalizado al persistir.
- **Por qué / notas:** Create/Más/Adscripción ya filtraban; se cierra hueco API org-wide y alias.
- **Archivos / refs:** `DispatchUsers.jsx`, `backend/src/routes/admin.js`, `backend/src/services/roles.js`

## 2026-09-22 — Usuarios: filtros en encabezado (estilo PV)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Se elimina el botón/panel Filtros del toolbar; el filtrado pasa a selects «— Todos —» bajo cada título de columna (Acciones sin filtro).
  - Opciones derivadas de los datos (perfil, estado, alcance, grado, nombre, etc.); siguen el orden de columnas (incluido drag-reorder). Se conserva Columnas y la búsqueda global.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Usuarios: Rol en paso Adscripción

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En el modal crear/editar usuario, el campo Rol / designación pasa del paso Generales al paso Adscripción (antes de la cascada Región → Zona → Unidad).
  - Checklist de adscripción incluye Rol; se mantienen ROLE_HELP, required y bloqueo para unit_admin.
- **Archivos / refs:** `DispatchUsers.jsx`

## 2026-09-22 — Usuarios: filtros ampliados (estilo PV)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Panel Filtros más amplio en grilla: Perfil, Estado, Nivel de alcance, Zona, Unidad.
  - Badge con conteo en el botón; chips activos quitables; Limpiar filtros; búsqueda del toolbar sin duplicar.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Usuarios: reordenar columnas arrastrando encabezados

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - En la tabla de usuarios se puede reordenar columnas arrastrando los `<th>` (icono ⠿ + cursor grab), como en Parque Vehicular.
  - El orden se persiste en el mismo `localStorage` (`tacticalptx_users_cols`); Acciones queda fija al final (no arrastrable).
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Usuarios: paginación al estilo Parque Vehicular

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Pie de listado: izquierda «Mostrando X de Y usuarios · Página N de M»; derecha botones cuadrados « ‹ 1 2 3 › » (página activa resaltada).
  - Tamaño de página 15 (como PV); ventana de hasta 5 números; tokens `--cc-*`.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Usuarios: Filtros y Columnas al estilo Parque Vehicular

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Botones Filtros / Columnas con iconos y estilo compacto tipo PV (sin Exportar).
  - Paneles popover: filtros Perfil/Estado; columnas con checkbox, reordenar (↑↓ / drag) y Restablecer.
  - Preferencias de columnas en `localStorage` (`tacticalptx_users_cols`); cierre al clic fuera o al cambiar de panel.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-09-22 — Perfiles como pestaña de Administración

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:** Se quitó la barra interna «Usuarios registrados / Perfiles» en Usuarios. Perfiles pasa a pestaña hermana de Administración (junto a Usuarios), visible solo para Administrador (`root`).
- **Archivos / refs:** `AdminLayout.jsx`, `App.jsx`, `DispatchUsers.jsx`, `DispatchProfiles.jsx`

## 2026-09-22 — Encabezados de tabla en tema obscuro

- **Tipo:** ux
- **Área:** web
- **Qué:** En tema obscuro, `.cc-table th` / `.data-table th` dejan el verde oliva institucional y usan tono de panel + texto muted.
- **Archivos / refs:** `institutional.css`



- **Tipo:** ux
- **Área:** web
- **Qué:** La pestaña Usuarios registrados pasa de tarjetas a tabla (grado, nombre, usuario, perfil, alcance, estado, fechas y acciones). Sin exportar. Filtros, columnas y paginación. Editar / Eliminar a la vista; Contactar, clave, pánico y ubicación quedan en Más.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`, `admin.js` (`created_at`)



- **Tipo:** feature
- **Área:** backend | web | database | mobile
- **Qué:**
  - Respaldo previo: `C:\pulsanet_soporte\Respaldos\pre-perfiles-jerarquia-20260922`.
  - Roles: Administrador (`root`), Admin/Usuario de región, zona y unidad. Migrados `admin`→`region_admin`, `operator`→`unit_user`.
  - Consola web solo administradores. Usuarios: app + mapa según perfil.
  - Pestaña Perfiles (modelo B): módulos y alcance; solo el Administrador crea/edita; el perfil Administrador no se borra.
  - Mapa: matriz de visibilidad + ocultar ubicación (solo admins) y share hacia abajo.
  - Grupos por nivel (región/zona/unidad) y DM/Contactar solo si comparten grupo.
  - Pánico: habilitado; la alerta se emite también a la organización (alcance fino pendiente).
- **Por qué / notas:** El Administrador no se puede eliminar (sí restablecer clave). Hay varias cuentas `root` en BD; no se borraron. El mapa en el APK ya instalado sigue con el filtro viejo hasta una compilación nueva; el API ya filtra.
- **Archivos / refs:** `roles.js`, `visibility.js`, `profiles.js`, `DispatchProfiles.jsx`, `DispatchUsers.jsx`, migración `apply-031-profiles.js`



- **Tipo:** fix | ux
- **Área:** backend | web | database
- **Qué:**
  - Aclarado: `amadridm2` aparece en Usuarios del admin Mijangos porque ambos tienen `unit_id` = **8/o. R.C.** (servicios desplegados correctos; no era alcance a toda la 8/a. Z.M.).
  - `unit_admin`: alcance admin/track/canales = unidad asignada (+ subordinadas reales); si el alcance apunta a zona/región por error, **no** se expande el árbol de zona.
  - UX designación: etiquetas Admin de región / zona / unidad + ayuda; `zone_admin` solo puede designar operador/despacho/admin de unidad; cascada y alcance al promover.
  - Grupos: listado/CRUD filtrado por alcance; crear canal exige `unit_id` (fijo para unit_admin); backfill de `unit_id` en canales cuyo nombre = unidad (p. ej. «8/o. R.C.»).
- **Por qué / notas:** Feedback panel ADMIN DE UNIDAD (lista «ajena», designar admins, grupos mal). Datos Mijangos OK; no se cambió su fila.
- **Archivos / refs:** `orgUnits.js`, `admin.js`, `groups.js`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `_backfill_group_unit_ids.js`

## 2026-09-21 — unit_admin: ubicaciones + pánico

- **Tipo:** fix | ux
- **Área:** backend | web
- **Qué:**
  - Alcance GPS/mapa/canales de **admin de unidad** fijo a su unidad (árbol); ya no se vacía por chip Z sin zona ni se limita a un solo `unit_id`.
  - `/api/locations` incluye operadores adscritos **o** miembros de canales de esa unidad.
  - Columna **Pánico** muestra «Por rol» para `unit_admin` / `zone_admin`; operadores nuevos con pánico en sí; admin de unidad solo crea/gestiona operadores.
- **Por qué / notas:** Queja: Admor de unidad no veía ubicaciones de servicios desplegados y veía Pánico=No.
- **Archivos / refs:** `backend/src/services/orgUnits.js`, `backend/src/routes/locations.js`, `backend/src/routes/admin.js`, `frontend/src/dispatch/DispatchUsers.jsx`

## 2026-09-21 — Admin unidad: cascada adscripción fijada

- **Tipo:** ux | fix
- **Área:** web | backend
- **Qué:**
  - En alta/edición de usuarios (servicios desplegados), si el operador es **admin de unidad**, Región / Zona·C.G. / Unidad se rellenan solas con su jerarquía y quedan deshabilitadas.
  - API: create/patch ya no aceptan otra `unitId` ni alta sin unidad asignada para `unit_admin`.
- **Por qué / notas:** Solo ese rol registra servicios de su unidad; root/admin/zone_admin siguen eligiendo libremente.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-09-21 — Rate-limit 429: clave JWT + poll consola

- **Tipo:** fix
- **Área:** backend
- **Qué:**
  - `keyGenerator` del rate-limit global usa la **cola de la firma JWT** (últimos ~32), no el prefijo del header Authorization (header JWT idéntico → un solo bucket).
  - Confirmados skip de poll consola (`GET /api/locations*`, `/api/admin/overview`) y default `RATE_LIMIT_MAX` ~2000; comentario en `.env.example`.
  - Soft-reload API (`--watch`); health OK; sin auth → 401 (no 429).
- **Por qué / notas:** Consola hacía poll GPS/overview y casi todas las sesiones compartían cupo → HTTP 429 «Demasiadas solicitudes». Tras reload de la consola el 429 debería desaparecer.
- **Archivos / refs:** `backend/src/server.js`, `backend/src/config.js`, `backend/.env.example`

## 2026-09-21 — Edge schtask + push rama WIP

- **Tipo:** ops
- **Área:** infra | ops
- **Qué:**
  - Registrada tarea `TacticalPtx-EdgeKeepalive` (cada 20 min → ENSURE-PUBLIC-EDGE); se detuvo el loop minimizado duplicado.
  - `git push` de `wip/despacho-panel-2026-09-12` (`10fd04a..51fa58e`).
- **Archivos / refs:** `Register-EdgeKeepalive.ps1`; remoto `origin/wip/despacho-panel-2026-09-12`

## 2026-09-21 — OTA retirada (solo sideload)

- **Tipo:** ops
- **Área:** mobile | ops
- **Qué:**
  - Se quitó el APK de `backend/app-updates/files/` y el manifiesto quedó inerte (`versionCode: 0`) → no ofrece OTA.
  - Sideload intacto: `pulsanet_soporte\APK\TacticalPtx-1.8.177+187.apk` (+ latest).
- **Archivos / refs:** `backend/app-updates/android.json`

## 2026-09-21 — Plan escalonado: borde + keepalive + freeze WIP

- **Tipo:** ops | security | docs
- **Área:** infra | ops
- **Qué:**
  - Fase 1: `START-PUBLIC-EDGE` — IP pública alineada (`189.175.60.174`), UPnP 80/443/LiveKit, DuckDNS/Caddy OK; checks externos HTTP 200.
  - Fase 2: keepalive edge cada 20 min (`EdgeKeepaliveLoop` + `START-EDGE-KEEPALIVE.cmd`) **sin** matar API/Web; `Register-EdgeKeepalive.ps1` listo si hay admin para schtasks.
  - Fase 3: commit `7e5be4b` del WIP despacho/Eventos/Radio (95 archivos; sin secretos ni basura).
  - Fase 4: OTA **1.8.177+187** (`force=false`) = mismo binario sideload → `backend/app-updates/` (sin rebuild).
- **Por qué / notas:** Sin desfases: no se reinició el supervisor completo (mata start-api/web). Schtasks denegado sin admin.
- **Archivos / refs:** `infra/EdgeKeepaliveLoop.ps1`, `START-EDGE-KEEPALIVE.cmd`, `Register-EdgeKeepalive.ps1`, `backend/app-updates/android.json`

## 2026-09-21 — Edge público: UPnP 443 caído (timeout WAN)

- **Tipo:** ops | fix
- **Área:** infra | ops
- **Qué:**
  - Desde fuera (check-host) HTTP/TCP :443 daba `Connection timed out`; DNS A OK → `189.152.246.140`; LAN/hairpin HTTP 200.
  - Corrió `infra\ENSURE-PUBLIC-EDGE.ps1` → `START-PUBLIC-EDGE` + UPnP 80/443 (y LiveKit); post-fix: check-host HTTP 200 y TCP OK desde varios nodos.
- **Por qué / notas:** Mapeo UPnP perdido (router/IGD); el PC servidor seguía OK en LAN → otro equipo fuera veía timeout.
- **Archivos / refs:** `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/START-PUBLIC-EDGE.ps1`, `infra/EXPOSE-UPNP.ps1`

## 2026-09-21 — FORMATO_CAMBIOS_21_09_2026 (resumen del día)

- **Tipo:** docs
- **Área:** docs | ops
- **Qué:**
  - Word de control de cambios del día (9 filas, lenguaje sencillo); copia Escritorio + soporte.
  - Sin la ampliación posterior de Eventos (timeline + Ver chat).
- **Archivos / refs:** `pulsanet_soporte\Documentos\FORMATO_CAMBIOS_21_09_2026.docx` (+ `.md`), `Scripts\fill_formato_cambios_21_09.py`

## 2026-09-21 — APK sideload 1.8.177+187 (Radio canal)

- **Tipo:** release | ux
- **Área:** mobile
- **Qué:**
  - APK **1.8.177+187** sin OTA: chip lateral con nombre de canal/grupo; encabezado canal primero; selector inferior con números.
  - → `pulsanet_soporte\APK\` (+ latest).
- **Archivos / refs:** `radio_screen.dart`, `pubspec.yaml`, `TacticalPtx-1.8.177+187.apk`

## 2026-09-21 — Radio APK: nombre de canal + selector numérico

- **Tipo:** ux | fix
- **Área:** mobile
- **Qué:**
  - Encabezado Radio: título = nombre del canal/grupo; subtítulo = operador (antes al revés).
  - Selector inferior: vuelve el strip con **números** claros (y nombre al seleccionar), como antes de los solo-iconos.
  - Chip lateral junto al PTT: otra vez icono + **nombre del canal/grupo** (no solo capas).
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`

## 2026-09-21 — Eventos: timeline del operador + Ver chat

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Timeline unificada (sesión, presencia, geocerca, mensajes, llamadas, PTT, pánico, cuenta).
  - Mensajes históricos desde BD; botón **Ver** abre hilo DM/grupo en solo lectura.
  - Login/logout y cambios online/ausente/desconectado se registran en `user_events`.
- **Archivos / refs:** `userEventsTimeline.js`, `userEvents.js`, `admin.js`, `auth.js`, `presence.js`, `ConfigEvents.jsx`, `api.js`

## 2026-09-21 — Fix pantalla negra /despacho (toast geocerca)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - `DispatchGeofenceToastHost` llamaba `socketIoOptions(token)` (no es función) → crash JS y pantalla oscura vacía.
  - Misma init que PanicHost: `{ auth: { token }, ...socketIoOptions }` + `dispatch:join`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGeofenceToastHost.jsx`

## 2026-09-21 — Eventos por operador + toast geocerca

- **Tipo:** feature | ux
- **Área:** web | backend | database
- **Qué:**
  - Configuración → **Eventos**: select de operador + tipo + fechas; lista legible (geocerca / cuenta).
  - Persistencia `user_events` (migración 035); enter/exit geocerca y alta/desact/react cuenta.
  - Toast flotante + campanita al enter/exit (`DispatchGeofenceToastHost`).
- **Archivos / refs:** `035_user_events.sql`, `userEvents.js`, `geofences.js`, `admin.js`, `ConfigEvents.jsx`, `DispatchGeofenceToastHost.jsx`, `appNotify.js`

## 2026-09-21 — Script geocerca: no cierra la ventana

- **Tipo:** fix | ops
- **Área:** infra
- **Qué:**
  - `Test-GeofenceEnterExit.ps1` pide usuario/clave si faltan, muestra el error y espera Enter.
  - `Test-GeofenceEnterExit.cmd` para lanzarlo con doble clic.
- **Archivos / refs:** `infra/Test-GeofenceEnterExit.ps1`, `infra/Test-GeofenceEnterExit.cmd`

## 2026-09-21 — Script prueba enter/exit geocerca

- **Tipo:** ops | docs
- **Área:** infra
- **Qué:**
  - `infra/Test-GeofenceEnterExit.ps1`: login operador + 3 POST `/api/locations` (fuera → dentro → fuera) para disparar enter/exit sin APK.
- **Archivos / refs:** `infra/Test-GeofenceEnterExit.ps1`

## 2026-09-21 — Consola ops: altura fija entre pestañas

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - `#map-ops-toolbar`: el cuerpo de paneles (Sitios/Operadores/Ruta/Geocerca) usa altura fija (`--map-ops-panel-body-h` = label + control); ya no cambia al cambiar de pestaña.
  - Una sola fila (`nowrap`); si no cabe, scroll horizontal en lugar de crecer.
- **Archivos / refs:** `command-center.css`

## 2026-09-21 — Color: sin cuadro intermedio

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Geocerca / Sitios: se eliminó el popover con el swatch grande; doble clic en la bolita abre solo la paleta nativa.
- **Archivos / refs:** `DispatchMap.jsx`, `CatalogTacticalSites.jsx`, `command-center.css`

## 2026-09-21 — Tooltip PTT: sin «Oír es aparte»

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Consola: en el tooltip del dock de radio se quitó la frase «Oír es aparte».
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-09-21 — Consola KPI: etiquetas y sin Al aire

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - KPIs del mapa/overview: Canales → Grupos, Con GPS → Operadores, Alertas activas → Alertas.
  - Se quita el KPI «Al aire ahora».
- **Archivos / refs:** `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-09-21 — Color: paleta nativa vuelve a abrir

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Geocerca / Sitios: al doble clic en la bolita se vuelve a abrir la paleta nativa (`showPicker` en el mismo gesto), sin que el clic fuera del portal la cierre al instante.
  - Clic en el swatch reabre la paleta; doble clic confirma y cierra.
- **Archivos / refs:** `DispatchMap.jsx`, `CatalogTacticalSites.jsx`

## 2026-09-21 — Geocerca: Guardar/Cancelar misma altura

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Consola → Geocerca (formulario): «Guardar cambios» y «Cancelar» usan la misma altura fija que inputs/selects (`--map-ops-ctrl-min-h`), sin agrandar el panel.
- **Archivos / refs:** `command-center.css`

## 2026-09-21 — Color: paleta fija visible (doble clic)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - La paleta de Geocerca/Sitios ya no se «oculta»: sale en portal fijo bajo la bolita (antes la recortaba el toolbar o se cerraba al abrir).
  - Doble clic en bolita abre; doble clic en el color de la paleta confirma y cierra.
- **Archivos / refs:** `DispatchMap.jsx`, `CatalogTacticalSites.jsx`, `command-center.css`

## 2026-09-21 — Color: doble clic en la paleta confirma

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Geocerca y Sitios: doble clic en una bolita abre una paleta propia (no la nativa del SO).
  - **Doble clic sobre el color de esa paleta** confirma el color y cierra la ventanita.
  - Clic simple en bolita sigue eligiendo sin abrir paleta. Esc / clic fuera también cierra.
- **Archivos / refs:** `DispatchMap.jsx`, `CatalogTacticalSites.jsx`, `command-center.css`

## 2026-09-21 — Geocerca: mismo ancho de select que otras pestañas

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Consola → Geocerca: el multi-select «Geocercas» queda a 11rem (como Persona/Grupo/Sitios); el panel desplegable ya no fuerza 260px (`preferMin` 220).
  - «Nueva geocerca» deja de estirarse con flex grow.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — APK sideload 1.8.176+186

- **Tipo:** ops
- **Área:** mobile
- **Qué:**
  - APK **1.8.176+186** (zumbido 1.8.175 + fix de audio de llamada tras ringback; árbol que ya compilaba, incluida la selección múltiple que estaba en disco) → `pulsanet_soporte\APK\` (+ latest); sin OTA ni emulador.
  - `Publish-ApkUpdate.ps1`; `API_BASE=https://pulsanet.duckdns.org`. Tamaño 99.8 MB (104 677 518 bytes).
- **Archivos / refs:** `mobile/pubspec.yaml`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.176+186.apk`

## 2026-09-20 — Chat 1:1 APK: selección múltiple

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:**
  - Mantener pulsado un mensaje del chat directo entra en selección (estilo WhatsApp): toques marcan o desmarcan, la fila lleva check y fondo, y la barra sustituye el encabezado (contador, cerrar, borrar, compartir, copiar).
  - Borrar usa el delete de DM que ya existía: solo los propios; si hay ajenos, se borran los propios y se avisa. Compartir abre la hoja del sistema con texto y archivos que ya están en el teléfono; el resto se omite. Copiar solo si hay texto (incluye pie de foto y «¡Zumbido!»).
  - Con un solo mensaje, «Más» conserva responder, reaccionar, reenviar, fijar y descargar. El deslizar para responder sigue fuera del modo. Salir con X, atrás o al quedar 0.
- **Por qué / notas:** No hay endpoint nuevo. No se descarga al compartir. No se compiló APK. El chat de canal no cambia.
- **Archivos / refs:** `mobile/lib/screens/direct_pane.dart`, `mobile/lib/chat_multi_select.dart`, `mobile/pubspec.yaml` (`share_plus`)

## 2026-09-20 — Llamada: el audio de voz sigue tras el timbre

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Al contestar, el ringback (`ToneGenerator` en `STREAM_VOICE_CALL`) soltaba el modo de comunicación y la voz WebRTC quedaba en silencio. Ahora se para el timbre y se reafirma sesión de voz y auricular/altavoz.
  - El timbre entrante se corta antes de abrir la sesión de voz (ya no en paralelo).
  - La radio (reconexión LiveKit / canales extra) ya no pasa a `MODE_NORMAL` mientras hay llamada o video.
- **Por qué / notas:** El timbre se mantiene. No se compiló APK.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `mobile/lib/channel_session.dart`, `mobile/android/.../MainActivity.kt`

## 2026-09-20 — APK sideload 1.8.175+185

- **Tipo:** ops
- **Área:** mobile
- **Qué:**
  - APK **1.8.175+185** (zumbido: mensaje sin `Exception:`, shake del chat, vibración de notificación) → `pulsanet_soporte\APK\` (+ latest); sin OTA ni emulador.
  - `Publish-ApkUpdate.ps1`; `API_BASE=https://pulsanet.duckdns.org`. Tamaño 99.6 MB.
- **Archivos / refs:** `mobile/pubspec.yaml`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.175+185.apk`

## 2026-09-20 — Zumbido APK: mensaje, shake y vibración

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:**
  - El snackbar del rate-limit (10 s) muestra solo el texto humano («Espera 10s para otro zumbido»), sin prefijo `Exception:`.
  - El chat 1:1 se sacude de lado (~1.45 s, misma curva que `.dm-nudge-shake` en web) al enviar y al recibir un zumbido. En primer plano, si no es ese hilo, se sacuden la pantalla visible y el globo.
  - La notificación de sistema no se puede animar en el shade (RemoteViews no aplica translate y no hay permiso de dibujar encima). Canal nuevo `tacticalptx_nudge_v5` con vibración alternada y texto «¡Zumbido!».
- **Archivos / refs:** `mobile/lib/screens/direct_pane.dart`, `mobile/lib/nudge_shake.dart`, `mobile/lib/screens/radio_shell.dart`, `mobile/lib/push_service.dart`

## 2026-09-20 — APK sideload 1.8.174+184

- **Tipo:** ops
- **Área:** mobile
- **Qué:**
  - APK **1.8.174+184** (código mobile pendiente tras 1.8.173) → `pulsanet_soporte\APK\` (+ latest); sin OTA ni emulador.
  - `Publish-ApkUpdate.ps1`; `API_BASE=https://pulsanet.duckdns.org`; `SERVER_LAN_IP=192.168.1.77`.
- **Archivos / refs:** `mobile/pubspec.yaml`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.174+184.apk`

## 2026-09-20 — Consola Ruta: «Máx. 30 días»

- **Tipo:** ux
- **Área:** web
- **Qué:** La etiquetita del calendario de rango (Desde/Hasta) pasa de «Máx. 30 d» a «Máx. 30 días». El tope de 30 días no cambia.
- **Archivos / refs:** `frontend/src/dispatch/TrackRangePicker.jsx`

## 2026-09-20 — Consola mapa: leyenda sigue el filtro ESTADO

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - La leyenda flotante del mapa (`PresenceMapLegend`) solo muestra los estados marcados en el select ESTADO.
  - Si se desmarca p. ej. Fuera de línea, esa pastilla desaparece. Los conteos siguen siendo de los pines visibles.
- **Archivos / refs:** `frontend/src/dispatch/PresenceMapLegend.jsx`, `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-20 — Consola: altura de toggles ops

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - «Fijar en mapa» (Geocerca) y «Ruta probable» (Ruta) quedan a la misma altura que select, `.cc-tactical-ms-trigger` y `.cc-btn` del panel ops.
  - Antes `.map-fix-toggle` solo tenía `min-height` (el contenido + padding 0.35rem lo dejaba más alto). Ahora entra en las reglas de `height` / `max-height` con `--map-ops-ctrl-min-h`. El checkbox interior no hereda el alto ni el padding de los inputs de texto.
- **Por qué / notas:** La fila de Ruta no cambia (sigue compacta a la izquierda). No toca maximizado ni «Ocultar panel».
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — Consola Ruta: una fila (Ruta · Desde · Hasta · check)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - El panel Ruta volvía a partir controles: label DESDE arriba y debajo Ruta | Hasta | Ruta probable.
  - Causa: `flex-wrap` en `.map-ops-panel--ruta` y `.map-track-range` + `flex: 0 1 auto` / `min-width: 0` dejaban encoger y wrappear Desde/Hasta.
  - Desktop: una fila compacta a la izquierda (`nowrap`, `flex: 0 0 auto`, `min-width: min-content`). El check sigue junto a Hasta.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — Maximizado: tipo de mapa (capas)

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - En maximizado, Natural / Satélite / Claro vuelven a cambiar (mismo listener nativo del page; React no recibe clics tras reparent a `body`).
  - `data-map-layer` en `.lt-layers`; `onClick` React intacto fuera de maximizado.
- **Archivos / refs:** `DispatchMap.jsx`

## 2026-09-20 — Maximizado: pestañas, leyendas y panel abajo

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - En maximizado, las pestañas Operadores/Ruta/Geocerca/Sitios vuelven a cambiar (mismo listener nativo que el panel; React no recibe clics tras reparent a `body`).
  - Leyenda de estatus y tipo de mapa se ven con la barra abierta (chrome del mapa por encima de Leaflet).
  - «Ocultar panel» / «Mostrar panel» abajo al centro del mapa (solo maximizado).
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Consola Ruta: «Ruta probable» junto a Hasta

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - El check «Ruta probable» ya no queda pegado al extremo derecho del panel Ruta.
  - Causa: `.map-track-range` con `flex: 1 1 18rem` estiraba Desde/Hasta y empujaba el toggle.
  - Ahora `flex: 0 1 auto` — controles compactos: Ruta, Desde, Hasta, Ruta probable.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — Fix: Ocultar barra ops en maximizado

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Consola mapa maximizado: «Ocultar»/«Mostrar» vuelven a funcionar.
  - Causa: tras reparent a `body`, los `onClick` de React ya no llegan (delegación en `#root`).
  - Delegación nativa `data-ops-chrome` en el page; toolbar con `hidden` + CSS más fuerte.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`, `useMapViewportMaximize.js`

## 2026-09-20 — Consola: pulido barra ops (maximizado)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Barra ops: indentación/a11y (aria-expanded/controls), «Ocultar»/«Mostrar» solo en maximizado.
  - `map-page--ops-collapsed` solo si maximizado; al restaurar la barra siempre visible (CSS).
  - Botón «Mostrar» alineado a chrome del mapa (altura/tema verde·obscuro); `cc-shell` en maximizado documentado (reparent a body).
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Consola: barra ops en maximizado + Ocultar

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Al maximizar el mapa, vuelven a verse Operadores / Ruta / Geocerca / Sitios.
  - Solo en maximizado: «Ocultar» / «Mostrar» para mapa a pantalla completa (preferencia en localStorage).
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Pin «Ver ruta»: selecciona Ruta + periodo

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - «Ver ruta» en popup del pin: pone ese operador en el select Ruta (1 solo), abre pestaña Ruta.
  - Si ya había ruta o Desde/Hasta tocados → se mantienen; si no → hoy 00:00 hasta ahora.
  - Mismo pin otra vez = Quitar ruta.
- **Archivos / refs:** `DispatchMap.jsx`

## 2026-09-20 — Ruta: clic en mapa ya no borra la selección

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Consola → Ruta: al elegir un operador, la ruta ya no se limpia al hacer clic/pan en el mapa (ni al siguiente poll GPS/presencia).
  - Causa: un `useEffect` podaba `trackUserIds` contra `visibleLocations` (pines filtrados por Operadores/estado); Ruta lista `gpsPeople` (universo GPS), así que un id válido salía del set filtrado y se borraba.
  - Se eliminó esa poda; se mantiene la poda contra `gpsPeople`. «Fijar en mapa» y Aceptar/clic fuera del picker intactos.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-20 — Geocerca: paleta de color como Sitios

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Consola → Geocerca: bolitas con clic = elegir color y doble clic = paleta nativa que muta esa bolita (localStorage `tacticalptx_geofence_palette`), paridad Administración → Sitios.
  - Se quitó la bolita extra «custom»; anillo `is-active` compartido con Sitios.
- **Archivos / refs:** `DispatchMap.jsx` (ref. `CatalogTacticalSites.jsx`)

## 2026-09-20 — Ruta: check «Ruta probable»

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - En Consola → Ruta, check para mostrar/ocultar ruta probable (huecos GPS) en mapa.
  - Si está off: no se pide OSRM/estimado y se oculta esa entrada de la leyenda; se guarda preferencia en localStorage.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Geocerca: bolita de color activa visible

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Anillo `is-active` de swatches de color más visible en Consola (ops).
  - Color de paleta nativa fuera del set: se muestra bolita extra marcada; comparación hex normalizada.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Selects: «— Seleccionar —» (antes elegir)

- **Tipo:** ux
- **Área:** web
- **Qué:** Placeholders de selects (Ruta, Grupo vacío, etc.): «— elegir —» → «— Seleccionar —»; ayudas Ruta y aria Desde/Hasta alineados.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `DispatchMap.jsx`, `TrackRangePicker.jsx`

## 2026-09-20 — Desde/Hasta calendario más compacto

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Popover calendario/hora de Consola Ruta (Desde/Hasta): menos padding/gaps, celdas ~32px, tipografía y steppers densos en una fila.
  - Footer Cancelar/Aplicar más bajo (estilo Ruta); Aplicar sigue primary; panel ~268–292px.
- **Por qué / notas:** el panel tapaba demasiado el mapa (“demasiado grandote”).
- **Archivos / refs:** `TrackRangePicker.jsx`, `command-center.css` (`.trp-panel`, `.trp-cal__*`, `.trp-time`, `.trp-stepper`, footer)

## 2026-09-20 — Ruta radio: clic fuera confirma como Aceptar

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `RouteTrackPicker` singleSelect: clic fuera (`mousedown`/`pointerdown`) y cierre exclusivo ms confirman el borrador (`commitDraft: true`), igual que Aceptar.
  - Cancelar y Esc siguen descartando el borrador.
- **Por qué / notas:** no se fuerza commit vacío sobre selección previa (`closePanel` solo hace `onChange` si hay `draftId`, como Aceptar disabled sin draft).
- **Archivos / refs:** `frontend/src/dispatch/RouteTrackPicker.jsx`

## 2026-09-20 — Ruta radio: sin caja cuadrada alrededor del control

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - `RouteTrackPicker` singleSelect: el radio seleccionado ya no muestra borde/outline cuadrado; queda solo el círculo relleno.
  - Estilos para `input[type='radio']` en `.cc-tactical-ms-option` (tamaño, `border/outline/box-shadow: none`); focus a11y en la fila vía `:has(:focus-visible)`.
- **Por qué / notas:** `styles.css` aplica `border`+`padding`+`outline` a todo `input`; los checkbox ya tenían override de tamaño, los radio no.
- **Archivos / refs:** `command-center.css` (`.cc-tactical-ms-option input[type='radio']`)

## 2026-09-20 — PTT mapa: Videollamada misma altura que Alerta

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Botón **Videollamada** del float PTT: misma altura que **Alerta** (`line-height: 1.25`, icono `1.05rem`, padding vertical compensado −1px por el borde).
- **Archivos / refs:** `command-center.css` (`.lt-ptt-float-menu-video`, `.lt-ptt-float-menu-panic`)

## 2026-09-20 — Ruta footer: Cancelar/Aceptar igualados

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Pie del panel Ruta: Cancelar/Aceptar con mismo `min-width`, outline a intensidad plena (`--cc-danger` / `--cc-accent`).
  - Hover/focus-visible rellena el fondo con el color del botón y texto contraste (`--cc-panel`); ya no solo opacity.
  - Aceptar disabled en muted/borde neutro (no “acento apagado”).
- **Archivos / refs:** `command-center.css` (`.cc-ms-footer`, `.cc-ms-cancel`, `.cc-ms-accept`)

## 2026-09-20 — Cluster click: zoom menos agresivo

- **Tipo:** fix | ux
- **Área:** web | mobile
- **Qué:**
  - Al picar un cluster con miembros cercanos, `fitBounds` ya no acerca de más (pines fuera de frame).
  - Web: `CLUSTER_FIT_MAX_ZOOM` 16.5, padding 96, soft +1 si el fit casi no cambia (sin forzar +2/`CLUSTER_BREAK`).
  - Mobile GPS: mismo espíritu (`maxZ` 16.5, padding 96, soft +1).
- **Por qué / notas:** maxZoom 18 + padding 56 (y bump +2) sobrepasaba el marco de grupos compactos.
- **Archivos / refs:** `ClusteredLocationLayer.jsx`, `gps_track_screen.dart`

## 2026-09-20 — Operadores: caret select nativo = multi-select

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Select nativo **Por operador / Por grupo**: caret CSS más pequeño (≈ `.cc-tactical-ms-caret` ▾) y `appearance: none` reforzado.
  - `background` → `background-color` en selects/inputs del toolbar para no borrar el caret custom.
- **Archivos / refs:** `command-center.css`

## 2026-09-20 — PTT mapa: Videollamada blanco fijo (como Radio)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Botón **Videollamada** del float PTT: deja tokens del menú (`--surface-raised` / `--ink`) que en Obscuro se fundían con el navy; ahora mismos colores fijos que Radio `.radio-video-call-btn` (`#f4f6f2` / `#1f2a1c` / borde `rgba(0,0,0,.18)`).
  - Solo ese botón; Posición inicial, círculo PTT y resto sin cambio.
- **Archivos / refs:** `command-center.css` (`.lt-ptt-float-menu-video`)

## 2026-09-20 — Fix Consola: lista/KPI geocercas vacíos

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Causa: tras el split `allLoc`/`pinLoc`, el poll seguía leyendo `loc.presence*` → `ReferenceError` antes de `setGeofences` (lista y KPI en 0 pese a datos en BD).
  - Poll pasa a `Promise.allSettled`; geocercas solo se actualizan si el GET OK (error de GPS/overview no vacía ni bloquea la lista).
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-20 — PTT mapa: Videollamada outline (como Radio)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Botón **Videollamada** del menú flotante PTT (pestaña Video): de fill primary (`--accent` / azul en Obscuro) a outline/secondary blanco-raised, como Radio `.radio-video-call-btn`.
  - Tokens del menú (`--surface-raised`, `--ink`, `--border`) para claro / verde / obscuro.
- **Archivos / refs:** `command-center.css` (`.lt-ptt-float-menu-video`)

## 2026-09-20 — Ruta probable: OSRM multi-base + sin cuerdas verdes

- **Tipo:** fix | mejora
- **Área:** web | backend
- **Qué:**
  - Huecos de señal: además de `gapBefore` del servidor, el mapa corta saltos espaciales ≥700 m sin marca (cuerdas verdes post-RDP).
  - Routing: varias bases OSRM (`ROUTING_OSRM_URL` → fallbacks → demos); si ninguna responde, corredor estimado multi-punto (Bezier + rumbo) en naranja **punteado** — nunca la recta A→B de 2 vértices.
  - Umbrales: post-simplificar 700 m; salto espacial backend 1000 m.
- **Por qué / notas:** el operador pedía la mejor ruta probable al perder señal, no líneas rectas sin sentido. Preferir OSRM propio en LAN (`ROUTING_OSRM_URL`).
- **Archivos / refs:** `routeHint.js`, `trackHistory.js`, `trackHighlighter.js`, `HighlighterTrack.jsx`, `useGapRoutes.js`, `locations.js`, `api.js`, `.env.example`

## 2026-09-20 — Ruta select: Cancelar rojo + descartar + sin persistir operador

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Footer **Cancelar** con estilo danger suave (`--cc-danger`, outline); **Aceptar** sigue accent.
  - Cancelar / Esc / clic fuera / panel exclusivo: descartan borrador y mantienen la selección comprometida al abrir (vacío → «— elegir —»).
  - `trackUserIds` (Ruta) ya no se restaura desde `OPS_MAP_FILTERS_KEY` al cargar el mapa; cada visita arranca sin operador.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `command-center.css`, `DispatchMap.jsx`

## 2026-09-20 — Dock radio: multi-Hablar, sin enlace a Config

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Chip del dock (fuera de Radio): muestra canales de **Hablar** (`talkIds`), no solo el grupo primario; Oír X/Y aparte.
  - Ya no es enlace a Configuración; solo estado (sin hover de atajo). Tooltip con lista completa + “cámbialos en Radio”.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`

## 2026-09-20 — Ruta: Aceptar/Cancelar en footer

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Panel Ruta (`singleSelect`): **Aceptar** sale de la fila Ascendente; pie sticky con **Cancelar** (izquierda, descarta borrador) y **Aceptar** (derecha, confirma).
  - Clic fuera / panel exclusivo siguen confirmando borrador; Esc = Cancelar.
  - `fitMsPanelHeight` resta altura del footer para que resize/lista no se rompan.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `command-center.css` (`.cc-ms-footer`), `fitMsPanelHeight.js`

## 2026-09-20 — Operadores: quitar modo «Todos»

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Consola Operadores: el select solo ofrece **Por operador** y **Por grupo** (se elimina «Todos»).
  - Persistencia: `operatorFilterMode === 'all'` (o inválido) migra a `operator` y re-siembra Persona = todos (paridad UX con el antiguo Todos).
  - Pines: no-grupo = foto individual; Por grupo = foto de grupo (sin ramas `all`).
- **Archivos / refs:** `DispatchMap.jsx`, `useMapAvatarPhotos.js`, `mapAvatarIcon.js`, `command-center.css`

## 2026-09-20 — Ruta: Aceptar compacto en cabecera PV

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Panel Ruta (`singleSelect`): **Aceptar** pasa a la fila de acciones (derecha, junto a Ascendente); estilo quieto borde/texto `--cc-accent` (no bloque azul a ancho completo).
  - Se elimina la fila gruesa entre búsqueda y lista.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `command-center.css` (`.cc-ms-accept`)

## 2026-09-20 — Persona select: ellipsis + caret visible (ops)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Consola Operadores → Persona (y demás `cc-tactical-ms` de la fila ops): el nombre largo ya no tapa/corta el ▾; ellipsis + caret fijo.
  - Con 1 persona seleccionada: mismo compact Grado+Cargo + tooltip completo que Ruta.
- **Por qué / notas:** el trigger (grid item) crecía al ancho del texto; el campo de 11rem con `overflow:hidden` recortaba el caret («mocho»).
- **Archivos / refs:** `command-center.css`, `RouteTrackPicker.jsx`

## 2026-09-20 — Por grupo: foto de grupo en pines del mapa

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Restaurado: con Operadores = **Por grupo**, cada pin muestra la foto del grupo (fallback a la del usuario si el grupo no tiene avatar).
  - Todos / Por operador siguen con foto individual. Etiquetas cargo/nombre sin cambio; un pin por persona.
- **Por qué / notas:** `pickMapMarkerPhotoSrc` había dejado de usar `groupPhotoSrc` (regresión frente al acuerdo de producto).
- **Archivos / refs:** `mapAvatarIcon.js`, `useMapAvatarPhotos.js`

## 2026-09-20 — Multi-select: fila/checkbox estilo PV (sin azul saturado)

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Paneles `cc-ms-panel` / `.cc-tactical-ms-option.is-on`: deja el relleno azul `#1e3a8a` (Obscuro) y hex fijos; selección con `color-mix` de `--cc-accent` sobre `--cc-panel` / `--cc-panel-2` (tint sutil tipo Vehículos PV).
  - Checkbox `accent-color: var(--cc-accent)`; tokens locales en el panel (portal fuera de `.cc-shell`).
- **Por qué / notas:** `C:\ParqueVehicular` no está en esta PC; se portó el feel institucional (fondo suave + acento de marca) a Claro/Verde/Obscuro vía tokens.
- **Archivos / refs:** `command-center.css`

## 2026-09-20 — En grupo: Marcar/Desmarcar + sin bolitas de color

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - «En grupo»: ids explícitos (1.ª vez todos; vacío = ninguno); Marcar/Desmarcar ya no chocan con emptyMeansAll.
  - Bolitas `.cc-tactical-dot` solo si `showColorDots` (Persona/En grupo no las muestran).
- **Archivos / refs:** `RouteTrackPicker.jsx`, `DispatchMap.jsx`

## 2026-09-20 — Ruta panel: resize 2D + tooltip + sin bolita radio

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Paneles PV multi-select (`cc-ms-panel`): `resize: both` (ancho + alto); max-width cerca del viewport.
  - Nombres truncados en Ruta: `title` con texto completo al hover.
  - Ruta radio (`singleSelect`): sin bolita de color de ruta junto al nombre.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `command-center.css`, `fitMsPanelHeight.js`

## 2026-09-20 — Ruta select: Grado+Cargo si no cabe + tooltip completo

- **Tipo:** ux | fix
- **Área:** web | backend
- **Qué:**
  - Trigger Ruta: si el indicativo completo no cabe, muestra Grado + Cargo; hover con tooltip del nombre completo.
  - Ancho fijo del select Ruta (15rem) sin solapar Desde/Hasta; API locations incluye `grade`.
- **Archivos / refs:** `RouteTrackPicker.jsx`, `mapLabelUtils.js`, `command-center.css`, `locations.js`, `liveTiming.js`

## 2026-09-20 — Operadores: selección Persona/Grupo persistente (1.ª vez todos)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Por operador y Por grupo guardan su selección por separado (no se borra al cambiar de modo ni al cerrar el panel).
  - Primera vez: todos los checks marcados; después se respeta lo que eligió el usuario en ese navegador.
- **Archivos / refs:** `DispatchMap.jsx`

## 2026-09-20 — Ruta: Aceptar + sin solape con Desde/Hasta

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Select Ruta (radio): botón Aceptar; al clic fuera confirma el borrador si había uno.
  - Ancho fijo del select Ruta (ellipsis) para no tapar Desde/Hasta (`map-ops-panel--ruta`).
- **Archivos / refs:** `RouteTrackPicker.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Operadores Por operador/grupo + Ruta 30 días

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Operadores: Todos | Por operador | Por grupo; tooltip GPS; Por grupo con subfiltro de personas (vacío = todos del grupo).
  - Ruta independiente (radio 1 operador, solo con GPS); historial span 30 d / lookback 31 d (front + API + trackHistory).
- **Archivos / refs:** `DispatchMap.jsx`, `RouteTrackPicker.jsx`, `trackRange.js`, `TrackRangePicker.jsx`, `locations.js`, `trackHistory.js`

## 2026-09-20 — Operadores: mismo ancho select que Sitios

- **Tipo:** ux
- **Área:** web
- **Qué:** Select Todos/Por grupo (`map-field--ops-primary`) alineado a 11rem como el multi de Sitios.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Consola: reordenar KPI (Al aire / Canales / GPS / …)

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - KPI de operaciones arrastrables (mismo pointer DnD que pestañas Sitios/Operadores/Ruta/Geocerca).
  - Orden en `localStorage` (`tacticalptx_ops_kpi_order`); cursor manita abierta al arrastrar.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — APK 1.8.173: volumen llamadas solo PTT/llamada (+ salir Radio)

- **Tipo:** fix | release
- **Área:** mobile
- **Qué:**
  - Volumen «llamadas» (`MODE_IN_COMMUNICATION`) solo con PTT/llamada/video; al salir de pestaña Radio, minimizar o cerrar → multimedia (`MODE_NORMAL`).
  - FGS: si LiveKit deja VoIP, reafirma perfil media; APK **1.8.173+183** → `pulsanet_soporte\APK\` (sin OTA/emulador).
- **Archivos / refs:** `radio_shell.dart`, `audio_session_setup.dart`, `channel_session.dart`, `pubspec.yaml`

## 2026-09-20 — Sitios: despliegue homologado a Ruta

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Desplegable de capas Sitios con misma UI que Ruta/Grupo: Ascendente·Marcar, contador, buscar, lista scroll y resize.
  - Panel Sitios en fila (`map-ops-panel--row`) como el resto de ops.
- **Archivos / refs:** `useTacticalSites.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Ops: manita abierta al arrastrar pestañas + refuerzo altura Operadores

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Cursor de reorder (ops / catálogo chips / canales dual / inbox): `grab` (manita abierta), no `grabbing` (puño).
  - Operadores: regla de altura tras `.cc-tactical-ms-trigger` base para que el select/multi no vuelva a 2.45rem.
- **Archivos / refs:** `command-center.css`, `styles.css`

## 2026-09-20 — Fix: Operadores altura + arrastre pestañas ops

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Operadores: `height`/`appearance` en select nativo y triggers (min-height solo no encogía el `<select>` vs `.trp-trigger`).
  - Pestañas Sitios/Operadores/Ruta/Geocerca: se cableó el pointer DnD que ya tenía helpers (`OPS_TAB_ORDER_*`) pero no handlers/`data-ops-tab-id`.
- **Por qué / notas:** Tras unificar alturas ops, Operadores seguía alto; el reorder de pestañas ops nunca quedó conectado al JSX.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — Ops mapa: misma altura controles que Desde/Hasta

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Tokens --map-ops-ctrl-* tomados de .trp-trigger (pad 0.32/0.45, fs 0.78, lh 1.25 → min-h calc ~1.74rem).
  - Selects, multi-select triggers, .map-action, inputs/botones del panel ops (Sitios/Operadores/Ruta/Geocerca) alineados a esa altura.
- **Por qué / notas:** La fila ops quedaba más alta que los calendarios nuevos; no se tocan paneles desplegables.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — GPS móvil: iconos de sitios tácticos

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Sitios en Seguimiento GPS dejan de pintar siempre la banderita blanca.
  - Usan `groupIconUrl` del API con descarga Bearer (misma auth que web `iconBlobs`); fallback = círculo del color de agrupación.
- **Por qué / notas:** El marcador nunca leía el icono de grupo; hacía falta APK nueva para verlo en dispositivo.
- **Archivos / refs:** `mobile/lib/screens/gps_track_screen.dart`


## 2026-09-20 — Radio APK: menos lag al pulsar (rescate audio)

- **Tipo:** fix | performance
- **Área:** mobile
- **Qué:**
  - El rescate `MODE_IN_COMMUNICATION` rearmaba LiveKit en cada FGS (~12 s), lifecycle duplicado y 4 reintentos → UI de Radio casi no respondía.
  - Ahora: si ya es `normal`, no hace nada; FGS solo `lightEnsureNormal`; debounce 4 s; reintentos solo si sigue en comunicación; coalescing de `setState` del canal por frame.
- **Archivos / refs:** `audio_session_setup.dart`, `background_radio.dart`, `radio_shell.dart`

## 2026-09-20 — Ruta: calendario propio Desde/Hasta (sin chips h)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Quitados atajos 8/24/48/120 h y el `datetime-local` nativo.
  - Disparadores compactos + popover con mes (‹ ›), días a clic y hora/min con −/+ (paso 5 min); Aplicar / Cancelar / Hasta ahora.
  - Misma ventana: máx. 120 h, sin futuro, lookback 130 h; temas light/verde/obscuro.
- **Archivos / refs:** `TrackRangePicker.jsx`, `trackRange.js`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-20 — APK: volumen «llamadas» en segundo plano

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - LiveKit pasa a `AudioSessionManagementMode.manual` + perfil media; reintentos `MODE_NORMAL` al minimizar/FGS (~12 s).
  - Nativo: suelta `MODE_IN_COMMUNICATION` (no toca telefonía `MODE_IN_CALL`).
  - APK **1.8.172+182** → `pulsanet_soporte\APK\`.
- **Por qué / notas:** Con app en segundo plano/cerrada sin forzar, Android seguía mostrando volumen de llamadas.
- **Archivos / refs:** `audio_session_setup.dart`, `radio_shell.dart`, `background_radio.dart`, `MainActivity.kt`

## 2026-09-20 — Ruta: periodo 120 h con calendario Desde/Hasta

- **Tipo:** feature | ux
- **Área:** web | backend
- **Qué:**
  - Consola → Ruta: atajos 8/24/48/120 h + campos **Desde / Hasta** (`datetime-local`).
  - Ventana máxima **120 h**; no futuro; no más atrás de **130 h**.
  - API `GET .../track` acepta `from`+`to` (ISO); `hours` sigue válido (tope 130).
  - N usuarios: mismo multi-select de Ruta; historial por rango acotado.
- **Por qué / notas:** Sustituye el combo Horas (máx. 48) por búsqueda por periodo operativo (~5 días).
- **Archivos / refs:** `trackRange.js`, `DispatchMap.jsx`, `command-center.css`, `api.js`, `locations.js`, `trackHistory.js`

## 2026-09-20 — MapPttFloat: Videollamada usa acento del tema

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Botón Videollamada del float PTT deja el azul fijo `#1a4d7c` y usa `var(--accent)` del menú (light / verde / obscuro).
  - Alarma/pánico sigue en rojo; obscuro conserva azul vía su `--accent`.
- **Por qué / notas:** En verde/claro el azul chocaba con checkmarks y pestaña Video.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css` (`.lt-ptt-float-menu-video`)

## 2026-09-20 — Mapa: Maximizar = Fullscreen API (F11)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Maximizar llama `element.requestFullscreen()` sobre la página del mapa (tras reparent a `body`); oculta chrome del navegador y barra de tareas de Windows.
  - Restaurar / Esc: `document.exitFullscreen()` + restore del home; `fullscreenchange` sincroniza estado si el usuario sale por Esc del navegador.
  - Freeze Leaflet mitigado con `invalidateSize` / `resize` escalonado (50–450 ms) en Consola y Seguimiento.
- **Por qué / notas:** El reparent solo llenaba el viewport del browser (label «Restaurar» OK, pero tabs Edge + taskbar seguían visibles).
- **Archivos / refs:** `useMapViewportMaximize.js`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-20 — Mapa: maximizar full-bleed vía body reparent

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Maximizar en Consola/Seguimiento reparenta el nodo del mapa a `document.body` (sin remount Leaflet) y marca `html.map-viewport-max`.
  - CSS full-bleed `100dvw/100dvh` + z-index alto; oculta rail/topbar/strip; Restaurar/Esc restaura el home en el outlet.
- **Por qué / notas:** El fix solo-CSS (`:has` + overflow:visible) no bastaba: el fixed seguía acotado al outlet (label «Restaurar» sin cubrir pantalla completa). Sin `requestFullscreen` (congela el mapa ~1–2s).
- **Archivos / refs:** `useMapViewportMaximize.js`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-20 — Geocerca: radio con separador de miles

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Radio de geocerca en lista, popups y catálogo: `40,000 m` (`toLocaleString('es-MX')`).
  - Input RADIO (m) del formulario muestra miles; al guardar se parsean digitos sin comas.
- **Archivos / refs:** `DispatchMap.jsx` (`formatRadiusM` / `parseRadiusM`), `GeofenceCatalog.jsx`, `CommandCenter.jsx`

## 2026-09-20 — Mapa: maximizar vuelve a cubrir el viewport

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Maximizar en Consola/Seguimiento ya no queda atrapado en el outlet: se suelta el `overflow:hidden` de los ancestros del shell mientras hay `.map-page--maximized` / `.lt-page--maximized`.
  - En maximizado se ocultan pestañas ops (Sitios/Operadores/Ruta/Geocerca) y toolbar; el mapa llena el viewport (Restaurar / Esc recupera el chrome).
- **Por qué / notas:** El estado sí pasaba a maximizado (label «Restaurar») pero `position:fixed` era recortado por el shell; además el CSS no ocultaba el chrome ops.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — Radio: arrastre de canales más fácil (estilo nav PV)

- **Tipo:** ux | mejora
- **Área:** web
- **Qué:**
  - Reordenar canales en ESCUCHAR/HABLAR/VIDEO/ALERTA con **pointer DnD solo en el asa** (umbral 8px), como pestañas catálogo / navegación ParqueVehicular.
  - Asa `⋮⋮` más grande (`touch-action: none`); la fila ya no es `draggable` HTML5 → no pelea con radio/checkbox.
- **Por qué / notas:** `C:\ParqueVehicular` no está en esta PC; se portó el patrón ya en-repo (`ReorderableCatalogTabs` + asa tipo `cc-mod-drag-handle`).
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css` (`.channel-dual-drag`, `html.channel-dual-dragging`)

## 2026-09-20 — Cámara oculta: sin aviso «Cámara de despacho activa»

- **Tipo:** fix | ux | security
- **Área:** mobile
- **Qué:**
  - Con **Ver cámara** headless (`RemoteCameraSession` / cámara oculta) el FGS ya no muestra «Cámara de despacho activa» ni «Transmitiendo cámara…».
  - Usa el texto genérico «SICOM activo · radio y ubicación» (misma notificación de radio en segundo plano).
  - Llamada/videollamada con UI (`setPrivateCallActive`) sigue con «Llamada en curso».
- **Por qué / notas:** Android exige notificación de FGS + tipo `camera` para no cortar el feed; el texto no debe delatar la transmisión. Indicador verde de cámara del SO (si aparece) es del sistema, no de SICOM.
- **Archivos / refs:** `mobile/lib/background_radio.dart`
## 2026-09-20 — Fix APK: Pulsación Corta se comportaba como Larga

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - En hold (Corta), `releasePtt` ya cancela si el dedo se soltó antes de `ptt:granted` (antes el mic quedaba al aire = latch).
  - PTT Corta usa `Listener` (pointer) en lugar de `onTapDown/Up`; el load de prefs no pisa una elección Corta ya hecha.
- **Por qué / notas:** Race press→tone/acquire→grant vs finger-up; web ya cancelaba pending vía `floorWait`.
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart` (_PttPad / _PttZone)
## 2026-09-20 — Geocerca: diálogo de eliminación más profesional

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Confirmación de borrado de geocerca (mapa y catálogo) con mensaje institucional y nombre de la zona.
- **Por qué / notas:** Sustituye «¿Eliminar esta geocerca?» por tono alineado a otros AppDialogs de despacho.
- **Archivos / refs:** `DispatchMap.jsx`, `GeofenceCatalog.jsx`

## 2026-09-20 — Mapa: chip Estados colapsado sin doble capa

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - El control colapsado «Estados ‹» del mapa ya no muestra bisel/offset claro (botón sobre botón).
  - Al colapsar, el shell externo pierde fondo/borde/sombra; el estilo de chip único queda en el toggle (paridad con Maximizar / leyenda de presencia; temas light/verde/obscuro).
- **Por qué / notas:** Colapsado heredaba panel + borde + box-shadow del contenedor y un segundo background en `.lt-state-legend__toggle` (radios distintos 6px/5px).
- **Archivos / refs:** `frontend/src/dispatch/command-center.css` (`.lt-state-legend--collapsed`)

## 2026-09-20 — Geocercas: color seleccionable (como sitios)

- **Tipo:** feature | ux
- **Área:** backend | web | database
- **Qué:**
  - Columna `geofences.color` (hex, default `#243d20` oliva de Consola).
  - API POST/PATCH/GET aceptan y devuelven `color` (validación hex segura).
  - Formulario alta/edición en Consola: swatches `.cc-tactical-colors` (misma UX que sitios tácticos; doble clic abre paleta nativa).
  - Círculos Leaflet usan `geofence.color`; punto de color en multi-select y catálogo.
- **Por qué / notas:** Paridad con color de agrupaciones de sitios. Migración: `database/migrations/034_geofence_color.sql` (vía `node backend/src/scripts/apply-all-migrations.js`).
- **Archivos / refs:** `034_geofence_color.sql`, `schema.sql`, `geofences.js`, `DispatchMap.jsx`, `CommandCenter.jsx`, `GeofenceCatalog.jsx`, `command-center.css`

## 2026-09-20 — Geocerca «Fijar en mapa»: cursor pointer + move

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Con el check **Fijar en mapa** (`.map-frame.pick-mode`), el mapa ya no muestra flecha `default`: idle = `pointer` (manita), pan/drag = `move` (4 flechas).
  - Overrides CSS que ganan a `.tp-map-cursor { cursor: default !important }`; el frame deja de usar `crosshair`.
- **Por qué / notas:** `MapCursorFix` fuerza flecha en reposo; pick-mode solo ponía crosshair en el frame y perdía frente a `!important` en tiles/panes.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`, `frontend/src/dispatch.css`

## 2026-09-20 — PTT float: radios en modo Individual

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Menú PTT flotante (mapa): en **Individual** los canales usan `type="radio"` (mismo `name` por panel); en **Múltiple** siguen checkboxes.
  - Paridad visual con Radio (`ChannelMultiSelect`), que ya tenía radios en Individual.
- **Por qué / notas:** En Individual los checks cuadrados sugerían multi-selección aunque la lógica ya era single-select.
- **Archivos / refs:** `frontend/src/dispatch/MapPttFloat.jsx`

## 2026-09-20 — Geocercas: × eliminar un poco más grande y rojo

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En el multi-select de geocercas, el botón × (`.cc-geofence-ms-row .cc-cat-rm`) pasa a ~13px, hit-area 1.5rem y color `var(--cc-danger)` (hover un poco más claro).
- **Por qué / notas:** La × se veía chica y gris frente a ✎; solo se tocó la X, no el lápiz.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-20 — PTT mapa: icono warning animado en Alerta

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Botón **Enviar alarma** del menú PTT flotante (pestaña Alerta) reutiliza el mismo icono ⚠ + ondas (`.panic-ico` / `panic-wave-out`) que Radio «Enviar alerta».
  - Tamaño compacto en float; ondas pausadas si el botón está deshabilitado.
- **Por qué / notas:** Paridad visual con Radio; no inventar animación nueva.
- **Archivos / refs:** `MapPttFloat.jsx`, `command-center.css` (icono base en `styles.css`)

## 2026-09-20 — PTT float: select Individual/Múltiple por tema

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - El `<select>` Individual/Múltiple del menú PTT flotante ya no se pinta como pastilla negra nativa: sigue light / verde / obscuro.
  - Tokens del float (`--surface`, `--border`, `--ink`, `--accent`, `color-scheme`) + overrides verde/obscuro; estilo compacto alineado a Radio (`.channel-col-mode`).
- **Por qué / notas:** El panel estaba hardcodeado claro y, con `color-scheme: dark` global (verde/obscuro), el select nativo salía negro sobre beige.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css` (`.lt-ptt-float-menu`, `.lt-ptt-float-menu-mode`)

## 2026-09-20 — PTT mapa: Individual/Múltiple en float

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Menú del PTT flotante (mapa maximizado): selector compacto **Individual | Múltiple** junto al título Escuchar/Hablar/Video/Alerta.
  - Misma preferencia y stash que Radio (`tacticalptx_*_mode` + stash localStorage vía `DispatchLayout`).
- **Por qué / notas:** Paridad con Radio sin inflar el popup.
- **Archivos / refs:** `MapPttFloat.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-20 — Radio: «Audio activado» usable solo con Escuchar

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - El mute de salida («Audio activado/desactivado») ya no exige canal en **Hablar** (`group`); se habilita si hay selección en Escuchar o Hablar.
  - Misma corrección en el dock de despacho (Altavoz/MUTE).
- **Por qué / notas:** Con HABLAR=0 y ESCUCHAR≥1 el botón quedaba `disabled` (gris) pese a OIR activo — bug, no diseño.
- **Archivos / refs:** `RadioPage.jsx`, `DispatchLayout.jsx`

## 2026-09-20 — Geocercas: editar + estilo ops/temas

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - Edición de geocerca en Consola (mismo formulario que alta; PATCH vía `updateGeofence`).
  - Acciones compactas ✎/× en el multi-select, alineadas a catálogos y tokens de tema (light/verde/obscuro).
- **Por qué / notas:** Completa UX pendiente (solo había eliminar).
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`, `api.js` (ya tenía update)

## 2026-09-20 — PTT mapa: botón Videollamada en float

- **Tipo:** feature | ux
- **Área:** web
- **Qué:**
  - En el menú del PTT flotante (mapa maximizado), pestaña **Video**: botón **Videollamada** (mismo patrón que «Enviar alarma» en Alerta).
  - Usa los canales marcados en Video (`videoIds`) y dispara `tacticalptx:open-group-video` como RadioPage.
  - Deshabilitado si no hay canales de video seleccionados.
- **Por qué / notas:** Ctrl+F5 → mapa maximizado → click derecho PTT → Video → marcar canal(es) → Videollamada.
- **Archivos / refs:** `frontend/src/dispatch/MapPttFloat.jsx`, `command-center.css`

## 2026-09-20 — APK 1.8.171+181 (PTT + composer)

- **Tipo:** release
- **Área:** mobile
- **Qué:**
  - APK **1.8.171+181** con PTT Pulsación Corta/Larga, tonos Walkie Talkie press/release, composer +/🙂/🫨; sin OTA.
  - `SERVER_LAN_IP=192.168.1.77`; artefactos en `pulsanet_soporte\APK\TacticalPtx-1.8.171+181.apk` (+ latest).
- **Archivos / refs:** `mobile/pubspec.yaml`, `Publish-ApkUpdate.ps1`

## 2026-09-20 — Obscuro: círculo del logo al mismo tamaño que Verde

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Tras normalizar el banner Obscuro a 971×390, el **círculo** (anillo azul/plata) seguía viéndose más chico que el de Verde por padding interno en el PNG.
  - Escala del glifo en `tactical_login_obscuro.png` (~+4%) para igualar altura/padding del círculo de `sicom.png`.
  - Mismo ajuste en `tactical_favicon_obscuro.png` vs `sicom_round.png` (~+8.5% diametro).
  - Cache-bust login `?v=3`, favicon `?v=2`.
- **Por qué / notas:** Ctrl+F5 en login (Verde ↔ Obscuro) y revisar favicon/badge redondo. Respaldo pre-escala: `pulsanet_soporte\Respaldos\brand_obscuro_circle_scale_20260920\`.
- **Archivos / refs:** `public/brand/tactical_login_obscuro.png`, `public/brand/tactical_favicon_obscuro.png`, `App.jsx`, `theme.jsx`, `appNotify.js`

## 2026-09-20 — APK chat: zumbido y emojis visibles como en web

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:**
  - Composer usaba `sticky_note` + `Icons.vibration` (poco reconocibles vs web `+` / `🙂` / `🫨`); en pantallas estrechas se percibían "ausentes".
  - Barra alineada a web: **+** (adjuntar), **🫨** zumbido (solo DM), **🙂**/⌨️ emojis, campo Mensaje, cámara; botones compactos sin clip.
- **Por qué / notas:** Lógica ya existía (`onNudge` en DirectPane, panel `ChatEmojiPanel`). Ver en hilo DM / chat de grupo (sin zumbido en grupo, igual que web).
- **Archivos / refs:** `mobile/lib/widgets/chat_composer.dart`

## 2026-09-20 — Chat web: punto de presencia en avatares (paridad APK)

- **Tipo:** ux | feature
- **Área:** web
- **Qué:**
  - Lista Contactos/DM y cabecera del chat 1:1 muestran el círculo de presencia (verde/amarillo/gris/rojo) como en la APK.
  - Datos: `presence` de `/api/dm/contacts` + refuerzo live desde `presence:update` / `onlineByGroup`.
  - Grupos: sin punto (igual que APK; solo texto «N en línea»).
- **Por qué / notas:** Verificar con Ctrl+F5 en Chats → Contactos y abriendo un DM.
- **Archivos / refs:** `PersonAvatar.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `presenceStatus.js`, `inboxTabOrder.js`, `styles.css`

## 2026-09-20 — Login: mismo tamaño de marca al cambiar tema

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - Obscuro usaba `tactical_login_obscuro.png` (1672×941 con mucho padding) vs Verde/Claro `sicom.png` (971×390 recortado) → el logo se veía un poco más chico al cambiar de tema.
  - Recorte + normalización del PNG Obscuro a **971×390** (misma caja que `sicom.png`); CSS con `aspect-ratio: 971/390` + `object-fit: contain`.
  - Cache-bust `?v=2`. Respaldo en `pulsanet_soporte\Respaldos\brand_login_obscuro_crop_20260920\`.
- **Por qué / notas:** Verificar en login / cambiar clave: Ctrl+F5 y alternar Verde ↔ Obscuro.
- **Archivos / refs:** `public/brand/tactical_login_obscuro.png`, `App.jsx`, `institutional.css`, `styles.css`

## 2026-09-20 — Tonos PTT Walkie Talkie (producción)

- **Tipo:** ux | mejora
- **Área:** mobile | web
- **Qué:**
  - Sustituidos `ptt_press.wav` / `ptt_release.wav` (mobile assets + frontend public) por extractos Walkie Talkie (FROM_MP3_*).
  - Respaldo de WAV anteriores en `pulsanet_soporte\Respaldos\ptt_sounds_20260920_145944\` (+ RESTAURAR.txt).
  - Preview `_ptt_sound_preview` intacto; sin copias en android `res/raw`.
- **Por qué / notas:** Confirmado por usuario. Web: Ctrl+F5. Teléfono: requiere APK nueva.
- **Archivos / refs:** mobile/assets/sounds/ptt_*.wav; frontend/public/sounds/ptt_*.wav

## 2026-09-20 — Preview tonos PTT desde Walkie Talkie.mp3

- **Tipo:** otro
- **Área:** docs | ops
- **Qué:**
  - Extracción preview press/release desde Desktop\Walkie Talkie.mp3 (sin tocar assets app).
  - Comparador HTML en pulsanet_soporte\APK\_ptt_sound_preview\.
- **Archivos / refs:** infra/_extract_ptt_from_mp3.py; FROM_MP3_*.wav; comparar.html

## 2026-09-20 — PTT: etiqueta Pulsación · Corta/Larga + colores por tema

- **Tipo:** ux
- **Área:** mobile | web
- **Qué:**
  - Etiqueta «Pulsación»; botones «Corta» / «Larga».
  - Web: activo usa --accent (en obscuro azul, no verde fijo).
- **Archivos / refs:** 
adio_screen.dart, PttModeSegment.jsx, styles.css, pttHoldMode.js

## 2026-09-20 — APK 1.8.169+179 (PTT Mantén/Toque)

- **Tipo:** release
- **Área:** mobile
- **Qué:**
  - APK con selector PTT Mantén / Toque; sin OTA.
  - Artefacto: pulsanet_soporte\APK\TacticalPtx-1.8.169+179.apk (+ latest).
- **Archivos / refs:** pubspec.yaml 1.8.169+179

## 2026-09-20 — PTT: modos Mantén / Toque (preferencia usuario)

- **Tipo:** feature | ux
- **Área:** mobile | web
- **Qué:**
  - Selector **Mantén** (sostener) / **Toque** (alternar) en radio app y web; ya no solo por rol.
  - Preferencia persistente (SharedPreferences / localStorage). Al pasar a Mantén con mic abierto, suelta solo.
- **Por qué / notas:** Respaldo en pulsanet_soporte\Respaldos\ptt_modo_20260920_141721 (+ RESTAURAR.txt).
- **Archivos / refs:** ptt_interaction_mode.dart, 
adio_screen.dart, pttHoldMode.js, PttModeSegment.jsx, usePtt.js, RadioPage.jsx, DispatchLayout.jsx

## 2026-09-20 — Fix: clic en cluster encuadra a todos los miembros

- **Tipo:** fix
- **Área:** web | mobile
- **Qué:**
  - Al picar un cluster ya no solo acerca al centroide (mapa vacío entre operadores).
  - Usa fitBounds / fitCamera de los miembros; si no hay progreso, +2 hacia el centro.
- **Archivos / refs:** ClusteredLocationLayer.jsx, gps_track_screen.dart

## 2026-09-20 — Cluster pastel: cuñas al centro geométrico

- **Tipo:** ux | fix
- **Área:** web | mobile
- **Qué:**
  - El pastel llena todo el círculo; el borde blanco va encima (no encoge el conic/drawArc).
  - Evita que la punta de una cuña fina se vea desplazada del centro.
- **Archivos / refs:** clusterMapPoints.js, command-center.css, gps_cluster_pin.dart

## 2026-09-20 — Clusters: cifras solo por color (sin total solapado)

- **Tipo:** fix | ux
- **Área:** web | mobile
- **Qué:**
  - Con 2+ estados en el pastel: solo el número de cada color (p.ej. verde 1 / rojo 20); ya no se mezcla el total `21` encima.
  - Cuñas finas también llevan cifra (radio un poco mayor). Un solo color sigue mostrando el total al centro.
- **Archivos / refs:** `gps_cluster_pin.dart`, `clusterMapPoints.js`, `command-center.css`

## 2026-09-20 — Fix: presencia web en Consola sin canal Hablar

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - `usePtt` ya no exige `group.id` para conectar: con `presenceGroupIds` (despacho) mantiene socket + ping de presencia.
  - Evita el flash «en línea → fuera de línea» del admin root solo en Operadores/mapa.
- **Por qué / notas:** La presencia se borraba al no haber canal PTT; el GPS seguía (pin gris/rojo).
- **Archivos / refs:** `frontend/src/usePtt.js`

## 2026-09-20 — Clusters GPS: cifras por color en el pastel

- **Tipo:** ux | mejora
- **Área:** mobile | web
- **Qué:**
  - El círculo de cluster muestra cuántos hay en cada porción (p.ej. verde 1 / rojo 2) cuando el arco es legible; si no, mantiene el total al centro.
- **Archivos / refs:** `gps_cluster_pin.dart`, `clusterMapPoints.js`, `command-center.css`

## 2026-09-19 — APK sideload 1.8.168+178 (sin OTA)

- **Tipo:** release | fix | ux
- **Área:** mobile
- **Qué:**
  - APK **1.8.168+178** → `pulsanet_soporte\APK\` (+ latest); sin OTA ni emulador.
  - Incluye PTT bip remitente/destinatarios, contactos semáforo, canales solo iconos.
- **Archivos / refs:** `pubspec.yaml`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.168+178.apk`

## 2026-09-19 — APK: PTT bip fiable + contactos semáforo + canales iconos

- **Tipo:** fix | ux
- **Área:** mobile | web | backend
- **Qué:**
  - PTT: players lowLatency separados press/release; warm al conectar; bip antes de acquireVoice; destinatarios oyen press (`ptt:speaker`) y release (`ptt:released`) — web alineado.
  - Contactos: punto semáforo (en línea/ausente/fuera) + orden; API `/dm/contacts` expone `presence`/`focus`.
  - Radio: selector inferior solo iconos centrados (sin nombre duplicado); chip lateral solo icono.
- **Archivos / refs:** `message_tone.dart`, `channel_session.dart`, `chat_inbox_screen.dart`, `inbox_tab_order.dart`, `radio_screen.dart`, `dm.js`, `usePtt.js`

## 2026-09-18 — Codemagic: integrations ASC en yaml

- **Tipo:** infra | fix
- **Área:** infra | mobile
- **Qué:**
  - `codemagic.yaml`: `integrations.app_store_connect: Codemagic TacticalPtx` en workflows TestFlight y build-only (valida `auth: integration`).
- **Archivos / refs:** `codemagic.yaml`

## 2026-09-18 — APK sideload 1.8.167+177 (sin OTA)

- **Tipo:** release | ux
- **Área:** mobile
- **Qué:**
  - APK **1.8.167+177** → `pulsanet_soporte\APK\` (+ `TacticalPtx-latest.apk`); sin OTA ni emulador.
  - Incluye GPS dropdown grupos/Todos, asa sin flecha, remediación security chat APK / presence / listen.
- **Archivos / refs:** `pubspec.yaml`, `gps_track_screen.dart`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.167+177.apk`

## 2026-09-18 — GPS APK: filtro por dropdown + layout teléfono

- **Tipo:** ux | fix
- **Área:** mobile
- **Qué:**
  - Header GPS: quita segmentado «Este grupo / Todos» (se cortaba en teléfono); desplegable a ancho completo con Todos + cada membresía.
  - Lista: se elimina la flecha lateral; basta el asa central para ocultar/mostrar.
- **Archivos / refs:** `gps_track_screen.dart`, `radio_shell.dart`

## 2026-09-18 — Security: remediación escalonada (chat APK, listen, presencia, backup)

- **Tipo:** security | fix
- **Área:** backend | mobile | infra
- **Qué:**
  - Chat: `.apk`/`.aab`/`.jar`/`.dex` otra vez bloqueados en uploads; OTA sigue por `app-updates`. Cliente deja de ofrecer APK en Documento.
  - `LISTEN_HOST=0.0.0.0` se ignora con production/PUBLIC_DOMAIN (salvo `TPX_LISTEN_UNSAFE=1`).
  - XFF solo si el peer es loopback (Caddy→API). Heartbeat HTTP solo `focus=service`; UI por socket.
  - Restore de backups: lista `tar -tf` + post-extract contra zip-slip/symlinks.
- **Por qué / notas:** Security Review high/medium sin romper OTA, FGS ni edge Caddy.
- **Archivos / refs:** `uploads.js`, `config.js`, `intrusion.js`, `presence.js`, `backup.js`, `media_kind.dart`, `channel_session.dart`, `location_heartbeat.dart`

## 2026-09-18 — APK UX: chat archivos, llamadas, radio PTT, GPS

- **Tipo:** mejora | ux | fix
- **Área:** mobile | backend | web
- **Qué:**
  - Chat: adjuntos APK/ZIP + confirmación caption en grupo; backend deja pasar `.apk`.
  - Llamadas: Contestar más claro; aceptar API antes de cerrar pantalla.
  - Radio: chip de canal con nombre; PTT bip alto al pulsar / bip bajo al soltar (más fuerte).
  - GPS: etiquetas Capas/Actualizar; Este grupo/Todos; asa central para ocultar lista.
- **Archivos / refs:** `media_kind.dart`, `uploads.js`, `incoming_call_screen.dart`, `gps_track_screen.dart`, `ptt_*.wav`, APK `1.8.166+176`
## 2026-09-18 — PTT: pitido más claro (press/release)

- **Tipo:** mejora | ux
- **Área:** mobile | web
- **Qué:**
  - Tonos PTT nuevos: chirp ascendente al pulsar y descendente al soltar (estilo «tubo», sin audio con copyright).
  - Volumen moderado (ya no el blip casi inaudible); mismos assets en APK y web.
- **Archivos / refs:** `ptt_press.wav`, `ptt_release.wav`, `message_tone.dart`, `appNotify.js`, APK `1.8.165+175`
## 2026-09-18 — APK: botones Enviar imagen sobre barra del sistema

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:**
  - Diálogo `Enviar imagen/video/documento` solo paddeaba el teclado; en tablet Galaxy los botones quedaban bajo taskbar/nav.
  - `SafeArea` + `viewInsets` (teclado) para que Cancelar/Enviar sean tocables.
- **Archivos / refs:** `chat_attach_sheet.dart`, APK `1.8.164+174`
## 2026-09-18 — Web llamada: foto de usuario en overlay (no iniciales)

- **Tipo:** fix
- **Área:** web | backend
- **Qué:**
  - Causa: cache de avatares por `userId:avatarUrl` + `clearAvatarBlobCache` al salir del mapa; la llamada sin URL perdía/borraba la foto del chat.
  - Cache por userId; no limpiar al desmontar mapa; `peerAvatarUrl` / `callerAvatarUrl` en llamada + socket.
- **Archivos / refs:** `avatarBlobCache.js`, `useMapAvatarPhotos.js`, `PrivateCallOverlay.jsx`, `PrivateCallHost.jsx`, `calls.js`
## 2026-09-18 — APK: restaurar botón Zumbido en composer DM

- **Tipo:** fix | ux
- **Área:** mobile
- **Qué:**
  - Causa: al migrar DM a `ChatComposer` quedó `_sendNudge` sin UI (botón omitido).
  - Restaurado icono `Icons.vibration` a la derecha del emoji (solo DM); busy propio sin bloquear adjuntos.
  - Auditoría: Sonidos/clusters/canal abierto/PTT OK; radio 1:1 retirado a propósito; temas web no portados; burbuja zumbido web más rica (texto plano en APK).
- **Archivos / refs:** `chat_composer.dart`, `direct_pane.dart`, APK `1.8.163+173`
## 2026-09-18 — APK 1.8.162: clusters pastel alineados con web

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:**
  - Clusters GPS en pastel por presencia/pánico (mismos colores y orden que web).
  - Paridad anti-desfase: radio agrupación 55px, tamaño 44/48/52, anillo = color dominante (no azul Google).
  - Presencia del API (ya con showAway/showOffline) alimenta porciones; etiqueta stale = Fuera de línea.
- **Archivos / refs:** `gps_cluster_pin.dart`, `gps_track_screen.dart`, `gps_location_cluster.dart`, APK `TacticalPtx-1.8.162+172.apk`
## 2026-09-18 — Clusters GPS: pastel por presencia

- **Tipo:** feature | ux
- **Área:** web | mobile
- **Qué:**
  - El círculo de agrupación ya no es azul fijo: se divide como pastel según estados (verde/amarillo/gris/rojo) y pánico.
  - Web: Consola, Command Center y Live Track; anillos de pulso toman el color dominante.
  - APK: misma lógica en `GpsClusterPin` (código; sin build APK).
- **Archivos / refs:** `clusterMapPoints.js`, `ClusteredLocationLayer.jsx`, `DispatchMap.jsx`, `gps_cluster_pin.dart`
## 2026-09-18 — Consola: pines con foto de usuario (no emblema de grupo)

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - En «Por grupo», los pines usaban la foto del radio-grupo (p. ej. CABALLERÍA) para todos los operadores.
  - Ahora cada pin muestra el avatar del usuario; la foto de grupo ya no sustituye identidad en el mapa.
  - Marcadores usan miniatura circular del blob cache.
- **Archivos / refs:** `mapAvatarIcon.js`, `useMapAvatarPhotos.js`
## 2026-09-18 — DuckDNS caído: faltaba caddy.exe; BAT ya no lo oculta

- **Tipo:** fix | infra
- **Área:** infra
- **Qué:**
  - `https://pulsanet.duckdns.org/` no abría: no había Caddy en :443 (`infra\caddy\caddy.exe` ausente; gitignore).
  - `ENSURE-PUBLIC-EDGE.cmd` tragaba el error (`exit /b 0`). Ahora propaga código; START-PUBLIC-EDGE descarga Caddy 2.10.2 si falta.
  - LEVANTAR avisa si no hay binario y fuerza borde si :443 está caído.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `START-PUBLIC-EDGE.ps1`, `ENSURE-PUBLIC-EDGE.cmd`
## 2026-09-18 — Contestar fullscreen: wake nativo FCM (Galaxy Tab)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Causa raíz: con pantalla encendida Android degrada FSI a heads-up; `bringToFrontForCall` vía MethodChannel de MainActivity no corre en el isolate FCM.
  - `CallWakeFirebaseMessagingReceiver` → `IncomingCallWakeService` (CallStyle + FSI + `startActivity` desde FGS) antes del handler Dart.
  - Pending en `FlutterSharedPreferences` para drenar Contestar al abrir; APK `1.8.161+171`.
- **Archivos / refs:** `CallWakeFirebaseMessagingReceiver.kt`, `IncomingCallWakeService.kt`, `IncomingCallWakeHelper.kt`, `AndroidManifest.xml`, `incoming_call_wake.dart`, `background_radio.dart`, `radio_shell.dart`

## 2026-09-18 — Semáforo presencia: checks amarillo/gris en Config

- **Tipo:** feature | ux
- **Área:** backend | web | docs
- **Qué:**
  - Org: `presence_show_away` / `presence_show_offline` (migración 033).
  - Config Presencia: checks independientes; sin amarillo→verde; sin gris→rojo.
  - Leyenda, pines y filtro Estado ocultan colores desactivados.
  - Manual: `docs/MANUAL_SEMAFORO_PRESENCIA.md` (+ soporte Documentos).
- **Archivos / refs:** `033_presence_show_away_offline.sql`, `presence.js`, `ConfigPresence.jsx`, `presenceStatus.js`, `DispatchMap.jsx`, `PresenceMapLegend.jsx`
## 2026-09-18 — Llamada Contestar: data-only FCM + FGS wake (Galaxy Tab)

- **Tipo:** fix
- **Área:** backend | mobile
- **Qué:**
  - Causa: push con `notification` → Android solo heads-up y no corre el handler FSI/Contestar.
  - Llamadas/videollamadas/invites/group video: solo FCM data-only; cliente muestra FSI + abre UI.
  - Wake: arranca FGS y reintenta `launchApp` (tablet desbloqueada degrada FSI a heads-up).
  - APK `TacticalPtx-1.8.160+170`. Requiere reinicio API.
- **Archivos / refs:** `calls.js`, `groupVideo.js`, `fcm.js`, `incoming_call_wake.dart`, `MainActivity.kt`
## 2026-09-18 — FGS presencia + llamada fullscreen + Estado multi-check + APK 1.8.159

- **Tipo:** feature | fix | ux
- **Área:** mobile | web
- **Qué:**
  - FGS envía `presenceHeartbeat(focus: service)` para que app cerrada quede Ausente (amarillo), no gris.
  - Llamada entrante (Galaxy Tab): FSI + `launchApp`/bring-to-front reforzados; Contestar a pantalla completa.
  - Consola Operadores → Estado: sin «Todos»; multi-check En línea / Ausente / Desconectados / Fuera de línea.
  - APK `TacticalPtx-1.8.159+169` en soporte.
- **Archivos / refs:** `background_radio.dart`, `incoming_call_wake.dart`, `MainActivity.kt`, `push_service.dart`, `DispatchMap.jsx`, `pubspec.yaml`

## 2026-09-18 — Ausente: onditas amarillas en el pin

- **Tipo:** ux | fix
- **Área:** web
- **Qué:** Anillos de pulso del marcador usan `--lt-wa-ring`; en estado Ausente son amarillos (`#eab308`), no verdes.
- **Archivos / refs:** `command-center.css`

## 2026-09-18 — Consola Operadores: orden Grupo → Estado

- **Tipo:** ux
- **Área:** web
- **Qué:** En pestaña Operadores, el multi-select Grupo queda antes del select Estado.
- **Archivos / refs:** `DispatchMap.jsx`

## 2026-09-18 — Presencia: Ausente (amarillo) + umbrales configurables

- **Tipo:** feature | ux
- **Área:** backend | web
- **Qué:**
  - Estado **Ausente** (amarillo): app minimizada/2º plano/cerrada (`background`/`service`) ≥ tiempo de ausencia (default 15 min). `awaySince` en Redis.
  - Config Presencia: **ausencia** y **fuera de línea** (0–10080). 0 ausencia = sin amarillo; 0 fuera de línea = rojo al desconectar.
  - Leyenda + filtro Operadores: Todos / En línea / Ausente / Desconectados / Fuera de línea.
  - Cadena: verde → amarillo → (desconecta) gris → rojo; foreground reinicia conteo.
- **Archivos / refs:** `032_presence_absence_minutes.sql`, `presence.js`, `locations.js`, `admin.js`, `presenceStatus.js`, `ConfigPresence.jsx`, `DispatchMap.jsx`, `PresenceMapLegend.jsx`

## 2026-09-18 — Wire keys por socket de despacho

- **Tipo:** security | fix
- **Área:** backend | web
- **Qué:**
  - La clave AES de wire ya no se reparte en login/`/me`/refresh (org-wide); solo `wireEnabled` a roles de despacho.
  - Mint de clave por socket en `dispatch:join` → `dispatch:joined.wireKey`; emisión GPS/geocerca/pánico sellada por socket.
  - Consola web: `applyDispatchJoinedWire` + clave en memoria (no localStorage). APK/PTT/Video sin cambios.
- **Por qué / notas:** Reduce exposición: operadores/APK dejan de recibir la clave de la org; cada consola tiene su propia clave de sesión socket.
- **Archivos / refs:** `wireCrypto.js` (backend/frontend), `socket/dispatch.js`, `panic.js`, `auth.js`, `CommandCenter`/`DispatchMap`/`LiveTrackMap`/`DispatchPanicHost`, `App.jsx`

## 2026-09-18 — Cola seguridad: APK pinning + CSV/miembros + OTA/avatar

- **Tipo:** security | ops | ux
- **Área:** mobile | backend | frontend
- **Qué:**
  - APK **1.8.158+168** con pinning TLS LAN → `pulsanet_soporte\APK\` (sin OTA, sin emulador).
  - CSV usuarios y `POST .../groups/:id/members` → solo **admin/root**; UI CSV oculta a no-admin.
  - OTA: solo header/Bearer con `APP_UPDATE_SECRET` (sin JWT sesión ni `?key=`).
  - Avatares: eliminado `?token=` JWT legacy; quedan Bearer y `?atk=`.
- **Archivos / refs:** `Publish-ApkUpdate.ps1`, `admin.js`, `DispatchUsers.jsx`, `appUpdate.js`, `me.js`

## 2026-09-18 — Harden loopback API/Web + restore solo root


- **Tipo:** security | fix
- **Área:** backend | frontend | infra
- **Qué:**
  - API escucha en **127.0.0.1** en production/PUBLIC_DOMAIN (`LISTEN_HOST` override). Vite igual vía `start-web.cmd` (dev: `TPX_LISTEN_ALL=1`).
  - LiveKit media sigue en `0.0.0.0` (WebRTC 4G); signal sigue accesible vía Caddy `/rtc`.
  - Restore (named + upload): **solo root** + `confirm: RESTAURAR`; UI oculta restaurar a no-root.
  - Verificado: API/Web loopback; edge DuckDNS 200.
- **Archivos / refs:** `config.js`, `server.js`, `start-web.cmd`, `routes/backups.js`, `ConfigBackups.jsx`

## 2026-09-18 — Harden localhost: Postgres/Redis + firewall edge


- **Tipo:** security | infra
- **Área:** infra | database | ops
- **Qué:**
  - Postgres `listen_addresses=localhost` y Redis `bind 127.0.0.1` (ya no en `0.0.0.0`). Backup en `pulsanet_soporte\Respaldos\harden-localhost-*`.
  - Script idempotente `infra/Harden-Localhost.ps1`.
  - Firewall canónico: allow solo **80/443 + LiveKit media**; **block** 5432/6379; sin allow 4000/5173/7880 (van por Caddy). Dev: `TPX_FW_DEV=1`.
  - Verificado: API/edge/web 200; DB/Redis solo `127.0.0.1`.
- **Archivos / refs:** `Ensure-Firewall.ps1`, `Harden-Localhost.ps1`, postgresql.conf, redis.windows-service.conf

## 2026-09-18 — P1 seguridad: pinning TLS, versiones, CORS, restore, logs


- **Tipo:** security | fix | mejora | docs
- **Área:** mobile | backend | frontend | infra | docs
- **Qué:**
  - APK: `lan_tls.dart` solo acepta el cert embebido en LAN (`.77`); `network_security_config` sin cleartext ni IPs legacy `.66`/68.x.
  - Versiones package backend/frontend → **1.8.107**; OTA `android.json` → **1.8.158+168** (en disco).
  - CORS podado a localhost + `.77` + DuckDNS; docs/scripts clave `.66`→`.77`; Publish-ApkUpdate y Caddy SANs sin mesh.
  - Restore: API exige `confirm: "RESTAURAR"`; frontend lo envía.
  - `Clear-StackCache`: subdirs Logs + `caddy*.log` + APK.bak viejos.
  - **Nota:** cambios TLS móvil requieren **recompilar APK** para aplicar en dispositivos.
- **Archivos / refs:** `mobile/lib/lan_tls.dart`, `network_security_config.xml`, `routes/backups.js`, `frontend/src/api.js`, `Clear-StackCache.ps1`, `Caddyfile.edge.template`

## 2026-09-18 — P0 seguridad: production + unlock + UPnP edge


- **Tipo:** security | fix | infra
- **Área:** backend | infra
- **Qué:**
  - `NODE_ENV=production` + JWT_SECRET rotado (el anterior era el de ejemplo). `PUBLIC_DOMAIN` sin production ahora hace FATAL al arrancar.
  - Unlock: rate-limit (5/15 min) + `timingSafeEqual` en `security.js` / `intrusion.js`.
  - UPnP por defecto: **80/443 + LiveKit media** (7881/7882/3478); ya no abre 4000/5173/7880. Override: `TPX_UPNP_FULL=1`.
  - Verificado: health `env=production`, edge 200, UPnP edge aplicado a `.77`.
  - **Nota:** sesiones JWT anteriores quedan inválidas → volver a iniciar sesión.
- **Archivos / refs:** `backend/.env`, `backend/src/config.js`, `routes/security.js`, `services/intrusion.js`, `infra/Reinforce-UPnP.ps1`, `EXPOSE-UPNP.ps1`

## 2026-09-18 — Follow-up auditoría integridad (UPnP LAN + .env.example)


- **Tipo:** fix | security | docs
- **Área:** infra | docs
- **Qué:**
  - `EXPOSE-UPNP.ps1` deja de preferir mesh `68.x`; usa `Get-TpxPreferredLanIp` (Ethernet `.77`).
  - `.env.example`: `LIVEKIT_LAN_HOST`/claves `PUBLIC_*`/`DUCKDNS_*` documentadas con canónico `.77`.
- **Archivos / refs:** `infra/EXPOSE-UPNP.ps1`, `backend/.env.example`

## 2026-09-18 — Auditoría integridad/seguridad/logs + higiene


- **Tipo:** security | docs | ops
- **Área:** backend | infra | docs | ops
- **Qué:**
  - Auditoría completa (stack OK; riesgos: UPnP WAN amplio, unlock sin rate-limit, TLS LAN permisivo, NODE_ENV=development con DuckDNS, versiones fragmentadas, logs/cache incompletos).
  - Higiene: `.gitignore` para `uploads_pre_restore*` y dumps `_login.json`; borrados `infra/_login.json`; snapshot `uploads_pre_restore_*` movido a `pulsanet_soporte\Respaldos\`.
  - Canvas: `auditoria-tacticalptx.canvas.tsx`.
- **Archivos / refs:** `.gitignore`, `pulsanet_soporte\Respaldos\uploads_pre_restore_*`, canvas auditoría

## 2026-09-18 — IP LAN fija Ethernet 192.168.1.77


- **Tipo:** infra | ops
- **Área:** infra | ops
- **Qué:**
  - Script `infra/Set-StableLanIp.ps1`: fija Ethernet a **192.168.1.77/24**, gateway/DNS `192.168.1.254` (+ 8.8.8.8), alinea hosts hairpin y puede realinear UPnP/edge.
  - Canonico del proyecto (coincide con APK `SERVER_LAN_IP`). `LEVANTAR` avisa si DHCP dio otra IP.
  - Verificado: PrefixOrigin=Manual, dominio health 200 vía `.77`.
- **Archivos / refs:** `infra/Set-StableLanIp.ps1`, `LEVANTAR-TACTICALPTX.bat`

## 2026-09-18 — Fix dominio muerto: hosts apuntaba a .77


- **Tipo:** fix | infra
- **Área:** ops
- **Qué:**
  - `C:\Windows\System32\drivers\etc\hosts` tenía `192.168.1.77 pulsanet.duckdns.org` (IP vieja); el PC está en **.107** → el navegador no abría el dominio aunque Caddy/API estaban OK.
  - `Fix-DuckdnsHairpin.ps1` existía pero **no se llamaba**; ahora corre en `START-PUBLIC-EDGE`, `ENSURE-PUBLIC-EDGE` y `LEVANTAR :ensure_edge`.
  - `:ensure_edge` ya no dispara START dos veces si faltaba `PUBLIC_DOMAIN`.
- **Archivos / refs:** `infra/Fix-DuckdnsHairpin.ps1`, `infra/START-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.ps1`, `LEVANTAR-TACTICALPTX.bat`

## 2026-09-18 — Fix API en :7880 (PORT contaminado por LEVANTAR)


- **Tipo:** fix | infra
- **Área:** ops | backend
- **Qué:**
  - Causa del `AVISO: API :4000 no responde` + edge try `000`: `:port_busy` / `:free_port` en `LEVANTAR` usaban `set PORT=%puerto%` (p. ej. 7880 LiveKit); el supervisor heredaba esa variable y la API escuchaba en **7880** (choque con LiveKit) en vez de **4000**.
  - Renombrado a `CHK_PORT`; se limpia `PORT` antes del bootstrap; `start-api.cmd` fuerza `PORT=4000`.
  - Verificado: API HTTPS :4000 = 200; LOCAL edge (`--resolve` → .107) = 200. WAN desde LAN puede seguir en 000 (hairpin); validar en 4G.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`

## 2026-09-18 — Fix LEVANTAR: `"f"` / no entra a C:\pulsanet

- **Tipo:** fix | infra
- **Área:** ops
- **Qué:**
  - Causa: `.bat` con finales LF (Unix) + `if ...=="\"` rompía el parseo de CMD (`"f"`, `"ocal"`, fallaba `cd`).
  - `LEVANTAR` y `CREAR-O-ACTUALIZAR-BD` pasan a CRLF; ROOT se normaliza con `%ROOT:~0,-1%` (sin `=="\"`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `CREAR-O-ACTUALIZAR-BD.bat`

## 2026-09-18 — Fix supervisor LEVANTAR (sí arranca API/Web)

- **Tipo:** fix | infra
- **Área:** infra | ops
- **Qué:**
  - El supervisor anterior mataba API/Web al salir y fallaba con redirect/`node --watch`.
  - Ahora usa `start-api.cmd` / `start-web.cmd` **ocultos** (redirección a log), deja procesos vivos, libera mutex/huérfanos y abre el navegador al estar OK.
  - Verificado: API health + Web 200 + LiveKit en una sola ventana.
- **Archivos / refs:** `infra/Run-StackSupervisor.ps1`, `LEVANTAR-TACTICALPTX.bat`

## 2026-09-18 — LEVANTAR: 1 ventana + limpia cache + supervisor

- **Tipo:** infra | ops
- **Área:** infra | ops
- **Qué:**
  - `LEVANTAR-TACTICALPTX.bat` ya no abre CMD de API/Web/Watch: una sola consola.
  - Al arrancar borra logs viejos y caché Vite (`Clear-StackCache.ps1`).
  - `Run-StackSupervisor.ps1` gestiona API/Web ocultos, repara (npm/puertos/Redis/LiveKit/Edge) y autorearranca si caen.
  - `Watch-Stack.ps1` queda como wrapper compatible.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/Clear-StackCache.ps1`, `infra/Run-StackSupervisor.ps1`, `infra/Watch-Stack.ps1`

## 2026-09-17 — APK 1.8.158 (clusters GPS + pitido PTT)

- **Tipo:** ops
- **Área:** mobile
- **Qué:** Compilación APK **1.8.158+168** con clusters de ubicación y tonos PTT. Copia en `pulsanet_soporte\APK`. **Sin OTA.**
- **Archivos / refs:** `Publish-ApkUpdate.ps1`, `pubspec.yaml`

## 2026-09-17 — Clusters GPS + pitido PTT

- **Tipo:** feature | ux
- **Área:** mobile | web
- **Qué:**
  - Ubicaciones APK/web: si 2+ pines están cerca al zoom actual, se agrupan en círculo azul con número + anillos de pulso (estilo Google); toque acerca el mapa. Zoom alto o selección deja el pin individual.
  - PTT: tono suave al pulsar y al soltar (APK + web); evita doble pitido con el “canal libre” remoto.
- **Archivos / refs:** `gps_location_cluster.dart`, `gps_cluster_pin.dart`, `gps_track_screen.dart`, `clusterMapPoints.js`, `ClusteredLocationLayer.jsx`, `DispatchMap/LiveTrackMap/CommandCenter`, `message_tone.dart`, `appNotify.js`, `usePtt.js`

## 2026-09-17 — Presencia reforzada + menú Sonidos APK

- **Tipo:** mejora | ux
- **Área:** mobile | backend | web
- **Qué:**
  - Ping de presencia cada **15 s** (antes 30) en APK y web; refuerzo HTTP `/api/presence/heartbeat` con `foreground|background|service` (además del socket).
  - GPS FGS también refresca presencia cada 15 s mientras envía ubicación.
  - Menú **Sonidos** (⋮ y Configuraciones): mensajes, llamadas, videollamadas, zumbidos; misma fuente (`SoundPrefs`) para AudioPlayer y canales Android v4+sufijo (sin desfase al cambiar tono).
  - Timbre video vs voz respeta preferencia distinta; video hereda tono de llamada si nunca se eligió.
  - Versión código **1.8.157+167**. **Sin OTA.**
- **Archivos / refs:** `channel_session.dart`, `presence.js`, `routes/presence.js`, `usePtt.js`, `sound_prefs.dart`, `sound_settings_screen.dart`, `push_service.dart`, `call_ringtone.dart`, `app_overflow_menu.dart`, `radio_shell.dart`

## 2026-09-17 — OTA desactivada por defecto

- **Tipo:** ops
- **Área:** mobile | infra
- **Qué:**
  - Pedido: no lanzar OTA. Manifest `android.json` sin force; versionCode bajado para no empujar 1.8.156.
  - `Publish-ApkUpdate.ps1` solo deja APK en `pulsanet_soporte\APK`; OTA requiere `-Ota` explícito.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`

## 2026-09-17 — APK 1.8.156: GPS cabecera + lista en línea primero

- **Tipo:** ux
- **Área:** mobile
- **Qué:**
  - Cabecera GPS más clara: título, contador en línea, Canal/Unidad segmentado.
  - Ocultar lista con barra táctil (manija), no iconos confusos.
  - Lista y pines del mapa: en línea (verde) primero / encima.
  - APK **1.8.156+166**.
- **Archivos / refs:** `gps_track_screen.dart`

## 2026-09-17 — Revisión integridad: conexiones + seguridad

- **Tipo:** security | mejora | fix
- **Área:** mobile | backend | web
- **Qué:**
  - Stack OK: LAN/WAN health 200, UPnP 443, DuckDNS alineado, LiveKit/API/Caddy arriba.
  - TLS: DuckDNS ya no acepta cualquier cert (solo sistema LE); LAN sigue con cert interno.
  - LiveKit: URL LAN solo si Host es IP privada (no por XFF spoofeable).
  - Intrusión: `X-Forwarded-For` solo con `TRUST_PROXY`.
  - FCM: `visibility: private` (menos fuga en pantalla bloqueada).
  - APK: refresh + subida media con failover hairpin; acks `chat:delivered` / `dm:delivered`; sockets DM con port/secure + reconexión; refresh JWT si el socket falla por token.
  - Web: video multi dejaba de llamar endpoint muerto `/api/group-video/multi/start`.
  - APK **1.8.155+165**.
- **Pendiente (no bloquea operación):** multiparty invite en APK; ticks UI delivered vs read; socket único compartido; rate-limit unlock.
- **Archivos / refs:** `lan_tls.dart`, `livekit.js`, `intrusion.js`, `fcm.js`, `api_client.dart`, `channel_session.dart`, `direct_pane.dart`, `chat_inbox_screen.dart`, `useGroupVideo.js`

## 2026-09-17 — APK 1.8.154: HTTPS roto por connectionFactory IPv4

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Login 4G: `400 Client sent an HTTP request to an HTTPS server` / `Broken pipe`.
  - Causa: `HttpClient.connectionFactory` devolvía socket TCP crudo; con `https://` Dart **no** aplica TLS encima.
  - Se quitó el factory; se mantiene solo `badCertificateCallback` para LAN.
  - APK **1.8.154+164**.
- **Archivos / refs:** `lan_tls.dart`

## 2026-09-17 — APK 1.8.153: 4G ya no fuerza IP LAN .77

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Causa real del login en 4G: tras un timeout el failover **forzaba** `https://192.168.1.77` aunque el probe fallara → «Sin conexión» en datos.
  - LAN solo si el TCP a `.77:443` responde; si el override es IP privada inalcanzable, se limpia y vuelve DuckDNS.
  - Quitado el tip que empujaba a fijar `.77` a mano (rompe 4G).
  - Borde WAN verificado: UPnP 443 → `.77`, DuckDNS A=`189.152.246.140`, sin AAAA.
  - APK **1.8.153+163**.
- **Archivos / refs:** `duckdns_hairpin.dart`, `login_screen.dart`

## 2026-09-17 — APK 1.8.152: Radio DuckDNS:41260 + AAAA podrido

- **Tipo:** fix
- **Área:** mobile | backend | infra
- **Qué:**
  - Radio iba a `pulsanet.duckdns.org:41260` (conexión rechazada): `LIVEKIT_PUBLIC_URL` ganaba siempre y el APK no reescribía LiveKit a la LAN.
  - En Wi‑Fi la API/LiveKit/socket usan `https://192.168.1.77` y `wss://192.168.1.77`. En 4G sigue DuckDNS.
  - DuckDNS tenía AAAA muerto (`2806:108e:29:b023::d`); se limpia de verdad (`clear=true` + A IPv4). HTTP del APK solo IPv4.
  - APK **1.8.152+162**.
- **Archivos / refs:** `livekit.js`, `config.dart`, `duckdns_hairpin.dart`, `lan_tls.dart`, `channel_session.dart`, `Sync-PublicIp.ps1`

## 2026-09-17 — APK 1.8.151: Llamadas por Wi‑Fi → LAN .77

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Login OK; historial de llamadas iba a DuckDNS (sin hairpin) porque el probe LAN era de 400 ms.
  - Probe 1.5 s; si DuckDNS falla en Wi‑Fi, reintenta `https://192.168.1.77`.
  - APK **1.8.151+161**.
- **Archivos / refs:** `duckdns_hairpin.dart`, `api_client.dart`, `main.dart`

## 2026-09-17 — APK 1.8.150: icono azul + splash de apertura

- **Tipo:** ux
- **Área:** mobile
- **Qué:**
  - Icono del launcher y pantalla al abrir usan el emblema circular azul (visores neón).
  - Login sin cambios (`sicom.png` dorado).
  - APK **1.8.150+160** → `pulsanet_soporte\APK\TacticalPtx-1.8.150+160.apk`.
- **Archivos / refs:** `sicom_round.png`, `splash_logo.png`, `main.dart` splash, `ic_launcher`

## 2026-09-17 — APK 1.8.149: IP pública cambió + login ya no cuelga

- **Tipo:** fix | ops
- **Área:** infra | mobile
- **Qué:**
  - Telmex cambió la IP WAN a `189.175.14.181`; el 443 quedó cerrado (4G/Wi‑Fi timeout). UPnP + DuckDNS realineados; 443 abierto otra vez.
  - Se quitó el AAAA de DuckDNS y el bind a 4G (colgaban «Verificando…»).
  - Login: probe LAN 400 ms, timeout 8 s.
  - APK **1.8.149+159**.
- **Archivos / refs:** `Sync-PublicIp.ps1`, `duckdns_hairpin.dart`, `login_screen.dart`, `api_client.dart`

## 2026-09-17 — APK 1.8.148: Telmex aísla Wi‑Fi del cable → 4G forzado

- **Tipo:** fix
- **Área:** mobile | infra
- **Qué:**
  - Causa real Wi‑Fi: ONT **Huawei HG8145V5 (Telmex)** aísla SSID del Ethernet. El teléfono no llega a `192.168.1.77`; DuckDNS por Wi‑Fi no hace hairpin. Por eso el pie seguía en DuckDNS.
  - Si la LAN no responde, la app **usa datos 4G** aunque el Wi‑Fi siga activo (`bindProcessToNetwork`).
  - DuckDNS AAAA del PC (`2806:108e:29:b023::d`); Caddy IPv6 LAN OK.
  - APK **1.8.148+158** → `pulsanet_soporte\APK\TacticalPtx-1.8.148+158.apk`.
- **Archivos / refs:** `MainActivity.kt`, `api_network.dart`, `duckdns_hairpin.dart`, `Sync-PublicIp.ps1`, `START-PUBLIC-EDGE.ps1`

## 2026-09-17 — APK 1.8.147: causa real Wi‑Fi (NSC + API LAN directa)

- **Tipo:** fix
- **Área:** mobile | infra
- **Qué:**
  - Causa real: `network_security_config.xml` **no incluía `192.168.1.77`** ni el cert LAN actual → Android rechazaba TLS al PC en Wi‑Fi.
  - En Wi‑Fi la app ahora usa API **directa** `https://192.168.1.77` (ya no bypass TCP+SNI frágil). En 4G sigue DuckDNS.
  - Cert LAN sincronizado a `@raw/lan_cert`; perfil Ethernet Windows → Private.
  - APK **1.8.147+157** → `pulsanet_soporte\APK\TacticalPtx-1.8.147+157.apk`.
- **Archivos / refs:** `network_security_config.xml`, `lan_tls.dart`, `config.dart`, `duckdns_hairpin.dart`, `lan_cert.pem`

## 2026-09-17 — APK 1.8.146: Wi‑Fi cobre siempre prueba LAN .77

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - En Wi‑Fi del router (sin Deco) fallaba: Android a menudo no reporta `192.168.*` y la app creía estar en 4G → DuckDNS por IP pública (sin hairpin).
  - Ahora **siempre** prueba `192.168.1.77` / `SERVER_LAN_IP` antes de WAN (en 4G el probe falla al instante).
  - APK **1.8.146+156** → `pulsanet_soporte\APK\TacticalPtx-1.8.146+156.apk`.
- **Archivos / refs:** `duckdns_hairpin.dart`, `login_screen.dart`, `pubspec.yaml`

## 2026-09-17 — APK 1.8.145: Wi‑Fi sin hairpin NAT → LAN primero

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - 4G OK; Wi‑Fi fallaba: DuckDNS → IP pública sin hairpin NAT (colgaba) y el discovery no alcanzaba a probar `192.168.1.77`.
  - En Wi‑Fi se prueba **primero** la IP LAN del PC; el dominio público solo como respaldo.
  - Login ya no borra la IP LAN recordada (`forgetPrefs`).
  - APK **1.8.145+155** → `pulsanet_soporte\APK\TacticalPtx-1.8.145+155.apk`.
- **Archivos / refs:** `duckdns_hairpin.dart`, `login_screen.dart`, `main.dart`, `pubspec.yaml`

## 2026-09-17 — APK 1.8.144: TLS sistema en 4G (causa real del login)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Diagnóstico: WAN/DuckDNS **OK** desde Internet (puerto 443 abierto, `/api/auth/login` responde). El fallo era del APK, no del servidor.
  - `LanTls` ya no inyecta el cert LAN en el `SecurityContext` global (rompía trust LE en Android/4G).
  - En 4G: sin bypass LAN; login limpia prefs de hairpin antes de conectar.
  - APK **1.8.144+154** → `pulsanet_soporte\APK\TacticalPtx-1.8.144+154.apk`.
- **Archivos / refs:** `lan_tls.dart`, `duckdns_hairpin.dart`, `login_screen.dart`, `pubspec.yaml`

## 2026-09-17 — APK 1.8.143: splash lento + No route to host (hairpin)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Causa: bypass LAN (`192.168.1.77`) quedaba activo en 4G → `No route to host`; discovery barría /24 y congelaba el splash.
  - Hairpin solo en Wi‑Fi `192.168.*`; presupuesto ~2.5 s; sin barrido de subred; al fallo limpia bypass y reintenta WAN.
  - APK **1.8.143+153** + UPnP reforzado → `pulsanet_soporte\APK\TacticalPtx-1.8.143+153.apk`.
- **Archivos / refs:** `duckdns_hairpin.dart`, `lan_tls.dart`, `api_client.dart`, `main.dart`, `pubspec.yaml`

## 2026-09-17 — PC solo Ethernet + APK 1.8.142 (Wi‑Fi/4G teléfono)

- **Tipo:** fix | ops
- **Área:** infra | mobile | ops
- **Qué:**
  - Política fija: **PC sin Wi‑Fi** (Disabled); solo Ethernet `192.168.1.77`.
  - Preferencia LAN Ethernet-first en `Sync-PublicIp`, `start-services`, `LEVANTAR-TACTICALPTX.bat`.
  - UPnP ISP → `.77`; certs/CORS/hosts/LiveKit/edge alineados; health API/LAN/DuckDNS 200.
  - APK **1.8.142+152** con `SERVER_LAN_IP=192.168.1.77` (hairpin Wi‑Fi teléfono + 4G vía DuckDNS/UPnP).
- **Por qué / notas:** El intento con PC en Wi‑Fi Sala (`.65`) se descartó; la app en Wi‑Fi/4G no requiere Wi‑Fi en el host.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/Sync-PublicIp.ps1`, `duckdns_hairpin.dart`, `pulsanet_soporte\APK\TacticalPtx-1.8.142+152.apk`

## 2026-09-17 — Wi‑Fi APK: PC en Sala de Operaciones + APK 1.8.141

- **Tipo:** fix | ops
- **Área:** infra | mobile
- **Qué:**
  - PC conectado a Wi‑Fi **Sala de Operaciones** (`192.168.68.65`); stack/CORS/certs/hosts/LiveKit alineados a esa LAN.
  - UPnP Deco → `.65`; Ethernet `.77` se mantiene como respaldo WAN.
  - APK **1.8.141+151** con `SERVER_LAN_IP=192.168.68.65` (misma red que los teléfonos).
- **Archivos / refs:** `duckdns_hairpin.dart`, `Publish-ApkUpdate.ps1`, `pulsanet_soporte\APK\TacticalPtx-latest.apk`

## 2026-09-17 — APK: hairpin LAN + login retry (1.8.140)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Causa: teléfono en Wi‑Fi no alcanzaba DuckDNS (sin hairpin NAT) y el bypass no priorizaba `192.168.1.77` (PC en Ethernet).
  - `DuckDnsHairpin` prueba `SERVER_LAN_IP` / IPs conocidas (1.77, 68.60…) antes del barrido; login reintenta tras timeout/socket.
  - APK **1.8.140+150** con `SERVER_LAN_IP=192.168.1.77` → `pulsanet_soporte\APK\TacticalPtx-latest.apk`.
- **Archivos / refs:** `duckdns_hairpin.dart`, `api_client.dart`, `Publish-ApkUpdate.ps1`, `pubspec.yaml`

## 2026-09-17 — UPnP WAN + hosts + Flutter + APK 1.8.139

- **Tipo:** ops | infra
- **Área:** infra | mobile | ops
- **Qué:**
  - UPnP SOAP OK (80/443/… → `192.168.1.77`); hosts `pulsanet.duckdns.org` → LAN; edge WAN health 200; LE sin `tls internal` en dominio.
  - Flutter 3.47.4 en `C:\tools\flutter`, JDK 17 Microsoft, cmdline-tools Android; APK release publicado.
  - Artefacto: `C:\pulsanet_soporte\APK\TacticalPtx-1.8.139+149.apk` (+ `TacticalPtx-latest.apk`) y OTA en `backend\app-updates`.
- **Por qué / notas:** Wi‑Fi 68.x ausente; LAN activa Ethernet `.77`. Integridad OK.
- **Archivos / refs:** `infra/Reinforce-UPnP.ps1`, `infra/Caddyfile.edge.template`, `mobile/scripts/Publish-ApkUpdate.ps1`

## 2026-09-17 — Stack integral: LEVANTAR + Watch-Stack + integridad local

- **Tipo:** ops | fix
- **Área:** infra | ops
- **Qué:**
  - `LEVANTAR-TACTICALPTX.bat` completo (PG/Redis/LiveKit/API/Web/Watch-Stack/Edge); LAN detecta primero `192.168.68.x`.
  - `check-integrity.ps1`: edge LOCAL OK vs WAN (warn UPnP); `Fix-DuckdnsHairpin.ps1` apunta a IP LAN preferida.
  - Integridad OK; servicios UP (API/Web/Caddy/LiveKit/Redis/Watch-Stack). WAN 4G sigue sin port-forward.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/check-integrity.ps1`, `infra/Fix-DuckdnsHairpin.ps1`

## 2026-09-17 — Alinear host dual-NIC (Wi‑Fi 68.60) + borde local

- **Tipo:** ops | infra
- **Área:** infra | ops
- **Qué:**
  - Certs LAN regenerados (SAN: 192.168.68.60 + 192.168.1.77); CORS/LIVEKIT_LAN_HOST/PUBLIC_LAN_IP alineados a Wi‑Fi preferida.
  - `start-services.ps1` ya no toma Ethernet primero; prefiere mesh `192.168.68.x`.
  - Caddy: `tls internal` en dominio (LE bloqueado sin port-forward); LAN block incluye .60 y .77; hosts hairpin → 192.168.68.60.
  - Integridad OK (API/Web/edge LAN/duckdns local/LiveKit).
- **Por qué / notas:** UPnP 80/443 sigue fallando en el router Deco/Ethernet — 4G requiere forward manual.
- **Archivos / refs:** `infra/start-services.ps1`, `infra/Caddyfile.edge.template`, `infra/certs/lan-*.pem`, `backend/.env`

## 2026-09-17 — Host: Redis/Git + PG alineado + stack UP + restore

- **Tipo:** ops | infra
- **Área:** infra | database | ops
- **Qué:**
  - Instalados Redis (Windows 3.0.504) y Git 2.55; password `postgres` alineado con `backend\.env`.
  - Creada/migrada `tacticalptx_db`; restaurado `tacticalptx_20260917_091600.zip` (25 usuarios, 3 grupos + uploads).
  - Stack local UP (PG/Redis/LiveKit/API/Web/Watch-Stack); borde Caddy local OK; UPnP 80/443 falló (abrir en router → LAN).
- **Archivos / refs:** `CREAR-O-ACTUALIZAR-BD.bat`, `LEVANTAR-TACTICALPTX.bat`, `infra\ENSURE-PUBLIC-EDGE.cmd`

## 2026-09-17 — Mic PTT: un solo cliente activo (admin multi-sesión)

- **Tipo:** fix | feature
- **Área:** backend | web | mobile
- **Qué:**
  - Admin/root pueden seguir en varias apps; el floor PTT guarda `socketId`.
  - Si el mismo usuario pulsa PTT en otro cliente, se mueve el mic (`selfMove`) y el anterior recibe `ptt:taken` (libera mic + audio normal).
  - Soltar/desconectar en un cliente no quita el floor si otro socket del mismo user lo tiene.
- **Archivos / refs:** `presence.js` (`tryAcquireFloor`/`clearFloor`), `ptt.js`, `usePtt.js`, `channel_session.dart`

## 2026-09-17 — PTT TOCAR redondo (barra superior)

- **Tipo:** ux
- **Área:** web
- **Qué:** El botón PTT de la barra (PTT / TOCAR) pasa de pastilla ovalada a círculo.
- **Archivos / refs:** `institutional.css` (`.cc-ptt-mini`)

## 2026-09-17 — PTT flotante azul en tema Obscuro

- **Tipo:** ux
- **Área:** web
- **Qué:** El botón PTT flotante del mapa maximizado usa degradé azul (`#3b82f6`) en Obscuro; en Verde/Claro sigue oliva. Al hablar (holding) sigue rojo.
- **Archivos / refs:** `command-center.css` (`.lt-ptt-float-btn`)

## 2026-09-17 — Rail: quitar nombre de usuario duplicado

- **Tipo:** ux
- **Área:** web
- **Qué:** Se quitó el displayName del pie del menú lateral; ya aparece en la barra superior.
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-09-17 — APK 1.8.139+149 (release limpio post-analyze)

- **Tipo:** release
- **Área:** mobile
- **Qué:**
  - Versión mobile `1.8.139+149`; `flutter analyze` sin errores (solo infos/warnings no bloqueantes).
  - Publicada con `Publish-ApkUpdate.ps1` (exit 0); alias SICOM + TacticalPtx + latest en soporte.
  - Regenerado Word sencillo `FORMATO_CAMBIOS_16_09_2026.docx` (Desktop + soporte).
- **Archivos / refs:** `mobile/pubspec.yaml`, `C:\pulsanet_soporte\APK\SICOM-1.8.139+149.apk`, `TacticalPtx-1.8.139+149.apk`, `SICOM-latest.apk`, `TacticalPtx-latest.apk`

## 2026-09-17 — FORMATO_CAMBIOS_16_09_2026.docx (lenguaje sencillo)

- **Tipo:** docs
- **Área:** docs
- **Qué:** Mismo Word del 16/09 reescrito en lenguaje claro (sin jerga técnica) para cualquier lector.
- **Archivos / refs:** Desktop + `pulsanet_soporte\Documentos\FORMATO_CAMBIOS_16_09_2026.docx`

## 2026-09-17 — FORMATO_CAMBIOS_16_09_2026.docx (ayer+hoy)

- **Tipo:** docs
- **Área:** docs
- **Qué:** Word institucional fecha 16/09/2026 con cambios del 16 y 17 (PTT, Canal abierto, tema Obscuro, mapa, APK 1.8.138, etc.).
- **Archivos / refs:** Desktop + pulsanet_soporte\Documentos\FORMATO_CAMBIOS_16_09_2026.docx

## 2026-09-17 — APK 1.8.138+148 (Canal abierto PTT 60s + chips Chats + geocerca)

- **Tipo:** release
- **Área:** mobile
- **Qué:** Release con Canal abierto (PTT→último 60 s), chips Chats como Llamadas, fix geocerca desmarcar, jerarquía PTT, soft-fail borde, LiveKit ICE y alerta pánico. Alias SICOM y TacticalPtx en `C:\pulsanet_soporte\APK\`.
- **Archivos / refs:** `C:\pulsanet_soporte\APK\SICOM-1.8.138+148.apk`, `TacticalPtx-1.8.138+148.apk`, `SICOM-latest.apk`, `TacticalPtx-latest.apk`

## 2026-09-17 — Fix geocerca: desmarcar no se re-marca al reabrir

- **Tipo:** fix
- **Área:** web
- **Qué:** El poll de `fetchGeofences` trataba selección vacía como «sin init» y volvía a marcar todas. Ahora solo la 1.ª carga marca todas; desmarcar se respeta.
- **Archivos / refs:** `DispatchMap.jsx`
## 2026-09-17 — Canal abierto PTT→último (60s) + chips Chats como Llamadas

- **Tipo:** feature | ux
- **Área:** mobile
- **Qué:**
  - Canal abierto: PTT va al último hablante remoto; caduca a 60 s y vuelve al canal home; línea fija `PTT → Grupo`; chip Último informativo (toca renueva ventana); no usa tu propia TX como destino.
  - Chats: chip seleccionado verde + letras blancas; no seleccionado fondo claro + letras negras; fantasma de arrastre = pill (sin cuadrote blanco).
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`, `chat_inbox_screen.dart`
## 2026-09-17 — LiveKit ICE restaurado (web+APK mic) + APK 1.8.137

- **Tipo:** fix | infra | release
- **Área:** infra | web | mobile
- **Qué:**
  - Causa del «Error de audio» / MediaConnectException: LiveKit UDP 7882 estaba en IP muerta `192.168.68.55`; Ethernet activa es `.51`.
  - Reinicio LiveKit `--bind 0.0.0.0 --node-ip` pública; UDP ahora en `.51:7882`. `LIVEKIT_LAN_HOST=.51`.
  - Web `usePtt`: conecta Hablar+Escuchar (antes solo Hablar y cortaba Oír). Texto «Error de audio» en `#FF0000`.
  - APK 1.8.137+147 (analyzer limpio) sobre la base 1.8.136 (Canal abierto ICE-first + Alerta `#FF0000`).
- **Por qué / notas:** UPnP Deco falló (500) en mapeo 7882; en LAN el ICE interno basta. 4G puede necesitar reenvío manual UDP 7882/TCP 7881/3478 → `.51`.
- **Archivos / refs:** `livekit.dev.yaml`, `Sync-PublicIp.ps1`, `usePtt.js`, `institutional.css`, `C:\pulsanet_soporte\APK\SICOM-1.8.137+147.apk`

## 2026-09-17 — Selects Sitios/Ruta = mismo color que Operadores

- **Tipo:** ux | fix
- **Área:** web
- **Qué:**
  - Los multi-select (Sitios/Ruta/Geocerca) alineados al fondo de los selects de Operadores en Verde/Obscuro.
- **Archivos / refs:** `theme-contrast.css`, `command-center.css`

## 2026-09-17 — APK 1.8.136+146 (Alerta #FF0000 + LiveKit Canal abierto)

- **Tipo:** fix | release | ux
- **Área:** mobile
- **Qué:**
  - Alerta círculo `#FF0000`, icono amarillo, texto blanco.
  - Canal abierto: PTT primero + reintento ICE; listens en background; mensaje amigable si falla red.
- **Archivos / refs:** `radio_screen.dart`, `channel_session.dart`, `C:\pulsanet_soporte\APK\SICOM-1.8.136+146.apk`
## 2026-09-17 â€” APK 1.8.135+145 (Calls history HTML 404 soft-fail)

- **Tipo:** fix | release
- **Ãrea:** mobile | infra
- **QuÃ©:**
  - Causa: no faltaba la ruta â€” `GET /api/calls/history` ya existe en `calls.js` y Caddy `/api*` â†’ Node. Probe local/DuckDNS/LAN `.51` = JSON 401.
  - Caddy en vivo no tenÃ­a host LAN `.51` (solo `.57`/`.58`); reload del `Caddyfile.edge.active` + comentario anti-SPA en template/active.
  - Llamadas: soft-fail si el borde devuelve HTML (404/502) â†’ lista vacÃ­a sin Exception roja; auth (401/token) sigue visible.
  - Inbox DM: mismo criterio HTML vs auth.
- **Archivos / refs:** `call_history_pane.dart`, `api_client.dart`, `chat_inbox_screen.dart`, `Caddyfile.edge.active`, `Caddyfile.edge.template`, `C:\pulsanet_soporte\APK\SICOM-1.8.135+145.apk`

## 2026-09-17 â€” APK 1.8.134+144 (PTT jerarquÃ­a, Canal abierto, socket :0, DM)

- **Tipo:** feature | fix | release
- **Ãrea:** mobile | web | backend
- **QuÃ©:**
  - Socket URL nunca usa puerto `:0` (default 443/80; `OptionBuilder` fuerza puerto vÃ¡lido).
  - Inbox DM: no tumba la app si `/api/dm/conversations` falla; mensaje claro si Caddy devuelve HTML.
  - PTT: operadores hold-to-talk; root/admin/zona/unidad latch; `ptt:taken` corta mic + aviso; denied con nombre.
  - Tras PTT: `acquireRadio` + `NativeAudioMode.ensureNormal` (no deja MODE_IN_COMMUNICATION).
  - Canal abierto (â‰¥2 grupos): escucha todos, PTT en un talk; chip Â«Ãšltimo: grupo â€” quiÃ©nÂ».
  - Alerta: cÃ­rculo rojo sÃ³lido, icono/ondas amarillos, texto blanco.
  - Web alineada (hold/latch + `ptt:taken`). Radio API/socket/LiveKit verificados OK.
- **Archivos / refs:** `config.dart`, `lan_tls.dart`, `channel_session.dart`, `radio_screen.dart`, `radio_shell.dart`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `C:\pulsanet_soporte\APK\SICOM-1.8.134+144.apk`

## 2026-09-17 â€” Obscuro: parpadeo Â«en vivoÂ» en verde (no azul)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - En tema Obscuro, `--cc-live` pasaba a azul (`#3b82f6`) y teÃ±Ã­a anillos/parpadeo de avatar conectado.
  - Ahora `--cc-live` = `#22c55e` (mismo verde que `--cc-ok` / usuario conectado). `--cc-accent` sigue azul para UI.
- **Por quÃ© / notas:** Mobile ya usaba verde fijo en pins (`#1F5A2E`); no habÃ­a tema obscuro compartido que corregir.
- **Archivos / refs:** `command-center.css`, `institutional.css`

## 2026-09-17 â€” Fix cursor move al pan del mapa (body.leaflet-dragging)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Idle sobre mapa: flecha (`default`).
  - Al pan/drag: cursor move (4 flechas) â€” selector corregido.
- **Por quÃ© / notas:** Leaflet 1.x pone `.leaflet-dragging` en `document.body`, no en `.leaflet-container`. Los selectores `.leaflet-container.tp-map-cursor.leaflet-dragging` nunca coincidÃ­an; el `default !important` ganaba siempre.
- **Archivos / refs:** `command-center.css` (`body.leaflet-dragging .leaflet-container.tp-map-cursorâ€¦`)

## 2026-09-17 â€” Mapa web: cursor flecha en hover, move al pan

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Sobre el mapa: cursor flecha (`default`), no grab/move en reposo.
  - Al arrastrar/pan: se mantiene el cursor move (4 flechas).
- **Por quÃ© / notas:** `.tp-map-cursor` forzaba `move` siempre; ahora solo con `.leaflet-dragging`.
- **Archivos / refs:** `command-center.css`, `mapLeafletUtils.jsx` (`MapCursorFix`)

## 2026-09-17 â€” APK 1.8.133+143 (Llamadas Perdida/Recibida + colores)

- **Tipo:** ux | release
- **Ãrea:** mobile
- **QuÃ©:**
  - En historial: sin Â«EntranteÂ»; texto **Perdida** / **Recibida Â· duraciÃ³n**; iconos telÃ©fono/video en rojo o verde.
  - Nombre del contacto sigue en color normal (`kInstInk`).
  - Incluye fixes previos (TLS hairpin, Alerta cÃ­rculo rojo, chip enlace).
- **Archivos / refs:** `call_history_pane.dart`, `C:\pulsanet_soporte\APK\SICOM-1.8.133+143.apk`

## 2026-09-17 â€” APK 1.8.132+142 (SIN RED falso + Alerta cÃ­rculo + LiveKit LAN)

- **Tipo:** fix | release | ux
- **Ãrea:** mobile
- **QuÃ©:**
  - Chip Â«SIN REDÂ» solo si no hay socket; si LiveKit aÃºn conecta â†’ Â«AUDIOâ€¦Â» (dorado).
  - Hairpin exige HTTPS directo a la IP (tls internal) ademÃ¡s de SNI DuckDNS â€” evita `.51` que rompe `wss://IP` LiveKit; elige p.ej. `.57`.
  - Alerta con cÃ­rculo rojo estilo Silenciar.
- **Archivos / refs:** `radio_screen.dart`, `duckdns_hairpin.dart`, `C:\pulsanet_soporte\APK\SICOM-1.8.132+142.apk`

## 2026-09-17 â€” Radio APK: Alerta con cÃ­rculo rojo (como Silenciar)

- **Tipo:** ux
- **Ãrea:** mobile
- **QuÃ©:** BotÃ³n Alerta recupera cÃ­rculo del mismo tamaÃ±o/estilo que Silenciar, en rojo (`kRadioDanger`); icono âš  y ondas en tonos rojos.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart` (`_PanicButton`)

## 2026-09-17 â€” APK 1.8.131+141 (TLS real en hairpin)

- **Tipo:** fix | release
- **Ãrea:** mobile
- **QuÃ©:**
  - Causa del 400 en contactos: `connectionFactory` devolvÃ­a Socket en claro a :443; Dart no aplica TLS solo en ese caso.
  - Ahora hairpin hace TCPâ†’IP LAN + `SecureSocket.secure` (SNI DuckDNS).
  - APK `1.8.131+141`, OTA `force: false`.
- **Archivos / refs:** `lan_tls.dart`, `C:\pulsanet_soporte\APK\SICOM-1.8.131+141.apk`

## 2026-09-17 â€” APK 1.8.130+140 (fix Respuesta invÃ¡lida 400)

- **Tipo:** release | fix
- **Ãrea:** mobile
- **QuÃ©:** Sideload con hairpin endurecido + retry ante 400 no-JSON post-login. `force: false` en OTA (no empujar flota).
- **Archivos / refs:** `C:\pulsanet_soporte\APK\SICOM-1.8.130+140.apk`, `SICOM-latest.apk`, `TacticalPtx-1.8.130+140.apk`

## 2026-09-17 â€” Fix Â«Respuesta invÃ¡lida (400)Â» post-login (hairpin)

- **Tipo:** fix
- **Ãrea:** mobile | infra
- **QuÃ©:**
  - Probe hairpin exige `tacticalptx-api` (evita IoT/routers con HTTP 200 falso).
  - API client: GET sin `Content-Type`; si el body no es JSON 4xx, redescubre hairpin y reintenta; el error muestra ruta + preview del body.
  - Caddy LAN incluye `.51`/`.57`/`.58`; `run-edge` con `PUBLIC_LAN_IP=192.168.68.51`.
  - Root `atacticalptxr2` sin `must_change_password` (entrada directa a radio).
- **Por quÃ© / notas:** Login OK por bypass LAN; luego un 400 no-JSON tumba el home. WAN DuckDNS sigue sin hairpin en el router.
- **Archivos / refs:** `duckdns_hairpin.dart`, `api_client.dart`, `Caddyfile.edge.*`, `run-edge.cmd`

## 2026-09-17 â€” APK: DuckDNS automÃ¡tico (bypass hairpin sin IP fija)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - La app sigue en `pulsanet.duckdns.org`. Si desde WiFi la IP pÃºblica no responde, descubre la IP LAN del servidor y redirige el TCP manteniendo SNI/Host del dominio (cert LE).
  - No pide override manual ni asigna IPs fijas en el PC.
  - APK `1.8.129+139`.
- **Archivos / refs:** `duckdns_hairpin.dart`, `lan_tls.dart`, `config.dart`, `main.dart`, `login_screen.dart`

## 2026-09-17 â€” APK: timeout WiFi = hairpin DuckDNS (usar LAN .58)

- **Tipo:** fix | docs
- **Ãrea:** mobile | infra
- **QuÃ©:**
  - En la misma WiFi, `pulsanet.duckdns.org` â†’ IP WAN y el router no hace hairpin (TCP 443 cuelga ~15 s).
  - APK confÃ­a cert Caddy en `192.168.68.58`/`.57`; mensaje de timeout indica Servidor LAN.
  - APK `1.8.127+137`.
- **Por quÃ© / notas:** En login â†’ Â«ServidorÂ» â†’ `https://192.168.68.58`. Fuera de casa: DuckDNS por 4G.
- **Archivos / refs:** `network_security_config.xml`, `es_msg.dart`, `pubspec.yaml`

## 2026-09-17 â€” Llamadas APK: Recibidas + iconos video + duraciÃ³n

- **Tipo:** ux | mejora
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Filtros Todas â†’ Recibidas â†’ Perdidas.
  - Videollamada recibida/perdida usa icono de video (no telÃ©fono); botÃ³n de acciÃ³n tambiÃ©n.
  - En recibidas/contestadas se muestra duraciÃ³n (`m:ss`).
  - APK `1.8.126+136` en `pulsanet_soporte\APK\`.
- **Archivos / refs:** `call_history_pane.dart`, `api_client.dart`, `backend/src/services/dm.js`, `routes/calls.js`

## 2026-09-17 â€” Multi-select mapa: layout PV (cabezal compacto + alto al contenido)

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Ruta/Grupo/Geocerca alineados a Parque Vehicular: acciones Â· meta Â· bÃºsqueda en filas compactas; tipografÃ­a 9â€“10px.
  - Alto del panel se ajusta al contenido (`fitMsPanelHeight`); `resize: vertical` (no both); scroll solo si hace falta.
- **Archivos / refs:** `fitMsPanelHeight.js`, `RouteTrackPicker.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-17 â€” Mapa: selects sin empalme (Ruta/Grupo/Sitios/Geocerca)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Solo un panel multi-select abierto a la vez (`exclusiveMsPanel`).
  - Ancho del desplegable no invade el hermano (p. ej. Ruta no tapa Horas).
  - Abrir select nativo (Horas / Operadores) cierra el panel portal.
- **Archivos / refs:** `frontend/src/dispatch/exclusiveMsPanel.js`, `RouteTrackPicker.jsx`, `DispatchMap.jsx`, `useTacticalSites.jsx`, `command-center.css`

## 2026-09-17 â€” Chats Contactos/chips + Radio Alerta (web/APK)

- **Tipo:** feature | ux
- **Ãrea:** web | mobile | backend
- **QuÃ©:**
  - Chips ContactosÂ·GruposÂ·No leÃ­dosÂ·Favoritos reordenables (persistencia por usuario); sin toggle Llamadas arriba en APK.
  - Contactos: miembros de grupos (+ yo), orden en lÃ­nea â†’ grado militar â†’ Ãºltimo mensaje; Grupos/No leÃ­dos/Favoritos por Ãºltimo mensaje.
  - API contactos: grado, online, auto-DM permitido.
  - Radio APK: botÃ³n Alerta (âš  amarillo + ondas, sin cÃ­rculo rojo); Silenciar circular mismo tamaÃ±o.
- **Archivos / refs:** `backend/src/services/dm.js`, `routes/dm.js`, `ChatInbox.jsx`, `inboxTabOrder.js`, `chat_inbox_screen.dart`, `inbox_tab_order.dart`, `radio_screen.dart`

## 2026-09-17 â€” Rutas: panel multi-select estilo PV (buscar/ordenar/estirar)

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Panel Â«RutaÂ» con Ascendente/Descendente, Marcar/Desmarcar, bÃºsqueda y contador (como filtros Parque Vehicular / Grupo).
  - Esquina inferior derecha con `resize: both` para estirar el desplegable; lista con scroll interno.
- **Archivos / refs:** `frontend/src/dispatch/RouteTrackPicker.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-17 â€” Rail: quitar kicker Â«OperaciÃ³nÂ»

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Eliminada la etiqueta `cc-mod-rail-kicker` (Â«OperaciÃ³nÂ») del encabezado del menÃº lateral; queda solo Â«MÃ³dulosÂ».
- **Archivos / refs:** `frontend/src/dispatch/DispatchLayout.jsx`, `frontend/src/institutional.css`

## 2026-09-17 â€” Tema: selector en rail (arriba de Salir)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Quitado el chip CLARO/Verde/Obscuro de la topbar del despacho.
  - Mismo control en pie del rail (formato Salir) y en menÃº Â«MÃ¡sÂ» mÃ³vil, arriba de Salir.
- **Archivos / refs:** `frontend/src/theme.jsx`, `frontend/src/dispatch/DispatchLayout.jsx`, `frontend/src/institutional.css`

## 2026-09-17 â€” DuckDNS HTTPS: offload NIC (LSO/checksum)

- **Tipo:** fix | ops
- **Ãrea:** infra
- **QuÃ©:**
  - HTTP :80 pÃºblico OK; HTTPS :443 hacÃ­a handshake TLS y luego colgaba (0 bytes) vÃ­a Deco WAN / 4G.
  - Causa: Large Send Offload + checksum offload en el NIC del PC rompÃ­an el camino doble-NAT.
  - Desactivados LSO/Checksum/RSC y MTU 1400; health externo check-host **200** (CA/ES/IT/SG/TR).
  - Script persistente `infra/Fix-WanTlsOffload.ps1` enganchado a START/ENSURE-PUBLIC-EDGE.
- **Por quÃ© / notas:** APK 4G puede volver a `https://pulsanet.duckdns.org` sin ngrok.
- **Archivos / refs:** `infra/Fix-WanTlsOffload.ps1`, `infra/START-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.ps1`

## 2026-09-16 â€” IP API alineada a 192.168.68.58 (Deco OK)

- **Tipo:** ops | fix
- **Ãrea:** infra
- **QuÃ©:**
  - Ethernet ya no es `.55` (caÃ­da); IP viva y la que mapea el Deco: **192.168.68.58**. Wi-Fi extra: `.57`.
  - Caddy/`PUBLIC_LAN_IP` seguÃ­an en `.55` â†’ HTTPS :443 en `.58` fallaba (HTTP :80 sÃ­). API `:4000` en `.58` = 200.
  - Alineados `.env` (`PUBLIC_LAN_IP`, `LIVEKIT_LAN_HOST`), `run-edge.cmd`, `Get-TpxPreferredLanIp` y Caddy LAN a `.58`/`.57`.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `infra/caddy/run-edge.cmd`, `backend/.env`

## 2026-09-16 â€” DMZ Infinitum â†’ Deco (abre 4G)

- **Tipo:** ops | infra
- **Ãrea:** infra
- **QuÃ©:**
  - En mÃ³dem HG8145V5V3: DMZ **Habilitado** host `192.168.1.240` (`decoMeshX55`).
  - Tras DMZ, TCP **443 WAN** responde desde nodos externos (check-host).
  - App 4G: volver a `https://pulsanet.duckdns.org` (probar en datos mÃ³viles).
- **Archivos / refs:** mÃ³dem `192.168.1.254` â†’ Reglas de desvÃ­o â†’ DMZ

## 2026-09-16 â€” Deco OK pero 4G bloqueado en mÃ³dem Telmex

- **Tipo:** ops | infra
- **Ãrea:** infra
- **QuÃ©:**
  - Deco web: WAN `192.168.1.240` â†’ gateway Infinitum `192.168.1.254` (doble NAT; ExternalIP UPnP vacÃ­o).
  - UI web Deco no expone Port Forward (solo Network Map / Advanced Status-System).
  - PC API alineada a `192.168.68.58` (coincide con UPnP Deco). Health local 200.
  - Workaround 4G activo: ngrok `https://tremor-turf-conform.ngrok-free.dev` â†’ API :4000 (health 200).
  - Pendiente: login mÃ³dem HG8145V5V3 y DMZ/Virtual Server TCP 80+443 â†’ `192.168.1.240`.
- **Archivos / refs:** diagnÃ³stico Deco Status; `infra/Fix-DuckdnsHairpin.ps1`

## 2026-09-16 â€” App: IP API real 192.168.68.55 (Deco mapea .58)

- **Tipo:** ops | fix
- **Ãrea:** infra | mobile
- **QuÃ©:**
  - Caddy/API se cayeron al reciclar el edge; API+Web+LiveKit relanzados.
  - IP Ethernet actual: `192.168.68.55`. Health API `https://192.168.68.55:4000/api/health` = 200.
  - El Deco puede verse â€œOKâ€ porque UPnP sigue a `192.168.68.58` (IP que ya no estÃ¡). Sin tocar Deco, la app en WiFi debe usar `https://192.168.68.55:4000`.
  - LAN preferida en scripts ahora prioriza `.58` si existe; `.env` LIVEKIT/PUBLIC_LAN alineados a `.55`.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `infra/caddy/run-edge.cmd`, `backend/.env`

## 2026-09-16 â€” App mÃ³vil: URL LAN (DuckDNS no llega al telÃ©fono)

- **Tipo:** ops
- **Ãrea:** infra | mobile
- **QuÃ©:**
  - Web en esta PC usa hosts â†’ DuckDNS local. La APK resuelve DuckDNS a la IP pÃºblica (443 WAN cerrado).
  - En la misma WiFi: URL del servidor `https://192.168.68.55`. Caddy LAN en esa IP (health 200).
  - Plantilla Caddy: sitio LAN tambiÃ©n en `192.168.68.58` (alias UPnP).
- **Archivos / refs:** `infra/Caddyfile.edge.template`

## 2026-09-16 â€” Hairpin local para pulsanet.duckdns.org

- **Tipo:** ops | infra
- **Ãrea:** infra
- **QuÃ©:**
  - `https://pulsanet.duckdns.org` fallaba en esta PC por hairpin NAT (DNS â†’ IP pÃºblica `189.152.201.59`, TCP 443 WAN cerrado).
  - Hosts: `127.0.0.1 pulsanet.duckdns.org` + alias Ethernet `192.168.68.58` (UPnP Deco apuntaba a esa IP vieja).
  - En esta mÃ¡quina health/despacho del dominio ya responden 200. WAN/4G sigue cerrado (doble NAT Telmex).
- **Archivos / refs:** `infra/Fix-DuckdnsHairpin.ps1`

## 2026-09-16 â€” Login Obscuro: Tactical 3 + acentos azules

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Tema Obscuro: marca/splash del login (y cambio de clave) usa Tactical 3 en lugar de `sicom.png`.
  - Acentos del panel de login (hero glow/grid/velo, borde, barra superior de la card, focus) en paleta PV azul; se quita el verde del gradiente de la card.
  - Claro y Verde sin cambios; favicon Obscuro (Tactical 4) intacto.
- **Archivos / refs:** `Tactical 3.png` â†’ `frontend/public/brand/tactical_login_obscuro.png`; `App.jsx`, `institutional.css`

## 2026-09-16 â€” Fix PostCSS: `}` huÃ©rfano en command-center.css

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Tras `.cc-geofence-ms-row .cc-btn-sm` habÃ­a `opacity`/`cursor`/`}` sin selector â†’ Vite overlay `[postcss] Unexpected }`.
  - Restaurado como `.cc-geofence-ms-row .cc-btn-sm:disabled { â€¦ }`.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-16 â€” Ops: servicio caÃ­do (edge pÃºblico)

- **Tipo:** ops
- **Ãrea:** infra
- **QuÃ©:**
  - Stack local estaba UP (API :4000, Web :5173, PG :5432, Redis :6379, LiveKit :7880, Caddy :80/:443); health API `ok/ready`.
  - Causa externa: DuckDNS desfasado (`189.152.160.81` vs IP real `189.152.201.59`) + UPnP sin mapear por **doble NAT** (Deco `192.168.68.1` detrÃ¡s de modem `192.168.1.254`; ExternalIP UPnP vacÃ­o).
  - Fix: `Get-TpxEnvValue` ahora lee `infra\secrets\stable-domain.env`; DuckDNS actualizado; `START-PUBLIC-EDGE` / edge LAN OK.
  - Pendiente router: reenvÃ­o TCP 80/443 en el modem (`192.168.1.254`) hacia `192.168.68.66` (o DMZ) para APK/web por 4G.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `infra/START-PUBLIC-EDGE.ps1`, DuckDNS `pulsanet.duckdns.org`
## 2026-09-16 â€” Consola: KPIs a la izquierda del radio mini

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Los 5 chips KPI (Al aire / Canales / Con GPS / Geocercas / Alertas) pasan a la **izquierda** de la misma fila que el radio mini (`cc-radio-strip`).
  - Se quita el encabezado Â«Consola de OperacionesÂ» + subtÃ­tulo (redundantes con el rail y los chips).
- **Archivos / refs:** `DispatchMap.jsx`, `DispatchLayout.jsx`, `command-center.css`

## 2026-09-16 â€” Favicon Obscuro: Tactical 4

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Tema Obscuro (`data-theme="obscuro"`): favicon y apple-touch-icon (round) usan Tactical 4.
  - Claro/Verde conservan `sicom_round.png`.
  - Cambio al ciclar tema + script temprano en `index.html`; Â«al aireÂ» no pisa/restaura mal el icono.
- **Archivos / refs:** `Tactical 4.png` â†’ `frontend/public/brand/tactical_favicon_obscuro.png`; `theme.jsx`, `index.html`, `appNotify.js`

## 2026-09-16 â€” Theme toggle: animaciÃ³n chip

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Chip Claro/Verde/Obscuro: crossfade+slide del face al ciclar, rotaciÃ³n del icono, press scale y wash de acento al hover/ciclo.
  - Hover/focus usan `--accent` / `--cc-accent` del tema activo; `prefers-reduced-motion` desactiva motion.
  - Ciclo lightâ†’verdeâ†’obscuro y migraciÃ³n localStorage intactos.
- **Archivos / refs:** `theme.jsx`, `styles.css`, `command-center.css`

## 2026-09-16 â€” Video Obscuro: acentos azul (sin oliva)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Tema Obscuro: `--cc-live` pasa de lima `#22c55e` a azul `#3b82f6`.
  - Badges: `.cc-badge.air` azul; `.cc-badge.idle` muted/borde (verde solo en tema Verde).
  - MÃ³dulo Video: overrides slate/azul en `.dv-live-on`, `.dv-cam-preview-wrap`, `.group-video-panel`, `.vc-tile-placeholder`, `.vc-tile-avatar`, cam-toggle activo.
  - Mic opcional ya cubierto (connect no falla si mic bloqueado); sin cambios JS.
- **Archivos / refs:** `command-center.css`, `styles.css`, `theme-contrast.css`
## 2026-09-16 â€” Geocercas: multi-select con checks

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
  - Lista suelta bajo el mapa reemplazada por multi-select **Geocercas** (checks) a la izquierda de Â«Nueva geocercaÂ».
  - El select solo aparece si hay â‰¥1 geocerca; los checks controlan cuÃ¡les se dibujan en el mapa.
  - Eliminar sigue disponible en el panel del select y en el popup del cÃ­rculo.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-16 â€” PestaÃ±as mapa: tipografÃ­a âˆ’1pt

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Sitios / Operadores / Ruta / Geocerca: fuente `calc(0.78rem + 1pt)` (âˆ’1pt respecto al +2pt previo).
- **Archivos / refs:** `command-center.css`

## 2026-09-16 â€” PestaÃ±as mapa: +2pt tipografÃ­a

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Sitios / Operadores / Ruta / Geocerca: `font-size` +2pt (`calc(0.78rem + 2pt)`); iconos 18px.
- **Archivos / refs:** `command-center.css`

## 2026-09-16 â€” Mapa ops: misma altura + respaldos tar/botones

- **Tipo:** fix | ux
- **Ãrea:** web | backend
- **QuÃ©:**
  - PestaÃ±as Sitios/Operadores/Ruta/Geocerca: selects, multi-select, botones e inputs a `min-height: 2.45rem` (antes selects en 2rem mÃ¡s bajos).
  - Respaldos: Acciones en una sola fila (Descargar / Restaurar / Eliminar) sin wrap.
  - Fix Windows: empaquetar ZIP con junction/copia de `uploads` en staging (bsdtar fallaba con varios `-C`: Â«Couldn't visit directoryÂ»).
- **Archivos / refs:** `command-center.css`, `backup.js`

## 2026-09-16 â€” Geocerca: toggle Â«Fijar en mapaÂ»

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Â«Nueva geocercaÂ» abre el formulario (Nombre / Lat / Lng / Radio / Guardar / Cancelar).
  - El clic en mapa deja de ser el botÃ³n de estado; pasa a toggle opcional **Â«Fijar en mapaÂ»** (off por defecto).
  - Con el toggle on, el mapa captura el centro; off, se navega normal y se escriben coords a mano.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-16 â€” Rail Obscuro: re-copia Tactical 3

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Recopia `Tactical 3.png` â†’ `tactical_rail_obscuro_expanded.png` (hash idÃ©ntico).
  - Regenera crop circular del emblema izquierdo â†’ `tactical_rail_obscuro_collapsed.png`.
  - Cache-bust Obscuro `?v=2` en `DispatchLayout`.
- **Archivos / refs:** `DispatchLayout.jsx`, `public/brand/tactical_rail_obscuro_*.png`

## 2026-09-16 â€” Obscuro: acentos mapa geocerca / capas

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Tema Obscuro: Â«Clic en mapaâ€¦Â» (`.map-action.is-on`) y capas Natural/SatÃ©lite/Claro (`.lt-layers button.active`) dejan el verde oliva/lima y usan acento azul PV (`--accent` / `--cc-accent` `#3b82f6`, texto `#93c5fd`).
  - BotÃ³n geocerca nivelado a `min-height: 2.45rem` con los inputs de la fila (antes quedaba en 2rem por el compact de `toolbar--ops`).
  - Verde conserva bronce/oliva; Claro sin cambio de acento.
- **Archivos / refs:** `command-center.css`, `institutional.css`, `theme-contrast.css`

## 2026-09-16 â€” Geocerca: Latitud y Longitud separados

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Panel Geocerca (Consola): el campo Ãºnico Â«CoordenadasÂ» (`lat, lng`) se divide en **Latitud** y **Longitud**.
  - Fila desktop: Clic en mapaâ€¦ | Nombre | Latitud | Longitud | Radio (m) | Guardar/Cancelar.
  - Clic en mapa rellena ambos; validaciÃ³n al guardar lat [-90,90] / lng [-180,180].
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-16 â€” Rail Obscuro: Tactical 3 + acentos azul

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Brand del rail por tema: Verde/Claro â†’ Tactical 1 (contraÃ­do) / Tactical 2 (expandido); Obscuro â†’ **Tactical 3** (`tactical_rail_obscuro_expanded.png`).
  - ContraÃ­do Obscuro: crop circular del emblema izquierdo de Tactical 3 (`tactical_rail_obscuro_collapsed.png`); no se reutiliza Tactical 1 (banner 3 â‰  cÃ­rculo militar).
  - Acentos del rail en Obscuro pasan a azul/slate PV (chevron, kicker, links activos/iconos); sin oro/bronce.
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `public/brand/tactical_rail_obscuro_*.png`

## 2026-09-16 â€” Geocerca: coordenadas editables

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - En Consola (`DispatchMap`), la fila de geocerca pasa a: Nombre â†’ Coordenadas (input) â†’ Radio; se conserva Â«Clic en mapaâ€¦Â».
  - El centro se puede escribir/pegar (`lat, lng` tolerante); el clic en mapa rellena el input y el borrador.
  - ValidaciÃ³n al guardar: lat [-90,90], lng [-180,180] con mensaje claro.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-16 â€” Tercer tema: Claro / Verde / Obscuro

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - El antiguo Â«ObscuroÂ» (HUD oliva/bronce) pasa a llamarse **Verde** (`data-theme=verde`).
  - Nuevo **Obscuro** (`data-theme=obscuro`) con tokens del tema oscuro de ParqueVehicular (`:root` en `frontend/public/assets/styles.css`: `#0f1117` / `#1a1d27` / azul `#3b82f6`).
  - Chip de tema cicla Claro â†’ Verde â†’ Obscuro; migraciÃ³n `localStorage` `dark`/`oscuro` â†’ `verde`.
- **Por quÃ© / notas:** Tres paletas sin tocar Claro; anti-regresiÃ³n en rail/toolbar (solo tokens/selectores de tema).
- **Archivos / refs:** `theme.jsx`, `index.html`, `styles.css`, `institutional.css`, `theme-contrast.css`, `command-center.css`

## 2026-09-16 â€” Rail: Tactical 2 exacta + cache-bust v4

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Copia forzada de `Tactical 2.png` â†’ `frontend/public/brand/tactical_rail_expanded.png` (SHA256 `8044BE12â€¦F254E9`, 760809 bytes; coincide fuente/destino).
  - Cache-bust rail expandido `?v=4` (antes `?v=3`; el asset previo era flood-fill reducido ~406 KB).
- **Por quÃ© / notas:** Usuario no veÃ­a Tactical 2; destino no coincidÃ­a con la fuente exacta. Servicios API/Web/PG/LiveKit ya estaban UP (HTTPS); no se reiniciÃ³ nada.
- **Archivos / refs:** `frontend/public/brand/tactical_rail_expanded.png`, `DispatchLayout.jsx`

## 2026-09-16 â€” Topbar: quitar Personas / Radio / Salir

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Eliminados los accesos rÃ¡pidos Personas | Radio | Salir del topbar desktop institucional.
  - Topbar compactado (menos padding) para ganar altura al mapa/contenido; se conserva chip de usuario, rol y tema.
- **Por quÃ© / notas:** Salir sigue en el pie del rail (y menÃº telÃ©fono); Radio en mÃ³dulos del rail / tabbar; Personas vÃ­a Ctrl/Cmd+K, RadioPage, ChatInbox y tab telÃ©fono.
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `theme-contrast.css`

## 2026-09-16 â€” Rail expanded: nueva Tactical 2 + transparencia

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Reemplazo de `tactical_rail_expanded.png` con `Tactical 2.png` (SICOM/colores, 20:03).
  - Flood-fill del negro exterior opaco â†’ transparencia (187â€¯647 px) para no tapar el rail oliva; exterior opaco negro restante = 0.
  - Cache-bust `?v=3` solo en expanded.
- **Por quÃ© / notas:** Nueva arte Tactical 2; el origen aÃºn traÃ­a negro opaco conectado al borde pese a esquinas alpha=0.
- **Archivos / refs:** `frontend/public/brand/tactical_rail_expanded.png`, `DispatchLayout.jsx`

## 2026-09-16 â€” Tooltip logo rail / topbar telÃ©fono

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Hover sobre emblema brand del rail (expandido/contraÃ­do) y logo del topbar en telÃ©fono muestra `title` con *Sistema de Comunicaciones para Operaciones Militares* (`SICOM_FULL_NAME`).
- **Archivos / refs:** `DispatchLayout.jsx`, `BrandName.jsx`

## 2026-09-16 â€” Rail brand: sin fondo negro + sin doble cÃ­rculo

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Expandido: `tactical_rail_expanded.png` (Tactical 2) pasÃ³ de JPEG/RGB con negro opaco a PNG RGBA; flood-fill del negro exterior â†’ transparencia sobre el oliva del rail.
  - ContraÃ­do: recorte al emblema circular; CSS sin `border-radius: 50%`, sin aro dorado ni `background: #0a0a0a` (la PNG ya es cÃ­rculo).
  - Cache-bust `?v=2` en rail y header telÃ©fono.
- **Por quÃ© / notas:** El rectÃ¡ngulo negro venÃ­a baked-in en el asset; el doble aro era CSS encima de Tactical 1.
- **Archivos / refs:** `institutional.css`, `DispatchLayout.jsx`, `public/brand/tactical_rail_*.png`

## 2026-09-16 â€” Mapa: quitar Operadores Â«UnoÂ» + focus selects

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Eliminada opciÃ³n **Uno** y el select Persona del filtro Operadores (redundante con checks de Ruta / grupos).
  - MigraciÃ³n: modo `one` â†’ `all`; se limpia `operatorUserId` y la clave legacy de localStorage.
  - Focus selects toolbar ops: outline none forzado en theme-contrast.css (vence el outline casi negro de styles.css).
  - Geocerca sigue en 1 fila (display:contents + panel --geocerca.is-picking).
- **Archivos / refs:** DispatchMap.jsx, useMapAvatarPhotos.js, mapAvatarIcon.js, theme-contrast.css, command-center.css


## 2026-09-16 â€” Mapa ops: geocerca 1 fila + focus sin negro

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Geocerca: `display: contents` en el form para que botÃ³n + Nombre + Radio + hint + Guardar/Cancelar queden en **una sola fila** del panel (desktop; wrap &lt;900px).
  - Focus toolbar ops: `outline: none` tambiÃ©n en `.cc-tactical-ms-trigger` y `.map-action`; anillo con `--cc-accent`.
- **Archivos / refs:** `command-center.css`

## 2026-09-16 â€” Consola mapa: Ruta+Horas, Geocerca 1 fila, focus selects

- **Tipo:** ux | mejora | fix
- **Ãrea:** web
- **QuÃ©:**
  - Toolbar mapa: pestaÃ±as Sitios Â· Operadores Â· **Ruta** Â· Geocerca (sin pestaÃ±a Â«HorasÂ»); panel Ruta = picker + Horas si hay â‰¥1 trazo.
  - Panel Geocerca en **una sola fila** (botÃ³n + Nombre + Radio + hint + Guardar/Cancelar); wrap solo <900px.
  - Focus de selects/inputs de la barra ops: sin outline negro; borde/sombra con `--cc-accent`.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-16 â€” Rail: Tactical 1/2 (contraÃ­do / expandido)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Copiados `Tactical 1.png` â†’ `tactical_rail_collapsed.png` y `Tactical 2.png` â†’ `tactical_rail_expanded.png` en `frontend/public/brand/`.
  - Rail expandido: banner completo (logo + tipografÃ­a en la imagen); contraÃ­do / tablet / telÃ©fono: emblema circular.
  - Quitado el texto HTML partido del rail (Tactical 2 ya incluye SICOM + subtÃ­tulo); `object-fit: contain` para no recortar.
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `public/brand/tactical_rail_*.png`


## 2026-09-16 â€” Fix logo rail acortado

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Regenerado `sicom_rail.png` (SICOM completo, subtÃ­tulo tapado en negro).
  - Quitado `aspect-ratio`/`object-fit:cover` que recortaba el banner; ahora `contain` a ancho completo.
  - Rail un poco mÃ¡s ancho (16.75rem) para que SICOM se lea bien.
- **Archivos / refs:** `sicom_rail.png`, `institutional.css`, `DispatchLayout.jsx`

## 2026-09-16 â€” Rail: SICOM completo / cÃ­rculo al contraer

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Rail expandido: banner `sicom_rail.png` (SICOM sin subtÃ­tulo de la imagen) + texto HTML arriba/abajo.
  - Rail contraÃ­do (y tablet): solo `sicom_round.png`.
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `public/brand/sicom_rail.png`

## 2026-09-16 â€” Marca SICOM dentro del rail de mÃ³dulos

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Logo y lema pasan al panel de navegaciÃ³n (altura completa); al contraer el rail el logo se reduce y el texto se oculta.
  - Texto partido: Â«Sistema de ComunicacionesÂ» arriba del emblema, Â«Para Operaciones MilitaresÂ» abajo.
  - Topbar desktop sin banner de marca (solo usuario / accesos); telÃ©fono mantiene emblema + SICOM.
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `sicom_round.png`

## 2026-09-16 â€” MenÃº PTT mapa: pestaÃ±as + fix al aire

- **Tipo:** feature | fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - MenÃº click-derecho del PTT flotante con pestaÃ±as **Escuchar / Hablar / Video / Alerta** (o Encabezado); tipografÃ­a alineada a Radio.
  - OpciÃ³n en **ConfiguraciÃ³n â†’ Canales**: Â«MenÃº PTT en mapa maximizadoÂ».
  - Fix: al estar AL AIRE, el click izquierdo vuelve a soltar (antes quedaba trabado).
  - Barra radio: Â«OyeÂ» â†’ Â«OÃ­rÂ».
- **Archivos / refs:** `MapPttFloat.jsx`, `ConfigChannels.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `DispatchLayout.jsx`, `command-center.css`

## 2026-09-16 â€” PTT flotante arrastrable en mapa maximizado

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - En mapa maximizado (Despacho y Seguimiento): PTT flotante se puede **arrastrar**; click izquierdo habla/suelta; click derecho abre menÃº de canales (Hablar/OÃ­r), alarma y reset de posiciÃ³n.
  - Componente compartido `MapPttFloat.jsx`; sin cambiar la lÃ³gica PTT del layout ni el resto del mapa.
- **Por quÃ© / notas:** El botÃ³n fijo abajo a la derecha tapaba el mapa; posiciÃ³n se guarda en `localStorage`.
- **Archivos / refs:** `MapPttFloat.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-16 â€” Inventario migraciÃ³n + prompt otra PC

- **Tipo:** docs | ops
- **Ãrea:** docs | infra | ops
- **QuÃ©:**
  - Script `infra/Inventario-Migracion.ps1` (checklist OK/FALTA sin imprimir secretos; exporta MD/CSV a soporte).
  - Checklist de copia en 3 paquetes + prompt anti-regresiÃ³n para Cursor en otra mÃ¡quina.
  - Actualizado `docs/INSTALAR_OTRA_MAQUINA.md`.
- **Archivos / refs:** `Inventario-Migracion.ps1`, `pulsanet_soporte\Documentos\CHECKLIST_COPIA_3_CARPETAS.md`, `PROMPT_AGENTE_OTRA_MAQUINA.md`, `INVENTARIO_MIGRACION_*.md`

## 2026-09-15 â€” Login 4G: doble NAT Telmex + UPnP SOAP Deco

- **Tipo:** fix | infra
- **Ãrea:** infra | ops | mobile
- **QuÃ©:**
  - Error APK Â«Sin conexiÃ³nÂ» / `No route to host`: stack local OK; Internet no llega por **doble NAT** (Deco X55 detrÃ¡s de modem Telmex Infinitum `192.168.1.254`).
  - Deco sÃ­ tiene IGD: se mapearon 80/443â†’`192.168.68.53` por **SOAP SSDP** (Windows COM UPnP fallaba). Nuevo `infra/Soap-UPnP.ps1` + `Reinforce-UPnP` reforzado.
  - Check externo sigue `No route to host`: falta reenvio en el **modem Telmex** (o modo bridge) hacia el Deco/PC.
- **Prueba inmediata Wiâ€‘Fi:** en login APK â†’ Â«Servidor (si no conecta)Â» â†’ `https://192.168.68.53`
- **4G:** en modem Infinitum abrir TCP 80+443 al Deco, o bridge + Deco como router.
- **Archivos / refs:** `Soap-UPnP.ps1`, `Reinforce-UPnP.ps1`, `Sync-PublicIp.ps1`

## 2026-09-15 â€” Edge 4G: UPnP/port-forward + bat reforzado

- **Tipo:** fix | infra
- **Ãrea:** infra | ops | mobile
- **QuÃ©:**
  - Causa del `No route to host` en APK 4G: Caddy/API locales OK; el router **no reenvÃ­a** TCP 80/443 (UPnP IGD null). DNS e IP pÃºblica correctos.
  - `Reinforce-UPnP` ahora incluye 80/443; LAN preferida `192.168.68.x` (dual-NIC).
  - Health de borde sin hairpin (`--resolve` / LAN); Watch-Stack y LEVANTAR distinguen LOCAL OK vs WAN/UPnP roto; exit â‰ 0 si edge 4G no verificado.
  - Arranque Watch-Stack mÃ¡s agresivo en el bat.
- **AcciÃ³n manual requerida:** en el Deco/TP-Link abrir **TCP 80 y 443 â†’ 192.168.68.53** (o activar UPnP/IGD).
- **Archivos / refs:** `Sync-PublicIp.ps1`, `Reinforce-UPnP.ps1`, `START-PUBLIC-EDGE.ps1`, `ENSURE-PUBLIC-EDGE.ps1`, `Watch-Stack.ps1`, `LEVANTAR-TACTICALPTX.bat`, `EXPOSE-UPNP.ps1`

## 2026-09-15 â€” GPS APK: pin presencia sÃ³lido + ficha pegada + icono SICOM

- **Tipo:** ux | fix | ops
- **Ãrea:** mobile
- **QuÃ©:**
  - Pin GPS al estilo web: cÃ­rculo con borde sÃ³lido verde/rojo/gris (sin sombreado difuso); punta del pin del mismo color.
  - Ficha Â«SeguirÂ» debajo del mapa, pegada a la lista (ya no tapa la leyenda IV R.M.).
  - Icono launcher regenerado desde `sicom_round.png` (operador tÃ¡ctico). APK sideload **1.8.125+135** sin OTA.
- **Archivos / refs:** `gps_map_pin.dart`, `gps_track_screen.dart`, mipmap/drawable launcher, `C:\pulsanet_soporte\APK\SICOM-1.8.125+135.apk`

## 2026-09-15 â€” APK sideload 1.8.124+134 (GPS UX + SICOM)

- **Tipo:** ops | release
- **Ãrea:** mobile
- **QuÃ©:** Release con GPS (ficha selecciÃ³n, lista ocultable, etiquetas por zoom) + rebrand SICOM. API https://pulsanet.duckdns.org. **Sin** actualizar android.json (no OTA flota).
- **Archivos / refs:** mobile/pubspec.yaml 1.8.124+134, `C:\pulsanet_soporte\APK\SICOM-1.8.124+134.apk`, SICOM-latest.apk, TacticalPtx-latest.apk

## 2026-09-15 â€” GPS APK: ficha selecciÃ³n, lista ocultable, etiquetas por zoom

- **Tipo:** ux | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - Ficha del operador seleccionado como sheet sobre el mapa (chips de presencia/edad/precisiÃ³n, coords, seguir/centrar).
  - Lista de usuarios ocultable (toolbar, menÃº Capas y chevron bajo el mapa); el mapa gana espacio al ocultarla.
  - Nombres/cargo en pines solo con zoom â‰¥13 (o pin seleccionado); hint Â«Acerca para ver nombresÂ».
- **Archivos / refs:** `mobile/lib/screens/gps_track_screen.dart`, `mobile/lib/widgets/gps_map_pin.dart`

## 2026-09-15 â€” Logo SICOM sin contorno blanco + APK 1.8.123+133

- **Tipo:** ux | ops
- **Ãrea:** web | mobile
- **QuÃ©:** Nuevo logo con fondo blanco externo eliminado (sin halo/contorno blanco); relleno interno conservado. Web `?v=4`. APK sideload 1.8.123+133 sin OTA.
- **Archivos / refs:** `sicom.png`, `sicom_round.png`, splash, `C:\pulsanet_soporte\APK\SICOM-1.8.123+133.apk`

## 2026-09-15 â€” APK sideload 1.8.122+132 (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release con rebrand SICOM, logo splash, GPS completo (avatares/latido/sitios/estados/OSRM). API https://pulsanet.duckdns.org. **Sin** actualizar android.json.
- **Archivos / refs:** mobile/pubspec.yaml 1.8.122+132, C:\pulsanet_soporte\APK\SICOM-1.8.122+132.apk, SICOM-latest.apk, TacticalPtx-latest.apk

## 2026-09-15 â€” Header: logo completo imponente (sin contraste verde)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Logo SICOM completo y mas grande; sin titulo duplicado; topbar oscuro alineado al negro del logo para que no se vea el circulo negro sobre verde; PNG solo transparencia exterior (`?v=3`).
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`, `institutional.css`, `sicom.png`

## 2026-09-15 â€” Logo SICOM: solo fondo exterior transparente

- **Tipo:** fix | ux
- **Ãrea:** web | mobile
- **QuÃ©:** Se restaura el relleno interno del emblema/placa; solo se elimina el fondo **fuera** del logotipo (contorno). Header despacho usa sicom.png?v=2.
- **Archivos / refs:** public/brand/sicom.png, DispatchLayout.jsx

## 2026-09-15 â€” Header despacho: logo SICOM completo + nombre completo

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En topbar del despacho se muestra el **logotipo completo** (sin cÃ­rculo/recorte) con fondo transparente; Â«Centro de operacionesÂ» â†’ *Sistema de Comunicaciones para Operaciones Militares*.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`, `institutional.css`, `public/brand/sicom.png`

## 2026-09-15 â€” GPS APK completo (paridad web)

- **Tipo:** feature | ux
- **Ãrea:** mobile
- **QuÃ©:**
  - Marcadores con **foto + latido** (estilo .lt-wa); selecciÃ³n centra/sigue y muestra ficha (presencia, edad GPS, coords, cargo).
  - Capas: **estados IV R.M.** (NL/TM/SLP), **sitios tÃ¡cticos**, ruta 8 h + **huecos OSRM** naranja.
  - Poll 5 s; menÃº Capas para activar/desactivar.
- **Archivos / refs:** gps_track_screen.dart, gps_map_pin.dart, pi_client.dart (track/gap/sites), ssets/geo/ivRmStates.json

## 2026-09-15 â€” Logo SICOM completo (sin fondo negro) + splash imponente

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - PNG con fondo transparente (sin caja/contornos negros); emblema circular limpio.
  - Login Web/APK y splash nativo Android muestran el logotipo **completo** (emblema + SICOM) grande, centrado, sobre oliva `#152017`.
  - TipografÃ­a Oswald condensada/imponente en wordmark; subtÃ­tulo del nombre completo.
- **Archivos / refs:** `sicom.png`, `sicom_round.png`, `launch_background.xml`, `main.dart` boot, `login_screen.dart`, `institutional.css`

## 2026-09-15 â€” Rebrand SICOM (logo + nombres + paleta)

- **Tipo:** ux | feature
- **Ãrea:** web | mobile | docs
- **QuÃ©:**
  - Marca visible: **SICOM** / *Sistema de Comunicaciones para Operaciones Militares* (login, tÃ­tulos, PWA, Android label, notificaciones display).
  - Logo nuevo en Web/APK; icono launcher desde emblema circular.
  - Paleta alineada al logo: bronce `#B8954A`/`#C9A84C`, oliva `#2A3D22`, HUD `#B8E04A`, fondos oscuros de login/llamada `#0A0A0A`.
- **Por quÃ© / notas:** Respaldo previo en `C:\pulsanet_soporte\Respaldos\marca-tacticalptx-20260915-0815`. **No** se tocÃ³ `com.tacticalptx.app`, sales crypto, BD, keys localStorage ni channel IDs FCM.
- **Archivos / refs:** `BrandName.jsx`, `theme.dart`, `styles.css`, `institutional.css`, `command-center.css`, brand PNGs `sicom*.png`

## 2026-09-15 â€” APK sideload 1.8.121+131 (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release con pestaÃ±a GPS (lista + mapa), Oswald, LISTO/SILENCIO, voz WA, foto en grande, menÃº â‹®, PiP arrastrable. API https://pulsanet.duckdns.org. **Sin** actualizar android.json.
- **Archivos / refs:** mobile/pubspec.yaml 1.8.121+131, C:\pulsanet_soporte\APK\TacticalPtx-1.8.121+131.apk, TacticalPtx-latest.apk

## 2026-09-15 â€” APK: pestaÃ±a GPS (lista + mapa en vivo) para mando

- **Tipo:** feature | ux
- **Ãrea:** mobile
- **QuÃ©:**
  - Nueva pestaÃ±a **GPS** junto a Radio (solo root / admin regiÃ³n / zona / unidad).
  - Lista + mapa OSM de compaÃ±eros con ubicaciÃ³n; filtro Canal activo o alcance de unidad/zona/regiÃ³n.
  - Poll cada 8 s vÃ­a `GET /api/locations`; operadores siguen con overlay Â«UbicaciÃ³n GPSÂ» propio.
- **Por quÃ© / notas:** Vista ligera (no consola de despacho); ampliable despuÃ©s.
- **Archivos / refs:** `gps_track_screen.dart`, `radio_shell.dart`, `roles.dart` (`canViewGpsTrack`), `api_client.dart` (`fetchLocations`), `flutter_map`/`latlong2`

## 2026-09-15 â€” TipografÃ­a Oswald institucional + llamada entrante llamativa

- **Tipo:** ux | fix
- **Ãrea:** mobile
- **QuÃ©:**
  - Fuentes otra vez **Oswald + Source Sans 3** (marca institucional; se quita Outfit/DM Sans).
  - Pantalla de llamada/videollamada entrante se **mantiene llamativa** (pulse/glow Contestar-Rechazar).
- **Archivos / refs:** `theme.dart`, `incoming_call_screen.dart`

## 2026-09-15 â€” Radio: restaurar LISTO / SILENCIO (no READY/MUTE)

- **Tipo:** fix | anti-regresiÃ³n | ux
- **Ãrea:** mobile
- **QuÃ©:** Estado de radio otra vez en espaÃ±ol: LISTO (no READY), SILENCIO (no MUTE). Se habÃ­a pisado al editar menÃº/canales/tipografÃ­a.
- **Archivos / refs:** 
adio_screen.dart _status

## 2026-09-15 â€” APK sideload 1.8.120+130 (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release con voz WA restaurada (composer + burbuja ondas), foto en grande, menÃº â‹® derecha, tipografÃ­a, canales por tap, videollamada layout original + PiP solo arrastrable. API https://pulsanet.duckdns.org. **Sin** actualizar ndroid.json (sigue 1.8.106+116).
- **Archivos / refs:** mobile/pubspec.yaml 1.8.120+130, C:\pulsanet_soporte\APK\TacticalPtx-1.8.120+130.apk, TacticalPtx-latest.apk

## 2026-09-15 â€” Videollamada: solo PiP arrastrable (revertir rediseÃ±o)

- **Tipo:** fix | anti-regresiÃ³n
- **Ãrea:** mobile
- **QuÃ©:** Se deshace el rediseÃ±o del stage de video (swap/fullscreen/etiquetas). Vuelve el marco 3:4 + mini local arriba-derecha; **Ãºnico** cambio pedido: arrastrar el PiP.
- **Por quÃ© / notas:** El usuario solo pidiÃ³ mover la imagen del oyente; no cambiar la forma de la videollamada.
- **Archivos / refs:** private_call_screen.dart _buildVideoStage

## 2026-09-15 â€” Recuperar UI voz (composer + burbuja ondas) tras regresiÃ³n

- **Tipo:** fix | ux | anti-regresiÃ³n
- **Ãrea:** mobile
- **QuÃ©:**
  - Al aÃ±adir DM audio se habÃ­a sustituido el flujo WA (ChatComposer con timer/onda/pausar/enviar + ChatVoiceBubble play/onda) por un mic hold + slider simple (ChatAudioBubble).
  - Se restauran chat_composer.dart, chat_voice_bubble.dart, ptt_wave_bars.dart y se reengancha grupo + 1:1; PTT radio vuelve a ondas animadas.
- **Por quÃ© / notas:** Los widgets no estaban en git (solo working tree anterior); se recuperaron del historial de sesiÃ³n. Requiere APK nueva.
- **Archivos / refs:** chat_composer.dart, chat_voice_bubble.dart, chat_panel.dart, direct_pane.dart, ptt_wave_bars.dart, channel_session.dart

## 2026-09-15 â€” APK sideload 1.8.119+129 (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release con foto en grande, menÃº â‹® derecha, tipografÃ­a Outfit/DM Sans, video entrante + PiP arrastrable, canales por tap, notas de voz 1:1. API https://pulsanet.duckdns.org. **Sin** actualizar ackend/app-updates/android.json (sigue 1.8.106+116).
- **Archivos / refs:** mobile/pubspec.yaml 1.8.119+129, C:\pulsanet_soporte\APK\TacticalPtx-1.8.119+129.apk, TacticalPtx-latest.apk

## 2026-09-15 â€” Foto de perfil/grupo en grande + UI APK (menÃº, tipografÃ­a, video, canales)

- **Tipo:** feature | ux | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - Tocar avatar de usuario o grupo abre visor a pantalla completa (zoom, nombre, cerrar) estilo WhatsApp â€” chats, cabeceras, radio, DM, historial.
  - MenÃº â‹® a la derecha; tipografÃ­a Outfit + DM Sans.
  - Videollamada entrante mÃ¡s llamativa; PiP arrastrable e intercambiable (tap).
  - Iconos de canal abajo: tap directo para seleccionar (no solo flechas).
- **Archivos / refs:** `user_avatar.dart` (`openAvatarPreview`), `theme.dart`, `incoming_call_screen.dart`, `private_call_screen.dart`, `radio_screen.dart`, `chat_inbox_screen.dart`, `call_history_pane.dart`

## 2026-09-15 â€” Chat 1:1: notas de voz (como grupos)

- **Tipo:** feature | fix
- **Ãrea:** mobile
- **QuÃ©:**
  - El DM nunca tuvo grabaciÃ³n de audio en cÃ³digo (solo grupos en `chat_panel`); no se quitÃ³ en los cambios recientes.
  - Se aÃ±ade: mantener pulsado el mic â†’ nota de voz; reproductor en burbuja (`ChatAudioBubble` compartido).
- **Archivos / refs:** `direct_pane.dart`, `chat_audio_bubble.dart`, `chat_panel.dart`

---

## 2026-09-15 â€” APK sideload 1.8.118+128 (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release con menÃº â‹®, borrar llamadas, stickers, arranque rÃ¡pido, notificaciones max + llamadas WhatsApp-like. API `https://pulsanet.duckdns.org`. **Sin** actualizar `backend/app-updates/android.json`.
- **Archivos / refs:** `mobile/pubspec.yaml` `1.8.118+128`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.118+128.apk`, `TacticalPtx-latest.apk`

---

## 2026-09-14 â€” Notificaciones alta prioridad + llamadas tipo WhatsApp

- **Tipo:** feature | ux | mejora
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Todas las notificaciones FCM/locales en canales v3/v2 con **prioridad mÃ¡xima** (`alerts_v3`, `calls_v3`, `nudge_v2`).
  - Llamadas/videollamadas: Contestar/Rechazar en la notificaciÃ³n; Contestar auto-abre la llamada; timbre al mostrar Contestar; minimizar (â†“) y seguir hablando con FGS alta prioridad + mic; ringback saliente.
- **Archivos / refs:** `fcm.js`, `push_service.dart`, `incoming_call_wake.dart`, `incoming_call_screen.dart`, `private_call_screen.dart`, `background_radio.dart`, `radio_shell.dart`

---

## 2026-09-14 â€” MenÃº â‹® estilo WhatsApp, borrar llamadas e icono stickers

- **Tipo:** feature | ux
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - MenÃº de tres puntos a la izquierda (Chats / Llamadas / Radio): canales, foto de perfil, datos, configuraciones, GPS, video/silencio radio, salir.
  - Llamadas: borrar registro (menÃº + botÃ³n); API `DELETE /api/calls/history`.
  - Stickers: icono `sticky_note_2` en compositor y pestaÃ±as Emojis/Stickers del panel.
- **Archivos / refs:** `app_overflow_menu.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`, `call_history_pane.dart`, `radio_screen.dart`, `chat_emoji_panel.dart`, `calls.js`, `dm.js`

---

## 2026-09-14 â€” Arranque: menos retardo al cerrar/abrir la app

- **Tipo:** fix | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - Splash ya no espera el chequeo OTA de red: sesiÃ³n local â†’ UI; OTA en segundo plano (solo bloquea si hay actualizaciÃ³n forzada).
  - Lectura de sesiÃ³n SecureStore en paralelo; timeout OTA 2s.
  - Home: cache local de grupos para pintar al instante al reabrir; `fetchGroups` refresca en segundo plano; no forzar avatar-ticket en cada boot.
- **Por quÃ© / notas:** El retardo al reabrir venÃ­a sobre todo de `await checkAndApply` en el splash (~2â€“3s) y luego del spinner hasta `fetchGroups`.
- **Archivos / refs:** `main.dart`, `app_update.dart`, `secure_store.dart`, `radio_shell.dart`, `api_client.dart`

---

## 2026-09-14 â€” Chat: swipe responder en grupos + umbral mÃ¡s corto

- **Tipo:** fix | ux
- **Ãrea:** mobile
- **QuÃ©:**
  - Grupos: deslizar a la derecha responde (igual que DM); antes solo menÃº largo.
  - Umbral compartido `kChatSwipeReplyThreshold` 0.16 (antes ~0.4 por defecto) en DM y grupos.
- **Archivos / refs:** `chat_bubble_style.dart` (`wrapChatSwipeReply`), `chat_panel.dart`, `direct_pane.dart`

---

## 2026-09-14 â€” APK alineada 1.8.117+127 (anÃ¡lisis desfase 94 vs 126)

- **Tipo:** ops | fix | docs
- **Ãrea:** mobile
- **QuÃ© / anÃ¡lisis:**
  - Techo real en Soporte: `TacticalPtx-1.8.116+126.apk` (11-sep). OTA `android.json` sigue en **1.8.106 / code 116** (no siguiÃ³ 117â€“126).
  - En **todas** las ramas git, `pubspec` estaba congelado en **1.8.84+94**: los bumps 95â†’126 se usaron al publicar pero **no se commitaron**.
  - El build Â«94Â» de hoy no fue un rollback de producto: compilÃ³ el Ã¡rbol actual con etiqueta vieja y pisÃ³ `latest`. La APK **126** ya traÃ­a ringtone/wake nativos + FGS camera/mic; el `MainActivity` en git HEAD estaba reducido (sin esos mÃ©todos) â€” se habÃ­a perdido el nativo en el repo respecto a lo que se empaquetaba.
  - CorrecciÃ³n: `pubspec` â†’ **1.8.117+127**; APK sideload sin OTA; `latest` apunta a +127.
- **Archivos / refs:** `mobile/pubspec.yaml`, `C:\pulsanet_soporte\APK\TacticalPtx-1.8.117+127.apk` (no tocar OTA)

---

## 2026-09-14 â€” APK 1.8.84+94 sideload (sin OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Release `TacticalPtx-1.8.84+94.apk` (API `https://pulsanet.duckdns.org`) copiado a Soporte; **sin** publicar `backend/app-updates`.
- **Archivos / refs:** `C:\pulsanet_soporte\APK\TacticalPtx-1.8.84+94.apk`, `TacticalPtx-latest.apk`

---

## 2026-09-14 â€” APK: ringtone/wake nativo, FGS cÃ¡mara, E2EE y red

- **Tipo:** fix | security | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - `MainActivity.kt`: ringtone/ringback del sistema + vibraciÃ³n, `bringToFrontForCall` (wake/lockscreen), cleanup en `onDestroy`.
  - Manifest FGS: permisos y tipos `camera|microphone` alineados con Â«Ver cÃ¡maraÂ» / mic remoto.
  - E2EE: `required` cuando el API marca `e2ee` en PTT canal, video grupal, cÃ¡mara remota y salientes 1:1.
  - `network_security_config`: cleartext OFF por defecto; solo LAN/emulador. `usesCleartextTraffic=false`.
  - Limpieza: `_fix_panic_vib.py` â†’ Soporte; README actualizado a 1.8.84+94.
- **Archivos / refs:** `MainActivity.kt`, `AndroidManifest.xml`, `network_security_config.xml`, `channel_session.dart`, `group_video_screen.dart`, `remote_camera_session.dart`, `peer_actions.dart`, `direct_pane.dart`, `personal_radio_bar.dart`, `call_ringtone.dart`, `mobile/README.md`

---

## 2026-09-14 â€” Ruta probable naranja: pendingRef + paralelo (OriÃ³n Hwy 54)

- **Tipo:** fix | ux
- **Ãrea:** web | backend
- **QuÃ©:**
  - Causa: `useGapRoutes` marcaba todos los huecos en `pendingRef` al inicio; al cancelar el efecto (Strict Mode / cambio de `wantedKey`) las claves restantes quedaban â€œpendingâ€ para siempre â†’ **cero naranja** aunque OSRM respondiera (OriÃ³n 48 h â‰ˆ 37 huecos; tramo Monterrey-Mier sin trazo).
  - Fetch en lotes de 6 (huecos largos primero), liberar `pendingRef` en cleanup, reintento 4 s; marcas naranja en extremos mientras calcula (sin recta Aâ†’B).
  - Contraste naranja `#e87812` opacity 0.58 / weight 14 (basemap Claro); `routeHint` reintenta tambiÃ©n en timeout.
  - Verificado: hueco 17,5 km OriÃ³n â†’ OSRM 219 pts / 27 km por Hwy 54 (`wouldDrawOrange`); 37/37 huecos en ~2,7 s paralelo.
- **Archivos / refs:** `frontend/src/dispatch/useGapRoutes.js`, `HighlighterTrack.jsx`, `DispatchMap.jsx`, `backend/src/services/routeHint.js`

## 2026-09-14 â€” Ruta probable: solo geometrÃ­a vial (sin cuerda recta)

- **Tipo:** fix
- **Ãrea:** backend | web
- **QuÃ©:**
  - Causa: tras Douglasâ€“Peucker, saltos de varios km sin `gapBefore` se pintaban en **verde recto** (p. ej. Cor. HernÃ¡ndez OriÃ³n 15 km); el fallback OSRM ademÃ¡s devolvÃ­a **recta Aâ†’B** etiquetada como Â«por callesÂ».
  - `trackHistory`: `splitOnGaps` respeta `gapBefore`; tras simplificar se remarcan saltos â‰¥1200 m para pedir OSRM (`TRACK_POST_SIMPLIFY_JUMP_M`).
  - `routeHint`: ya no inventa puntos en recta (`points: []` si pending); timeout 25 s; cachÃ© de fallos corta; rechaza geometrÃ­a de solo 2 vÃ©rtices en saltos largos.
  - `HighlighterTrack` / `useGapRoutes`: solo dibujan naranja con `source=osrm` y â‰¥2 puntos; mÃ¡s reintentos; store `v2`.
  - Verificado: OriÃ³n top-10 huecos y chiludas â†’ OSRM con forma (p. ej. 17,5 km â†’ 27 km / 219 pts, ratio 1,54; chiludas 3,8 km â†’ calles ratio 1,14â€“1,41). 0 cuerdas verdes >1200 m.
- **Archivos / refs:** `backend/src/services/routeHint.js`, `trackHistory.js`, `frontend/src/dispatch/HighlighterTrack.jsx`, `useGapRoutes.js`, `backend/.env.example`

## 2026-09-14 â€” Consola: leyenda de ruta no visible al elegir Ruta

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - La leyenda solo salÃ­a si habÃ­a polilÃ­nea (`â‰¥2` puntos GPS); con Cap. Luna (0 puntos en 48 h) no aparecÃ­a ni trazo ni leyenda.
  - Ahora la leyenda se muestra al tener operador(es) en **Ruta**; si el fetch termina sin recorrido: aviso Â«Sin GPS en N hÂ».
  - `z-index` de la leyenda subido a 1000 (como el chrome) para que Leaflet no la tape cuando sÃ­ hay trazo.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-14 â€” LEVANTAR: cierre por ecos `:puerto` y `...` en cmd

- **Tipo:** fix
- **Ãrea:** infra | ops
- **QuÃ©:**
  - `LEVANTAR-TACTICALPTX.bat` dejaba de ejecutarse en el paso Web con Â«No se esperaba ... en este momentoÂ» porque `cmd` interpreta tokens tipo `:5173` / `:4000` (tras espacio) y elipsis `...` dentro de bloques `if (...)`.
  - Ecos saneados (Â«puerto NNNNÂ», sin `...`); `ensure_api` / `ensure_web` con gotos (sin `if` anidados frÃ¡giles); archivo en CRLF.
  - Verificado: API + Web health OK; resumen de acceso al final.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`

## 2026-09-14 â€” LEVANTAR + instalar en otra mÃ¡quina

- **Tipo:** fix | docs | infra
- **Ãrea:** infra | docs | ops
- **QuÃ©:**
  - `LEVANTAR-TACTICALPTX.bat` v3: root portable (`%~dp0` primero), sin IP LAN inventada `192.168.1.66`, PATH PG 15â€“18 + Redis, detecciÃ³n PG por `Get-Service *postgres*`, `port_busy`/`free_port` con `netstat` (evita cuelgues de `Get-NetTCPConnection`), Web con espera larga + soft-retry antes de matar puerto, ventanas API/Web visibles (sin `/MIN`), flag `/noedge`.
  - `start-api.cmd` / `start-web.cmd`: resuelven carpeta relativa a `infra\` primero.
  - `Watch-Stack.ps1`: Test/Free puerto con netstat.
  - `CREAR-O-ACTUALIZAR-BD.bat`: avisa si `:5432` no escucha; PATH PG ampliado.
  - GuÃ­a `docs/INSTALAR_OTRA_MAQUINA.md` (+ copia en soporte Documentos).
- **Por quÃ© / notas:** los logs de hoy terminaban en Â«OK APIÂ» sin Web; Vite sÃ­ arranca a mano â€” el BAT mataba/esperaba mal o el borde colgaba la percepciÃ³n de Â«no levantÃ³Â».
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`, `infra/Watch-Stack.ps1`, `infra/start-services.ps1`, `CREAR-O-ACTUALIZAR-BD.bat`, `docs/INSTALAR_OTRA_MAQUINA.md`

## 2026-09-14 â€” Respaldos con multimedia (uploads/)

- **Tipo:** feature | mejora
- **Ãrea:** backend | web
- **QuÃ©:**
  - Los ZIP de Config â†’ Respaldos incluyen `database.sql` + `meta.json` + Ã¡rbol `uploads/` (avatares, chat, grabaciones, etc.).
  - Al restaurar un ZIP con multimedia se sustituye `uploads/` (el anterior queda en `uploads_pre_restore_*`); ZIP/SQL legado sin media conserva uploads actuales.
  - LÃ­mite de subida de restauraciÃ³n por defecto `BACKUP_UPLOAD_MAX_MB=2048` (2 GB); UI actualizada (BD + multimedia).
- **Por quÃ© / notas:** el clon de un servidor debe coincidir en datos y archivos, no solo en el dump SQL.
- **Archivos / refs:** `backend/src/services/backup.js`, `backend/src/routes/backups.js`, `frontend/src/dispatch/ConfigBackups.jsx`, `backend/.env.example`

## 2026-09-13 â€” Huecos de seÃ±al: leyenda y trazo unificados a Â«ruta probableÂ» (naranja)

- **Tipo:** mejora | ux
- **Ãrea:** web | backend
- **QuÃ©:**
  - Se unifican los dos conceptos del mapa (Â«ruta probableÂ» Ã¡mbar por OSRM + Â«ruta estimadaÂ» naranja en recta) en uno solo: **Â«ruta probableÂ»** en **naranja `#e87812`**.
  - Leyenda de rutas (`DispatchMap.jsx`) ahora solo muestra Â«Ruta recorridaÂ» (verde marcatextos, intacto) y Â«Sin seÃ±al Â· ruta probableÂ» (naranja). Se quita el item Â«ruta estimadaÂ».
  - `HighlighterTrack.jsx`: el trazo del hueco usa siempre el naranja unificado; el Popup dice siempre Â«Ruta probable por callesÂ». Se conserva solo una pista visual sutil (punteado) cuando el trazo es fallback en recta por falta de servicio de routing. `PREDICTED_COLOR` pasa a naranja y `ESTIMATED_COLOR` queda como alias (compat) para no romper imports.
  - Routing (`routeHint.js`): se refuerzan los params OSRM para una ruta tipo vehÃ­culo profesional que respeta el sentido de las calles: `continue_straight=false`, `snapping=any`, `annotations=false` (mÃ¡s `overview=full&geometries=geojson&steps=false&alternatives=false`). Se documenta que el perfil `driving` (default forzado) respeta one-way / doble sentido y que NO debe usarse `foot`/`walking`.
- **Por quÃ© / notas:** la Â«rectaÂ» que atravesaba calles era el fallback sin routing; OSRM `driving` ya respeta sentidos. Con OSRM propio (`ROUTING_OSRM_URL`) la ruta es fiel; el demo pÃºblico queda como default con mejores params. Build de frontend verificado (vite build OK).
- **Archivos / refs:** `frontend/src/dispatch/HighlighterTrack.jsx`, `frontend/src/dispatch/DispatchMap.jsx`, `backend/src/services/routeHint.js`, `backend/src/routes/locations.js`

## 2026-09-13 â€” Selects del mapa en maximizado / fullscreen

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Los MultiSelect (Sitios, Grupos, Ruta) portaleaban el panel a `.cc-shell`/`body`; con `requestFullscreen` en la pÃ¡gina del mapa el panel quedaba fuera del Ã¡rbol fullscreen â†’ invisible / no clicable.
  - Nuevo `resolveDropdownPortalHost`: host = `fullscreenElement` (si contiene el trigger), o `.map-page--maximized` / `.lt-page--maximized`, si no `.cc-shell`/`body`.
  - PTT flotante en maximizado porta al `pageRef` / fullscreen (Consola y Seguimiento/Radio).
  - z-index de chrome Leaflet un poco mÃ¡s alto en maximizado.
- **Archivos / refs:** `dropdownPortalHost.js`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `useTacticalSites.jsx`, `RouteTrackPicker.jsx`, `command-center.css`

## 2026-09-13 â€” Formatos control de cambios 12/09 y 13/09

- **Tipo:** docs
- **Ãrea:** docs | ops
- **QuÃ©:** Word de control de cambios (estilo FORMATO_CAMBIOS_08_09) para **ayer 12/09** y **hoy 13/09**; 8 filas cada uno, textos cortos. Escritorio + copia en soporte.
- **Archivos / refs:** Escritorio\FORMATO_CAMBIOS_12_09_2026.docx, Escritorio\FORMATO_CAMBIOS_13_09_2026.docx, `pulsanet_soporte\Documentos\`, `Scripts\fill_formato_cambios_12_13_09.py`
## 2026-09-13 â€” Tipo de mapa: top-right sin Estados

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - CorrecciÃ³n: sin leyenda Estados, `.lt-layers` va arriba a la derecha (`margin-left: auto`); con Estados sigue centrado (`--has-estados`).
  - Presencia a la izquierda; ops toolbar y tokens flush sin cambios.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-13 â€” Tipo de mapa: centro si hay Estados, izq. si no

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Consola / Seguimiento / Radio: `.lt-layers` (Natural|SatÃ©lite|Claro) se centra arriba si la leyenda IV R.M. estÃ¡ visible (`isSurfaceEnabled` + estados habilitados); si no, queda arriba a la izquierda junto a presencia.
  - Clases `map-frame-chrome--has-estados` / `lt-map-chrome--has-estados`; Estados sigue a la derecha.
- **Archivos / refs:** `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-13 â€” Consola ops: padding superior del toolbar equilibrado

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - En `.map-toolbar--ops`, `padding-top` de `0.65rem` (heredado de `--spread`) a `0.4rem` para igualar visualmente el hueco arriba de las labels con el de abajo de los controles.
  - Sin tocar alturas compactas (2rem) ni otros toolbars.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-13 â€” Consola ops: altura compacta en todos los controles del toolbar

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - La compactaciÃ³n previa solo â€œpegabaâ€ en Sitios: reglas posteriores (`.map-toolbar select`, `.map-action`, `.cc-tactical-ms-trigger`) pisaban padding/font/min-height.
  - Selectores con mayor especificidad bajo `.map-toolbar.map-toolbar--ops` para native `select`, triggers multi-select y `.map-action` (Operadores / Persona / Ruta / Horas / Nueva geocerca).
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-13 â€” Chrome de mapa unificado (Consola / Seguimiento / Radio)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Tokens compartidos `--map-chrome-*` en `.map-frame` / `.lt-map` / `.cc-map-body` (altura 23px, inset 0.55rem, fuente, padding, radius).
  - `.map-frame-chrome` y `.lt-map-chrome` comparten reglas; top/bottom flush; Radio embed ya no mueve capas abajo ni reduce botones.
  - Zoom + Maximizar + leyenda de ruta usan los mismos tokens.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-13 â€” Consola mapa: selects y Nueva geocerca mÃ¡s compactos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Toolbar ops (`map-toolbar--ops`): menor altura en selects, triggers Sitios/Ruta y botÃ³n Nueva geocerca (padding/min-height/font); ancho sin cambios.
  - Reglas acotadas a `--ops` para no afectar otros toolbars.
- **Archivos / refs:** `command-center.css`

## 2026-09-13 â€” Alerta de pÃ¡nico flotante (no bloquea la consola)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Quitado el backdrop a pantalla completa que atrapaba todos los clics.
  - Panel flotante arrastrable (`pointer-events` solo en el modal); se puede seguir navegando mÃ³dulos.
  - Persiste hasta Enterado/Resolver; botones con texto claro (contraste).
- **Archivos / refs:** `DispatchPanicHost.jsx`, `command-center.css`

## 2026-09-13 â€” Capas Natural/SatÃ©lite/Claro en Consola + Maximizar junto al zoom

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Consola (`/despacho`): restaurado selector Natural | SatÃ©lite | Claro en el chrome del mapa (se habÃ­a quitado del toolbar).
  - Maximizar movido a la izquierda de los controles Leaflet +/âˆ’ (Consola y Seguimiento).
- **Archivos / refs:** `DispatchMap.jsx`, `LiveTrackMap.jsx`, `MapMaximizeButton.jsx`, `command-center.css`

## 2026-09-13 â€” Volumen grabaciones al 100 % + chip Estados = Maximizar

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Reproductor Grabaciones: slider de volumen 0â€“100 % (llega al tope) y porcentaje visible al lado.
  - Chip Â«EstadosÂ» colapsado: misma altura 23px que Â«MaximizarÂ» (padding/chrome alineados).
  - Indicador pestaÃ±a al aire (tÃ­tulo `ðŸ”´ AL AIRE` + favicon rojo) mientras PTT holding (sin cortar mic).
- **Archivos / refs:** `RecordingPlayer.jsx`, `command-center.css`, `appNotify.js`, `usePtt.js`

## 2026-09-13 â€” Consola mapa: MAPAS off, leyendas y player 1.5Ã—

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Consola: eliminado selector MAPAS (toolbar y chrome); basemap fijo Natural.
  - Leyenda de rutas: separador `Â·` con clase centrada; puntos estimados naranja (`#e87812`) en mapa y swatch.
  - Leyenda estados IV R.M.: grid 2 filas alineadas; colapso a la derecha con transiciÃ³n CSS (panel + chip Â«EstadosÂ»).
  - RecordingPlayer: pÃ­ldora WhatsApp (play|onda|tiempo en una fila, play alineado); ancho â‰ˆ 1.5Ã— (17.6 rem).
- **Por quÃ© / notas:** Paquete de fixes UI mapa/grabaciones. Anti-regresiÃ³n: edits quirÃºrgicos.
- **Archivos / refs:** `DispatchMap.jsx`, `IvRmStatesLegend.jsx`, `HighlighterTrack.jsx`, `RecordingPlayer.jsx`, `command-center.css`

## 2026-09-12 â€” Grabaciones: reproductor compacto estilo nota de voz

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Mini reproductor de Grabaciones PTT rediseÃ±ado: play circular + onda corta + tiempo (forma WhatsApp / VoiceNote), colores `--cc-*`.
  - Anclado a la derecha de la fila (plaza de Â«EscucharÂ»); ya no estira una pÃ­ldora ancha en el medio.
  - Saltos Â±10 s, velocidad, realce y descarga en menÃº `â‹¯`; lÃ³gica de reproducciÃ³n (MIME/src imperativo/canplay/un audio) intacta.
- **Por quÃ© / notas:** Pedido: se veÃ­a mal / descuadraba la fila. Homologado en Consola + ConfigRecordings (mismo componente). Sync `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/src/dispatch/RecordingPlayer.jsx`, `command-center.css`

## 2026-09-12 â€” Ruta estimada: puntos naranjas (no amarillos)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Nuevo token `ESTIMATED_COLOR = #f08a24` para el trazo punteado Â«Sin seÃ±al Â· ruta estimadaÂ».
  - Leyenda y polilÃ­nea de mapa usan naranja; la lÃ­nea continua Â«ruta probableÂ» sigue en `PREDICTED_COLOR` (`#f5b32a`).
- **Por quÃ© / notas:** Distinguir estimado vs probable en la leyenda. Sync a `C:\pulsanet-dev\frontend\`. No se tocÃ³ CSS de leyenda de estados.
- **Archivos / refs:** `frontend/src/dispatch/HighlighterTrack.jsx`, `DispatchMap.jsx`

## 2026-09-12 â€” Leyenda de estados: 2 filas alineadas y colapsable

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Nueva `IvRmStatesLegend`: grid de **2 filas** con columnas `max-content` (cuadritos alineados en vertical), no flex-wrap desacomodado.
  - Control sutil (chevron â€º / chip Â«EstadosÂ») para **colapsar a la derecha**; persistencia `localStorage` (`tacticalptx_ivrm_legend_collapsed`).
  - Homologada en Consola (`DispatchMap`), Seguimiento y Radio (`LiveTrackMap`); se quitÃ³ el `display:none` de la leyenda en embed Radio.
- **Por quÃ© / notas:** Pedido de captura: 3 filas desalineadas y sin ocultar. Sync a `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/src/dispatch/IvRmStatesLegend.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-12 â€” Leyenda de rutas: punto medio centrado (Â·)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - En la leyenda inferior del mapa (`track-route-legend`), el Ã­tem estimado pasa de Â«Sin seÃ±al Ruta estimadaÂ» a Â«Sin seÃ±al Â· ruta estimadaÂ» (U+00B7).
  - El Ã­tem probable ya tenÃ­a Â«Sin seÃ±al Â· ruta probableÂ»; se confirma el mismo separador.
- **Por quÃ© / notas:** Pedido de captura: restaurar punto medio centrado (no guiÃ³n ni espacio suelto). Solo texto; sin tocar colores/estilos. Sync a `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 â€” Consola: chrome de capas/Maximizar sobre el mapa (como Seguimiento)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Quitado el bloque **MAPAS** (Natural|SatÃ©lite|Claro) del toolbar superior de Consola.
  - Mismo segmentado + **Maximizar** montados en overlay `map-frame-chrome` sobre el mapa, reutilizando `lt-layers`, `MapMaximizeButton`, `mapTiles.js` (`loadStoredMapLayer` / `storeMapLayer`) como en Seguimiento.
  - Un solo Maximizar (el del overlay); sin duplicar control en barra + mapa.
- **Por quÃ© / notas:** Pedido explÃ­cito: chrome idÃ©ntico a Seguimiento; Â«quita de aquÃ­ MAPASÂ». No se tocÃ³ lÃ³gica de avatares/filtros Operadores/Ruta/Horas. Sync a `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`, `frontend/src/dispatch/command-center.css` (estilos `.map-frame-chrome .lt-layers`)

## 2026-09-12 â€” Sitios tÃ¡cticos: UI se actualiza al eliminar sin F5

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Tras eliminar punto/agrupaciÃ³n (y resto de mutaciones), el catÃ¡logo actualiza state de inmediato (optimista) y re-fetch silencioso; el contador `Nombre (N)` del select sale del mismo array `sites` que la lista.
  - Evento `tacticalptx:tactical-sites-changed` para que Consola/Seguimiento (`useTacticalSites`) relean capas sin F5.
  - GET de grupos/sitios con `cache: 'no-store'` para no reponer datos viejos tras el DELETE.
- **Por quÃ© / notas:** El DELETE ya iba al API, pero el `(N)` dependÃ­a de `g.siteCount` y el re-load con spinner/`siteCount` podÃ­a dejar la vista desfasada; los mapas no escuchaban mutaciones del catÃ¡logo.
- **Archivos / refs:** `frontend/src/dispatch/CatalogTacticalSites.jsx`, `frontend/src/dispatch/useTacticalSites.jsx`, `frontend/src/api.js` (sync `C:\pulsanet-dev\frontend\`)

## 2026-09-12 â€” Marcadores: foto de usuario o de grupo segÃºn modo Operadores

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
  - En Consola (`DispatchMap`), el avatar del marcador sigue el select **Operadores**: **Todos** / **Uno** â†’ foto del usuario; **Por grupo** â†’ foto/icono del grupo; si el grupo no tiene foto â†’ fallback a la del usuario.
  - Multi-grupo: primer grupo seleccionado al que pertenece el operador y que tenga avatar; si ninguno tiene, foto de usuario.
  - Iconos se recalculan al cambiar modo o selecciÃ³n de grupos (no quedan stale).
- **Por quÃ© / notas:** Pedido explÃ­cito de Consola. LÃ³gica encapsulada en `mapAvatarIcon.js` + `useMapAvatarPhotos`; `LiveTrackMap` / `CommandCenter` sin el select Operadores quedan en comportamiento previo (foto de usuario). Sync a `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/src/dispatch/mapAvatarIcon.js`, `frontend/src/dispatch/useMapAvatarPhotos.js`, `frontend/src/dispatch/DispatchMap.jsx`, `frontend/src/avatarBlobCache.js`

## 2026-09-12 â€” RevisiÃ³n del lote: reproductor PTT endurecido + validaciÃ³n del resto

- **Tipo:** fix | mejora
- **Ãrea:** web | backend
- **QuÃ©:**
  - Pasada de revisiÃ³n sobre el lote del dÃ­a (Personas, AdscripciÃ³n, Grabaciones, etiquetas de sitios, Â«RutaÂ» en Consola, delimitaciones de estados).
  - **Grabaciones:** el segundo pase del mini reproductor habÃ­a quedado a medias; se cerrÃ³ el fallo Â«No se pudo reproducir el audioÂ» endureciendo el blob (`fetchRecordingBlobUrl` fuerza MIME `audio/webm` si viene vacÃ­o/octet-stream), esperando `canplay` tras asignar el `src` de forma imperativa, dedupe de descarga y grafo Web Audio solo cuando el realce Ã—2/Ã—3 lo pide. Quitado el botÃ³n verde **Escuchar** (ya solo queda el player). Meta de duraciÃ³n en fila pasa a `m:ss` y `.cc-rec-time` gana ancho mÃ­nimo para no solaparse.
  - **Validado OK (sin cambios extra):** Personas (âœ• + Esc + colores institucionales), AdscripciÃ³n (checks + AtrÃ¡s/Guardar en fila), etiquetas de sitios sin ellipsis, Â«RutaÂ» oculta sin selecciÃ³n en Por grupo/Uno + limpieza de `trackUserIds`, delimitaciones con fuente Ãºnica INEGI.
- **Por quÃ© / notas:** Prioridad a bugs funcionales del player (producciÃ³n ya lo marcÃ³ roto) sobre micro-refactors. Sync a `C:\pulsanet-dev\`.
- **Archivos / refs:** `frontend/src/dispatch/RecordingPlayer.jsx`, `frontend/src/api.js`, `frontend/src/dispatch/ConfigRecordings.jsx`, `frontend/src/dispatch/CommandCenter.jsx`, `frontend/src/dispatch/command-center.css`; backend `recordings.js` (Range) ya presente

## 2026-09-12 â€” Asegurado panel de despacho en rama WIP (solo vivÃ­a en working tree)

- **Tipo:** ops
- **Ãrea:** docs / ops
- **QuÃ©:**
  - Creada rama `wip/despacho-panel-2026-09-12` y commit(s) locales del panel de despacho (`frontend/src/dispatch/**`, rename `web`â†’`frontend`, backend/database/docs relacionados) que no existÃ­an bajo `frontend/` en ningÃºn HEAD previo.
  - Prioridad: no perder semanas de avance del panel; sin push forzado ni secretos.
- **Por quÃ© / notas:** El path `frontend/src/dispatch` solo estaba en el Ã­ndice/disco (rename pendiente + WIP). Asegurar en rama nombrada antes de seguir editando.
- **Archivos / refs:** rama `wip/despacho-panel-2026-09-12`; `frontend/src/dispatch/**`; backend/database/docs de producto

## 2026-09-12 â€” Barra del mapa: Â«RutaÂ» solo cuando Â«Por grupoÂ» / Â«UnoÂ» ya tienen selecciÃ³n

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - En la barra de la Consola (`DispatchMap.jsx`), el picker de **Â«RutaÂ»** ahora se oculta mientras el modo de operadores no tenga una selecciÃ³n real: en **Â«Por grupoÂ»** exige al menos 1 grupo marcado, en **Â«UnoÂ»** exige persona elegida. En **Â«TodosÂ»** se muestra siempre (sin cambios).
  - Nuevo helper `hasOperatorSelection(mode, groupIds, userId)` como Ãºnica fuente de verdad, usado tanto en el render como al restaurar filtros.
  - Al ocultarse Â«RutaÂ» (cambio de modo o desmarcar el Ãºltimo grupo) se **limpian las rutas seleccionadas**, para no dejar trazos fantasma en el mapa sin control visible en la barra.
  - Persistencia: `normalizeOpsMapFilters` descarta `trackUserIds` guardados si el modo restaurado no tiene selecciÃ³n, asÃ­ que tras recargar no aparece Â«HorasÂ» huÃ©rfano ni rutas sin picker.
- **Por quÃ© / notas:**
  - Completa la cadena **modo â†’ selecciÃ³n â†’ Ruta â†’ Horas**: cada control aparece solo cuando el anterior ya tiene algo elegido. Se mantiene intacta la regla previa de Â«HorasÂ» (`trackUserIds.length >= 1`), ahora ademÃ¡s condicionada a que Â«RutaÂ» estÃ© visible.
  - Sin cambios de CSS: `.map-toolbar-trail` ya es `flex-wrap` con `flex: 1 1 7rem`, los controles restantes se reparten el ancho igual que hacÃ­a Â«HorasÂ».
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx` (sincronizado a `C:\pulsanet-dev\frontend\`)

## 2026-09-12 â€” Delimitaciones de estados: causa raÃ­z del desfase (dos fuentes mezcladas) y fuente Ãºnica INEGI

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - **Causa raÃ­z encontrada:** la capa mezclaba **dos fuentes de geometrÃ­a distintas**. NL/TM/SLP salÃ­an de `data/ivRmStates.json` (detallado, correcto) y los otros 29 de `public/geo/mxEstados.json` (**mexicoHigh / angelnmara**, muy simplificado y desalineado). Al pintar vecinos con fuentes distintas, **cada frontera compartida se dibujaba dos veces y en sitios diferentes**: de ahÃ­ las rendijas color crema y los solapes que se veÃ­an entre Nuevo LeÃ³n y Coahuila, y entre San Luis PotosÃ­ y Zacatecas.
  - Sustituida por **fuente Ãºnica para los 32**: geoBoundaries **gbOpen MEX ADM1** (origen **INEGI**, CC BY 3.0 IGO), simplificada con **mapshaper** a ~100 m **preservando topologÃ­a** (`-simplify interval=100 keep-shapes -clean`, salida a 4 decimales â‰ˆ 11 m).
  - `public/geo/mxEstados.json` (32 estados, 2.3 MB, ~121k vÃ©rtices) y `src/dispatch/data/ivRmStates.json` (subconjunto NL/TM/SLP, 219 KB) se generan en la **misma corrida**, asÃ­ que los lÃ­mites entre vecinos son **arcos con vÃ©rtices idÃ©nticos** â€” es imposible que vuelvan a aparecer rendijas.
  - `IvRmStatesLayer.jsx`: la descarga diferida (`anyEnabled` â†’ `needsExtra`) ahora solo se dispara si estÃ¡ habilitado **algÃºn estado fuera del bundle IV R.M.** Con la configuraciÃ³n por defecto (solo NL/TM/SLP) ya no se bajan 2.3 MB que el bundle ya trae.
  - Comentarios de `mxStatesGeo.js` / `ivRmStatesConfig.js` actualizados y `EXTRA_URL` con cache-bust `?v=inegi-20260912` para soltar el `mexicoHigh` cacheado.
- **Por quÃ© / notas:**
  - **Por quÃ© los intentos anteriores no lo tocaron:** todos fueron del lado del render (ImageOverlay â†’ GeoJSON, `L.canvas` â†’ `L.svg`, grosor de stroke, `fillOpacity`) o cambiaron *quÃ©* fuente ganaba, pero **nunca eliminaron la mezcla de fuentes**, que era el problema. La geometrÃ­a de NL/TM/SLP siempre estuvo bien; lo que estaba mal eran los **vecinos**, y al mirar la Consola el usuario veÃ­a el borde de NL contra el borde de Coahuila y parecÃ­a un desfase de NL.
  - **Evidencia numÃ©rica.** Descartadas las hipÃ³tesis de datum/CRS/ids cruzados: los bbox del bundle ya coincidÃ­an con la realidad (NL `[-101.21, 23.16, -98.42, 27.80]` vs real `[-101.20, 23.16, -98.42, 27.79]`, desviaciÃ³n mÃ¡x. **0.01Â°**), WGS84 y lon/lat en orden correcto. Lo que fallaba era `mexicoHigh`: desviaciÃ³n **mediana 1.5â€“2.5 km y mÃ¡xima 32 km**, con ~18 % de sus vÃ©rtices a mÃ¡s de 5 km. VÃ©rtices compartidos en fronteras, **antes**: NL/COAH **0**, SLP/ZAC **0**, TM/VER **0**, pero NL/TM **1565** â€” eso explica exactamente el patrÃ³n que se veÃ­a (el borde NL/TM salÃ­a limpio porque ambos venÃ­an del bundle; los demÃ¡s no). **DespuÃ©s**: NL/COAH 371, NL/TM 637, SLP/ZAC 423, TM/VER 311, CDMX/MEX 222.
  - **Test de Ã¡rea mal etiquetada** (rejilla de 107 588 puntos sobre el noreste, verdad = INEGI a resoluciÃ³n completa): **antes 4.47 %** mal etiquetada (1116 puntos en solape, 3670 pintados como otro estado); **despuÃ©s 0.02 %**, con **0 solapes**. PrecisiÃ³n de la simplificaciÃ³n: error mediano 11 m, p95 63 m.
  - **ValidaciÃ³n de los 32:** ids del catÃ¡logo y del GeoJSON 1:1, sin duplicados ni cruces, y cada bbox dentro de 0.11Â° de su valor real (la mayorÃ­a <0.03Â°). Ojo con la fuente: geoBoundaries trae `shapeISO = MX-MEX` **duplicado** para CDMX y Estado de MÃ©xico, asÃ­ que el generador empareja por `shapeName` con tabla explÃ­cita y aborta si algo no mapea.
  - **Cambio visible esperado:** la costa de Tamaulipas ahora dibuja la **Laguna Madre** y sus islas de barrera (INEGI excluye el cuerpo de agua), donde antes se pintaba un bloque liso encima del agua. Coincide con el basemap.
  - **VerificaciÃ³n.** El navegador de Cursor no logrÃ³ abrir pestaÃ±a otra vez (Â«No browser tab availableÂ»), asÃ­ que **no hay captura de la Consola en vivo**. En su lugar se hizo un harness local que descarga las **mismas teselas Esri World_Street_Map** de `mapTiles.js` y proyecta el GeoJSON con la **misma fÃ³rmula EPSG:3857 de Leaflet**: el render Â«antesÂ» reproduce la captura del usuario (mismas rendijas), y en el Â«despuÃ©sÂ», a z8/z9/z10/z12, el borde de color cae **justo sobre la lÃ­nea administrativa gris del basemap**, con panel de referencia sin overlay. Comprobado tambiÃ©n end-to-end contra el dev server real: `GET /geo/mxEstados.json?v=inegi-20260912` â†’ 200, 2 335 265 bytes, 32 features, 371 vÃ©rtices compartidos NL/COAH. Falta la confirmaciÃ³n visual en la app en vivo (Consola / Seguimiento / Radio): **verificar con Ctrl+F5**.
  - No se tocaron los checks de superficies, los colores configurables, la carga diferida ni `tacticalptx_iv_rm_states_v1`. Respaldo previo en `C:\pulsanet_soporte\Respaldos\geo-estados-20260912-213913\`. Sync `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/public/geo/mxEstados.json`, `frontend/src/dispatch/data/ivRmStates.json`, `frontend/src/dispatch/mxStatesGeo.js`, `frontend/src/dispatch/IvRmStatesLayer.jsx`, `frontend/src/dispatch/ivRmStatesConfig.js`; generador y harness en `C:\pulsanet_soporte\Respaldos\` (`build-states.js`, `render-check.py`, `area-test.py`, `validate32.js`); evidencias `C:\pulsanet_soporte\Documentos\evidencias\2026-09-12_estados_*.png`

## 2026-09-12 â€” RegresiÃ³n recuperada: etiquetas de sitios en el mapa ya no se cortan con Â«â€¦Â»

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Las etiquetas de **sitios tÃ¡cticos** volvÃ­an a salir cortadas (Â«Antidron de la Bâ€¦Â»). El recorte era **solo CSS**: `.cc-tactical-map-label` conservaba `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` con `max-width: 118px`, encajonada ademÃ¡s en un `divIcon` de ancho fijo de 120 px. **No hay recorte en JS** (no se usa `slice`/`substring` sobre el nombre).
  - Se replicÃ³ el patrÃ³n que **ya funcionaba en las etiquetas de operadores** (`.lt-wa-cargo` + `mapAvatarIcon.js`): `white-space: normal`, `overflow: visible`, `text-overflow: unset`, `word-break: break-word` y tamaÃ±o de icono dinÃ¡mico.
  - `TacticalSitesLayer.jsx` â†’ `siteIcon()`: ancho dinÃ¡mico (120â€“280 px segÃºn el largo del texto), alto segÃºn nÃºmero de lÃ­neas (hasta 4) y `iconAnchor` recalculado a `iconW/2`, para que la caja crezca/envuelva y el pin siga **centrado en la coordenada** del sitio.
  - `command-center.css`: nuevo `.cc-tactical-map-pin.has-label` (`width:auto`, `min-width:120px`, `max-width:min(280px,42vw)`), `overflow: visible` en `.cc-tactical-map-icon` y `.cc-tactical-map-label` con envoltura en varias lÃ­neas.
- **Por quÃ© / notas:** La Â«regresiÃ³nÂ» no fue un commit que pisara el arreglo: el fix de etiquetas completas **solo se habÃ­a aplicado a la capa de operadores**, nunca a la de sitios (en la versiÃ³n *staged* del CSS ambas clases siguen truncadas, asÃ­ que el sitio nunca estuvo arreglado). Cubre los **tres mapas** de una sola vez porque Consola (`DispatchMap.jsx`), Seguimiento (`LiveTrackMap.jsx`), Radio (`RadioPage.jsx`, que embebe `LiveTrackMap`) y Consola de mando (`CommandCenter.jsx`) comparten el mismo `TacticalSitesLayer`; `.cc-tactical-map-label` era el Ãºltimo rÃ³tulo de mapa que quedaba con `ellipsis`. Verificado con `vite build` OK y captura en Chrome headless sobre el **CSS real** en claro y oscuro: nombre completo, envuelve a dos lÃ­neas cuando es muy largo, la caja se ajusta al texto y el pin queda centrado. El navegador de Cursor no conservÃ³ pestaÃ±a en esta sesiÃ³n y no habÃ­a stack levantado, asÃ­ que la evidencia es de un harness aislado, no de la app en vivo. Sync `C:\pulsanet-dev\frontend\`. Verificar con **Ctrl+F5**.
- **Aviso (anti-regresiÃ³n):** `frontend/src/dispatch/` **no existe en ningÃºn commit ni rama** (`main`, `develop`, `cursor/video-panic-stable-domain`); estÃ¡ solo en el Ã­ndice (staged) y en disco. Todo el panel de despacho vive sin commit: conviene commitearlo o dejarlo en una rama nombrada para no perderlo.
- **Archivos / refs:** `frontend/src/dispatch/TacticalSitesLayer.jsx`, `frontend/src/dispatch/command-center.css`, evidencia `C:\pulsanet_soporte\Documentos\evidencias\2026-09-12_etiquetas_sitios_completas.png`

## 2026-09-12 â€” Grabaciones PTT: mini reproductor en la fila

- **Tipo:** feature
- **Ãrea:** web, backend
- **QuÃ©:**
  - Nuevo componente `frontend/src/dispatch/RecordingPlayer.jsx`: mini reproductor embebido en cada fila de **Grabaciones PTT** (ConfiguraciÃ³n â†’ Grabaciones y panel de grabaciones de la Consola). Controles: play/pausa, onda con barra de progreso arrastrable (`pointerdown`/`pointermove` + `role="slider"`), tiempo transcurrido / total, saltos **âˆ’10 s / +10 s** y un menÃº compacto con **Realce de voz Ã—1/Ã—2/Ã—3**, **velocidad 0.5Ã— / 1Ã— / 1.5Ã— / 2Ã—**, volumen y Â«Descargar audioÂ».
  - El realce por encima del 100 % usa **Web Audio** (`AudioContext` â†’ `MediaElementAudioSourceNode` â†’ `DynamicsCompressorNode` â†’ `GainNode`): el compresor levanta lo que se habla bajito y el gain sube el total sin reventar los picos. El grafo se crea solo si se pide Ã—2/Ã—3 (gesto de usuario, asÃ­ `resume()` funciona).
  - Solo suena una grabaciÃ³n a la vez (bus interno `rec-play`). Se **retirÃ³ el botÃ³n verde Â«EscucharÂ»** de las dos listas y con Ã©l su cÃ³digo muerto (`playRecording`, `playingId`, refs de audio y el import `fetchRecordingBlobUrl` en `CommandCenter`): el player de la fila es ahora la Ãºnica forma de oÃ­r, y hace todo lo que hacÃ­a el botÃ³n (incluida la descarga).
  - El audio se descarga con el token (blob) al primer play, no al pintar la lista, con dedupe para que un doble clic no baje el archivo dos veces.
  - Backend `GET /api/recordings/:id/audio`: se aÃ±adiÃ³ `Accept-Ranges`, `Content-Length` y **peticiones parciales HTTP 206** (rango explÃ­cito, sufijo `bytes=-N`, abierto `bytes=N-` y `416` con `Content-Range: bytes */total`). Sigue sin `Content-Disposition`, asÃ­ que se reproduce en lÃ­nea.
- **Fix tras prueba en producciÃ³n â€” Â«No se pudo reproducir el audioÂ»:** la causa era el orden de asignaciÃ³n del `src`. El blob llegaba por `setState` y `play()` se llamaba en el mismo tick, cuando React todavÃ­a no habÃ­a pintado el atributo: el elemento arrancaba Â«sin fuentesÂ» y la promesa de `play()` se rompÃ­a (reproducido en Chrome headless con un .webm real: `AbortError â€” The play() request was interrupted by a new load request`). **Siempre fallaba el primer clic.** Ahora el `src` se asigna de forma imperativa (`audio.src = url; audio.load()`) antes de `play()` y el elemento ya no recibe `src` por prop. AÃ±adido ademÃ¡s: listeners enganchados una sola vez al montar (antes se ataban al cambiar `src`, perdiendo el primer evento `play`), mensajes de error que dicen **quÃ©** pasÃ³ (HTTP 401/403/404, `NotAllowedError`, `NotSupportedError`, cÃ³digos de `MediaError`), `AbortError` tratado como no-fallo, y el grafo de Web Audio se crea **solo** al pedir Ã—2/Ã—3 dentro del clic y con `await ctx.resume()`; si no puede crearse, el realce vuelve a Ã—1 y el audio **sigue sonando** en modo simple con un aviso, en vez de fallar.
- **Fix de layout:** la columna de datos de la fila no podÃ­a encogerse (su lÃ­nea Â«Canal Â· 350.1 s Â· horaÂ» no rompe sola) y se montaba sobre el player; el mensaje de error, con `flex-basis:100%` en un contenedor sin `wrap`, machacaba los controles. Ahora la columna lleva `min-width:0` + `overflow-wrap`, el player es columna (pastilla + panel + avisos en lÃ­neas propias) y el **panel de ajustes va en lÃ­nea, no flotante**, asÃ­ no lo recorta el `overflow` de `.cc-rec-list` ni el borde del panel de la consola. Las barras de la onda se reparten con `space-between` para que el thumb caiga donde se hace clic.
- **Por quÃ© / notas:** Despacho necesita distinguir matices de audios donde se habla bajito y poder adelantar/atrasar dentro de la grabaciÃ³n. Cambios aditivos: no se tocÃ³ el reproductor de notas de voz del chat (`VoiceNotePlayer` en `ChatMedia.jsx`), solo se tomÃ³ como modelo visual; el CSS entra como bloque nuevo al final de `command-center.css` con variables `--cc-*`. Comprobado en Chrome headless: cÃ³dec `audio/webm; codecs=opus` â†’ `probably` (las 277 grabaciones son webm de MediaRecorder; su `duration` es `Infinity`, de ahÃ­ que el total venga de `durationMs` de la BD, y el seek a segundo exacto sÃ­ funciona), las 5 variantes de `Range` contra una grabaciÃ³n real de 5.6 MB, y el layout con el CSS compilado a 900 / 620 / 400 px en tema claro y oscuro sin solapes ni recortes. El navegador de Cursor no conservÃ³ pestaÃ±a en esta sesiÃ³n. Sync `C:\pulsanet-dev\frontend\` y `C:\pulsanet-dev\backend\`. Verificar con **Ctrl+F5** en Despacho â†’ ConfiguraciÃ³n â†’ Grabaciones.
- **Archivos / refs:** `frontend/src/dispatch/RecordingPlayer.jsx` (nuevo), `frontend/src/dispatch/ConfigRecordings.jsx`, `frontend/src/dispatch/CommandCenter.jsx`, `frontend/src/dispatch/command-center.css`, `backend/src/routes/recordings.js`

## 2026-09-12 â€” Editar usuario / paso AdscripciÃ³n: checks y botones alineados

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - **Privilegios de radio / visibilidad**: los tres checks salÃ­an con el cuadrito estirado y el texto en una columna aparte porque `.cc-shell .admin-form input` impone `width:100%` a todo `input` (Chrome centra el glifo dentro de la caja inflada). Ahora `.cc-priv-check input[type=checkbox]` mide 1rem, no se encoge y usa `accent-color: var(--cc-accent)` (oliva institucional en vez del azul nativo).
  - Cada fila es un `<label>` completo clickeable: check + tÃ­tulo (`Ver RegiÃ³n` / `Ver Zonas / C.G.` / `Ver Unidades`) y la descripciÃ³n entre parÃ©ntesis como segunda lÃ­nea en `--cc-muted`, alineada a la izquierda y con **el mismo texto** de antes. Filas dentro de `.cc-priv-check-list` con espaciado uniforme, borde suave y realce `.on` al marcar (mismo patrÃ³n que `.cc-group-check`).
  - El `fieldset` deja de dibujar una caja dentro de `.cc-form-section`: su `legend` toma el estilo de tÃ­tulo de secciÃ³n, asÃ­ el bloque queda alineado con Â«UbicaciÃ³n orgÃ¡nicaÂ» y con los tres selects RegiÃ³n / Zona-C.G. / Unidad.
  - Botones del paso: `.field` aportaba `flex-direction: column` y apilaba Â«â† AtrÃ¡sÂ» encima de Â«Guardar cambiosÂ». `.field-actions.cc-form-actions` ahora es fila (`row` + `wrap`, `justify-content: flex-end`, `align-items: center`), ambos botones con la misma altura y Â«â† AtrÃ¡sÂ» a la izquierda de Â«Guardar cambiosÂ».
- **Por quÃ© / notas:** Solo layout/estilo con variables del sistema; sin tocar la cascada RegiÃ³nâ†’Zonaâ†’Unidad, la validaciÃ³n ni el guardado. Verificado en Chrome headless con el CSS real a 1000px y 430px (en angosto los selects pasan a una columna y los botones envuelven, no se apilan). Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en AdministraciÃ³n â†’ Usuarios â†’ Editar usuario â†’ paso AdscripciÃ³n.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 â€” Personas: botÃ³n X y colores institucionales

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Modal **Personas** (`PeoplePalette.jsx`, Ctrl+K): el chip de texto Â«EscÂ» se cambiÃ³ por un botÃ³n **âœ•** redondo (`aria-label`/`title` Â«Cerrar (Esc)Â»), igual que `PeerActionSheet`. Conserva `data-esc-close-btn`, asÃ­ que **Escape sigue cerrando** vÃ­a `GlobalEscapeClose`.
  - Paleta adaptada al tema institucional con variables (`--surface`, `--ink`, `--muted`, `--border`, `--accent`, `--gold`, `--paper`, `--shadow`) en vez de hex oscuros fijos: panel claro/oscuro segÃºn `data-theme`, cabecera con filo dorado y tÃ­tulo oliva (oro en oscuro), buscador y filas con `color-mix` del acento.
  - Contraste de los 4 iconos de acciÃ³n (mensaje/llamada/video/ver cÃ¡mara): chips con fondo `--paper` + borde `--border`; avatares con disco oliva y aro dorado. En mÃ³vil el âœ• ya no se oculta (antes `display:none`) y toma tamaÃ±o tÃ¡ctil 44px.
- **Por quÃ© / notas:** El modal desentonaba con el panel oliva/oro. Sin cambios de lÃ³gica: buscar, recientes, mensaje, llamada, video, ver cÃ¡mara y el scroll de la lista quedan intactos. Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** y Ctrl+K.
- **Archivos / refs:** `frontend/src/PeoplePalette.jsx`, `frontend/src/styles.css`

## 2026-09-12 â€” CatÃ¡logos: manita ciclaba y bloqueaba clics

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Causa: `html.cc-catalogs-tabs-dragging * { cursor: grab !important }` + `setOverTo` en cada `pointermove` provocaba recalc/flicker del cursor en Chrome/Windows y sensaciÃ³n de UI trabada; listeners de pointer podÃ­an apilarse y la clase quedarse pegada.
  - Fix pestaÃ±as: sesiÃ³n Ãºnica con `setPointerCapture`, umbral 8px, updates solo si cambia drag/over, limpieza fiable en pointerup/cancel/Escape/visibility/unmount; grab solo en `html`/`body` y pestaÃ±as (ya no en `*`).
  - Fix chips Grados/JerarquÃ­as: misma limpieza de `cc-cat-dragging` + cursor sin selector universal.
- **Por quÃ© / notas:** Reorder de pestaÃ±as e Ã­tems se conserva. AppDialog de Grados ya tiene X (no habÃ­a modal con texto Â«EscÂ» claro sin captura). Verificar: **Ctrl+F5** en `/despacho/catalogos/grados`.
- **Archivos / refs:** `ReorderableCatalogTabs.jsx`, `CatalogGrades.jsx`, `CatalogJerarquias.jsx`, `command-center.css` (sync `pulsanet-dev`)

## 2026-09-12 â€” Inbox: alinear hora con iconos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Hora + estrella/telÃ©fono/video en el mismo contenedor `.wa-inbox-row-end` (`align-items: center`).
  - La hora saliÃ³ de `.wa-inbox-top` (quedaba arriba del preview) para compartir lÃ­nea visual con las acciones.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio/inbox â€” hora a la misma altura que los 3 iconos.
- **Archivos / refs:** `frontend/src/ChatInbox.jsx`, `frontend/src/styles.css`

## 2026-09-12 â€” Radio: icono Videollamada un poco mÃ¡s chico

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Icono PNG de **Videollamada** en botones laterales PTT: de **17Ã—17** a **15Ã—15** px (CSS `.radio-video-call-btn img` + `width`/`height` del `<img>`).
  - Sin tocar Audio/alerta ni el archivo PNG fuente.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio â€” icono mÃ¡s alineado con speaker y âš .
- **Archivos / refs:** `frontend/src/styles.css`, `frontend/src/pages/RadioPage.jsx`

## 2026-09-12 â€” Consola: Horas solo con â‰¥1 ruta

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - En toolbar de Consola, el select **Horas** solo se renderiza si `trackUserIds.length >= 1`.
  - Sin rutas marcadas (RUTA = Â«â€” ninguna â€”Â») no aparece Horas; al marcar â‰¥1 check vuelve. El valor `trackHours` en state/localStorage se conserva.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: sin rutas â†’ no Horas; marca 1 â†’ aparece; **Ctrl+F5**.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 â€” Consola: GRUPO multi-select estilo Parque Vehicular

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
  - Sustituido el selector nativo / multi parcial de **Grupo** por panel multi-check sin `<select>`: Ascendente/Descendente, Marcar/Desmarcar, contador Â«N de N seleccionadosÂ», ayuda `?`, bÃºsqueda Â«Buscar en listaâ€¦Â» y lista con checks (sin lÃ­mite).
  - Colores TacticalPtx (oliva/oro institucional) reutilizando `channel-col-*` + `cc-tactical-ms-*` / `cc-group-ms-*`.
  - Persistencia `operatorGroupIds[]` en `tacticalptx_ops_map_filters_v1`; filtro mapa = uniÃ³n de miembros de grupos marcados.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: Operadores â†’ Por grupo â†’ abrir Grupo â†’ panel PV; **Ctrl+F5**.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 â€” UX: alinear icono âš  Enviar alerta

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Centrado Ã³ptico del glyph âš  en `.panic-ico-glyph` (`translateX(-0.08em)`) para alinearlo con los iconos de `.radio-ops-side-btn` (p. ej. Audio activado).
  - Ondas expansivas intactas; solo nudge del triÃ¡ngulo amarillo.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio â€” âš  centrado respecto al icono de audio debajo.
- **Archivos / refs:** `frontend/src/styles.css` (`.panic-ico-glyph`)

## 2026-09-12 â€” Radio: icono PNG Videollamada (lado PTT)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - BotÃ³n Videollamada en Radio (`radio-video-call-btn`) deja el emoji ðŸ“¹ y usa `videollamada.png` (`iconVideollamada`), mismo asset que DM/inbox.
  - TamaÃ±o ~17px alineado al icono de Audio del botÃ³n superior; CSS mÃ­nimo en `.radio-ops-side-btn`.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio â€” icono PNG en Videollamada. No tocar Enviar alerta / `.panic-ico`.
- **Archivos / refs:** `frontend/src/pages/RadioPage.jsx`, `frontend/src/styles.css`, `frontend/src/assets/icons/videollamada.png`

## 2026-09-12 â€” Persistencia filtros barra mapa Consola

- **Tipo:** mejora
- **Ãrea:** web
- **QuÃ©:**
  - Barra Consola (Operadores / Ruta / Horas) se guarda en `localStorage` (`tacticalptx_ops_map_filters_v1`) y se restaura al montar / F5.
  - Sitios siguen en su clave existente (`tacticalptx_tactical_site_layers`).
  - IDs restaurados se validan contra grupos/ubicaciones cargados; no se podan rutas antes del primer fetch.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: elegir filtros â†’ F5 â†’ siguen. Seguimiento/Radio no tienen esa barra.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 â€” UX: leyenda de rutas (quitar Tramo repetido + texto estimado)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Quitado de la leyenda el Ã­tem **Tramo repetido** (solo UI; highlighter de tramos repetidos en mapa intacto).
  - **Sin seÃ±al Â· ruta probable** sin cambios.
  - Estimado: **Sin seÃ±al Â· estimado** â†’ **Sin seÃ±al Ruta estimada**.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola con ruta activa â€” 3 Ã­tems en leyenda.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 â€” UX: chrome mapas homologado a 23px

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - `--map-chrome-h` / `--lt-chrome-h`: **1.85rem â†’ 23px** (Maximizar + En lÃ­nea/Desconectado/Fuera de lÃ­nea).
  - Misma altura en Consola, Seguimiento y Radio PTT; `.track-route-legend` tambiÃ©n fija **23px**.
  - Padding/fuente mÃ¡s compactos + `overflow: hidden` / `box-sizing: border-box` para que el texto quepa sin crecer el contenedor.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola, Seguimiento y Radio PTT â€” franja superior ~23px alineada a leyenda de rutas.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-12 â€” UX: leyenda de rutas a inferior izquierda

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - `.track-route-legend` deja de anclarse debajo del chrome de presencia (En lÃ­neaâ€¦) y pasa a **esquina inferior izquierda** (`bottom: 12px; left: 10px`).
  - Zoom Leaflet sigue en bottomright; no se mueve En lÃ­nea ni Maximizar.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola (mapa con ruta activa) â€” leyenda verde/amarillo abajo-izquierda.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css` (markup en `DispatchMap.jsx`)

## 2026-09-12 â€” PrecisiÃ³n fronteras IV R.M. (NL/TM/SLP) + fill SVG

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Restaurado `ivRmStates.json` detallado (~333 KB; NL ~2.3k / TM ~6.6k / SLP ~5.5k vÃ©rtices) desde `38ffa58:web/...` â€” deja de usarse mexicoHigh crudo para IV R.M.
  - Renderer **`L.svg`** intacto (fill fiable); stroke **1.15 px**.
  - `availableStateFeatures`: mxEstados para lazy; **bundle detallado gana** en NL/TM/SLP (nunca concat duplicada).
  - Resto de estados: sigue `mxEstados.json` (mexicoHigh); no hay fuente mÃ¡s densa empaquetada sin subir mucho el peso.
- **Por quÃ© / notas:** El fix de relleno habÃ­a sustituido el detallado por mexicoHigh; el color volviÃ³ pero las fronteras se veÃ­an â€œpoligonalesâ€. Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** â€” fill visible y bordes alineados al tile.
- **Archivos / refs:** `data/ivRmStates.json`, `mxStatesGeo.js`, `IvRmStatesLayer.jsx`, `ivRmStatesConfig.js`

## 2026-09-12 â€” UX: chrome mapa mÃ¡s bajo (Consola / Seguimiento / Radio)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Altura de leyenda + Maximizar: **2.5rem â†’ 1.85rem** (misma que Radio PTT embed).
  - Homologados Consola (`.map-frame-chrome`), Seguimiento (`.lt-map-chrome`) y Radio; padding/fuente de leyenda y `.lt-max-btn--map` mÃ¡s compactos.
  - Ajuste de `.track-route-legend` top al nuevo chrome.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola, Seguimiento y Radio PTT â€” franja superior misma altura.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-12 â€” UX: miembros inline bajo el grupo seleccionado

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - En AdministraciÃ³n â†’ Grupos, el panel de miembros ya no aparece al final de la pÃ¡gina: se inserta **inmediatamente debajo** de la tarjeta del grupo al pulsar Â«MiembrosÂ» (accordion, un grupo abierto a la vez; segundo clic cierra).
  - Misma funcionalidad: lista, roles, quitar miembro, cambiar/quitar avatar del canal.
- **Por quÃ© / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: Ctrl+F5 en `/despacho/administracion/grupos`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 â€” Limpieza de cÃ³digo muerto del rail (sub-enlaces del despacho)

- **Tipo:** mejora
- **Ãrea:** web
- **QuÃ©:**
  - `DispatchLayout.jsx`: eliminado el andamiaje del viejo submenÃº `<details>` que quedÃ³ sin usar tras convertir CatÃ¡logos / AdministraciÃ³n / ConfiguraciÃ³n en enlaces Ãºnicos: `CATALOG_LINKS`, `ADMIN_LINKS`, `CONFIG_LINKS`, `SUB_NAV_DEFAULTS`, `configLinks`, `renderSubLinks`, `subSlotClass`, `orderLinksBySaved`, `mergeSubOrder`, `loadSubNavOrder`, `saveSubNavOrder`, estado `subNavOrder`/`subDrag`/`subOver`, handlers `onSubDrag*`/`onSubDrop`, `reorderSubNav` y la clave `tacticalptx_mod_sub_nav_order`.
  - Simplificados los guards de `onNavDragOver`/`onNavDrop` que solo servÃ­an para rechazar drops de sub-Ã­tems (ya imposibles). El drag del rail de mÃ³dulos (`tacticalptx_mod_nav_order`) se conserva intacto.
  - `institutional.css`: quitadas las reglas exclusivas del submenÃº (`.cc-mod-group*`, `summary`, `.cc-mod-sub*`), sin tocar `.cc-mod-drag-handle` ni `.cc-mod-slot` (siguen en uso).
- **Por quÃ© / notas:** Verificado con bÃºsqueda en todo `frontend/src` que ningÃºn sÃ­mbolo/clase eliminada se usa fuera de estos dos archivos. El reordenamiento de pestaÃ±as vive ahora en `ReorderableCatalogTabs.jsx` (claves `tacticalptx_{catalog,admin,config}_tabs_order`). `npm run build` OK (âˆ’2 kB CSS, âˆ’2 kB JS). Sincronizado a `C:\pulsanet-dev\frontend\` (el worktree DEV aÃºn tenÃ­a el rail viejo).
- **Archivos / refs:** `frontend/src/dispatch/DispatchLayout.jsx`, `frontend/src/institutional.css`

## 2026-09-12 â€” LiveKit Radio: causa real (API/Caddy + race PTT) y hardening

- **Tipo:** fix | ops
- **Ãrea:** web | backend | infra
- **QuÃ©:**
  - El soft-fix previo (quitar `192.168.1.66`) no bastaba en HTTPS: ahÃ­ ya se usa `wss://host` (proxy `/rtc`). SeÃ±al + E2EE `room.connect` OK en Chrome (~0.5â€“1.5s) vÃ­a Vite y DuckDNS.
  - Causa operativa: Caddy reventaba con 502 `dial tcp 127.0.0.1:4000 connection refused` (API a veces solo en `::` / procesos `--watch` huÃ©rfanos) mientras el despacho usaba `https://pulsanet.duckdns.org/despacho/radio`.
  - Hardening: API `listen(..., '0.0.0.0')`; `usePtt` dedupe de connects, Ã©xito parcial multi-canal, limpia banner al conectar, log `[PTT LiveKit]` con URL real; limpios watchers huÃ©rfanos.
- **Por quÃ© / notas:** El banner rojo aparece si *todos* los canales Hablar fallan al conectar LiveKit; un canal fallido ya no tumba el resto.
- **Archivos / refs:** `frontend/src/usePtt.js`, `backend/src/server.js`, Caddy `API_UPSTREAM` â†’ `:4000`, LiveKit `:7880`
## 2026-09-12 â€” Zumbido: siempre vibra+suena (sonido BG = canal FCM)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - Requisito corregido: en los 3 contextos el zumbido recibido vibra Y suena.
  - `applyReceivedNudgeFeedback` siempre vibra+tono (sin ramas por chat/foco); debounce tono 400 ms (alineado a vibraciÃ³n).
  - Background: vibraciÃ³n en isolate FCM + sonido por canal dedicado `tacticalptx_nudge_v1` / `nudge_buzz` â€” **sin** AudioPlayer en el isolate (anti WhatsApp mic).
- **Archivos / refs:** message_tone.dart, push_service.dart (canal zumbido), direct_pane.dart (comentario)
- **Nota:** APK pendiente (otro agente compila / bug mic).

## 2026-09-12 â€” Mobile DM zumbido: icono in-field + reglas de feedback

- **Tipo:** ux | fix
- **Ãrea:** mobile
- **QuÃ©:**
  - BotÃ³n zumbido: icono vector gris Icons.vibration **dentro** del campo Mensaje, a la derecha del emoji (mismo estilo que smiley).
  - Feedback al recibir (corrigido despuÃ©s): siempre vibra+suena; en BG el sonido es el canal FCM `nudge_buzz`, no AudioPlayer. Helper applyReceivedNudgeFeedback.
- **Por quÃ© / notas:** Antes vibraba tambiÃ©n con el chat abierto; el emoji colorido quedaba fuera del composer.
- **Archivos / refs:** direct_pane.dart, message_tone.dart, panic_vibration.dart, push_service.dart, radio_shell.dart, channel_session.dart, private_call_screen.dart
  - APK debug instalado en emulator-5554: C:\\pulsanet_soporte\\APK\\TacticalPtx-PRUEBA-zumbido-20260912-1757.apk (~233 MB). API_BASE=https://pulsanet.duckdns.org.

## 2026-09-12 â€” ChatInbox: alinear estrella favorito en lista

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - `.wa-inbox-bottom` pasa a `align-items: center` (el top sigue en `baseline`).
  - Nudge Ã³ptico `translateY(-0.06em)` en SVG de estrella lista (`.wa-inbox-star`) y botones favorito (`.wa-inbox-fav-btn`, incl. header DM).
- **Por quÃ© / notas:** El path Material de la estrella es bottom-heavy; con badge/call/video se veÃ­a baja.
- **Archivos / refs:** `frontend/src/styles.css` (sync `pulsanet-dev`)

## 2026-09-12 â€” CatÃ¡logos: sin subtÃ­tulo, pestaÃ±as doradas y reordenables

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
  - Quitado el subtÃ­tulo bajo el tÃ­tulo en CatÃ¡logos / AdministraciÃ³n / ConfiguraciÃ³n (mÃ¡s espacio vertical).
  - Color mostaza/oro institucional (`#9a7b2f`) pasado a las pestaÃ±as activas (texto + underline).
  - PestaÃ±as arrastrables para reordenar; orden en `localStorage` (`tacticalptx_catalog_tabs_order`, `_admin_`, `_config_`). Cursor `pointer` / `grabbing` al arrastrar.
- **Archivos / refs:** `ReorderableCatalogTabs.jsx`, `CatalogsLayout.jsx`, `AdminLayout.jsx`, `ConfigLayout.jsx`, `command-center.css`, `institutional.css`

## 2026-09-12 â€” LiveKit audio: diagnÃ³stico y fix URL LAN

- **Tipo:** fix | ops
- **Ãrea:** web | backend | infra
- **QuÃ©:**
  - Diagnosticado error Â«No se pudo conectar el audio (LiveKit)Â»: API solo responde por **HTTPS** (`http://:4000` da empty reply; health OK por `https://`); seÃ±al LiveKit OK vÃ­a Vite/Caddy `/rtc` y DuckDNS; WebRTC `room.connect` verificado en Chrome (connected ~1.5s).
  - Reiniciado `livekit-server` (node-ip pÃºblico vigente `189.152.160.81`).
  - Quitado hardcode muerto `192.168.1.66` en `publicLiveKitUrl` (LAN real `192.168.1.216` / `LIVEKIT_LAN_HOST`); fallback backend sin `.66` stale.
- **Por quÃ© / notas:** El fallback `.66` hacÃ­a timeout en HTTP/LAN; en HTTPS la consola ya usaba same-origin `wss://host` (proxy `/rtc`).
- **Archivos / refs:** `frontend/src/livekitUrl.js`, `backend/src/services/livekit.js`, LiveKit `:7880`
## 2026-09-12 â€” DM header: iconos llamada/video sin relleno verde

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Quitado el fondo verde de los botones de llamada/videollamada en el header del DM (mismo estilo que favorito). Iconos desde Escritorio\Iconos (`telefono.png`, `videollamada.png`) en `frontend/public/icons/`.
- **Archivos / refs:** `DirectChat.jsx`, `styles.css`, `public/icons/telefono.png`, `public/icons/videollamada.png`


## 2026-09-12 â€” Zumbido Messenger + no secuestrar mic (WhatsApp)

- **Tipo:** feature | fix
- **Ãrea:** mobile | web | backend
- **QuÃ©:**
  - Zumbido: buzz aproximado (`nudge_buzz.wav`), vibraciÃ³n/shake ~1.45 s, hasta **5** seguidos y luego **10 s** de espera.
  - Etiqueta **Â¡Zumbido!** (ya no Â«nudgeÂ») en inbox/previews/notificaciones; FCM `dm_nudge` abre el DM.
  - Anti-regresiÃ³n audio: tonos con `assistanceSonification` (sin voiceCommunication); al minimizar sin PTT/llamada se hace `downgradeFromVoice`; en FCM background solo vibra (sonido = notificaciÃ³n). Evita aviso WhatsApp Â«no se pueden grabar mensajes de voz durante una llamadaÂ».
  - UI: cÃ­rculos header DM y dock Colgar homologados.
- **Archivos / refs:** `dm.js`, `fcm.js`, `formatMessage`, `DirectChat`/`ChatInbox`, `audio_session_setup.dart`, `message_tone.dart`, `push_service.dart`, `radio_shell.dart`, `panic_vibration.dart`, `assets/sounds/nudge_buzz.wav`

## 2026-09-12 â€” APK prueba chat zumbido (debug)

- **Tipo:** fix | ops
- **Ãrea:** mobile
- **QuÃ©:**
  - Corregido fallo de compile: restaurado `call_ringtone.dart`; `onUpdateAvailable` en `app_update`; `intent` en IncomingCallScreen; `required` en E2EE; colores `kInstDangerSoft` / `kInstCallSurfaceHi`.
  - APK debug de prueba (no OTA) con zumbido, etiqueta Imagen y picker solo documentos: `C:\pulsanet_soporte\APK\TacticalPtx-PRUEBA-chat-zumbido-20260912-1621.apk` (~204 MB).
  - `API_BASE=https://pulsanet.duckdns.org`; instalado en emulador `emulator-5554`.
- **Archivos / refs:** `mobile/lib/call_ringtone.dart`, `app_update.dart`, `livekit_e2ee.dart`, `theme.dart`, `incoming_call_screen.dart`, chat attach sheet / media_kind / direct_pane

## 2026-09-12 Ã¢â‚¬â€ Inbox chat: mostrar todos los contactos

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - La lista izquierda de `ChatInbox` vuelve a incluir **contactos sin historial DM** (preview Ã‚Â«Toca para escribirÃ‚Â»), alineado con mobile y DirectChat; antes solo listaba conversaciones con mensajes.
  - Despacho/admin: `DirectChat` y Ã‚Â«Nuevo chatÃ‚Â» piden contactos con `scope=org` (toda la org); operadores siguen en `shared` (comparten grupo).
- **Por quÃƒÂ© / notas:** En despacho Radio el usuario no veÃƒÂ­a a todos los contactos; el panel forzaba `shared` y omitÃƒÂ­a contactos sin chat previo.
- **Archivos / refs:** `ChatInbox.jsx`, `DirectChat.jsx`, `NewChatSheet.jsx`

## 2026-09-12 Ã¢â‚¬â€ ConfiguraciÃƒÂ³n Ã¢â€ â€™ Estados (delimitaciones mapa)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Nueva pÃƒÂ¡gina **ConfiguraciÃƒÂ³n Ã¢â€ â€™ Estados** para activar/desactivar y colorear las delimitaciones IV R.M. (NL / Tamaulipas / SLP) en Consola, Seguimiento y Radio. Preferencias en `localStorage` (`tacticalptx_iv_rm_states_v1`); la capa `IvRmStatesLayer` re-rasteriza en Mercator segÃƒÂºn config.
- **Archivos / refs:** `ConfigStates.jsx`, `ivRmStatesConfig.js`, `IvRmStatesLayer.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Rail: reordenar sub-ÃƒÂ­tems del menÃƒÂº por mÃƒÂ³dulo

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En el rail izquierdo de despacho, los enlaces dentro de cada mÃƒÂ³dulo (CatÃƒÂ¡logos, AdministraciÃƒÂ³n, ConfiguraciÃƒÂ³n) se pueden arrastrar arriba/abajo **solo dentro del mismo mÃƒÂ³dulo**. Orden persistido en `localStorage` (`tacticalptx_mod_sub_nav_order`).
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`

## 2026-09-12 Ã¢â‚¬â€ Mapa estados: alinear ImageOverlay a Mercator

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** La capa de colores IV R.M. se rasteriza en **Web Mercator (EPSG:3857)** (antes equirectangular), para que coincida con las fronteras del mapa base sin desfase.
- **Archivos / refs:** `IvRmStatesLayer.jsx`

## 2026-09-12 Ã¢â‚¬â€ Mapa estados IV R.M.: ImageOverlay sin parpadeo

- **Tipo:** fix | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Los colores de NL / TM / SLP se rasterizan una vez a PNG y se muestran como `ImageOverlay` (escalan con el zoom, sin clear/redraw de Canvas/SVG). Elimina el destello al soltar el zoom.
- **Archivos / refs:** `IvRmStatesLayer.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ DM: zumbido (nudge) con vibraciÃƒÂ³n

- **Tipo:** feature
- **ÃƒÂrea:** web | backend | mobile | database
- **QuÃƒÂ©:** BotÃƒÂ³n **Zumbido** a la izquierda del emoji en chat privado. EnvÃƒÂ­a mensaje `type=nudge`, sacude UI web y vibra el celular (socket + FCM `dm_nudge`). Cooldown 8 s.
- **Archivos / refs:** `031_message_nudge.sql`, `dm.js`, `DirectChat.jsx`, `styles.css`, `api.js`, `api_client.dart`, `direct_pane.dart`, `push_service.dart`, `panic_vibration.dart`

## 2026-09-12 Ã¢â‚¬â€ Chat: adjunto Imagen; documentos tipados

- **Tipo:** ux | fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** MenÃƒÂº adjuntar: **GalerÃƒÂ­a** Ã¢â€ â€™ **Imagen** con icono de paisaje. BotÃƒÂ³n **Documento** solo PDF/Office/texto (sin imagen/video/zip); tope de docs elevado a 5 GB.
- **Archivos / refs:** `DirectChat.jsx`, `WhatsAppChat.jsx`, `styles.css`, `mediaKind.js`, `uploads.js`

## 2026-09-12 Ã¢â‚¬â€ Mapa: estados IV R.M. sin parpadeo al zoom

- **Tipo:** fix | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Las manchas de color de NL / Tamaulipas / SLP ya no desaparecen un instante al hacer zoom. Se dibujan en Canvas (pane propio) en lugar de SVG.
- **Archivos / refs:** `IvRmStatesLayer.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Sitios: preview icono sin cÃƒÂ­rculo; Salir blanco; zoom Esri

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Con icono subido, preview y pin en mapa muestran la imagen sin cÃƒÂ­rculo ni deformar (`object-fit: contain`); el cÃƒÂ­rculo solo si no hay icono. **Salir** del rail en letras blancas. Capas Natural/SatÃƒÂ©lite Esri: `maxNativeZoom` 17 para evitar Ã‚Â«Map data not yet availableÃ‚Â» al acercar.
- **Archivos / refs:** `command-center.css`, `institutional.css`, `mapTiles.js`, `MapMaximizeButton.jsx`

## 2026-09-12 Ã¢â‚¬â€ Mapa: Maximizar Ã¢â€ â€™ Restaurar; sin hint Esc

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En mapa en vivo y seguimiento, el botÃƒÂ³n maximizado dice **Restaurar** (mismo ancho que Maximizar). Se quitÃƒÂ³ la etiqueta Ã‚Â«Esc o ReducirÃ¢â‚¬Â¦Ã‚Â»; el tooltip indica **Restaurar (Esc) para salir**.
- **Archivos / refs:** `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Mapa Maximizar/Restaurar unificado

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n Maximizar/Restaurar compartido (`MapMaximizeButton`) en Consola, Seguimiento y Radio. Texto Restaurar, sin hint Esc visible, tooltip Ã‚Â«Restaurar (Esc) para salirÃ‚Â», mismo ancho. En Consola, misma altura que la leyenda En lÃƒÂ­nea.
- **Archivos / refs:** `MapMaximizeButton.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Geocerca: Guardar/Cancelar con estilo cc-btn

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Botones Guardar / Cancelar (y Eliminar) del borrador de geocerca usan `cc-btn primary` / `ghost` como el resto del panel.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Topbar: Oscuro/Claro mismo ancho; menÃƒÂº Sitios

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El botÃƒÂ³n Oscuro/Claro no cambia de ancho al alternar. En el menÃƒÂº, Ã‚Â«Sitios tÃƒÂ¡cticosÃ‚Â» pasa a **Sitios** (UI y textos visibles).
- **Archivos / refs:** `command-center.css`, `DispatchLayout.jsx`, `AdminLayout.jsx`, `CatalogTacticalSites.jsx`, `CommandCenter.jsx`

## 2026-09-12 Ã¢â‚¬â€ Radio mapa: capas abajo a la izquierda

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En el mapa embebido de Radio PTT, Natural / SatÃƒÂ©lite / Claro pasan a la esquina inferior izquierda. Leyenda y Maximizar siguen arriba.
- **Archivos / refs:** `command-center.css` (`.lt-page--embed-radio .lt-layers`)

## 2026-09-12 Ã¢â‚¬â€ Leyenda mapa: Fuera de lÃƒÂ­nea; PÃƒÂ¡nico oculto

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En la leyenda del mapa, Ã‚Â«Desconectado prolongadoÃ‚Â» pasa a **Fuera de lÃƒÂ­nea**. Se oculta **PÃƒÂ¡nico** por ahora (pendiente reactivar). Pastilla de lista: gris = **Desconectado**; rojo = **Fuera de lÃƒÂ­nea**; verde = **En lÃƒÂ­nea**.
- **Archivos / refs:** `presenceStatus.js`, `PresenceMapLegend.jsx`, `LiveTrackMap.jsx`
- **Pendiente:** volver a mostrar PÃƒÂ¡nico en la leyenda cuando se pida.

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: sin flechas Ã¢â€ â€˜Ã¢â€ â€œ de orden

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Se quitan las flechas subir/bajar en Vista PestaÃƒÂ±as y Encabezado (igual que en Columnas). El orden sigue por arrastre Ã¢â€¹Â®Ã¢â€¹Â®.
- **Archivos / refs:** `ChannelMultiSelect.jsx`

## 2026-09-12 Ã¢â‚¬â€ Topbar: Oscuro del mismo tamaÃƒÂ±o que el badge de rol

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El botÃƒÂ³n Oscuro/Claro en la barra superior queda al mismo alto/padding que la pastilla ROOT (u otro rol) a su izquierda.
- **Archivos / refs:** `command-center.css` (`.cc-theme-toggle`)

## 2026-09-12 Ã¢â‚¬â€ Fix: toast falso al reordenar canales

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Al arrastrar/subir/bajar un grupo en Canales ya no aparece el globo de chat con un mensaje viejo. Se ignora el historial al cambiar de canal PTT y solo se cambia el canal de Hablar si el orden realmente cambia el primario.
- **Archivos / refs:** `ChatInbox.jsx`, `DispatchLayout.jsx`, `RadioPage.jsx`

## 2026-09-12 Ã¢â‚¬â€ ConfiguraciÃƒÂ³n Canales: texto, sin resumen, tarjeta ancha

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** DescripciÃƒÂ³n formal de Canales; se quita el resumen Ã‚Â«Oye / Habla / Video / AlertaÃ‚Â»; la tarjeta usa todo el ancho para mostrar bien las 4 columnas.
- **Archivos / refs:** `ConfigChannels.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Radio mapa: barra de controles mÃƒÂ¡s baja

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En el mapa embebido de Radio (PestaÃƒÂ±as/Encabezado), la leyenda de presencia, Natural/SatÃƒÂ©lite/Claro y Maximizar bajan de ~40 px a ~30 px. Seguimiento completo no cambia.
- **Archivos / refs:** `command-center.css` (`.lt-page--embed-radio .lt-map-chrome`)

## 2026-09-12 Ã¢â‚¬â€ Encabezado: orden de selects y Video completo

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista Encabezado, Escuchar/Hablar/Video/Alerta queda a la **izquierda** e Individual/MÃƒÂºltiple a la **derecha** (como Columnas). El select ya no recorta Ã‚Â«VideoÃ‚Â» ni Ã‚Â«EscucharÃ‚Â».
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Radio PestaÃƒÂ±as/Encabezado: chats, conversaciÃƒÂ³n y mapa 2Ãƒâ€”2

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista PestaÃƒÂ±as o Encabezado, Radio queda en 2Ãƒâ€”2: chats (zona 1), radio intacta (zona 2), conversaciÃƒÂ³n (zona 3) y mapa de Seguimiento (zona 4). Vista Columnas no cambia.
- **Por quÃƒÂ© / notas:** El hueco izquierdo del bloque de radio pasa a ser la lista de chats; el mapa reutiliza el de seguimiento (sin lista de personas). En telÃƒÂ©fono (Ã¢â€°Â¤720 px) el mapa de Radio no se monta: el ÃƒÂºtil estÃƒÂ¡ en Seguimiento. Barra del mapa: leyenda, Natural/SatÃƒÂ©lite/Claro y Maximizar a la misma altura y botones un poco mÃƒÂ¡s anchos. Radio y mapa son tarjetas distintas; hueco entre zonas mÃƒÂ¡s chico. El cuadro de canales no se recorta (fila 1 = alto del cuadro; sin overflow hidden / backdrop-filter en Firefox/Safari).
- **Archivos / refs:** `RadioPage.jsx`, `LiveTrackMap.jsx`, `styles.css`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Fix: GPS en vivo ya no sale Ã‚Â«Fuera de lÃƒÂ­neaÃ‚Â»

- **Tipo:** fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Si el GPS estÃƒÂ¡ fresco (avatar verde / Ã‚Â«En vivo Ã‚Â· compartiendoÃ‚Â»), la pastilla pasa a **En lÃƒÂ­nea**. Antes usaba solo `last_seen` del socket y podÃƒÂ­a marcar desconectado prolongado. El reporte GPS tambiÃƒÂ©n actualiza last_seen.
- **Archivos / refs:** `presenceStatus.js`, `LiveTrackMap.jsx`, `locations.js`, `presence.js`

## 2026-09-12 Ã¢â‚¬â€ Chats: Ã‚Â«N en lÃƒÂ­neaÃ‚Â» en Todos y Grupos

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En la lista de chats (Todos / Grupos) cada canal muestra **N en lÃƒÂ­nea**. Al abrir el grupo, el encabezado usa la presencia de ese canal (no solo el de PTT).
- **Archivos / refs:** `ChatInbox.jsx`, `usePtt.js` (`onlineByGroup`), `DispatchLayout.jsx`, `RadioPage.jsx`

## 2026-09-12 Ã¢â‚¬â€ Seguimiento: pastilla Fuera de lÃƒÂ­nea (gris/rojo)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En la lista de personas, **OFF** pasa a **Fuera de lÃƒÂ­nea**. Gris si estÃƒÂ¡ desconectado; rojo si supera el umbral de desconexiÃƒÂ³n (mismo criterio de los pines).
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 Ã¢â‚¬â€ Quitar Ã‚Â«En lÃƒÂ­neaÃ‚Â» del bloque Radio

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Se elimina la lista Ã‚Â«En lÃƒÂ­neaÃ‚Â» debajo de canales/PTT. QuiÃƒÂ©n estÃƒÂ¡ se ve en el chat de grupo (encabezado Ã‚Â«N en lÃƒÂ­neaÃ‚Â»).
- **Archivos / refs:** `RadioPage.jsx`

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: mismo ancho que una columna

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El cuadro en PestaÃƒÂ±as/Encabezado usa el mismo ancho que **una** columna de Vista Columnas (4 pistas + PTT). Sigue a la izquierda de los botones, bloque a la derecha.
- **Archivos / refs:** `styles.css` (`.radio-ops-primary` grid)

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: cuadro de canales con ancho fijo

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El cuadro en PestaÃƒÂ±as/Encabezado deja de aplastarse: 28rem fijos, 1 columna y el `.channel-col` al 100%. Sigue pegado a la izquierda del PTT, bloque a la derecha.
- **Archivos / refs:** `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Etiqueta al aire: punto medio entre cargo y canal

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Ã‚Â«ENCARGADO Ã‚Â· Grupo para pruebasÃ‚Â» (punto medio en lugar de coma).
- **Archivos / refs:** `radioSpeakerLabel.js`

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: cuadro + PTT juntos a la derecha

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En PestaÃƒÂ±as/Encabezado el cuadro de canales queda a la izquierda de Enviar alerta / Audio / Video / PTT, pegados, y el bloque entero alineado a la **derecha**. El cuadro tiene ancho fijo (~22rem) para no aplastarse.
- **Archivos / refs:** `styles.css` (`.radio-ops-primary:has(.layout-tabs|.layout-select)`)

## 2026-09-12 Ã¢â‚¬â€ Radio PestaÃƒÂ±as/Encabezado: fila canales|PTT sin hueco

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Se completa el layout: `radio-ops-primary` agrupa canales + PTT en una fila. En PestaÃƒÂ±as/Encabezado van pegados (`flex-start`); en Columnas siguen con espacio. Online/errores abajo en `radio-ops-secondary`.
- **Archivos / refs:** `RadioPage.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Franja PTT mini oculta en Radio (visible en el resto)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** `cc-radio-strip` se oculta en `/despacho/radio` (ahÃƒÂ­ estÃƒÂ¡ el PTT grande) y se muestra en Consola, mapa y demÃƒÂ¡s rutas del despacho.
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-09-12 Ã¢â‚¬â€ Franja PTT mini solo en /despacho/radio

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** La barra `cc-radio-strip` (dock + PTT mini) solo se muestra en `/despacho/radio`. En Consola, mapa y resto del despacho ya no aparece.
- **Archivos / refs:** `DispatchLayout.jsx`
- **Nota:** En otras rutas el radio sigue en keepalive (audio); el PTT grande estÃƒÂ¡ en la pÃƒÂ¡gina Radio.

## 2026-09-12 Ã¢â‚¬â€ Mute + 1 al aire: incluir canal en etiqueta

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Con radio silenciada y una persona al aire: **Radio silenciada Ã‚Â· ENCARGADO, GrupoÃ¢â‚¬Â¦** (mismo formato que sin mute). MÃƒÂ¡s adelante se revisan/retoman etiquetas del mini PTT.
- **Archivos / refs:** `radioSpeakerLabel.js`

## 2026-09-12 Ã¢â‚¬â€ Etiquetas PTT (cargo, mute, varios) + bloque canales a la derecha

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Etiquetas bajo PTT: cargo prioritario, Ã‚Â«EstÃƒÂ¡s al aireÃ‚Â», mute combinado, Ã‚Â«Varios al aireÃ‚Â» si Ã¢â€°Â¥2 hablan.
  - `usePtt` rastrea varios speakers e incluye canales Escuchar en joins.
  - PestaÃƒÂ±as/Encabezado: canales + PTT juntos anclados a la **derecha** (`flex-end`, sin hueco). Columnas sin cambio.
- **Archivos / refs:** `radioSpeakerLabel.js`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: canales pegados al PTT

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En PestaÃƒÂ±as/Encabezado, el cuadro de canales queda a la izquierda del PTT pero **junto** (`flex-start`, sin `space-between`). Columnas sigue con espacio entre bloques.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck:has(.layout-tabs|.layout-select)`)

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: canales izq. / PTT der. (como Columnas)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Se corrige el orden: en PestaÃƒÂ±as y Encabezado el cuadro de canales va a la izquierda y los botones/PTT a la derecha (como en la referencia / Columnas). Se revirtiÃƒÂ³ el `order: -1` que los invertÃƒÂ­a.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck`)

## 2026-09-12 Ã¢â‚¬â€ PestaÃƒÂ±as/Encabezado: canales a la derecha del PTT

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista PestaÃƒÂ±as o Encabezado, el cuadro de canales queda a la derecha de los botones/PTT (ya no pegado a la izquierda). En Columnas el layout no cambia.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck:has(.layout-tabs|.layout-select)`)

## 2026-09-12 Ã¢â‚¬â€ Encabezado/PestaÃƒÂ±as: panel Escuchar a la derecha

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista Encabezado, el select Escuchar/Hablar/Video/Alerta pasa a la derecha (Individual/MÃƒÂºltiple a la izquierda). En PestaÃƒÂ±as, Individual/MÃƒÂºltiple queda alineado a la derecha como en Columnas.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Alinear ancho del buscador de canales

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El input Ã‚Â«Buscar en listaÃ¢â‚¬Â¦Ã‚Â» alinea su ancho con la lista de checks/radios (se quitÃƒÂ³ el padding horizontal extra de `.channel-col-tools`).
- **Archivos / refs:** `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Hints fijos Individual/MÃƒÂºltiple (sin resumen dinÃƒÂ¡mico)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El pie de cada columna ya no cambia a Ã‚Â«Oyendo NÃ¢â‚¬Â¦ / PTT a NÃ¢â‚¬Â¦ / etc.Ã‚Â» al marcar varios; siempre muestra la ayuda Individual vs MÃƒÂºltiple. El conteo sigue en Ã‚Â«N de M seleccionadosÃ‚Â».
- **Archivos / refs:** `ChannelMultiSelect.jsx`

## 2026-09-12 Ã¢â‚¬â€ Marco visual en columnas de canales

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Cada columna (Escuchar/Hablar/Video/Alerta) va en un Ã‚Â«cuadritoÃ‚Â»: borde, radio 12px, fondo suave y sombra ligera, con lista e hint dentro.
- **Archivos / refs:** `styles.css` (`.channel-col`)

## 2026-09-12 Ã¢â‚¬â€ Etiquetas Individual/MÃƒÂºltiple + badge OIR

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Hints claros por columna (Escuchar/Hablar/Video/Alerta) segÃƒÂºn Individual o MÃƒÂºltiple.
  - Badge **OIR** en canales marcados en Escuchar (junto a PTT / VID / ALE).
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Vista Columnas: ocultar flechas Ã¢â€ â€˜Ã¢â€ â€œ

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista **Columnas**, se ocultan las flechas subir/bajar de cada canal para ganar espacio; el orden sigue por arrastre (Ã¢â€¹Â®Ã¢â€¹Â®). En PestaÃƒÂ±as/Encabezado las flechas siguen visibles.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Vista canales: opciÃƒÂ³n Ã‚Â«EncabezadoÃ‚Â»

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Vista de canales, Ã‚Â«Select en encabezadoÃ‚Â» pasa a **Encabezado**.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `ConfigChannels.jsx`

## 2026-09-12 Ã¢â‚¬â€ Radio: Canal libre debajo PTT + select sin borde

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Ã‚Â«Canal libreÃ‚Â» agrupado bajo los botones (columna `radio-ops-actions`), ya no al lado del PTT.
  - Select Individual/MÃƒÂºltiple sin contorno negro (`appearance: none` + sin outline).
- **Archivos / refs:** `RadioPage.jsx`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ Reaplicar pedidos 08:00Ã¢â‚¬â€œ08:19 (Radio/mapa/sesiÃƒÂ³n)

- **Tipo:** fix | ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Ã‚Â«Canal libreÃ‚Â» debajo de PTT/Videollamada en Radio.
  - Contador Ã‚Â«N de M seleccionadosÃ‚Â» alineado a la derecha antes del `?`.
  - PTT: `unlockMediaAudio` + resume AudioContext antes de hablar (mini PTT y botÃƒÂ³n grande).
  - `SessionKeepaliveHost` + `ensureFreshSession` (JWT ~15 min antes); mapa/seguimiento solo muestran error tras **3** fallos seguidos; sockets con `socketAuth`.
  - Radio parked fuera de pantalla (evita capa invisible que congela clics).
  - Cargo completo en pines (sin ellipsis de 118px).
- **Archivos / refs:** `RadioPage.jsx`, `SessionKeepaliveHost.jsx`, `api.js`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `mapAvatarIcon.js`, `command-center.css`, `styles.css`

## 2026-09-12 Ã¢â‚¬â€ UI canÃƒÂ³nica `frontend\` + APK a pulsanet_soporte

- **Tipo:** infra | docs | fix
- **ÃƒÂrea:** infra | web | docs | mobile | ops
- **QuÃƒÂ©:**
  - Unificados ambos ÃƒÂ¡rboles a `frontend\` (prod `:5173`, DEV `:5273`). Eliminado leftover `web\` de `C:\pulsanet` (copia idÃƒÂ©ntica archivada en `pulsanet_soporte\Archivo\web-leftover-C-pulsanet-20260912`).
  - Scripts/docs alineados: `start-web.cmd`, `LEVANTAR-TACTICALPTX.bat`, `Watch-Stack.ps1`, `docker-compose.prod.yml`, `SOPORTE.md`, `UBICACION_PROYECTO.md`, `README.md`.
  - `Publish-ApkUpdate.ps1` archiva APK vÃƒÂ­a `Resolve-AuxRoot.ps1` Ã¢â€ â€™ `C:\pulsanet_soporte\APK` (OTA sigue en `backend\app-updates`).
  - Corregido bug en `pulsanet-dev\LEVANTAR-TACTICALPTX.bat` (`pushd` a `web\` inexistente).
- **Por quÃƒÂ© / notas:** El organizador portable habÃƒÂ­a dejado prod como `web\`; contradecÃƒÂ­a el rename pedido. Vite ya corrÃƒÂ­a desde `frontend\`.
- **Archivos / refs:** `infra/start-web.cmd`, `infra/start-frontend.cmd`, `mobile/scripts/Publish-ApkUpdate.ps1`, `docs/SOPORTE.md`

## 2026-09-12 Ã¢â‚¬â€ Producto portable: soporte fuera y BD/arranque para mÃƒÂ¡quina nueva

- **Tipo:** infra | docs | ops
- **ÃƒÂrea:** infra | docs | database | ops
- **QuÃƒÂ©:**
  - Auxiliar unificado en `C:\pulsanet_soporte` (Documentos, Logs/restore-sep11, Brand, Cursor, APK). En el repo queda un puntero `Soporte\README.md`.
  - UI canÃƒÂ³nica: `frontend\` en prod y DEV (puertos distintos). *(Nota: una entrada posterior unifica el rename; no usar `web\`.)*
  - Nuevo `CREAR-O-ACTUALIZAR-BD.bat` (idempotente: crea BD si falta, schema si vacÃƒÂ­a, migraciones 001Ã¢â€ â€™030+; no DROP).
  - `LEVANTAR-TACTICALPTX.bat` y `LEVANTAR-DEV.bat` mÃƒÂ¡s claros; logs en `pulsanet_soporte\Logs` o `var\logs`.
- **Por quÃƒÂ© / notas:** Copiar el programa a otra mÃƒÂ¡quina sin mezclar dumps/IA ni las dos UIs.
- **Archivos / refs:** `CREAR-O-ACTUALIZAR-BD.bat`, `backend/src/scripts/apply-all-migrations.js`, `docs/SOPORTE.md`, `infra/Resolve-AuxRoot.ps1`

## 2026-09-12 Ã¢â‚¬â€ Restaurar UI y features al estado del 11-sep ~15:41

- **Tipo:** fix | ops
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:**
  - DuckDNS servÃƒÂ­a el `web/` del merge de las 08:34 (rama 6-sep), no el trabajo de `pulsanet-dev/frontend` + parches del 11.
  - Restaurado el panel: mapa como inicio, catÃƒÂ¡logos (jerarquÃƒÂ­as/grados/empleos), admin (usuarios/grupos/sitios tÃƒÂ¡cticos), config (canales 4 columnas, grabaciones, presencia, respaldos).
  - Reaplicados parches del 11-sep hasta las 15:41: Escuchar/Hablar/Video/Alerta, Individual/MÃƒÂºltiple, PTT multi-canal, Radio (Enviar alerta / Audio / Videollamada).
  - Backend alineado con `pulsanet-dev` (rutas presencia, sitios tÃƒÂ¡cticos, migraciones 023Ã¢â‚¬â€œ030).
- **Por quÃƒÂ© / notas:** El trabajo de ayer no estaba commiteado; un merge de esta maÃƒÂ±ana pisÃƒÂ³ `web/`. Copia previa en `Soporte/Logs/restore-sep11/`.
- **Archivos / refs:** `web/src/**`, `backend/src/**`, `database/migrations/023Ã¢â‚¬â€œ030`

## 2026-09-12 Ã¢â‚¬â€ DuckDNS en blanco: faltaba RemoteMonitorConference

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - `https://pulsanet.duckdns.org/` devolvÃƒÂ­a HTML pero React no montaba (`#root` vacÃƒÂ­o).
  - Vite fallaba al resolver `./RemoteMonitorConference` desde `DispatchVideo.jsx` / `CommandCenter.jsx` (archivo no estaba en el tip del merge).
  - Restaurado `web/src/dispatch/RemoteMonitorConference.jsx` desde historial de agente; login vuelve a renderizar.
- **Archivos / refs:** `web/src/dispatch/RemoteMonitorConference.jsx`

## 2026-09-12 Ã¢â‚¬â€ Reinicio stack tras recuperaciÃƒÂ³n + fix FCM

- **Tipo:** fix | ops
- **ÃƒÂrea:** backend | web | ops
- **QuÃƒÂ©:**
  - Reiniciados API (:4000) y Web (:5173); health **1.8.84** ready.
  - La rama recuperada importaba `notifyUserDevicesDataOnly` pero no existÃƒÂ­a Ã¢â€ â€™ API no arrancaba; export aÃƒÂ±adido en `fcm.js`.
  - `/api/group-video` responde (401 sin token = ruta viva).
- **Archivos / refs:** `backend/src/services/fcm.js`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-09-12 Ã¢â‚¬â€ RecuperaciÃƒÂ³n rama video-panic + anti-regresiÃƒÂ³n

- **Tipo:** fix | ops
- **ÃƒÂrea:** web | backend | mobile | docs
- **QuÃƒÂ©:**
  - `main` estaba en **1.8.51** mientras el avance real vivÃƒÂ­a en `cursor/video-panic-stable-domain` (Video, cÃƒÂ¡mara remota, layout moderno, DuckDNS, etc.).
  - **Fast-forward** de esa rama a `main` (~17k lÃƒÂ­neas / 116 archivos).
  - Reparado `mapTiles.js` incompleto en el tip (`tileLayerProps`, `mapWorldProps`, zoom, **sin atribuciÃƒÂ³n Leaflet**).
  - Reaplicado cargo completo en pines + API ubicaciones.
  - Regla Cursor **anti-regresiÃƒÂ³n** (usuario + `.cursor/rules/anti-regresion.mdc`).
- **Por quÃƒÂ© / notas:** DuckDNS servÃƒÂ­a el tip viejo de `main`. PTT Individual/MÃƒÂºltiple puede seguir incompleto si solo existÃƒÂ­a en working tree no commiteado.
- **Archivos / refs:** merge `cursor/video-panic-stable-domain`, `mapTiles.js`, `mapAvatarIcon.js`, `DispatchVideo.jsx`, `groupVideo.js`

## 2026-09-06 Ã¢â‚¬â€ Fix re-ring en llamada + altavoz por defecto (1.8.84+94)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - No abrir Contestar encima si ya hay llamada 1:1 (PrivateCallGate + guardas en socket/push/shell).
  - Backend 409 si caller/callee ya tienen llamada activa (evita re-marcar).
  - Voz: **auricular por defecto** al contestar (no altavoz); video/radio siguen manos libres.
  - Radio ensureBackgroundAudio / 
eleasePtt ya no fuerzan altavoz mientras hay llamada 1:1.
- **Archivos / refs:** private_call_gate.dart, private_call_screen.dart, channel_session.dart, radio_shell.dart, calls.js, dm.js

## 2026-09-06 Ã¢â‚¬â€ Panel web progresivo (fases 0Ã¢â‚¬â€œ5)

- **Tipo:** feature | ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - **F0Ã¢â‚¬â€œ1:** tokens/breakpoints (`720`/`960`), `useMediaQuery`, shell phone (bottom nav Radio/Chats/Personas/MÃƒÂ¡s), rail oculto, safe-area.
  - **F2:** inbox lista XOR hilo en phone; AtrÃƒÂ¡s; tab Chats Ã¢â€ â€™ lista; Personas/peer sheet full-bleed; touch Ã¢â€°Â¥44px.
  - **F3:** overlays llamada `100dvh`+safe-area; `unlockMediaAudio` unificado; warmUp media con errores claros; mapa/video fullscreen `dvh`.
  - **F4:** Command Center tabs Mapa|Actividad Ã¢â€°Â¤960; LiveTrack bottom sheet + capas drawer; Video mÃƒÂ¡x. 2 monitores en phone; tablas/catÃƒÂ¡logos 1 col / scroll.
  - **F5:** `manifest.webmanifest`, iconos, `offline.html`, SW shell cache (sin API/socket/LiveKit); higiene `(pointer: coarse)`.
- **Por quÃƒÂ© / notas:** web mÃƒÂ³vil = respaldo / mesa ligera; sin paridad FGS Flutter. Matriz: `Soporte/Documentos/MATRIZ_PRUEBA_PANEL_WEB.md`.
- **Archivos / refs:** responsive.css, useMediaQuery.js, DispatchLayout.jsx, ChatInbox.jsx, unlockMediaAudio.js, PrivateCall*, CommandCenter.jsx, LiveTrackMap.jsx, DispatchVideo.jsx, sw-notify.js, manifest.webmanifest

## 2026-09-06 Ã¢â‚¬â€ Calidad de video: nitidez sobre fluidez (1.8.83+93)

- **Tipo:** fix | mejora
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - `degradationPreference` pasa de `maintainFramerate` a `maintainResolution`: el encoder baja FPS en vez de reescalar a 360p (se veÃƒÂ­a borroso aun en la misma red).
  - Bitrate alineado a **3.2 Mbps** en mÃƒÂ³vil y web (antes mÃƒÂ³vil publicaba 2.8 con captura de 3.2).
  - Web: `adaptiveStream: false` Ã¢â‚¬â€ el mosaico enlaza por `srcObject`, asÃƒÂ­ que adaptiveStream no observaba los elementos y solo podÃƒÂ­a pausar tracks.
- **Por quÃƒÂ© / notas:** VP8 por software en Android satura CPU a 720p30; con `maintainFramerate` WebRTC reescala la resoluciÃƒÂ³n y la imagen se ve suave/pixelada aunque haya ancho de banda de sobra.
- **Archivos / refs:** video_streaming_config.dart, videoStreaming.js

## 2026-09-06 Ã¢â‚¬â€ Fix switch frontal/trasera Ver cÃƒÂ¡mara (1.8.82+92)

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - `setCameraEnabled(false/true)` solo muteaba el mismo track: no cambiaba facing.
  - Switch ahora: `setCameraPosition` Ã¢â€ â€™ recrear track (`removePublishedTrack` + `createCameraTrack`) Ã¢â€ â€™ fallback.
  - Socket dedicado tambiÃƒÂ©n escucha `call:remote_control` (backup + dedupe).
- **Archivos / refs:** remote_camera_session.dart

## 2026-09-06 Ã¢â‚¬â€ Fix Ver cÃƒÂ¡mara splash + SafeArea Llamadas (1.8.81+91)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - FCM `private_remote_camera` ya no usa `IncomingCallWake`/`launchApp` si auto-accept (evita recrear Activity Ã¢â€ â€™ splash).
  - Boot: si hay pending remote cam, se acepta en silencio y se difiere OTA forzada ~4 s.
  - FGS: al activar cÃƒÂ¡mara se hace `forceRestart` para aplicar tipo `camera` (Android 14+).
  - Wake background: persist + bring UI; FGS camera lo arranca el isolate principal.
  - `PrivateCallHost`: si despacho marca `handled`, no abre overlay 1:1.
  - Cabecera **Llamadas**: `SafeArea` para no montarse bajo la barra de estado.
- **Archivos / refs:** main.dart, push_service.dart, remote_camera_wake.dart, incoming_call_wake.dart, background_radio.dart, radio_shell.dart, call_history_pane.dart, PrivateCallHost.jsx

## 2026-09-04 Ã¢â‚¬â€ Aislamiento video/monitor + estabilidad control (APK 1.8.72)

## 2026-09-06 Ã¢â‚¬â€ RediseÃƒÂ±o web: Personas y llamadas

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Paleta Personas global (Ctrl+K) + ficha de acciones (mensaje / llamada / video / ver cÃƒÂ¡mara).
  - Host ÃƒÂºnico de llamadas (`PrivateCallHost`) entrantes y salientes; inbox con pestaÃƒÂ±a Personas y acciones rÃƒÂ¡pidas.
  - DM: iconos de llamada visibles; grupo: roster completo + acciones por miembro; Radio Ã¢â‚¬Å“En lÃƒÂ­neaÃ¢â‚¬Â abre ficha.
  - Despacho alineado (layout, consola, video, seguimiento, usuarios Ã¢â€ â€™ Contactar).
- **Archivos / refs:** peerActions.js, PrivateCallHost.jsx, PeoplePalette.jsx, PeerActionSheet.jsx, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, RadioPage.jsx, DispatchLayout.jsx, CommandCenter.jsx, DispatchVideo.jsx

## 2026-09-06 Ã¢â‚¬â€ UI llamada web: avatar + banner entrante

- **Tipo:** fix | ux | feature
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Overlay de llamada muestra foto del usuario (`PersonAvatar`); avatar ya no se monta encima del texto (CSS `absolute` corregido).
  - Estados cortos (Ã‚Â«En llamadaÃ‚Â») sin repetir el nombre en cabecera y cuerpo.
  - Banner flotante global de llamada entrante (arriba/derecha) para Contestar/Rechazar sin abrir el panel de chat.
- **Archivos / refs:** IncomingCallHost.jsx, PrivateCallOverlay.jsx, DirectChat.jsx, App.jsx, styles.css, private_call_screen.dart

## 2026-09-06 Ã¢â‚¬â€ Fix OTA automÃƒÂ¡tica (APK 1.8.79+89)

- **Tipo:** fix | release
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - OTA forzada vuelve a bloquear el arranque al detectar versiÃƒÂ³n nueva (no solo al terminar).
  - Reintento tras login; timeout manifiesto 12s + 1 reintento; token descarga 1h.
  - Publicada **1.8.79+89**.
- **Archivos / refs:** main.dart, app_update.dart, appUpdate.js, Soporte/APK/TacticalPtx-1.8.79+89.apk

## 2026-09-06 Ã¢â‚¬â€ APK 1.8.78+88 (llamadas nÃƒÂ­tidas + E2EE + Alertas)

- **Tipo:** release
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Publicada OTA **1.8.78+88** (audio llamadas sin NS/DTX agresivo; sala+E2EE v3 por sesiÃƒÂ³n; botÃƒÂ³n Alertas; timeout 5 timbres / llamada perdida; pantalla Contestar).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.78+88.apk

## 2026-09-06 Ã¢â‚¬â€ Llamadas: nitidez, E2EE e integridad

- **Tipo:** mejora | security | fix
- **ÃƒÂrea:** mobile | web | backend
- **QuÃƒÂ©:**
  - Audio de llamadas alineado con PTT (sin noise suppression/DTX/RED agresivos) Ã¢â€ â€™ voz mÃƒÂ¡s nÃƒÂ­tida.
  - Sala LiveKit **ÃƒÂºnica por llamada** + clave E2EE **v3** por sesiÃƒÂ³n; fail-closed si `e2ee: true` sin clave.
  - Video ~2.8 Mbps + adaptiveStream + preferir framerate bajo congestiÃƒÂ³n; token LiveKit TTL 1h.
- **Archivos / refs:** voiceE2ee.js, dm.js, livekit.js, video_streaming_config.dart, videoStreaming.js, livekitE2ee.js, private_call_screen.dart, PrivateCallOverlay.jsx

## 2026-09-06 Ã¢â‚¬â€ APK 1.8.77+87: botÃƒÂ³n Alertas + llamadas

- **Tipo:** release | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Publicada APK con botÃƒÂ³n Radio **Alertas** (ya no Ã‚Â«PÃƒÂNICOÃ‚Â»), textos de overlay/chat/FCM alineados; incluye fixes de llamada entrante y timeout 5 timbres.
- **Archivos / refs:** radio_screen.dart, radio_shell.dart, panic.js, Soporte/APK/TacticalPtx-1.8.77+87.apk

## 2026-09-06 Ã¢â‚¬â€ Llamada entrante a pantalla + 5 timbres / perdida

- **Tipo:** fix | feature | ux
- **ÃƒÂrea:** mobile | backend | web
- **QuÃƒÂ©:**
  - Entrante: abre pantalla Contestar (trae app al frente); FCM data-only sin banner del sistema; full-screen intent solo de respaldo en segundo plano.
  - Sin respuesta tras **5 timbres (~25 s)**: el servidor cuelga y manda push Ã‚Â«Llamada perdidaÃ‚Â» al destino (estilo WhatsApp); el llamante ve Ã‚Â«Sin respuestaÃ‚Â».
- **Archivos / refs:** calls.js (sweeper), dm.js, server.js, incoming_call_wake.dart, MainActivity.kt, channel_session.dart, push_service.dart, radio_shell.dart

## 2026-09-06 Ã¢â‚¬â€ BotÃƒÂ³n PÃƒÂ¡nico Ã¢â€ â€™ Alertas

- **Tipo:** ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** La etiqueta del botÃƒÂ³n de pÃƒÂ¡nico en Radio pasa de Ã‚Â«PÃƒÂNICOÃ‚Â» a Ã‚Â«AlertasÃ‚Â» (app y web).
- **Archivos / refs:** mobile/lib/screens/radio_screen.dart, web/src/pages/RadioPage.jsx

## 2026-09-06 Ã¢â‚¬â€ Contraste pantalla de llamada

- **Tipo:** ux
- **Area:** mobile
- **Que:** Fondos y botones de llamada mas claros/visibles; colgar en rojo vivo; titulo y etiquetas con mayor contraste.
- **Archivos / refs:** theme.dart (kInstCall*), private_call_screen.dart

## 2026-09-06 Ã¢â‚¬â€ APK 1.8.76+86 (arranke rapido + nav llamadas)

- **Tipo:** release
- **Area:** mobile
- **Que:** Publicada OTA **1.8.76+86** (splash sesion no bloquea por OTA; nav Chats/Llamadas/Radio abajo; timbre llamadas).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.76+86.apk

## 2026-09-06 Ã¢â‚¬â€ Nav inferior: Chats / Llamadas / Radio

- **Tipo:** ux
- **Area:** mobile
- **Que:** Llamadas pasan a la barra inferior junto a Chats y Radio; se quita el toggle Chats|Llamadas de arriba en el inbox.
- **Archivos / refs:** radio_shell.dart, chat_inbox_screen.dart, call_history_pane.dart

## 2026-09-06 Ã¢â‚¬â€ Reabrir app: sin splash Ã‚Â«Cargando sesionÃ‚Â» lento

- **Tipo:** fix | ux
- **Area:** mobile
- **Que:**
  - Arranque: carga sesion local primero y muestra home; OTA/Push/Shorebird en segundo plano.
  - RadioShell libera UI al tener grupos (LiveKit/FGS no bloquean).
  - Timeouts cortos en loadSession (4s) y fetchGroups (8s).
- **Archivos / refs:** mobile/lib/main.dart, mobile/lib/screens/radio_shell.dart

## 2026-09-06 Ã¢â‚¬â€ Timbre/vibracion llamadas + ciclo de vida

- **Tipo:** feature | fix
- **Area:** mobile | web | backend
- **Que:**
  - Timbre nativo Android (ringtone del sistema) + vibracion en bucle al recibir voz/video.
  - Canal FCM/local 	acticalptx_calls_v2 con USAGE_NOTIFICATION_RINGTONE + fullScreenIntent.
  - Tope de reconexion/connect; endPrivateCall en salidas fallidas; mensaje si la llamada ya expiro.
- **Archivos / refs:** MainActivity.kt, call_ringtone.dart, incoming_call_screen.dart, push_service.dart, private_call_screen.dart, PrivateCallOverlay.jsx, fcm.js Ã¢â‚¬â€ APK **1.8.75+85**

## 2026-09-06 Ã¢â‚¬â€ Eliminar Radio personal 1:1 (app + web)

- **Tipo:** feature | breaking
- **Area:** mobile | web | backend
- **Que:**
  - Retirada la opcion de iniciar Radio personal / PTT 1:1 en APK y Web.
  - API rechaza mode=radio en llamadas privadas.
  - Invitaciones residuales se rechazan automaticamente.
- **Archivos / refs:** peer_actions.dart, direct_pane.dart, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, calls.js

## 2026-09-04 Ã¢â‚¬â€ Mensaje permiso de camaras (APK)

- **Tipo:** ux
- **Area:** mobile
- **Que:**
  - Dialogo y textos de permiso de camara reducidos a: Ã‚Â«Permiso de camaras unicamenteÃ‚Â».
- **Archivos / refs:** mobile/lib/screens/radio_shell.dart
- **APK:** 1.8.73+83

## 2026-09-04 Ã¢â‚¬â€ Reordenar modulos del menu lateral

- **Tipo:** feature | ux
- **Area:** web
- **Que:**
  - Arrastrar (asa Ã¢â€¹Â®Ã¢â€¹Â®) los modulos del rail para reacomodarlos.
  - El orden se guarda en localStorage.
- **Archivos / refs:** DispatchLayout.jsx, institutional.css

## 2026-09-04 Ã¢â‚¬â€ Sin etiqueta de nombre bajo pins del mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Quitada la pastilla de nombre bajo el marcador; el detalle solo al seleccionar (panel/popup).
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

## 2026-09-04 Ã¢â‚¬â€ Indicativo desde Cargo / puesto

- **Tipo:** feature | ux
- **Area:** web | backend
- **Que:**
  - Eliminados campos Indicativo al aire y Detalle/expansion.
  - El nombre visible se arma solo: Grado + Apellido[, cargo] (ej. Sgto. 1/o. Gomez, desarrollador).
  - Quitados textos/ayudas del formulario de usuarios.
- **Archivos / refs:** rfcUsername.js, DispatchUsers.jsx, admin.js

## 2026-09-04 Ã¢â‚¬â€ Mas zoom en mapas de despacho

- **Tipo:** mejora | ux
- **Area:** web
- **Que:**
  - Zoom maximo del mapa sube a **22** (antes ~18), con overzoom sobre tiles nativos 19.
  - Ajuste automatico al grupo de operadores permite acercar mas (hasta 18).
- **Archivos / refs:** web/src/dispatch/mapTiles.js, LiveTrackMap, DispatchMap, CommandCenter, mapLeafletUtils

## 2026-09-04 Ã¢â‚¬â€ Formato de matricula (letra-guion-numeros)

- **Tipo:** feature | fix
- **Area:** web | backend
- **Que:**
  - Matricula siempre en formato Letra-Numeros (ej. A-1234, B-2048).
  - Mascara en el formulario de usuarios; validacion en API al crear/editar.
- **Archivos / refs:** web/src/matricula.js, backend/src/services/matricula.js, DispatchUsers.jsx, admin.js

## 2026-09-04 Ã¢â‚¬â€ Pins de ubicacion redondos (gota)

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Correccion: ubicaciones en mapa como pin gota redondo (foto circular), no cuadrado.
  - Se conservan colores, live, panico y avatar de cada usuario.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

## 2026-09-04 Ã¢â‚¬â€ Forma de pins de ubicacion en mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Marcadores de ubicacion: silueta gota/teardrop sustituida por badge cuadrado redondeado + punta triangular.
  - Colores (verde / en vivo / panico) y foto circular del usuario sin cambios.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

- **Tipo:** fix | security | mejora
- **ÃƒÂrea:** web | mobile | backend
- **QuÃƒÂ©:**
  - Ver cÃƒÂ¡mara y videollamada ya no comparten flags ni pelean por la cÃƒÂ¡mara (CameraSessionGate).
  - Control remoto deduplicado + cola de facing; fallos no cuelgan la sesiÃƒÂ³n.
  - Conferencia Expandir sin remount LiveKit; monitor sin mic del puesto ni privateCallUi.
  - ExclusiÃƒÂ³n mutua mismo peer (Ver cÃƒÂ¡mara Ã¢â€ â€ videollamada).
  - APK **1.8.72+82**.
- **Archivos / refs:** camera_session_gate.dart, 
emote_camera_session.dart, RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, privateCallUi.js

## 2026-09-03 Ã¢â‚¬â€ Fix cambio cÃƒÂ¡mara frontal/trasera (APK 1.8.71)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - Control remoto tambiÃƒÂ©n por socket principal + data packet LiveKit.
  - Cambio de cÃƒÂ¡mara reinicia el track (offÃ¢â€ â€™on con facing nuevo); setCameraPosition no bastaba en FGS.
  - APK **1.8.71+80**.
- **Archivos / refs:** 
emote_camera_session.dart, channel_session.dart, PrivateCallOverlay.jsx

## 2026-09-03 Ã¢â‚¬â€ Conferencia multi-cÃƒÂ¡mara + dock centrado

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Varias Ã‚Â«Ver cÃƒÂ¡maraÃ‚Â» en un mosaico tipo conferencia (RemoteMonitorConference).
  - Dock del monitor: barra a ancho completo; EN VIVO a la izquierda y controles centrados (ya no el bloque de 26rem a la izquierda).
- **Archivos / refs:** RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, DispatchVideo.jsx, CommandCenter.jsx, command-center.css, styles.css

## 2026-09-03 Ã¢â‚¬â€ Multi-monitor + control frontal/trasera/mic

- **Tipo:** feature
- **ÃƒÂrea:** web | backend | mobile
- **QuÃƒÂ©:**
  - Varias Ã‚Â«Ver cÃƒÂ¡maraÃ‚Â» a la vez, apiladas en el panel (Video y Command Center).
  - Control remoto: cÃƒÂ¡mara frontal/trasera y micrÃƒÂ³fono ON/OFF del dispositivo.
  - API POST /private/:id/remote-control + socket call:remote_control.
  - APK **1.8.70+79** (FGS microphone al activar mic remoto).
- **Archivos / refs:** DispatchVideo.jsx, CommandCenter.jsx, PrivateCallOverlay.jsx, calls.js, 
emote_camera_session.dart

## 2026-09-03 Ã¢â‚¬â€ Monitor: centrado real + pantalla completa usable

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Corregido el colapso del stage (tile absolute Ã¢â€ â€™ barra fea arriba).
  - Un solo video centrado en X/Y con flex; sin caja horizontal ancha.
  - **Pantalla completa** = alto completo del stage (marco vertical centrado).
- **Archivos / refs:** `styles.css`, `PrivateCallOverlay.jsx`

## 2026-09-03 Ã¢â‚¬â€ Monitor: centrado en pantalla + tamaÃƒÂ±o pantalla completa

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Un solo video queda **centrado en la pantalla** (absolute 50%/50%).
  - Nuevo tamaÃƒÂ±o **Pantalla completa** (`fill`) que ocupa todo el stage.
  - TamaÃƒÂ±o solo en Expandir; al abrir Expandir arranca en pantalla completa.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`

## 2026-09-03 Ã¢â‚¬â€ Monitor Expandir: video centrado + tamaÃƒÂ±o funcional

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Un solo video queda **centrado** (Expandir y panel).
  - **TamaÃƒÂ±o** solo en Expandir; escala real vÃƒÂ­a `--vc-solo-h` (40Ã¢â€ â€™84vh).
  - Quitado el control del panel normal; al Expandir arranca en MÃƒÂ¡ximo.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 Ã¢â‚¬â€ UI monitor cÃƒÂ¡mara: pantalla completa redistribuida

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Vista Expandir de Ã‚Â«CÃƒÂ¡mara del dispositivoÃ‚Â» tipo sala de monitoreo: chrome superior, stage a pantalla completa, dock inferior con estado EN VIVO + acciones; video portrait/landscape centrado y mÃƒÂ¡s usable.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `styles.css`

## 2026-09-03 Ã¢â‚¬â€ Ver cÃƒÂ¡mara con app cerrada / suspendida (APK 1.8.69)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - FCM en background ya no se ignora: guarda la solicitud, arranca FGS `camera` y **reabre la app** (sin Contestar) para publicar LiveKit.
  - Al reanudar/arranque se drena el pending y activa la cÃƒÂ¡mara en silencio.
- **Archivos / refs:** `remote_camera_wake.dart`, `push_service.dart`, `radio_shell.dart`, `fcm.js`

## 2026-09-03 Ã¢â‚¬â€ CÃƒÂ¡mara remota con pantalla bloqueada (APK 1.8.68)

- **Tipo:** fix | feature
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - FGS Android con tipo **`camera`** + wake/wifi lock para que Ã‚Â«Ver cÃƒÂ¡maraÃ‚Â» no se suspenda al bloquear el telÃƒÂ©fono.
  - Watchdog republica la cÃƒÂ¡mara si el SO la apaga; FCM data-only (sin banner) para despertar con pantalla bloqueada.
- **Archivos / refs:** `background_radio.dart`, `remote_camera_session.dart`, `AndroidManifest.xml`, `fcm.js`, `calls.js`

## 2026-09-03 Ã¢â‚¬â€ Emoji/Stickers: safe area barra de navegaciÃƒÂ³n (APK 1.8.67)

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Los tabs Emoji/Stickers ya no se montan sobre los botones del sistema; padding inferior con `viewPadding`.
- **Archivos / refs:** `chat_emoji_panel.dart`

## 2026-09-03 Ã¢â‚¬â€ Chat: emojis y adjuntos mejorados (APK 1.8.66)

- **Tipo:** mejora | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Panel de emojis con tipografÃƒÂ­a color-emoji mÃƒÂ¡s nÃƒÂ­tida, acentos tÃƒÂ¡cticos (sin verde WhatsApp), sin pestaÃƒÂ±a GIF vacÃƒÂ­a; mÃƒÂ³vil gana **bÃƒÂºsqueda + recientes**.
  - MenÃƒÂº adjuntar tipo iconos (GalerÃƒÂ­a / CÃƒÂ¡mara / Video / Documento); en mÃƒÂ³vil, vista previa + leyenda antes de enviar; fotos a mayor calidad.
- **Archivos / refs:** `WaEmojiPicker.jsx`, `styles.css`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_emoji_panel.dart`, `chat_attach_sheet.dart`, `emoji_data.dart`

## 2026-09-03 Ã¢â‚¬â€ Ver cÃƒÂ¡mara silenciosa (sin aviso en el mÃƒÂ³vil) APK 1.8.65

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Con permiso previo, **Ver cÃƒÂ¡mara** solo publica el feed a LiveKit: **sin push FCM, sin notificaciÃƒÂ³n local, sin vibraciÃƒÂ³n, sin snackbar y sin abrir panel de video** en el telÃƒÂ©fono.
  - SesiÃƒÂ³n headless `RemoteCameraSession`; al colgar desde despacho se apaga sola.
- **Archivos / refs:** `remote_camera_session.dart`, `radio_shell.dart`, `channel_session.dart`, `backend/src/routes/calls.js`

## 2026-09-03 Ã¢â‚¬â€ Video nÃƒÂ­tido 720p + Expandir sin perder imagen (APK 1.8.64)

- **Tipo:** fix | mejora | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - CodificaciÃƒÂ³n a **720p / ~3.2 Mbps / 30 FPS / VP8** (antes 540p Ã¢â‚¬Å“estableÃ¢â‚¬Â se veÃƒÂ­a pixelada).
  - **Expandir** ya no deja el video negro: un solo mosaico enganchado al track (panel o fullscreen).
  - Panel de video en despacho: tamaÃƒÂ±os **Compacto / Mediano / Grande / MÃƒÂ¡ximo** + pantalla completa mÃƒÂ¡s grande; `object-fit: contain` en 1 tile.
- **Archivos / refs:** `videoStreaming.js`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 Ã¢â‚¬â€ CÃƒÂ¡mara remota: permiso inicial + auto-aceptar (APK 1.8.63)

- **Tipo:** feature
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - Al entrar a la app (primera vez): diÃƒÂ¡logo para permitir que **despacho active la cÃƒÂ¡mara** + permiso del SO.
  - Con eso activo, **Ver cÃƒÂ¡mara** desde el panel web acepta sola (sin Contestar); snackbar Ã‚Â«Despacho activÃƒÂ³ tu cÃƒÂ¡maraÃ‚Â».
  - Interruptor en perfil del mÃƒÂ³vil para activar/desactivar.
- **Archivos / refs:** `remote_camera_prefs.dart`, `radio_shell.dart`, `channel_session.dart`, `DispatchVideo.jsx`

## 2026-09-03 Ã¢â‚¬â€ Intermitencia video: ICE/UPnP + bitrate + reconnect (APK 1.8.62)

- **Tipo:** fix | infra
- **ÃƒÂrea:** infra | web | mobile
- **QuÃƒÂ©:**
  - LiveKit usaba puertos UDP altos (50000+) **sin UPnP** Ã¢â€ â€™ media 4G inestable; vuelto a **UDP mux 7882** + relays TURN 30000Ã¢â‚¬â€œ30010 mapeados.
  - Video a **540p / 1.2 Mbps / VP8 / sin simulcast** (prioridad continuidad en 4G).
  - Stabilizer deja de spamear Ã¢â‚¬Å“ReconectandoÃ¢â‚¬Â¦Ã¢â‚¬Â en microcortes; LiveKit reiniciado.
  - APK **1.8.62+71** OTA.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `Reinforce-UPnP.ps1`, `videoStreaming.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`

## 2026-09-03 Ã¢â‚¬â€ Video negro: VP8 + attach srcObject (APK 1.8.61)

- **Tipo:** fix
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Causa tÃƒÂ­pica de tiles negros con audio OK: **H.264 + E2EE** entre web y APK.
  - Codec de publicaciÃƒÂ³n vuelve a **VP8**; attach del mosaico vÃƒÂ­a `MediaStream`/`srcObject`; dynacast off; monitor sin tile local vacÃƒÂ­o.
  - APK **1.8.61+70** OTA.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`

## 2026-09-03 Ã¢â‚¬â€ APK 1.8.60+69 (estabilidad video)

- **Tipo:** fix | release
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Compilada y publicada OTA **APK 1.8.60+69** con fixes de parpadeo/intermitencia de video (simulcast 480/720, adaptiveStream off, reconnect suave).
  - `API_BASE=https://pulsanet.duckdns.org`; `APP_VERSION` backend Ã¢â€ â€™ **1.8.60**.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.60+69.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-09-03 Ã¢â‚¬â€ Estabilidad video (fin de parpadeo / intermitencia)

- **Tipo:** fix
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Baja carga de uplink: simulcast 480p+720p (~6 Mbps) en lugar de 480+720+1080 (~14.5 Mbps) que saturaba la red.
  - `adaptiveStream` desactivado (evitaba resubscribe al redimensionar tiles).
  - No republicar cÃƒÂ¡mara en cada `Reconnected` salvo track muerto; debounce de unsubscribes; mosaico mantiene ÃƒÂºltimo frame.
  - Stabilizer: no fuerza `connect` encima de la reconexiÃƒÂ³n interna de LiveKit; delays mÃƒÂ¡s largos.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `usePrivateCallTiles.js`, `useGroupVideo.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`, `private_call_screen.dart`, `group_video_screen.dart`

## 2026-09-03 Ã¢â‚¬â€ Perfiles video RTMP-like (480/720/1080 @ 30 FPS)

- **Tipo:** mejora
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - PublicaciÃƒÂ³n LiveKit con perfiles tipo RTMP externo: H.264, 30 FPS, techos CBR-like **480p/1500 Kbps**, **720p/4500 Kbps**, **1080p/8500 Kbps** (simulcast + captura 1080).
  - Audio de sala a Opus HQ stereo (~AAC 128 kbps); captura con fallback 1080Ã¢â€ â€™720Ã¢â€ â€™540 si el dispositivo no abre Full HD.
- **Por quÃƒÂ© / notas:** WebRTC no tiene CBR estricto ni AAC en el peer; el techo de bitrate + `maintain-framerate` aproximan el perfil pedido. AAC real solo en egress RTMP externo.
- **Archivos / refs:** `web/src/videoStreaming.js`, `web/src/useGroupVideo.js`, `web/src/PrivateCallOverlay.jsx`, `mobile/lib/video_streaming_config.dart`

## 2026-09-03 Ã¢â‚¬â€ Ver cÃƒÂ¡mara del dispositivo desde consola Video

- **Tipo:** feature
- **ÃƒÂrea:** web | backend | mobile
- **QuÃƒÂ©:**
  - Desde **Despacho Ã¢â€ â€™ Video** (y Operaciones): botÃƒÂ³n **Ver cÃƒÂ¡mara** solicita activar la cÃƒÂ¡mara del dispositivo de campo y proyecta el feed en el panel (sin publicar cam del puesto por defecto).
  - Intent `remote_camera`: FCM/socket Ã‚Â«Solicitud de cÃƒÂ¡maraÃ‚Â»; en el mÃƒÂ³vil se muestra Ã‚Â«Despacho solicita ver tu cÃƒÂ¡maraÃ‚Â» y se prioriza cÃƒÂ¡mara **trasera**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `dm.js`, `DispatchVideo.jsx`, `CommandCenter.jsx`, `PrivateCallOverlay.jsx`, `incoming_call_screen.dart`, `private_call_screen.dart`, `radio_shell.dart`

## 2026-09-03 Ã¢â‚¬â€ Video negro en consola / tras reconectar

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Vista previa de cÃƒÂ¡mara: stream se enganchaba a un `<video>` que luego se desmontaba.
  - Videollamada en consola: mosaico sin altura ÃƒÂºtil + tile local no se refrescaba; tras Ã‚Â«ConexiÃƒÂ³n restauradaÃ‚Â» no se republicaba la cÃƒÂ¡mara (frame negro con Ã‚Â«Apagar camÃ‚Â» activo).
- **Archivos / refs:** `DispatchVideo.jsx`, `PrivateCallOverlay.jsx`, `usePrivateCallTiles.js`, `VideoConferenceMosaic.jsx`, `useGroupVideo.js`, CSS

## 2026-09-03 Ã¢â‚¬â€ Vista previa cÃƒÂ¡mara consola negra

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En mÃƒÂ³dulo Video, al activar cÃƒÂ¡mara web el preview quedaba negro porque el stream se enganchaba a un `<video>` que luego se desmontaba. Ahora el elemento es estable y se re-engancha el stream.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `command-center.css`

## 2026-09-03 Ã¢â‚¬â€ Ancla DuckDNS pulsanet + APK 1.8.59

- **Tipo:** infra | fix
- **ÃƒÂrea:** infra | mobile
- **QuÃƒÂ©:**
  - Dominio permanente **`pulsanet.duckdns.org`** configurado (DuckDNS A Ã¢â€ â€™ IP pÃƒÂºblica; Sync/Watch lo mantienen).
  - Caddy + Let's Encrypt en ese host; `.env` / APK default apuntan ahÃƒÂ­.
  - APK **1.8.59+68** OTA con `API_BASE=https://pulsanet.duckdns.org`.
- **Por quÃƒÂ© / notas:** Ya no hace falta republicar APK cuando el ISP cambie la IP.
- **Archivos / refs:** `Soporte/Secrets/stable-domain.env`, `infra/caddy/stable-domain.txt`, `mobile/lib/config.dart`

## 2026-09-03 Ã¢â‚¬â€ APK ancla dominio permanente (anti-desfase IP)

- **Tipo:** fix | infra | feature
- **ÃƒÂrea:** mobile | infra
- **QuÃƒÂ©:**
  - Causa: APK apuntaba a `189.152.222.98.sslip.io` (IP vieja); el ISP ahora es `189.152.160.81`.
  - APK **1.8.58+67** OTA con `API_BASE=https://189.152.160.81.sslip.io`; borde Caddy realineado.
  - Ancla permanente: DuckDNS vÃƒÂ­a `infra\SETUP-STABLE-DOMAIN.ps1` + `Sync-PublicIp` (actualiza A-record al cambiar IP; el APK ya no depende de `IP.sslip.io`).
  - Login mÃƒÂ³vil: opciÃƒÂ³n **Servidor** para fijar URL si aÃƒÂºn no hay OTA.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `SETUP-STABLE-DOMAIN.ps1`, `START-PUBLIC-EDGE.ps1`, `mobile/lib/config.dart`, `login_screen.dart`, `Publish-ApkUpdate.ps1`

## 2026-09-03 Ã¢â‚¬â€ MÃƒÂ³dulo Video en despacho + cÃƒÂ¡mara consola

- **Tipo:** feature | fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - MenÃƒÂº **Video** en el rail de despacho (junto a Operaciones / Seguimiento) Ã¢â€ â€™ `/despacho/video`.
  - Consola con canales (iniciar/unirse a transmisiÃƒÂ³n), operadores en lÃƒÂ­nea (videollamada 1:1) y botÃƒÂ³n **Activar cÃƒÂ¡mara web** del puesto (vista previa + permiso del navegador).
  - Controles de cÃƒÂ¡mara con texto claro en panel de consola; fix Radio PTT: el botÃƒÂ³n Ã‚Â«Video en vivoÃ‚Â» ahora envÃƒÂ­a `groupId`.
- **Por quÃƒÂ© / notas:** Faltaba un mÃƒÂ³dulo dedicado y una opciÃƒÂ³n explÃƒÂ­cita de cÃƒÂ¡mara en consola; el botÃƒÂ³n de Radio no abrÃƒÂ­a la sesiÃƒÂ³n.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `DispatchLayout.jsx`, `App.jsx`, `GroupVideoPanel.jsx`, `RadioPage.jsx`

## 2026-09-03 Ã¢â‚¬â€ Marcador en mapa: anillo rojo parpadeante en pÃƒÂ¡nico

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Al activar pÃƒÂ¡nico, el cÃƒÂ­rculo verde del pin del operador en el mapa pasa a rojo y parpadea (Centro de mando, Mapa en vivo y Mapa de despacho) hasta que el evento se cierra.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `command-center.css`, `CommandCenter.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`

## 2026-09-03 Ã¢â‚¬â€ Sin pin de pÃƒÂ¡nico en (0,0)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** El mapa ya no dibuja Ã‚Â«Punto de pÃƒÂ¡nicoÃ‚Â» en coordenadas `0,0` (Null Island). Se trata como sin GPS; botones de mapa solo con ubicaciÃƒÂ³n vÃƒÂ¡lida.
- **Por quÃƒÂ© / notas:** Ese pin no era un operador real: pÃƒÂ¡nico enviado sin GPS fijado.
- **Archivos / refs:** `web/src/panicMaps.js`, `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/DispatchPanicHost.jsx`, `mobile/lib/panic_maps.dart`

## 2026-09-02 Ã¢â‚¬â€ Acceso LAN por IP + stack caÃƒÂ­do / IP pÃƒÂºblica nueva

- **Tipo:** fix | infra
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:**
  - Causa de Ã‚Â«no entraÃ‚Â» por `192.168.68.51`: esa IP **no es** del servidor (LAN actual `192.168.1.216`); ademÃƒÂ¡s API/Web/Caddy estaban caÃƒÂ­dos.
  - Borde Caddy ahora sirve tambiÃƒÂ©n **`https://192.168.1.216`** (cert interno).
  - IP pÃƒÂºblica del ISP cambiÃƒÂ³ a **`189.152.160.81`** Ã¢â€ â€™ dominio `https://189.152.160.81.sslip.io`.
  - LiveKit no arrancaba por YAML corrupto (`control characters`); reescrito `livekit.dev.yaml`.
- **Archivos / refs:** `infra/Caddyfile.edge.template`, `infra/START-PUBLIC-EDGE.ps1`, `infra/livekit.dev.yaml`

## 2026-09-02 Ã¢â‚¬â€ MenÃƒÂº Video + cambio cÃƒÂ¡mara frontal/trasera

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - OpciÃƒÂ³n **Video en vivo** en menÃƒÂº Radio (Ã¢ËœÂ°), menÃƒÂº del chat de grupo y menÃƒÂº de Directos (Videollamada).
  - En videollamada 1:1 y transmisiÃƒÂ³n grupal: botÃƒÂ³n para alternar **cÃƒÂ¡mara frontal Ã¢â€ â€ trasera** (web + mobile); preview local sin espejo en trasera.
- **Por quÃƒÂ© / notas:** Equipos institucionales con permisos de cÃƒÂ¡mara; el agente debe poder mostrar entorno (trasera) o rostro (frontal) sin salir de la llamada.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `private_call_screen.dart`, `group_video_screen.dart`, `web/src/PrivateCallOverlay.jsx`, `web/src/useGroupVideo.js`, `web/src/videoStreaming.js`

## 2026-09-01 Ã¢â‚¬â€ Video grupal: cierre global + aceptar sin parpadeo

- **Tipo:** fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - **`group:video_ended`** llega a todos los miembros por sala `user:*` (no solo canal PTT) Ã¢â‚¬â€ al colgar/terminar cierra video e invitaciÃƒÂ³n en web y mobile.
  - **Web:** panel ÃƒÂºnico en `App` al aceptar invitaciÃƒÂ³n (sin navegaciÃƒÂ³n retrasada ni doble conexiÃƒÂ³n LiveKit).
  - **Mobile:** al aceptar o tocar notificaciÃƒÂ³n abre video directo (sin cambiar canal PTT); evita pop accidental del diÃƒÂ¡logo sobre la pantalla de video.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/GroupVideoSessionHost.jsx`, `web/src/useGroupVideo.js`, `mobile/lib/screens/radio_shell.dart`

## 2026-09-01 Ã¢â‚¬â€ Fix entrega notificaciones video grupal + modo telÃƒÂ©fono

- **Tipo:** fix
- **ÃƒÂrea:** backend | mobile
- **QuÃƒÂ©:**
  - InvitaciÃƒÂ³n grupal por **tres vÃƒÂ­as**: socket `user:*`, socket `group:*` (canal PTT) y FCM **por miembro** (`notifyUserDevices`, igual que llamadas 1:1).
  - Join explÃƒÂ­cito a sala `user:{id}` en cada conexiÃƒÂ³n socket del servidor.
  - Mobile: escucha tambiÃƒÂ©n `group:video_started`; deduplica invitaciones; notificaciÃƒÂ³n local respeta **silencio / vibrador / sonido** del telÃƒÂ©fono.
- **Por quÃƒÂ© / notas:** La invitaciÃƒÂ³n solo iba a `user:*` y el batch FCM podÃƒÂ­a no entregar; miembros en el canal del grupo no recibÃƒÂ­an evento si fallaba la sala personal.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/server.js`, `backend/src/services/fcm.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 Ã¢â‚¬â€ Notificaciones transmisiÃƒÂ³n grupal (FCM + socket + tono/vibraciÃƒÂ³n)

- **Tipo:** feature | fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - Al iniciar video grupal: push FCM a miembros + evento `group:video_incoming` por sala `user:*` (llega aunque no estÃƒÂ©n en el canal PTT).
  - Web: pantalla **Unirse/Ignorar** con tono de llamada; mobile: pantalla entrante estilo llamada + canal `tacticalptx_calls`.
  - VibraciÃƒÂ³n respeta modo **silencio** del telÃƒÂ©fono (Android); sonido usa tono del sistema (respeta vibrador/silencio).
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/services/fcm.js`, `web/src/GroupVideoIncomingHost.jsx`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 Ã¢â‚¬â€ Fix video grupal: cÃƒÂ¡mara local no se mostraba

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Corregido bug donde el mosaico quedaba en Ã‚Â«Sin cÃƒÂ¡maraÃ‚Â» aunque LiveKit publicara video (rebuild de tiles antes de actualizar estado); lectura de track desde `camRef`/publicaciÃƒÂ³n local; warmup de permisos; fallback 720Ã¢â€ â€™540.
- **Archivos / refs:** `web/src/useGroupVideo.js`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 Ã¢â‚¬â€ UX video grupal web: botones visibles en Radio y Despacho

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n **Video en vivo** con etiqueta (ya no solo emoji) en header del chat de grupo; mismo control en panel PTT de Radio; botÃƒÂ³n por canal en consola **Operaciones** (Despacho).
- **Por quÃƒÂ© / notas:** El acceso solo estaba en chat y era fÃƒÂ¡cil de no ver; Operaciones no tenÃƒÂ­a chat integrado.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 Ã¢â‚¬â€ Streaming video grupal + HD 720p (1.8.57)

- **Tipo:** feature | mejora
- **ÃƒÂrea:** backend | web | mobile | database
- **QuÃƒÂ©:**
  - **Video grupal en vivo:** sala LiveKit paralela `gvid_*` (no interrumpe PTT audio); API `/api/group-video`, eventos socket `group:video_*`.
  - **Web/despacho:** botÃƒÂ³n Ã°Å¸â€œÂ¹ en chat de grupo, panel mosaico `GroupVideoPanel`, E2EE + simulcast/adaptiveStream.
  - **Mobile:** pantalla `GroupVideoScreen`, botÃƒÂ³n en header del chat de grupo; videollamada 1:1 sube a **720p**.
  - APK **1.8.57+66** publicada OTA.
- **Por quÃƒÂ© / notas:** PTT sigue en `grp_*` audio-only; video es opt-in en segunda conexiÃƒÂ³n.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/useGroupVideo.js`, `web/src/GroupVideoPanel.jsx`, `mobile/lib/screens/group_video_screen.dart`, `database/migrations/022_group_video_sessions.sql`

## 2026-09-01 Ã¢â‚¬â€ APK 1.8.56+65 (fixes llamadas + estabilizadores)

- **Tipo:** release | ops
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Compilada y publicada APK **1.8.56+65** (UI llamadas, apagar cÃƒÂ¡mara, estabilizadores de red, historial).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.56+65.apk`, `backend/app-updates/files/TacticalPtx.apk`

## 2026-09-01 Ã¢â‚¬â€ Abreviatura Mayor: Myr.

- **Tipo:** fix
- **ÃƒÂrea:** backend | web
- **QuÃƒÂ©:** Corregida abreviatura de **Mayor** de `May.` a `Myr.` en catÃƒÂ¡logo y UI; migraciÃƒÂ³n actualiza registros existentes.
- **Archivos / refs:** `backend/src/data/defaultGrades.js`, `web/src/dispatch/armyGrades.js`, `database/migrations/021_mayor_abbreviation_myr.sql`

## 2026-09-01 Ã¢â‚¬â€ Fix UI llamadas: iconos + apagar cÃƒÂ¡mara

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Web: eliminado auto-reencendido de cÃƒÂ¡mara cada 400 ms al apagarla en videollamada; toggle respeta elecciÃƒÂ³n del usuario.
  - Web/mobile: apagar cÃƒÂ¡mara vÃƒÂ­a unpublish/`setCameraEnabled(false)` con fallback por publicaciÃƒÂ³n.
  - Mobile: dock de controles fijo abajo (sin montarse sobre video); PiP local arriba-derecha.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`, `mobile/lib/screens/private_call_screen.dart`

## 2026-09-01 Ã¢â‚¬â€ Estabilizadores virtuales llamadas (voz / radio / video)

- **Tipo:** mejora | fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - Periodo de gracia (~28 s) ante caÃƒÂ­das LiveKit: no cuelga al instante si el peer se desconecta brevemente.
  - Ping cada 15 s (`POST /private/:id/ping`) + refresh de token LiveKit (`POST /private/:id/refresh`).
  - Web: `privateCallStabilizer.js` en overlay, radio bar y opciones resilientes en `livekitE2ee.js`.
  - Mobile: `PrivateCallStabilizer` en llamada privada y radio personal; reintento automÃƒÂ¡tico al fallar connect.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/privateCallStabilizer.js`, `mobile/lib/private_call_stabilizer.dart`

## 2026-09-01 Ã¢â‚¬â€ Consola web: panel videoconferencia en mosaico

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Nuevo componente `VideoConferenceMosaic` con grid adaptativo (1Ã¢â‚¬â€œN participantes) y attach/detach estable por tile.
  - `PrivateCallOverlay` usa mosaico en videollamadas; modo `console` embebido en despacho con mapa/canales visibles.
  - Panel **Videoconferencia** en Command Center: expandir a pantalla completa, controles integrados.
- **Archivos / refs:** `web/src/VideoConferenceMosaic.jsx`, `web/src/usePrivateCallTiles.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/dispatch/CommandCenter.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`

## 2026-09-01 Ã¢â‚¬â€ Historial de llamadas + UI profesional (APK 1.8.55)

- **Tipo:** feature | ux
- **ÃƒÂrea:** backend | mobile | database
- **QuÃƒÂ©:**
  - Tabla `private_call_logs` y API `GET /api/calls/history` (voz, video, radio; perdidas/completadas).
  - Inbox mobile con pestaÃƒÂ±a **Chats | Llamadas** e historial agrupado por fecha (estilo WhatsApp).
  - Pantalla entrante con gradiente y badge de modo (VOZ / VIDEO / RADIO).
  - APK **1.8.55+64** compilada y publicada OTA.
- **Archivos / refs:** `database/migrations/020_private_call_logs.sql`, `backend/src/services/dm.js`, `backend/src/routes/calls.js`, `mobile/lib/screens/call_history_pane.dart`, `mobile/lib/screens/chat_inbox_screen.dart`, `mobile/lib/screens/incoming_call_screen.dart`

## 2026-09-01 Ã¢â‚¬â€ Fix videollamada: cÃƒÂ¡mara auto, colgar ambos lados, menÃƒÂº web

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - CÃƒÂ¡mara se activa sola al contestar/iniciar videollamada (permisos en gesto del usuario + fix mobile `_room` null).
  - Colgar cierra en ambos extremos: teardown LiveKit + `call:ended` en inbox/despacho.
  - MenÃƒÂº **Llamar Ã¢â€“Â¾** en chat directo (voz / video / radio); videollamada en panel Seguimiento y menÃƒÂº de canal.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/callMedia.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`, `mobile/lib/screens/private_call_screen.dart`

## 2026-09-01 Ã¢â‚¬â€ APK 1.8.53+62 OTA (videollamadas)

- **Tipo:** release | ops
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Compilada y publicada APK **1.8.53+62** con `API_BASE=https://189.152.222.98.sslip.io`.
  - Copias: `Soporte/APK/TacticalPtx-1.8.53+62.apk`, OTA `backend/app-updates/files/TacticalPtx.apk`, manifest `android.json` actualizado.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`

## 2026-09-01 Ã¢â‚¬â€ Videollamadas 1:1 + solicitud de cÃƒÂ¡mara (web + mobile)

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - Modo `video` en llamadas privadas LiveKit (salas `video_*`, E2EE igual que voz).
  - API REST + sockets: `/video/request`, `/video/respond`, `/video/stop` con consentimiento explÃƒÂ­cito.
  - Web: overlay con preview local/remoto, botÃƒÂ³n videollamada en DM e inbox; solicitud de cÃƒÂ¡mara en llamada de voz.
  - Mobile: `PrivateCallScreen` con `VideoTrackRenderer`, permisos cÃƒÂ¡mara, FCM `private_video` / `private_video_request`.
  - VersiÃƒÂ³n **1.8.53+62**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/DirectChat.jsx`, `mobile/lib/screens/private_call_screen.dart`, `mobile/lib/api_client.dart`

## 2026-09-01 Ã¢â‚¬â€ Resiliencia IP pÃƒÂºblica + LiveKit ICE (auto-sync)

- **Tipo:** infra | fix
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:**
  - Nuevo `infra/Sync-PublicIp.ps1`: detecta cambio de IP (ipify vs `.env`/`public-ip.txt`/`livekit.dev.yaml`) y realinea `.env`, YAML y `--node-ip`.
  - `ENSURE-PUBLIC-EDGE` y `Watch-Stack` fuerzan `START-PUBLIC-EDGE` ante **drift** aunque Caddy responda 200.
  - `START-PUBLIC-EDGE` sincroniza `node_ip` + reinicia LiveKit; `start-services` prefiere ipify sobre `.env` viejo.
  - `check-integrity` valida alineaciÃƒÂ³n IP + health del borde pÃƒÂºblico; quitados fallbacks a IP `189.152.200.238`.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `ENSURE-PUBLIC-EDGE.ps1`, `START-PUBLIC-EDGE.ps1`, `start-services.ps1`, `Watch-Stack.ps1`, `check-integrity.ps1`

## 2026-09-01 Ã¢â‚¬â€ LiveKit ICE mÃƒÂ³vil 4G: node-ip fija tras cambio ISP

- **Tipo:** fix | infra
- **ÃƒÂrea:** infra | mobile
- **QuÃƒÂ©:**
  - Tras instalar APK 1.8.52, mÃƒÂ³vil conectaba API pero fallaba audio: `MediaConnectException` (ICE timeout).
  - Causa: LiveKit seguÃƒÂ­a anunciando candidatos con IP vieja vÃƒÂ­a STUN; puertos media/TURN ya reenviados por UPnP.
  - Fix: `livekit.dev.yaml` Ã¢â€ â€™ `node_ip: 189.152.222.98`, `use_external_ip: false`, `advertise_internal_ip: true`; `start-services.ps1` pasa `--node-ip` desde `LIVEKIT_PUBLIC_HOST`; UPnP/firewall refrescados.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `infra/Reinforce-UPnP.ps1`

## 2026-09-01 Ã¢â‚¬â€ Fix LiveKit: IP pÃƒÂºblica nueva + seÃƒÂ±al wss same-origin

- **Tipo:** fix | infra | release
- **ÃƒÂrea:** web | infra | mobile | backend
- **QuÃƒÂ©:**
  - IP pÃƒÂºblica cambiÃƒÂ³ **189.152.200.238 Ã¢â€ â€™ 189.152.222.98**; Caddy/borde caÃƒÂ­do Ã¢â€ â€™ Ã‚Â«No se pudo conectar el audio (LiveKit)Ã‚Â».
  - `ENSURE-PUBLIC-EDGE`: Caddy + cert LE en `https://189.152.222.98.sslip.io`; LiveKit reiniciado.
  - Web: `livekitUrl.js` usa **siempre** `wss://mismo-origen` bajo HTTPS (proxy `/rtc`, sin hairpin al dominio viejo).
  - `.env` alineado; APK **1.8.52+61** OTA con `API_BASE=https://189.152.222.98.sslip.io`.
- **Archivos / refs:** `web/src/livekitUrl.js`, `backend/.env`, `mobile/lib/config.dart`, `infra/ENSURE-PUBLIC-EDGE.ps1`

## 2026-09-01 Ã¢â‚¬â€ APK 1.8.51+60 OTA (MEJORAS.txt + audio)

- **Tipo:** release | fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Publicada **APK 1.8.51+60** OTA con fix de audio (libera sesiÃƒÂ³n al silenciar escucha de radio).
  - Incluye tambiÃƒÂ©n los fixes web/backend de MEJORAS.txt del mismo dÃƒÂ­a (pÃƒÂ¡nico, llamadas, chat, PTT).
  - `APP_VERSION` backend Ã¢â€ â€™ **1.8.51**; `TacticalPtx-latest.apk` actualizado.
- **Archivos / refs:** pubspec.yaml, version.js, android.json, channel_session.dart, Publish-ApkUpdate.ps1

## 2026-09-01 Ã¢â‚¬â€ MEJORAS.txt: pÃƒÂ¡nico, llamadas, chat, PTT y audio

- **Tipo:** fix | mejora | ux
- **ÃƒÂrea:** web | backend | mobile
- **QuÃƒÂ©:**
  - **PÃƒÂ¡nico en Seguimiento:** `DispatchPanicHost` en portal a `body`, botÃƒÂ³n Ã‚Â«Silenciar alarmaÃ‚Â», fallback con `ptt.incomingPanic`, sale de pantalla completa al recibir alerta.
  - **Llamadas:** overlay portaled; atrÃƒÂ¡s/Esc minimiza (no cuelga); banner `dm:notify` durante llamada/radio privada; `peerId` en sesiÃƒÂ³n de llamada.
  - **Chat Radio:** conserva scroll al volver desde Seguimiento (`chatActive`); avatares de perfil en burbujas (`senderAvatarUrl` en API).
  - **Mapa maximizado:** botÃƒÂ³n PTT flotante tambiÃƒÂ©n en Mapa en vivo (`DispatchMap`).
  - **Mobile:** suelta sesiÃƒÂ³n de audio del SO cuando radio en mute de escucha.
- **Notas (#6 indicativos):** `display_name` en BD ya es el indicativo (`SGTO GOMEZ`, etc.) vÃƒÂ­a admin; usuarios viejos pueden regenerarse con `rebuild-callsigns.js`.
- **Archivos / refs:** DispatchPanicHost.jsx, PrivateCallOverlay.jsx, WhatsAppChat.jsx, DispatchMap.jsx, chat.js, channel_session.dart, userDisplay.js

## 2026-09-01 Ã¢â‚¬â€ Limpieza post-rollback 1.8.49 + housekeeping

- **Tipo:** fix | ops | security
- **ÃƒÂrea:** mobile | backend | ops
- **QuÃƒÂ©:**
  - Eliminados `screen_security.dart`, `settings_screen.dart` y canal `FLAG_SECURE` en Android (restos del rediseÃƒÂ±o 1.8.49).
  - Imports muertos en `radio_shell.dart`; `APP_VERSION` backend alineado a **1.8.50**.
  - `Usuario y contra.txt` movido a `Soporte/Secrets/`; `TacticalPtx-latest.apk` apunta a **1.8.50+59**.
- **Archivos / refs:** MainActivity.kt, radio_shell.dart, version.js, .gitignore

## 2026-09-01 Ã¢â‚¬â€ Rollback UI: APK 1.8.50 (tema claro, como 1.8.48)

- **Tipo:** fix | release
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Revertido tema tÃƒÂ¡ctico oscuro/camo de 1.8.49; restaurado look institucional claro (oliva/oro) como 1.8.48.
  - APK **1.8.50+59** publicada OTA; reemplaza 1.8.49+58 en el servidor.
- **Por quÃƒÂ© / notas:** El usuario no aprobÃƒÂ³ el rediseÃƒÂ±o 1.8.49; OTA no puede bajar versionCode, por eso se publica 1.8.50 con el aspecto anterior.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, chat_bubble_style.dart, pubspec.yaml, Publish-ApkUpdate.ps1

## 2026-08-31 Ã¢â‚¬â€ Coordenadas clicables Ã¢â€ â€™ Google Maps en detalles GPS

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En popup del marcador y panel de detalle (Seguimiento / Consola / Mapa) se muestran lat/lng; al hacer clic abren Google Maps en esa posiciÃƒÂ³n.
- **Archivos / refs:** MapCoordsLink.jsx, LiveTrackMap.jsx, DispatchMap.jsx, CommandCenter.jsx, panicMaps.js

## 2026-08-31 Ã¢â‚¬â€ APK tema tÃƒÂ¡ctico camo + seguridad (1.8.49)

- **Tipo:** ux | security | release
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Tema oscuro olive/camo digital en chat, inbox, DM, canales, login y **ConfiguraciÃƒÂ³n**.
  - Bloqueo de capturas (`FLAG_SECURE`) activable en ConfiguraciÃƒÂ³n (activo por defecto).
  - APK **1.8.49+58** publicada OTA.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, settings_screen.dart, screen_security.dart, MainActivity.kt, chat_panel.dart, Publish-ApkUpdate.ps1

## 2026-08-31 Ã¢â‚¬â€ Marcadores mapa estilo pin/gota verde

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Iconos de ubicaciÃƒÂ³n en Seguimiento/Mapa pasan a pin teardrop verde (borde + aro claro + punta); siguen mostrando foto de perfil o inicial.
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

\n## 2026-08-31 Ã¢â‚¬â€ Seguimiento: panel lista colapsable (acordeÃƒÂ³n)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n Ocultar/Lista en Seguimiento en vivo; al colapsar queda franja estrecha y el mapa gana espacio. Preferencia en localStorage.
- **Archivos / refs:** LiveTrackMap.jsx, command-center.css

\## 2026-08-31 Ã¢â‚¬â€ Maximizar en Mapa en vivo

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n Maximizar/Reducir (pantalla completa + Esc) en Mapa en vivo, igual que Seguimiento.
- **Archivos / refs:** DispatchMap.jsx, command-center.css

\nn## 2026-08-31 Ã¢â‚¬â€ Parpadeo Ã‚Â«en vivoÃ‚Â» estable en todos los Host PC

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Anillos del mapa ya no usan 	ransform (conflicto con Leaflet/GPU en otras PCs); pulso por ox-shadow.
  - isFresh tolera desfase de reloj entre Hosts (hasta ~2 min) para no perder el estado en vivo.
- **Archivos / refs:** web/src/dispatch/command-center.css, liveTiming.js

\## 2026-08-31 Ã¢â‚¬â€ Tono de mensaje tÃƒÂ¡ctico (web + APK 1.8.48)

- **Tipo:** ux | release
- **ÃƒÂrea:** web | mobile | backend
- **QuÃƒÂ©:**
  - Reemplazado tono Nokia SMS por chirp radio (doble pip 980/1320 Hz), acorde a TacticalPtx.
  - APK **1.8.48+57** OTA; canal Android 	acticalptx_alerts_radio; FCM usa 	actical_msg.
- **Archivos / refs:** web/public/sounds/message.wav, mobile/assets/sounds/tactical_msg.wav, push_service.dart, cm.js

\nn## 2026-08-31 Ã¢â‚¬â€ Seguimiento en vivo filtrado por canal activo

- **Tipo:** ux | fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Mapa de seguimiento muestra GPS y presencia solo de miembros del canal Ã‚Â«Hablar enÃ‚Â» + canales en escucha; API /api/locations?groupIds=.
- **Archivos / refs:** LiveTrackMap.jsx, ackend/src/routes/locations.js, web/src/api.js

\## 2026-08-31 Ã¢â‚¬â€ APK 1.8.47+56 (canales miembro + pitido PTT)

- **Tipo:** release | mobile
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:**
  - APK publicada OTA: solo canales con membresÃƒÂ­a (membersOnly=1), pitido al liberar PTT ajeno.
  - Copias: Soporte/APK/TacticalPtx-1.8.47+56.apk, ackend/app-updates/files/TacticalPtx.apk.
- **Notas:** Chat/seguimiento filtrados por canal son solo web; backend debe estar reiniciado para membersOnly.

\nn## 2026-08-31 Ã¢â‚¬â€ MÃƒÂ³vil: solo canales con membresÃƒÂ­a real

- **Tipo:** fix
- **ÃƒÂrea:** backend | mobile
- **QuÃƒÂ©:** GET /api/groups?membersOnly=1 devuelve ÃƒÂºnicamente grupos en group_members; la app Android usa ese filtro en el selector de canales.
- **Por quÃƒÂ© / notas:** Despacho web sigue con listado ampliado por privilegios (can_see_region, etc.).
- **Archivos / refs:** ackend/src/services/orgUnits.js, ackend/src/routes/groups.js, mobile/lib/api_client.dart

\## 2026-08-31 Ã¢â‚¬â€ Radio web: chat filtrado al canal activo

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Radio/Despacho el panel Chats muestra solo el canal Ã‚Â«Hablar enÃ‚Â» y canales en escucha; oculta DMs y otros grupos. Con un solo canal, la lista lateral se oculta.
- **Archivos / refs:** web/src/ChatInbox.jsx, web/src/pages/RadioPage.jsx, web/src/styles.css

\nn## 2026-08-31 Ã¢â‚¬â€ Acercamiento suave al pÃƒÂ¡nico en mapa (estilo Earth)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Reemplazado flyTo por zoom/pan suave en lÃƒÂ­nea recta (~2.2 s); evita doble movimiento al cargar Seguimiento desde pÃƒÂ¡nico.
- **Archivos / refs:** web/src/dispatch/mapLeafletUtils.jsx, LiveTrackMap.jsx

\## 2026-08-31 Ã¢â‚¬â€ Pitido al liberar canal PTT (web)

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Tono breve (playChannelFreeTone) cuando otro operador suelta el PTT; no suena al soltar el propio botÃƒÂ³n.
- **Archivos / refs:** web/src/appNotify.js, web/src/usePtt.js

\nn## 2026-08-31 Ã¢â‚¬â€ Mac actualizando a Tahoe 26.x (build iOS local)

- **Tipo:** docs | ops
- **ÃƒÂrea:** mobile | docs
- **QuÃƒÂ©:**
  - Mac pasa de Monterey a **Tahoe 26.6.2** Ã¢â€ â€™ ya viable Xcode actual + IPA/TestFlight local.
  - Nueva guÃƒÂ­a IOS_BUILD_MAC_TAHOE.md; Monterey queda como histÃƒÂ³rico.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_TAHOE.md, docs/APP_IOS.md

\## 2026-08-31 Ã¢â‚¬â€ Ver en mapa acerca al punto de pÃƒÂ¡nico

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Ã‚Â«Ver en mapaÃ‚Â» navega a Seguimiento con lat/lng y hace flyTo (zoom ~18) al punto del evento.
  - Overlay de pÃƒÂ¡nico se compacta arriba para no tapar el mapa; marcador rojo del punto.
- **Archivos / refs:** web/src/dispatch/DispatchPanicHost.jsx, LiveTrackMap.jsx, command-center.css

\nn## 2026-08-31 Ã¢â‚¬â€ GuÃƒÂ­a build iOS en Mac Monterey 12.7.6

- **Tipo:** docs
- **ÃƒÂrea:** mobile | docs
- **QuÃƒÂ©:** Documentado build local iOS (Xcode 14.2 mÃƒÂ¡x.), lÃƒÂ­mites Monterey, Firebase plist y ruta hÃƒÂ­brida Codemagic para TestFlight.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_MONTEREY.md, docs/APP_IOS.md

\n# TacticalPtx Ã¢â‚¬â€ BitÃƒÂ¡cora de desarrollo

**Producto:** TacticalPtx 
**UbicaciÃƒÂ³n canÃƒÂ³nica (Soporte):** `C:\pulsanet\Soporte\Documentos\BITACORA_DESARROLLO.md` 
**Copia en repo:** `C:\pulsanet\docs\BITACORA_DESARROLLO.md` 
**Changelog por versiÃƒÂ³n:** `C:\pulsanet\docs\CHANGELOG.md`

Documento **vivo**: cada cambio, mejora, correcciÃƒÂ³n, despliegue o decisiÃƒÂ³n relevante se aÃƒÂ±ade **arriba** (mÃƒÂ¡s reciente primero), con fecha.

### CÃƒÂ³mo registrar una entrada

```markdown
## 2026-08-31 Ã¢â‚¬â€ PPT: reseÃƒÂ±a por fase en cada semana

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** Cada diapositiva S1Ã¢â‚¬â€œS5 incluye una reseÃƒÂ±a breve de la etapa CVDS (AnÃƒÂ¡lisisÃ¢â‚¬Â¦ Mantenimiento).
- **Archivos / refs:** uild_plan_5_semanas_pptx.py, TACTICALPTX_CVDS_5_SEMANAS.pptx


## 2026-08-31 Ã¢â‚¬â€ PPT CVDS: menos texto + flujo completo

- **Tipo:** docs | ux
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** PresentaciÃƒÂ³n reducida a 11 diapositivas visuales; ciclo AÃ¢â€ â€™F con retorno G/H como diagrama de flujo; chips de navegaciÃƒÂ³n.
- **Archivos / refs:** cvds_flujo_completo.png, TACTICALPTX_CVDS_5_SEMANAS*.pptx


## 2026-08-31 Ã¢â‚¬â€ PPT CVDS: capturas UI, ER, flujos e ilustraciÃƒÂ³n pruebas

- **Tipo:** docs | ux
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** PresentaciÃƒÂ³n enriquecida con galerÃƒÂ­a Web/Android, diagrama ER, flujos PTT/pÃƒÂ¡nico e ilustraciÃƒÂ³n 2D soldados (Chat/GPS/PÃƒÂ¡nico/PTT); navegaciÃƒÂ³n interactiva ampliada.
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, _pptx_assets_cvds_exec/, uild_plan_5_semanas_pptx.py


## 2026-08-31 Ã¢â‚¬â€ PPT CVDS ejecutivo blanco institucional Defensa

- **Tipo:** docs | ux
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** PresentaciÃƒÂ³n 5 semanas rediseÃƒÂ±ada: fondo blanco federal, verdes Defensa, oro institucional; menÃƒÂº y chips con hipervÃƒÂ­nculos; versiones APK/API alineadas (1.8.46+55 / 1.8.21).
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py, PLAN_5_SEMANAS.md


## 2026-08-31 Ã¢â‚¬â€ PPT/plan 5 semanas alineado al CVDS

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** Plan y PowerPoint reestructurados al Ciclo de Vida (AnÃƒÂ¡lisis, DiseÃƒÂ±o, Desarrollo, Pruebas, ImplementaciÃƒÂ³n+Mantenimiento) en 5 semanas; incluye marco 184-185 y ciclo G/H.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py


## 2026-08-31 Ã¢â‚¬â€ Plan ejecutivo 5 semanas + PowerPoint

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** Ciclo de 5 semanas (PlaneaciÃƒÂ³n con alcances, Desarrollo, Pruebas, Entrega, Retro). PPT ejecutivo con grÃƒÂ¡ficos e imÃƒÂ¡genes de marca.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, Soporte/Scripts/build_plan_5_semanas_pptx.py


## 2026-08-29 Ã¢â‚¬â€ Edge: XAMPP Apache quitaba Caddy (sslip mostraba Apache/MariaDB)

- **Tipo:** fix | ops
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:** Detenido `httpd` (XAMPP) en 80/443; Caddy vuelve a servir TacticalPtx. START/ENSURE-PUBLIC-EDGE ahora matan httpd antes de arrancar.
- **Por quÃƒÂ© / notas:** Misma URL pÃƒÂºblica mostraba dashboard XAMPP Apache/MariaDB caÃƒÂ­do.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.ps1`


## YYYY-MM-DD Ã¢â‚¬â€ TÃƒÂ­tulo corto

- **Tipo:** feature | fix | mejora | docs | infra | ux | security | otro
- **ÃƒÂrea:** backend | web | mobile | database | infra | docs | ops
- **QuÃƒÂ©:** Ã¢â‚¬Â¦
- **Por quÃƒÂ© / notas:** Ã¢â‚¬Â¦
- **Archivos / refs:** Ã¢â‚¬Â¦
```

---

---

---

## 2026-08-28 Ã¢â‚¬â€ Radio 1:1: mic del canal + PTT usable en ambos

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Antes de conectar radio 1:1 se libera el mic del canal grupal; PTT con setMicrophoneEnabled; receptor abre el chat con barra visible; reintento si falla audio; ya no se cierra por disconnect breve.
- **Por quÃƒÂ© / notas:** Un lado hablaba y el otro no podÃƒÂ­a ni pulsar el mic (mic ocupado / barra tapada / ready=false).
- **Archivos / refs:** personal_radio_bar.dart, channel_session.dart, 
adio_shell.dart, direct_pane.dart Ã¢â‚¬â€ APK **1.8.46+55**

## 2026-08-28 Ã¢â‚¬â€ Radio 1:1 otra vez con barra PTT (no pantalla de llamada)

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Radio personal vuelve a ser barra PTT arriba del chat (DirectPane / RadioShell); la pantalla fullscreen queda solo para llamada de voz.
- **Por quÃƒÂ© / notas:** En 1.8.44 el radio 1:1 se habÃƒÂ­a abierto como PrivateCallScreen.
- **Archivos / refs:** `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart` Ã¢â‚¬â€ APK **1.8.45+54**

## 2026-08-28 Ã¢â‚¬â€ Llamadas: foto de perfil + contestar desde push

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Avatar con foto en pantalla de llamada/entrante; al tocar la notificaciÃƒÂ³n de llamada se abre Contestar/Rechazar (antes se ignoraba y la llamada se perdÃƒÂ­a). FCM canal `tacticalptx_calls` tambiÃƒÂ©n para radio 1:1; GET `/api/calls/private/:id`.
- **Archivos / refs:** `private_call_screen.dart`, `incoming_call_screen.dart`, `radio_shell.dart`, `push_service.dart`, `calls.js`, `fcm.js` Ã¢â‚¬â€ APK **1.8.44+53**

## 2026-08-28 Ã¢â‚¬â€ Edge publico levantado (APK sin conexion)

- **Tipo:** infra | fix
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:** APK no conectaba a `https://189.152.200.238.sslip.io` porque Caddy 80/443 estaba caido; se ejecuto `ENSURE-PUBLIC-EDGE` Ã¢â€ â€™ health 200.
- **Por quÃƒÂ© / notas:** UPnP reporto fallo; si 4G sigue fallando, abrir 80/443 en el router hacia la PC.
- **Archivos / refs:** `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/START-PUBLIC-EDGE.ps1`

## 2026-08-28 Ã¢â‚¬â€ BAT reforzado + stack levantado

- **Tipo:** infra
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:** Refuerzo de `LEVANTAR-TACTICALPTX.bat` (preflight, espera LiveKit, chequeo post-edge, `/strict`, logs con timestamp); arreglo UTF-8/em-dash en `start-api.cmd` / `start-web.cmd` que rompÃƒÂ­a el parseo de cmd; stack verificado (API/Web/Redis/LiveKit).
- **Por quÃƒÂ© / notas:** Caracteres Unicode y parentesis en `echo` rompen etiquetas/batch en Windows. Scripts en ASCII puro.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-28 Ã¢â‚¬â€ Plan de trabajo en PDF

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** ExportaciÃƒÂ³n PDF de `PLAN_DE_TRABAJO.md`; script reutilizable `Soporte/Scripts/md_plan_to_pdf.py`.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.pdf`

## 2026-08-28 Ã¢â‚¬â€ Plan de trabajo maestro (sprints + roadmap)

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** Documento PLAN_DE_TRABAJO: plan desde cero en 13 sprints (2 sem), roadmap pendiente vs estado actual, seguimiento MEJORAS.txt y escalones 1.8.x.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.md`, `docs/PLAN_DE_TRABAJO.md`, `README.md`

## 2026-08-28 Ã¢â‚¬â€ Web chat: avatares en burbujas + banner en llamada

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Chat grupal (Radio) muestra foto de perfil junto a mensajes ajenos (como la APK); globo de mensaje vuelve a aparecer durante llamada privada.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `web/src/chatNotify.js`

## 2026-08-28 Ã¢â‚¬â€ Seguimiento: nombres en mapa solo al seleccionar

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Marcadores de ubicaciÃƒÂ³n ya no muestran etiqueta bajo el avatar; al seleccionar operador se ve nombre, popup y panel lateral como antes.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `web/src/dispatch/command-center.css`

## 2026-08-28 Ã¢â‚¬â€ APK 1.8.43+52 publicada (fix burbujas chat)

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Build release + OTA (`force`) con fix de burbujas recibidas; copia en `Soporte\APK\`.
- **Archivos / refs:** `Soporte\APK\TacticalPtx-1.8.43+52.apk`, `backend\app-updates\files\TacticalPtx.apk`

## 2026-08-28 Ã¢â‚¬â€ APK chat: burbujas recibidas sin recorte (hora visible)

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Mensajes entrantes ya no quedan cortados en el borde izquierdo; la hora y el contenido corto (p. ej. Ã‚Â«.Ã‚Â») se ven completos en DM y grupo.
- **Por quÃƒÂ© / notas:** `IntrinsicWidth` + `Stack`/`Positioned` no reservaba ancho para la meta; ahora `Column` + ancho mÃƒÂ­nimo y mÃƒÂ¡s padding horizontal.
- **Archivos / refs:** `mobile/lib/chat_bubble_style.dart`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart` Ã¢â‚¬â€ **1.8.43+52**

## 2026-08-28 Ã¢â‚¬â€ Seguimiento: colores Tamaulipas rojo / SLP verde

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En mapa IV R.M., **Tamaulipas** rojo tenue (`#c97070`); **San Luis PotosÃƒÂ­** verde (el que tenÃƒÂ­a Tamaulipas, `#1f8a4c`).
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`

## 2026-08-28 Ã¢â‚¬â€ Chat abierto: tono suave WhatsApp (sin notificaciÃƒÂ³n fuerte)

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - Con el **hilo abierto**, solo tono tenue (estilo WhatsApp); sin bandeja ni sirena Nokia a volumen completo.
  - **APK:** FCM en primer plano ya no duplica el push (socket maneja UI/tono); iOS sin sonido de sistema en foreground.
  - **Web:** `playMessageTone({ soft: true })` al leer el chat activo (grupo y DM).
- **VersiÃƒÂ³n:** 1.8.42+51 (APK)
- **Archivos / refs:** `message_tone.dart`, `push_service.dart`, `chat_message_banner.dart`, `appNotify.js`, `ChatInbox.jsx`, `DirectChat.jsx`

## 2026-08-28 Ã¢â‚¬â€ Fix Error 500: API inestable + BAT reforzado

- **Tipo:** fix | infra
- **ÃƒÂrea:** infra | backend | ops
- **QuÃƒÂ©:**
  - **Causa:** la API caÃƒÂ­a o reiniciaba (`--watch`) y Watch-Stack **mataba el puerto :4000** cada 15 s Ã¢â€ â€™ bucle de muerte Ã¢â€ â€™ consola/APK veÃƒÂ­an "Error del servidor (500)".
  - **Watch-Stack:** no mata proceso si :4000 escucha; 4 fallos + cooldown 120 s antes de reiniciar; health con timeout mayor.
  - **start-api.cmd:** si health OK, espera 20 s sin relanzar npm (como Web).
  - **LEVANTAR-TACTICALPTX.bat:** chequeo Redis, espera API 60 s, no libera :4000 hasta confirmar zombie, log en `Soporte\Logs\levantar-*.log`, aviso explÃƒÂ­cito del 500.
  - **API:** logs de ruta en errores 500; try/catch en listado de pÃƒÂ¡nico.
- **Archivos / refs:** `infra/Watch-Stack.ps1`, `infra/start-api.cmd`, `LEVANTAR-TACTICALPTX.bat`, `backend/src/server.js`, `routes/panic.js`

## 2026-08-28 Ã¢â‚¬â€ PÃƒÂ¡nico: silenciar sirena al abrir mapa

- **Tipo:** fix
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - **APK:** al pulsar **Ver ubicaciÃƒÂ³n** / **CÃƒÂ³mo llegar** se detiene sirena y vibraciÃƒÂ³n en el dispositivo (overlay sigue hasta Enterado).
  - **Web:** mismo comportamiento en Radio (modal) y Despacho (`DispatchPanicHost`); botones **Ver ubicaciÃƒÂ³n** y **CÃƒÂ³mo llegar** en consola.
- **VersiÃƒÂ³n:** 1.8.41+50 (APK)
- **Archivos / refs:** `channel_session.dart`, `radio_shell.dart`, `DispatchPanicHost.jsx`, `RadioPage.jsx`, `usePtt.js`, `panicMaps.js`

## 2026-08-28 Ã¢â‚¬â€ Fix overlay UbicaciÃƒÂ³n GPS transparente

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Panel **UbicaciÃƒÂ³n** y **Canales** con fondo opaco (`Material` + `kInstPaper`) para no superponerse sobre Radio.
  - Texto GPS con padding horizontal para evitar solapamiento visual.
- **VersiÃƒÂ³n:** 1.8.40+49
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

## 2026-08-28 Ã¢â‚¬â€ PÃƒÂ¡nico APK: ver ubicaciÃƒÂ³n y cÃƒÂ³mo llegar

- **Tipo:** feature
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Overlay de pÃƒÂ¡nico con botones **Ver ubicaciÃƒÂ³n** y **CÃƒÂ³mo llegar** (Maps / navegaciÃƒÂ³n externa).
  - Guarda lat/lng del `panic:alert`; sync de pÃƒÂ¡nico activo al abrir/reanudar; push FCM con coords; `GET /api/panic/:id`.
- **VersiÃƒÂ³n:** 1.8.39+48
- **Archivos / refs:** `mobile/lib/panic_maps.dart`, `radio_shell.dart`, `channel_session.dart`, `push_service.dart`, `backend/src/services/panic.js`, `routes/panic.js`

## 2026-08-28 Ã¢â‚¬â€ Fix mensajes al estar inactivo (historial + sync)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - DM: historial pedÃƒÂ­a los mensajes **mÃƒÂ¡s viejos** (`ORDER BY ASC LIMIT`); ahora trae los **ÃƒÂºltimos** N.
  - Grupo/DM: al volver de inactividad o abrir el chat se re-sincroniza historial desde el servidor (no solo memoria/socket).
  - Push FCM con preview del texto y `title`/`body` tambiÃƒÂ©n en `data`.
- **VersiÃƒÂ³n:** 1.8.38+47
- **Archivos / refs:** `backend/src/services/dm.js`, `fcm.js`, `socket/chat.js`, `socket/dm.js`, `mobile/lib/channel_session.dart`, `direct_pane.dart`, `radio_shell.dart`

## 2026-08-28 Ã¢â‚¬â€ Fix envÃƒÂ­o de mensajes APK (DM join + eco socket)

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - DM: `dm:join` al conectar/reconectar y antes de cada envÃƒÂ­o (el join se perdÃƒÂ­a si el socket aÃƒÂºn no conectaba).
  - DM/grupo: eco `dm:message` / `chat:message` al emisor; handler `dm:error`; mensajes optimistas en chat grupal con `clientMsgId`.
  - Scroll del chat solo salta al llegar mensajes nuevos (no en cada rebuild).
- **VersiÃƒÂ³n:** 1.8.37+46
- **Archivos / refs:** `mobile/lib/screens/direct_pane.dart`, `channel_session.dart`, `chat_panel.dart`, `backend/src/socket/dm.js`, `chat.js`

## 2026-08-28 Ã¢â‚¬â€ APK MEJORAS.txt (globo, pÃƒÂ¡nico, scroll, avatares, PTT, audio)

- **Tipo:** fix | ux | mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Globo de mensajes global (`ChatMessageBanner`) en shell y durante llamada/radio 1:1.
  - Alerta de pÃƒÂ¡nico como overlay en cualquier pestaÃƒÂ±a (Seguimiento incluido), no solo diÃƒÂ¡logo tapado.
  - AtrÃƒÂ¡s en llamada minimiza (PopScope); radio 1:1 abre pantalla completa con PTT visible al expandir y en barra mini.
  - `IndexedStack` + overlays en stack (Seguimiento/Grupos) preservan estado; scroll de chat mÃƒÂ¡s estable.
  - Avatares en burbujas de chat grupal y DM; formato indicativo en cabecera DM.
  - Audio: altavoz forzado solo si radio no estÃƒÂ¡ en mute; menos invasiÃƒÂ³n al colgar llamada.
- **VersiÃƒÂ³n:** 1.8.36+45
- **Archivos / refs:** `mobile/lib/chat_message_banner.dart`, `radio_shell.dart`, `private_call_screen.dart`, `chat_panel.dart`, `direct_pane.dart`, `channel_session.dart`, `peer_actions.dart`

## 2026-08-28 Ã¢â‚¬â€ Globo de chat global (cualquier pÃƒÂ¡gina)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Globo tipo WhatsApp Web centralizado (`GlobalChatNotifyHost` + `chatNotify.js`) visible en Radio, Despacho, Seguimiento, Config, etc.
  - z-index 15000 para quedar encima del despacho/mapa.
  - Al salir del panel de chat (otro mÃƒÂ³dulo) ya no se suprime el aviso; clic abre Radio con el hilo correcto.
- **Archivos / refs:** `web/src/GlobalChatNotifyHost.jsx`, `web/src/chatNotify.js`, `web/src/App.jsx`, `web/src/ChatInbox.jsx`, `web/src/styles.css`

---

## 2026-08-28 Ã¢â‚¬â€ Notificaciones SO con permiso activo (service worker)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Notificaciones del sistema vÃƒÂ­a `sw-notify.js` + `registration.showNotification()` (Chrome/Edge no muestran bien `new Notification()` con pestaÃƒÂ±a minimizada aunque el permiso estÃƒÂ© en Ã‚Â«PermitirÃ‚Â»).
  - Banner in-app siempre que no estÃƒÂ©s leyendo ese chat (tambiÃƒÂ©n respaldo al volver a la pestaÃƒÂ±a).
  - Registro automÃƒÂ¡tico del service worker al iniciar sesiÃƒÂ³n.
- **Por quÃƒÂ© / notas:** Usuario con notificaciones permitidas solo oÃƒÂ­a el tono; el aviso visual no aparecÃƒÂ­a en segundo plano.
- **Archivos / refs:** `web/public/sw-notify.js`, `web/src/appNotify.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/App.jsx`

---

## 2026-08-28 Ã¢â‚¬â€ Web DM: lecturas en vivo + banner de notificaciÃƒÂ³n

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Chat 1:1 web marca mensajes como leÃƒÂ­dos al abrir el hilo y al recibir mensajes (`markDmRead`).
  - Escucha `dm:receipts` por socket para actualizar palomitas sin recargar la pÃƒÂ¡gina.
  - Corregida detecciÃƒÂ³n de Ã¢â‚¬Å“chat visibleÃ¢â‚¬Â (`visiblePeerId` + `active`) para no suprimir avisos al cambiar a grupo/radio.
  - Banner in-app de mensaje en `ChatInbox` (portal a `document.body`); fallback visual si no hay permiso de Notification del SO.
- **Por quÃƒÂ© / notas:** En web los mensajes enviados no pasaban a Ã¢â‚¬Å“leÃƒÂ­doÃ¢â‚¬Â hasta F5; el sonido sonaba pero no aparecÃƒÂ­a el banner tipo WhatsApp Web.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/api.js`, `web/src/appNotify.js`

---

## 2026-08-27 Ã¢â‚¬â€ LEVANTAR reforzado (reintentos + edge + Watch-Stack)

- **Tipo:** infra | mejora
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:**
  - `LEVANTAR-TACTICALPTX.bat` en 7 pasos: PG, Redis/LiveKit, firewall, API, Web, Watch-Stack, borde pÃƒÂºblico.
  - Reintento automÃƒÂ¡tico si API/Web no dan health; scorecard final [OK]/[!!].
  - Watch-Stack tambiÃƒÂ©n vigila LiveKit y el edge HTTPS (log en `Soporte\Logs\watch-stack.log`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/Watch-Stack.ps1`

## 2026-08-27 Ã¢â‚¬â€ Fix mensaje OTA Ã¢â‚¬Å“ActualizandoÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦Ã¢â‚¬Â

- **Tipo:** fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** El ellipsis Unicode se corrompÃƒÂ­a en el manifiesto JSON; ahora usa `Actualizando...` (ASCII) y se sanitiza en API/app.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `appUpdate.js`, `app_update.dart`, `main.dart`

## 2026-08-27 Ã¢â‚¬â€ APK UI profesional (tipografÃƒÂ­a institucional)

- **Tipo:** ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - TipografÃƒÂ­a Oswald + Source Sans 3 (como la web); tema Material refinado.
  - Login y Radio PTT mÃƒÂ¡s presentables (cabecera, estado, PTT, pÃƒÂ¡nico, canales).
  - Barra Chats/Radio con iconos redondeados y tipografÃƒÂ­a clara.
  - APK **1.8.35+44**.
- **Archivos / refs:** `theme.dart`, `login_screen.dart`, `radio_screen.dart`, `radio_shell.dart`, `google_fonts`

## 2026-08-27 Ã¢â‚¬â€ PTT radio grupal por toque (abre / libera)

- **Tipo:** ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** En radio de canal/grupo, un toque pone al aire y el segundo libera (ya no hay que mantener). Espacio en web tambiÃƒÂ©n es toggle. APK **1.8.34+43**.
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `LiveTrackMap.jsx`

## 2026-08-27 Ã¢â‚¬â€ Lightbox: copiar / descargar imagen (como WhatsApp)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En la galerÃƒÂ­a a pantalla completa: botones Copiar y Descargar; clic derecho con las mismas opciones. El menÃƒÂº del navegador estaba bloqueado y la toolbar oculta.
- **Archivos / refs:** `ImageGalleryLightbox.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-27 Ã¢â‚¬â€ Web Vite: por quÃƒÂ© caÃƒÂ­a y watchdog anti-caÃƒÂ­da

- **Tipo:** infra | fix
- **ÃƒÂrea:** infra | web | ops
- **QuÃƒÂ©:**
  - Causa: Vite arrancado desde shell de Cursor muere al abortar la sesiÃƒÂ³n; `http://127.0.0.1:5173` falla (solo **HTTPS** con certs LAN).
  - `start-web.cmd` / `start-api.cmd` reinician solos si el proceso sale.
  - `Watch-Stack.ps1` + `ENSURE-WEB.cmd`; LEVANTAR lanza el watchdog en segundo plano.
- **Por quÃƒÂ© / notas:** Usar siempre https://127.0.0.1:5173; no depender del terminal del agente.
- **Archivos / refs:** `infra/start-web.cmd`, `infra/start-api.cmd`, `infra/Watch-Stack.ps1`, `infra/ENSURE-WEB.cmd`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-27 Ã¢â‚¬â€ Pegar / editar imÃƒÂ¡genes en chat (estilo WhatsApp Web)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Ctrl+V (o Cmd+V) pega imÃƒÂ¡genes en chat grupal y DM y abre vista previa.
  - Adjuntar foto tambiÃƒÂ©n abre el compositor (no envÃƒÂ­a al instante).
  - Herramientas: recortar/rotar, mejorar, dibujar, texto, formas, mosaico, emoji, HD, deshacer/rehacer, descargar; caption; varias imÃƒÂ¡genes (+).
- **Por quÃƒÂ© / notas:** Paridad con WhatsApp Web al pegar; Ã¢â‚¬Å“ver una vezÃ¢â‚¬Â no incluido (sin backend).
- **Archivos / refs:** `MediaComposerModal.jsx`, `mediaComposerUtils.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 Ã¢â‚¬â€ Radio 1:1: toggle PTT, mÃƒÂ¡s rÃƒÂ¡pido y nueva forma

- **Tipo:** ux | mejora
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - PTT por toque: 1.Ã‚Âº abre el canal, 2.Ã‚Âº libera (ya no hay que mantener pulsado).
  - ConexiÃƒÂ³n mÃƒÂ¡s rÃƒÂ¡pida: audio/E2EE y LiveKit + mic en paralelo; socket solo WebSocket.
  - Nueva forma: tarjeta redondeada con mic circular (app + web).
  - APK **1.8.33+42**.
- **Archivos / refs:** `personal_radio_bar.dart`, `PrivateRadioBar.jsx`, `styles.css`, `pubspec.yaml`

## 2026-08-27 Ã¢â‚¬â€ Textos OTA sin Ã¢â‚¬Å“BanjeCelÃ¢â‚¬Â

- **Tipo:** ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Al actualizar la APK el mensaje visible es **ActualizandoÃ¢â‚¬Â¦** / **Descargando configuraciÃƒÂ³nÃ¢â‚¬Â¦**; se eliminÃƒÂ³ Ã¢â‚¬Å“BanjeCelÃ¢â‚¬Â del manifiesto y de la publicaciÃƒÂ³n; API y app filtran ese texto si aparece.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `app_update.dart`, `appUpdate.js`, `main.dart`

## 2026-08-27 Ã¢â‚¬â€ Uploads por jerarquÃƒÂ­a y carpetas de grupo

- **Tipo:** mejora | infra
- **ÃƒÂrea:** backend
- **QuÃƒÂ©:**
  - Media de chat/PTT y avatares se guardan bajo `uploads/orgs/{orgId}/Ã¢â‚¬Â¦` con jerarquÃƒÂ­a regiÃƒÂ³n/zona/unidad cuando el grupo tiene `unit_id`, y carpeta por grupo.
  - DM Ã¢â€ â€™ `orgs/{orgId}/dm/`; avatares Ã¢â€ â€™ `orgs/{orgId}/avatars/`.
  - Archivos planos previos siguen resolviÃƒÂ©ndose (compatibilidad).
- **Archivos / refs:** `backend/src/services/uploads.js`, `messages.js`, `dm.js`, `recordings.js`, `me.js`, `admin.js`

## 2026-08-27 Ã¢â‚¬â€ Radio 1:1 arriba (PTT) sin tapar el chat

- **Tipo:** ux | fix
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - Radio personal deja de usar `bottomSheet` / barra inferior grande; franja superior compacta con un botÃƒÂ³n **PTT** + cerrar.
  - Se puede escribir en el chat y usar el teclado con la radio activa.
  - Web: barra bajo el header del DM (mismo patrÃƒÂ³n).
- **Archivos / refs:** `personal_radio_bar.dart`, `direct_pane.dart`, `radio_shell.dart`, `peer_actions.dart`, `PrivateRadioBar.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 Ã¢â‚¬â€ Layout Historial / AuditorÃƒÂ­a a ancho completo

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** La pantalla de auditorÃƒÂ­a usa todo el ancho del panel; columnas de tabla reequilibradas; detalle legible (no JSON cortado en 22 rem).
- **Archivos / refs:** `ConfigAudit.jsx`, `command-center.css`

## 2026-08-27 Ã¢â‚¬â€ Fix foto de perfil en APK (Bearer Ã¢â€ â€™ Image.memory)

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - `UserAvatar` ya no usa `Image.network` (falla con URL autenticada); descarga con `http.get` + Bearer y muestra `Image.memory`.
  - Icono de grupo en cabecera del chat tambiÃƒÂ©n usa `UserAvatar` con auth.
  - APK **1.8.31+40** OTA force.
- **Archivos / refs:** `user_avatar.dart`, `api_client.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`, `pubspec.yaml`

## 2026-08-27 Ã¢â‚¬â€ Historial / AuditorÃƒÂ­a en ConfiguraciÃƒÂ³n

- **Tipo:** feature
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:**
  - Pantalla **ConfiguraciÃƒÂ³n Ã¢â€ â€™ Historial / AuditorÃƒÂ­a** (quiÃƒÂ©n, quÃƒÂ©, cuÃƒÂ¡ndo) solo para root/admin.
  - `GET /api/admin/activity` restringido a admin; filtros por acciÃƒÂ³n/bÃƒÂºsqueda y paginaciÃƒÂ³n.
- **Archivos / refs:** `ConfigAudit.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`, `api.js`, `admin.js`, `command-center.css`

## 2026-08-27 Ã¢â‚¬â€ DelimitaciÃƒÂ³n IV R.M. detallada (NL / TM / SLP)

- **Tipo:** mejora | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** PolÃƒÂ­gonos de Nuevo LeÃƒÂ³n, Tamaulipas y San Luis PotosÃƒÂ­ regenerados con frontera de alta resoluciÃƒÂ³n (fuente estados MÃƒÂ©xico); deja de cortar ciudades (p. ej. Nuevo Laredo) por simplificaciÃƒÂ³n excesiva.
- **Archivos / refs:** `web/src/dispatch/data/ivRmStates.json`, `LiveTrackMap.jsx`

## 2026-08-27 Ã¢â‚¬â€ PÃƒÂ¡nico solo al grupo del operador

- **Tipo:** security | mejora
- **ÃƒÂrea:** backend | web | docs
- **QuÃƒÂ©:**
  - La alerta de pÃƒÂ¡nico ya no escala a todo el proyecto (admins/despacho/`canReceivePanic` fuera del canal).
  - Socket, FCM y listado `GET /api/panic` quedan acotados a **miembros del grupo** del canal activo; la consola solo recibe `dispatch:panic` si el operador pertenece a ese grupo.
  - Enterado / Resolver / Cancelar: solo miembros del mismo grupo.
- **Por quÃƒÂ© / notas:** Evitar impacto org-wide; el alcance lo define `group_members`.
- **Archivos / refs:** `backend/src/services/panic.js`, `backend/src/routes/panic.js`, `docs/V1_7_PANIC.md`, `DispatchPanicHost.jsx`

## 2026-08-27 Ã¢â‚¬â€ Radio PTT antes de CatÃƒÂ¡logos en el menÃƒÂº

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En el rail del despacho, **Radio PTT** queda arriba de CatÃƒÂ¡logos (despuÃƒÂ©s de Mapa en vivo).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ DelimitaciÃƒÂ³n estados IV R.M. en Seguimiento

- **Tipo:** feature / ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Seguimiento en vivo se muestran polÃƒÂ­gonos tenues de **Nuevo LeÃƒÂ³n**, **Tamaulipas** y **San Luis PotosÃƒÂ­** (relleno semitransparente + borde suave) sin tapar el fondo del mapa; leyenda en el chrome del mapa.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`, `command-center.css`

---

## 2026-08-27 Ã¢â‚¬â€ PTT visible al maximizar

- **Tipo:** fix / ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Corregido layout Radio keep-alive (outlet aparcado con `display:none`) que al maximizar ocultaba/recortaba el PTT.
  - BotÃƒÂ³n PTT mini siempre en la franja de radio del despacho.
  - En Seguimiento maximizado: PTT flotante encima del mapa.
- **Archivos / refs:** `DispatchLayout.jsx`, `LiveTrackMap.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 Ã¢â‚¬â€ Indicativo al aire (SGTO GOMEZ, S.O. IV R.M.)

- **Tipo:** feature / ux
- **ÃƒÂrea:** backend | web
- **QuÃƒÂ©:**
  - Indicativo visible en chat/PTT: grado + apellido en MAYÃƒÅ¡SCULAS (SGTO GOMEZ) o libre (B.O. LINARES).
  - Detalle opcional entre parÃƒÂ©ntesis: `S.O. IV R.M. (SALA DE OPERACIONES IV R.M.)`.
  - Campo editable en alta/ediciÃƒÂ³n de usuarios; login (ggomezd2) no cambia.
  - Grados/puestos: SGTO, B.O., S.O., C.G. Script `npm run rebuild:callsigns` para regenerar display_name existentes.
- **Archivos / refs:** `backend/src/services/rfcUsername.js`, `admin.js`, `catalogs.js`, `defaultGrades.js`, `scripts/rebuild-callsigns.js`; `web/src/dispatch/DispatchUsers.jsx`, `armyGrades.js`

---

## 2026-08-27 Ã¢â‚¬â€ Scroll del chat al volver de Seguimiento

- **Tipo:** fix / ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Radio PTT en despacho permanece montado (oculto) al ir a Seguimiento/u otros mÃƒÂ³dulos; se conserva conversaciÃƒÂ³n y posiciÃƒÂ³n de scroll. Auto-scroll del chat solo si estÃƒÂ¡s al final.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `command-center.css`, `App.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Banner de mensaje visible en llamada

- **Tipo:** fix / ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - Web: banner WhatsApp por encima del overlay de llamada (`z-index`); no silenciar aviso si el chat estÃƒÂ¡ tapado por la llamada.
  - App: tarjeta emergente sobre la pantalla de llamada (tambiÃƒÂ©n minimizada); evita SnackBar detrÃƒÂ¡s de la llamada.
- **Por quÃƒÂ© / notas:** En llamada los mensajes no se veÃƒÂ­an (overlay / chat abierto = Ã¢â‚¬Å“ya estÃƒÂ¡s viendoÃ¢â‚¬Â).
- **Archivos / refs:** `web/src/appNotify.js`, `privateCallUi.js`, `PrivateCallOverlay.jsx`, `styles.css`; `mobile/lib/screens/private_call_screen.dart`, `radio_shell.dart`

---

## 2026-08-27 Ã¢â‚¬â€ AtrÃƒÂ¡s en llamada minimiza (no cuelga)

- **Tipo:** fix / ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - App: flecha atrÃƒÂ¡s / gesto atrÃƒÂ¡s minimiza la llamada a una barra superior; el audio sigue; Colgar corta.
  - Web: flecha Ã¢â€ Â y Esc minimizan; solo Ã‚Â«ColgarÃ‚Â» / botÃƒÂ³n rojo cierra la llamada.
- **Por quÃƒÂ© / notas:** Evitar colgar al salir de la UI de llamada (comportamiento tipo WhatsApp).
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`; `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`

---

## 2026-08-27 Ã¢â‚¬â€ RecuperaciÃƒÂ³n DispatchLayout moderno

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Reconstruido `DispatchLayout.jsx` tras revert accidental a versiÃƒÂ³n antigua: `listenIds`/`onListenChange`, menÃƒÂº ConfiguraciÃƒÂ³n (Canales/Respaldos), catÃƒÂ¡logos actuales, outlet embebido para Radio/ConfigChannels, roles zona/unidad, mute oculto en `/despacho/radio`, Salir solo con `canManageUsers`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Alerta de pÃƒÂ¡nico visible en toda la consola

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** La ventana emergente de pÃƒÂ¡nico (Enterado / Resolver) y la sirena viven en el layout de despacho, no solo en Operaciones. En **Seguimiento**, Mapa, CatÃƒÂ¡logos, etc. tambiÃƒÂ©n aparece y se puede detener.
- **Por quÃƒÂ© / notas:** Al salir de Operaciones se desmontaba el CommandCenter y cortaba sirena/UI.
- **Archivos / refs:** `web/src/dispatch/DispatchPanicHost.jsx`, `DispatchLayout.jsx`, `CommandCenter.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Editar usuarios (admins unidad/zona/regiÃƒÂ³n/root)

- **Tipo:** feature
- **ÃƒÂrea:** backend | web
- **QuÃƒÂ©:** BotÃƒÂ³n **Editar** en CatÃƒÂ¡logos Ã¢â€ â€™ Usuarios (solo `canManageUsers`: admin unidad, zona, regiÃƒÂ³n y Superadmin). Permite cambiar grado, nombre, matrÃƒÂ­cula, cargo, rol, adscripciÃƒÂ³n y visibilidad. El usuario de acceso no se regenera.
- **Archivos / refs:** `backend/src/routes/admin.js` (PATCH identidad), `web/src/dispatch/DispatchUsers.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Foto de perfil no se veÃƒÂ­a en Radio (app)

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** El avatar en cabecera/perfil se carga con **Bearer** (como la web), no solo con ticket `?atk=` de 1 h. Si la descarga falla, muestra iniciales en lugar de cÃƒÂ­rculo blanco vacÃƒÂ­o.
- **Por quÃƒÂ© / notas:** El ticket corto expiraba y `NetworkImage` dejaba el `CircleAvatar` en blanco aunque el archivo existiera en el servidor.
- **Archivos / refs:** `mobile/lib/api_client.dart`, `widgets/user_avatar.dart`, `radio_screen.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 Ã¢â‚¬â€ Salir solo para admins (unidad/zona/regiÃƒÂ³n/root)

- **Tipo:** ux | security
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** OpciÃƒÂ³n Ã‚Â«SalirÃ‚Â» visible solo para `unit_admin`, `zone_admin`, `admin` (RegiÃƒÂ³n) y `root` (Superadmin). Operadores y despacho no la ven. En la app: perfil (avatar) + overlay de canales. En web: radio y consola de despacho.
- **Por quÃƒÂ© / notas:** Evitar cierre de sesiÃƒÂ³n accidental en radios de campo. Sigue disponible en error de carga y en cambio de clave temporal.
- **Archivos / refs:** `mobile/lib/roles.dart`, `radio_shell.dart`, `groups_screen.dart`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Ojito ver/ocultar contraseÃƒÂ±a

- **Tipo:** ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** En Ã‚Â«Cambiar contraseÃƒÂ±aÃ‚Â» (APK) cada campo tiene icono de ojo para mostrar/ocultar; mismo patrÃƒÂ³n en login y cambio de clave de la web. El botÃƒÂ³n de salida dice Ã‚Â«SalirÃ‚Â» (antes Ã‚Â«Cerrar sesiÃƒÂ³nÃ‚Â»).
- **Archivos / refs:** `mobile/lib/screens/change_password_screen.dart`, `web/src/App.jsx`, `web/src/institutional.css`

---

## 2026-08-27 Ã¢â‚¬â€ Sin Altavoz duplicado en menÃƒÂº Radio

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En `/despacho/radio` se oculta el botÃƒÂ³n Altavoz/MUTE de la barra superior (ya estÃƒÂ¡ Ã‚Â«SilenciarÃ‚Â» abajo); en el resto de menÃƒÂºs se mantiene.
- **Archivos / refs:** `DispatchLayout.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ Imagen de grupo/canal

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile | database
- **QuÃƒÂ©:** `groups.avatar_url` (migraciÃƒÂ³n 020); admin sube/quita icono en CatÃƒÂ¡logos Ã¢â€ â€™ Grupos; se muestra en bandeja y cabecera de chat (web + APK).
- **Archivos / refs:** `020_group_avatar.sql`, `admin.js`, `groups.js`, `me.js`, `DispatchGroups.jsx`, `PersonAvatar.jsx`, `ChatInbox.jsx`, `WhatsAppChat.jsx`, `user_avatar.dart`

---

## 2026-08-27 Ã¢â‚¬â€ Mute radio sin mover botones

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Quitado el aviso extra Ã‚Â«Radio silenciadaÃ¢â‚¬Â¦Ã‚Â» que empujaba el layout; el estado va en la lÃƒÂ­nea Ã‚Â«Canal libreÃ‚Â». Botones Altavoz/MUTE con ancho fijo.
- **Archivos / refs:** `RadioPage.jsx`, `DispatchLayout.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 Ã¢â‚¬â€ ConfiguraciÃƒÂ³n Ã¢â€ â€™ Canales (oÃƒÂ­r / hablar)

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Selector multi-canal movido a ConfiguraciÃƒÂ³n Ã¢â€ â€™ Canales; barra superior solo muestra canal PTT + Ã‚Â«Oye N/MÃ‚Â» con enlace. Respaldos sigue solo admin.
- **Archivos / refs:** `ConfigChannels.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

---

## 2026-08-27 Ã¢â‚¬â€ KPI despacho: textos centrados

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** NÃƒÂºmeros/etiquetas centrados **dentro** de cada tarjeta; la fila de cuadros vuelve a la izquierda y Ã‚Â«ConexiÃƒÂ³n en vivoÃ‚Â» a la derecha.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

## 2026-08-27 Ã¢â‚¬â€ Avatares en lista de chats (web + APK)

- **Tipo:** feature | ux
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:** API DM devuelve `avatarUrl` en contactos y conversaciones; componente `PersonAvatar` / `UserAvatar` en bandeja de chats.
- **Archivos / refs:** `backend/src/services/dm.js`, `web/src/PersonAvatar.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/user_avatar.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 Ã¢â‚¬â€ Despacho: actividad y grabaciones en columnas

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Panel inferior en 2 columnas (actividad | grabaciones) a igual altura; mÃƒÂ¡s espacio al bloque inferior (~55%); KPI compacto.
- **Por quÃƒÂ© / notas:** Apiladas verticalmente, grabaciones quedaban fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 Ã¢â‚¬â€ Despacho: layout viewport sin cortar grabaciones

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** `cc-workspace-grid` envuelve mapa + panel inferior; KPI/banners fijos arriba; todo cabe en `100dvh` con scroll interno en actividad/grabaciones.
- **Por quÃƒÂ© / notas:** El grid de 2 filas trataba KPI como fila 1 y empujaba grabaciones fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 Ã¢â‚¬â€ Despacho: panel actividad/grabaciones menos comprimido

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** MÃƒÂ¡s altura mÃƒÂ­nima al bloque inferior (actividad, grabaciones PTT, detalle); mÃƒÂ¡s padding en filas y cabeceras; columna detalle mÃƒÂ¡s ancha.
- **Por quÃƒÂ© / notas:** El usuario reportÃƒÂ³ el apartado Ã‚Â«muy comprimidoÃ‚Â» en el centro de mando.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

- **Tipo:** fix
- **ÃƒÂrea:** backend | mobile | infra
- **QuÃƒÂ©:** LiveKit no escuchaba UDP 7882 (usaba rango 50000+ sin UPnP). Simplificado `livekit.dev.yaml`; `--udp-port 7882` explÃƒÂ­cito; STUN sin `--node-ip` fijo. LAN Ã¢â€ â€™ `ws://IP_LAN:7880`; 4G Ã¢â€ â€™ `wss://dominio`. MÃƒÂ³vil no reescribe `ws://192.168.x` a wss.
- **Por quÃƒÂ© / notas:** `MediaConnectException` / ICE timeout en PTT. Causa raÃƒÂ­z: puerto media UDP no abierto en el servidor.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `Caddyfile.edge.template`

---

## 2026-08-26 Ã¢â‚¬â€ PTT mÃƒÂ³vil: una URL para WiÃ¢â‚¬â€˜Fi y 4G (sin obligar LAN)

- **Tipo:** fix
- **ÃƒÂrea:** backend | infra
- **QuÃƒÂ©:** LiveKit siempre `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). Quitado atajo `ws://LAN:7880` y `--node-ip` fijo; STUN + candidatos LAN + TURN. `LIVEKIT_PUBLIC_URL` en borde pÃƒÂºblico.
- **Por quÃƒÂ© / notas:** El fix anterior solo funcionaba en la misma WiÃ¢â‚¬â€˜Fi; 4G seguÃƒÂ­a roto. Ahora LAN y datos mÃƒÂ³viles usan la misma seÃƒÂ±al HTTPS.
- **Archivos / refs:** `backend/src/services/livekit.js`, `infra/start-services.ps1`, `infra/Caddyfile.edge`, `START-PUBLIC-EDGE.ps1`

---

## 2026-08-26 Ã¢â‚¬â€ Fix audio PTT mÃƒÂ³vil (LiveKit ICE timeout)

- **Tipo:** fix
- **ÃƒÂrea:** backend | mobile | infra
- **QuÃƒÂ©:** URL LiveKit segÃƒÂºn contexto: LAN Ã¢â€ â€™ `ws://IP_LAN:7880`; remoto HTTPS Ã¢â€ â€™ `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). `LIVEKIT_LAN_HOST` auto-sync en `start-services.ps1`. MÃƒÂ³vil reescribe `wss` cuando API es HTTPS. UPnP/firewall LiveKit reforzados.
- **Por quÃƒÂ© / notas:** La app recibÃƒÂ­a `ws://IP_PUBLICA:7880`; en WiÃ¢â‚¬â€˜Fi fallaba ICE (hairpin NAT) y en 4G el puerto 7880 no siempre alcanza. Error: `MediaConnectException` / PeerConnection timeout.
- **Archivos / refs:** `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `infra/start-services.ps1`, `Reinforce-UPnP.ps1`

---

## 2026-08-26 Ã¢â‚¬â€ Fix error 500 detrÃƒÂ¡s de Caddy (trust proxy)

- **Tipo:** fix
- **ÃƒÂrea:** backend | infra
- **QuÃƒÂ©:** `trust proxy` activo en dev cuando hay `PUBLIC_DOMAIN` o `TRUST_PROXY=1`; `.env.example` actualizado; `TRUST_PROXY=1` en `.env` local.
- **Por quÃƒÂ© / notas:** TrÃƒÂ¡fico vÃƒÂ­a Caddy envÃƒÂ­a `X-Forwarded-For` y `express-rate-limit` lanzaba `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` Ã¢â€ â€™ 500 en login y demÃƒÂ¡s rutas pÃƒÂºblicas.
- **Archivos / refs:** `backend/src/config.js`, `backend/.env.example`

---

## 2026-08-26 Ã¢â‚¬â€ Codemagic iOS + checklist TestFlight

- **Tipo:** infra | docs
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:** `codemagic.yaml` con workflows TestFlight y solo IPA; checklist Apple+Firebase; plantilla plist; script base64 para Codemagic.
- **Por quÃƒÂ© / notas:** Build iOS sin Mac local. Ver `Soporte/Documentos/IOS_TESTFLIGHT_CHECKLIST.md`.
- **Archivos / refs:** `codemagic.yaml`, `IOS_TESTFLIGHT_CHECKLIST.md`, `GoogleService-Info.plist.example`, `Encode-GoogleServicePlist.ps1`

## 2026-08-26 Ã¢â‚¬â€ Fix .cmd/.bat rotos en Windows (LF vs CRLF)

- **Tipo:** fix
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:** `start-api.cmd`, `start-web.cmd` y `LEVANTAR-TACTICALPTX.bat` tenian saltos LF (Unix); cmd.exe rompia bloques `if` y ejecutaba palabras sueltas (`Preferir`, `exist`, `not`). Reescritos con CRLF y sintaxis por etiquetas.
- **Archivos / refs:** `infra/start-api.cmd`, `infra/start-web.cmd`, `LEVANTAR-TACTICALPTX.bat`, resto `infra/*.cmd`

## 2026-08-26 Ã¢â‚¬â€ LEVANTAR-TACTICALPTX.bat mas robusto

- **Tipo:** fix | infra
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:** Bat detecta PostgreSQL 18, fallback puerto 5432, borde publico via `.cmd` sin romper el script, dominio desde `.env`, Redis con rutas alternativas.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.cmd`, `infra/start-services.ps1`

## 2026-08-26 Ã¢â‚¬â€ APK 1.8.30+39 (emojis/stickers OTA)

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** OTA BanjeCel force `1.8.30+39` con emojis y stickers estilo WhatsApp (grupal + personal).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.30+39.apk`, `backend/app-updates/android.json`

## 2026-08-26 Ã¢â‚¬â€ Emojis y stickers estilo WhatsApp (web + APK)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
  - Web: panel flotante tipo WhatsApp Web (categorÃƒÂ­as, bÃƒÂºsqueda, pestaÃƒÂ±as Emoji / GIF / Stickers) en chat grupal y DM.
  - APK: panel inferior con emojis + stickers; el icono Ã°Å¸â„¢â€š / Ã¢Å’Â¨Ã¯Â¸Â alterna panel y teclado (grupal y personal).
- **Por quÃƒÂ© / notas:** GIF tab placeholder (prÃƒÂ³ximamente). Stickers DM vÃƒÂ­a `POST /api/dm/:id/messages/sticker`.
- **Archivos / refs:** `web/src/WaEmojiPicker.jsx`, `web/src/emojiData.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/chat_emoji_panel.dart`, `chat_panel.dart`, `direct_pane.dart`

## 2026-08-26 Ã¢â‚¬â€ Fix lightbox Ã‚Â«Cargando imagenÃ¢â‚¬Â¦Ã‚Â» infinito

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Al abrir imagen a pantalla completa ya no se queda colgado en carga. El efecto de React Strict Mode cancelaba el fetch y no reintentaba.
- **Por quÃƒÂ© / notas:** Miniatura OK; lightbox con Ã‚Â«Cargando imagenÃ¢â‚¬Â¦Ã‚Â» + nombre de archivo. Ahora libera el slot al cancelar, muestra error claro y botÃƒÂ³n Reintentar.
- **Archivos / refs:** `web/src/ImageGalleryLightbox.jsx`, `web/src/api.js` (`fetchMediaBlobUrl`)

## 2026-08-26 Ã¢â‚¬â€ APK 1.8.29+38 (ortografÃƒÂ­a + BanjeCel)

- **Tipo:** fix | ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Corregidos textos mojibake (GalerÃƒÂ­a, CÃƒÂ¡mara, etc.). OTA BanjeCel force `1.8.29+38`.
- **Archivos / refs:** `direct_pane.dart`, `Soporte/APK/TacticalPtx-1.8.29+38.apk`

## 2026-08-26 Ã¢â‚¬â€ APK 1.8.28+37 (radio personal PTT)

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Publicado OTA force con radio personal tipo grupal (barra PTT, sin UI de llamada).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.28+37.apk`

## 2026-08-26 Ã¢â‚¬â€ Radio personal = PTT (como radio grupal)

- **Tipo:** ux | feature
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Radio personal ya no abre UI de llamada: barra PTT `MANTÃƒâ€°N PARA HABLAR`, auto-uniÃƒÂ³n del destinatario, botÃƒÂ³n Radio del chat sirve para transmitir. Llamar sigue siendo full-duplex.
- **Archivos / refs:** `web/src/PrivateRadioBar.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `mobile/.../personal_radio_bar.dart`

## 2026-08-26 Ã¢â‚¬â€ Proyecto iOS preparado (IPA requiere Mac)

- **Tipo:** infra | docs
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Listo el target iOS `com.tacticalptx.app`: Podfile, Info.plist (mic/cÃƒÂ¡mara/fotos/ubicaciÃƒÂ³n/Bluetooth), entitlements push, iconos, script `scripts/build-ios.sh` y guÃƒÂ­a `Soporte/Documentos/APP_IOS.md`. El `.ipa` no se puede generar en Windows.
- **Por quÃƒÂ© / notas:** Pedido de app iOS; falta Mac + Apple Developer + `GoogleService-Info.plist` para FCM.
- **Archivos / refs:** `mobile/ios/`, `mobile/scripts/build-ios.sh`, `Soporte/Documentos/APP_IOS.md`

## 2026-08-26 Ã¢â‚¬â€ App no secuestra volumen/cÃƒÂ¡mara del mÃƒÂ³vil

- **Tipo:** fix | security
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Audio solo al radio/llamada (volumen multimedia + mayDuck); mic se libera al callar; FGS sin tipo microphone; pausa sesiÃƒÂ³n al abrir cÃƒÂ¡mara. APK **1.8.27+36** OTA force.
- **Por quÃƒÂ© / notas:** La sesiÃƒÂ³n voiceCommunication + mic siempre abierto interferÃƒÂ­a con volumen, notificaciones y cÃƒÂ¡mara de otras apps.
- **Archivos / refs:** `audio_session_setup.dart`, `channel_session.dart`, `background_radio.dart`, `AndroidManifest.xml`

## 2026-08-26 Ã¢â‚¬â€ APK 1.8.26+35 (radio 1:1 + controles llamada)

- **Tipo:** feature | ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Publicado OTA force: radio personal 1:1 + controles de llamada estilo WhatsApp (altavoz, silenciar, teclado, mensaje).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.26+35.apk`, `backend/app-updates/android.json`, `mobile/pubspec.yaml`

## 2026-08-26 Ã¢â‚¬â€ Controles de llamada estilo telÃƒÂ©fono/WhatsApp (app)

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** En llamada privada: **Silenciar**, **Teclado**, **Altavoz/Auricular**, **Mensaje** (DM sin colgar), **MÃƒÂ¡s** (audio entrante), temporizador y colgar. Radio 1:1: PTT + altavoz + mensaje.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`

## 2026-08-26 Ã¢â‚¬â€ Radio personal 1:1 (ademÃƒÂ¡s de llamada y mensaje)

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - Entre usuarios: **Mensaje**, **Radio personal** (PTT 1:1) y **Llamada** (full-duplex).
  - Backend: `mode: call|radio` en `/api/calls/private`; rooms `radio_*` vs `call_*`; FCM `private_radio`.
  - Web: menÃƒÂº peer + botÃƒÂ³n Radio en DM; overlay con PTT (mantener).
  - MÃƒÂ³vil: menÃƒÂº peer, iconos en chat DM, pantalla entrante/activa con PTT.
- **Por quÃƒÂ© / notas:** Pedido: radio entre usuarios ademÃƒÂ¡s de llamadas y mensajes.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `WhatsAppChat.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/peer_actions.dart`, `direct_pane.dart`, `incoming_call_screen.dart`, `radio_shell.dart`

## 2026-08-26 Ã¢â‚¬â€ Llamada entrante web visible (portal)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** La UI de llamada entrante vivÃƒÂ­a dentro de DirectChat con `display:none` (vista grupos) Ã¢â€ â€™ sonaba pero no se veÃƒÂ­a. Ahora se renderiza con `createPortal` en `document.body` (z-index alto).
- **Archivos / refs:** `web/src/DirectChat.jsx`, `appNotify.js`, `styles.css`

## 2026-08-26 Ã¢â‚¬â€ DiÃƒÂ¡logos prompt del proyecto (sin window.prompt)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** `AppDialog` con campo de texto; renombrar dependencias/grados/empleos y confirmar restauraciÃƒÂ³n usan modal del producto (no el prompt del navegador).
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchDependencias.jsx`, `CatalogGradesEmpleos.jsx`, `ConfigBackups.jsx`, `institutional.css`

## 2026-08-26 Ã¢â‚¬â€ Notificaciones web estilo WhatsApp

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Tono `/sounds/message.wav`, banner oscuro con acento verde, Notification del SO al ir a segundo plano, tÃƒÂ­tulo `(N) TacticalPtx`, silencio si el chat estÃƒÂ¡ abierto. Grupos tambiÃƒÂ©n notifican con pestaÃƒÂ±a oculta.
- **Archivos / refs:** `web/src/appNotify.js`, `ChatInbox.jsx`, `styles.css`, `public/sounds/message.wav`

## 2026-08-26 Ã¢â‚¬â€ Mute de escucha radio (mÃƒÂ³vil + web)

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** BotÃƒÂ³n visible **Silenciar / MUTE** en Radio (tambiÃƒÂ©n menÃƒÂº Ã¢ËœÂ°). Corta audio remoto al silenciar. Web RadioPage: mismo control. APK **1.8.25+34**.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `channel_session.dart`, `web/src/pages/RadioPage.jsx`, `styles.css`

## 2026-08-26 Ã¢â‚¬â€ Publicar APK OTA 1.8.24+33

- **Tipo:** release
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:** Build/release APK con Socket.IO `:443`, E2EE sin fallback silencioso, tono chat, etc. Manifiesto OTA `force: true`.
- **Archivos / refs:** `mobile/pubspec.yaml` 1.8.24+33, `backend/app-updates/`, `Soporte/APK/`

## 2026-08-26 Ã¢â‚¬â€ SIN RED mÃƒÂ³vil: Caddy edge caÃƒÂ­do + endurecer arranque

- **Tipo:** fix | infra
- **ÃƒÂrea:** ops | mobile | infra
- **QuÃƒÂ©:**
  - Causa: borde pÃƒÂºblico Caddy (:80/:443) apagado Ã¢â€ â€™ timeout/`SIN RED` en app 4G; API/DB/Redis locales OK.
  - Edge reiniciado (health 200 + Socket.IO polling OK). APK **1.8.23+32** ya publicada (fix `:0`).
  - `START-PUBLIC-EDGE` detecta API HTTP vs HTTPS (evita 502 TLS handshake); `ENSURE-PUBLIC-EDGE`; `LEVANTAR` llama al ensure.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `ENSURE-PUBLIC-EDGE.*`, `Caddyfile.edge.template`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-26 Ã¢â‚¬â€ Mapas: quitar watermark CARTO Ã‚Â«API KEY REQUIREDÃ‚Â»

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** CARTO raster ahora exige API key; se reemplazÃƒÂ³ por Esri World Street Map / OSM / satÃƒÂ©lite Esri (sin key). Capas centralizadas en `mapTiles.js`.
- **Archivos / refs:** `web/src/dispatch/mapTiles.js`, `CommandCenter.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`

## 2026-08-26 Ã¢â‚¬â€ Dependencias: ÃƒÂ¡rbol contraÃƒÂ­do por defecto

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Regiones/zonas del catÃƒÂ¡logo Dependencias inician colapsadas (`NestedRow` defaultOpen=false).
- **Archivos / refs:** `web/src/dispatch/DispatchDependencias.jsx`

## 2026-08-26 Ã¢â‚¬â€ Fix Socket.IO mÃƒÂ³vil `:0` (sslip.io sin puerto)

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** `socket_io_client` usaba `Uri.port == 0` con `https://host` (sin puerto) Ã¢â€ â€™ `Ã¢â‚¬Â¦sslip.io:0/socket.io` y fallo de upgrade WebSocket. `AppConfig.socketUrl` fuerza `:443`/`:80`; todas las conexiones IO usan `socketUrl`.
- **Archivos / refs:** `mobile/lib/config.dart`, `channel_session.dart` (ya usaba socketUrl), `direct_pane.dart`, `chat_inbox_screen.dart`, `test/widget_test.dart`
- **Nota:** APK **1.8.23+32** en publicaciÃƒÂ³n OTA (force). Reabrir app o actualizar cuando termine el build.

## 2026-08-26 Ã¢â‚¬â€ Integridad: paths C:, TLS/FCM, cifrado, firewall

- **Tipo:** security | fix | infra
- **ÃƒÂrea:** backend | web | mobile | infra | docs | ops
- **QuÃƒÂ©:**
  - RaÃƒÂ­z canÃƒÂ³nica documentada como `C:\pulsanet` (evita fracturas D: ausente).
  - `FIREBASE_SERVICE_ACCOUNT` corregido a C:; health reporta TLS real + flags wire/content/voice; FCM vuelve a `configured`.
  - Despacho: no degradar payloads sealed a texto en claro si falla unwrap; voz E2EE no cae en silencio a SRTP-only si hay clave.
  - Firewall canÃƒÂ³nico reforzado (9 reglas `TacticalPtx-*`); script `infra/check-integrity.ps1`.
- **Por quÃƒÂ© / notas:** Tras el 500 por TLS en D:, auditorÃƒÂ­a completa de estructura App/Web/proyecto.
- **Archivos / refs:** `backend/src/routes/health.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`, `infra/check-integrity.ps1`, `infra/Ensure-Firewall.ps1`, `docs/UBICACION_PROYECTO.md`, `backend/.env` (paths)

## 2026-08-26 Ã¢â‚¬â€ Fix API TLS (certs D: Ã¢â€ â€™ C:) y 500 por proxy

- **Tipo:** fix | infra
- **ÃƒÂrea:** backend | ops
- **QuÃƒÂ©:** `.env` apuntaba `TLS_CERT/KEY` a `D:\pulsanet\Ã¢â‚¬Â¦` (inexistente); la API caÃƒÂ­a a HTTP y Vite/proxy HTTPS devolvÃƒÂ­a fallos (500 / conexiÃƒÂ³n). Certs corregidos a `C:\pulsanet\infra\certs\` y API reiniciada con TLS on. Alta sin cargo verificada (201).
- **Archivos / refs:** `backend/.env` (TLS_*), `infra/certs/lan-*.pem`

## 2026-08-26 Ã¢â‚¬â€ Tono tenue si el chat estÃƒÂ¡ abierto (mÃƒÂ³vil)

- **Tipo:** ux | fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Con el hilo abierto en primer plano ya no suena la notificaciÃƒÂ³n Nokia de bandeja; se reproduce un tono al ~16% de volumen (estilo WhatsApp). Si el chat es otro o la app estÃƒÂ¡ en segundo plano, se mantiene el aviso completo.
- **Archivos / refs:** `mobile/lib/message_tone.dart`, `app_focus.dart`, `push_service.dart`, `radio_shell.dart`, `channel_session.dart`, `direct_pane.dart`

## 2026-08-26 Ã¢â‚¬â€ Cargo opcional en alta de usuarios

- **Tipo:** ux | fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Ã‚Â«Cargo / puestoÃ‚Â» deja de ser obligatorio en el alta; el indicativo usa grado + apellido y solo aÃƒÂ±ade cargo si se captura.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-08-26 Ã¢â‚¬â€ Acelerar abrir chat desde notificaciÃƒÂ³n (mÃƒÂ³vil)

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Al tocar Ã‚Â«AbrirÃ‚Â» en la notificaciÃƒÂ³n, el hilo DM se abre al instante (sin esperar contactos/LiveKit/FGS). Cambio de canal y limpieza de avisos ya no bloquean la navegaciÃƒÂ³n; bootstrap paralelo.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/direct_pane.dart`, `mobile/lib/push_service.dart`

## 2026-08-26 Ã¢â‚¬â€ Fix formularios Grupos (alineaciÃƒÂ³n)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Formularios Ã‚Â«Nuevo grupoÃ‚Â» / Ã‚Â«Asignar miembroÃ‚Â» dejaron de usar `.admin-form` (que los empujaba a la derecha). Ahora son paneles verticales con campos a ancho completo.
- **Archivos / refs:** `web/src/dispatch/DispatchGroups.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 Ã¢â‚¬â€ Purga canales PTT del import PV

- **Tipo:** ops | fix
- **ÃƒÂrea:** backend
- **QuÃƒÂ©:** Eliminados 48 grupos creados automÃƒÂ¡ticamente al importar Dependencias (`Canal operativo Ã‚Â· PV-O-*`). El import ya no crea canales PTT.
- **Archivos / refs:** `backend/src/scripts/purge-import-groups.js`, `backend/src/scripts/import-pv-dependencias.js`

## 2026-08-26 Ã¢â‚¬â€ UX compacta Dependencias / Usuarios / Grupos

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Mismo criterio que Grados/empleos: contenedor max ~820px; Dependencias mÃƒÂ¡s densa; Usuarios en tarjetas de una columna; Grupos con formularios en paneles y lista/miembros en chips (sin tablas a todo el ancho).
- **Archivos / refs:** `DispatchDependencias.jsx`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `command-center.css`

## 2026-08-26 Ã¢â‚¬â€ UX Grados/empleos mÃƒÂ¡s compactos

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Paneles Grados/Empleos dejan de estirarse a todo el ancho; columnas ~300Ã¢â‚¬â€œ380px y elementos en chips (abreviatura + nombre juntos a las acciones).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 Ã¢â‚¬â€ Dependencias idÃƒÂ©nticas a ParqueVehicular

- **Tipo:** feature | data
- **ÃƒÂrea:** backend | web | database
- **QuÃƒÂ©:**
  - Importado el ÃƒÂ¡rbol live de PV (`catalogos.html#dependencias`): 6 RR.MM., 15 ZZ.MM., 48 organismos (`PV-*`).
  - UI Dependencias alineada a PV: labels RR.MM.Ã¢â€ â€™ZZ.MM.Ã¢â€ â€™Organismos, placeholders, chips de organismos, botones Ã‚Â«+ RegiÃƒÂ³n / + Zona / + OrganismoÃ‚Â».
  - Script `npm run import:pv-dependencias` (desactiva org_units no `PV-*`).
- **Por quÃƒÂ© / notas:** Sustituye el seed parcial IV R.M. (`ivRmUnits.js`) por la estructura real de ParqueVehicular.
- **Archivos / refs:** `backend/src/data/pvDependenciasTree.js`, `backend/src/scripts/import-pv-dependencias.js`, `web/src/dispatch/DispatchDependencias.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 Ã¢â‚¬â€ Fix scroll CatÃƒÂ¡logos / ConfiguraciÃƒÂ³n

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El cuerpo de CatÃƒÂ¡logos/ConfiguraciÃƒÂ³n tenÃƒÂ­a `overflow: hidden` sin scroll; Grados/empleos, Dependencias, Usuarios, Grupos y Respaldos se cortaban abajo. Ahora `.cc-catalogs-body` hace scroll vertical.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

## 2026-08-26 Ã¢â‚¬â€ Fix pantalla en negro (web App.jsx)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Crash al renderizar rutas: `isAdminUser(session.user)` con `session === null` (menÃƒÂº ConfiguraciÃƒÂ³n/Respaldos). Ahora usa `session?.user`.
- **Archivos / refs:** `web/src/App.jsx`

## 2026-08-26 Ã¢â‚¬â€ APK OTA 1.8.22+31 desde C:\pulsanet

- **Tipo:** ops | fix
- **ÃƒÂrea:** mobile | infra | ops
- **QuÃƒÂ©:**
  - `Publish-ApkUpdate.ps1` resuelve repo en `C:\pulsanet` (fallback D:), Flutter/SDK/JDK reales; reescribe `local.properties` y `org.gradle.java.home`.
  - Reinstalados Flutter (`C:\tools\flutter`), Android SDK (`C:\Android\Sdk`) y Microsoft OpenJDK 17.
  - Publicada APK **1.8.22+31** a `backend/app-updates` + `Soporte/APK`; `LEVANTAR-TACTICALPTX.bat` prioriza C:\.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.22+31.apk`

## 2026-08-26 Ã¢â‚¬â€ CatÃƒÂ¡logo PV (grados/empleos/dependencias) + Respaldos

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | backend | database
- **QuÃƒÂ©:**
  - CatÃƒÂ¡logos al estilo ParqueVehicular: **Grados y empleos** (chips, alta/renombre/baja; bloqueo si estÃƒÂ¡n en uso) y **Dependencias** (ÃƒÂ¡rbol RegiÃƒÂ³n Ã¢â€ â€™ Zona Ã¢â€ â€™ Unidad).
  - MenÃƒÂº **ConfiguraciÃƒÂ³n Ã¢â€ â€™ Respaldos**: programaciÃƒÂ³n, retenciÃƒÂ³n, manual, descarga, borrado, restauraciÃƒÂ³n (.zip/.sql) y subida; ZIP `tacticalptx_*.zip` con `database.sql` + `meta.json`.
  - MigraciÃƒÂ³n `019_catalog_grades_empleos.sql`; seed LOEFAM al primer listado; Usuarios consume grados/empleos del API.
  - Arranque `infra/start-api.cmd` / `start-web.cmd` prioriza `C:\pulsanet`.
- **Por quÃƒÂ© / notas:** Importar forma e informaciÃƒÂ³n de PV adaptada a TacticalPtx (`users.grade` / `specialty`, `org_units`).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `DispatchDependencias.jsx`, `ConfigBackups.jsx`, `ConfigLayout.jsx`, `backend/src/services/catalogs.js`, `backup.js`, `routes/catalogs.js`, `routes/backups.js`, `database/migrations/019_catalog_grades_empleos.sql`

## 2026-08-25 Ã¢â‚¬â€ ZIP respaldo completo TacticalPtx

- **Tipo:** ops
- **ÃƒÂrea:** ops | docs
- **QuÃƒÂ©:** Respaldo ZIP del trabajo en `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip` (~1.42 GB). Incluye cÃƒÂ³digo, docs, Soporte/APK/OTA; excluye `node_modules`, `mobile/build`, `.dart_tool` y Respaldos anidados.
- **Archivos / refs:** `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip`

## 2026-08-25 Ã¢â‚¬â€ Proyecto solo en D:\pulsanet (nada fuera)

- **Tipo:** ops | docs
- **ÃƒÂrea:** docs | ops
- **QuÃƒÂ©:**
  - Eliminada la junction externa `D:\PulsaNet_Soporte` (apuntaba a `D:\pulsanet\Soporte`).
  - Logos/variantes TacticalPtx movidos de Documentos Ã¢â€ â€™ `Soporte\Brand\from-Documents\`.
  - Docs: ubicaciÃƒÂ³n ÃƒÂºnica y stack completo bajo `D:\pulsanet` (`UBICACION_PROYECTO.md`, README).
- **Por quÃƒÂ© / notas:** El producto no debe vivir fuera de esa carpeta; SDKs del sistema (Flutter/Android/JDK/PG) siguen en sus rutas de instalaciÃƒÂ³n.
- **Archivos / refs:** `docs/UBICACION_PROYECTO.md`, `README.md`, `Soporte/Brand/from-Documents/`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.21+30 publicada (OTA)

- **Tipo:** feature | ux | ops
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:** APK **1.8.21+30** Ã¢â‚¬â€ vaciar/borrar chats, miniaturas de imagen en DM, burbujas estilo WhatsApp. OTA `versionCode` 30, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.21+30.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 Ã¢â‚¬â€ GPS mapa: Ã‚Â«Hace X hÃ‚Â» no implica en vivo

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:**
  - Aclara que Ã‚Â«Hace 21 h / 72 hÃ‚Â» = ÃƒÂºltima seÃƒÂ±al recibida por el servidor (suele pasar fuera de red/API).
  - Parseo UTC de `recordedAt` sin zona; API siempre envÃƒÂ­a ISO con `Z`.
  - Popup/ficha: Ã‚Â«desactualizadoÃ‚Â» + hora local; ya no dice Ã‚Â«rastro en vivoÃ‚Â» si la seÃƒÂ±al es vieja.
- **Archivos / refs:** `liveTiming.js`, `LiveTrackMap.jsx`, `locations.js`

## 2026-08-25 Ã¢â‚¬â€ Burbujas de chat estilo WhatsApp

- **Tipo:** ux | mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Mensajes DM y grupo mÃƒÂ¡s estÃƒÂ©ticos: radios/cola tipo WhatsApp, agrupaciÃƒÂ³n por remitente, hora+palomas en esquina, tipografÃƒÂ­a y sombra suaves, composer redondeado sin borde tosco.
- **Archivos / refs:** `chat_bubble_style.dart`, `direct_pane.dart`, `chat_panel.dart`

## 2026-08-25 Ã¢â‚¬â€ Vaciar/borrar chats + miniatura imagen DM

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Inbox: pulsaciÃƒÂ³n larga Ã¢â€ â€™ Vaciar chat/grupo, Borrar chat (ocultar de la lista; reaparece con mensaje nuevo) y favorito.
  - API `POST /api/dm/:userId/messages/clear` y `POST /api/groups/:id/messages/clear`; eventos `dm:cleared` / `chat:cleared`.
  - MenÃƒÂº Ã¢â€¹Â® en DM y grupo para vaciar.
  - Chat personal: imÃƒÂ¡genes en miniatura dentro de la burbuja (estilo WhatsApp).
- **Archivos / refs:** `dm.js`, `chat.js`, `messages.js`, `chat_inbox_screen.dart`, `direct_pane.dart`, `api_client.dart`, `channel_session.dart`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.20+29 publicada (OTA)

- **Tipo:** feature | ops
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:** APK **1.8.20+29** Ã¢â‚¬â€ DM con palomas/hora/swipe reply/envÃƒÂ­o rÃƒÂ¡pido/atrÃƒÂ¡s al inbox; tambiÃƒÂ©n presencia multi-device y ticket avatar. OTA `versionCode` 29.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.20+29.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 Ã¢â‚¬â€ DM mÃƒÂ³vil: palomas, hora, swipe reply, atrÃƒÂ¡s al inbox

- **Tipo:** feature | ux | fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Chat personal con hora + palomas (Ã¢Å“â€œÃ¢Å“â€œ / azules al leer); envÃƒÂ­o optimista (menos latencia); deslizar derecha para responder; opciones alineadas (descargar); atrÃƒÂ¡s/sistema vuelve al inicio (inbox) de un toque.
- **Archivos / refs:** `direct_pane.dart`, `api_client.dart` (`markDmRead`), `peer_actions.dart`, `radio_shell.dart`

## 2026-08-25 Ã¢â‚¬â€ Avatar sin JWT en URL + presencia multi-device

- **Tipo:** security | fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
  - #1 Presencia por socket (cerrar web no saca al mÃƒÂ³vil del radio).
  - #2 Avatares: ticket corto HMAC (`?atk=`) en login/refresh; mapas web usan blob+Bearer; app deja de poner el JWT en `Image.network`.
- **Archivos / refs:** `presence.js`, `ptt.js`, `avatarTicket.js`, `me.js`, `auth.js`, `avatarBlobCache` / mapas despacho, `api_client.dart`, `secure_store.dart`

## 2026-08-25 Ã¢â‚¬â€ Presencia multi-dispositivo (socket refcount)

- **Tipo:** fix
- **ÃƒÂrea:** backend
- **QuÃƒÂ©:** Presencia PTT por `socket.id` en Redis (`presence:sockets:*`). Cerrar web/otra pestaÃƒÂ±a ya no marca offline al mÃƒÂ³vil ni suelta el floor si otro dispositivo sigue en el canal. Floor solo se libera si ese socket tenÃƒÂ­a PTT o el usuario no tiene mÃƒÂ¡s sockets.
- **Archivos / refs:** `presence.js`, `socket/ptt.js`, `redis.js`

## 2026-08-25 Ã¢â‚¬â€ Restaurado borde HTTPS (app sin conexiÃƒÂ³n)

- **Tipo:** fix | infra | ops
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:** App mostraba Ã¢â‚¬Å“No hay conexiÃƒÂ³n con el servidor (Ã¢â‚¬Â¦sslip.io)Ã¢â‚¬Â: Caddy no escuchaba en 443 (Apache/Laragon ocupaba 80). Se relanzÃƒÂ³ `START-PUBLIC-EDGE.ps1`; health pÃƒÂºblico 200.
- **Por quÃƒÂ© / notas:** No reiniciar Laragon Apache en 80 mientras se use el borde LE; 80/443 deben quedar para Caddy.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/Caddyfile.edge`

## 2026-08-25 Ã¢â‚¬â€ AuditorÃƒÂ­a completa + remediaciÃƒÂ³n segura

- **Tipo:** security | fix | docs | ops
- **ÃƒÂrea:** backend | mobile | database | docs
- **QuÃƒÂ©:**
  - AuditorÃƒÂ­a versiones/seguridad/datos/sockets; BD viva OK para DM.
  - MigraciÃƒÂ³n `018_dm_messages.sql`; `BUILD-APK-WHATSAPP.cmd` Ã¢â€ â€™ Publish OTA; `clearFloor` atÃƒÂ³mico; reject secretos OTA/unlock de ejemplo; versiones 1.8.19 en package.json; `.env.example` host actual + lockdown off por defecto.
- **Por quÃƒÂ© / notas:** Evitar regresiones OTA y desfases; hallazgos abiertos: presence multi-device, JWT en query avatar, web DM sin delete/react, calls in-memory.
- **Archivos / refs:** `018_dm_messages.sql`, `config.js`, `presence.js`, `BUILD-APK-WHATSAPP.cmd`, canvas `auditoria-tacticalptx`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.19+28 publicada (OTA)

- **Tipo:** feature | ops
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:** APK **1.8.19+28** con galerÃƒÂ­a swipe de imÃƒÂ¡genes (estilo WhatsApp) y links clicables en chat; OTA `versionCode` 28, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.19+28.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`, `backend/src/version.js`

## 2026-08-25 Ã¢â‚¬â€ Chat: galerÃƒÂ­a swipe de imÃƒÂ¡genes (estilo WhatsApp)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** En vista ampliada, deslizar izquierda/derecha (app) o flechas/swipe/teclado (web) entre todas las imÃƒÂ¡genes del mismo chat (grupo y DM). Contador `n / total`.
- **Por quÃƒÂ© / notas:** Igual que WhatsApp; antes solo se veÃƒÂ­a la imagen tocada.
- **Archivos / refs:** `chat_image_gallery.dart`, `chat_panel.dart`, `direct_pane.dart`, `ImageGalleryLightbox.jsx`, `ChatMedia.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-25 Ã¢â‚¬â€ Chat: links clicables (web + app)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** URLs en mensajes (http/https, www, geo, mailto, tel) se muestran como enlace y abren el navegador / app correspondiente. Grupo y DM.
- **Archivos / refs:** `LinkifiedText.jsx`, `linkified_text.dart`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_panel.dart`, `direct_pane.dart`, `AndroidManifest.xml` queries

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.18+27 publicada (OTA)

- **Tipo:** ops | release
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Release **1.8.18+27** con icono verde, mute radio, adjuntos video/docs, colgado bilateral de llamadas, arranque mÃƒÂ¡s rÃƒÂ¡pido. APK en OTA + Soporte.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.18+27.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-08-25 Ã¢â‚¬â€ Web chat: lightbox sin menÃƒÂº duplicado + Esc

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Vista ampliada de imagen sin barra superior de acciones (solo menÃƒÂº contextual del centro). Esc cierra **menÃƒÂº de opciones y lightbox** a la vez. Nombres de media: conserva el original si es legible; si no Ã¢â€ â€™ `Img.jpg` / `Video.mp4` / `Archivo.ext`.
- **Archivos / refs:** `ChatMedia.jsx`, `WhatsAppChat.jsx`, `GlobalEscapeClose.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 Ã¢â‚¬â€ App Radio: mute de escucha (altavoz)

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** BotÃƒÂ³n de altavoz en el panel Radio silencia el **audio entrante** del canal (`listenMuted`); estado **MUTE** + icono `volume_off`. Persiste en SharedPreferences. PTT propio sigue funcionando. Se aplica a tracks LiveKit remotos (disable/enable).
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`

## 2026-08-25 Ã¢â‚¬â€ AuditorÃƒÂ­a: desfases corregidos

- **Tipo:** fix | docs
- **ÃƒÂrea:** backend | web | mobile | docs
- **QuÃƒÂ©:** AlineaciÃƒÂ³n versiones **1.8.17** (API `version.js`/`package.json`, web `package.json`, OTA example `versionCode` 26). BitÃƒÂ¡cora: eliminadas ~94 entradas duplicadas de Ã‚Â«PostgreSQL reiniciadoÃ‚Â». Fix fuga LiveKit si falla conectar llamada; preview DM de video en app; lÃƒÂ­mites media en `V1_1_MEDIA_GPS.md`.
- **Archivos / refs:** `version.js`, `package.json` (backend/web), `android.json.example`, `BITACORA_*`, `direct_pane.dart`, `channel_session.dart`, `V1_1_MEDIA_GPS.md`

## 2026-08-25 Ã¢â‚¬â€ Llamada personal: colgar en ambos lados

- **Tipo:** fix
- **ÃƒÂrea:** mobile | web | backend
- **QuÃƒÂ©:** Si uno cuelga la llamada 1:1, el otro tambiÃƒÂ©n cierra la UI (app ya no se quedaba en pantalla de llamada). Escucha `call:ended` + salida del peer en LiveKit; API emite el evento a ambos usuarios.
- **Archivos / refs:** `PrivateCallScreen` (`direct_pane.dart`), `channel_session.dart`, `calls.js`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`

## 2026-08-25 Ã¢â‚¬â€ Chat: videos, documentos y archivos (web + app)

- **Tipo:** feature | ux
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:** Adjuntar como WhatsApp: **video**, **documentos** (PDF/Office) y **archivos** (ZIP/RAR/7zÃ¢â‚¬Â¦). MenÃƒÂº Foto / Video / Documento en grupo y DM (web y app). Reproductor de video y tarjeta de archivo con abrir/descargar. LÃƒÂ­mites: imagen 10 MB, audio 15 MB, docs 25 MB, video 50 MB. Bloqueo de ejecutables.
- **Archivos / refs:** `uploads.js`, `messages.js`, `dm.js`; `WhatsAppChat.jsx`, `DirectChat.jsx`, `ChatMedia.jsx`, `mediaKind.js`; `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`, `media_kind.dart`

## 2026-08-25 Ã¢â‚¬â€ App: arranque mÃƒÂ¡s rÃƒÂ¡pido + icono verde

- **Tipo:** mejora | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Splash ya no espera Firebase/mic/Shorebird antes de pintar; check de APK con timeout 3 s y mensajes claros. Icono launcher regenerado con fondo oliva `#243D20` (`tacticalptx.png`); splash nativo y boot screen con papel institucional + logo.
- **Por quÃƒÂ© / notas:** Ã‚Â«Cargando configuraciÃƒÂ³nÃ¢â‚¬Â¦Ã‚Â» se sentÃƒÂ­a lento por awaits encadenados. Hace falta **APK nueva** para ver el icono en el launcher.
- **Archivos / refs:** `main.dart`, `app_update.dart`, `colors.xml`, `launch_background.xml`, mipmaps via `flutter_launcher_icons`

## 2026-08-25 Ã¢â‚¬â€ Chat canal: mensaje/llamada personal entre miembros

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:** Desde el chat de grupo/canal se puede contactar a otro miembro: **mensaje personal** (DM) o **llamada personal**. App: tocar nombre del mensaje, cabecera del canal o chips en Radio. Web: tocar nombre, cabecera Ã‚Â«en lÃƒÂ­neaÃ‚Â» o lista de en lÃƒÂ­nea en Radio.
- **Archivos / refs:** `peer_actions.dart`, `chat_panel.dart`, `chat_inbox_screen.dart`, `radio_screen.dart`; `WhatsAppChat.jsx`, `ChatInbox.jsx`, `RadioPage.jsx`, `styles.css`

## 2026-08-25 Ã¢â‚¬â€ App: tono SMS Nokia (Morse) en notificaciones

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Notificaciones de **mensajes** usan tono **SMS Nokia** (cÃƒÂ³digo Morse SMS), fuerte y claro. Canal Android nuevo `tacticalptx_alerts_nokia` + `res/raw/nokia_sms.wav`; FCM apunta a ese sonido.
- **Por quÃƒÂ© / notas:** Android no cambia el sonido de un canal ya creado Ã¢â€ â€™ canal nuevo. Requiere **reinstalar/actualizar APK**. Llamadas siguen con tono por defecto del sistema.
- **Archivos / refs:** `mobile/android/.../res/raw/nokia_sms.wav`, `push_service.dart`, `fcm.js`, `assets/sounds/nokia_sms.wav`, iOS `Runner/nokia_sms.wav`

## 2026-08-25 Ã¢â‚¬â€ Radio: un solo botÃƒÂ³n PTT (sin duplicar)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En **Radio PTT** ya no se muestra el PTT mini del dock superior (quedaba duplicado junto al PTT grande). El mini sigue en el resto de pestaÃƒÂ±as (Seguimiento, mapa, etc.).
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-08-25 Ã¢â‚¬â€ App: menÃƒÂº WhatsApp en chat grupal y DM

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:** Mantener pulsado un mensaje abre menÃƒÂº estilo WhatsApp: **reaccionar**, **responder**, **copiar**, **reenviar**, **fijar/desfijar**, **editar** (grupo), **eliminar**. Chat personal (DM) con reply, reacciones y borrado; fijado local por conversaciÃƒÂ³n.
- **Por quÃƒÂ© / notas:** Paridad con la consola web y UX pedida en app. Fijar es local (dispositivo). Reenviar manda el texto/preview a un contacto DM.
- **Archivos / refs:** `mobile/lib/chat_message_actions.dart`, `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`; `backend/src/services/dm.js`, `routes/dm.js`

## 2026-08-25 Ã¢â‚¬â€ Centro de mando: panel inferior visible (grabaciones)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Actividad reciente y **Grabaciones PTT** ya no se cortan: mitad inferior con `min-height:0`, reparto 50/50 con mapa, scroll interno en actividad y grabaciones.
- **Por quÃƒÂ© / notas:** `.cc-lower` no encogÃƒÂ­a en flex (`min-height` implÃƒÂ­cito del contenido) y `.cc-activity` usaba `max-height:40%` sin alto fijo del padre.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Mapas: foto real en marcador + cursor visible

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Marcadores usan URL HTTP `/api/avatars/:id?token=` (igual que la lista) con `background-image` en lugar de `<img>` (Leaflet rompÃƒÂ­a el tamaÃƒÂ±o con `width:auto!important`). Cursor `move` forzado en tiles/paneles; cÃƒÂ­rculos de precisiÃƒÂ³n no interceptan el puntero.
- **Por quÃƒÂ© / notas:** CÃƒÂ­rculo blanco = foto cargada pero img colapsada por CSS de Leaflet; cursor invisible = `grab` no soportado en Windows + overlays SVG interactivos.
- **Archivos / refs:** `api.js`, `mapAvatarIcon.js`, `mapLeafletUtils.jsx`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 Ã¢â‚¬â€ Mapas: misma foto en marcador y cursor de arrastre

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Marcadores usan la **misma foto** que la lista lateral (ya no miniatura separada que fallaba). Claves estables evitan marcadores duplicados al cargar avatares. Cursor **grab/grabbing** se mantiene al pasar sobre iconos en Seguimiento, Centro de mando y Geocercas.
- **Por quÃƒÂ© / notas:** La miniatura circular a veces quedaba `null` con la foto completa OK; las claves con `avatarReady` remontaban todos los markers. Los `pointer-events` del icono quitaban el cursor de mano al hover.
- **Archivos / refs:** `avatarBlobCache.js`, `useMapAvatarPhotos.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `mapLeafletUtils.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 Ã¢â‚¬â€ Mapa: foto de perfil en marcador (data URL)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Leaflet no pintaba `blob:` en divIcon (cÃƒÂ­rculo blanco). Avatares en mapa usan **data URL** + `background-image`; marcador se recrea al cargar la foto.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.17+26 publicada (OTA)

- **Tipo:** release | ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Publicada **1.8.17+26** vÃƒÂ­a `PUBLISH-APK-UPDATE.cmd`: fix teclado en chat/DM (`resizeToAvoidBottomInset`), manifiesto `android.json` versionCode **26**, APK en `backend/app-updates/files/` y `Soporte/APK/`.
- **Por quÃƒÂ© / notas:** La OTA no avisaba porque servidor y clientes seguÃƒÂ­an en **25** (mismo `versionCode`). Quien tenga Ã¢â€°Â¤25 verÃƒÂ¡ actualizaciÃƒÂ³n al abrir la app si la API pÃƒÂºblica responde.
- **Archivos / refs:** `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.17+26.apk`

## 2026-08-25 Ã¢â‚¬â€ Lightbox chat: un solo menÃƒÂº de acciones

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Al ampliar imagen ya no aparecen **dos** menÃƒÂºs (barra superior + cuadro flotante); solo la barra fija Responder / Copiar / Descargar. Clic derecho ya no abre menÃƒÂº duplicado.
- **Archivos / refs:** `ChatMedia.jsx`

## 2026-08-25 Ã¢â‚¬â€ Mapa: misma foto de perfil en marcador

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Marcadores del mapa cargan el avatar con **Bearer** (blob en memoria), igual que la lista lateral Ã¢â‚¬â€ sin superponer inicial Ã¢â‚¬Å“GÃ¢â‚¬Â sobre la foto ni fondo verde encima. Marcador seleccionado queda por encima si hay solape.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Seguimiento en vivo: layout y mapa acotado

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Panel **Seguimiento en vivo** redistribuido: KPIs en chips, capas del mapa sobre el mapa, lista con scroll interno, detalle del operador abajo. Mapa con borde/sombra y alto limitado al viewport (sin Ã¢â‚¬Å“scroll infinitoÃ¢â‚¬Â); `ResizeObserver` recalcula Leaflet al cambiar el panel.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Mapa: icono con foto de perfil del usuario

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Marcadores de Seguimiento / Mapa en vivo cargan la **foto de perfil** vÃƒÂ­a `/api/avatars/:userId` (con fallback a inicial si no hay foto). Se preserva `avatarUrl` al fusionar GPS por socket/poll; Leaflet actualiza el icono al cambiar.
- **Archivos / refs:** `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `liveTiming.js`, `api.js`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Web chat: menÃƒÂº contextual estilo WhatsApp

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Radio PTT / chat de grupo: clic derecho o Ã¢â€¹Â¯ abre menÃƒÂº propio (Reaccionar, Responder, Copiar, Copiar imagen, Descargar, Copiar nombre, Editar, Eliminar). Lightbox de imagen con barra de acciones y menÃƒÂº contextual (sin menÃƒÂº del navegador).
- **Archivos / refs:** `WhatsAppChat.jsx`, `ChatMedia.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 Ã¢â‚¬â€ Web: catÃƒÂ¡logos y mapas acotados al viewport

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Usuarios y mapas ya no Ã¢â‚¬Å“cuelganÃ¢â‚¬Â sin fin: scroll interno en lista de usuarios; **Seguimiento** y **Mapa en vivo** ocupan el alto visible con borde inferior claro.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Web: lista de usuarios en tarjetas

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Panel Usuarios pasa de tabla ancha a **tarjetas** por operador: avatar, indicativo, datos en columnas y acciones en fila inferior.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ MÃƒÂ³vil: teclado no tapa cuadro de chat

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** DM y chat de grupo usan `Scaffold` con `resizeToAvoidBottomInset` para que el composer quede visible al escribir.
- **Archivos / refs:** `direct_pane.dart`, `chat_inbox_screen.dart` (`GroupChatScreen`)

## 2026-08-25 Ã¢â‚¬â€ Web: sin borde amarillo en campos pendientes (alta usuario)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Eliminado resaltado ÃƒÂ¡mbar (`.cc-field-pending`) en inputs del alta de usuario; se mantiene el checklist de faltantes.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Web: grado Subteniente Ã¢â€ â€™ Sbtte.

- **Tipo:** mejora | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Abreviatura **Subteniente** corregida a `Sbtte.` (antes `Subtte.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 Ã¢â‚¬â€ Alta usuario: Especialidad tras Grado, Cargo al final

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | backend | database
- **QuÃƒÂ©:** Formulario separa **Especialidad** (opcional, tras grado) y **Cargo** (obligatorio, al final del paso Generales). Nueva columna `users.cargo`; indicativo usa cargo.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `rfcUsername.js`, `017_user_cargo.sql`

## 2026-08-25 Ã¢â‚¬â€ Web: abreviaturas grado Sld. y Gral. Brig.

- **Tipo:** mejora | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** CatÃƒÂ¡logo de grados: **Soldado** Ã¢â€ â€™ `Sld.`; **General Brigadier** Ã¢â€ â€™ `Gral. Brig.` (antes `Gral. Brigr.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 Ã¢â‚¬â€ Web: selector de grado solo abreviatura

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Desplegable de grado en alta de usuario muestra solo la abreviatura (ej. `Cap. 1/o.`), sin el nombre largo.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 Ã¢â‚¬â€ Web: pantalla en blanco en Usuarios (roleLabel)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Restaurada funciÃƒÂ³n `roleLabel` en panel Usuarios; sin ella React crasheaba al pintar la tabla. Eliminado CSS huÃƒÂ©rfano en `styles.css`.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/styles.css`

## 2026-08-25 Ã¢â‚¬â€ Web: estrella favorito sin mojibake (SVG)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n favorito (junto a **Llamar** y en lista de chats) usa icono SVG en lugar de carÃƒÂ¡cter Ã¢Ëœâ€¦ corrupto (`ÃƒÂ¢Ã‹Å“Ã¢â‚¬Â¦`).
- **Archivos / refs:** `web/src/StarIcon.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `styles.css`

## 2026-08-25 Ã¢â‚¬â€ Web: ticks de lectura sin mojibake en DM

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Corregidos caracteres corruptos (`ÃƒÂ¢Ã…â€œ"`) en mensajes directos: palomitas Ã¢Å“â€œ/Ã¢Å“â€œÃ¢Å“â€œ, estrella favorito, enviar, llamada entrante.
- **Por quÃƒÂ© / notas:** El archivo `DirectChat.jsx` tenÃƒÂ­a UTF-8 mal interpretado; ahora usa escapes `\u2713` etc.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/WhatsAppChat.jsx`

## 2026-08-25 Ã¢â‚¬â€ Web: alta de usuario reorganizada con checklist

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Modal **Alta de usuario** en 3 pasos con stepper visual, secciones (Identidad militar, Nombre completo, Vista previa, UbicaciÃƒÂ³n orgÃƒÂ¡nica), checklist Ã¢â‚¬Å“Falta completarÃ¢â‚¬Â y borde ÃƒÂ¡mbar en campos pendientes.
- **Por quÃƒÂ© / notas:** Ver de un vistazo quÃƒÂ© falta antes de avanzar; grado+cargo juntos, nombres agrupados, regiÃƒÂ³n/zona/unidad en cascada.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 Ã¢â‚¬â€ MÃƒÂ³vil: inbox Chats tipo WhatsApp + pestaÃƒÂ±a Radio

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Dos pestaÃƒÂ±as inferiores (**Chats** | **Radio**). Chats unifica grupos + DM con filtros Todos / No leÃƒÂ­dos / Favoritos / Grupos, bÃƒÂºsqueda, favoritos locales y badges. Al tocar conversaciÃƒÂ³n se abre pantalla completa; Radio conserva PTT, pÃƒÂ¡nico y canales (Mapa/Canales en menÃƒÂº Ã¢â€¹Â®).
- **Por quÃƒÂ© / notas:** Flujo principal estilo WhatsApp; radio como segunda pestaÃƒÂ±a sin saturar la barra inferior.
- **Archivos / refs:** `mobile/lib/screens/chat_inbox_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `radio_screen.dart`, `api_client.dart`; APK **1.8.16+25**

## 2026-08-25 Ã¢â‚¬â€ Alta usuario: generales Ã¢â€ â€™ adscripciÃƒÂ³n; indicativo con cargo

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Formulario de usuarios en 3 pasos (Generales Ã¢â€ â€™ RegiÃƒÂ³n/Zona/Unidad Ã¢â€ â€™ Grupos). Campo Ã‚Â«Cargo / puestoÃ‚Â» (ej. Jfe. Rgnl. TIC). Indicativo en chat/radio: `Grado Apellido, Cargo` (ej. Cap. Luna, Jfe. Rgnl. TIC).
- **Por quÃƒÂ© / notas:** Orden institucional claro; el cargo viaja en `display_name` para mÃƒÂ³vil y web.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/services/rfcUsername.js`, `backend/src/routes/admin.js`

## 2026-08-25 Ã¢â‚¬â€ NavegaciÃƒÂ³n mÃƒÂ³vil mÃƒÂ¡s clara (sin cÃƒÂ¡mara suelta)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Barra inferior con etiquetas (Mensajes, Mapa, Directos, Canales); se quitÃƒÂ³ el botÃƒÂ³n CÃƒÂ¡mara que mandaba fotos al chat sin contexto. En el chat, un solo botÃƒÂ³n **+** abre menÃƒÂº GalerÃƒÂ­a / CÃƒÂ¡mara / Archivo.
- **Por quÃƒÂ© / notas:** Flujo mÃƒÂ¡s entendible estilo WhatsApp; fotos solo desde el chat.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/chat_panel.dart`; APK **1.8.15+24**

## 2026-08-25 Ã¢â‚¬â€ Panel Usuarios rediseÃƒÂ±ado (web despacho)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Lista de usuarios como vista principal con skeleton al cargar, bÃƒÂºsqueda/filtros, actualizaciÃƒÂ³n en segundo plano sin vaciar la tabla, y alta de usuario en modal (+ Nuevo usuario) en lugar del formulario fijo arriba.
- **Por quÃƒÂ© / notas:** Mejor flujo de carga y menos scroll; la tabla queda visible de inmediato tras la carga.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 Ã¢â‚¬â€ Flecha pasos alta de usuario (web)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Corregido carÃƒÂ¡cter roto `ÃƒÂ¢Ã¢â‚¬Â '` entre Ã‚Â«1. DatosÃ‚Â» y Ã‚Â«2. GruposÃ‚Â» en el formulario de alta de usuario del despacho; ahora muestra `Ã¢â€ â€™`.
- **Por quÃƒÂ© / notas:** Mojibake por codificaciÃƒÂ³n incorrecta del sÃƒÂ­mbolo Unicode en el JSX.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.14 tap notificaciÃƒÂ³n abre chat/DM

- **Tipo:** fix | ux | ops
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:**
  - Tap en notificaciÃƒÂ³n de mensaje de grupo Ã¢â€ â€™ pane Chat del canal correcto, foco en compositor; cold start consume `pendingGroupId` tras bootstrap.
  - Tap en notificaciÃƒÂ³n DM Ã¢â€ â€™ pane Directos y abre el hilo del peer (`initialPeerId`).
  - `RadioShell` registra `onNotificationOpen` / `onNotificationData`; `PushService` guarda `pendingMessageId` y cold start de notificaciÃƒÂ³n local.
  - Publicada APK **1.8.14+23** (OTA `android.json` versionCode 23); copias en `Soporte/APK/`.
- **Por quÃƒÂ© / notas:** PushService ya dejaba pending al tocar, pero el shell no consumÃƒÂ­a ni navegaba (quedaba en radio).
- **Archivos / refs:** `radio_shell.dart`, `push_service.dart`, `direct_pane.dart`, `chat_panel.dart`, `pubspec.yaml`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.13 vibraciÃƒÂ³n fuerte en pÃƒÂ¡nico

- **Tipo:** feature | ux | ops
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:**
  - Alerta de pÃƒÂ¡nico entrante: vibraciÃƒÂ³n nativa en bucle (500 ms on / 200 ms off, amplitud mÃƒÂ¡xima si el hardware lo permite) junto con la sirena; se cancela al pulsar **Enterado** / stop.
  - BotÃƒÂ³n PÃƒÂNICO (emisor): rÃƒÂ¡faga fuerte de confirmaciÃƒÂ³n vÃƒÂ­a API `Vibrator` (`package:vibration` 3.2), no solo `HapticFeedback`.
  - Publicada APK **1.8.13+22** (OTA `android.json` versionCode 22); copias en `Soporte/APK/`.
- **Por quÃƒÂ© / notas:** El haptic corto no se sentÃƒÂ­a como vibraciÃƒÂ³n real en muchos equipos.
- **Archivos / refs:** `panic_vibration.dart`, `channel_session.dart`, `radio_screen.dart`, `pubspec.yaml`, `Publish-ApkUpdate.ps1`

## 2026-08-25 Ã¢â‚¬â€ APK 1.8.12 presencia + pÃƒÂ¡nico circular

- **Tipo:** feature | ux | ops
- **ÃƒÂrea:** mobile | backend | ops
- **QuÃƒÂ©:**
  - Publicada APK **1.8.12+21** (OTA `android.json` versionCode 21) con presencia Skype (verde/amarillo) y botÃƒÂ³n PÃƒÂ¡nico circular.
  - Copias en `Soporte/APK/TacticalPtx-1.8.12+21.apk` y `TacticalPtx-latest.apk`.
  - API reiniciada (`infra/start-api.cmd`); health TLS `:4000` ok (presence Redis JSON live).
- **Archivos / refs:** `mobile/pubspec.yaml`, `Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`, `presence.js`, `radio_screen.dart`

## 2026-08-25 Ã¢â‚¬â€ Presencia tipo Skype (verde / amarillo / rojo)

- **Tipo:** feature | ux
- **ÃƒÂrea:** mobile | backend | web
- **QuÃƒÂ©:**
  - Puntos de color en chips de presencia del canal radio: **verde** = en la app (foreground); **amarillo** = conectado pero minimizado/bloqueado (background); **rojo** reservado para offline (v1: al salir/stale desaparecen del listado).
  - Redis presence guarda JSON `{displayName,focus}`; `ptt:join` / `presence:ping` envÃƒÂ­an `focus`; broadcast al cambiar foco.
  - Chips con `StadiumBorder`; web RadioPage con puntos active/away.
- **Por quÃƒÂ© / notas:** Entra en el prÃƒÂ³ximo APK (sin bump de versiÃƒÂ³n en este cambio). Roster offline con chips rojos = mejora futura.
- **Archivos / refs:** `presence.js`, `ptt.js`, `channel_session.dart`, `radio_screen.dart`, `radio_shell.dart`, `usePtt.js`, `RadioPage.jsx`

## 2026-08-25 Ã¢â‚¬â€ BotÃƒÂ³n PÃƒÂ¡nico circular (sin esquinas)

- **Tipo:** ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Esquinas del botÃƒÂ³n PÃƒÂ¡nico redondeadas/circulares (`CircleBorder` + clip); sin fondo/splash cuadrado.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart` (`_PanicButton`)

## 2026-08-25 Ã¢â‚¬â€ Foto de perfil con recorte estilo WhatsApp

- **Tipo:** feature | ux | fix
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Tras elegir/tomar foto: pantalla de recorte circular (mover + zoom), export JPEG 800Ãƒâ€”800 ~85% y subida con `Content-Type: image/jpeg`.
  - Backend `/api/me/avatar` acepta mime vacÃƒÂ­o/`octet-stream` con extensiÃƒÂ³n vÃƒÂ¡lida y valida magic bytes; mensajes de error en espaÃƒÂ±ol.
  - SnackBar ya no muestra `Exception: Ã¢â‚¬Â¦`; APK **1.8.11+20**.
- **Por quÃƒÂ© / notas:** Android enviaba HEIC/octet-stream y multer rechazaba; falta de recorte tipo WhatsApp.
- **Archivos / refs:** `radio_shell.dart`, `api_client.dart`, `es_msg.dart`, `me.js`, `image_cropper`, `AndroidManifest.xml`, `Soporte/APK/`

## 2026-08-25 Ã¢â‚¬â€ Notificaciones se limpian al leer (estilo WhatsApp)

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
  - Al abrir chat de canal o un DM, se cancelan las notificaciones de esa conversaciÃƒÂ³n (tag `g:` / `dm:`) y tambiÃƒÂ©n `cancelAll` para avisos viejos sin tag.
  - Resume de la app con chat/DM abierto vuelve a limpiar bandeja; `markRead` ya no borra avisos si la app estÃƒÂ¡ en segundo plano.
  - FCM/Android ya usan `tag` + `collapseKey`; MethodChannel nativo `cancelTag` / `cancelAll`.
  - APK **1.8.10+19**.
- **Por quÃƒÂ© / notas:** Las push de chat quedaban en la bandeja tras leer (comportamiento distinto a WhatsApp).
- **Archivos / refs:** `push_service.dart`, `radio_shell.dart`, `direct_pane.dart`, `channel_session.dart`, `MainActivity.kt`, `fcm.js`, `Soporte/APK/`

## 2026-08-25 Ã¢â‚¬â€ UX: chat mÃƒÂ³vil estilo WhatsApp (sin huecos)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Chat de canal y DM: fondo tipo WA, burbujas compactas (colas, agrupaciÃƒÂ³n), lista `reverse`, hora + ticks, compositor redondo.
  - En chat/DM se oculta la barra inferior para quitar espacio vacÃƒÂ­o / doble chrome.
  - APK **1.8.9+18**.
- **Archivos / refs:** `chat_panel.dart`, `direct_pane.dart`, `radio_shell.dart`, `Soporte/APK/`

## 2026-08-25 Ã¢â‚¬â€ Fix UX: timeout por IP antigua en APK

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile | ops
- **QuÃƒÂ©:**
  - Causa: APK vieja apuntaba a `189.175.38.29:4000` (IP ya no responde); el host actual es `https://189.152.200.238.sslip.io`.
  - Mensaje de bootstrap mÃƒÂ¡s claro ante Timeout/Socket; usuario debe instalar `TacticalPtx-1.8.8+17.apk` (OTA no llega si la API vieja estÃƒÂ¡ caÃƒÂ­da).
- **Archivos / refs:** `radio_shell.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.8+17.apk`

## 2026-08-25 Ã¢â‚¬â€ Dominio HTTPS publico (Caddy + Let's Encrypt / sslip.io)

- **Tipo:** security | infra | ops
- **ÃƒÂrea:** infra | mobile | docs
- **QuÃƒÂ©:**
  - Borde Caddy en :80/:443 con cert **Let's Encrypt** para `https://189.152.200.238.sslip.io` (sin comprar dominio).
  - Scripts `START-PUBLIC-EDGE.ps1`, `Caddyfile.edge`, guÃƒÂ­a `DOMINIO_Y_CERTIFICADO.md`.
  - IP publica actualizada (`189.152.200.238`); UPnP 80/443 + stack; APK **1.8.8+17** con `API_BASE` al dominio.
  - Nota: si el ISP cambia la IP, re-ejecutar edge y republicar APK (o usar dominio propio).
- **Archivos / refs:** `infra/Caddyfile.edge`, `infra/START-PUBLIC-EDGE.ps1`, `infra/caddy/`, `Soporte/Documentos/DOMINIO_Y_CERTIFICADO.md`

## 2026-08-25 Ã¢â‚¬â€ Ops: UPnP reaplicado (+ TURN 3478)

- **Tipo:** ops
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:**
  - `Reinforce-UPnP.ps1`: mapeos OK 4000/5173/7880/7881/7882/**3478** Ã¢â€ â€™ `192.168.1.66`.
  - API/Web locales OK; Postgres Running/Automatic. Curl a IP pÃƒÂºblica desde el propio host = `000` (hairpin NAT tÃƒÂ­pico; validar desde 4G).
- **Archivos / refs:** `infra/Reinforce-UPnP.ps1`

## 2026-08-25 Ã¢â‚¬â€ Endurecimiento completo (ops + seguridad + TURN)

- **Tipo:** security | infra | ops
- **ÃƒÂrea:** backend | mobile | infra | docs
- **QuÃƒÂ©:**
  - Script `infra/HARDEN.ps1` / `.cmd`: Postgres **Automatic**, firewall (+UDP 3478), UPnP, `APP_UPDATE_SECRET`, `ALLOW_HOST_LOCKDOWN=1`, rate limits.
  - OTA: clave `X-App-Update-Key` + token HMAC de descarga; rate-limit dedicado; prod exige secreto.
  - Metrics/admin: Redis **SCAN** (sin `KEYS`).
  - LiveKit TURN embebido UDP 3478; Caddy `/rtc`; versiones API **1.8.6**; APK **1.8.7+16** (publicar con secreto).
  - GuÃƒÂ­a `Soporte/Documentos/SEGURIDAD_HARDENING.md`.
- **Archivos / refs:** `appUpdate.js`, `config.js`, `auth.js`, `redis.js`, `livekit.dev.yaml`, `Ensure-Firewall.ps1`, `HARDEN.ps1`, `mobile/lib/config.dart`, `PUBLISH-APK-UPDATE.cmd`

## 2026-08-24 Ã¢â‚¬â€ Fix: Enterado en pÃƒÂ¡nico cerraba la APK

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
  - Al pulsar **Enterado** en la alerta de pÃƒÂ¡nico la app se cerraba: doble `Navigator.pop` (botÃƒÂ³n + listener tras `ackIncomingPanic`/`notifyListeners`) y posible error no manejado al `stop()` de la sirena.
  - Enterado ahora cierra solo el diÃƒÂ¡logo; la app permanece en radio/chat. VersiÃƒÂ³n **1.8.6+15** publicada (Soporte + OTA).
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/channel_session.dart`, `mobile/pubspec.yaml`, `Soporte/APK/`, `backend/app-updates/`

## 2026-08-24 Ã¢â‚¬â€ Fix: xhr poll error Socket.IO en consola HTTPS

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:**
  - Causa: Socket.IO caÃƒÂ­a a long-polling XHR (a veces por proxy Vite / orden de transports) y el banner rojo Ã‚Â«xhr poll errorÃ‚Â» **no se limpiaba** aunque el enlace reconectara (Ã‚Â«Enlace okÃ‚Â» / Ã‚Â«Audio okÃ‚Â»).
  - Cliente: mismo origen vÃƒÂ­a proxy Vite `/socket.io` (bloquea `http://` bajo pÃƒÂ¡gina HTTPS); transports `websocket` Ã¢â€ â€™ `polling`; limpia error al `connect`.
  - Vite: timeouts del proxy socket; DirectChat unificado a `socketConfig`.
  - Mensaje UI en espaÃƒÂ±ol si vuelve a fallar el transporte.
- **Por quÃƒÂ© / notas:** Verificar: Ctrl+F5 en `https://189.175.38.29:5173` Ã¢â‚¬â€ sin banner rojo; `/socket.io/?EIO=4&transport=polling` debe responder `0{Ã¢â‚¬Â¦}` por HTTPS.
- **Archivos / refs:** `web/src/socketConfig.js`, `web/src/usePtt.js`, `web/src/DirectChat.jsx`, `web/src/esMsg.js`, `web/vite.config.js`, `backend/src/server.js`

## 2026-08-24 Ã¢â‚¬â€ Fix: LiveKit PTT bajo HTTPS remoto (mixed content)

- **Tipo:** fix | infra
- **ÃƒÂrea:** web | backend | infra
- **QuÃƒÂ©:**
  - Causa: consola `https://IP:5173` recibÃƒÂ­a `ws://IP:7880` Ã¢â€ â€™ el navegador bloqueaba la seÃƒÂ±al (mixed content) Ã¢â€ â€™ Ã‚Â«No se pudo conectar el audio (LiveKit)Ã‚Â».
  - Web: `publicLiveKitUrl` usa `wss://mismo-origen`; Vite proxy `/rtc` Ã¢â€ â€™ `http://127.0.0.1:7880`.
  - LiveKit reiniciado con `--node-ip 189.175.38.29`; UPnP 4000/5173/7880/7881 + UDP 7882 reaplicado.
  - Docs ACCESO_DIRECTO + `.env.example` aclaran seÃƒÂ±al vs media.
- **Por quÃƒÂ© / notas:** URL resultante consola: **`wss://189.175.38.29:5173`** (proxy). API/mÃƒÂ³vil: **`ws://189.175.38.29:7880`**. Media ICE: TCP 7881 / UDP 7882.
- **Archivos / refs:** `web/src/livekitUrl.js`, `web/vite.config.js`, `backend/src/services/livekit.js`, `infra/livekit.dev.yaml`, `infra/Reinforce-UPnP.ps1`, `infra/EXPOSE-UPNP.ps1`

## 2026-08-24 Ã¢â‚¬â€ Fix: consola web HTTPS para PTT remoto

- **Tipo:** fix | infra | ux
- **ÃƒÂrea:** web | infra | backend
- **QuÃƒÂ©:**
  - Vite `:5173` usa TLS con `infra/certs/lan-*.pem` (mismo cert que la API).
  - Guardas si no hay `navigator.mediaDevices` (mensaje en espaÃƒÂ±ol; sin crash).
  - `WEB_PUBLIC_URL=https://189.175.38.29:5173`; CORS incluye orÃƒÂ­genes HTTPS pÃƒÂºblicos.
  - Docs/arranque (`start-web`, `LEVANTAR`, ACCESO_DIRECTO, EXPOSE-*) actualizados.
- **Por quÃƒÂ© / notas:** Abrir `http://IP:5173` desde 4G Ã¢â€ â€™ `getUserMedia` undefined. Remoto: **https://189.175.38.29:5173** (aceptar cert autofirmado).
- **Archivos / refs:** `web/vite.config.js`, `web/src/voiceRecord.js`, `web/src/usePtt.js`, `web/src/esMsg.js`, `backend/.env`, `infra/start-web.cmd`

## 2026-08-24 Ã¢â‚¬â€ Fix: GET / API redirige a consola web

- **Tipo:** fix | ux
- **ÃƒÂrea:** backend
- **QuÃƒÂ©:**
  - `GET /` en la API (:4000) deja de devolver `{"ok":false,"error":"Ruta no encontrada"}` y responde **302** a la consola (`WEB_PUBLIC_URL`, default `http://189.175.38.29:5173`).
  - `/api/health` sin cambios. RaÃƒÂ­z permitida tambiÃƒÂ©n bajo lockdown (solo redirect).
  - Documentado en `.env.example`; en host: `WEB_PUBLIC_URL=http://189.175.38.29:5173`.
  - Con TLS activo no hay listener HTTP en :4000: `http://Ã¢â‚¬Â¦:4000` no llega a Express (usar `https://Ã¢â‚¬Â¦:4000/` o ir directo a `:5173`). Clientes APK `https://Ã¢â‚¬Â¦:4000` intactos.
- **Por quÃƒÂ© / notas:** Usuario abriÃƒÂ³ la raÃƒÂ­z de la API desde el mÃƒÂ³vil esperando Ã¢â‚¬Å“entrarÃ¢â‚¬Â a la app web.
- **Archivos / refs:** `backend/src/server.js`, `backend/src/config.js`, `backend/src/services/intrusion.js`, `backend/.env.example`

## 2026-08-24 Ã¢â‚¬â€ Ops: PostgreSQL reiniciado (login/despacho)

- **Tipo:** ops | fix
- **ÃƒÂrea:** database | ops
- **QuÃƒÂ©:**
  - Servicio `postgresql-x64-17` estaba **Stopped** (StartType Manual); provocaba fallos de login/despacho aunque API/web/OTA respondieran.
  - Arranque elevado OK Ã¢â€ â€™ **Running**; `tacticalptx_db` accesible (psql; 8 usuarios).
  - Health API: `ready:true`, `db:connected` en `https://127.0.0.1:4000/api/health` y `https://189.175.38.29:4000/api/health`. Web `5173` y Redis OK; no hizo falta reiniciar API.
- **Por quÃƒÂ© / notas:** `Start-Service` sin Admin falla (Ã¢â‚¬Å“No se puede abrir el servicioÃ¢â‚¬Â). Comando elevado: `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-Command','Start-Service postgresql-x64-17'`. Conviene valorar StartType **Automatic** para que no quede caÃƒÂ­do tras reinicio.
- **Archivos / refs:** servicio Windows `postgresql-x64-17`; data `C:\Program Files\PostgreSQL\17\data`


## 2026-08-24 Ã¢â‚¬â€ APK OTA 1.8.5+14 (host pÃƒÂºblico)

- **Tipo:** ops | feature
- **ÃƒÂrea:** mobile | backend | infra
- **QuÃƒÂ©:**
  - VersiÃƒÂ³n mÃƒÂ³vil `1.8.5+14`; `API_BASE` por defecto `https://189.175.38.29:4000` (pubspec/scripts/`config.dart`).
  - PublicaciÃƒÂ³n OTA: manifiesto + APK en `backend/app-updates/`; copia `Soporte/APK/TacticalPtx-1.8.5+14-4G.apk`.
  - UPnP reaplicado (incl. TCP **5173** web): health/OTA pÃƒÂºblicos alcanzables; web remota `http://189.175.38.29:5173`.
- **Por quÃƒÂ© / notas:** Acceso PC remota vÃƒÂ­a IP pÃƒÂºblica (no LAN). PostgreSQL quedÃƒÂ³ detenido (hace falta Admin para `Start-Service`); API responde pero `db:disconnected` hasta reiniciar PG.
- **Archivos / refs:** `mobile/pubspec.yaml`, `PUBLISH-APK-UPDATE.cmd`, `BUILD-APK-WHATSAPP.cmd`, `backend/app-updates/`, `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`

## 2026-08-24 Ã¢â‚¬â€ Mapas: capas institucionales + zoom al cursor

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Se mantienen las capas **Natural** (Carto Voyager), **SatÃƒÂ©lite** (Esri) y **Claro** (OSM); default `natural`. No se cambiÃƒÂ³ el basemap al pedir Ã¢â‚¬Å“como Google MapsÃ¢â‚¬Â.
  - Se conserva **CursorZoom** (rueda hacia el punto bajo el cursor) en Seguimiento.
  - Fondo del contenedor Leaflet en Seguimiento alineado al tono institucional Voyager (tema claro); oscuro solo en tema dark.
- **Por quÃƒÂ© / notas:** Ã¢â‚¬Å“Como MapsÃ¢â‚¬Â = solo la funciÃƒÂ³n de zoom, no el estilo de teselas.
- **Archivos / refs:** `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-08-24 Ã¢â‚¬â€ ActualizaciÃƒÂ³n APK en la app (estilo BanjeCel)

- **Tipo:** feature | ops | ux
- **ÃƒÂrea:** mobile | backend | docs
- **QuÃƒÂ©:**
  - Al abrir Android: pantalla Ã‚Â«Cargando configuraciÃƒÂ³nÃ¢â‚¬Â¦Ã‚Â»; `GET /api/app/android`; si `versionCode` del servidor es mayor, descarga APK e instala (FileProvider / instalador del sistema).
  - Manifiesto + APK en `backend/app-updates/`; `PUBLISH-APK-UPDATE.cmd`; guÃƒÂ­a `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`.
  - Shorebird queda como parche Dart opcional; flujo principal = APK completa (sin Play Store).
- **Por quÃƒÂ© / notas:** DistribuciÃƒÂ³n institucional directa, UX equivalente a BanjeCel.
- **Archivos / refs:** `backend/src/routes/appUpdate.js`, `mobile/lib/app_update.dart`, `mobile/lib/main.dart`, `MainActivity.kt`, `PUBLISH-APK-UPDATE.cmd`


## 2026-08-24 Ã¢â‚¬â€ Config APK 1.8.4+13 (API 4G + OTA)

- **Tipo:** release | mejora | ops
- **ÃƒÂrea:** mobile | docs
- **QuÃƒÂ©:**
  - `pubspec` Ã¢â€ â€™ **1.8.4+13** (`versionName` / `versionCode`).
  - Build WhatsApp por defecto `API_BASE=https://189.175.38.29:4000`; `FORCE_LAN=1` para HTTPS LAN.
  - Copia a `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk` (+ `TacticalPtx-latest.apk`) y manifiesto OTA `backend/app-updates/`.
  - `network_security_config`: dominio IP pÃƒÂºblica; README/run-usb alineados a HTTPS.
- **Por quÃƒÂ© / notas:** Alineado a `LIVEKIT_PUBLIC_HOST` y al flujo de actualizaciÃƒÂ³n en app (REQUEST_INSTALL_PACKAGES / FileProvider ya en paralelo).
- **Archivos / refs:** `mobile/pubspec.yaml`, `scripts/BUILD-APK-WHATSAPP.cmd`, `network_security_config.xml`, `run-usb.ps1`, `mobile/README.md`, `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk`

## 2026-08-24 Ã¢â‚¬â€ DiÃƒÂ¡logos in-app (sin window.confirm)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
  - Componente `AppDialog` (estilo `sys-modal`) para confirmar / avisar dentro de la app.
  - Sustituidos `window.confirm` / `alert` en grupos, chat WhatsApp, mapa y catÃƒÂ¡logo de geocercas.
- **Por quÃƒÂ© / notas:** Los diÃƒÂ¡logos nativos del navegador no coinciden con la UI institucional.
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchGroups.jsx`, `WhatsAppChat.jsx`, `DispatchMap.jsx`, `GeofenceCatalog.jsx`

## 2026-08-24 Ã¢â‚¬â€ PTT circular y pÃƒÂ¡nico al primer toque (mÃƒÂ³vil)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
  - BotÃƒÂ³n PTT circular tÃƒÂ¡ctil (oliva/oro, etiqueta PTT / AL AIRE); hold-to-talk sin cambios.
  - PÃƒÂ¡nico mÃƒÂ¡s visible (rojo urgente) y **dispara al primer toque** Ã¢â‚¬â€ sin diÃƒÂ¡logo Ã‚Â«Ã‚Â¿confirmas?Ã‚Â».
  - Web alineada: pÃƒÂ¡nico al primer clic; PTT institucional vuelve a ser cÃƒÂ­rculo (no cuadrado redondeado).
- **Por quÃƒÂ© / notas:** Captura de radio: PTT poco llamativo y pÃƒÂ¡nico con confirmaciÃƒÂ³n.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `radio_shell.dart`, `web/src/pages/RadioPage.jsx`, `web/src/institutional.css`

## 2026-08-24 Ã¢â‚¬â€ CorrecciÃƒÂ³n de textos UTF-8 (mojibake)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Corregidos acentos rotos (`SESIÃƒÆ’Ã‚Â³N` Ã¢â€ â€™ `SESIÃƒâ€œN`, contraseÃƒÂ±a, vacÃƒÂ­o, etc.) en login, chat DM y mensajes de error del socket de chat.
- **Archivos / refs:** `web/src/App.jsx`, `web/src/DirectChat.jsx`, `backend/src/socket/chat.js`

## 2026-08-24 Ã¢â‚¬â€ Lockdown ante intrusiÃƒÂ³n + endurecimiento

- **Tipo:** security | infra
- **ÃƒÂrea:** backend | infra | docs
- **QuÃƒÂ©:**
  - Servicio de lockdown: fallos de login Ã¢â€ â€™ fuera de servicio (503), revoca sesiones, corta sockets, aviso FCM a root/admin, incidente en Soporte/Respaldos.
  - `POST /api/security/unlock` con `LOCKDOWN_UNLOCK_SECRET`; lockdown manual por root.
  - `infra/LOCKDOWN.ps1` / `.cmd`: cierra firewall/UPnP y detiene API/Web/LiveKit.
  - `/api/metrics` solo con rol despacho; sin backdoors detectados en auditorÃƒÂ­a.
- **Archivos / refs:** `backend/src/services/intrusion.js`, `routes/security.js`, `LOCKDOWN.ps1`, `SEGURIDAD_LOCKDOWN.md`

## 2026-08-23 Ã¢â‚¬â€ Marca ÃƒÂºnica TacticalPtx

- **Tipo:** docs | mejora | infra
- **ÃƒÂrea:** backend | web | mobile | database | docs | infra
- **QuÃƒÂ©:**
  - Producto y docs solo bajo marca TacticalPtx (sin nombre anterior).
  - BD `tacticalptx_db`; package web `tacticalptx-web`; localStorage `tacticalptx_*`.
  - iOS bundle `com.tacticalptx.app`; display name TacticalPtx.
  - Carpeta de disco `D:\pulsanet` es solo ruta; el producto es TacticalPtx.
- **Archivos / refs:** `backend/.env`, `config.js`, `schema.sql`, `README.md`, `docs/UBICACION_PROYECTO.md`, iOS `Info.plist` / `project.pbxproj`

## 2026-08-23 Ã¢â‚¬â€ Firewall Windows canÃƒÂ³nico (sin variantes)

- **Tipo:** infra | security | ops
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:**
 - Fuente ÃƒÂºnica `infra/Ensure-Firewall.ps1` (solo `netsh`; evita colgar `Get-NetFirewall*`).
 - 6 reglas fijas: TCP 4000/5173/7880/7881 + UDP 7882 + UDP 50000-50200.
 - Elimina variTacticalPtx / Ã¢â‚¬Å“TacticalPtx API TCPÃ¢â‚¬Â¦Ã¢â‚¬Â / livekit-server Any.
 - Integrado en `start-services.ps1`, `EXPOSE-UPNP.ps1`, `EXPOSE-PUBLIC.ps1`; launcher `ENSURE-FIREWALL.cmd`.
 - UPnP: `Reinforce-UPnP.ps1` / `EXPOSE-UPNP.ps1` (hoy el IGD del router no respondiÃƒÂ³; reintentar con UPnP activo).
- **Archivos / refs:** `infra/Ensure-Firewall.ps1`, `infra/ENSURE-FIREWALL.cmd`, `infra/Reinforce-UPnP.ps1`, `infra/start-services.ps1`

## 2026-08-23 Ã¢â‚¬â€ LEVANTAR-TACTICALPTX.bat corregido y reforzado

- **Tipo:** infra | ops | fix
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:**
 - BAT en ASCII; `/nopause`; preflight Node/npm; LAN vÃƒÂ­a `ipconfig` (sin `Get-NetIPAddress`).
 - Health API sin `findstr` con comillas escapadas (rompÃƒÂ­a `>nul`); detecta `tacticalptx-api`.
 - Solo libera :4000/:5173 si hay listener zombie; no mata API/Web sanos.
 - Postgres 17/16/15; espera ~45 s; abre navegador solo si Web responde.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 Ã¢â‚¬â€ Seguimiento acotado RegiÃƒÂ³n / C.G.Ã¢â‚¬â€œZona / Unidad

- **Tipo:** feature | security | ux
- **ÃƒÂrea:** backend | web
- **QuÃƒÂ©:**
 - Modelo: RegiÃƒÂ³n maestro; C.G. RegiÃƒÂ³n con unidades subordinadas directas; Zonas administran unidades; Unidades administran servicios desplegados (usuarios).
 - GPS / seguimiento / pÃƒÂ¡nico / geocerca filtrados por alcance (`loadTrackScope` + salas `dispatch:track:*`).
 - Textos de privilegios y catÃƒÂ¡logo Unidades alineados a esa jerarquÃƒÂ­a.
- **Archivos / refs:** `orgUnits.js`, `locations.js`, `dispatch.js`, `panic.js`, `geofences.js`, `LiveTrackMap.jsx`, `DispatchUsers.jsx`, `DispatchUnits.jsx`

## 2026-08-23 Ã¢â‚¬â€ JerarquÃƒÂ­a RegiÃƒÂ³n / Zonas / Unidades + multi-canal

- **Tipo:** feature | security | ux
- **ÃƒÂrea:** backend | web | database
- **QuÃƒÂ©:**
 - Rol `unit_admin`; privilegios `can_see_region` / `can_see_zones` / `can_see_units`.
 - RegiÃƒÂ³n (root/admin) = maestro; zona controla sus unidades/usuarios; unidad solo los suyos.
 - Lista de canales filtrada por privilegios; radio/despacho con multi-selecciÃƒÂ³n (oÃƒÂ­r varios / hablar en uno).
 - Alta y tabla de usuarios: checkboxes R/Z/U y alcance de zona/unidad.
- **Archivos / refs:** `016_unit_admin_visibility.sql`, `roles.js`, `orgUnits.js`, `admin.js`, `groups.js`, `DispatchUsers.jsx`, `ChannelMultiSelect.jsx`, `RadioPage.jsx`, `DispatchLayout.jsx`

## 2026-08-23 Ã¢â‚¬â€ LEVANTAR-TACTICALPTX.bat reforzado

- **Tipo:** infra | ops
- **ÃƒÂrea:** infra
- **QuÃƒÂ©:**
 - BAT detecta API HTTP/HTTPS, espera health, libera puertos zombies, lee IP LAN y `LIVEKIT_PUBLIC_HOST`.
 - `start-api.cmd` / `start-web.cmd` mÃƒÂ¡s robustos (PATH, npm install, mensajes claros).
 - Stack verificado: API HTTPS ok, Web, LiveKit (`node-ip` pÃƒÂºblica), Redis.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 Ã¢â‚¬â€ Seguimiento: zoom al cursor (tipo Maps)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En Seguimiento, la rueda acerca/aleja el punto bajo el cursor (como Google Maps), no el centro del mapa.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-23 Ã¢â‚¬â€ APK 1.8.3+12 (logo oliva/oro)

- **Tipo:** release | ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** APK con logo recoloreado; fix sintaxis `panic:update` en `channel_session.dart`. API `https://189.175.38.29:4000`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.3+12-4G-logo.apk`, `pubspec.yaml` `1.8.3+12`

## 2026-08-23 Ã¢â‚¬â€ Logo: rojo Ã¢â€ â€™ oliva/oro institucional

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** RecoloraciÃƒÂ³n de `tacticalptx.png` (web + mÃƒÂ³vil): acentos rojos a oliva `#243d20` y oro `#9a7b2f`; marco del logo alineado a la marca.
- **Por quÃƒÂ© / notas:** Respaldo en `Soporte/Respaldos/logo-tacticalptx-*`. Ctrl+F5 en login.
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `mobile/assets/brand/tacticalptx.png`, `styles.css`, `institutional.css`

## 2026-08-23 Ã¢â‚¬â€ RevisiÃƒÂ³n seguridad: cifrado y authz

- **Tipo:** security | fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
 - Wire AES tambiÃƒÂ©n en `dispatch:panic` / `panic_update`; CC descifra.
 - `GET /locations` y tracks solo roles de despacho (incl. `zone_admin`).
 - Ya no se exporta `contentKey`; `wireKey` no se guarda en `localStorage`.
 - FCM de chat/DM sin cuerpo en claro; pÃƒÂ¡nico en chat sin coords.
 - Prod rechaza secretos de ejemplo (content/wire/E2EE); health sin detalle crypto en prod.
 - `zone_admin` entra a despacho / usuarios; LAN TLS solo confÃƒÂ­a el host de API.
- **Archivos / refs:** `dispatch.js`, `locations.js`, `auth.js`, `contentCrypto.js`, `config.js`, `api.js`, `CommandCenter.jsx`, `lan_tls.dart`

## 2026-08-23 Ã¢â‚¬â€ Chat inbox estilo WhatsApp

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Inbox unificado (grupos + DM) con pestaÃƒÂ±as Todos / No leÃƒÂ­dos / Favoritos / Grupos.
 - Favoritos en `localStorage`; badges de no leÃƒÂ­dos; bÃƒÂºsqueda de chats.
 - Banner superior al llegar mensaje fuera del chat abierto; tono doble tipo WhatsApp.
 - DM: ticks de lectura, botÃƒÂ³n enviar circular; panel sin sidebar duplicada.
- **Por quÃƒÂ© / notas:** Recargar Radio con Ctrl+F5.
- **Archivos / refs:** `ChatInbox.jsx`, `RadioPage.jsx`, `DirectChat.jsx`, `styles.css`, `appNotify.js`

## 2026-08-23 Ã¢â‚¬â€ PÃƒÂ¡nico: Enterado silencia solo este dispositivo

- **Tipo:** fix
- **ÃƒÂrea:** web | mobile | backend
- **QuÃƒÂ©:** Enterado ya no apaga la sirena en los demÃƒÂ¡s; cada equipo la cancela por su cuenta. Resuelto/cancelado sÃƒÂ­ cierra en todos.
- **Archivos / refs:** `panic.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

## 2026-08-23 Ã¢â‚¬â€ Organigrama IV R.M. (RegiÃƒÂ³n Ã¢â€ â€™ zonas Ã¢â€ â€™ unidades)

- **Tipo:** feature
- **ÃƒÂrea:** database | backend | web
- **QuÃƒÂ©:**
 - JerarquÃƒÂ­a operativa: RegiÃƒÂ³n Ã¢â€ â€™ C.G. / 4 Z.M. (+ Sanidad, AÃƒÂ©reas, Justicia) Ã¢â€ â€™ 70 unidades.
 - Fuente: catÃƒÂ¡logo institucional IV R.M. (Control TÃƒÂ³ner); ParqueVehicular no estÃƒÂ¡ en esta PC.
 - Rol `zone_admin` (admin de zona: usuarios en su alcance).
 - Seed: `npm run seed:units` crea unidades + canal PTT por unidad.
 - CatÃƒÂ¡logo web **Unidades** en despacho.
- **Archivos / refs:** `015_org_units.sql`, `ivRmUnits.js`, `seed-units.js`, `orgUnits.js`, `admin.js`, `DispatchUnits.jsx`

## 2026-08-23 Ã¢â‚¬â€ PTT mini en Seguimiento y resto de despacho

- **Tipo:** feature | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - BotÃƒÂ³n PTT compacto en la franja de radio (visible en Seguimiento, mapa, catÃƒÂ¡logos, etc.).
 - Espacio para hablar en toda la consola de despacho.
- **Archivos / refs:** `DispatchLayout.jsx`, `RadioPage.jsx`, `institutional.css`

## 2026-08-22 Ã¢â‚¬â€ Chat: altura fija (2.Ã‚Âª pasada)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Causa real: `.shell` con `min-height: 100dvh` dentro de despacho + `.cc-shell` solo `min-height` Ã¢â€ â€™ la pÃƒÂ¡gina crecÃƒÂ­a con los mensajes.
 - Consola: `height/max-height: 100dvh` + `overflow: hidden` en shell/body/main.
 - Radio embebido: anula min-height del shell; grid/chat en flex con `min-height: 0`; scroll solo en `.wa-log`.
- **Por quÃƒÂ© / notas:** Recargar Radio con Ctrl+F5 (hard refresh).
- **Archivos / refs:** `styles.css`, `command-center.css`, `institutional.css` (`.cc-main` tenÃƒÂ­a `overflow:auto`)

## 2026-08-22 Ã¢â‚¬â€ jlunag2: oÃƒÂ­a pero no lo oÃƒÂ­an (LiveKit)

- **Tipo:** fix
- **ÃƒÂrea:** backend | web | mobile | infra
- **QuÃƒÂ©:**
 - Cap. Luna (`jlunag2`) reportÃƒÂ³ en chat: escucha pero no sabe si lo oyen; PTT OK, audio de subida fallaba.
 - `LIVEKIT_PUBLIC_HOST` unifica URL LiveKit (web + 4G); LiveKit reiniciado con `--node-ip` pÃƒÂºblica.
 - Web: re-play audio al `TrackUnmuted`; mÃƒÂ³vil: `setMicrophoneEnabled` en PTT.
- **Por quÃƒÂ© / notas:** Cuenta OK en BD. Fallo de medios ICE (LAN vs pÃƒÂºblica). Web: Ctrl+F5 + reentrar canal. MÃƒÂ³vil: ideal APK nuevo; sin APK, salir/entrar canal tras reinicio LiveKit.
- **Archivos / refs:** `livekit.js`, `.env`, `start-services.ps1`, `usePtt.js`, `channel_session.dart`

## 2026-08-22 Ã¢â‚¬â€ Chat: scroll interno (estilo WhatsApp)

- **Tipo:** fix | ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - El panel de radio ya no crece con los mensajes; altura fija al viewport.
 - El historial (grupo y DM) hace scroll interno; cabecera y composer quedan fijos.
- **Por quÃƒÂ© / notas:** `max-height: none` en `.wa-chat` hacÃƒÂ­a alargar toda la pÃƒÂ¡gina. Recargar con Ctrl+F5.
- **Archivos / refs:** `web/src/styles.css`

## 2026-08-22 Ã¢â‚¬â€ Credenciales: modal del sistema (sin alert)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Alta/restablecer clave ya no usan `window.alert`/`confirm`; modal institucional con copiar y Esc.
- **Archivos / refs:** `DispatchUsers.jsx`, `institutional.css`

## 2026-08-22 Ã¢â‚¬â€ Fix voz de regreso (LiveKit ICE / URL)

- **Tipo:** fix
- **ÃƒÂrea:** backend | web | infra
- **QuÃƒÂ©:**
 - LiveKit `use_external_ip: true` + `--node-ip` LAN para que el audio RTP vuelva en LAN y 4G.
 - Token ya no fuerza IP pÃƒÂºblica desde Vite/localhost; usa `LIVEKIT_LAN_HOST`.
 - Clientes web reescriben `127.0.0.1` en URL LiveKit (`livekitUrl.js`).
 - UPnP 7880Ã¢â‚¬â€œ7882 reaplicado.
- **Por quÃƒÂ© / notas:** SeÃƒÂ±al OK pero medios ICE mal anunciados Ã¢â€ â€™ se oÃƒÂ­a PTT propio / no el de regreso. Recargar Radio (Ctrl+F5); en app salir y entrar al canal.
- **Archivos / refs:** `livekit.js`, `livekit.dev.yaml`, `usePtt.js`, `livekitUrl.js`

## 2026-08-22 Ã¢â‚¬â€ PÃƒÂ¡nico: tono mÃƒÂ¡s centrado (780/980 Hz)

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Sirena hi-lo media (~780Ã¢â€ â€980 Hz) en lugar del barrido agudo wail; WAV regenerado.
- **Archivos / refs:** `panicSound.js`, `public/sounds/panic_siren.wav`, `mobile/assets/sounds/panic_siren.wav`

## 2026-08-22 Ã¢â‚¬â€ Nuevo sonido de pÃƒÂ¡nico (sirena wail)

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Sirena de emergencia tipo barrido (wail) en lugar del beep 880/1175; asset `panic_siren.wav` en web y app.
- **Archivos / refs:** `web/src/panicSound.js`, `web/public/sounds/panic_siren.wav`, `mobile/assets/sounds/`, `channel_session.dart`

## 2026-08-22 Ã¢â‚¬â€ Grado: desplegable EjÃƒÂ©rcito Mexicano

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Campo Grado en alta de usuarios pasa a `<select>` con grados Art. 129 LOEFAM (Generales Ã¢â€ â€™ Tropa), abreviatura al aire.
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`, `DispatchUsers.jsx`

## 2026-08-22 Ã¢â‚¬â€ UPnP + firewall para 4G/5G (sin Tailscale mÃƒÂ³vil)

- **Tipo:** infra | ops
- **ÃƒÂrea:** infra | mobile
- **QuÃƒÂ©:**
 - Firewall Windows + mapeo UPnP automÃƒÂ¡tico (4000/7880/7881/7882) Ã¢â€ â€™ health pÃƒÂºblica HTTPS **200**.
 - Script `infra/EXPOSE-UPNP.cmd` / `.ps1`.
 - `LIVEKIT_PUBLIC_URL=ws://189.175.38.29:7880`.
 - APK **1.8.3+10** 4G: `Soporte/APK/TacticalPtx-1.8.3+10-4G.apk`.
- **Por quÃƒÂ© / notas:** En el celular solo la APK; sin Tailscale. Tras reiniciar el router, volver a ejecutar EXPOSE-UPNP.
- **Archivos / refs:** `EXPOSE-UPNP.ps1`, `ACCESO_DIRECTO_SIN_TAILSCALE.md`

## 2026-08-22 Ã¢â‚¬â€ RevisiÃƒÂ³n 4G/IP pÃƒÂºblica (sin Tailscale)

- **Tipo:** ops | infra
- **ÃƒÂrea:** infra | mobile | docs
- **QuÃƒÂ©:**
 - IP pÃƒÂºblica `189.175.38.29` (sin CGNAT); LAN `192.168.1.66`.
 - Firewall Windows: TCP 4000/7880/7881 + UDP 7882.
 - Cert TLS regenerado con SAN LAN + IP pÃƒÂºblica; API reiniciada.
 - Acceso Internet aÃƒÂºn pendiente de **reenvÃƒÂ­o en el router**.
- **Archivos / refs:** `ACCESO_DIRECTO_SIN_TAILSCALE.md`, `EXPOSE-PUBLIC.ps1`, `infra/certs/`

## 2026-08-22 Ã¢â‚¬â€ Fix xhr poll error (socket vÃƒÂ­a proxy Vite)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** En DEV el socket ya no apunta a `https://127.0.0.1:4000` (cert autofirmado Ã¢â€ â€™ xhr poll error); usa mismo origen y el proxy Vite (`secure:false`).
- **Archivos / refs:** `web/src/socketConfig.js`

## 2026-08-22 Ã¢â‚¬â€ Fix CERTIFICATE_VERIFY_FAILED (APK 1.8.3+9)

- **Tipo:** fix | security
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Flutter confÃƒÂ­a el cert LAN vÃƒÂ­a `LanTls` + asset `assets/certs/lan-cert.pem` (HttpOverrides).
 - Allowlist de hosts privados como respaldo; mensaje de error en espaÃƒÂ±ol.
 - APK **1.8.3+9** con `API_BASE=https://192.168.1.66:4000`.
- **Por quÃƒÂ© / notas:** `network_security_config` de Android no aplica al HttpClient de Dart; por eso fallaba el login HTTPS.
- **Archivos / refs:** `lan_tls.dart`, `main.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.3+9.apk`

## 2026-08-22 Ã¢â‚¬â€ EscalÃƒÂ³n TLS LAN + APK HTTPS 1.8.3+8

- **Tipo:** security | ops
- **ÃƒÂrea:** backend | web | mobile | infra
- **QuÃƒÂ©:**
 - EscalÃƒÂ³n 1: API reiniciada; health OK; GPS exige auth; LiveKit :7880 OK; wire on.
 - EscalÃƒÂ³n 2: `TLS_CERT`/`TLS_KEY` activos; CORS HTTPS; Vite proxy `https://127.0.0.1:4000` (secure:false); LiveKit sigue en `ws://` (no forzar wss).
 - EscalÃƒÂ³n 3: APK **1.8.3+8** con `API_BASE=https://192.168.1.66:4000` + `network_security_config` (cert LAN embebido).
- **Por quÃƒÂ© / notas:** HTTP plano a :4000 ya no responde. Reiniciar Vite. En navegador aceptar cert autofirmado si abres la API directo.
- **Archivos / refs:** `backend/.env`, `vite.config.js`, `socketConfig.js`, `network_security_config.xml`, `Soporte/APK/TacticalPtx-1.8.3+8.apk`

## 2026-08-22 Ã¢â‚¬â€ APK 1.8.3+7

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Build release `1.8.3+7` con `API_BASE=http://192.168.1.66:4000`.
 - Copia en `Soporte/APK/TacticalPtx-1.8.3+7.apk` y `TacticalPtx-latest.apk`.
- **Por quÃƒÂ© / notas:** ActualizaciÃƒÂ³n de campo tras cifrado wire/TLS y fixes de indicativo.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/build/app/outputs/flutter-apk/app-release.apk`

## 2026-08-22 Ã¢â‚¬â€ Cifrado en trÃƒÂ¡nsito + fix indicativo JWT

- **Tipo:** security | fix
- **ÃƒÂrea:** backend | web | infra
- **QuÃƒÂ©:**
 - Perfil vivo desde BD en auth REST y sockets (indicativo/rol ya no quedan congelados en el JWT).
 - TLS opcional (`TLS_CERT`/`TLS_KEY`) + generador LAN de certificados PEM.
 - Cifrado wire AES-256-GCM de GPS/geocerca en socket; login/`/me` entregan `crypto.wireKey`.
 - LiveKit wss si la API va por HTTPS; prod exige claves de contenido, voz y wire.
 - ÃƒÂndice de matrÃƒÂ­cula alineado en `schema.sql`.
- **Por quÃƒÂ© / notas:** Refuerza trÃƒÂ¡fico entre hosts; descomentar TLS en `.env` para HTTPS total. Reiniciar API; en despacho se refresca la clave wire vÃƒÂ­a `/api/auth/me`.
- **Archivos / refs:** `userProfile.js`, `wireCrypto.js`, `tls.js`, `server.js`, `auth.js`, `generate-lan-certs.mjs`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 Ã¢â‚¬â€ Contraste tema oscuro en todo el web

- **Tipo:** fix
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
 - Capa `theme-contrast.css` al final: selects, botones, chat, pÃƒÂ¡nico, badges, popups Leaflet, tablas y formularios legibles en claro/oscuro.
 - Corregidos texto perdido en selector de canal, botones primary/WA, banner al aire y chips.
- **Archivos / refs:** `theme-contrast.css`, `main.jsx`, `DispatchLayout.jsx`, `styles.css`, `command-center.css`, `chat_panel.dart`

## 2026-08-22 Ã¢â‚¬â€ Selects legibles en tema oscuro

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Opciones del selector de canal/grupos con contraste correcto (fondo oscuro + texto claro; evita letras blancas sobre blanco).
- **Archivos / refs:** `institutional.css`, `command-center.css`

## 2026-08-22 Ã¢â‚¬â€ Usuarios: grado, especialidad, nombres, matrÃƒÂ­cula e indicativo

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | database
- **QuÃƒÂ©:**
 - Alta pide Grado, Especialidad, Nombre(s), Apellidos y MatrÃƒÂ­cula.
 - Al hablar/publicar el `display_name` es el indicativo **Grado + apellido paterno** (ej. Cap. Gomez); el canal se muestra aparte (ej. B.O. Ã‚Â«Las GranaditasÃ‚Â»).
- **Archivos / refs:** `014_user_identity.sql`, `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `DispatchLayout.jsx`

## 2026-08-22 Ã¢â‚¬â€ Geocercas fuera de CatÃƒÂ¡logos

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Quitada la entrada Geocercas de CatÃƒÂ¡logos (menÃƒÂº y pestaÃƒÂ±as); las zonas se gestionan en Mapa en vivo. URL antigua redirige a `/despacho/mapa`.
- **Archivos / refs:** `CatalogsLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

## 2026-08-22 Ã¢â‚¬â€ Sin textos Ã¢â‚¬Å“como WhatsAppÃ¢â‚¬Â en la UI

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Eliminadas frases de comparaciÃƒÂ³n con WhatsApp en Seguimiento, perfil y comentarios visibles al producto.
- **Archivos / refs:** `LiveTrackMap.jsx`, `radio_shell.dart`

## 2026-08-22 Ã¢â‚¬â€ Login mÃƒÂ¡s presentable (web + mÃƒÂ³vil)

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Login con mÃƒÂ¡s presencia de marca, atmÃƒÂ³sfera oliva/oro, animaciones suaves y tarjeta con acento dorado (misma identidad institucional).
- **Archivos / refs:** `App.jsx`, `institutional.css`, `mobile/lib/screens/login_screen.dart`

## 2026-08-22 Ã¢â‚¬â€ Colores app alineados a web institucional

- **Tipo:** ux
- **ÃƒÂrea:** mobile | web
- **QuÃƒÂ©:**
 - App mÃƒÂ³vil: paleta oliva/oro (login, radio, chat, llamadas, cambio de clave).
 - Seguimiento y llamadas web: sin verde/azul WhatsApp; usan `--cc-live` / oliva institucional.
- **Archivos / refs:** `mobile/lib/theme.dart`, `incoming_call_screen.dart`, `direct_pane.dart`, `command-center.css`, `styles.css`, `LiveTrackMap.jsx`

## 2026-08-22 Ã¢â‚¬â€ Seguimiento maximizar + Esc cierra overlays

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - BotÃƒÂ³n Maximizar / Reducir en Seguimiento (pantalla completa; Esc o clic).
 - Esc global cierra fullscreen, lightbox, llamada entrante/privada y overlays `data-esc-close`.
- **Archivos / refs:** `GlobalEscapeClose.jsx`, `LiveTrackMap.jsx`, `ChatMedia.jsx`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`

## 2026-08-22 Ã¢â‚¬â€ Seguimiento: ubicaciones se refrescan solas (~5 s)

- **Tipo:** mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Seguimiento / Mapa / Consola refrescan GPS y rastro automÃƒÂ¡ticamente al ritmo del latido (5 s).
 - Merge socket+poll sin pisar fixes mÃƒÂ¡s nuevos; rejoin al reconectar; refresh al volver a la pestaÃƒÂ±a.
- **Archivos / refs:** `web/src/dispatch/liveTiming.js`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 Ã¢â‚¬â€ Radio, mensajes y GPS con pantalla bloqueada

- **Tipo:** feature
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Servicio en primer plano incluye `location` ademÃƒÂ¡s de micrÃƒÂ³fono/reproducciÃƒÂ³n.
 - SesiÃƒÂ³n de audio (voice) para seguir oyendo el canal bloqueado.
 - GPS pide ubicaciÃƒÂ³n Ã¢â‚¬Å“siempreÃ¢â‚¬Â; stream iOS con background updates.
 - FCM en background muestra aviso local si el push es solo `data`.
- **Por quÃƒÂ© / notas:** Mantener el aviso persistente Ã¢â‚¬Å“TacticalPtx activoÃ¢â‚¬Â; aceptar ubicaciÃƒÂ³n siempre y no optimizar baterÃƒÂ­a.
- **Archivos / refs:** `background_radio.dart`, `location_heartbeat.dart`, `audio_session_setup.dart`, `AndroidManifest.xml`, `Info.plist`, `push_service.dart`

## 2026-08-22 Ã¢â‚¬â€ Icono de perfil (estilo WhatsApp en seguimiento)

- **Tipo:** feature
- **ÃƒÂrea:** mobile | backend | web
- **QuÃƒÂ©:**
 - El usuario cambia su foto en la app (perfil Ã¢â€ â€™ galerÃƒÂ­a/cÃƒÂ¡mara).
 - El icono se muestra en Seguimiento web como bolita con foto (WhatsApp).
- **Archivos / refs:** `backend/src/routes/me.js`, `locations.js`, `auth.js`, `LiveTrackMap.jsx`, `radio_shell.dart`, `api_client.dart`

---
## 2026-08-22 Ã¢â‚¬â€ UI mÃƒÂ¡s suave (radios e iconos)

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Quitados bordes cuadrados agresivos; login, botones, paneles, menÃƒÂº e iconos con radio suave y Ã¢â‚¬Å“pozosÃ¢â‚¬Â redondeados para iconos.
- **Archivos / refs:** `web/src/institutional.css`, `mobile/lib/theme.dart`, `mobile/lib/screens/login_screen.dart`

---
## 2026-08-22 Ã¢â‚¬â€ Mensajes de error en espaÃƒÂ±ol

- **Tipo:** ux | fix
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** TraducciÃƒÂ³n de errores tÃƒÂ©cnicos del navegador/LiveKit/red (`Permission denied`, etc.) a espaÃƒÂ±ol claro; Offline Ã¢â€ â€™ Fuera de lÃƒÂ­nea.
- **Archivos / refs:** `web/src/esMsg.js`, `usePtt.js`, `api.js`, `RadioPage.jsx`, `mobile/lib/es_msg.dart`

---
## 2026-08-22 Ã¢â‚¬â€ Radio mantiene menÃƒÂº de despacho

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Radio pasa a `/despacho/radio` dentro del layout; el rail no desaparece. PTT compartido (sin doble LiveKit). Operadores sin despacho siguen en `/radio`.
- **Archivos / refs:** `App.jsx`, `DispatchLayout.jsx`, `RadioPage.jsx`, `styles.css`

---
## 2026-08-22 Ã¢â‚¬â€ Plan escalonado 1Ã¢â€ â€™4 (validaciÃƒÂ³n Ã‚Â· Git Ã‚Â· APK Ã‚Â· deploy)

- **Tipo:** ops | docs
- **ÃƒÂrea:** ops | docs | mobile
- **QuÃƒÂ©:**
 - EscalÃƒÂ³n 1: PC/API/web OK; checklist Pedro actualizado (voz/GPS pendientes humano).
 - EscalÃƒÂ³n 2: `git init` + commit `027fb0d` (287 archivos, sin secretos).
 - EscalÃƒÂ³n 3: rebuild APK 1.8.1+5 en curso/pendiente salida.
 - EscalÃƒÂ³n 4: Docker/Play documentados, **no** ejecutados aÃƒÂºn.
- **Archivos / refs:** `VALIDACION_CAMPO_1_8_0.md`, `PLAN_ESCALONADO_1_8.md`, `.gitignore`, `docs/DOCKER_PROD.md`, `docs/PLAY_STORE.md`

---
## 2026-08-22 Ã¢â‚¬â€ Iconos en menÃƒÂº de mÃƒÂ³dulos

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Iconos SVG en Operaciones, Seguimiento, Mapa, CatÃƒÂ¡logos (y sub), Radio y Salir; visibles tambiÃƒÂ©n en modo miniatura.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 Ã¢â‚¬â€ MenÃƒÂº miniatura con sola flecha (sin montajes)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - MenÃƒÂº en flujo flex (ya no overlay): el mapa/consola no se montan encima.
 - Solo flecha para contraer/expandir; al contraer queda barra miniatura (OP/SEG/MAPÃ¢â‚¬Â¦).
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `command-center.css`

---
## 2026-08-22 Ã¢â‚¬â€ MenÃƒÂº mÃƒÂ³dulos con flecha acordeÃƒÂ³n

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - PestaÃƒÂ±a lateral con flecha para ocultar/mostrar el menÃƒÂº (sin desplazar el contenido).
 - Flecha tambiÃƒÂ©n en topbar y en CatÃƒÂ¡logos (acordeÃƒÂ³n).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 Ã¢â‚¬â€ Mapa en vivo a pantalla completa equilibrada

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Quitado el tope de 1200px; toolbar en rejilla equitativa; mapa ocupa el alto restante.
 - KPIs alineados a la derecha del encabezado; sin franjas vacÃƒÂ­as laterales.
- **Archivos / refs:** `web/src/dispatch/DispatchMap.jsx`, `command-center.css`, `dispatch.css`

---
## 2026-08-22 Ã¢â‚¬â€ MenÃƒÂº despacho a la izquierda (ocultable)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Rail de mÃƒÂ³dulos a la **izquierda**, como overlay (el mapa/consola no se desplaza al ocultar).
 - BotÃƒÂ³n **MenÃƒÂº / Ocultar** en la topbar; se recuerda en `localStorage`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 Ã¢â‚¬â€ Acceso directo sin Tailscale

- **Tipo:** infra | docs
- **ÃƒÂrea:** ops | mobile
- **QuÃƒÂ©:**
 - GuÃƒÂ­a IP pÃƒÂºblica + reenvÃƒÂ­o de puertos (4G sin Tailscale ni dominio).
 - Script `infra/EXPOSE-PUBLIC.ps1` (firewall + detecciÃƒÂ³n IP).
 - Build APK ya **no** fuerza Tailscale; LAN por defecto; `API_BASE` / `FORCE_TAILSCALE=1` opcionales.
- **Archivos / refs:** `Soporte/Documentos/ACCESO_DIRECTO_SIN_TAILSCALE.md`, `infra/EXPOSE-PUBLIC.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-22 Ã¢â‚¬â€ APK mÃƒÂ¡s robusta (cifrado, datos, UI)

- **Tipo:** security | ux | mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Tokens JWT en **Flutter Secure Storage** (migraciÃƒÂ³n desde SharedPreferences).
 - HTTP con timeout 18 s y cabecera de cliente; login limpia contraseÃƒÂ±a en memoria.
 - Tema institucional oliva/oro (claro, plano); login y radio mÃƒÂ¡s presentables.
 - E2EE LiveKit ya cableado; versiÃƒÂ³n **1.8.1+5**.
- **Archivos / refs:** `mobile/lib/secure_store.dart`, `api_client.dart`, `theme.dart`, `screens/login_screen.dart`, `pubspec.yaml`

---
## 2026-08-22 Ã¢â‚¬â€ Cifrado reforzado voz + texto

- **Tipo:** security
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
 - Chat/DM: cuerpos con **AES-256-GCM** en base de datos (`CONTENT_ENCRYPTION_KEY`); mensajes viejos en claro siguen legibles.
 - Voz PTT y llamadas: **E2EE LiveKit** por room (`LIVEKIT_E2EE_SECRET` + `e2eeKey` al cliente), encima de DTLS-SRTP.
- **Por quÃƒÂ© / notas:** Reiniciar API tras aÃƒÂ±adir secretos en `.env`. Clientes web/APK deben actualizarse para E2EE de voz.
- **Archivos / refs:** `backend/src/services/contentCrypto.js`, `voiceE2ee.js`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`

---
## 2026-08-22 Ã¢â‚¬â€ Seguimiento estilo WhatsApp (bolitas en vivo)

- **Tipo:** feature | ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
 - Mapa de seguimiento con bolitas tipo Live Location (pulso, nombre, deslizamiento suave).
 - Rastro permanente que se actualiza por socket; opciÃƒÂ³n Ã¢â‚¬Å“SeguirÃ¢â‚¬Â al operador seleccionado.
 - GPS mÃƒÂ³vil por stream continuo (+ latido) para actualizar de forma permanente.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `command-center.css`, `mobile/lib/location_heartbeat.dart`, `useGpsReporter.js`

---
## 2026-08-22 Ã¢â‚¬â€ Chat limpio (sin iconos sobre burbujas)

- **Tipo:** ux | fix
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:**
 - Web: menÃƒÂº `Ã¢â€¹Â¯` al lado de la burbuja (no encima del texto); toast DM elevado sobre el compositor.
 - MÃƒÂ³vil: ancho mÃƒÂ¡ximo en DM, clip en burbujas, audio flexible, ticks alineados a la derecha.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart`

---
## 2026-08-22 Ã¢â‚¬â€ Sin notificaciones en cada PTT

- **Tipo:** fix | ux
- **ÃƒÂrea:** mobile | backend
- **QuÃƒÂ©:**
 - El backend ya no envÃƒÂ­a FCM al otorgar el floor PTT.
 - La APK no muestra notificaciÃƒÂ³n local al oÃƒÂ­r a alguien al aire (solo mensajes y llamadas).
- **Por quÃƒÂ© / notas:** Evitar spam de notificaciones en cada transmisiÃƒÂ³n de radio.
- **Archivos / refs:** `backend/src/socket/ptt.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`

---
## 2026-08-22 Ã¢â‚¬â€ UI institucional estilo Reclutamiento

- **Tipo:** ux | mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Tema oliva `#243d20` + oro `#9a7b2f`, tipografÃƒÂ­a Oswald + Source Sans 3, paneles planos.
 - Despacho: topbar clara + rail derecho de mÃƒÂ³dulos (como Reclutamiento IV R.M.).
 - Login, Radio y consola alineados al mismo sistema; tema por defecto claro.
- **Por quÃƒÂ© / notas:** Unificar look institucional con el resto de sistemas de la dependencia.
- **Archivos / refs:** `web/src/institutional.css`, `web/src/dispatch/DispatchLayout.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`, `web/index.html`

---
## 2026-08-22 Ã¢â‚¬â€ RevisiÃƒÂ³n completa 1.8.0

- **Tipo:** docs | otro
- **ÃƒÂrea:** docs | ops
- **QuÃƒÂ©:**
 - AuditorÃƒÂ­a de stack, features, riesgos y huecos (iOS, Docker prod, Git, Play Store).
 - Health API OK (db/redis/livekit/fcm). UbicaciÃƒÂ³n ÃƒÂºnica D:\pulsanet verificada.
 - Ajustes menores: texto GPS 5 s; limpieza de archivos basura en raÃƒÂ­z (`start`, `query`, `favicon.ico/`).
- **Archivos / refs:** canvas revisiÃƒÂ³n, `docs/UBICACION_PROYECTO.md`, `mobile/lib/screens/radio_shell.dart`

---
## 2026-08-22 Ã¢â‚¬â€ UbicaciÃƒÂ³n ÃƒÂºnica D:\pulsanet

- **Tipo:** infra | docs
- **ÃƒÂrea:** ops | docs
- **QuÃƒÂ©:**
 - Todo el proyecto queda bajo `D:\pulsanet` (cÃƒÂ³digo + `Soporte\`).
 - `D:\Soporte` es uniÃƒÂ³n Ã¢â€ â€™ `D:\pulsanet\Soporte` (compat Firebase/bitÃƒÂ¡cora).
 - Logos movidos a `Soporte\Brand\`; doc `docs/UBICACION_PROYECTO.md`.
- **Archivos / refs:** `Soporte\`, `.env` (`FIREBASE_SERVICE_ACCOUNT`), `.cursor/rules/documentar-cambios.mdc`, `README.md`

---
## 2026-08-22 Ã¢â‚¬â€ Release 1.8.0 (escalonado)

- **Tipo:** otro | infra | docs
- **ÃƒÂrea:** mobile | infra | docs | web | backend
- **QuÃƒÂ©:**
 - Etapa 1: APK mÃƒÂ³vil **1.8.0+4** (GPS 5 s + fixes radio) vÃƒÂ­a `BUILD-APK-WHATSAPP.cmd`.
 - Etapa 2: LiveKit ICE dual WiÃ¢â‚¬â€˜Fi + Tailscale; `LIVEKIT_PUBLIC_URL` vacÃƒÂ­o; reinicio con `taskkill`.
 - Etapa 3: Changelog cerrado como **[1.8.0]**; API/web `1.8.0`.
 - Etapa 4: Checklist de campo en `Soporte\Documentos\VALIDACION_CAMPO_1_8_0.md`.
- **Por quÃƒÂ© / notas:** Si LiveKit no reinicia, ejecutar `LEVANTAR-TACTICALPTX.bat` como Administrador.
- **Archivos / refs:** `mobile/pubspec.yaml`, `infra/start-services.ps1`, `docs/CHANGELOG.md`, `backend/src/version.js`

---
## 2026-08-22 Ã¢â‚¬â€ RediseÃƒÂ±o despacho: menÃƒÂº izquierdo, catÃƒÂ¡logos y seguimiento

- **Tipo:** ux | feature
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Shell de despacho con menÃƒÂº lateral (Operaciones, Seguimiento, Mapa en vivo, CatÃƒÂ¡logos, Radio).
 - Nueva vista Seguimiento estilo WhatsApp (lista de operadores + mapa en tiempo real, capas Natural/SatÃƒÂ©lite/Claro).
 - CatÃƒÂ¡logos: Usuarios, Grupos y Geocercas bajo `/despacho/catalogos/Ã¢â‚¬Â¦`.
 - Mapa operativo con selector de capas naturales.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `LiveTrackMap.jsx`, `CatalogsLayout.jsx`, `GeofenceCatalog.jsx`, `App.jsx`, `command-center.css`

---
## 2026-08-18 Ã¢â‚¬â€ CorrecciÃƒÂ³n LiveKit duplicado en Consola

- **Tipo:** fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:**
 - La escucha extra de canales usaba la misma identidad LiveKit que el PTT y se expulsaban mutuamente (error de participante duplicado / audio cortado).
 - La escucha extra ahora entra como `:listen:` (solo oÃƒÂ­r) y espera a que el dock tenga canal.
- **Archivos / refs:** `backend/src/routes/livekit.js`, `web/src/useDispatchListen.js`, `web/src/api.js`

---
## 2026-08-18 Ã¢â‚¬â€ Voz PTT de otro canal no llegaba a Consola

- **Tipo:** fix
- **ÃƒÂrea:** web | backend | infra
- **QuÃƒÂ©:**
 - Pedro Sanchez Torres solo estÃƒÂ¡ en Ã‚Â«Jfa. T.I.C.Ã‚Â»; el altavoz de Consola sintonizaba Ã‚Â«GeneralÃ‚Â» (otro LiveKit) y el PTT Ã‚Â«al aireÃ‚Â» no llevaba audio.
 - Despacho ahora escucha LiveKit de todos los canales; el selector es el canal por el que habla el despachador.
 - LiveKit URL sigue al host de la API (LAN o Tailscale); ICE ya no se fuerza solo a 100.x.
- **Por quÃƒÂ© / notas:** El floor PTT (socket) es independiente del audio (LiveKit, un room por grupo).
- **Archivos / refs:** `web/src/useDispatchListen.js`, `web/src/dispatch/DispatchLayout.jsx`, `backend/src/services/livekit.js`, `infra/start-services.ps1`

---
## 2026-08-18 Ã¢â‚¬â€ GPS en consola y envÃƒÂ­o cada 5 s

- **Tipo:** fix | mejora
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
 - El mapa decÃƒÂ­a Ã‚Â«aÃƒÂºn no hay GPSÃ‚Â» con todo en ceros: si fallaba el listado de grabaciones (p. ej. cuenta **root**), se vaciaba tambiÃƒÂ©n canales y ubicaciones.
 - `root` ahora entra al socket de despacho y puede listar grabaciones.
 - GPS se envÃƒÂ­a cada **5 s** (antes ~20 s) desde la app al abrirla, Radio web y Consola.
- **Por quÃƒÂ© / notas:** Ã‚Â«En lÃƒÂ­neaÃ‚Â» es presencia PTT (radio), no GPS. El chat no publica coordenadas. 1 s drenarÃƒÂ­a baterÃƒÂ­a; se dejÃƒÂ³ 5 s.
- **Archivos / refs:** `backend/src/routes/recordings.js`, `backend/src/socket/dispatch.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/useGpsReporter.js`, `mobile/lib/location_heartbeat.dart`

---
## 2026-08-18 Ã¢â‚¬â€ Pruebas 4G/5G con Tailscale

- **Tipo:** infra
- **ÃƒÂrea:** infra | mobile | ops
- **QuÃƒÂ©:**
 - Tailscale en la PC (`100.127.12.44`); LiveKit anuncia esa IP para ICE.
 - APK de WhatsApp usa `API_BASE` Tailscale si `tailscale ip -4` existe.
 - GuÃƒÂ­a: `D:\Soporte\Documentos\TACTICALPTX_4G_TAILSCALE.md`
- **Por quÃƒÂ© / notas:** Desde datos mÃƒÂ³viles no se alcanza `192.168.1.66`. El celular debe instalar Tailscale con la misma cuenta.
- **Archivos / refs:** `infra/start-services.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`, `backend/.env` (`LIVEKIT_PUBLIC_URL`)

---
## 2026-08-18 Ã¢â‚¬â€ Mic flotante tapaba el chat mÃƒÂ³vil

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** El FAB de Radio (micrÃƒÂ³fono) se superponÃƒÂ­a al cuadro Ã‚Â«MensajeÃ¢â‚¬Â¦Ã‚Â». En Chat y Directos ya no se muestra; se vuelve a Radio con la flecha atrÃƒÂ¡s.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

---
## 2026-08-18 Ã¢â‚¬â€ Radio en vivo en Consola / despacho

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** El audio PTT sigue sonando en Consola, Mapa, Usuarios y Grupos. Barra de canal + **Silenciada / En altavoz**.
- **Por quÃƒÂ© / notas:** Antes solo habÃƒÂ­a LiveKit en `/radio`; al entrar a Consola se cortaba.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/usePtt.js`, `web/src/dispatch/command-center.css`

---
## 2026-08-17 Ã¢â‚¬â€ Icono APK TacticalPtx

- **Tipo:** ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Icono launcher Android sustituido por el logo TacticalPtx (mipmaps + adaptive icon fondo negro). Splash de arranque en negro.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/android/app/src/main/res/mipmap-*`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-17 Ã¢â‚¬â€ BAT de arranque reparado

- **Tipo:** ops
- **ÃƒÂrea:** infra | ops
- **QuÃƒÂ©:**
 - `LEVANTAR-TACTICALPTX.bat` no arrancaba bien: PowerShell se colgaba en `Get-NetIPAddress`/firewall; la web iba a `:5174` o no escuchaba; `curl`/`start` poco fiables.
 - `start-services.ps1` ahora usa `ipconfig` (rÃƒÂ¡pido) y no reinicia LiveKit si ya corre.
 - API/Web se lanzan con `infra/start-api.cmd` y `infra/start-web.cmd` (PATH de Node + Vite en `0.0.0.0:5173`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`, `infra/start-api.cmd`, `infra/start-web.cmd`

---
## 2026-08-17 Ã¢â‚¬â€ Error 500: Postgres deshabilitado / API caÃƒÂ­da

- **Tipo:** ops
- **ÃƒÂrea:** infra | backend
- **QuÃƒÂ©:**
 - PostgreSQL `postgresql-x64-17` estaba **Disabled/Stopped**; la API no escuchaba en :4000 (la web Vite devolvÃƒÂ­a 500 al proxy).
 - Servicio habilitado y arrancado; Redis/LiveKit/API de nuevo con health `ready` y `fcm: configured`.
 - `LEVANTAR-TACTICALPTX.bat` ahora re-habilita el servicio Postgres si viene Disabled.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`

---
## 2026-08-17 Ã¢â‚¬â€ Limpieza de BAT/CMD

- **Tipo:** ops
- **ÃƒÂrea:** ops | mobile
- **QuÃƒÂ©:**
 - Se dejan: `LEVANTAR-TACTICALPTX.bat` (stack local) y `mobile/scripts/BUILD-APK-WHATSAPP.cmd` (APK).
 - Se borra el alias `LEVANTAR-TACTICALPTX.bat` y los lanzadores duplicados de Shorebird/diagnÃƒÂ³stico (nunca hubo `shorebird.yaml`).
- **Por quÃƒÂ© / notas:** HabÃƒÂ­a varios `.cmd` equivalentes (instalar Shorebird 2 veces, setup, parche, diagnÃƒÂ³stico, reparar PowerShell) y logs temporales.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-13 Ã¢â‚¬â€ Firebase FCM activado (proyecto tacticalptx)

- **Tipo:** infra
- **ÃƒÂrea:** backend | mobile | ops
- **QuÃƒÂ©:**
 - Proyecto Firebase `tacticalptx` + app Android `com.tacticalptx.app`
 - `google-services.json` en `mobile/android/app/`
 - Service account en Soporte; `FIREBASE_SERVICE_ACCOUNT` en `backend/.env`
 - API health: `"fcm":"configured"`
- **Por quÃƒÂ© / notas:** Login CLI fallÃƒÂ³; configuraciÃƒÂ³n vÃƒÂ­a Consola. Credenciales fuera de git.
- **Archivos / refs:** `backend/.env`, `mobile/android/app/google-services.json`, `D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json`, `docs/FCM_PUSH.md`

---
## 2026-08-12 Ã¢â‚¬â€ Lightbox imÃƒÂ¡genes chat mÃƒÂ³vil

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Pulsar una imagen del chat grupal la abre a pantalla completa (zoom con pellizco, cerrar con X o atrÃƒÂ¡s).
- **Archivos / refs:** `mobile/lib/screens/chat_panel.dart`

---
## 2026-08-12 Ã¢â‚¬â€ Plan UI PTT Radio verificado

- **Tipo:** mejora
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Confirmado plan Ã¢â‚¬Å“UI mÃƒÂ³vil estilo PTT RadioÃ¢â‚¬Â: theme azul, `RadioShell` home, `RadioScreen` READY/mic, `ChatPanel`, atajos Chat/GPS/CÃƒÂ¡mara/Directos/Grupos. Pulido: nombre de canal en chat, nav con return explÃƒÂ­cito, `GroupsScreen` legacy al theme.
- **Archivos / refs:** `theme.dart`, `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `groups_screen.dart`, `main.dart`

---
## 2026-08-12 Ã¢â‚¬â€ Prioridad en segundo plano (radio/mensajes/llamadas)

- **Tipo:** feature
- **ÃƒÂrea:** mobile | web | backend
- **QuÃƒÂ©:**
 - Android: foreground service (`microphone|mediaPlayback`) + wake/wifi lock + pedir ignorar optimizaciÃƒÂ³n de baterÃƒÂ­a; notificaciÃƒÂ³n persistente Ã¢â‚¬Å“Radio activaÃ¢â‚¬Â.
 - MÃƒÂ³vil: avisos locales de chat/PTT/DM/llamada con app minimizada o pantalla bloqueada.
 - Web: keepalive de audio + Media Session + notificaciones del navegador si la pestaÃƒÂ±a estÃƒÂ¡ oculta.
 - FCM: canal de llamadas `tacticalptx_calls` con prioridad mÃƒÂ¡xima.
- **Archivos / refs:** `background_radio.dart`, `AndroidManifest.xml`, `radio_shell.dart`, `channel_session.dart`, `backgroundKeepalive.js`, `RadioPage.jsx`, `usePtt.js`, `fcm.js`

---
## 2026-08-12 Ã¢â‚¬â€ Rebrand total TacticalPtx + APK

- **Tipo:** feature
- **ÃƒÂrea:** web | mobile | backend | ops
- **QuÃƒÂ©:**
 - Identificadores visibles e internos a **TacticalPtx** (`com.tacticalptx.app`, claves `tacticalptx_*`, API `tacticalptx-api`, emails `@tacticalptx.local`).
 - Script `LEVANTAR-TACTICALPTX.bat`.
 - APK release con marca nueva (~88.3 MB): `mobile/build/app/outputs/flutter-apk/app-release.apk`
- **Por quÃƒÂ© / notas:** Carpeta de trabajo `D:\pulsanet` y BD `tacticalptx_db` se mantienen (rutas/datos); el producto se llama TacticalPtx. Package Android nuevo: hay que **desinstalar** la app anterior `com.tacticalptx.*` e instalar esta.
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`, `main.dart`, `BrandName.jsx`, `LEVANTAR-TACTICALPTX.bat`

---
## 2026-08-12 Ã¢â‚¬â€ Rebrand TacticalPtx + paleta tÃƒÂ¡ctica

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile | backend
- **QuÃƒÂ©:**
 - Marca visible **TacticalPtx** (logo + wordmark plata/rojo).
 - Paleta negro / rojo / ÃƒÂ¡mbar-dorado segÃƒÂºn logo; tema oscuro por defecto en web.
 - App Android: label, login con logo, tema dark tÃƒÂ¡ctico.
- **Por quÃƒÂ© / notas:** No se renombrÃƒÂ³ el repo ni el package `com.tacticalptx.*` (interno).
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `BrandName.jsx`, `styles.css`, `theme.dart`, `login_screen.dart`

---
## 2026-08-12 Ã¢â‚¬â€ RevisiÃƒÂ³n: rollback mensaje optimista

- **Tipo:** fix
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Si `chat:error` / `dm:error`, se elimina el mensaje local pendiente (`clientMsgId`).
- **Archivos / refs:** `usePtt.js`, `DirectChat.jsx`, `socket/chat.js`, `socket/dm.js`

---
## 2026-08-12 Ã¢â‚¬â€ EnvÃƒÂ­o de mensajes mÃƒÂ¡s rÃƒÂ¡pido

- **Tipo:** fix
- **ÃƒÂrea:** backend | web
- **QuÃƒÂ©:**
 - Tras INSERT ya no se consultan reacciones/lecturas (inÃƒÂºtiles en mensaje nuevo).
 - Nombre del emisor desde el token/socket (sin SELECT extra).
 - UI optimista en chat grupal y DM (aparece al instante; se confirma por socket).
- **Por quÃƒÂ© / notas:** `hydrateMessage` hacÃƒÂ­a 3Ã¢â‚¬â€œ4 queries (incl. COUNT de lecturas) por cada envÃƒÂ­o.
- **Archivos / refs:** `socket/chat.js`, `services/dm.js`, `socket/dm.js`, `usePtt.js`, `DirectChat.jsx`

---
## 2026-08-12 Ã¢â‚¬â€ Vista Radio web reorganizada

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Radio en un solo layout: franja superior con canal/online + **PTT a la derecha**, abajo chat grupal (izq) y Directos (der). Sin pestaÃƒÂ±as Canal/Directos.
- **Archivos / refs:** `RadioPage.jsx`, `DirectChat.jsx` (`embedded`), `styles.css`

---
## 2026-08-12 Ã¢â‚¬â€ APK UI llamada estilo WhatsApp

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Build release `app-release.apk` (~87.8 MB) con UI de llamada entrante fullscreen + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 Ã¢â‚¬â€ UI llamada entrante estilo WhatsApp

- **Tipo:** ux
- **ÃƒÂrea:** web | mobile
- **QuÃƒÂ©:** Llamada entrante a pantalla completa (avatar, anillos, Contestar verde / Rechazar rojo); en llamada con el mismo look.
- **Archivos / refs:** `incoming_call_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `styles.css`

---
## 2026-08-12 Ã¢â‚¬â€ APK con notificaciones DM/llamadas

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Build release `app-release.apk` (~87.8 MB) con avisos DM/llamada + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 Ã¢â‚¬â€ Notificaciones DM y llamadas

- **Tipo:** mejora
- **ÃƒÂrea:** web | mobile | backend
- **QuÃƒÂ©:**
 - Web: tono + Notification del navegador + toast al recibir DM; ringtone en llamada privada.
 - MÃƒÂ³vil: SnackBar + badge Directos + notificaciÃƒÂ³n local por socket (independiente de FCM).
 - Backend: FCM tambiÃƒÂ©n en `dm:send` por socket y en sticker/media DM.
- **Por quÃƒÂ© / notas:** FCM suele estar `off` sin Firebase; con la app abierta las seÃƒÂ±ales socket ahora avisan. Push en background sigue requiriendo configurar Firebase.
- **Archivos / refs:** `web/src/appNotify.js`, `DirectChat.jsx`, `RadioPage.jsx`, `mobile/lib/push_service.dart`, `channel_session.dart`, `radio_shell.dart`, `backend/src/socket/dm.js`, `routes/dm.js`

---
## 2026-08-12 Ã¢â‚¬â€ UI Directos reorganizada

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Pantalla Directos con avatares, roles en espaÃƒÂ±ol, chat a altura completa, burbujas y vacÃƒÂ­os claros; contactos sin duplicar recientes.
- **Archivos / refs:** `DirectChat.jsx`, `styles.css`

---
## 2026-08-12 Ã¢â‚¬â€ APK con fix llamadas privadas

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Build release `app-release.apk` (~87.8 MB) con `API_BASE=http://192.168.1.66:4000` (incluye fix LiveKit LAN + seÃƒÂ±al de llamada global).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 Ã¢â‚¬â€ Fix llamadas privadas

- **Tipo:** fix
- **ÃƒÂrea:** backend | web | mobile
- **QuÃƒÂ©:**
 - URL LiveKit pÃƒÂºblica segÃƒÂºn host del cliente (no `127.0.0.1` en mÃƒÂ³vil).
 - Web: DirectChat permanece montado para recibir `call:incoming` fuera de la pestaÃƒÂ±a.
 - MÃƒÂ³vil: seÃƒÂ±al de llamada en `ChannelSession` + diÃƒÂ¡logo global; PrivateCall usa host LAN.
- **Archivos / refs:** `livekit.js`, `calls.js`, `RadioPage.jsx`, `PrivateCallOverlay.jsx`, `channel_session.dart`, `radio_shell.dart`, `direct_pane.dart`

---
## 2026-08-12 Ã¢â‚¬â€ 5 usuarios de prueba

- **Tipo:** ops
- **ÃƒÂrea:** backend | database
- **QuÃƒÂ©:** Creados 5 usuarios de prueba (4 operadores + 1 despacho) en canal General, con contraseÃƒÂ±a temporal y cambio obligatorio en 1er ingreso.
- **Archivos / refs:** `create-test-users.js` Ã¢â‚¬â€ usuarios: `jramirezl2`, `mhernandezg2`, `psanchezt2`, `amartinezr2`, `lfernandezd2`

---
## 2026-08-12 Ã¢â‚¬â€ Usuario estilo ggomezd2 (no RFC)

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile | docs
- **QuÃƒÂ©:**
 - GeneraciÃƒÂ³n de usuario: inicial nombre + apellido paterno + inicial materno + nÃƒÂºmero desde 2 (ej. `ggomezd2`).
 - Se omite fecha de nacimiento / formato RFC.
 - Login en minÃƒÂºsculas; migrado `GODG900516` Ã¢â€ â€™ `ggomezd2`.
- **Archivos / refs:** `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `migrate-usernames-style.js`

---
## 2026-08-12 Ã¢â‚¬â€ APK Android actualizaciÃƒÂ³n

- **Tipo:** ops
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Build release `app-release.apk` (~87.7 MB) con `API_BASE=http://192.168.1.66:4000` (incluye login RFC, cambio de clave, radio PTT, etc.).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 Ã¢â‚¬â€ Limpieza usuarios demo/prueba

- **Tipo:** ops
- **ÃƒÂrea:** backend | database | docs
- **QuÃƒÂ©:**
 - Purgados 90 usuarios demo/loadtest de la BD (`npm run seed:purge-demo`).
 - Seed pasa a bootstrap mÃƒÂ­nimo: 1 root + canal General (sin operadores de prueba).
 - Manual sin cuentas demo; `seed:load` requiere `ALLOW_LOAD_SEED=1`.
- **Archivos / refs:** `purge-demo-users.js`, `seed.js`, `seed-load.js`, `MANUAL_USUARIO.md`

---
## 2026-08-12 Ã¢â‚¬â€ ContraseÃƒÂ±a temporal + cambio en 1er ingreso

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile | database
- **QuÃƒÂ©:**
 - Al crear/restablecer usuario se genera contraseÃƒÂ±a temporal (se muestra una vez al admin).
 - Flag `must_change_password`; en el primer login web/mÃƒÂ³vil obliga a cambiarla (mÃƒÂ­n. 8, letras y nÃƒÂºmeros).
- **Archivos / refs:** `tempPassword.js`, `auth.js`, `admin.js`, `App.jsx`, `DispatchUsers.jsx`, `change_password_screen.dart`, `013_must_change_password.sql`

---
## 2026-08-12 Ã¢â‚¬â€ Alta usuario: paso de grupos

- **Tipo:** feature
- **ÃƒÂrea:** web | backend
- **QuÃƒÂ©:** Tras los datos del alta, paso 2 para elegir grupos; sugiere Ã‚Â«GeneralÃ‚Â». API acepta `groupIds` al crear usuario.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `command-center.css`

---
## 2026-08-12 Ã¢â‚¬â€ Login por usuario tipo RFC

- **Tipo:** feature
- **ÃƒÂrea:** backend | web | mobile | database
- **QuÃƒÂ©:**
 - Login con **usuario + contraseÃƒÂ±a** (ya no correo).
 - Usuario generado tipo RFC: 4 letras (apellidos/nombre) + fecha YYMMDD.
 - Alta en despacho pide nombre(s), apellidos y fecha; previsualiza el usuario.
 - MigraciÃƒÂ³n `012_user_username.sql`; seed demo con cuentas RFC.
- **Archivos / refs:** `rfcUsername.js`, `auth.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `seed.js`

---
## 2026-08-12 Ã¢â‚¬â€ Icono marca consola despacho

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Sustituido el marcador vacÃƒÂ­o por SVG micrÃƒÂ³fono + ondas (marca TacticalPtx) en la cabecera del centro de operaciones.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`

---
## 2026-08-12 Ã¢â‚¬â€ Consola admin mÃƒÂ¡s profesional (sin demo)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - Centro de operaciones: cabecera, badges de rol, formularios/tablas pulidos.
 - Usuarios/Grupos con etiquetas en espaÃƒÂ±ol; sin contraseÃƒÂ±as ni textos demo.
 - Login sin cuentas de demostraciÃƒÂ³n; sesiÃƒÂ³n `tacticalptx_session`.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `App.jsx`

---
## 2026-08-12 Ã¢â‚¬â€ DM 1:1 + llamada privada

- **Tipo:** feature
- **ÃƒÂrea:** backend / web / mobile
- **QuÃƒÂ©:**
 - Chat directo entre usuarios de la misma org (`/api/dm`, sockets `dm:*`) ademÃƒÂ¡s de chat de grupo/canal.
 - Llamada privada 1:1 vÃƒÂ­a LiveKit (`/api/calls/private`, signaling `call:incoming|accepted|ended`).
 - Web Radio: pestaÃƒÂ±a **Directos / llamada**; mÃƒÂ³vil: ÃƒÂ­cono Directos en barra inferior.
- **Archivos / refs:** `services/dm.js`, `routes/dm.js`, `routes/calls.js`, `socket/dm.js`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `direct_pane.dart`

---
## 2026-08-12 Ã¢â‚¬â€ UI mÃƒÂ³vil estilo PTT Radio

- **Tipo:** ux
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Home post-login = `RadioShell`: READY / AL AIRE, mic anillo azul, selector de canales, pÃƒÂ¡nico lateral.
 - Barra inferior: Chat Ã‚Â· GPS Ã‚Â· CÃƒÂ¡mara Ã‚Â· Grabaciones (stub) Ã‚Â· Grupos/cuenta.
 - Tema blanco/azul (`theme.dart`); chat extraÃƒÂ­do a `chat_panel.dart`.
- **Archivos / refs:** `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `main.dart`, `theme.dart`

---
## 2026-08-12 Ã¢â‚¬â€ Chat: imÃƒÂ¡genes con vista previa (estilo WhatsApp)

- **Tipo:** ux / fix
- **ÃƒÂrea:** web / backend
- **QuÃƒÂ©:**
 - ClasificaciÃƒÂ³n de media por mime + extensiÃƒÂ³n (PNG/JPG ya no quedan como Ã¢â‚¬Å“archivoÃ¢â‚¬Â).
 - Vista previa inline + lightbox al clic (ampliar / Escape / cerrar).
 - Mensajes antiguos `type=file` que eran imagen se reclasificaron a `image`.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`, `uploads.js`, `messages.js`

---
## 2026-08-12 Ã¢â‚¬â€ Rol root (superadmin) permisos totales

- **Tipo:** feature / security
- **ÃƒÂrea:** backend / web / database
- **QuÃƒÂ©:**
 - Enum `user_role` + migraciÃƒÂ³n `011_role_root.sql`; helpers `services/roles.js`.
 - Root: CRUD usuarios (incl. delete/reset password), grupos (desactivar/hard delete), quitar miembros, purge chat; ve todos los grupos; modera mensajes sin ser miembro.
 - Seed + UI despacho: `root@tacticalptx.local` / `demo1234`.
- **Archivos / refs:** `admin.js`, `groups.js`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `api.js`, `seed.js`

---
## 2026-08-12 Ã¢â‚¬â€ BAT + stack local levantado

- **Tipo:** ops
- **ÃƒÂrea:** infra / ops
- **QuÃƒÂ©:**
 - Creado `LEVANTAR-TACTICALPTX.bat` (Postgres + Redis/LiveKit + API + Web).
 - Stack arrancado: PG Running, Redis, LiveKit (`node-ip=192.168.1.66`), API health OK.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`

---
## 2026-08-12 Ã¢â‚¬â€ Consola OK + APK release WhatsApp

- **Tipo:** ops
- **ÃƒÂrea:** mobile / ops
- **QuÃƒÂ©:**
 - Consola/PowerShell volviÃƒÂ³ a responder (`PS_OK`).
 - Build `flutter build apk --release` con `API_BASE=http://192.168.1.66:4000`.
 - APK lista: `mobile/build/app/outputs/flutter-apk/app-release.apk` (~87 MB).
- **Por quÃƒÂ© / notas:** Sin Shorebird OTA; para distribuir por WhatsApp. Si Cursor vuelve a colgar, usar `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.
- **Archivos / refs:** `app-release.apk`, `BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-12 Ã¢â‚¬â€ GuÃƒÂ­a: consola Windows colgada

- **Tipo:** docs / ops
- **ÃƒÂrea:** ops
- **QuÃƒÂ©:** DiagnÃƒÂ³stico cuando cmd/PowerShell/Cursor cuelgan; build APK por cmd o Android Studio; Shorebird solo si PS responde.
- **Archivos / refs:** `docs/CONSOLA_COLGADA.md`

---
## 2026-08-12 Ã¢â‚¬â€ Shorebird: flujo solo CMD (sin PowerShell)

- **Tipo:** infra / fix
- **ÃƒÂrea:** mobile / ops
- **QuÃƒÂ©:** Shorebird ya clonado en `%USERPROFILE%\.shorebird`. Scripts `INSTALAR-SHOREBIRD.cmd`, `SHOREBIRD-WHATSAPP.cmd`, `SHOREBIRD-PARCHE.cmd`, `DIAGNOSTICO.cmd` sin depender de PowerShell.
- **Archivos / refs:** `mobile/scripts/*.cmd`, `docs/SHOREBIRD_SIN_POWERSHELL.md`

---
## 2026-08-12 Ã¢â‚¬â€ Shorebird: instalador CMD sin UAC

- **Tipo:** fix / infra
- **ÃƒÂrea:** mobile / ops
- **QuÃƒÂ©:** Reescrito `install-shorebird-windows.cmd` (sin Admin anidado); PS1 con log; fallback ZIP si falla git.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.cmd`, `.ps1`, `shorebird-whatsapp-setup.cmd`

---
## 2026-08-12 Ã¢â‚¬â€ Shorebird: instalador anti-Defender

- **Tipo:** infra
- **ÃƒÂrea:** mobile / ops
- **QuÃƒÂ©:** Scripts Admin `install-shorebird-windows.ps1/.cmd` (exclusiones Defender + clone git). GuÃƒÂ­a WhatsApp actualizada.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.*`, `docs/SHOREBIRD_WHATSAPP.md`

---
## 2026-08-12 Ã¢â‚¬â€ Paridad chat Android (lote 1)

- **Tipo:** feature
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - Modelo de mensaje completo (reply, reactions, sticker, ticks, edit/delete).
 - Sockets: `chat:edited|deleted|reaction|receipts|typing` + APIs REST.
 - UI: responder, reacciones, stickers, editar/borrar, typing, ticks Ã¢Å“â€œ/Ã¢Å“â€œÃ¢Å“â€œ.
- **Pendiente:** notas de voz (grabar/reproducir) en mÃƒÂ³vil.
- **Archivos / refs:** `channel_session.dart`, `channel_screen.dart`, `api_client.dart`

---
## 2026-08-12 Ã¢â‚¬â€ Shorebird OTA + WhatsApp

- **Tipo:** infra / docs
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:**
 - GuÃƒÂ­a `docs/SHOREBIRD_WHATSAPP.md`: APK base por WhatsApp + parches OTA.
 - Scripts `mobile/scripts/shorebird-release-whatsapp.ps1` y `shorebird-patch.ps1`.
 - App: `shorebird_code_push` + aviso al tener parche listo.
- **Archivos / refs:** `SHOREBIRD_WHATSAPP.md`, `shorebird_update.dart`, `main.dart`, `pubspec.yaml`, scripts/

---
## 2026-08-11 Ã¢â‚¬â€ PTT: bajar latencia de voz

- **Tipo:** mejora
- **ÃƒÂrea:** web / mobile / backend / infra
- **QuÃƒÂ©:**
 - Mic se publica **muteado al entrar** al canal; al grant solo unmute.
 - `ptt:granted` se emite **antes** del INSERT en `ptt_sessions`.
 - RED desactivado; preset speech; NS off en mÃƒÂ³vil.
 - Mute no espera la subida de grabaciÃƒÂ³n; LiveKit `livekit.dev.yaml` + `--node-ip`.
- **Archivos / refs:** `usePtt.js`, `channel_session.dart`, `socket/ptt.js`, `infra/livekit.dev.yaml`, `start-services.ps1`

---
## 2026-08-11 Ã¢â‚¬â€ MÃƒÂ³vil: pÃƒÂ¡nico ya no tapa el chat

- **Tipo:** ux / fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Se quitÃƒÂ³ el FAB de pÃƒÂ¡nico que tapaba Enviar; el botÃƒÂ³n queda bajo el PTT (y el icono del AppBar).
- **Archivos / refs:** `mobile/lib/screens/channel_screen.dart`

---
## 2026-08-11 Ã¢â‚¬â€ Build Android: core library desugaring

- **Tipo:** fix
- **ÃƒÂrea:** mobile
- **QuÃƒÂ©:** Habilitado `coreLibraryDesugaring` en `android/app/build.gradle.kts` (requerido por `flutter_local_notifications`).
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`

---
## 2026-08-11 Ã¢â‚¬â€ PÃƒÂ¡nico: sirena hasta Enterado

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / mobile / backend
- **QuÃƒÂ©:**
 - Sirena en bucle hasta **Enterado** (Radio, Despacho) o **Resolver**.
 - Miembros del canal pueden hacer PATCH `acked`.
 - MÃƒÂ³vil: alarma periÃƒÂ³dica + diÃƒÂ¡logo hasta Enterado; se silencia tambiÃƒÂ©n si otro acusa.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`, `panic.js` (routes), `channel_session.dart`, `channel_screen.dart`, `V1_7_PANIC.md`

---
## 2026-08-11 Ã¢â‚¬â€ Mapa despacho: estilo Voyager (no black)

- **Tipo:** ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** TileLayer del mapa de unidades pasÃƒÂ³ de Carto `dark_all` a `voyager` (calles a color).
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---
## 2026-08-11 Ã¢â‚¬â€ Fix sirena de pÃƒÂ¡nico (no sonaba)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:**
 - El emisor ahora oye la sirena al confirmar pÃƒÂ¡nico (antes solo receptores).
 - Se quitÃƒÂ³ `window.confirm` (bloqueaba autoplay); confirmaciÃƒÂ³n por doble pulsaciÃƒÂ³n.
 - Audio mÃƒÂ¡s robusto: WAV HTMLAudio + Web Audio; unlock en cada gesto.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`

---
## 2026-08-11 Ã¢â‚¬â€ Fix pantalla en blanco al PTT (Radio)

- **Tipo:** fix
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Se restaurÃƒÂ³ `usePtt(...)` en `RadioPage` (se habÃƒÂ­a borrado al cablear audio de pÃƒÂ¡nico).
- **Archivos / refs:** `RadioPage.jsx`

---
## 2026-08-11 Ã¢â‚¬â€ Sonido al recibir pÃƒÂ¡nico

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / mobile
- **QuÃƒÂ©:** Sirena Web Audio en Radio/Despacho al `panic:alert`; en mÃƒÂ³vil SystemSound + vibraciÃƒÂ³n + diÃƒÂ¡logo.
- **Notas:** El navegador requiere un clic/PTT previo para permitir audio.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

---
## 2026-08-11 Ã¢â‚¬â€ Ticks de lectura (v1.7.1)

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend / database
- **QuÃƒÂ©:** Ã¢Å“â€œÃ¢Å“â€œ enviado Ã¢â€ â€™ leÃƒÂ­do (alguien del canal) Ã¢â€ â€™ azul si todos; mark-read al ver el chat.
- **Archivos / refs:** `010_message_reads.sql`, `chat.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_7_1_READ_RECEIPTS.md`

---
## 2026-08-11 Ã¢â‚¬â€ BotÃƒÂ³n de pÃƒÂ¡nico tambiÃƒÂ©n en Radio web

- **Tipo:** feature / ux
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** BotÃƒÂ³n rojo **PÃƒÂNICO** bajo el PTT en Radio web (misma API que mÃƒÂ³vil); confirma antes de enviar.
- **Archivos / refs:** `RadioPage.jsx`, `usePtt.js`, `styles.css`

---
## 2026-08-11 Ã¢â‚¬â€ BotÃƒÂ³n de pÃƒÂ¡nico (v1.7)

- **Tipo:** feature / security
- **ÃƒÂrea:** mobile / backend / web / database
- **QuÃƒÂ©:** SOS desde canal mÃƒÂ³vil Ã¢â€ â€™ grupo + admin/despacho + `canReceivePanic`; banner en consola; mensaje sistema en chat.
- **Archivos / refs:** `009_panic_button.sql`, `panic.js`, `channel_screen.dart`, `CommandCenter.jsx`, `V1_7_PANIC.md`

---
## 2026-08-11 Ã¢â‚¬â€ Stickers en chat (v1.6.1)

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend / database
- **QuÃƒÂ©:** Packs de stickers en Radio (botÃƒÂ³n Ã°Å¸Å½Â­); tipo `sticker`; catÃƒÂ¡logo API.
- **Archivos / refs:** `008_message_stickers.sql`, `stickers.js`, `chat.js`, `WhatsAppChat.jsx`, `V1_6_STICKERS.md`

---
## 2026-08-11 Ã¢â‚¬â€ Reacciones en mensajes (v1.6)

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend / database
- **QuÃƒÂ©:** Reacciones emoji en chat Radio (toggle una por usuario); chips con contador en vivo.
- **Archivos / refs:** `007_message_reactions.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_6_REACTIONS.md`

---
## 2026-08-11 Ã¢â‚¬â€ Calidad de voz menos Ã¢â‚¬Å“robÃƒÂ³ticaÃ¢â‚¬Â

- **Tipo:** fix / mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Notas de voz y PTT: Opus a 128 kbps, sin noiseSuppression agresivo, sampleRate 48 kHz; helper `voiceRecord.js`.
- **Por quÃƒÂ© / notas:** La NS + bitrate bajo deformaba formantes (voz metÃƒÂ¡lica/IA).
- **Archivos / refs:** `voiceRecord.js`, `WhatsAppChat.jsx`, `usePtt.js`

---
## 2026-08-11 Ã¢â‚¬â€ Reproductor de audio mÃƒÂ¡s presentable

- **Tipo:** ux / mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** RediseÃƒÂ±o del player de notas de voz: botÃƒÂ³n SVG play/pausa, forma de onda clicable, chip Ã¢â‚¬Å“AudioÃ¢â‚¬Â, tipografÃƒÂ­a de marca, sin pulso ni control nativo.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---
## 2026-08-11 Ã¢â‚¬â€ Reproductor de notas de voz en chat

- **Tipo:** ux / mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Sustituye el `<audio controls>` nativo por un player estilo nota de voz: botÃƒÂ³n play/pausa grande, onda + seek, duraciÃƒÂ³n; solo una nota suena a la vez.
- **Por quÃƒÂ© / notas:** El control nativo se veÃƒÂ­a desfasado y poco usable dentro de las burbujas.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---
## 2026-08-11 Ã¢â‚¬â€ Editar / eliminar mensajes (v1.5.1)

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend / database
- **QuÃƒÂ©:** MenÃƒÂº del mensaje (Ã¢â€¹Â¯ o clic derecho): Editar (solo texto) y Eliminar para autor, admin o despacho. Soft-delete para todos; etiqueta Ã¢â‚¬Å“editadoÃ¢â‚¬Â.
- **Por quÃƒÂ© / notas:** Completa el chat estilo WhatsApp con gestiÃƒÂ³n bÃƒÂ¡sica de mensajes.
- **Archivos / refs:** `006_message_edit_delete.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `api.js`

---
## 2026-08-11 Ã¢â‚¬â€ Chat estilo WhatsApp (v1.5)

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend / database
- **QuÃƒÂ©:** Chat Radio rediseÃƒÂ±ado: burbujas, hora, responder, buscar, emojis, foto/doc, notas de voz, Ã¢â‚¬Å“escribiendoÃ¢â‚¬Â¦Ã¢â‚¬Â, ticks enviados.
- **Notas:** No es clon completo (sin llamadas 1:1, ticks lectura, E2E, estados). Doc lÃƒÂ­mites en `V1_5_CHAT_WHATSAPP.md`.
- **Archivos:** `WhatsAppChat.jsx`, `chat.js`, `005_chat_whatsapp.sql`, `RadioPage.jsx`, `ChatMedia.jsx`

---
## 2026-08-11 Ã¢â‚¬â€ Sistema de documentaciÃƒÂ³n continua

- **Tipo:** docs / proceso
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** BitÃƒÂ¡cora + CHANGELOG + regla Cursor para documentar todo lo que se realice de aquÃƒÂ­ en adelante.
- **Archivos:** `BITACORA_DESARROLLO.md`, `CHANGELOG.md`, `.cursor/rules/documentar-cambios.mdc`

---
## 2026-08-11 Ã¢â‚¬â€ Informe desarrollo por mes

- **Tipo:** docs
- **ÃƒÂrea:** docs
- **QuÃƒÂ©:** Informe Mes 1Ã¢â‚¬â€œ6 + v1.1Ã¢â‚¬â€œv1.4 (entregas, anÃƒÂ¡lisis, pendientes).
- **Archivos:** `Documentos/INFORME_DESARROLLO_POR_MES.md`, `docs/INFORME_DESARROLLO_POR_MES.md`

---
## 2026-08-11 Ã¢â‚¬â€ Tema claro/oscuro + Radio mejorada

- **Tipo:** ux / mejora
- **ÃƒÂrea:** web
- **QuÃƒÂ©:** Toggle Claro/Oscuro (persistente) en Login, Radio y Despacho. Radio con tarjeta PTT y estados mÃƒÂ¡s claros.
- **Archivos:** `web/src/theme.jsx`, `styles.css`, `RadioPage.jsx`, `command-center.css`, `DispatchLayout.jsx`, `index.html`

---
## 2026-08-11 Ã¢â‚¬â€ GrabaciÃƒÂ³n PTT v1.4

- **Tipo:** feature
- **ÃƒÂrea:** backend / web
- **QuÃƒÂ©:** Al soltar PTT en Radio web se sube audio; API `/api/recordings`; consola reproduce grabaciones 24 h.
- **Archivos:** `migrations/004_ptt_recordings.sql`, `routes/recordings.js`, `usePtt.js`, `CommandCenter.jsx`, `docs/V1_4_RECORDINGS.md`
- **Notas:** MÃƒÂ³vil aÃƒÂºn no graba (mismo endpoint listo).

---
## 2026-08-11 Ã¢â‚¬â€ FCM: gaps de cÃƒÂ³digo (Firebase pendiente)

- **Tipo:** feature / docs
- **ÃƒÂrea:** mobile / backend
- **QuÃƒÂ©:** Canal `tacticalptx_alerts`, notificaciones foreground, re-registro token, `GET/POST /api/devices/me|test`. Checklist Soporte.
- **Notas:** Usuario dejÃƒÂ³ Firebase/JSON pendiente Ã¢â€ â€™ health sigue `fcm: off`.
- **Archivos:** `push_service.dart`, `fcm.js`, `devices.js`, `ACTIVAR_FCM.md`, `docs/FCM_PUSH.md`

---
## 2026-08-11 Ã¢â‚¬â€ Consola Command + geocercas + login

- **Tipo:** feature / ux
- **ÃƒÂrea:** web / backend
- **QuÃƒÂ©:**
 - Consola tipo CommandCentral (mapa, canales, actividad, detalle); luego rediseÃƒÂ±o por legibilidad.
 - Geocercas v1.3 (CRUD + enter/exit).
 - Login split con marca dominante.
 - Stack arrancado post-cambio disco C; script `start-services.ps1` corregido (encoding).
- **Archivos:** `CommandCenter.jsx`, `command-center.css`, `geofences.js`, `003_geofences.sql`, `App.jsx` login

---
## 2026-08-10 Ã¢â‚¬â€ Audio LAN + APK + respaldo disco D

- **Tipo:** fix / infra / ops
- **ÃƒÂrea:** mobile / infra / ops
- **QuÃƒÂ©:**
 - PÃƒÂ©rdidas de voz: LiveKit `--node-ip` + UDP 7882, mute/unmute PTT, DTX off.
 - Rebuild APK `TacticalPtx-LAN.apk` (Gradle en D: por C: lleno).
 - Proyecto confirmado en `D:\pulsanet`; respaldo `Respaldos\pulsanet_pre_cambio_C_*`.
- **Archivos:** `channel_session.dart`, `usePtt.js`, `start-services.ps1`, Soporte APK/Respaldos

---
## 2026-08-10 Ã¢â‚¬â€ v1.1 Media/GPS y v1.2 FCM cableado (sesiÃƒÂ³n previa)

- **Tipo:** feature
- **ÃƒÂrea:** backend / web / mobile
- **QuÃƒÂ©:** Chat multimedia, GPS/rutas despacho; pipeline FCM (sin credenciales).
- **Docs:** `V1_1_MEDIA_GPS.md`, `FCM_PUSH.md`

---
## 2026-08 (Mes 1Ã¢â‚¬â€œ6 consolidados)

Ver informe detallado: [INFORME_DESARROLLO_POR_MES.md](INFORME_DESARROLLO_POR_MES.md)

| Mes | Resumen |
|-----|---------|
| 1 | Auth, grupos, PTT web, LiveKit |
| 2 | Redis floor/presencia, chat, reconnect |
| 3 | Android Flutter alpha |
| 4 | Panel despacho (overview, mapa, users, groups) |
| 5 | Loadtest / piloto seÃƒÂ±alizaciÃƒÂ³n |
| 6 | Compose prod, harden API, prep Play Store |

---

*Fin de entradas histÃƒÂ³ricas iniciales. Las nuevas van encima de esta lÃƒÂ­nea de separaciÃƒÂ³n (despuÃƒÂ©s del encabezado Ã¢â‚¬Å“CÃƒÂ³mo registrarÃ¢â‚¬Â).*





