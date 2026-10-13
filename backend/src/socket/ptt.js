/**
 * Floor PTT + presencia online (Redis) + auditoría ptt_sessions.
 * Multi-join: un socket puede estar en varios group:* (Canal abierto / Escuchar N).
 * Takeover: root > admin/zona/unidad > operador; mismo rango no se quita.
 * Multi-cliente (admin): mismo user en otro socket mueve el mic (selfMove) y corta el anterior.
 */
import {
  addPresence,
  broadcastPresence,
  clearFloor,
  getFloor,
  resolvePttMemberRole,
  normalizePresenceFocus,
  pttFloorRank,
  refreshFloorTtl,
  removePresenceSocket,
  tryAcquireFloor,
} from '../services/presence.js';
import { emitDispatch } from './dispatch.js';
import { inc } from '../services/metrics.js';
import { isFcmReady, notifyPttWake } from '../services/fcm.js';
import { getRedis } from '../redis.js';
import { query } from '../db.js';

const PTT_WAKE_GRANT_DELAY_MS = Math.max(
  0,
  Math.min(2000, Number(process.env.PTT_WAKE_GRANT_DELAY_MS ?? 800) || 0)
);

/** Margen extra al emisor cuando se despertó por push algún radio dormido. */
const PTT_PUSH_GRANT_DELAY_MS = Math.max(
  0,
  Math.min(4000, Number(process.env.PTT_PUSH_GRANT_DELAY_MS ?? 2000) || 0)
);
/** Un push de despertar por canal como máximo en esta ventana. */
const PTT_WAKE_PUSH_EVERY_SEC = Math.max(
  5,
  Math.min(120, Number(process.env.PTT_WAKE_PUSH_EVERY_SEC ?? 25) || 25)
);

/** Retraso del grant solo si hay otro radio bajo demanda (APK) escuchando el canal. */
async function grantDelayFor(io, groupId, talkerSocketId) {
  if (!PTT_WAKE_GRANT_DELAY_MS) return 0;
  try {
    const socks = await io.in(`group:${groupId}`).fetchSockets();
    const wake = socks.some((s) => s.id !== talkerSocketId && s.data?.radioOnDemand);
    return wake ? PTT_WAKE_GRANT_DELAY_MS : 0;
  } catch {
    return PTT_WAKE_GRANT_DELAY_MS;
  }
}

/**
 * Miembros del canal sin socket unido (app dormida, cerrada o sin red): push `ptt_wake`.
 * @returns {Promise<number>} cuántos usuarios se intentaron despertar
 */
async function wakeSleepingMembers(io, groupId, user) {
  if (!isFcmReady()) return 0;
  try {
    const ok = await getRedis().set(`pttwake:${groupId}`, '1', 'EX', PTT_WAKE_PUSH_EVERY_SEC, 'NX');
    if (ok !== 'OK') return 0;
  } catch {
    /* sin Redis: seguir sin límite */
  }
  const socks = await io.in(`group:${groupId}`).fetchSockets();
  const awake = new Set(socks.map((s) => String(s.data?.user?.sub || '')).filter(Boolean));
  const { rows } = await query(
    `SELECT gm.user_id, g.name AS group_name
     FROM group_members gm
     INNER JOIN groups g ON g.id = gm.group_id
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND u.is_active = TRUE AND gm.user_id <> $2`,
    [groupId, user.sub]
  );
  const sleeping = rows.map((r) => String(r.user_id)).filter((id) => !awake.has(id));
  if (!sleeping.length) return 0;
  notifyPttWake({
    groupId,
    groupName: rows[0]?.group_name,
    speakerId: user.sub,
    speakerName: user.displayName,
    userIds: sleeping,
  })
    .then(({ sent }) => {
      if (sent) inc('pttWakePush', sent);
    })
    .catch((err) => console.error('ptt wake push:', err?.message || err));
  return sleeping.length;
}

function ensureJoinState(socket) {
  if (!(socket.data.joinedGroups instanceof Set)) {
    socket.data.joinedGroups = new Set();
  }
  if (!socket.data.memberRoles || typeof socket.data.memberRoles !== 'object') {
    socket.data.memberRoles = {};
  }
  if (!(socket.data.holdingFloors instanceof Set)) {
    socket.data.holdingFloors = new Set();
  }
}

