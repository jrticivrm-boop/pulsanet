-- TacticalPtx Mes 6: activity_logs (idempotente)
CREATE TABLE IF NOT EXISTS activity_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
 actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(64) NOT NULL,
 entity_type VARCHAR(64),
 entity_id UUID,
 meta JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time
 ON activity_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
 ON activity_logs (actor_id, created_at DESC);

COMMENT ON TABLE activity_logs IS 'Auditoría: login, cambios de usuario/grupo';
