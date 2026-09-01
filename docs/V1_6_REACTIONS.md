# TacticalPtx v1.6 — Reacciones en chat

## Incluido (web Radio)

- Reaccionar a un mensaje (menú → Reaccionar, o clic en chip existente)
- Emojis fijos: 👍 ❤️ 😂 😮 😢 🙏
- Una reacción por usuario (mismo emoji quita; otro reemplaza)
- Contadores en vivo vía Socket.IO `chat:reaction`

## Backend

- Tabla `message_reactions` (migración `007_message_reactions.sql`)
- Socket `chat:react` → broadcast `chat:reaction`
- REST `POST /api/groups/:id/messages/:messageId/reactions` `{ "emoji": "👍" }`
- Historial GET incluye `reactions: [{ emoji, count, mine }]`

## Probar

1. Dos usuarios en el mismo canal.
2. Reaccionar desde el menú ⋯.
3. Ver el chip en ambos clientes; volver a pulsar el mismo emoji para quitar.
