-- Cabecera de cada municipio (pestaña «Buscar» del mapa): el pin de un municipio va a su
-- cabecera y no al centro geométrico del polígono (que puede caer en lagunas o despoblado).
-- Centro comercial de la localidad 0001 (cabecera, clave INEGI) según el DENUE.
-- Se llena con backend/src/scripts/load-mx-postcodes.js.
CREATE TABLE IF NOT EXISTS mx_cabeceras (
  c_estado SMALLINT NOT NULL,
  c_mnpio SMALLINT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (c_estado, c_mnpio)
);
