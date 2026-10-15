/**
 * Carga los códigos postales de México para la pestaña «Buscar» del mapa:
 *  1) Catálogo oficial de Correos de México (SEPOMEX) → `mx_postcodes`.
 *  2) Establecimientos del DENUE (INEGI) con coordenadas y C.P. → `mx_postcode_grid`
 *     (cuántos negocios declaran cada C.P. en celdas de ~110 m; así se sabe el C.P. de un punto).
 *
 * Uso (desde backend/):
 *   node src/scripts/load-mx-postcodes.js                    # todo (descarga ~2 MB + ~450 MB)
 *   node src/scripts/load-mx-postcodes.js --dir=C:\ruta      # caché de descargas (no vuelve a bajar)
 *   node src/scripts/load-mx-postcodes.js --states=28,30     # DENUE solo de esos estados (clave INEGI)
 *   node src/scripts/load-mx-postcodes.js --skip-denue       # solo SEPOMEX
 *   node src/scripts/load-mx-postcodes.js --skip-sepomex     # solo DENUE (SEPOMEX ya cargado)
 *
 * Requiere la migración 042_mx_postcodes.sql y `tar` (Windows 10+ y la imagen de la API lo traen).
 * SEPOMEX es gratuito para uso propio; no se redistribuye fuera del sistema.
 */
import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { spawnSync } from 'child_process';
import { pool, query } from '../db.js';
import { normalizeText } from '../services/geoSearch.js';

const SEPOMEX_URL = 'https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx';
const DENUE_URL = (name) => `https://www.inegi.org.mx/contenidos/masiva/denue/${name}`;
const UA = 'Mozilla/5.0 (SICOM carga de catálogo)';
const BATCH = 1000;

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
const flag = (name) => process.argv.includes(`--${name}`);

function untar(zipFile, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const r = spawnSync('tar', ['-xf', zipFile, '-C', outDir], { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`tar: ${String(r.stderr || r.error || 'falló')}`);
}

function listFiles(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, ext));
    else if (e.name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

async function download(url, file, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15 * 60 * 1000),
    headers: { 'User-Agent': UA, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

/** El INEGI responde 200 con una página HTML cuando el archivo no existe. */
function isZip(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) return false;
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(2);
  fs.readSync(fd, head, 0, 2, 0);
  fs.closeSync(fd);
  return head.toString('latin1') === 'PK';
}

async function fetchZip(name, dir) {
  const file = path.join(dir, name);
  if (isZip(file)) return file;
  await download(DENUE_URL(name), file);
  if (isZip(file)) return file;
  fs.rmSync(file, { force: true });
  return null;
}

/** Estados grandes (p. ej. Estado de México) vienen en partes: denue_15_1_csv.zip, _2… */
async function denueZips(st, dir) {
  const whole = await fetchZip(`denue_${st}_csv.zip`, dir);
  if (whole) return [whole];
  const parts = [];
  for (let i = 1; i <= 9; i += 1) {
    const part = await fetchZip(`denue_${st}_${i}_csv.zip`, dir);
    if (!part) break;
    parts.push(part);
  }
  return parts;
}

/* ------------------------------------------------------------------ SEPOMEX */

/** La descarga es un formulario ASP.NET: hay que reenviar sus campos ocultos y la cookie. */
async function downloadSepomex(zipFile) {
  const page = await fetch(SEPOMEX_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!page.ok) throw new Error(`HTTP ${page.status} SEPOMEX`);
  const html = await page.text();
  const cookie = (page.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const hidden = (name) => html.match(new RegExp(`id="${name}" value="([^"]*)"`))?.[1] || '';
  const body = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: hidden('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: hidden('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: hidden('__EVENTVALIDATION'),
    cboEdo: '00',
    rblTipo: 'txt',
    'btnDescarga.x': '10',
    'btnDescarga.y': '10',
  });
  return download(SEPOMEX_URL, zipFile, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) },
  });
}

