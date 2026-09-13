import crypto from 'crypto';
import { config } from '../config.js';

/** Prefijo de payloads cifrados (compatible con texto legado en claro). */
export const CONTENT_PREFIX = 'tpx1.';

let cachedKey = null;

function resolveSecret() {
  const fromEnv = process.env.CONTENT_ENCRYPTION_KEY?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  // Derivación de respaldo (dev): no usar en prod sin CONTENT_ENCRYPTION_KEY
  return `tacticalptx-content|${config.jwtSecret}|${config.livekit.apiSecret || 'lk'}`;
}

function getKey() {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.scryptSync(resolveSecret(), 'tacticalptx-aes256-v1', 32);
  return cachedKey;
}

export function isContentEncryptionReady() {
  const key = process.env.CONTENT_ENCRYPTION_KEY?.trim();
  if (config.isProd) {
    return Boolean(key && key.length >= 32);
  }
  // Dev: solo “listo” si hay clave explícita (evita fingir cifrado con fallback JWT).
  return Boolean(key && key.length >= 16);
}

/**
 * @deprecated No exportar a clientes: el servidor abre cuerpos en reposo.
 * Se mantiene por compat; siempre null.
 */
export function exportContentKeyB64() {
  return null;
}

/**
 * AES-256-GCM sobre texto (chat / DM / leyendas).
 * Stickers y null se dejan igual.
 */
export function encryptText(plain, { force = false } = {}) {
  if (plain == null) return plain;
  const text = String(plain);
  if (!text) return text;
  if (text.startsWith(CONTENT_PREFIX)) return text;
  if (!force && config.isProd && !isContentEncryptionReady()) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return CONTENT_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptText(stored) {
  if (stored == null) return stored;
  const text = String(stored);
  if (!text.startsWith(CONTENT_PREFIX)) return text;

  try {
    const raw = Buffer.from(text.slice(CONTENT_PREFIX.length), 'base64url');
    if (raw.length < 12 + 16 + 1) return text;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('contentCrypto decrypt:', err.message);
    return '[mensaje cifrado — clave incorrecta]';
  }
}

/** Cifra cuerpos de mensaje de usuario; no toca ids de sticker / zumbidos. */
export function sealMessageBody(type, body) {
  if (body == null || body === '') return body;
  if (type === 'sticker' || type === 'nudge') return body;
  return encryptText(body);
}

export function openMessageBody(type, body) {
  if (body == null || body === '') return body;
  if (type === 'sticker' || type === 'nudge') return body;
  return decryptText(body);
}
