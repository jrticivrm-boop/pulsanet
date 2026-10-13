-- Número de teléfono de contacto del usuario (alta / edición en Usuarios).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
