-- Abreviatura correcta de Mayor: Myr. (no May.)
UPDATE cat_grades
SET abbreviation = 'Myr.', updated_at = NOW()
WHERE name = 'Mayor' AND abbreviation = 'May.';

UPDATE users
SET grade = 'Myr.', updated_at = NOW()
WHERE LOWER(TRIM(grade)) = 'may.';
