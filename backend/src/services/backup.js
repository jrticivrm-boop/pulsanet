/**
 * Respaldos PostgreSQL (pg_dump) para TacticalPtx.
 * Formato: tacticalptx_YYYYMMDD_HHMMSS.zip → database.sql + meta.json + uploads/
 * Carpeta: backend/data/backups (o BACKUP_DIR)
 * Multimedia: contenido de UPLOADS_DIR (backend/uploads)
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { APP_VERSION } from '../version.js';
import { UPLOADS_DIR } from './uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const DEFAULT_BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(BACKEND_ROOT, process.env.BACKUP_DIR)
  : DEFAULT_BACKUP_DIR;
const CONFIG_PATH = path.join(DATA_DIR, 'backup-config.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'backup-manifest.json');
const UPLOAD_DIR = path.join(BACKUP_DIR, '_uploads');
const SPAWN_TIMEOUT_MS = Number(process.env.BACKUP_SPAWN_TIMEOUT_MS) || 30 * 60 * 1000;
const OFFICIAL_BACKUP_RE = /^tacticalptx_\d{8}_\d{6}\.(sql|zip)$/;
const ZIP_DB_ENTRY = 'database.sql';
const ZIP_META_ENTRY = 'meta.json';
const ZIP_UPLOADS_ENTRY = 'uploads';

const DEFAULT_CONFIG = {
  enabled: true,
  intervalHours: 24,
  retentionCount: 14,
  lastRunAt: null,
  lastStatus: null,
  lastError: null,
  lastFile: null,
};

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function loadConfig() {
  ensureDirs();
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function loadManifest() {
  ensureDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveManifest(manifest) {
  ensureDirs();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

function safeFilename(name) {
  if (!OFFICIAL_BACKUP_RE.test(name)) return null;
  return name;
}

function recordBackupMeta(filename, { manual = false } = {}) {
  const safe = safeFilename(filename);
  if (!safe) return;
  const manifest = loadManifest();
  manifest[safe] = { manual: !!manual, at: new Date().toISOString() };
  saveManifest(manifest);
}

function removeBackupMeta(filename) {
  const safe = safeFilename(filename);
  if (!safe) return;
  const manifest = loadManifest();
  if (!manifest[safe]) return;
  delete manifest[safe];
  saveManifest(manifest);
}

function syncManifestWithFiles() {
  const manifest = loadManifest();
  const onDisk = new Set(fs.readdirSync(BACKUP_DIR).filter((f) => OFFICIAL_BACKUP_RE.test(f)));
  let changed = false;
  for (const name of Object.keys(manifest)) {
    if (!onDisk.has(name)) {
      delete manifest[name];
      changed = true;
    }
  }
  if (changed) saveManifest(manifest);
  return manifest;
}

function parseDatabaseUrl() {
  const raw = config.databaseUrl || process.env.DATABASE_URL || '';
  try {
    const u = new URL(raw.replace(/^postgresql:/i, 'http:'));
    let host = u.hostname || '127.0.0.1';
    if (host === 'localhost' || host === '::1') host = '127.0.0.1';
    return {
      host,
      port: Number(u.port || 5432),
      database: decodeURIComponent((u.pathname || '/tacticalptx_db').replace(/^\//, '')) || 'tacticalptx_db',
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 5432,
      database: 'tacticalptx_db',
      user: 'postgres',
      password: '',
    };
  }
}

function pgDumpBin() {
  return process.env.PG_DUMP_BIN || 'pg_dump';
}

function psqlBin() {
  return process.env.PSQL_BIN || 'psql';
}

function formatBackupName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `tacticalptx_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.zip`;
}

function runSpawn(command, args, { label = command } = {}) {
  const db = parseDatabaseUrl();
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PGPASSWORD: db.password };
    const proc = spawn(command, args, { env, windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < 200000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      reject(new Error(`${label}: tiempo de espera agotado.`));
    }, SPAWN_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(`No se encontró ${command}. Defina PG_DUMP_BIN / PSQL_BIN en .env.`));
      } else reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${label} terminó con código ${code}`));
    });
  });
}

function runTar(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('tar', args, { env: process.env, windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < 200000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      reject(new Error('tar: tiempo de espera agotado.'));
    }, SPAWN_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error('No se encontró tar (necesario para empaquetar .zip).'));
      } else reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
    });
  });
}

/** Lista entradas del archivo (stdout de `tar -tf`). */
function runTarList(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('tar', args, { env: process.env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      if (stdout.length < 5_000_000) stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < 200000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      reject(new Error('tar: tiempo de espera agotado.'));
    }, SPAWN_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error('No se encontró tar (necesario para empaquetar .zip).'));
      } else reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
    });
  });
}

