/** Descifrado de eventos socket GPS (tpxw1. AES-256-GCM). */

const WIRE_PREFIX = 'tpxw1.';
const SOCKET_KEY = '__tpxWireKey';

/** Fallback si un handler no recibe el socket (páginas de un solo join). */
let liveWireKeyB64 = null;

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
  if (!payload.sealed && !payload.payloadEnc) return payload;
  const key = wireKeyB64 || liveWireKeyB64;
  if (!key || !payload.payloadEnc) return null;

  const text = String(payload.payloadEnc);
  if (!text.startsWith(WIRE_PREFIX)) return null;

  try {
    const keyBytes = b64ToBytes(key);
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

export function setLiveWireKey(b64) {
  liveWireKeyB64 = b64 || null;
}

/** Clave del socket que recibió el evento (cada consola puede tener varios joins). */
export function socketWireKey(socket, session) {
  return socket?.[SOCKET_KEY] || liveWireKeyB64 || session?.crypto?.wireKey || null;
}

export function sessionWireKey(session) {
  return liveWireKeyB64 || session?.crypto?.wireKey || null;
}

/**
 * Escucha dispatch:joined y guarda wireKey en el socket (no pisa otros joins).
 * No dispara setSession: evita cascadas de re-render / poll / 429.
 * @param {import('socket.io-client').Socket} socket
 * @returns {() => void} cleanup
 */
export function applyDispatchJoinedWire(socket) {
  if (!socket) return () => {};

  function onJoined(payload) {
    const key = payload?.wireKey;
    if (!key || typeof key !== 'string') return;
    socket[SOCKET_KEY] = key;
    // Fallback para código legacy que aún usa sessionWireKey() sin socket.
    setLiveWireKey(key);
  }

  socket.on('dispatch:joined', onJoined);
  return () => {
    socket.off('dispatch:joined', onJoined);
  };
}
