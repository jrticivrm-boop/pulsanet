/** Reglas de grupos por nivel (región / zona / unidad) — membresía geográfica. */
import { normalizeRole, isRoot, isRegionAdmin, isZoneAdmin, isUnitAdmin } from './roles.js';
import { listScopeUnitIds } from './orgUnits.js';

/**
 * ¿La adscripción del usuario cae bajo el ancla del canal?
 * region_* pueden entrar en cualquier canal (admin de región los mete / se meten).
 */
export async function memberFitsGroupGeo(orgId, member, { scopeLevel, unitId: anchorId }) {
  const role = normalizeRole(member?.role);
  const level = scopeLevel || 'unit';
  if (isRoot(role)) return true;
  // Perfiles de región pueden estar en canales de zona/unidad (quien asigna filtra aparte).
  if (role === 'region_admin' || role === 'region_user') return true;

  const uid = member.unit_id || null;
  const sid = member.admin_scope_unit_id || null;

  if (level === 'region') {
    if (!anchorId) return true;
    const ids = new Set(await listScopeUnitIds(orgId, anchorId));
    ids.add(anchorId);
    return (uid && ids.has(uid)) || (sid && ids.has(sid));
  }

  if (level === 'zone') {
    if (!anchorId) return false;
    const ids = new Set(await listScopeUnitIds(orgId, anchorId));
    ids.add(anchorId);
    return (uid && ids.has(uid)) || (sid && ids.has(sid));
  }

  // unit: misma unidad, o admin de zona cuya zona contiene esa unidad
  if (!anchorId) return false;
  if (uid === anchorId || sid === anchorId) return true;
  if (isZoneAdmin(role) && sid) {
    const ids = new Set(await listScopeUnitIds(orgId, sid));
    return ids.has(anchorId);
  }
  return false;
}

/** Compat: sync API previa (solo rol). Preferir memberFitsGroupGeo en rutas async. */
export function memberFitsGroup(memberRole, scopeLevel) {
  const role = normalizeRole(memberRole);
  const level = scopeLevel || 'unit';
  if (isRoot(role)) return true;
  if (role === 'region_admin' || role === 'region_user') return true;
  if (level === 'region') {
    return (
      role === 'zone_admin' ||
      role === 'zone_user' ||
      role === 'unit_admin' ||
      role === 'unit_user'
    );
  }
  if (level === 'zone') {
    return (
      role === 'zone_admin' ||
      role === 'zone_user' ||
      role === 'unit_admin' ||
      role === 'unit_user'
    );
  }
  return role === 'unit_admin' || role === 'unit_user' || role === 'zone_admin';
}

export function groupRejectReason(memberRole, scopeLevel) {
  if (memberFitsGroup(memberRole, scopeLevel)) return null;
  const level = scopeLevel || 'unit';
  const levelLabel =
    level === 'region' ? 'región' : level === 'zone' ? 'zona' : 'unidad';
  return `Esa persona no encaja en un canal de ${levelLabel} (revisa su adscripción y el alcance del grupo).`;
}

export function groupGeoRejectReason() {
  return 'Esa persona no está dentro del alcance orgánico de este canal (región / zona / unidad del grupo).';
}

/**
 * Quién puede agregar a quién: un admin no mete perfiles “más arriba” que él.
 * - Admin de zona: no region_admin / region_user
 * - Admin de unidad: solo unit_admin / unit_user
 */
export function actorCanAssignMember(actorRole, memberRole) {
  const actor = normalizeRole(actorRole);
  const member = normalizeRole(memberRole);
  if (isRoot(actor) || isRegionAdmin(actor)) return true;
  if (isZoneAdmin(actor)) {
    return (
      member === 'zone_admin' ||
      member === 'zone_user' ||
      member === 'unit_admin' ||
      member === 'unit_user'
    );
  }
  if (isUnitAdmin(actor)) {
    return member === 'unit_admin' || member === 'unit_user';
  }
  return false;
}

export function actorAssignRejectReason(actorRole, memberRole) {
  if (actorCanAssignMember(actorRole, memberRole)) return null;
  const actor = normalizeRole(actorRole);
  if (isZoneAdmin(actor)) {
    return 'Como administrador de zona no puedes agregar usuarios ni administradores de región a tus canales.';
  }
  if (isUnitAdmin(actor)) {
    return 'Como administrador de unidad solo puedes agregar personas de tu unidad (operadores o admin de unidad).';
  }
  return 'No puedes agregar ese perfil a este canal.';
}

/**
 * Salir del grupo: usuarios no se auto-agregan a niveles superiores.
 * Grupo bloqueado (admins de zona creados por región): el admin de zona no puede salirse.
 */
export function canLeaveGroup(actorRole, { scopeLevel, membershipLocked, isSelf }) {
  const role = normalizeRole(actorRole);
  if (isRoot(role) || isRegionAdmin(role)) return true;
  if (membershipLocked && role === 'zone_admin') return false;
  if (!isSelf) {
    if (role === 'zone_admin' && (scopeLevel === 'zone' || scopeLevel === 'unit')) return true;
    if (role === 'unit_admin' && scopeLevel === 'unit') return true;
    return false;
  }
  if (role === 'zone_admin' && scopeLevel === 'unit') return true;
  if (role === 'region_admin') return true;
  return false;
}
