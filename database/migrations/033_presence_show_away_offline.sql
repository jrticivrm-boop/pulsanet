-- Semáforo de presencia: qué colores intermedios mostrar (amarillo / gris).
-- false = fusionar: away→online, offline→stale (rojo). Verde y rojo siempre existen.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS presence_show_away BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS presence_show_offline BOOLEAN NOT NULL DEFAULT TRUE;
