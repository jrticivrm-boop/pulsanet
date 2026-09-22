-- Color de geocerca en mapa (hex), mismo criterio que sitios tácticos.
ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS color VARCHAR(16) NOT NULL DEFAULT '#243d20';

COMMENT ON COLUMN geofences.color IS
  'Color del círculo en mapa (hex #RRGGBB). Por defecto oliva usado históricamente en Consola.';
