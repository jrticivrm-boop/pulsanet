import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createRoomToken, isLiveKitConfigured, resolveLiveKitUrl } from '../services/livekit.js';
import {
  assertSameOrgPeer,
  createPrivateCall,
  getPrivateCall,
  updatePrivateCall,
  endPrivateCall,
  privateCallRoom,
} from '../services/dm.js';
import { notifyUserDevices } from '../services/fcm.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

export function createCallsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Iniciar llamada privada 1:1 */
  router.post('/private', async (req, res) => {
    const targetUserId = req.body?.targetUserId;
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, targetUserId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }

    const room = privateCallRoom(req.user.sub, peer.id);
    const call = createPrivateCall({
      callerId: req.user.sub,
      callerName: req.user.displayName,
      targetId: peer.id,
      targetName: peer.display_name,
      room,
    });

    const token = await createRoomToken({
      identity: req.user.sub,
      displayName: req.user.displayName,
      roomName: room,
      canPublish: true,
    });

    const payload = {
      callId: call.id,
      room,
      callerId: call.callerId,
      callerName: call.callerName,
      targetId: call.targetId,
      targetName: call.targetName,
    };

    io.to(`user:${peer.id}`).emit('call:incoming', payload);
    notifyUserDevices({
      userId: peer.id,
      title: 'Llamada privada',
      body: `${call.callerName} te está llamando`,
      data: { type: 'private_call', callId: call.id },
    }).catch(() => {});

    res.status(201).json({
      ok: true,
      call: payload,
      token,
      url: resolveLiveKitUrl(req),
      e2eeKey: voiceE2eeKeyForRoom(room),
      e2ee: Boolean(voiceE2eeKeyForRoom(room)),
    });
  });

  /** Aceptar */
  router.post('/private/:id/accept', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (call.targetId !== req.user.sub) {
      return res.status(403).json({ ok: false, error: 'No eres el destinatario' });
    }
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }
    updatePrivateCall(call.id, { status: 'active' });
    const token = await createRoomToken({
      identity: req.user.sub,
      displayName: req.user.displayName,
      roomName: call.room,
      canPublish: true,
    });
    io.to(`user:${call.callerId}`).emit('call:accepted', {
      callId: call.id,
      by: req.user.sub,
      displayName: req.user.displayName,
    });
    res.json({
      ok: true,
      call: {
        callId: call.id,
        room: call.room,
        callerId: call.callerId,
        callerName: call.callerName,
        targetId: call.targetId,
        targetName: call.targetName,
      },
      token,
      url: resolveLiveKitUrl(req),
      e2eeKey: voiceE2eeKeyForRoom(call.room),
      e2ee: Boolean(voiceE2eeKeyForRoom(call.room)),
    });
  });

  /** Rechazar / colgar */
  router.post('/private/:id/end', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.json({ ok: true, alreadyEnded: true });
    if (call.callerId !== req.user.sub && call.targetId !== req.user.sub) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    endPrivateCall(call.id);
    const other = call.callerId === req.user.sub ? call.targetId : call.callerId;
    io.to(`user:${other}`).emit('call:ended', {
      callId: call.id,
      by: req.user.sub,
      reason: req.body?.reason || 'hangup',
    });
    res.json({ ok: true });
  });

  return router;
}