/** Rechaza path traversal / absolutos antes de extraer (zip-slip). */
async function assertTarEntriesSafe(zipPath) {
  const listing = await runTarList(['-tf', zipPath]);
  for (const line of listing.split(/\r?\n/)) {
    const entry = String(line || '').trim();
    if (!entry) continue;
    const n = entry.replace(/\\/g, '/');
    if (n.startsWith('/') || n.startsWith('~/') || /^[A-Za-z]:/.test(n)) {
      throw new Error('Respaldo inválido: ruta absoluta en el archivo.');
    }
    const parts = n.split('/');
    if (parts.some((p) => p === '..')) {
      throw new Error('Respaldo inválido: path traversal (..).');
    }
  }
}

function assertPathInside(rootAbs, candidateAbs) {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (cand !== root && !cand.startsWith(prefix)) {
    throw new Error('Respaldo inválido: archivo fuera de staging.');
  }
}

/** Defensa en profundidad tras extract (incluye symlinks). */
function assertExtractedInside(stagingAbs) {
  const root = path.resolve(stagingAbs);
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      assertPathInside(root, full);
      if (ent.isSymbolicLink()) {
        let target;
        try {
          target = fs.readlinkSync(full);
        } catch {
          continue;
        }
        assertPathInside(root, path.resolve(dir, target));
      } else if (ent.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(root);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatBackupError(err, fallback = 'No se pudo crear el respaldo.') {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return fallback;
  if (/ENOENT|No se encontró/i.test(raw)) {
    return 'No se encontró pg_dump/psql. Configure PG_DUMP_BIN y PSQL_BIN en .env.';
  }
  if (/password authentication failed|autenticaci/i.test(raw)) {
    return 'Autenticación fallida con PostgreSQL. Revise DATABASE_URL.';
  }
  if (/could not connect|connection refused|ECONNREFUSED/i.test(raw)) {
    return 'No se pudo conectar a PostgreSQL.';
  }
  const first = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || raw;
  return first.length > 280 ? `${first.slice(0, 277)}…` : first;
}

function listBackups() {
  ensureDirs();
  const manifest = syncManifestWithFiles();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => OFFICIAL_BACKUP_RE.test(f))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const st = fs.statSync(full);
      const meta = manifest[f];
      const manual = meta ? !!meta.manual : false;
      return {
        filename: f,
        size: st.size,
        sizeLabel: formatBytes(st.size),
        createdAt: st.mtime.toISOString(),
        manual,
        origin: manual ? 'manual' : 'automatic',
        format: f.endsWith('.zip') ? 'zip' : 'sql',
        includesMeta: f.endsWith('.zip'),
        // Zips nuevos = BD + meta + multimedia; .sql legado = solo BD
        includesMedia: f.endsWith('.zip'),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function pruneBackups(retentionCount) {
  const list = listBackups();
  if (list.length <= retentionCount) return 0;
  let removed = 0;
  for (const item of list.slice(retentionCount)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, item.filename));
      removeBackupMeta(item.filename);
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function uploadsDirHasContent(dir = UPLOADS_DIR) {
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((name) => !name.startsWith('_tmp'));
  } catch {
    return false;
  }
}

function measureUploadsBytes(dir = UPLOADS_DIR) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('_tmp')) continue;
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory() && !e.isSymbolicLink()) walk(p);
        else if (e.isFile()) total += fs.statSync(p).size;
      } catch {
        /* ignore */
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return total;
}

