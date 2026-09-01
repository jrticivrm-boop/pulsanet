import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { isLiveKitConfigured } from '../services/livekit.js';
import { getRedis, isRedisReady } from '../redis.js';
import { isFcmReady } from '../services/fcm.js';
import { isLockdownActive, getLockdownStatus } from '../services/intrusion.js';
import { loadTlsOptions } from '../tls.js';
import { isVoiceE2eeReady } from '../services/voiceE2ee.js';
import { isWireEncryptionEnabled } from '../services/wireCrypto.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    if (await isLockdownActive()) {
      const st = await getLockdownStatus();
      return res.status(503).json({
        ok: false,
        ready: false,
        service: 'tacticalptx-api',
        lockdown: true,
        reason: st.reason || 'security',
        at: st.at || null,
      });
    }

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
    const tlsListening = Boolean(loadTlsOptions());

    const payload = {
      ok: true,
      ready,
      service: 'tacticalptx-api',
      version: config.version,
      env: config.nodeEnv,
      db: 'connected',
      redis: redisStatus,
      livekit: livekitOk ? 'configured' : 'missing',
      fcm: isFcmReady() ? 'configured' : 'off',
      // Esquema real de escucha (no solo "paths en .env").
      tls: tlsListening ? 'on' : 'off',
    };
    // Detalle de cifrado / URL LiveKit solo fuera de production (menos reconocimiento).
    if (!config.isProd) {
      payload.livekitUrl = livekitOk ? config.livekit.url : null;
      payload.wireEncryption = isWireEncryptionEnabled() ? 'on' : 'off';
      payload.contentEncryption = process.env.CONTENT_ENCRYPTION_KEY?.trim() ? 'on' : 'dev-fallback';
      payload.voiceE2ee = isVoiceE2eeReady()
        ? process.env.LIVEKIT_E2EE_SECRET?.trim()?.length >= 32
          ? 'on'
          : 'dev'
        : 'off';
      payload.tlsConfigured = config.tls.enabled ? 'paths-set' : 'paths-unset';
    }
    res.json(payload);
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
