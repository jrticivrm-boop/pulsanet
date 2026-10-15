/**
 * Ruta probable por calles entre dos puntos (para los huecos de señal).
 *
 * Se resuelve en el backend, no en el navegador, porque:
 *  - El Host suele tener internet aunque las consolas estén en LAN aislada.
 *  - La caché es compartida por todas las consolas (el mapa repolla la ruta).
 *  - Un OSRM propio se configura en un solo lugar (ROUTING_OSRM_URL).
 *
 * Orden de intento:
 *  1) ROUTING_OSRM_URL (OSRM propio en LAN — preferido para producto militar).
 *  2) ROUTING_OSRM_FALLBACKS (lista CSV opcional).
 *  3) Demos públicos OSRM (solo si no hay URL propia, o como último recurso).
 *
 * Si ningún OSRM da geometría vial, se devuelve un corredor estimado multi-punto
 * (dead-reckoning con rumbo de aproximación + destino), NUNCA la cuerda A→B
 * de 2 vértices. El mapa lo pinta naranja punteado como «estimado».
 */

/** OSRM propio primero. */
const PRIMARY = (process.env.ROUTING_OSRM_URL || '').trim().replace(/\/$/, '');
const EXTRA_FALLBACKS = String(process.env.ROUTING_OSRM_FALLBACKS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
/** Demos públicos: útiles con Host con internet; en LAN aislada fallan y cae el estimado. */
const PUBLIC_DEMOS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
];

function buildOsrmBases() {
  const out = [];
  const seen = new Set();
  const push = (u) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  push(PRIMARY);
  EXTRA_FALLBACKS.forEach(push);
  // Con OSRM propio no quemamos tiempo en demos salvo que se pida explícitamente.
  const allowPublic =
    !PRIMARY || String(process.env.ROUTING_OSRM_ALLOW_PUBLIC || '').trim() === '1';
  if (allowPublic) PUBLIC_DEMOS.forEach(push);
  if (!out.length) PUBLIC_DEMOS.forEach(push);
  return out;
}

const OSRM_BASES = buildOsrmBases();
const ROUTING_ENABLED = String(process.env.ROUTING_ENABLED ?? '1').trim() !== '0';
/**
 * El demo público en frío puede tardar; dar margen.
 * Con OSRM propio se puede bajar ROUTING_TIMEOUT_MS.
 */
const TIMEOUT_MS = parseInt(process.env.ROUTING_TIMEOUT_MS || '20000', 10);
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
 * bloqueaban los reintentos del mapa.
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

function cacheKey(from, to, heading) {
  const r = (n) => n.toFixed(4);
  const h =
    heading != null && Number.isFinite(Number(heading))
      ? `:h${Math.round(Number(heading))}`
      : '';
  return `${PROFILE}:${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}${h}`;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return null;
  }
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

function haversineM(a, b) {
  return haversineKm(a, b) * 1000;
}

