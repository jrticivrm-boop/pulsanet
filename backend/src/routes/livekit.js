import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { createRoomToken, isLiveKitConfigured, resolveLiveKitUrl } from '../services/livekit.js';
import { voiceE2eeKeyForRoom } from '../services/voiceE2ee.js';

export const livekitRouter = Router();

livekitRouter.use(authMiddleware);

/** Estado de configuración LiveKit (sin secretos). */
livekitRouter.get('/status', (req, res) => {
  res.json({
    ok: true,
    configured: isLiveKitConfigured(),
    url: isLiveKitConfigured() ? resolveLiveKitUrl(req) : null,
  });
});

/**
 * Token para unirse a la room LiveKit de un grupo.
 * Solo miembros del grupo. listen_only → canPublish false.
 */
livekitRouter.post('/token', async (req, res) => {
  const { groupId } = req.body || {};
  if (!groupId) {
    return res.status(400).json({ ok: false, error: 'groupId requerido' });
  }

  if (!isLiveKitConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'LiveKit no configurado. Revisa LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET.',
    });
  }

  const { rows } = await query(
    `SELECT g.id, g.name, g.livekit_room, gm.role AS member_role
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE g.id = $1 AND gm.user_id = $2 AND g.is_active = TRUE`,
    [groupId, req.user.sub]
  );

  let group = rows[0];
  if (!group && isDispatch(req.user.role)) {
    const { rows: orgRows } = await query(
      `SELECT g.id, g.name, g.livekit_room, 'leader'::text AS member_role
       FROM groups g
       WHERE g.id = $1 AND g.organization_id = $2 AND g.is_active = TRUE`,
      [groupId, req.user.orgId]
    );
    group = orgRows[0];
  }

  if (!group) {
    return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
  }

  const listenOnly = Boolean(req.body?.listenOnly) && isDispatch(req.user.role);
  const canPublish = listenOnly ? false : group.member_role !== 'listen_only';
  const identity = listenOnly
    ? `${req.user.sub}:listen:${group.livekit_room}`
    : req.user.sub;
  const token = await createRoomToken({
    identity,
    displayName: listenOnly
      ? `${req.user.displayName || 'Despacho'} (escucha)`
      : req.user.displayName,
    roomName: group.livekit_room,
    canPublish,
  });

  res.json({
    ok: true,
    token,
    url: resolveLiveKitUrl(req),
    room: group.livekit_room,
    groupId: group.id,
    groupName: group.name,
    canPublish,
    e2eeKey: voiceE2eeKeyForRoom(group.livekit_room),
    e2ee: Boolean(voiceE2eeKeyForRoom(group.livekit_room)),
  });
});
