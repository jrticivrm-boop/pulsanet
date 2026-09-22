import { isDispatch, canManageUsers } from '../services/roles.js';
import {
  isWireEncryptionEnabled,
  mintSocketWireKey,
  packWireEventWithKey,
  wireKeyToB64,
} from '../services/wireCrypto.js';
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
 * Emite a un conjunto de sockets sellando wire por clave de cada socket.
 * Si wire está off → emit plano a rooms (comportamiento previo).
 */
async function emitWireToSockets(sockets, event, payload) {
  const list = Array.isArray(sockets) ? sockets : [...sockets];
  if (!isWireEncryptionEnabled() || !WIRE_EVENTS.has(event)) {
    for (const s of list) {
      s.emit(event, payload);
    }
    return;
  }
  for (const s of list) {
    const keyBuf = s.data?.wireKeyBuf;
    if (!keyBuf) continue; // sin join aún: no filtrar coords en claro
    s.emit(event, packWireEventWithKey(payload, keyBuf));
  }
}

async function uniqueSocketsInRooms(io, roomNames) {
  const seen = new Set();
  const out = [];
  for (const room of roomNames) {
    if (!room) continue;
    let socks = [];
    try {
      socks = await io.in(room).fetchSockets();
    } catch {
      continue;
    }
    for (const s of socks) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
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

      // Clave wire por socket (solo despacho).
      if (isWireEncryptionEnabled()) {
        const keyBuf = mintSocketWireKey();
        socket.data.wireKeyBuf = keyBuf;
      } else {
        socket.data.wireKeyBuf = null;
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
          wireKey: wireKeyToB64(socket.data.wireKeyBuf) || undefined,
          wireEnabled: isWireEncryptionEnabled(),
          track: {
            level: scope.level,
            orgWide: Boolean(scope.orgWide),
            unitCount: scope.orgWide ? null : scope.unitIds?.length || 0,
          },
        });
      } catch (err) {
        console.error('dispatch:join track scope:', err.message);
        socket.emit('dispatch:joined', {
          ok: true,
          wireKey: wireKeyToB64(socket.data.wireKeyBuf) || undefined,
          wireEnabled: isWireEncryptionEnabled(),
        });
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
      socket.data.wireKeyBuf = null;
    });
  });
}

/** Presencia / speaker / grabaciones: toda la mesa de despacho. */
export function emitDispatch(io, event, payload) {
  if (!WIRE_EVENTS.has(event) || !isWireEncryptionEnabled()) {
    io.to('dispatch').emit(event, payload);
    return;
  }
  // Wire events no deberían usar emitDispatch (van a track); por si acaso, per-socket.
  void uniqueSocketsInRooms(io, ['dispatch']).then((socks) =>
    emitWireToSockets(socks, event, payload)
  );
}

/**
 * GPS / geocerca / pánico (track): Región (track:all) + admins de la unidad.
 * @param {{ unitId?: string|null }} opts
 */
export function emitDispatchTrack(io, event, payload, opts = {}) {
  const rooms = [TRACK_ROOM_ALL];
  if (opts.unitId) rooms.push(trackUnitRoom(opts.unitId));

  if (!WIRE_EVENTS.has(event) || !isWireEncryptionEnabled()) {
    io.to(TRACK_ROOM_ALL).emit(event, payload);
    if (opts.unitId) io.to(trackUnitRoom(opts.unitId)).emit(event, payload);
    return;
  }

  void uniqueSocketsInRooms(io, rooms).then((socks) =>
    emitWireToSockets(socks, event, payload)
  );
}

/**
 * Emite evento wire a salas user:{id} (pánico a miembros de grupo).
 * @param {import('socket.io').Server} io
 * @param {string} eventName
 * @param {object} payload
 * @param {string[]} userIds
 */
export async function emitWireToUserIds(io, eventName, payload, userIds) {
  if (!io || !eventName || !userIds?.length) return;
  if (!WIRE_EVENTS.has(eventName) || !isWireEncryptionEnabled()) {
    for (const uid of userIds) {
      io.to(`user:${uid}`).emit(eventName, payload);
    }
    return;
  }
  const rooms = userIds.map((id) => `user:${id}`);
  const socks = await uniqueSocketsInRooms(io, rooms);
  await emitWireToSockets(socks, eventName, payload);
}
