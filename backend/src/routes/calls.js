import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createRoomToken, isLiveKitConfigured, resolveLiveKitUrl } from '../services/livekit.js';
import {
  assertSameOrgPeer,
  createPrivateCall,
  getPrivateCall,
  updatePrivateCall,
  endPrivateCall,
  touchPrivateCall,
  persistPrivateCallLog,
  listPrivateCallHistory,
  privateCallRoom,
} from '../services/dm.js';
import { notifyUserDevices } from '../services/fcm.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

function normalizeMode(raw) {
  const m = String(raw || '').toLowerCase();
  if (m === 'radio') return 'radio';
  if (m === 'video') return 'video';
  return 'call';
}

function assertCallParticipant(call, userId) {
  if (!call) return false;
  return call.callerId === userId || call.targetId === userId;
}

function peerUserId(call, userId) {
  return call.callerId === userId ? call.targetId : call.callerId;
}

function serializeCall(call) {
  return {
    callId: call.id,
    room: call.room,
    mode: call.mode || 'call',
    status: call.status,
    callerId: call.callerId,
    callerName: call.callerName,
    targetId: call.targetId,
    targetName: call.targetName,
    withVideo: Boolean(call.withVideo),
    videoRequest: call.videoRequest || null,
    createdAt: call.createdAt,
  };
}

async function issueCallCredentials(req, call, identity, displayName) {
  const token = await createRoomToken({
    identity,
    displayName,
    roomName: call.room,
    canPublish: true,
  });
  return {
    token,
    url: resolveLiveKitUrl(req),
    e2eeKey: voiceE2eeKeyForRoom(call.room),
    e2ee: Boolean(voiceE2eeKeyForRoom(call.room)),
  };
}

