/**
 * Floor PTT + presencia online (Redis) + auditoría ptt_sessions.
 */
import {
  addPresence,
  broadcastPresence,
  clearFloor,
  getFloor,
  getMemberRole,
  normalizePresenceFocus,
  refreshFloorTtl,
  removePresenceSocket,
  tryAcquireFloor,
} from '../services/presence.js';
import { emitDispatch } from './dispatch.js';
import { inc } from '../services/metrics.js';
import { query } from '../db.js';

export function registerPttHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.on('ptt:join', async ({ groupId, focus, background }) => {
      if (!groupId) return;
      try {
        const role = await getMemberRole(groupId, user.sub);
        if (!role) {
          socket.emit('ptt:error', { groupId, error: 'No eres miembro' });
          return;
        }
        socket.data.memberRole = role;

        if (socket.data.activeGroup && socket.data.activeGroup !== groupId) {
          await leaveGroup(socket, io, socket.data.activeGroup, user);
        }

        socket.join(`group:${groupId}`);
        socket.data.activeGroup = groupId;
        const focusState = normalizePresenceFocus(focus, background);
        await addPresence(groupId, user.sub, user.displayName, focusState, socket.id, user.orgId);
        await broadcastPresence(io, groupId);
        emitDispatch(io, 'dispatch:presence', { groupId });

        const floor = await getFloor(groupId);
        socket.emit('ptt:state', {
          groupId,
          memberRole: role,
          speaker: floor
            ? { userId: floor.userId, displayName: floor.displayName, since: floor.since }
            : null,
        });
      } catch (err) {
        socket.emit('ptt:error', { groupId, error: err.message });
      }
    });

    socket.on('ptt:leave', async ({ groupId }) => {
      const gid = groupId || socket.data.activeGroup;
      if (!gid) return;
      await leaveGroup(socket, io, gid, user);
    });

    socket.on('ptt:request', async ({ groupId }) => {
      if (!groupId) return;
      try {
        const role =
          socket.data.memberRole || (await getMemberRole(groupId, user.sub));
        if (!role) {
          socket.emit('ptt:error', { groupId, error: 'No eres miembro' });
          return;
        }
        if (role === 'listen_only') {
          inc('pttDenied');
          socket.emit('ptt:denied', {
            groupId,
            reason: 'listen_only',
          });
          return;
        }

        const result = await tryAcquireFloor(groupId, {
          userId: user.sub,
          displayName: user.displayName,
          since: Date.now(),
        });

        if (!result.ok) {
          inc('pttDenied');
          socket.emit('ptt:denied', {
            groupId,
            reason: 'ocupado',
            speakerId: result.current?.userId,
          });
          return;
        }

        inc('pttGranted');
        socket.data.holdingFloor = true;
        // Emitir YA: no bloquear el audio esperando INSERT en Postgres
        socket.emit('ptt:granted', { groupId });
        io.to(`group:${groupId}`).emit('ptt:speaker', {
          groupId,
          userId: user.sub,
          displayName: user.displayName,
        });
        emitDispatch(io, 'dispatch:speaker', {
          groupId,
          userId: user.sub,
          displayName: user.displayName,
        });

        query(
          `INSERT INTO ptt_sessions (group_id, user_id) VALUES ($1, $2) RETURNING id`,
          [groupId, user.sub]
        )
          .then(({ rows }) => {
            socket.data.pttSessionId = rows[0]?.id;
          })
          .catch((err) => {
            console.error('ptt_sessions insert:', err.message);
          });

        // Sin push FCM en PTT: el audio va por LiveKit; notificaciones solo mensajes/llamadas.
      } catch (err) {
        socket.emit('ptt:error', { groupId, error: err.message });
      }
    });

    socket.on('ptt:release', async ({ groupId }) => {
      const gid = groupId || socket.data.activeGroup;
      if (!gid) return;
      await releaseFloor(gid, user.sub, io, socket);
    });

    socket.on('presence:ping', async ({ groupId, focus, background }) => {
      const gid = groupId || socket.data.activeGroup;
      if (!gid) return;
      try {
        const focusState = normalizePresenceFocus(focus, background);
        const { focusChanged } = await addPresence(
          gid,
          user.sub,
          user.displayName,
          focusState,
          socket.id,
          user.orgId
        );
        const floor = await getFloor(gid);
        if (floor?.userId === user.sub) {
          await refreshFloorTtl(gid);
        }
        if (focusChanged) {
          await broadcastPresence(io, gid);
          emitDispatch(io, 'dispatch:presence', { groupId: gid });
        }
      } catch {
        /* ignore ping errors */
      }
    });

    socket.on('disconnect', async () => {
      if (socket.data.activeGroup) {
        await leaveGroup(socket, io, socket.data.activeGroup, user);
      }
    });
  });
}

async function leaveGroup(socket, io, groupId, user) {
  socket.leave(`group:${groupId}`);
  if (socket.data.activeGroup === groupId) {
    socket.data.activeGroup = null;
  }

  const { removedUser } = await removePresenceSocket(groupId, socket.id, user.orgId);

  // Liberar floor solo si este socket tenía el PTT o el usuario ya no tiene ningún dispositivo.
  if (socket.data.holdingFloor || removedUser) {
    await releaseFloor(groupId, user.sub, io, socket);
  }

  await broadcastPresence(io, groupId);
  emitDispatch(io, 'dispatch:presence', { groupId });
}

async function releaseFloor(groupId, userId, io, socket) {
  const cleared = await clearFloor(groupId, userId);
  if (socket) socket.data.holdingFloor = false;
  if (cleared) {
    inc('pttReleased');
    try {
      if (socket?.data?.pttSessionId) {
        await query(`UPDATE ptt_sessions SET ended_at = NOW() WHERE id = $1 AND ended_at IS NULL`, [
          socket.data.pttSessionId,
        ]);
        socket.data.pttSessionId = null;
      } else {
        await query(
          `UPDATE ptt_sessions SET ended_at = NOW()
           WHERE group_id = $1 AND user_id = $2 AND ended_at IS NULL`,
          [groupId, userId]
        );
      }
    } catch (err) {
      console.error('ptt_sessions close:', err.message);
    }
    io.to(`group:${groupId}`).emit('ptt:released', { groupId });
    emitDispatch(io, 'dispatch:released', { groupId });
  }
}
