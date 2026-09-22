import { timingSafeEqual } from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isRoot } from '../services/roles.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  clearLockdown,
  getLockdownStatus,
  isLockdownActive,
  triggerLockdown,
  clientIpFromReq,
  unlockUserLogin,
} from '../services/intrusion.js';
import { query } from '../db.js';

export const securityRouter = Router();

function secretsEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Estricto: desbloqueo sin JWT = objetivo de fuerza bruta si el API es público. */
const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.UNLOCK_RATE_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de desbloqueo. Espera unos minutos.' },
});

/** Estado público mínimo (sin detalle sensible). */
securityRouter.get('/status', async (_req, res) => {
  const active = await isLockdownActive();
  if (!active) return res.json({ ok: true, lockdown: false });
  const st = await getLockdownStatus();
  res.json({
    ok: true,
    lockdown: true,
    reason: st.reason || 'security',
    at: st.at || null,
  });
});

/**
 * Desbloqueo de emergencia (no usa JWT).
 * Body: { unlockSecret: "..." }
 */
securityRouter.post('/unlock', unlockLimiter, async (req, res) => {
  try {
    await clearLockdown({
      unlockSecret: req.body?.unlockSecret,
      sourceIp: clientIpFromReq(req),
    });
    res.json({ ok: true, lockdown: false });
  } catch (err) {
    res.status(403).json({ ok: false, error: err.message || 'Desbloqueo denegado' });
  }
});

/**
 * Desbloqueo de emergencia de una cuenta (no usa JWT).
 * Body: { unlockSecret: "...", username: "ggomezd2" }
 */
securityRouter.post('/unlock-user', unlockLimiter, async (req, res) => {
  try {
    const expected = String(process.env.LOCKDOWN_UNLOCK_SECRET || '').trim();
    if (!expected || expected.length < 16) {
      return res.status(403).json({ ok: false, error: 'LOCKDOWN_UNLOCK_SECRET no configurado' });
    }
    if (!secretsEqual(req.body?.unlockSecret, expected)) {
      return res.status(403).json({ ok: false, error: 'Secreto de desbloqueo inválido' });
    }
    const username = String(req.body?.username || '').trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ ok: false, error: 'username requerido' });
    }
    const { rows } = await query(
      `SELECT id, organization_id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    const out = await unlockUserLogin({
      userId: rows[0].id,
      orgId: rows[0].organization_id,
      actorId: null,
      sourceIp: clientIpFromReq(req),
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    res.status(403).json({ ok: false, error: err.message || 'Desbloqueo denegado' });
  }
});

/**
 * Lockdown manual (solo root autenticado).
 * Body: { reason?: string, confirm: true }
 */
securityRouter.post('/lockdown', authMiddleware, async (req, res) => {
  if (!isRoot(req.user?.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede activar lockdown' });
  }
  if (req.body?.confirm !== true) {
    return res.status(400).json({ ok: false, error: 'Envía confirm: true' });
  }
  const result = await triggerLockdown({
    reason: req.body?.reason || 'manual_root',
    sourceIp: clientIpFromReq(req),
    actorId: req.user.sub,
    orgId: req.user.orgId,
    detail: 'Activado manualmente por root',
  });
  res.json(result);
});
