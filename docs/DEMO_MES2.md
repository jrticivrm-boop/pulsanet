# TacticalPtx — Demo Mes 2 (presencia, chat, PTT)

Extiende la demo Mes 1 con **Redis** (floor + online), **chat de texto** y reconexión Socket/LiveKit.

## Arranque rápido

```powershell
# Redis + LiveKit
powershell -File infra/start-services.ps1

cd backend
npm run seed # si aún no
npm run dev

cd ../frontend
npm run dev
```

- Demo: http://localhost:5173 
- API: http://localhost:4000 

## Qué probar

1. 2–5 pestañas con `admin` / `op1`…`op4` (`demo1234`).
2. Lista **En línea** se actualiza al entrar/salir.
3. **Chat** en el canal (historial + tiempo real).
4. **PTT** — un hablante; si se cae el socket, reconecta y re-une al canal.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/groups/:id/messages` | Historial (limit) |
| POST | `/api/groups/:id/messages` | `{ body }` texto |
| GET | `/api/health` | Incluye `redis` |

### Socket.IO

| Evento | Dirección | Uso |
|--------|-----------|-----|
| `ptt:join` / `leave` / `request` / `release` | C→S | Floor |
| `ptt:state` / `speaker` / `granted` / `denied` / `released` | S→C | Estado floor |
| `presence:update` | S→C | `{ members[] }` |
| `presence:ping` | C→S | Keepalive |
| `chat:send` | C→S | Texto en vivo |
| `chat:message` | S→C | Nuevo mensaje |

## Redis (Laragon)

```
C:\laragon\bin\redis\redis-x64-5.0.14.1\redis-server.exe
```

URL: `redis://127.0.0.1:6379` (`backend/.env`).
