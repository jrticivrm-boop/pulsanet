import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isFcmReady, notifyUserDevices } from '../services/fcm.js';

export const devicesRouter = Router();
devicesRouter.use(authMiddleware);

/**
 * Registra/actualiza token FCM del dispositivo (sin enviar push aún).
 * Body: { platform: 'android'|'ios'|'web', fcmToken, deviceName? }
 */
devicesRouter.post('/', async (req, res) => {
  const { platform, fcmToken, deviceName } = req.body || {};
  if (!['android', 'ios', 'web'].includes(platform)) {
    return res.status(400).json({ ok: false, error: 'platform inválido' });
  }
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 8) {
    return res.status(400).json({ ok: false, error: 'fcmToken requerido' });
  }

  const { rows } = await query(
    `INSERT INTO devices (user_id, platform, fcm_token, device_name, is_active, last_used_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW())
     ON CONFLICT (user_id, fcm_token) DO UPDATE SET
       platform = EXCLUDED.platform,
       device_name = COALESCE(EXCLUDED.device_name, devices.device_name),
       is_active = TRUE,
       last_used_at = NOW()
     RETURNING id, platform, device_name, is_active, last_used_at`,
    [req.user.sub, platform, fcmToken.trim(), deviceName?.trim() || null]
  );

  const d = rows[0];
  res.status(201).json({
    ok: true,
    device: {
      id: d.id,
      platform: d.platform,
      deviceName: d.device_name,
      isActive: d.is_active,
      lastUsedAt: d.last_used_at,
    },
  });
});

devicesRouter.delete('/', async (req, res) => {
  const { fcmToken } = req.body || {};
  if (fcmToken) {
    await query(
      `UPDATE devices SET is_active = FALSE WHERE user_id = $1 AND fcm_token = $2`,
      [req.user.sub, fcmToken]
    );
  } else {
    await query(`UPDATE devices SET is_active = FALSE WHERE user_id = $1`, [req.user.sub]);
  }
  res.json({ ok: true });
});

/** Estado FCM + dispositivos del usuario actual */
devicesRouter.get('/me', async (req, res) => {
  const { rows } = await query(
    `SELECT id, platform, device_name, is_active, last_used_at, left(fcm_token, 12) AS token_prefix
     FROM devices WHERE user_id = $1 ORDER BY last_used_at DESC NULLS LAST`,
    [req.user.sub]
  );
  res.json({
    ok: true,
    fcmConfigured: isFcmReady(),
    devices: rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      deviceName: r.device_name,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at,
      tokenPrefix: r.token_prefix,
    })),
  });
});

/**
 * Push de prueba al propio usuario.
 * Body opcional: { title?, body? }
 */
devicesRouter.post('/test', async (req, res) => {
  if (!isFcmReady()) {
    return res.status(503).json({
      ok: false,
      error: 'FCM no configurado. Añade FIREBASE_SERVICE_ACCOUNT en backend/.env',
    });
  }
  const title = (req.body?.title || 'TacticalPtx').toString().slice(0, 80);
  const body = (req.body?.body || 'Notificación de prueba').toString().slice(0, 200);
  const result = await notifyUserDevices({
    userId: req.user.sub,
    title,
    body,
    data: { type: 'test' },
  });
  res.json({ ok: true, ...result });
});
