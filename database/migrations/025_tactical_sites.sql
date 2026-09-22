-- Añade ubicación legible + asegura tablas (idempotente)

CREATE TABLE IF NOT EXISTS tactical_site_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#c4a35a',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS tactical_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES tactical_site_groups(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  location_text VARCHAR(400),
  notes TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_m REAL CHECK (radius_m IS NULL OR (radius_m > 0 AND radius_m <= 50000)),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tactical_sites_lat CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT tactical_sites_lng CHECK (longitude >= -180 AND longitude <= 180)
);

ALTER TABLE tactical_sites
  ADD COLUMN IF NOT EXISTS location_text VARCHAR(400);
-- Icono PNG/JPG a nivel de agrupación (los puntos heredan el del grupo)
ALTER TABLE tactical_site_groups
  ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_tactical_site_groups_org
  ON tactical_site_groups (organization_id, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_tactical_sites_org
  ON tactical_sites (organization_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_tactical_sites_group
  ON tactical_sites (group_id, sort_order, name);

COMMENT ON COLUMN tactical_sites.name IS 'Nombre del punto (ej. Antidron B.O. La Ganadera)';
COMMENT ON COLUMN tactical_sites.location_text IS 'Ubicación legible según coords (poblado, municipio, estado)';
COMMENT ON COLUMN tactical_sites.notes IS 'Datos adicionales libres';
COMMENT ON COLUMN tactical_site_groups.icon_url IS 'Ruta relativa del icono PNG/JPG de la agrupación (heredado por todos sus puntos)';
