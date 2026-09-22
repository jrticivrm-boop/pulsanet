import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { canManageUsers, isRegionAdmin, isUnitAdmin, isZoneAdmin, isRoot } from '../services/roles.js';
import { groupRejectReason } from '../services/groupPolicy.js';
import { listVisibleGroups, listMemberGroups, loadAdminScope } from '../services/orgUnits.js';
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
  if (!canManageUsers(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso para crear canales' });
  }

  const { name, description, unitId: unitIdIn, scopeLevel: scopeIn, membershipLocked } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }

  const scope = await loadAdminScope(req.user);
  let unitId = unitIdIn ? String(unitIdIn).trim() : null;
  const requestedScope = ['region', 'zone', 'unit'].includes(scopeIn) ? scopeIn : null;

  async function orgUnitKind(id) {
    if (!id) return null;
    const { rows } = await query(
      `SELECT id, kind FROM org_units
       WHERE id = $1 AND organization_id = $2 AND is_active`,
      [id, req.user.orgId]
    );
    return rows[0] || null;
  }

  let scopeLevel = 'unit';

  if (isUnitAdmin(req.user.role)) {
    unitId = scope.unitId || null;
    if (!unitId) {
      return res.status(403).json({ ok: false, error: 'Admin de unidad sin unidad asignada' });
    }
    scopeLevel = 'unit';
  } else if (isZoneAdmin(req.user.role)) {
    // Admin de zona: canal de toda la zona O de una unidad de su zona.
    if (!unitId || !scope.unitIds?.includes(unitId)) {
      // También aceptar ancla = zoneId del admin
      const zoneOk = scope.zoneId && unitId === scope.zoneId;
      if (!zoneOk) {
        return res.status(400).json({
          ok: false,
          error: 'Admin de zona: elige toda tu zona o una unidad de tu zona',
        });
      }
    }
    const node = await orgUnitKind(unitId);
    if (!node || (node.kind !== 'unit' && node.kind !== 'zone')) {
      return res.status(400).json({
        ok: false,
        error: 'Admin de zona: el canal debe ser de zona o de una unidad',
      });
    }
    if (node.kind === 'zone' && scope.zoneId && node.id !== scope.zoneId) {
      return res.status(403).json({ ok: false, error: 'Zona fuera de tu alcance' });
    }
    scopeLevel = node.kind === 'zone' ? 'zone' : 'unit';
    unitId = node.id;
  } else if (isRegionAdmin(req.user.role) || isRoot(req.user.role)) {
    // Cascada explícita: unit > zone > region. Ancla en unit_id (región/zona/unidad).
    const level = requestedScope || (unitId ? 'unit' : 'region');
    if (level === 'region') {
      if (unitId) {
        const node = await orgUnitKind(unitId);
        if (!node || node.kind !== 'region') {
          return res.status(400).json({
            ok: false,
            error: 'Canal de región: el ancla debe ser una región',
          });
        }
        unitId = node.id;
      } else if (!isRoot(req.user.role)) {
        return res.status(400).json({
          ok: false,
          error: 'Canal de región: selecciona la región',
        });
      } else {
        unitId = null;
      }
      scopeLevel = 'region';
    } else if (level === 'zone') {
      const node = await orgUnitKind(unitId);
      if (!node || node.kind !== 'zone') {
        return res.status(400).json({
          ok: false,
          error: 'Canal de zona: el ancla debe ser una zona / C.G.',
        });
      }
      scopeLevel = 'zone';
      unitId = node.id;
    } else {
      const node = await orgUnitKind(unitId);
      if (!node || node.kind !== 'unit') {
        return res.status(400).json({
          ok: false,
          error: 'Canal de unidad: elige una unidad válida',
        });
      }
      scopeLevel = 'unit';
      unitId = node.id;
    }
  } else {
    return res.status(403).json({ ok: false, error: 'Sin permiso para crear canales' });
  }

  const roomId = `grp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const locked =
    Boolean(membershipLocked) &&
    scopeLevel === 'zone' &&
    (isRegionAdmin(req.user.role) || isRoot(req.user.role));
  const { rows } = await query(
    `INSERT INTO groups (organization_id, name, description, livekit_room, created_by, unit_id, scope_level, membership_locked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, livekit_room, unit_id, scope_level, membership_locked`,
    [
      req.user.orgId,
      name.trim(),
      description || null,
      roomId,
      req.user.sub,
      unitId || null,
      scopeLevel,
      locked,
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
