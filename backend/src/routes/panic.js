import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  triggerPanic,
  listPanicEvents,
  updatePanicStatus,
} from '../services/panic.js';
import { emitDispatch } from '../socket/dispatch.js';

import { isDispatch } from '../services/roles.js';

async function canManagePanic(userId) {
  const { rows } = await query(
    `SELECT role, can_receive_panic FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  return isDispatch(u?.role) || Boolean(u?.can_receive_panic);
}

/** Miembro del canal del evento (puede marcar Enterado). */
async function canAckAsMember(userId, panicId, orgId) {
  const { rows } = await query(
    `SELECT 1
     FROM panic_events p
     JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = $1
     WHERE p.id = $2 AND p.organization_id = $3`,
    [userId, panicId, orgId]
  );
  return Boolean(rows[0]);
}

export function createPanicRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Miembro del canal: dispara pánico */
  router.post('/', async (req, res) => {
    try {
      const { event, systemMsg } = await triggerPanic({
        io,
        orgId: req.user.orgId,
        userId: req.user.sub,
        displayName: req.user.displayName || 'Usuario',
        groupId: req.body?.groupId,
        latitude: req.body?.latitude,
        longitude: req.body?.longitude,
        accuracyM: req.body?.accuracyM,
        note: req.body?.note,
      });
      res.status(201).json({ ok: true, event, message: systemMsg });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  /** Admin / despacho / permiso pánico: listado */
  router.get('/', async (req, res) => {
    if (!(await canManagePanic(req.user.sub))) {
      return res.status(403).json({ ok: false, error: 'Sin permiso para ver alertas' });
    }
    const events = await listPanicEvents({
      orgId: req.user.orgId,
      status: req.query.status || undefined,
      limit: req.query.limit,
    });
    res.json({ ok: true, events });
  });

  /** Ack / resolver / cancelar — Enterado también por miembros del canal */
  router.patch('/:id', async (req, res) => {
    const status = req.body?.status;
    const manage = await canManagePanic(req.user.sub);
    const member = await canAckAsMember(req.user.sub, req.params.id, req.user.orgId);
    if (!manage && !member) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    if (!manage && status !== 'acked') {
      return res
        .status(403)
        .json({ ok: false, error: 'Solo puedes marcar Enterado' });
    }
    try {
      const event = await updatePanicStatus({
        orgId: req.user.orgId,
        panicId: req.params.id,
        actorId: req.user.sub,
        status,
      });
      emitDispatch(io, 'dispatch:panic_update', event);
      if (event.groupId) {
        io.to(`group:${event.groupId}`).emit('panic:update', event);
      }
      res.json({ ok: true, event });
    } catch (err) {
      const notFound = /no encontrada/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  return router;
}
