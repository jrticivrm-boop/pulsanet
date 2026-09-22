-- Bloqueo de login por cuenta (no lockdown global del servicio).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_fail_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_locked_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_login_locked
  ON users (organization_id)
  WHERE login_locked_at IS NOT NULL;
