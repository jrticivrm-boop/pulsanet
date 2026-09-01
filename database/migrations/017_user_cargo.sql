-- Cargo / puesto (indicativo al aire) separado de especialidad militar.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cargo VARCHAR(120);

-- Datos previos: specialty se usaba como cargo en el indicativo.
UPDATE users
SET cargo = specialty
WHERE cargo IS NULL AND specialty IS NOT NULL AND TRIM(specialty) <> '';
