import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';

export const groupsRouter = Router();

groupsRouter.use(authMiddleware);

groupsRouter.get('/', async (req, res) => {
  // Despacho oye / ve todos los canales de la org (PTT no es solo el grupo «General»)
  if (isDispatch(req.user.role)) {
    const { rows } = await query(
      `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active,
              'leader'::text AS member_role
       FROM groups g
       WHERE g.organization_id = $1 AND g.is_active = TRUE
       ORDER BY g.name`,
      [req.user.orgId]
    );
    return res.json({ ok: true, groups: rows });
  }

  const { rows } = await query(
    `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active,
            gm.role AS member_role
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1 AND g.is_active = TRUE
     ORDER BY g.name`,
    [req.user.sub]
  );
  res.json({ ok: true, groups: rows });
});

groupsRouter.post('/', async (req, res) => {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' });
  }

  const { name, description } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }

  const roomId = `grp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, livekit_room`,
    [req.user.orgId, name.trim(), description || null, roomId, req.user.sub]
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
