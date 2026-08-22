-- Grabaciones PTT (v1.4)
CREATE TABLE IF NOT EXISTS ptt_recordings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    mime_type       VARCHAR(80) NOT NULL DEFAULT 'audio/webm',
    byte_size       INT,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptt_recordings_group_time
  ON ptt_recordings (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptt_recordings_org_time
  ON ptt_recordings (organization_id, created_at DESC);
