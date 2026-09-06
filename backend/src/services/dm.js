import { randomUUID } from 'crypto';
import { query } from '../db.js';
import {
  hydrateMessage,
  formatMessage,
  formatFreshMessage,
  loadReactionsSummary,
  normalizeEmoji,
  REACTION_NORMALIZED,
} from '../socket/chat.js';
import { openMessageBody, sealMessageBody } from './contentCrypto.js';
import { isModerator } from './roles.js';

export function dmPairKey(userA, userB) {
  return [String(userA), String(userB)].sort().join('_');
}

export function dmSocketRoom(userA, userB) {
  return `dm:${dmPairKey(userA, userB)}`;
}

export function privateCallRoom(userA, userB, mode = 'call', callId = null) {
  const m = String(mode || 'call').toLowerCase();
  const prefix = m === 'radio' ? 'radio' : m === 'video' ? 'video' : 'call';
  const pair = dmPairKey(userA, userB);
  // Sala única por llamada: evita colisión de publishers/E2EE entre sesiones.
  const idPart = callId
    ? `_${String(callId).replace(/-/g, '').slice(0, 16)}`
    : '';
  return `${prefix}_${pair}${idPart}`;
}

export async function assertSameOrgPeer(orgId, userId, peerId) {
  if (!peerId || peerId === userId) return null;
  const { rows } = await query(
    `SELECT id, username, email, display_name, role, is_active
     FROM users
     WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
    [peerId, orgId]
  );
  return rows[0] || null;
}

export async function listOrgContacts(orgId, excludeUserId) {
  const { rows } = await query(
    `SELECT id, username, email, display_name, role, last_seen_at, avatar_url
     FROM users
     WHERE organization_id = $1 AND is_active = TRUE AND id <> $2
     ORDER BY display_name`,
    [orgId, excludeUserId]
  );
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.display_name,
    role: u.role,
    lastSeenAt: u.last_seen_at,
    avatarUrl: u.avatar_url
      ? `/api/avatars/file/${encodeURIComponent(u.avatar_url)}`
      : null,
  }));
}

export async function listDmConversations(userId) {
  const { rows } = await query(
    `WITH latest AS (
       SELECT DISTINCT ON (pair)
         id, sender_id, recipient_id, type, body, media_name, created_at, deleted_at,
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id
       FROM (
         SELECT m.*,
           LEAST(m.sender_id::text, m.recipient_id::text) || '_' ||
           GREATEST(m.sender_id::text, m.recipient_id::text) AS pair
         FROM messages m
         WHERE m.group_id IS NULL
           AND m.recipient_id IS NOT NULL
           AND (m.sender_id = $1 OR m.recipient_id = $1)
       ) t
       ORDER BY pair, created_at DESC
     )
     SELECT l.*, u.display_name AS peer_name, u.email AS peer_email, u.is_active AS peer_active,
            u.avatar_url AS peer_avatar_url
     FROM latest l
     JOIN users u ON u.id = l.peer_id
     ORDER BY l.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return rows.map((r) => ({
    peerId: r.peer_id,
    peerName: r.peer_name,
    peerEmail: r.peer_email,
    peerActive: r.peer_active,
    peerAvatarUrl: r.peer_avatar_url
      ? `/api/avatars/file/${encodeURIComponent(r.peer_avatar_url)}`
      : null,
    lastMessage: {
      id: r.id,
      type: r.deleted_at ? 'text' : r.type,
      body: r.deleted_at ? null : r.type === 'sticker' ? null : openMessageBody(r.type, r.body),
      mediaName: r.deleted_at ? null : r.media_name,
      createdAt: r.created_at,
      isDeleted: Boolean(r.deleted_at),
      mine: r.sender_id === userId,
    },
  }));
}

export async function listDmMessages(userId, peerId, { limit = 120 } = {}) {
  const lim = Math.min(Math.max(limit, 1), 200);
  // Últimos N (DESC) y luego ASC para pintar el hilo en orden cronológico.
  const { rows } = await query(
    `SELECT id, group_id, sender_id, recipient_id, type, body, media_url, media_mime, media_name, media_size,
            reply_to_id, edited_at, deleted_at, created_at
     FROM (
       SELECT id, group_id, sender_id, recipient_id, type, body, media_url, media_mime, media_name, media_size,
              reply_to_id, edited_at, deleted_at, created_at
       FROM messages
       WHERE group_id IS NULL
         AND recipient_id IS NOT NULL
         AND (
           (sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1)
         )
       ORDER BY created_at DESC
       LIMIT $3
     ) recent
     ORDER BY created_at ASC`,
    [userId, peerId, lim]
  );

  const out = [];
  for (const row of rows) {
    out.push(await hydrateDmMessage(row, userId));
  }
  return out;
}

export async function insertDmMessage({
  senderId,
  recipientId,
  body = null,
  type = 'text',
  mediaUrl = null,
  mediaMime = null,
  mediaName = null,
  mediaSize = null,
  replyToId = null,
  displayName = null,
}) {
  let safeReply = null;
  let reply = null;
  if (replyToId) {
    const { rows: replyRows } = await query(
      `SELECT m.id, m.body, m.type, m.media_name, m.deleted_at, u.display_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1 AND m.group_id IS NULL AND m.deleted_at IS NULL
         AND (
           (m.sender_id = $2 AND m.recipient_id = $3)
           OR (m.sender_id = $3 AND m.recipient_id = $2)
         )`,
      [replyToId, senderId, recipientId]
    );
    if (replyRows[0]) {
      safeReply = replyToId;
      reply = {
        id: replyRows[0].id,
        body: openMessageBody(replyRows[0].type, replyRows[0].body),
        type: replyRows[0].type,
        mediaName: replyRows[0].media_name,
        displayName: replyRows[0].display_name || 'Usuario',
        isDeleted: false,
      };
    }
  }

  const { rows } = await query(
    `INSERT INTO messages (
       group_id, sender_id, recipient_id, type, body,
       media_url, media_mime, media_name, media_size, reply_to_id
     ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, group_id, sender_id, recipient_id, type, body, media_url, media_mime, media_name, media_size,
               reply_to_id, edited_at, deleted_at, created_at`,
    [
      senderId,
      recipientId,
      type,
      sealMessageBody(type, body),
      mediaUrl,
      mediaMime,
      mediaName,
      mediaSize,
      safeReply,
    ]
  );

  let name = displayName;
  if (!name) {
    const { rows: users } = await query(`SELECT display_name FROM users WHERE id = $1`, [
      senderId,
    ]);
    name = users[0]?.display_name || 'Usuario';
  }
  const msg = formatFreshMessage(rows[0], name, reply);
  msg.recipientId = rows[0].recipient_id || null;
  msg.groupId = null;
  msg.peerCount = 1;
  return msg;
}

function canModerateDm(userId, senderId, userRole) {
  if (userId && senderId && userId === senderId) return true;
  return isModerator(userRole);
}

/** Soft-delete de un mensaje DM (ambos lo ven como eliminado). */
export async function softDeleteDmMessage({
  peerId,
  messageId,
  userId,
  userRole,
}) {
  const { rows } = await query(
    `SELECT id, sender_id, recipient_id, deleted_at
     FROM messages
     WHERE id = $1 AND group_id IS NULL AND recipient_id IS NOT NULL
       AND (
         (sender_id = $2 AND recipient_id = $3)
         OR (sender_id = $3 AND recipient_id = $2)
       )`,
    [messageId, userId, peerId]
  );
  const row = rows[0];
  if (!row) throw new Error('Mensaje no encontrado');
  if (row.deleted_at) throw new Error('Ya estaba eliminado');
  if (!canModerateDm(userId, row.sender_id, userRole)) {
    throw new Error('No puedes eliminar este mensaje');
  }

  await query(`DELETE FROM message_reactions WHERE message_id = $1`, [messageId]);
  const { rows: updated } = await query(
    `UPDATE messages
     SET deleted_at = NOW(),
         body = NULL,
         media_url = NULL,
         media_mime = NULL,
         media_name = NULL,
         media_size = NULL
     WHERE id = $1
     RETURNING id, group_id, sender_id, recipient_id, type, body, media_url, media_mime, media_name, media_size,
               reply_to_id, edited_at, deleted_at, created_at`,
    [messageId]
  );
  return hydrateDmMessage(updated[0], userId);
}

/** Vacía el hilo DM (borra mensajes + reacciones/lecturas). */
export async function clearDmThread(userId, peerId) {
  const { rows: ids } = await query(
    `SELECT id FROM messages
     WHERE group_id IS NULL AND recipient_id IS NOT NULL
       AND (
         (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
       )`,
    [userId, peerId]
  );
  if (!ids.length) return 0;
  const list = ids.map((r) => r.id);
  await query(`DELETE FROM message_reactions WHERE message_id = ANY($1::uuid[])`, [list]);
  await query(`DELETE FROM message_reads WHERE message_id = ANY($1::uuid[])`, [list]);
  const { rowCount } = await query(
    `DELETE FROM messages
     WHERE group_id IS NULL AND recipient_id IS NOT NULL
       AND (
         (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
       )`,
    [userId, peerId]
  );
  return rowCount || 0;
}

/** Toggle reacción en mensaje DM. */
export async function toggleDmReaction({ peerId, messageId, userId, emoji }) {
  const canonical = REACTION_NORMALIZED.get(normalizeEmoji(emoji));
  if (!canonical) throw new Error('Reacción no permitida');

  const { rows } = await query(
    `SELECT id, deleted_at
     FROM messages
     WHERE id = $1 AND group_id IS NULL AND recipient_id IS NOT NULL
       AND (
         (sender_id = $2 AND recipient_id = $3)
         OR (sender_id = $3 AND recipient_id = $2)
       )`,
    [messageId, userId, peerId]
  );
  const row = rows[0];
  if (!row) throw new Error('Mensaje no encontrado');
  if (row.deleted_at) throw new Error('El mensaje está eliminado');

  const { rows: existing } = await query(
    `SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId]
  );

  if (existing[0] && normalizeEmoji(existing[0].emoji) === normalizeEmoji(canonical)) {
    await query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, [
      messageId,
      userId,
    ]);
  } else {
    await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()`,
      [messageId, userId, canonical]
    );
  }

  const reactions = await loadReactionsSummary([messageId], userId);
  return {
    peerId,
    messageId,
    reactions: reactions.get(messageId) || [],
  };
}

