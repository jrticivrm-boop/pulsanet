-- Avisos globales (warning crítico, no chat). Persistidos hasta Enterado.

CREATE TABLE IF NOT EXISTS announcements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  body             TEXT NOT NULL,
  audience         TEXT NOT NULL DEFAULT 'org'
                   CHECK (audience IN ('org', 'zone', 'unit', 'admins')),
  scope_unit_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_admins   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_org_created
  ON announcements (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_recipients (
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user
  ON announcement_recipients (user_id);

CREATE TABLE IF NOT EXISTS announcement_acks (
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_user
  ON announcement_acks (user_id, acked_at DESC);

COMMENT ON TABLE announcements IS
  'Avisos globales tipo warning (no mensajes de chat); requieren Enterado';
COMMENT ON TABLE announcement_recipients IS
  'Destinatarios resueltos al publicar (sync login / Enterado)';
COMMENT ON TABLE announcement_acks IS
  'Confirmación Enterado por usuario/aviso';
