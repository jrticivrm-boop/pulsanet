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
  listActivePrivateCalls,
  findBusyPrivateCallForUsers,
} from '../services/dm.js';
import { notifyUserDevices, notifyUserDevicesDataOnly } from '../services/fcm.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

/** ~5 timbres (≈5 s c/u) sin contestar → colgar + llamada perdida. */
const RING_MS = 5_000;
const RING_COUNT = 5;
const RING_TIMEOUT_MS = RING_MS * RING_COUNT;
const REMOTE_CAMERA_RING_MS = 120_000;
const STALE_ACTIVE_MS = 90_000;
const HARD_MAX_CALL_MS = 10 * 60 * 1000;
const SWEEP_EVERY_MS = 2_000;

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
    intent: call.intent || null,
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

/**
 * Cierra llamada, persiste log y notifica ambos lados.
 * Si quedó sin contestar (timeout/no_answer) → push «Llamada perdida» al destino.
 */
export async function finalizePrivateCall(
  io,
  callId,
  { reason = 'hangup', endedBy = null } = {}
) {
  const ended = endPrivateCall(callId, { reason, endedBy });
  if (!ended?.call) return null;

  const call = ended.call;
  const outcome = await persistPrivateCallLog({
    call,
    reason: ended.reason,
    endedBy: ended.endedBy,
  });

  const payload = {
    callId: call.id,
    by: endedBy,
    reason: ended.reason || reason,
    mode: call.mode || 'call',
    outcome: outcome?.outcome || null,
  };
  io.to(`user:${call.callerId}`).emit('call:ended', payload);
  io.to(`user:${call.targetId}`).emit('call:ended', payload);

  const unanswered =
    !call.answeredAt &&
    (ended.reason === 'timeout' ||
      ended.reason === 'no_answer' ||
      (outcome && outcome.outcome === 'missed'));

  if (unanswered && call.intent !== 'remote_camera') {
    const isVideo = call.mode === 'video';
    notifyUserDevices({
      userId: call.targetId,
      title: isVideo ? 'Videollamada perdida' : 'Llamada perdida',
      body: call.callerName || 'Usuario',
      data: {
        type: 'missed_call',
        callId: call.id,
        callerId: call.callerId,
        callerName: call.callerName || 'Usuario',
        mode: call.mode || 'call',
        peerId: call.callerId,
      },
    }).catch(() => {});
  }

  return { call, reason: ended.reason, endedBy: ended.endedBy, outcome };
}

/** Sweeper: 5 timbres sin respuesta → cuelga; activas huérfanas → cierra. */
export function startPrivateCallSweeper(io) {
  setInterval(() => {
    const now = Date.now();
    for (const call of listActivePrivateCalls()) {
      const age = now - (call.createdAt || now);
      if (age > HARD_MAX_CALL_MS) {
        finalizePrivateCall(io, call.id, { reason: 'timeout', endedBy: null }).catch(
          () => {}
        );
        continue;
      }
      if (call.status === 'ringing') {
        const limit =
          call.intent === 'remote_camera' ? REMOTE_CAMERA_RING_MS : RING_TIMEOUT_MS;
        if (age >= limit) {
          finalizePrivateCall(io, call.id, {
            reason: 'timeout',
            endedBy: null,
          }).catch(() => {});
        }
        continue;
      }
      if (call.status === 'active') {
        const seen = call.lastSeenAt || {};
        const callerSeen = seen[call.callerId] || call.createdAt || 0;
        const targetSeen = seen[call.targetId] || call.answeredAt || call.createdAt || 0;
        const bothStale =
          now - callerSeen > STALE_ACTIVE_MS && now - targetSeen > STALE_ACTIVE_MS;
        if (bothStale) {
          finalizePrivateCall(io, call.id, {
            reason: 'timeout',
            endedBy: null,
          }).catch(() => {});
        }
      }
    }
  }, SWEEP_EVERY_MS);
  console.log(
    `Private call sweeper: ring ${RING_COUNT}×${RING_MS / 1000}s (${RING_TIMEOUT_MS}ms)`
  );
}

