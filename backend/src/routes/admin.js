import bcrypt from 'bcrypt';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../redis.js';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getFloor, listPresence } from '../services/presence.js';
import { logActivity } from '../services/activity.js';
import { isAdmin, isDispatch, isRoot, ORG_ROLES } from '../services/roles.js';
import { buildUsername } from '../services/rfcUsername.js';
import { generateTemporaryPassword } from '../services/tempPassword.js';

export const adminRouter = Router();
adminRouter.use(authMiddleware);

function requireDispatch(req, res, next) {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root, admin o despachador' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root o admin' });
  }
  next();
}

function requireRoot(req, res, next) {
  if (!isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo superadministrador (root)' });
  }
  next();
}

adminRouter.use(requireDispatch);

function mapUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.display_name,
    role: u.role,
    isActive: u.is_active,
    canReceivePanic: u.can_receive_panic,
    mustChangePassword: Boolean(u.must_change_password),
    lastSeenAt: u.last_seen_at,
    location:
      u.latitude != null
        ? { latitude: u.latitude, longitude: u.longitude, recordedAt: u.location_at }
        : null,
  };
}

async function isUsernameTaken(orgId, username) {
  const { rows } = await query(
    `SELECT 1 FROM users WHERE organization_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
    [orgId, username]
  );
  return Boolean(rows[0]);
}

/** Dashboard: usuarios, grupos, online y speakers activos */
adminRouter.get('/overview', async (req, res) => {
  const orgId = req.user.orgId;

  const { rows: users } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active)::int AS active
     FROM users WHERE organization_id = $1`,
    [orgId]
  );

  const { rows: groups } = await query(
    `SELECT id, name, livekit_room, is_active
     FROM groups WHERE organization_id = $1 AND is_active = TRUE
     ORDER BY name`,
    [orgId]
  );

  const channels = [];
  const onlineUserIds = new Set();

  for (const g of groups) {
    const members = await listPresence(g.id);
    const floor = await getFloor(g.id);
    members.forEach((m) => onlineUserIds.add(m.userId));
    channels.push({
      id: g.id,
      name: g.name,
      online: members,
      speaker: floor
        ? { userId: floor.userId, displayName: floor.displayName, since: floor.since }
        : null,
    });
  }

  res.json({
    ok: true,
    overview: {
      usersTotal: users[0]?.total || 0,
      usersActive: users[0]?.active || 0,
      onlineCount: onlineUserIds.size,
      groupsCount: groups.length,
      channels,
    },
  });
});

adminRouter.get('/users', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.role, u.is_active, u.can_receive_panic,
            u.must_change_password, u.last_seen_at,
            l.latitude, l.longitude, l.recorded_at AS location_at
     FROM users u
     LEFT JOIN user_last_location l ON l.user_id = u.id
     WHERE u.organization_id = $1
     ORDER BY
       CASE u.role
         WHEN 'root' THEN 0
         WHEN 'admin' THEN 1
         WHEN 'dispatcher' THEN 2
         ELSE 3
       END,
       u.display_name`,
    [req.user.orgId]
  );
  res.json({ ok: true, users: rows.map(mapUser) });
});

/** Vista previa del usuario (inicial + apellido + inicial materno + número). */
adminRouter.post('/users/preview-username', requireAdmin, async (req, res) => {
  try {
    const built = await buildUsername(req.body || {}, (candidate) =>
      isUsernameTaken(req.user.orgId, candidate)
    );
    res.json({
      ok: true,
      username: built.username,
      displayName: built.displayName,
      base: built.base,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Datos inválidos' });
  }
});

adminRouter.post('/users', requireAdmin, async (req, res) => {
  const {
    role = 'operator',
    givenNames,
    paternalSurname,
    maternalSurname,
    displayName: displayNameIn,
  } = req.body || {};

  if (!ORG_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: 'Rol inválido' });
  }
  if (role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede crear usuarios root' });
  }

  let built;
  try {
    built = await buildUsername(
      { givenNames, paternalSurname, maternalSurname },
      (candidate) => isUsernameTaken(req.user.orgId, candidate)
    );
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Datos de nombre inválidos' });
  }

  const username = built.username;
  const displayName = (displayNameIn || built.displayName).trim();
  const email = `${username}@tacticalptx.local`;
  const temporaryPassword = generateTemporaryPassword();
  const hash = await bcrypt.hash(temporaryPassword, 12);

  const rawGroupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];
  const groupIds = [...new Set(rawGroupIds.map((id) => String(id || '').trim()).filter(Boolean))];

  try {
    const { rows } = await query(
      `INSERT INTO users (
         organization_id, username, email, password_hash, display_name, role, must_change_password
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, username, email, display_name, role, is_active, can_receive_panic,
                 must_change_password, last_seen_at`,
      [req.user.orgId, username, email, hash, displayName, role]
    );
    const u = rows[0];

    const memberRole =
      role === 'root' || role === 'admin' || role === 'dispatcher' ? 'leader' : 'member';
    const assignedGroups = [];
    for (const groupId of groupIds) {
      const { rows: g } = await query(
        `SELECT id, name FROM groups
         WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
        [groupId, req.user.orgId]
      );
      if (!g[0]) continue;
      await query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [groupId, u.id, memberRole]
      );
      assignedGroups.push({ id: g[0].id, name: g[0].name, role: memberRole });
    }

    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'user.create',
      entityType: 'user',
      entityId: u.id,
      meta: {
        username: u.username,
        role: u.role,
        groups: assignedGroups.map((g) => g.id),
        mustChangePassword: true,
      },
    });
    res.status(201).json({
      ok: true,
      user: mapUser(u),
      groups: assignedGroups,
      temporaryPassword,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Usuario ya existe' });
    }
    throw err;
  }
});

