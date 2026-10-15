/**
 * Búsqueda de direcciones y lugares para la pestaña «Buscar» del mapa (consola web).
 *
 * - Autocompletado: Photon (datos OpenStreetMap). Se consulta desde el servidor
 *   (las consolas pueden estar en LAN sin internet) con caché compartida y
 *   espaciado mínimo entre peticiones: todas las consolas salen con la IP del
 *   servidor y el Photon público pide uso razonable.
 *   GEOCODER_URL permite apuntar a un Photon propio (p. ej. http://127.0.0.1:2322).
 * - Catálogo propio `geo_places`: ejidos y comunidades del RAN (funciona sin internet).
 */
import { query } from '../db.js';

const GEOCODER_URL = (process.env.GEOCODER_URL || 'https://photon.komoot.io')
  .trim()
  .replace(/\/$/, '');
const GEOCODER_ENABLED = String(process.env.GEOCODER_ENABLED ?? '1').trim() !== '0';
const TIMEOUT_MS = parseInt(process.env.GEOCODER_TIMEOUT_MS || '6000', 10);
/** Espaciado mínimo entre peticiones salientes (todas las consolas comparten IP). */
const MIN_GAP_MS = parseInt(process.env.GEOCODER_MIN_GAP_MS || '200', 10);
/** Si hay más de esto en cola, se responde vacío en vez de acumular. */
const MAX_QUEUE = 12;

/** Recuadro de México (lon/lat) para sesgar y filtrar resultados. */
const MX_BBOX = '-118.6,14.3,-86.5,32.8';

const CACHE_MAX = 3000;
const OK_TTL_MS = 24 * 60 * 60 * 1000;
const FAIL_TTL_MS = 15 * 1000;

/** @type {Map<string, { at: number, ttl: number, value: any }>} */
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return undefined;
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

let queueTail = Promise.resolve();
let queued = 0;
let lastAt = 0;

/** Serializa peticiones salientes con MIN_GAP_MS entre cada una. */
function throttled(fn) {
  if (queued >= MAX_QUEUE) return Promise.reject(new Error('geocoder_busy'));
  queued += 1;
  const run = queueTail.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    try {
      return await fn();
    } finally {
      queued -= 1;
    }
  });
  queueTail = run.catch(() => {});
  return run;
}

export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ#.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en']);

/** «SAN MATEO TLALTENANGO» → «San Mateo Tlaltenango». */
export function titleCaseEs(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi)\b/g, (m) => m.toUpperCase());
}

/* ------------------------------------------------------------------ Photon */

const HIGHWAY_ROAD = new Set(['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link']);

function photonKind(p) {
  const key = p.osm_key;
  const val = p.osm_value;
  const type = p.type;
  if (type === 'country') return 'pais';
  if (type === 'state') return 'estado';
  if (type === 'county') return 'municipio';
  if (key === 'place') {
    if (val === 'city') return 'ciudad';
    if (val === 'town') return 'ciudad';
    if (val === 'village') return 'pueblo';
    if (val === 'hamlet' || val === 'isolated_dwelling' || val === 'farm') return 'localidad';
    if (val === 'suburb' || val === 'neighbourhood' || val === 'quarter') return 'colonia';
    if (val === 'locality') return 'localidad';
  }
  if (type === 'city') return 'ciudad';
  if (type === 'district' || type === 'locality') return 'colonia';
  if (key === 'highway') return HIGHWAY_ROAD.has(val) ? 'carretera' : 'calle';
  if (type === 'street') return 'calle';
  if (type === 'house') return 'direccion';
  return 'lugar';
}

