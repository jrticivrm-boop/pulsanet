-- Eventos de operador (lenguaje claro): geocerca, cuenta, etc.
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,
  summary TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_subject_time
  ON user_events (organization_id, subject_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_kind_time
  ON user_events (organization_id, kind, created_at DESC);

COMMENT ON TABLE user_events IS 'Historial legible por operador (enter/exit geocerca, alta/baja cuenta, …)';
