-- Historial de llamadas / videollamadas / radio privada 1:1
CREATE TABLE IF NOT EXISTS private_call_logs (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  caller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL DEFAULT 'call',
  outcome         TEXT NOT NULL DEFAULT 'completed',
  reason          TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at     TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_sec    INT
);

CREATE INDEX IF NOT EXISTS idx_private_call_logs_org_ended
  ON private_call_logs (organization_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_call_logs_caller
  ON private_call_logs (caller_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_call_logs_target
  ON private_call_logs (target_id, ended_at DESC);
