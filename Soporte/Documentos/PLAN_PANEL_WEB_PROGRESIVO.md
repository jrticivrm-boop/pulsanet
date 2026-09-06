# Plan: Panel web progresivo (móvil · tablet · escritorio)

**Fecha:** 2026-09-06  
**Alcance:** hacer el panel web TacticalPtx usable y estable en navegadores móviles/tablet/desktop, sin romper el flujo de escritorio actual.  
**Producto:** la app Flutter sigue siendo el cliente de campo (FCM, FGS, wake). El web en móvil es **cliente de respaldo / mesa ligera / tablet de despacho**, no un clon 1:1 del APK en background.

**Fuentes de auditoría:** shell `cc-shell--inst`, rail, inbox, Command Center, Video, LiveTrack, CSS (`styles.css`, `institutional.css`, `command-center.css`), hosts globales (llamadas, Personas), SW de notificaciones.

---

## Diagnóstico (estado actual)

| Área | Situación |
|------|-----------|
| Login | Ya apila bien ≤820px |
| Radio operador (`/radio`) | Cercano a usable; PTT grande; inbox apila mal (lista + hilo a la vez) |
| Shell despacho | Rail lateral permanente + `100dvh` + `overflow: hidden` → en teléfono queda ~240px de contenido |
| Consola / mapa / video | Multi-panel: colapsa columnas pero sigue denso y recortado |
| Tablas admin | `min-width: 720px` → scroll horizontal |
| Touch | Algunos `@media (hover: none)`; muchos botones &lt; 44px; drag HTML5 del rail frágil en móvil |
| PWA | Solo `sw-notify.js` (avisos); sin manifest ni install |
| Viewport | OK (`device-width`); falta `viewport-fit=cover` si se usan notches |

**Principio anti-desfase:** cada fase deja el producto **desplegable y usable en escritorio igual o mejor**, y **mejor en móvil** respecto a la fase anterior. No se empieza Fase N+1 sin checklist verde de Fase N.

---

## Decisiones de producto (fijas para este plan)

1. **IA móvil web** (≤720px): navegación tipo pestañas inferiores o drawer — **Radio · Chats · Personas** (+ Despacho colapsado a “Más” / menú para roles dispatch).
2. **Consola multi-cámara / mosaico denso** en teléfono: **modo reducido** (1–2 tiles, sheets), no el dashboard completo.
3. **PWA instalable** = Fase 5 (después de shell + chat + media estables).
4. **No** perseguir paridad de background con Flutter (iOS Safari suspende audio/socket).

---

## Fase 0 — Cimentación (sin UI visible “grande”)

**Objetivo:** tokens, breakpoints y harness de prueba para que las fases siguientes no peleen entre sí.

### Entregables
- Tokens CSS compartidos: `--bp-phone: 720px`, `--bp-tablet: 960px`, `--touch-min: 44px`, safe-area insets en variables.
- `index.html`: `viewport-fit=cover`; `theme-color`; meta Apple básicas (sin PWA completa aún).
- Utilidad JS `useMediaQuery` / `matchMedia` (phone / tablet / coarse pointer) usada por shell e inbox.
- Documento corto de matriz de prueba (Safari iOS, Chrome Android, Chrome desktop, Edge): mic, cam, geoloc, LiveKit, PTT, teclado virtual.

### Criterio de salida
- [ ] Escritorio sin cambios visuales relevantes.
- [ ] Tokens importados en `institutional.css` / `styles.css` / `command-center.css`.
- [ ] Matriz de prueba firmada (checklist en `Soporte/Documentos/` o bitácora).

### Riesgo si se salta
Breakpoints inconsistentes (820 vs 860 vs 960 vs 980) y regresiones de teclado/`100vh`.

---

## Fase 1 — Shell móvil (Despacho + Radio embebido)

**Objetivo:** que el chrome deje de robar el viewport en teléfono.

### Entregables
1. **≤720px:** rail lateral oculto por defecto; menú hamburguesa o **bottom nav** (Radio / Chats / Personas / Más).
2. Auto `is-rail-mini` o rail overlay (drawer) en tablet estrecha (720–960); reutilizar patrón legacy `is-mobile-open` solo si se adapta al rail institucional (hoy el drawer CSS es de `cc-shell--side` y el shell vivo es `cc-shell--inst`).
3. Topbar comprimida: PTT mini ≥44px; safe-area top/bottom en topbar, strip y composer.
4. En phone: permitir scroll del contenido principal (relajar `overflow: hidden` global del shell solo en narrow).
5. Desactivar o sustituir reorder por drag HTML5 del rail en touch (`pointer: coarse`).

