-- Preferencias UI por usuario (pliegues de catálogos, etc.)
-- Colores de unidad territorial por organización (consola / mapa).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ui_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.ui_prefs IS
  'Preferencias de interfaz por usuario (p. ej. pliegues de Catálogos → Territorio). No es localStorage.';

CREATE TABLE IF NOT EXISTS cat_territory_unit_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zona_key VARCHAR(32) NOT NULL DEFAULT '',
  unidad_name VARCHAR(120) NOT NULL,
  color VARCHAR(7) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cat_territory_unit_colors_uniq
  ON cat_territory_unit_colors (organization_id, zona_key, unidad_name);

CREATE INDEX IF NOT EXISTS idx_cat_territory_unit_colors_org
  ON cat_territory_unit_colors (organization_id);

COMMENT ON TABLE cat_territory_unit_colors IS
  'Color de relleno por unidad (zona_key + nombre) para el mapa Territorio de la consola.';

-- Clave de cobertura: zona|unidad|estado|municipio (misma unidad en dos zonas no choca).
DROP INDEX IF EXISTS cat_territory_coverage_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS cat_territory_coverage_uniq
  ON cat_territory_coverage (organization_id, zona_key, unidad_name, estado, municipio);
