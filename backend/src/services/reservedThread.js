/**
 * Búsqueda y exportación de un hilo RESERVADO.
 * El texto va cifrado en la base: se abre en memoria y se filtra aquí.
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
const EXPORT_DIR = path.join(path.resolve(__dirname, '../..'), 'data', 'reserved-exports');
const MAX_ROWS = 4000;
const PAGE = 20;

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [y, m, d] = String(value).split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return String(value);
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function foldParts(text) {
  const chars = Array.from(String(text || ''));
  let folded = '';
  const at = [];
  chars.forEach((ch, i) => {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const c of base) {
      folded += c;
      at.push(i);
    }
  });
  return { chars, folded, at };
}

function snippetAround(chars, start, end) {
  const from = Math.max(0, start - 42);
  const to = Math.min(chars.length, end + 42);
  return {
    before: `${from > 0 ? '…' : ''}${chars.slice(from, start).join('')}`,
    match: chars.slice(start, end).join(''),
    after: `${chars.slice(end, to).join('')}${to < chars.length ? '…' : ''}`,
  };
}

function countHits(chars, folded, at, needle) {
  const hits = [];
  if (!needle) return hits;
  let from = 0;
  for (;;) {
    const i = folded.indexOf(needle, from);
    if (i < 0) break;
    const start = at[i];
    const end = at[i + needle.length - 1] + 1;
    hits.push(snippetAround(chars, start, end));
    from = i + Math.max(needle.length, 1);
  }
  return hits;
}

function plainText(row) {
  const body = openMessageBody(row.type, row.body);
  return String(body || '').trim();
}

function wiped(row) {
  return Boolean(row.deleted_at) && !row.body && !row.media_url;
}

async function loadThread({ orgId, userId, peerId, groupId, from, to }) {
  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  if (!fromDay || !toDay || fromDay > toDay) throw fail('Elige un periodo válido.');
  if (!userId) throw fail('Elige de quién es el hilo.');

  const { rows: who } = await query(
    `SELECT id, display_name FROM users WHERE id = $1 AND organization_id = $2`,
    [userId, orgId]
  );
  if (!who[0]) throw fail('Operador no encontrado.', 404);

  let title = '';
  let sql = '';
  let params = [];
  if (groupId) {
    const { rows: g } = await query(
      `SELECT id, name FROM groups WHERE id = $1 AND organization_id = $2`,
      [groupId, orgId]
    );
    if (!g[0]) throw fail('Grupo no encontrado.', 404);
    title = `${who[0].display_name} en ${g[0].name}`;
    params = [groupId, fromDay, toDay, MAX_ROWS + 1];
    sql = `SELECT m.id, m.sender_id, m.type, m.body, m.media_url, m.media_mime, m.media_name,
                  m.deleted_at, m.view_once, m.view_once_opened_at, m.created_at,
                  u.display_name AS sender_name
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.group_id = $1
             AND m.created_at >= $2::date
             AND m.created_at < ($3::date + INTERVAL '1 day')
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT $4`;
  } else if (peerId && String(peerId) !== String(userId)) {
    const { rows: peer } = await query(
      `SELECT id, display_name FROM users WHERE id = $1 AND organization_id = $2`,
      [peerId, orgId]
    );
    if (!peer[0]) throw fail('Operador no encontrado.', 404);
    title = `${who[0].display_name} con ${peer[0].display_name}`;
    params = [userId, peerId, fromDay, toDay, MAX_ROWS + 1];
    sql = `SELECT m.id, m.sender_id, m.type, m.body, m.media_url, m.media_mime, m.media_name,
                  m.deleted_at, m.view_once, m.view_once_opened_at, m.created_at,
                  u.display_name AS sender_name
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.group_id IS NULL AND m.recipient_id IS NOT NULL
             AND (
               (m.sender_id = $1 AND m.recipient_id = $2)
               OR (m.sender_id = $2 AND m.recipient_id = $1)
             )
             AND m.created_at >= $3::date
             AND m.created_at < ($4::date + INTERVAL '1 day')
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT $5`;
  } else {
    throw fail('Elige con quién es el hilo.');
  }

  const { rows } = await query(sql, params);
  const truncated = rows.length > MAX_ROWS;
  return {
    title,
    from: fromDay,
    to: toDay,
    truncated,
    rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
  };
}

export async function searchReservedThread(opts) {
  const q = String(opts.q || '').trim();
  const onlyDeleted = opts.onlyDeleted === true || opts.onlyDeleted === '1' || opts.onlyDeleted === 'true';
  if (!q && !onlyDeleted) throw fail('Escribe qué buscar, o marca Solo eliminados.');
  if (q.length > 80) throw fail('La búsqueda admite hasta 80 caracteres.');
  const offset = Math.max(parseInt(opts.offset, 10) || 0, 0);
  const thread = await loadThread(opts);
  const needle = foldParts(q).folded;
  const found = [];
  let occurrences = 0;
  for (const row of thread.rows) {
    if (onlyDeleted && !row.deleted_at) continue;
    const text = plainText(row);
    const { chars, folded, at } = foldParts(text);
    const parts = q ? countHits(chars, folded, at, needle) : [];
    if (q && parts.length === 0) continue;
    occurrences += q ? parts.length : 1;
    const sample = parts[0] || snippetAround(chars, 0, Math.min(chars.length, 90));
    found.push({
      messageId: row.id,
      senderName: row.sender_name || 'Usuario',
      createdAt: row.created_at,
      isDeleted: Boolean(row.deleted_at),
      contentWiped: wiped(row),
      viewOnce: Boolean(row.view_once),
      type: row.type,
      occurrences: q ? parts.length : 1,
      snippet: sample,
    });
  }
  return {
    title: thread.title,
    from: thread.from,
    to: thread.to,
    truncated: thread.truncated,
    query: q,
    onlyDeleted,
    occurrences,
    messages: found.length,
    total: found.length,
    offset,
    hits: found.slice(offset, offset + PAGE),
  };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function when(iso) {
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return String(iso || '');
  }
}

function copyMedia(row, mediaDir) {
  if (!row.media_url) return null;
  const disk = mediaDiskPath(row.media_url);
  if (!disk || !fs.existsSync(disk) || !fs.statSync(disk).isFile()) return null;
  const ext = path.extname(disk) || '';
  const name = `${row.id}${ext}`;
  fs.copyFileSync(disk, path.join(mediaDir, name));
  return `media/${name}`;
}

function mediaTag(row, rel) {
  if (!rel) return '';
  const mime = String(row.media_mime || '');
  if (row.type === 'image' || mime.startsWith('image/')) {
    return `<figure class="frame"><img src="${esc(rel)}" alt=""><figcaption>Foto</figcaption></figure>`;
  }
  if (row.type === 'audio' || mime.startsWith('audio/')) {
    return `<audio controls src="${esc(rel)}"></audio>`;
  }
  if (row.type === 'video' || mime.startsWith('video/')) {
    return `<video controls src="${esc(rel)}"></video>`;
  }
  return `<p><a href="${esc(rel)}">${esc(row.media_name || 'Archivo')}</a></p>`;
}

function messageHtml(row, rel) {
  const text = plainText(row);
  const badges = [];
  if (row.deleted_at) badges.push(row.type === 'image' ? 'Imagen eliminada' : 'Mensaje eliminado');
  if (row.view_once) badges.push('Solo 1 vez');
  const badge = badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('');
  const body = wiped(row)
    ? '<p class="muted">El contenido ya no está en el servidor. Queda quién lo envió y cuándo.</p>'
    : `${mediaTag(row, rel)}${text ? `<p>${esc(text)}</p>` : ''}`;
  return `<article id="m-${esc(row.id)}">
    <header><strong>${esc(row.sender_name || 'Usuario')}</strong><time>${esc(when(row.created_at))}</time>${badge}</header>
    ${body || '<p class="muted">Sin texto.</p>'}
  </article>`;
}

function zipDir(sourceDir, destZip) {
  return new Promise((resolve, reject) => {
    const proc = spawn('tar', ['-a', '-c', '-f', destZip, '-C', sourceDir, '.'], { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (b) => {
      stderr += b.toString();
    });
    proc.on('error', (err) => reject(err.code === 'ENOENT' ? fail('No se encontró tar para armar el ZIP.', 500) : err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
    });
  });
}

export async function exportReservedThread(opts) {
  const thread = await loadThread(opts);
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const id = randomUUID();
  const staging = path.join(EXPORT_DIR, `_staging_${id}`);
  const mediaDir = path.join(staging, 'media');
  const zipName = `conversacion_${thread.from}_${thread.to}.zip`;
  const zipPath = path.join(EXPORT_DIR, `${id}.zip`);
  fs.mkdirSync(mediaDir, { recursive: true });
  const blocks = thread.rows.map((row) => messageHtml(row, copyMedia(row, mediaDir)));
  const note = thread.truncated
    ? `<p class="warn">Este periodo tiene más de ${MAX_ROWS} mensajes. El archivo incluye los primeros ${MAX_ROWS}.</p>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(thread.title)}</title>
  <style>
    body { margin: 0; font: 15px/1.45 Segoe UI, sans-serif; background: #e7e2d8; color: #1c1915; }
    main { max-width: 42rem; margin: 0 auto; padding: 1.25rem 1rem 2rem; }
    h1 { font-size: 1.15rem; margin: 0 0 0.25rem; }
    .lead, .warn { margin: 0 0 1rem; color: #5c564c; }
    .warn { color: #8a3b12; }
    article { background: #fff; border-radius: 10px; padding: 0.7rem 0.8rem; margin: 0 0 0.55rem; }
    header { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; align-items: baseline; margin-bottom: 0.35rem; }
    time { color: #6b6560; font-size: 0.8rem; }
    .badge { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; color: #8a3b12; background: #f6e4d4; border-radius: 999px; padding: 0.05rem 0.45rem; }
    .frame { margin: 0.2rem 0; background: #f4f1ea; border: 1px solid #e3ddd2; border-radius: 8px; padding: 0.4rem; }
    .frame img, video { display: block; max-width: 100%; max-height: 22rem; margin: 0 auto; }
    figcaption, .muted { color: #6b6560; font-size: 0.85rem; }
    audio { width: 100%; }
    p { margin: 0.25rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>${esc(thread.title)}</h1>
    <p class="lead">Periodo ${esc(thread.from)} a ${esc(thread.to)}. Las fotos y los audios están en la carpeta media, junto a este archivo. Ctrl+F busca en el texto.</p>
    ${note}
    ${blocks.join('\n') || '<p class="muted">Sin mensajes en este periodo.</p>'}
  </main>
</body>
</html>`;
  fs.writeFileSync(path.join(staging, 'conversacion.html'), html, 'utf8');
  await zipDir(staging, zipPath);
  fs.rmSync(staging, { recursive: true, force: true });
  return {
    zipPath,
    filename: zipName,
    cleanup() {
      fs.rmSync(zipPath, { force: true });
    },
  };
}
