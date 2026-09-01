/** Roles de organización y helpers de autorización */

export const ORG_ROLES = [
  'root',
  'admin',
  'zone_admin',
  'unit_admin',
  'dispatcher',
  'operator',
];

export function isRoot(role) {
  return role === 'root';
}

/** Admin de zona (usuarios y unidades de su zona) */
export function isZoneAdmin(role) {
  return role === 'zone_admin';
}

/** Admin de unidad (solo usuarios/canales de su unidad) */
export function isUnitAdmin(role) {
  return role === 'unit_admin';
}

/** Admin de org o root (Región / maestro) */
export function isAdmin(role) {
  return role === 'root' || role === 'admin';
}

/** Puede administrar usuarios (org, zona o unidad) */
export function canManageUsers(role) {
  return isAdmin(role) || isZoneAdmin(role) || isUnitAdmin(role);
}

/** Consola despacho / overview / mapa (con alcance según rol) */
export function isDispatch(role) {
  return (
    role === 'root' ||
    role === 'admin' ||
    role === 'zone_admin' ||
    role === 'unit_admin' ||
    role === 'dispatcher'
  );
}

/** Moderar mensajes ajenos, pánico por rol, etc. */
export function isModerator(role) {
  return isDispatch(role);
}

/** Privilegios de visibilidad por defecto según rol. */
export function defaultVisibilityFlags(role) {
  if (isAdmin(role)) {
    return { canSeeRegion: true, canSeeZones: true, canSeeUnits: true };
  }
  if (isZoneAdmin(role)) {
    return { canSeeRegion: false, canSeeZones: true, canSeeUnits: true };
  }
  if (isUnitAdmin(role)) {
    return { canSeeRegion: false, canSeeZones: false, canSeeUnits: true };
  }
  return { canSeeRegion: false, canSeeZones: false, canSeeUnits: false };
}

export function requireRole(pred, message = 'Sin permiso') {
  return (req, res, next) => {
    if (!pred(req.user?.role)) {
      return res.status(403).json({ ok: false, error: message });
    }
    next();
  };
}
