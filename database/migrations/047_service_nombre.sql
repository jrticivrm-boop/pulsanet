-- Nombre libre del servicio (distinto del catálogo cat_servicios → users.cargo).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_nombre VARCHAR(160);

COMMENT ON COLUMN users.service_nombre IS 'Nombre libre del servicio donde ejerce (texto); catálogo aparte en users.cargo';