export async function hydrateDmMessage(row, viewerUserId = null) {
  const { rows: users } = await query(`SELECT display_name FROM users WHERE id = $1`, [
    row.sender_id,
  ]);
  let reply = null;
  if (row.reply_to_id) {
    const { rows: rr } = await query(
      `SELECT m.id, m.body, m.type, m.media_name, m.deleted_at, u.display_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [row.reply_to_id]
    );
    if (rr[0]) {
      reply = {
        id: rr[0].id,
        body: rr[0].deleted_at ? null : openMessageBody(rr[0].type, rr[0].body),
        type: rr[0].type,
        mediaName: rr[0].deleted_at ? null : rr[0].media_name,
        displayName: rr[0].display_name || 'Usuario',
        isDeleted: Boolean(rr[0].deleted_at),
      };
    }
  }
  const msg = formatMessage(row, users[0]?.display_name || 'Usuario', reply);
  msg.recipientId = row.recipient_id || null;
  msg.groupId = null;
  if (!msg.isDeleted) {
    const map = await loadReactionsSummary([row.id], viewerUserId);
    msg.reactions = map.get(row.id) || [];
    // DM: un solo peer
    const { rows: reads } = await query(
      `SELECT COUNT(*)::int AS c FROM message_reads
       WHERE message_id = $1 AND user_id IS DISTINCT FROM $2`,
      [row.id, row.sender_id]
    );
    msg.readCount = reads[0]?.c || 0;
    msg.peerCount = 1;
    msg.readFully = msg.readCount >= 1;
  }
  return msg;
}

/** Llamadas privadas en memoria (activas) */
const activeCalls = new Map();

function computeCallOutcome(call, { reason = 'hangup', endedBy = null } = {}) {
  const answered = Boolean(call.answeredAt);
  const r = String(reason || '').toLowerCase();
  if (r === 'timeout' || r === 'no_answer') return 'missed';
  if (r === 'reject') {
    if (answered) return 'completed';
    if (endedBy && endedBy === call.targetId) return 'rejected';
    return 'missed';
  }
  if (!answered) {
    if (endedBy && endedBy === call.callerId) return 'cancelled';
    return 'missed';
  }
  return 'completed';
}

export function createPrivateCall({
  callerId,
  callerName,
  targetId,
  targetName,
  room = null,
  mode = 'call',
  intent = null,
  orgId = null,
}) {
  const id = randomUUID();
  const normalized = String(mode || 'call').toLowerCase();
  const callMode = normalized === 'radio' ? 'radio' : normalized === 'video' ? 'video' : 'call';
  const intentNorm = String(intent || '').toLowerCase() === 'remote_camera' ? 'remote_camera' : null;
  const roomName = room || privateCallRoom(callerId, targetId, callMode, id);
  const call = {
    id,
    orgId,
    callerId,
    callerName,
    targetId,
    targetName,
    room: roomName,
    mode: callMode,
    intent: intentNorm,
    withVideo: callMode === 'video',
    videoRequest: null,
    status: 'ringing',
    createdAt: Date.now(),
    answeredAt: null,
    lastSeenAt: {},
  };
  activeCalls.set(id, call);
  touchPrivateCall(id, callerId);
  for (const [cid, c] of activeCalls) {
    if (Date.now() - c.createdAt > 10 * 60 * 1000) activeCalls.delete(cid);
  }
  return call;
}

export function touchPrivateCall(id, userId) {
  const c = activeCalls.get(id);
  if (!c || !userId) return null;
  if (!c.lastSeenAt) c.lastSeenAt = {};
  c.lastSeenAt[userId] = Date.now();
  return c;
}

export function getPrivateCall(id) {
  return activeCalls.get(id) || null;
}

/** Snapshot de llamadas en memoria (sweeper / diagnóstico). */
export function listActivePrivateCalls() {
  return [...activeCalls.values()];
}

/** Llamada activa (ringing/answered) que involucra a alguno de los usuarios. */
export function findBusyPrivateCallForUsers(...userIds) {
  const ids = new Set(userIds.map((u) => String(u || '')).filter(Boolean));
  if (!ids.size) return null;
  for (const c of activeCalls.values()) {
    if (!c || c.status === 'ended') continue;
    if (ids.has(String(c.callerId)) || ids.has(String(c.targetId))) return c;
  }
  return null;
}

export function updatePrivateCall(id, patch) {
  const c = activeCalls.get(id);
  if (!c) return null;
  Object.assign(c, patch);
  return c;
}

export function endPrivateCall(id, { reason = 'hangup', endedBy = null } = {}) {
  const c = activeCalls.get(id);
  if (!c) return null;
  c.status = 'ended';
  activeCalls.delete(id);
  return { call: c, reason, endedBy };
}

export async function persistPrivateCallLog({ call, reason = 'hangup', endedBy = null }) {
  if (!call?.id || !call.callerId || !call.targetId) return null;
  const endedAt = new Date();
  const startedAt = new Date(call.createdAt || Date.now());
  const answeredAt = call.answeredAt ? new Date(call.answeredAt) : null;
  const outcome = computeCallOutcome(call, { reason, endedBy });
  let durationSec = null;
  if (answeredAt) {
    durationSec = Math.max(0, Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000));
  }
  const orgId = call.orgId;
  if (!orgId) return { outcome, durationSec };
  try {
    await query(
      `INSERT INTO private_call_logs (
         id, organization_id, caller_id, target_id, mode, outcome, reason,
         started_at, answered_at, ended_at, duration_sec
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         outcome = EXCLUDED.outcome,
         reason = EXCLUDED.reason,
         answered_at = COALESCE(private_call_logs.answered_at, EXCLUDED.answered_at),
         ended_at = EXCLUDED.ended_at,
         duration_sec = EXCLUDED.duration_sec`,
      [
        call.id,
        orgId,
        call.callerId,
        call.targetId,
        call.mode || 'call',
        outcome,
        reason || null,
        startedAt,
        answeredAt,
        endedAt,
        durationSec,
      ]
    );
  } catch (e) {
    console.error('[calls] persist log failed:', e.message);
  }
  return { outcome, durationSec };
}

export async function listPrivateCallHistory(userId, orgId, { limit = 80, peerId = null, missedOnly = false } = {}) {
  if (!userId || !orgId) return [];
  const lim = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const params = [userId, orgId];
  let peerFilter = '';
  if (peerId) {
    params.push(peerId);
    peerFilter = ` AND (l.caller_id = $3 OR l.target_id = $3)`;
  }
  const missedFilter = missedOnly ? ` AND l.outcome IN ('missed', 'rejected')` : '';
  const { rows } = await query(
    `SELECT l.id, l.caller_id, l.target_id, l.mode, l.outcome, l.reason,
            l.started_at, l.answered_at, l.ended_at, l.duration_sec,
            CASE WHEN l.caller_id = $1 THEN l.target_id ELSE l.caller_id END AS peer_id,
            CASE WHEN l.caller_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
            u.display_name AS peer_name,
            u.avatar_url AS peer_avatar_url
     FROM private_call_logs l
     JOIN users u ON u.id = CASE WHEN l.caller_id = $1 THEN l.target_id ELSE l.caller_id END
     WHERE l.organization_id = $2
       AND (l.caller_id = $1 OR l.target_id = $1)
       ${peerFilter}
       ${missedFilter}
     ORDER BY l.ended_at DESC
     LIMIT ${lim}`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    peerId: r.peer_id,
    peerName: r.peer_name,
    peerAvatarUrl: r.peer_avatar_url
      ? `/api/avatars/file/${encodeURIComponent(r.peer_avatar_url)}`
      : null,
    direction: r.direction,
    mode: r.mode || 'call',
    outcome: r.outcome || 'completed',
    reason: r.reason,
    startedAt: r.started_at,
    answeredAt: r.answered_at,
    endedAt: r.ended_at,
    durationSec: r.duration_sec,
  }));
}
