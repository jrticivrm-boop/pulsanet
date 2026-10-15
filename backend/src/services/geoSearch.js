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
/** Espaciado mínimo entre arranques de peticiones a Photon (todas las consolas comparten IP). */
const MIN_GAP_MS = parseInt(process.env.GEOCODER_MIN_GAP_MS || '100', 10);
/**
 * Búsqueda completa (Enter): Nominatim es más preciso con «calle + número + colonia»,
 * pero su servicio público exige ≤ 1 petición/s y no admite autocompletado.
 */
const NOMINATIM_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org')
  .trim()
  .replace(/\/$/, '');
const NOMINATIM_ENABLED = String(process.env.NOMINATIM_ENABLED ?? '1').trim() !== '0';
const NOMINATIM_GAP_MS = parseInt(process.env.NOMINATIM_MIN_GAP_MS || '1100', 10);
const USER_AGENT = 'SICOM-TacticalPtx/1.0 (consola de despacho)';

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

function abortError() {
  const err = new Error('cancelado');
  err.name = 'AbortError';
  return err;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(id);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Espacia los ARRANQUES de peticiones (no espera a que termine la anterior).
 * Si quien pidió ya se fue (tecleó otra letra), su turno se descarta sin salir a internet.
 */
function makeLimiter(gapMs, maxPending) {
  let nextAt = 0;
  let pending = 0;
  return async function run(fn, signal) {
    if (pending >= maxPending) throw new Error('geocoder_busy');
    const now = Date.now();
    const slot = Math.max(now, nextAt);
    nextAt = slot + gapMs;
    pending += 1;
    try {
      if (slot > now) await sleep(slot - now, signal);
      if (signal?.aborted) throw abortError();
      return await fn();
    } finally {
      pending -= 1;
    }
  };
}

const photonLimiter = makeLimiter(MIN_GAP_MS, 40);
const nominatimLimiter = makeLimiter(NOMINATIM_GAP_MS, 4);

function withTimeout(signal) {
  const t = AbortSignal.timeout(TIMEOUT_MS);
  return signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([t, signal]) : t;
}

function errorStatus(err) {
  if (err?.message === 'geocoder_busy') return 'ocupado';
  if (err?.message === 'cancelado') return 'cancelado';
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'timeout';
  return 'sin_servicio';
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

/* --------------------------------------------- Código postal vs. estado */

/** Primeros 2 dígitos del C.P. por estado (SEPOMEX), clave ISO 3166-2:MX. */
const MX_POSTCODE_RANGES = {
  CMX: [1, 16], AGU: [20, 20], BCN: [21, 22], BCS: [23, 23], CAM: [24, 24], COA: [25, 27],
  COL: [28, 28], CHP: [29, 30], CHH: [31, 33], DUR: [34, 35], GUA: [36, 38], GRO: [39, 41],
  HID: [42, 43], JAL: [44, 49], MEX: [50, 57], MIC: [58, 61], MOR: [62, 62], NAY: [63, 63],
  NLE: [64, 67], OAX: [68, 71], PUE: [72, 75], QUE: [76, 76], ROO: [77, 77], SLP: [78, 79],
  SIN: [80, 82], SON: [83, 85], TAB: [86, 86], TAM: [87, 89], TLA: [90, 90], VER: [91, 96],
  YUC: [97, 97], ZAC: [98, 99],
};

const MX_STATE_BY_NAME = new Map(
  [
    ['aguascalientes', 'AGU'], ['baja california', 'BCN'], ['baja california sur', 'BCS'],
    ['campeche', 'CAM'], ['chiapas', 'CHP'], ['chihuahua', 'CHH'], ['ciudad de mexico', 'CMX'],
    ['distrito federal', 'CMX'], ['coahuila', 'COA'], ['coahuila de zaragoza', 'COA'],
    ['colima', 'COL'], ['durango', 'DUR'], ['guanajuato', 'GUA'], ['guerrero', 'GRO'],
    ['hidalgo', 'HID'], ['jalisco', 'JAL'], ['mexico', 'MEX'], ['estado de mexico', 'MEX'],
    ['michoacan', 'MIC'], ['michoacan de ocampo', 'MIC'], ['morelos', 'MOR'], ['nayarit', 'NAY'],
    ['nuevo leon', 'NLE'], ['oaxaca', 'OAX'], ['puebla', 'PUE'], ['queretaro', 'QUE'],
    ['queretaro de arteaga', 'QUE'], ['quintana roo', 'ROO'], ['san luis potosi', 'SLP'],
    ['sinaloa', 'SIN'], ['sonora', 'SON'], ['tabasco', 'TAB'], ['tamaulipas', 'TAM'],
    ['tlaxcala', 'TLA'], ['veracruz', 'VER'], ['veracruz de ignacio de la llave', 'VER'],
    ['yucatan', 'YUC'], ['zacatecas', 'ZAC'],
  ]
);

function mxStateCode(state, iso) {
  const m = String(iso || '').match(/^MX-([A-Z]{3})$/);
  if (m) return m[1] === 'DIF' ? 'CMX' : m[1];
  return MX_STATE_BY_NAME.get(normalizeText(state)) || null;
}

/**
 * OSM casi nunca etiqueta el C.P. en calles: Nominatim/Photon lo calculan con las direcciones
 * más cercanas y en límites estatales cae el de enfrente (p. ej. Tampico 89080 en Pueblo Viejo, Ver.).
 * Se devuelve solo un C.P. coherente con el estado; si ninguno lo es, null (no se muestra).
 */
export function coherentPostcode(postcode, { state, iso, countryCode } = {}) {
  const raw = String(postcode || '').trim();
  if (!raw) return null;
  if (countryCode && String(countryCode).toUpperCase() !== 'MX') return raw;
  const code = mxStateCode(state, iso);
  const range = code ? MX_POSTCODE_RANGES[code] : null;
  for (const pc of raw.split(/[;,]/).map((s) => s.trim())) {
    if (!/^\d{5}$/.test(pc)) continue;
    const prefix = Number(pc.slice(0, 2));
    if (!range || (prefix >= range[0] && prefix <= range[1])) return pc;
  }
  return null;
}

/* ------------------------------------------------- Interpretar la consulta */

/** Abreviaturas comunes en direcciones de México. */
const ABBREVIATIONS = [
  [/\bav(?:da)?\.?(?=\s)/gi, 'avenida'],
  [/\bcalz\.?(?=\s)/gi, 'calzada'],
  [/\bblvd?\.?(?=\s)/gi, 'boulevard'],
  [/\bprol\.?(?=\s)/gi, 'prolongación'],
  [/\bcarr\.?(?=\s)/gi, 'carretera'],
  [/\bfracc?\.?(?=\s)/gi, 'fraccionamiento'],
  [/\bcol\.?(?=\s)/gi, 'colonia'],
  [/\bcdmx\b/gi, 'ciudad de méxico'],
  [/\bedomex\b/gi, 'estado de méxico'],
  [/\bno\.\s*(?=\d)/gi, ''],
  [/#\s*(?=\d)/g, ''],
];

const POSTCODE_RE = /^(?:c\.?\s*p\.?\s*)?(\d{5})$/i;

/**
 * @returns {{ text: string, words: string[], houseNumber: string|null, postcode: string|null }}
 */
export function prepareQuery(raw) {
  const trimmed = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 160);
  const pc = trimmed.match(POSTCODE_RE);
  if (pc) return { text: trimmed, words: [], houseNumber: null, postcode: pc[1] };
  let text = ` ${trimmed} `;
  for (const [re, rep] of ABBREVIATIONS) text = text.replace(re, rep);
  text = text.replace(/\s+/g, ' ').trim();
  let postcode = null;
  const pcInside = text.match(/(?:c\.?\s*p\.?\s*)(\d{5})\b/i);
  if (pcInside) postcode = pcInside[1];
  const norm = normalizeText(text);
  const tokens = norm.split(' ').filter(Boolean);
  const houseNumber =
    tokens.find((t) => /^\d{1,5}[a-z]?$/.test(t) && t !== postcode && !/^\d{5}$/.test(t)) || null;
  const words = tokens.filter((t) => !/^\d/.test(t) && t.length > 1);
  return { text, words, houseNumber, postcode };
}

/** Prioriza coincidencias reales del nombre sin romper el orden de relevancia de OSM. */
function rerank(results, prep) {
  if (!prep.words.length) return results;
  const first = prep.words[0];
  return results
    .map((r, i) => {
      const name = normalizeText(r.name);
      let score = i;
      if (prep.words.every((w) => name.includes(w))) score -= 3;
      if (name.startsWith(first) || name.includes(` ${first}`)) score -= 1.5;
      if (prep.houseNumber && r.houseNumber === prep.houseNumber) score -= 4;
      return { r, score };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.r);
}

/** Una calle partida en tramos sale una sola vez por municipio/ciudad. */
function dedupeResults(list) {
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const street = (r.kind === 'calle' || r.kind === 'carretera') && !r.houseNumber;
    const k = street
      ? `${r.kind}|${normalizeText(r.name)}|${normalizeText(r.area)}`
      : `${r.kind}|${normalizeText(r.name)}|${normalizeText(r.detail)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Si pidió número exterior y el resultado es la calle sin número, se avisa que es aproximado. */
function markApprox(results, prep) {
  if (!prep.houseNumber) return results;
  return results.map((r) =>
    r.kind === 'calle' && !r.houseNumber ? { ...r, approx: true } : r
  );
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
  const postcode = coherentPostcode(p.postcode, { state: p.state, countryCode: p.countrycode });
  const detail = [parts.join(' · '), postcode ? `C.P. ${postcode}` : '']
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
    houseNumber: p.housenumber ? String(p.housenumber).toLowerCase() : null,
    area: p.city || p.county || p.state || '',
  };
}

async function jsonFetch(url, signal) {
  const res = await fetch(url, {
    signal: withTimeout(signal),
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {ReturnType<typeof prepareQuery>} prep
 * @param {{ lat?: number|null, lng?: number|null, world?: boolean, limit?: number, signal?: AbortSignal }} opts
 */
async function searchPhoton(prep, opts) {
  if (!GEOCODER_ENABLED) return { results: [], status: 'deshabilitado' };
  const q = prep.text;
  const limit = Math.min(Math.max(opts.limit || 8, 1), 15);
  const bias =
    Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
      ? `${opts.lat.toFixed(1)},${opts.lng.toFixed(1)}`
      : '';
  const key = `s:${opts.world ? 'w' : 'mx'}:${bias}:${normalizeText(q)}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const params = new URLSearchParams({ q, limit: String(opts.world ? limit + 4 : limit + 8), lang: 'default' });
  if (!opts.world) params.set('bbox', MX_BBOX);
  if (bias) {
    // Cercanía como desempate: ciudades/estados importantes no deben quedar tapados.
    params.set('lat', String(opts.lat));
    params.set('lon', String(opts.lng));
    params.set('zoom', '9');
    params.set('location_bias_scale', '0.6');
  }
  try {
    const data = await photonLimiter(
      () => jsonFetch(`${GEOCODER_URL}/api/?${params}`, opts.signal),
      opts.signal
    );
    let results = (data?.features || []).map(photonFeatureToResult).filter(Boolean);
    if (!opts.world) results = results.filter((r) => !r.countryCode || r.countryCode === 'MX');
    results = markApprox(dedupeResults(rerank(results, prep)), prep).slice(0, limit);
    const value = { results, status: 'ok' };
    cacheSet(key, value, OK_TTL_MS);
    return value;
  } catch (err) {
    const status = errorStatus(opts.signal?.aborted ? { message: 'cancelado' } : err);
    const value = { results: [], status };
    if (status === 'timeout' || status === 'sin_servicio') cacheSet(key, value, FAIL_TTL_MS);
    return value;
  }
}

/* --------------------------------------------- Nominatim (búsqueda completa) */

function nominatimKind(r) {
  const t = r.addresstype || r.type;
  const a = r.address || {};
  if (a.house_number) return 'direccion';
  if (t === 'country') return 'pais';
  if (t === 'state') return 'estado';
  if (t === 'municipality' || t === 'county') return 'municipio';
  if (t === 'city' || t === 'town') return 'ciudad';
  if (t === 'village') return 'pueblo';
  if (t === 'hamlet' || t === 'isolated_dwelling' || t === 'farm' || t === 'locality') return 'localidad';
  if (t === 'suburb' || t === 'neighbourhood' || t === 'quarter' || t === 'city_district') return 'colonia';
  if (t === 'postcode') return 'colonia';
  if (r.category === 'highway' || t === 'road') {
    return HIGHWAY_ROAD.has(r.type) ? 'carretera' : 'calle';
  }
  return 'lugar';
}

function nominatimToResult(r) {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = r.address || {};
  const kind = nominatimKind(r);
  let name = String(r.name || '').trim();
  if (a.house_number && a.road) name = `${a.road} ${a.house_number}`;
  else if (!name) name = a.road || String(r.display_name || '').split(',')[0].trim();
  if (!name) return null;
  const postcode = coherentPostcode(a.postcode, {
    state: a.state,
    iso: a['ISO3166-2-lvl4'],
    countryCode: a.country_code,
  });
  if (r.addresstype === 'postcode' && a.postcode && !postcode) return null;
  if (r.addresstype === 'postcode' && /^\d{5}$/.test(name)) name = `C.P. ${name}`;
  const city = a.city || a.town || a.village || a.hamlet || '';
  const parts = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (!s || normalizeText(s) === normalizeText(name)) return;
    if (parts.some((x) => normalizeText(x) === normalizeText(s))) return;
    parts.push(s);
  };
  if (!a.house_number && a.road && kind !== 'calle') push(a.road);
  push(a.neighbourhood || a.suburb || a.quarter);
  push(city);
  push(a.municipality || a.county || a.city_district);
  push(a.state);
  if (a.country_code && a.country_code !== 'mx') push(a.country);
  const detail = [parts.join(' · '), postcode ? `C.P. ${postcode}` : ''].filter(Boolean).join(' · ');
  let bbox = null;
  if (Array.isArray(r.boundingbox) && r.boundingbox.length === 4) {
    const [minLat, maxLat, minLng, maxLng] = r.boundingbox.map(Number);
    if ([minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
      bbox = [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }
  }
  return {
    id: `osm:${String(r.osm_type || '').charAt(0).toUpperCase()}${r.osm_id || `${lat},${lng}`}`,
    source: 'osm',
    kind,
    name,
    detail,
    lat,
    lng,
    bbox: kind === 'direccion' ? null : bbox,
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
    houseNumber: a.house_number ? String(a.house_number).toLowerCase() : null,
    area: city || a.municipality || a.county || a.state || '',
  };
}

/**
 * Enter / «Buscar dirección completa» y búsqueda por código postal.
 * @param {ReturnType<typeof prepareQuery>} prep
 */
async function searchNominatim(prep, opts) {
  if (!NOMINATIM_ENABLED) return { results: [], status: 'deshabilitado' };
  const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '8' });
  if (prep.postcode && !prep.words.length) params.set('postalcode', prep.postcode);
  else params.set('q', prep.text);
  if (!opts.world) params.set('countrycodes', 'mx');
  if (Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    const d = 1.5;
    params.set('viewbox', `${opts.lng - d},${opts.lat + d},${opts.lng + d},${opts.lat - d}`);
  }
  const key = `n:${params}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };
  try {
    const data = await nominatimLimiter(
      () => jsonFetch(`${NOMINATIM_URL}/search?${params}`, opts.signal),
      opts.signal
    );
    const results = markApprox(
      dedupeResults(rerank((Array.isArray(data) ? data : []).map(nominatimToResult).filter(Boolean), prep)),
      prep
    );
    const value = { results, status: 'ok' };
    cacheSet(key, value, OK_TTL_MS);
    return value;
  } catch (err) {
    const status = errorStatus(opts.signal?.aborted ? { message: 'cancelado' } : err);
    return { results: [], status };
  }
}

async function reversePhoton(lat, lng) {
  if (!GEOCODER_ENABLED) return null;
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1', lang: 'default' });
    const data = await photonLimiter(() => jsonFetch(`${GEOCODER_URL}/reverse?${params}`));
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
 * La consola pide por partes para mostrar algo de inmediato:
 *  - `local`: ejidos/comunidades del catálogo propio (milisegundos).
 *  - `osm`: autocompletado Photon (≈ 1 s con el servicio público).
 *  - `full`: Enter / «dirección completa»: Nominatim + Photon (más preciso con número exterior).
 *  - sin `src`: local + osm combinados (compatibilidad).
 * @param {string} q
 * @param {{ lat?: number|null, lng?: number|null, world?: boolean, src?: string, signal?: AbortSignal }} opts
 */
export async function geoSearch(q, opts = {}) {
  const prep = prepareQuery(q);
  const text = prep.text;
  if (text.length < 2) return { ok: true, results: [], status: 'ok' };
  const src = opts.src || 'all';

  if (src === 'local') {
    const local = await searchLocal(text, 6);
    return { ok: true, results: local.results, forced: local.forced, status: 'ok' };
  }

  if (src === 'osm') {
    // Solo código postal: Photon no lo resuelve bien; se usa Nominatim (una consulta).
    const remote = prep.postcode && !prep.words.length
      ? await searchNominatim(prep, opts)
      : text.length >= 3
        ? await searchPhoton(prep, opts)
        : { results: [], status: 'ok' };
    return { ok: true, results: remote.results, status: remote.status };
  }

  if (src === 'full') {
    const [nom, pho] = await Promise.all([searchNominatim(prep, opts), searchPhoton(prep, opts)]);
    const near = (a, b) => Math.abs(a.lat - b.lat) < 0.0015 && Math.abs(a.lng - b.lng) < 0.0015;
    const merged = [...nom.results];
    for (const r of pho.results) {
      if (!merged.some((m) => normalizeText(m.name) === normalizeText(r.name) && near(m, r))) merged.push(r);
    }
    const status = nom.status === 'ok' || pho.status === 'ok' ? 'ok' : nom.status;
    return { ok: true, results: rerank(merged, prep).slice(0, 14), status };
  }

  const [local, remote] = await Promise.all([
    searchLocal(text, 6),
    text.length >= 3 ? searchPhoton(prep, opts) : Promise.resolve({ results: [], status: 'ok' }),
  ]);
  const results = local.forced
    ? [...local.results, ...remote.results]
    : [...remote.results.slice(0, 3), ...local.results.slice(0, 4), ...remote.results.slice(3)];
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
