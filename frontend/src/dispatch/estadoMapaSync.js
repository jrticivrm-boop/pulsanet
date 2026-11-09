import { fetchRegionStates, fetchUiPrefs } from '../api';
import { applyEstadoMapa } from './ivRmStatesConfig.js';
import { getOrgUnitColorOverrides, setOrgUnitColorOverrides } from './ivRmTerritoryConfig.js';

/** Trae estados de la región (compartidos) y colores / mapas de esta cuenta. */
export async function syncEstadoMapa(token) {
  if (!token) return null;
  const [geo, prefsRes] = await Promise.all([
    fetchRegionStates(token).catch(() => ({ states: [] })),
    fetchUiPrefs(token).catch(() => ({ prefs: {} })),
  ]);
  const prefs = prefsRes?.prefs || {};
  const states = geo?.states || [];
  applyEstadoMapa({
    assignedIds: states.map((s) => s.estadoId),
    colors: prefs.estadoMapaColors || {},
    surfaces: prefs.estadoMapaSurfaces || null,
  });
  const personal = prefs.territorioUnitColors;
  if (personal && typeof personal === 'object') {
    setOrgUnitColorOverrides({ ...getOrgUnitColorOverrides(), ...personal });
  }
  return { states, prefs };
}
