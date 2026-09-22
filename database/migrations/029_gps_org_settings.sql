-- Precisión / latido GPS por organización (clientes leen vía /api/me/gps-settings).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gps_max_accuracy_m INTEGER NOT NULL DEFAULT 50;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gps_interval_sec INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_gps_max_accuracy_m_chk'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_gps_max_accuracy_m_chk
      CHECK (gps_max_accuracy_m >= 10 AND gps_max_accuracy_m <= 200);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_gps_interval_sec_chk'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_gps_interval_sec_chk
      CHECK (gps_interval_sec >= 2 AND gps_interval_sec <= 60);
  END IF;
END $$;
