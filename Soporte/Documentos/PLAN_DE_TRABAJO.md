# TacticalPtx — Plan de trabajo maestro

**Producto:** TacticalPtx — PTT por internet (voz, chat, ubicación, despacho)  
**Ubicación canónica:** `C:\pulsanet\Soporte\Documentos\PLAN_DE_TRABAJO.md`  
**PDF:** `C:\pulsanet\Soporte\Documentos\PLAN_DE_TRABAJO.pdf` (generar: `python Soporte/Scripts/md_plan_to_pdf.py`)  
**Copia en repo:** `C:\pulsanet\docs\PLAN_DE_TRABAJO.md`  
**Referencias:** [ALCANCE_V1.md](../../docs/ALCANCE_V1.md) · [ARQUITECTURA.md](../../docs/ARQUITECTURA.md) · [PLAN_ESCALONADO_1_8.md](../../docs/PLAN_ESCALONADO_1_8.md) · [PLAN_5_SEMANAS.md](PLAN_5_SEMANAS.md) · PPT `TACTICALPTX_PLAN_5_SEMANAS.pptx`

Documento de planificación **como si el proyecto partiera de cero**, más un **roadmap de lo pendiente** respecto al estado actual del repo.

---

## Resumen ejecutivo

| Parámetro | Valor |
|-----------|--------|
| Usuarios objetivo | ~1.000 |
| Plataformas | Web (despacho) · Android · iOS |
| Stack | Flutter · React/Vite · Node · PostgreSQL · Redis · LiveKit · FCM |
| Plazo base v1.0 | 6 meses (~13 sprints de 2 semanas) |
| Evolución post-v1 | v1.1 → v1.8+ (media, DM, pánico, org, OTA) |

**Estado actual (ago 2026):** núcleo v1.0 y mayoría de v1.1–v1.8 **implementados en código**; pendiente **validación campo**, **endurecimiento producción**, **tiendas** y **cierre de MEJORAS.txt**.

**Ciclo ejecutivo:** ver [PLAN_5_SEMANAS.md](PLAN_5_SEMANAS.md) y presentación `TACTICALPTX_PLAN_5_SEMANAS.pptx` (Planeación → Desarrollo → Pruebas → Entrega → Retroalimentación).

---

## Parte A — Plan desde cero (sprints de 2 semanas)

Marcar `[x]` al cerrar cada ítem en un despliegue nuevo o al auditar que ya existe en el repo.

### Sprint 0 — Descubrimiento (sem. 1–2)

- [ ] Documento de alcance v1 (incluido / excluido / criterios)
- [ ] Propuesta técnica y presupuesto
- [ ] Roles: root, admin, despachador, operador
- [ ] Wireframes: login, PTT, chat, mapa, despacho
- [ ] Política de privacidad (stub App Store / Play)
- [ ] Estructura repo: `backend/`, `web/`, `mobile/`, `database/`, `infra/`, `docs/`, `Soporte/`
- [ ] Secretos fuera de git (`Soporte/Secrets/`, `.env.example`)

### Sprint 1 — Fundación backend (sem. 3–4)

- [ ] Node/Express, config por entorno
- [ ] PostgreSQL: schema base + migraciones
- [ ] Auth JWT + refresh, bcrypt
- [ ] Health `/api/health`
- [ ] Seed usuarios demo
- [ ] Redis instalado y documentado
- [ ] LiveKit dev/prod yaml + script arranque

### Sprint 2 — PTT voz web (sem. 5–6)

- [ ] Socket.IO floor: request / granted / denied / release
- [ ] Floor atómico Redis (1 hablante por grupo)
- [ ] Tokens LiveKit por room/grupo
- [ ] Demo web: login → canal → PTT
- [ ] Indicador “quién habla”
- [ ] Reconexión &lt; 10 s tras caída de red
- [ ] Doc demo Mes 1

### Sprint 3 — Presencia y chat grupal (sem. 7–8)

