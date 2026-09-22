/**
 * Preferencias de delimitación de estados en mapas (visible + color).
 * MVP: localStorage en este navegador (como canales / capas de sitios).
 */
import { useEffect, useState } from 'react';

export const IV_RM_STATES_STORAGE_KEY = 'tacticalptx_iv_rm_states_v1';
export const IV_RM_STATES_EVENT = 'tacticalptx-iv-rm-states-changed';

/** Mapas donde pueden dibujarse las delimitaciones (checks en Config → Estados). */
export const IV_RM_SURFACES = [
  { id: 'consola', label: 'Consola', hint: 'Consola de Operaciones' },
  { id: 'seguimiento', label: 'Seguimiento', hint: 'Mapa de seguimiento' },
  { id: 'radio', label: 'Radio', hint: 'Mapa embebido en Radio' },
];

/** Estados de la IV Región Militar: encendidos por defecto. */
export const IV_RM_IDS = ['NL', 'TM', 'SLP'];

/**
 * Catálogo de los 32 estados.
 * `geo: 'bundle'` → IV R.M. (NL/TM/SLP): geometría en `ivRmStates.json`.
 * `geo: 'lazy'`   → al habilitar cualquiera se descarga `public/geo/mxEstados.json`.
 * Ambos archivos salen de la misma fuente INEGI (ver mxStatesGeo.js).
 */
export const IV_RM_STATE_DEFS = [
  { id: 'AGS', name: 'Aguascalientes', defaultColor: '#97503b', geo: 'lazy' },
  { id: 'BC', name: 'Baja California', defaultColor: '#b97b4b', geo: 'lazy' },
  { id: 'BCS', name: 'Baja California Sur', defaultColor: '#97763b', geo: 'lazy' },
  { id: 'CAM', name: 'Campeche', defaultColor: '#bfad45', geo: 'lazy' },
  { id: 'CHIS', name: 'Chiapas', defaultColor: '#969c35', geo: 'lazy' },
  { id: 'CHIH', name: 'Chihuahua', defaultColor: '#9ebf45', geo: 'lazy' },
  { id: 'CDMX', name: 'Ciudad de México', defaultColor: '#60823a', geo: 'lazy' },
  { id: 'COAH', name: 'Coahuila de Zaragoza', defaultColor: '#67a54a', geo: 'lazy' },
  { id: 'COL', name: 'Colima', defaultColor: '#42823a', geo: 'lazy' },
  { id: 'DGO', name: 'Durango', defaultColor: '#4aa553', geo: 'lazy' },
  { id: 'MEX', name: 'Estado de México', defaultColor: '#3a8250', geo: 'lazy' },
  { id: 'GTO', name: 'Guanajuato', defaultColor: '#4aa579', geo: 'lazy' },
  { id: 'GRO', name: 'Guerrero', defaultColor: '#3a826e', geo: 'lazy' },
  { id: 'HGO', name: 'Hidalgo', defaultColor: '#4aa59e', geo: 'lazy' },
  { id: 'JAL', name: 'Jalisco', defaultColor: '#3a7982', geo: 'lazy' },
  { id: 'MICH', name: 'Michoacán de Ocampo', defaultColor: '#4b94b9', geo: 'lazy' },
  { id: 'MOR', name: 'Morelos', defaultColor: '#3b6597', geo: 'lazy' },
  { id: 'NAY', name: 'Nayarit', defaultColor: '#4b66b9', geo: 'lazy' },
  { id: 'NL', name: 'Nuevo León', defaultColor: '#2f6fed', geo: 'bundle' },
  { id: 'OAX', name: 'Oaxaca', defaultColor: '#3b3e97', geo: 'lazy' },
  { id: 'PUE', name: 'Puebla', defaultColor: '#5d4bb9', geo: 'lazy' },
  { id: 'QRO', name: 'Querétaro', defaultColor: '#5d3b97', geo: 'lazy' },
  { id: 'QROO', name: 'Quintana Roo', defaultColor: '#8b4bb9', geo: 'lazy' },
  { id: 'SLP', name: 'San Luis Potosí', defaultColor: '#1f8a4c', geo: 'bundle' },
  { id: 'SIN', name: 'Sinaloa', defaultColor: '#833b97', geo: 'lazy' },
  { id: 'SON', name: 'Sonora', defaultColor: '#b84bb9', geo: 'lazy' },
  { id: 'TAB', name: 'Tabasco', defaultColor: '#973b84', geo: 'lazy' },
  { id: 'TM', name: 'Tamaulipas', defaultColor: '#c97070', geo: 'bundle' },
  { id: 'TLAX', name: 'Tlaxcala', defaultColor: '#b94b8c', geo: 'lazy' },
  { id: 'VER', name: 'Veracruz de Ignacio de la Llave', defaultColor: '#973b5e', geo: 'lazy' },
  { id: 'YUC', name: 'Yucatán', defaultColor: '#b94b5f', geo: 'lazy' },
  { id: 'ZAC', name: 'Zacatecas', defaultColor: '#973d3b', geo: 'lazy' },
].map((d) => ({ ...d, ivRm: IV_RM_IDS.includes(d.id) }));

