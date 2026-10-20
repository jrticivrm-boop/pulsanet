/**
 * Coordenadas escritas a mano → { lat, lng, format }.
 * Formatos: grados decimales (DD), grados-minutos-segundos (DMS / DDM),
 * cuadrícula MGRS (14R NP 0975 4567) y ligas completas de Google Maps.
 */

const NUM = String.raw`\d+(?:\.\d+)?`;

function inRange(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalizeSymbols(s) {
  return String(s || '')
    .replace(/[º˚]/g, '°')
    .replace(/[’‘′´`]/g, "'")
    .replace(/[”“″]/g, '"')
    .replace(/''/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const isSouthOrWest = (h) => /^[SWO]$/i.test(h || '');
const isLngHemi = (h) => /^[EWO]$/i.test(h || '');

/* ---------- Grados decimales ---------- */

function parseDecimal(s) {
  const m = s.match(
    new RegExp(
      String.raw`^([NSEWO])?\s*(-?${NUM})\s*°?\s*([NSEWO])?\s*[,;\s]\s*([NSEWO])?\s*(-?${NUM})\s*°?\s*([NSEWO])?$`,
      'i',
    ),
  );
  if (!m) return null;
  const h1 = m[1] || m[3];
  const h2 = m[4] || m[6];
  let a = Number(m[2]);
  let b = Number(m[5]);
  if (h1 && isSouthOrWest(h1)) a = -Math.abs(a);
  if (h2 && isSouthOrWest(h2)) b = -Math.abs(b);
  let [lat, lng] = [a, b];
  if ((h1 && isLngHemi(h1)) || (!h1 && !h2 && Math.abs(a) > 90 && Math.abs(b) <= 90)) [lat, lng] = [b, a];
  return inRange(lat, lng) ? { lat, lng, format: 'DD' } : null;
}

/* ---------- DMS / grados y minutos ---------- */

const DMS_PART = String.raw`([NSEWO])?\s*(-?\d{1,3}(?:\.\d+)?)\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*')?\s*(?:(\d{1,2}(?:\.\d+)?)\s*")?\s*([NSEWO])?`;
const DMS_RE = new RegExp(String.raw`^${DMS_PART}\s*[,;]?\s*${DMS_PART}$`, 'i');

function dmsValue(deg, min, sec, hemi) {
  if (Number(min) >= 60 || Number(sec) >= 60) return NaN;
  const v = Math.abs(Number(deg)) + (Number(min) || 0) / 60 + (Number(sec) || 0) / 3600;
  return isSouthOrWest(hemi) || String(deg).startsWith('-') ? -v : v;
}

function parseDms(s) {
  const m = s.match(DMS_RE);
  if (!m) return null;
  const h1 = m[1] || m[5];
  const h2 = m[6] || m[10];
  const first = { deg: m[2], min: m[3], sec: m[4], hemi: h1 };
  const second = { deg: m[7], min: m[8], sec: m[9], hemi: h2 };
  const [latP, lngP] = isLngHemi(h1) ? [second, first] : [first, second];
  // Sin hemisferio, en México la longitud es oeste.
  if (!lngP.hemi && !String(lngP.deg).startsWith('-')) lngP.hemi = 'W';
  const lat = dmsValue(latP.deg, latP.min, latP.sec, latP.hemi);
  const lng = dmsValue(lngP.deg, lngP.min, lngP.sec, lngP.hemi);
  return inRange(lat, lng) ? { lat, lng, format: 'DMS' } : null;
}

/* ---------- MGRS (cuadrícula militar) ---------- */

const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';
const COL_SETS = ['STUVWXYZ', 'ABCDEFGH', 'JKLMNPQR'];
/** Norte mínimo (m, con falso norte en el hemisferio sur) de cada banda de latitud. */
const BAND_MIN_NORTHING = {
  C: 1100000, D: 2000000, E: 2800000, F: 3700000, G: 4600000, H: 5500000, J: 6400000,
  K: 7300000, L: 8200000, M: 9100000, N: 0, P: 800000, Q: 1700000, R: 2600000,
  S: 3500000, T: 4400000, U: 5300000, V: 6200000, W: 7000000, X: 7900000,
};

const MGRS_RE = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/;

/** UTM (WGS84) → grados. */
function utmToLatLng(zone, easting, northing, southern) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = easting - 500000;
  const y = southern ? northing - 10000000 : northing;
  const mu = y / k0 / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const n1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
  const t1 = tan1 ** 2;
  const c1 = ep2 * cos1 ** 2;
  const r1 = (a * (1 - e2)) / (1 - e2 * sin1 ** 2) ** 1.5;
  const d = x / (n1 * k0);
  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lng =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
    cos1;
  return {
    lat: (lat * 180) / Math.PI,
    lng: (zone - 1) * 6 - 180 + 3 + (lng * 180) / Math.PI,
  };
}

/** @returns {{lat,lng,format}|{error:string}|null} null = no parece MGRS. */
function parseMgrs(s) {
  const compact = s.toUpperCase().replace(/\s+/g, '');
  if (!/^\d{1,2}[A-Z]{3}\d*$/.test(compact)) return null;
  const m = compact.match(MGRS_RE);
  if (!m) return { error: 'Cuadrícula no válida: revisa zona y letras (ej. 14R NP 0975 4567).' };
  const zone = Number(m[1]);
  const [, , band, col, row, digits] = m;
  if (zone < 1 || zone > 60) return { error: 'Cuadrícula no válida: la zona va de 1 a 60.' };
  if (digits.length % 2 || digits.length > 10) {
    return {
      error: `Cuadrícula incompleta: Este y Norte llevan los mismos dígitos (${digits.length} escritos; ej. 14R NP 0975 4567).`,
    };
  }
  const colIdx = COL_SETS[zone % 3].indexOf(col);
  if (colIdx < 0) return { error: `Cuadrícula no válida: la columna «${col}» no existe en la zona ${zone}.` };
  let rowIdx = ROW_LETTERS.indexOf(row);
  if (zone % 2 === 0) rowIdx = (rowIdx - 5 + 20) % 20;
  const p = digits.length / 2;
  const cell = 10 ** (5 - p);
  const half = p < 5 ? cell / 2 : 0;
  const easting = (colIdx + 1) * 100000 + (p ? Number(digits.slice(0, p)) * cell : 0) + half;
  let northing = rowIdx * 100000 + (p ? Number(digits.slice(p)) * cell : 0) + half;
  while (northing < BAND_MIN_NORTHING[band]) northing += 2000000;
  const southern = BANDS.indexOf(band) < BANDS.indexOf('N');
  const { lat, lng } = utmToLatLng(zone, easting, northing, southern);
  const bandSouth = -80 + BANDS.indexOf(band) * 8;
  const bandNorth = band === 'X' ? 84 : bandSouth + 8;
  if (!inRange(lat, lng) || lat < bandSouth - 0.5 || lat > bandNorth + 0.5) {
    return {
      error: `Cuadrícula no válida: el cuadro «${col}${row}» no cae en la banda ${zone}${band} (${bandSouth}° a ${bandNorth}°).`,
    };
  }
  return { lat, lng, format: 'MGRS' };
}

/* ---------- Ligas de Google Maps ---------- */

function parseMapsUrl(s) {
  if (!/https?:\/\/|maps\.|goo\.gl/i.test(s)) return null;
  let text = s;
  try {
    text = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    /* liga mal codificada: se usa tal cual */
  }
  const pick = (re) => {
    const m = text.match(re);
    return m && inRange(Number(m[1]), Number(m[2])) ? { lat: Number(m[1]), lng: Number(m[2]), format: 'Google Maps' } : null;
  };
  const pin = pick(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return pin;
  const q = text.match(/[?&](?:q|query|ll|destination|center)=([^&]+)/i);
  if (q) {
    const inner = parseCoords(q[1].replace(/^loc:/i, ''));
    if (inner) return { ...inner, format: 'Google Maps' };
  }
  const at = pick(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at) return at;
  if (/goo\.gl|maps\.app/i.test(text)) {
    return { error: 'Las ligas cortas no traen coordenadas: abre la liga y copia la dirección completa o las coordenadas.' };
  }
  return { error: 'La liga no trae coordenadas.' };
}

/**
 * @returns {{ coords: {lat:number,lng:number,format:string}|null, error: string|null }}
 */
export function analyzeCoords(raw) {
  const s = normalizeSymbols(raw);
  if (!s) return { coords: null, error: null };
  for (const parse of [parseMapsUrl, parseMgrs]) {
    const r = parse(s);
    if (r?.error) return { coords: null, error: r.error };
    if (r) return { coords: r, error: null };
  }
  const coords = /[°'"]/.test(s) ? parseDms(s) : parseDecimal(s);
  return coords
    ? { coords, error: null }
    : { coords: null, error: 'Usa 25.712132, -100.329889 · 25°42\'42.0"N 100°19\'49.3"W · 14R NP 0975 4567.' };
}

/** @returns {{lat:number,lng:number,format:string}|null} */
export function parseCoords(raw) {
  return analyzeCoords(raw).coords;
}
