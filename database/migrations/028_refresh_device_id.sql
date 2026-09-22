-- Identificador estable de equipo para sesión única (no admin/root).
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_device
  ON refresh_tokens (user_id, device_id);
