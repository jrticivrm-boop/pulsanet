-- Chat WhatsApp-like: audio + reply
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'audio';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages (reply_to_id);
