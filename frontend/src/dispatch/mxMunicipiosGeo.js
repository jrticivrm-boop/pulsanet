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

/** Filtro por zona / unidad / municipio (shapeID o nombre). */
export function filterTerritoryFeatures(features, { zonaId, unidad, municipioId, municipioName } = {}) {
  let list = features || [];
  if (zonaId) list = list.filter((f) => f.properties?.zonaId === zonaId);
  if (unidad) {
    const u = String(unidad);
    list = list.filter((f) => {
      const units = f.properties?.unidades || [f.properties?.unidad];
      return (units || []).some((x) => String(x) === u) || String(f.properties?.unidad || '') === u;
    });
  }
  if (municipioId) {
    list = list.filter((f) => f.properties?.shapeID === municipioId);
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
