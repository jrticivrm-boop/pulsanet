-- Ubicación de referencia del servicio (coordenadas capturadas en Usuarios) y datos extraídos de ella.
-- Solo consulta (relación de usuarios / Excel): no interviene en la ubicación en tiempo real.
-- Nombres service_geo_* distintos de los que retira 048 (que se reaplica en cada arranque).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS service_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS service_geo_estado VARCHAR(80),
  ADD COLUMN IF NOT EXISTS service_geo_municipio VARCHAR(160),
  ADD COLUMN IF NOT EXISTS service_geo_localidad VARCHAR(200),
  ADD COLUMN IF NOT EXISTS service_geo_colonia VARCHAR(200),
  ADD COLUMN IF NOT EXISTS service_geo_cp VARCHAR(10),
  ADD COLUMN IF NOT EXISTS service_geo_ejido VARCHAR(200);
