-- Efectivos del servicio desplegado (capturados en Usuarios). Solo consulta (relación de usuarios / Excel).
-- Personal por categoría (Grals., Jefes, Ofs., Tpa.); vehículos y armamento en texto libre. NULL = sin capturar.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_personal_grals INTEGER,
  ADD COLUMN IF NOT EXISTS service_personal_jefes INTEGER,
  ADD COLUMN IF NOT EXISTS service_personal_ofs INTEGER,
  ADD COLUMN IF NOT EXISTS service_personal_tpa INTEGER,
  ADD COLUMN IF NOT EXISTS service_vehiculos VARCHAR(300),
  ADD COLUMN IF NOT EXISTS service_armamento VARCHAR(300);

-- Versiones previas (solo desarrollo): vehículos/armamento INTEGER y personal en una sola columna.
ALTER TABLE users
  ALTER COLUMN service_vehiculos TYPE VARCHAR(300) USING service_vehiculos::text,
  ALTER COLUMN service_armamento TYPE VARCHAR(300) USING service_armamento::text,
  DROP COLUMN IF EXISTS service_personal;