- [ ] Presencia con heartbeat (sin fantasmas offline)
- [ ] Chat grupal REST + Socket.IO
- [ ] Historial 90 días
- [ ] Typing indicators
- [ ] Doc demo Mes 2

### Sprint 4 — App Android alpha (sem. 9–10)

- [ ] Flutter: login, shell Radio/Chats/Ubicación
- [ ] PTT LiveKit + chat grupal
- [ ] Permisos mic / ubicación / notificaciones
- [ ] Keystore release + APK Wi‑Fi
- [ ] Doc demo Mes 3 + INSTALAR_APK_WIFI

### Sprint 5 — Panel despacho web (sem. 9–10, paralelo)

- [ ] Layout despacho: Radio, Seguimiento, Usuarios, Canales
- [ ] Mapa Leaflet en vivo
- [ ] CRUD usuarios y grupos
- [ ] Dashboard online / canales activos
- [ ] Manual de usuario operador + despachador
- [ ] Doc demo Mes 4

### Sprint 6 — App iOS (sem. 11–12)

- [ ] Podfile, certificados, Firebase iOS
- [ ] Paridad PTT + chat + push
- [ ] TestFlight checklist
- [ ] Doc APP_IOS

### Sprint 7 — Piloto y carga (sem. 13–14)

- [ ] Piloto 50–100 usuarios reales
- [ ] Prueba 50 hablantes en grupos distintos
- [ ] Checklist validación campo
- [ ] Métricas latencia PTT LAN/4G
- [ ] Doc demo Mes 5

### Sprint 8 — Producción v1.0 (sem. 15–16)

- [ ] HTTPS (Caddy), dominio, certificados
- [ ] Docker Compose prod (opcional)
- [ ] Respaldos BD automáticos + restore probado
- [ ] Firewall / hardening scripts
- [ ] CHANGELOG v1.0 + auditoría v1
- [ ] Doc PRODUCCION_MES6

### Sprint 9 — v1.1 Media + GPS (sem. 17–18)

- [ ] Fotos/archivos en chat (límites 10/25 MB)
- [ ] Ubicación tiempo real app + mapa despacho
- [ ] Historial rutas (polyline)
- [ ] Doc V1_1_MEDIA_GPS

### Sprint 10 — v1.2 Push + background (sem. 19–20)

- [ ] FCM Android/iOS completo
- [ ] Registro dispositivos
- [ ] PTT/chat con app en background
- [ ] Doc FCM_PUSH

### Sprint 11 — v1.3–v1.4 Geocercas + grabación (sem. 21–22)

- [ ] Geocercas polígonos + alertas
- [ ] Grabación sesiones PTT + reproducción despacho
- [ ] Docs V1_3_GEOFENCES, V1_4_RECORDINGS

### Sprint 12 — v1.5–v1.6 Chat WhatsApp (sem. 23–24)

- [ ] DM 1:1 web + mobile
- [ ] Burbujas, adjuntos, galería, stickers, reacciones
- [ ] Docs V1_5_CHAT_WHATSAPP, V1_6_*

### Sprint 13 — v1.7–v1.8 Pánico + org (sem. 25–26)

- [ ] Botón pánico + coords + alerta despacho/mapa
- [ ] Unidades org, grados, indicativos (SGTO GÓMEZ, B.O. LINARES)
- [ ] Radio/llamada 1:1, avatares, OTA APK
- [ ] E2EE contenido, edge público, seguridad
- [ ] Docs V1_7_PANIC, PLAN_ESCALONADO_1_8

---

## Parte B — Roadmap: lo que falta (estado actual)

**Versión APK referencia:** 1.8.43+52  
**Versión API referencia:** ver `backend/src/version.js`

### B.1 Escalón operativo (prioridad máxima)

Orden fijo según [PLAN_ESCALONADO_1_8.md](../../docs/PLAN_ESCALONADO_1_8.md):