### Archivos clave
- [`web/src/dispatch/DispatchLayout.jsx`](web/src/dispatch/DispatchLayout.jsx)
- [`web/src/institutional.css`](web/src/institutional.css)
- [`web/src/dispatch/command-center.css`](web/src/dispatch/command-center.css)

### Criterio de salida
- [ ] iPhone SE / Pixel estrecho: contenido principal ≥70% del ancho.
- [ ] Abrir `/despacho`, `/despacho/video`, `/radio` sin clip fatal de altura.
- [ ] Escritorio: rail y topbar idénticos al comportamiento actual.
- [ ] PTT hold sigue funcionando (touch-action) sin bloquear scroll del resto.

### No hacer en esta fase
Rediseñar Command Center mosaico; PWA; tablas card.

---

## Fase 2 — Chat / Inbox stack (estilo WhatsApp)

**Objetivo:** mensajería usable en teléfono (hoy lista + hilo apilados a la vez).

### Entregables
1. ≤720px: **lista XOR hilo** — seleccionar fila → pantalla completa del chat; botón Atrás siempre.
2. Composer fijo con `safe-area-inset-bottom` + compensación teclado (`visualViewport` si hace falta).
3. Acciones de fila / menú de burbuja: visibles en touch (≥44px); eliminar dependencia de hover.
4. Tabs de conversación: scroll horizontal OK; sin overflow horizontal de página.
5. Integrar Personas / Peer sheet con el bottom nav (abrir sheet sin Ctrl+K).

### Archivos clave
- [`web/src/ChatInbox.jsx`](web/src/ChatInbox.jsx)
- [`web/src/WhatsAppChat.jsx`](web/src/WhatsAppChat.jsx) / [`DirectChat.jsx`](web/src/DirectChat.jsx)
- [`web/src/styles.css`](web/src/styles.css) (~3759+)
- [`web/src/PeoplePalette.jsx`](web/src/PeoplePalette.jsx), [`PeerActionSheet.jsx`](web/src/PeerActionSheet.jsx)

### Criterio de salida
- [ ] Flujo: lista → DM/grupo → atrás → lista, sin perder scroll de lista.
- [ ] Enviar texto / audio / imagen en iOS Safari y Chrome Android.
- [ ] Llamada / video / Ver cámara desde ficha de persona sin solapar teclado de forma irrecuperable.

### Dependencia
Requiere Fase 1 (nav Atrás / chrome estable).

---

## Fase 3 — Llamadas, PTT y media en móvil web

**Objetivo:** audio/video no se rompen por viewport, autoplay o overlays.

### Entregables
1. Overlays de llamada: `100dvh` + safe-area (no solo `100vh`/`100vw`).
2. Banner entrante y mini-call: no tapa bottom nav ni notch.
3. Unlock de audio (gesto usuario) documentado y unificado (PTT, panic, ringtone web).
4. LiveKit: `playsInline`, muted bootstrap donde aplique; revalidar calidad ya tocada en 1.8.83.
5. Geolocation / getUserMedia: mensajes de error claros si HTTP o permiso denegado.
6. Checklist explícito: “mantener pestaña abierta” vs APK (sin fingir FGS).

### Archivos clave
- [`PrivateCallOverlay.jsx`](web/src/PrivateCallOverlay.jsx), [`PrivateCallHost.jsx`](web/src/PrivateCallHost.jsx)
- [`usePtt.js`](web/src/usePtt.js), [`appNotify.js`](web/src/appNotify.js), [`backgroundKeepalive.js`](web/src/backgroundKeepalive.js)
- [`callMedia.js`](web/src/callMedia.js), [`videoStreaming.js`](web/src/videoStreaming.js)

### Criterio de salida
- [ ] Contestar / colgar / PTT / videollamada 1:1 en phone browser.
- [ ] Ver cámara (monitor) en tablet/phone: al menos 1 feed usable + controles Frontal/Trasera.
- [ ] No regresión escritorio de llamadas.

### Dependencia
Fases 1–2 (chrome y chat no pelean con overlay).

---

## Fase 4 — Despacho progresivo (tablet primero, phone “pinch”)

**Objetivo:** consolas densas usables en tablet; en phone, superficies primarias + sheets.

