# PulsaNet v1.7.1 — Ticks de lectura

## Comportamiento (Radio web)

- ✓✓ gris/muted: mensaje **enviado**
- ✓✓ verde (accent): **leído** por al menos un compañero del canal
- ✓✓ azul: **leído por todos** los demás miembros del grupo
- Tooltip: “Enviado” / “Leído por N” / “Leído por todos”

## Backend

- Tabla `message_reads` (migración `010_message_reads.sql`)
- Socket `chat:read` `{ groupId, upToMessageId }` → `chat:receipts`
- REST `POST /api/groups/:id/messages/read` `{ upToMessageId }`

## Cliente

Al abrir/ver el chat se marca lectura hasta el último mensaje visible.
