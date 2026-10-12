import { query } from '../db.js';
import { notifyUserIdsAlert } from './fcm.js';
import { insertGroupMessage } from '../socket/chat.js';
import { emitWireToUserIds } from '../socket/dispatch.js';
import { logActivity } from './activity.js';
import { isDispatch } from './roles.js';
import { listVisibleGroups, loadTrackScope, unitInTrackScope, getUserUnitId } from './orgUnits.js';

const MAX_NOTE_LEN = 280;

function formatPanic(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    displayName: row.display_name || row.user_display_name || 'Usuario',
    groupId: row.group_id || null,
    groupName: row.group_name || null,
    status: row.status,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    accuracyM: row.accuracy_m != null ? Number(row.accuracy_m) : null,
    note: row.note || null,
    ackedBy: row.acked_by || null,
    ackedAt: row.acked_at || null,
    resolvedAt: row.resolved_at || null,
    createdAt: row.created_at,
  };
}

/**
 * Consola de despacho: solo sockets de miembros del grupo (sala user:{id}).
 * Wire se sella por clave de cada socket (mint en dispatch:join).
 */
export async function emitPanicToGroupMembers(io, eventName, payload, groupId) {
  if (!io || !groupId || !eventName) return;
  const { rows } = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId]
  );
  const userIds = rows.map((r) => r.user_id);
  const extra = await scopedDispatcherIds(payload?.organizationId, payload?.userId);
  await emitWireToUserIds(io, eventName, payload, [...new Set([...userIds, ...extra])]);
}

/** Administradores de despacho activos cuyo alcance de seguimiento cubre al usuario `senderId`. */
export async function scopedDispatcherIds(orgId, senderId) {
  if (!orgId || !senderId) return [];
  const { rows } = await query(
    `SELECT id, role FROM users WHERE organization_id = $1 AND is_active = TRUE AND id <> $2`,
    [orgId, senderId]
  );
  const admins = rows.filter((r) => isDispatch(r.role));
  if (!admins.length) return [];
  const senderUnit = await getUserUnitId(senderId);
  const checks = await Promise.all(
    admins.map(async (a) => {
      try {
        const scope = await loadTrackScope({ sub: a.id, orgId, role: a.role });
        return unitInTrackScope(scope, senderUnit) ? a.id : null;
      } catch {
        return null;
      }
    })
  );
  return checks.filter(Boolean);
}

/**
 * Canales destino de la alerta, validados contra los canales visibles del usuario.
 * `target === 'all'` (solo despacho) = todos sus canales visibles.
 */
async function resolvePanicTargets({ orgId, userId, groupId, groupIds, target }) {
  const visible = await listVisibleGroups({ sub: userId, orgId });
  const visibleById = new Map(visible.filter((g) => g.is_active !== false).map((g) => [g.id, g]));

  if (target === 'all') {
    const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (!isDispatch(rows[0]?.role)) throw new Error('Solo administración puede alertar a todos');
    const all = [...visibleById.values()];
    if (!all.length) throw new Error('Sin canales disponibles');
    return all;
  }

  const wanted = [
    ...new Set(
      [...(Array.isArray(groupIds) ? groupIds : []), groupId]
        .filter((x) => typeof x === 'string' && x)
    ),
  ];
  if (!wanted.length) throw new Error('groupId requerido');
  const out = [];
  for (const id of wanted) {
    const g = visibleById.get(id);
    if (!g) throw new Error('No eres miembro de este grupo');
    out.push(g);
  }
  return out;
}

