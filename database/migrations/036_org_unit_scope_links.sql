-- Vínculos de alcance: una zona "anfitriona" ve otras zonas/unidades
-- como si fueran organismos propios (sin cambiar parent_id).
-- Ej.: 8/a. Z.M. ve 23/a. y 29/a. Coord. Unidad (+ sus organismos).

CREATE TABLE IF NOT EXISTS org_unit_scope_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  host_zone_id    UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  linked_id       UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (host_zone_id, linked_id),
  CHECK (host_zone_id <> linked_id)
);

CREATE INDEX IF NOT EXISTS idx_org_scope_links_host
  ON org_unit_scope_links (organization_id, host_zone_id);
CREATE INDEX IF NOT EXISTS idx_org_scope_links_linked
  ON org_unit_scope_links (linked_id);

COMMENT ON TABLE org_unit_scope_links IS
  'Zona anfitriona incluye linked_id (zona o unidad) y descendientes en su alcance operativo';
