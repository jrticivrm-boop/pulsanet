import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config.js';

export function isLiveKitConfigured() {
  const { url, apiKey, apiSecret } = config.livekit;
  return Boolean(url && apiKey && apiSecret);
}

function pickProtoAndPort(source) {
  let proto = source.startsWith('wss') ? 'wss' : 'ws';
  // No forzar wss://:7880 solo porque la API tenga TLS: LiveKit en este stack
  // escucha ws en claro; el web HTTPS usa proxy Vite (ver web/src/livekitUrl.js).
  if (process.env.LIVEKIT_FORCE_WSS === '1') proto = 'wss';
  let port = '7880';
  try {
    const u = new URL(source.replace(/^ws/i, 'http'));
    if (u.port) port = u.port;
  } catch {
    /* defaults */
  }
  return { proto, port };
}

function clientIp(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  const ip = req?.ip || req?.socket?.remoteAddress || '';
  return String(ip).replace(/^::ffff:/, '');
}

function isPrivateIp(ip) {
  if (!ip) return false;
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
}

/**
 * URL LiveKit para el cliente (móvil / web / referencia).
 *
 * Preferencia:
 * 1) LIVEKIT_PUBLIC_URL — override (p. ej. wss://dominio.sslip.io)
 * 2) Cliente en LAN → ws://LIVEKIT_LAN_HOST:7880 (ICE local, sin hairpin)
 * 3) PUBLIC_DOMAIN → wss://dominio (4G / otra red, Caddy /rtc :443)
 * 4) LIVEKIT_PUBLIC_HOST → ws://IP:7880
 *
 * ICE remoto: UDP 7882 + TCP 7881 + TURN 3478 (UPnP).
 */
export function resolveLiveKitUrl(req) {
  const configured = config.livekit.url || '';
  const override = process.env.LIVEKIT_PUBLIC_URL?.trim();
  // Prefer LIVEKIT_LAN_HOST from .env (synced by start-services). Avoid stale .66 default.
  const lanHost = (process.env.LIVEKIT_LAN_HOST || '').trim() || '127.0.0.1';
  const publicHost = (process.env.LIVEKIT_PUBLIC_HOST || '').trim();
  const publicDomain = (process.env.PUBLIC_DOMAIN || '').trim();
  const source = override || configured || `ws://${lanHost}:7880`;
  const { proto, port } = pickProtoAndPort(source);

  if (override && /^wss?:\/\//i.test(override)) {
    return override.replace(/\/$/, '');
  }

  const onLan = isPrivateIp(clientIp(req));

  if (onLan && lanHost) {
    return `${proto}://${lanHost}:${port}`;
  }

  if (publicDomain) {
    return `wss://${publicDomain.split(':')[0]}`;
  }

  if (publicHost) {
    return `${proto}://${publicHost}:${port}`;
  }

  const rawHost =
    (typeof req?.headers?.['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0]
      : null) ||
    (typeof req?.headers?.host === 'string' ? req.headers.host : null) ||
    '';
  let host = rawHost.split(':')[0].trim();

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    host = lanHost;
  }

  return `${proto}://${host}:${port}`;
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
    // 1h: menos ventana de reuso; refresh de llamada renueva.
    ttl: '1h',
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
