import { Router } from 'express';
import { getRedis, isRedisReady } from '../redis.js';
import { query } from '../db.js';
import { isLiveKitConfigured } from '../services/livekit.js';
import { config } from '../config.js';
import { getCounters } from '../services/metrics.js';

export function createMetricsRouter(io) {
  const router = Router();

  router.get('/', async (_req, res) => {
    let redisOk = false;
    let presenceKeys = 0;
    let floorKeys = 0;
    try {
      if (isRedisReady()) {
        await getRedis().ping();
        redisOk = true;
        const p = await getRedis().keys('presence:group:*');
        const f = await getRedis().keys('ptt:floor:*');
        presenceKeys = p.length;
        floorKeys = f.length;
      }
    } catch {
      redisOk = false;
    }

    let dbOk = false;
    let usersCount = 0;
    try {
      const { rows } = await query('SELECT COUNT(*)::int AS c FROM users');
      usersCount = rows[0]?.c || 0;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    res.json({
      ok: dbOk && redisOk,
      version: config.version,
      uptimeSec: Math.floor(process.uptime()),
      sockets: io?.engine?.clientsCount ?? 0,
      db: dbOk ? 'connected' : 'down',
      redis: redisOk ? 'connected' : 'down',
      livekit: isLiveKitConfigured() ? config.livekit.url : null,
      presenceGroups: presenceKeys,
      activeFloors: floorKeys,
      usersCount,
      counters: getCounters(),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  });

  return router;
}
