/**
 * Expediente RESERVADO: copia mensual de conversaciones y audios.
 * No borra los archivos en vivo (el teléfono sigue abriéndolos).
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { query } from '../db.js';
import { mediaDiskPath } from './uploads.js';
import { openMessageBody } from './contentCrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'reserved-archives');
const CONFIG_PATH = path.join(DATA_DIR, 'reserved-archive-config.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'reserved-archive-manifest.json');

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DEFAULT_CONFIG = {
  intervalEnabled: true,
  intervalHours: 24,
  lastIntervalAt: null,
  lastMonthKey: null,
  lastMonthStatus: null,
  lastMonthError: null,
  lastMonthLabel: null,
};

let _running = false;
let _tickRunning = false;
let _timer = null;
const PAGE = 2000;
const MAX_ROWS = 200000;

function ensureDirs() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveManifest(list) {
  ensureDirs();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(list, null, 2), 'utf8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(year, monthIndex) {
  return `Respaldo completo del mes de ${MONTHS[monthIndex]} ${year}`;
}

function previousMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: isoDate(start), to: isoDate(end), key: monthKey(start), label: monthLabel(start.getFullYear(), start.getMonth()) };
}

function currentMonthSoFar(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: isoDate(start),
    to: isoDate(now),
    key: monthKey(start),
    label: `Copia parcial de ${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
  };
}

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return value;
}

function zipWithTar(sourceDir, destZip) {
  return new Promise((resolve, reject) => {
    const proc = spawn('tar', ['-a', '-c', '-f', destZip, '-C', sourceDir, '.'], {
      windowsHide: true,
    });
    let stderr = '';
    proc.stderr.on('data', (b) => {
      stderr += b.toString();
    });
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') reject(new Error('No se encontró tar para empaquetar el respaldo.'));
      else reject(err);
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
    });
  });
}

async function collectPaged(sql, params) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { rows: page } = await query(`${sql} LIMIT ${PAGE} OFFSET ${offset}`, params);
    rows.push(...page);
    if (page.length < PAGE) return rows;
    offset += PAGE;
    if (offset >= MAX_ROWS) {
      const err = new Error('El periodo tiene demasiados registros para un solo respaldo.');
      err.status = 413;
      throw err;
    }
  }
}

async function collectRows(orgId, from, to) {
  const messages = await collectPaged(
    `SELECT m.id, m.sender_id, m.recipient_id, m.group_id, m.type, m.body, m.media_url,
            m.media_name, m.media_mime, m.created_at, m.deleted_at, m.view_once,
            su.display_name AS sender_name,
            ru.display_name AS recipient_name,
            g.name AS group_name
     FROM messages m
     INNER JOIN users su ON su.id = m.sender_id AND su.organization_id = $1
     LEFT JOIN users ru ON ru.id = m.recipient_id
     LEFT JOIN groups g ON g.id = m.group_id
     WHERE m.created_at >= $2::date
       AND m.created_at < ($3::date + INTERVAL '1 day')
     ORDER BY m.created_at ASC, m.id ASC`,
    [orgId, from, to]
  );
  const recordings = await collectPaged(
    `SELECT r.id, r.file_path, r.user_id, r.group_id, r.mime_type, r.byte_size, r.duration_ms, r.created_at,
            u.display_name, g.name AS group_name
     FROM ptt_recordings r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN groups g ON g.id = r.group_id
     WHERE r.organization_id = $1
       AND r.created_at >= $2::date
       AND r.created_at < ($3::date + INTERVAL '1 day')
     ORDER BY r.created_at ASC, r.id ASC`,
    [orgId, from, to]
  );
  return { messages, recordings };
}

function copyIfExists(stored, destDir, prefix) {
  const disk = mediaDiskPath(stored);
  if (!disk || !fs.existsSync(disk) || !fs.statSync(disk).isFile()) {
    return { copied: false, name: null };
  }
  const ext = path.extname(disk) || '';
  const name = `${prefix}${ext}`;
  fs.copyFileSync(disk, path.join(destDir, name));
  return { copied: true, name };
}

export async function createReservedArchive({ orgId, from, to, kind, label, monthKey: mKey }) {
  if (_running) {
    const e = new Error('Ya hay un respaldo de RESERVADO en curso.');
    e.status = 409;
    throw e;
  }
  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  if (!fromDay || !toDay || fromDay > toDay) {
    const e = new Error('Rango de fechas no válido.');
    e.status = 400;
    throw e;
  }
  _running = true;
  const id = randomUUID();
  const staging = path.join(ARCHIVE_DIR, `_staging_${id}`);
  const mediaDir = path.join(staging, 'audios');
  const zipName = `reservado_${fromDay}_${toDay}_${id.slice(0, 8)}.zip`;
  const zipPath = path.join(ARCHIVE_DIR, zipName);
  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    const { messages, recordings } = await collectRows(orgId, fromDay, toDay);
    const index = [];
    let missing = 0;
    for (const m of messages) {
      let file = null;
      if (m.media_url) {
        const copied = copyIfExists(m.media_url, mediaDir, `chat-${m.id}`);
        file = copied.name;
        if (!copied.copied) missing += 1;
      }
      const withWhom = m.group_id
        ? m.group_name || 'Grupo'
        : m.recipient_name || 'Operador';
      index.push({
        kind: 'chat',
        at: m.created_at,
        from: m.sender_name || m.sender_id,
        with: withWhom,
        type: m.type,
        deleted: Boolean(m.deleted_at),
        viewOnce: Boolean(m.view_once),
        text: String(openMessageBody(m.type, m.body) || '').slice(0, 4000) || null,
        file,
      });
    }
    for (const r of recordings) {
      const copied = copyIfExists(r.file_path, mediaDir, `ptt-${r.id}`);
      if (!copied.copied) missing += 1;
      index.push({
        kind: 'ptt',
        at: r.created_at,
        from: r.display_name || r.user_id,
        with: r.group_name || 'Canal',
        type: 'audio',
        text: null,
        file: copied.name,
        durationMs: r.duration_ms,
      });
    }
    const meta = {
      id,
      label: label || `Respaldo ${fromDay} a ${toDay}`,
      kind,
      monthKey: mKey || null,
      from: fromDay,
      to: toDay,
      organizationId: orgId,
      messages: messages.length,
      recordings: recordings.length,
      missingFiles: missing,
      createdAt: new Date().toISOString(),
      status: 'completo',
    };
    fs.writeFileSync(path.join(staging, 'indice.json'), JSON.stringify(index, null, 2), 'utf8');
    fs.writeFileSync(path.join(staging, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
    await zipWithTar(staging, zipPath);
    const stat = fs.statSync(zipPath);
    const entry = {
      ...meta,
      file: zipName,
      bytes: stat.size,
    };
    const list = loadManifest();
    list.unshift(entry);
    saveManifest(list.slice(0, 80));
    return entry;
  } catch (err) {
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch {
      /* ignore */
    }
    const failed = {
      id,
      label: label || `Respaldo ${fromDay} a ${toDay}`,
      kind,
      monthKey: mKey || null,
      from: fromDay,
      to: toDay,
      organizationId: orgId,
      messages: 0,
      recordings: 0,
      missingFiles: 0,
      bytes: 0,
      createdAt: new Date().toISOString(),
      status: 'falló',
      error: err.message || 'No se pudo crear el respaldo',
    };
    const list = loadManifest();
    list.unshift(failed);
    saveManifest(list.slice(0, 80));
    throw err;
  } finally {
    _running = false;
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function orgIds() {
  const { rows } = await query(`SELECT id FROM organizations ORDER BY created_at ASC`);
  return rows.map((r) => r.id);
}

export async function maybeClosePreviousMonth() {
  const cfg = loadConfig();
  const prev = previousMonthRange();
  if (cfg.lastMonthKey === prev.key && cfg.lastMonthStatus === 'completo') return null;
  try {
    const orgs = await orgIds();
    if (!orgs.length) return null;
    const done = new Set(
      loadManifest()
        .filter((a) => a.kind === 'month' && a.monthKey === prev.key && a.status === 'completo')
        .map((a) => a.organizationId)
    );
    let last = null;
    for (const orgId of orgs) {
      if (done.has(orgId)) continue;
      last = await createReservedArchive({
        orgId,
        from: prev.from,
        to: prev.to,
        kind: 'month',
        label: prev.label,
        monthKey: prev.key,
      });
    }
    saveConfig({
      ...loadConfig(),
      lastMonthKey: prev.key,
      lastMonthStatus: 'completo',
      lastMonthError: null,
      lastMonthLabel: prev.label,
    });
    return last;
  } catch (err) {
    if (err.status === 409) return null;
    saveConfig({
      ...loadConfig(),
      lastMonthKey: prev.key,
      lastMonthStatus: 'falló',
      lastMonthError: err.message || 'No se pudo cerrar el mes',
      lastMonthLabel: prev.label,
    });
    return null;
  }
}

export async function maybeIntervalCopy() {
  const cfg = loadConfig();
  if (!cfg.intervalEnabled) return null;
  const hours = [6, 12, 24].includes(Number(cfg.intervalHours)) ? Number(cfg.intervalHours) : 24;
  const last = cfg.lastIntervalAt ? new Date(cfg.lastIntervalAt).getTime() : 0;
  if (Date.now() - last < hours * 3600 * 1000) return null;
  const cur = currentMonthSoFar();
  try {
    const orgs = await orgIds();
    let lastEntry = null;
    for (const orgId of orgs) {
      lastEntry = await createReservedArchive({
        orgId,
        from: cur.from,
        to: cur.to,
        kind: 'interval',
        label: cur.label,
        monthKey: cur.key,
      });
    }
    saveConfig({
      ...loadConfig(),
      lastIntervalAt: new Date().toISOString(),
      intervalHours: hours,
      lastIntervalStatus: 'completo',
      lastIntervalError: null,
    });
    return lastEntry;
  } catch (err) {
    if (err.status !== 409) {
      saveConfig({
        ...loadConfig(),
        lastIntervalStatus: 'falló',
        lastIntervalError: err.message || 'No se pudo hacer la copia parcial',
      });
    }
    console.error('[ReservedArchive] intervalo:', err.message);
    return null;
  }
}

export function getReservedArchiveInfo(orgId) {
  const cfg = loadConfig();
  return {
    config: {
      intervalEnabled: cfg.intervalEnabled !== false,
      intervalHours: cfg.intervalHours || 24,
      lastIntervalAt: cfg.lastIntervalAt,
      lastIntervalStatus: cfg.lastIntervalStatus || null,
      lastIntervalError: cfg.lastIntervalError || null,
    },
    month: {
      key: cfg.lastMonthKey,
      status: cfg.lastMonthStatus,
      error: cfg.lastMonthError,
      label: cfg.lastMonthLabel,
    },
    archives: loadManifest()
      .filter((a) => a.organizationId === orgId)
      .map((a) => ({
        id: a.id,
        label: a.label,
        kind: a.kind,
        from: a.from,
        to: a.to,
        status: a.status,
        error: a.error || null,
        messages: a.messages,
        recordings: a.recordings,
        missingFiles: a.missingFiles,
        bytes: a.bytes,
        createdAt: a.createdAt,
        file: a.file,
      })),
    running: _running,
  };
}

export function noteOfficialMonth(entry) {
  if (!entry || entry.kind !== 'month' || entry.status !== 'completo') return;
  const prev = previousMonthRange();
  if (entry.monthKey !== prev.key) return;
  saveConfig({
    ...loadConfig(),
    lastMonthKey: prev.key,
    lastMonthStatus: 'completo',
    lastMonthError: null,
    lastMonthLabel: entry.label || prev.label,
  });
}

export function updateReservedArchiveConfig(patch) {
  const cfg = loadConfig();
  const hours = Number(patch.intervalHours);
  const next = {
    ...cfg,
    intervalEnabled: patch.intervalEnabled != null ? Boolean(patch.intervalEnabled) : cfg.intervalEnabled,
    intervalHours: [6, 12, 24].includes(hours) ? hours : cfg.intervalHours || 24,
  };
  saveConfig(next);
  return next;
}

export function reservedArchiveFile(id, orgId) {
  const row = loadManifest().find((a) => a.id === id && a.organizationId === orgId);
  if (!row?.file || row.status !== 'completo') return null;
  const root = path.resolve(ARCHIVE_DIR);
  const full = path.resolve(root, path.basename(row.file));
  if (path.dirname(full) !== root || !fs.existsSync(full)) return null;
  return { full, name: row.file, label: row.label };
}

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function rangeFromMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return null;
  const [y, m] = ym.split('-').map((n) => parseInt(n, 10));
  const start = new Date(y, m - 1, 1);
  if (start.getFullYear() !== y || start.getMonth() !== m - 1) return null;
  const end = new Date(y, m, 0);
  return {
    from: isoDate(start),
    to: isoDate(end),
    key: `${y}-${pad(m)}`,
    label: monthLabel(y, m - 1),
    manualLabel: `Copia manual de ${MONTHS[m - 1]} ${y}`,
  };
}

export function startReservedArchiveScheduler() {
  ensureDirs();
  const tick = async () => {
    if (_tickRunning) return;
    _tickRunning = true;
    try {
      await maybeClosePreviousMonth();
      await maybeIntervalCopy();
    } catch (err) {
      console.error('[ReservedArchive]', err.message);
    } finally {
      _tickRunning = false;
    }
  };
  setTimeout(tick, 20000);
  if (_timer) clearInterval(_timer);
  _timer = setInterval(tick, 60 * 60 * 1000);
  console.log(`[ReservedArchive] programador activo → ${ARCHIVE_DIR}`);
}

export { ARCHIVE_DIR };
