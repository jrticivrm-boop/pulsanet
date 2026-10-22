/**
 * GeoJSON municipal IV R.M. (Zonas Militares) — geoBoundaries ADM2 filtrado
 * y cruzado con el catálogo institucional (ver infra/_build_ivrm_municipios.py).
 */
const MUNI_URL = '/geo/ivRmMunicipios.json?v=20261015d';

let cache = null;
let pending = null;

export function loadedIvRmMunicipios() {
  return cache;
}

export function loadIvRmMunicipios() {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = fetch(MUNI_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((fc) => {
      const features = Array.isArray(fc?.features) ? fc.features : [];
      if (!features.length) return null;
      cache = features;
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Ray casting point-in-polygon (rings GeoJSON [lng, lat]). */
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoords(lng, lat, coords, type) {
  if (type === 'Polygon') {
    if (!coords?.length) return false;
    if (!pointInRing(lng, lat, coords[0])) return false;
    for (let h = 1; h < coords.length; h++) {
      if (pointInRing(lng, lat, coords[h])) return false;
    }
    return true;
  }
  if (type === 'MultiPolygon') {
    return (coords || []).some((poly) => pointInPolygonCoords(lng, lat, poly, 'Polygon'));
  }
  return false;
}

export function featureContainsLatLng(feature, lat, lng) {
  if (!feature?.geometry) return false;
  return pointInPolygonCoords(lng, lat, feature.geometry.coordinates, feature.geometry.type);
}

/**
 * ¿El punto cae en alguno de los features filtrados?
 * @param {Array} features
 * @param {number} lat
 * @param {number} lng
 */
export function pointInAnyFeature(features, lat, lng) {
  if (!features?.length) return false;
  for (const f of features) {
    if (featureContainsLatLng(f, lat, lng)) return true;
  }
  return false;
}

function featureUnitNames(f) {
  const p = f?.properties || {};
  if (Array.isArray(p.unidades) && p.unidades.length) {
    return p.unidades.map((u) => String(u).trim()).filter(Boolean);
  }
  return String(p.unidad || '')
    .split(' / ')
    .map((u) => u.trim())
    .filter(Boolean);
}

function idList(filter, pluralKey, singularKey) {
  if (!filter) return null;
  if (Array.isArray(filter[pluralKey])) {
    return filter[pluralKey].map(String).filter(Boolean);
  }
  if (filter[singularKey]) return [String(filter[singularKey])];
  return null;
}

function normName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cruza polígonos GeoJSON con la cobertura del catálogo (unidad ↔ municipio).
 * Si no hay filas, deja las propiedades del archivo.
 */
export function applyTerritoryCoverage(features, rows) {
  if (!features?.length || !rows?.length) return features || [];
  const byMuni = new Map();
  for (const r of rows) {
    const estado = r.estado || r.estadoName;
    const municipio = r.municipio || r.municipioName;
    const key = `${normName(estado)}|${normName(municipio)}`;
    let bucket = byMuni.get(key);
    if (!bucket) {
      bucket = {
        unidades: [],
        zonaKey: r.zonaKey || r.zona_key || '',
        zonaShort: r.zonaShort || r.zona_short || '',
      };
      byMuni.set(key, bucket);
    }
    const u = String(r.unidadName || r.unidad_name || '').trim();
    if (u && !bucket.unidades.includes(u)) bucket.unidades.push(u);
  }
  return features.map((f) => {
    const p = f.properties || {};
    const key = `${normName(p.estado)}|${normName(p.municipio || p.shapeName)}`;
    const cov = byMuni.get(key);
    if (!cov) return f;
    return {
      ...f,
      properties: {
        ...p,
        unidades: cov.unidades,
        unidad: cov.unidades.join(' / '),
        zonaId: cov.zonaKey || p.zonaId,
        zona: cov.zonaShort || p.zona,
      },
    };
  });
}

/** Filtro por zona / unidad / estado / municipio. Arrays vacíos = ninguno (sin opción «Todos»). */
export function filterTerritoryFeatures(features, filter = {}) {
  let list = features || [];
  const zonaIds = idList(filter, 'zonaIds', 'zonaId');
  const unidadIds = idList(filter, 'unidadIds', 'unidad');
  const estadoIds = idList(filter, 'estadoIds', 'estado');
  const municipioIds = idList(filter, 'municipioIds', 'municipioId');
  const municipioName = filter.municipioName;

  if (zonaIds) {
    if (!zonaIds.length) return [];
    const zs = new Set(zonaIds);
    list = list.filter((f) => zs.has(String(f.properties?.zonaId || '')));
  }
  if (unidadIds) {
    if (!unidadIds.length) return [];
    const us = new Set(unidadIds);
    list = list.filter((f) => featureUnitNames(f).some((u) => us.has(u)));
  }
  if (estadoIds) {
    if (!estadoIds.length) return [];
    const es = new Set(estadoIds.map((e) => normName(e)));
    list = list.filter((f) => es.has(normName(f.properties?.estado)));
  }
  if (municipioIds) {
    if (!municipioIds.length) return [];
    const ms = new Set(municipioIds);
    list = list.filter((f) => ms.has(String(f.properties?.shapeID || '')));
  } else if (municipioName) {
    const n = String(municipioName).toLowerCase();
    list = list.filter(
      (f) =>
        String(f.properties?.municipio || '').toLowerCase() === n ||
        String(f.properties?.shapeName || '').toLowerCase() === n
    );
  }
  return list;
}