async function packBackupZip(zipPath, sqlPath) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'tpx-bk-'));
  try {
    const stagedSql = path.join(staging, ZIP_DB_ENTRY);
    const stagedMeta = path.join(staging, ZIP_META_ENTRY);
    fs.copyFileSync(sqlPath, stagedSql);

    const includesUploads = uploadsDirHasContent(UPLOADS_DIR);
    const uploadsBytes = includesUploads ? measureUploadsBytes(UPLOADS_DIR) : 0;

    fs.writeFileSync(
      stagedMeta,
      JSON.stringify(
        {
          product: 'TacticalPtx',
          version: APP_VERSION,
          createdAt: new Date().toISOString(),
          includesUploads,
          ...(includesUploads ? { uploadsBytes } : {}),
        },
        null,
        2
      ),
      'utf8'
    );
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    // Windows bsdtar falla con varios -C («Couldn't visit directory») y -rf en .zip
    // no es fiable. Si hay multimedia, enlazar uploads/ dentro del staging y un solo tar.
    const entries = [ZIP_DB_ENTRY, ZIP_META_ENTRY];
    if (includesUploads) {
      const stagedUploads = path.join(staging, ZIP_UPLOADS_ENTRY);
      try {
        fs.symlinkSync(UPLOADS_DIR, stagedUploads, 'junction');
      } catch {
        fs.cpSync(UPLOADS_DIR, stagedUploads, {
          recursive: true,
          dereference: true,
          filter: (src) => !path.basename(src).startsWith('_tmp'),
        });
      }
      entries.push(ZIP_UPLOADS_ENTRY);
    }
    await runTar(['-a', '-cf', zipPath, '--exclude=_tmp*', '-C', staging, ...entries]);
  } finally {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function unpackBackupZip(zipPath) {
  await assertTarEntriesSafe(zipPath);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'tpx-bk-x-'));
  try {
    await runTar(['-xf', zipPath, '-C', staging]);
    assertExtractedInside(staging);
  } catch (err) {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw err;
  }
  const sqlPath = path.join(staging, ZIP_DB_ENTRY);
  if (!fs.existsSync(sqlPath)) {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw new Error('El ZIP no contiene database.sql.');
  }
  const uploadsPath = path.join(staging, ZIP_UPLOADS_ENTRY);
  const hasUploads = uploadsDirHasContent(uploadsPath);
  return { staging, sqlPath, uploadsPath, hasUploads };
}

/**
 * Sustituye UPLOADS_DIR por el árbol restaurado (clon exacto).
 * Mueve el uploads actual a uploads_pre_restore_<timestamp> como seguridad.
 */
function replaceUploadsTree(restoredUploadsPath) {
  const parent = path.dirname(UPLOADS_DIR);
  fs.mkdirSync(parent, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const aside = path.join(parent, `uploads_pre_restore_${stamp}`);

  let movedAside = false;
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.renameSync(UPLOADS_DIR, aside);
    movedAside = true;
  }
  try {
    try {
      fs.renameSync(restoredUploadsPath, UPLOADS_DIR);
    } catch (err) {
      // Fallback si rename falla entre volúmenes: copiar y borrar origen en staging
      fs.cpSync(restoredUploadsPath, UPLOADS_DIR, { recursive: true });
      try {
        fs.rmSync(restoredUploadsPath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      if (!fs.existsSync(UPLOADS_DIR)) throw err;
    }
  } catch (err) {
    if (movedAside && fs.existsSync(aside) && !fs.existsSync(UPLOADS_DIR)) {
      try {
        fs.renameSync(aside, UPLOADS_DIR);
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
  return aside;
}

function runPgDump(outputPath) {
  const db = parseDatabaseUrl();
  return runSpawn(
    pgDumpBin(),
    [
      '-h',
      db.host,
      '-p',
      String(db.port),
      '-U',
      db.user,
      '-d',
      db.database,
      '-F',
      'p',
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '-f',
      outputPath,
    ],
    { label: 'pg_dump' }
  );
}

function runPsql(argsExtra) {
  const db = parseDatabaseUrl();
  return runSpawn(
    psqlBin(),
    ['-h', db.host, '-p', String(db.port), '-U', db.user, '-d', db.database, '-v', 'ON_ERROR_STOP=1', ...argsExtra],
    { label: 'psql' }
  );
}

function isSqlBackupFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size < 50) return false;
  const head = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 8000).toLowerCase();
  return head.includes('postgresql') || head.includes('create table') || head.includes('copy ');
}

function isZipBackupFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size < 50) return false;
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    return buf[0] === 0x50 && buf[1] === 0x4b;
  } finally {
    fs.closeSync(fd);
  }
}