export function registerPttHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;
    ensureJoinState(socket);

    socket.on('ptt:join', async ({ groupId, focus, background, onDemand } = {}) => {
      if (!groupId) return;
      try {
        ensureJoinState(socket);
        if (onDemand === true) socket.data.radioOnDemand = true;
        const role = await resolvePttMemberRole(groupId, user);
        if (!role) {
          socket.emit('ptt:error', { groupId, error: 'No eres miembro' });
          return;
        }
        socket.data.memberRoles[groupId] = role;
        // Compat: último join = canal “activo” para pings sin groupId.
        socket.data.memberRole = role;
        socket.data.activeGroup = groupId;

        socket.join(`group:${groupId}`);
        socket.data.joinedGroups.add(groupId);

        const focusState = normalizePresenceFocus(focus, background);
        socket.data.presenceFocus = focusState;
        await addPresence(groupId, user.sub, user.displayName, focusState, socket.id, user.orgId);
        await broadcastPresence(io, groupId);
        emitDispatch(io, 'dispatch:presence', { groupId });

        const floor = await getFloor(groupId);
        socket.emit('ptt:state', {
          groupId,
          memberRole: role,
          speaker: floor
            ? {
                userId: floor.userId,
                displayName: floor.displayName,
                since: floor.since,
                role: floor.role,
              }
            : null,
        });
      } catch (err) {
        socket.emit('ptt:error', { groupId, error: err.message });
      }
    });

    socket.on('ptt:leave', async ({ groupId } = {}) => {
      const gid = groupId || socket.data.activeGroup;
      if (!gid) return;
      try {
        await leaveGroup(socket, io, gid, user);
      } catch (e) {
        console.error('ptt:leave:', e?.message || e);
      }
    });

    socket.on('ptt:request', async ({ groupId } = {}) => {
      if (!groupId) return;
      try {
        ensureJoinState(socket);
        const memberRole =
          socket.data.memberRoles[groupId] ||
          (await resolvePttMemberRole(groupId, user));
        if (!memberRole) {
          socket.emit('ptt:error', { groupId, error: 'No eres miembro' });
          return;
        }
        socket.data.memberRoles[groupId] = memberRole;
        if (memberRole === 'listen_only') {
          inc('pttDenied');
          socket.emit('ptt:denied', {
            groupId,
            reason: 'listen_only',
          });
          return;
        }

        const orgRole = user.role || 'operator';
        const result = await tryAcquireFloor(groupId, {
          userId: user.sub,
          displayName: user.displayName,
          since: Date.now(),
          role: orgRole,
          rank: pttFloorRank(orgRole),
          socketId: socket.id,
          deviceId: socket.data.deviceId || null,
        });

        if (!result.ok) {
          inc('pttDenied');
          socket.emit('ptt:denied', {
            groupId,
            reason: 'ocupado',
            speakerId: result.current?.userId,
            speakerName: result.current?.displayName,
            speakerRole: result.current?.role,
          });
          return;
        }

        // Takeover por rango O mismo usuario en otro cliente: cortar mic del titular previo.
        if ((result.takeover || result.selfMove) && result.previous?.userId) {
          const takenPayload = {
            groupId,
            byUserId: user.sub,
            byDisplayName: user.displayName,
            previousUserId: result.previous.userId,
            previousDisplayName: result.previous.displayName,
            previousSocketId: result.previous.socketId || null,
            holderSocketId: socket.id,
            reason: result.selfMove ? 'same_user_other_client' : 'takeover',
          };
          if (result.previous.socketId) {
            io.to(result.previous.socketId).emit('ptt:taken', takenPayload);
          } else {
            // Floor legado sin socketId: avisar a todas las sesiones del usuario previo.
            io.to(`user:${result.previous.userId}`).emit('ptt:taken', takenPayload);
          }
          if (result.takeover) {
            io.to(`group:${groupId}`).emit('ptt:taken', takenPayload);
          }
          try {
            await query(
              `UPDATE ptt_sessions SET ended_at = NOW()
               WHERE group_id = $1 AND user_id = $2 AND ended_at IS NULL`,
              [groupId, result.previous.userId]
            );
          } catch (err) {
            console.error('ptt_sessions takeover close:', err.message);
          }
        }

        inc('pttGranted');
        socket.data.holdingFloor = true;
        socket.data.holdingFloors.add(groupId);
        // ptt:speaker primero: los radios bajo demanda conectan su sala mientras
        // el emisor espera el grant (si no, se pierden las primeras palabras).
        io.to(`group:${groupId}`).emit('ptt:speaker', {
          groupId,
          userId: user.sub,
          displayName: user.displayName,
          role: orgRole,
        });
        const grant = {
          groupId,
          takeover: Boolean(result.takeover),
          selfMove: Boolean(result.selfMove),
        };
        let delayMs = await grantDelayFor(io, groupId, socket.id);
        if (!result.renewed) {
          const woken = await wakeSleepingMembers(io, groupId, user).catch((err) => {
            console.error('ptt wake:', err?.message || err);
            return 0;
          });
          if (woken > 0) {
            delayMs = Math.max(delayMs, PTT_PUSH_GRANT_DELAY_MS);
            socket.emit('ptt:waking', { groupId, count: woken, delayMs });
          }
        }
        if (delayMs > 0) {
          setTimeout(() => {
            getFloor(groupId)
              .then((f) => {
                if (f?.socketId === socket.id) socket.emit('ptt:granted', grant);
              })
              .catch(() => {});
          }, delayMs);
        } else {
          socket.emit('ptt:granted', grant);
        }
        emitDispatch(io, 'dispatch:speaker', {
          groupId,
          userId: user.sub,
          displayName: user.displayName,
          role: orgRole,
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
      } catch (err) {
        socket.emit('ptt:error', { groupId, error: err.message });
      }
    });

    socket.on('ptt:release', async ({ groupId } = {}) => {
      const gid = groupId || socket.data.activeGroup;
      if (!gid) return;
      try {
        await releaseFloor(gid, user.sub, io, socket);
      } catch (e) {
        console.error('ptt:release:', e?.message || e);
      }
    });

    const refreshPresence = async (targets, focusState) => {
      for (const gid of targets) {
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
      }
    };

    // Heartbeat de engine.io (cada pingInterval): renueva presencia sin tráfico extra del cliente.
    socket.conn?.on?.('packet', (packet) => {
      if (packet?.type !== 'pong') return;
      if (!socket.data.joinedGroups?.size || !socket.data.presenceFocus) return;
      refreshPresence([...socket.data.joinedGroups], socket.data.presenceFocus).catch(() => {});
    });

    socket.on('presence:ping', async ({ groupId, focus, background } = {}) => {
      ensureJoinState(socket);
      const targets = [];
      if (groupId) {
        if (!socket.data.joinedGroups.has(groupId)) return;
        targets.push(groupId);
      } else if (socket.data.joinedGroups.size) {
        targets.push(...socket.data.joinedGroups);
      } else if (socket.data.activeGroup) {
        targets.push(socket.data.activeGroup);
      }
      if (!targets.length) return;
      try {
        const focusState = normalizePresenceFocus(focus, background);
        socket.data.presenceFocus = focusState;
        await refreshPresence(targets, focusState);
      } catch {
        /* ignore ping errors */
      }
    });

    socket.on('disconnect', async () => {
      ensureJoinState(socket);
      const groups = [...socket.data.joinedGroups];
      if (!groups.length && socket.data.activeGroup) {
        groups.push(socket.data.activeGroup);
      }
      for (const gid of groups) {
        try {
          await leaveGroup(socket, io, gid, user);
        } catch (e) {
          console.error('ptt disconnect:', e?.message || e);
        }
      }
    });
  });
}

