-- Botón de pánico
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_receive_panic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TYPE panic_status AS ENUM ('active', 'acked', 'resolved', 'cancelled');

CREATE TABLE IF NOT EXISTS panic_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  status          panic_status NOT NULL DEFAULT 'active',
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  accuracy_m      REAL,
  note            TEXT,
  acked_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  acked_at        TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_panic_org_active
  ON panic_events (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panic_user_time
  ON panic_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panic_group
  ON panic_events (group_id, created_at DESC);