export async function triggerPanic({
  io,
  orgId,
  userId,
  displayName,
  groupId,
  groupIds,
  target,
  latitude,
  longitude,
  accuracyM,
  note,
}) {
  const targets = await resolvePanicTargets({ orgId, userId, groupId, groupIds, target });
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LEN) || null : null;

  // Coordenadas: body o última ubicación conocida
  let lat = latitude != null ? Number(latitude) : null;
  let lng = longitude != null ? Number(longitude) : null;
  let acc = accuracyM != null ? Number(accuracyM) : null;

  if (lat == null || lng == null) {
    const { rows: loc } = await query(
      `SELECT latitude, longitude, accuracy_m FROM locations
       WHERE user_id = $1
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId]
    );
    if (loc[0]) {
      lat = Number(loc[0].latitude);
      lng = Number(loc[0].longitude);
      acc = loc[0].accuracy_m != null ? Number(loc[0].accuracy_m) : null;
    }
  }

  const targetList = targets.map((g) => ({ id: g.id, name: g.name || null }));
  const sender = displayName || 'Usuario';
  const events = [];
  const messages = [];

  // Un evento por canal: cada canal atiende / cierra su alerta por separado.
  for (const g of targets) {
    const { rows } = await query(
      `INSERT INTO panic_events (
         organization_id, user_id, group_id, latitude, longitude, accuracy_m, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, userId, g.id, lat, lng, acc, cleanNote]
    );
    const event = {
      ...formatPanic({ ...rows[0], display_name: displayName, group_name: g.name || null }),
      targets: targetList,
    };
    events.push(event);

    try {
      const msg = await insertGroupMessage({
        groupId: g.id,
        senderId: userId,
        type: 'system',
        body: `🚨 ALERTA — ${sender}${cleanNote ? ` — ${cleanNote}` : ''}`,
      });
      messages.push(msg);
      io.to(`group:${g.id}`).emit('chat:message', msg);
    } catch (err) {
      console.warn('panic system message:', err.message);
    }
  }

  // Cada destinatario recibe UNA sola alerta (la del primer canal destino que comparte).
  const eventByUser = new Map();
  const { rows: memberRows } = await query(
    `SELECT group_id, user_id FROM group_members WHERE group_id = ANY($1::uuid[])`,
    [targets.map((g) => g.id)]
  );
  for (const ev of events) {
    for (const r of memberRows) {
      if (r.group_id === ev.groupId && !eventByUser.has(r.user_id)) eventByUser.set(r.user_id, ev);
    }
  }
  const dispatchers = await scopedDispatcherIds(orgId, userId);
  for (const id of dispatchers) {
    if (!eventByUser.has(id)) eventByUser.set(id, events[0]);
  }

  const usersByEvent = new Map(events.map((ev) => [ev.id, []]));
  for (const [uid, ev] of eventByUser) usersByEvent.get(ev.id).push(uid);

  const title = '🚨 ALERTA';
  for (const ev of events) {
    const uids = usersByEvent.get(ev.id);
    if (!uids.length) continue;
    for (const uid of uids) io.to(`user:${uid}`).emit('panic:alert', ev);
    await emitWireToUserIds(io, 'dispatch:panic', ev, uids);

    const pushUids = uids.filter((id) => id !== userId);
    if (!pushUids.length) continue;
    const body = `${sender} — ${ev.groupName || 'canal'}${cleanNote ? ` — ${cleanNote}` : ''}`;
    notifyUserIdsAlert({
      userIds: pushUids,
      title,
      body,
      collapse: `panic:${ev.id}`,
      data: {
        type: 'panic',
        panicId: ev.id,
        groupId: ev.groupId,
        userId,
        displayName: sender,
        ...(cleanNote ? { note: cleanNote } : {}),
        ...(lat != null ? { latitude: String(lat) } : {}),
        ...(lng != null ? { longitude: String(lng) } : {}),
        ...(acc != null ? { accuracyM: String(acc) } : {}),
      },
    }).catch(() => {});
  }

  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'panic.trigger',
    entityType: 'panic_event',
    entityId: events[0].id,
    meta: {
      groupIds: targetList.map((t) => t.id),
      target: target === 'all' ? 'all' : 'groups',
      latitude: lat,
      longitude: lng,
    },
  }).catch(() => {});

  return { event: events[0], events, systemMsg: messages[0] || null };
}

/** Despacho con alcance de seguimiento sobre quien envió la alerta (orgWide o lista de unidades). */
async function viewerDispatchScope(orgId, viewerId) {
  const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [viewerId]);
  if (!isDispatch(rows[0]?.role)) return { orgWide: false, unitIds: [] };
  const scope = await loadTrackScope({ sub: viewerId, orgId, role: rows[0].role });
  return { orgWide: Boolean(scope.orgWide), unitIds: scope.unitIds || [] };
}

