-- Revertir Estado/Municipio de servicio (experimento): no se usan.
-- Conserva users.cargo (catálogo) y users.service_nombre (texto libre).

ALTER TABLE users DROP COLUMN IF EXISTS service_estado;
ALTER TABLE users DROP COLUMN IF EXISTS service_municipio;
