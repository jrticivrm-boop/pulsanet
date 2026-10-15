/**
 * Carga los núcleos agrarios del RAN (ejidos y comunidades) en `geo_places`
 * para la pestaña «Buscar» del mapa. Datos abiertos: perimetrales por estado (KML).
 *
 * Uso (desde backend/):
 *   node src/scripts/load-ran-ejidos.js                 # 32 estados (descarga ~230 MB)
 *   node src/scripts/load-ran-ejidos.js --states=df,mex # solo algunos
 *   node src/scripts/load-ran-ejidos.js --dir=C:\ruta   # caché de KML (no vuelve a descargar)
 *
 * Idempotente: actualiza por (source, source_key). Requiere la migración 041_geo_places.sql.
 */
import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pool, query } from '../db.js';
import { normalizeText, titleCaseEs } from '../services/geoSearch.js';

const BASE_URL = 'http://datos.ran.gob.mx/filescd/dgcat/ran_da_dgcat_poligonos_nucleos_agrarios_';

const STATES = {
  ags: 'Aguascalientes',
  bc: 'Baja California',
  bcs: 'Baja California Sur',
  camp: 'Campeche',
  coah: 'Coahuila',
  col: 'Colima',
  chis: 'Chiapas',
  chih: 'Chihuahua',
  df: 'Ciudad de México',
  dgo: 'Durango',
  gto: 'Guanajuato',
  gro: 'Guerrero',
  hgo: 'Hidalgo',
  jal: 'Jalisco',
  mex: 'Estado de México',
  mich: 'Michoacán',
  mor: 'Morelos',
  nay: 'Nayarit',
  nl: 'Nuevo León',
  oax: 'Oaxaca',
  pue: 'Puebla',
  qro: 'Querétaro',
  qroo: 'Quintana Roo',
  slp: 'San Luis Potosí',
  sin: 'Sinaloa',
  son: 'Sonora',
  tab: 'Tabasco',
  tamps: 'Tamaulipas',
  tlax: 'Tlaxcala',
  ver: 'Veracruz',
  yuc: 'Yucatán',
  zac: 'Zacatecas',
};

/** Contorno guardado: pocos anillos y pocos vértices (solo para dibujar y «¿qué hay aquí?»). */
const MAX_RINGS = 8;
const MAX_POINTS_PER_RING = 160;
const BATCH = 300;

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function decodeXml(s) {
  return String(s || '')
    // El origen trae la «ñ» de algunos estados en otra página de códigos («Pe¥on»).
    .replace(/¥/g, 'ñ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function parseRing(text) {
  const out = [];
  for (const tok of String(text).trim().split(/\s+/)) {
    const [lngS, latS] = tok.split(',');
    const lat = Number(latS);
    const lng = Number(lngS);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
  }
  return out;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += (ring[j][1] + ring[i][1]) * (ring[j][0] - ring[i][0]);
  }
  return Math.abs(a / 2);
}

function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [y0, x0] = ring[j];
    const [y1, x1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-14) {
    const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lng = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return [lat, lng];
  }
  return [cy / (3 * a), cx / (3 * a)];
}

