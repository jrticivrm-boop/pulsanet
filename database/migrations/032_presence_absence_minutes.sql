-- Ausencia (amarillo) + permitir 0 en umbrales (0 = desactivar / rojo inmediato).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS presence_absence_minutes INTEGER NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_presence_offline_red_minutes_chk'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_presence_offline_red_minutes_chk;
  END IF;
END $$;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_presence_offline_red_minutes_chk
  CHECK (presence_offline_red_minutes >= 0 AND presence_offline_red_minutes <= 10080);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_presence_absence_minutes_chk'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_presence_absence_minutes_chk
      CHECK (presence_absence_minutes >= 0 AND presence_absence_minutes <= 10080);
  END IF;
END $$;
