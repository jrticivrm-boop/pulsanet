# TacticalPtx — Panel despacho Mes 4

Panel web para admin/despachador: resumen PTT en vivo, mapa OSM, usuarios y grupos.

## Arranque

```powershell
powershell -File infra/start-services.ps1
cd backend; npm run seed; npm run dev
cd frontend; npm run dev
```

http://localhost:5173

| Cuenta | Rol | Destino |
|--------|-----|---------|
| `despacho@tacticalptx.local` | dispatcher | `/despacho` |
| `admin@tacticalptx.local` | admin | `/despacho` (+ crear usuarios) |
| `op1@…` | operator | `/radio` PTT |

Pass: `demo1234`

## Rutas web

- `/login`
- `/despacho` — overview + speakers
- `/despacho/mapa` — Leaflet + OpenStreetMap
- `/despacho/usuarios` — listado / alta
- `/despacho/grupos` — listado / alta / asignar
- `/radio` — demo PTT (Mes 1–2)

## API admin

| Método | Ruta |
|--------|------|
| GET | `/api/admin/overview` |
| GET/POST | `/api/admin/users` |
| PATCH | `/api/admin/users/:id` |
| GET | `/api/admin/groups` |
| POST | `/api/admin/groups/:id/members` |
| GET/POST | `/api/locations` |

Socket despacho: `dispatch:join` → eventos `dispatch:speaker|released|presence`.

## iOS TestFlight (prep)

El código Flutter en `mobile/` ya incluye target iOS. Para TestFlight hace falta:

1. Mac + Xcode + cuenta Apple Developer
2. `flutter build ipa`
3. Subir con Transporter / Xcode Organizer

En Windows solo se prepara el proyecto; el build iOS se hace en Mac.
