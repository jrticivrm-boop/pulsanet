-- Rutas frecuentes de la pestaña «Ruta» del mapa (compartidas por la organización).
-- points: [{ "name": "...", "detail": "...", "lat": 22.2, "lng": -97.8 }, …] = A, paradas…, B.
CREATE TABLE IF NOT EXISTS saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  points JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_routes_org ON saved_routes (organization_id, name);
