-- Efectivos del servicio desplegado (capturados en Usuarios, paso «Efectivos»). Solo consulta (relación / Excel).
-- Catálogo por organización agrupado (Personal, Armamento, Vehs. S/B., Vehs. C/B., Otros); cada grupo admite
-- anexar más conceptos. Las cantidades por usuario van en users.service_efectivos: { "<cat_efectivos.id>": n }.
CREATE TABLE IF NOT EXISTS cat_efectivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grupo VARCHAR(20) NOT NULL CHECK (grupo IN ('personal', 'armamento', 'vehs_sb', 'vehs_cb', 'otros')),
  name VARCHAR(60) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, grupo, name)
);

CREATE INDEX IF NOT EXISTS idx_cat_efectivos_org ON cat_efectivos (organization_id, grupo, sort_order, name);

INSERT INTO cat_efectivos (organization_id, grupo, name, sort_order)
SELECT o.id, d.grupo, d.name, d.sort_order
FROM organizations o
CROSS JOIN (VALUES
  ('personal', 'GG.', 10), ('personal', 'JJ.', 20), ('personal', 'OO.', 30), ('personal', 'TT.', 40),
  ('armamento', 'Fx.', 10), ('armamento', 'G-3', 20), ('armamento', 'Adit. L.G.', 30),
  ('vehs_sb', 'Cheyenne', 10), ('vehs_sb', 'Humvee', 20), ('vehs_sb', 'Sandkat', 30),
  ('vehs_cb', 'Cheyenne', 10), ('vehs_cb', 'Humvee', 20), ('vehs_cb', 'Sandkat', 30),
  ('otros', 'Cams.', 10), ('otros', 'Anti dron fijo', 20), ('otros', 'Antidron semifijo', 30), ('otros', 'Dron', 40)
) AS d(grupo, name, sort_order)
ON CONFLICT (organization_id, grupo, name) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS service_efectivos JSONB;

-- Versiones previas (solo desarrollo, nunca en producción): columnas sueltas por concepto.
ALTER TABLE users
  DROP COLUMN IF EXISTS service_personal,
  DROP COLUMN IF EXISTS service_personal_grals,
  DROP COLUMN IF EXISTS service_personal_jefes,
  DROP COLUMN IF EXISTS service_personal_ofs,
  DROP COLUMN IF EXISTS service_personal_tpa,
  DROP COLUMN IF EXISTS service_vehiculos,
  DROP COLUMN IF EXISTS service_armamento,
  DROP COLUMN IF EXISTS service_camaras,
  DROP COLUMN IF EXISTS service_drones,
  DROP COLUMN IF EXISTS service_antidrones;
