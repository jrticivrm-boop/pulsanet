import Redis from 'ioredis';
import { config } from './config.js';

let redis = null;
let redisReady = false;

export function getRedis() {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('ready', () => {
      redisReady = true;
    });
    redis.on('error', (err) => {
      console.error('Redis error:', err.message);
    });
    redis.on('end', () => {
      redisReady = false;
    });
  }
  return redis;
}

export async function connectRedis() {
  const client = getRedis();
  await client.ping();
  redisReady = true;
  return client;
}

export function isRedisReady() {
  return redisReady;
}

export const FLOOR_TTL_SEC = 90;
/** Sin presence:ping en este intervalo → se oculta de “en línea”. */
export const PRESENCE_STALE_MS = 90_000;
/** Heartbeat FGS (focus=service): intervalo más holgado (FGS ~12s). */
export const PRESENCE_SERVICE_STALE_MS = 150_000;

export function floorKey(groupId) {
  return `ptt:floor:${groupId}`;
}

export function presenceKey(groupId) {
  return `presence:group:${groupId}`;
}

export function presenceTsKey(groupId) {
  return `presence:ts:${groupId}`;
}

/** Hash socketId → { userId, displayName, focus } por grupo (multi-dispositivo). */
export function presenceSocketsKey(groupId) {
  return `presence:sockets:${groupId}`;
}

/** Presencia org-wide (p.ej. FGS service sin canal). Hash userId → JSON. */
export function orgPresenceKey(orgId) {
  return `presence:org:${orgId}`;
}

export function orgPresenceTsKey(orgId) {
  return `presence:org:ts:${orgId}`;
}

/**
 * Cuenta claves por patrón con SCAN (no KEYS — evita bloquear Redis).
 * @param {string} match p.ej. 'presence:group:*'
 * @param {number} [limit=5000] tope de seguridad
 */
export async function countKeysByScan(match, limit = 5000) {
  if (!isRedisReady()) return 0;
  const redis = getRedis();
  let cursor = '0';
  let n = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200);
    cursor = String(next);
    n += keys.length;
    if (n >= limit) return limit;
  } while (cursor !== '0');
  return n;
}

/**
 * Lista claves por patrón con SCAN (máx. [limit]).
 */
export async function listKeysByScan(match, limit = 500) {
  if (!isRedisReady()) return [];
  const redis = getRedis();
  let cursor = '0';
  const out = [];
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
    cursor = String(next);
    for (const k of keys) {
      out.push(k);
      if (out.length >= limit) return out;
    }
  } while (cursor !== '0');
  return out;
}
