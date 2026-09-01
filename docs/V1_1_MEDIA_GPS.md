# TacticalPtx v1.1 — Multimedia + GPS / rutas

## Qué se añadió

| Capacidad | Detalle |
|-----------|---------|
| Chat imagen | Hasta 10 MB (`image/jpeg|png|gif|webp`) |
| Chat audio | Hasta 15 MB |
| Chat archivo | Hasta 25 MB (docs, zip, rar, office…) |
| Chat video | Hasta 50 MB (se guarda como `file` + mime; UI reproduce) |
| Media auth | `GET /api/media/:messageId` (solo miembros) |
| GPS | Web Geolocation + Android `geolocator` → `POST /api/locations` |
| Rutas | `GET /api/locations/:userId/track?hours=` + polyline en despacho |
| Live mapa | Socket `dispatch:location` |

## API

```
POST /api/groups/:id/messages/media multipart file + type + body?
GET /api/media/:messageId
POST /api/locations { latitude, longitude, accuracyM? }
GET /api/locations/:userId/track?hours=8
```

Migración: `database/migrations/002_media_fields.sql`

## Probar

1. API v1.1 + migración aplicada 
2. Web radio: botón **+** adjunta; permite GPS del navegador 
3. Despacho → Mapa: selector “Ruta de” + horas 
4. Android: iconos imagen/adjunto; icono GPS en app bar si reporta 

## Sigue fuera (v2 / v1.2)

Geo-cercas, grabación PTT, interoperabilidad radios, FCM, DM.
