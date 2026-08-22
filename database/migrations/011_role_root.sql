-- Rol superadministrador (root): permisos totales en la org
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'root';
