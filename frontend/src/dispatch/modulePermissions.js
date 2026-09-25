/**
 * Permisos de módulos/pestañas desde session.user.modules (access_profiles).
 * Root: acceso total (perfil inamovible).
 * Sin modules en sesión: fallback legacy por rol (no romper consolas antiguas).
 */

export function isRootRole(user) {
  return user?.role === 'root';
}

export function getUserModules(user) {
  const m = user?.modules;
  return m && typeof m === 'object' ? m : null;
}

/** ¿Tiene el JSON de módulos en sesión? */
export function hasModulesPayload(user) {
  const m = getUserModules(user);
  return Boolean(m && Object.keys(m).length);
}

function legacyView(user, moduleKey) {
  const role = user?.role;
  const isAdmin = ['root', 'region_admin', 'admin', 'zone_admin', 'unit_admin'].includes(role);
  switch (moduleKey) {
    case 'video':
      return role === 'root';
    case 'usuarios':
    case 'grupos':
    case 'avisos':
    case 'catalogos':
    case 'configuracion':
      return isAdmin;
    case 'mapa':
    case 'panico':
      return true;
    default:
      return isAdmin;
  }
}

export function canViewModule(user, moduleKey) {
  if (!user) return false;
  /* RESERVADO: solo Administrador (root), no se configura en perfiles. */
  if (moduleKey === 'video') return isRootRole(user);
  if (isRootRole(user)) return true;
  if (!hasModulesPayload(user)) return legacyView(user, moduleKey);
  return Boolean(getUserModules(user)[moduleKey]?.ver);
}

export function canModuleAction(user, moduleKey, action) {
  if (!user) return false;
  if (moduleKey === 'video') return isRootRole(user);
  if (action === 'ver') return canViewModule(user, moduleKey);
  if (isRootRole(user)) return true;
  if (!canViewModule(user, moduleKey)) return false;
  if (!hasModulesPayload(user)) {
    // Legacy: admins pueden CRUD salvo config eliminar
    const isAdmin = ['root', 'region_admin', 'admin', 'zone_admin', 'unit_admin'].includes(
      user.role
    );
    if (!isAdmin) return false;
    if (moduleKey === 'configuracion' && (action === 'agregar' || action === 'eliminar')) {
      return false;
    }
    return true;
  }
  return Boolean(getUserModules(user)[moduleKey]?.[action]);
}

export function canViewTab(user, moduleKey, tabKey) {
  if (!canViewModule(user, moduleKey)) return false;
  if (isRootRole(user)) return true;
  if (!hasModulesPayload(user)) return true;
  const tabs = getUserModules(user)[moduleKey]?.tabs;
  if (!tabs || typeof tabs !== 'object') return true;
  if (!Object.prototype.hasOwnProperty.call(tabs, tabKey)) return true;
  return Boolean(tabs[tabKey]);
}

/**
 * Filtra defs de pestaña `{ key, to, label, ... }` según permiso.
 * `tabKey` = def.permKey || def.key || último segmento de `to`.
 */
export function filterTabsByPermission(user, moduleKey, tabDefs) {
  if (!Array.isArray(tabDefs)) return [];
  return tabDefs.filter((t) => {
    const tabKey =
      t.permKey ||
      t.key ||
      String(t.to || '')
        .split('/')
        .filter(Boolean)
        .pop();
    if (moduleKey === 'video' && (t.to === '/despacho/video' || t.end)) {
      return canViewTab(user, moduleKey, 'video');
    }
    return canViewTab(user, moduleKey, tabKey);
  });
}

/** ¿Mostrar ítem Administración en el rail? */
export function canViewAdminRail(user) {
  return (
    canViewModule(user, 'usuarios') ||
    canViewModule(user, 'grupos') ||
    canViewModule(user, 'avisos')
  );
}

/** Primera ruta permitida de una lista, o fallback. */
export function firstAllowedPath(paths, fallback) {
  const list = (paths || []).filter(Boolean);
  return list[0] || fallback;
}