export function createCallsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Iniciar llamada, videollamada o radio privada 1:1 (`mode`: call|video|radio) */
  router.post('/private', async (req, res) => {
    const targetUserId = req.body?.targetUserId;
    const mode = normalizeMode(req.body?.mode);
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, targetUserId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }

    const room = privateCallRoom(req.user.sub, peer.id, mode);
    const call = createPrivateCall({
      callerId: req.user.sub,
      callerName: req.user.displayName,
      targetId: peer.id,
      targetName: peer.display_name,
      room,
      mode,
      orgId: req.user.orgId,
    });

    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    const payload = serializeCall(call);

    io.to(`user:${peer.id}`).emit('call:incoming', payload);
    const fcmTitle =
      mode === 'radio'
        ? 'Radio personal'
        : mode === 'video'
          ? 'Videollamada entrante'
          : 'Llamada entrante';
    const fcmBody =
      mode === 'radio'
        ? `${call.callerName} te invita a radio 1:1`
        : mode === 'video'
          ? `${call.callerName} te llama con video`
          : `${call.callerName} te está llamando`;
    notifyUserDevices({
      userId: peer.id,
      title: fcmTitle,
      body: fcmBody,
      data: {
        type: mode === 'radio' ? 'private_radio' : mode === 'video' ? 'private_video' : 'private_call',
        callId: call.id,
        callerId: call.callerId,
        callerName: call.callerName,
        mode,
      },
    }).catch(() => {});

    res.status(201).json({
      ok: true,
      call: payload,
      ...creds,
    });
  });

  /** Estado de llamada (para retomar UI desde push FCM) */
  router.get('/private/:id', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada o ya terminó' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    res.json({ ok: true, call: serializeCall(call) });
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
    updatePrivateCall(call.id, { status: 'active', answeredAt: Date.now() });
    touchPrivateCall(call.id, req.user.sub);
    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    io.to(`user:${call.callerId}`).emit('call:accepted', {
      callId: call.id,
      by: req.user.sub,
      displayName: req.user.displayName,
      mode: call.mode || 'call',
    });
    res.json({
      ok: true,
      call: serializeCall(call),
      ...creds,
    });
  });

  /** Historial de llamadas privadas (voz / video / radio) */
  router.get('/history', async (req, res) => {
    const peerId = req.query?.peerId?.toString() || null;
    const missedOnly = req.query?.missed === '1' || req.query?.missed === 'true';
    const limit = Number(req.query?.limit) || 80;
    try {
      const history = await listPrivateCallHistory(req.user.sub, req.user.orgId, {
        limit,
        peerId,
        missedOnly,
      });
      res.json({ ok: true, history });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Error al cargar historial' });
    }
  });

  /** Latido — mantiene la sesión activa ante caídas breves de red */
  router.post('/private/:id/ping', (req, res) => {
    const call = touchPrivateCall(req.params.id, req.user.sub);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada o ya terminó' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    res.json({ ok: true, call: serializeCall(call) });
  });

  /** Renovar credenciales LiveKit tras reconexión */
  router.post('/private/:id/refresh', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada o ya terminó' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }
    touchPrivateCall(call.id, req.user.sub);
    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    res.json({
      ok: true,
      call: serializeCall(call),
      ...creds,
    });
  });

  /** Rechazar / colgar */
  router.post('/private/:id/end', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.json({ ok: true, alreadyEnded: true });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const reason = req.body?.reason || 'hangup';
    const ended = endPrivateCall(call.id, { reason, endedBy: req.user.sub });
    if (ended?.call) {
      await persistPrivateCallLog({
        call: ended.call,
        reason: ended.reason,
        endedBy: ended.endedBy,
      });
    }
    const payload = {
      callId: call.id,
      by: req.user.sub,
      reason: req.body?.reason || 'hangup',
      mode: call.mode || 'call',
    };
    io.to(`user:${call.callerId}`).emit('call:ended', payload);
    io.to(`user:${call.targetId}`).emit('call:ended', payload);
    res.json({ ok: true });
  });

  /**
   * Solicitar que el otro usuario active su cámara (consentimiento explícito).
   * Solo en llamada/videollamada activa (no radio).
   */
  router.post('/private/:id/video/request', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    if (call.mode === 'radio') {
      return res.status(400).json({ ok: false, error: 'Radio privada es solo audio' });
    }
    if (call.status !== 'active' && call.status !== 'ringing') {
      return res.status(400).json({ ok: false, error: 'Llamada no activa' });
    }
    const peerId = peerUserId(call, req.user.sub);
    const request = {
      from: req.user.sub,
      fromName: req.user.displayName || 'Usuario',
      at: new Date().toISOString(),
    };
    updatePrivateCall(call.id, { videoRequest: request });
    const payload = {
      callId: call.id,
      from: request.from,
      fromName: request.fromName,
      at: request.at,
    };
    io.to(`user:${peerId}`).emit('call:video_request', payload);
    notifyUserDevices({
      userId: peerId,
      title: 'Solicitud de cámara',
      body: `${request.fromName} solicita ver tu cámara`,
      data: {
        type: 'private_video_request',
        callId: call.id,
        callerId: request.from,
        callerName: request.fromName,
        mode: call.mode || 'call',
      },
    }).catch(() => {});
    res.json({ ok: true, request: payload });
  });

  /** Responder solicitud de cámara ({ accept: true|false }) */
  router.post('/private/:id/video/respond', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const reqInfo = call.videoRequest;
    if (!reqInfo || reqInfo.from === req.user.sub) {
      return res.status(400).json({ ok: false, error: 'No hay solicitud de cámara pendiente' });
    }
    if (reqInfo.from !== call.callerId && reqInfo.from !== call.targetId) {
      return res.status(400).json({ ok: false, error: 'Solicitud inválida' });
    }
    const accept = req.body?.accept === true;
    updatePrivateCall(call.id, { videoRequest: null });
    const peerId = peerUserId(call, req.user.sub);
    const event = accept ? 'call:video_accepted' : 'call:video_rejected';
    io.to(`user:${peerId}`).emit(event, {
      callId: call.id,
      by: req.user.sub,
      displayName: req.user.displayName,
    });
    res.json({ ok: true, accepted: accept });
  });

  /** Avisar que el usuario apagó la cámara (opcional, sincroniza UI remota) */
  router.post('/private/:id/video/stop', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.json({ ok: true, alreadyEnded: true });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const peerId = peerUserId(call, req.user.sub);
    io.to(`user:${peerId}`).emit('call:video_stopped', {
      callId: call.id,
      by: req.user.sub,
    });
    res.json({ ok: true });
  });

  return router;
}
