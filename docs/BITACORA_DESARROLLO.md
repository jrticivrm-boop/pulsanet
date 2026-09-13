## 2026-09-12 — Asegurado panel de despacho en rama WIP (solo vivía en working tree)

- **Tipo:** ops
- **Área:** docs / ops
- **Qué:**
  - Creada rama `wip/despacho-panel-2026-09-12` y commit(s) locales del panel de despacho (`frontend/src/dispatch/**`, rename `web`→`frontend`, backend/database/docs relacionados) que no existían bajo `frontend/` en ningún HEAD previo.
  - Prioridad: no perder semanas de avance del panel; sin push forzado ni secretos.
- **Por qué / notas:** El path `frontend/src/dispatch` solo estaba en el índice/disco (rename pendiente + WIP). Asegurar en rama nombrada antes de seguir editando.
- **Archivos / refs:** rama `wip/despacho-panel-2026-09-12`; `frontend/src/dispatch/**`; backend/database/docs de producto

## 2026-09-12 — Barra del mapa: «Ruta» solo cuando «Por grupo» / «Uno» ya tienen selección

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En la barra de la Consola (`DispatchMap.jsx`), el picker de **«Ruta»** ahora se oculta mientras el modo de operadores no tenga una selección real: en **«Por grupo»** exige al menos 1 grupo marcado, en **«Uno»** exige persona elegida. En **«Todos»** se muestra siempre (sin cambios).
  - Nuevo helper `hasOperatorSelection(mode, groupIds, userId)` como única fuente de verdad, usado tanto en el render como al restaurar filtros.
  - Al ocultarse «Ruta» (cambio de modo o desmarcar el último grupo) se **limpian las rutas seleccionadas**, para no dejar trazos fantasma en el mapa sin control visible en la barra.
  - Persistencia: `normalizeOpsMapFilters` descarta `trackUserIds` guardados si el modo restaurado no tiene selección, así que tras recargar no aparece «Horas» huérfano ni rutas sin picker.
- **Por qué / notas:**
  - Completa la cadena **modo → selección → Ruta → Horas**: cada control aparece solo cuando el anterior ya tiene algo elegido. Se mantiene intacta la regla previa de «Horas» (`trackUserIds.length >= 1`), ahora además condicionada a que «Ruta» esté visible.
  - Sin cambios de CSS: `.map-toolbar-trail` ya es `flex-wrap` con `flex: 1 1 7rem`, los controles restantes se reparten el ancho igual que hacía «Horas».
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx` (sincronizado a `C:\pulsanet-dev\frontend\`)

## 2026-09-12 — Delimitaciones de estados: causa raíz del desfase (dos fuentes mezcladas) y fuente única INEGI

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - **Causa raíz encontrada:** la capa mezclaba **dos fuentes de geometría distintas**. NL/TM/SLP salían de `data/ivRmStates.json` (detallado, correcto) y los otros 29 de `public/geo/mxEstados.json` (**mexicoHigh / angelnmara**, muy simplificado y desalineado). Al pintar vecinos con fuentes distintas, **cada frontera compartida se dibujaba dos veces y en sitios diferentes**: de ahí las rendijas color crema y los solapes que se veían entre Nuevo León y Coahuila, y entre San Luis Potosí y Zacatecas.
  - Sustituida por **fuente única para los 32**: geoBoundaries **gbOpen MEX ADM1** (origen **INEGI**, CC BY 3.0 IGO), simplificada con **mapshaper** a ~100 m **preservando topología** (`-simplify interval=100 keep-shapes -clean`, salida a 4 decimales ≈ 11 m).
  - `public/geo/mxEstados.json` (32 estados, 2.3 MB, ~121k vértices) y `src/dispatch/data/ivRmStates.json` (subconjunto NL/TM/SLP, 219 KB) se generan en la **misma corrida**, así que los límites entre vecinos son **arcos con vértices idénticos** — es imposible que vuelvan a aparecer rendijas.
  - `IvRmStatesLayer.jsx`: la descarga diferida (`anyEnabled` → `needsExtra`) ahora solo se dispara si está habilitado **algún estado fuera del bundle IV R.M.** Con la configuración por defecto (solo NL/TM/SLP) ya no se bajan 2.3 MB que el bundle ya trae.
  - Comentarios de `mxStatesGeo.js` / `ivRmStatesConfig.js` actualizados y `EXTRA_URL` con cache-bust `?v=inegi-20260912` para soltar el `mexicoHigh` cacheado.
- **Por qué / notas:**
  - **Por qué los intentos anteriores no lo tocaron:** todos fueron del lado del render (ImageOverlay → GeoJSON, `L.canvas` → `L.svg`, grosor de stroke, `fillOpacity`) o cambiaron *qué* fuente ganaba, pero **nunca eliminaron la mezcla de fuentes**, que era el problema. La geometría de NL/TM/SLP siempre estuvo bien; lo que estaba mal eran los **vecinos**, y al mirar la Consola el usuario veía el borde de NL contra el borde de Coahuila y parecía un desfase de NL.
  - **Evidencia numérica.** Descartadas las hipótesis de datum/CRS/ids cruzados: los bbox del bundle ya coincidían con la realidad (NL `[-101.21, 23.16, -98.42, 27.80]` vs real `[-101.20, 23.16, -98.42, 27.79]`, desviación máx. **0.01°**), WGS84 y lon/lat en orden correcto. Lo que fallaba era `mexicoHigh`: desviación **mediana 1.5–2.5 km y máxima 32 km**, con ~18 % de sus vértices a más de 5 km. Vértices compartidos en fronteras, **antes**: NL/COAH **0**, SLP/ZAC **0**, TM/VER **0**, pero NL/TM **1565** — eso explica exactamente el patrón que se veía (el borde NL/TM salía limpio porque ambos venían del bundle; los demás no). **Después**: NL/COAH 371, NL/TM 637, SLP/ZAC 423, TM/VER 311, CDMX/MEX 222.
  - **Test de área mal etiquetada** (rejilla de 107 588 puntos sobre el noreste, verdad = INEGI a resolución completa): **antes 4.47 %** mal etiquetada (1116 puntos en solape, 3670 pintados como otro estado); **después 0.02 %**, con **0 solapes**. Precisión de la simplificación: error mediano 11 m, p95 63 m.
  - **Validación de los 32:** ids del catálogo y del GeoJSON 1:1, sin duplicados ni cruces, y cada bbox dentro de 0.11° de su valor real (la mayoría <0.03°). Ojo con la fuente: geoBoundaries trae `shapeISO = MX-MEX` **duplicado** para CDMX y Estado de México, así que el generador empareja por `shapeName` con tabla explícita y aborta si algo no mapea.
  - **Cambio visible esperado:** la costa de Tamaulipas ahora dibuja la **Laguna Madre** y sus islas de barrera (INEGI excluye el cuerpo de agua), donde antes se pintaba un bloque liso encima del agua. Coincide con el basemap.
  - **Verificación.** El navegador de Cursor no logró abrir pestaña otra vez («No browser tab available»), así que **no hay captura de la Consola en vivo**. En su lugar se hizo un harness local que descarga las **mismas teselas Esri World_Street_Map** de `mapTiles.js` y proyecta el GeoJSON con la **misma fórmula EPSG:3857 de Leaflet**: el render «antes» reproduce la captura del usuario (mismas rendijas), y en el «después», a z8/z9/z10/z12, el borde de color cae **justo sobre la línea administrativa gris del basemap**, con panel de referencia sin overlay. Comprobado también end-to-end contra el dev server real: `GET /geo/mxEstados.json?v=inegi-20260912` → 200, 2 335 265 bytes, 32 features, 371 vértices compartidos NL/COAH. Falta la confirmación visual en la app en vivo (Consola / Seguimiento / Radio): **verificar con Ctrl+F5**.
  - No se tocaron los checks de superficies, los colores configurables, la carga diferida ni `tacticalptx_iv_rm_states_v1`. Respaldo previo en `C:\pulsanet_soporte\Respaldos\geo-estados-20260912-213913\`. Sync `C:\pulsanet-dev\frontend\`.
- **Archivos / refs:** `frontend/public/geo/mxEstados.json`, `frontend/src/dispatch/data/ivRmStates.json`, `frontend/src/dispatch/mxStatesGeo.js`, `frontend/src/dispatch/IvRmStatesLayer.jsx`, `frontend/src/dispatch/ivRmStatesConfig.js`; generador y harness en `C:\pulsanet_soporte\Respaldos\` (`build-states.js`, `render-check.py`, `area-test.py`, `validate32.js`); evidencias `C:\pulsanet_soporte\Documentos\evidencias\2026-09-12_estados_*.png`

## 2026-09-12 — Regresión recuperada: etiquetas de sitios en el mapa ya no se cortan con «…»

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Las etiquetas de **sitios tácticos** volvían a salir cortadas («Antidron de la B…»). El recorte era **solo CSS**: `.cc-tactical-map-label` conservaba `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` con `max-width: 118px`, encajonada además en un `divIcon` de ancho fijo de 120 px. **No hay recorte en JS** (no se usa `slice`/`substring` sobre el nombre).
  - Se replicó el patrón que **ya funcionaba en las etiquetas de operadores** (`.lt-wa-cargo` + `mapAvatarIcon.js`): `white-space: normal`, `overflow: visible`, `text-overflow: unset`, `word-break: break-word` y tamaño de icono dinámico.
  - `TacticalSitesLayer.jsx` → `siteIcon()`: ancho dinámico (120–280 px según el largo del texto), alto según número de líneas (hasta 4) y `iconAnchor` recalculado a `iconW/2`, para que la caja crezca/envuelva y el pin siga **centrado en la coordenada** del sitio.
  - `command-center.css`: nuevo `.cc-tactical-map-pin.has-label` (`width:auto`, `min-width:120px`, `max-width:min(280px,42vw)`), `overflow: visible` en `.cc-tactical-map-icon` y `.cc-tactical-map-label` con envoltura en varias líneas.
- **Por qué / notas:** La «regresión» no fue un commit que pisara el arreglo: el fix de etiquetas completas **solo se había aplicado a la capa de operadores**, nunca a la de sitios (en la versión *staged* del CSS ambas clases siguen truncadas, así que el sitio nunca estuvo arreglado). Cubre los **tres mapas** de una sola vez porque Consola (`DispatchMap.jsx`), Seguimiento (`LiveTrackMap.jsx`), Radio (`RadioPage.jsx`, que embebe `LiveTrackMap`) y Consola de mando (`CommandCenter.jsx`) comparten el mismo `TacticalSitesLayer`; `.cc-tactical-map-label` era el último rótulo de mapa que quedaba con `ellipsis`. Verificado con `vite build` OK y captura en Chrome headless sobre el **CSS real** en claro y oscuro: nombre completo, envuelve a dos líneas cuando es muy largo, la caja se ajusta al texto y el pin queda centrado. El navegador de Cursor no conservó pestaña en esta sesión y no había stack levantado, así que la evidencia es de un harness aislado, no de la app en vivo. Sync `C:\pulsanet-dev\frontend\`. Verificar con **Ctrl+F5**.
- **Aviso (anti-regresión):** `frontend/src/dispatch/` **no existe en ningún commit ni rama** (`main`, `develop`, `cursor/video-panic-stable-domain`); está solo en el índice (staged) y en disco. Todo el panel de despacho vive sin commit: conviene commitearlo o dejarlo en una rama nombrada para no perderlo.
- **Archivos / refs:** `frontend/src/dispatch/TacticalSitesLayer.jsx`, `frontend/src/dispatch/command-center.css`, evidencia `C:\pulsanet_soporte\Documentos\evidencias\2026-09-12_etiquetas_sitios_completas.png`

## 2026-09-12 — Grabaciones PTT: mini reproductor en la fila

- **Tipo:** feature
- **Área:** web, backend
- **Qué:**
  - Nuevo componente `frontend/src/dispatch/RecordingPlayer.jsx`: mini reproductor embebido en cada fila de **Grabaciones PTT** (Configuración → Grabaciones y panel de grabaciones de la Consola). Controles: play/pausa, onda con barra de progreso arrastrable (`pointerdown`/`pointermove` + `role="slider"`), tiempo transcurrido / total, saltos **−10 s / +10 s** y un menú compacto con **Realce de voz ×1/×2/×3**, **velocidad 0.5× / 1× / 1.5× / 2×**, volumen y «Descargar audio».
  - El realce por encima del 100 % usa **Web Audio** (`AudioContext` → `MediaElementAudioSourceNode` → `DynamicsCompressorNode` → `GainNode`): el compresor levanta lo que se habla bajito y el gain sube el total sin reventar los picos. El grafo se crea solo si se pide ×2/×3 (gesto de usuario, así `resume()` funciona).
  - Solo suena una grabación a la vez: bus interno `rec-play`; el botón verde **Escuchar** de siempre se conserva y ahora también se pausa/pausa a los demás (`pauseOtherRecordings` / `onRecordingPlay`).
  - El audio se descarga con el token (blob) al primer play, no al pintar la lista.
  - Backend `GET /api/recordings/:id/audio`: se añadió `Accept-Ranges`, `Content-Length` y **peticiones parciales HTTP 206** (rango explícito, sufijo `bytes=-N`, abierto `bytes=N-` y `416` con `Content-Range: bytes */total`). Sigue sin `Content-Disposition`, así que se reproduce en línea.
- **Por qué / notas:** Despacho necesita distinguir matices de audios donde se habla bajito y poder adelantar/atrasar dentro de la grabación. Cambios aditivos: no se tocó el reproductor de notas de voz del chat (`VoiceNotePlayer` en `ChatMedia.jsx`), solo se tomó como modelo visual; el CSS entra como bloque nuevo al final de `command-center.css` con variables `--cc-*` (claro y oscuro). Verificado: `vite build` OK y las 5 variantes de `Range` probadas contra una grabación real (5.6 MB → 206 correcto en todas). El navegador de Cursor no conservó pestaña en esta sesión, así que no hay captura. Sync `C:\pulsanet-dev\frontend\` y `C:\pulsanet-dev\backend\`. Verificar con **Ctrl+F5** en Despacho → Configuración → Grabaciones.
- **Archivos / refs:** `frontend/src/dispatch/RecordingPlayer.jsx` (nuevo), `frontend/src/dispatch/ConfigRecordings.jsx`, `frontend/src/dispatch/CommandCenter.jsx`, `frontend/src/dispatch/command-center.css`, `backend/src/routes/recordings.js`

## 2026-09-12 — Editar usuario / paso Adscripción: checks y botones alineados

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - **Privilegios de radio / visibilidad**: los tres checks salían con el cuadrito estirado y el texto en una columna aparte porque `.cc-shell .admin-form input` impone `width:100%` a todo `input` (Chrome centra el glifo dentro de la caja inflada). Ahora `.cc-priv-check input[type=checkbox]` mide 1rem, no se encoge y usa `accent-color: var(--cc-accent)` (oliva institucional en vez del azul nativo).
  - Cada fila es un `<label>` completo clickeable: check + título (`Ver Región` / `Ver Zonas / C.G.` / `Ver Unidades`) y la descripción entre paréntesis como segunda línea en `--cc-muted`, alineada a la izquierda y con **el mismo texto** de antes. Filas dentro de `.cc-priv-check-list` con espaciado uniforme, borde suave y realce `.on` al marcar (mismo patrón que `.cc-group-check`).
  - El `fieldset` deja de dibujar una caja dentro de `.cc-form-section`: su `legend` toma el estilo de título de sección, así el bloque queda alineado con «Ubicación orgánica» y con los tres selects Región / Zona-C.G. / Unidad.
  - Botones del paso: `.field` aportaba `flex-direction: column` y apilaba «← Atrás» encima de «Guardar cambios». `.field-actions.cc-form-actions` ahora es fila (`row` + `wrap`, `justify-content: flex-end`, `align-items: center`), ambos botones con la misma altura y «← Atrás» a la izquierda de «Guardar cambios».
- **Por qué / notas:** Solo layout/estilo con variables del sistema; sin tocar la cascada Región→Zona→Unidad, la validación ni el guardado. Verificado en Chrome headless con el CSS real a 1000px y 430px (en angosto los selects pasan a una columna y los botones envuelven, no se apilan). Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Administración → Usuarios → Editar usuario → paso Adscripción.
- **Archivos / refs:** `frontend/src/dispatch/DispatchUsers.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 — Personas: botón X y colores institucionales

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Modal **Personas** (`PeoplePalette.jsx`, Ctrl+K): el chip de texto «Esc» se cambió por un botón **✕** redondo (`aria-label`/`title` «Cerrar (Esc)»), igual que `PeerActionSheet`. Conserva `data-esc-close-btn`, así que **Escape sigue cerrando** vía `GlobalEscapeClose`.
  - Paleta adaptada al tema institucional con variables (`--surface`, `--ink`, `--muted`, `--border`, `--accent`, `--gold`, `--paper`, `--shadow`) en vez de hex oscuros fijos: panel claro/oscuro según `data-theme`, cabecera con filo dorado y título oliva (oro en oscuro), buscador y filas con `color-mix` del acento.
  - Contraste de los 4 iconos de acción (mensaje/llamada/video/ver cámara): chips con fondo `--paper` + borde `--border`; avatares con disco oliva y aro dorado. En móvil el ✕ ya no se oculta (antes `display:none`) y toma tamaño táctil 44px.
- **Por qué / notas:** El modal desentonaba con el panel oliva/oro. Sin cambios de lógica: buscar, recientes, mensaje, llamada, video, ver cámara y el scroll de la lista quedan intactos. Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** y Ctrl+K.
- **Archivos / refs:** `frontend/src/PeoplePalette.jsx`, `frontend/src/styles.css`

## 2026-09-12 — Catálogos: manita ciclaba y bloqueaba clics

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Causa: `html.cc-catalogs-tabs-dragging * { cursor: grab !important }` + `setOverTo` en cada `pointermove` provocaba recalc/flicker del cursor en Chrome/Windows y sensación de UI trabada; listeners de pointer podían apilarse y la clase quedarse pegada.
  - Fix pestañas: sesión única con `setPointerCapture`, umbral 8px, updates solo si cambia drag/over, limpieza fiable en pointerup/cancel/Escape/visibility/unmount; grab solo en `html`/`body` y pestañas (ya no en `*`).
  - Fix chips Grados/Jerarquías: misma limpieza de `cc-cat-dragging` + cursor sin selector universal.
- **Por qué / notas:** Reorder de pestañas e ítems se conserva. AppDialog de Grados ya tiene X (no había modal con texto «Esc» claro sin captura). Verificar: **Ctrl+F5** en `/despacho/catalogos/grados`.
- **Archivos / refs:** `ReorderableCatalogTabs.jsx`, `CatalogGrades.jsx`, `CatalogJerarquias.jsx`, `command-center.css` (sync `pulsanet-dev`)

## 2026-09-12 — Inbox: alinear hora con iconos

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Hora + estrella/teléfono/video en el mismo contenedor `.wa-inbox-row-end` (`align-items: center`).
  - La hora salió de `.wa-inbox-top` (quedaba arriba del preview) para compartir línea visual con las acciones.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio/inbox — hora a la misma altura que los 3 iconos.
- **Archivos / refs:** `frontend/src/ChatInbox.jsx`, `frontend/src/styles.css`

## 2026-09-12 — Radio: icono Videollamada un poco más chico

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Icono PNG de **Videollamada** en botones laterales PTT: de **17×17** a **15×15** px (CSS `.radio-video-call-btn img` + `width`/`height` del `<img>`).
  - Sin tocar Audio/alerta ni el archivo PNG fuente.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio — icono más alineado con speaker y ⚠.
- **Archivos / refs:** `frontend/src/styles.css`, `frontend/src/pages/RadioPage.jsx`

## 2026-09-12 — Consola: Horas solo con ≥1 ruta

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En toolbar de Consola, el select **Horas** solo se renderiza si `trackUserIds.length >= 1`.
  - Sin rutas marcadas (RUTA = «— ninguna —») no aparece Horas; al marcar ≥1 check vuelve. El valor `trackHours` en state/localStorage se conserva.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: sin rutas → no Horas; marca 1 → aparece; **Ctrl+F5**.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 — Consola: GRUPO multi-select estilo Parque Vehicular

- **Tipo:** ux | feature
- **Área:** web
- **Qué:**
  - Sustituido el selector nativo / multi parcial de **Grupo** por panel multi-check sin `<select>`: Ascendente/Descendente, Marcar/Desmarcar, contador «N de N seleccionados», ayuda `?`, búsqueda «Buscar en lista…» y lista con checks (sin límite).
  - Colores TacticalPtx (oliva/oro institucional) reutilizando `channel-col-*` + `cc-tactical-ms-*` / `cc-group-ms-*`.
  - Persistencia `operatorGroupIds[]` en `tacticalptx_ops_map_filters_v1`; filtro mapa = unión de miembros de grupos marcados.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: Operadores → Por grupo → abrir Grupo → panel PV; **Ctrl+F5**.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 — UX: alinear icono ⚠ Enviar alerta

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Centrado óptico del glyph ⚠ en `.panic-ico-glyph` (`translateX(-0.08em)`) para alinearlo con los iconos de `.radio-ops-side-btn` (p. ej. Audio activado).
  - Ondas expansivas intactas; solo nudge del triángulo amarillo.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio — ⚠ centrado respecto al icono de audio debajo.
- **Archivos / refs:** `frontend/src/styles.css` (`.panic-ico-glyph`)

## 2026-09-12 — Radio: icono PNG Videollamada (lado PTT)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Botón Videollamada en Radio (`radio-video-call-btn`) deja el emoji 📹 y usa `videollamada.png` (`iconVideollamada`), mismo asset que DM/inbox.
  - Tamaño ~17px alineado al icono de Audio del botón superior; CSS mínimo en `.radio-ops-side-btn`.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Radio — icono PNG en Videollamada. No tocar Enviar alerta / `.panic-ico`.
- **Archivos / refs:** `frontend/src/pages/RadioPage.jsx`, `frontend/src/styles.css`, `frontend/src/assets/icons/videollamada.png`

## 2026-09-12 — Persistencia filtros barra mapa Consola

- **Tipo:** mejora
- **Área:** web
- **Qué:**
  - Barra Consola (Operadores / Ruta / Horas) se guarda en `localStorage` (`tacticalptx_ops_map_filters_v1`) y se restaura al montar / F5.
  - Sitios siguen en su clave existente (`tacticalptx_tactical_site_layers`).
  - IDs restaurados se validan contra grupos/ubicaciones cargados; no se podan rutas antes del primer fetch.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: elegir filtros → F5 → siguen. Seguimiento/Radio no tienen esa barra.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 — UX: leyenda de rutas (quitar Tramo repetido + texto estimado)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Quitado de la leyenda el ítem **Tramo repetido** (solo UI; highlighter de tramos repetidos en mapa intacto).
  - **Sin señal · ruta probable** sin cambios.
  - Estimado: **Sin señal · estimado** → **Sin señal Ruta estimada**.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola con ruta activa — 3 ítems en leyenda.
- **Archivos / refs:** `frontend/src/dispatch/DispatchMap.jsx`

## 2026-09-12 — UX: chrome mapas homologado a 23px

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `--map-chrome-h` / `--lt-chrome-h`: **1.85rem → 23px** (Maximizar + En línea/Desconectado/Fuera de línea).
  - Misma altura en Consola, Seguimiento y Radio PTT; `.track-route-legend` también fija **23px**.
  - Padding/fuente más compactos + `overflow: hidden` / `box-sizing: border-box` para que el texto quepa sin crecer el contenedor.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola, Seguimiento y Radio PTT — franja superior ~23px alineada a leyenda de rutas.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-12 — UX: leyenda de rutas a inferior izquierda

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - `.track-route-legend` deja de anclarse debajo del chrome de presencia (En línea…) y pasa a **esquina inferior izquierda** (`bottom: 12px; left: 10px`).
  - Zoom Leaflet sigue en bottomright; no se mueve En línea ni Maximizar.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola (mapa con ruta activa) — leyenda verde/amarillo abajo-izquierda.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css` (markup en `DispatchMap.jsx`)

## 2026-09-12 — Precisión fronteras IV R.M. (NL/TM/SLP) + fill SVG

- **Tipo:** fix
- **Área:** web
- **Qué:**
  - Restaurado `ivRmStates.json` detallado (~333 KB; NL ~2.3k / TM ~6.6k / SLP ~5.5k vértices) desde `38ffa58:web/...` — deja de usarse mexicoHigh crudo para IV R.M.
  - Renderer **`L.svg`** intacto (fill fiable); stroke **1.15 px**.
  - `availableStateFeatures`: mxEstados para lazy; **bundle detallado gana** en NL/TM/SLP (nunca concat duplicada).
  - Resto de estados: sigue `mxEstados.json` (mexicoHigh); no hay fuente más densa empaquetada sin subir mucho el peso.
- **Por qué / notas:** El fix de relleno había sustituido el detallado por mexicoHigh; el color volvió pero las fronteras se veían “poligonales”. Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** — fill visible y bordes alineados al tile.
- **Archivos / refs:** `data/ivRmStates.json`, `mxStatesGeo.js`, `IvRmStatesLayer.jsx`, `ivRmStatesConfig.js`

## 2026-09-12 — UX: chrome mapa más bajo (Consola / Seguimiento / Radio)

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - Altura de leyenda + Maximizar: **2.5rem → 1.85rem** (misma que Radio PTT embed).
  - Homologados Consola (`.map-frame-chrome`), Seguimiento (`.lt-map-chrome`) y Radio; padding/fuente de leyenda y `.lt-max-btn--map` más compactos.
  - Ajuste de `.track-route-legend` top al nuevo chrome.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: **Ctrl+F5** en Consola, Seguimiento y Radio PTT — franja superior misma altura.
- **Archivos / refs:** `frontend/src/dispatch/command-center.css`

## 2026-09-12 — UX: miembros inline bajo el grupo seleccionado

- **Tipo:** ux
- **Área:** web
- **Qué:**
  - En Administración → Grupos, el panel de miembros ya no aparece al final de la página: se inserta **inmediatamente debajo** de la tarjeta del grupo al pulsar «Miembros» (accordion, un grupo abierto a la vez; segundo clic cierra).
  - Misma funcionalidad: lista, roles, quitar miembro, cambiar/quitar avatar del canal.
- **Por qué / notas:** Sync `C:\pulsanet-dev\frontend\`. Verificar: Ctrl+F5 en `/despacho/administracion/grupos`.
- **Archivos / refs:** `frontend/src/dispatch/DispatchGroups.jsx`, `frontend/src/dispatch/command-center.css`

## 2026-09-12 — Limpieza de código muerto del rail (sub-enlaces del despacho)

- **Tipo:** mejora
- **Área:** web
- **Qué:**
  - `DispatchLayout.jsx`: eliminado el andamiaje del viejo submenú `<details>` que quedó sin usar tras convertir Catálogos / Administración / Configuración en enlaces únicos: `CATALOG_LINKS`, `ADMIN_LINKS`, `CONFIG_LINKS`, `SUB_NAV_DEFAULTS`, `configLinks`, `renderSubLinks`, `subSlotClass`, `orderLinksBySaved`, `mergeSubOrder`, `loadSubNavOrder`, `saveSubNavOrder`, estado `subNavOrder`/`subDrag`/`subOver`, handlers `onSubDrag*`/`onSubDrop`, `reorderSubNav` y la clave `tacticalptx_mod_sub_nav_order`.
  - Simplificados los guards de `onNavDragOver`/`onNavDrop` que solo servían para rechazar drops de sub-ítems (ya imposibles). El drag del rail de módulos (`tacticalptx_mod_nav_order`) se conserva intacto.
  - `institutional.css`: quitadas las reglas exclusivas del submenú (`.cc-mod-group*`, `summary`, `.cc-mod-sub*`), sin tocar `.cc-mod-drag-handle` ni `.cc-mod-slot` (siguen en uso).
- **Por qué / notas:** Verificado con búsqueda en todo `frontend/src` que ningún símbolo/clase eliminada se usa fuera de estos dos archivos. El reordenamiento de pestañas vive ahora en `ReorderableCatalogTabs.jsx` (claves `tacticalptx_{catalog,admin,config}_tabs_order`). `npm run build` OK (−2 kB CSS, −2 kB JS). Sincronizado a `C:\pulsanet-dev\frontend\` (el worktree DEV aún tenía el rail viejo).
- **Archivos / refs:** `frontend/src/dispatch/DispatchLayout.jsx`, `frontend/src/institutional.css`

## 2026-09-12 — LiveKit Radio: causa real (API/Caddy + race PTT) y hardening

- **Tipo:** fix | ops
- **Área:** web | backend | infra
- **Qué:**
  - El soft-fix previo (quitar `192.168.1.66`) no bastaba en HTTPS: ahí ya se usa `wss://host` (proxy `/rtc`). Señal + E2EE `room.connect` OK en Chrome (~0.5–1.5s) vía Vite y DuckDNS.
  - Causa operativa: Caddy reventaba con 502 `dial tcp 127.0.0.1:4000 connection refused` (API a veces solo en `::` / procesos `--watch` huérfanos) mientras el despacho usaba `https://pulsanet.duckdns.org/despacho/radio`.
  - Hardening: API `listen(..., '0.0.0.0')`; `usePtt` dedupe de connects, éxito parcial multi-canal, limpia banner al conectar, log `[PTT LiveKit]` con URL real; limpios watchers huérfanos.
- **Por qué / notas:** El banner rojo aparece si *todos* los canales Hablar fallan al conectar LiveKit; un canal fallido ya no tumba el resto.
- **Archivos / refs:** `frontend/src/usePtt.js`, `backend/src/server.js`, Caddy `API_UPSTREAM` → `:4000`, LiveKit `:7880`
## 2026-09-12 — Zumbido: siempre vibra+suena (sonido BG = canal FCM)

- **Tipo:** fix
- **Área:** mobile
- **Qué:**
  - Requisito corregido: en los 3 contextos el zumbido recibido vibra Y suena.
  - `applyReceivedNudgeFeedback` siempre vibra+tono (sin ramas por chat/foco); debounce tono 400 ms (alineado a vibración).
  - Background: vibración en isolate FCM + sonido por canal dedicado `tacticalptx_nudge_v1` / `nudge_buzz` — **sin** AudioPlayer en el isolate (anti WhatsApp mic).
- **Archivos / refs:** message_tone.dart, push_service.dart (canal zumbido), direct_pane.dart (comentario)
- **Nota:** APK pendiente (otro agente compila / bug mic).

## 2026-09-12 — Mobile DM zumbido: icono in-field + reglas de feedback

- **Tipo:** ux | fix
- **Área:** mobile
- **Qué:**
  - Botón zumbido: icono vector gris Icons.vibration **dentro** del campo Mensaje, a la derecha del emoji (mismo estilo que smiley).
  - Feedback al recibir (corrigido después): siempre vibra+suena; en BG el sonido es el canal FCM `nudge_buzz`, no AudioPlayer. Helper applyReceivedNudgeFeedback.
- **Por qué / notas:** Antes vibraba también con el chat abierto; el emoji colorido quedaba fuera del composer.
- **Archivos / refs:** direct_pane.dart, message_tone.dart, panic_vibration.dart, push_service.dart, radio_shell.dart, channel_session.dart, private_call_screen.dart
  - APK debug instalado en emulator-5554: C:\\pulsanet_soporte\\APK\\TacticalPtx-PRUEBA-zumbido-20260912-1757.apk (~233 MB). API_BASE=https://pulsanet.duckdns.org.

## 2026-09-12 — ChatInbox: alinear estrella favorito en lista

- **Tipo:** fix | ux
- **Área:** web
- **Qué:**
  - `.wa-inbox-bottom` pasa a `align-items: center` (el top sigue en `baseline`).
  - Nudge óptico `translateY(-0.06em)` en SVG de estrella lista (`.wa-inbox-star`) y botones favorito (`.wa-inbox-fav-btn`, incl. header DM).
- **Por qué / notas:** El path Material de la estrella es bottom-heavy; con badge/call/video se veía baja.
- **Archivos / refs:** `frontend/src/styles.css` (sync `pulsanet-dev`)

## 2026-09-12 — Catálogos: sin subtítulo, pestañas doradas y reordenables

- **Tipo:** ux | feature
- **Área:** web
- **Qué:**
  - Quitado el subtítulo bajo el título en Catálogos / Administración / Configuración (más espacio vertical).
  - Color mostaza/oro institucional (`#9a7b2f`) pasado a las pestañas activas (texto + underline).
  - Pestañas arrastrables para reordenar; orden en `localStorage` (`tacticalptx_catalog_tabs_order`, `_admin_`, `_config_`). Cursor `pointer` / `grabbing` al arrastrar.
- **Archivos / refs:** `ReorderableCatalogTabs.jsx`, `CatalogsLayout.jsx`, `AdminLayout.jsx`, `ConfigLayout.jsx`, `command-center.css`, `institutional.css`

## 2026-09-12 — LiveKit audio: diagnóstico y fix URL LAN

- **Tipo:** fix | ops
- **Área:** web | backend | infra
- **Qué:**
  - Diagnosticado error «No se pudo conectar el audio (LiveKit)»: API solo responde por **HTTPS** (`http://:4000` da empty reply; health OK por `https://`); señal LiveKit OK vía Vite/Caddy `/rtc` y DuckDNS; WebRTC `room.connect` verificado en Chrome (connected ~1.5s).
  - Reiniciado `livekit-server` (node-ip público vigente `189.152.160.81`).
  - Quitado hardcode muerto `192.168.1.66` en `publicLiveKitUrl` (LAN real `192.168.1.216` / `LIVEKIT_LAN_HOST`); fallback backend sin `.66` stale.
- **Por qué / notas:** El fallback `.66` hacía timeout en HTTP/LAN; en HTTPS la consola ya usaba same-origin `wss://host` (proxy `/rtc`).
- **Archivos / refs:** `frontend/src/livekitUrl.js`, `backend/src/services/livekit.js`, LiveKit `:7880`
## 2026-09-12 — DM header: iconos llamada/video sin relleno verde

- **Tipo:** ux
- **Área:** web
- **Qué:** Quitado el fondo verde de los botones de llamada/videollamada en el header del DM (mismo estilo que favorito). Iconos desde Escritorio\Iconos (`telefono.png`, `videollamada.png`) en `frontend/public/icons/`.
- **Archivos / refs:** `DirectChat.jsx`, `styles.css`, `public/icons/telefono.png`, `public/icons/videollamada.png`


## 2026-09-12 — Zumbido Messenger + no secuestrar mic (WhatsApp)

- **Tipo:** feature | fix
- **Área:** mobile | web | backend
- **Qué:**
  - Zumbido: buzz aproximado (`nudge_buzz.wav`), vibración/shake ~1.45 s, hasta **5** seguidos y luego **10 s** de espera.
  - Etiqueta **¡Zumbido!** (ya no «nudge») en inbox/previews/notificaciones; FCM `dm_nudge` abre el DM.
  - Anti-regresión audio: tonos con `assistanceSonification` (sin voiceCommunication); al minimizar sin PTT/llamada se hace `downgradeFromVoice`; en FCM background solo vibra (sonido = notificación). Evita aviso WhatsApp «no se pueden grabar mensajes de voz durante una llamada».
  - UI: círculos header DM y dock Colgar homologados.
- **Archivos / refs:** `dm.js`, `fcm.js`, `formatMessage`, `DirectChat`/`ChatInbox`, `audio_session_setup.dart`, `message_tone.dart`, `push_service.dart`, `radio_shell.dart`, `panic_vibration.dart`, `assets/sounds/nudge_buzz.wav`

## 2026-09-12 — APK prueba chat zumbido (debug)

- **Tipo:** fix | ops
- **Área:** mobile
- **Qué:**
  - Corregido fallo de compile: restaurado `call_ringtone.dart`; `onUpdateAvailable` en `app_update`; `intent` en IncomingCallScreen; `required` en E2EE; colores `kInstDangerSoft` / `kInstCallSurfaceHi`.
  - APK debug de prueba (no OTA) con zumbido, etiqueta Imagen y picker solo documentos: `C:\pulsanet_soporte\APK\TacticalPtx-PRUEBA-chat-zumbido-20260912-1621.apk` (~204 MB).
  - `API_BASE=https://pulsanet.duckdns.org`; instalado en emulador `emulator-5554`.
- **Archivos / refs:** `mobile/lib/call_ringtone.dart`, `app_update.dart`, `livekit_e2ee.dart`, `theme.dart`, `incoming_call_screen.dart`, chat attach sheet / media_kind / direct_pane

## 2026-09-12 â€” Inbox chat: mostrar todos los contactos

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - La lista izquierda de `ChatInbox` vuelve a incluir **contactos sin historial DM** (preview Â«Toca para escribirÂ»), alineado con mobile y DirectChat; antes solo listaba conversaciones con mensajes.
  - Despacho/admin: `DirectChat` y Â«Nuevo chatÂ» piden contactos con `scope=org` (toda la org); operadores siguen en `shared` (comparten grupo).
- **Por quÃ© / notas:** En despacho Radio el usuario no veÃ­a a todos los contactos; el panel forzaba `shared` y omitÃ­a contactos sin chat previo.
- **Archivos / refs:** `ChatInbox.jsx`, `DirectChat.jsx`, `NewChatSheet.jsx`

## 2026-09-12 â€” ConfiguraciÃ³n â†’ Estados (delimitaciones mapa)

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:** Nueva pÃ¡gina **ConfiguraciÃ³n â†’ Estados** para activar/desactivar y colorear las delimitaciones IV R.M. (NL / Tamaulipas / SLP) en Consola, Seguimiento y Radio. Preferencias en `localStorage` (`tacticalptx_iv_rm_states_v1`); la capa `IvRmStatesLayer` re-rasteriza en Mercator segÃºn config.
- **Archivos / refs:** `ConfigStates.jsx`, `ivRmStatesConfig.js`, `IvRmStatesLayer.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-09-12 â€” Rail: reordenar sub-Ã­tems del menÃº por mÃ³dulo

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:** En el rail izquierdo de despacho, los enlaces dentro de cada mÃ³dulo (CatÃ¡logos, AdministraciÃ³n, ConfiguraciÃ³n) se pueden arrastrar arriba/abajo **solo dentro del mismo mÃ³dulo**. Orden persistido en `localStorage` (`tacticalptx_mod_sub_nav_order`).
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`

## 2026-09-12 â€” Mapa estados: alinear ImageOverlay a Mercator

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** La capa de colores IV R.M. se rasteriza en **Web Mercator (EPSG:3857)** (antes equirectangular), para que coincida con las fronteras del mapa base sin desfase.
- **Archivos / refs:** `IvRmStatesLayer.jsx`

## 2026-09-12 â€” Mapa estados IV R.M.: ImageOverlay sin parpadeo

- **Tipo:** fix | mejora
- **Ãrea:** web
- **QuÃ©:** Los colores de NL / TM / SLP se rasterizan una vez a PNG y se muestran como `ImageOverlay` (escalan con el zoom, sin clear/redraw de Canvas/SVG). Elimina el destello al soltar el zoom.
- **Archivos / refs:** `IvRmStatesLayer.jsx`, `command-center.css`

## 2026-09-12 â€” DM: zumbido (nudge) con vibraciÃ³n

- **Tipo:** feature
- **Ãrea:** web | backend | mobile | database
- **QuÃ©:** BotÃ³n **Zumbido** a la izquierda del emoji en chat privado. EnvÃ­a mensaje `type=nudge`, sacude UI web y vibra el celular (socket + FCM `dm_nudge`). Cooldown 8 s.
- **Archivos / refs:** `031_message_nudge.sql`, `dm.js`, `DirectChat.jsx`, `styles.css`, `api.js`, `api_client.dart`, `direct_pane.dart`, `push_service.dart`, `panic_vibration.dart`

