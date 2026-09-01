-- Admin de unidad + privilegios de visibilidad radio/despacho
-- Región (admin/root) = maestro · Zona = sus unidades · Unidad = sus usuarios/canales

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'unit_admin';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_see_region BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_see_zones BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_see_units BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.can_see_region IS 'Privilegio: ver/oir toda la Región (todos los canales)';
COMMENT ON COLUMN users.can_see_zones IS 'Privilegio: ver/oir zonas (alcance de zona o todas si región)';
COMMENT ON COLUMN users.can_see_units IS 'Privilegio: ver/oir unidades (propia o del alcance)';
COMMENT ON COLUMN users.admin_scope_unit_id IS 'zone_admin: zona; unit_admin: unidad que administra';

-- Defaults por rol existente
UPDATE users SET
  can_see_region = TRUE,
  can_see_zones = TRUE,
  can_see_units = TRUE
WHERE role IN ('root', 'admin');

UPDATE users SET
  can_see_region = FALSE,
  can_see_zones = TRUE,
  can_see_units = TRUE
WHERE role = 'zone_admin';

UPDATE users SET
  can_see_region = FALSE,
  can_see_zones = FALSE,
  can_see_units = TRUE
WHERE role = 'unit_admin';
