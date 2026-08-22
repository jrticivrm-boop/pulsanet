import { query } from '../db.js';
import { assertGroupMember } from './presence.js';
import { notifyGroupMembers, notifyUserDevices } from './fcm.js';
import { insertGroupMessage } from '../socket/chat.js';
import { emitDispatch } from '../socket/dispatch.js';
import { logActivity } from './activity.js';

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
 * Destinatarios extra: admin/dispatcher org + usuarios con can_receive_panic.
 * (Los miembros del grupo se notifican aparte con notifyGroupMembers.)
 */
export async function listPanicEscalationUserIds(organizationId, excludeUserId) {
  const { rows } = await query(
    `SELECT id FROM users
     WHERE organization_id = $1
       AND is_active = TRUE
       AND id <> $2
       AND (
         role IN ('root', 'admin', 'dispatcher')
         OR can_receive_panic = TRUE
       )`,
    [organizationId, excludeUserId]
  );
  return rows.map((r) => r.id);
}

export async function triggerPanic({
  io,
  orgId,
  userId,
  displayName,
  groupId,
  latitude,
  longitude,
  accuracyM,
  note,
}) {
  if (!groupId) throw new Error('groupId requerido');

  const ok = await assertGroupMember(groupId, userId);
  if (!ok) throw new Error('No eres miembro de este grupo');

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

  const { rows } = await query(
    `INSERT INTO panic_events (
       organization_id, user_id, group_id, latitude, longitude, accuracy_m, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [orgId, userId, groupId, lat, lng, acc, note?.trim() || null]
  );

  const { rows: gRows } = await query(`SELECT name FROM groups WHERE id = $1`, [groupId]);
  const event = formatPanic({
    ...rows[0],
    display_name: displayName,
    group_name: gRows[0]?.name || null,
  });

  // Mensaje de sistema en el chat del grupo
  let systemMsg = null;
  try {
    const coords =
      lat != null && lng != null ? ` · ${lat.toFixed(5)}, ${lng.toFixed(5)}` : '';
    systemMsg = await insertGroupMessage({
      groupId,
      senderId: userId,
      type: 'system',
      body: `🚨 PÁNICO — ${displayName || 'Usuario'}${coords}`,
    });
    io.to(`group:${groupId}`).emit('chat:message', systemMsg);
  } catch (err) {
    console.warn('panic system message:', err.message);
  }

  io.to(`group:${groupId}`).emit('panic:alert', event);
  emitDispatch(io, 'dispatch:panic', event);

  const title = '🚨 ALERTA DE PÁNICO';
  const body = `${displayName || 'Usuario'} — ${event.groupName || 'canal'}`;
  const data = {
    type: 'panic',
    panicId: event.id,
    groupId,
    userId,
  };

  notifyGroupMembers({
    groupId,
    excludeUserId: userId,
    title,
    body,
    data,
  }).catch(() => {});

  const escalation = await listPanicEscalationUserIds(orgId, userId);
  // Evitar doble push a quienes ya están en el grupo
  const { rows: members } = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId]
  );
  const memberSet = new Set(members.map((m) => m.user_id));
  for (const uid of escalation) {
    if (memberSet.has(uid)) continue;
    notifyUserDevices({ userId: uid, title, body, data }).catch(() => {});
  }

  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'panic.trigger',
    entityType: 'panic_event',
    entityId: event.id,
    meta: { groupId, latitude: lat, longitude: lng },
  }).catch(() => {});

  return { event, systemMsg };
}

export async function listPanicEvents({ orgId, status, limit = 50 }) {
  const lim = Math.min(Number(limit) || 50, 100);
  const params = [orgId];
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
     WHERE p.organization_id = $1${filter}
     ORDER BY p.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(formatPanic);
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
