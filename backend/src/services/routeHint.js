/**
 * Ruta probable por calles entre dos puntos (para los huecos de señal).
 *
 * Se resuelve en el backend, no en el navegador, porque:
 *  - El Host suele tener internet aunque las consolas estén en LAN aislada.
 *  - La caché es compartida por todas las consolas (el mapa repolla la ruta).
 *  - Un OSRM propio se configura en un solo lugar (ROUTING_OSRM_URL).
 *
 * Sin servicio disponible NO se inventa geometría: se devuelve `estimated: true`
 * con los dos extremos y el mapa la dibuja punteada como estimación.
 */

/** OSRM propio primero; el demo público solo como defecto conveniente. */
const OSRM_BASE = (process.env.ROUTING_OSRM_URL || 'https://router.project-osrm.org')
  .trim()
  .replace(/\/$/, '');
const ROUTING_ENABLED = String(process.env.ROUTING_ENABLED ?? '1').trim() !== '0';
/**
 * El demo público en frío puede tardar >20 s; no se espera tanto en la primera
 * petición: se devuelve la estimación punteada y el mapa reintenta (ya caliente
 * responde en ~200 ms). Con OSRM propio se puede bajar mucho.
 */
const TIMEOUT_MS = parseInt(process.env.ROUTING_TIMEOUT_MS || '15000', 10);
const PROFILE = (process.env.ROUTING_PROFILE || 'driving').trim();

/** Una ruta por carretera no cambia: se puede cachear largo. */
const OK_TTL_MS = 24 * 60 * 60 * 1000;
/** Fallo (sin internet / sin camino): reintentar pronto pero sin martillear. */
const FAIL_TTL_MS = 60 * 1000;
const CACHE_MAX = 600;
/** Más allá de esto no es un hueco de señal creíble, es basura de GPS. */
const MAX_SPAN_KM = 2_500;
/** Puntos máximos devueltos por tramo (la geometría OSRM `full` trae miles). */
const MAX_GEOMETRY_POINTS = 500;

/** @type {Map<string, { at: number, ttl: number, value: object }>} */
const cache = new Map();

function cacheKey(from, to) {
  const r = (n) => n.toFixed(4);
  return `${PROFILE}:${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return null;
  }
  // LRU simple: refrescar posición de inserción.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value, ttl) {
  cache.set(key, { at: Date.now(), ttl, value });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Diezmado uniforme preservando extremos (la geometría ya viene ordenada). */
function thin(points, max = MAX_GEOMETRY_POINTS) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  out[out.length - 1] = points[points.length - 1];
  return out;
}

function straightFallback(from, to, reason) {
  return {
    ok: true,
    estimated: true,
    reason,
    source: 'straight',
    points: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceM: Math.round(haversineKm(from, to) * 1000),
    durationS: null,
  };
}

/**
 * @param {{ lat: number, lng: number }} from  último fix conocido
 * @param {{ lat: number, lng: number }} to    primer fix al reconectar
 * @returns {Promise<{ ok: boolean, estimated: boolean, points: [number,number][], source: string, distanceM: number|null, durationS: number|null, reason?: string }>}
 */
export async function routeBetween(from, to) {
  const spanKm = haversineKm(from, to);
  if (spanKm > MAX_SPAN_KM) {
    return straightFallback(from, to, 'salto_fuera_de_rango');
  }
  if (!ROUTING_ENABLED) {
    return straightFallback(from, to, 'routing_deshabilitado');
  }

  const key = cacheKey(from, to);
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  // OSRM espera lon,lat. `overview=full` y se diezma aquí: mejor forma que `simplified`.
  const url =
    `${OSRM_BASE}/route/v1/${encodeURIComponent(PROFILE)}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data?.code !== 'Ok' || !Array.isArray(coords) || coords.length < 2) {
      const miss = straightFallback(from, to, 'sin_ruta');
      cacheSet(key, miss, FAIL_TTL_MS);
      return miss;
    }
    const value = {
      ok: true,
      estimated: false,
      source: 'osrm',
      points: thin(coords.map(([lng, lat]) => [lat, lng])),
      distanceM: Math.round(Number(route.distance) || 0),
      durationS: Math.round(Number(route.duration) || 0),
    };
    cacheSet(key, value, OK_TTL_MS);
    return value;
  } catch (err) {
    // Sin internet / LAN aislada / OSRM caído → estimación punteada.
    const miss = straightFallback(
      from,
      to,
      err?.name === 'TimeoutError' ? 'timeout' : 'sin_servicio'
    );
    cacheSet(key, miss, FAIL_TTL_MS);
    return miss;
  }
}

export const routingInfo = {
  enabled: ROUTING_ENABLED,
  baseUrl: OSRM_BASE,
  profile: PROFILE,
};
