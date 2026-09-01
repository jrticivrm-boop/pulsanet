-- Identidad operativa: grado, especialidad, nombres y matrícula.
-- display_name = indicativo al aire (ej. "Cap. Gomez").

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS grade VARCHAR(40),
  ADD COLUMN IF NOT EXISTS specialty VARCHAR(120),
  ADD COLUMN IF NOT EXISTS given_names VARCHAR(120),
  ADD COLUMN IF NOT EXISTS paternal_surname VARCHAR(80),
  ADD COLUMN IF NOT EXISTS maternal_surname VARCHAR(80),
  ADD COLUMN IF NOT EXISTS matricula VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_matricula
  ON users (organization_id, LOWER(matricula))
  WHERE matricula IS NOT NULL AND TRIM(matricula) <> '';
