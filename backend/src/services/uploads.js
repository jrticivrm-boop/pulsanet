import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/jpg',
  'image/pjpeg',
  'image/x-png',
]);

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.jfif', '.bmp']);

const VIDEO_EXT = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.m4v',
  '.3gp',
]);

const AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
  'audio/aac',
]);

/** Extensiones ejecutables / peligrosas — no chat. */
const BLOCKED_EXT = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msi',
  '.dll',
  '.ps1',
  '.reg',
  '.apk',
]);

const MB = 1024 * 1024;
/** Techo de transporte multer (docs grandes; imagen/audio/video siguen con tope propio). */
const MULTER_CEILING = 5 * 1024 * MB; // 5 GB
export const LIMITS = {
  image: 10 * MB,
  audio: 15 * MB,
  video: 50 * MB,
  /** Documentos: sin tope práctico (solo el techo multer). */
  file: MULTER_CEILING,
  multer: MULTER_CEILING,
};

function extOf(name) {
  const m = String(name || '')
    .toLowerCase()
    .match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}

function looksLikeImage(mime, filename) {
  const base = (mime || '').split(';')[0].toLowerCase();
  if (IMAGE_MIME.has(base) || base.startsWith('image/')) return true;
  return IMAGE_EXT.has(extOf(filename));
}

export function looksLikeVideo(mime, filename) {
  const base = (mime || '').split(';')[0].toLowerCase();
  if (base.startsWith('video/')) return true;
  return VIDEO_EXT.has(extOf(filename));
}

function isBlocked(filename) {
  return BLOCKED_EXT.has(extOf(filename));
}

/** Segmento de carpeta seguro (nombres de región/zona/unidad/grupo). */
export function slugFolder(input, fallback = 'x') {
  const s = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || fallback;
}

function toPosix(...parts) {
  return path.posix.join(...parts.map((p) => String(p).replace(/\\/g, '/')));
}

/**
 * Resuelve jerarquía org_units (región → zona → unidad) para un unit_id.
 * @returns {Promise<string[]>} segmentos de carpeta
 */
export async function orgUnitFolderSegments(unitId) {
  if (!unitId) return [];
  const { rows } = await query(
    `WITH RECURSIVE up AS (
       SELECT id, parent_id, kind, name, code, 0 AS depth
       FROM org_units WHERE id = $1
       UNION ALL
       SELECT o.id, o.parent_id, o.kind, o.name, o.code, up.depth + 1
       FROM org_units o
       INNER JOIN up ON o.id = up.parent_id
     )
     SELECT id, kind, name, code, depth FROM up ORDER BY depth DESC`,
    [unitId]
  );
  const segs = [];
  for (const r of rows) {
    const label = slugFolder(r.code || r.name || r.kind, r.kind || 'u');
    if (r.kind === 'region') segs.push(`region-${label}`);
    else if (r.kind === 'zone') segs.push(`zone-${label}`);
    else if (r.kind === 'unit') segs.push(`unit-${label}`);
    else segs.push(`${r.kind || 'node'}-${label}`);
  }
  return segs;
}

/** Relativo: orgs/{orgId}/[jerarquía]/groups/{groupId} */
export async function resolveGroupUploadRel(orgId, groupId) {
  const { rows } = await query(
    `SELECT unit_id, name FROM groups WHERE id = $1 AND organization_id = $2`,
    [groupId, orgId]
  );
  if (!rows[0]) throw new Error('Grupo no encontrado');
  const hierarchy = await orgUnitFolderSegments(rows[0].unit_id);
  const groupSeg = `group-${slugFolder(rows[0].name, groupId.slice(0, 8))}-${groupId.slice(0, 8)}`;
  return toPosix('orgs', orgId, ...hierarchy, 'groups', groupSeg);
}

/** Relativo: orgs/{orgId}/dm */
export function resolveDmUploadRel(orgId) {
  return toPosix('orgs', orgId, 'dm');
}

/** Relativo: orgs/{orgId}/avatars */
export function resolveAvatarUploadRel(orgId) {
  return toPosix('orgs', orgId, 'avatars');
}

export function ensureUploadAbsDir(relDir) {
  const abs = path.join(UPLOADS_DIR, ...String(relDir).split('/').filter(Boolean));
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

/** Ruta relativa a guardar en BD (posix). */
export function storedUploadRel(req) {
  const relDir = req.uploadRelDir || '';
  const name = req.file?.filename;
  if (!name) return null;
  return relDir ? toPosix(relDir, name) : name;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const rel = req.uploadRelDir || '';
      const abs = rel ? ensureUploadAbsDir(rel) : UPLOADS_DIR;
      cb(null, abs);
    } catch (e) {
      cb(e);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (isBlocked(file.originalname || file.filename)) {
    cb(new Error('Tipo de archivo no permitido'));
    return;
  }
  cb(null, true);
}

export const uploadMedia = multer({
  storage,
  limits: { fileSize: LIMITS.multer },
  fileFilter,
}).single('file');

export const uploadAudio = multer({
  storage,
  limits: { fileSize: LIMITS.audio },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').split(';')[0];
    if (AUDIO_MIME.has(mime) || mime.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo audio'));
    }
  },
}).single('audio');

