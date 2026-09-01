-- Jerarquía operativa: Región → zona (C.G. / Z.M.) → unidad
-- + rol zone_admin (admin de una zona: alta/baja usuarios y privilegios en su alcance)

DO $$ BEGIN
  CREATE TYPE org_unit_kind AS ENUM ('region', 'zone', 'unit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_zone_type AS ENUM ('cg', 'zm', 'support');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'zone_admin';

CREATE TABLE IF NOT EXISTS org_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES org_units(id) ON DELETE CASCADE,
  kind            org_unit_kind NOT NULL,
  zone_type       org_zone_type,
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(40) NOT NULL,
  external_id     INT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_units_org ON org_units (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON org_units (parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_kind ON org_units (organization_id, kind);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_scope_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_unit ON users (unit_id);
CREATE INDEX IF NOT EXISTS idx_users_admin_scope ON users (admin_scope_unit_id);

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_groups_unit ON groups (unit_id);

COMMENT ON TABLE org_units IS 'Árbol Región → zona (C.G./Z.M./apoyo) → unidad operativa';
COMMENT ON COLUMN users.unit_id IS 'Unidad de adscripción (despliegue / patrullaje)';
COMMENT ON COLUMN users.admin_scope_unit_id IS 'Para zone_admin: zona que administra';
COMMENT ON COLUMN groups.unit_id IS 'Canal PTT ligado a una unidad (opcional)';
