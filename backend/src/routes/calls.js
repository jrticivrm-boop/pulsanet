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
  clearPrivateCallHistory,
  listActivePrivateCalls,
  findBusyPrivateCallForUsers,
  isPrivateCallParticipant,
  listPrivateCallParticipantIds,
  serializePrivateCallParticipants,
  markPrivateCallParticipantJoined,
  invitePrivateCallParticipant,
  leavePrivateCallParticipant,
} from '../services/dm.js';
import { notifyUserDevices, notifyUserDevicesDataOnly } from '../services/fcm.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

/** ~5 timbres (≈5 s c/u) sin contestar → colgar + llamada perdida. */
const RING_MS = 5_000;
const RING_COUNT = 5;
const RING_TIMEOUT_MS = RING_MS * RING_COUNT;
const REMOTE_CAMERA_RING_MS = 120_000;
/** Sin latido de un lado → llamada huérfana (antes exigía ambos, y quedaba fantasma). */
const STALE_ACTIVE_MS = 45_000;
const HARD_MAX_CALL_MS = 10 * 60 * 1000;
const SWEEP_EVERY_MS = 2_000;

function lastSeenOf(call, userId, fallback = 0) {
  const seen = call?.lastSeenAt || {};
  return seen[userId] || fallback || 0;
}

/** true si la llamada ya no tiene presencia real y se puede liberar. */
function isOrphanPrivateCall(call, now = Date.now()) {
  if (!call || call.status === 'ended') return true;
  const age = now - (call.createdAt || now);
  if (age > HARD_MAX_CALL_MS) return true;
  if (call.status === 'ringing') {
    const limit =
      call.intent === 'remote_camera' ? REMOTE_CAMERA_RING_MS : RING_TIMEOUT_MS;
    return age >= limit;
  }
  if (call.status === 'active') {
    const joined = listPrivateCallParticipantIds(call, { includeRinging: false });
    if (!joined.length) return true;
    // Nadie con latido reciente → huérfana (incluye 1:1 y multiparty).
    return joined.every(
      (uid) =>
        now - lastSeenOf(call, uid, call.answeredAt || call.createdAt) >
        STALE_ACTIVE_MS
    );
  }
  return false;
}

function isSamePrivatePair(call, userA, userB) {
  if (!call) return false;
  const a = String(userA || '');
  const b = String(userB || '');
  return (
    (String(call.callerId) === a && String(call.targetId) === b) ||
    (String(call.callerId) === b && String(call.targetId) === a)
  );
}

function normalizeMode(raw) {
  const m = String(raw || '').toLowerCase();
  if (m === 'radio') return 'radio';
  if (m === 'video') return 'video';
  return 'call';
}

function assertCallParticipant(call, userId) {
  return isPrivateCallParticipant(call, userId);
}

function peerUserId(call, userId) {
  const me = String(userId || '');
  if (String(call.callerId) === me) return call.targetId;
  if (String(call.targetId) === me) return call.callerId;
  const others = listPrivateCallParticipantIds(call).filter((id) => id !== me);
  return others[0] || call.callerId;
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
    callerAvatarUrl: call.callerAvatarUrl
      ? `/api/avatars/file/${encodeURIComponent(call.callerAvatarUrl)}`
      : null,
    targetId: call.targetId,
    targetName: call.targetName,
    withVideo: Boolean(call.withVideo),
    videoRequest: call.videoRequest || null,
    createdAt: call.createdAt,
    participants: serializePrivateCallParticipants(call),
  };
}