const VIEWER_FILTER_SQL = (viewerIdx, orgWideIdx, unitIdsIdx) => `(
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = p.group_id AND gm.user_id = $${viewerIdx}
  )
  OR $${orgWideIdx}::boolean
  OR u.unit_id = ANY($${unitIdsIdx}::uuid[])
)`;

/** ¿Puede ver / atender la alerta? Miembro del canal o despacho con alcance sobre el emisor. */
export async function canViewerActOnPanic({ orgId, viewerId, panicId }) {
  const scope = await viewerDispatchScope(orgId, viewerId);
  const { rows } = await query(
    `SELECT 1 FROM panic_events p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND p.organization_id = $2
       AND ${VIEWER_FILTER_SQL(3, 4, 5)}`,
    [panicId, orgId, viewerId, scope.orgWide, scope.unitIds]
  );
  return Boolean(rows[0]);
}

/** Eventos de canales donde el viewer es miembro, o de emisores dentro de su alcance de despacho. */
export async function listPanicEvents({ orgId, viewerId, status, limit = 50 }) {
  const lim = Math.min(Number(limit) || 50, 100);
  const scope = await viewerDispatchScope(orgId, viewerId);
  const params = [orgId, viewerId, scope.orgWide, scope.unitIds];
  let filter = '';
  if (status) {
    params.push(status);
    filter = ` AND p.status = $${params.length}`;
  }
  params.push(lim);
  const { rows } = await query(
    `SELECT p.*, u.display_name, g.name AS group_name
     FROM panic_events p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN groups g ON g.id = p.group_id
     WHERE p.organization_id = $1
       AND ${VIEWER_FILTER_SQL(2, 3, 4)}${filter}
     ORDER BY p.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(formatPanic);
}

export async function getPanicEvent({ orgId, viewerId, panicId }) {
  const scope = await viewerDispatchScope(orgId, viewerId);
  const { rows } = await query(
    `SELECT p.*, u.display_name, g.name AS group_name
     FROM panic_events p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN groups g ON g.id = p.group_id
     WHERE p.id = $1
       AND p.organization_id = $2
       AND ${VIEWER_FILTER_SQL(3, 4, 5)}`,
    [panicId, orgId, viewerId, scope.orgWide, scope.unitIds]
  );
  if (!rows[0]) return null;
  return formatPanic(rows[0]);
}

export async function updatePanicStatus({
  orgId,
  panicId,
  actorId,
  status,
}) {
  if (!['acked', 'resolved', 'cancelled'].includes(status)) {
    throw new Error('Estado inválido');
  }

  const { rows: cur } = await query(
    `SELECT * FROM panic_events WHERE id = $1 AND organization_id = $2`,
    [panicId, orgId]
  );
  if (!cur[0]) throw new Error('Alerta no encontrada');

  let sql;
  let params;
  if (status === 'acked') {
    sql = `UPDATE panic_events
           SET status = 'acked', acked_by = $3, acked_at = NOW()
           WHERE id = $1 AND organization_id = $2
           RETURNING *`;
    params = [panicId, orgId, actorId];
  } else if (status === 'resolved') {
    sql = `UPDATE panic_events
           SET status = 'resolved',
               resolved_at = NOW(),
               acked_by = COALESCE(acked_by, $3),
               acked_at = COALESCE(acked_at, NOW())
           WHERE id = $1 AND organization_id = $2
           RETURNING *`;
    params = [panicId, orgId, actorId];
  } else {
    sql = `UPDATE panic_events
           SET status = 'cancelled', resolved_at = NOW()
           WHERE id = $1 AND organization_id = $2
           RETURNING *`;
    params = [panicId, orgId];
  }

  const { rows } = await query(sql, params);
  const { rows: u } = await query(`SELECT display_name FROM users WHERE id = $1`, [
    rows[0].user_id,
  ]);
  const { rows: g } = await query(`SELECT name FROM groups WHERE id = $1`, [
    rows[0].group_id,
  ]);
  return formatPanic({
    ...rows[0],
    display_name: u[0]?.display_name,
    group_name: g[0]?.name,
  });
}

export { formatPanic };
