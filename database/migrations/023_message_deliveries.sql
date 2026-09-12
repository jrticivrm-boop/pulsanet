-- Entrega a dispositivo (1 paloma → 2 palomas grises)
CREATE TABLE IF NOT EXISTS message_deliveries (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_user
  ON message_deliveries (user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_msg
  ON message_deliveries (message_id);
