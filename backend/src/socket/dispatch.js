import { isDispatch } from '../services/roles.js';

/**
 * Canal de despacho: root/admin/dispatcher reciben speakers, GPS y presencia.
 */
export function registerDispatchHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.on('dispatch:join', () => {
      if (!isDispatch(user.role)) {
        socket.emit('dispatch:error', { error: 'Sin permiso' });
        return;
      }
      socket.join('dispatch');
      socket.emit('dispatch:joined', { ok: true });
    });

    socket.on('dispatch:leave', () => {
      socket.leave('dispatch');
    });
  });
}

export function emitDispatch(io, event, payload) {
  io.to('dispatch').emit(event, payload);
}
