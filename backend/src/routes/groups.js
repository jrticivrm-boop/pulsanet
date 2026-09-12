import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { listVisibleGroups, listMemberGroups } from '../services/orgUnits.js';
import { mapAvatarUrl } from './me.js';

export const groupsRouter = Router();

groupsRouter.use(authMiddleware);

groupsRouter.get('/', async (req, res) => {
  try {
    const membersOnly =
      req.query.membersOnly === '1' ||
      req.query.membersOnly === 'true' ||
      req.query.scope === 'member';
    const memberIds = new Set(
      (await listMemberGroups(req.user)).map((g) => g.id)
    );
    const groups = membersOnly
      ? await listMemberGroups(req.user)
      : await listVisibleGroups(req.user);
    return res.json({
      ok: true,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        livekit_room: g.livekit_room,
        is_active: g.is_active,
        unit_id: g.unit_id || null,
        member_role: g.member_role || 'member',
        is_member: memberIds.has(g.id),
        member_count: Number(g.member_count) || 0,
        memberCount: Number(g.member_count) || 0,
        avatarUrl: mapAvatarUrl(g.avatar_url),
      })),
    });
  } catch (err) {
    console.error('groups list:', err.message);
    return res.status(500).json({ ok: false, error: 'No se pudieron listar canales' });
  }
});

groupsRouter.post('/', async (req, res) => {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' });
  }

  const { name, description, unitId } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }

  const roomId = `grp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by, unit_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, livekit_room, unit_id`,
    [
      req.user.orgId,
      name.trim(),
      description || null,
      roomId,
      req.user.sub,
      unitId || null,
    ]
  );

  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')`,
    [rows[0].id, req.user.sub]
  );

  res.status(201).json({ ok: true, group: rows[0] });
});

groupsRouter.get('/:id/members', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.display_name, u.username, u.email, gm.role
     FROM group_members gm
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND u.is_active = TRUE
     ORDER BY u.display_name`,
    [req.params.id]
  );
  res.json({ ok: true, members: rows });
});
