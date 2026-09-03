import { ConnectionState, RoomEvent } from 'livekit-client';
import { fetchPrivateCall, pingPrivateCall, refreshPrivateCall } from './api';
import { publicLiveKitUrl } from './livekitUrl';

export const CALL_PEER_GRACE_MS = 28_000;
export const CALL_PING_MS = 15_000;
export const CALL_RECONNECT_DELAYS = [400, 800, 1600, 3200, 6000, 10_000];

/**
 * Estabilizador virtual para llamadas privadas (voz / radio / video):
 * - No cuelga en caídas breves de LiveKit
 * - Reintenta connect + refresh de token
 * - Ping al backend + resync por socket
 */
export function attachPrivateCallStabilizer({
  room,
  callId,
  authToken,
  signalSocket = null,
  closingRef,
  onStatus,
  onRemoteEnd,
  getPeerLabel = () => 'el otro usuario',
  peerGraceMs = CALL_PEER_GRACE_MS,
  pingMs = CALL_PING_MS,
}) {
  if (!room || !callId || !authToken) return () => {};

  let peerGraceTimer = null;
  let pingTimer = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let disposed = false;

  const clearPeerGrace = () => {
    if (peerGraceTimer) {
      clearTimeout(peerGraceTimer);
      peerGraceTimer = null;
    }
  };

  const verifyCallActive = async () => {
    try {
      const data = await fetchPrivateCall(authToken, callId);
      const status = data?.call?.status;
      return status && status !== 'ended';
    } catch {
      return false;
    }
  };

  const schedulePeerGrace = () => {
    if (disposed || closingRef?.current) return;
    clearPeerGrace();
    onStatus?.(`Reconectando con ${getPeerLabel()}…`);
    peerGraceTimer = setTimeout(async () => {
      if (disposed || closingRef?.current) return;
      const alive = await verifyCallActive();
      if (!alive) {
        onRemoteEnd?.();
        return;
      }
      onStatus?.('Conexión inestable — manteniendo llamada…');
      schedulePeerGrace();
    }, peerGraceMs);
  };

  const scheduleReconnect = () => {
    if (disposed || closingRef?.current) return;
    if (reconnectAttempt >= CALL_RECONNECT_DELAYS.length) {
      onStatus?.('Sin señal — reintentando…');
      reconnectAttempt = 0;
    }
    const delay = CALL_RECONNECT_DELAYS[reconnectAttempt] ?? 10_000;
    reconnectAttempt += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => {
      if (disposed || closingRef?.current) return;
      const alive = await verifyCallActive();
      if (!alive) {
        onRemoteEnd?.();
        return;
      }
      try {
        onStatus?.('Restaurando audio y video…');
        const fresh = await refreshPrivateCall(authToken, callId);
        const url = publicLiveKitUrl(fresh.url);
        const token = fresh.token;
        if (room.state === ConnectionState.Connected) return;
        await room.connect(url, token);
        reconnectAttempt = 0;
        onStatus?.('Conexión restaurada');
      } catch {
        scheduleReconnect();
      }
    }, delay);
  };

  const resyncFromBackend = async () => {
    if (disposed || closingRef?.current) return;
    const alive = await verifyCallActive();
    if (!alive) {
      onRemoteEnd?.();
      return;
    }
    try {
      await pingPrivateCall(authToken, callId);
    } catch {
      /* ignore */
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
    onStatus?.('En llamada');
  };

  const onReconnecting = () => {
    if (disposed || closingRef?.current) return;
    onStatus?.('Reconectando…');
  };

  const onReconnected = () => {
    if (disposed || closingRef?.current) return;
    clearPeerGrace();
    reconnectAttempt = 0;
    onStatus?.('Conexión restaurada');
  };

  const onDisconnected = () => {
    if (disposed || closingRef?.current) return;
    scheduleReconnect();
  };

  room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  room.on(RoomEvent.Reconnecting, onReconnecting);
  room.on(RoomEvent.Reconnected, onReconnected);
  room.on(RoomEvent.Disconnected, onDisconnected);

  pingTimer = setInterval(() => {
    if (disposed || closingRef?.current) return;
    pingPrivateCall(authToken, callId).catch(() => {});
  }, pingMs);

  const onSocketConnect = () => {
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
