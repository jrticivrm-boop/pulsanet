/**
 * Búsqueda de direcciones y lugares para la pestaña «Buscar» del mapa (consola web).
 *
 * - Autocompletado: Photon (datos OpenStreetMap). Se consulta desde el servidor
 *   (las consolas pueden estar en LAN sin internet) con caché compartida y
 *   espaciado mínimo entre peticiones: todas las consolas salen con la IP del
 *   servidor y el Photon público pide uso razonable.
 *   GEOCODER_URL es el Photon principal (público por defecto); GEOCODER_LOCAL_URL el Photon
 *   propio de México en la red de SICOM (p. ej. http://photon:2322), que responde sin internet.
 * - Catálogo propio `geo_places`: ejidos y comunidades del RAN (funciona sin internet).
 */
import { query } from '../db.js';

const GEOCODER_URL = (process.env.GEOCODER_URL || 'https://photon.komoot.io')
  .trim()
  .replace(/\/$/, '');
const GEOCODER_ENABLED = String(process.env.GEOCODER_ENABLED ?? '1').trim() !== '0';
const TIMEOUT_MS = parseInt(process.env.GEOCODER_TIMEOUT_MS || '2500', 10);
/** Photon propio (solo México, se actualiza cada semana): respaldo cuando no hay internet. */
const GEOCODER_LOCAL_URL = String(process.env.GEOCODER_LOCAL_URL || '')
  .trim()
  .replace(/\/$/, '');
const LOCAL_TIMEOUT_MS = parseInt(process.env.GEOCODER_LOCAL_TIMEOUT_MS || '3000', 10);
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

const PHOTON_DOWN_MS = 60_000;
/** Photon público (principal, el más actualizado) y Photon propio en la red de SICOM (respaldo sin internet). */
const PHOTON_PUBLIC = GEOCODER_ENABLED
  ? { name: 'publico', url: GEOCODER_URL, timeoutMs: TIMEOUT_MS, limiter: makeLimiter(MIN_GAP_MS, 40), downUntil: 0, local: false }
  : null;
const PHOTON_LOCAL = GEOCODER_LOCAL_URL
  ? { name: 'propio', url: GEOCODER_LOCAL_URL, timeoutMs: LOCAL_TIMEOUT_MS, limiter: makeLimiter(0, 80), downUntil: 0, local: true }
  : null;
const nominatimLimiter = makeLimiter(NOMINATIM_GAP_MS, 4);

