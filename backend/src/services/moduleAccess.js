/**
 * Acceso a módulos del perfil (access_profiles.modules) en requests autenticados.
 * req.user.modules viene de bindLiveUser / loadUserProfile.
 * Root: acceso total. Sin payload modules: fallback por rol (compat).
 */
import { isAdmin, isRoot, canManageUsers, isDispatch, normalizeRole } from './roles.js';
import { normalizeModules } from './profiles.js';

function modulesOf(user) {
  const m = user?.modules;
  if (m && typeof m === 'object' && Object.keys(m).length) {
    return normalizeModules(m);
  }
  return null;
}

function legacyAction(user, moduleKey, action) {
  const role = normalizeRole(user?.role);
  if (action === 'ver') {
    if (moduleKey === 'video') return isRoot(role);
    if (['mapa', 'panico'].includes(moduleKey)) return true;
    if (['usuarios', 'grupos', 'avisos', 'catalogos', 'configuracion'].includes(moduleKey)) {
      return canManageUsers(role) || role === 'dispatcher';
    }
    return canManageUsers(role);
  }
  // mutaciones
  if (moduleKey === 'configuracion') {
    if (action === 'editar') return isAdmin(role);
    return false;
  }
  if (moduleKey === 'avisos') {
    return isDispatch(role) && (action === 'agregar' || action === 'ver');
  }
  if (moduleKey === 'catalogos') {
    if (action === 'ver') return canManageUsers(role) || role === 'dispatcher';
    return isAdmin(role);
  }
  if (['usuarios', 'grupos'].includes(moduleKey)) {
    return canManageUsers(role);
  }
  return isAdmin(role);
}

/**
 * @param {object} user req.user
 * @param {string} moduleKey
 * @param {'ver'|'agregar'|'editar'|'eliminar'} action
 */
export function userHasModuleAction(user, moduleKey, action) {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (isRoot(role)) return true;
  /* RESERVADO: solo Administrador (root); no se otorga por perfil. */
  if (moduleKey === 'video') return false;

  const mods = modulesOf(user);
  if (!mods) return legacyAction(user, moduleKey, action);

  const entry = mods[moduleKey];
  if (!entry?.ver) return false;
  if (action === 'ver') return true;
  return Boolean(entry[action]);
}

export function userCanViewModule(user, moduleKey) {
  return userHasModuleAction(user, moduleKey, 'ver');
}

export function userCanViewTab(user, moduleKey, tabKey) {
  if (!userHasModuleAction(user, moduleKey, 'ver')) return false;
  if (isRoot(normalizeRole(user?.role))) return true;
  const mods = modulesOf(user);
  if (!mods) return true;
  const tabs = mods[moduleKey]?.tabs;
  if (!tabs || typeof tabs !== 'object') return true;
  if (!Object.prototype.hasOwnProperty.call(tabs, tabKey)) return true;
  return Boolean(tabs[tabKey]);
}

/**
 * Express middleware: exige acción en un módulo.
 * @param {string} moduleKey
 * @param {'ver'|'agregar'|'editar'|'eliminar'} action
 */
export function requireModuleAction(moduleKey, action) {
  return function moduleActionGuard(req, res, next) {
    if (userHasModuleAction(req.user, moduleKey, action)) return next();
    const labels = {
      ver: 'ver',
      agregar: 'agregar en',
      editar: 'editar',
      eliminar: 'eliminar en',
    };
    return res.status(403).json({
      ok: false,
      error: `Sin permiso para ${labels[action] || action} ${moduleKey}`,
      code: 'MODULE_FORBIDDEN',
      module: moduleKey,
      action,
    });
  };
}

/**
 * Exige ver el módulo y una pestaña concreta (Config / RESERVADO / Catálogos).
 */
export function requireModuleTab(moduleKey, tabKey) {
  return function moduleTabGuard(req, res, next) {
    if (userCanViewTab(req.user, moduleKey, tabKey)) return next();
    return res.status(403).json({
      ok: false,
      error: `Sin permiso para la pestaña «${tabKey}» de ${moduleKey}`,
      code: 'MODULE_TAB_FORBIDDEN',
      module: moduleKey,
      tab: tabKey,
    });
  };
}