async function sepomexText(dir) {
  const given = arg('sepomex-file');
  if (given) return fs.readFileSync(given, 'latin1');
  const txt = path.join(dir, 'CPdescarga.txt');
  if (!fs.existsSync(txt) || fs.statSync(txt).size < 1_000_000) {
    const zip = path.join(dir, 'CPdescarga.zip');
    console.log('Descargando catálogo SEPOMEX…');
    await downloadSepomex(zip);
    untar(zip, dir);
  }
  return fs.readFileSync(txt, 'latin1');
}

function parseSepomex(text) {
  const rows = [];
  let header = null;
  for (const line of text.split(/\r?\n/)) {
    const f = line.split('|');
    if (!header) {
      if (f[0] === 'd_codigo') header = Object.fromEntries(f.map((h, i) => [h, i]));
      continue;
    }
    const cp = (f[header.d_codigo] || '').trim();
    if (!/^\d{5}$/.test(cp)) continue;
    const asentamiento = (f[header.d_asenta] || '').trim();
    const municipio = (f[header.D_mnpio] || '').trim();
    const cEstado = Number(f[header.c_estado]);
    if (!asentamiento || !municipio || !cEstado) continue;
    const ciudad = (f[header.d_ciudad] || '').trim();
    rows.push({
      cp,
      asentamiento: asentamiento.slice(0, 200),
      tipo: (f[header.d_tipo_asenta] || '').trim().slice(0, 60) || null,
      municipio: municipio.slice(0, 160),
      estado: (f[header.d_estado] || '').trim().slice(0, 80),
      ciudad: ciudad.slice(0, 160) || null,
      cEstado,
      cMnpio: Number(f[header.c_mnpio]) || 0,
      zona: (f[header.d_zona] || '').trim().slice(0, 20) || null,
      asentaNorm: normalizeText(asentamiento),
      mnpioNorm: normalizeText(municipio),
      ciudadNorm: normalizeText(ciudad),
    });
  }
  return rows;
}

async function loadSepomex(dir) {
  const rows = parseSepomex(await sepomexText(dir));
  if (rows.length < 100000) throw new Error(`SEPOMEX incompleto (${rows.length} renglones)`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM mx_postcodes');
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const params = [];
      const values = chunk.map((r, k) => {
        params.push(
          r.cp, r.asentamiento, r.tipo, r.municipio, r.estado, r.ciudad, r.cEstado, r.cMnpio,
          r.zona, r.asentaNorm, r.mnpioNorm, r.ciudadNorm
        );
        const b = k * 12;
        return `(${Array.from({ length: 12 }, (_, j) => `$${b + j + 1}`).join(',')})`;
      });
      await client.query(
        `INSERT INTO mx_postcodes
           (cp, asentamiento, tipo, municipio, estado, ciudad, c_estado, c_mnpio, zona,
            asenta_norm, mnpio_norm, ciudad_norm)
         VALUES ${values.join(',')}`,
        params
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log(`[OK] SEPOMEX: ${rows.length} asentamientos`);
}

/* -------------------------------------------------------------------- DENUE */

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** C.P. válidos por estado según SEPOMEX: un negocio con un C.P. inexistente no vota. */
async function validPostcodes() {
  const { rows } = await query('SELECT DISTINCT cp, c_estado FROM mx_postcodes');
  const set = new Set(rows.map((r) => `${r.c_estado}|${r.cp}`));
  if (!set.size) throw new Error('mx_postcodes vacío: carga primero SEPOMEX');
  return set;
}

async function aggregateCsv(file, valid, cells) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'latin1' }), crlfDelay: Infinity });
  let idx = null;
  let used = 0;
  for await (const line of rl) {
    if (!idx) {
      const h = parseCsvLine(line.replace(/^\uFEFF/, '')).map((s) => s.trim().toLowerCase());
      idx = { cp: h.indexOf('cod_postal'), ent: h.indexOf('cve_ent'), lat: h.indexOf('latitud'), lng: h.indexOf('longitud') };
      if (Object.values(idx).some((v) => v < 0)) throw new Error(`Encabezado DENUE inesperado en ${file}`);
      continue;
    }
    const f = parseCsvLine(line);
    const cp = (f[idx.cp] || '').trim().padStart(5, '0');
    const ent = Number(f[idx.ent]);
    if (!/^\d{5}$/.test(cp) || cp === '00000' || !valid.has(`${ent}|${cp}`)) continue;
    const lat = Number(f[idx.lat]);
    const lng = Number(f[idx.lng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 14 || lat > 33 || lng < -119 || lng > -86) continue;
    const key = `${Math.round(lat * 1000)},${Math.round(lng * 1000)},${cp}`;
    cells.set(key, (cells.get(key) || 0) + 1);
    used += 1;
  }
  return used;
}

