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

export function floorKey(groupId) {
  return `ptt:floor:${groupId}`;
}

export function presenceKey(groupId) {
  return `presence:group:${groupId}`;
}

export function presenceTsKey(groupId) {
  return `presence:ts:${groupId}`;
}
