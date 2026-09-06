import { ConnectionState, DisconnectReason, RoomEvent } from 'livekit-client';
import { fetchPrivateCall, pingPrivateCall, refreshPrivateCall } from './api';
import { publicLiveKitUrl } from './livekitUrl';

export const CALL_PEER_GRACE_MS = 45_000;
export const CALL_PING_MS = 25_000;
export const CALL_RECONNECT_DELAYS = [3_000, 6_000, 12_000, 20_000];
export const CALL_MAX_PEER_GRACE_CYCLES = 5;
export const CALL_MAX_RECONNECT_CYCLES = 6;

function isCallGoneError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.statusCode;
  return (
    status === 404 ||
    msg.includes('404') ||
    msg.includes('no encontrada') ||
    msg.includes('not found') ||
    msg.includes('finalizada') ||
    msg.includes('ended')
  );
}

/**
 * Estabilizador suave: LiveKit reconecta solo; nosotros solo intervenimos
 * si queda Disconnected de verdad. Tras N ciclos de grace/reconnect → onGiveUp.
 */
export function attachPrivateCallStabilizer({
  room,
  callId,
  authToken,
  signalSocket = null,
  closingRef,
  onStatus,
  onRemoteEnd,
  onGiveUp,
  getPeerLabel = () => 'el otro usuario',
  peerGraceMs = CALL_PEER_GRACE_MS,
  pingMs = CALL_PING_MS,
  maxPeerGraceCycles = CALL_MAX_PEER_GRACE_CYCLES,
  maxReconnectCycles = CALL_MAX_RECONNECT_CYCLES,
}) {
  if (!room || !callId || !authToken) return () => {};

  let peerGraceTimer = null;
  let pingTimer = null;
  let reconnectAttempt = 0;
  let peerGraceCycles = 0;
  let reconnectCycles = 0;
  let reconnectTimer = null;
  let disposed = false;
  let quietStatusUntil = 0;

  const clearPeerGrace = () => {
    if (peerGraceTimer) {
      clearTimeout(peerGraceTimer);
      peerGraceTimer = null;
    }
  };

  const busy = () =>
    room.state === ConnectionState.Connected ||
    room.state === ConnectionState.Reconnecting ||
    room.state === ConnectionState.Connecting ||
    room.state === ConnectionState.SignalReconnecting;

  const abandon = async (status) => {
    if (disposed || closingRef?.current) return;
    onStatus?.(status);
    const fn = onGiveUp || onRemoteEnd;
    await fn?.();
  };

  const verifyCallActive = async () => {
    try {
      const data = await fetchPrivateCall(authToken, callId);
      const status = data?.call?.status;
      return Boolean(status && status !== 'ended');
    } catch (err) {
      if (isCallGoneError(err)) return false;
      // Blip de API: no dar por muerta.
      return true;
    }
  };

  const schedulePeerGrace = () => {
    if (disposed || closingRef?.current) return;
    clearPeerGrace();
    peerGraceTimer = setTimeout(() => {
      if (disposed || closingRef?.current) return;
      if (Date.now() < quietStatusUntil) return;
      onStatus?.(`Reconectando con ${getPeerLabel()}…`);
      peerGraceTimer = setTimeout(async () => {
        if (disposed || closingRef?.current) return;
        const alive = await verifyCallActive();
        if (!alive) {
          onRemoteEnd?.();
          return;
        }
        peerGraceCycles += 1;
        if (peerGraceCycles >= maxPeerGraceCycles) {
          await abandon('Sin respuesta del otro usuario');
          return;
        }
        onStatus?.('Conexión inestable — manteniendo llamada…');
        schedulePeerGrace();
      }, peerGraceMs);
    }, 8000);
  };

  const scheduleReconnect = () => {
    if (disposed || closingRef?.current || busy()) return;
    if (reconnectCycles >= maxReconnectCycles) {
      abandon('No se pudo restaurar la conexión');
      return;
    }
    if (reconnectAttempt >= CALL_RECONNECT_DELAYS.length) {
      reconnectAttempt = 0;
      reconnectCycles += 1;
    }
    const delay = CALL_RECONNECT_DELAYS[reconnectAttempt] ?? 20_000;
    reconnectAttempt += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => {
      if (disposed || closingRef?.current || busy()) return;
      const alive = await verifyCallActive();
      if (!alive) {
        onRemoteEnd?.();
        return;
      }
      try {
        onStatus?.('Restaurando enlace…');
        const fresh = await refreshPrivateCall(authToken, callId);
        const url = publicLiveKitUrl(fresh.url);
        const token = fresh.token;
        if (busy()) return;
        await room.connect(url, token);
        reconnectAttempt = 0;
        reconnectCycles = 0;
        quietStatusUntil = Date.now() + 5000;
        onStatus?.('Enlace restaurado');
      } catch (err) {
        if (isCallGoneError(err)) {
          onRemoteEnd?.();
          return;
        }
        scheduleReconnect();
      }
    }, delay);
  };

  const resyncFromBackend = async () => {
    if (disposed || closingRef?.current) return;
    try {
      await pingPrivateCall(authToken, callId);
    } catch (err) {
      if (isCallGoneError(err)) {
        onRemoteEnd?.();
        return;
      }
    }
    if (room.state === ConnectionState.Disconnected) {
      scheduleReconnect();
    }
  };

  const onParticipantDisconnected = () => {
    if (disposed || closingRef?.current) return;
    schedulePeerGrace();
  };

  const onParticipantConnected = () => {
    if (disposed || closingRef?.current) return;
    clearPeerGrace();
    reconnectAttempt = 0;
    peerGraceCycles = 0;
    reconnectCycles = 0;
    quietStatusUntil = Date.now() + 4000;
  };

  const onReconnecting = () => {
    if (disposed || closingRef?.current) return;
    if (Date.now() < quietStatusUntil) return;
    onStatus?.('Reconectando…');
  };

  const onReconnected = () => {
    if (disposed || closingRef?.current) return;
    clearPeerGrace();
    clearTimeout(reconnectTimer);
    reconnectAttempt = 0;
    peerGraceCycles = 0;
    reconnectCycles = 0;
    quietStatusUntil = Date.now() + 6000;
  };

  const onDisconnected = (reason) => {
    if (disposed || closingRef?.current) return;
    if (
      reason === DisconnectReason.CLIENT_INITIATED ||
      reason === DisconnectReason.ROOM_DELETED ||
      reason === DisconnectReason.DUPLICATE_IDENTITY
    ) {
      return;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (disposed || closingRef?.current) return;
      if (room.state === ConnectionState.Disconnected) scheduleReconnect();
    }, 2500);
  };

  room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  room.on(RoomEvent.Reconnecting, onReconnecting);
  room.on(RoomEvent.Reconnected, onReconnected);
  room.on(RoomEvent.Disconnected, onDisconnected);

  pingTimer = setInterval(() => {
    if (disposed || closingRef?.current) return;
    pingPrivateCall(authToken, callId).catch((err) => {
      if (isCallGoneError(err)) onRemoteEnd?.();
    });
  }, pingMs);

  const onSocketConnect = () => {
    quietStatusUntil = Date.now() + 3000;
    resyncFromBackend();
  };
  if (signalSocket) {
    signalSocket.on('connect', onSocketConnect);
    signalSocket.on('reconnect', onSocketConnect);
  }

  return () => {
    disposed = true;
    clearPeerGrace();
    clearInterval(pingTimer);
    clearTimeout(reconnectTimer);
    room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.off(RoomEvent.Reconnecting, onReconnecting);
    room.off(RoomEvent.Reconnected, onReconnected);
    room.off(RoomEvent.Disconnected, onDisconnected);
    if (signalSocket) {
      signalSocket.off('connect', onSocketConnect);
      signalSocket.off('reconnect', onSocketConnect);
    }
  };
}

import { mergeStreamingRoomOptions } from './videoStreaming.js';

export const RESILIENT_ROOM_OPTIONS = mergeStreamingRoomOptions();
