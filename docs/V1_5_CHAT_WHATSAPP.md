# TacticalPtx v1.5 — Chat estilo WhatsApp (Radio)

## Incluido (web Radio)

- Burbujas enviadas / recibidas + hora
- Cabecera con canal, en línea y “escribiendo…”
- Responder (quote) + menú (⋯ o clic derecho)
- **Editar** mensajes de texto propios (también admin/despacho)
- **Eliminar** (soft-delete: todos ven “Mensaje eliminado”)
- Etiqueta “editado” en mensajes modificados
- Buscar en el chat
- Emojis rápidos
- Adjuntar foto / documento
- Notas de voz (mantener 🎤) con reproductor propio (play/pausa + barra + duración)
- Ticks de enviado (✓✓) en propios

## Backend

- Enum `audio` + columna `reply_to_id` (migración `005`)
- Columnas `edited_at`, `deleted_at` (migración `006`)
- Socket: `chat:send`, `chat:typing`, `chat:edit`, `chat:delete` → `chat:edited` / `chat:deleted`
- REST: `PATCH` / `DELETE` `/api/groups/:id/messages/:messageId`

## No es un clon completo de WhatsApp

Pendiente / fuera de alcance ahora: llamadas 1:1, estados/historias, cifrado E2E, chats DM privados, mensajes temporales, packs WebP personalizados.

Reacciones: `V1_6_REACTIONS.md`. Stickers: `V1_6_STICKERS.md`. Lectura: `V1_7_1_READ_RECEIPTS.md`.

## Probar

1. Dos usuarios en el mismo canal (Radio).
2. Texto, respuesta, emoji, foto, nota de voz.
3. Ver “escribiendo…” en el otro cliente.
4. Editar un texto propio → ambos ven “editado”.
5. Eliminar → ambos ven “Mensaje eliminado”.
