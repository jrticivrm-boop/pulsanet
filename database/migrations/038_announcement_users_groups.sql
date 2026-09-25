-- Avisos: destinatarios por usuarios específicos o canales/grupos.

ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_audience_check;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_audience_check
  CHECK (audience IN ('org', 'zone', 'unit', 'admins', 'users', 'groups'));

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN announcements.target_ids IS
  'IDs de usuarios (audience=users) o grupos/canales (audience=groups)';
