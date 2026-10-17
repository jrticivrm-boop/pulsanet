-- Catálogo de servicios (ex-cargo libre) + lugar donde ejerce (estado/municipio).
-- users.cargo sigue guardando el nombre del servicio seleccionado (texto).
-- La unidad de ejercicio es users.unit_id (mismo que Alcance); no hay columna nueva.

CREATE TABLE IF NOT EXISTS cat_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cat_servicios_org
  ON cat_servicios (organization_id, sort_order, name);

COMMENT ON TABLE cat_servicios IS 'Servicios / puestos de catálogo; name → users.cargo';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_estado VARCHAR(80);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_municipio VARCHAR(160);

COMMENT ON COLUMN users.service_estado IS 'Estado (República) donde ejerce el servicio';
COMMENT ON COLUMN users.service_municipio IS 'Municipio donde ejerce el servicio (ligado al estado)';
