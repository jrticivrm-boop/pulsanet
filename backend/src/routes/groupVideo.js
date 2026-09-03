import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { createRoomToken, isLiveKitConfigured, resolveLiveKitUrl } from '../services/livekit.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';
import { notifyUserDevices } from '../services/fcm.js';
import {
  endGroupVideoSession,
  getGroupVideoSession,
  groupVideoRoomName,
  leaveGroupVideoSession,
  serializeGroupVideoSession,
  startGroupVideoSession,
  touchGroupVideoParticipant,
} from '../services/groupVideo.js';

async function loadGroupMember(orgId, groupId, userId, role) {
  const { rows } = await query(
    `SELECT g.id, g.name, g.organization_id, gm.role AS member_role
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE g.id = $1 AND gm.user_id = $2 AND g.is_active = TRUE`,
    [groupId, userId]
  );
  if (rows[0]) return rows[0];
  if (!isDispatch(role)) return null;
  const { rows: orgRows } = await query(
    `SELECT g.id, g.name, g.organization_id, 'leader'::text AS member_role
     FROM groups g
     WHERE g.id = $1 AND g.organization_id = $2 AND g.is_active = TRUE`,
    [groupId, orgId]
  );
  return orgRows[0] || null;
}

async function issueGroupVideoCredentials(req, group, roomName) {
  const token = await createRoomToken({
    identity: req.user.sub,
    displayName: req.user.displayName,
    roomName,
    canPublish: group.member_role !== 'listen_only',
  });
  return {
    token,
    url: resolveLiveKitUrl(req),
    room: roomName,
    e2eeKey: voiceE2eeKeyForRoom(roomName),
    e2ee: Boolean(voiceE2eeKeyForRoom(roomName)),
  };
}

async function broadcastGroupVideoInvite(io, { group, session, startedBy, startedByName }) {
  const payload = {
    groupId: group.id,
    groupName: group.name,
    session: serializeGroupVideoSession(session),
    startedBy,
    startedByName,
  };

  const { rows } = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [group.id]
  );

  for (const row of rows) {
    if (String(row.user_id) === String(startedBy)) continue;
    io.to(`user:${row.user_id}`).emit('group:video_incoming', payload);
    notifyUserDevices({
      userId: row.user_id,
      title: 'Transmisión grupal en vivo',
      body: `${startedByName || 'Un operador'} inició video en «${group.name || 'grupo'}»`,
      data: {
        type: 'group_video',
        groupId: group.id,
        groupName: group.name,
        startedBy,
        startedByName,
      },
    }).catch(() => {});
  }

  // Miembros sintonizados en el canal PTT del grupo (respaldo si falla user:*).
  io.to(`group:${group.id}`).emit('group:video_incoming', payload);

  io.to(`group:${group.id}`).emit('group:video_started', {
    ...payload,
    by: startedBy,
    displayName: startedByName,
  });
}

async function broadcastGroupVideoEnded(io, groupId, { by, reason }) {
  const payload = { groupId, by, reason };
  const { rows } = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId]
  );
  for (const row of rows) {
    io.to(`user:${row.user_id}`).emit('group:video_ended', payload);
  }
  io.to(`group:${groupId}`).emit('group:video_ended', payload);
}

export function createGroupVideoRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/:groupId/status', async (req, res) => {
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    const session = getGroupVideoSession(req.params.groupId);
    res.json({
      ok: true,
      active: Boolean(session),
      session: serializeGroupVideoSession(session),
    });
  });

  router.post('/:groupId/start', async (req, res) => {
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    if (group.member_role === 'listen_only') {
      return res.status(403).json({ ok: false, error: 'Solo escucha — no puedes iniciar video' });
    }

    const wasActive = Boolean(getGroupVideoSession(group.id));
    const session = startGroupVideoSession({
      groupId: group.id,
      orgId: group.organization_id,
      userId: req.user.sub,
      userName: req.user.displayName,
      groupName: group.name,
    });
    const creds = await issueGroupVideoCredentials(req, group, session.room);
    const payload = serializeGroupVideoSession(session);

    if (!wasActive) {
      await broadcastGroupVideoInvite(io, {
        group,
        session,
        startedBy: req.user.sub,
        startedByName: req.user.displayName,
      });
    } else {
      io.to(`group:${group.id}`).emit('group:video_started', {
        groupId: group.id,
        session: payload,
        by: req.user.sub,
        displayName: req.user.displayName,
      });
    }

    res.json({ ok: true, session: payload, ...creds });
  });

  router.post('/:groupId/join', async (req, res) => {
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ ok: false, error: 'LiveKit no configurado' });
    }
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });

    let session = getGroupVideoSession(group.id);
    const wasActive = Boolean(session);
    if (!session) {
      session = startGroupVideoSession({
        groupId: group.id,
        orgId: group.organization_id,
        userId: req.user.sub,
        userName: req.user.displayName,
        groupName: group.name,
      });
    } else {
      touchGroupVideoParticipant(group.id, req.user.sub, req.user.displayName);
    }

    const creds = await issueGroupVideoCredentials(req, group, session.room);
    const payload = serializeGroupVideoSession(session);

    if (!wasActive) {
      await broadcastGroupVideoInvite(io, {
        group,
        session,
        startedBy: req.user.sub,
        startedByName: req.user.displayName,
      });
    } else {
      io.to(`group:${group.id}`).emit('group:video_joined', {
        groupId: group.id,
        userId: req.user.sub,
        displayName: req.user.displayName,
        participantCount: payload.participantCount,
      });
    }

    res.json({ ok: true, session: payload, ...creds });
  });

  router.post('/:groupId/leave', async (req, res) => {
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });

    const result = leaveGroupVideoSession(group.id, req.user.sub);
    if (result?.ended) {
      await broadcastGroupVideoEnded(io, group.id, {
        by: req.user.sub,
        reason: 'empty',
      });
    } else if (result?.session) {
      io.to(`group:${group.id}`).emit('group:video_left', {
        groupId: group.id,
        userId: req.user.sub,
        participantCount: result.session.participants.size,
      });
    }

    res.json({ ok: true, ended: Boolean(result?.ended) });
  });

  router.post('/:groupId/end', async (req, res) => {
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    const session = getGroupVideoSession(group.id);
    if (!session) return res.json({ ok: true, alreadyEnded: true });

    const isStarter = session.startedBy === req.user.sub;
    const isLeader = group.member_role === 'leader' || isDispatch(req.user.role);
    if (!isStarter && !isLeader) {
      return res.status(403).json({ ok: false, error: 'Solo quien inició o un líder puede cerrar la transmisión' });
    }

    endGroupVideoSession(group.id);
    await broadcastGroupVideoEnded(io, group.id, {
      by: req.user.sub,
      reason: 'ended',
    });
    res.json({ ok: true });
  });

  router.post('/:groupId/ping', async (req, res) => {
    const group = await loadGroupMember(req.user.orgId, req.params.groupId, req.user.sub, req.user.role);
    if (!group) return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    const session = touchGroupVideoParticipant(group.id, req.user.sub, req.user.displayName);
    if (!session) return res.status(404).json({ ok: false, error: 'No hay transmisión activa' });
    res.json({ ok: true, session: serializeGroupVideoSession(session) });
  });

  return router;
}

export { groupVideoRoomName };
