# SICOM — Sistema de Comunicaciones para Operaciones Militares

_(antes TacticalPtx)_

**Producto:** SICOM  
**Carpeta del programa:** `C:\pulsanet` (UI: `frontend\` :5173). Worktree desarrollo: `C:\pulsanet-dev` (UI: `frontend\` :5273). Auxiliar opcional: `C:\pulsanet_soporte`.  
Detalle: [docs/UBICACION_PROYECTO.md](docs/UBICACION_PROYECTO.md) · [docs/SOPORTE.md](docs/SOPORTE.md)

Plataforma **Push-to-Talk (PTT)** por internet — producto independiente.

Comunicación instantánea por voz para equipos de campo, vía celular o Wi‑Fi, con grupos, chat, ubicación y panel de despacho web.

| | |
|---|---|
| **Usuarios objetivo** | 1,000 |
| **Plataformas** | Web + Android + iOS |
| **Plazo v1** | 6 meses |
| **Stack** | Flutter · React · Node.js · PostgreSQL · Redis · LiveKit |

---

## Estructura del proyecto

```
C:\pulsanet\
├── backend/ API REST + Socket.IO + Redis + LiveKit
├── frontend/ Radio + panel despacho (producción, Vite :5173)
├── mobile/ App Flutter (Android; iOS con Mac)
├── database/ Esquema PostgreSQL + migraciones
├── infra/ LiveKit local + Caddy + Docker Compose
├── docs/ Alcance, arquitectura, bitácora de producto
├── LEVANTAR-TACTICALPTX.bat
└── CREAR-O-ACTUALIZAR-BD.bat
```

Auxiliar (no runtime): `C:\pulsanet_soporte`. Ambos árboles usan `frontend\`; solo cambian puertos (`LEVANTAR-DEV.bat` → 4100/5273/7980).

---

## Documentación

- [Ubicación del proyecto](docs/UBICACION_PROYECTO.md)
- [Soporte auxiliar](docs/SOPORTE.md)
- [Alcance v1](docs/ALCANCE_V1.md)
- [Plan de trabajo maestro](docs/PLAN_DE_TRABAJO.md) — sprints + roadmap pendiente
- [Propuesta técnica](docs/PROPUESTA_TECNICA.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Producción Mes 6](docs/PRODUCCION_MES6.md)
- [Privacidad (stub)](docs/PRIVACY.md)
- [Demo Mes 1 (PTT)](docs/DEMO_PTT_MES1.md)
- [Demo Mes 2 (presencia + chat)](docs/DEMO_MES2.md)
- [Android alpha Mes 3](docs/ANDROID_ALPHA_MES3.md)
- [Despacho Mes 4](docs/DESPACHO_MES4.md)
- [Piloto Mes 5](docs/PILOTO_MES5.md)
- [Producción Mes 6](docs/PRODUCCION_MES6.md)
- [v1.1 Multimedia + GPS](docs/V1_1_MEDIA_GPS.md)
- [FCM Push v1.2](docs/FCM_PUSH.md)
- [Auditoría v1](docs/AUDITORIA_V1.md)
- [Informe desarrollo por mes](docs/INFORME_DESARROLLO_POR_MES.md)
- [Bitácora de desarrollo](docs/BITACORA_DESARROLLO.md)
- [Changelog](docs/CHANGELOG.md)
- [v1.3 Geocercas](docs/V1_3_GEOFENCES.md)
- [v1.4 Grabación PTT](docs/V1_4_RECORDINGS.md)

---

## Inicio rápido (máquina nueva)

### 1. PostgreSQL (idempotente)

```bat
CREAR-O-ACTUALIZAR-BD.bat
```

Crea `tacticalptx_db` si falta, aplica `schema.sql` solo si la base está vacía, y corre migraciones `001`→`030+` sin borrar datos.

### 2. Redis + LiveKit + API + Web

```bat
LEVANTAR-TACTICALPTX.bat
```

Consola: **https://127.0.0.1:5173** (no uses `http://` con TLS LAN). API: **https://127.0.0.1:4000/api/health**.

Copia `backend\.env.example` → `backend\.env` antes del primer arranque. Usuario inicial: `npm run seed` en `backend`.

### Producción (Docker)

Ver [docs/PRODUCCION_MES6.md](docs/PRODUCCION_MES6.md) — `infra/docker-compose.prod.yml`.

---

## Estado actual (v1.2)

- [x] Documentación de producto + manual + privacy stub
- [x] Esquema PostgreSQL (+ activity_logs + media fields)
- [x] API 1.2: auth/refresh, grupos, chat texto+media, admin, ubicaciones+rutas, metrics, devices, FCM
- [x] Socket.IO: floor PTT + presencia + despacho + location live + push triggers
- [x] LiveKit + demo radio web + panel despacho (mapa/rutas)
- [x] App Flutter Android (PTT, chat media, GPS, registro FCM)
- [x] Piloto carga (`npm run loadtest`)
- [x] Docker Compose producción (archivos; Docker Desktop opcional en host)
- [ ] Publicación Play Store / App Store
- [ ] iOS TestFlight + APNs
- [ ] Geo-cercas / grabación (v2)

---

*TacticalPtx © 2026 — Producto independiente*
