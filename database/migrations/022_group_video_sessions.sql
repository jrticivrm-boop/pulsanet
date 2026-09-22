-- Auditoría de transmisiones de video grupal (sala gvid_* paralela al PTT)
CREATE TABLE IF NOT EXISTS group_video_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  livekit_room    TEXT NOT NULL,
  started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  peak_participants INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_group_video_sessions_group
  ON group_video_sessions (group_id, started_at DESC);
