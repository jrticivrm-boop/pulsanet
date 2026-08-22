import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config.js';

export function isLiveKitConfigured() {
  const { url, apiKey, apiSecret } = config.livekit;
  return Boolean(url && apiKey && apiSecret);
}

/**
 * URL que debe usar el cliente (móvil / otro PC).
 * Misma IP con la que el cliente llegó a la API (LAN o Tailscale).
 * LIVEKIT_PUBLIC_URL no se fuerza: si no, un teléfono en Wi‑Fi recibe 100.x y el audio no llega.
 */
export function resolveLiveKitUrl(req) {
  const configured = config.livekit.url || '';
  const override = process.env.LIVEKIT_PUBLIC_URL?.trim();
  const source = override || configured;

  const rawHost =
    (typeof req?.headers?.['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0]
      : null) ||
    (typeof req?.headers?.host === 'string' ? req.headers.host : null) ||
    '';
  const host = rawHost.split(':')[0].trim();

  let proto = source.startsWith('wss') ? 'wss' : 'ws';
  let port = '7880';
  try {
    const u = new URL(source.replace(/^ws/i, 'http'));
    if (u.port) port = u.port;
  } catch {
    /* defaults */
  }

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `${proto}://${host}:${port}`;
  }

  return configured || override || '';
}

/**
 * Token LiveKit para unirse a la room del grupo.
 * canPublish: false si el rol es listen_only (solo escucha).
 */
export async function createRoomToken({
  identity,
  displayName,
  roomName,
  canPublish = true,
}) {
  if (!isLiveKitConfigured()) {
    throw new Error('LiveKit no configurado (LIVEKIT_URL / API_KEY / API_SECRET)');
  }

  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: String(identity),
    name: displayName || String(identity),
    ttl: '2h',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}