export function createCallsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Iniciar llamada o videollamada privada 1:1 (`mode`: call|video).
   *  `intent: 'remote_camera'` = despacho pide ver la cámara del dispositivo (monitor).
   *  Radio personal 1:1 deshabilitada.
   */
  router.post('/private', async (req, res) => {
    const targetUserId = req.body?.targetUserId;
    const mode = normalizeMode(req.body?.mode);
    if (mode === 'radio') {
      return res.status(410).json({
        ok: false,
        error: 'Radio personal 1:1 ya no está disponible',
      });
    }
    const intentRaw = String(req.body?.intent || '').toLowerCase();
    const intent = intentRaw === 'remote_camera' ? 'remote_camera' : null;
    const effectiveMode = intent === 'remote_camera' ? 'video' : mode;
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, targetUserId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }

    // Evita re-marcar: si cualquiera ya tiene llamada activa, no crear otra.
    // (remote_camera puede coexistir en flujos de despacho — se permite).
    if (intent !== 'remote_camera') {
      const busy = findBusyPrivateCallForUsers(req.user.sub, peer.id);
      if (busy) {
        return res.status(409).json({
          ok: false,
          error: 'Ya hay una llamada en curso',
          busyCallId: busy.id,
        });
      }
    }

    const call = createPrivateCall({
      callerId: req.user.sub,
      callerName: req.user.displayName,
      targetId: peer.id,
      targetName: peer.display_name,
      mode: effectiveMode,
      intent,
      orgId: req.user.orgId,
    });

    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    const payload = serializeCall(call);

    io.to(`user:${peer.id}`).emit('call:incoming', payload);
    // remote_camera: sin banner; data-only FCM para despertar con pantalla bloqueada.
    const isRemoteCam = intent === 'remote_camera';
    if (isRemoteCam) {
      notifyUserDevicesDataOnly({
        userId: peer.id,
        data: {
          type: 'private_remote_camera',
          callId: call.id,
          callerId: call.callerId,
          callerName: call.callerName,
          mode: effectiveMode,
          intent: 'remote_camera',
          silent: '1',
        },
      }).catch(() => {});
    } else {
      const fcmTitle =
        effectiveMode === 'radio'
          ? 'Radio personal'
          : effectiveMode === 'video'
            ? 'Videollamada entrante'
            : 'Llamada entrante';
      const fcmBody =
        effectiveMode === 'radio'
          ? `${call.callerName} te invita a radio 1:1`
          : effectiveMode === 'video'
            ? `${call.callerName} te llama con video`
            : `${call.callerName} te está llamando`;
      // Data-only: la app abre pantalla Contestar (no banner del sistema).
      notifyUserDevicesDataOnly({
        userId: peer.id,
        data: {
          type:
            effectiveMode === 'radio'
              ? 'private_radio'
              : effectiveMode === 'video'
                ? 'private_video'
                : 'private_call',
          callId: call.id,
          callerId: call.callerId,
          callerName: call.callerName,
          mode: effectiveMode,
          intent: intent || '',
          title: fcmTitle,
          body: fcmBody,
        },
      }).catch(() => {});
    }

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
    await finalizePrivateCall(io, call.id, { reason, endedBy: req.user.sub });
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

  /**
   * Control remoto (solo monitor remote_camera, solo el caller/despacho):
   * { facing: 'front'|'back' } y/o { mic: true|false }
   */
  router.post('/private/:id/remote-control', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    if (call.intent !== 'remote_camera') {
      return res.status(400).json({ ok: false, error: 'Solo para Ver cámara' });
    }
    if (call.callerId !== req.user.sub) {
      return res.status(403).json({ ok: false, error: 'Solo el puesto puede controlar' });
    }
    if (call.status !== 'active' && call.status !== 'ringing') {
      return res.status(400).json({ ok: false, error: 'Sesión no activa' });
    }

    const facingRaw = req.body?.facing;
    const facing =
      facingRaw === 'front' || facingRaw === 'user'
        ? 'front'
        : facingRaw === 'back' || facingRaw === 'environment'
          ? 'back'
          : undefined;
    const hasMic = Object.prototype.hasOwnProperty.call(req.body || {}, 'mic');
    const mic = hasMic ? req.body.mic === true : undefined;
    if (facing == null && mic == null) {
      return res.status(400).json({ ok: false, error: 'Indica facing y/o mic' });
    }

    const patch = {};
    if (facing != null) patch.remoteFacing = facing;
    if (mic != null) patch.remoteMic = mic;
    updatePrivateCall(call.id, patch);

    const payload = {
      callId: call.id,
      by: req.user.sub,
      cmdId: req.body?.cmdId || undefined,
      ts: Date.now(),
      ...(facing != null ? { facing } : {}),
      ...(mic != null ? { mic } : {}),
    };
    io.to(`user:${call.targetId}`).emit('call:remote_control', payload);
    // Eco al puesto para sincronizar UI si hay varios clientes.
    io.to(`user:${call.callerId}`).emit('call:remote_control_ack', payload);
    res.json({ ok: true, control: payload });
  });

  return router;
}
