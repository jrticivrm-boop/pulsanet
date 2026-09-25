/**
 * Visibilidad en mapa / listados (Alcance 3).
 * Solo jerarquía + matriz: nadie «oculta» ubicación.
 * Abajo no ve arriba; región ve hacia abajo en su territorio (filtro geo aparte).
 */
import { normalizeRole, isRoot } from './roles.js';

export const RANK = {
  root: 100,
  region_admin: 80,
  region_user: 70,
  zone_admin: 60,
  zone_user: 50,
  unit_admin: 40,
  unit_user: 30,
};

/** Matriz por defecto: viewerRole → targetRoles visibles. */
export const DEFAULT_SEE = {
  root: ['root', 'region_admin', 'region_user', 'zone_admin', 'zone_user', 'unit_admin', 'unit_user'],
  region_admin: ['region_admin', 'region_user', 'zone_admin', 'zone_user', 'unit_admin', 'unit_user'],
  // Alcance 3: usuario de región ve toda su región (zonas y unidades) en matriz;
  // el territorio concreto lo recorta loadTrackScope.
  region_user: [
    'region_admin',
    'region_user',
    'zone_admin',
    'zone_user',
    'unit_admin',
    'unit_user',
  ],
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
 * @param {object} viewer { id, role, profileVisibility? }
 * @param {object} target { id, role, locationShare? } — locationShare se ignora (Alcance 3)
 */
export function canSeePerson(viewer, target) {
  if (!viewer || !target) return false;
  if (String(viewer.id) === String(target.id)) return true;
  const vr = normalizeRole(viewer.role);
  const tr = normalizeRole(target.role);
  if (isRoot(vr)) return true;

  if (!matrixAllows(vr, tr, viewer.profileVisibility)) return false;

  // Solo matriz + jerarquía. location_share / «ocultar» ya no aplican.
  return true;
}

/** @deprecated Alcance 3 — conservado por si algún test importa RANK vía side-effect */
export function rankOfRole(role) {
  return rankOf(role);
}
