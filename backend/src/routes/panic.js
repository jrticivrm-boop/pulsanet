import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  triggerPanic,
  listPanicEvents,
  getPanicEvent,
  updatePanicStatus,
  emitPanicToGroupMembers,
} from '../services/panic.js';

/** Miembro del canal del evento (ver / Enterado / Resolver). */
async function canActAsGroupMember(userId, panicId, orgId) {
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

  /** Solo pánicos de grupos donde el usuario es miembro (no todo el org). */
  router.get('/', async (req, res) => {
    try {
      const events = await listPanicEvents({
        orgId: req.user.orgId,
        viewerId: req.user.sub,
        status: req.query.status || undefined,
        limit: req.query.limit,
      });
      res.json({ ok: true, events });
    } catch (err) {
      console.error('panic list:', err.message);
      res.status(500).json({ ok: false, error: 'No se pudieron listar alertas' });
    }
  });

  /** Detalle de un evento (coords para APK al abrir por push). */
  router.get('/:id', async (req, res) => {
    const event = await getPanicEvent({
      orgId: req.user.orgId,
      viewerId: req.user.sub,
      panicId: req.params.id,
    });
    if (!event) {
      return res.status(404).json({ ok: false, error: 'Alerta no encontrada' });
    }
    res.json({ ok: true, event });
  });

  /** Ack / resolver / cancelar — solo miembros del mismo grupo */
  router.patch('/:id', async (req, res) => {
    const status = req.body?.status;
    const member = await canActAsGroupMember(
      req.user.sub,
      req.params.id,
      req.user.orgId
    );
    if (!member) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    try {
      const event = await updatePanicStatus({
        orgId: req.user.orgId,
        panicId: req.params.id,
        actorId: req.user.sub,
        status,
      });
      if (event.groupId) {
        await emitPanicToGroupMembers(
          io,
          'dispatch:panic_update',
          event,
          event.groupId
        );
        // Enterado (acked): no emitir al canal — cada dispositivo silencia en local.
        // resolved/cancelled sí se avisa al grupo.
        if (status !== 'acked') {
          io.to(`group:${event.groupId}`).emit('panic:update', event);
        }
      }
      res.json({ ok: true, event });
    } catch (err) {
      const notFound = /no encontrada/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  return router;
}
