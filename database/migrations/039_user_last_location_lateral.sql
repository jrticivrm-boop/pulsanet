-- Última ubicación por usuario sin ordenar toda la tabla locations.
-- Antes: DISTINCT ON sobre locations completa (cientos de miles de filas por consulta).
-- Ahora: una búsqueda por índice idx_locations_user_time (user_id, recorded_at DESC) por usuario.
-- Mismas columnas, tipos y orden: CREATE OR REPLACE es compatible con la vista anterior.
-- locations.user_id tiene FK a users ON DELETE CASCADE, así que partir de users no pierde filas.

CREATE OR REPLACE VIEW user_last_location AS
SELECT u.id AS user_id, l.latitude, l.longitude, l.accuracy_m, l.recorded_at
FROM users u
CROSS JOIN LATERAL (
  SELECT latitude, longitude, accuracy_m, recorded_at
  FROM locations
  WHERE user_id = u.id
  ORDER BY recorded_at DESC
  LIMIT 1
) l;
