-- DM 1:1: mensajes con recipient_id y group_id nullable.
-- Idempotente: DBs creadas desde schema.sql ya tienen estos objetos.

ALTER TABLE messages ALTER COLUMN group_id DROP NOT NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_target'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_target CHECK (
        (group_id IS NOT NULL AND recipient_id IS NULL)
        OR (group_id IS NULL AND recipient_id IS NOT NULL AND sender_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_dm
  ON messages (sender_id, recipient_id, created_at DESC);
