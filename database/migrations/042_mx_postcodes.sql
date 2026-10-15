-- Códigos postales de México para la pestaña «Buscar» del mapa (consola web).
-- Sustituyen al C.P. que calcula OpenStreetMap (suele ser el de la colonia o ciudad vecina).
-- Se llenan con backend/src/scripts/load-mx-postcodes.js.

-- Catálogo oficial de Correos de México (SEPOMEX): un renglón por asentamiento.
CREATE TABLE IF NOT EXISTS mx_postcodes (
  id BIGSERIAL PRIMARY KEY,
  cp CHAR(5) NOT NULL,
  asentamiento VARCHAR(200) NOT NULL,
  tipo VARCHAR(60),
  municipio VARCHAR(160) NOT NULL,
  estado VARCHAR(80) NOT NULL,
  ciudad VARCHAR(160),
  c_estado SMALLINT NOT NULL,
  c_mnpio SMALLINT NOT NULL,
  zona VARCHAR(20),
  asenta_norm TEXT NOT NULL,
  mnpio_norm TEXT NOT NULL,
  ciudad_norm TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_mx_postcodes_cp ON mx_postcodes (cp);
CREATE INDEX IF NOT EXISTS idx_mx_postcodes_mnpio ON mx_postcodes (c_estado, mnpio_norm);
CREATE INDEX IF NOT EXISTS idx_mx_postcodes_ciudad ON mx_postcodes (c_estado, ciudad_norm);

-- C.P. por ubicación: establecimientos del DENUE (INEGI) agrupados en celdas de ~110 m
-- (lat/lng × 1000 redondeado). Solo C.P. que existen en SEPOMEX para ese estado.
CREATE TABLE IF NOT EXISTS mx_postcode_grid (
  lat_i INTEGER NOT NULL,
  lng_i INTEGER NOT NULL,
  cp CHAR(5) NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (lat_i, lng_i, cp)
);

CREATE INDEX IF NOT EXISTS idx_mx_postcode_grid_cp ON mx_postcode_grid (cp);
