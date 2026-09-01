import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Capa de cifrado en tránsito para eventos socket sensibles (GPS, etc.).
 * Prefijo tpxw1. — AES-256-GCM. Complementa TLS; no sustituye HTTPS.
 */
export const WIRE_PREFIX = 'tpxw1.';

let wireKey = null;

function resolveWireSecret() {
  const fromEnv = process.env.WIRE_ENCRYPTION_KEY?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const content = process.env.CONTENT_ENCRYPTION_KEY?.trim();
  if (content && content.length >= 16) return `wire|${content}`;
  return `tacticalptx-wire|${config.jwtSecret}`;
}

function getWireKey() {
  if (wireKey) return wireKey;
  wireKey = crypto.scryptSync(resolveWireSecret(), 'tacticalptx-wire-v1', 32);
  return wireKey;
}

export function isWireEncryptionEnabled() {
  return Boolean(config.wireEncryption);
}

/** Clave en base64 para clientes autenticados (entregada solo tras login). */
export function exportWireKeyB64() {
  if (!isWireEncryptionEnabled()) return null;
  return getWireKey().toString('base64');
}

export function sealWirePayload(plainObj) {
  if (!isWireEncryptionEnabled()) return null;
  const text = JSON.stringify(plainObj);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getWireKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return WIRE_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function openWirePayload(sealed) {
  if (sealed == null) return null;
  const text = String(sealed);
  if (!text.startsWith(WIRE_PREFIX)) return null;
  try {
    const raw = Buffer.from(text.slice(WIRE_PREFIX.length), 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getWireKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(json);
  } catch (err) {
    console.error('wireCrypto open:', err.message);
    return null;
  }
}

/** Paquete socket: solo cifrado (sin coordenadas en claro) si wire está activo. */
export function packWireEvent(plainPayload) {
  if (!isWireEncryptionEnabled()) return plainPayload;
  return {
    sealed: true,
    payloadEnc: sealWirePayload(plainPayload),
  };
}
