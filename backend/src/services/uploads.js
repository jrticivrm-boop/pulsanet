import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { randomUUID } from 'crypto';

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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  // Accept images, audio and common docs/video as "file"
  cb(null, true);
}

export const uploadMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter,
}).single('file');

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

export const uploadAudio = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').split(';')[0];
    if (AUDIO_MIME.has(mime) || mime.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo audio'));
    }
  },
}).single('audio');

export function classifyMedia(mime, declaredType, filename) {
  const base = (mime || '').split(';')[0];
  if (declaredType === 'audio' || base.startsWith('audio/')) {
    return { ok: true, type: 'audio', maxBytes: 15 * 1024 * 1024 };
  }
  const asImage =
    declaredType === 'image' || looksLikeImage(mime, filename);
  if (asImage) {
    // Si el cliente declara image pero ni mime ni extensión lo respaldan, rechazar
    if (declaredType === 'image' && !looksLikeImage(mime, filename) && base && !base.startsWith('image/')) {
      return { ok: false, error: 'Tipo de imagen no permitido' };
    }
    return { ok: true, type: 'image', maxBytes: 10 * 1024 * 1024 };
  }
  return { ok: true, type: 'file', maxBytes: 25 * 1024 * 1024 };
}

export function mediaDiskPath(storedName) {
  const safe = path.basename(storedName);
  return path.join(UPLOADS_DIR, safe);
}
