-- Efectivos del servicio desplegado (capturados en Usuarios): personal, vehículos y armamento.
-- Texto libre (ej. «2 Oficiales, 15 Tropa»). Solo consulta (relación de usuarios / Excel). NULL = sin capturar.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_personal VARCHAR(300),
  ADD COLUMN IF NOT EXISTS service_vehiculos VARCHAR(300),
  ADD COLUMN IF NOT EXISTS service_armamento VARCHAR(300);

-- Primera versión (solo desarrollo) las creó INTEGER.
ALTER TABLE users
  ALTER COLUMN service_personal TYPE VARCHAR(300) USING service_personal::text,
  ALTER COLUMN service_vehiculos TYPE VARCHAR(300) USING service_vehiculos::text,
  ALTER COLUMN service_armamento TYPE VARCHAR(300) USING service_armamento::text;
