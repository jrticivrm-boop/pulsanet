/**
 * Preferencias de división territorial IV R.M. (Zonas Militares / municipios).
 * localStorage en este navegador (mismo patrón que Estados / Sitios).
 */
import { useEffect, useState } from 'react';
import catalog from './ivRmTerritoryCatalog.json';

export const IV_RM_TERRITORY_STORAGE_KEY = 'tacticalptx_iv_rm_territory_v1';
export const IV_RM_TERRITORY_EVENT = 'tacticalptx-iv-rm-territory-changed';

export const IV_RM_ZONAS = catalog.zonas;
export const IV_RM_ZONA_BY_ID = new Map(IV_RM_ZONAS.map((z) => [z.id, z]));
export const IV_RM_ZONA_ID_BY_SHORT = catalog.zonaIdByShort || {};
export const IV_RM_TERRITORY_ASSIGNMENTS = catalog.assignments || [];

export const IV_RM_TERRITORY_SURFACES = [
  { id: 'consola', label: 'Consola', hint: 'Consola de Operaciones' },
  { id: 'radio', label: 'Radio', hint: 'Mapa embebido en Radio' },
];

function normalizeHex(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

export function defaultTerritorySurfaces() {
  return { consola: true, radio: true };
}

export function normalizeTerritorySurfaces(raw) {
  const base = defaultTerritorySurfaces();
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  }
  return base;
}

export function defaultIvRmTerritoryConfig() {
  const zonas = {};
  for (const z of IV_RM_ZONAS) {
    zonas[z.id] = { enabled: true, color: z.color };
  }
  return {
    surfaces: defaultTerritorySurfaces(),
    /** Capa municipal activa (además de estados). */
    layerEnabled: true,
    /** Relleno por color de Z.M.; si false, solo bordes. */
    showColors: true,
    zonas,
  };
}

export function isTerritorySurfaceEnabled(config, surface) {
  const key = String(surface || '');
  if (!key || !Object.prototype.hasOwnProperty.call(defaultTerritorySurfaces(), key)) {
    return true;
  }
  return normalizeTerritorySurfaces(config?.surfaces)[key] !== false;
}

export function isZonaEnabled(config, zonaId) {
  const row = config?.zonas?.[zonaId];
  if (row && typeof row === 'object' && typeof row.enabled === 'boolean') return row.enabled;
  return true;
}

export function zonaColor(config, zonaId) {
  const def = IV_RM_ZONA_BY_ID.get(zonaId);
  return normalizeHex(config?.zonas?.[zonaId]?.color) || def?.color || '#355c2e';
}

/**
 * Colores por unidad (mismo tono = misma unidad; tonos bien diferenciados entre sí).
 * Clave = nombre canónico de unidad del catálogo XLS.
 */
export const IV_RM_UNIDAD_COLORS = {
  '16/o. R.C.': '#e07830',
  '29/o. R.C.': '#2f7fd4',
  '25/o. R.C.': '#c44f7a',
  '19/o. R.C.': '#3a9a4a',
  '8/o. R.C.': '#c9a020',
  '15/o. B.I.': '#1f8a72',
  '77/o. B.I.': '#6a4f9a',
  '77 B.I.': '#6a4f9a',
  '16/o. B.I.': '#3f6fd0',
  '22/o. B.I': '#d04a4a',
  '27/o. R.C.': '#2f8f9a',
  '40/o. B.I.': '#5f8f4f',
  '36/o. B.I.': '#c46a28',
};

const UNIDAD_FALLBACK_PALETTE = [
  '#4a8f6a',
  '#8f6a4a',
  '#4a6a8f',
  '#8f4a6a',
  '#6a8f4a',
  '#6a4a8f',
  '#8f8f4a',
  '#4a8f8f',
];

/** Unidad principal del feature (primera de la lista). */
export function primaryUnidad(props) {
  const units = props?.unidades;
  if (Array.isArray(units) && units.length) return String(units[0]);
  return String(props?.unidad || '').split(' / ')[0].trim();
}

/** Color tenue de relleno por unidad; borde más suave derivado. */
export function unidadColor(unidad) {
  const key = String(unidad || '').trim();
  if (!key) return '#9aa3ad';
  const direct = IV_RM_UNIDAD_COLORS[key];
  if (direct) return direct;
  // Normalizar "22/o. B.I." vs "22/o. B.I"
  const soft = key.replace(/\.$/, '');
  if (IV_RM_UNIDAD_COLORS[soft]) return IV_RM_UNIDAD_COLORS[soft];
  if (IV_RM_UNIDAD_COLORS[`${soft}.`]) return IV_RM_UNIDAD_COLORS[`${soft}.`];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return UNIDAD_FALLBACK_PALETTE[h % UNIDAD_FALLBACK_PALETTE.length];
}

export function loadIvRmTerritoryConfig() {
  const base = defaultIvRmTerritoryConfig();
  try {
    const raw = localStorage.getItem(IV_RM_TERRITORY_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    base.surfaces = normalizeTerritorySurfaces(parsed.surfaces);
    if (typeof parsed.layerEnabled === 'boolean') base.layerEnabled = parsed.layerEnabled;
    if (typeof parsed.showColors === 'boolean') base.showColors = parsed.showColors;
    for (const z of IV_RM_ZONAS) {
      const row = parsed.zonas?.[z.id];
      if (!row || typeof row !== 'object') continue;
      base.zonas[z.id] = {
        enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
        color: normalizeHex(row.color) || z.color,
      };
    }
    return base;
  } catch {
    return base;
  }
}

export function saveIvRmTerritoryConfig(config) {
  const next = defaultIvRmTerritoryConfig();
  next.surfaces = normalizeTerritorySurfaces(config?.surfaces);
  next.layerEnabled = config?.layerEnabled !== false;
  next.showColors = config?.showColors !== false;
  for (const z of IV_RM_ZONAS) {
    const row = config?.zonas?.[z.id];
    next.zonas[z.id] = {
      enabled: isZonaEnabled(config, z.id),
      color: normalizeHex(row?.color) || z.color,
    };
  }
  try {
    localStorage.setItem(IV_RM_TERRITORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(IV_RM_TERRITORY_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
  return next;
}

export function enabledZonas(config) {
  const cfg = config || loadIvRmTerritoryConfig();
  return IV_RM_ZONAS.filter((z) => isZonaEnabled(cfg, z.id)).map((z) => ({
    ...z,
    color: zonaColor(cfg, z.id),
  }));
}

/** Unidades únicas del catálogo (para filtros de consola). */
export function listTerritoryUnidades() {
  const seen = new Map();
  for (const a of IV_RM_TERRITORY_ASSIGNMENTS) {
    const u = String(a.unidad || '').trim();
    if (!u || seen.has(u)) continue;
    const zid = IV_RM_ZONA_ID_BY_SHORT[a.zona];
    seen.set(u, { unidad: u, zona: a.zona, zonaId: zid, estado: a.estado });
  }
  return [...seen.values()].sort((a, b) => a.unidad.localeCompare(b.unidad, 'es'));
}

export function useIvRmTerritoryConfig() {
  const [config, setConfig] = useState(loadIvRmTerritoryConfig);

  useEffect(() => {
    const sync = () => setConfig(loadIvRmTerritoryConfig());
    const onStorage = (e) => {
      if (e.key === IV_RM_TERRITORY_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(IV_RM_TERRITORY_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(IV_RM_TERRITORY_EVENT, sync);
    };
  }, []);

  function update(nextOrFn) {
    setConfig((prev) => {
      const draft = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      return saveIvRmTerritoryConfig(draft);
    });
  }

  return [config, update];
}
