-- Geocercas circulares (v1.3)
CREATE TABLE IF NOT EXISTS geofences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    center_lat      DOUBLE PRECISION NOT NULL,
    center_lng      DOUBLE PRECISION NOT NULL,
    radius_m        REAL NOT NULL CHECK (radius_m > 0 AND radius_m <= 50000),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_org ON geofences (organization_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS geofence_presence (
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inside      BOOLEAN NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (geofence_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_presence_user ON geofence_presence (user_id);
