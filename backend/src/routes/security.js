import { Router } from 'express';
import { isRoot } from '../services/roles.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  clearLockdown,
  getLockdownStatus,
  isLockdownActive,
  triggerLockdown,
  clientIpFromReq,
} from '../services/intrusion.js';

export const securityRouter = Router();

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
securityRouter.post('/unlock', async (req, res) => {
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