/**
 * Middleware: fija carpeta de grupo (jerarquía + groups/…) antes de multer.
 * Espera `req.params.id` o `req.params.groupId`.
 */
export function prepareGroupUploadDir(param = 'id') {
  return async (req, res, next) => {
    try {
      const groupId = req.params[param];
      const orgId = req.user?.orgId;
      if (!groupId || !orgId) {
        return res.status(400).json({ ok: false, error: 'Grupo u organización requerida' });
      }
      const rel = await resolveGroupUploadRel(orgId, groupId);
      ensureUploadAbsDir(rel);
      req.uploadRelDir = rel;
      next();
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'No se pudo preparar carpeta' });
    }
  };
}

/** Middleware: carpeta DM de la org. */
export function prepareDmUploadDir(req, res, next) {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(400).json({ ok: false, error: 'Organización requerida' });
    }
    const rel = resolveDmUploadRel(orgId);
    ensureUploadAbsDir(rel);
    req.uploadRelDir = rel;
    next();
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'No se pudo preparar carpeta' });
  }
}

/** Middleware: avatares por org. */
export function prepareAvatarUploadDir(req, res, next) {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(400).json({ ok: false, error: 'Organización requerida' });
    }
    const rel = resolveAvatarUploadRel(orgId);
    ensureUploadAbsDir(rel);
    req.uploadRelDir = rel;
    next();
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'No se pudo preparar carpeta' });
  }
}

/**
 * Clasifica media de chat.
 * Videos/docs/archivos (zip, rar, office…) → type `file` (enum DB);
 * el cliente usa mediaMime / mediaName para reproducir o icono.
 */
export function classifyMedia(mime, declaredType, filename) {
  if (isBlocked(filename)) {
    return { ok: false, error: 'Tipo de archivo no permitido' };
  }
  const base = (mime || '').split(';')[0];
  if (declaredType === 'audio' || base.startsWith('audio/')) {
    return { ok: true, type: 'audio', kind: 'audio', maxBytes: LIMITS.audio };
  }
  const asImage = declaredType === 'image' || looksLikeImage(mime, filename);
  if (asImage) {
    if (
      declaredType === 'image' &&
      !looksLikeImage(mime, filename) &&
      base &&
      !base.startsWith('image/')
    ) {
      return { ok: false, error: 'Tipo de imagen no permitido' };
    }
    return { ok: true, type: 'image', kind: 'image', maxBytes: LIMITS.image };
  }
  if (declaredType === 'video' || looksLikeVideo(mime, filename)) {
    return { ok: true, type: 'file', kind: 'video', maxBytes: LIMITS.video };
  }
  return { ok: true, type: 'file', kind: 'file', maxBytes: LIMITS.file };
}

export function mediaPreviewLabel(classified, mediaName, caption) {
  if (classified?.type === 'image' || classified?.kind === 'image') return '📷 Imagen';
  if (classified?.type === 'audio' || classified?.kind === 'audio') return '🎤 Audio';
  if (classified?.kind === 'video') return '🎬 Video';
  if (caption) return caption;
  return `📎 ${mediaName || 'Archivo'}`;
}

/**
 * Resuelve ruta en disco. Acepta:
 * - legado: solo filename en raíz de uploads/
 * - nuevo: ruta relativa orgs/.../file
 */
export function mediaDiskPath(storedName) {
  const raw = String(storedName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.includes('..')) {
    return path.join(UPLOADS_DIR, '_invalid');
  }
  if (!raw.includes('/')) {
    // legado plano + avatars/uuid
    const flat = path.join(UPLOADS_DIR, path.basename(raw));
    if (fs.existsSync(flat)) return flat;
    const underAvatars = path.join(UPLOADS_DIR, 'avatars', path.basename(raw));
    if (fs.existsSync(underAvatars)) return underAvatars;
    return flat;
  }
  const abs = path.resolve(UPLOADS_DIR, ...raw.split('/'));
  const root = path.resolve(UPLOADS_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return path.join(UPLOADS_DIR, path.basename(raw));
  }
  return abs;
}

export function sizeLimitError(classified) {
  if (classified?.type === 'image') return 'Imagen demasiado grande (máx 10 MB)';
  if (classified?.type === 'audio') return 'Audio demasiado grande (máx 15 MB)';
  if (classified?.kind === 'video') return 'Video demasiado grande (máx 50 MB)';
  return 'Documento demasiado grande (máx 5 GB)';
}