function photonFeatureToResult(f) {
  const p = f?.properties || {};
  const coords = f?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const kind = photonKind(p);
  let name = String(p.name || '').trim();
  if (p.housenumber && p.street) name = `${p.street} ${p.housenumber}`;
  else if (!name && p.street) name = String(p.street);
  if (!name) return null;

  const parts = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (!s) return;
    if (normalizeText(s) === normalizeText(name)) return;
    if (parts.some((x) => normalizeText(x) === normalizeText(s))) return;
    parts.push(s);
  };
  if (kind !== 'calle' && kind !== 'direccion' && p.street && !p.housenumber) push(p.street);
  push(p.district);
  push(p.locality);
  push(p.city);
  push(p.county);
  push(p.state);
  if (p.countrycode && p.countrycode !== 'MX') push(p.country);
  const detail = [parts.join(' · '), p.postcode ? `C.P. ${p.postcode}` : '']
    .filter(Boolean)
    .join(' · ');

  let bbox = null;
  if (Array.isArray(p.extent) && p.extent.length === 4) {
    const [minLng, maxLat, maxLng, minLat] = p.extent.map(Number);
    if ([minLng, maxLat, maxLng, minLat].every(Number.isFinite)) {
      bbox = [
        [Math.min(minLat, maxLat), Math.min(minLng, maxLng)],
        [Math.max(minLat, maxLat), Math.max(minLng, maxLng)],
      ];
    }
  }

  return {
    id: `osm:${p.osm_type || ''}${p.osm_id || `${lat},${lng}`}`,
    source: 'osm',
    kind,
    name,
    detail,
    lat,
    lng,
    bbox,
    countryCode: p.countrycode || null,
    road: p.osm_key === 'highway' ? p.osm_value : null,
  };
}

