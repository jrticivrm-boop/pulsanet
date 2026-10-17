-- Mensajes efímeros (ver una vez): imagen/video DM con flag; se borran tras apertura.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS view_once BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS view_once_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_view_once
  ON messages (view_once)
  WHERE view_once = TRUE AND deleted_at IS NULL;