### Entregables
1. **Command Center:** en ≤960px una superficie primaria (mapa **o** actividad); el resto en bottom sheet / tabs.
2. **LiveTrack:** lista como sheet inferior (ya hay colapso); mapa full; filtros en drawer.
3. **Dispatch Video:** ≤720px máx. 1–2 monitores; ocultar conferencia multi-tile densa o forzar lista.
4. **Usuarios / grupos / catálogos:** formularios 1 col; tablas → cards o scroll horizontal **acotado** con sombra de overflow (quitar `min-width: 720` ciego donde sea posible).
5. Panic / alertas: banner y mapa alcanzables desde bottom nav “Más”.

### Archivos clave
- [`CommandCenter.jsx`](web/src/dispatch/CommandCenter.jsx)
- [`LiveTrackMap.jsx`](web/src/dispatch/LiveTrackMap.jsx)
- [`DispatchVideo.jsx`](web/src/dispatch/DispatchVideo.jsx) + `RemoteMonitorConference.jsx`
- [`DispatchUsers.jsx`](web/src/dispatch/DispatchUsers.jsx), catálogos, `command-center.css`

### Criterio de salida
- [ ] iPad / tablet Android: ops + seguimiento usables sin zoom horizontal de página.
- [ ] Phone: al menos mapa **o** lista de unidades + Ver cámara 1 peer sin UI rota.
- [ ] Escritorio: mosaico multi-panel intacto.

### Dependencia
Fases 1–3 (shell, chat, media). **No** mezclar rediseño de mosaico con cambio de rail en el mismo PR.

---

## Fase 5 — PWA e higiene multiplataforma

**Objetivo:** instalar en home screen y endurecer edge cases.

### Entregables
1. `manifest.webmanifest` + iconos (incl. round brand si aplica) + link en `index.html`.
2. `display: standalone`, `start_url`, `theme_color`, `background_color`.
3. Extender SW: precache shell estático (HTML/CSS/JS); **no** cachear API/socket/LiveKit a ciegas.
4. Web Push (VAPID) opcional — documentar límites iOS.
5. Sustituir drag-reorder del rail por UI touch-friendly.
6. `@media (pointer: coarse)` global para hit targets restantes.
7. Smoke automatizable (Playwright mobile viewports) en CI o script local.

### Criterio de salida
- [ ] “Añadir a pantalla de inicio” en Android Chrome; iOS Safari Add to Home Screen muestra icono correcto.
- [ ] Arranque offline muestra shell + mensaje “sin red” (no pantalla blanca).
- [ ] Notificaciones: al menos nivel actual (SW notify) sin regresión.

### Dependencia
Fases 1–4 estables. PWA antes de media estable = falsos positivos de “instalado pero no usable”.

---

## Orden de PRs (anti-desfase)

| PR | Fase | Contenido | Merge gate |
|----|------|-----------|------------|
| PR0 | 0 | Tokens + viewport-fit + useMediaQuery + matriz | Desktop visual OK |
| PR1 | 1 | Shell móvil / bottom nav / rail | Phone chrome OK |
| PR2 | 2 | Inbox stack | Chat phone OK |
| PR3 | 3 | Calls/PTT/media dvh | Media phone OK |
| PR4a | 4 | LiveTrack + CC sheets | Tablet ops OK |
| PR4b | 4 | Video reducido + tablas | Phone pinch OK |
| PR5 | 5 | Manifest + SW shell + coarse | Install OK |

Un PR = una fase (o 4a/4b). **Prohibido** mezclar shell + mosaico video + PWA en un solo commit grande.

---

## Fuera de alcance (explícito)

- Reemplazar la app Flutter por web.
- Background PTT/cámara con app “matada” en iOS Safari.
- Paridad pixel-perfect del Command Center de 3 monitores en un iPhone SE.
- Reescritura total de CSS desde cero (se adapta el sistema institucional existente).

---

## Definición de “terminado”

El panel web se considera **progresivo / multiplataforma** cuando:

1. Operador en phone browser: Radio + Chats + Personas + llamadas 1:1 sin layout roto.  
2. Despacho en tablet: seguimiento + ops + 1–2 cámaras usables.  
3. Escritorio: sin regresiones de consola actual.  
4. Matriz Safari iOS + Chrome Android + desktop pasada.  
5. (Opcional Fase 5) Instalable como PWA con shell offline.

---

## Primera acción al implementar

Empezar **Fase 0 + Fase 1** juntos solo si Fase 0 es &lt;1 día; si no, PR0 solo y luego PR1. Validar en dispositivo real (no solo DevTools) antes de Fase 2.
