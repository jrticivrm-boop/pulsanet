# TacticalPtx (antes PulsaNet)

**Ubicación única:** `D:\pulsanet`  
(Todo el producto + carpeta `Soporte\`. Detalle: [docs/UBICACION_PROYECTO.md](docs/UBICACION_PROYECTO.md))

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
D:\pulsanet\
├── backend/       API REST + Socket.IO + Redis + LiveKit
├── web/           Radio + panel despacho
├── mobile/        App Flutter (Android; iOS con Mac)
├── database/      Esquema PostgreSQL + migraciones
├── infra/         LiveKit local + Docker Compose prod
├── docs/          Alcance, arquitectura, demos, producción
└── Soporte/       Documentos, secretos, APK, respaldos, brand
```

`D:\PulsaNet_Soporte` → unión a `D:\pulsanet\Soporte` (compatibilidad).

---

## Documentación

- [Ubicación del proyecto](docs/UBICACION_PROYECTO.md)
- [Alcance v1](docs/ALCANCE_V1.md)
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

## Inicio rápido (desarrollo)

### 1. PostgreSQL

```bash
createdb pulsanet_db
psql -U postgres -d pulsanet_db -f database/schema.sql
```

### 2. Redis + LiveKit

```powershell
powershell -File infra/start-services.ps1
```

### 3. API

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

### 4. Demo web

```bash
cd web
npm install
npm run dev
```

http://localhost:5173 — usuarios `admin@pulsanet.local` / `op1`…`op4` · pass `demo1234`

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

*PulsaNet © 2026 — Producto independiente*