function emitToCallParticipants(io, call, event, payload) {
  for (const uid of listPrivateCallParticipantIds(call, { includeRinging: true })) {
    io.to(`user:${uid}`).emit(event, payload);
  }
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
  emitToCallParticipants(io, call, 'call:ended', payload);

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
        const joined = listPrivateCallParticipantIds(call, { includeRinging: false });
        for (const uid of joined) {
          const seen = lastSeenOf(call, uid, call.answeredAt || call.createdAt);
          if (now - seen > STALE_ACTIVE_MS) {
            leavePrivateCallParticipant(call, uid);
            io.to(`user:${uid}`).emit('call:ended', {
              callId: call.id,
              reason: 'timeout',
              mode: call.mode || 'call',
            });
            emitToCallParticipants(io, call, 'call:participant_left', {
              callId: call.id,
              userId: uid,
              call: serializeCall(call),
            });
          }
        }
        // Invitados ringing demasiado tiempo → sacar
        for (const p of serializePrivateCallParticipants(call)) {
          if (p.status !== 'ringing') continue;
          const parts = call.participants || {};
          const invitedAt = parts[p.userId]?.invitedAt || call.createdAt || now;
          if (now - invitedAt > RING_TIMEOUT_MS) {
            leavePrivateCallParticipant(call, p.userId);
            io.to(`user:${p.userId}`).emit('call:ended', {
              callId: call.id,
              reason: 'timeout',
              mode: call.mode || 'call',
            });
          }
        }
        const still = listPrivateCallParticipantIds(call, { includeRinging: false });
        if (still.length < 2 || isOrphanPrivateCall(call, now)) {
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
    // Fantasmas / mismo par en ringing: liberar y continuar (UI cerrada sin /end).
    if (intent !== 'remote_camera') {
      const busy = findBusyPrivateCallForUsers(req.user.sub, peer.id);
      if (busy) {
        const me = req.user.sub;
        const samePair = isSamePrivatePair(busy, me, peer.id);
        const imIn =
          String(busy.callerId) === String(me) ||
          String(busy.targetId) === String(me);
        const canReplace =
          (samePair &&
            (busy.status === 'ringing' || isOrphanPrivateCall(busy))) ||
          (imIn && isOrphanPrivateCall(busy));
        if (canReplace) {
          await finalizePrivateCall(io, busy.id, {
            reason: 'hangup',
            endedBy: me,
          });
        } else {
          return res.status(409).json({
            ok: false,
            error: 'Ya hay una llamada en curso',
            busyCallId: busy.id,
          });
        }
      }
    }

    const call = createPrivateCall({
      callerId: req.user.sub,
      callerName: req.user.displayName,
      callerAvatarUrl: req.user.avatarUrl || null,
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
      const fcmType =
        effectiveMode === 'radio'
          ? 'private_radio'
          : effectiveMode === 'video'
            ? 'private_video'
            : 'private_call';
      const fcmData = {
        type: fcmType,
        callId: call.id,
        callerId: call.callerId,
        callerName: call.callerName,
        mode: effectiveMode,
        intent: intent || '',
        title: fcmTitle,
        body: fcmBody,
      };
      // Solo data-only: con payload `notification` Android muestra heads-up del sistema
      // y NO llama al background handler → Contestar/FSI nunca corre (Galaxy Tab).
      notifyUserDevicesDataOnly({
        userId: peer.id,
        data: fcmData,
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
    markPrivateCallParticipantJoined(call, req.user.sub, req.user.displayName);
    // Ambos lados vivos: evita sweeper orphan si el caller aún no hizo ping.
    touchPrivateCall(call.id, req.user.sub);
    touchPrivateCall(call.id, call.callerId);
    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    emitToCallParticipants(io, call, 'call:accepted', {
      callId: call.id,
      by: req.user.sub,
      displayName: req.user.displayName,
      mode: call.mode || 'call',
      call: serializeCall(call),
    });
    res.json({
      ok: true,
      call: serializeCall(call),
      ...creds,
    });
  });

  /**
   * Anexar participante a videollamada (misma sala LiveKit / E2EE).
   * Solo quien ya está joined puede invitar; el destino no debe estar ocupado.
   */
  router.post('/private/:id/invite', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const parts = call.participants || {};
    const me = parts[String(req.user.sub)];
    if (!me || me.status !== 'joined') {
      return res.status(403).json({ ok: false, error: 'Debes estar en la llamada para invitar' });
    }
    if (call.mode !== 'video' && call.intent !== 'remote_camera') {
      // Permitir también en voz por integridad futura; UX principal es video.
    }
    const targetUserId = req.body?.targetUserId;
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, targetUserId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (String(peer.id) === String(req.user.sub)) {
      return res.status(400).json({ ok: false, error: 'No puedes invitarte a ti mismo' });
    }

    const busy = findBusyPrivateCallForUsers(peer.id);
    if (busy && String(busy.id) !== String(call.id)) {
      return res.status(409).json({
        ok: false,
        error: 'El usuario ya está en otra llamada',
        busyCallId: busy.id,
      });
    }

    const invited = invitePrivateCallParticipant(call, {
      userId: peer.id,
      displayName: peer.display_name,
      invitedBy: req.user.sub,
    });
    if (invited?.error === 'already_in_call') {
      return res.status(409).json({ ok: false, error: 'Ya está en esta llamada' });
    }

    const payload = {
      ...serializeCall(call),
      invitedBy: req.user.sub,
      invitedByName: req.user.displayName,
      inviteeId: peer.id,
      inviteeName: peer.display_name,
    };
    io.to(`user:${peer.id}`).emit('call:invite', payload);
    emitToCallParticipants(io, call, 'call:participant_invited', payload);

    const isVideo = call.mode === 'video';
    const inviteTitle = isVideo ? 'Te agregan a videollamada' : 'Te agregan a llamada';
    const inviteBody = `${req.user.displayName || 'Usuario'} te invita`;
    const inviteType = isVideo ? 'private_video_invite' : 'private_call_invite';
    const inviteData = {
      type: inviteType,
      callId: call.id,
      callerId: req.user.sub,
      callerName: req.user.displayName || 'Usuario',
      mode: call.mode || 'call',
      intent: '',
      isInvite: 'true',
      title: inviteTitle,
      body: inviteBody,
    };
    notifyUserDevicesDataOnly({
      userId: peer.id,
      data: inviteData,
    }).catch(() => {});

    res.status(201).json({ ok: true, call: serializeCall(call) });
  });

  /** Rechazar invitación sin colgar a los demás. */
  router.post('/private/:id/decline-invite', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.json({ ok: true, alreadyEnded: true });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const parts = call.participants || {};
    const me = parts[String(req.user.sub)];
    if (me?.status === 'joined' &&
        (String(call.callerId) === String(req.user.sub) ||
          String(call.targetId) === String(req.user.sub))) {
      // Caller/callee originales: declinar = colgar.
      await finalizePrivateCall(io, call.id, {
        reason: 'reject',
        endedBy: req.user.sub,
      });
      return res.json({ ok: true, ended: true });
    }
    leavePrivateCallParticipant(call, req.user.sub);
    emitToCallParticipants(io, call, 'call:participant_left', {
      callId: call.id,
      userId: req.user.sub,
      call: serializeCall(call),
    });
    res.json({ ok: true, ended: false });
  });

  /** Salir de la llamada (los demás siguen si quedan ≥2). */
  router.post('/private/:id/leave', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.json({ ok: true, alreadyEnded: true });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    leavePrivateCallParticipant(call, req.user.sub);
    io.to(`user:${req.user.sub}`).emit('call:ended', {
      callId: call.id,
      reason: 'hangup',
      by: req.user.sub,
      mode: call.mode || 'call',
    });
    const still = listPrivateCallParticipantIds(call, { includeRinging: false });
    if (still.length < 2) {
      await finalizePrivateCall(io, call.id, {
        reason: 'hangup',
        endedBy: req.user.sub,
      });
      return res.json({ ok: true, ended: true });
    }
    emitToCallParticipants(io, call, 'call:participant_left', {
      callId: call.id,
      userId: req.user.sub,
      displayName: req.user.displayName,
      call: serializeCall(call),
    });
    res.json({ ok: true, ended: false, call: serializeCall(call) });
  });

  /** Unirse tras invitación (guest) o re-entrar. */
  router.post('/private/:id/join', async (req, res) => {
    const call = getPrivateCall(req.params.id);
    if (!call) return res.status(404).json({ ok: false, error: 'Llamada no encontrada' });
    if (!assertCallParticipant(call, req.user.sub)) {
      return res.status(403).json({ ok: false, error: 'No estás invitado a esta llamada' });
    }
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }
    if (call.status === 'ringing' && String(call.targetId) === String(req.user.sub)) {
      updatePrivateCall(call.id, { status: 'active', answeredAt: Date.now() });
    }
    markPrivateCallParticipantJoined(call, req.user.sub, req.user.displayName);
    touchPrivateCall(call.id, req.user.sub);
    const creds = await issueCallCredentials(req, call, req.user.sub, req.user.displayName);
    emitToCallParticipants(io, call, 'call:participant_joined', {
      callId: call.id,
      userId: req.user.sub,
      displayName: req.user.displayName,
      call: serializeCall(call),
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
    const receivedOnly = req.query?.received === '1' || req.query?.received === 'true';
    const limit = Number(req.query?.limit) || 80;
    try {
      const history = await listPrivateCallHistory(req.user.sub, req.user.orgId, {
        limit,
        peerId,
        missedOnly: missedOnly && !receivedOnly,
        receivedOnly: receivedOnly && !missedOnly,
      });
      res.json({ ok: true, history });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Error al cargar historial' });
    }
  });

  /** Borrar todo el registro de llamadas del usuario */
  router.delete('/history', async (req, res) => {
    try {
      const deleted = await clearPrivateCallHistory(req.user.sub, req.user.orgId);
      res.json({ ok: true, deleted });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message || 'No se pudo borrar el registro',
      });
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
    notifyUserDevicesDataOnly({
      userId: peerId,
      data: {
        type: 'private_video_request',
        callId: call.id,
        callerId: request.from,
        callerName: request.fromName,
        mode: call.mode || 'call',
        title: 'Solicitud de cámara',
        body: `${request.fromName} solicita ver tu cámara`,
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
