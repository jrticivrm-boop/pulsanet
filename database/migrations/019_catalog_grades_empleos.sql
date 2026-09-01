-- Catálogos editables: grados militares y empleos (forma ParqueVehicular)

CREATE TABLE IF NOT EXISTS cat_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  abbreviation VARCHAR(40) NOT NULL,
  category VARCHAR(40),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, abbreviation)
);

CREATE INDEX IF NOT EXISTS idx_cat_grades_org
  ON cat_grades (organization_id, sort_order, name);

CREATE TABLE IF NOT EXISTS cat_empleos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cat_empleos_org
  ON cat_empleos (organization_id, sort_order, name);

COMMENT ON TABLE cat_grades IS 'Grados (indicativo al aire); abbreviation → users.grade';
COMMENT ON TABLE cat_empleos IS 'Empleos / especialidades de catálogo; name → users.specialty';