adminRouter.patch('/users/:id', requireAdmin, async (req, res) => {
  const { isActive, role, displayName, canReceivePanic, password, resetPassword } = req.body || {};

  const { rows: existing } = await query(
    `SELECT id, role FROM users WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!existing[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

  if (existing[0].role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede modificar un root' });
  }
  if (role === 'root' && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede asignar rol root' });
  }
  if (role && !ORG_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: 'Rol inválido' });
  }
  if (req.params.id === req.user.sub && typeof isActive === 'boolean' && !isActive) {
    return res.status(400).json({ ok: false, error: 'No puedes desactivarte a ti mismo' });
  }

  let temporaryPassword = null;
  let passwordHash = null;
  let forceChange = false;
  if (resetPassword === true) {
    temporaryPassword = generateTemporaryPassword();
    passwordHash = await bcrypt.hash(temporaryPassword, 12);
    forceChange = true;
  } else if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password mínimo 6 caracteres' });
    }
    passwordHash = await bcrypt.hash(password, 12);
    forceChange = true;
  }

  const { rows } = await query(
    `UPDATE users SET
       is_active = COALESCE($2, is_active),
       role = COALESCE($3, role),
       display_name = COALESCE($4, display_name),
       can_receive_panic = COALESCE($5, can_receive_panic),
       password_hash = COALESCE($6, password_hash),
       must_change_password = CASE WHEN $8::boolean THEN TRUE ELSE must_change_password END,
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $7
     RETURNING id, username, email, display_name, role, is_active, can_receive_panic,
               must_change_password, last_seen_at`,
    [
      req.params.id,
      typeof isActive === 'boolean' ? isActive : null,
      role || null,
      displayName?.trim() || null,
      typeof canReceivePanic === 'boolean' ? canReceivePanic : null,
      passwordHash,
      req.user.orgId,
      forceChange,
    ]
  );
  const u = rows[0];
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: passwordHash ? 'user.reset_password' : 'user.update',
    entityType: 'user',
    entityId: u.id,
    meta: {
      isActive: u.is_active,
      role: u.role,
      displayName: u.display_name,
      canReceivePanic: u.can_receive_panic,
      passwordReset: Boolean(passwordHash),
      mustChangePassword: u.must_change_password,
    },
  });
  if (passwordHash) {
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [u.id]);
  }
  res.json({
    ok: true,
    user: mapUser(u),
    ...(temporaryPassword ? { temporaryPassword } : {}),
  });
});

/** Eliminar usuario (hard). Solo root. */
adminRouter.delete('/users/:id', requireRoot, async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ ok: false, error: 'No puedes eliminarte a ti mismo' });
  }
  const { rows } = await query(
    `DELETE FROM users WHERE id = $1 AND organization_id = $2
     RETURNING id, username, email, role`,
    [req.params.id, req.user.orgId]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'user.delete',
    entityType: 'user',
    entityId: rows[0].id,
    meta: { username: rows[0].username, role: rows[0].role },
  });
  res.json({ ok: true });
});

/** Exportación CSV de usuarios (alcance v1) */
adminRouter.get('/users.csv', async (req, res) => {
  const { rows } = await query(
    `SELECT username, email, display_name, role, is_active, last_seen_at, created_at
     FROM users WHERE organization_id = $1
     ORDER BY display_name`,
    [req.user.orgId]
  );

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = ['username,email,display_name,role,is_active,last_seen_at,created_at'];
  for (const u of rows) {
    lines.push(
      [
        esc(u.username),
        esc(u.email),
        esc(u.display_name),
        esc(u.role),
        esc(u.is_active),
        esc(u.last_seen_at?.toISOString?.() || u.last_seen_at),
        esc(u.created_at?.toISOString?.() || u.created_at),
      ].join(',')
    );
  }

  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'user.export_csv',
    entityType: 'users',
    meta: { count: rows.length },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tacticalptx-users.csv"');
  res.send(`\uFEFF${lines.join('\n')}\n`);
});

adminRouter.get('/activity', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
  const { rows } = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at,
            u.email AS actor_email, u.display_name AS actor_name
     FROM activity_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.organization_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [req.user.orgId, limit]
  );
  res.json({
    ok: true,
    activity: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: r.meta,
      createdAt: r.created_at,
      actor: r.actor_email
        ? { email: r.actor_email, displayName: r.actor_name }
        : null,
    })),
  });
});

adminRouter.get('/groups', async (req, res) => {
  const { rows } = await query(
    `SELECT g.id, g.name, g.description, g.livekit_room, g.is_active,
            (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count
     FROM groups g
     WHERE g.organization_id = $1
     ORDER BY g.name`,
    [req.user.orgId]
  );
  res.json({ ok: true, groups: rows });
});

adminRouter.post('/groups', requireAdmin, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }
  const roomId = `grp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, livekit_room, is_active`,
    [req.user.orgId, name.trim(), description || null, roomId, req.user.sub]
  );
  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [rows[0].id, req.user.sub]
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.create',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name },
  });
  res.status(201).json({ ok: true, group: rows[0] });
});

adminRouter.patch('/groups/:id', requireAdmin, async (req, res) => {
  const { name, description, isActive } = req.body || {};
  const { rows } = await query(
    `UPDATE groups SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       is_active = COALESCE($4, is_active),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $5
     RETURNING id, name, description, livekit_room, is_active`,
    [
      req.params.id,
      name?.trim() || null,
      description !== undefined ? description : null,
      typeof isActive === 'boolean' ? isActive : null,
      req.user.orgId,
    ]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.update',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name, isActive: rows[0].is_active },
  });
  res.json({ ok: true, group: rows[0] });
});

/** Soft-delete (desactivar) o hard delete (root + ?hard=1) */
adminRouter.delete('/groups/:id', requireAdmin, async (req, res) => {
  const hard = String(req.query.hard || '') === '1' || req.body?.hard === true;
  if (hard && !isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Hard delete solo root' });
  }

  if (hard) {
    const { rows } = await query(
      `DELETE FROM groups WHERE id = $1 AND organization_id = $2
       RETURNING id, name`,
      [req.params.id, req.user.orgId]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'group.delete_hard',
      entityType: 'group',
      entityId: rows[0].id,
      meta: { name: rows[0].name },
    });
    return res.json({ ok: true, hard: true });
  }

  const { rows } = await query(
    `UPDATE groups SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, name`,
    [req.params.id, req.user.orgId]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.deactivate',
    entityType: 'group',
    entityId: rows[0].id,
    meta: { name: rows[0].name },
  });
  res.json({ ok: true, hard: false });
});

adminRouter.post('/groups/:id/members', async (req, res) => {
  const { userId, role = 'member' } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'userId requerido' });

  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, userId, role]
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.member_add',
    entityType: 'group',
    entityId: req.params.id,
    meta: { userId, role },
  });
  res.status(201).json({ ok: true });
});

adminRouter.delete('/groups/:id/members/:userId', requireAdmin, async (req, res) => {
  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rowCount } = await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [req.params.id, req.params.userId]
  );
  if (!rowCount) return res.status(404).json({ ok: false, error: 'Miembro no encontrado' });
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'group.member_remove',
    entityType: 'group',
    entityId: req.params.id,
    meta: { userId: req.params.userId },
  });
  res.json({ ok: true });
});

adminRouter.get('/groups/:id/members', async (req, res) => {
  const { rows: g } = await query(
    `SELECT id FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rows } = await query(
    `SELECT u.id, u.display_name, u.username, u.email, u.role AS org_role, gm.role
     FROM group_members gm
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY u.display_name`,
    [req.params.id]
  );
  res.json({
    ok: true,
    members: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      username: r.username,
      email: r.email,
      orgRole: r.org_role,
      role: r.role,
    })),
  });
});

/** Vaciar chat del grupo (hard purge mensajes). Root o admin. */
adminRouter.post('/groups/:id/messages/purge', requireAdmin, async (req, res) => {
  const { rows: g } = await query(
    `SELECT id, name FROM groups WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!g[0]) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });

  const { rowCount } = await query(`DELETE FROM messages WHERE group_id = $1`, [req.params.id]);
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'chat.purge',
    entityType: 'group',
    entityId: req.params.id,
    meta: { name: g[0].name, deleted: rowCount },
  });
  res.json({ ok: true, deleted: rowCount });
});

/** Escaneo liviano de claves presence (demo; en prod usar índice/org set) */
adminRouter.get('/presence', async (req, res) => {
  const redis = getRedis();
  const keys = await redis.keys('presence:group:*');
  const byGroup = {};
  for (const key of keys) {
    const groupId = key.replace('presence:group:', '');
    byGroup[groupId] = await listPresence(groupId);
  }
  res.json({ ok: true, presence: byGroup });
});