| # | Tarea | Estado | Acción |
|---|--------|--------|--------|
| E1 | Validación campo voz + GPS | ⬜ Pendiente humano | Completar `VALIDACION_CAMPO_1_8_0.md` con usuario real |
| E2 | Repo git estable | 🟡 Parcial | Muchos cambios sin commit; definir rama release |
| E3 | APK OTA en producción | 🟢 Hecho flujo | Mantener `Publish-ApkUpdate.ps1`; usuarios en 1.8.43+52 |
| E4 | Docker / Play Store | ⬜ No iniciar | Solo tras E1 verde; ver DOCKER_PROD, PLAY_STORE |

### B.2 MEJORAS.txt — seguimiento

| # | Tema | Código | Validar en campo |
|---|------|--------|------------------|
| 1 | Pánico en Seguimiento (alerta + silenciar) | 🟢 Implementado | ⬜ Probar en consola |
| 2 | Atrás en llamada no cuelga | 🟢 Implementado | ⬜ Probar web + APK |
| 3 | Globo mensaje durante llamada | 🟢 Corregido web | ⬜ Probar APK en llamada |
| 4 | Scroll al volver Seguimiento → Radio | 🟡 Parcial | ⬜ Reproducir y cerrar si persiste |
| 5 | Avatares en chat web (Radio) | 🟢 Implementado | ⬜ Ctrl+F5 y verificar fotos |
| 6 | Indicativos SGTO GÓMEZ, B.O. LINARES | 🟡 Parcial | Ejecutar `rebuild-callsigns.js` + datos grado/apellido |
| 7 | PTT al maximizar pantalla | 🟢 Implementado | ⬜ Probar mapa fullscreen |
| 8 | Audio invasivo (APK) | 🟡 Parcial | ⬜ Probar Spotify/YouTube con radio conectada |

### B.3 Producción e infra

- [ ] Dominio y certificado estable (Caddy edge)
- [ ] Watch-Stack / LEVANTAR sin matar API en bucle
- [ ] Respaldos automáticos verificados (restore)
- [ ] LOCKDOWN / HARDEN scripts probados en servidor final
- [ ] Redis + LiveKit UDP accesibles desde 4G (ICE)
- [ ] Documentación POST_CAMBIO_DISCO / UBICACION_PROYECTO actualizada

### B.4 Producto / UX pendiente menor

- [ ] DM web: paridad total con APK (si falta algo)
- [ ] iOS TestFlight en dispositivos reales
- [ ] OpenAPI / documentación API formal
- [ ] Limpieza CHANGELOG [Unreleased] → versión etiquetada
- [ ] Manual usuario alineado con UI 1.8.x

### B.5 Fuera de alcance inmediato (v2+)

- Multi-organización SaaS
- Integración radios MOTOTRBO
- Grabación legal certificada 24/7
- Video PTT / videollamada
- Facturación integrada

---

## Parte C — Definition of Done (cualquier sprint)

1. Código mergeable en `backend/`, `web/` o `mobile/`
2. Migración SQL si aplica
3. Probado web + al menos un Android real
4. Entrada en `BITACORA_DESARROLLO.md` (+ CHANGELOG si es release)
5. Sin secretos en git
6. Doc de operación si afecta despliegue

---

## Parte D — Equipo y ceremonias mínimas

| Ritual | Frecuencia | Objetivo |
|--------|------------|----------|
| Revisión MEJORAS.txt | Semanal | Priorizar fixes UX |
| Publicar APK OTA | Por release | `mobile/scripts/Publish-ApkUpdate.ps1` |
| Validación campo | Por escalón | Cerrar PLAN_ESCALONADO |
| Bitácora | Cada cambio relevante | Trazabilidad |

---

## Parte E — Próximos 3 pasos recomendados

1. **Validación campo** — checklist Pedro (voz, GPS, pánico) en APK 1.8.43+52.
2. **Indicativos** — respaldar BD → `rebuild-callsigns.js` → verificar en chat/mapa.
3. **Commit release** — agrupar cambios recientes, tag `v1.8.43`, cerrar ítems MEJORAS verificados.

---

*Última actualización: 2026-08-28*
