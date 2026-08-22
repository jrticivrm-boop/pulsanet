-- Login por usuario tipo RFC (4 letras + YYMMDD). Email queda opcional / legado.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(20);

-- Relleno desde parte local del email (op1@… → OP1) para filas existentes
UPDATE users
SET username = UPPER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^A-Za-z0-9]', '', 'g'))
WHERE username IS NULL OR BTRIM(username) = '';

-- Evitar vacíos tras backfill
UPDATE users
SET username = UPPER(REPLACE(id::text, '-', ''))
WHERE username IS NULL OR BTRIM(username) = '';

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_organization_id_username_key'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_organization_id_username_key UNIQUE (organization_id, username);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Email deja de ser obligatorio (el login usa username)
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;
