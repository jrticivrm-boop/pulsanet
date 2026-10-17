import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  triggerPanic,
  listPanicEvents,
  getPanicEvent,
  updatePanicStatus,
  emitPanicToGroupMembers,
  canViewerActOnPanic,
  scopedDispatcherIds,
} from '../services/panic.js';
import {
  bindPanicLiveIo,
  canViewPanicLive,
  findPanicLive,
  maybeEndPanicLiveForEvent,
} from '../services/panicLive.js';
import { createRoomToken, isLiveKitConfigured, resolveLiveKitUrl } from '../services/livekit.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

async function liveCredentials(req, session, { publish }) {
  const token = await createRoomToken({
    identity: publish ? String(req.user.sub) : `panicview-${req.user.sub}`,
    displayName: req.user.displayName || 'Usuario',
    roomName: session.roomName,
    canPublish: publish,
    publishMode: publish ? 'all' : 'none',
  });
  const e2eeKey = voiceE2eeKeyForRoom(session.roomName);
  return {
    ok: true,
    panicId: session.panicId,
    userId: session.userId,
    token,
    url: resolveLiveKitUrl(req),
    e2eeKey,
    e2ee: Boolean(e2eeKey),
    expiresAt: session.expiresAt,
  };
}

export function createPanicRouter(io) {
  const router = Router();
  bindPanicLiveIo(io);
  router.use(authMiddleware);

  /** Emisor: credencial para transmitir cámara + mic de su alerta (≤ 15 min). */
  router.post('/:id/live/publish', async (req, res) => {
    try {
      if (!isLiveKitConfigured()) {
        return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
      }
      const session = await findPanicLive(req.params.id, req.user.orgId);
      if (!session || String(session.userId) !== String(req.user.sub)) {
        return res.status(404).json({ ok: false, error: 'Transmisión no disponible' });
      }
      res.json(await liveCredentials(req, session, { publish: true }));
    } catch (err) {
      console.error('panic live publish:', err.message);
      res.status(500).json({ ok: false, error: 'No se pudo iniciar la transmisión' });
    }
  });

  /** Despacho con alcance sobre el emisor: credencial solo para ver/escuchar. */
  router.post('/:id/live/view', async (req, res) => {
    try {
      if (!isLiveKitConfigured()) {
        return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
      }
      const session = await findPanicLive(req.params.id, req.user.orgId);
      if (!session) {
        return res.status(404).json({ ok: false, error: 'La transmisión de esta alerta ya terminó' });
      }
      if (!(await canViewPanicLive(req.user, session))) {
        return res.status(403).json({ ok: false, error: 'Sin permiso para ver esta cámara' });
      }
      res.json(await liveCredentials(req, session, { publish: false }));
    } catch (err) {
      console.error('panic live view:', err.message);
      res.status(500).json({ ok: false, error: 'No se pudo abrir la cámara' });
    }
  });

  /** Dispara la alerta a uno o varios canales visibles (`target: 'all'` solo despacho). */
  router.post('/', async (req, res) => {
    try {
      const { event, events, systemMsg } = await triggerPanic({
        io,
        orgId: req.user.orgId,
        userId: req.user.sub,
        displayName: req.user.displayName || 'Usuario',
        groupId: req.body?.groupId,
        groupIds: req.body?.groupIds,
        target: req.body?.target,
        latitude: req.body?.latitude,
        longitude: req.body?.longitude,
        accuracyM: req.body?.accuracyM,
        note: req.body?.note,
      });
      res.status(201).json({ ok: true, event, events, message: systemMsg });
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
    try {
      const event = await getPanicEvent({
        orgId: req.user.orgId,
        viewerId: req.user.sub,
        panicId: req.params.id,
      });
      if (!event) {
        return res.status(404).json({ ok: false, error: 'Alerta no encontrada' });
      }
      res.json({ ok: true, event });
    } catch {
      res.status(404).json({ ok: false, error: 'Alerta no encontrada' });
    }
  });

  /** Ack / resolver / cancelar — miembros del canal o despacho con alcance sobre el emisor */
  router.patch('/:id', async (req, res) => {
    const status = req.body?.status;
    try {
      const member = await canViewerActOnPanic({
        orgId: req.user.orgId,
        viewerId: req.user.sub,
        panicId: req.params.id,
      });
      if (!member) {
        return res.status(403).json({ ok: false, error: 'Sin permiso' });
      }
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
          const admins = await scopedDispatcherIds(event.organizationId, event.userId);
          for (const uid of admins) {
            if (uid !== event.userId) io.to(`user:${uid}`).emit('panic:update', event);
          }
          await maybeEndPanicLiveForEvent(event.id, req.user.orgId).catch(() => {});
        }
      }
      // Emisor original: Enterado / atendida / cancelada (siempre a su sala user:*)
      if (event.userId) {
        io.to(`user:${event.userId}`).emit('panic:update', event);
      }
      res.json({ ok: true, event });
    } catch (err) {
      const notFound = /no encontrada/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  return router;
}
