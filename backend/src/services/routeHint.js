/**
 * Ruta probable por calles entre dos puntos (para los huecos de señal).
 *
 * Se resuelve en el backend, no en el navegador, porque:
 *  - El Host suele tener internet aunque las consolas estén en LAN aislada.
 *  - La caché es compartida por todas las consolas (el mapa repolla la ruta).
 *  - Un OSRM propio se configura en un solo lugar (ROUTING_OSRM_URL).
 *
 * Si no hay geometría vial válida NO se inventa una recta: se devuelve
 * `estimated: true` con `points: []` para que el mapa no dibuje un atajo
 * a través de campo / manzanas / bases.
 */

/** OSRM propio primero; el demo público solo como defecto conveniente. */
const OSRM_BASE = (process.env.ROUTING_OSRM_URL || 'https://router.project-osrm.org')
  .trim()
  .replace(/\/$/, '');
const ROUTING_ENABLED = String(process.env.ROUTING_ENABLED ?? '1').trim() !== '0';
/**
 * El demo público en frío puede tardar; dar margen y un reintento corto.
 * Con OSRM propio se puede bajar ROUTING_TIMEOUT_MS.
 */
const TIMEOUT_MS = parseInt(process.env.ROUTING_TIMEOUT_MS || '25000', 10);
/**
 * Perfil de routing. Se fuerza `driving` por defecto: es el único que respeta el
 * sentido de las calles (one-way) y las de doble sentido, como un vehículo real.
 * NO usar `foot`/`walking`: ignoran one-way y darían rutas contra el sentido.
 */
const PROFILE = (process.env.ROUTING_PROFILE || 'driving').trim();

/** Una ruta por carretera no cambia: se puede cachear largo. */
const OK_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Fallos blandos (timeout / sin servicio) NO se cachean agresivo: antes 60 s
 * bloqueaban los reintentos del mapa y dejaban la recta “congelada”.
 */
const FAIL_TTL_MS = 8 * 1000;
const CACHE_MAX = 600;
/** Más allá de esto no es un hueco de señal creíble, es basura de GPS. */
const MAX_SPAN_KM = 2_500;
/** Puntos máximos devueltos por tramo (la geometría OSRM `full` trae miles). */
const MAX_GEOMETRY_POINTS = 500;
/**
 * Si OSRM solo devuelve los 2 extremos en un salto largo, es geometría inútil
 * (equivalente a la cuerda). Se rechaza para reintentar / no dibujar.
 */
const MIN_SHAPE_SPAN_M = 400;

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

/** Fallo sin geometría inventada: el mapa no dibuja atajo recto. */
function pendingFallback(reason) {
  return {
    ok: true,
    estimated: true,
    reason,
    source: 'pending',
    points: [],
    distanceM: null,
    durationS: null,
  };
}

function buildOsrmUrl(from, to) {
  // OSRM espera lon,lat. `overview=full` y se diezma aquí: mejor forma que `simplified`.
  //  - profile driving respeta one-way / doble sentido.
  //  - continue_straight=false: deja elegir el giro válido más natural.
  //  - snapping=any: engancha al segmento vial más cercano.
  return (
    `${OSRM_BASE}/route/v1/${encodeURIComponent(PROFILE)}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false` +
    `&annotations=false&continue_straight=false&snapping=any`
  );
}

async function fetchOsrmOnce(from, to, timeoutMs) {
  const res = await fetch(buildOsrmUrl(from, to), {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (data?.code !== 'Ok' || !Array.isArray(coords) || coords.length < 2) {
    return pendingFallback('sin_ruta');
  }
  const distanceM = Math.round(Number(route.distance) || 0);
  const straightM = Math.round(haversineKm(from, to) * 1000);
  // Solo 2 vértices en un salto largo ≈ cuerda A→B (no es red vial usable).
  if (coords.length < 3 && straightM >= MIN_SHAPE_SPAN_M) {
    return pendingFallback('ruta_sin_forma');
  }
  return {
    ok: true,
    estimated: false,
    source: 'osrm',
    points: thin(coords.map(([lng, lat]) => [lat, lng])),
    distanceM,
    durationS: Math.round(Number(route.duration) || 0),
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
    return pendingFallback('salto_fuera_de_rango');
  }
  if (!ROUTING_ENABLED) {
    return pendingFallback('routing_deshabilitado');
  }

  const key = cacheKey(from, to);
  const cached = cacheGet(key);
  // Solo se reutiliza caché de rutas reales; pending/estimado se reintenta.
  if (cached && !cached.estimated) return { ...cached, cached: true };

  try {
    let value = await fetchOsrmOnce(from, to, TIMEOUT_MS);
    // Un reintento corto si el demo público falló en frío o sin forma usable.
    if (
      value.estimated &&
      (value.reason === 'sin_ruta' || value.reason === 'ruta_sin_forma')
    ) {
      await new Promise((r) => setTimeout(r, 400));
      value = await fetchOsrmOnce(from, to, TIMEOUT_MS);
    }
    if (!value.estimated) {
      cacheSet(key, value, OK_TTL_MS);
    } else {
      cacheSet(key, value, FAIL_TTL_MS);
    }
    return value;
  } catch (err) {
    const timedOut =
      err?.name === 'TimeoutError' || err?.name === 'AbortError';
    // Timeout del demo público: un segundo intento suele bastar (arranque en frío).
    if (timedOut) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        const retry = await fetchOsrmOnce(from, to, TIMEOUT_MS);
        if (!retry.estimated) {
          cacheSet(key, retry, OK_TTL_MS);
          return retry;
        }
        cacheSet(key, retry, FAIL_TTL_MS);
        return retry;
      } catch {
        /* cae al pending de abajo */
      }
    }
    const miss = pendingFallback(timedOut ? 'timeout' : 'sin_servicio');
    cacheSet(key, miss, FAIL_TTL_MS);
    return miss;
  }
}

export const routingInfo = {
  enabled: ROUTING_ENABLED,
  baseUrl: OSRM_BASE,
  profile: PROFILE,
};
