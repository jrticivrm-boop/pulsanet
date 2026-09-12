import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { broadcastPresence, heartbeatServicePresence } from '../services/presence.js';
import { emitDispatch } from '../socket/dispatch.js';

/** Heartbeat de presencia FGS (app UI muerta, servicio en primer plano). */
export function createPresenceRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  router.post('/heartbeat', async (req, res) => {
    const focus = String(req.body?.focus || 'service');
    if (focus !== 'service') {
      return res.status(400).json({ ok: false, error: 'focus debe ser service' });
    }
    const orgId = req.user.orgId;
    const userId = req.user.sub;
    const displayName = req.user.displayName || 'Usuario';
    try {
      const result = await heartbeatServicePresence({ orgId, userId, displayName });
      emitDispatch(io, 'dispatch:presence', { orgId, userId, focus: 'service' });
      for (const groupId of result.groupIds || []) {
        try {
          await broadcastPresence(io, groupId);
        } catch {
          /* ignore */
        }
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('presence heartbeat:', err.message);
      res.status(500).json({ ok: false, error: 'No se pudo actualizar presencia' });
    }
  });

  return router;
}