let _running = false;
let _timer = null;

export async function createBackup({ manual = false, internal = false } = {}) {
  if (!internal && _running) throw new Error('Ya hay un respaldo en progreso.');
  if (!internal) _running = true;
  ensureDirs();
  const cfg = loadConfig();
  const filename = formatBackupName();
  const fullPath = path.join(BACKUP_DIR, filename);
  const tmpSql = path.join(BACKUP_DIR, `_tmp_${Date.now()}_${process.pid}.sql`);
  try {
    await runPgDump(tmpSql);
    if (!fs.existsSync(tmpSql) || fs.statSync(tmpSql).size < 100) {
      throw new Error('El archivo de respaldo está vacío.');
    }
    await packBackupZip(fullPath, tmpSql);
    try {
      fs.unlinkSync(tmpSql);
    } catch {
      /* ignore */
    }
    const removed = pruneBackups(cfg.retentionCount);
    saveConfig({
      ...cfg,
      lastRunAt: new Date().toISOString(),
      lastStatus: 'ok',
      lastError: null,
      lastFile: filename,
    });
    recordBackupMeta(filename, { manual });
    console.log(`[Backup] ${manual ? 'Manual' : 'Auto'}: ${filename} (−${removed} antiguos)`);
    return {
      filename,
      path: fullPath,
      size: fs.statSync(fullPath).size,
      sizeLabel: formatBytes(fs.statSync(fullPath).size),
      manual,
    };
  } catch (e) {
    try {
      if (fs.existsSync(tmpSql)) fs.unlinkSync(tmpSql);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      /* ignore */
    }
    const friendly = formatBackupError(e);
    saveConfig({
      ...cfg,
      lastRunAt: new Date().toISOString(),
      lastStatus: 'error',
      lastError: friendly,
    });
    throw new Error(friendly);
  } finally {
    if (!internal) _running = false;
  }
}

export function getBackupPath(filename) {
  const safe = safeFilename(filename);
  if (!safe) return null;
  const full = path.join(BACKUP_DIR, safe);
  return fs.existsSync(full) ? full : null;
}

export function deleteBackup(filename) {
  const full = getBackupPath(filename);
  if (!full) throw new Error('Archivo de respaldo no encontrado.');
  fs.unlinkSync(full);
  removeBackupMeta(filename);
}

