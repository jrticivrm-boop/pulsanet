/** Descifrado de eventos socket GPS (tpxw1. AES-256-GCM). */

const WIRE_PREFIX = 'tpxw1.';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return b64ToBytes(b64);
}

/**
 * @param {unknown} payload
 * @param {string|null|undefined} wireKeyB64
 */
export async function unwrapDispatchPayload(payload, wireKeyB64) {
  if (!payload || typeof payload !== 'object') return payload;
  const sealed = payload.payloadEnc || (payload.sealed && payload.payloadEnc);
  if (!payload.sealed && !payload.payloadEnc) return payload;
  if (!wireKeyB64 || !payload.payloadEnc) return null;

  const text = String(payload.payloadEnc);
  if (!text.startsWith(WIRE_PREFIX)) return null;

  try {
    const keyBytes = b64ToBytes(wireKeyB64);
    const raw = b64urlToBytes(text.slice(WIRE_PREFIX.length));
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    // WebCrypto expects ciphertext||tag
    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data, 0);
    combined.set(tag, data.length);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      combined
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (err) {
    console.error('wireCrypto unwrap:', err);
    return null;
  }
}

export function sessionWireKey(session) {
  return session?.crypto?.wireKey || null;
}