function sqSegDist(p, a, b) {
  let x = a[1];
  let y = a[0];
  let dx = b[1] - x;
  let dy = b[0] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[1] - x) * dx + (p[0] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[1];
      y = b[0];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[1] - x;
  dy = p[0] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker iterativo. */
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const sqTol = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
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
    if (idx > 0 && maxD > sqTol) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function compactRing(ring) {
  let tol = 0.00015;
  let out = simplify(ring, tol);
  while (out.length > MAX_POINTS_PER_RING && tol < 0.05) {
    tol *= 1.8;
    out = simplify(ring, tol);
  }
  return out.map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
}

function parsePlacemarks(xml, stateCode) {
  const stateName = STATES[stateCode];
  const out = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const data = {};
    const dre = /<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g;
    let d;
    while ((d = dre.exec(block))) data[d[1]] = decodeXml(d[2]);

    const rings = [];
    const ore = /<outerBoundaryIs>\s*<LinearRing>\s*<coordinates>([\s\S]*?)<\/coordinates>/g;
    let o;
    while ((o = ore.exec(block))) {
      const ring = parseRing(o[1]);
      if (ring.length >= 3) rings.push(ring);
    }
    const rawName = data.NOM_NUC || '';
    if (!rawName || !rings.length) continue;

    let minLat = Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let maxLng = -Infinity;
    for (const ring of rings) {
      for (const [lat, lng] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }
    rings.sort((a, b) => ringArea(b) - ringArea(a));
    const [lat, lng] = ringCentroid(rings[0]);
    const outline = rings.slice(0, MAX_RINGS).map(compactRing).filter((r) => r.length >= 3);

    const tipo = normalizeText(data.tipo || '');
    const kind = tipo.startsWith('comun') ? 'comunidad' : 'ejido';
    const name = titleCaseEs(rawName);
    const municipality = titleCaseEs(data.MUNICIPIO || '');
    const sourceKey =
      data.Clv_Unica ||
      data.Fol_Matriz ||
      `${stateCode}:${normalizeText(rawName)}:${normalizeText(data.MUNICIPIO || '')}`;
    out.push({
      sourceKey: String(sourceKey).slice(0, 80),
      kind,
      name: name.slice(0, 200),
      municipality: municipality.slice(0, 160) || null,
      state: stateName,
      nameNorm: normalizeText(name),
      searchNorm: normalizeText(`${name} ${municipality} ${stateName}`),
      lat,
      lng,
      minLat,
      minLng,
      maxLat,
      maxLng,
      outline,
    });
  }
  return out;
}

/** Varios polígonos con la misma clave (acciones agrarias): se unen. */
function mergeByKey(rows) {
  const map = new Map();
  for (const r of rows) {
    const prev = map.get(r.sourceKey);
    if (!prev) {
      map.set(r.sourceKey, r);
      continue;
    }
    prev.minLat = Math.min(prev.minLat, r.minLat);
    prev.minLng = Math.min(prev.minLng, r.minLng);
    prev.maxLat = Math.max(prev.maxLat, r.maxLat);
    prev.maxLng = Math.max(prev.maxLng, r.maxLng);
    prev.outline = [...prev.outline, ...r.outline].slice(0, MAX_RINGS);
  }
  return [...map.values()];
}

async function loadKml(code, dir) {
  const file = path.join(dir, `${code}.kml`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    return fs.readFileSync(file, 'utf8');
  }
  const res = await fetch(`${BASE_URL}${code}.kml`, {
    signal: AbortSignal.timeout(10 * 60 * 1000),
    headers: { 'User-Agent': 'Mozilla/5.0 (SICOM carga de catálogo)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text, 'utf8');
  return text;
}

async function upsert(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const values = chunk.map((r, k) => {
      params.push(
        r.sourceKey,
        r.kind,
        r.name,
        r.municipality,
        r.state,
        r.nameNorm,
        r.searchNorm,
        r.lat,
        r.lng,
        r.minLat,
        r.minLng,
        r.maxLat,
        r.maxLng,
        JSON.stringify(r.outline)
      );
      const b = k * 14;
      const ph = Array.from({ length: 14 }, (_, j) => `$${b + j + 1}`);
      ph[13] += '::jsonb';
      return `('ran',${ph.join(',')})`;
    });
    await query(
      `INSERT INTO geo_places
         (source, source_key, kind, name, municipality, state, name_norm, search_norm, lat, lng,
          min_lat, min_lng, max_lat, max_lng, outline)
       VALUES ${values.join(',')}
       ON CONFLICT (source, source_key) DO UPDATE SET
         kind = EXCLUDED.kind, name = EXCLUDED.name, municipality = EXCLUDED.municipality,
         state = EXCLUDED.state, name_norm = EXCLUDED.name_norm, search_norm = EXCLUDED.search_norm,
         lat = EXCLUDED.lat, lng = EXCLUDED.lng,
         min_lat = EXCLUDED.min_lat, min_lng = EXCLUDED.min_lng,
         max_lat = EXCLUDED.max_lat, max_lng = EXCLUDED.max_lng,
         outline = EXCLUDED.outline, updated_at = NOW()`,
      params
    );
  }
}

async function main() {
  const dir = arg('dir') || path.join(os.tmpdir(), 'sicom-ran-kml');
  fs.mkdirSync(dir, { recursive: true });
  const wanted = (arg('states') || Object.keys(STATES).join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => STATES[s]);
  if (!wanted.length) {
    console.error('Ningún estado válido en --states');
    process.exit(1);
  }
  console.log(`=== RAN: núcleos agrarios → geo_places (${wanted.length} estados, caché ${dir}) ===`);
  let total = 0;
  let failed = 0;
  for (const code of wanted) {
    const t0 = Date.now();
    try {
      const xml = await loadKml(code, dir);
      const rows = mergeByKey(parsePlacemarks(xml, code));
      await upsert(rows);
      total += rows.length;
      console.log(`[OK] ${STATES[code]}: ${rows.length} núcleos (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (err) {
      failed += 1;
      console.error(`[ERROR] ${STATES[code]}: ${err.message}`);
    }
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n, pg_size_pretty(pg_total_relation_size('geo_places')) AS size
       FROM geo_places WHERE source = 'ran'`
  );
  console.log(`Total cargados ahora: ${total} · en tabla: ${rows[0].n} · tamaño ${rows[0].size} · errores: ${failed}`);
  await pool.end();
  if (failed) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
