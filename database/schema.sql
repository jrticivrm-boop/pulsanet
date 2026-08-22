-- PulsaNet — Esquema PostgreSQL v1
-- Ejecutar: psql -U postgres -d pulsanet_db -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Organización (v1: una sola; v2 multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(80)  NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('root', 'admin', 'dispatcher', 'operator');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    username        VARCHAR(20) NOT NULL,
    email           VARCHAR(255),
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    role            user_role NOT NULL DEFAULT 'operator',
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    can_receive_panic BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, username),
    UNIQUE (organization_id, email)
);

CREATE INDEX idx_users_username ON users (username);

CREATE INDEX idx_users_org ON users (organization_id);
CREATE INDEX idx_users_active ON users (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- Grupos (canales PTT)
-- ---------------------------------------------------------------------------
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    livekit_room    VARCHAR(120) NOT NULL UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    max_members     INT NOT NULL DEFAULT 500,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_org ON groups (organization_id);

-- ---------------------------------------------------------------------------
-- Miembros de grupo
-- ---------------------------------------------------------------------------
CREATE TYPE group_member_role AS ENUM ('leader', 'member', 'listen_only');

CREATE TABLE group_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        group_member_role NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);

-- ---------------------------------------------------------------------------
-- Dispositivos (push notifications)
-- ---------------------------------------------------------------------------
CREATE TYPE device_platform AS ENUM ('android', 'ios', 'web');

CREATE TABLE devices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform    device_platform NOT NULL,
    fcm_token   TEXT NOT NULL,
    device_name VARCHAR(120),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fcm_token)
);

-- ---------------------------------------------------------------------------
-- Mensajes (chat)
-- ---------------------------------------------------------------------------
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'audio', 'sticker', 'location', 'system');

CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type        message_type NOT NULL DEFAULT 'text',
    body        TEXT,
    media_url   TEXT,
    media_mime  VARCHAR(120),
    media_name  VARCHAR(255),
    media_size  INT,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    edited_at   TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT messages_target CHECK (
        (group_id IS NOT NULL AND recipient_id IS NULL)
        OR (group_id IS NULL AND recipient_id IS NOT NULL AND sender_id IS NOT NULL)
    )
);

CREATE INDEX idx_messages_group ON messages (group_id, created_at DESC);
CREATE INDEX idx_messages_dm ON messages (sender_id, recipient_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Reacciones a mensajes
-- ---------------------------------------------------------------------------
CREATE TABLE message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_reactions_msg ON message_reactions (message_id);

-- ---------------------------------------------------------------------------
-- Lecturas de mensajes (ticks)
-- ---------------------------------------------------------------------------
CREATE TABLE message_reads (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_reads_user ON message_reads (user_id, read_at DESC);

-- ---------------------------------------------------------------------------
-- Ubicaciones (tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    accuracy_m  REAL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_user_time ON locations (user_id, recorded_at DESC);

-- Vista: última ubicación por usuario
CREATE OR REPLACE VIEW user_last_location AS
SELECT DISTINCT ON (user_id)
    user_id, latitude, longitude, accuracy_m, recorded_at
FROM locations
ORDER BY user_id, recorded_at DESC;

-- ---------------------------------------------------------------------------
-- Geocercas (círculos)
-- ---------------------------------------------------------------------------
CREATE TABLE geofences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    center_lat      DOUBLE PRECISION NOT NULL,
    center_lng      DOUBLE PRECISION NOT NULL,
    radius_m        REAL NOT NULL CHECK (radius_m > 0 AND radius_m <= 50000),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofences_org ON geofences (organization_id) WHERE is_active;

CREATE TABLE geofence_presence (
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inside      BOOLEAN NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (geofence_id, user_id)
);

CREATE INDEX idx_geofence_presence_user ON geofence_presence (user_id);

-- ---------------------------------------------------------------------------
-- Sesiones PTT (auditoría)
-- ---------------------------------------------------------------------------
CREATE TABLE ptt_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    duration_ms INT GENERATED ALWAYS AS (
        CASE WHEN ended_at IS NOT NULL
        THEN (EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000)::INT
        ELSE NULL END
    ) STORED
);

CREATE INDEX idx_ptt_sessions_group ON ptt_sessions (group_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- Grabaciones PTT
-- ---------------------------------------------------------------------------
CREATE TABLE ptt_recordings (
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

CREATE INDEX idx_ptt_recordings_group_time ON ptt_recordings (group_id, created_at DESC);
CREATE INDEX idx_ptt_recordings_org_time ON ptt_recordings (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Refresh tokens
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Eventos de pánico (SOS)
-- ---------------------------------------------------------------------------
CREATE TYPE panic_status AS ENUM ('active', 'acked', 'resolved', 'cancelled');

CREATE TABLE panic_events (
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

CREATE INDEX idx_panic_org_active ON panic_events (organization_id, status, created_at DESC);
CREATE INDEX idx_panic_user_time ON panic_events (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Activity logs (auditoría)
-- ---------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(64) NOT NULL,
    entity_type     VARCHAR(64),
    entity_id       UUID,
    meta            JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_org_time ON activity_logs (organization_id, created_at DESC);
CREATE INDEX idx_activity_logs_actor ON activity_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Datos semilla (desarrollo)
-- ---------------------------------------------------------------------------
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organización', 'org');

-- Superadmin: crear con `npm run seed` en backend (contraseña temporal, cambio en 1er ingreso)

COMMENT ON TABLE groups IS 'Cada grupo tiene un livekit_room único para audio PTT';
COMMENT ON TABLE ptt_sessions IS 'Registro de quién habló y cuánto tiempo';