export const IV_RM_STATE_DEF_BY_ID = new Map(IV_RM_STATE_DEFS.map((d) => [d.id, d]));

/** Solo IV R.M. viene encendido: ampliar a 32 no debe pintar el país entero. */
export function defaultStateEnabled(id) {
  return IV_RM_IDS.includes(id);
}

function normalizeHex(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

/** Por defecto: delimitaciones en Consola, Seguimiento y Radio. */
export function defaultSurfaces() {
  return { consola: true, seguimiento: true, radio: true };
}

export function normalizeSurfaces(raw) {
  const base = defaultSurfaces();
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  }
  return base;
}

export function defaultIvRmStatesConfig() {
  const out = { surfaces: defaultSurfaces() };
  for (const d of IV_RM_STATE_DEFS) {
    out[d.id] = { enabled: defaultStateEnabled(d.id), color: d.defaultColor };
  }
  return out;
}

/** Lectura tolerante: si el estado no está guardado, manda su valor por defecto. */
export function isStateEnabled(config, id) {
  const row = config?.[id];
  if (row && typeof row === 'object' && typeof row.enabled === 'boolean') return row.enabled;
  return defaultStateEnabled(id);
}

/** ¿Dibujar delimitaciones en este mapa? Default true si falta la clave. */
export function isSurfaceEnabled(config, surface) {
  const key = String(surface || '');
  if (!key || !Object.prototype.hasOwnProperty.call(defaultSurfaces(), key)) return true;
  const surfaces = normalizeSurfaces(config?.surfaces);
  return surfaces[key] !== false;
}

export function stateColor(config, id) {
  const def = IV_RM_STATE_DEF_BY_ID.get(id);
  return normalizeHex(config?.[id]?.color) || def?.defaultColor || '#355c2e';
}

export function loadIvRmStatesConfig() {
  const base = defaultIvRmStatesConfig();
  try {
    const raw = localStorage.getItem(IV_RM_STATES_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    /* Merge: lo ya guardado por el usuario gana; estados/superficies nuevos
       entran con su valor por defecto (no borra colores previos). */
    base.surfaces = normalizeSurfaces(parsed.surfaces);
    for (const d of IV_RM_STATE_DEFS) {
      const row = parsed[d.id];
      if (!row || typeof row !== 'object') continue;
      base[d.id] = {
        enabled: typeof row.enabled === 'boolean' ? row.enabled : defaultStateEnabled(d.id),
        color: normalizeHex(row.color) || d.defaultColor,
      };
    }
    return base;
  } catch {
    return base;
  }
}

export function saveIvRmStatesConfig(config) {
  const next = defaultIvRmStatesConfig();
  next.surfaces = normalizeSurfaces(config?.surfaces);
  for (const d of IV_RM_STATE_DEFS) {
    const row = config?.[d.id];
    next[d.id] = {
      enabled: isStateEnabled(config, d.id),
      color: normalizeHex(row?.color) || d.defaultColor,
    };
  }
  try {
    localStorage.setItem(IV_RM_STATES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(IV_RM_STATES_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
  return next;
}

/** Lista lista para leyenda / capa: solo habilitados. */
export function enabledIvRmStates(config) {
  const cfg = config || loadIvRmStatesConfig();
  return IV_RM_STATE_DEFS.filter((d) => isStateEnabled(cfg, d.id)).map((d) => ({
    ...d,
    color: stateColor(cfg, d.id),
  }));
}

export function useIvRmStatesConfig() {
  const [config, setConfig] = useState(loadIvRmStatesConfig);

  useEffect(() => {
    const sync = () => setConfig(loadIvRmStatesConfig());
    const onStorage = (e) => {
      if (e.key === IV_RM_STATES_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(IV_RM_STATES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(IV_RM_STATES_EVENT, sync);
    };
  }, []);

  function update(nextOrFn) {
    setConfig((prev) => {
      const draft = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      return saveIvRmStatesConfig(draft);
    });
  }

  return [config, update];
}