## 2026-09-12 â€” Chat: adjunto Imagen; documentos tipados

- **Tipo:** ux | fix
- **Ãrea:** web | backend
- **QuÃ©:** MenÃº adjuntar: **GalerÃ­a** â†’ **Imagen** con icono de paisaje. BotÃ³n **Documento** solo PDF/Office/texto (sin imagen/video/zip); tope de docs elevado a 5 GB.
- **Archivos / refs:** `DirectChat.jsx`, `WhatsAppChat.jsx`, `styles.css`, `mediaKind.js`, `uploads.js`

## 2026-09-12 â€” Mapa: estados IV R.M. sin parpadeo al zoom

- **Tipo:** fix | mejora
- **Ãrea:** web
- **QuÃ©:** Las manchas de color de NL / Tamaulipas / SLP ya no desaparecen un instante al hacer zoom. Se dibujan en Canvas (pane propio) en lugar de SVG.
- **Archivos / refs:** `IvRmStatesLayer.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 â€” Sitios: preview icono sin cÃ­rculo; Salir blanco; zoom Esri

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Con icono subido, preview y pin en mapa muestran la imagen sin cÃ­rculo ni deformar (`object-fit: contain`); el cÃ­rculo solo si no hay icono. **Salir** del rail en letras blancas. Capas Natural/SatÃ©lite Esri: `maxNativeZoom` 17 para evitar Â«Map data not yet availableÂ» al acercar.
- **Archivos / refs:** `command-center.css`, `institutional.css`, `mapTiles.js`, `MapMaximizeButton.jsx`

## 2026-09-12 â€” Mapa: Maximizar â†’ Restaurar; sin hint Esc

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En mapa en vivo y seguimiento, el botÃ³n maximizado dice **Restaurar** (mismo ancho que Maximizar). Se quitÃ³ la etiqueta Â«Esc o Reducirâ€¦Â»; el tooltip indica **Restaurar (Esc) para salir**.
- **Archivos / refs:** `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 â€” Mapa Maximizar/Restaurar unificado

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** BotÃ³n Maximizar/Restaurar compartido (`MapMaximizeButton`) en Consola, Seguimiento y Radio. Texto Restaurar, sin hint Esc visible, tooltip Â«Restaurar (Esc) para salirÂ», mismo ancho. En Consola, misma altura que la leyenda En lÃ­nea.
- **Archivos / refs:** `MapMaximizeButton.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 â€” Geocerca: Guardar/Cancelar con estilo cc-btn

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Botones Guardar / Cancelar (y Eliminar) del borrador de geocerca usan `cc-btn primary` / `ghost` como el resto del panel.
- **Archivos / refs:** `DispatchMap.jsx`, `command-center.css`

## 2026-09-12 â€” Topbar: Oscuro/Claro mismo ancho; menÃº Sitios

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** El botÃ³n Oscuro/Claro no cambia de ancho al alternar. En el menÃº, Â«Sitios tÃ¡cticosÂ» pasa a **Sitios** (UI y textos visibles).
- **Archivos / refs:** `command-center.css`, `DispatchLayout.jsx`, `AdminLayout.jsx`, `CatalogTacticalSites.jsx`, `CommandCenter.jsx`

## 2026-09-12 â€” Radio mapa: capas abajo a la izquierda

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En el mapa embebido de Radio PTT, Natural / SatÃ©lite / Claro pasan a la esquina inferior izquierda. Leyenda y Maximizar siguen arriba.
- **Archivos / refs:** `command-center.css` (`.lt-page--embed-radio .lt-layers`)

## 2026-09-12 â€” Leyenda mapa: Fuera de lÃ­nea; PÃ¡nico oculto

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En la leyenda del mapa, Â«Desconectado prolongadoÂ» pasa a **Fuera de lÃ­nea**. Se oculta **PÃ¡nico** por ahora (pendiente reactivar). Pastilla de lista: gris = **Desconectado**; rojo = **Fuera de lÃ­nea**; verde = **En lÃ­nea**.
- **Archivos / refs:** `presenceStatus.js`, `PresenceMapLegend.jsx`, `LiveTrackMap.jsx`
- **Pendiente:** volver a mostrar PÃ¡nico en la leyenda cuando se pida.

## 2026-09-12 â€” PestaÃ±as/Encabezado: sin flechas â†‘â†“ de orden

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Se quitan las flechas subir/bajar en Vista PestaÃ±as y Encabezado (igual que en Columnas). El orden sigue por arrastre â‹®â‹®.
- **Archivos / refs:** `ChannelMultiSelect.jsx`

## 2026-09-12 â€” Topbar: Oscuro del mismo tamaÃ±o que el badge de rol

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** El botÃ³n Oscuro/Claro en la barra superior queda al mismo alto/padding que la pastilla ROOT (u otro rol) a su izquierda.
- **Archivos / refs:** `command-center.css` (`.cc-theme-toggle`)

## 2026-09-12 â€” Fix: toast falso al reordenar canales

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Al arrastrar/subir/bajar un grupo en Canales ya no aparece el globo de chat con un mensaje viejo. Se ignora el historial al cambiar de canal PTT y solo se cambia el canal de Hablar si el orden realmente cambia el primario.
- **Archivos / refs:** `ChatInbox.jsx`, `DispatchLayout.jsx`, `RadioPage.jsx`

## 2026-09-12 â€” ConfiguraciÃ³n Canales: texto, sin resumen, tarjeta ancha

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** DescripciÃ³n formal de Canales; se quita el resumen Â«Oye / Habla / Video / AlertaÂ»; la tarjeta usa todo el ancho para mostrar bien las 4 columnas.
- **Archivos / refs:** `ConfigChannels.jsx`, `command-center.css`

## 2026-09-12 â€” Radio mapa: barra de controles mÃ¡s baja

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En el mapa embebido de Radio (PestaÃ±as/Encabezado), la leyenda de presencia, Natural/SatÃ©lite/Claro y Maximizar bajan de ~40 px a ~30 px. Seguimiento completo no cambia.
- **Archivos / refs:** `command-center.css` (`.lt-page--embed-radio .lt-map-chrome`)

## 2026-09-12 â€” Encabezado: orden de selects y Video completo

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** En Vista Encabezado, Escuchar/Hablar/Video/Alerta queda a la **izquierda** e Individual/MÃºltiple a la **derecha** (como Columnas). El select ya no recorta Â«VideoÂ» ni Â«EscucharÂ».
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 â€” Radio PestaÃ±as/Encabezado: chats, conversaciÃ³n y mapa 2Ã—2

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En Vista PestaÃ±as o Encabezado, Radio queda en 2Ã—2: chats (zona 1), radio intacta (zona 2), conversaciÃ³n (zona 3) y mapa de Seguimiento (zona 4). Vista Columnas no cambia.
- **Por quÃ© / notas:** El hueco izquierdo del bloque de radio pasa a ser la lista de chats; el mapa reutiliza el de seguimiento (sin lista de personas). En telÃ©fono (â‰¤720 px) el mapa de Radio no se monta: el Ãºtil estÃ¡ en Seguimiento. Barra del mapa: leyenda, Natural/SatÃ©lite/Claro y Maximizar a la misma altura y botones un poco mÃ¡s anchos. Radio y mapa son tarjetas distintas; hueco entre zonas mÃ¡s chico. El cuadro de canales no se recorta (fila 1 = alto del cuadro; sin overflow hidden / backdrop-filter en Firefox/Safari).
- **Archivos / refs:** `RadioPage.jsx`, `LiveTrackMap.jsx`, `styles.css`, `command-center.css`

## 2026-09-12 â€” Fix: GPS en vivo ya no sale Â«Fuera de lÃ­neaÂ»

- **Tipo:** fix
- **Ãrea:** web | backend
- **QuÃ©:** Si el GPS estÃ¡ fresco (avatar verde / Â«En vivo Â· compartiendoÂ»), la pastilla pasa a **En lÃ­nea**. Antes usaba solo `last_seen` del socket y podÃ­a marcar desconectado prolongado. El reporte GPS tambiÃ©n actualiza last_seen.
- **Archivos / refs:** `presenceStatus.js`, `LiveTrackMap.jsx`, `locations.js`, `presence.js`

## 2026-09-12 â€” Chats: Â«N en lÃ­neaÂ» en Todos y Grupos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En la lista de chats (Todos / Grupos) cada canal muestra **N en lÃ­nea**. Al abrir el grupo, el encabezado usa la presencia de ese canal (no solo el de PTT).
- **Archivos / refs:** `ChatInbox.jsx`, `usePtt.js` (`onlineByGroup`), `DispatchLayout.jsx`, `RadioPage.jsx`

## 2026-09-12 â€” Seguimiento: pastilla Fuera de lÃ­nea (gris/rojo)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En la lista de personas, **OFF** pasa a **Fuera de lÃ­nea**. Gris si estÃ¡ desconectado; rojo si supera el umbral de desconexiÃ³n (mismo criterio de los pines).
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-09-12 â€” Quitar Â«En lÃ­neaÂ» del bloque Radio

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Se elimina la lista Â«En lÃ­neaÂ» debajo de canales/PTT. QuiÃ©n estÃ¡ se ve en el chat de grupo (encabezado Â«N en lÃ­neaÂ»).
- **Archivos / refs:** `RadioPage.jsx`

## 2026-09-12 â€” PestaÃ±as/Encabezado: mismo ancho que una columna

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** El cuadro en PestaÃ±as/Encabezado usa el mismo ancho que **una** columna de Vista Columnas (4 pistas + PTT). Sigue a la izquierda de los botones, bloque a la derecha.
- **Archivos / refs:** `styles.css` (`.radio-ops-primary` grid)

## 2026-09-12 â€” PestaÃ±as/Encabezado: cuadro de canales con ancho fijo

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** El cuadro en PestaÃ±as/Encabezado deja de aplastarse: 28rem fijos, 1 columna y el `.channel-col` al 100%. Sigue pegado a la izquierda del PTT, bloque a la derecha.
- **Archivos / refs:** `styles.css`

## 2026-09-12 â€” Etiqueta al aire: punto medio entre cargo y canal

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Â«ENCARGADO Â· Grupo para pruebasÂ» (punto medio en lugar de coma).
- **Archivos / refs:** `radioSpeakerLabel.js`

## 2026-09-12 â€” PestaÃ±as/Encabezado: cuadro + PTT juntos a la derecha

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** En PestaÃ±as/Encabezado el cuadro de canales queda a la izquierda de Enviar alerta / Audio / Video / PTT, pegados, y el bloque entero alineado a la **derecha**. El cuadro tiene ancho fijo (~22rem) para no aplastarse.
- **Archivos / refs:** `styles.css` (`.radio-ops-primary:has(.layout-tabs|.layout-select)`)

## 2026-09-12 â€” Radio PestaÃ±as/Encabezado: fila canales|PTT sin hueco

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Se completa el layout: `radio-ops-primary` agrupa canales + PTT en una fila. En PestaÃ±as/Encabezado van pegados (`flex-start`); en Columnas siguen con espacio. Online/errores abajo en `radio-ops-secondary`.
- **Archivos / refs:** `RadioPage.jsx`, `styles.css`

## 2026-09-12 â€” Franja PTT mini oculta en Radio (visible en el resto)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** `cc-radio-strip` se oculta en `/despacho/radio` (ahÃ­ estÃ¡ el PTT grande) y se muestra en Consola, mapa y demÃ¡s rutas del despacho.
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-09-12 â€” Franja PTT mini solo en /despacho/radio

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** La barra `cc-radio-strip` (dock + PTT mini) solo se muestra en `/despacho/radio`. En Consola, mapa y resto del despacho ya no aparece.
- **Archivos / refs:** `DispatchLayout.jsx`
- **Nota:** En otras rutas el radio sigue en keepalive (audio); el PTT grande estÃ¡ en la pÃ¡gina Radio.

## 2026-09-12 â€” Mute + 1 al aire: incluir canal en etiqueta

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Con radio silenciada y una persona al aire: **Radio silenciada Â· ENCARGADO, Grupoâ€¦** (mismo formato que sin mute). MÃ¡s adelante se revisan/retoman etiquetas del mini PTT.
- **Archivos / refs:** `radioSpeakerLabel.js`

## 2026-09-12 â€” Etiquetas PTT (cargo, mute, varios) + bloque canales a la derecha

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
  - Etiquetas bajo PTT: cargo prioritario, Â«EstÃ¡s al aireÂ», mute combinado, Â«Varios al aireÂ» si â‰¥2 hablan.
  - `usePtt` rastrea varios speakers e incluye canales Escuchar en joins.
  - PestaÃ±as/Encabezado: canales + PTT juntos anclados a la **derecha** (`flex-end`, sin hueco). Columnas sin cambio.
- **Archivos / refs:** `radioSpeakerLabel.js`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `styles.css`

## 2026-09-12 â€” PestaÃ±as/Encabezado: canales pegados al PTT

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En PestaÃ±as/Encabezado, el cuadro de canales queda a la izquierda del PTT pero **junto** (`flex-start`, sin `space-between`). Columnas sigue con espacio entre bloques.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck:has(.layout-tabs|.layout-select)`)

## 2026-09-12 â€” PestaÃ±as/Encabezado: canales izq. / PTT der. (como Columnas)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Se corrige el orden: en PestaÃ±as y Encabezado el cuadro de canales va a la izquierda y los botones/PTT a la derecha (como en la referencia / Columnas). Se revirtiÃ³ el `order: -1` que los invertÃ­a.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck`)

## 2026-09-12 â€” PestaÃ±as/Encabezado: canales a la derecha del PTT

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En Vista PestaÃ±as o Encabezado, el cuadro de canales queda a la derecha de los botones/PTT (ya no pegado a la izquierda). En Columnas el layout no cambia.
- **Archivos / refs:** `styles.css` (`.radio-ops-deck:has(.layout-tabs|.layout-select)`)

## 2026-09-12 â€” Encabezado/PestaÃ±as: panel Escuchar a la derecha

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En Vista Encabezado, el select Escuchar/Hablar/Video/Alerta pasa a la derecha (Individual/MÃºltiple a la izquierda). En PestaÃ±as, Individual/MÃºltiple queda alineado a la derecha como en Columnas.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 â€” Alinear ancho del buscador de canales

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** El input Â«Buscar en listaâ€¦Â» alinea su ancho con la lista de checks/radios (se quitÃ³ el padding horizontal extra de `.channel-col-tools`).
- **Archivos / refs:** `styles.css`

## 2026-09-12 â€” Hints fijos Individual/MÃºltiple (sin resumen dinÃ¡mico)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** El pie de cada columna ya no cambia a Â«Oyendo Nâ€¦ / PTT a Nâ€¦ / etc.Â» al marcar varios; siempre muestra la ayuda Individual vs MÃºltiple. El conteo sigue en Â«N de M seleccionadosÂ».
- **Archivos / refs:** `ChannelMultiSelect.jsx`

## 2026-09-12 â€” Marco visual en columnas de canales

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Cada columna (Escuchar/Hablar/Video/Alerta) va en un Â«cuadritoÂ»: borde, radio 12px, fondo suave y sombra ligera, con lista e hint dentro.
- **Archivos / refs:** `styles.css` (`.channel-col`)

## 2026-09-12 â€” Etiquetas Individual/MÃºltiple + badge OIR

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
  - Hints claros por columna (Escuchar/Hablar/Video/Alerta) segÃºn Individual o MÃºltiple.
  - Badge **OIR** en canales marcados en Escuchar (junto a PTT / VID / ALE).
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 â€” Vista Columnas: ocultar flechas â†‘â†“

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En Vista **Columnas**, se ocultan las flechas subir/bajar de cada canal para ganar espacio; el orden sigue por arrastre (â‹®â‹®). En PestaÃ±as/Encabezado las flechas siguen visibles.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `styles.css`

## 2026-09-12 â€” Vista canales: opciÃ³n Â«EncabezadoÂ»

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En Vista de canales, Â«Select en encabezadoÂ» pasa a **Encabezado**.
- **Archivos / refs:** `ChannelMultiSelect.jsx`, `ConfigChannels.jsx`

## 2026-09-12 â€” Radio: Canal libre debajo PTT + select sin borde

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Â«Canal libreÂ» agrupado bajo los botones (columna `radio-ops-actions`), ya no al lado del PTT.
  - Select Individual/MÃºltiple sin contorno negro (`appearance: none` + sin outline).
- **Archivos / refs:** `RadioPage.jsx`, `styles.css`

## 2026-09-12 â€” Reaplicar pedidos 08:00â€“08:19 (Radio/mapa/sesiÃ³n)

- **Tipo:** fix | ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Â«Canal libreÂ» debajo de PTT/Videollamada en Radio.
  - Contador Â«N de M seleccionadosÂ» alineado a la derecha antes del `?`.
  - PTT: `unlockMediaAudio` + resume AudioContext antes de hablar (mini PTT y botÃ³n grande).
  - `SessionKeepaliveHost` + `ensureFreshSession` (JWT ~15 min antes); mapa/seguimiento solo muestran error tras **3** fallos seguidos; sockets con `socketAuth`.
  - Radio parked fuera de pantalla (evita capa invisible que congela clics).
  - Cargo completo en pines (sin ellipsis de 118px).
- **Archivos / refs:** `RadioPage.jsx`, `SessionKeepaliveHost.jsx`, `api.js`, `DispatchMap.jsx`, `LiveTrackMap.jsx`, `mapAvatarIcon.js`, `command-center.css`, `styles.css`

## 2026-09-12 â€” UI canÃ³nica `frontend\` + APK a pulsanet_soporte