async function saveCells(cells, additive) {
  const entries = [...cells.entries()];
  const onConflict = additive ? 'mx_postcode_grid.n + EXCLUDED.n' : 'GREATEST(mx_postcode_grid.n, EXCLUDED.n)';
  for (let i = 0; i < entries.length; i += BATCH * 2) {
    const chunk = entries.slice(i, i + BATCH * 2);
    const params = [];
    const values = chunk.map(([key, n], k) => {
      const [latI, lngI, cp] = key.split(',');
      params.push(Number(latI), Number(lngI), cp, n);
      const b = k * 4;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4})`;
    });
    await query(
      `INSERT INTO mx_postcode_grid (lat_i, lng_i, cp, n) VALUES ${values.join(',')}
       ON CONFLICT (lat_i, lng_i, cp) DO UPDATE SET n = ${onConflict}`,
      params
    );
  }
}

async function loadDenue(dir) {
  const all = Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, '0'));
  const wanted = arg('states')
    ? arg('states').split(',').map((s) => s.trim().padStart(2, '0')).filter((s) => all.includes(s))
    : all;
  if (!wanted.length) throw new Error('Ningún estado válido en --states (claves INEGI 01–32)');
  const full = wanted.length === all.length;
  const valid = await validPostcodes();
  if (full) await query('TRUNCATE mx_postcode_grid');
  let failed = 0;
  for (const st of wanted) {
    const t0 = Date.now();
    const work = path.join(dir, `denue_${st}`);
    try {
      const zips = await denueZips(st, dir);
      if (!zips.length) throw new Error('no se encontró el archivo del INEGI');
      zips.forEach((zip, i) => untar(zip, path.join(work, String(i))));
      const files = listFiles(work, '.csv').filter((f) => !/diccionario/i.test(f));
      if (!files.length) throw new Error('el ZIP no trae CSV de datos');
      const cells = new Map();
      let used = 0;
      for (const f of files) used += await aggregateCsv(f, valid, cells);
      await saveCells(cells, full);
      console.log(`[OK] DENUE ${st}: ${used} negocios con C.P. válido → ${cells.size} celdas (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (err) {
      failed += 1;
      console.error(`[ERROR] DENUE ${st}: ${err.message}`);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
  return failed;
}

async function main() {
  const dir = arg('dir') || path.join(os.tmpdir(), 'sicom-mx-postcodes');
  fs.mkdirSync(dir, { recursive: true });
  console.log(`=== Códigos postales de México (caché ${dir}) ===`);
  if (!flag('skip-sepomex')) await loadSepomex(dir);
  const failed = flag('skip-denue') ? 0 : await loadDenue(dir);
  const { rows } = await query(
    `SELECT (SELECT COUNT(*)::int FROM mx_postcodes) AS asentamientos,
            (SELECT COUNT(*)::int FROM mx_postcode_grid) AS celdas,
            pg_size_pretty(pg_total_relation_size('mx_postcodes') + pg_total_relation_size('mx_postcode_grid')) AS size`
  );
  console.log(`En tabla: ${rows[0].asentamientos} asentamientos · ${rows[0].celdas} celdas · ${rows[0].size} · errores: ${failed}`);
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
