-- Catálogo de jerarquías (Generales, Jefes, Oficiales, Tropa, …)
-- Los grados siguen usando cat_grades.category = nombre de jerarquía.

CREATE TABLE IF NOT EXISTS cat_jerarquias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cat_jerarquias_org
  ON cat_jerarquias (organization_id, sort_order, name);

COMMENT ON TABLE cat_jerarquias IS 'Jerarquías militares; name → cat_grades.category';
