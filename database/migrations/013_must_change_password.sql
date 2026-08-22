-- Forzar cambio de contraseña en el primer ingreso (o tras restablecer).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
