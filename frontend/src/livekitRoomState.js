import { ConnectionState, DisconnectReason, RoomEvent } from 'livekit-client';

/** El SDK está conectando o reanudando: no reemplazar la sala (misma identidad = DUPLICATE_IDENTITY). */
export function roomIsResuming(room) {
  return (
    room?.state === ConnectionState.Connecting ||
    room?.state === ConnectionState.Reconnecting ||
    room?.state === ConnectionState.SignalReconnecting
  );
}

/**
 * Espera a que una sala en reanudación quede `connected` o `disconnected`.
 * Devuelve el estado final (o el actual si vence el tiempo).
 */
export function waitRoomSettled(room, timeoutMs = 20000) {
  if (!room || !roomIsResuming(room)) return Promise.resolve(room?.state);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      room.off(RoomEvent.Connected, finish);
      room.off(RoomEvent.Reconnected, finish);
      room.off(RoomEvent.Disconnected, finish);
      resolve(room.state);
    };
    const timer = setTimeout(finish, timeoutMs);
    room.on(RoomEvent.Connected, finish);
    room.on(RoomEvent.Reconnected, finish);
    room.on(RoomEvent.Disconnected, finish);
  });
}

/** Desconexiones que no deben reconectarse solas (salida propia u otra pestaña/equipo con la misma identidad). */
export function isFinalDisconnect(reason) {
  return (
    reason === DisconnectReason.CLIENT_INITIATED ||
    reason === DisconnectReason.DUPLICATE_IDENTITY ||
    reason === DisconnectReason.ROOM_DELETED ||
    reason === DisconnectReason.PARTICIPANT_REMOVED
  );
}
