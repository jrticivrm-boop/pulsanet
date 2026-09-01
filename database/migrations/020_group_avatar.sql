-- Icono / foto de canal (grupo PTT / chat)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN groups.avatar_url IS 'Nombre de archivo en uploads/avatars (igual que users.avatar_url)';