async function leaveGroup(socket, io, groupId, user) {
  ensureJoinState(socket);
  socket.leave(`group:${groupId}`);
  socket.data.joinedGroups.delete(groupId);
  delete socket.data.memberRoles[groupId];
  if (socket.data.activeGroup === groupId) {
    const next = socket.data.joinedGroups.values().next();
    socket.data.activeGroup = next.done ? null : next.value;
    socket.data.memberRole = socket.data.activeGroup
      ? socket.data.memberRoles[socket.data.activeGroup]
      : null;
  }

  const { removedUser } = await removePresenceSocket(groupId, socket.id, user.orgId);

  if (socket.data.holdingFloors.has(groupId) || socket.data.holdingFloor || removedUser) {
    await releaseFloor(groupId, user.sub, io, socket);
  }

  await broadcastPresence(io, groupId);
  emitDispatch(io, 'dispatch:presence', { groupId });
}

async function releaseFloor(groupId, userId, io, socket) {
  // Solo el socket que tiene el floor puede liberarlo (multi-cliente admin).
  const floor = await getFloor(groupId);
  if (socket?.id && floor?.socketId && floor.userId === userId && floor.socketId !== socket.id) {
    ensureJoinState(socket);
    socket.data.holdingFloors.delete(groupId);
    if (!socket.data.holdingFloors.size) {
      socket.data.holdingFloor = false;
    }
    return;
  }

  const cleared = await clearFloor(groupId, userId, socket?.id || null);
  if (socket) {
    ensureJoinState(socket);
    socket.data.holdingFloors.delete(groupId);
    if (!socket.data.holdingFloors.size) {
      socket.data.holdingFloor = false;
    }
  }
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
