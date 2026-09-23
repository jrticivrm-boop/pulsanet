import { query } from '../db.js';
import { loadAdminScope, listScopeUnitIds } from './orgUnits.js';
import { isRoot, isDispatch, normalizeRole } from './roles.js';
import { notifyUserDevices } from './fcm.js';

const ADMIN_ROLES = ['root', 'region_admin', 'zone_admin', 'unit_admin', 'admin'];

/**
 * ¿Puede publicar avisos? root siempre; resto según perfil.modules.avisos.agregar
 * (si el módulo no existe en JSON, admins de consola = sí por defecto).
 */
export async function canPublishAnnouncements(user) {
  if (!user?.sub || !user?.orgId) return false;
  const role = normalizeRole(user.role);
  if (isRoot(role)) return true;
  if (!isDispatch(role)) return false;

  const { rows } = await query(
    `SELECT p.modules
     FROM users u
     LEFT JOIN access_profiles p ON p.id = u.profile_id
     WHERE u.id = $1 AND u.organization_id = $2`,
    [user.sub, user.orgId]
  );
  const modules = rows[0]?.modules || {};
  const avisos = modules.avisos;
  if (avisos && typeof avisos === 'object') {
    return Boolean(avisos.agregar || avisos.ver);
  }
  return true;
}

function parseScopeIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

function audienceLabel(audience, includeAdmins) {
  const base =
    audience === 'org'
      ? 'Toda la organización'
      : audience === 'zone'
        ? 'Zona(s) seleccionada(s)'
        : audience === 'unit'
          ? 'Unidad(es) seleccionada(s)'
          : audience === 'admins'
            ? 'Administradores'
            : 'Alcance';
  if (includeAdmins && audience !== 'admins') return `${base} + administradores`;
  return base;
}

/**
 * Resuelve destinatarios user ids según alcance del actor y opciones del aviso.
 */
export async function resolveAnnouncementRecipients({
  orgId,
  actor,
  audience,
  scopeUnitIds = [],
  includeAdmins = false,
}) {
  const scope = await loadAdminScope(actor);
  const ids = parseScopeIds(scopeUnitIds);
  const aud = String(audience || 'org').trim();

  if ((aud === 'zone' || aud === 'unit') && !ids.length) {
    const err = new Error('Selecciona al menos una zona o unidad');
    err.status = 400;
    throw err;
  }
  if ((aud === 'zone' || aud === 'unit') && !scope.orgWide) {
    const allowed = new Set(scope.unitIds || []);
    for (const id of ids) {
      if (!allowed.has(id)) {
        const err = new Error('Hay destinos fuera de tu alcance');
        err.status = 403;
        throw err;
      }
    }
  }

  let userRows = [];

  if (aud === 'org') {
    if (scope.orgWide) {
      const { rows } = await query(
        `SELECT id FROM users WHERE organization_id = $1 AND is_active = TRUE`,
        [orgId]
      );
      userRows = rows;
    } else {
      const unitList = scope.unitIds || [];
      if (!unitList.length) {
        const err = new Error('Sin alcance para enviar avisos');
        err.status = 403;
        throw err;
      }
      const { rows } = await query(
        `SELECT id FROM users
         WHERE organization_id = $1 AND is_active = TRUE
           AND (
             unit_id = ANY($2::uuid[])
             OR admin_scope_unit_id = ANY($2::uuid[])
           )`,
        [orgId, unitList]
      );
      userRows = rows;
    }
  } else if (aud === 'admins') {
    if (scope.orgWide) {
      const { rows } = await query(
        `SELECT id FROM users
         WHERE organization_id = $1 AND is_active = TRUE
           AND role::text = ANY($2::text[])`,
        [orgId, ADMIN_ROLES]
      );
      userRows = rows;
    } else {
      const unitList = scope.unitIds || [];
      if (!unitList.length) return [];
      const { rows } = await query(
        `SELECT id FROM users
         WHERE organization_id = $1 AND is_active = TRUE
           AND role::text = ANY($2::text[])
           AND (
             unit_id = ANY($3::uuid[])
             OR admin_scope_unit_id = ANY($3::uuid[])
           )`,
        [orgId, ADMIN_ROLES, unitList]
      );
      userRows = rows;
    }
  } else if (aud === 'zone' || aud === 'unit') {
    const expanded = new Set();
    for (const id of ids) {
      const tree = await listScopeUnitIds(orgId, id);
      for (const tid of tree) expanded.add(tid);
      expanded.add(id);
    }
    const unitList = [...expanded];
    if (!unitList.length) return [];
    const { rows } = await query(
      `SELECT id FROM users
       WHERE organization_id = $1 AND is_active = TRUE
         AND (
           unit_id = ANY($2::uuid[])
           OR admin_scope_unit_id = ANY($2::uuid[])
         )`,
      [orgId, unitList]
    );
    userRows = rows;
  } else {
    const err = new Error('Audiencia no válida');
    err.status = 400;
    throw err;
  }

  const recipientIds = new Set(userRows.map((r) => r.id));

  if (includeAdmins && aud !== 'admins') {
    let adminRows = [];
    if (scope.orgWide && aud === 'org') {
      const { rows } = await query(
        `SELECT id FROM users
         WHERE organization_id = $1 AND is_active = TRUE
           AND role::text = ANY($2::text[])`,
        [orgId, ADMIN_ROLES]
      );
      adminRows = rows;
    } else {
      const unitFilter =
        aud === 'org' ? scope.unitIds || [] : ids;
      const expanded = new Set();
      for (const id of unitFilter) {
        const tree = await listScopeUnitIds(orgId, id);
        for (const tid of tree) expanded.add(tid);
        expanded.add(id);
      }
      const list = [...expanded];
      if (list.length) {
        const { rows } = await query(
          `SELECT id FROM users
           WHERE organization_id = $1 AND is_active = TRUE
             AND role::text = ANY($2::text[])
             AND (
               unit_id = ANY($3::uuid[])
               OR admin_scope_unit_id = ANY($3::uuid[])
             )`,
          [orgId, ADMIN_ROLES, list]
        );
        adminRows = rows;
      }
    }
    for (const r of adminRows) recipientIds.add(r.id);
  }

  if (actor?.sub) recipientIds.add(actor.sub);
  return [...recipientIds];
}

