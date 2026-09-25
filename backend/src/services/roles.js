/** Roles jerárquicos SICOM: Administrador + Región / Zona / Unidad (admin y usuario). */

export const ORG_ROLES = [
  'root',
  'region_admin',
  'region_user',
  'zone_admin',
  'zone_user',
  'unit_admin',
  'unit_user',
];

/** Valores antiguos aceptados en entrada y filas aún no migradas. */
const ROLE_ALIAS = {
  admin: 'region_admin',
  dispatcher: 'region_user',
  operator: 'unit_user',
};

export const ROLE_LABELS = {
  root: 'Administrador',
  region_admin: 'Administrador de región',
  region_user: 'Usuario de región',
  zone_admin: 'Administrador de zona',
  zone_user: 'Usuario de zona',
  unit_admin: 'Administrador de unidad',
  unit_user: 'Usuario de unidad',
};

export function normalizeRole(role) {
  const raw = String(role || '').trim();
  return ROLE_ALIAS[raw] || raw;
}

export function isKnownRole(role) {
  return ORG_ROLES.includes(normalizeRole(role));
}

export function isRoot(role) {
  return normalizeRole(role) === 'root';
}

export function isRegionAdmin(role) {
  return normalizeRole(role) === 'region_admin';
}

export function isZoneAdmin(role) {
  return normalizeRole(role) === 'zone_admin';
}

export function isUnitAdmin(role) {
  return normalizeRole(role) === 'unit_admin';
}

/** Maestro o administrador de región (gestión amplia de la org / región). */
export function isAdmin(role) {
  const r = normalizeRole(role);
  return r === 'root' || r === 'region_admin';
}

export function isUserProfile(role) {
  const r = normalizeRole(role);
  return r === 'region_user' || r === 'zone_user' || r === 'unit_user';
}

/** Consola web: solo administradores. Ningún perfil Usuario. */
export function isDispatch(role) {
  const r = normalizeRole(role);
  return r === 'root' || r === 'region_admin' || r === 'zone_admin' || r === 'unit_admin';
}

export function canManageUsers(role) {
  return isDispatch(role);
}

export function canManageProfiles(role) {
  return isRoot(role);
}

/** Puede elegir nivel de ubicación. Alcance 3: nadie oculta ni ajusta share. */
export function canChooseLocationShare(_role) {
  return false;
}

export function isModerator(role) {
  return isDispatch(role);
}

export function roleLevel(role) {
  const r = normalizeRole(role);
  if (r === 'root' || r === 'region_admin' || r === 'region_user') return 'region';
  if (r === 'zone_admin' || r === 'zone_user') return 'zone';
  return 'unit';
}

/**
 * Quién puede dar de alta qué rol (solo hacia abajo, no pares ni superiores).
 * root → cualquiera (incluido root).
 * Admin región → region_user, zona y unidad (no otro region_admin ni root).
 * Admin zona → zone_user y unidad (no otro zone_admin).
 * Admin unidad → solo unit_user.
 */
export function canAssignRole(actorRole, targetRole) {
  const a = normalizeRole(actorRole);
  const t = normalizeRole(targetRole);
  if (!ORG_ROLES.includes(t)) return false;
  if (t === 'root') return a === 'root';
  if (a === 'root') return true;
  if (a === 'region_admin') {
    return (
      t === 'region_user' ||
      t === 'zone_admin' ||
      t === 'zone_user' ||
      t === 'unit_admin' ||
      t === 'unit_user'
    );
  }
  if (a === 'zone_admin') {
    return t === 'zone_user' || t === 'unit_admin' || t === 'unit_user';
  }
  if (a === 'unit_admin') return t === 'unit_user';
  return false;
}

export function defaultLocationShare(role) {
  const r = normalizeRole(role);
  if (r === 'region_admin') return 'region';
  if (r === 'zone_admin') return 'zone';
  if (r === 'unit_admin') return 'unit';
  return 'peers';
}

export function shareOptionsForRole(role) {
  // Alcance 3: sin selector de compartir / ocultar ubicación.
  return [];
}

export function defaultVisibilityFlags(role) {
  const r = normalizeRole(role);
  if (r === 'root' || r === 'region_admin') {
    return { canSeeRegion: true, canSeeZones: true, canSeeUnits: true };
  }
  if (r === 'zone_admin') {
    return { canSeeRegion: false, canSeeZones: true, canSeeUnits: true };
  }
  if (r === 'unit_admin') {
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