/** Destino a `distM` metros desde `from` con rumbo `bearingDeg`. */
function destinationPoint(from, bearingDeg, distM) {
  const R = 6_371_000;
  const δ = distM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (from.lat * Math.PI) / 180;
  const λ1 = (from.lng * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return {
    lat: (φ2 * 180) / Math.PI,
    lng: ((((λ2 * 180) / Math.PI + 540) % 360) - 180),
  };
}

function bearingBetween(a, b) {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Corredor estimado multi-punto: sigue un tramo el rumbo de aproximación y
 * luego curva hacia el destino (Bezier cuadrática). Evita la cuerda A→B de
 * 2 vértices que atraviesa campo como si fuera vialidad.
 *
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @param {number|null|undefined} headingDeg
 * @returns {[number, number][]}
 */
export function estimateCorridor(from, to, headingDeg) {
  const spanM = haversineM(from, to);
  if (!(spanM > 0) || !Number.isFinite(spanM)) {
    return [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ];
  }

  const directBrng = bearingBetween(from, to);
  const approach =
    headingDeg != null && Number.isFinite(Number(headingDeg))
      ? Number(headingDeg)
      : directBrng;

  // Control: avanza en el rumbo previo una fracción del salto (tope 4 km).
  const leadM = Math.min(Math.max(spanM * 0.28, 180), 4_000);
  const ctrl = destinationPoint(from, approach, leadM);

  const steps = Math.min(48, Math.max(8, Math.ceil(spanM / 450)));
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const omt = 1 - t;
    const lat =
      omt * omt * from.lat + 2 * omt * t * ctrl.lat + t * t * to.lat;
    const lng =
      omt * omt * from.lng + 2 * omt * t * ctrl.lng + t * t * to.lng;
    out.push([lat, lng]);
  }
  out[0] = [from.lat, from.lng];
  out[out.length - 1] = [to.lat, to.lng];
  return out;
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

function estimateFallback(from, to, headingDeg, reason) {
  const points = estimateCorridor(from, to, headingDeg);
  return {
    ok: true,
    estimated: true,
    reason,
    source: 'estimate',
    points,
    distanceM: Math.round(haversineM(from, to)),
    durationS: null,
  };
}

function buildOsrmUrl(base, from, to) {
  // OSRM espera lon,lat. `overview=full` y se diezma aquí: mejor forma que `simplified`.
  //  - profile driving respeta one-way / doble sentido.
  //  - continue_straight=false: deja elegir el giro válido más natural.
  //  - snapping=any: engancha al segmento vial más cercano.
  return (
    `${base}/route/v1/${encodeURIComponent(PROFILE)}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false` +
    `&annotations=false&continue_straight=false&snapping=any`
  );
}

async function fetchOsrmOnce(base, from, to, timeoutMs) {
  const res = await fetch(buildOsrmUrl(base, from, to), {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (data?.code !== 'Ok' || !Array.isArray(coords) || coords.length < 2) {
    return { estimated: true, reason: 'sin_ruta', points: [] };
  }
  const distanceM = Math.round(Number(route.distance) || 0);
  const straightM = Math.round(haversineM(from, to));
  // Solo 2 vértices en un salto largo ≈ cuerda A→B (no es red vial usable).
  if (coords.length < 3 && straightM >= MIN_SHAPE_SPAN_M) {
    return { estimated: true, reason: 'ruta_sin_forma', points: [] };
  }
  return {
    ok: true,
    estimated: false,
    source: 'osrm',
    points: thin(coords.map(([lng, lat]) => [lat, lng])),
    distanceM,
    durationS: Math.round(Number(route.duration) || 0),
    base,
  };
}

/**
 * Prueba cada base OSRM hasta obtener geometría vial con forma.
 * @returns {Promise<object|null>}
 */
async function fetchOsrmAny(from, to) {
  const perBase = Math.max(
    4_000,
    Math.floor(TIMEOUT_MS / Math.max(1, OSRM_BASES.length))
  );
  let lastReason = 'sin_servicio';
  for (const base of OSRM_BASES) {
    try {
      const value = await fetchOsrmOnce(base, from, to, perBase);
      if (!value.estimated && value.points?.length >= 2) return value;
      lastReason = value.reason || lastReason;
    } catch (err) {
      const timedOut =
        err?.name === 'TimeoutError' || err?.name === 'AbortError';
      lastReason = timedOut ? 'timeout' : 'sin_servicio';
    }
  }
  return { estimated: true, reason: lastReason, points: [] };
}

/**
 * @param {{ lat: number, lng: number }} from  último fix conocido
 * @param {{ lat: number, lng: number }} to    primer fix al reconectar
 * @param {{ headingDeg?: number|null }} [opts]
 * @returns {Promise<{ ok: boolean, estimated: boolean, points: [number,number][], source: string, distanceM: number|null, durationS: number|null, reason?: string }>}
 */
export async function routeBetween(from, to, opts = {}) {
  const headingDeg =
    opts.headingDeg != null && Number.isFinite(Number(opts.headingDeg))
      ? Number(opts.headingDeg)
      : null;
  const spanKm = haversineKm(from, to);
  if (spanKm > MAX_SPAN_KM) {
    return estimateFallback(from, to, headingDeg, 'salto_fuera_de_rango');
  }
  if (!ROUTING_ENABLED) {
    return estimateFallback(from, to, headingDeg, 'routing_deshabilitado');
  }

  const key = cacheKey(from, to, headingDeg);
  const cached = cacheGet(key);
  // Reutilizar rutas reales OSRM; el estimado se puede refrescar si vuelve el servicio.
  if (cached && !cached.estimated && cached.source === 'osrm') {
    return { ...cached, cached: true };
  }

  try {
    let value = await fetchOsrmAny(from, to);
    if (value.estimated) {
      // Un reintento corto en la primera base (arranque en frío del demo).
      if (OSRM_BASES.length) {
        await new Promise((r) => setTimeout(r, 350));
        try {
          const retry = await fetchOsrmOnce(
            OSRM_BASES[0],
            from,
            to,
            Math.min(TIMEOUT_MS, 12_000)
          );
          if (!retry.estimated) value = retry;
        } catch {
          /* sigue al estimado */
        }
      }
    }
    if (!value.estimated) {
      cacheSet(key, value, OK_TTL_MS);
      return value;
    }
    const estimate = estimateFallback(from, to, headingDeg, value.reason || 'sin_servicio');
    cacheSet(key, estimate, FAIL_TTL_MS);
    return estimate;
  } catch (err) {
    const timedOut =
      err?.name === 'TimeoutError' || err?.name === 'AbortError';
    const estimate = estimateFallback(
      from,
      to,
      headingDeg,
      timedOut ? 'timeout' : 'sin_servicio'
    );
    cacheSet(key, estimate, FAIL_TTL_MS);
    return estimate;
  }
}

/* ------------------------------------------- Ruta A → B (pestaña «Ruta») */

const PLAN_TTL_MS = 30 * 60 * 1000;
const PLAN_MAX_POINTS = 1500;
/** Paradas intermedias entre A y B (el enlace de Google Maps admite 9). */
export const PLAN_MAX_STOPS = 9;
/** «¿Quién llega primero?»: operadores por consulta (los más cercanos en línea recta). */
export const ETA_MAX_ORIGINS = 25;
const ETA_TTL_MS = 60 * 1000;

function isPublicBase(base) {
  return PUBLIC_DEMOS.includes(base);
}

/** Vías principales del recorrido (las de más kilómetros). */
function mainRoads(route) {
  const km = new Map();
  for (const leg of route.legs || []) {
    for (const s of leg.steps || []) {
      const name = String(s.name || s.ref || '').trim();
      if (!name) continue;
      km.set(name, (km.get(name) || 0) + (Number(s.distance) || 0));
    }
  }
  return [...km.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n);
}

function coordList(points) {
  return points.map((p) => `${p.lng},${p.lat}`).join(';');
}

async function fetchPlanOnce(base, points, timeoutMs) {
  // OSRM solo calcula alternativas entre 2 puntos.
  const alternatives = points.length === 2 ? '2' : 'false';
  const url =
    `${base}/route/v1/${encodeURIComponent(PROFILE)}/${coordList(points)}` +
    `?overview=full&geometries=geojson&alternatives=${alternatives}&steps=true&annotations=false`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) {
    return { ok: false, reason: 'sin_ruta' };
  }
  const routes = data.routes
    .map((r) => ({
      distanceM: Math.round(Number(r.distance) || 0),
      durationS: Math.round(Number(r.duration) || 0),
      via: mainRoads(r),
      points: thin(
        (r.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
        PLAN_MAX_POINTS
      ),
      legs: (r.legs || []).map((l) => ({
        distanceM: Math.round(Number(l.distance) || 0),
        durationS: Math.round(Number(l.duration) || 0),
      })),
    }))
    .filter((r) => r.points.length >= 2);
  if (!routes.length) return { ok: false, reason: 'sin_ruta' };
  return {
    ok: true,
    source: isPublicBase(base) ? 'publico' : 'propio',
    // Metros entre cada punto pedido y el camino donde OSRM lo «pegó».
    snapM: (data.waypoints || []).map((w) => Math.round(Number(w.distance) || 0)),
    routes,
  };
}

/**
 * Cómo llegar en vehículo de A a B, con paradas intermedias opcionales.
 * Entre 2 puntos: ruta recomendada (la más rápida) y hasta 2 alternativas.
 * Tiempos sin tráfico en tiempo real.
 * @param {Array<{ lat: number, lng: number }>} points A, paradas…, B
 */
export async function routeOptions(points) {
  if (!ROUTING_ENABLED) return { ok: false, reason: 'routing_deshabilitado' };
  if (!Array.isArray(points) || points.length < 2) return { ok: false, reason: 'sin_ruta' };
  for (let i = 1; i < points.length; i++) {
    if (haversineKm(points[i - 1], points[i]) > MAX_SPAN_KM) return { ok: false, reason: 'fuera_de_rango' };
  }
  const r5 = (n) => n.toFixed(5);
  const key = `plan:${PROFILE}:${points.map((p) => `${r5(p.lat)},${r5(p.lng)}`).join('>')}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };
  const perBase = Math.max(6_000, Math.floor(TIMEOUT_MS / Math.max(1, OSRM_BASES.length)));
  let reason = 'sin_servicio';
  for (const base of OSRM_BASES) {
    try {
      const value = await fetchPlanOnce(base, points, perBase);
      if (value.ok) {
        cacheSet(key, value, PLAN_TTL_MS);
        return value;
      }
      reason = value.reason || reason;
      if (reason === 'sin_ruta') break;
    } catch (err) {
      reason = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'sin_servicio';
    }
  }
  return { ok: false, reason };
}

async function fetchEtaOnce(base, to, origins, timeoutMs) {
  const sources = origins.map((_, i) => i).join(';');
  const url =
    `${base}/table/v1/${encodeURIComponent(PROFILE)}/${coordList([...origins, to])}` +
    `?sources=${sources}&destinations=${origins.length}&annotations=duration,distance`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.code !== 'Ok' || !Array.isArray(data.durations)) return { ok: false, reason: 'sin_ruta' };
  const results = origins.map((o, i) => {
    const d = data.durations[i]?.[0];
    const m = data.distances?.[i]?.[0];
    return {
      id: o.id,
      durationS: Number.isFinite(d) ? Math.round(d) : null,
      distanceM: Number.isFinite(m) ? Math.round(m) : null,
      snapM: Math.round(Number(data.sources?.[i]?.distance) || 0),
    };
  });
  return {
    ok: true,
    source: isPublicBase(base) ? 'publico' : 'propio',
    destSnapM: Math.round(Number(data.destinations?.[0]?.distance) || 0),
    results,
  };
}

/**
 * «¿Quién llega primero?»: tiempo y distancia por carretera de cada origen hasta `to`
 * (una sola consulta /table de OSRM).
 * @param {{ lat: number, lng: number }} to
 * @param {Array<{ id: string, lat: number, lng: number }>} origins
 */
export async function routeEta(to, origins) {
  if (!ROUTING_ENABLED) return { ok: false, reason: 'routing_deshabilitado' };
  const list = (origins || []).slice(0, ETA_MAX_ORIGINS);
  if (!list.length) return { ok: true, source: null, destSnapM: 0, results: [] };
  const r4 = (n) => n.toFixed(4);
  const key = `eta:${PROFILE}:${r4(to.lat)},${r4(to.lng)}<${list.map((o) => `${o.id}@${r4(o.lat)},${r4(o.lng)}`).join('|')}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };
  const perBase = Math.max(6_000, Math.floor(TIMEOUT_MS / Math.max(1, OSRM_BASES.length)));
  let reason = 'sin_servicio';
  for (const base of OSRM_BASES) {
    try {
      const value = await fetchEtaOnce(base, to, list, perBase);
      if (value.ok) {
        cacheSet(key, value, ETA_TTL_MS);
        return value;
      }
      reason = value.reason || reason;
    } catch (err) {
      reason = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'sin_servicio';
    }
  }
  return { ok: false, reason };
}

/** Servidor de rutas propio: ¿responde? y fecha del mapa (si se procesó con --data_version=osmosis). */
export async function ownRoutingStatus() {
  if (!PRIMARY) return { configurado: false };
  try {
    const r = await fetch(`${PRIMARY}/nearest/v1/driving/-99.13,19.43?number=1`, { signal: AbortSignal.timeout(2000) });
    const j = await r.json();
    return { configurado: true, ok: j?.code === 'Ok', fecha: j?.data_version || null };
  } catch {
    return { configurado: true, ok: false, fecha: null };
  }
}

export const routingInfo = {
  enabled: ROUTING_ENABLED,
  baseUrl: OSRM_BASES[0] || '',
  bases: OSRM_BASES,
  profile: PROFILE,
};