export async function createAnnouncement({
  orgId,
  actor,
  body,
  audience,
  scopeUnitIds,
  includeAdmins,
  io,
}) {
  const text = String(body || '').trim();
  if (!text || text.length > 2000) {
    const err = new Error(text ? 'El aviso supera 2000 caracteres' : 'Escribe el texto del aviso');
    err.status = 400;
    throw err;
  }

  const allowed = await canPublishAnnouncements(actor);
  if (!allowed) {
    const err = new Error('Sin permiso para enviar avisos');
    err.status = 403;
    throw err;
  }

  const recipientIds = await resolveAnnouncementRecipients({
    orgId,
    actor,
    audience,
    scopeUnitIds,
    includeAdmins: Boolean(includeAdmins),
  });

  if (!recipientIds.length) {
    const err = new Error('No hay destinatarios en ese alcance');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `INSERT INTO announcements (
       organization_id, created_by, body, audience, scope_unit_ids, include_admins
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, organization_id, created_by, body, audience, scope_unit_ids,
               include_admins, created_at`,
    [
      orgId,
      actor.sub,
      text,
      String(audience || 'org'),
      JSON.stringify(parseScopeIds(scopeUnitIds)),
      Boolean(includeAdmins),
    ]
  );
  const ann = rows[0];

  // Destinatarios persistidos (login / pending exacto)
  const chunk = 200;
  for (let i = 0; i < recipientIds.length; i += chunk) {
    const slice = recipientIds.slice(i, i + chunk);
    const values = slice.map((_, j) => `($1, $${j + 2})`).join(',');
    await query(
      `INSERT INTO announcement_recipients (announcement_id, user_id)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [ann.id, ...slice]
    );
  }

  const payload = {
    id: ann.id,
    body: ann.body,
    audience: ann.audience,
    audienceLabel: audienceLabel(ann.audience, ann.include_admins),
    createdAt: ann.created_at,
    createdBy: actor.displayName || actor.username || 'Administración',
  };

  for (const uid of recipientIds) {
    try {
      if (io) io.to(`user:${uid}`).emit('announcement:alert', payload);
    } catch {
      /* ignore */
    }
    try {
      await notifyUserDevices({
        userId: uid,
        title: 'AVISO',
        body: text.slice(0, 180),
        data: {
          type: 'announcement',
          announcementId: ann.id,
          title: 'AVISO',
          body: text.slice(0, 180),
        },
      });
    } catch {
      /* ignore push failures */
    }
  }

  return {
    announcement: payload,
    recipientCount: recipientIds.length,
  };
}

export async function listAnnouncements(orgId, { limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT a.id, a.body, a.audience, a.scope_unit_ids, a.include_admins, a.created_at,
            u.display_name AS created_by_name, u.username AS created_by_username,
            (SELECT COUNT(*)::int FROM announcement_acks ack WHERE ack.announcement_id = a.id) AS ack_count
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.organization_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [orgId, Math.min(100, Math.max(1, limit))]
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    audience: r.audience,
    audienceLabel: audienceLabel(r.audience, r.include_admins),
    scopeUnitIds: r.scope_unit_ids || [],
    includeAdmins: Boolean(r.include_admins),
    createdAt: r.created_at,
    createdByName: r.created_by_name || r.created_by_username || 'Administración',
    ackCount: r.ack_count || 0,
  }));
}

/** Avisos pendientes de Enterado para un usuario (login / sync). */
export async function listPendingAnnouncements(userId, orgId) {
  const { rows } = await query(
    `SELECT a.id, a.body, a.audience, a.include_admins, a.created_at,
            u.display_name AS created_by_name
     FROM announcement_recipients r
     INNER JOIN announcements a ON a.id = r.announcement_id
     LEFT JOIN users u ON u.id = a.created_by
     WHERE r.user_id = $1
       AND a.organization_id = $2
       AND a.created_at > NOW() - INTERVAL '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM announcement_acks ack
         WHERE ack.announcement_id = a.id AND ack.user_id = $1
       )
     ORDER BY a.created_at ASC
     LIMIT 20`,
    [userId, orgId]
  );

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    audience: r.audience,
    audienceLabel: audienceLabel(r.audience, r.include_admins),
    createdAt: r.created_at,
    createdBy: r.created_by_name || 'Administración',
  }));
}

export async function ackAnnouncement(announcementId, userId, orgId) {
  const { rows } = await query(
    `SELECT id FROM announcements WHERE id = $1 AND organization_id = $2`,
    [announcementId, orgId]
  );
  if (!rows[0]) {
    const err = new Error('Aviso no encontrado');
    err.status = 404;
    throw err;
  }
  await query(
    `INSERT INTO announcement_acks (announcement_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [announcementId, userId]
  );
  return { ok: true };
}
