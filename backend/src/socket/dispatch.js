import { isDispatch, canManageUsers } from '../services/roles.js';
import { packWireEvent } from '../services/wireCrypto.js';
import { loadTrackScope } from '../services/orgUnits.js';

const WIRE_EVENTS = new Set([
  'dispatch:location',
  'dispatch:geofence',
  'dispatch:panic',
  'dispatch:panic_update',
]);

const TRACK_ROOM_ALL = 'dispatch:track:all';

function trackUnitRoom(unitId) {
  return `dispatch:track:unit:${unitId}`;
}

/**
 * Canal de despacho:
 * - `dispatch` — presencia / speaker (mesa)
 * - `dispatch:track:*` — GPS / seguimiento acotado a Región / zona / unidad
 */
export function registerDispatchHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.on('dispatch:join', async () => {
      if (!isDispatch(user.role)) {
        socket.emit('dispatch:error', { error: 'Sin permiso' });
        return;
      }
      socket.join('dispatch');
      if (canManageUsers(user.role) || isDispatch(user.role)) {
        socket.join('security:alerts');
      }

      try {
        const scope = await loadTrackScope(user);
        socket.data.trackScope = scope;
        if (scope.orgWide) {
          socket.join(TRACK_ROOM_ALL);
        } else if (scope.unitIds?.length) {
          for (const id of scope.unitIds) {
            socket.join(trackUnitRoom(id));
          }
        }
        socket.emit('dispatch:joined', {
          ok: true,
          track: {
            level: scope.level,
            orgWide: Boolean(scope.orgWide),
            unitCount: scope.orgWide ? null : scope.unitIds?.length || 0,
          },
        });
      } catch (err) {
        console.error('dispatch:join track scope:', err.message);
        socket.emit('dispatch:joined', { ok: true });
      }
    });

    socket.on('dispatch:leave', () => {
      socket.leave('dispatch');
      const scope = socket.data.trackScope;
      if (scope?.orgWide) socket.leave(TRACK_ROOM_ALL);
      if (scope?.unitIds?.length) {
        for (const id of scope.unitIds) socket.leave(trackUnitRoom(id));
      }
      socket.data.trackScope = null;
    });
  });
}

/** Presencia / speaker / grabaciones: toda la mesa de despacho. */
export function emitDispatch(io, event, payload) {
  const packed = WIRE_EVENTS.has(event) ? packWireEvent(payload) : payload;
  io.to('dispatch').emit(event, packed);
}

/**
 * GPS / geocerca / pánico: Región (track:all) + admins de la unidad del usuario.
 * @param {{ unitId?: string|null }} opts
 */
export function emitDispatchTrack(io, event, payload, opts = {}) {
  const packed = WIRE_EVENTS.has(event) ? packWireEvent(payload) : payload;
  io.to(TRACK_ROOM_ALL).emit(event, packed);
  const unitId = opts.unitId;
  if (unitId) {
    io.to(trackUnitRoom(unitId)).emit(event, packed);
  }
}
