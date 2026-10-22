-- Versión de token de acceso: al bloquear, forzar logout o cambiar contraseña
-- se incrementa y los JWT anteriores dejan de valer (no esperan las 8 h / 15 min).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN users.token_version IS
  'Se incrementa para invalidar access JWT (lock, force-logout, cambio de password).';
