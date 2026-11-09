-- Un estado pertenece a una sola región. Los municipios de cobertura no se borran al quitarlo.

CREATE TABLE IF NOT EXISTS cat_region_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id       UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  estado_id       VARCHAR(8) NOT NULL,
  estado          VARCHAR(80) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cat_region_states_estado_uniq
  ON cat_region_states (organization_id, estado_id);

CREATE INDEX IF NOT EXISTS idx_cat_region_states_region
  ON cat_region_states (organization_id, region_id);

COMMENT ON TABLE cat_region_states IS
  'Estados asignados a una región. Un estado no se repite en dos regiones.';
