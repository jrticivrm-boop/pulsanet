import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { isLiveKitConfigured } from '../services/livekit.js';
import { getRedis, isRedisReady } from '../redis.js';
import { isFcmReady } from '../services/fcm.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await query('SELECT 1');
    let redisStatus = 'disconnected';
    try {
      if (isRedisReady()) {
        await getRedis().ping();
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'disconnected';
    }

    const livekitOk = isLiveKitConfigured();
    const ready = redisStatus === 'connected' && livekitOk;

    res.json({
      ok: true,
      ready,
      service: 'tacticalptx-api',
      version: config.version,
      env: config.nodeEnv,
      db: 'connected',
      redis: redisStatus,
      livekit: livekitOk ? 'configured' : 'missing',
      livekitUrl: livekitOk ? config.livekit.url : null,
      fcm: isFcmReady() ? 'configured' : 'off',
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      ready: false,
      service: 'tacticalptx-api',
      version: config.version,
      db: 'disconnected',
      error: err.message,
    });
  }
});
