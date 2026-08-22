/** Roles de organización y helpers de autorización */

export const ORG_ROLES = ['root', 'admin', 'dispatcher', 'operator'];

export function isRoot(role) {
  return role === 'root';
}

/** Admin de org o root (crear usuarios, etc.) */
export function isAdmin(role) {
  return role === 'root' || role === 'admin';
}

/** Consola despacho / overview / mapa */
export function isDispatch(role) {
  return role === 'root' || role === 'admin' || role === 'dispatcher';
}

/** Moderar mensajes ajenos, pánico por rol, etc. */
export function isModerator(role) {
  return isDispatch(role);
}

export function requireRole(pred, message = 'Sin permiso') {
  return (req, res, next) => {
    if (!pred(req.user?.role)) {
      return res.status(403).json({ ok: false, error: message });
    }
    next();
  };
}
