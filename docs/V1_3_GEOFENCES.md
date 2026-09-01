# TacticalPtx v1.3 — Geocercas

Circulares por organización. Evaluación en el servidor al reportar GPS (`POST /api/locations`).

## API (admin / dispatcher)

- `GET /api/geofences`
- `POST /api/geofences` `{ name, centerLat, centerLng, radiusM }`
- `PATCH /api/geofences/:id`
- `DELETE /api/geofences/:id`

## Socket despacho

`dispatch:geofence` → `{ userId, displayName, geofenceId, name, event: 'enter'|'exit', ... }`

## UI

Despacho → Mapa → **Nueva geocerca** → clic en mapa (centro) → radio → Guardar.

## Migración

`database/migrations/003_geofences.sql` (ya aplicada en esta PC).
