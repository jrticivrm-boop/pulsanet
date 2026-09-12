-- Icono PNG/JPG por agrupación (todos los puntos de la agrupación lo usan en mapa)

ALTER TABLE tactical_site_groups
  ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500);

COMMENT ON COLUMN tactical_site_groups.icon_url IS
  'Ruta relativa de icono de mapa para todos los puntos de la agrupación';

-- Si había iconos por punto, toma el primero no nulo de cada grupo (migración suave)
UPDATE tactical_site_groups g
SET icon_url = s.icon_url, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (group_id) group_id, icon_url
  FROM tactical_sites
  WHERE icon_url IS NOT NULL AND is_active
  ORDER BY group_id, updated_at DESC NULLS LAST, created_at DESC
) s
WHERE g.id = s.group_id
  AND g.icon_url IS NULL
  AND s.icon_url IS NOT NULL;

-- Dejar de usar icono por punto
ALTER TABLE tactical_sites DROP COLUMN IF EXISTS icon_url;