async function photonFetch(path) {
  const res = await fetch(`${GEOCODER_URL}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SICOM-TacticalPtx/1.0 (consola de despacho)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function dedupeResults(list) {
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const k = `${r.kind}|${normalizeText(r.name)}|${normalizeText(r.detail)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * @param {string} q
 * @param {{ lat?: number|null, lng?: number|null, world?: boolean, limit?: number }} opts
 */
async function searchPhoton(q, opts) {
  if (!GEOCODER_ENABLED) return { results: [], status: 'deshabilitado' };
  const limit = Math.min(Math.max(opts.limit || 8, 1), 15);
  const bias =
    Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
      ? `${opts.lat.toFixed(1)},${opts.lng.toFixed(1)}`
      : '';
  const key = `s:${opts.world ? 'w' : 'mx'}:${bias}:${normalizeText(q)}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const params = new URLSearchParams({ q, limit: String(opts.world ? limit : limit + 7), lang: 'default' });
  if (!opts.world) params.set('bbox', MX_BBOX);
  if (bias) {
    // Cercanía como desempate: ciudades/estados importantes no deben quedar tapados.
    params.set('lat', String(opts.lat));
    params.set('lon', String(opts.lng));
    params.set('zoom', '9');
    params.set('location_bias_scale', '0.6');
  }
  try {
    const data = await throttled(() => photonFetch(`/api/?${params}`));
    let results = (data?.features || []).map(photonFeatureToResult).filter(Boolean);
    if (!opts.world) results = results.filter((r) => !r.countryCode || r.countryCode === 'MX');
    results = dedupeResults(results).slice(0, limit);
    const value = { results, status: 'ok' };
    cacheSet(key, value, OK_TTL_MS);
    return value;
  } catch (err) {
    const status =
      err?.message === 'geocoder_busy'
        ? 'ocupado'
        : err?.name === 'TimeoutError' || err?.name === 'AbortError'
          ? 'timeout'
          : 'sin_servicio';
    const value = { results: [], status };
    if (status !== 'ocupado') cacheSet(key, value, FAIL_TTL_MS);
    return value;
  }
}

async function reversePhoton(lat, lng) {
  if (!GEOCODER_ENABLED) return null;
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1', lang: 'default' });
    const data = await throttled(() => photonFetch(`/reverse?${params}`));
    const r = photonFeatureToResult((data?.features || [])[0]);
    cacheSet(key, r, OK_TTL_MS);
    return r;
  } catch {
    return null;
  }
}

/* ------------------------------------------------- Catálogo propio (RAN) */

const LOCAL_KIND_WORDS = new Map([
  ['ejido', 'ejido'],
  ['ejidos', 'ejido'],
  ['ej', 'ejido'],
  ['ej.', 'ejido'],
  ['comunidad', 'comunidad'],
  ['comunidades', 'comunidad'],
]);

function localPlaceRow(r) {
  const detail = [r.municipality, r.state].filter(Boolean).join(' · ');
  const bbox =
    r.min_lat != null && r.max_lat != null
      ? [
          [Number(r.min_lat), Number(r.min_lng)],
          [Number(r.max_lat), Number(r.max_lng)],
        ]
      : null;
  return {
    id: `place:${r.id}`,
    placeId: String(r.id),
    source: r.source,
    kind: r.kind,
    name: r.name,
    detail,
    lat: Number(r.lat),
    lng: Number(r.lng),
    bbox,
    hasOutline: Boolean(r.has_outline),
  };
}

/**
 * Ejidos/comunidades: todas las palabras deben aparecer en nombre, municipio o estado.
 * «ejido» / «comunidad» en la consulta filtran por tipo.
 */
async function searchLocal(q, limit = 6) {
  const tokens = normalizeText(q).split(' ').filter(Boolean);
  let kind = null;
  const words = [];
  for (const t of tokens) {
    if (LOCAL_KIND_WORDS.has(t)) kind = LOCAL_KIND_WORDS.get(t);
    else words.push(t);
  }
  if (!words.length || words.join('').length < 2) return { results: [], forced: Boolean(kind) };
  const patterns = words.map((w) => `%${w.replace(/[%_\\]/g, '')}%`);
  const first = words[0];
  try {
    const { rows } = await query(
      `SELECT id, source, kind, name, municipality, state, lat, lng,
              min_lat, min_lng, max_lat, max_lng, (outline IS NOT NULL) AS has_outline
         FROM geo_places
        WHERE search_norm LIKE ALL($1::text[])
          AND name_norm LIKE ANY($1::text[])
          AND ($2::text IS NULL OR kind = $2)
        ORDER BY (name_norm LIKE $3) DESC, (name_norm LIKE ALL($1::text[])) DESC, LENGTH(name), name
        LIMIT $4`,
      [patterns, kind, `${first}%`, limit]
    );
    return { results: rows.map(localPlaceRow), forced: Boolean(kind) };
  } catch (err) {
    // Tabla aún sin migrar: la búsqueda en línea sigue funcionando.
    if (err?.code === '42P01') return { results: [], forced: Boolean(kind) };
    throw err;
  }
}

/**
 * @param {string} q
 * @param {{ lat?: number|null, lng?: number|null, world?: boolean }} opts
 */
export async function geoSearch(q, opts = {}) {
  const text = String(q || '').trim().slice(0, 160);
  if (text.length < 2) return { ok: true, results: [], status: 'ok' };
  const [local, remote] = await Promise.all([
    searchLocal(text, 6),
    text.length >= 3 ? searchPhoton(text, opts) : Promise.resolve({ results: [], status: 'ok' }),
  ]);
  let results;
  if (local.forced) {
    results = [...local.results, ...remote.results];
  } else {
    // Lo de OSM manda (más general); los ejidos se intercalan tras los 3 primeros.
    results = [...remote.results.slice(0, 3), ...local.results.slice(0, 4), ...remote.results.slice(3)];
  }
  return { ok: true, results: results.slice(0, 14), status: remote.status };
}

function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

async function localAt(lat, lng) {
  try {
    const { rows } = await query(
      `SELECT id, source, kind, name, municipality, state, lat, lng,
              min_lat, min_lng, max_lat, max_lng, outline, TRUE AS has_outline
         FROM geo_places
        WHERE min_lat <= $1 AND max_lat >= $1 AND min_lng <= $2 AND max_lng >= $2
        LIMIT 25`,
      [lat, lng]
    );
    for (const r of rows) {
      const rings = Array.isArray(r.outline) ? r.outline : [];
      if (rings.some((ring) => Array.isArray(ring) && pointInRing(lat, lng, ring))) {
        return localPlaceRow(r);
      }
    }
    return null;
  } catch (err) {
    if (err?.code === '42P01') return null;
    throw err;
  }
}

export async function geoReverse(lat, lng) {
  const [place, ejido] = await Promise.all([reversePhoton(lat, lng), localAt(lat, lng)]);
  return { ok: true, lat, lng, place, ejido };
}

export async function geoPlaceOutline(id) {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  try {
    const { rows } = await query('SELECT outline FROM geo_places WHERE id = $1', [n]);
    return rows[0]?.outline || null;
  } catch (err) {
    if (err?.code === '42P01') return null;
    throw err;
  }
}

export const geocoderInfo = {
  enabled: GEOCODER_ENABLED,
  baseUrl: GEOCODER_URL,
};
