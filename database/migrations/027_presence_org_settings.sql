-- Umbral gris → rojo (minutos sin presencia) por organización.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS presence_offline_red_minutes INTEGER NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_presence_offline_red_minutes_chk'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_presence_offline_red_minutes_chk
      CHECK (presence_offline_red_minutes >= 1 AND presence_offline_red_minutes <= 10080);
  END IF;
END $$;
