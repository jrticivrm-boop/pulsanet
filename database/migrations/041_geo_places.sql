-- Catálogo propio de lugares para la pestaña «Buscar» del mapa (consola web).
-- Hoy: núcleos agrarios del RAN (ejidos y comunidades), cargados con
-- backend/src/scripts/load-ran-ejidos.js. No depende de la organización.
CREATE TABLE IF NOT EXISTS geo_places (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(16) NOT NULL,
  source_key VARCHAR(80) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  name VARCHAR(200) NOT NULL,
  municipality VARCHAR(160),
  state VARCHAR(80),
  name_norm TEXT NOT NULL DEFAULT '',
  search_norm TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  min_lat DOUBLE PRECISION,
  min_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  outline JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_key)
);

CREATE INDEX IF NOT EXISTS idx_geo_places_bbox
  ON geo_places (min_lat, max_lat, min_lng, max_lng);
