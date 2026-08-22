import { randomUUID } from 'crypto';
import { query } from '../db.js';
import { hydrateMessage, formatMessage, formatFreshMessage, loadReactionsSummary } from '../socket/chat.js';
import { openMessageBody, sealMessageBody } from './contentCrypto.js';

export function dmPairKey(userA, userB) {
  return [String(userA), String(userB)].sort().join('_');
}

export function dmSocketRoom(userA, userB) {
  return `dm:${dmPairKey(userA, userB)}`;
}

export function privateCallRoom(userA, userB) {
  return `call_${dmPairKey(userA, userB)}`;
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
    `SELECT id, username, email, display_name, role, last_seen_at
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
     SELECT l.*, u.display_name AS peer_name, u.email AS peer_email, u.is_active AS peer_active
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

export async function listDmMessages(userId, peerId, { limit = 80 } = {}) {
  const { rows } = await query(
    `SELECT id, group_id, sender_id, recipient_id, type, body, media_url, media_mime, media_name, media_size,
            reply_to_id, edited_at, deleted_at, created_at
     FROM messages
     WHERE group_id IS NULL
       AND recipient_id IS NOT NULL
       AND (
         (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
       )
     ORDER BY created_at ASC
     LIMIT $3`,
    [userId, peerId, Math.min(limit, 200)]
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

/** Llamadas privadas en memoria (demo / proceso) */
const activeCalls = new Map();

export function createPrivateCall({ callerId, callerName, targetId, targetName, room }) {
  const id = randomUUID();
  const call = {
    id,
    callerId,
    callerName,
    targetId,
    targetName,
    room,
    status: 'ringing',
    createdAt: Date.now(),
  };
  activeCalls.set(id, call);
  // limpia llamadas viejas (>10 min)
  for (const [cid, c] of activeCalls) {
    if (Date.now() - c.createdAt > 10 * 60 * 1000) activeCalls.delete(cid);
  }
  return call;
}

export function getPrivateCall(id) {
  return activeCalls.get(id) || null;
}

export function updatePrivateCall(id, patch) {
  const c = activeCalls.get(id);
  if (!c) return null;
  Object.assign(c, patch);
  return c;
}

export function endPrivateCall(id) {
  const c = activeCalls.get(id);
  if (c) {
    c.status = 'ended';
    activeCalls.delete(id);
  }
  return c;
}