function withTimeout(signal, timeoutMs = TIMEOUT_MS) {
  const t = AbortSignal.timeout(timeoutMs);
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

function postcodeInState(cp, code) {
  const range = code ? MX_POSTCODE_RANGES[code] : null;
  if (!range) return true;
  const prefix = Number(String(cp).slice(0, 2));
  return prefix >= range[0] && prefix <= range[1];
}

/* ------------------------ Código postal: SEPOMEX + DENUE (nunca el de OSM) */
/*
 * OSM casi nunca etiqueta el C.P.: Nominatim/Photon lo calculan con la dirección más cercana
 * que sí lo tenga (p. ej. 89080 de Tampico en Pueblo Viejo, Ver., o en la Zona Centro de Tampico,
 * que es 89000). En México el C.P. se toma de:
 *  1) Ubicación: C.P. que declaran los negocios del DENUE alrededor del punto (`mx_postcode_grid`).
 *  2) Nombre: colonia/localidad + municipio en el catálogo SEPOMEX (`mx_postcodes`).
 * Si no se puede determinar, no se muestra C.P.
 */

/** Clave INEGI del estado (la que usan SEPOMEX y DENUE). */
const INEGI_STATE = {
  AGU: 1, BCN: 2, BCS: 3, CAM: 4, COA: 5, COL: 6, CHP: 7, CHH: 8, CMX: 9, DUR: 10, GUA: 11,
  GRO: 12, HID: 13, JAL: 14, MEX: 15, MIC: 16, MOR: 17, NAY: 18, NLE: 19, OAX: 20, PUE: 21,
  QUE: 22, ROO: 23, SLP: 24, SIN: 25, SON: 26, TAB: 27, TAM: 28, TLA: 29, VER: 30, YUC: 31, ZAC: 32,
};

/** Tipos de resultado donde el C.P. tiene sentido (en una ciudad entera o un estado, no). */
const POSTCODE_KINDS = new Set(['calle', 'direccion', 'colonia', 'localidad', 'pueblo', 'lugar']);

const PC_CACHE_MAX = 2000;
/** @type {Map<string, any>} */
const pcCache = new Map();
async function pcCached(key, fn) {
  if (pcCache.has(key)) {
    const v = pcCache.get(key);
    pcCache.delete(key);
    pcCache.set(key, v);
    return v;
  }
  const v = await fn();
  pcCache.set(key, v);
  while (pcCache.size > PC_CACHE_MAX) pcCache.delete(pcCache.keys().next().value);
  return v;
}

function tableMissing(err) {
  return err?.code === '42P01';
}

/**
 * Votos por C.P. de los negocios en un radio de `r` celdas (~110 m c/u); pesan más los cercanos.
 * @returns {Promise<{ votes: [string, number][], points: number }>}
 */
async function gridVotes(lat, lng, r) {
  const la = Math.round(lat * 1000);
  const lo = Math.round(lng * 1000);
  return pcCached(`g:${la},${lo},${r}`, async () => {
    const { rows } = await query(
      `SELECT lat_i, lng_i, cp, n FROM mx_postcode_grid
        WHERE lat_i BETWEEN $1 AND $2 AND lng_i BETWEEN $3 AND $4`,
      [la - r, la + r, lo - r, lo + r]
    );
    const kx = Math.cos((lat * Math.PI) / 180);
    const maxD = r * 111 + 60;
    const votes = new Map();
    let points = 0;
    for (const row of rows) {
      const dy = (row.lat_i / 1000 - lat) * 111000;
      const dx = (row.lng_i / 1000 - lng) * 111000 * kx;
      const d = Math.hypot(dx, dy);
      if (d > maxD) continue;
      votes.set(row.cp, (votes.get(row.cp) || 0) + row.n / (1 + (d / 120) ** 2));
      points += row.n;
    }
    return { votes: [...votes.entries()].sort((a, b) => b[1] - a[1]), points };
  });
}

/** C.P. por ubicación: exacto si una mayoría clara de negocios cercanos lo declara. */
async function postcodeByLocation(lat, lng, stateCode) {
  let possible = null;
  for (const [r, exactShare] of [
    [3, 0.6],
    [8, 0.75],
  ]) {
    const { votes, points } = await gridVotes(lat, lng, r);
    const list = votes.filter(([cp]) => postcodeInState(cp, stateCode));
    if (points < 3 || !list.length) continue;
    const total = list.reduce((s, [, w]) => s + w, 0);
    const share = list[0][1] / total;
    if (share >= exactShare) return { cps: [list[0][0]], exact: true };
    if (!possible) {
      const top = list.slice(0, 2).filter(([, w]) => w / total >= 0.15);
      if (top.reduce((s, [, w]) => s + w, 0) / total >= 0.7) possible = { cps: top.map(([cp]) => cp), exact: false };
    }
  }
  return possible;
}

const PC_GENERIC = new Set(['colonia', 'col', 'fraccionamiento', 'fracc', 'frac', 'barrio', 'zona', 'conjunto', 'unidad', 'habitacional']);

function coreName(s, drop) {
  return normalizeText(s)
    .replace(/[.#\-]/g, ' ')
    .split(' ')
    .filter((t) => t && !PC_GENERIC.has(t) && !drop.has(t))
    .join(' ');
}

/** «Anahuac - Col. Centro» → nombres a probar: completo y cada parte. */
function nameVariants(names) {
  const out = [];
  for (const n of names) {
    const s = String(n || '').trim();
    if (!s) continue;
    out.push(s);
    if (/\s[-–/]\s|,/.test(s)) out.push(...s.split(/\s[-–/]\s|,/).map((x) => x.trim()).filter(Boolean));
  }
  return [...new Set(out)];
}

/**
 * C.P. por nombre: colonia o localidad dentro del municipio (SEPOMEX).
 * @param {string} stateCode
 * @param {{ colonias: string[], localities: string[], munis: string[] }} meta
 */
async function postcodeByNames(stateCode, meta) {
  const cEstado = INEGI_STATE[stateCode];
  const munis = [...new Set(meta.munis.map(normalizeText).filter(Boolean))];
  if (!cEstado || !munis.length) return null;
  const rows = await pcCached(`m:${cEstado}:${munis.sort().join('|')}`, async () => {
    const res = await query(
      `SELECT cp, asentamiento, municipio, ciudad, mnpio_norm, ciudad_norm FROM mx_postcodes
        WHERE c_estado = $1 AND (mnpio_norm = ANY($2::text[]) OR ciudad_norm = ANY($2::text[]))
        LIMIT 4000`,
      [cEstado, munis]
    );
    return res.rows;
  });
  if (!rows.length) return null;
  // El nombre de la ciudad/municipio no distingue colonias («Tampico Centro» ≈ «Zona Centro»).
  const drop = new Set(
    rows
      .flatMap((r) => [r.mnpio_norm, r.ciudad_norm])
      .concat(munis)
      .join(' ')
      .split(' ')
      .filter(Boolean)
  );
  const byCore = new Map();
  for (const r of rows) {
    const k = coreName(r.asentamiento, drop);
    if (!k) continue;
    if (!byCore.has(k)) byCore.set(k, new Set());
    byCore.get(k).add(r.cp);
  }
  for (const group of [meta.colonias, meta.localities]) {
    const cps = new Set();
    for (const v of nameVariants(group)) {
      const k = coreName(v, drop);
      if (k && byCore.has(k)) byCore.get(k).forEach((cp) => cps.add(cp));
    }
    if (cps.size === 1) return { cps: [...cps], exact: true };
    if (cps.size > 1 && cps.size <= 3) return { cps: [...cps].sort(), exact: false };
  }
  const all = [...new Set(rows.map((r) => r.cp))].sort();
  if (all.length === 1) return { cps: all, exact: true };
  return null;
}

/** @returns {Promise<{ cps: string[], exact: boolean } | null>} */
async function resolvePostcode(r) {
  const meta = r._pc;
  if (!meta || (!meta.anyKind && !POSTCODE_KINDS.has(r.kind))) return null;
  if (r.countryCode && r.countryCode !== 'MX') return null;
  const stateCode = mxStateCode(meta.state, meta.iso);
  try {
    const near = await postcodeByLocation(r.lat, r.lng, stateCode);
    if (near?.exact) return near;
    const named = stateCode ? await postcodeByNames(stateCode, meta) : null;
    if (named?.exact) return named;
    return near || named;
  } catch (err) {
    if (tableMissing(err)) return null;
    throw err;
  }
}

/**
 * El centro geométrico de un municipio puede caer en lagunas o despoblado (Tampico):
 * el pin va a su cabecera (centro comercial de la localidad 0001 según el DENUE).
 */
async function cabeceraFor(r) {
  if (r.kind !== 'municipio' || !r._pc || (r.countryCode && r.countryCode !== 'MX')) return null;
  const cEstado = INEGI_STATE[mxStateCode(r._pc.state, r._pc.iso)];
  const name = normalizeText(r.name).replace(/^municipio (de |del )?/, '');
  if (!cEstado || !name) return null;
  const rows = await pcCached(`c:${cEstado}:${name}`, async () => {
    const res = await query(
      `SELECT lat, lng FROM mx_cabeceras
        WHERE c_estado = $1
          AND c_mnpio IN (SELECT DISTINCT c_mnpio FROM mx_postcodes WHERE c_estado = $1 AND mnpio_norm = $2)
        LIMIT 2`,
      [cEstado, name]
    );
    return res.rows;
  });
  if (rows.length !== 1) return null;
  const { lat, lng } = rows[0];
  const b = r.bbox;
  if (b && (lat < b[0][0] || lat > b[1][0] || lng < b[0][1] || lng > b[1][1])) return null;
  return { lat, lng };
}

/** Añade el C.P. (SEPOMEX/DENUE) al detalle, pone el pin de los municipios en su cabecera y quita los datos internos. */
async function attachPostcodes(results) {
  return Promise.all(
    results.map(async (r) => {
      if (!r?._pc) return r;
      const { _pc, ...clean } = r;
      const head = await cabeceraFor(r).catch(() => null);
      if (head) {
        clean.lat = head.lat;
        clean.lng = head.lng;
        clean.pinAt = 'cabecera';
      }
      const pc = await resolvePostcode(r).catch(() => null);
      if (!pc) return clean;
      const label = pc.exact ? `C.P. ${pc.cps[0]}` : `C.P. posible ${pc.cps.join(' / ')}`;
      return {
        ...clean,
        postcode: pc.cps[0],
        postcodeExact: pc.exact,
        detail: [clean.detail, label].filter(Boolean).join(' · '),
      };
    })
  );
}

/** Ubicación de un C.P.: donde se concentran sus negocios (DENUE). */
async function postcodeCenter(cp) {
  const { rows } = await query('SELECT lat_i, lng_i, n FROM mx_postcode_grid WHERE cp = $1', [cp]);
  if (!rows.length) return null;
  const top = rows.reduce((a, b) => (b.n > a.n ? b : a));
  // Negocios con el C.P. mal capturado lejos del resto no deben mover el punto.
  const cluster = rows.filter((r) => Math.abs(r.lat_i - top.lat_i) <= 30 && Math.abs(r.lng_i - top.lng_i) <= 30);
  const sum = cluster.reduce((s, r) => s + r.n, 0);
  const lat = cluster.reduce((s, r) => s + r.lat_i * r.n, 0) / sum / 1000;
  const lng = cluster.reduce((s, r) => s + r.lng_i * r.n, 0) / sum / 1000;
  const lats = cluster.map((r) => r.lat_i / 1000);
  const lngs = cluster.map((r) => r.lng_i / 1000);
  const pad = 0.0015;
  return {
    lat,
    lng,
    bbox: [
      [Math.min(...lats) - pad, Math.min(...lngs) - pad],
      [Math.max(...lats) + pad, Math.max(...lngs) + pad],
    ],
  };
}

/**
 * Búsqueda por C.P.: colonias del catálogo SEPOMEX; el punto sale del DENUE o, si no hay
 * negocios, de buscar la colonia en OSM.
 */
async function searchPostcode(cp, opts) {
  let rows;
  try {
    ({ rows } = await query(
      `SELECT asentamiento, tipo, municipio, estado, c_estado FROM mx_postcodes
        WHERE cp = $1 ORDER BY asentamiento`,
      [cp]
    ));
  } catch (err) {
    if (tableMissing(err)) return null;
    throw err;
  }
  if (!rows.length) return { results: [], status: 'ok' };
  const first = rows[0];
  let place = await postcodeCenter(cp);
  if (!place && !opts.localOnly) {
    const prep = prepareQuery(`${first.asentamiento}, ${first.municipio}, ${first.estado}`);
    let found = await searchPhoton(prep, { limit: 3, signal: opts.signal }, PHOTON_LOCAL);
    if (!found.results.length) found = await searchPhoton(prep, { limit: 3, signal: opts.signal }, PHOTON_PUBLIC);
    const hit = found.results.find((r) => normalizeText(r.detail).includes(normalizeText(first.municipio))) || found.results[0];
    if (hit) place = { lat: hit.lat, lng: hit.lng, bbox: hit.bbox || null };
  }
  if (!place) return { results: [], status: 'ok' };
  const names = rows.map((r) => r.asentamiento);
  const shown = names.slice(0, 4).join(', ') + (names.length > 4 ? ` y ${names.length - 4} más` : '');
  const munis = [...new Set(rows.map((r) => r.municipio))].join(', ');
  return {
    results: [
      {
        id: `cp:${cp}`,
        source: 'sepomex',
        kind: 'codigo_postal',
        name: `C.P. ${cp}`,
        detail: [shown, munis, first.estado].join(' · '),
        lat: place.lat,
        lng: place.lng,
        bbox: place.bbox,
        countryCode: 'MX',
        postcode: cp,
        postcodeExact: true,
      },
    ],
    status: 'ok',
  };
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
  const detail = parts.join(' · ');

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
    _pc: {
      state: p.state,
      county: p.county || null,
      city: p.city || null,
      district: p.district || p.locality || null,
      iso: null,
      colonias: [p.district, p.locality, kind === 'colonia' ? name : null].filter(Boolean),
      localities: [p.city, kind === 'pueblo' || kind === 'localidad' ? name : null].filter(Boolean),
      munis: [p.county, p.city].filter(Boolean),
    },
  };
}

async function jsonFetch(url, signal, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, {
    signal: withTimeout(signal, timeoutMs),
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {ReturnType<typeof prepareQuery>} prep
 * @param {{ lat?: number|null, lng?: number|null, world?: boolean, limit?: number, signal?: AbortSignal }} opts
 */
async function searchPhoton(prep, opts, ph = PHOTON_PUBLIC) {
  if (!ph) return { results: [], status: 'deshabilitado' };
  // Photon caído: no hacer esperar su timeout a cada búsqueda; se reintenta pasado el lapso.
  if (Date.now() < ph.downUntil) return { results: [], status: 'sin_servicio' };
  if (ph.local && opts.world) return { results: [], status: 'ok' };
  const q = prep.text;
  const limit = Math.min(Math.max(opts.limit || 8, 1), 15);
  const bias =
    Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
      ? `${opts.lat.toFixed(1)},${opts.lng.toFixed(1)}`
      : '';
  const key = `s:${ph.name}:${opts.world ? 'w' : 'mx'}:${bias}:${normalizeText(q)}`;
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
    const data = await ph.limiter(() => jsonFetch(`${ph.url}/api/?${params}`, opts.signal, ph.timeoutMs), opts.signal);
    let results = (data?.features || []).map(photonFeatureToResult).filter(Boolean);
    if (!opts.world) results = results.filter((r) => !r.countryCode || r.countryCode === 'MX');
    results = markApprox(dedupeResults(rerank(results, prep)), prep).slice(0, limit);
    const value = { results, status: 'ok' };
    cacheSet(key, value, OK_TTL_MS);
    return value;
  } catch (err) {
    const status = errorStatus(opts.signal?.aborted ? { message: 'cancelado' } : err);
    const value = { results: [], status };
    if (status === 'timeout' || status === 'sin_servicio') {
      cacheSet(key, value, FAIL_TTL_MS);
      ph.downUntil = Date.now() + PHOTON_DOWN_MS;
    }
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
  // Las «zonas de C.P.» de OSM son calculadas; el C.P. se busca con SEPOMEX.
  if (r.addresstype === 'postcode') return null;
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
  const detail = parts.join(' · ');
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
    _pc: {
      state: a.state,
      iso: a['ISO3166-2-lvl4'],
      colonias: [a.neighbourhood, a.suburb, a.quarter, kind === 'colonia' ? name : null].filter(Boolean),
      localities: [city, kind === 'pueblo' || kind === 'localidad' ? name : null].filter(Boolean),
      munis: [a.municipality, a.county, a.city_district, a.city, a.town].filter(Boolean),
    },
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
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1', lang: 'default' });
  for (const ph of [PHOTON_PUBLIC, PHOTON_LOCAL]) {
    if (!ph || Date.now() < ph.downUntil) continue;
    try {
      const data = await ph.limiter(() => jsonFetch(`${ph.url}/reverse?${params}`, undefined, ph.timeoutMs));
      const r = photonFeatureToResult((data?.features || [])[0]);
      cacheSet(key, r, OK_TTL_MS);
      return r;
    } catch (err) {
      const status = errorStatus(err);
      if (status === 'timeout' || status === 'sin_servicio') ph.downUntil = Date.now() + PHOTON_DOWN_MS;
    }
  }
  return null;
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
    municipality: r.municipality || null,
    state: r.state || null,
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

/** `a` manda (más actualizado); de `b` solo lo que no esté ya (mismo id, o mismo nombre a ~150 m). */
function mergeUnique(a, b) {
  const near = (x, y) => Math.abs(x.lat - y.lat) < 0.0015 && Math.abs(x.lng - y.lng) < 0.0015;
  const out = [...a];
  for (const r of b) {
    if (!out.some((m) => m.id === r.id || (normalizeText(m.name) === normalizeText(r.name) && near(m, r)))) out.push(r);
  }
  return out;
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

  // Solo un C.P.: catálogo SEPOMEX (OSM no los tiene o los calcula mal).
  if (prep.postcode && !prep.words.length && !opts.world) {
    const pc = await searchPostcode(prep.postcode, { ...opts, localOnly: src === 'local' });
    if (pc) return { ok: true, results: pc.results, status: pc.status };
  }

  if (src === 'local') {
    const local = await searchLocal(text, 6);
    return { ok: true, results: local.results, forced: local.forced, status: 'ok' };
  }

  if (src === 'osm' || src === 'propio') {
    const ph = src === 'osm' ? PHOTON_PUBLIC : PHOTON_LOCAL;
    const remote = text.length >= 3 ? await searchPhoton(prep, opts, ph) : { results: [], status: 'ok' };
    return { ok: true, results: await attachPostcodes(remote.results), status: remote.status };
  }

  if (src === 'full') {
    const [nom, pho, own] = await Promise.all([
      searchNominatim(prep, opts),
      searchPhoton(prep, opts, PHOTON_PUBLIC),
      searchPhoton(prep, opts, PHOTON_LOCAL),
    ]);
    const merged = mergeUnique(mergeUnique(nom.results, pho.results), own.results);
    const status = [nom, pho, own].some((s) => s.status === 'ok') ? 'ok' : nom.status;
    return { ok: true, results: await attachPostcodes(rerank(merged, prep).slice(0, 14)), status };
  }

  const [local, pub, own] = await Promise.all([
    searchLocal(text, 6),
    text.length >= 3 ? searchPhoton(prep, opts, PHOTON_PUBLIC) : Promise.resolve({ results: [], status: 'ok' }),
    text.length >= 3 ? searchPhoton(prep, opts, PHOTON_LOCAL) : Promise.resolve({ results: [], status: 'ok' }),
  ]);
  const remote = {
    results: mergeUnique(pub.results, own.results),
    status: pub.status === 'ok' || own.status === 'ok' ? 'ok' : pub.status,
  };
  const results = local.forced
    ? [...local.results, ...remote.results]
    : [...remote.results.slice(0, 3), ...local.results.slice(0, 4), ...remote.results.slice(3)];
  return { ok: true, results: await attachPostcodes(results.slice(0, 14)), status: remote.status };
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
  const [found, ejido] = await Promise.all([reversePhoton(lat, lng), localAt(lat, lng)]);
  // «¿Qué hay aquí?»: el C.P. es el del punto pedido, sea cual sea el tipo de lugar.
  const [place] = found
    ? await attachPostcodes([{ ...found, lat, lng, _pc: found._pc && { ...found._pc, anyKind: true } }])
    : [null];
  if (place) {
    place.lat = found.lat;
    place.lng = found.lng;
  }
  return { ok: true, lat, lng, place, ejido };
}

/** C.P. del punto por la rejilla DENUE; el radio crece en zonas rurales (hasta ~6.6 km). */
async function nearestPostcodeAt(lat, lng) {
  for (const r of [3, 8, 25, 60]) {
    const { votes } = await gridVotes(lat, lng, r);
    if (votes.length) return votes[0][0];
  }
  return null;
}

/**
 * Datos administrativos de un punto (alta de usuarios): estado, municipio, localidad, colonia, C.P., ejido.
 * Polígonos primero (OSM vía Photon, ejidos RAN); SEPOMEX/DENUE como respaldo sin internet (`approx`).
 */
export async function geoAdminAt(lat, lng) {
  const [found, ejido, nearCp] = await Promise.all([
    reversePhoton(lat, lng).catch(() => null),
    localAt(lat, lng).catch(() => null),
    nearestPostcodeAt(lat, lng).catch(() => null),
  ]);
  const clean = (s) =>
    String(s || '')
      .replace(/^municipio (de |del )?/i, '')
      .trim() || null;
  const pc = found && (!found.countryCode || found.countryCode === 'MX') ? found._pc || {} : {};
  const polyState = clean(pc.state) || clean(ejido?.state);

  let cp = nearCp;
  if (cp && polyState && !postcodeInState(cp, mxStateCode(polyState))) cp = null;
  let sep = [];
  if (cp) {
    try {
      const { rows } = await query(
        `SELECT asentamiento, municipio, estado, ciudad FROM mx_postcodes WHERE cp = $1 ORDER BY id LIMIT 60`,
        [cp]
      );
      sep = rows;
    } catch (err) {
      if (!tableMissing(err)) throw err;
    }
  }
  const s0 = sep[0] || null;
  const polyMuni = clean(pc.county) || clean(ejido?.municipality);
  return {
    ok: true,
    lat,
    lng,
    estado: polyState || s0?.estado || null,
    municipio: polyMuni || s0?.municipio || null,
    localidad: clean(pc.city) || s0?.ciudad || null,
    colonia: clean(pc.district) || (sep.length === 1 ? sep[0].asentamiento : null),
    cp: cp || null,
    ejido: ejido?.name || null,
    approx: !polyState || !polyMuni,
  };
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

const OUTLINE_MAX_POINTS = 4000;
const OUTLINE_MAX_PARTS = 20;

function sqSegDist(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker iterativo sobre [lng, lat]. */
function simplifyRing(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const sq = tol * tol;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > sq) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringSpan(ring) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

/**
 * Límite de un municipio/estado/colonia de OSM («R5606424» o «W123»), para dibujarlo al elegirlo.
 * Formato Leaflet multipolígono: [[[lat, lng], …]] por parte (solo anillos exteriores).
 */
export async function geoOsmOutline(ref) {
  const m = String(ref || '').match(/^([RW])(\d{1,12})$/);
  if (!m || !NOMINATIM_ENABLED) return null;
  const key = `o:${m[0]}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  try {
    const params = new URLSearchParams({
      osm_ids: m[0],
      format: 'json',
      polygon_geojson: '1',
      polygon_threshold: '0.0003',
    });
    const data = await nominatimLimiter(() => jsonFetch(`${NOMINATIM_URL}/lookup?${params}`));
    const g = Array.isArray(data) ? data[0]?.geojson : null;
    let parts = [];
    if (g?.type === 'Polygon') parts = [g.coordinates[0]];
    else if (g?.type === 'MultiPolygon') parts = g.coordinates.map((p) => p[0]);
    parts = parts
      .filter((r) => Array.isArray(r) && r.length >= 4)
      .sort((a, b) => ringSpan(b) - ringSpan(a))
      .slice(0, OUTLINE_MAX_PARTS);
    let tol = 0.0002;
    let out = parts;
    while (out.reduce((s, r) => s + r.length, 0) > OUTLINE_MAX_POINTS && tol < 0.1) {
      out = parts.map((r) => simplifyRing(r, tol));
      tol *= 1.8;
    }
    const outline = out.length
      ? out.map((r) => [r.map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5])])
      : null;
    cacheSet(key, outline, OK_TTL_MS);
    return outline;
  } catch {
    return null;
  }
}

/** Buscador propio: ¿responde? y fecha del índice de OpenStreetMap que trae. */
export async function ownGeocoderStatus() {
  if (!PHOTON_LOCAL) return { configurado: false };
  try {
    const j = await jsonFetch(`${PHOTON_LOCAL.url}/status`, undefined, 2000);
    return { configurado: true, ok: String(j?.status || '').toLowerCase() === 'ok', fecha: j?.import_date || null };
  } catch {
    return { configurado: true, ok: false, fecha: null };
  }
}

export const geocoderInfo = {
  enabled: GEOCODER_ENABLED,
  baseUrl: GEOCODER_URL,
  localUrl: GEOCODER_LOCAL_URL || null,
};
