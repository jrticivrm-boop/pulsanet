# PulsaNet v1.5 — Chat estilo WhatsApp (Radio)

## Incluido (web Radio)

- Burbujas enviadas / recibidas + hora
- Cabecera con canal, en línea y “escribiendo…”
- Responder (quote) + menú contextual (clic derecho)
- Buscar en el chat
- Emojis rápidos
- Adjuntar foto / documento
- Notas de voz (mantener 🎤)
- Ticks de enviado (✓✓) en propios

## Backend

- Enum `audio` + columna `reply_to_id`
- Migración `005_chat_whatsapp.sql`
- Socket `chat:typing` / `chat:send` con `replyToId`

## No es un clon completo de WhatsApp

Pendiente / fuera de alcance ahora: llamadas 1:1, estados/historias, ticks azules de lectura, cifrado E2E, chats DM privados, reacciones, mensajes temporales, sticker packs.

## Probar

1. Dos usuarios en el mismo canal (Radio).
2. Texto, respuesta, emoji, foto, nota de voz.
3. Ver “escribiendo…” en el otro cliente.
