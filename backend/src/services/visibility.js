/**
 * Visibilidad en mapa / listados.
 * Perfil (matriz) define la base; ocultar y nivel de share la ajustan en vivo.
 * Administrador (root) ve siempre a todos.
 */
import { normalizeRole, isRoot, isUserProfile } from './roles.js';

export const RANK = {
  root: 100,
  region_admin: 80,
  region_user: 70,
  zone_admin: 60,
  zone_user: 50,
  unit_admin: 40,
  unit_user: 30,
};

/** Matriz por defecto: viewerRole → targetRoles visibles (antes de ocultar/share/territorio). */
export const DEFAULT_SEE = {
  root: ['root', 'region_admin', 'region_user', 'zone_admin', 'zone_user', 'unit_admin', 'unit_user'],
  region_admin: ['region_admin', 'region_user', 'zone_admin', 'zone_user', 'unit_admin', 'unit_user'],
  region_user: ['region_admin', 'region_user'],
  zone_admin: ['zone_admin', 'zone_user', 'unit_admin', 'unit_user'],
  zone_user: ['zone_user'],
  unit_admin: ['unit_admin', 'unit_user'],
  unit_user: ['unit_user'],
};

function rankOf(role) {
  return RANK[normalizeRole(role)] || 0;
}

export function matrixAllows(viewerRole, targetRole, matrix) {
  const vr = normalizeRole(viewerRole);
  const tr = normalizeRole(targetRole);
  const row = matrix?.[vr];
  if (Array.isArray(row)) return row.includes(tr);
  if (row && typeof row === 'object') return Boolean(row[tr]);
  const def = DEFAULT_SEE[vr] || [];
  return def.includes(tr);
}

/**
 * Share del objetivo: ¿el observador (no superior estricto) alcanza ese nivel?
 * Superiores se evalúan aparte.
 */
function shareReachesViewer(share, viewerRole) {
  const s = share || 'peers';
  const vr = normalizeRole(viewerRole);
  if (s === 'hidden') return false;
  if (s === 'peers') return true;
  if (s === 'region') return true;
  if (s === 'zone') return vr !== 'region_admin' && vr !== 'region_user' && vr !== 'root';
  if (s === 'unit') return vr === 'unit_admin' || vr === 'unit_user';
  return true;
}

/**
 * @param {object} viewer { id, role, profileVisibility? }
 * @param {object} target { id, role, locationShare }
 */
export function canSeePerson(viewer, target) {
  if (!viewer || !target) return false;
  if (String(viewer.id) === String(target.id)) return true;
  const vr = normalizeRole(viewer.role);
  const tr = normalizeRole(target.role);
  if (isRoot(vr)) return true;

  if (!matrixAllows(vr, tr, viewer.profileVisibility)) return false;

  const share = target.locationShare || (isUserProfile(tr) ? 'peers' : 'region');
  const hidden = share === 'hidden';
  const viewerRank = rankOf(vr);
  const targetRank = rankOf(tr);
  const superior = viewerRank > targetRank;

  if (hidden) {
    if (!superior) return false;
    // Usuario de región no ve admin de zona oculto (aunque su rango sea mayor).
    if (vr === 'region_user' && tr === 'zone_admin') return false;
    return true;
  }

  if (superior) return true;
  return shareReachesViewer(share, vr);
}
