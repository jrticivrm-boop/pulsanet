-- Efectivos del servicio desplegado (capturados en Usuarios): personal, vehículos y armamento.
-- Solo consulta (relación de usuarios / Excel). NULL = sin capturar.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_personal INTEGER,
  ADD COLUMN IF NOT EXISTS service_vehiculos INTEGER,
  ADD COLUMN IF NOT EXISTS service_armamento INTEGER;
