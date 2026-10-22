-- Cobertura territorial: unidad ↔ municipio (estados/municipios del registro nacional, sin CRUD).
-- region_id permite más regiones además de IV R.M.

CREATE TABLE IF NOT EXISTS cat_territory_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
  region_label VARCHAR(80) NOT NULL DEFAULT 'IV R.M.',
  zona_key VARCHAR(32) NOT NULL,
  zona_short VARCHAR(32) NOT NULL,
  unidad_name VARCHAR(120) NOT NULL,
  estado VARCHAR(80) NOT NULL,
  municipio VARCHAR(120) NOT NULL,
  shape_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cat_territory_coverage_uniq
  ON cat_territory_coverage (organization_id, unidad_name, estado, municipio);

CREATE INDEX IF NOT EXISTS idx_cat_territory_coverage_org_zona
  ON cat_territory_coverage (organization_id, zona_key, unidad_name);

CREATE INDEX IF NOT EXISTS idx_cat_territory_coverage_org_muni
  ON cat_territory_coverage (organization_id, estado, municipio);

COMMENT ON TABLE cat_territory_coverage IS
  'Asignación unidad-municipio para el mapa Territorio. Estados y municipios no se dan de alta aquí.';
