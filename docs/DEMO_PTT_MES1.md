# PulsaNet — Demo PTT Mes 1

Pasos para la demo de 5 usuarios en navegador.

## 1. Base de datos

```bash
createdb pulsanet_db
psql -U postgres -d pulsanet_db -f database/schema.sql
```

## 2. LiveKit

**Opción A — Docker (recomendado en local)**

```bash
docker compose -f infra/docker-compose.yml up -d
```

Keys `--dev`: `devkey` / `secret` · URL `ws://127.0.0.1:7880` (ya van en `.env.example`).

**Opción B — LiveKit Cloud** (si no tienes Docker)

1. Crea proyecto en https://cloud.livekit.io  
2. Copia URL, API Key y API Secret a `backend/.env`:

```env
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```
## 3. API

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

## 4. Web demo

```bash
cd web
npm install
npm run dev
```

URL: http://localhost:5173

## Flujo a probar

1. Abre 5 ventanas/pestañas (o perfiles) y entra con admin + op1…op4.
2. Todos en canal **General**.
3. Uno mantiene PTT → los demás oyen audio y ven “X habla”.
4. Segundo intenta PTT → denegado (“ocupado”).
5. Suelta → canal libre.

## API nueva

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/livekit/status` | ¿LiveKit configurado? |
| POST | `/api/livekit/token` | `{ groupId }` → token + URL room |
