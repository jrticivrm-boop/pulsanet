# TacticalPtx v1.4 — Grabación PTT

Al **soltar el PTT** en la Radio web, se sube un audio (webm/ogg) al servidor.

## API

| Método | Ruta | Quién |
|--------|------|--------|
| POST | `/api/recordings/groups/:groupId` | Miembro (multipart `audio` + `durationMs`) |
| GET | `/api/recordings?hours=24` | Admin/dispatcher (org) |
| GET | `/api/recordings?groupId=&hours=` | Miembro del grupo |
| GET | `/api/recordings/:id/audio` | Auth + permiso |

Socket despacho: `dispatch:recording`

## UI

Consola → panel **Grabaciones PTT** (Escuchar).

## Migración

`database/migrations/004_ptt_recordings.sql`

## Límites

- Solo cliente **web** por ahora (MediaRecorder).
- Móvil: pendiente (mismo endpoint).
- Archivos en `backend/uploads/` (máx ~15 MB).