- **Tipo:** infra | docs | fix
- **Ãrea:** infra | web | docs | mobile | ops
- **QuÃ©:**
  - Unificados ambos Ã¡rboles a `frontend\` (prod `:5173`, DEV `:5273`). Eliminado leftover `web\` de `C:\pulsanet` (copia idÃ©ntica archivada en `pulsanet_soporte\Archivo\web-leftover-C-pulsanet-20260912`).
  - Scripts/docs alineados: `start-web.cmd`, `LEVANTAR-TACTICALPTX.bat`, `Watch-Stack.ps1`, `docker-compose.prod.yml`, `SOPORTE.md`, `UBICACION_PROYECTO.md`, `README.md`.
  - `Publish-ApkUpdate.ps1` archiva APK vÃ­a `Resolve-AuxRoot.ps1` â†’ `C:\pulsanet_soporte\APK` (OTA sigue en `backend\app-updates`).
  - Corregido bug en `pulsanet-dev\LEVANTAR-TACTICALPTX.bat` (`pushd` a `web\` inexistente).
- **Por quÃ© / notas:** El organizador portable habÃ­a dejado prod como `web\`; contradecÃ­a el rename pedido. Vite ya corrÃ­a desde `frontend\`.
- **Archivos / refs:** `infra/start-web.cmd`, `infra/start-frontend.cmd`, `mobile/scripts/Publish-ApkUpdate.ps1`, `docs/SOPORTE.md`

## 2026-09-12 â€” Producto portable: soporte fuera y BD/arranque para mÃ¡quina nueva

- **Tipo:** infra | docs | ops
- **Ãrea:** infra | docs | database | ops
- **QuÃ©:**
  - Auxiliar unificado en `C:\pulsanet_soporte` (Documentos, Logs/restore-sep11, Brand, Cursor, APK). En el repo queda un puntero `Soporte\README.md`.
  - UI canÃ³nica: `frontend\` en prod y DEV (puertos distintos). *(Nota: una entrada posterior unifica el rename; no usar `web\`.)*
  - Nuevo `CREAR-O-ACTUALIZAR-BD.bat` (idempotente: crea BD si falta, schema si vacÃ­a, migraciones 001â†’030+; no DROP).
  - `LEVANTAR-TACTICALPTX.bat` y `LEVANTAR-DEV.bat` mÃ¡s claros; logs en `pulsanet_soporte\Logs` o `var\logs`.
- **Por quÃ© / notas:** Copiar el programa a otra mÃ¡quina sin mezclar dumps/IA ni las dos UIs.
- **Archivos / refs:** `CREAR-O-ACTUALIZAR-BD.bat`, `backend/src/scripts/apply-all-migrations.js`, `docs/SOPORTE.md`, `infra/Resolve-AuxRoot.ps1`

## 2026-09-12 â€” Restaurar UI y features al estado del 11-sep ~15:41

- **Tipo:** fix | ops
- **Ãrea:** web | backend
- **QuÃ©:**
  - DuckDNS servÃ­a el `web/` del merge de las 08:34 (rama 6-sep), no el trabajo de `pulsanet-dev/frontend` + parches del 11.
  - Restaurado el panel: mapa como inicio, catÃ¡logos (jerarquÃ­as/grados/empleos), admin (usuarios/grupos/sitios tÃ¡cticos), config (canales 4 columnas, grabaciones, presencia, respaldos).
  - Reaplicados parches del 11-sep hasta las 15:41: Escuchar/Hablar/Video/Alerta, Individual/MÃºltiple, PTT multi-canal, Radio (Enviar alerta / Audio / Videollamada).
  - Backend alineado con `pulsanet-dev` (rutas presencia, sitios tÃ¡cticos, migraciones 023â€“030).
- **Por quÃ© / notas:** El trabajo de ayer no estaba commiteado; un merge de esta maÃ±ana pisÃ³ `web/`. Copia previa en `Soporte/Logs/restore-sep11/`.
- **Archivos / refs:** `web/src/**`, `backend/src/**`, `database/migrations/023â€“030`

## 2026-09-12 â€” DuckDNS en blanco: faltaba RemoteMonitorConference

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - `https://pulsanet.duckdns.org/` devolvÃ­a HTML pero React no montaba (`#root` vacÃ­o).
  - Vite fallaba al resolver `./RemoteMonitorConference` desde `DispatchVideo.jsx` / `CommandCenter.jsx` (archivo no estaba en el tip del merge).
  - Restaurado `web/src/dispatch/RemoteMonitorConference.jsx` desde historial de agente; login vuelve a renderizar.
- **Archivos / refs:** `web/src/dispatch/RemoteMonitorConference.jsx`

## 2026-09-12 â€” Reinicio stack tras recuperaciÃ³n + fix FCM

- **Tipo:** fix | ops
- **Ãrea:** backend | web | ops
- **QuÃ©:**
  - Reiniciados API (:4000) y Web (:5173); health **1.8.84** ready.
  - La rama recuperada importaba `notifyUserDevicesDataOnly` pero no existÃ­a â†’ API no arrancaba; export aÃ±adido en `fcm.js`.
  - `/api/group-video` responde (401 sin token = ruta viva).
- **Archivos / refs:** `backend/src/services/fcm.js`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-09-12 â€” RecuperaciÃ³n rama video-panic + anti-regresiÃ³n

- **Tipo:** fix | ops
- **Ãrea:** web | backend | mobile | docs
- **QuÃ©:**
  - `main` estaba en **1.8.51** mientras el avance real vivÃ­a en `cursor/video-panic-stable-domain` (Video, cÃ¡mara remota, layout moderno, DuckDNS, etc.).
  - **Fast-forward** de esa rama a `main` (~17k lÃ­neas / 116 archivos).
  - Reparado `mapTiles.js` incompleto en el tip (`tileLayerProps`, `mapWorldProps`, zoom, **sin atribuciÃ³n Leaflet**).
  - Reaplicado cargo completo en pines + API ubicaciones.
  - Regla Cursor **anti-regresiÃ³n** (usuario + `.cursor/rules/anti-regresion.mdc`).
- **Por quÃ© / notas:** DuckDNS servÃ­a el tip viejo de `main`. PTT Individual/MÃºltiple puede seguir incompleto si solo existÃ­a en working tree no commiteado.
- **Archivos / refs:** merge `cursor/video-panic-stable-domain`, `mapTiles.js`, `mapAvatarIcon.js`, `DispatchVideo.jsx`, `groupVideo.js`

## 2026-09-06 â€” Fix re-ring en llamada + altavoz por defecto (1.8.84+94)

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - No abrir Contestar encima si ya hay llamada 1:1 (PrivateCallGate + guardas en socket/push/shell).
  - Backend 409 si caller/callee ya tienen llamada activa (evita re-marcar).
  - Voz: **auricular por defecto** al contestar (no altavoz); video/radio siguen manos libres.
  - Radio ensureBackgroundAudio / 
eleasePtt ya no fuerzan altavoz mientras hay llamada 1:1.
- **Archivos / refs:** private_call_gate.dart, private_call_screen.dart, channel_session.dart, radio_shell.dart, calls.js, dm.js

## 2026-09-06 â€” Panel web progresivo (fases 0â€“5)

- **Tipo:** feature | ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - **F0â€“1:** tokens/breakpoints (`720`/`960`), `useMediaQuery`, shell phone (bottom nav Radio/Chats/Personas/MÃ¡s), rail oculto, safe-area.
  - **F2:** inbox lista XOR hilo en phone; AtrÃ¡s; tab Chats â†’ lista; Personas/peer sheet full-bleed; touch â‰¥44px.
  - **F3:** overlays llamada `100dvh`+safe-area; `unlockMediaAudio` unificado; warmUp media con errores claros; mapa/video fullscreen `dvh`.
  - **F4:** Command Center tabs Mapa|Actividad â‰¤960; LiveTrack bottom sheet + capas drawer; Video mÃ¡x. 2 monitores en phone; tablas/catÃ¡logos 1 col / scroll.
  - **F5:** `manifest.webmanifest`, iconos, `offline.html`, SW shell cache (sin API/socket/LiveKit); higiene `(pointer: coarse)`.
- **Por quÃ© / notas:** web mÃ³vil = respaldo / mesa ligera; sin paridad FGS Flutter. Matriz: `Soporte/Documentos/MATRIZ_PRUEBA_PANEL_WEB.md`.
- **Archivos / refs:** responsive.css, useMediaQuery.js, DispatchLayout.jsx, ChatInbox.jsx, unlockMediaAudio.js, PrivateCall*, CommandCenter.jsx, LiveTrackMap.jsx, DispatchVideo.jsx, sw-notify.js, manifest.webmanifest

## 2026-09-06 â€” Calidad de video: nitidez sobre fluidez (1.8.83+93)

- **Tipo:** fix | mejora
- **Ãrea:** mobile | web
- **QuÃ©:**
  - `degradationPreference` pasa de `maintainFramerate` a `maintainResolution`: el encoder baja FPS en vez de reescalar a 360p (se veÃ­a borroso aun en la misma red).
  - Bitrate alineado a **3.2 Mbps** en mÃ³vil y web (antes mÃ³vil publicaba 2.8 con captura de 3.2).
  - Web: `adaptiveStream: false` â€” el mosaico enlaza por `srcObject`, asÃ­ que adaptiveStream no observaba los elementos y solo podÃ­a pausar tracks.
- **Por quÃ© / notas:** VP8 por software en Android satura CPU a 720p30; con `maintainFramerate` WebRTC reescala la resoluciÃ³n y la imagen se ve suave/pixelada aunque haya ancho de banda de sobra.
- **Archivos / refs:** video_streaming_config.dart, videoStreaming.js

## 2026-09-06 â€” Fix switch frontal/trasera Ver cÃ¡mara (1.8.82+92)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - `setCameraEnabled(false/true)` solo muteaba el mismo track: no cambiaba facing.
  - Switch ahora: `setCameraPosition` â†’ recrear track (`removePublishedTrack` + `createCameraTrack`) â†’ fallback.
  - Socket dedicado tambiÃ©n escucha `call:remote_control` (backup + dedupe).
- **Archivos / refs:** remote_camera_session.dart

## 2026-09-06 â€” Fix Ver cÃ¡mara splash + SafeArea Llamadas (1.8.81+91)

- **Tipo:** fix
- **Ãrea:** mobile | web
- **QuÃ©:**
  - FCM `private_remote_camera` ya no usa `IncomingCallWake`/`launchApp` si auto-accept (evita recrear Activity â†’ splash).
  - Boot: si hay pending remote cam, se acepta en silencio y se difiere OTA forzada ~4 s.
  - FGS: al activar cÃ¡mara se hace `forceRestart` para aplicar tipo `camera` (Android 14+).
  - Wake background: persist + bring UI; FGS camera lo arranca el isolate principal.
  - `PrivateCallHost`: si despacho marca `handled`, no abre overlay 1:1.
  - Cabecera **Llamadas**: `SafeArea` para no montarse bajo la barra de estado.
- **Archivos / refs:** main.dart, push_service.dart, remote_camera_wake.dart, incoming_call_wake.dart, background_radio.dart, radio_shell.dart, call_history_pane.dart, PrivateCallHost.jsx

## 2026-09-04 â€” Aislamiento video/monitor + estabilidad control (APK 1.8.72)

## 2026-09-06 â€” RediseÃ±o web: Personas y llamadas

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - Paleta Personas global (Ctrl+K) + ficha de acciones (mensaje / llamada / video / ver cÃ¡mara).
  - Host Ãºnico de llamadas (`PrivateCallHost`) entrantes y salientes; inbox con pestaÃ±a Personas y acciones rÃ¡pidas.
  - DM: iconos de llamada visibles; grupo: roster completo + acciones por miembro; Radio â€œEn lÃ­neaâ€ abre ficha.
  - Despacho alineado (layout, consola, video, seguimiento, usuarios â†’ Contactar).
- **Archivos / refs:** peerActions.js, PrivateCallHost.jsx, PeoplePalette.jsx, PeerActionSheet.jsx, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, RadioPage.jsx, DispatchLayout.jsx, CommandCenter.jsx, DispatchVideo.jsx

## 2026-09-06 â€” UI llamada web: avatar + banner entrante

- **Tipo:** fix | ux | feature
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Overlay de llamada muestra foto del usuario (`PersonAvatar`); avatar ya no se monta encima del texto (CSS `absolute` corregido).
  - Estados cortos (Â«En llamadaÂ») sin repetir el nombre en cabecera y cuerpo.
  - Banner flotante global de llamada entrante (arriba/derecha) para Contestar/Rechazar sin abrir el panel de chat.
- **Archivos / refs:** IncomingCallHost.jsx, PrivateCallOverlay.jsx, DirectChat.jsx, App.jsx, styles.css, private_call_screen.dart

## 2026-09-06 â€” Fix OTA automÃ¡tica (APK 1.8.79+89)

- **Tipo:** fix | release
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - OTA forzada vuelve a bloquear el arranque al detectar versiÃ³n nueva (no solo al terminar).
  - Reintento tras login; timeout manifiesto 12s + 1 reintento; token descarga 1h.
  - Publicada **1.8.79+89**.
- **Archivos / refs:** main.dart, app_update.dart, appUpdate.js, Soporte/APK/TacticalPtx-1.8.79+89.apk

## 2026-09-06 â€” APK 1.8.78+88 (llamadas nÃ­tidas + E2EE + Alertas)

- **Tipo:** release
- **Ãrea:** mobile
- **QuÃ©:** Publicada OTA **1.8.78+88** (audio llamadas sin NS/DTX agresivo; sala+E2EE v3 por sesiÃ³n; botÃ³n Alertas; timeout 5 timbres / llamada perdida; pantalla Contestar).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.78+88.apk

## 2026-09-06 â€” Llamadas: nitidez, E2EE e integridad

- **Tipo:** mejora | security | fix
- **Ãrea:** mobile | web | backend
- **QuÃ©:**
  - Audio de llamadas alineado con PTT (sin noise suppression/DTX/RED agresivos) â†’ voz mÃ¡s nÃ­tida.
  - Sala LiveKit **Ãºnica por llamada** + clave E2EE **v3** por sesiÃ³n; fail-closed si `e2ee: true` sin clave.
  - Video ~2.8 Mbps + adaptiveStream + preferir framerate bajo congestiÃ³n; token LiveKit TTL 1h.
- **Archivos / refs:** voiceE2ee.js, dm.js, livekit.js, video_streaming_config.dart, videoStreaming.js, livekitE2ee.js, private_call_screen.dart, PrivateCallOverlay.jsx

## 2026-09-06 â€” APK 1.8.77+87: botÃ³n Alertas + llamadas

- **Tipo:** release | ux
- **Ãrea:** mobile | backend
- **QuÃ©:** Publicada APK con botÃ³n Radio **Alertas** (ya no Â«PÃNICOÂ»), textos de overlay/chat/FCM alineados; incluye fixes de llamada entrante y timeout 5 timbres.
- **Archivos / refs:** radio_screen.dart, radio_shell.dart, panic.js, Soporte/APK/TacticalPtx-1.8.77+87.apk

## 2026-09-06 â€” Llamada entrante a pantalla + 5 timbres / perdida

- **Tipo:** fix | feature | ux
- **Ãrea:** mobile | backend | web
- **QuÃ©:**
  - Entrante: abre pantalla Contestar (trae app al frente); FCM data-only sin banner del sistema; full-screen intent solo de respaldo en segundo plano.
  - Sin respuesta tras **5 timbres (~25 s)**: el servidor cuelga y manda push Â«Llamada perdidaÂ» al destino (estilo WhatsApp); el llamante ve Â«Sin respuestaÂ».
- **Archivos / refs:** calls.js (sweeper), dm.js, server.js, incoming_call_wake.dart, MainActivity.kt, channel_session.dart, push_service.dart, radio_shell.dart

## 2026-09-06 â€” BotÃ³n PÃ¡nico â†’ Alertas

- **Tipo:** ux
- **Ãrea:** mobile | web
- **QuÃ©:** La etiqueta del botÃ³n de pÃ¡nico en Radio pasa de Â«PÃNICOÂ» a Â«AlertasÂ» (app y web).
- **Archivos / refs:** mobile/lib/screens/radio_screen.dart, web/src/pages/RadioPage.jsx

## 2026-09-06 â€” Contraste pantalla de llamada

- **Tipo:** ux
- **Area:** mobile
- **Que:** Fondos y botones de llamada mas claros/visibles; colgar en rojo vivo; titulo y etiquetas con mayor contraste.
- **Archivos / refs:** theme.dart (kInstCall*), private_call_screen.dart

## 2026-09-06 â€” APK 1.8.76+86 (arranke rapido + nav llamadas)

- **Tipo:** release
- **Area:** mobile
- **Que:** Publicada OTA **1.8.76+86** (splash sesion no bloquea por OTA; nav Chats/Llamadas/Radio abajo; timbre llamadas).
- **Archivos / refs:** Soporte/APK/TacticalPtx-1.8.76+86.apk

## 2026-09-06 â€” Nav inferior: Chats / Llamadas / Radio

- **Tipo:** ux
- **Area:** mobile
- **Que:** Llamadas pasan a la barra inferior junto a Chats y Radio; se quita el toggle Chats|Llamadas de arriba en el inbox.
- **Archivos / refs:** radio_shell.dart, chat_inbox_screen.dart, call_history_pane.dart

## 2026-09-06 â€” Reabrir app: sin splash Â«Cargando sesionÂ» lento

- **Tipo:** fix | ux
- **Area:** mobile
- **Que:**
  - Arranque: carga sesion local primero y muestra home; OTA/Push/Shorebird en segundo plano.
  - RadioShell libera UI al tener grupos (LiveKit/FGS no bloquean).
  - Timeouts cortos en loadSession (4s) y fetchGroups (8s).
- **Archivos / refs:** mobile/lib/main.dart, mobile/lib/screens/radio_shell.dart

## 2026-09-06 â€” Timbre/vibracion llamadas + ciclo de vida

- **Tipo:** feature | fix
- **Area:** mobile | web | backend
- **Que:**
  - Timbre nativo Android (ringtone del sistema) + vibracion en bucle al recibir voz/video.
  - Canal FCM/local 	acticalptx_calls_v2 con USAGE_NOTIFICATION_RINGTONE + fullScreenIntent.
  - Tope de reconexion/connect; endPrivateCall en salidas fallidas; mensaje si la llamada ya expiro.
- **Archivos / refs:** MainActivity.kt, call_ringtone.dart, incoming_call_screen.dart, push_service.dart, private_call_screen.dart, PrivateCallOverlay.jsx, fcm.js â€” APK **1.8.75+85**

## 2026-09-06 â€” Eliminar Radio personal 1:1 (app + web)

- **Tipo:** feature | breaking
- **Area:** mobile | web | backend
- **Que:**
  - Retirada la opcion de iniciar Radio personal / PTT 1:1 en APK y Web.
  - API rechaza mode=radio en llamadas privadas.
  - Invitaciones residuales se rechazan automaticamente.
- **Archivos / refs:** peer_actions.dart, direct_pane.dart, ChatInbox.jsx, DirectChat.jsx, WhatsAppChat.jsx, calls.js

## 2026-09-04 â€” Mensaje permiso de camaras (APK)

- **Tipo:** ux
- **Area:** mobile
- **Que:**
  - Dialogo y textos de permiso de camara reducidos a: Â«Permiso de camaras unicamenteÂ».
- **Archivos / refs:** mobile/lib/screens/radio_shell.dart
- **APK:** 1.8.73+83

## 2026-09-04 â€” Reordenar modulos del menu lateral

- **Tipo:** feature | ux
- **Area:** web
- **Que:**
  - Arrastrar (asa â‹®â‹®) los modulos del rail para reacomodarlos.
  - El orden se guarda en localStorage.
- **Archivos / refs:** DispatchLayout.jsx, institutional.css

## 2026-09-04 â€” Sin etiqueta de nombre bajo pins del mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Quitada la pastilla de nombre bajo el marcador; el detalle solo al seleccionar (panel/popup).
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

## 2026-09-04 â€” Indicativo desde Cargo / puesto

- **Tipo:** feature | ux
- **Area:** web | backend
- **Que:**
  - Eliminados campos Indicativo al aire y Detalle/expansion.
  - El nombre visible se arma solo: Grado + Apellido[, cargo] (ej. Sgto. 1/o. Gomez, desarrollador).
  - Quitados textos/ayudas del formulario de usuarios.
- **Archivos / refs:** rfcUsername.js, DispatchUsers.jsx, admin.js

## 2026-09-04 â€” Mas zoom en mapas de despacho

- **Tipo:** mejora | ux
- **Area:** web
- **Que:**
  - Zoom maximo del mapa sube a **22** (antes ~18), con overzoom sobre tiles nativos 19.
  - Ajuste automatico al grupo de operadores permite acercar mas (hasta 18).
- **Archivos / refs:** web/src/dispatch/mapTiles.js, LiveTrackMap, DispatchMap, CommandCenter, mapLeafletUtils

## 2026-09-04 â€” Formato de matricula (letra-guion-numeros)

- **Tipo:** feature | fix
- **Area:** web | backend
- **Que:**
  - Matricula siempre en formato Letra-Numeros (ej. A-1234, B-2048).
  - Mascara en el formulario de usuarios; validacion en API al crear/editar.
- **Archivos / refs:** web/src/matricula.js, backend/src/services/matricula.js, DispatchUsers.jsx, admin.js

## 2026-09-04 â€” Pins de ubicacion redondos (gota)

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Correccion: ubicaciones en mapa como pin gota redondo (foto circular), no cuadrado.
  - Se conservan colores, live, panico y avatar de cada usuario.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

## 2026-09-04 â€” Forma de pins de ubicacion en mapa

- **Tipo:** ux
- **Area:** web
- **Que:**
  - Marcadores de ubicacion: silueta gota/teardrop sustituida por badge cuadrado redondeado + punta triangular.
  - Colores (verde / en vivo / panico) y foto circular del usuario sin cambios.
- **Archivos / refs:** web/src/dispatch/command-center.css, web/src/dispatch/mapAvatarIcon.js

- **Tipo:** fix | security | mejora
- **Ãrea:** web | mobile | backend
- **QuÃ©:**
  - Ver cÃ¡mara y videollamada ya no comparten flags ni pelean por la cÃ¡mara (CameraSessionGate).
  - Control remoto deduplicado + cola de facing; fallos no cuelgan la sesiÃ³n.
  - Conferencia Expandir sin remount LiveKit; monitor sin mic del puesto ni privateCallUi.
  - ExclusiÃ³n mutua mismo peer (Ver cÃ¡mara â†” videollamada).
  - APK **1.8.72+82**.
- **Archivos / refs:** camera_session_gate.dart, 
emote_camera_session.dart, RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, privateCallUi.js

## 2026-09-03 â€” Fix cambio cÃ¡mara frontal/trasera (APK 1.8.71)

- **Tipo:** fix
- **Ãrea:** mobile | web
- **QuÃ©:**
  - Control remoto tambiÃ©n por socket principal + data packet LiveKit.
  - Cambio de cÃ¡mara reinicia el track (offâ†’on con facing nuevo); setCameraPosition no bastaba en FGS.
  - APK **1.8.71+80**.
- **Archivos / refs:** 
emote_camera_session.dart, channel_session.dart, PrivateCallOverlay.jsx

## 2026-09-03 â€” Conferencia multi-cÃ¡mara + dock centrado

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - Varias Â«Ver cÃ¡maraÂ» en un mosaico tipo conferencia (RemoteMonitorConference).
  - Dock del monitor: barra a ancho completo; EN VIVO a la izquierda y controles centrados (ya no el bloque de 26rem a la izquierda).
- **Archivos / refs:** RemoteMonitorConference.jsx, PrivateCallOverlay.jsx, DispatchVideo.jsx, CommandCenter.jsx, command-center.css, styles.css

## 2026-09-03 â€” Multi-monitor + control frontal/trasera/mic

- **Tipo:** feature
- **Ãrea:** web | backend | mobile
- **QuÃ©:**
  - Varias Â«Ver cÃ¡maraÂ» a la vez, apiladas en el panel (Video y Command Center).
  - Control remoto: cÃ¡mara frontal/trasera y micrÃ³fono ON/OFF del dispositivo.
  - API POST /private/:id/remote-control + socket call:remote_control.
  - APK **1.8.70+79** (FGS microphone al activar mic remoto).
- **Archivos / refs:** DispatchVideo.jsx, CommandCenter.jsx, PrivateCallOverlay.jsx, calls.js, 
emote_camera_session.dart

## 2026-09-03 â€” Monitor: centrado real + pantalla completa usable

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Corregido el colapso del stage (tile absolute â†’ barra fea arriba).
  - Un solo video centrado en X/Y con flex; sin caja horizontal ancha.
  - **Pantalla completa** = alto completo del stage (marco vertical centrado).
- **Archivos / refs:** `styles.css`, `PrivateCallOverlay.jsx`

## 2026-09-03 â€” Monitor: centrado en pantalla + tamaÃ±o pantalla completa

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Un solo video queda **centrado en la pantalla** (absolute 50%/50%).
  - Nuevo tamaÃ±o **Pantalla completa** (`fill`) que ocupa todo el stage.
  - TamaÃ±o solo en Expandir; al abrir Expandir arranca en pantalla completa.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`

## 2026-09-03 â€” Monitor Expandir: video centrado + tamaÃ±o funcional

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
  - Un solo video queda **centrado** (Expandir y panel).
  - **TamaÃ±o** solo en Expandir; escala real vÃ­a `--vc-solo-h` (40â†’84vh).
  - Quitado el control del panel normal; al Expandir arranca en MÃ¡ximo.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 â€” UI monitor cÃ¡mara: pantalla completa redistribuida

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Vista Expandir de Â«CÃ¡mara del dispositivoÂ» tipo sala de monitoreo: chrome superior, stage a pantalla completa, dock inferior con estado EN VIVO + acciones; video portrait/landscape centrado y mÃ¡s usable.
- **Archivos / refs:** `PrivateCallOverlay.jsx`, `styles.css`

## 2026-09-03 â€” Ver cÃ¡mara con app cerrada / suspendida (APK 1.8.69)

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - FCM en background ya no se ignora: guarda la solicitud, arranca FGS `camera` y **reabre la app** (sin Contestar) para publicar LiveKit.
  - Al reanudar/arranque se drena el pending y activa la cÃ¡mara en silencio.
- **Archivos / refs:** `remote_camera_wake.dart`, `push_service.dart`, `radio_shell.dart`, `fcm.js`

## 2026-09-03 â€” CÃ¡mara remota con pantalla bloqueada (APK 1.8.68)

- **Tipo:** fix | feature
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - FGS Android con tipo **`camera`** + wake/wifi lock para que Â«Ver cÃ¡maraÂ» no se suspenda al bloquear el telÃ©fono.
  - Watchdog republica la cÃ¡mara si el SO la apaga; FCM data-only (sin banner) para despertar con pantalla bloqueada.
- **Archivos / refs:** `background_radio.dart`, `remote_camera_session.dart`, `AndroidManifest.xml`, `fcm.js`, `calls.js`

## 2026-09-03 â€” Emoji/Stickers: safe area barra de navegaciÃ³n (APK 1.8.67)

- **Tipo:** fix | ux
- **Ãrea:** mobile
- **QuÃ©:** Los tabs Emoji/Stickers ya no se montan sobre los botones del sistema; padding inferior con `viewPadding`.
- **Archivos / refs:** `chat_emoji_panel.dart`

## 2026-09-03 â€” Chat: emojis y adjuntos mejorados (APK 1.8.66)

- **Tipo:** mejora | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Panel de emojis con tipografÃ­a color-emoji mÃ¡s nÃ­tida, acentos tÃ¡cticos (sin verde WhatsApp), sin pestaÃ±a GIF vacÃ­a; mÃ³vil gana **bÃºsqueda + recientes**.
  - MenÃº adjuntar tipo iconos (GalerÃ­a / CÃ¡mara / Video / Documento); en mÃ³vil, vista previa + leyenda antes de enviar; fotos a mayor calidad.
- **Archivos / refs:** `WaEmojiPicker.jsx`, `styles.css`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_emoji_panel.dart`, `chat_attach_sheet.dart`, `emoji_data.dart`

## 2026-09-03 â€” Ver cÃ¡mara silenciosa (sin aviso en el mÃ³vil) APK 1.8.65

- **Tipo:** fix | ux
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Con permiso previo, **Ver cÃ¡mara** solo publica el feed a LiveKit: **sin push FCM, sin notificaciÃ³n local, sin vibraciÃ³n, sin snackbar y sin abrir panel de video** en el telÃ©fono.
  - SesiÃ³n headless `RemoteCameraSession`; al colgar desde despacho se apaga sola.
- **Archivos / refs:** `remote_camera_session.dart`, `radio_shell.dart`, `channel_session.dart`, `backend/src/routes/calls.js`

## 2026-09-03 â€” Video nÃ­tido 720p + Expandir sin perder imagen (APK 1.8.64)

- **Tipo:** fix | mejora | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - CodificaciÃ³n a **720p / ~3.2 Mbps / 30 FPS / VP8** (antes 540p â€œestableâ€ se veÃ­a pixelada).
  - **Expandir** ya no deja el video negro: un solo mosaico enganchado al track (panel o fullscreen).
  - Panel de video en despacho: tamaÃ±os **Compacto / Mediano / Grande / MÃ¡ximo** + pantalla completa mÃ¡s grande; `object-fit: contain` en 1 tile.
- **Archivos / refs:** `videoStreaming.js`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`, `VideoConferenceMosaic.jsx`, `styles.css`, `command-center.css`

## 2026-09-03 â€” CÃ¡mara remota: permiso inicial + auto-aceptar (APK 1.8.63)

- **Tipo:** feature
- **Ãrea:** mobile | web
- **QuÃ©:**
  - Al entrar a la app (primera vez): diÃ¡logo para permitir que **despacho active la cÃ¡mara** + permiso del SO.
  - Con eso activo, **Ver cÃ¡mara** desde el panel web acepta sola (sin Contestar); snackbar Â«Despacho activÃ³ tu cÃ¡maraÂ».
  - Interruptor en perfil del mÃ³vil para activar/desactivar.
- **Archivos / refs:** `remote_camera_prefs.dart`, `radio_shell.dart`, `channel_session.dart`, `DispatchVideo.jsx`

## 2026-09-03 â€” Intermitencia video: ICE/UPnP + bitrate + reconnect (APK 1.8.62)

- **Tipo:** fix | infra
- **Ãrea:** infra | web | mobile
- **QuÃ©:**
  - LiveKit usaba puertos UDP altos (50000+) **sin UPnP** â†’ media 4G inestable; vuelto a **UDP mux 7882** + relays TURN 30000â€“30010 mapeados.
  - Video a **540p / 1.2 Mbps / VP8 / sin simulcast** (prioridad continuidad en 4G).
  - Stabilizer deja de spamear â€œReconectandoâ€¦â€ en microcortes; LiveKit reiniciado.
  - APK **1.8.62+71** OTA.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `Reinforce-UPnP.ps1`, `videoStreaming.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`

## 2026-09-03 â€” Video negro: VP8 + attach srcObject (APK 1.8.61)

- **Tipo:** fix
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Causa tÃ­pica de tiles negros con audio OK: **H.264 + E2EE** entre web y APK.
  - Codec de publicaciÃ³n vuelve a **VP8**; attach del mosaico vÃ­a `MediaStream`/`srcObject`; dynacast off; monitor sin tile local vacÃ­o.
  - APK **1.8.61+70** OTA.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `video_streaming_config.dart`, `PrivateCallOverlay.jsx`

## 2026-09-03 â€” APK 1.8.60+69 (estabilidad video)

- **Tipo:** fix | release
- **Ãrea:** mobile
- **QuÃ©:**
  - Compilada y publicada OTA **APK 1.8.60+69** con fixes de parpadeo/intermitencia de video (simulcast 480/720, adaptiveStream off, reconnect suave).
  - `API_BASE=https://pulsanet.duckdns.org`; `APP_VERSION` backend â†’ **1.8.60**.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.60+69.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-09-03 â€” Estabilidad video (fin de parpadeo / intermitencia)

- **Tipo:** fix
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Baja carga de uplink: simulcast 480p+720p (~6 Mbps) en lugar de 480+720+1080 (~14.5 Mbps) que saturaba la red.
  - `adaptiveStream` desactivado (evitaba resubscribe al redimensionar tiles).
  - No republicar cÃ¡mara en cada `Reconnected` salvo track muerto; debounce de unsubscribes; mosaico mantiene Ãºltimo frame.
  - Stabilizer: no fuerza `connect` encima de la reconexiÃ³n interna de LiveKit; delays mÃ¡s largos.
- **Archivos / refs:** `videoStreaming.js`, `VideoConferenceMosaic.jsx`, `usePrivateCallTiles.js`, `useGroupVideo.js`, `privateCallStabilizer.js`, `video_streaming_config.dart`, `private_call_screen.dart`, `group_video_screen.dart`

## 2026-09-03 â€” Perfiles video RTMP-like (480/720/1080 @ 30 FPS)

- **Tipo:** mejora
- **Ãrea:** web | mobile
- **QuÃ©:**
  - PublicaciÃ³n LiveKit con perfiles tipo RTMP externo: H.264, 30 FPS, techos CBR-like **480p/1500 Kbps**, **720p/4500 Kbps**, **1080p/8500 Kbps** (simulcast + captura 1080).
  - Audio de sala a Opus HQ stereo (~AAC 128 kbps); captura con fallback 1080â†’720â†’540 si el dispositivo no abre Full HD.
- **Por quÃ© / notas:** WebRTC no tiene CBR estricto ni AAC en el peer; el techo de bitrate + `maintain-framerate` aproximan el perfil pedido. AAC real solo en egress RTMP externo.
- **Archivos / refs:** `web/src/videoStreaming.js`, `web/src/useGroupVideo.js`, `web/src/PrivateCallOverlay.jsx`, `mobile/lib/video_streaming_config.dart`

## 2026-09-03 â€” Ver cÃ¡mara del dispositivo desde consola Video

- **Tipo:** feature
- **Ãrea:** web | backend | mobile
- **QuÃ©:**
  - Desde **Despacho â†’ Video** (y Operaciones): botÃ³n **Ver cÃ¡mara** solicita activar la cÃ¡mara del dispositivo de campo y proyecta el feed en el panel (sin publicar cam del puesto por defecto).
  - Intent `remote_camera`: FCM/socket Â«Solicitud de cÃ¡maraÂ»; en el mÃ³vil se muestra Â«Despacho solicita ver tu cÃ¡maraÂ» y se prioriza cÃ¡mara **trasera**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `dm.js`, `DispatchVideo.jsx`, `CommandCenter.jsx`, `PrivateCallOverlay.jsx`, `incoming_call_screen.dart`, `private_call_screen.dart`, `radio_shell.dart`

## 2026-09-03 â€” Video negro en consola / tras reconectar

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Vista previa de cÃ¡mara: stream se enganchaba a un `<video>` que luego se desmontaba.
  - Videollamada en consola: mosaico sin altura Ãºtil + tile local no se refrescaba; tras Â«ConexiÃ³n restauradaÂ» no se republicaba la cÃ¡mara (frame negro con Â«Apagar camÂ» activo).
- **Archivos / refs:** `DispatchVideo.jsx`, `PrivateCallOverlay.jsx`, `usePrivateCallTiles.js`, `VideoConferenceMosaic.jsx`, `useGroupVideo.js`, CSS

## 2026-09-03 â€” Vista previa cÃ¡mara consola negra

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** En mÃ³dulo Video, al activar cÃ¡mara web el preview quedaba negro porque el stream se enganchaba a un `<video>` que luego se desmontaba. Ahora el elemento es estable y se re-engancha el stream.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `command-center.css`

## 2026-09-03 â€” Ancla DuckDNS pulsanet + APK 1.8.59

- **Tipo:** infra | fix
- **Ãrea:** infra | mobile
- **QuÃ©:**
  - Dominio permanente **`pulsanet.duckdns.org`** configurado (DuckDNS A â†’ IP pÃºblica; Sync/Watch lo mantienen).
  - Caddy + Let's Encrypt en ese host; `.env` / APK default apuntan ahÃ­.
  - APK **1.8.59+68** OTA con `API_BASE=https://pulsanet.duckdns.org`.
- **Por quÃ© / notas:** Ya no hace falta republicar APK cuando el ISP cambie la IP.
- **Archivos / refs:** `Soporte/Secrets/stable-domain.env`, `infra/caddy/stable-domain.txt`, `mobile/lib/config.dart`

## 2026-09-03 â€” APK ancla dominio permanente (anti-desfase IP)

- **Tipo:** fix | infra | feature
- **Ãrea:** mobile | infra
- **QuÃ©:**
  - Causa: APK apuntaba a `189.152.222.98.sslip.io` (IP vieja); el ISP ahora es `189.152.160.81`.
  - APK **1.8.58+67** OTA con `API_BASE=https://189.152.160.81.sslip.io`; borde Caddy realineado.
  - Ancla permanente: DuckDNS vÃ­a `infra\SETUP-STABLE-DOMAIN.ps1` + `Sync-PublicIp` (actualiza A-record al cambiar IP; el APK ya no depende de `IP.sslip.io`).
  - Login mÃ³vil: opciÃ³n **Servidor** para fijar URL si aÃºn no hay OTA.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `SETUP-STABLE-DOMAIN.ps1`, `START-PUBLIC-EDGE.ps1`, `mobile/lib/config.dart`, `login_screen.dart`, `Publish-ApkUpdate.ps1`

## 2026-09-03 â€” MÃ³dulo Video en despacho + cÃ¡mara consola

- **Tipo:** feature | fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - MenÃº **Video** en el rail de despacho (junto a Operaciones / Seguimiento) â†’ `/despacho/video`.
  - Consola con canales (iniciar/unirse a transmisiÃ³n), operadores en lÃ­nea (videollamada 1:1) y botÃ³n **Activar cÃ¡mara web** del puesto (vista previa + permiso del navegador).
  - Controles de cÃ¡mara con texto claro en panel de consola; fix Radio PTT: el botÃ³n Â«Video en vivoÂ» ahora envÃ­a `groupId`.
- **Por quÃ© / notas:** Faltaba un mÃ³dulo dedicado y una opciÃ³n explÃ­cita de cÃ¡mara en consola; el botÃ³n de Radio no abrÃ­a la sesiÃ³n.
- **Archivos / refs:** `web/src/dispatch/DispatchVideo.jsx`, `DispatchLayout.jsx`, `App.jsx`, `GroupVideoPanel.jsx`, `RadioPage.jsx`

## 2026-09-03 â€” Marcador en mapa: anillo rojo parpadeante en pÃ¡nico

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:** Al activar pÃ¡nico, el cÃ­rculo verde del pin del operador en el mapa pasa a rojo y parpadea (Centro de mando, Mapa en vivo y Mapa de despacho) hasta que el evento se cierra.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `command-center.css`, `CommandCenter.jsx`, `LiveTrackMap.jsx`, `DispatchMap.jsx`

## 2026-09-03 â€” Sin pin de pÃ¡nico en (0,0)

- **Tipo:** fix | ux
- **Ãrea:** web | mobile
- **QuÃ©:** El mapa ya no dibuja Â«Punto de pÃ¡nicoÂ» en coordenadas `0,0` (Null Island). Se trata como sin GPS; botones de mapa solo con ubicaciÃ³n vÃ¡lida.
- **Por quÃ© / notas:** Ese pin no era un operador real: pÃ¡nico enviado sin GPS fijado.
- **Archivos / refs:** `web/src/panicMaps.js`, `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/DispatchPanicHost.jsx`, `mobile/lib/panic_maps.dart`

## 2026-09-02 â€” Acceso LAN por IP + stack caÃ­do / IP pÃºblica nueva

- **Tipo:** fix | infra
- **Ãrea:** infra
- **QuÃ©:**
  - Causa de Â«no entraÂ» por `192.168.68.51`: esa IP **no es** del servidor (LAN actual `192.168.1.216`); ademÃ¡s API/Web/Caddy estaban caÃ­dos.
  - Borde Caddy ahora sirve tambiÃ©n **`https://192.168.1.216`** (cert interno).
  - IP pÃºblica del ISP cambiÃ³ a **`189.152.160.81`** â†’ dominio `https://189.152.160.81.sslip.io`.
  - LiveKit no arrancaba por YAML corrupto (`control characters`); reescrito `livekit.dev.yaml`.
- **Archivos / refs:** `infra/Caddyfile.edge.template`, `infra/START-PUBLIC-EDGE.ps1`, `infra/livekit.dev.yaml`

## 2026-09-02 â€” MenÃº Video + cambio cÃ¡mara frontal/trasera

- **Tipo:** feature | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - OpciÃ³n **Video en vivo** en menÃº Radio (â˜°), menÃº del chat de grupo y menÃº de Directos (Videollamada).
  - En videollamada 1:1 y transmisiÃ³n grupal: botÃ³n para alternar **cÃ¡mara frontal â†” trasera** (web + mobile); preview local sin espejo en trasera.
- **Por quÃ© / notas:** Equipos institucionales con permisos de cÃ¡mara; el agente debe poder mostrar entorno (trasera) o rostro (frontal) sin salir de la llamada.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `private_call_screen.dart`, `group_video_screen.dart`, `web/src/PrivateCallOverlay.jsx`, `web/src/useGroupVideo.js`, `web/src/videoStreaming.js`

## 2026-09-01 â€” Video grupal: cierre global + aceptar sin parpadeo

- **Tipo:** fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - **`group:video_ended`** llega a todos los miembros por sala `user:*` (no solo canal PTT) â€” al colgar/terminar cierra video e invitaciÃ³n en web y mobile.
  - **Web:** panel Ãºnico en `App` al aceptar invitaciÃ³n (sin navegaciÃ³n retrasada ni doble conexiÃ³n LiveKit).
  - **Mobile:** al aceptar o tocar notificaciÃ³n abre video directo (sin cambiar canal PTT); evita pop accidental del diÃ¡logo sobre la pantalla de video.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/GroupVideoSessionHost.jsx`, `web/src/useGroupVideo.js`, `mobile/lib/screens/radio_shell.dart`

## 2026-09-01 â€” Fix entrega notificaciones video grupal + modo telÃ©fono

- **Tipo:** fix
- **Ãrea:** backend | mobile
- **QuÃ©:**
  - InvitaciÃ³n grupal por **tres vÃ­as**: socket `user:*`, socket `group:*` (canal PTT) y FCM **por miembro** (`notifyUserDevices`, igual que llamadas 1:1).
  - Join explÃ­cito a sala `user:{id}` en cada conexiÃ³n socket del servidor.
  - Mobile: escucha tambiÃ©n `group:video_started`; deduplica invitaciones; notificaciÃ³n local respeta **silencio / vibrador / sonido** del telÃ©fono.
- **Por quÃ© / notas:** La invitaciÃ³n solo iba a `user:*` y el batch FCM podÃ­a no entregar; miembros en el canal del grupo no recibÃ­an evento si fallaba la sala personal.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/server.js`, `backend/src/services/fcm.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 â€” Notificaciones transmisiÃ³n grupal (FCM + socket + tono/vibraciÃ³n)

- **Tipo:** feature | fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - Al iniciar video grupal: push FCM a miembros + evento `group:video_incoming` por sala `user:*` (llega aunque no estÃ©n en el canal PTT).
  - Web: pantalla **Unirse/Ignorar** con tono de llamada; mobile: pantalla entrante estilo llamada + canal `tacticalptx_calls`.
  - VibraciÃ³n respeta modo **silencio** del telÃ©fono (Android); sonido usa tono del sistema (respeta vibrador/silencio).
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `backend/src/services/fcm.js`, `web/src/GroupVideoIncomingHost.jsx`, `mobile/lib/push_service.dart`, `mobile/lib/ringer_mode.dart`

## 2026-09-01 â€” Fix video grupal: cÃ¡mara local no se mostraba

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Corregido bug donde el mosaico quedaba en Â«Sin cÃ¡maraÂ» aunque LiveKit publicara video (rebuild de tiles antes de actualizar estado); lectura de track desde `camRef`/publicaciÃ³n local; warmup de permisos; fallback 720â†’540.
- **Archivos / refs:** `web/src/useGroupVideo.js`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 â€” UX video grupal web: botones visibles en Radio y Despacho

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** BotÃ³n **Video en vivo** con etiqueta (ya no solo emoji) en header del chat de grupo; mismo control en panel PTT de Radio; botÃ³n por canal en consola **Operaciones** (Despacho).
- **Por quÃ© / notas:** El acceso solo estaba en chat y era fÃ¡cil de no ver; Operaciones no tenÃ­a chat integrado.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/CommandCenter.jsx`

## 2026-09-01 â€” Streaming video grupal + HD 720p (1.8.57)

- **Tipo:** feature | mejora
- **Ãrea:** backend | web | mobile | database
- **QuÃ©:**
  - **Video grupal en vivo:** sala LiveKit paralela `gvid_*` (no interrumpe PTT audio); API `/api/group-video`, eventos socket `group:video_*`.
  - **Web/despacho:** botÃ³n ðŸ“¹ en chat de grupo, panel mosaico `GroupVideoPanel`, E2EE + simulcast/adaptiveStream.
  - **Mobile:** pantalla `GroupVideoScreen`, botÃ³n en header del chat de grupo; videollamada 1:1 sube a **720p**.
  - APK **1.8.57+66** publicada OTA.
- **Por quÃ© / notas:** PTT sigue en `grp_*` audio-only; video es opt-in en segunda conexiÃ³n.
- **Archivos / refs:** `backend/src/routes/groupVideo.js`, `web/src/useGroupVideo.js`, `web/src/GroupVideoPanel.jsx`, `mobile/lib/screens/group_video_screen.dart`, `database/migrations/022_group_video_sessions.sql`

## 2026-09-01 â€” APK 1.8.56+65 (fixes llamadas + estabilizadores)

- **Tipo:** release | ops
- **Ãrea:** mobile | backend
- **QuÃ©:** Compilada y publicada APK **1.8.56+65** (UI llamadas, apagar cÃ¡mara, estabilizadores de red, historial).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.56+65.apk`, `backend/app-updates/files/TacticalPtx.apk`

## 2026-09-01 â€” Abreviatura Mayor: Myr.

- **Tipo:** fix
- **Ãrea:** backend | web
- **QuÃ©:** Corregida abreviatura de **Mayor** de `May.` a `Myr.` en catÃ¡logo y UI; migraciÃ³n actualiza registros existentes.
- **Archivos / refs:** `backend/src/data/defaultGrades.js`, `web/src/dispatch/armyGrades.js`, `database/migrations/021_mayor_abbreviation_myr.sql`

## 2026-09-01 â€” Fix UI llamadas: iconos + apagar cÃ¡mara

- **Tipo:** fix | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Web: eliminado auto-reencendido de cÃ¡mara cada 400 ms al apagarla en videollamada; toggle respeta elecciÃ³n del usuario.
  - Web/mobile: apagar cÃ¡mara vÃ­a unpublish/`setCameraEnabled(false)` con fallback por publicaciÃ³n.
  - Mobile: dock de controles fijo abajo (sin montarse sobre video); PiP local arriba-derecha.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`, `mobile/lib/screens/private_call_screen.dart`

## 2026-09-01 â€” Estabilizadores virtuales llamadas (voz / radio / video)

- **Tipo:** mejora | fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - Periodo de gracia (~28 s) ante caÃ­das LiveKit: no cuelga al instante si el peer se desconecta brevemente.
  - Ping cada 15 s (`POST /private/:id/ping`) + refresh de token LiveKit (`POST /private/:id/refresh`).
  - Web: `privateCallStabilizer.js` en overlay, radio bar y opciones resilientes en `livekitE2ee.js`.
  - Mobile: `PrivateCallStabilizer` en llamada privada y radio personal; reintento automÃ¡tico al fallar connect.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/privateCallStabilizer.js`, `mobile/lib/private_call_stabilizer.dart`

## 2026-09-01 â€” Consola web: panel videoconferencia en mosaico

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - Nuevo componente `VideoConferenceMosaic` con grid adaptativo (1â€“N participantes) y attach/detach estable por tile.
  - `PrivateCallOverlay` usa mosaico en videollamadas; modo `console` embebido en despacho con mapa/canales visibles.
  - Panel **Videoconferencia** en Command Center: expandir a pantalla completa, controles integrados.
- **Archivos / refs:** `web/src/VideoConferenceMosaic.jsx`, `web/src/usePrivateCallTiles.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/dispatch/CommandCenter.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`

## 2026-09-01 â€” Historial de llamadas + UI profesional (APK 1.8.55)

- **Tipo:** feature | ux
- **Ãrea:** backend | mobile | database
- **QuÃ©:**
  - Tabla `private_call_logs` y API `GET /api/calls/history` (voz, video, radio; perdidas/completadas).
  - Inbox mobile con pestaÃ±a **Chats | Llamadas** e historial agrupado por fecha (estilo WhatsApp).
  - Pantalla entrante con gradiente y badge de modo (VOZ / VIDEO / RADIO).
  - APK **1.8.55+64** compilada y publicada OTA.
- **Archivos / refs:** `database/migrations/020_private_call_logs.sql`, `backend/src/services/dm.js`, `backend/src/routes/calls.js`, `mobile/lib/screens/call_history_pane.dart`, `mobile/lib/screens/chat_inbox_screen.dart`, `mobile/lib/screens/incoming_call_screen.dart`

## 2026-09-01 â€” Fix videollamada: cÃ¡mara auto, colgar ambos lados, menÃº web

- **Tipo:** fix | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - CÃ¡mara se activa sola al contestar/iniciar videollamada (permisos en gesto del usuario + fix mobile `_room` null).
  - Colgar cierra en ambos extremos: teardown LiveKit + `call:ended` en inbox/despacho.
  - MenÃº **Llamar â–¾** en chat directo (voz / video / radio); videollamada en panel Seguimiento y menÃº de canal.
- **Archivos / refs:** `web/src/PrivateCallOverlay.jsx`, `web/src/callMedia.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/dispatch/CommandCenter.jsx`, `mobile/lib/screens/private_call_screen.dart`

## 2026-09-01 â€” APK 1.8.53+62 OTA (videollamadas)

- **Tipo:** release | ops
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Compilada y publicada APK **1.8.53+62** con `API_BASE=https://189.152.222.98.sslip.io`.
  - Copias: `Soporte/APK/TacticalPtx-1.8.53+62.apk`, OTA `backend/app-updates/files/TacticalPtx.apk`, manifest `android.json` actualizado.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`

## 2026-09-01 â€” Videollamadas 1:1 + solicitud de cÃ¡mara (web + mobile)

- **Tipo:** feature
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - Modo `video` en llamadas privadas LiveKit (salas `video_*`, E2EE igual que voz).
  - API REST + sockets: `/video/request`, `/video/respond`, `/video/stop` con consentimiento explÃ­cito.
  - Web: overlay con preview local/remoto, botÃ³n videollamada en DM e inbox; solicitud de cÃ¡mara en llamada de voz.
  - Mobile: `PrivateCallScreen` con `VideoTrackRenderer`, permisos cÃ¡mara, FCM `private_video` / `private_video_request`.
  - VersiÃ³n **1.8.53+62**.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `web/src/DirectChat.jsx`, `mobile/lib/screens/private_call_screen.dart`, `mobile/lib/api_client.dart`

## 2026-09-01 â€” Resiliencia IP pÃºblica + LiveKit ICE (auto-sync)

- **Tipo:** infra | fix
- **Ãrea:** infra | ops
- **QuÃ©:**
  - Nuevo `infra/Sync-PublicIp.ps1`: detecta cambio de IP (ipify vs `.env`/`public-ip.txt`/`livekit.dev.yaml`) y realinea `.env`, YAML y `--node-ip`.
  - `ENSURE-PUBLIC-EDGE` y `Watch-Stack` fuerzan `START-PUBLIC-EDGE` ante **drift** aunque Caddy responda 200.
  - `START-PUBLIC-EDGE` sincroniza `node_ip` + reinicia LiveKit; `start-services` prefiere ipify sobre `.env` viejo.
  - `check-integrity` valida alineaciÃ³n IP + health del borde pÃºblico; quitados fallbacks a IP `189.152.200.238`.
- **Archivos / refs:** `infra/Sync-PublicIp.ps1`, `ENSURE-PUBLIC-EDGE.ps1`, `START-PUBLIC-EDGE.ps1`, `start-services.ps1`, `Watch-Stack.ps1`, `check-integrity.ps1`

## 2026-09-01 â€” LiveKit ICE mÃ³vil 4G: node-ip fija tras cambio ISP

- **Tipo:** fix | infra
- **Ãrea:** infra | mobile
- **QuÃ©:**
  - Tras instalar APK 1.8.52, mÃ³vil conectaba API pero fallaba audio: `MediaConnectException` (ICE timeout).
  - Causa: LiveKit seguÃ­a anunciando candidatos con IP vieja vÃ­a STUN; puertos media/TURN ya reenviados por UPnP.
  - Fix: `livekit.dev.yaml` â†’ `node_ip: 189.152.222.98`, `use_external_ip: false`, `advertise_internal_ip: true`; `start-services.ps1` pasa `--node-ip` desde `LIVEKIT_PUBLIC_HOST`; UPnP/firewall refrescados.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `infra/Reinforce-UPnP.ps1`

## 2026-09-01 â€” Fix LiveKit: IP pÃºblica nueva + seÃ±al wss same-origin

- **Tipo:** fix | infra | release
- **Ãrea:** web | infra | mobile | backend
- **QuÃ©:**
  - IP pÃºblica cambiÃ³ **189.152.200.238 â†’ 189.152.222.98**; Caddy/borde caÃ­do â†’ Â«No se pudo conectar el audio (LiveKit)Â».
  - `ENSURE-PUBLIC-EDGE`: Caddy + cert LE en `https://189.152.222.98.sslip.io`; LiveKit reiniciado.
  - Web: `livekitUrl.js` usa **siempre** `wss://mismo-origen` bajo HTTPS (proxy `/rtc`, sin hairpin al dominio viejo).
  - `.env` alineado; APK **1.8.52+61** OTA con `API_BASE=https://189.152.222.98.sslip.io`.
- **Archivos / refs:** `web/src/livekitUrl.js`, `backend/.env`, `mobile/lib/config.dart`, `infra/ENSURE-PUBLIC-EDGE.ps1`

## 2026-09-01 â€” APK 1.8.51+60 OTA (MEJORAS.txt + audio)

- **Tipo:** release | fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Publicada **APK 1.8.51+60** OTA con fix de audio (libera sesiÃ³n al silenciar escucha de radio).
  - Incluye tambiÃ©n los fixes web/backend de MEJORAS.txt del mismo dÃ­a (pÃ¡nico, llamadas, chat, PTT).
  - `APP_VERSION` backend â†’ **1.8.51**; `TacticalPtx-latest.apk` actualizado.
- **Archivos / refs:** pubspec.yaml, version.js, android.json, channel_session.dart, Publish-ApkUpdate.ps1

## 2026-09-01 â€” MEJORAS.txt: pÃ¡nico, llamadas, chat, PTT y audio

- **Tipo:** fix | mejora | ux
- **Ãrea:** web | backend | mobile
- **QuÃ©:**
  - **PÃ¡nico en Seguimiento:** `DispatchPanicHost` en portal a `body`, botÃ³n Â«Silenciar alarmaÂ», fallback con `ptt.incomingPanic`, sale de pantalla completa al recibir alerta.
  - **Llamadas:** overlay portaled; atrÃ¡s/Esc minimiza (no cuelga); banner `dm:notify` durante llamada/radio privada; `peerId` en sesiÃ³n de llamada.
  - **Chat Radio:** conserva scroll al volver desde Seguimiento (`chatActive`); avatares de perfil en burbujas (`senderAvatarUrl` en API).
  - **Mapa maximizado:** botÃ³n PTT flotante tambiÃ©n en Mapa en vivo (`DispatchMap`).
  - **Mobile:** suelta sesiÃ³n de audio del SO cuando radio en mute de escucha.
- **Notas (#6 indicativos):** `display_name` en BD ya es el indicativo (`SGTO GOMEZ`, etc.) vÃ­a admin; usuarios viejos pueden regenerarse con `rebuild-callsigns.js`.
- **Archivos / refs:** DispatchPanicHost.jsx, PrivateCallOverlay.jsx, WhatsAppChat.jsx, DispatchMap.jsx, chat.js, channel_session.dart, userDisplay.js

## 2026-09-01 â€” Limpieza post-rollback 1.8.49 + housekeeping

- **Tipo:** fix | ops | security
- **Ãrea:** mobile | backend | ops
- **QuÃ©:**
  - Eliminados `screen_security.dart`, `settings_screen.dart` y canal `FLAG_SECURE` en Android (restos del rediseÃ±o 1.8.49).
  - Imports muertos en `radio_shell.dart`; `APP_VERSION` backend alineado a **1.8.50**.
  - `Usuario y contra.txt` movido a `Soporte/Secrets/`; `TacticalPtx-latest.apk` apunta a **1.8.50+59**.
- **Archivos / refs:** MainActivity.kt, radio_shell.dart, version.js, .gitignore

## 2026-09-01 â€” Rollback UI: APK 1.8.50 (tema claro, como 1.8.48)

- **Tipo:** fix | release
- **Ãrea:** mobile
- **QuÃ©:**
  - Revertido tema tÃ¡ctico oscuro/camo de 1.8.49; restaurado look institucional claro (oliva/oro) como 1.8.48.
  - APK **1.8.50+59** publicada OTA; reemplaza 1.8.49+58 en el servidor.
- **Por quÃ© / notas:** El usuario no aprobÃ³ el rediseÃ±o 1.8.49; OTA no puede bajar versionCode, por eso se publica 1.8.50 con el aspecto anterior.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, chat_bubble_style.dart, pubspec.yaml, Publish-ApkUpdate.ps1

## 2026-08-31 â€” Coordenadas clicables â†’ Google Maps en detalles GPS

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:** En popup del marcador y panel de detalle (Seguimiento / Consola / Mapa) se muestran lat/lng; al hacer clic abren Google Maps en esa posiciÃ³n.
- **Archivos / refs:** MapCoordsLink.jsx, LiveTrackMap.jsx, DispatchMap.jsx, CommandCenter.jsx, panicMaps.js

## 2026-08-31 â€” APK tema tÃ¡ctico camo + seguridad (1.8.49)

- **Tipo:** ux | security | release
- **Ãrea:** mobile
- **QuÃ©:**
  - Tema oscuro olive/camo digital en chat, inbox, DM, canales, login y **ConfiguraciÃ³n**.
  - Bloqueo de capturas (`FLAG_SECURE`) activable en ConfiguraciÃ³n (activo por defecto).
  - APK **1.8.49+58** publicada OTA.
- **Archivos / refs:** theme.dart, tactical_backdrop.dart, settings_screen.dart, screen_security.dart, MainActivity.kt, chat_panel.dart, Publish-ApkUpdate.ps1

## 2026-08-31 â€” Marcadores mapa estilo pin/gota verde

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Iconos de ubicaciÃ³n en Seguimiento/Mapa pasan a pin teardrop verde (borde + aro claro + punta); siguen mostrando foto de perfil o inicial.
- **Archivos / refs:** mapAvatarIcon.js, command-center.css

\n## 2026-08-31 â€” Seguimiento: panel lista colapsable (acordeÃ³n)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** BotÃ³n Ocultar/Lista en Seguimiento en vivo; al colapsar queda franja estrecha y el mapa gana espacio. Preferencia en localStorage.
- **Archivos / refs:** LiveTrackMap.jsx, command-center.css

\## 2026-08-31 â€” Maximizar en Mapa en vivo

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** BotÃ³n Maximizar/Reducir (pantalla completa + Esc) en Mapa en vivo, igual que Seguimiento.
- **Archivos / refs:** DispatchMap.jsx, command-center.css

\nn## 2026-08-31 â€” Parpadeo Â«en vivoÂ» estable en todos los Host PC

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Anillos del mapa ya no usan 	ransform (conflicto con Leaflet/GPU en otras PCs); pulso por ox-shadow.
  - isFresh tolera desfase de reloj entre Hosts (hasta ~2 min) para no perder el estado en vivo.
- **Archivos / refs:** web/src/dispatch/command-center.css, liveTiming.js

\## 2026-08-31 â€” Tono de mensaje tÃ¡ctico (web + APK 1.8.48)

- **Tipo:** ux | release
- **Ãrea:** web | mobile | backend
- **QuÃ©:**
  - Reemplazado tono Nokia SMS por chirp radio (doble pip 980/1320 Hz), acorde a TacticalPtx.
  - APK **1.8.48+57** OTA; canal Android 	acticalptx_alerts_radio; FCM usa 	actical_msg.
- **Archivos / refs:** web/public/sounds/message.wav, mobile/assets/sounds/tactical_msg.wav, push_service.dart, cm.js

\nn## 2026-08-31 â€” Seguimiento en vivo filtrado por canal activo

- **Tipo:** ux | fix
- **Ãrea:** web | backend
- **QuÃ©:** Mapa de seguimiento muestra GPS y presencia solo de miembros del canal Â«Hablar enÂ» + canales en escucha; API /api/locations?groupIds=.
- **Archivos / refs:** LiveTrackMap.jsx, ackend/src/routes/locations.js, web/src/api.js

\## 2026-08-31 â€” APK 1.8.47+56 (canales miembro + pitido PTT)

- **Tipo:** release | mobile
- **Ãrea:** mobile | ops
- **QuÃ©:**
  - APK publicada OTA: solo canales con membresÃ­a (membersOnly=1), pitido al liberar PTT ajeno.
  - Copias: Soporte/APK/TacticalPtx-1.8.47+56.apk, ackend/app-updates/files/TacticalPtx.apk.
- **Notas:** Chat/seguimiento filtrados por canal son solo web; backend debe estar reiniciado para membersOnly.

\nn## 2026-08-31 â€” MÃ³vil: solo canales con membresÃ­a real

- **Tipo:** fix
- **Ãrea:** backend | mobile
- **QuÃ©:** GET /api/groups?membersOnly=1 devuelve Ãºnicamente grupos en group_members; la app Android usa ese filtro en el selector de canales.
- **Por quÃ© / notas:** Despacho web sigue con listado ampliado por privilegios (can_see_region, etc.).
- **Archivos / refs:** ackend/src/services/orgUnits.js, ackend/src/routes/groups.js, mobile/lib/api_client.dart

\## 2026-08-31 â€” Radio web: chat filtrado al canal activo

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** En Radio/Despacho el panel Chats muestra solo el canal Â«Hablar enÂ» y canales en escucha; oculta DMs y otros grupos. Con un solo canal, la lista lateral se oculta.
- **Archivos / refs:** web/src/ChatInbox.jsx, web/src/pages/RadioPage.jsx, web/src/styles.css

\nn## 2026-08-31 â€” Acercamiento suave al pÃ¡nico en mapa (estilo Earth)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Reemplazado flyTo por zoom/pan suave en lÃ­nea recta (~2.2 s); evita doble movimiento al cargar Seguimiento desde pÃ¡nico.
- **Archivos / refs:** web/src/dispatch/mapLeafletUtils.jsx, LiveTrackMap.jsx

\## 2026-08-31 â€” Pitido al liberar canal PTT (web)

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:** Tono breve (playChannelFreeTone) cuando otro operador suelta el PTT; no suena al soltar el propio botÃ³n.
- **Archivos / refs:** web/src/appNotify.js, web/src/usePtt.js

\nn## 2026-08-31 â€” Mac actualizando a Tahoe 26.x (build iOS local)

- **Tipo:** docs | ops
- **Ãrea:** mobile | docs
- **QuÃ©:**
  - Mac pasa de Monterey a **Tahoe 26.6.2** â†’ ya viable Xcode actual + IPA/TestFlight local.
  - Nueva guÃ­a IOS_BUILD_MAC_TAHOE.md; Monterey queda como histÃ³rico.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_TAHOE.md, docs/APP_IOS.md

\## 2026-08-31 â€” Ver en mapa acerca al punto de pÃ¡nico

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Â«Ver en mapaÂ» navega a Seguimiento con lat/lng y hace flyTo (zoom ~18) al punto del evento.
  - Overlay de pÃ¡nico se compacta arriba para no tapar el mapa; marcador rojo del punto.
- **Archivos / refs:** web/src/dispatch/DispatchPanicHost.jsx, LiveTrackMap.jsx, command-center.css

\nn## 2026-08-31 â€” GuÃ­a build iOS en Mac Monterey 12.7.6

- **Tipo:** docs
- **Ãrea:** mobile | docs
- **QuÃ©:** Documentado build local iOS (Xcode 14.2 mÃ¡x.), lÃ­mites Monterey, Firebase plist y ruta hÃ­brida Codemagic para TestFlight.
- **Archivos / refs:** Soporte/Documentos/IOS_BUILD_MAC_MONTEREY.md, docs/APP_IOS.md

\n# TacticalPtx â€” BitÃ¡cora de desarrollo

**Producto:** TacticalPtx 
**UbicaciÃ³n canÃ³nica (Soporte):** `C:\pulsanet\Soporte\Documentos\BITACORA_DESARROLLO.md` 
**Copia en repo:** `C:\pulsanet\docs\BITACORA_DESARROLLO.md` 
**Changelog por versiÃ³n:** `C:\pulsanet\docs\CHANGELOG.md`

Documento **vivo**: cada cambio, mejora, correcciÃ³n, despliegue o decisiÃ³n relevante se aÃ±ade **arriba** (mÃ¡s reciente primero), con fecha.

### CÃ³mo registrar una entrada

```markdown
## 2026-08-31 â€” PPT: reseÃ±a por fase en cada semana

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** Cada diapositiva S1â€“S5 incluye una reseÃ±a breve de la etapa CVDS (AnÃ¡lisisâ€¦ Mantenimiento).
- **Archivos / refs:** uild_plan_5_semanas_pptx.py, TACTICALPTX_CVDS_5_SEMANAS.pptx


## 2026-08-31 â€” PPT CVDS: menos texto + flujo completo

- **Tipo:** docs | ux
- **Ãrea:** docs
- **QuÃ©:** PresentaciÃ³n reducida a 11 diapositivas visuales; ciclo Aâ†’F con retorno G/H como diagrama de flujo; chips de navegaciÃ³n.
- **Archivos / refs:** cvds_flujo_completo.png, TACTICALPTX_CVDS_5_SEMANAS*.pptx


## 2026-08-31 â€” PPT CVDS: capturas UI, ER, flujos e ilustraciÃ³n pruebas

- **Tipo:** docs | ux
- **Ãrea:** docs
- **QuÃ©:** PresentaciÃ³n enriquecida con galerÃ­a Web/Android, diagrama ER, flujos PTT/pÃ¡nico e ilustraciÃ³n 2D soldados (Chat/GPS/PÃ¡nico/PTT); navegaciÃ³n interactiva ampliada.
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, _pptx_assets_cvds_exec/, uild_plan_5_semanas_pptx.py


## 2026-08-31 â€” PPT CVDS ejecutivo blanco institucional Defensa

- **Tipo:** docs | ux
- **Ãrea:** docs
- **QuÃ©:** PresentaciÃ³n 5 semanas rediseÃ±ada: fondo blanco federal, verdes Defensa, oro institucional; menÃº y chips con hipervÃ­nculos; versiones APK/API alineadas (1.8.46+55 / 1.8.21).
- **Archivos / refs:** TACTICALPTX_CVDS_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py, PLAN_5_SEMANAS.md


## 2026-08-31 â€” PPT/plan 5 semanas alineado al CVDS

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** Plan y PowerPoint reestructurados al Ciclo de Vida (AnÃ¡lisis, DiseÃ±o, Desarrollo, Pruebas, ImplementaciÃ³n+Mantenimiento) en 5 semanas; incluye marco 184-185 y ciclo G/H.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, uild_plan_5_semanas_pptx.py


## 2026-08-31 â€” Plan ejecutivo 5 semanas + PowerPoint

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** Ciclo de 5 semanas (PlaneaciÃ³n con alcances, Desarrollo, Pruebas, Entrega, Retro). PPT ejecutivo con grÃ¡ficos e imÃ¡genes de marca.
- **Archivos / refs:** PLAN_5_SEMANAS.md, TACTICALPTX_PLAN_5_SEMANAS.pptx, Soporte/Scripts/build_plan_5_semanas_pptx.py


## 2026-08-29 â€” Edge: XAMPP Apache quitaba Caddy (sslip mostraba Apache/MariaDB)

- **Tipo:** fix | ops
- **Ãrea:** infra
- **QuÃ©:** Detenido `httpd` (XAMPP) en 80/443; Caddy vuelve a servir TacticalPtx. START/ENSURE-PUBLIC-EDGE ahora matan httpd antes de arrancar.
- **Por quÃ© / notas:** Misma URL pÃºblica mostraba dashboard XAMPP Apache/MariaDB caÃ­do.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.ps1`


## YYYY-MM-DD â€” TÃ­tulo corto

- **Tipo:** feature | fix | mejora | docs | infra | ux | security | otro
- **Ãrea:** backend | web | mobile | database | infra | docs | ops
- **QuÃ©:** â€¦
- **Por quÃ© / notas:** â€¦
- **Archivos / refs:** â€¦
```

---

---

---

## 2026-08-28 â€” Radio 1:1: mic del canal + PTT usable en ambos

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** Antes de conectar radio 1:1 se libera el mic del canal grupal; PTT con setMicrophoneEnabled; receptor abre el chat con barra visible; reintento si falla audio; ya no se cierra por disconnect breve.
- **Por quÃ© / notas:** Un lado hablaba y el otro no podÃ­a ni pulsar el mic (mic ocupado / barra tapada / ready=false).
- **Archivos / refs:** personal_radio_bar.dart, channel_session.dart, 
adio_shell.dart, direct_pane.dart â€” APK **1.8.46+55**

## 2026-08-28 â€” Radio 1:1 otra vez con barra PTT (no pantalla de llamada)

- **Tipo:** fix | ux
- **Ãrea:** mobile
- **QuÃ©:** Radio personal vuelve a ser barra PTT arriba del chat (DirectPane / RadioShell); la pantalla fullscreen queda solo para llamada de voz.
- **Por quÃ© / notas:** En 1.8.44 el radio 1:1 se habÃ­a abierto como PrivateCallScreen.
- **Archivos / refs:** `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart` â€” APK **1.8.45+54**

## 2026-08-28 â€” Llamadas: foto de perfil + contestar desde push

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:** Avatar con foto en pantalla de llamada/entrante; al tocar la notificaciÃ³n de llamada se abre Contestar/Rechazar (antes se ignoraba y la llamada se perdÃ­a). FCM canal `tacticalptx_calls` tambiÃ©n para radio 1:1; GET `/api/calls/private/:id`.
- **Archivos / refs:** `private_call_screen.dart`, `incoming_call_screen.dart`, `radio_shell.dart`, `push_service.dart`, `calls.js`, `fcm.js` â€” APK **1.8.44+53**

## 2026-08-28 â€” Edge publico levantado (APK sin conexion)

- **Tipo:** infra | fix
- **Ãrea:** infra | ops
- **QuÃ©:** APK no conectaba a `https://189.152.200.238.sslip.io` porque Caddy 80/443 estaba caido; se ejecuto `ENSURE-PUBLIC-EDGE` â†’ health 200.
- **Por quÃ© / notas:** UPnP reporto fallo; si 4G sigue fallando, abrir 80/443 en el router hacia la PC.
- **Archivos / refs:** `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/START-PUBLIC-EDGE.ps1`

## 2026-08-28 â€” BAT reforzado + stack levantado

- **Tipo:** infra
- **Ãrea:** infra | ops
- **QuÃ©:** Refuerzo de `LEVANTAR-TACTICALPTX.bat` (preflight, espera LiveKit, chequeo post-edge, `/strict`, logs con timestamp); arreglo UTF-8/em-dash en `start-api.cmd` / `start-web.cmd` que rompÃ­a el parseo de cmd; stack verificado (API/Web/Redis/LiveKit).
- **Por quÃ© / notas:** Caracteres Unicode y parentesis en `echo` rompen etiquetas/batch en Windows. Scripts en ASCII puro.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-28 â€” Plan de trabajo en PDF

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** ExportaciÃ³n PDF de `PLAN_DE_TRABAJO.md`; script reutilizable `Soporte/Scripts/md_plan_to_pdf.py`.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.pdf`

## 2026-08-28 â€” Plan de trabajo maestro (sprints + roadmap)

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** Documento PLAN_DE_TRABAJO: plan desde cero en 13 sprints (2 sem), roadmap pendiente vs estado actual, seguimiento MEJORAS.txt y escalones 1.8.x.
- **Archivos / refs:** `Soporte/Documentos/PLAN_DE_TRABAJO.md`, `docs/PLAN_DE_TRABAJO.md`, `README.md`

## 2026-08-28 â€” Web chat: avatares en burbujas + banner en llamada

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Chat grupal (Radio) muestra foto de perfil junto a mensajes ajenos (como la APK); globo de mensaje vuelve a aparecer durante llamada privada.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `web/src/chatNotify.js`

## 2026-08-28 â€” Seguimiento: nombres en mapa solo al seleccionar

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Marcadores de ubicaciÃ³n ya no muestran etiqueta bajo el avatar; al seleccionar operador se ve nombre, popup y panel lateral como antes.
- **Archivos / refs:** `web/src/dispatch/mapAvatarIcon.js`, `web/src/dispatch/command-center.css`

## 2026-08-28 â€” APK 1.8.43+52 publicada (fix burbujas chat)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Build release + OTA (`force`) con fix de burbujas recibidas; copia en `Soporte\APK\`.
- **Archivos / refs:** `Soporte\APK\TacticalPtx-1.8.43+52.apk`, `backend\app-updates\files\TacticalPtx.apk`

## 2026-08-28 â€” APK chat: burbujas recibidas sin recorte (hora visible)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** Mensajes entrantes ya no quedan cortados en el borde izquierdo; la hora y el contenido corto (p. ej. Â«.Â») se ven completos en DM y grupo.
- **Por quÃ© / notas:** `IntrinsicWidth` + `Stack`/`Positioned` no reservaba ancho para la meta; ahora `Column` + ancho mÃ­nimo y mÃ¡s padding horizontal.
- **Archivos / refs:** `mobile/lib/chat_bubble_style.dart`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart` â€” **1.8.43+52**

## 2026-08-28 â€” Seguimiento: colores Tamaulipas rojo / SLP verde

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En mapa IV R.M., **Tamaulipas** rojo tenue (`#c97070`); **San Luis PotosÃ­** verde (el que tenÃ­a Tamaulipas, `#1f8a4c`).
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`

## 2026-08-28 â€” Chat abierto: tono suave WhatsApp (sin notificaciÃ³n fuerte)

- **Tipo:** fix | ux
- **Ãrea:** mobile | web
- **QuÃ©:**
  - Con el **hilo abierto**, solo tono tenue (estilo WhatsApp); sin bandeja ni sirena Nokia a volumen completo.
  - **APK:** FCM en primer plano ya no duplica el push (socket maneja UI/tono); iOS sin sonido de sistema en foreground.
  - **Web:** `playMessageTone({ soft: true })` al leer el chat activo (grupo y DM).
- **VersiÃ³n:** 1.8.42+51 (APK)
- **Archivos / refs:** `message_tone.dart`, `push_service.dart`, `chat_message_banner.dart`, `appNotify.js`, `ChatInbox.jsx`, `DirectChat.jsx`

## 2026-08-28 â€” Fix Error 500: API inestable + BAT reforzado

- **Tipo:** fix | infra
- **Ãrea:** infra | backend | ops
- **QuÃ©:**
  - **Causa:** la API caÃ­a o reiniciaba (`--watch`) y Watch-Stack **mataba el puerto :4000** cada 15 s â†’ bucle de muerte â†’ consola/APK veÃ­an "Error del servidor (500)".
  - **Watch-Stack:** no mata proceso si :4000 escucha; 4 fallos + cooldown 120 s antes de reiniciar; health con timeout mayor.
  - **start-api.cmd:** si health OK, espera 20 s sin relanzar npm (como Web).
  - **LEVANTAR-TACTICALPTX.bat:** chequeo Redis, espera API 60 s, no libera :4000 hasta confirmar zombie, log en `Soporte\Logs\levantar-*.log`, aviso explÃ­cito del 500.
  - **API:** logs de ruta en errores 500; try/catch en listado de pÃ¡nico.
- **Archivos / refs:** `infra/Watch-Stack.ps1`, `infra/start-api.cmd`, `LEVANTAR-TACTICALPTX.bat`, `backend/src/server.js`, `routes/panic.js`

## 2026-08-28 â€” PÃ¡nico: silenciar sirena al abrir mapa

- **Tipo:** fix
- **Ãrea:** mobile | web
- **QuÃ©:**
  - **APK:** al pulsar **Ver ubicaciÃ³n** / **CÃ³mo llegar** se detiene sirena y vibraciÃ³n en el dispositivo (overlay sigue hasta Enterado).
  - **Web:** mismo comportamiento en Radio (modal) y Despacho (`DispatchPanicHost`); botones **Ver ubicaciÃ³n** y **CÃ³mo llegar** en consola.
- **VersiÃ³n:** 1.8.41+50 (APK)
- **Archivos / refs:** `channel_session.dart`, `radio_shell.dart`, `DispatchPanicHost.jsx`, `RadioPage.jsx`, `usePtt.js`, `panicMaps.js`

## 2026-08-28 â€” Fix overlay UbicaciÃ³n GPS transparente

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - Panel **UbicaciÃ³n** y **Canales** con fondo opaco (`Material` + `kInstPaper`) para no superponerse sobre Radio.
  - Texto GPS con padding horizontal para evitar solapamiento visual.
- **VersiÃ³n:** 1.8.40+49
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

## 2026-08-28 â€” PÃ¡nico APK: ver ubicaciÃ³n y cÃ³mo llegar

- **Tipo:** feature
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Overlay de pÃ¡nico con botones **Ver ubicaciÃ³n** y **CÃ³mo llegar** (Maps / navegaciÃ³n externa).
  - Guarda lat/lng del `panic:alert`; sync de pÃ¡nico activo al abrir/reanudar; push FCM con coords; `GET /api/panic/:id`.
- **VersiÃ³n:** 1.8.39+48
- **Archivos / refs:** `mobile/lib/panic_maps.dart`, `radio_shell.dart`, `channel_session.dart`, `push_service.dart`, `backend/src/services/panic.js`, `routes/panic.js`

## 2026-08-28 â€” Fix mensajes al estar inactivo (historial + sync)

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - DM: historial pedÃ­a los mensajes **mÃ¡s viejos** (`ORDER BY ASC LIMIT`); ahora trae los **Ãºltimos** N.
  - Grupo/DM: al volver de inactividad o abrir el chat se re-sincroniza historial desde el servidor (no solo memoria/socket).
  - Push FCM con preview del texto y `title`/`body` tambiÃ©n en `data`.
- **VersiÃ³n:** 1.8.38+47
- **Archivos / refs:** `backend/src/services/dm.js`, `fcm.js`, `socket/chat.js`, `socket/dm.js`, `mobile/lib/channel_session.dart`, `direct_pane.dart`, `radio_shell.dart`

## 2026-08-28 â€” Fix envÃ­o de mensajes APK (DM join + eco socket)

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - DM: `dm:join` al conectar/reconectar y antes de cada envÃ­o (el join se perdÃ­a si el socket aÃºn no conectaba).
  - DM/grupo: eco `dm:message` / `chat:message` al emisor; handler `dm:error`; mensajes optimistas en chat grupal con `clientMsgId`.
  - Scroll del chat solo salta al llegar mensajes nuevos (no en cada rebuild).
- **VersiÃ³n:** 1.8.37+46
- **Archivos / refs:** `mobile/lib/screens/direct_pane.dart`, `channel_session.dart`, `chat_panel.dart`, `backend/src/socket/dm.js`, `chat.js`

## 2026-08-28 â€” APK MEJORAS.txt (globo, pÃ¡nico, scroll, avatares, PTT, audio)

- **Tipo:** fix | ux | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - Globo de mensajes global (`ChatMessageBanner`) en shell y durante llamada/radio 1:1.
  - Alerta de pÃ¡nico como overlay en cualquier pestaÃ±a (Seguimiento incluido), no solo diÃ¡logo tapado.
  - AtrÃ¡s en llamada minimiza (PopScope); radio 1:1 abre pantalla completa con PTT visible al expandir y en barra mini.
  - `IndexedStack` + overlays en stack (Seguimiento/Grupos) preservan estado; scroll de chat mÃ¡s estable.
  - Avatares en burbujas de chat grupal y DM; formato indicativo en cabecera DM.
  - Audio: altavoz forzado solo si radio no estÃ¡ en mute; menos invasiÃ³n al colgar llamada.
- **VersiÃ³n:** 1.8.36+45
- **Archivos / refs:** `mobile/lib/chat_message_banner.dart`, `radio_shell.dart`, `private_call_screen.dart`, `chat_panel.dart`, `direct_pane.dart`, `channel_session.dart`, `peer_actions.dart`

## 2026-08-28 â€” Globo de chat global (cualquier pÃ¡gina)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Globo tipo WhatsApp Web centralizado (`GlobalChatNotifyHost` + `chatNotify.js`) visible en Radio, Despacho, Seguimiento, Config, etc.
  - z-index 15000 para quedar encima del despacho/mapa.
  - Al salir del panel de chat (otro mÃ³dulo) ya no se suprime el aviso; clic abre Radio con el hilo correcto.
- **Archivos / refs:** `web/src/GlobalChatNotifyHost.jsx`, `web/src/chatNotify.js`, `web/src/App.jsx`, `web/src/ChatInbox.jsx`, `web/src/styles.css`

---

## 2026-08-28 â€” Notificaciones SO con permiso activo (service worker)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Notificaciones del sistema vÃ­a `sw-notify.js` + `registration.showNotification()` (Chrome/Edge no muestran bien `new Notification()` con pestaÃ±a minimizada aunque el permiso estÃ© en Â«PermitirÂ»).
  - Banner in-app siempre que no estÃ©s leyendo ese chat (tambiÃ©n respaldo al volver a la pestaÃ±a).
  - Registro automÃ¡tico del service worker al iniciar sesiÃ³n.
- **Por quÃ© / notas:** Usuario con notificaciones permitidas solo oÃ­a el tono; el aviso visual no aparecÃ­a en segundo plano.
- **Archivos / refs:** `web/public/sw-notify.js`, `web/src/appNotify.js`, `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/App.jsx`

---

## 2026-08-28 â€” Web DM: lecturas en vivo + banner de notificaciÃ³n

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
  - Chat 1:1 web marca mensajes como leÃ­dos al abrir el hilo y al recibir mensajes (`markDmRead`).
  - Escucha `dm:receipts` por socket para actualizar palomitas sin recargar la pÃ¡gina.
  - Corregida detecciÃ³n de â€œchat visibleâ€ (`visiblePeerId` + `active`) para no suprimir avisos al cambiar a grupo/radio.
  - Banner in-app de mensaje en `ChatInbox` (portal a `document.body`); fallback visual si no hay permiso de Notification del SO.
- **Por quÃ© / notas:** En web los mensajes enviados no pasaban a â€œleÃ­doâ€ hasta F5; el sonido sonaba pero no aparecÃ­a el banner tipo WhatsApp Web.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/ChatInbox.jsx`, `web/src/api.js`, `web/src/appNotify.js`

---

## 2026-08-27 â€” LEVANTAR reforzado (reintentos + edge + Watch-Stack)

- **Tipo:** infra | mejora
- **Ãrea:** infra | ops
- **QuÃ©:**
  - `LEVANTAR-TACTICALPTX.bat` en 7 pasos: PG, Redis/LiveKit, firewall, API, Web, Watch-Stack, borde pÃºblico.
  - Reintento automÃ¡tico si API/Web no dan health; scorecard final [OK]/[!!].
  - Watch-Stack tambiÃ©n vigila LiveKit y el edge HTTPS (log en `Soporte\Logs\watch-stack.log`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/Watch-Stack.ps1`

## 2026-08-27 â€” Fix mensaje OTA â€œActualizandoÃ¢â‚¬Â¦â€

- **Tipo:** fix
- **Ãrea:** mobile | backend
- **QuÃ©:** El ellipsis Unicode se corrompÃ­a en el manifiesto JSON; ahora usa `Actualizando...` (ASCII) y se sanitiza en API/app.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `appUpdate.js`, `app_update.dart`, `main.dart`

## 2026-08-27 â€” APK UI profesional (tipografÃ­a institucional)

- **Tipo:** ux
- **Ãrea:** mobile
- **QuÃ©:**
  - TipografÃ­a Oswald + Source Sans 3 (como la web); tema Material refinado.
  - Login y Radio PTT mÃ¡s presentables (cabecera, estado, PTT, pÃ¡nico, canales).
  - Barra Chats/Radio con iconos redondeados y tipografÃ­a clara.
  - APK **1.8.35+44**.
- **Archivos / refs:** `theme.dart`, `login_screen.dart`, `radio_screen.dart`, `radio_shell.dart`, `google_fonts`

## 2026-08-27 â€” PTT radio grupal por toque (abre / libera)

- **Tipo:** ux
- **Ãrea:** mobile | web
- **QuÃ©:** En radio de canal/grupo, un toque pone al aire y el segundo libera (ya no hay que mantener). Espacio en web tambiÃ©n es toggle. APK **1.8.34+43**.
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`, `usePtt.js`, `RadioPage.jsx`, `DispatchLayout.jsx`, `LiveTrackMap.jsx`

## 2026-08-27 â€” Lightbox: copiar / descargar imagen (como WhatsApp)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** En la galerÃ­a a pantalla completa: botones Copiar y Descargar; clic derecho con las mismas opciones. El menÃº del navegador estaba bloqueado y la toolbar oculta.
- **Archivos / refs:** `ImageGalleryLightbox.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-27 â€” Web Vite: por quÃ© caÃ­a y watchdog anti-caÃ­da

- **Tipo:** infra | fix
- **Ãrea:** infra | web | ops
- **QuÃ©:**
  - Causa: Vite arrancado desde shell de Cursor muere al abortar la sesiÃ³n; `http://127.0.0.1:5173` falla (solo **HTTPS** con certs LAN).
  - `start-web.cmd` / `start-api.cmd` reinician solos si el proceso sale.
  - `Watch-Stack.ps1` + `ENSURE-WEB.cmd`; LEVANTAR lanza el watchdog en segundo plano.
- **Por quÃ© / notas:** Usar siempre https://127.0.0.1:5173; no depender del terminal del agente.
- **Archivos / refs:** `infra/start-web.cmd`, `infra/start-api.cmd`, `infra/Watch-Stack.ps1`, `infra/ENSURE-WEB.cmd`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-27 â€” Pegar / editar imÃ¡genes en chat (estilo WhatsApp Web)

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
  - Ctrl+V (o Cmd+V) pega imÃ¡genes en chat grupal y DM y abre vista previa.
  - Adjuntar foto tambiÃ©n abre el compositor (no envÃ­a al instante).
  - Herramientas: recortar/rotar, mejorar, dibujar, texto, formas, mosaico, emoji, HD, deshacer/rehacer, descargar; caption; varias imÃ¡genes (+).
- **Por quÃ© / notas:** Paridad con WhatsApp Web al pegar; â€œver una vezâ€ no incluido (sin backend).
- **Archivos / refs:** `MediaComposerModal.jsx`, `mediaComposerUtils.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 â€” Radio 1:1: toggle PTT, mÃ¡s rÃ¡pido y nueva forma

- **Tipo:** ux | mejora
- **Ãrea:** mobile | web
- **QuÃ©:**
  - PTT por toque: 1.Âº abre el canal, 2.Âº libera (ya no hay que mantener pulsado).
  - ConexiÃ³n mÃ¡s rÃ¡pida: audio/E2EE y LiveKit + mic en paralelo; socket solo WebSocket.
  - Nueva forma: tarjeta redondeada con mic circular (app + web).
  - APK **1.8.33+42**.
- **Archivos / refs:** `personal_radio_bar.dart`, `PrivateRadioBar.jsx`, `styles.css`, `pubspec.yaml`

## 2026-08-27 â€” Textos OTA sin â€œBanjeCelâ€

- **Tipo:** ux
- **Ãrea:** mobile | backend
- **QuÃ©:** Al actualizar la APK el mensaje visible es **Actualizandoâ€¦** / **Descargando configuraciÃ³nâ€¦**; se eliminÃ³ â€œBanjeCelâ€ del manifiesto y de la publicaciÃ³n; API y app filtran ese texto si aparece.
- **Archivos / refs:** `android.json`, `Publish-ApkUpdate.ps1`, `app_update.dart`, `appUpdate.js`, `main.dart`

## 2026-08-27 â€” Uploads por jerarquÃ­a y carpetas de grupo

- **Tipo:** mejora | infra
- **Ãrea:** backend
- **QuÃ©:**
  - Media de chat/PTT y avatares se guardan bajo `uploads/orgs/{orgId}/â€¦` con jerarquÃ­a regiÃ³n/zona/unidad cuando el grupo tiene `unit_id`, y carpeta por grupo.
  - DM â†’ `orgs/{orgId}/dm/`; avatares â†’ `orgs/{orgId}/avatars/`.
  - Archivos planos previos siguen resolviÃ©ndose (compatibilidad).
- **Archivos / refs:** `backend/src/services/uploads.js`, `messages.js`, `dm.js`, `recordings.js`, `me.js`, `admin.js`

## 2026-08-27 â€” Radio 1:1 arriba (PTT) sin tapar el chat

- **Tipo:** ux | fix
- **Ãrea:** mobile | web
- **QuÃ©:**
  - Radio personal deja de usar `bottomSheet` / barra inferior grande; franja superior compacta con un botÃ³n **PTT** + cerrar.
  - Se puede escribir en el chat y usar el teclado con la radio activa.
  - Web: barra bajo el header del DM (mismo patrÃ³n).
- **Archivos / refs:** `personal_radio_bar.dart`, `direct_pane.dart`, `radio_shell.dart`, `peer_actions.dart`, `PrivateRadioBar.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-27 â€” Layout Historial / AuditorÃ­a a ancho completo

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** La pantalla de auditorÃ­a usa todo el ancho del panel; columnas de tabla reequilibradas; detalle legible (no JSON cortado en 22 rem).
- **Archivos / refs:** `ConfigAudit.jsx`, `command-center.css`

## 2026-08-27 â€” Fix foto de perfil en APK (Bearer â†’ Image.memory)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - `UserAvatar` ya no usa `Image.network` (falla con URL autenticada); descarga con `http.get` + Bearer y muestra `Image.memory`.
  - Icono de grupo en cabecera del chat tambiÃ©n usa `UserAvatar` con auth.
  - APK **1.8.31+40** OTA force.
- **Archivos / refs:** `user_avatar.dart`, `api_client.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`, `pubspec.yaml`

## 2026-08-27 â€” Historial / AuditorÃ­a en ConfiguraciÃ³n

- **Tipo:** feature
- **Ãrea:** web | backend
- **QuÃ©:**
  - Pantalla **ConfiguraciÃ³n â†’ Historial / AuditorÃ­a** (quiÃ©n, quÃ©, cuÃ¡ndo) solo para root/admin.
  - `GET /api/admin/activity` restringido a admin; filtros por acciÃ³n/bÃºsqueda y paginaciÃ³n.
- **Archivos / refs:** `ConfigAudit.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`, `api.js`, `admin.js`, `command-center.css`

## 2026-08-27 â€” DelimitaciÃ³n IV R.M. detallada (NL / TM / SLP)

- **Tipo:** mejora | ux
- **Ãrea:** web
- **QuÃ©:** PolÃ­gonos de Nuevo LeÃ³n, Tamaulipas y San Luis PotosÃ­ regenerados con frontera de alta resoluciÃ³n (fuente estados MÃ©xico); deja de cortar ciudades (p. ej. Nuevo Laredo) por simplificaciÃ³n excesiva.
- **Archivos / refs:** `web/src/dispatch/data/ivRmStates.json`, `LiveTrackMap.jsx`

## 2026-08-27 â€” PÃ¡nico solo al grupo del operador

- **Tipo:** security | mejora
- **Ãrea:** backend | web | docs
- **QuÃ©:**
  - La alerta de pÃ¡nico ya no escala a todo el proyecto (admins/despacho/`canReceivePanic` fuera del canal).
  - Socket, FCM y listado `GET /api/panic` quedan acotados a **miembros del grupo** del canal activo; la consola solo recibe `dispatch:panic` si el operador pertenece a ese grupo.
  - Enterado / Resolver / Cancelar: solo miembros del mismo grupo.
- **Por quÃ© / notas:** Evitar impacto org-wide; el alcance lo define `group_members`.
- **Archivos / refs:** `backend/src/services/panic.js`, `backend/src/routes/panic.js`, `docs/V1_7_PANIC.md`, `DispatchPanicHost.jsx`

## 2026-08-27 â€” Radio PTT antes de CatÃ¡logos en el menÃº

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En el rail del despacho, **Radio PTT** queda arriba de CatÃ¡logos (despuÃ©s de Mapa en vivo).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 â€” DelimitaciÃ³n estados IV R.M. en Seguimiento

- **Tipo:** feature / ux
- **Ãrea:** web
- **QuÃ©:** En Seguimiento en vivo se muestran polÃ­gonos tenues de **Nuevo LeÃ³n**, **Tamaulipas** y **San Luis PotosÃ­** (relleno semitransparente + borde suave) sin tapar el fondo del mapa; leyenda en el chrome del mapa.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `web/src/dispatch/data/ivRmStates.json`, `command-center.css`

---

## 2026-08-27 â€” PTT visible al maximizar

- **Tipo:** fix / ux
- **Ãrea:** web
- **QuÃ©:**
  - Corregido layout Radio keep-alive (outlet aparcado con `display:none`) que al maximizar ocultaba/recortaba el PTT.
  - BotÃ³n PTT mini siempre en la franja de radio del despacho.
  - En Seguimiento maximizado: PTT flotante encima del mapa.
- **Archivos / refs:** `DispatchLayout.jsx`, `LiveTrackMap.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 â€” Indicativo al aire (SGTO GOMEZ, S.O. IV R.M.)

- **Tipo:** feature / ux
- **Ãrea:** backend | web
- **QuÃ©:**
  - Indicativo visible en chat/PTT: grado + apellido en MAYÃšSCULAS (SGTO GOMEZ) o libre (B.O. LINARES).
  - Detalle opcional entre parÃ©ntesis: `S.O. IV R.M. (SALA DE OPERACIONES IV R.M.)`.
  - Campo editable en alta/ediciÃ³n de usuarios; login (ggomezd2) no cambia.
  - Grados/puestos: SGTO, B.O., S.O., C.G. Script `npm run rebuild:callsigns` para regenerar display_name existentes.
- **Archivos / refs:** `backend/src/services/rfcUsername.js`, `admin.js`, `catalogs.js`, `defaultGrades.js`, `scripts/rebuild-callsigns.js`; `web/src/dispatch/DispatchUsers.jsx`, `armyGrades.js`

---

## 2026-08-27 â€” Scroll del chat al volver de Seguimiento

- **Tipo:** fix / ux
- **Ãrea:** web
- **QuÃ©:** Radio PTT en despacho permanece montado (oculto) al ir a Seguimiento/u otros mÃ³dulos; se conserva conversaciÃ³n y posiciÃ³n de scroll. Auto-scroll del chat solo si estÃ¡s al final.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `command-center.css`, `App.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`

---

## 2026-08-27 â€” Banner de mensaje visible en llamada

- **Tipo:** fix / ux
- **Ãrea:** mobile | web
- **QuÃ©:**
  - Web: banner WhatsApp por encima del overlay de llamada (`z-index`); no silenciar aviso si el chat estÃ¡ tapado por la llamada.
  - App: tarjeta emergente sobre la pantalla de llamada (tambiÃ©n minimizada); evita SnackBar detrÃ¡s de la llamada.
- **Por quÃ© / notas:** En llamada los mensajes no se veÃ­an (overlay / chat abierto = â€œya estÃ¡s viendoâ€).
- **Archivos / refs:** `web/src/appNotify.js`, `privateCallUi.js`, `PrivateCallOverlay.jsx`, `styles.css`; `mobile/lib/screens/private_call_screen.dart`, `radio_shell.dart`

---

## 2026-08-27 â€” AtrÃ¡s en llamada minimiza (no cuelga)

- **Tipo:** fix / ux
- **Ãrea:** mobile | web
- **QuÃ©:**
  - App: flecha atrÃ¡s / gesto atrÃ¡s minimiza la llamada a una barra superior; el audio sigue; Colgar corta.
  - Web: flecha â† y Esc minimizan; solo Â«ColgarÂ» / botÃ³n rojo cierra la llamada.
- **Por quÃ© / notas:** Evitar colgar al salir de la UI de llamada (comportamiento tipo WhatsApp).
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`; `web/src/PrivateCallOverlay.jsx`, `web/src/styles.css`

---

## 2026-08-27 â€” RecuperaciÃ³n DispatchLayout moderno

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Reconstruido `DispatchLayout.jsx` tras revert accidental a versiÃ³n antigua: `listenIds`/`onListenChange`, menÃº ConfiguraciÃ³n (Canales/Respaldos), catÃ¡logos actuales, outlet embebido para Radio/ConfigChannels, roles zona/unidad, mute oculto en `/despacho/radio`, Salir solo con `canManageUsers`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 â€” Alerta de pÃ¡nico visible en toda la consola

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** La ventana emergente de pÃ¡nico (Enterado / Resolver) y la sirena viven en el layout de despacho, no solo en Operaciones. En **Seguimiento**, Mapa, CatÃ¡logos, etc. tambiÃ©n aparece y se puede detener.
- **Por quÃ© / notas:** Al salir de Operaciones se desmontaba el CommandCenter y cortaba sirena/UI.
- **Archivos / refs:** `web/src/dispatch/DispatchPanicHost.jsx`, `DispatchLayout.jsx`, `CommandCenter.jsx`

---

## 2026-08-27 â€” Editar usuarios (admins unidad/zona/regiÃ³n/root)

- **Tipo:** feature
- **Ãrea:** backend | web
- **QuÃ©:** BotÃ³n **Editar** en CatÃ¡logos â†’ Usuarios (solo `canManageUsers`: admin unidad, zona, regiÃ³n y Superadmin). Permite cambiar grado, nombre, matrÃ­cula, cargo, rol, adscripciÃ³n y visibilidad. El usuario de acceso no se regenera.
- **Archivos / refs:** `backend/src/routes/admin.js` (PATCH identidad), `web/src/dispatch/DispatchUsers.jsx`

---

## 2026-08-27 â€” Foto de perfil no se veÃ­a en Radio (app)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** El avatar en cabecera/perfil se carga con **Bearer** (como la web), no solo con ticket `?atk=` de 1 h. Si la descarga falla, muestra iniciales en lugar de cÃ­rculo blanco vacÃ­o.
- **Por quÃ© / notas:** El ticket corto expiraba y `NetworkImage` dejaba el `CircleAvatar` en blanco aunque el archivo existiera en el servidor.
- **Archivos / refs:** `mobile/lib/api_client.dart`, `widgets/user_avatar.dart`, `radio_screen.dart`, `radio_shell.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 â€” Salir solo para admins (unidad/zona/regiÃ³n/root)

- **Tipo:** ux | security
- **Ãrea:** mobile | web
- **QuÃ©:** OpciÃ³n Â«SalirÂ» visible solo para `unit_admin`, `zone_admin`, `admin` (RegiÃ³n) y `root` (Superadmin). Operadores y despacho no la ven. En la app: perfil (avatar) + overlay de canales. En web: radio y consola de despacho.
- **Por quÃ© / notas:** Evitar cierre de sesiÃ³n accidental en radios de campo. Sigue disponible en error de carga y en cambio de clave temporal.
- **Archivos / refs:** `mobile/lib/roles.dart`, `radio_shell.dart`, `groups_screen.dart`, `web/src/pages/RadioPage.jsx`, `web/src/dispatch/DispatchLayout.jsx`

---

## 2026-08-27 â€” Ojito ver/ocultar contraseÃ±a

- **Tipo:** ux
- **Ãrea:** mobile | web
- **QuÃ©:** En Â«Cambiar contraseÃ±aÂ» (APK) cada campo tiene icono de ojo para mostrar/ocultar; mismo patrÃ³n en login y cambio de clave de la web. El botÃ³n de salida dice Â«SalirÂ» (antes Â«Cerrar sesiÃ³nÂ»).
- **Archivos / refs:** `mobile/lib/screens/change_password_screen.dart`, `web/src/App.jsx`, `web/src/institutional.css`

---

## 2026-08-27 â€” Sin Altavoz duplicado en menÃº Radio

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** En `/despacho/radio` se oculta el botÃ³n Altavoz/MUTE de la barra superior (ya estÃ¡ Â«SilenciarÂ» abajo); en el resto de menÃºs se mantiene.
- **Archivos / refs:** `DispatchLayout.jsx`

---

## 2026-08-27 â€” Imagen de grupo/canal

- **Tipo:** feature
- **Ãrea:** backend | web | mobile | database
- **QuÃ©:** `groups.avatar_url` (migraciÃ³n 020); admin sube/quita icono en CatÃ¡logos â†’ Grupos; se muestra en bandeja y cabecera de chat (web + APK).
- **Archivos / refs:** `020_group_avatar.sql`, `admin.js`, `groups.js`, `me.js`, `DispatchGroups.jsx`, `PersonAvatar.jsx`, `ChatInbox.jsx`, `WhatsAppChat.jsx`, `user_avatar.dart`

---

## 2026-08-27 â€” Mute radio sin mover botones

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Quitado el aviso extra Â«Radio silenciadaâ€¦Â» que empujaba el layout; el estado va en la lÃ­nea Â«Canal libreÂ». Botones Altavoz/MUTE con ancho fijo.
- **Archivos / refs:** `RadioPage.jsx`, `DispatchLayout.jsx`, `command-center.css`, `styles.css`

---

## 2026-08-27 â€” ConfiguraciÃ³n â†’ Canales (oÃ­r / hablar)

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:** Selector multi-canal movido a ConfiguraciÃ³n â†’ Canales; barra superior solo muestra canal PTT + Â«Oye N/MÂ» con enlace. Respaldos sigue solo admin.
- **Archivos / refs:** `ConfigChannels.jsx`, `ConfigLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

---

## 2026-08-27 â€” KPI despacho: textos centrados

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** NÃºmeros/etiquetas centrados **dentro** de cada tarjeta; la fila de cuadros vuelve a la izquierda y Â«ConexiÃ³n en vivoÂ» a la derecha.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

## 2026-08-27 â€” Avatares en lista de chats (web + APK)

- **Tipo:** feature | ux
- **Ãrea:** backend | web | mobile
- **QuÃ©:** API DM devuelve `avatarUrl` en contactos y conversaciones; componente `PersonAvatar` / `UserAvatar` en bandeja de chats.
- **Archivos / refs:** `backend/src/services/dm.js`, `web/src/PersonAvatar.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/user_avatar.dart`, `chat_inbox_screen.dart`

---

## 2026-08-27 â€” Despacho: actividad y grabaciones en columnas

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Panel inferior en 2 columnas (actividad | grabaciones) a igual altura; mÃ¡s espacio al bloque inferior (~55%); KPI compacto.
- **Por quÃ© / notas:** Apiladas verticalmente, grabaciones quedaban fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 â€” Despacho: layout viewport sin cortar grabaciones

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** `cc-workspace-grid` envuelve mapa + panel inferior; KPI/banners fijos arriba; todo cabe en `100dvh` con scroll interno en actividad/grabaciones.
- **Por quÃ© / notas:** El grid de 2 filas trataba KPI como fila 1 y empujaba grabaciones fuera de pantalla.
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---

## 2026-08-27 â€” Despacho: panel actividad/grabaciones menos comprimido

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** MÃ¡s altura mÃ­nima al bloque inferior (actividad, grabaciones PTT, detalle); mÃ¡s padding en filas y cabeceras; columna detalle mÃ¡s ancha.
- **Por quÃ© / notas:** El usuario reportÃ³ el apartado Â«muy comprimidoÂ» en el centro de mando.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

---

- **Tipo:** fix
- **Ãrea:** backend | mobile | infra
- **QuÃ©:** LiveKit no escuchaba UDP 7882 (usaba rango 50000+ sin UPnP). Simplificado `livekit.dev.yaml`; `--udp-port 7882` explÃ­cito; STUN sin `--node-ip` fijo. LAN â†’ `ws://IP_LAN:7880`; 4G â†’ `wss://dominio`. MÃ³vil no reescribe `ws://192.168.x` a wss.
- **Por quÃ© / notas:** `MediaConnectException` / ICE timeout en PTT. Causa raÃ­z: puerto media UDP no abierto en el servidor.
- **Archivos / refs:** `infra/livekit.dev.yaml`, `infra/start-services.ps1`, `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `Caddyfile.edge.template`

---

## 2026-08-26 â€” PTT mÃ³vil: una URL para Wiâ€‘Fi y 4G (sin obligar LAN)

- **Tipo:** fix
- **Ãrea:** backend | infra
- **QuÃ©:** LiveKit siempre `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). Quitado atajo `ws://LAN:7880` y `--node-ip` fijo; STUN + candidatos LAN + TURN. `LIVEKIT_PUBLIC_URL` en borde pÃºblico.
- **Por quÃ© / notas:** El fix anterior solo funcionaba en la misma Wiâ€‘Fi; 4G seguÃ­a roto. Ahora LAN y datos mÃ³viles usan la misma seÃ±al HTTPS.
- **Archivos / refs:** `backend/src/services/livekit.js`, `infra/start-services.ps1`, `infra/Caddyfile.edge`, `START-PUBLIC-EDGE.ps1`

---

## 2026-08-26 â€” Fix audio PTT mÃ³vil (LiveKit ICE timeout)

- **Tipo:** fix
- **Ãrea:** backend | mobile | infra
- **QuÃ©:** URL LiveKit segÃºn contexto: LAN â†’ `ws://IP_LAN:7880`; remoto HTTPS â†’ `wss://PUBLIC_DOMAIN` (Caddy `/rtc`). `LIVEKIT_LAN_HOST` auto-sync en `start-services.ps1`. MÃ³vil reescribe `wss` cuando API es HTTPS. UPnP/firewall LiveKit reforzados.
- **Por quÃ© / notas:** La app recibÃ­a `ws://IP_PUBLICA:7880`; en Wiâ€‘Fi fallaba ICE (hairpin NAT) y en 4G el puerto 7880 no siempre alcanza. Error: `MediaConnectException` / PeerConnection timeout.
- **Archivos / refs:** `backend/src/services/livekit.js`, `mobile/lib/config.dart`, `infra/start-services.ps1`, `Reinforce-UPnP.ps1`

---

## 2026-08-26 â€” Fix error 500 detrÃ¡s de Caddy (trust proxy)

- **Tipo:** fix
- **Ãrea:** backend | infra
- **QuÃ©:** `trust proxy` activo en dev cuando hay `PUBLIC_DOMAIN` o `TRUST_PROXY=1`; `.env.example` actualizado; `TRUST_PROXY=1` en `.env` local.
- **Por quÃ© / notas:** TrÃ¡fico vÃ­a Caddy envÃ­a `X-Forwarded-For` y `express-rate-limit` lanzaba `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` â†’ 500 en login y demÃ¡s rutas pÃºblicas.
- **Archivos / refs:** `backend/src/config.js`, `backend/.env.example`

---

## 2026-08-26 â€” Codemagic iOS + checklist TestFlight

- **Tipo:** infra | docs
- **Ãrea:** mobile | ops
- **QuÃ©:** `codemagic.yaml` con workflows TestFlight y solo IPA; checklist Apple+Firebase; plantilla plist; script base64 para Codemagic.
- **Por quÃ© / notas:** Build iOS sin Mac local. Ver `Soporte/Documentos/IOS_TESTFLIGHT_CHECKLIST.md`.
- **Archivos / refs:** `codemagic.yaml`, `IOS_TESTFLIGHT_CHECKLIST.md`, `GoogleService-Info.plist.example`, `Encode-GoogleServicePlist.ps1`

## 2026-08-26 â€” Fix .cmd/.bat rotos en Windows (LF vs CRLF)

- **Tipo:** fix
- **Ãrea:** infra | ops
- **QuÃ©:** `start-api.cmd`, `start-web.cmd` y `LEVANTAR-TACTICALPTX.bat` tenian saltos LF (Unix); cmd.exe rompia bloques `if` y ejecutaba palabras sueltas (`Preferir`, `exist`, `not`). Reescritos con CRLF y sintaxis por etiquetas.
- **Archivos / refs:** `infra/start-api.cmd`, `infra/start-web.cmd`, `LEVANTAR-TACTICALPTX.bat`, resto `infra/*.cmd`

## 2026-08-26 â€” LEVANTAR-TACTICALPTX.bat mas robusto

- **Tipo:** fix | infra
- **Ãrea:** infra | ops
- **QuÃ©:** Bat detecta PostgreSQL 18, fallback puerto 5432, borde publico via `.cmd` sin romper el script, dominio desde `.env`, Redis con rutas alternativas.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/ENSURE-PUBLIC-EDGE.ps1`, `infra/ENSURE-PUBLIC-EDGE.cmd`, `infra/start-services.ps1`

## 2026-08-26 â€” APK 1.8.30+39 (emojis/stickers OTA)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** OTA BanjeCel force `1.8.30+39` con emojis y stickers estilo WhatsApp (grupal + personal).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.30+39.apk`, `backend/app-updates/android.json`

## 2026-08-26 â€” Emojis y stickers estilo WhatsApp (web + APK)

- **Tipo:** feature | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
  - Web: panel flotante tipo WhatsApp Web (categorÃ­as, bÃºsqueda, pestaÃ±as Emoji / GIF / Stickers) en chat grupal y DM.
  - APK: panel inferior con emojis + stickers; el icono ðŸ™‚ / âŒ¨ï¸ alterna panel y teclado (grupal y personal).
- **Por quÃ© / notas:** GIF tab placeholder (prÃ³ximamente). Stickers DM vÃ­a `POST /api/dm/:id/messages/sticker`.
- **Archivos / refs:** `web/src/WaEmojiPicker.jsx`, `web/src/emojiData.js`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `mobile/lib/widgets/chat_emoji_panel.dart`, `chat_panel.dart`, `direct_pane.dart`

## 2026-08-26 â€” Fix lightbox Â«Cargando imagenâ€¦Â» infinito

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Al abrir imagen a pantalla completa ya no se queda colgado en carga. El efecto de React Strict Mode cancelaba el fetch y no reintentaba.
- **Por quÃ© / notas:** Miniatura OK; lightbox con Â«Cargando imagenâ€¦Â» + nombre de archivo. Ahora libera el slot al cancelar, muestra error claro y botÃ³n Reintentar.
- **Archivos / refs:** `web/src/ImageGalleryLightbox.jsx`, `web/src/api.js` (`fetchMediaBlobUrl`)

## 2026-08-26 â€” APK 1.8.29+38 (ortografÃ­a + BanjeCel)

- **Tipo:** fix | ops
- **Ãrea:** mobile
- **QuÃ©:** Corregidos textos mojibake (GalerÃ­a, CÃ¡mara, etc.). OTA BanjeCel force `1.8.29+38`.
- **Archivos / refs:** `direct_pane.dart`, `Soporte/APK/TacticalPtx-1.8.29+38.apk`

## 2026-08-26 â€” APK 1.8.28+37 (radio personal PTT)

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Publicado OTA force con radio personal tipo grupal (barra PTT, sin UI de llamada).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.28+37.apk`

## 2026-08-26 â€” Radio personal = PTT (como radio grupal)

- **Tipo:** ux | feature
- **Ãrea:** web | mobile
- **QuÃ©:** Radio personal ya no abre UI de llamada: barra PTT `MANTÃ‰N PARA HABLAR`, auto-uniÃ³n del destinatario, botÃ³n Radio del chat sirve para transmitir. Llamar sigue siendo full-duplex.
- **Archivos / refs:** `web/src/PrivateRadioBar.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `mobile/.../personal_radio_bar.dart`

## 2026-08-26 â€” Proyecto iOS preparado (IPA requiere Mac)

- **Tipo:** infra | docs
- **Ãrea:** mobile
- **QuÃ©:** Listo el target iOS `com.tacticalptx.app`: Podfile, Info.plist (mic/cÃ¡mara/fotos/ubicaciÃ³n/Bluetooth), entitlements push, iconos, script `scripts/build-ios.sh` y guÃ­a `Soporte/Documentos/APP_IOS.md`. El `.ipa` no se puede generar en Windows.
- **Por quÃ© / notas:** Pedido de app iOS; falta Mac + Apple Developer + `GoogleService-Info.plist` para FCM.
- **Archivos / refs:** `mobile/ios/`, `mobile/scripts/build-ios.sh`, `Soporte/Documentos/APP_IOS.md`

## 2026-08-26 â€” App no secuestra volumen/cÃ¡mara del mÃ³vil

- **Tipo:** fix | security
- **Ãrea:** mobile
- **QuÃ©:** Audio solo al radio/llamada (volumen multimedia + mayDuck); mic se libera al callar; FGS sin tipo microphone; pausa sesiÃ³n al abrir cÃ¡mara. APK **1.8.27+36** OTA force.
- **Por quÃ© / notas:** La sesiÃ³n voiceCommunication + mic siempre abierto interferÃ­a con volumen, notificaciones y cÃ¡mara de otras apps.
- **Archivos / refs:** `audio_session_setup.dart`, `channel_session.dart`, `background_radio.dart`, `AndroidManifest.xml`

## 2026-08-26 â€” APK 1.8.26+35 (radio 1:1 + controles llamada)

- **Tipo:** feature | ops
- **Ãrea:** mobile
- **QuÃ©:** Publicado OTA force: radio personal 1:1 + controles de llamada estilo WhatsApp (altavoz, silenciar, teclado, mensaje).
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.26+35.apk`, `backend/app-updates/android.json`, `mobile/pubspec.yaml`

## 2026-08-26 â€” Controles de llamada estilo telÃ©fono/WhatsApp (app)

- **Tipo:** feature | ux
- **Ãrea:** mobile
- **QuÃ©:** En llamada privada: **Silenciar**, **Teclado**, **Altavoz/Auricular**, **Mensaje** (DM sin colgar), **MÃ¡s** (audio entrante), temporizador y colgar. Radio 1:1: PTT + altavoz + mensaje.
- **Archivos / refs:** `mobile/lib/screens/private_call_screen.dart`, `direct_pane.dart`, `peer_actions.dart`, `radio_shell.dart`

## 2026-08-26 â€” Radio personal 1:1 (ademÃ¡s de llamada y mensaje)

- **Tipo:** feature
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - Entre usuarios: **Mensaje**, **Radio personal** (PTT 1:1) y **Llamada** (full-duplex).
  - Backend: `mode: call|radio` en `/api/calls/private`; rooms `radio_*` vs `call_*`; FCM `private_radio`.
  - Web: menÃº peer + botÃ³n Radio en DM; overlay con PTT (mantener).
  - MÃ³vil: menÃº peer, iconos en chat DM, pantalla entrante/activa con PTT.
- **Por quÃ© / notas:** Pedido: radio entre usuarios ademÃ¡s de llamadas y mensajes.
- **Archivos / refs:** `backend/src/routes/calls.js`, `backend/src/services/dm.js`, `web/src/PrivateCallOverlay.jsx`, `WhatsAppChat.jsx`, `ChatInbox.jsx`, `DirectChat.jsx`, `mobile/lib/peer_actions.dart`, `direct_pane.dart`, `incoming_call_screen.dart`, `radio_shell.dart`

## 2026-08-26 â€” Llamada entrante web visible (portal)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** La UI de llamada entrante vivÃ­a dentro de DirectChat con `display:none` (vista grupos) â†’ sonaba pero no se veÃ­a. Ahora se renderiza con `createPortal` en `document.body` (z-index alto).
- **Archivos / refs:** `web/src/DirectChat.jsx`, `appNotify.js`, `styles.css`

## 2026-08-26 â€” DiÃ¡logos prompt del proyecto (sin window.prompt)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** `AppDialog` con campo de texto; renombrar dependencias/grados/empleos y confirmar restauraciÃ³n usan modal del producto (no el prompt del navegador).
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchDependencias.jsx`, `CatalogGradesEmpleos.jsx`, `ConfigBackups.jsx`, `institutional.css`

## 2026-08-26 â€” Notificaciones web estilo WhatsApp

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:** Tono `/sounds/message.wav`, banner oscuro con acento verde, Notification del SO al ir a segundo plano, tÃ­tulo `(N) TacticalPtx`, silencio si el chat estÃ¡ abierto. Grupos tambiÃ©n notifican con pestaÃ±a oculta.
- **Archivos / refs:** `web/src/appNotify.js`, `ChatInbox.jsx`, `styles.css`, `public/sounds/message.wav`

## 2026-08-26 â€” Mute de escucha radio (mÃ³vil + web)

- **Tipo:** feature | ux
- **Ãrea:** mobile | web
- **QuÃ©:** BotÃ³n visible **Silenciar / MUTE** en Radio (tambiÃ©n menÃº â˜°). Corta audio remoto al silenciar. Web RadioPage: mismo control. APK **1.8.25+34**.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `channel_session.dart`, `web/src/pages/RadioPage.jsx`, `styles.css`

## 2026-08-26 â€” Publicar APK OTA 1.8.24+33

- **Tipo:** release
- **Ãrea:** mobile | ops
- **QuÃ©:** Build/release APK con Socket.IO `:443`, E2EE sin fallback silencioso, tono chat, etc. Manifiesto OTA `force: true`.
- **Archivos / refs:** `mobile/pubspec.yaml` 1.8.24+33, `backend/app-updates/`, `Soporte/APK/`

## 2026-08-26 â€” SIN RED mÃ³vil: Caddy edge caÃ­do + endurecer arranque

- **Tipo:** fix | infra
- **Ãrea:** ops | mobile | infra
- **QuÃ©:**
  - Causa: borde pÃºblico Caddy (:80/:443) apagado â†’ timeout/`SIN RED` en app 4G; API/DB/Redis locales OK.
  - Edge reiniciado (health 200 + Socket.IO polling OK). APK **1.8.23+32** ya publicada (fix `:0`).
  - `START-PUBLIC-EDGE` detecta API HTTP vs HTTPS (evita 502 TLS handshake); `ENSURE-PUBLIC-EDGE`; `LEVANTAR` llama al ensure.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `ENSURE-PUBLIC-EDGE.*`, `Caddyfile.edge.template`, `LEVANTAR-TACTICALPTX.bat`

## 2026-08-26 â€” Mapas: quitar watermark CARTO Â«API KEY REQUIREDÂ»

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** CARTO raster ahora exige API key; se reemplazÃ³ por Esri World Street Map / OSM / satÃ©lite Esri (sin key). Capas centralizadas en `mapTiles.js`.
- **Archivos / refs:** `web/src/dispatch/mapTiles.js`, `CommandCenter.jsx`, `DispatchMap.jsx`, `LiveTrackMap.jsx`

## 2026-08-26 â€” Dependencias: Ã¡rbol contraÃ­do por defecto

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Regiones/zonas del catÃ¡logo Dependencias inician colapsadas (`NestedRow` defaultOpen=false).
- **Archivos / refs:** `web/src/dispatch/DispatchDependencias.jsx`

## 2026-08-26 â€” Fix Socket.IO mÃ³vil `:0` (sslip.io sin puerto)

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** `socket_io_client` usaba `Uri.port == 0` con `https://host` (sin puerto) â†’ `â€¦sslip.io:0/socket.io` y fallo de upgrade WebSocket. `AppConfig.socketUrl` fuerza `:443`/`:80`; todas las conexiones IO usan `socketUrl`.
- **Archivos / refs:** `mobile/lib/config.dart`, `channel_session.dart` (ya usaba socketUrl), `direct_pane.dart`, `chat_inbox_screen.dart`, `test/widget_test.dart`
- **Nota:** APK **1.8.23+32** en publicaciÃ³n OTA (force). Reabrir app o actualizar cuando termine el build.

## 2026-08-26 â€” Integridad: paths C:, TLS/FCM, cifrado, firewall

- **Tipo:** security | fix | infra
- **Ãrea:** backend | web | mobile | infra | docs | ops
- **QuÃ©:**
  - RaÃ­z canÃ³nica documentada como `C:\pulsanet` (evita fracturas D: ausente).
  - `FIREBASE_SERVICE_ACCOUNT` corregido a C:; health reporta TLS real + flags wire/content/voice; FCM vuelve a `configured`.
  - Despacho: no degradar payloads sealed a texto en claro si falla unwrap; voz E2EE no cae en silencio a SRTP-only si hay clave.
  - Firewall canÃ³nico reforzado (9 reglas `TacticalPtx-*`); script `infra/check-integrity.ps1`.
- **Por quÃ© / notas:** Tras el 500 por TLS en D:, auditorÃ­a completa de estructura App/Web/proyecto.
- **Archivos / refs:** `backend/src/routes/health.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`, `infra/check-integrity.ps1`, `infra/Ensure-Firewall.ps1`, `docs/UBICACION_PROYECTO.md`, `backend/.env` (paths)

## 2026-08-26 â€” Fix API TLS (certs D: â†’ C:) y 500 por proxy

- **Tipo:** fix | infra
- **Ãrea:** backend | ops
- **QuÃ©:** `.env` apuntaba `TLS_CERT/KEY` a `D:\pulsanet\â€¦` (inexistente); la API caÃ­a a HTTP y Vite/proxy HTTPS devolvÃ­a fallos (500 / conexiÃ³n). Certs corregidos a `C:\pulsanet\infra\certs\` y API reiniciada con TLS on. Alta sin cargo verificada (201).
- **Archivos / refs:** `backend/.env` (TLS_*), `infra/certs/lan-*.pem`

## 2026-08-26 â€” Tono tenue si el chat estÃ¡ abierto (mÃ³vil)

- **Tipo:** ux | fix
- **Ãrea:** mobile
- **QuÃ©:** Con el hilo abierto en primer plano ya no suena la notificaciÃ³n Nokia de bandeja; se reproduce un tono al ~16% de volumen (estilo WhatsApp). Si el chat es otro o la app estÃ¡ en segundo plano, se mantiene el aviso completo.
- **Archivos / refs:** `mobile/lib/message_tone.dart`, `app_focus.dart`, `push_service.dart`, `radio_shell.dart`, `channel_session.dart`, `direct_pane.dart`

## 2026-08-26 â€” Cargo opcional en alta de usuarios

- **Tipo:** ux | fix
- **Ãrea:** web | backend
- **QuÃ©:** Â«Cargo / puestoÂ» deja de ser obligatorio en el alta; el indicativo usa grado + apellido y solo aÃ±ade cargo si se captura.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/routes/admin.js`

## 2026-08-26 â€” Acelerar abrir chat desde notificaciÃ³n (mÃ³vil)

- **Tipo:** fix | ux
- **Ãrea:** mobile
- **QuÃ©:** Al tocar Â«AbrirÂ» en la notificaciÃ³n, el hilo DM se abre al instante (sin esperar contactos/LiveKit/FGS). Cambio de canal y limpieza de avisos ya no bloquean la navegaciÃ³n; bootstrap paralelo.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/direct_pane.dart`, `mobile/lib/push_service.dart`

## 2026-08-26 â€” Fix formularios Grupos (alineaciÃ³n)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Formularios Â«Nuevo grupoÂ» / Â«Asignar miembroÂ» dejaron de usar `.admin-form` (que los empujaba a la derecha). Ahora son paneles verticales con campos a ancho completo.
- **Archivos / refs:** `web/src/dispatch/DispatchGroups.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 â€” Purga canales PTT del import PV

- **Tipo:** ops | fix
- **Ãrea:** backend
- **QuÃ©:** Eliminados 48 grupos creados automÃ¡ticamente al importar Dependencias (`Canal operativo Â· PV-O-*`). El import ya no crea canales PTT.
- **Archivos / refs:** `backend/src/scripts/purge-import-groups.js`, `backend/src/scripts/import-pv-dependencias.js`

## 2026-08-26 â€” UX compacta Dependencias / Usuarios / Grupos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Mismo criterio que Grados/empleos: contenedor max ~820px; Dependencias mÃ¡s densa; Usuarios en tarjetas de una columna; Grupos con formularios en paneles y lista/miembros en chips (sin tablas a todo el ancho).
- **Archivos / refs:** `DispatchDependencias.jsx`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `command-center.css`

## 2026-08-26 â€” UX Grados/empleos mÃ¡s compactos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Paneles Grados/Empleos dejan de estirarse a todo el ancho; columnas ~300â€“380px y elementos en chips (abreviatura + nombre juntos a las acciones).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 â€” Dependencias idÃ©nticas a ParqueVehicular

- **Tipo:** feature | data
- **Ãrea:** backend | web | database
- **QuÃ©:**
  - Importado el Ã¡rbol live de PV (`catalogos.html#dependencias`): 6 RR.MM., 15 ZZ.MM., 48 organismos (`PV-*`).
  - UI Dependencias alineada a PV: labels RR.MM.â†’ZZ.MM.â†’Organismos, placeholders, chips de organismos, botones Â«+ RegiÃ³n / + Zona / + OrganismoÂ».
  - Script `npm run import:pv-dependencias` (desactiva org_units no `PV-*`).
- **Por quÃ© / notas:** Sustituye el seed parcial IV R.M. (`ivRmUnits.js`) por la estructura real de ParqueVehicular.
- **Archivos / refs:** `backend/src/data/pvDependenciasTree.js`, `backend/src/scripts/import-pv-dependencias.js`, `web/src/dispatch/DispatchDependencias.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-26 â€” Fix scroll CatÃ¡logos / ConfiguraciÃ³n

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** El cuerpo de CatÃ¡logos/ConfiguraciÃ³n tenÃ­a `overflow: hidden` sin scroll; Grados/empleos, Dependencias, Usuarios, Grupos y Respaldos se cortaban abajo. Ahora `.cc-catalogs-body` hace scroll vertical.
- **Archivos / refs:** `web/src/dispatch/command-center.css`

## 2026-08-26 â€” Fix pantalla en negro (web App.jsx)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Crash al renderizar rutas: `isAdminUser(session.user)` con `session === null` (menÃº ConfiguraciÃ³n/Respaldos). Ahora usa `session?.user`.
- **Archivos / refs:** `web/src/App.jsx`

## 2026-08-26 â€” APK OTA 1.8.22+31 desde C:\pulsanet

- **Tipo:** ops | fix
- **Ãrea:** mobile | infra | ops
- **QuÃ©:**
  - `Publish-ApkUpdate.ps1` resuelve repo en `C:\pulsanet` (fallback D:), Flutter/SDK/JDK reales; reescribe `local.properties` y `org.gradle.java.home`.
  - Reinstalados Flutter (`C:\tools\flutter`), Android SDK (`C:\Android\Sdk`) y Microsoft OpenJDK 17.
  - Publicada APK **1.8.22+31** a `backend/app-updates` + `Soporte/APK`; `LEVANTAR-TACTICALPTX.bat` prioriza C:\.
- **Archivos / refs:** `mobile/scripts/Publish-ApkUpdate.ps1`, `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.22+31.apk`

## 2026-08-26 â€” CatÃ¡logo PV (grados/empleos/dependencias) + Respaldos

- **Tipo:** feature | ux
- **Ãrea:** web | backend | database
- **QuÃ©:**
  - CatÃ¡logos al estilo ParqueVehicular: **Grados y empleos** (chips, alta/renombre/baja; bloqueo si estÃ¡n en uso) y **Dependencias** (Ã¡rbol RegiÃ³n â†’ Zona â†’ Unidad).
  - MenÃº **ConfiguraciÃ³n â†’ Respaldos**: programaciÃ³n, retenciÃ³n, manual, descarga, borrado, restauraciÃ³n (.zip/.sql) y subida; ZIP `tacticalptx_*.zip` con `database.sql` + `meta.json`.
  - MigraciÃ³n `019_catalog_grades_empleos.sql`; seed LOEFAM al primer listado; Usuarios consume grados/empleos del API.
  - Arranque `infra/start-api.cmd` / `start-web.cmd` prioriza `C:\pulsanet`.
- **Por quÃ© / notas:** Importar forma e informaciÃ³n de PV adaptada a TacticalPtx (`users.grade` / `specialty`, `org_units`).
- **Archivos / refs:** `web/src/dispatch/CatalogGradesEmpleos.jsx`, `DispatchDependencias.jsx`, `ConfigBackups.jsx`, `ConfigLayout.jsx`, `backend/src/services/catalogs.js`, `backup.js`, `routes/catalogs.js`, `routes/backups.js`, `database/migrations/019_catalog_grades_empleos.sql`

## 2026-08-25 â€” ZIP respaldo completo TacticalPtx

- **Tipo:** ops
- **Ãrea:** ops | docs
- **QuÃ©:** Respaldo ZIP del trabajo en `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip` (~1.42 GB). Incluye cÃ³digo, docs, Soporte/APK/OTA; excluye `node_modules`, `mobile/build`, `.dart_tool` y Respaldos anidados.
- **Archivos / refs:** `Soporte/Respaldos/TacticalPtx_completo_2026-08-25_2220.zip`

## 2026-08-25 â€” Proyecto solo en D:\pulsanet (nada fuera)

- **Tipo:** ops | docs
- **Ãrea:** docs | ops
- **QuÃ©:**
  - Eliminada la junction externa `D:\PulsaNet_Soporte` (apuntaba a `D:\pulsanet\Soporte`).
  - Logos/variantes TacticalPtx movidos de Documentos â†’ `Soporte\Brand\from-Documents\`.
  - Docs: ubicaciÃ³n Ãºnica y stack completo bajo `D:\pulsanet` (`UBICACION_PROYECTO.md`, README).
- **Por quÃ© / notas:** El producto no debe vivir fuera de esa carpeta; SDKs del sistema (Flutter/Android/JDK/PG) siguen en sus rutas de instalaciÃ³n.
- **Archivos / refs:** `docs/UBICACION_PROYECTO.md`, `README.md`, `Soporte/Brand/from-Documents/`

## 2026-08-25 â€” APK 1.8.21+30 publicada (OTA)

- **Tipo:** feature | ux | ops
- **Ãrea:** mobile | ops
- **QuÃ©:** APK **1.8.21+30** â€” vaciar/borrar chats, miniaturas de imagen en DM, burbujas estilo WhatsApp. OTA `versionCode` 30, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.21+30.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 â€” GPS mapa: Â«Hace X hÂ» no implica en vivo

- **Tipo:** fix | ux
- **Ãrea:** web | backend
- **QuÃ©:**
  - Aclara que Â«Hace 21 h / 72 hÂ» = Ãºltima seÃ±al recibida por el servidor (suele pasar fuera de red/API).
  - Parseo UTC de `recordedAt` sin zona; API siempre envÃ­a ISO con `Z`.
  - Popup/ficha: Â«desactualizadoÂ» + hora local; ya no dice Â«rastro en vivoÂ» si la seÃ±al es vieja.
- **Archivos / refs:** `liveTiming.js`, `LiveTrackMap.jsx`, `locations.js`

## 2026-08-25 â€” Burbujas de chat estilo WhatsApp

- **Tipo:** ux | mejora
- **Ãrea:** mobile
- **QuÃ©:** Mensajes DM y grupo mÃ¡s estÃ©ticos: radios/cola tipo WhatsApp, agrupaciÃ³n por remitente, hora+palomas en esquina, tipografÃ­a y sombra suaves, composer redondeado sin borde tosco.
- **Archivos / refs:** `chat_bubble_style.dart`, `direct_pane.dart`, `chat_panel.dart`

## 2026-08-25 â€” Vaciar/borrar chats + miniatura imagen DM

- **Tipo:** feature | ux
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Inbox: pulsaciÃ³n larga â†’ Vaciar chat/grupo, Borrar chat (ocultar de la lista; reaparece con mensaje nuevo) y favorito.
  - API `POST /api/dm/:userId/messages/clear` y `POST /api/groups/:id/messages/clear`; eventos `dm:cleared` / `chat:cleared`.
  - MenÃº â‹® en DM y grupo para vaciar.
  - Chat personal: imÃ¡genes en miniatura dentro de la burbuja (estilo WhatsApp).
- **Archivos / refs:** `dm.js`, `chat.js`, `messages.js`, `chat_inbox_screen.dart`, `direct_pane.dart`, `api_client.dart`, `channel_session.dart`

## 2026-08-25 â€” APK 1.8.20+29 publicada (OTA)

- **Tipo:** feature | ops
- **Ãrea:** mobile | ops
- **QuÃ©:** APK **1.8.20+29** â€” DM con palomas/hora/swipe reply/envÃ­o rÃ¡pido/atrÃ¡s al inbox; tambiÃ©n presencia multi-device y ticket avatar. OTA `versionCode` 29.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.20+29.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`

## 2026-08-25 â€” DM mÃ³vil: palomas, hora, swipe reply, atrÃ¡s al inbox

- **Tipo:** feature | ux | fix
- **Ãrea:** mobile
- **QuÃ©:** Chat personal con hora + palomas (âœ“âœ“ / azules al leer); envÃ­o optimista (menos latencia); deslizar derecha para responder; opciones alineadas (descargar); atrÃ¡s/sistema vuelve al inicio (inbox) de un toque.
- **Archivos / refs:** `direct_pane.dart`, `api_client.dart` (`markDmRead`), `peer_actions.dart`, `radio_shell.dart`

## 2026-08-25 â€” Avatar sin JWT en URL + presencia multi-device

- **Tipo:** security | fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
  - #1 Presencia por socket (cerrar web no saca al mÃ³vil del radio).
  - #2 Avatares: ticket corto HMAC (`?atk=`) en login/refresh; mapas web usan blob+Bearer; app deja de poner el JWT en `Image.network`.
- **Archivos / refs:** `presence.js`, `ptt.js`, `avatarTicket.js`, `me.js`, `auth.js`, `avatarBlobCache` / mapas despacho, `api_client.dart`, `secure_store.dart`

## 2026-08-25 â€” Presencia multi-dispositivo (socket refcount)

- **Tipo:** fix
- **Ãrea:** backend
- **QuÃ©:** Presencia PTT por `socket.id` en Redis (`presence:sockets:*`). Cerrar web/otra pestaÃ±a ya no marca offline al mÃ³vil ni suelta el floor si otro dispositivo sigue en el canal. Floor solo se libera si ese socket tenÃ­a PTT o el usuario no tiene mÃ¡s sockets.
- **Archivos / refs:** `presence.js`, `socket/ptt.js`, `redis.js`

## 2026-08-25 â€” Restaurado borde HTTPS (app sin conexiÃ³n)

- **Tipo:** fix | infra | ops
- **Ãrea:** infra | ops
- **QuÃ©:** App mostraba â€œNo hay conexiÃ³n con el servidor (â€¦sslip.io)â€: Caddy no escuchaba en 443 (Apache/Laragon ocupaba 80). Se relanzÃ³ `START-PUBLIC-EDGE.ps1`; health pÃºblico 200.
- **Por quÃ© / notas:** No reiniciar Laragon Apache en 80 mientras se use el borde LE; 80/443 deben quedar para Caddy.
- **Archivos / refs:** `infra/START-PUBLIC-EDGE.ps1`, `infra/Caddyfile.edge`

## 2026-08-25 â€” AuditorÃ­a completa + remediaciÃ³n segura

- **Tipo:** security | fix | docs | ops
- **Ãrea:** backend | mobile | database | docs
- **QuÃ©:**
  - AuditorÃ­a versiones/seguridad/datos/sockets; BD viva OK para DM.
  - MigraciÃ³n `018_dm_messages.sql`; `BUILD-APK-WHATSAPP.cmd` â†’ Publish OTA; `clearFloor` atÃ³mico; reject secretos OTA/unlock de ejemplo; versiones 1.8.19 en package.json; `.env.example` host actual + lockdown off por defecto.
- **Por quÃ© / notas:** Evitar regresiones OTA y desfases; hallazgos abiertos: presence multi-device, JWT en query avatar, web DM sin delete/react, calls in-memory.
- **Archivos / refs:** `018_dm_messages.sql`, `config.js`, `presence.js`, `BUILD-APK-WHATSAPP.cmd`, canvas `auditoria-tacticalptx`

## 2026-08-25 â€” APK 1.8.19+28 publicada (OTA)

- **Tipo:** feature | ops
- **Ãrea:** mobile | ops
- **QuÃ©:** APK **1.8.19+28** con galerÃ­a swipe de imÃ¡genes (estilo WhatsApp) y links clicables en chat; OTA `versionCode` 28, `force: true`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.19+28.apk`, `backend/app-updates/`, `mobile/pubspec.yaml`, `backend/src/version.js`

## 2026-08-25 â€” Chat: galerÃ­a swipe de imÃ¡genes (estilo WhatsApp)

- **Tipo:** feature | ux
- **Ãrea:** web | mobile
- **QuÃ©:** En vista ampliada, deslizar izquierda/derecha (app) o flechas/swipe/teclado (web) entre todas las imÃ¡genes del mismo chat (grupo y DM). Contador `n / total`.
- **Por quÃ© / notas:** Igual que WhatsApp; antes solo se veÃ­a la imagen tocada.
- **Archivos / refs:** `chat_image_gallery.dart`, `chat_panel.dart`, `direct_pane.dart`, `ImageGalleryLightbox.jsx`, `ChatMedia.jsx`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `styles.css`

## 2026-08-25 â€” Chat: links clicables (web + app)

- **Tipo:** feature | ux
- **Ãrea:** web | mobile
- **QuÃ©:** URLs en mensajes (http/https, www, geo, mailto, tel) se muestran como enlace y abren el navegador / app correspondiente. Grupo y DM.
- **Archivos / refs:** `LinkifiedText.jsx`, `linkified_text.dart`, `WhatsAppChat.jsx`, `DirectChat.jsx`, `chat_panel.dart`, `direct_pane.dart`, `AndroidManifest.xml` queries

## 2026-08-25 â€” APK 1.8.18+27 publicada (OTA)

- **Tipo:** ops | release
- **Ãrea:** mobile | backend
- **QuÃ©:** Release **1.8.18+27** con icono verde, mute radio, adjuntos video/docs, colgado bilateral de llamadas, arranque mÃ¡s rÃ¡pido. APK en OTA + Soporte.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.18+27.apk`, `backend/app-updates/files/TacticalPtx.apk`, `android.json`

## 2026-08-25 â€” Web chat: lightbox sin menÃº duplicado + Esc

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Vista ampliada de imagen sin barra superior de acciones (solo menÃº contextual del centro). Esc cierra **menÃº de opciones y lightbox** a la vez. Nombres de media: conserva el original si es legible; si no â†’ `Img.jpg` / `Video.mp4` / `Archivo.ext`.
- **Archivos / refs:** `ChatMedia.jsx`, `WhatsAppChat.jsx`, `GlobalEscapeClose.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 â€” App Radio: mute de escucha (altavoz)

- **Tipo:** feature | ux
- **Ãrea:** mobile
- **QuÃ©:** BotÃ³n de altavoz en el panel Radio silencia el **audio entrante** del canal (`listenMuted`); estado **MUTE** + icono `volume_off`. Persiste en SharedPreferences. PTT propio sigue funcionando. Se aplica a tracks LiveKit remotos (disable/enable).
- **Archivos / refs:** `channel_session.dart`, `radio_screen.dart`

## 2026-08-25 â€” AuditorÃ­a: desfases corregidos

- **Tipo:** fix | docs
- **Ãrea:** backend | web | mobile | docs
- **QuÃ©:** AlineaciÃ³n versiones **1.8.17** (API `version.js`/`package.json`, web `package.json`, OTA example `versionCode` 26). BitÃ¡cora: eliminadas ~94 entradas duplicadas de Â«PostgreSQL reiniciadoÂ». Fix fuga LiveKit si falla conectar llamada; preview DM de video en app; lÃ­mites media en `V1_1_MEDIA_GPS.md`.
- **Archivos / refs:** `version.js`, `package.json` (backend/web), `android.json.example`, `BITACORA_*`, `direct_pane.dart`, `channel_session.dart`, `V1_1_MEDIA_GPS.md`

## 2026-08-25 â€” Llamada personal: colgar en ambos lados

- **Tipo:** fix
- **Ãrea:** mobile | web | backend
- **QuÃ©:** Si uno cuelga la llamada 1:1, el otro tambiÃ©n cierra la UI (app ya no se quedaba en pantalla de llamada). Escucha `call:ended` + salida del peer en LiveKit; API emite el evento a ambos usuarios.
- **Archivos / refs:** `PrivateCallScreen` (`direct_pane.dart`), `channel_session.dart`, `calls.js`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`

## 2026-08-25 â€” Chat: videos, documentos y archivos (web + app)

- **Tipo:** feature | ux
- **Ãrea:** backend | web | mobile
- **QuÃ©:** Adjuntar como WhatsApp: **video**, **documentos** (PDF/Office) y **archivos** (ZIP/RAR/7zâ€¦). MenÃº Foto / Video / Documento en grupo y DM (web y app). Reproductor de video y tarjeta de archivo con abrir/descargar. LÃ­mites: imagen 10 MB, audio 15 MB, docs 25 MB, video 50 MB. Bloqueo de ejecutables.
- **Archivos / refs:** `uploads.js`, `messages.js`, `dm.js`; `WhatsAppChat.jsx`, `DirectChat.jsx`, `ChatMedia.jsx`, `mediaKind.js`; `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`, `media_kind.dart`

## 2026-08-25 â€” App: arranque mÃ¡s rÃ¡pido + icono verde

- **Tipo:** mejora | ux
- **Ãrea:** mobile
- **QuÃ©:** Splash ya no espera Firebase/mic/Shorebird antes de pintar; check de APK con timeout 3 s y mensajes claros. Icono launcher regenerado con fondo oliva `#243D20` (`tacticalptx.png`); splash nativo y boot screen con papel institucional + logo.
- **Por quÃ© / notas:** Â«Cargando configuraciÃ³nâ€¦Â» se sentÃ­a lento por awaits encadenados. Hace falta **APK nueva** para ver el icono en el launcher.
- **Archivos / refs:** `main.dart`, `app_update.dart`, `colors.xml`, `launch_background.xml`, mipmaps via `flutter_launcher_icons`

## 2026-08-25 â€” Chat canal: mensaje/llamada personal entre miembros

- **Tipo:** feature | ux
- **Ãrea:** mobile | web
- **QuÃ©:** Desde el chat de grupo/canal se puede contactar a otro miembro: **mensaje personal** (DM) o **llamada personal**. App: tocar nombre del mensaje, cabecera del canal o chips en Radio. Web: tocar nombre, cabecera Â«en lÃ­neaÂ» o lista de en lÃ­nea en Radio.
- **Archivos / refs:** `peer_actions.dart`, `chat_panel.dart`, `chat_inbox_screen.dart`, `radio_screen.dart`; `WhatsAppChat.jsx`, `ChatInbox.jsx`, `RadioPage.jsx`, `styles.css`

## 2026-08-25 â€” App: tono SMS Nokia (Morse) en notificaciones

- **Tipo:** feature | ux
- **Ãrea:** mobile | backend
- **QuÃ©:** Notificaciones de **mensajes** usan tono **SMS Nokia** (cÃ³digo Morse SMS), fuerte y claro. Canal Android nuevo `tacticalptx_alerts_nokia` + `res/raw/nokia_sms.wav`; FCM apunta a ese sonido.
- **Por quÃ© / notas:** Android no cambia el sonido de un canal ya creado â†’ canal nuevo. Requiere **reinstalar/actualizar APK**. Llamadas siguen con tono por defecto del sistema.
- **Archivos / refs:** `mobile/android/.../res/raw/nokia_sms.wav`, `push_service.dart`, `fcm.js`, `assets/sounds/nokia_sms.wav`, iOS `Runner/nokia_sms.wav`

## 2026-08-25 â€” Radio: un solo botÃ³n PTT (sin duplicar)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** En **Radio PTT** ya no se muestra el PTT mini del dock superior (quedaba duplicado junto al PTT grande). El mini sigue en el resto de pestaÃ±as (Seguimiento, mapa, etc.).
- **Archivos / refs:** `DispatchLayout.jsx`

## 2026-08-25 â€” App: menÃº WhatsApp en chat grupal y DM

- **Tipo:** feature | ux
- **Ãrea:** mobile | backend
- **QuÃ©:** Mantener pulsado un mensaje abre menÃº estilo WhatsApp: **reaccionar**, **responder**, **copiar**, **reenviar**, **fijar/desfijar**, **editar** (grupo), **eliminar**. Chat personal (DM) con reply, reacciones y borrado; fijado local por conversaciÃ³n.
- **Por quÃ© / notas:** Paridad con la consola web y UX pedida en app. Fijar es local (dispositivo). Reenviar manda el texto/preview a un contacto DM.
- **Archivos / refs:** `mobile/lib/chat_message_actions.dart`, `chat_panel.dart`, `direct_pane.dart`, `api_client.dart`; `backend/src/services/dm.js`, `routes/dm.js`

## 2026-08-25 â€” Centro de mando: panel inferior visible (grabaciones)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Actividad reciente y **Grabaciones PTT** ya no se cortan: mitad inferior con `min-height:0`, reparto 50/50 con mapa, scroll interno en actividad y grabaciones.
- **Por quÃ© / notas:** `.cc-lower` no encogÃ­a en flex (`min-height` implÃ­cito del contenido) y `.cc-activity` usaba `max-height:40%` sin alto fijo del padre.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 â€” Mapas: foto real en marcador + cursor visible

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Marcadores usan URL HTTP `/api/avatars/:id?token=` (igual que la lista) con `background-image` en lugar de `<img>` (Leaflet rompÃ­a el tamaÃ±o con `width:auto!important`). Cursor `move` forzado en tiles/paneles; cÃ­rculos de precisiÃ³n no interceptan el puntero.
- **Por quÃ© / notas:** CÃ­rculo blanco = foto cargada pero img colapsada por CSS de Leaflet; cursor invisible = `grab` no soportado en Windows + overlays SVG interactivos.
- **Archivos / refs:** `api.js`, `mapAvatarIcon.js`, `mapLeafletUtils.jsx`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 â€” Mapas: misma foto en marcador y cursor de arrastre

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Marcadores usan la **misma foto** que la lista lateral (ya no miniatura separada que fallaba). Claves estables evitan marcadores duplicados al cargar avatares. Cursor **grab/grabbing** se mantiene al pasar sobre iconos en Seguimiento, Centro de mando y Geocercas.
- **Por quÃ© / notas:** La miniatura circular a veces quedaba `null` con la foto completa OK; las claves con `avatarReady` remontaban todos los markers. Los `pointer-events` del icono quitaban el cursor de mano al hover.
- **Archivos / refs:** `avatarBlobCache.js`, `useMapAvatarPhotos.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `mapLeafletUtils.jsx`, `command-center.css`, `dispatch.css`

## 2026-08-25 â€” Mapa: foto de perfil en marcador (data URL)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Leaflet no pintaba `blob:` en divIcon (cÃ­rculo blanco). Avatares en mapa usan **data URL** + `background-image`; marcador se recrea al cargar la foto.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 â€” APK 1.8.17+26 publicada (OTA)

- **Tipo:** release | ops
- **Ãrea:** mobile
- **QuÃ©:** Publicada **1.8.17+26** vÃ­a `PUBLISH-APK-UPDATE.cmd`: fix teclado en chat/DM (`resizeToAvoidBottomInset`), manifiesto `android.json` versionCode **26**, APK en `backend/app-updates/files/` y `Soporte/APK/`.
- **Por quÃ© / notas:** La OTA no avisaba porque servidor y clientes seguÃ­an en **25** (mismo `versionCode`). Quien tenga â‰¤25 verÃ¡ actualizaciÃ³n al abrir la app si la API pÃºblica responde.
- **Archivos / refs:** `mobile/pubspec.yaml`, `backend/app-updates/android.json`, `Soporte/APK/TacticalPtx-1.8.17+26.apk`

## 2026-08-25 â€” Lightbox chat: un solo menÃº de acciones

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Al ampliar imagen ya no aparecen **dos** menÃºs (barra superior + cuadro flotante); solo la barra fija Responder / Copiar / Descargar. Clic derecho ya no abre menÃº duplicado.
- **Archivos / refs:** `ChatMedia.jsx`

## 2026-08-25 â€” Mapa: misma foto de perfil en marcador

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Marcadores del mapa cargan el avatar con **Bearer** (blob en memoria), igual que la lista lateral â€” sin superponer inicial â€œGâ€ sobre la foto ni fondo verde encima. Marcador seleccionado queda por encima si hay solape.
- **Archivos / refs:** `avatarBlobCache.js`, `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 â€” Seguimiento en vivo: layout y mapa acotado

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Panel **Seguimiento en vivo** redistribuido: KPIs en chips, capas del mapa sobre el mapa, lista con scroll interno, detalle del operador abajo. Mapa con borde/sombra y alto limitado al viewport (sin â€œscroll infinitoâ€); `ResizeObserver` recalcula Leaflet al cambiar el panel.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-25 â€” Mapa: icono con foto de perfil del usuario

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Marcadores de Seguimiento / Mapa en vivo cargan la **foto de perfil** vÃ­a `/api/avatars/:userId` (con fallback a inicial si no hay foto). Se preserva `avatarUrl` al fusionar GPS por socket/poll; Leaflet actualiza el icono al cambiar.
- **Archivos / refs:** `mapAvatarIcon.js`, `LiveTrackMap.jsx`, `CommandCenter.jsx`, `DispatchMap.jsx`, `liveTiming.js`, `api.js`, `command-center.css`

## 2026-08-25 â€” Web chat: menÃº contextual estilo WhatsApp

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:** En Radio PTT / chat de grupo: clic derecho o â‹¯ abre menÃº propio (Reaccionar, Responder, Copiar, Copiar imagen, Descargar, Copiar nombre, Editar, Eliminar). Lightbox de imagen con barra de acciones y menÃº contextual (sin menÃº del navegador).
- **Archivos / refs:** `WhatsAppChat.jsx`, `ChatMedia.jsx`, `chatMediaActions.js`, `styles.css`

## 2026-08-25 â€” Web: catÃ¡logos y mapas acotados al viewport

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Usuarios y mapas ya no â€œcuelganâ€ sin fin: scroll interno en lista de usuarios; **Seguimiento** y **Mapa en vivo** ocupan el alto visible con borde inferior claro.
- **Archivos / refs:** `command-center.css`

## 2026-08-25 â€” Web: lista de usuarios en tarjetas

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Panel Usuarios pasa de tabla ancha a **tarjetas** por operador: avatar, indicativo, datos en columnas y acciones en fila inferior.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 â€” MÃ³vil: teclado no tapa cuadro de chat

- **Tipo:** fix | ux
- **Ãrea:** mobile
- **QuÃ©:** DM y chat de grupo usan `Scaffold` con `resizeToAvoidBottomInset` para que el composer quede visible al escribir.
- **Archivos / refs:** `direct_pane.dart`, `chat_inbox_screen.dart` (`GroupChatScreen`)

## 2026-08-25 â€” Web: sin borde amarillo en campos pendientes (alta usuario)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Eliminado resaltado Ã¡mbar (`.cc-field-pending`) en inputs del alta de usuario; se mantiene el checklist de faltantes.
- **Archivos / refs:** `DispatchUsers.jsx`, `command-center.css`

## 2026-08-25 â€” Web: grado Subteniente â†’ Sbtte.

- **Tipo:** mejora | ux
- **Ãrea:** web
- **QuÃ©:** Abreviatura **Subteniente** corregida a `Sbtte.` (antes `Subtte.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 â€” Alta usuario: Especialidad tras Grado, Cargo al final

- **Tipo:** feature | ux
- **Ãrea:** web | backend | database
- **QuÃ©:** Formulario separa **Especialidad** (opcional, tras grado) y **Cargo** (obligatorio, al final del paso Generales). Nueva columna `users.cargo`; indicativo usa cargo.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `rfcUsername.js`, `017_user_cargo.sql`

## 2026-08-25 â€” Web: abreviaturas grado Sld. y Gral. Brig.

- **Tipo:** mejora | ux
- **Ãrea:** web
- **QuÃ©:** CatÃ¡logo de grados: **Soldado** â†’ `Sld.`; **General Brigadier** â†’ `Gral. Brig.` (antes `Gral. Brigr.`).
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`

## 2026-08-25 â€” Web: selector de grado solo abreviatura

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Desplegable de grado en alta de usuario muestra solo la abreviatura (ej. `Cap. 1/o.`), sin el nombre largo.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 â€” Web: pantalla en blanco en Usuarios (roleLabel)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Restaurada funciÃ³n `roleLabel` en panel Usuarios; sin ella React crasheaba al pintar la tabla. Eliminado CSS huÃ©rfano en `styles.css`.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/styles.css`

## 2026-08-25 â€” Web: estrella favorito sin mojibake (SVG)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** BotÃ³n favorito (junto a **Llamar** y en lista de chats) usa icono SVG en lugar de carÃ¡cter â˜… corrupto (`Ã¢Ëœâ€¦`).
- **Archivos / refs:** `web/src/StarIcon.jsx`, `DirectChat.jsx`, `ChatInbox.jsx`, `styles.css`

## 2026-08-25 â€” Web: ticks de lectura sin mojibake en DM

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Corregidos caracteres corruptos (`Ã¢Å“"`) en mensajes directos: palomitas âœ“/âœ“âœ“, estrella favorito, enviar, llamada entrante.
- **Por quÃ© / notas:** El archivo `DirectChat.jsx` tenÃ­a UTF-8 mal interpretado; ahora usa escapes `\u2713` etc.
- **Archivos / refs:** `web/src/DirectChat.jsx`, `web/src/WhatsAppChat.jsx`

## 2026-08-25 â€” Web: alta de usuario reorganizada con checklist

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Modal **Alta de usuario** en 3 pasos con stepper visual, secciones (Identidad militar, Nombre completo, Vista previa, UbicaciÃ³n orgÃ¡nica), checklist â€œFalta completarâ€ y borde Ã¡mbar en campos pendientes.
- **Por quÃ© / notas:** Ver de un vistazo quÃ© falta antes de avanzar; grado+cargo juntos, nombres agrupados, regiÃ³n/zona/unidad en cascada.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 â€” MÃ³vil: inbox Chats tipo WhatsApp + pestaÃ±a Radio

- **Tipo:** feature | ux
- **Ãrea:** mobile
- **QuÃ©:** Dos pestaÃ±as inferiores (**Chats** | **Radio**). Chats unifica grupos + DM con filtros Todos / No leÃ­dos / Favoritos / Grupos, bÃºsqueda, favoritos locales y badges. Al tocar conversaciÃ³n se abre pantalla completa; Radio conserva PTT, pÃ¡nico y canales (Mapa/Canales en menÃº â‹®).
- **Por quÃ© / notas:** Flujo principal estilo WhatsApp; radio como segunda pestaÃ±a sin saturar la barra inferior.
- **Archivos / refs:** `mobile/lib/screens/chat_inbox_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `radio_screen.dart`, `api_client.dart`; APK **1.8.16+25**

## 2026-08-25 â€” Alta usuario: generales â†’ adscripciÃ³n; indicativo con cargo

- **Tipo:** feature | ux
- **Ãrea:** web | backend
- **QuÃ©:** Formulario de usuarios en 3 pasos (Generales â†’ RegiÃ³n/Zona/Unidad â†’ Grupos). Campo Â«Cargo / puestoÂ» (ej. Jfe. Rgnl. TIC). Indicativo en chat/radio: `Grado Apellido, Cargo` (ej. Cap. Luna, Jfe. Rgnl. TIC).
- **Por quÃ© / notas:** Orden institucional claro; el cargo viaja en `display_name` para mÃ³vil y web.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `backend/src/services/rfcUsername.js`, `backend/src/routes/admin.js`

## 2026-08-25 â€” NavegaciÃ³n mÃ³vil mÃ¡s clara (sin cÃ¡mara suelta)

- **Tipo:** ux | mejora
- **Ãrea:** mobile
- **QuÃ©:** Barra inferior con etiquetas (Mensajes, Mapa, Directos, Canales); se quitÃ³ el botÃ³n CÃ¡mara que mandaba fotos al chat sin contexto. En el chat, un solo botÃ³n **+** abre menÃº GalerÃ­a / CÃ¡mara / Archivo.
- **Por quÃ© / notas:** Flujo mÃ¡s entendible estilo WhatsApp; fotos solo desde el chat.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/screens/chat_panel.dart`; APK **1.8.15+24**

## 2026-08-25 â€” Panel Usuarios rediseÃ±ado (web despacho)

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Lista de usuarios como vista principal con skeleton al cargar, bÃºsqueda/filtros, actualizaciÃ³n en segundo plano sin vaciar la tabla, y alta de usuario en modal (+ Nuevo usuario) en lugar del formulario fijo arriba.
- **Por quÃ© / notas:** Mejor flujo de carga y menos scroll; la tabla queda visible de inmediato tras la carga.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`, `web/src/dispatch/command-center.css`

## 2026-08-25 â€” Flecha pasos alta de usuario (web)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:** Corregido carÃ¡cter roto `Ã¢â€ '` entre Â«1. DatosÂ» y Â«2. GruposÂ» en el formulario de alta de usuario del despacho; ahora muestra `â†’`.
- **Por quÃ© / notas:** Mojibake por codificaciÃ³n incorrecta del sÃ­mbolo Unicode en el JSX.
- **Archivos / refs:** `web/src/dispatch/DispatchUsers.jsx`

## 2026-08-25 â€” APK 1.8.14 tap notificaciÃ³n abre chat/DM

- **Tipo:** fix | ux | ops
- **Ãrea:** mobile | ops
- **QuÃ©:**
  - Tap en notificaciÃ³n de mensaje de grupo â†’ pane Chat del canal correcto, foco en compositor; cold start consume `pendingGroupId` tras bootstrap.
  - Tap en notificaciÃ³n DM â†’ pane Directos y abre el hilo del peer (`initialPeerId`).
  - `RadioShell` registra `onNotificationOpen` / `onNotificationData`; `PushService` guarda `pendingMessageId` y cold start de notificaciÃ³n local.
  - Publicada APK **1.8.14+23** (OTA `android.json` versionCode 23); copias en `Soporte/APK/`.
- **Por quÃ© / notas:** PushService ya dejaba pending al tocar, pero el shell no consumÃ­a ni navegaba (quedaba en radio).
- **Archivos / refs:** `radio_shell.dart`, `push_service.dart`, `direct_pane.dart`, `chat_panel.dart`, `pubspec.yaml`

## 2026-08-25 â€” APK 1.8.13 vibraciÃ³n fuerte en pÃ¡nico

- **Tipo:** feature | ux | ops
- **Ãrea:** mobile | ops
- **QuÃ©:**
  - Alerta de pÃ¡nico entrante: vibraciÃ³n nativa en bucle (500 ms on / 200 ms off, amplitud mÃ¡xima si el hardware lo permite) junto con la sirena; se cancela al pulsar **Enterado** / stop.
  - BotÃ³n PÃNICO (emisor): rÃ¡faga fuerte de confirmaciÃ³n vÃ­a API `Vibrator` (`package:vibration` 3.2), no solo `HapticFeedback`.
  - Publicada APK **1.8.13+22** (OTA `android.json` versionCode 22); copias en `Soporte/APK/`.
- **Por quÃ© / notas:** El haptic corto no se sentÃ­a como vibraciÃ³n real en muchos equipos.
- **Archivos / refs:** `panic_vibration.dart`, `channel_session.dart`, `radio_screen.dart`, `pubspec.yaml`, `Publish-ApkUpdate.ps1`

## 2026-08-25 â€” APK 1.8.12 presencia + pÃ¡nico circular

- **Tipo:** feature | ux | ops
- **Ãrea:** mobile | backend | ops
- **QuÃ©:**
  - Publicada APK **1.8.12+21** (OTA `android.json` versionCode 21) con presencia Skype (verde/amarillo) y botÃ³n PÃ¡nico circular.
  - Copias en `Soporte/APK/TacticalPtx-1.8.12+21.apk` y `TacticalPtx-latest.apk`.
  - API reiniciada (`infra/start-api.cmd`); health TLS `:4000` ok (presence Redis JSON live).
- **Archivos / refs:** `mobile/pubspec.yaml`, `Publish-ApkUpdate.ps1`, `backend/app-updates/android.json`, `presence.js`, `radio_screen.dart`

## 2026-08-25 â€” Presencia tipo Skype (verde / amarillo / rojo)

- **Tipo:** feature | ux
- **Ãrea:** mobile | backend | web
- **QuÃ©:**
  - Puntos de color en chips de presencia del canal radio: **verde** = en la app (foreground); **amarillo** = conectado pero minimizado/bloqueado (background); **rojo** reservado para offline (v1: al salir/stale desaparecen del listado).
  - Redis presence guarda JSON `{displayName,focus}`; `ptt:join` / `presence:ping` envÃ­an `focus`; broadcast al cambiar foco.
  - Chips con `StadiumBorder`; web RadioPage con puntos active/away.
- **Por quÃ© / notas:** Entra en el prÃ³ximo APK (sin bump de versiÃ³n en este cambio). Roster offline con chips rojos = mejora futura.
- **Archivos / refs:** `presence.js`, `ptt.js`, `channel_session.dart`, `radio_screen.dart`, `radio_shell.dart`, `usePtt.js`, `RadioPage.jsx`

## 2026-08-25 â€” BotÃ³n PÃ¡nico circular (sin esquinas)

- **Tipo:** ux
- **Ãrea:** mobile
- **QuÃ©:** Esquinas del botÃ³n PÃ¡nico redondeadas/circulares (`CircleBorder` + clip); sin fondo/splash cuadrado.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart` (`_PanicButton`)

## 2026-08-25 â€” Foto de perfil con recorte estilo WhatsApp

- **Tipo:** feature | ux | fix
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Tras elegir/tomar foto: pantalla de recorte circular (mover + zoom), export JPEG 800Ã—800 ~85% y subida con `Content-Type: image/jpeg`.
  - Backend `/api/me/avatar` acepta mime vacÃ­o/`octet-stream` con extensiÃ³n vÃ¡lida y valida magic bytes; mensajes de error en espaÃ±ol.
  - SnackBar ya no muestra `Exception: â€¦`; APK **1.8.11+20**.
- **Por quÃ© / notas:** Android enviaba HEIC/octet-stream y multer rechazaba; falta de recorte tipo WhatsApp.
- **Archivos / refs:** `radio_shell.dart`, `api_client.dart`, `es_msg.dart`, `me.js`, `image_cropper`, `AndroidManifest.xml`, `Soporte/APK/`

## 2026-08-25 â€” Notificaciones se limpian al leer (estilo WhatsApp)

- **Tipo:** fix | ux
- **Ãrea:** mobile | backend
- **QuÃ©:**
  - Al abrir chat de canal o un DM, se cancelan las notificaciones de esa conversaciÃ³n (tag `g:` / `dm:`) y tambiÃ©n `cancelAll` para avisos viejos sin tag.
  - Resume de la app con chat/DM abierto vuelve a limpiar bandeja; `markRead` ya no borra avisos si la app estÃ¡ en segundo plano.
  - FCM/Android ya usan `tag` + `collapseKey`; MethodChannel nativo `cancelTag` / `cancelAll`.
  - APK **1.8.10+19**.
- **Por quÃ© / notas:** Las push de chat quedaban en la bandeja tras leer (comportamiento distinto a WhatsApp).
- **Archivos / refs:** `push_service.dart`, `radio_shell.dart`, `direct_pane.dart`, `channel_session.dart`, `MainActivity.kt`, `fcm.js`, `Soporte/APK/`

## 2026-08-25 â€” UX: chat mÃ³vil estilo WhatsApp (sin huecos)

- **Tipo:** ux | mejora
- **Ãrea:** mobile
- **QuÃ©:**
  - Chat de canal y DM: fondo tipo WA, burbujas compactas (colas, agrupaciÃ³n), lista `reverse`, hora + ticks, compositor redondo.
  - En chat/DM se oculta la barra inferior para quitar espacio vacÃ­o / doble chrome.
  - APK **1.8.9+18**.
- **Archivos / refs:** `chat_panel.dart`, `direct_pane.dart`, `radio_shell.dart`, `Soporte/APK/`

## 2026-08-25 â€” Fix UX: timeout por IP antigua en APK

- **Tipo:** fix | ux
- **Ãrea:** mobile | ops
- **QuÃ©:**
  - Causa: APK vieja apuntaba a `189.175.38.29:4000` (IP ya no responde); el host actual es `https://189.152.200.238.sslip.io`.
  - Mensaje de bootstrap mÃ¡s claro ante Timeout/Socket; usuario debe instalar `TacticalPtx-1.8.8+17.apk` (OTA no llega si la API vieja estÃ¡ caÃ­da).
- **Archivos / refs:** `radio_shell.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.8+17.apk`

## 2026-08-25 â€” Dominio HTTPS publico (Caddy + Let's Encrypt / sslip.io)

- **Tipo:** security | infra | ops
- **Ãrea:** infra | mobile | docs
- **QuÃ©:**
  - Borde Caddy en :80/:443 con cert **Let's Encrypt** para `https://189.152.200.238.sslip.io` (sin comprar dominio).
  - Scripts `START-PUBLIC-EDGE.ps1`, `Caddyfile.edge`, guÃ­a `DOMINIO_Y_CERTIFICADO.md`.
  - IP publica actualizada (`189.152.200.238`); UPnP 80/443 + stack; APK **1.8.8+17** con `API_BASE` al dominio.
  - Nota: si el ISP cambia la IP, re-ejecutar edge y republicar APK (o usar dominio propio).
- **Archivos / refs:** `infra/Caddyfile.edge`, `infra/START-PUBLIC-EDGE.ps1`, `infra/caddy/`, `Soporte/Documentos/DOMINIO_Y_CERTIFICADO.md`

## 2026-08-25 â€” Ops: UPnP reaplicado (+ TURN 3478)

- **Tipo:** ops
- **Ãrea:** infra
- **QuÃ©:**
  - `Reinforce-UPnP.ps1`: mapeos OK 4000/5173/7880/7881/7882/**3478** â†’ `192.168.1.66`.
  - API/Web locales OK; Postgres Running/Automatic. Curl a IP pÃºblica desde el propio host = `000` (hairpin NAT tÃ­pico; validar desde 4G).
- **Archivos / refs:** `infra/Reinforce-UPnP.ps1`

## 2026-08-25 â€” Endurecimiento completo (ops + seguridad + TURN)

- **Tipo:** security | infra | ops
- **Ãrea:** backend | mobile | infra | docs
- **QuÃ©:**
  - Script `infra/HARDEN.ps1` / `.cmd`: Postgres **Automatic**, firewall (+UDP 3478), UPnP, `APP_UPDATE_SECRET`, `ALLOW_HOST_LOCKDOWN=1`, rate limits.
  - OTA: clave `X-App-Update-Key` + token HMAC de descarga; rate-limit dedicado; prod exige secreto.
  - Metrics/admin: Redis **SCAN** (sin `KEYS`).
  - LiveKit TURN embebido UDP 3478; Caddy `/rtc`; versiones API **1.8.6**; APK **1.8.7+16** (publicar con secreto).
  - GuÃ­a `Soporte/Documentos/SEGURIDAD_HARDENING.md`.
- **Archivos / refs:** `appUpdate.js`, `config.js`, `auth.js`, `redis.js`, `livekit.dev.yaml`, `Ensure-Firewall.ps1`, `HARDEN.ps1`, `mobile/lib/config.dart`, `PUBLISH-APK-UPDATE.cmd`

## 2026-08-24 â€” Fix: Enterado en pÃ¡nico cerraba la APK

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:**
  - Al pulsar **Enterado** en la alerta de pÃ¡nico la app se cerraba: doble `Navigator.pop` (botÃ³n + listener tras `ackIncomingPanic`/`notifyListeners`) y posible error no manejado al `stop()` de la sirena.
  - Enterado ahora cierra solo el diÃ¡logo; la app permanece en radio/chat. VersiÃ³n **1.8.6+15** publicada (Soporte + OTA).
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`, `mobile/lib/channel_session.dart`, `mobile/pubspec.yaml`, `Soporte/APK/`, `backend/app-updates/`

## 2026-08-24 â€” Fix: xhr poll error Socket.IO en consola HTTPS

- **Tipo:** fix | ux
- **Ãrea:** web | backend
- **QuÃ©:**
  - Causa: Socket.IO caÃ­a a long-polling XHR (a veces por proxy Vite / orden de transports) y el banner rojo Â«xhr poll errorÂ» **no se limpiaba** aunque el enlace reconectara (Â«Enlace okÂ» / Â«Audio okÂ»).
  - Cliente: mismo origen vÃ­a proxy Vite `/socket.io` (bloquea `http://` bajo pÃ¡gina HTTPS); transports `websocket` â†’ `polling`; limpia error al `connect`.
  - Vite: timeouts del proxy socket; DirectChat unificado a `socketConfig`.
  - Mensaje UI en espaÃ±ol si vuelve a fallar el transporte.
- **Por quÃ© / notas:** Verificar: Ctrl+F5 en `https://189.175.38.29:5173` â€” sin banner rojo; `/socket.io/?EIO=4&transport=polling` debe responder `0{â€¦}` por HTTPS.
- **Archivos / refs:** `web/src/socketConfig.js`, `web/src/usePtt.js`, `web/src/DirectChat.jsx`, `web/src/esMsg.js`, `web/vite.config.js`, `backend/src/server.js`

## 2026-08-24 â€” Fix: LiveKit PTT bajo HTTPS remoto (mixed content)

- **Tipo:** fix | infra
- **Ãrea:** web | backend | infra
- **QuÃ©:**
  - Causa: consola `https://IP:5173` recibÃ­a `ws://IP:7880` â†’ el navegador bloqueaba la seÃ±al (mixed content) â†’ Â«No se pudo conectar el audio (LiveKit)Â».
  - Web: `publicLiveKitUrl` usa `wss://mismo-origen`; Vite proxy `/rtc` â†’ `http://127.0.0.1:7880`.
  - LiveKit reiniciado con `--node-ip 189.175.38.29`; UPnP 4000/5173/7880/7881 + UDP 7882 reaplicado.
  - Docs ACCESO_DIRECTO + `.env.example` aclaran seÃ±al vs media.
- **Por quÃ© / notas:** URL resultante consola: **`wss://189.175.38.29:5173`** (proxy). API/mÃ³vil: **`ws://189.175.38.29:7880`**. Media ICE: TCP 7881 / UDP 7882.
- **Archivos / refs:** `web/src/livekitUrl.js`, `web/vite.config.js`, `backend/src/services/livekit.js`, `infra/livekit.dev.yaml`, `infra/Reinforce-UPnP.ps1`, `infra/EXPOSE-UPNP.ps1`

## 2026-08-24 â€” Fix: consola web HTTPS para PTT remoto

- **Tipo:** fix | infra | ux
- **Ãrea:** web | infra | backend
- **QuÃ©:**
  - Vite `:5173` usa TLS con `infra/certs/lan-*.pem` (mismo cert que la API).
  - Guardas si no hay `navigator.mediaDevices` (mensaje en espaÃ±ol; sin crash).
  - `WEB_PUBLIC_URL=https://189.175.38.29:5173`; CORS incluye orÃ­genes HTTPS pÃºblicos.
  - Docs/arranque (`start-web`, `LEVANTAR`, ACCESO_DIRECTO, EXPOSE-*) actualizados.
- **Por quÃ© / notas:** Abrir `http://IP:5173` desde 4G â†’ `getUserMedia` undefined. Remoto: **https://189.175.38.29:5173** (aceptar cert autofirmado).
- **Archivos / refs:** `web/vite.config.js`, `web/src/voiceRecord.js`, `web/src/usePtt.js`, `web/src/esMsg.js`, `backend/.env`, `infra/start-web.cmd`

## 2026-08-24 â€” Fix: GET / API redirige a consola web

- **Tipo:** fix | ux
- **Ãrea:** backend
- **QuÃ©:**
  - `GET /` en la API (:4000) deja de devolver `{"ok":false,"error":"Ruta no encontrada"}` y responde **302** a la consola (`WEB_PUBLIC_URL`, default `http://189.175.38.29:5173`).
  - `/api/health` sin cambios. RaÃ­z permitida tambiÃ©n bajo lockdown (solo redirect).
  - Documentado en `.env.example`; en host: `WEB_PUBLIC_URL=http://189.175.38.29:5173`.
  - Con TLS activo no hay listener HTTP en :4000: `http://â€¦:4000` no llega a Express (usar `https://â€¦:4000/` o ir directo a `:5173`). Clientes APK `https://â€¦:4000` intactos.
- **Por quÃ© / notas:** Usuario abriÃ³ la raÃ­z de la API desde el mÃ³vil esperando â€œentrarâ€ a la app web.
- **Archivos / refs:** `backend/src/server.js`, `backend/src/config.js`, `backend/src/services/intrusion.js`, `backend/.env.example`

## 2026-08-24 â€” Ops: PostgreSQL reiniciado (login/despacho)

- **Tipo:** ops | fix
- **Ãrea:** database | ops
- **QuÃ©:**
  - Servicio `postgresql-x64-17` estaba **Stopped** (StartType Manual); provocaba fallos de login/despacho aunque API/web/OTA respondieran.
  - Arranque elevado OK â†’ **Running**; `tacticalptx_db` accesible (psql; 8 usuarios).
  - Health API: `ready:true`, `db:connected` en `https://127.0.0.1:4000/api/health` y `https://189.175.38.29:4000/api/health`. Web `5173` y Redis OK; no hizo falta reiniciar API.
- **Por quÃ© / notas:** `Start-Service` sin Admin falla (â€œNo se puede abrir el servicioâ€). Comando elevado: `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-Command','Start-Service postgresql-x64-17'`. Conviene valorar StartType **Automatic** para que no quede caÃ­do tras reinicio.
- **Archivos / refs:** servicio Windows `postgresql-x64-17`; data `C:\Program Files\PostgreSQL\17\data`


## 2026-08-24 â€” APK OTA 1.8.5+14 (host pÃºblico)

- **Tipo:** ops | feature
- **Ãrea:** mobile | backend | infra
- **QuÃ©:**
  - VersiÃ³n mÃ³vil `1.8.5+14`; `API_BASE` por defecto `https://189.175.38.29:4000` (pubspec/scripts/`config.dart`).
  - PublicaciÃ³n OTA: manifiesto + APK en `backend/app-updates/`; copia `Soporte/APK/TacticalPtx-1.8.5+14-4G.apk`.
  - UPnP reaplicado (incl. TCP **5173** web): health/OTA pÃºblicos alcanzables; web remota `http://189.175.38.29:5173`.
- **Por quÃ© / notas:** Acceso PC remota vÃ­a IP pÃºblica (no LAN). PostgreSQL quedÃ³ detenido (hace falta Admin para `Start-Service`); API responde pero `db:disconnected` hasta reiniciar PG.
- **Archivos / refs:** `mobile/pubspec.yaml`, `PUBLISH-APK-UPDATE.cmd`, `BUILD-APK-WHATSAPP.cmd`, `backend/app-updates/`, `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`

## 2026-08-24 â€” Mapas: capas institucionales + zoom al cursor

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
  - Se mantienen las capas **Natural** (Carto Voyager), **SatÃ©lite** (Esri) y **Claro** (OSM); default `natural`. No se cambiÃ³ el basemap al pedir â€œcomo Google Mapsâ€.
  - Se conserva **CursorZoom** (rueda hacia el punto bajo el cursor) en Seguimiento.
  - Fondo del contenedor Leaflet en Seguimiento alineado al tono institucional Voyager (tema claro); oscuro solo en tema dark.
- **Por quÃ© / notas:** â€œComo Mapsâ€ = solo la funciÃ³n de zoom, no el estilo de teselas.
- **Archivos / refs:** `LiveTrackMap.jsx`, `DispatchMap.jsx`, `command-center.css`

## 2026-08-24 â€” ActualizaciÃ³n APK en la app (estilo BanjeCel)

- **Tipo:** feature | ops | ux
- **Ãrea:** mobile | backend | docs
- **QuÃ©:**
  - Al abrir Android: pantalla Â«Cargando configuraciÃ³nâ€¦Â»; `GET /api/app/android`; si `versionCode` del servidor es mayor, descarga APK e instala (FileProvider / instalador del sistema).
  - Manifiesto + APK en `backend/app-updates/`; `PUBLISH-APK-UPDATE.cmd`; guÃ­a `Soporte/Documentos/ACTUALIZACION_APK_EN_APP.md`.
  - Shorebird queda como parche Dart opcional; flujo principal = APK completa (sin Play Store).
- **Por quÃ© / notas:** DistribuciÃ³n institucional directa, UX equivalente a BanjeCel.
- **Archivos / refs:** `backend/src/routes/appUpdate.js`, `mobile/lib/app_update.dart`, `mobile/lib/main.dart`, `MainActivity.kt`, `PUBLISH-APK-UPDATE.cmd`


## 2026-08-24 â€” Config APK 1.8.4+13 (API 4G + OTA)

- **Tipo:** release | mejora | ops
- **Ãrea:** mobile | docs
- **QuÃ©:**
  - `pubspec` â†’ **1.8.4+13** (`versionName` / `versionCode`).
  - Build WhatsApp por defecto `API_BASE=https://189.175.38.29:4000`; `FORCE_LAN=1` para HTTPS LAN.
  - Copia a `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk` (+ `TacticalPtx-latest.apk`) y manifiesto OTA `backend/app-updates/`.
  - `network_security_config`: dominio IP pÃºblica; README/run-usb alineados a HTTPS.
- **Por quÃ© / notas:** Alineado a `LIVEKIT_PUBLIC_HOST` y al flujo de actualizaciÃ³n en app (REQUEST_INSTALL_PACKAGES / FileProvider ya en paralelo).
- **Archivos / refs:** `mobile/pubspec.yaml`, `scripts/BUILD-APK-WHATSAPP.cmd`, `network_security_config.xml`, `run-usb.ps1`, `mobile/README.md`, `Soporte/APK/TacticalPtx-1.8.4+13-4G.apk`

## 2026-08-24 â€” DiÃ¡logos in-app (sin window.confirm)

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
  - Componente `AppDialog` (estilo `sys-modal`) para confirmar / avisar dentro de la app.
  - Sustituidos `window.confirm` / `alert` en grupos, chat WhatsApp, mapa y catÃ¡logo de geocercas.
- **Por quÃ© / notas:** Los diÃ¡logos nativos del navegador no coinciden con la UI institucional.
- **Archivos / refs:** `web/src/AppDialog.jsx`, `DispatchGroups.jsx`, `WhatsAppChat.jsx`, `DispatchMap.jsx`, `GeofenceCatalog.jsx`

## 2026-08-24 â€” PTT circular y pÃ¡nico al primer toque (mÃ³vil)

- **Tipo:** ux | mejora
- **Ãrea:** mobile | web
- **QuÃ©:**
  - BotÃ³n PTT circular tÃ¡ctil (oliva/oro, etiqueta PTT / AL AIRE); hold-to-talk sin cambios.
  - PÃ¡nico mÃ¡s visible (rojo urgente) y **dispara al primer toque** â€” sin diÃ¡logo Â«Â¿confirmas?Â».
  - Web alineada: pÃ¡nico al primer clic; PTT institucional vuelve a ser cÃ­rculo (no cuadrado redondeado).
- **Por quÃ© / notas:** Captura de radio: PTT poco llamativo y pÃ¡nico con confirmaciÃ³n.
- **Archivos / refs:** `mobile/lib/screens/radio_screen.dart`, `radio_shell.dart`, `web/src/pages/RadioPage.jsx`, `web/src/institutional.css`

## 2026-08-24 â€” CorrecciÃ³n de textos UTF-8 (mojibake)

- **Tipo:** fix | ux
- **Ãrea:** web | backend
- **QuÃ©:** Corregidos acentos rotos (`SESIÃƒÂ³N` â†’ `SESIÃ“N`, contraseÃ±a, vacÃ­o, etc.) en login, chat DM y mensajes de error del socket de chat.
- **Archivos / refs:** `web/src/App.jsx`, `web/src/DirectChat.jsx`, `backend/src/socket/chat.js`

## 2026-08-24 â€” Lockdown ante intrusiÃ³n + endurecimiento

- **Tipo:** security | infra
- **Ãrea:** backend | infra | docs
- **QuÃ©:**
  - Servicio de lockdown: fallos de login â†’ fuera de servicio (503), revoca sesiones, corta sockets, aviso FCM a root/admin, incidente en Soporte/Respaldos.
  - `POST /api/security/unlock` con `LOCKDOWN_UNLOCK_SECRET`; lockdown manual por root.
  - `infra/LOCKDOWN.ps1` / `.cmd`: cierra firewall/UPnP y detiene API/Web/LiveKit.
  - `/api/metrics` solo con rol despacho; sin backdoors detectados en auditorÃ­a.
- **Archivos / refs:** `backend/src/services/intrusion.js`, `routes/security.js`, `LOCKDOWN.ps1`, `SEGURIDAD_LOCKDOWN.md`

## 2026-08-23 â€” Marca Ãºnica TacticalPtx

- **Tipo:** docs | mejora | infra
- **Ãrea:** backend | web | mobile | database | docs | infra
- **QuÃ©:**
  - Producto y docs solo bajo marca TacticalPtx (sin nombre anterior).
  - BD `tacticalptx_db`; package web `tacticalptx-web`; localStorage `tacticalptx_*`.
  - iOS bundle `com.tacticalptx.app`; display name TacticalPtx.
  - Carpeta de disco `D:\pulsanet` es solo ruta; el producto es TacticalPtx.
- **Archivos / refs:** `backend/.env`, `config.js`, `schema.sql`, `README.md`, `docs/UBICACION_PROYECTO.md`, iOS `Info.plist` / `project.pbxproj`

## 2026-08-23 â€” Firewall Windows canÃ³nico (sin variantes)

- **Tipo:** infra | security | ops
- **Ãrea:** infra
- **QuÃ©:**
 - Fuente Ãºnica `infra/Ensure-Firewall.ps1` (solo `netsh`; evita colgar `Get-NetFirewall*`).
 - 6 reglas fijas: TCP 4000/5173/7880/7881 + UDP 7882 + UDP 50000-50200.
 - Elimina variTacticalPtx / â€œTacticalPtx API TCPâ€¦â€ / livekit-server Any.
 - Integrado en `start-services.ps1`, `EXPOSE-UPNP.ps1`, `EXPOSE-PUBLIC.ps1`; launcher `ENSURE-FIREWALL.cmd`.
 - UPnP: `Reinforce-UPnP.ps1` / `EXPOSE-UPNP.ps1` (hoy el IGD del router no respondiÃ³; reintentar con UPnP activo).
- **Archivos / refs:** `infra/Ensure-Firewall.ps1`, `infra/ENSURE-FIREWALL.cmd`, `infra/Reinforce-UPnP.ps1`, `infra/start-services.ps1`

## 2026-08-23 â€” LEVANTAR-TACTICALPTX.bat corregido y reforzado

- **Tipo:** infra | ops | fix
- **Ãrea:** infra
- **QuÃ©:**
 - BAT en ASCII; `/nopause`; preflight Node/npm; LAN vÃ­a `ipconfig` (sin `Get-NetIPAddress`).
 - Health API sin `findstr` con comillas escapadas (rompÃ­a `>nul`); detecta `tacticalptx-api`.
 - Solo libera :4000/:5173 si hay listener zombie; no mata API/Web sanos.
 - Postgres 17/16/15; espera ~45 s; abre navegador solo si Web responde.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 â€” Seguimiento acotado RegiÃ³n / C.G.â€“Zona / Unidad

- **Tipo:** feature | security | ux
- **Ãrea:** backend | web
- **QuÃ©:**
 - Modelo: RegiÃ³n maestro; C.G. RegiÃ³n con unidades subordinadas directas; Zonas administran unidades; Unidades administran servicios desplegados (usuarios).
 - GPS / seguimiento / pÃ¡nico / geocerca filtrados por alcance (`loadTrackScope` + salas `dispatch:track:*`).
 - Textos de privilegios y catÃ¡logo Unidades alineados a esa jerarquÃ­a.
- **Archivos / refs:** `orgUnits.js`, `locations.js`, `dispatch.js`, `panic.js`, `geofences.js`, `LiveTrackMap.jsx`, `DispatchUsers.jsx`, `DispatchUnits.jsx`

## 2026-08-23 â€” JerarquÃ­a RegiÃ³n / Zonas / Unidades + multi-canal

- **Tipo:** feature | security | ux
- **Ãrea:** backend | web | database
- **QuÃ©:**
 - Rol `unit_admin`; privilegios `can_see_region` / `can_see_zones` / `can_see_units`.
 - RegiÃ³n (root/admin) = maestro; zona controla sus unidades/usuarios; unidad solo los suyos.
 - Lista de canales filtrada por privilegios; radio/despacho con multi-selecciÃ³n (oÃ­r varios / hablar en uno).
 - Alta y tabla de usuarios: checkboxes R/Z/U y alcance de zona/unidad.
- **Archivos / refs:** `016_unit_admin_visibility.sql`, `roles.js`, `orgUnits.js`, `admin.js`, `groups.js`, `DispatchUsers.jsx`, `ChannelMultiSelect.jsx`, `RadioPage.jsx`, `DispatchLayout.jsx`

## 2026-08-23 â€” LEVANTAR-TACTICALPTX.bat reforzado

- **Tipo:** infra | ops
- **Ãrea:** infra
- **QuÃ©:**
 - BAT detecta API HTTP/HTTPS, espera health, libera puertos zombies, lee IP LAN y `LIVEKIT_PUBLIC_HOST`.
 - `start-api.cmd` / `start-web.cmd` mÃ¡s robustos (PATH, npm install, mensajes claros).
 - Stack verificado: API HTTPS ok, Web, LiveKit (`node-ip` pÃºblica), Redis.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-api.cmd`, `infra/start-web.cmd`

## 2026-08-23 â€” Seguimiento: zoom al cursor (tipo Maps)

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** En Seguimiento, la rueda acerca/aleja el punto bajo el cursor (como Google Maps), no el centro del mapa.
- **Archivos / refs:** `LiveTrackMap.jsx`, `command-center.css`

## 2026-08-23 â€” APK 1.8.3+12 (logo oliva/oro)

- **Tipo:** release | ux
- **Ãrea:** mobile
- **QuÃ©:** APK con logo recoloreado; fix sintaxis `panic:update` en `channel_session.dart`. API `https://189.175.38.29:4000`.
- **Archivos / refs:** `Soporte/APK/TacticalPtx-1.8.3+12-4G-logo.apk`, `pubspec.yaml` `1.8.3+12`

## 2026-08-23 â€” Logo: rojo â†’ oliva/oro institucional

- **Tipo:** ux | mejora
- **Ãrea:** web | mobile
- **QuÃ©:** RecoloraciÃ³n de `tacticalptx.png` (web + mÃ³vil): acentos rojos a oliva `#243d20` y oro `#9a7b2f`; marco del logo alineado a la marca.
- **Por quÃ© / notas:** Respaldo en `Soporte/Respaldos/logo-tacticalptx-*`. Ctrl+F5 en login.
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `mobile/assets/brand/tacticalptx.png`, `styles.css`, `institutional.css`

## 2026-08-23 â€” RevisiÃ³n seguridad: cifrado y authz

- **Tipo:** security | fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
 - Wire AES tambiÃ©n en `dispatch:panic` / `panic_update`; CC descifra.
 - `GET /locations` y tracks solo roles de despacho (incl. `zone_admin`).
 - Ya no se exporta `contentKey`; `wireKey` no se guarda en `localStorage`.
 - FCM de chat/DM sin cuerpo en claro; pÃ¡nico en chat sin coords.
 - Prod rechaza secretos de ejemplo (content/wire/E2EE); health sin detalle crypto en prod.
 - `zone_admin` entra a despacho / usuarios; LAN TLS solo confÃ­a el host de API.
- **Archivos / refs:** `dispatch.js`, `locations.js`, `auth.js`, `contentCrypto.js`, `config.js`, `api.js`, `CommandCenter.jsx`, `lan_tls.dart`

## 2026-08-23 â€” Chat inbox estilo WhatsApp

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
 - Inbox unificado (grupos + DM) con pestaÃ±as Todos / No leÃ­dos / Favoritos / Grupos.
 - Favoritos en `localStorage`; badges de no leÃ­dos; bÃºsqueda de chats.
 - Banner superior al llegar mensaje fuera del chat abierto; tono doble tipo WhatsApp.
 - DM: ticks de lectura, botÃ³n enviar circular; panel sin sidebar duplicada.
- **Por quÃ© / notas:** Recargar Radio con Ctrl+F5.
- **Archivos / refs:** `ChatInbox.jsx`, `RadioPage.jsx`, `DirectChat.jsx`, `styles.css`, `appNotify.js`

## 2026-08-23 â€” PÃ¡nico: Enterado silencia solo este dispositivo

- **Tipo:** fix
- **Ãrea:** web | mobile | backend
- **QuÃ©:** Enterado ya no apaga la sirena en los demÃ¡s; cada equipo la cancela por su cuenta. Resuelto/cancelado sÃ­ cierra en todos.
- **Archivos / refs:** `panic.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

## 2026-08-23 â€” Organigrama IV R.M. (RegiÃ³n â†’ zonas â†’ unidades)

- **Tipo:** feature
- **Ãrea:** database | backend | web
- **QuÃ©:**
 - JerarquÃ­a operativa: RegiÃ³n â†’ C.G. / 4 Z.M. (+ Sanidad, AÃ©reas, Justicia) â†’ 70 unidades.
 - Fuente: catÃ¡logo institucional IV R.M. (Control TÃ³ner); ParqueVehicular no estÃ¡ en esta PC.
 - Rol `zone_admin` (admin de zona: usuarios en su alcance).
 - Seed: `npm run seed:units` crea unidades + canal PTT por unidad.
 - CatÃ¡logo web **Unidades** en despacho.
- **Archivos / refs:** `015_org_units.sql`, `ivRmUnits.js`, `seed-units.js`, `orgUnits.js`, `admin.js`, `DispatchUnits.jsx`

## 2026-08-23 â€” PTT mini en Seguimiento y resto de despacho

- **Tipo:** feature | ux
- **Ãrea:** web
- **QuÃ©:**
 - BotÃ³n PTT compacto en la franja de radio (visible en Seguimiento, mapa, catÃ¡logos, etc.).
 - Espacio para hablar en toda la consola de despacho.
- **Archivos / refs:** `DispatchLayout.jsx`, `RadioPage.jsx`, `institutional.css`

## 2026-08-22 â€” Chat: altura fija (2.Âª pasada)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
 - Causa real: `.shell` con `min-height: 100dvh` dentro de despacho + `.cc-shell` solo `min-height` â†’ la pÃ¡gina crecÃ­a con los mensajes.
 - Consola: `height/max-height: 100dvh` + `overflow: hidden` en shell/body/main.
 - Radio embebido: anula min-height del shell; grid/chat en flex con `min-height: 0`; scroll solo en `.wa-log`.
- **Por quÃ© / notas:** Recargar Radio con Ctrl+F5 (hard refresh).
- **Archivos / refs:** `styles.css`, `command-center.css`, `institutional.css` (`.cc-main` tenÃ­a `overflow:auto`)

## 2026-08-22 â€” jlunag2: oÃ­a pero no lo oÃ­an (LiveKit)

- **Tipo:** fix
- **Ãrea:** backend | web | mobile | infra
- **QuÃ©:**
 - Cap. Luna (`jlunag2`) reportÃ³ en chat: escucha pero no sabe si lo oyen; PTT OK, audio de subida fallaba.
 - `LIVEKIT_PUBLIC_HOST` unifica URL LiveKit (web + 4G); LiveKit reiniciado con `--node-ip` pÃºblica.
 - Web: re-play audio al `TrackUnmuted`; mÃ³vil: `setMicrophoneEnabled` en PTT.
- **Por quÃ© / notas:** Cuenta OK en BD. Fallo de medios ICE (LAN vs pÃºblica). Web: Ctrl+F5 + reentrar canal. MÃ³vil: ideal APK nuevo; sin APK, salir/entrar canal tras reinicio LiveKit.
- **Archivos / refs:** `livekit.js`, `.env`, `start-services.ps1`, `usePtt.js`, `channel_session.dart`

## 2026-08-22 â€” Chat: scroll interno (estilo WhatsApp)

- **Tipo:** fix | ux
- **Ãrea:** web
- **QuÃ©:**
 - El panel de radio ya no crece con los mensajes; altura fija al viewport.
 - El historial (grupo y DM) hace scroll interno; cabecera y composer quedan fijos.
- **Por quÃ© / notas:** `max-height: none` en `.wa-chat` hacÃ­a alargar toda la pÃ¡gina. Recargar con Ctrl+F5.
- **Archivos / refs:** `web/src/styles.css`

## 2026-08-22 â€” Credenciales: modal del sistema (sin alert)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Alta/restablecer clave ya no usan `window.alert`/`confirm`; modal institucional con copiar y Esc.
- **Archivos / refs:** `DispatchUsers.jsx`, `institutional.css`

## 2026-08-22 â€” Fix voz de regreso (LiveKit ICE / URL)

- **Tipo:** fix
- **Ãrea:** backend | web | infra
- **QuÃ©:**
 - LiveKit `use_external_ip: true` + `--node-ip` LAN para que el audio RTP vuelva en LAN y 4G.
 - Token ya no fuerza IP pÃºblica desde Vite/localhost; usa `LIVEKIT_LAN_HOST`.
 - Clientes web reescriben `127.0.0.1` en URL LiveKit (`livekitUrl.js`).
 - UPnP 7880â€“7882 reaplicado.
- **Por quÃ© / notas:** SeÃ±al OK pero medios ICE mal anunciados â†’ se oÃ­a PTT propio / no el de regreso. Recargar Radio (Ctrl+F5); en app salir y entrar al canal.
- **Archivos / refs:** `livekit.js`, `livekit.dev.yaml`, `usePtt.js`, `livekitUrl.js`

## 2026-08-22 â€” PÃ¡nico: tono mÃ¡s centrado (780/980 Hz)

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:** Sirena hi-lo media (~780â†”980 Hz) en lugar del barrido agudo wail; WAV regenerado.
- **Archivos / refs:** `panicSound.js`, `public/sounds/panic_siren.wav`, `mobile/assets/sounds/panic_siren.wav`

## 2026-08-22 â€” Nuevo sonido de pÃ¡nico (sirena wail)

- **Tipo:** ux | mejora
- **Ãrea:** web | mobile
- **QuÃ©:** Sirena de emergencia tipo barrido (wail) en lugar del beep 880/1175; asset `panic_siren.wav` en web y app.
- **Archivos / refs:** `web/src/panicSound.js`, `web/public/sounds/panic_siren.wav`, `mobile/assets/sounds/`, `channel_session.dart`

## 2026-08-22 â€” Grado: desplegable EjÃ©rcito Mexicano

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:** Campo Grado en alta de usuarios pasa a `<select>` con grados Art. 129 LOEFAM (Generales â†’ Tropa), abreviatura al aire.
- **Archivos / refs:** `web/src/dispatch/armyGrades.js`, `DispatchUsers.jsx`

## 2026-08-22 â€” UPnP + firewall para 4G/5G (sin Tailscale mÃ³vil)

- **Tipo:** infra | ops
- **Ãrea:** infra | mobile
- **QuÃ©:**
 - Firewall Windows + mapeo UPnP automÃ¡tico (4000/7880/7881/7882) â†’ health pÃºblica HTTPS **200**.
 - Script `infra/EXPOSE-UPNP.cmd` / `.ps1`.
 - `LIVEKIT_PUBLIC_URL=ws://189.175.38.29:7880`.
 - APK **1.8.3+10** 4G: `Soporte/APK/TacticalPtx-1.8.3+10-4G.apk`.
- **Por quÃ© / notas:** En el celular solo la APK; sin Tailscale. Tras reiniciar el router, volver a ejecutar EXPOSE-UPNP.
- **Archivos / refs:** `EXPOSE-UPNP.ps1`, `ACCESO_DIRECTO_SIN_TAILSCALE.md`

## 2026-08-22 â€” RevisiÃ³n 4G/IP pÃºblica (sin Tailscale)

- **Tipo:** ops | infra
- **Ãrea:** infra | mobile | docs
- **QuÃ©:**
 - IP pÃºblica `189.175.38.29` (sin CGNAT); LAN `192.168.1.66`.
 - Firewall Windows: TCP 4000/7880/7881 + UDP 7882.
 - Cert TLS regenerado con SAN LAN + IP pÃºblica; API reiniciada.
 - Acceso Internet aÃºn pendiente de **reenvÃ­o en el router**.
- **Archivos / refs:** `ACCESO_DIRECTO_SIN_TAILSCALE.md`, `EXPOSE-PUBLIC.ps1`, `infra/certs/`

## 2026-08-22 â€” Fix xhr poll error (socket vÃ­a proxy Vite)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** En DEV el socket ya no apunta a `https://127.0.0.1:4000` (cert autofirmado â†’ xhr poll error); usa mismo origen y el proxy Vite (`secure:false`).
- **Archivos / refs:** `web/src/socketConfig.js`

## 2026-08-22 â€” Fix CERTIFICATE_VERIFY_FAILED (APK 1.8.3+9)

- **Tipo:** fix | security
- **Ãrea:** mobile
- **QuÃ©:**
 - Flutter confÃ­a el cert LAN vÃ­a `LanTls` + asset `assets/certs/lan-cert.pem` (HttpOverrides).
 - Allowlist de hosts privados como respaldo; mensaje de error en espaÃ±ol.
 - APK **1.8.3+9** con `API_BASE=https://192.168.1.66:4000`.
- **Por quÃ© / notas:** `network_security_config` de Android no aplica al HttpClient de Dart; por eso fallaba el login HTTPS.
- **Archivos / refs:** `lan_tls.dart`, `main.dart`, `es_msg.dart`, `Soporte/APK/TacticalPtx-1.8.3+9.apk`

## 2026-08-22 â€” EscalÃ³n TLS LAN + APK HTTPS 1.8.3+8

- **Tipo:** security | ops
- **Ãrea:** backend | web | mobile | infra
- **QuÃ©:**
 - EscalÃ³n 1: API reiniciada; health OK; GPS exige auth; LiveKit :7880 OK; wire on.
 - EscalÃ³n 2: `TLS_CERT`/`TLS_KEY` activos; CORS HTTPS; Vite proxy `https://127.0.0.1:4000` (secure:false); LiveKit sigue en `ws://` (no forzar wss).
 - EscalÃ³n 3: APK **1.8.3+8** con `API_BASE=https://192.168.1.66:4000` + `network_security_config` (cert LAN embebido).
- **Por quÃ© / notas:** HTTP plano a :4000 ya no responde. Reiniciar Vite. En navegador aceptar cert autofirmado si abres la API directo.
- **Archivos / refs:** `backend/.env`, `vite.config.js`, `socketConfig.js`, `network_security_config.xml`, `Soporte/APK/TacticalPtx-1.8.3+8.apk`

## 2026-08-22 â€” APK 1.8.3+7

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:**
 - Build release `1.8.3+7` con `API_BASE=http://192.168.1.66:4000`.
 - Copia en `Soporte/APK/TacticalPtx-1.8.3+7.apk` y `TacticalPtx-latest.apk`.
- **Por quÃ© / notas:** ActualizaciÃ³n de campo tras cifrado wire/TLS y fixes de indicativo.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/build/app/outputs/flutter-apk/app-release.apk`

## 2026-08-22 â€” Cifrado en trÃ¡nsito + fix indicativo JWT

- **Tipo:** security | fix
- **Ãrea:** backend | web | infra
- **QuÃ©:**
 - Perfil vivo desde BD en auth REST y sockets (indicativo/rol ya no quedan congelados en el JWT).
 - TLS opcional (`TLS_CERT`/`TLS_KEY`) + generador LAN de certificados PEM.
 - Cifrado wire AES-256-GCM de GPS/geocerca en socket; login/`/me` entregan `crypto.wireKey`.
 - LiveKit wss si la API va por HTTPS; prod exige claves de contenido, voz y wire.
 - Ãndice de matrÃ­cula alineado en `schema.sql`.
- **Por quÃ© / notas:** Refuerza trÃ¡fico entre hosts; descomentar TLS en `.env` para HTTPS total. Reiniciar API; en despacho se refresca la clave wire vÃ­a `/api/auth/me`.
- **Archivos / refs:** `userProfile.js`, `wireCrypto.js`, `tls.js`, `server.js`, `auth.js`, `generate-lan-certs.mjs`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 â€” Contraste tema oscuro en todo el web

- **Tipo:** fix
- **Ãrea:** web | mobile
- **QuÃ©:**
 - Capa `theme-contrast.css` al final: selects, botones, chat, pÃ¡nico, badges, popups Leaflet, tablas y formularios legibles en claro/oscuro.
 - Corregidos texto perdido en selector de canal, botones primary/WA, banner al aire y chips.
- **Archivos / refs:** `theme-contrast.css`, `main.jsx`, `DispatchLayout.jsx`, `styles.css`, `command-center.css`, `chat_panel.dart`

## 2026-08-22 â€” Selects legibles en tema oscuro

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Opciones del selector de canal/grupos con contraste correcto (fondo oscuro + texto claro; evita letras blancas sobre blanco).
- **Archivos / refs:** `institutional.css`, `command-center.css`

## 2026-08-22 â€” Usuarios: grado, especialidad, nombres, matrÃ­cula e indicativo

- **Tipo:** feature
- **Ãrea:** backend | web | database
- **QuÃ©:**
 - Alta pide Grado, Especialidad, Nombre(s), Apellidos y MatrÃ­cula.
 - Al hablar/publicar el `display_name` es el indicativo **Grado + apellido paterno** (ej. Cap. Gomez); el canal se muestra aparte (ej. B.O. Â«Las GranaditasÂ»).
- **Archivos / refs:** `014_user_identity.sql`, `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `DispatchLayout.jsx`

## 2026-08-22 â€” Geocercas fuera de CatÃ¡logos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Quitada la entrada Geocercas de CatÃ¡logos (menÃº y pestaÃ±as); las zonas se gestionan en Mapa en vivo. URL antigua redirige a `/despacho/mapa`.
- **Archivos / refs:** `CatalogsLayout.jsx`, `DispatchLayout.jsx`, `App.jsx`

## 2026-08-22 â€” Sin textos â€œcomo WhatsAppâ€ en la UI

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:** Eliminadas frases de comparaciÃ³n con WhatsApp en Seguimiento, perfil y comentarios visibles al producto.
- **Archivos / refs:** `LiveTrackMap.jsx`, `radio_shell.dart`

## 2026-08-22 â€” Login mÃ¡s presentable (web + mÃ³vil)

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:** Login con mÃ¡s presencia de marca, atmÃ³sfera oliva/oro, animaciones suaves y tarjeta con acento dorado (misma identidad institucional).
- **Archivos / refs:** `App.jsx`, `institutional.css`, `mobile/lib/screens/login_screen.dart`

## 2026-08-22 â€” Colores app alineados a web institucional

- **Tipo:** ux
- **Ãrea:** mobile | web
- **QuÃ©:**
 - App mÃ³vil: paleta oliva/oro (login, radio, chat, llamadas, cambio de clave).
 - Seguimiento y llamadas web: sin verde/azul WhatsApp; usan `--cc-live` / oliva institucional.
- **Archivos / refs:** `mobile/lib/theme.dart`, `incoming_call_screen.dart`, `direct_pane.dart`, `command-center.css`, `styles.css`, `LiveTrackMap.jsx`

## 2026-08-22 â€” Seguimiento maximizar + Esc cierra overlays

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
 - BotÃ³n Maximizar / Reducir en Seguimiento (pantalla completa; Esc o clic).
 - Esc global cierra fullscreen, lightbox, llamada entrante/privada y overlays `data-esc-close`.
- **Archivos / refs:** `GlobalEscapeClose.jsx`, `LiveTrackMap.jsx`, `ChatMedia.jsx`, `PrivateCallOverlay.jsx`, `DirectChat.jsx`

## 2026-08-22 â€” Seguimiento: ubicaciones se refrescan solas (~5 s)

- **Tipo:** mejora
- **Ãrea:** web
- **QuÃ©:**
 - Seguimiento / Mapa / Consola refrescan GPS y rastro automÃ¡ticamente al ritmo del latido (5 s).
 - Merge socket+poll sin pisar fixes mÃ¡s nuevos; rejoin al reconectar; refresh al volver a la pestaÃ±a.
- **Archivos / refs:** `web/src/dispatch/liveTiming.js`, `LiveTrackMap.jsx`, `DispatchMap.jsx`, `CommandCenter.jsx`

## 2026-08-22 â€” Radio, mensajes y GPS con pantalla bloqueada

- **Tipo:** feature
- **Ãrea:** mobile
- **QuÃ©:**
 - Servicio en primer plano incluye `location` ademÃ¡s de micrÃ³fono/reproducciÃ³n.
 - SesiÃ³n de audio (voice) para seguir oyendo el canal bloqueado.
 - GPS pide ubicaciÃ³n â€œsiempreâ€; stream iOS con background updates.
 - FCM en background muestra aviso local si el push es solo `data`.
- **Por quÃ© / notas:** Mantener el aviso persistente â€œTacticalPtx activoâ€; aceptar ubicaciÃ³n siempre y no optimizar baterÃ­a.
- **Archivos / refs:** `background_radio.dart`, `location_heartbeat.dart`, `audio_session_setup.dart`, `AndroidManifest.xml`, `Info.plist`, `push_service.dart`

## 2026-08-22 â€” Icono de perfil (estilo WhatsApp en seguimiento)

- **Tipo:** feature
- **Ãrea:** mobile | backend | web
- **QuÃ©:**
 - El usuario cambia su foto en la app (perfil â†’ galerÃ­a/cÃ¡mara).
 - El icono se muestra en Seguimiento web como bolita con foto (WhatsApp).
- **Archivos / refs:** `backend/src/routes/me.js`, `locations.js`, `auth.js`, `LiveTrackMap.jsx`, `radio_shell.dart`, `api_client.dart`

---
## 2026-08-22 â€” UI mÃ¡s suave (radios e iconos)

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:** Quitados bordes cuadrados agresivos; login, botones, paneles, menÃº e iconos con radio suave y â€œpozosâ€ redondeados para iconos.
- **Archivos / refs:** `web/src/institutional.css`, `mobile/lib/theme.dart`, `mobile/lib/screens/login_screen.dart`

---
## 2026-08-22 â€” Mensajes de error en espaÃ±ol

- **Tipo:** ux | fix
- **Ãrea:** web | mobile
- **QuÃ©:** TraducciÃ³n de errores tÃ©cnicos del navegador/LiveKit/red (`Permission denied`, etc.) a espaÃ±ol claro; Offline â†’ Fuera de lÃ­nea.
- **Archivos / refs:** `web/src/esMsg.js`, `usePtt.js`, `api.js`, `RadioPage.jsx`, `mobile/lib/es_msg.dart`

---
## 2026-08-22 â€” Radio mantiene menÃº de despacho

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:** Radio pasa a `/despacho/radio` dentro del layout; el rail no desaparece. PTT compartido (sin doble LiveKit). Operadores sin despacho siguen en `/radio`.
- **Archivos / refs:** `App.jsx`, `DispatchLayout.jsx`, `RadioPage.jsx`, `styles.css`

---
## 2026-08-22 â€” Plan escalonado 1â†’4 (validaciÃ³n Â· Git Â· APK Â· deploy)

- **Tipo:** ops | docs
- **Ãrea:** ops | docs | mobile
- **QuÃ©:**
 - EscalÃ³n 1: PC/API/web OK; checklist Pedro actualizado (voz/GPS pendientes humano).
 - EscalÃ³n 2: `git init` + commit `027fb0d` (287 archivos, sin secretos).
 - EscalÃ³n 3: rebuild APK 1.8.1+5 en curso/pendiente salida.
 - EscalÃ³n 4: Docker/Play documentados, **no** ejecutados aÃºn.
- **Archivos / refs:** `VALIDACION_CAMPO_1_8_0.md`, `PLAN_ESCALONADO_1_8.md`, `.gitignore`, `docs/DOCKER_PROD.md`, `docs/PLAY_STORE.md`

---
## 2026-08-22 â€” Iconos en menÃº de mÃ³dulos

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Iconos SVG en Operaciones, Seguimiento, Mapa, CatÃ¡logos (y sub), Radio y Salir; visibles tambiÃ©n en modo miniatura.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 â€” MenÃº miniatura con sola flecha (sin montajes)

- **Tipo:** ux | fix
- **Ãrea:** web
- **QuÃ©:**
 - MenÃº en flujo flex (ya no overlay): el mapa/consola no se montan encima.
 - Solo flecha para contraer/expandir; al contraer queda barra miniatura (OP/SEG/MAPâ€¦).
- **Archivos / refs:** `DispatchLayout.jsx`, `institutional.css`, `command-center.css`

---
## 2026-08-22 â€” MenÃº mÃ³dulos con flecha acordeÃ³n

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
 - PestaÃ±a lateral con flecha para ocultar/mostrar el menÃº (sin desplazar el contenido).
 - Flecha tambiÃ©n en topbar y en CatÃ¡logos (acordeÃ³n).
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 â€” Mapa en vivo a pantalla completa equilibrada

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
 - Quitado el tope de 1200px; toolbar en rejilla equitativa; mapa ocupa el alto restante.
 - KPIs alineados a la derecha del encabezado; sin franjas vacÃ­as laterales.
- **Archivos / refs:** `web/src/dispatch/DispatchMap.jsx`, `command-center.css`, `dispatch.css`

---
## 2026-08-22 â€” MenÃº despacho a la izquierda (ocultable)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
 - Rail de mÃ³dulos a la **izquierda**, como overlay (el mapa/consola no se desplaza al ocultar).
 - BotÃ³n **MenÃº / Ocultar** en la topbar; se recuerda en `localStorage`.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/institutional.css`

---
## 2026-08-22 â€” Acceso directo sin Tailscale

- **Tipo:** infra | docs
- **Ãrea:** ops | mobile
- **QuÃ©:**
 - GuÃ­a IP pÃºblica + reenvÃ­o de puertos (4G sin Tailscale ni dominio).
 - Script `infra/EXPOSE-PUBLIC.ps1` (firewall + detecciÃ³n IP).
 - Build APK ya **no** fuerza Tailscale; LAN por defecto; `API_BASE` / `FORCE_TAILSCALE=1` opcionales.
- **Archivos / refs:** `Soporte/Documentos/ACCESO_DIRECTO_SIN_TAILSCALE.md`, `infra/EXPOSE-PUBLIC.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-22 â€” APK mÃ¡s robusta (cifrado, datos, UI)

- **Tipo:** security | ux | mejora
- **Ãrea:** mobile
- **QuÃ©:**
 - Tokens JWT en **Flutter Secure Storage** (migraciÃ³n desde SharedPreferences).
 - HTTP con timeout 18 s y cabecera de cliente; login limpia contraseÃ±a en memoria.
 - Tema institucional oliva/oro (claro, plano); login y radio mÃ¡s presentables.
 - E2EE LiveKit ya cableado; versiÃ³n **1.8.1+5**.
- **Archivos / refs:** `mobile/lib/secure_store.dart`, `api_client.dart`, `theme.dart`, `screens/login_screen.dart`, `pubspec.yaml`

---
## 2026-08-22 â€” Cifrado reforzado voz + texto

- **Tipo:** security
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
 - Chat/DM: cuerpos con **AES-256-GCM** en base de datos (`CONTENT_ENCRYPTION_KEY`); mensajes viejos en claro siguen legibles.
 - Voz PTT y llamadas: **E2EE LiveKit** por room (`LIVEKIT_E2EE_SECRET` + `e2eeKey` al cliente), encima de DTLS-SRTP.
- **Por quÃ© / notas:** Reiniciar API tras aÃ±adir secretos en `.env`. Clientes web/APK deben actualizarse para E2EE de voz.
- **Archivos / refs:** `backend/src/services/contentCrypto.js`, `voiceE2ee.js`, `web/src/livekitE2ee.js`, `mobile/lib/livekit_e2ee.dart`

---
## 2026-08-22 â€” Seguimiento estilo WhatsApp (bolitas en vivo)

- **Tipo:** feature | ux
- **Ãrea:** web | mobile
- **QuÃ©:**
 - Mapa de seguimiento con bolitas tipo Live Location (pulso, nombre, deslizamiento suave).
 - Rastro permanente que se actualiza por socket; opciÃ³n â€œSeguirâ€ al operador seleccionado.
 - GPS mÃ³vil por stream continuo (+ latido) para actualizar de forma permanente.
- **Archivos / refs:** `web/src/dispatch/LiveTrackMap.jsx`, `command-center.css`, `mobile/lib/location_heartbeat.dart`, `useGpsReporter.js`

---
## 2026-08-22 â€” Chat limpio (sin iconos sobre burbujas)

- **Tipo:** ux | fix
- **Ãrea:** web | mobile
- **QuÃ©:**
 - Web: menÃº `â‹¯` al lado de la burbuja (no encima del texto); toast DM elevado sobre el compositor.
 - MÃ³vil: ancho mÃ¡ximo en DM, clip en burbujas, audio flexible, ticks alineados a la derecha.
- **Archivos / refs:** `web/src/WhatsAppChat.jsx`, `web/src/styles.css`, `mobile/lib/screens/chat_panel.dart`, `mobile/lib/screens/direct_pane.dart`

---
## 2026-08-22 â€” Sin notificaciones en cada PTT

- **Tipo:** fix | ux
- **Ãrea:** mobile | backend
- **QuÃ©:**
 - El backend ya no envÃ­a FCM al otorgar el floor PTT.
 - La APK no muestra notificaciÃ³n local al oÃ­r a alguien al aire (solo mensajes y llamadas).
- **Por quÃ© / notas:** Evitar spam de notificaciones en cada transmisiÃ³n de radio.
- **Archivos / refs:** `backend/src/socket/ptt.js`, `mobile/lib/channel_session.dart`, `mobile/lib/push_service.dart`

---
## 2026-08-22 â€” UI institucional estilo Reclutamiento

- **Tipo:** ux | mejora
- **Ãrea:** web
- **QuÃ©:**
 - Tema oliva `#243d20` + oro `#9a7b2f`, tipografÃ­a Oswald + Source Sans 3, paneles planos.
 - Despacho: topbar clara + rail derecho de mÃ³dulos (como Reclutamiento IV R.M.).
 - Login, Radio y consola alineados al mismo sistema; tema por defecto claro.
- **Por quÃ© / notas:** Unificar look institucional con el resto de sistemas de la dependencia.
- **Archivos / refs:** `web/src/institutional.css`, `web/src/dispatch/DispatchLayout.jsx`, `web/src/styles.css`, `web/src/dispatch/command-center.css`, `web/index.html`

---
## 2026-08-22 â€” RevisiÃ³n completa 1.8.0

- **Tipo:** docs | otro
- **Ãrea:** docs | ops
- **QuÃ©:**
 - AuditorÃ­a de stack, features, riesgos y huecos (iOS, Docker prod, Git, Play Store).
 - Health API OK (db/redis/livekit/fcm). UbicaciÃ³n Ãºnica D:\pulsanet verificada.
 - Ajustes menores: texto GPS 5 s; limpieza de archivos basura en raÃ­z (`start`, `query`, `favicon.ico/`).
- **Archivos / refs:** canvas revisiÃ³n, `docs/UBICACION_PROYECTO.md`, `mobile/lib/screens/radio_shell.dart`

---
## 2026-08-22 â€” UbicaciÃ³n Ãºnica D:\pulsanet

- **Tipo:** infra | docs
- **Ãrea:** ops | docs
- **QuÃ©:**
 - Todo el proyecto queda bajo `D:\pulsanet` (cÃ³digo + `Soporte\`).
 - `D:\Soporte` es uniÃ³n â†’ `D:\pulsanet\Soporte` (compat Firebase/bitÃ¡cora).
 - Logos movidos a `Soporte\Brand\`; doc `docs/UBICACION_PROYECTO.md`.
- **Archivos / refs:** `Soporte\`, `.env` (`FIREBASE_SERVICE_ACCOUNT`), `.cursor/rules/documentar-cambios.mdc`, `README.md`

---
## 2026-08-22 â€” Release 1.8.0 (escalonado)

- **Tipo:** otro | infra | docs
- **Ãrea:** mobile | infra | docs | web | backend
- **QuÃ©:**
 - Etapa 1: APK mÃ³vil **1.8.0+4** (GPS 5 s + fixes radio) vÃ­a `BUILD-APK-WHATSAPP.cmd`.
 - Etapa 2: LiveKit ICE dual Wiâ€‘Fi + Tailscale; `LIVEKIT_PUBLIC_URL` vacÃ­o; reinicio con `taskkill`.
 - Etapa 3: Changelog cerrado como **[1.8.0]**; API/web `1.8.0`.
 - Etapa 4: Checklist de campo en `Soporte\Documentos\VALIDACION_CAMPO_1_8_0.md`.
- **Por quÃ© / notas:** Si LiveKit no reinicia, ejecutar `LEVANTAR-TACTICALPTX.bat` como Administrador.
- **Archivos / refs:** `mobile/pubspec.yaml`, `infra/start-services.ps1`, `docs/CHANGELOG.md`, `backend/src/version.js`

---
## 2026-08-22 â€” RediseÃ±o despacho: menÃº izquierdo, catÃ¡logos y seguimiento

- **Tipo:** ux | feature
- **Ãrea:** web
- **QuÃ©:**
 - Shell de despacho con menÃº lateral (Operaciones, Seguimiento, Mapa en vivo, CatÃ¡logos, Radio).
 - Nueva vista Seguimiento estilo WhatsApp (lista de operadores + mapa en tiempo real, capas Natural/SatÃ©lite/Claro).
 - CatÃ¡logos: Usuarios, Grupos y Geocercas bajo `/despacho/catalogos/â€¦`.
 - Mapa operativo con selector de capas naturales.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `LiveTrackMap.jsx`, `CatalogsLayout.jsx`, `GeofenceCatalog.jsx`, `App.jsx`, `command-center.css`

---
## 2026-08-18 â€” CorrecciÃ³n LiveKit duplicado en Consola

- **Tipo:** fix
- **Ãrea:** web | backend
- **QuÃ©:**
 - La escucha extra de canales usaba la misma identidad LiveKit que el PTT y se expulsaban mutuamente (error de participante duplicado / audio cortado).
 - La escucha extra ahora entra como `:listen:` (solo oÃ­r) y espera a que el dock tenga canal.
- **Archivos / refs:** `backend/src/routes/livekit.js`, `web/src/useDispatchListen.js`, `web/src/api.js`

---
## 2026-08-18 â€” Voz PTT de otro canal no llegaba a Consola

- **Tipo:** fix
- **Ãrea:** web | backend | infra
- **QuÃ©:**
 - Pedro Sanchez Torres solo estÃ¡ en Â«Jfa. T.I.C.Â»; el altavoz de Consola sintonizaba Â«GeneralÂ» (otro LiveKit) y el PTT Â«al aireÂ» no llevaba audio.
 - Despacho ahora escucha LiveKit de todos los canales; el selector es el canal por el que habla el despachador.
 - LiveKit URL sigue al host de la API (LAN o Tailscale); ICE ya no se fuerza solo a 100.x.
- **Por quÃ© / notas:** El floor PTT (socket) es independiente del audio (LiveKit, un room por grupo).
- **Archivos / refs:** `web/src/useDispatchListen.js`, `web/src/dispatch/DispatchLayout.jsx`, `backend/src/services/livekit.js`, `infra/start-services.ps1`

---
## 2026-08-18 â€” GPS en consola y envÃ­o cada 5 s

- **Tipo:** fix | mejora
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
 - El mapa decÃ­a Â«aÃºn no hay GPSÂ» con todo en ceros: si fallaba el listado de grabaciones (p. ej. cuenta **root**), se vaciaba tambiÃ©n canales y ubicaciones.
 - `root` ahora entra al socket de despacho y puede listar grabaciones.
 - GPS se envÃ­a cada **5 s** (antes ~20 s) desde la app al abrirla, Radio web y Consola.
- **Por quÃ© / notas:** Â«En lÃ­neaÂ» es presencia PTT (radio), no GPS. El chat no publica coordenadas. 1 s drenarÃ­a baterÃ­a; se dejÃ³ 5 s.
- **Archivos / refs:** `backend/src/routes/recordings.js`, `backend/src/socket/dispatch.js`, `web/src/dispatch/CommandCenter.jsx`, `web/src/useGpsReporter.js`, `mobile/lib/location_heartbeat.dart`

---
## 2026-08-18 â€” Pruebas 4G/5G con Tailscale

- **Tipo:** infra
- **Ãrea:** infra | mobile | ops
- **QuÃ©:**
 - Tailscale en la PC (`100.127.12.44`); LiveKit anuncia esa IP para ICE.
 - APK de WhatsApp usa `API_BASE` Tailscale si `tailscale ip -4` existe.
 - GuÃ­a: `D:\Soporte\Documentos\TACTICALPTX_4G_TAILSCALE.md`
- **Por quÃ© / notas:** Desde datos mÃ³viles no se alcanza `192.168.1.66`. El celular debe instalar Tailscale con la misma cuenta.
- **Archivos / refs:** `infra/start-services.ps1`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`, `backend/.env` (`LIVEKIT_PUBLIC_URL`)

---
## 2026-08-18 â€” Mic flotante tapaba el chat mÃ³vil

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** El FAB de Radio (micrÃ³fono) se superponÃ­a al cuadro Â«Mensajeâ€¦Â». En Chat y Directos ya no se muestra; se vuelve a Radio con la flecha atrÃ¡s.
- **Archivos / refs:** `mobile/lib/screens/radio_shell.dart`

---
## 2026-08-18 â€” Radio en vivo en Consola / despacho

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** El audio PTT sigue sonando en Consola, Mapa, Usuarios y Grupos. Barra de canal + **Silenciada / En altavoz**.
- **Por quÃ© / notas:** Antes solo habÃ­a LiveKit en `/radio`; al entrar a Consola se cortaba.
- **Archivos / refs:** `web/src/dispatch/DispatchLayout.jsx`, `web/src/usePtt.js`, `web/src/dispatch/command-center.css`

---
## 2026-08-17 â€” Icono APK TacticalPtx

- **Tipo:** ux
- **Ãrea:** mobile
- **QuÃ©:** Icono launcher Android sustituido por el logo TacticalPtx (mipmaps + adaptive icon fondo negro). Splash de arranque en negro.
- **Archivos / refs:** `mobile/pubspec.yaml`, `mobile/android/app/src/main/res/mipmap-*`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-17 â€” BAT de arranque reparado

- **Tipo:** ops
- **Ãrea:** infra | ops
- **QuÃ©:**
 - `LEVANTAR-TACTICALPTX.bat` no arrancaba bien: PowerShell se colgaba en `Get-NetIPAddress`/firewall; la web iba a `:5174` o no escuchaba; `curl`/`start` poco fiables.
 - `start-services.ps1` ahora usa `ipconfig` (rÃ¡pido) y no reinicia LiveKit si ya corre.
 - API/Web se lanzan con `infra/start-api.cmd` y `infra/start-web.cmd` (PATH de Node + Vite en `0.0.0.0:5173`).
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`, `infra/start-api.cmd`, `infra/start-web.cmd`

---
## 2026-08-17 â€” Error 500: Postgres deshabilitado / API caÃ­da

- **Tipo:** ops
- **Ãrea:** infra | backend
- **QuÃ©:**
 - PostgreSQL `postgresql-x64-17` estaba **Disabled/Stopped**; la API no escuchaba en :4000 (la web Vite devolvÃ­a 500 al proxy).
 - Servicio habilitado y arrancado; Redis/LiveKit/API de nuevo con health `ready` y `fcm: configured`.
 - `LEVANTAR-TACTICALPTX.bat` ahora re-habilita el servicio Postgres si viene Disabled.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`

---
## 2026-08-17 â€” Limpieza de BAT/CMD

- **Tipo:** ops
- **Ãrea:** ops | mobile
- **QuÃ©:**
 - Se dejan: `LEVANTAR-TACTICALPTX.bat` (stack local) y `mobile/scripts/BUILD-APK-WHATSAPP.cmd` (APK).
 - Se borra el alias `LEVANTAR-TACTICALPTX.bat` y los lanzadores duplicados de Shorebird/diagnÃ³stico (nunca hubo `shorebird.yaml`).
- **Por quÃ© / notas:** HabÃ­a varios `.cmd` equivalentes (instalar Shorebird 2 veces, setup, parche, diagnÃ³stico, reparar PowerShell) y logs temporales.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `mobile/scripts/BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-13 â€” Firebase FCM activado (proyecto tacticalptx)

- **Tipo:** infra
- **Ãrea:** backend | mobile | ops
- **QuÃ©:**
 - Proyecto Firebase `tacticalptx` + app Android `com.tacticalptx.app`
 - `google-services.json` en `mobile/android/app/`
 - Service account en Soporte; `FIREBASE_SERVICE_ACCOUNT` en `backend/.env`
 - API health: `"fcm":"configured"`
- **Por quÃ© / notas:** Login CLI fallÃ³; configuraciÃ³n vÃ­a Consola. Credenciales fuera de git.
- **Archivos / refs:** `backend/.env`, `mobile/android/app/google-services.json`, `D:\Soporte\Secrets\tacticalptx-firebase-adminsdk.json`, `docs/FCM_PUSH.md`

---
## 2026-08-12 â€” Lightbox imÃ¡genes chat mÃ³vil

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** Pulsar una imagen del chat grupal la abre a pantalla completa (zoom con pellizco, cerrar con X o atrÃ¡s).
- **Archivos / refs:** `mobile/lib/screens/chat_panel.dart`

---
## 2026-08-12 â€” Plan UI PTT Radio verificado

- **Tipo:** mejora
- **Ãrea:** mobile
- **QuÃ©:** Confirmado plan â€œUI mÃ³vil estilo PTT Radioâ€: theme azul, `RadioShell` home, `RadioScreen` READY/mic, `ChatPanel`, atajos Chat/GPS/CÃ¡mara/Directos/Grupos. Pulido: nombre de canal en chat, nav con return explÃ­cito, `GroupsScreen` legacy al theme.
- **Archivos / refs:** `theme.dart`, `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `groups_screen.dart`, `main.dart`

---
## 2026-08-12 â€” Prioridad en segundo plano (radio/mensajes/llamadas)

- **Tipo:** feature
- **Ãrea:** mobile | web | backend
- **QuÃ©:**
 - Android: foreground service (`microphone|mediaPlayback`) + wake/wifi lock + pedir ignorar optimizaciÃ³n de baterÃ­a; notificaciÃ³n persistente â€œRadio activaâ€.
 - MÃ³vil: avisos locales de chat/PTT/DM/llamada con app minimizada o pantalla bloqueada.
 - Web: keepalive de audio + Media Session + notificaciones del navegador si la pestaÃ±a estÃ¡ oculta.
 - FCM: canal de llamadas `tacticalptx_calls` con prioridad mÃ¡xima.
- **Archivos / refs:** `background_radio.dart`, `AndroidManifest.xml`, `radio_shell.dart`, `channel_session.dart`, `backgroundKeepalive.js`, `RadioPage.jsx`, `usePtt.js`, `fcm.js`

---
## 2026-08-12 â€” Rebrand total TacticalPtx + APK

- **Tipo:** feature
- **Ãrea:** web | mobile | backend | ops
- **QuÃ©:**
 - Identificadores visibles e internos a **TacticalPtx** (`com.tacticalptx.app`, claves `tacticalptx_*`, API `tacticalptx-api`, emails `@tacticalptx.local`).
 - Script `LEVANTAR-TACTICALPTX.bat`.
 - APK release con marca nueva (~88.3 MB): `mobile/build/app/outputs/flutter-apk/app-release.apk`
- **Por quÃ© / notas:** Carpeta de trabajo `D:\pulsanet` y BD `tacticalptx_db` se mantienen (rutas/datos); el producto se llama TacticalPtx. Package Android nuevo: hay que **desinstalar** la app anterior `com.tacticalptx.*` e instalar esta.
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`, `main.dart`, `BrandName.jsx`, `LEVANTAR-TACTICALPTX.bat`

---
## 2026-08-12 â€” Rebrand TacticalPtx + paleta tÃ¡ctica

- **Tipo:** ux
- **Ãrea:** web | mobile | backend
- **QuÃ©:**
 - Marca visible **TacticalPtx** (logo + wordmark plata/rojo).
 - Paleta negro / rojo / Ã¡mbar-dorado segÃºn logo; tema oscuro por defecto en web.
 - App Android: label, login con logo, tema dark tÃ¡ctico.
- **Por quÃ© / notas:** No se renombrÃ³ el repo ni el package `com.tacticalptx.*` (interno).
- **Archivos / refs:** `web/public/brand/tacticalptx.png`, `BrandName.jsx`, `styles.css`, `theme.dart`, `login_screen.dart`

---
## 2026-08-12 â€” RevisiÃ³n: rollback mensaje optimista

- **Tipo:** fix
- **Ãrea:** web | backend
- **QuÃ©:** Si `chat:error` / `dm:error`, se elimina el mensaje local pendiente (`clientMsgId`).
- **Archivos / refs:** `usePtt.js`, `DirectChat.jsx`, `socket/chat.js`, `socket/dm.js`

---
## 2026-08-12 â€” EnvÃ­o de mensajes mÃ¡s rÃ¡pido

- **Tipo:** fix
- **Ãrea:** backend | web
- **QuÃ©:**
 - Tras INSERT ya no se consultan reacciones/lecturas (inÃºtiles en mensaje nuevo).
 - Nombre del emisor desde el token/socket (sin SELECT extra).
 - UI optimista en chat grupal y DM (aparece al instante; se confirma por socket).
- **Por quÃ© / notas:** `hydrateMessage` hacÃ­a 3â€“4 queries (incl. COUNT de lecturas) por cada envÃ­o.
- **Archivos / refs:** `socket/chat.js`, `services/dm.js`, `socket/dm.js`, `usePtt.js`, `DirectChat.jsx`

---
## 2026-08-12 â€” Vista Radio web reorganizada

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Radio en un solo layout: franja superior con canal/online + **PTT a la derecha**, abajo chat grupal (izq) y Directos (der). Sin pestaÃ±as Canal/Directos.
- **Archivos / refs:** `RadioPage.jsx`, `DirectChat.jsx` (`embedded`), `styles.css`

---
## 2026-08-12 â€” APK UI llamada estilo WhatsApp

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Build release `app-release.apk` (~87.8 MB) con UI de llamada entrante fullscreen + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 â€” UI llamada entrante estilo WhatsApp

- **Tipo:** ux
- **Ãrea:** web | mobile
- **QuÃ©:** Llamada entrante a pantalla completa (avatar, anillos, Contestar verde / Rechazar rojo); en llamada con el mismo look.
- **Archivos / refs:** `incoming_call_screen.dart`, `radio_shell.dart`, `direct_pane.dart`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `styles.css`

---
## 2026-08-12 â€” APK con notificaciones DM/llamadas

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Build release `app-release.apk` (~87.8 MB) con avisos DM/llamada + `API_BASE=http://192.168.1.66:4000`.
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 â€” Notificaciones DM y llamadas

- **Tipo:** mejora
- **Ãrea:** web | mobile | backend
- **QuÃ©:**
 - Web: tono + Notification del navegador + toast al recibir DM; ringtone en llamada privada.
 - MÃ³vil: SnackBar + badge Directos + notificaciÃ³n local por socket (independiente de FCM).
 - Backend: FCM tambiÃ©n en `dm:send` por socket y en sticker/media DM.
- **Por quÃ© / notas:** FCM suele estar `off` sin Firebase; con la app abierta las seÃ±ales socket ahora avisan. Push en background sigue requiriendo configurar Firebase.
- **Archivos / refs:** `web/src/appNotify.js`, `DirectChat.jsx`, `RadioPage.jsx`, `mobile/lib/push_service.dart`, `channel_session.dart`, `radio_shell.dart`, `backend/src/socket/dm.js`, `routes/dm.js`

---
## 2026-08-12 â€” UI Directos reorganizada

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Pantalla Directos con avatares, roles en espaÃ±ol, chat a altura completa, burbujas y vacÃ­os claros; contactos sin duplicar recientes.
- **Archivos / refs:** `DirectChat.jsx`, `styles.css`

---
## 2026-08-12 â€” APK con fix llamadas privadas

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Build release `app-release.apk` (~87.8 MB) con `API_BASE=http://192.168.1.66:4000` (incluye fix LiveKit LAN + seÃ±al de llamada global).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 â€” Fix llamadas privadas

- **Tipo:** fix
- **Ãrea:** backend | web | mobile
- **QuÃ©:**
 - URL LiveKit pÃºblica segÃºn host del cliente (no `127.0.0.1` en mÃ³vil).
 - Web: DirectChat permanece montado para recibir `call:incoming` fuera de la pestaÃ±a.
 - MÃ³vil: seÃ±al de llamada en `ChannelSession` + diÃ¡logo global; PrivateCall usa host LAN.
- **Archivos / refs:** `livekit.js`, `calls.js`, `RadioPage.jsx`, `PrivateCallOverlay.jsx`, `channel_session.dart`, `radio_shell.dart`, `direct_pane.dart`

---
## 2026-08-12 â€” 5 usuarios de prueba

- **Tipo:** ops
- **Ãrea:** backend | database
- **QuÃ©:** Creados 5 usuarios de prueba (4 operadores + 1 despacho) en canal General, con contraseÃ±a temporal y cambio obligatorio en 1er ingreso.
- **Archivos / refs:** `create-test-users.js` â€” usuarios: `jramirezl2`, `mhernandezg2`, `psanchezt2`, `amartinezr2`, `lfernandezd2`

---
## 2026-08-12 â€” Usuario estilo ggomezd2 (no RFC)

- **Tipo:** feature
- **Ãrea:** backend | web | mobile | docs
- **QuÃ©:**
 - GeneraciÃ³n de usuario: inicial nombre + apellido paterno + inicial materno + nÃºmero desde 2 (ej. `ggomezd2`).
 - Se omite fecha de nacimiento / formato RFC.
 - Login en minÃºsculas; migrado `GODG900516` â†’ `ggomezd2`.
- **Archivos / refs:** `rfcUsername.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `migrate-usernames-style.js`

---
## 2026-08-12 â€” APK Android actualizaciÃ³n

- **Tipo:** ops
- **Ãrea:** mobile
- **QuÃ©:** Build release `app-release.apk` (~87.7 MB) con `API_BASE=http://192.168.1.66:4000` (incluye login RFC, cambio de clave, radio PTT, etc.).
- **Archivos / refs:** `mobile/build/app/outputs/flutter-apk/app-release.apk`

---
## 2026-08-12 â€” Limpieza usuarios demo/prueba

- **Tipo:** ops
- **Ãrea:** backend | database | docs
- **QuÃ©:**
 - Purgados 90 usuarios demo/loadtest de la BD (`npm run seed:purge-demo`).
 - Seed pasa a bootstrap mÃ­nimo: 1 root + canal General (sin operadores de prueba).
 - Manual sin cuentas demo; `seed:load` requiere `ALLOW_LOAD_SEED=1`.
- **Archivos / refs:** `purge-demo-users.js`, `seed.js`, `seed-load.js`, `MANUAL_USUARIO.md`

---
## 2026-08-12 â€” ContraseÃ±a temporal + cambio en 1er ingreso

- **Tipo:** feature
- **Ãrea:** backend | web | mobile | database
- **QuÃ©:**
 - Al crear/restablecer usuario se genera contraseÃ±a temporal (se muestra una vez al admin).
 - Flag `must_change_password`; en el primer login web/mÃ³vil obliga a cambiarla (mÃ­n. 8, letras y nÃºmeros).
- **Archivos / refs:** `tempPassword.js`, `auth.js`, `admin.js`, `App.jsx`, `DispatchUsers.jsx`, `change_password_screen.dart`, `013_must_change_password.sql`

---
## 2026-08-12 â€” Alta usuario: paso de grupos

- **Tipo:** feature
- **Ãrea:** web | backend
- **QuÃ©:** Tras los datos del alta, paso 2 para elegir grupos; sugiere Â«GeneralÂ». API acepta `groupIds` al crear usuario.
- **Archivos / refs:** `DispatchUsers.jsx`, `admin.js`, `command-center.css`

---
## 2026-08-12 â€” Login por usuario tipo RFC

- **Tipo:** feature
- **Ãrea:** backend | web | mobile | database
- **QuÃ©:**
 - Login con **usuario + contraseÃ±a** (ya no correo).
 - Usuario generado tipo RFC: 4 letras (apellidos/nombre) + fecha YYMMDD.
 - Alta en despacho pide nombre(s), apellidos y fecha; previsualiza el usuario.
 - MigraciÃ³n `012_user_username.sql`; seed demo con cuentas RFC.
- **Archivos / refs:** `rfcUsername.js`, `auth.js`, `admin.js`, `DispatchUsers.jsx`, `App.jsx`, `login_screen.dart`, `seed.js`

---
## 2026-08-12 â€” Icono marca consola despacho

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** Sustituido el marcador vacÃ­o por SVG micrÃ³fono + ondas (marca TacticalPtx) en la cabecera del centro de operaciones.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`

---
## 2026-08-12 â€” Consola admin mÃ¡s profesional (sin demo)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:**
 - Centro de operaciones: cabecera, badges de rol, formularios/tablas pulidos.
 - Usuarios/Grupos con etiquetas en espaÃ±ol; sin contraseÃ±as ni textos demo.
 - Login sin cuentas de demostraciÃ³n; sesiÃ³n `tacticalptx_session`.
- **Archivos / refs:** `DispatchLayout.jsx`, `command-center.css`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `App.jsx`

---
## 2026-08-12 â€” DM 1:1 + llamada privada

- **Tipo:** feature
- **Ãrea:** backend / web / mobile
- **QuÃ©:**
 - Chat directo entre usuarios de la misma org (`/api/dm`, sockets `dm:*`) ademÃ¡s de chat de grupo/canal.
 - Llamada privada 1:1 vÃ­a LiveKit (`/api/calls/private`, signaling `call:incoming|accepted|ended`).
 - Web Radio: pestaÃ±a **Directos / llamada**; mÃ³vil: Ã­cono Directos en barra inferior.
- **Archivos / refs:** `services/dm.js`, `routes/dm.js`, `routes/calls.js`, `socket/dm.js`, `DirectChat.jsx`, `PrivateCallOverlay.jsx`, `direct_pane.dart`

---
## 2026-08-12 â€” UI mÃ³vil estilo PTT Radio

- **Tipo:** ux
- **Ãrea:** mobile
- **QuÃ©:**
 - Home post-login = `RadioShell`: READY / AL AIRE, mic anillo azul, selector de canales, pÃ¡nico lateral.
 - Barra inferior: Chat Â· GPS Â· CÃ¡mara Â· Grabaciones (stub) Â· Grupos/cuenta.
 - Tema blanco/azul (`theme.dart`); chat extraÃ­do a `chat_panel.dart`.
- **Archivos / refs:** `radio_shell.dart`, `radio_screen.dart`, `chat_panel.dart`, `main.dart`, `theme.dart`

---
## 2026-08-12 â€” Chat: imÃ¡genes con vista previa (estilo WhatsApp)

- **Tipo:** ux / fix
- **Ãrea:** web / backend
- **QuÃ©:**
 - ClasificaciÃ³n de media por mime + extensiÃ³n (PNG/JPG ya no quedan como â€œarchivoâ€).
 - Vista previa inline + lightbox al clic (ampliar / Escape / cerrar).
 - Mensajes antiguos `type=file` que eran imagen se reclasificaron a `image`.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`, `uploads.js`, `messages.js`

---
## 2026-08-12 â€” Rol root (superadmin) permisos totales

- **Tipo:** feature / security
- **Ãrea:** backend / web / database
- **QuÃ©:**
 - Enum `user_role` + migraciÃ³n `011_role_root.sql`; helpers `services/roles.js`.
 - Root: CRUD usuarios (incl. delete/reset password), grupos (desactivar/hard delete), quitar miembros, purge chat; ve todos los grupos; modera mensajes sin ser miembro.
 - Seed + UI despacho: `root@tacticalptx.local` / `demo1234`.
- **Archivos / refs:** `admin.js`, `groups.js`, `DispatchUsers.jsx`, `DispatchGroups.jsx`, `api.js`, `seed.js`

---
## 2026-08-12 â€” BAT + stack local levantado

- **Tipo:** ops
- **Ãrea:** infra / ops
- **QuÃ©:**
 - Creado `LEVANTAR-TACTICALPTX.bat` (Postgres + Redis/LiveKit + API + Web).
 - Stack arrancado: PG Running, Redis, LiveKit (`node-ip=192.168.1.66`), API health OK.
- **Archivos / refs:** `LEVANTAR-TACTICALPTX.bat`, `infra/start-services.ps1`

---
## 2026-08-12 â€” Consola OK + APK release WhatsApp

- **Tipo:** ops
- **Ãrea:** mobile / ops
- **QuÃ©:**
 - Consola/PowerShell volviÃ³ a responder (`PS_OK`).
 - Build `flutter build apk --release` con `API_BASE=http://192.168.1.66:4000`.
 - APK lista: `mobile/build/app/outputs/flutter-apk/app-release.apk` (~87 MB).
- **Por quÃ© / notas:** Sin Shorebird OTA; para distribuir por WhatsApp. Si Cursor vuelve a colgar, usar `mobile/scripts/BUILD-APK-WHATSAPP.cmd`.
- **Archivos / refs:** `app-release.apk`, `BUILD-APK-WHATSAPP.cmd`

---
## 2026-08-12 â€” GuÃ­a: consola Windows colgada

- **Tipo:** docs / ops
- **Ãrea:** ops
- **QuÃ©:** DiagnÃ³stico cuando cmd/PowerShell/Cursor cuelgan; build APK por cmd o Android Studio; Shorebird solo si PS responde.
- **Archivos / refs:** `docs/CONSOLA_COLGADA.md`

---
## 2026-08-12 â€” Shorebird: flujo solo CMD (sin PowerShell)

- **Tipo:** infra / fix
- **Ãrea:** mobile / ops
- **QuÃ©:** Shorebird ya clonado en `%USERPROFILE%\.shorebird`. Scripts `INSTALAR-SHOREBIRD.cmd`, `SHOREBIRD-WHATSAPP.cmd`, `SHOREBIRD-PARCHE.cmd`, `DIAGNOSTICO.cmd` sin depender de PowerShell.
- **Archivos / refs:** `mobile/scripts/*.cmd`, `docs/SHOREBIRD_SIN_POWERSHELL.md`

---
## 2026-08-12 â€” Shorebird: instalador CMD sin UAC

- **Tipo:** fix / infra
- **Ãrea:** mobile / ops
- **QuÃ©:** Reescrito `install-shorebird-windows.cmd` (sin Admin anidado); PS1 con log; fallback ZIP si falla git.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.cmd`, `.ps1`, `shorebird-whatsapp-setup.cmd`

---
## 2026-08-12 â€” Shorebird: instalador anti-Defender

- **Tipo:** infra
- **Ãrea:** mobile / ops
- **QuÃ©:** Scripts Admin `install-shorebird-windows.ps1/.cmd` (exclusiones Defender + clone git). GuÃ­a WhatsApp actualizada.
- **Archivos / refs:** `mobile/scripts/install-shorebird-windows.*`, `docs/SHOREBIRD_WHATSAPP.md`

---
## 2026-08-12 â€” Paridad chat Android (lote 1)

- **Tipo:** feature
- **Ãrea:** mobile
- **QuÃ©:**
 - Modelo de mensaje completo (reply, reactions, sticker, ticks, edit/delete).
 - Sockets: `chat:edited|deleted|reaction|receipts|typing` + APIs REST.
 - UI: responder, reacciones, stickers, editar/borrar, typing, ticks âœ“/âœ“âœ“.
- **Pendiente:** notas de voz (grabar/reproducir) en mÃ³vil.
- **Archivos / refs:** `channel_session.dart`, `channel_screen.dart`, `api_client.dart`

---
## 2026-08-12 â€” Shorebird OTA + WhatsApp

- **Tipo:** infra / docs
- **Ãrea:** mobile
- **QuÃ©:**
 - GuÃ­a `docs/SHOREBIRD_WHATSAPP.md`: APK base por WhatsApp + parches OTA.
 - Scripts `mobile/scripts/shorebird-release-whatsapp.ps1` y `shorebird-patch.ps1`.
 - App: `shorebird_code_push` + aviso al tener parche listo.
- **Archivos / refs:** `SHOREBIRD_WHATSAPP.md`, `shorebird_update.dart`, `main.dart`, `pubspec.yaml`, scripts/

---
## 2026-08-11 â€” PTT: bajar latencia de voz

- **Tipo:** mejora
- **Ãrea:** web / mobile / backend / infra
- **QuÃ©:**
 - Mic se publica **muteado al entrar** al canal; al grant solo unmute.
 - `ptt:granted` se emite **antes** del INSERT en `ptt_sessions`.
 - RED desactivado; preset speech; NS off en mÃ³vil.
 - Mute no espera la subida de grabaciÃ³n; LiveKit `livekit.dev.yaml` + `--node-ip`.
- **Archivos / refs:** `usePtt.js`, `channel_session.dart`, `socket/ptt.js`, `infra/livekit.dev.yaml`, `start-services.ps1`

---
## 2026-08-11 â€” MÃ³vil: pÃ¡nico ya no tapa el chat

- **Tipo:** ux / fix
- **Ãrea:** mobile
- **QuÃ©:** Se quitÃ³ el FAB de pÃ¡nico que tapaba Enviar; el botÃ³n queda bajo el PTT (y el icono del AppBar).
- **Archivos / refs:** `mobile/lib/screens/channel_screen.dart`

---
## 2026-08-11 â€” Build Android: core library desugaring

- **Tipo:** fix
- **Ãrea:** mobile
- **QuÃ©:** Habilitado `coreLibraryDesugaring` en `android/app/build.gradle.kts` (requerido por `flutter_local_notifications`).
- **Archivos / refs:** `mobile/android/app/build.gradle.kts`

---
## 2026-08-11 â€” PÃ¡nico: sirena hasta Enterado

- **Tipo:** feature / ux
- **Ãrea:** web / mobile / backend
- **QuÃ©:**
 - Sirena en bucle hasta **Enterado** (Radio, Despacho) o **Resolver**.
 - Miembros del canal pueden hacer PATCH `acked`.
 - MÃ³vil: alarma periÃ³dica + diÃ¡logo hasta Enterado; se silencia tambiÃ©n si otro acusa.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`, `panic.js` (routes), `channel_session.dart`, `channel_screen.dart`, `V1_7_PANIC.md`

---
## 2026-08-11 â€” Mapa despacho: estilo Voyager (no black)

- **Tipo:** ux
- **Ãrea:** web
- **QuÃ©:** TileLayer del mapa de unidades pasÃ³ de Carto `dark_all` a `voyager` (calles a color).
- **Archivos / refs:** `CommandCenter.jsx`, `command-center.css`

---
## 2026-08-11 â€” Fix sirena de pÃ¡nico (no sonaba)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:**
 - El emisor ahora oye la sirena al confirmar pÃ¡nico (antes solo receptores).
 - Se quitÃ³ `window.confirm` (bloqueaba autoplay); confirmaciÃ³n por doble pulsaciÃ³n.
 - Audio mÃ¡s robusto: WAV HTMLAudio + Web Audio; unlock en cada gesto.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `RadioPage.jsx`, `CommandCenter.jsx`

---
## 2026-08-11 â€” Fix pantalla en blanco al PTT (Radio)

- **Tipo:** fix
- **Ãrea:** web
- **QuÃ©:** Se restaurÃ³ `usePtt(...)` en `RadioPage` (se habÃ­a borrado al cablear audio de pÃ¡nico).
- **Archivos / refs:** `RadioPage.jsx`

---
## 2026-08-11 â€” Sonido al recibir pÃ¡nico

- **Tipo:** feature / ux
- **Ãrea:** web / mobile
- **QuÃ©:** Sirena Web Audio en Radio/Despacho al `panic:alert`; en mÃ³vil SystemSound + vibraciÃ³n + diÃ¡logo.
- **Notas:** El navegador requiere un clic/PTT previo para permitir audio.
- **Archivos / refs:** `panicSound.js`, `usePtt.js`, `CommandCenter.jsx`, `channel_session.dart`

---
## 2026-08-11 â€” Ticks de lectura (v1.7.1)

- **Tipo:** feature / ux
- **Ãrea:** web / backend / database
- **QuÃ©:** âœ“âœ“ enviado â†’ leÃ­do (alguien del canal) â†’ azul si todos; mark-read al ver el chat.
- **Archivos / refs:** `010_message_reads.sql`, `chat.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_7_1_READ_RECEIPTS.md`

---
## 2026-08-11 â€” BotÃ³n de pÃ¡nico tambiÃ©n en Radio web

- **Tipo:** feature / ux
- **Ãrea:** web
- **QuÃ©:** BotÃ³n rojo **PÃNICO** bajo el PTT en Radio web (misma API que mÃ³vil); confirma antes de enviar.
- **Archivos / refs:** `RadioPage.jsx`, `usePtt.js`, `styles.css`

---
## 2026-08-11 â€” BotÃ³n de pÃ¡nico (v1.7)

- **Tipo:** feature / security
- **Ãrea:** mobile / backend / web / database
- **QuÃ©:** SOS desde canal mÃ³vil â†’ grupo + admin/despacho + `canReceivePanic`; banner en consola; mensaje sistema en chat.
- **Archivos / refs:** `009_panic_button.sql`, `panic.js`, `channel_screen.dart`, `CommandCenter.jsx`, `V1_7_PANIC.md`

---
## 2026-08-11 â€” Stickers en chat (v1.6.1)

- **Tipo:** feature / ux
- **Ãrea:** web / backend / database
- **QuÃ©:** Packs de stickers en Radio (botÃ³n ðŸŽ­); tipo `sticker`; catÃ¡logo API.
- **Archivos / refs:** `008_message_stickers.sql`, `stickers.js`, `chat.js`, `WhatsAppChat.jsx`, `V1_6_STICKERS.md`

---
## 2026-08-11 â€” Reacciones en mensajes (v1.6)

- **Tipo:** feature / ux
- **Ãrea:** web / backend / database
- **QuÃ©:** Reacciones emoji en chat Radio (toggle una por usuario); chips con contador en vivo.
- **Archivos / refs:** `007_message_reactions.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `V1_6_REACTIONS.md`

---
## 2026-08-11 â€” Calidad de voz menos â€œrobÃ³ticaâ€

- **Tipo:** fix / mejora
- **Ãrea:** web
- **QuÃ©:** Notas de voz y PTT: Opus a 128 kbps, sin noiseSuppression agresivo, sampleRate 48 kHz; helper `voiceRecord.js`.
- **Por quÃ© / notas:** La NS + bitrate bajo deformaba formantes (voz metÃ¡lica/IA).
- **Archivos / refs:** `voiceRecord.js`, `WhatsAppChat.jsx`, `usePtt.js`

---
## 2026-08-11 â€” Reproductor de audio mÃ¡s presentable

- **Tipo:** ux / mejora
- **Ãrea:** web
- **QuÃ©:** RediseÃ±o del player de notas de voz: botÃ³n SVG play/pausa, forma de onda clicable, chip â€œAudioâ€, tipografÃ­a de marca, sin pulso ni control nativo.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---
## 2026-08-11 â€” Reproductor de notas de voz en chat

- **Tipo:** ux / mejora
- **Ãrea:** web
- **QuÃ©:** Sustituye el `<audio controls>` nativo por un player estilo nota de voz: botÃ³n play/pausa grande, onda + seek, duraciÃ³n; solo una nota suena a la vez.
- **Por quÃ© / notas:** El control nativo se veÃ­a desfasado y poco usable dentro de las burbujas.
- **Archivos / refs:** `ChatMedia.jsx`, `styles.css`

---
## 2026-08-11 â€” Editar / eliminar mensajes (v1.5.1)

- **Tipo:** feature / ux
- **Ãrea:** web / backend / database
- **QuÃ©:** MenÃº del mensaje (â‹¯ o clic derecho): Editar (solo texto) y Eliminar para autor, admin o despacho. Soft-delete para todos; etiqueta â€œeditadoâ€.
- **Por quÃ© / notas:** Completa el chat estilo WhatsApp con gestiÃ³n bÃ¡sica de mensajes.
- **Archivos / refs:** `006_message_edit_delete.sql`, `chat.js`, `messages.js`, `WhatsAppChat.jsx`, `usePtt.js`, `api.js`

---
## 2026-08-11 â€” Chat estilo WhatsApp (v1.5)

- **Tipo:** feature / ux
- **Ãrea:** web / backend / database
- **QuÃ©:** Chat Radio rediseÃ±ado: burbujas, hora, responder, buscar, emojis, foto/doc, notas de voz, â€œescribiendoâ€¦â€, ticks enviados.
- **Notas:** No es clon completo (sin llamadas 1:1, ticks lectura, E2E, estados). Doc lÃ­mites en `V1_5_CHAT_WHATSAPP.md`.
- **Archivos:** `WhatsAppChat.jsx`, `chat.js`, `005_chat_whatsapp.sql`, `RadioPage.jsx`, `ChatMedia.jsx`

---
## 2026-08-11 â€” Sistema de documentaciÃ³n continua

- **Tipo:** docs / proceso
- **Ãrea:** docs
- **QuÃ©:** BitÃ¡cora + CHANGELOG + regla Cursor para documentar todo lo que se realice de aquÃ­ en adelante.
- **Archivos:** `BITACORA_DESARROLLO.md`, `CHANGELOG.md`, `.cursor/rules/documentar-cambios.mdc`

---
## 2026-08-11 â€” Informe desarrollo por mes

- **Tipo:** docs
- **Ãrea:** docs
- **QuÃ©:** Informe Mes 1â€“6 + v1.1â€“v1.4 (entregas, anÃ¡lisis, pendientes).
- **Archivos:** `Documentos/INFORME_DESARROLLO_POR_MES.md`, `docs/INFORME_DESARROLLO_POR_MES.md`

---
## 2026-08-11 â€” Tema claro/oscuro + Radio mejorada

- **Tipo:** ux / mejora
- **Ãrea:** web
- **QuÃ©:** Toggle Claro/Oscuro (persistente) en Login, Radio y Despacho. Radio con tarjeta PTT y estados mÃ¡s claros.
- **Archivos:** `web/src/theme.jsx`, `styles.css`, `RadioPage.jsx`, `command-center.css`, `DispatchLayout.jsx`, `index.html`

---
## 2026-08-11 â€” GrabaciÃ³n PTT v1.4

- **Tipo:** feature
- **Ãrea:** backend / web
- **QuÃ©:** Al soltar PTT en Radio web se sube audio; API `/api/recordings`; consola reproduce grabaciones 24 h.
- **Archivos:** `migrations/004_ptt_recordings.sql`, `routes/recordings.js`, `usePtt.js`, `CommandCenter.jsx`, `docs/V1_4_RECORDINGS.md`
- **Notas:** MÃ³vil aÃºn no graba (mismo endpoint listo).

---
## 2026-08-11 â€” FCM: gaps de cÃ³digo (Firebase pendiente)

- **Tipo:** feature / docs
- **Ãrea:** mobile / backend
- **QuÃ©:** Canal `tacticalptx_alerts`, notificaciones foreground, re-registro token, `GET/POST /api/devices/me|test`. Checklist Soporte.
- **Notas:** Usuario dejÃ³ Firebase/JSON pendiente â†’ health sigue `fcm: off`.
- **Archivos:** `push_service.dart`, `fcm.js`, `devices.js`, `ACTIVAR_FCM.md`, `docs/FCM_PUSH.md`

---
## 2026-08-11 â€” Consola Command + geocercas + login

- **Tipo:** feature / ux
- **Ãrea:** web / backend
- **QuÃ©:**
 - Consola tipo CommandCentral (mapa, canales, actividad, detalle); luego rediseÃ±o por legibilidad.
 - Geocercas v1.3 (CRUD + enter/exit).
 - Login split con marca dominante.
 - Stack arrancado post-cambio disco C; script `start-services.ps1` corregido (encoding).
- **Archivos:** `CommandCenter.jsx`, `command-center.css`, `geofences.js`, `003_geofences.sql`, `App.jsx` login

---
## 2026-08-10 â€” Audio LAN + APK + respaldo disco D

- **Tipo:** fix / infra / ops
- **Ãrea:** mobile / infra / ops
- **QuÃ©:**
 - PÃ©rdidas de voz: LiveKit `--node-ip` + UDP 7882, mute/unmute PTT, DTX off.
 - Rebuild APK `TacticalPtx-LAN.apk` (Gradle en D: por C: lleno).
 - Proyecto confirmado en `D:\pulsanet`; respaldo `Respaldos\pulsanet_pre_cambio_C_*`.
- **Archivos:** `channel_session.dart`, `usePtt.js`, `start-services.ps1`, Soporte APK/Respaldos

---
## 2026-08-10 â€” v1.1 Media/GPS y v1.2 FCM cableado (sesiÃ³n previa)

- **Tipo:** feature
- **Ãrea:** backend / web / mobile
- **QuÃ©:** Chat multimedia, GPS/rutas despacho; pipeline FCM (sin credenciales).
- **Docs:** `V1_1_MEDIA_GPS.md`, `FCM_PUSH.md`

---
## 2026-08 (Mes 1â€“6 consolidados)

Ver informe detallado: [INFORME_DESARROLLO_POR_MES.md](INFORME_DESARROLLO_POR_MES.md)

| Mes | Resumen |
|-----|---------|
| 1 | Auth, grupos, PTT web, LiveKit |
| 2 | Redis floor/presencia, chat, reconnect |
| 3 | Android Flutter alpha |
| 4 | Panel despacho (overview, mapa, users, groups) |
| 5 | Loadtest / piloto seÃ±alizaciÃ³n |
| 6 | Compose prod, harden API, prep Play Store |

---

*Fin de entradas histÃ³ricas iniciales. Las nuevas van encima de esta lÃ­nea de separaciÃ³n (despuÃ©s del encabezado â€œCÃ³mo registrarâ€).*