async function wipePublicSchema() {
  const db = parseDatabaseUrl();
  const user = String(db.user).replace(/"/g, '""');
  const sql = [
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'GRANT ALL ON SCHEMA public TO PUBLIC;',
    `GRANT ALL ON SCHEMA public TO "${user}";`,
  ].join('\n');
  await runPsql(['-c', sql]);
}

export async function restoreFromArchive(archivePath, { createSafetyBackup = true } = {}) {
  if (_running) throw new Error('Ya hay una operación de respaldo en curso.');
  const lower = String(archivePath).toLowerCase();
  const isZip = lower.endsWith('.zip') || isZipBackupFile(archivePath);
  const isSql = lower.endsWith('.sql') || isSqlBackupFile(archivePath);
  if (!isZip && !isSql) throw new Error('Archivo no válido (.zip o .sql).');

  _running = true;
  let staging = null;
  let sqlPath = archivePath;
  let safetyFile = null;
  let hasUploads = false;
  let restoredUploadsPath = null;
  try {
    if (isZip) {
      const unpacked = await unpackBackupZip(archivePath);
      staging = unpacked.staging;
      sqlPath = unpacked.sqlPath;
      hasUploads = !!unpacked.hasUploads;
      restoredUploadsPath = unpacked.uploadsPath;
    }
    if (!isSqlBackupFile(sqlPath)) throw new Error('SQL del respaldo no válido.');

    if (createSafetyBackup) {
      const safety = await createBackup({ manual: true, internal: true });
      safetyFile = safety.filename;
    }
    await wipePublicSchema();
    await runPsql(['-f', sqlPath]);

    let includesUploads = false;
    let message = 'Base de datos restaurada correctamente.';
    if (hasUploads && restoredUploadsPath && fs.existsSync(restoredUploadsPath)) {
      replaceUploadsTree(restoredUploadsPath);
      includesUploads = true;
      message =
        'Base de datos y multimedia restaurados correctamente. Los uploads previos quedaron en uploads_pre_restore_*.';
    } else if (isZip || isSql) {
      message =
        'Base de datos restaurada. El archivo no incluye multimedia; se conservaron los archivos uploads actuales.';
      includesUploads = false;
    }

    const cfg = loadConfig();
    saveConfig({
      ...cfg,
      lastRunAt: new Date().toISOString(),
      lastStatus: 'restored',
      lastError: null,
      lastFile: path.basename(archivePath),
    });
    return {
      ok: true,
      includesUploads,
      message,
      safetyFile,
    };
  } finally {
    if (staging) {
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    _running = false;
  }
}

export async function restoreNamedBackup(filename) {
  const full = getBackupPath(filename);
  if (!full) throw new Error('Archivo de respaldo no encontrado.');
  return restoreFromArchive(full, { createSafetyBackup: true });
}

function scheduleNext() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  const cfg = loadConfig();
  if (!cfg.enabled) return;
  const hours = Number(cfg.intervalHours) || 24;
  const last = cfg.lastRunAt ? new Date(cfg.lastRunAt).getTime() : 0;
  const due = last + hours * 3600 * 1000;
  const wait = Math.max(5000, due - Date.now());
  _timer = setTimeout(async () => {
    try {
      await createBackup({ manual: false });
    } catch (e) {
      console.error('[Backup] auto:', e.message);
    }
    scheduleNext();
  }, wait);
}

export function startBackupScheduler() {
  ensureDirs();
  scheduleNext();
  console.log(`[Backup] programador activo → ${BACKUP_DIR}`);
}

export function getBackupPublicInfo() {
  const cfg = loadConfig();
  return {
    config: cfg,
    backups: listBackups(),
    backupDir: BACKUP_DIR,
    backupDirRelative: path.relative(BACKEND_ROOT, BACKUP_DIR).replace(/\\/g, '/') || 'data/backups',
    uploadDir: UPLOAD_DIR,
  };
}

export function updateBackupConfig(patch) {
  const cfg = loadConfig();
  const next = {
    ...cfg,
    enabled: patch.enabled != null ? Boolean(patch.enabled) : cfg.enabled,
    intervalHours: patch.intervalHours != null ? Number(patch.intervalHours) : cfg.intervalHours,
    retentionCount: patch.retentionCount != null ? Number(patch.retentionCount) : cfg.retentionCount,
  };
  if (![6, 12, 24, 48, 168].includes(next.intervalHours)) next.intervalHours = 24;
  if (![7, 14, 21, 30, 60, 90].includes(next.retentionCount)) next.retentionCount = 14;
  saveConfig(next);
  scheduleNext();
  return next;
}

export { BACKUP_DIR, UPLOAD_DIR, OFFICIAL_BACKUP_RE };
