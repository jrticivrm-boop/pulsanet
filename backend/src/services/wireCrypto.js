import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Capa de cifrado en tránsito para eventos socket sensibles (GPS, etc.).
 * Prefijo tpxw1. — AES-256-GCM. Complementa TLS; no sustituye HTTPS.
 *
 * Claves por socket de despacho (mint en dispatch:join). La clave org-wide
 * ya no se exporta a clientes.
 */
export const WIRE_PREFIX = 'tpxw1.';

let orgWireKey = null;

function resolveWireSecret() {
  const fromEnv = process.env.WIRE_ENCRYPTION_KEY?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const content = process.env.CONTENT_ENCRYPTION_KEY?.trim();
  if (content && content.length >= 16) return `wire|${content}`;
  return `tacticalptx-wire|${config.jwtSecret}`;
}

/** Solo uso interno servidor (open legado / tests). No exportar a clientes. */
function getOrgWireKey() {
  if (orgWireKey) return orgWireKey;
  orgWireKey = crypto.scryptSync(resolveWireSecret(), 'tacticalptx-wire-v1', 32);
  return orgWireKey;
}

export function isWireEncryptionEnabled() {
  return Boolean(config.wireEncryption);
}

/** Mint de clave AES-256 por conexión de despacho. */
export function mintSocketWireKey() {
  return crypto.randomBytes(32);
}

export function wireKeyToB64(keyBuf) {
  if (!keyBuf || !Buffer.isBuffer(keyBuf)) return null;
  return keyBuf.toString('base64');
}

/**
 * Sella con una clave concreta (Buffer 32 bytes).
 * @param {object} plainObj
 * @param {Buffer} keyBuf
 */
export function sealWirePayloadWithKey(plainObj, keyBuf) {
  if (!isWireEncryptionEnabled() || !keyBuf) return null;
  const text = JSON.stringify(plainObj);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return WIRE_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** @deprecated Prefer sealWirePayloadWithKey — org key no se reparte a clientes. */
export function sealWirePayload(plainObj) {
  return sealWirePayloadWithKey(plainObj, getOrgWireKey());
}

export function openWirePayload(sealed, keyBuf = null) {
  if (sealed == null) return null;
  const text = String(sealed);
  if (!text.startsWith(WIRE_PREFIX)) return null;
  const key = keyBuf || getOrgWireKey();
  try {
    const raw = Buffer.from(text.slice(WIRE_PREFIX.length), 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(json);
  } catch (err) {
    console.error('wireCrypto open:', err.message);
    return null;
  }
}

export function packWireEventWithKey(plainPayload, keyBuf) {
  if (!isWireEncryptionEnabled()) return plainPayload;
  if (!keyBuf) {
    // Sin clave de socket: no enviar coordenadas en claro.
    return { sealed: true, payloadEnc: null, wirePending: true };
  }
  return {
    sealed: true,
    payloadEnc: sealWirePayloadWithKey(plainPayload, keyBuf),
  };
}

/** @deprecated Usar packWireEventWithKey con clave de socket. */
export function packWireEvent(plainPayload) {
  if (!isWireEncryptionEnabled()) return plainPayload;
  return {
    sealed: true,
    payloadEnc: sealWirePayload(plainPayload),
  };
}
