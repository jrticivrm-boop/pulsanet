import { query } from '../db.js';
import { assertGroupMember } from '../services/presence.js';
import { inc } from '../services/metrics.js';
import { notifyGroupMembers } from '../services/fcm.js';
import { getStickerById } from '../data/stickers.js';
import { isModerator, isRoot } from '../services/roles.js';
import { openMessageBody, sealMessageBody } from '../services/contentCrypto.js';

const MAX_BODY = 2000;

/** Set fijo de reacciones (una reacción por usuario). */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function normalizeEmoji(emoji) {
  return String(emoji || '')
    .trim()
    .replace(/\uFE0F/g, '')
    .replace(/\u200D/g, '');
}

const REACTION_NORMALIZED = new Map(
  REACTION_EMOJIS.map((e) => [normalizeEmoji(e), e])
);

export { normalizeEmoji, REACTION_NORMALIZED };

/**
 * Chat por Socket.IO: send / typing / edit / delete / react
 */
export function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.on('chat:typing', async ({ groupId, typing }) => {
      if (!groupId) return;
      try {
        const ok = await assertGroupMember(groupId, user.sub);
        if (!ok) return;
        socket.to(`group:${groupId}`).emit('chat:typing', {
          groupId,
          userId: user.sub,
          displayName: user.displayName || 'Usuario',
          typing: Boolean(typing),
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('chat:send', async ({ groupId, body, replyToId, clientMsgId }) => {
      if (!groupId || typeof body !== 'string') return;
      const text = body.trim();
      if (!text) {
        socket.emit('chat:error', { error: 'Mensaje vacío', clientMsgId });
        return;
      }
      if (text.length > MAX_BODY) {
        socket.emit('chat:error', { error: `Máximo ${MAX_BODY} caracteres`, clientMsgId });
        return;
      }

      try {
        const ok = await assertGroupMember(groupId, user.sub);
        if (!ok) {
          socket.emit('chat:error', { error: 'No eres miembro', clientMsgId });
          return;
        }

        const msg = await insertGroupMessage({
          groupId,
          senderId: user.sub,
          body: text,
          type: 'text',
          replyToId: replyToId || null,
          displayName: user.displayName,
        });
        if (clientMsgId) msg.clientMsgId = String(clientMsgId);

        inc('chatSent');
        io.to(`group:${groupId}`).emit('chat:message', msg);
        // Eco al emisor por si aún no está en la room (race de join).
        socket.emit('chat:message', msg);
        notifyGroupMembers({
          groupId,
          excludeUserId: user.sub,
          title: msg.displayName || 'TacticalPtx',
          body: text.length > 100 ? `${text.slice(0, 100)}…` : text,
          data: {
            type: 'chat',
            messageId: msg.id,
            groupId,
            title: msg.displayName || 'TacticalPtx',
            body: text.length > 100 ? `${text.slice(0, 100)}…` : text,
          },
        }).catch(() => {});
      } catch (err) {
        socket.emit('chat:error', { error: err.message, clientMsgId });
      }
    });

    socket.on('chat:edit', async ({ groupId, messageId, body }) => {
      if (!groupId || !messageId || typeof body !== 'string') return;
      try {
        const msg = await editGroupMessage({
          groupId,
          messageId,
          userId: user.sub,
          body,
          userRole: user.role,
        });
        io.to(`group:${groupId}`).emit('chat:edited', msg);
      } catch (err) {
        socket.emit('chat:error', { error: err.message });
      }
    });

    socket.on('chat:delete', async ({ groupId, messageId }) => {
      if (!groupId || !messageId) return;
      try {
        const msg = await softDeleteGroupMessage({
          groupId,
          messageId,
          userId: user.sub,
          userRole: user.role,
        });
        io.to(`group:${groupId}`).emit('chat:deleted', msg);
      } catch (err) {
        socket.emit('chat:error', { error: err.message });
      }
    });

    socket.on('chat:react', async ({ groupId, messageId, emoji }) => {
      if (!groupId || !messageId || typeof emoji !== 'string') return;
      try {
        const payload = await toggleMessageReaction({
          groupId,
          messageId,
          userId: user.sub,
          emoji,
        });
        io.to(`group:${groupId}`).emit('chat:reaction', payload);
      } catch (err) {
        socket.emit('chat:error', { error: err.message });
      }
    });

    socket.on('chat:sticker', async ({ groupId, stickerId, replyToId }) => {
      if (!groupId || !stickerId) return;
      try {
        const msg = await insertStickerMessage({
          groupId,
          senderId: user.sub,
          stickerId,
          replyToId: replyToId || null,
        });
        inc('chatSent');
        io.to(`group:${groupId}`).emit('chat:message', msg);
        notifyGroupMembers({
          groupId,
          excludeUserId: user.sub,
          title: msg.displayName || 'TacticalPtx',
          body: 'Nuevo sticker',
          data: { type: 'chat', messageId: msg.id, groupId },
        }).catch(() => {});
      } catch (err) {
        socket.emit('chat:error', { error: err.message });
      }
    });

    socket.on('chat:read', async ({ groupId, upToMessageId }) => {
      if (!groupId) return;
      try {
        const payload = await markGroupMessagesRead({
          groupId,
          userId: user.sub,
          upToMessageId: upToMessageId || null,
        });
        if (payload.updates?.length) {
          io.to(`group:${groupId}`).emit('chat:receipts', payload);
        }
      } catch {
        /* ignore */
      }
    });
  });
}

export async function insertGroupMessage({
  groupId,
  senderId,
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
       WHERE m.id = $1 AND m.group_id = $2 AND m.deleted_at IS NULL`,
      [replyToId, groupId]
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

  const sealedBody = sealMessageBody(type, body);

  const { rows } = await query(
    `INSERT INTO messages (
       group_id, sender_id, type, body, media_url, media_mime, media_name, media_size, reply_to_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, group_id, sender_id, type, body, media_url, media_mime, media_name, media_size,
               reply_to_id, edited_at, deleted_at, created_at`,
    [
      groupId,
      senderId,
      type,
      sealedBody,
      mediaUrl,
      mediaMime,
      mediaName,
      mediaSize,
      safeReply,
    ]
  );

  // Ruta rápida: mensaje recién creado no tiene reacciones ni lecturas.
  let name = displayName;
  let avatarUrl = null;
  if (!name) {
    const { rows: users } = await query(
      `SELECT display_name, avatar_url FROM users WHERE id = $1`,
      [senderId]
    );
    name = users[0]?.display_name || 'Usuario';
    avatarUrl = users[0]?.avatar_url || null;
  } else {
    const { rows: users } = await query(`SELECT avatar_url FROM users WHERE id = $1`, [senderId]);
    avatarUrl = users[0]?.avatar_url || null;
  }
  return formatFreshMessage(rows[0], name, reply, avatarUrl);
}

export async function insertStickerMessage({ groupId, senderId, stickerId, replyToId = null }) {
  const sticker = getStickerById(stickerId);
  if (!sticker) throw new Error('Sticker no válido');

  const ok = await assertGroupMember(groupId, senderId);
  if (!ok) throw new Error('No eres miembro');

  return insertGroupMessage({
    groupId,
    senderId,
    body: sticker.id,
    type: 'sticker',
    replyToId,
  });
}

function canModerate(userId, senderId, userRole) {
  if (userId && senderId && userId === senderId) return true;
  return isModerator(userRole);
}

async function assertChatAccess(groupId, userId, userRole) {
  if (isRoot(userRole)) return true;
  return assertGroupMember(groupId, userId);
}

export async function editGroupMessage({ groupId, messageId, userId, body, userRole }) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Mensaje vacío');
  if (text.length > MAX_BODY) throw new Error(`Máximo ${MAX_BODY} caracteres`);

  const ok = await assertChatAccess(groupId, userId, userRole);
  if (!ok) throw new Error('No eres miembro');

  const { rows } = await query(
    `SELECT id, sender_id, type, deleted_at FROM messages WHERE id = $1 AND group_id = $2`,
    [messageId, groupId]
  );
  const row = rows[0];
  if (!row) throw new Error('Mensaje no encontrado');
  if (row.deleted_at) throw new Error('El mensaje está eliminado');
  if (row.type !== 'text') throw new Error('Solo se pueden editar mensajes de texto');
  if (!canModerate(userId, row.sender_id, userRole)) {
    throw new Error('No puedes editar este mensaje');
  }

  const { rows: updated } = await query(
    `UPDATE messages SET body = $1, edited_at = NOW()
     WHERE id = $2
     RETURNING id, group_id, sender_id, type, body, media_url, media_mime, media_name, media_size,
               reply_to_id, edited_at, deleted_at, created_at`,
    [sealMessageBody('text', text), messageId]
  );
  return hydrateMessage(updated[0], userId);
}

export async function softDeleteGroupMessage({ groupId, messageId, userId, userRole }) {
  const ok = await assertChatAccess(groupId, userId, userRole);
  if (!ok) throw new Error('No eres miembro');

  const { rows } = await query(
    `SELECT id, sender_id, deleted_at FROM messages WHERE id = $1 AND group_id = $2`,
    [messageId, groupId]
  );
  const row = rows[0];
  if (!row) throw new Error('Mensaje no encontrado');
  if (row.deleted_at) throw new Error('Ya estaba eliminado');
  if (!canModerate(userId, row.sender_id, userRole)) {
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
     RETURNING id, group_id, sender_id, type, body, media_url, media_mime, media_name, media_size,
               reply_to_id, edited_at, deleted_at, created_at`,
    [messageId]
  );
  return hydrateMessage(updated[0], userId);
}

/** Vacía el chat de un grupo (borra mensajes + reacciones/lecturas). Miembro del grupo. */
export async function clearGroupMessages(groupId, userId, userRole) {
  const ok = await assertChatAccess(groupId, userId, userRole);
  if (!ok) throw new Error('No eres miembro');

  const { rows: ids } = await query(`SELECT id FROM messages WHERE group_id = $1`, [groupId]);
  if (!ids.length) return 0;
  const list = ids.map((r) => r.id);
  await query(`DELETE FROM message_reactions WHERE message_id = ANY($1::uuid[])`, [list]);
  await query(`DELETE FROM message_reads WHERE message_id = ANY($1::uuid[])`, [list]);
  const { rowCount } = await query(`DELETE FROM messages WHERE group_id = $1`, [groupId]);
  return rowCount || 0;
}

/**
 * Toggle: mismo emoji quita; otro emoji reemplaza; emoji nuevo inserta.
 * @returns {{ groupId, messageId, reactions }}
 */
export async function toggleMessageReaction({ groupId, messageId, userId, emoji }) {
  const canonical = REACTION_NORMALIZED.get(normalizeEmoji(emoji));
  if (!canonical) throw new Error('Reacción no permitida');

  const ok = await assertGroupMember(groupId, userId);
  if (!ok) throw new Error('No eres miembro');

  const { rows } = await query(
    `SELECT id, deleted_at FROM messages WHERE id = $1 AND group_id = $2`,
    [messageId, groupId]
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
    groupId,
    messageId,
    reactions: reactions.get(messageId) || [],
  };
}

/** @returns {Map<string, Array<{emoji:string,count:number,mine:boolean}>>} */
export async function loadReactionsSummary(messageIds, viewerUserId = null) {
  const map = new Map();
  if (!messageIds?.length) return map;

  const { rows } = await query(
    `SELECT message_id, emoji, user_id
     FROM message_reactions
     WHERE message_id = ANY($1::uuid[])`,
    [messageIds]
  );

  const byMsg = new Map();
  for (const r of rows) {
    if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, []);
    byMsg.get(r.message_id).push(r);
  }

  for (const id of messageIds) {
    const list = byMsg.get(id) || [];
    const counts = new Map();
    let mine = null;
    for (const r of list) {
      counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
      if (viewerUserId && r.user_id === viewerUserId) mine = r.emoji;
    }
    const summary = [...counts.entries()]
      .map(([emoji, count]) => ({
        emoji,
        count,
        mine: mine === emoji,
      }))
      .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    map.set(id, summary);
  }
  return map;
}

/**
 * Marca como leídos los mensajes del grupo (ajenos) hasta upToMessageId (inclusive por created_at).
 * @returns {{ groupId, updates: Array<{ messageId, readCount, readFully }> }}
 */
export async function markGroupMessagesRead({ groupId, userId, upToMessageId = null }) {
  const ok = await assertGroupMember(groupId, userId);
  if (!ok) throw new Error('No eres miembro');

  let upToCreated = null;
  if (upToMessageId) {
    const { rows } = await query(
      `SELECT created_at FROM messages WHERE id = $1 AND group_id = $2`,
      [upToMessageId, groupId]
    );
    upToCreated = rows[0]?.created_at || null;
  }

  const { rows: targets } = await query(
    `SELECT m.id
     FROM messages m
     WHERE m.group_id = $1
       AND m.sender_id IS DISTINCT FROM $2
       AND m.deleted_at IS NULL
       AND m.type <> 'system'
       AND ($3::timestamptz IS NULL OR m.created_at <= $3)
       AND NOT EXISTS (
         SELECT 1 FROM message_reads r
         WHERE r.message_id = m.id AND r.user_id = $2
       )
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [groupId, userId, upToCreated]
  );

  if (!targets.length) {
    return { groupId, updates: [] };
  }

  const ids = targets.map((t) => t.id);
  await query(
    `INSERT INTO message_reads (message_id, user_id)
     SELECT unnest($1::uuid[]), $2
     ON CONFLICT DO NOTHING`,
    [ids, userId]
  );

  const receipts = await loadReadReceipts(ids);
  const updates = ids.map((messageId) => {
    const r = receipts.get(messageId) || { readCount: 0, peerCount: 0 };
    return {
      messageId,
      readCount: r.readCount,
      readFully: r.peerCount > 0 && r.readCount >= r.peerCount,
    };
  });

  return { groupId, updates };
}

/**
 * @returns {Map<string, { readCount: number, peerCount: number }>}
 */
export async function loadReadReceipts(messageIds) {
  const map = new Map();
  if (!messageIds?.length) return map;

  const { rows: msgs } = await query(
    `SELECT m.id, m.sender_id, m.group_id,
            (SELECT COUNT(*)::int FROM group_members gm
             WHERE gm.group_id = m.group_id AND gm.user_id IS DISTINCT FROM m.sender_id) AS peer_count,
            (SELECT COUNT(*)::int FROM message_reads mr
             WHERE mr.message_id = m.id AND mr.user_id IS DISTINCT FROM m.sender_id) AS read_count
     FROM messages m
     WHERE m.id = ANY($1::uuid[])`,
    [messageIds]
  );

  for (const r of msgs) {
    map.set(r.id, {
      readCount: r.read_count || 0,
      peerCount: r.peer_count || 0,
    });
  }
  return map;
}

export async function hydrateMessage(row, viewerUserId = null) {
  const { rows: users } = await query(`SELECT display_name, avatar_url FROM users WHERE id = $1`, [
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
  const msg = formatMessage(
    row,
    users[0]?.display_name || 'Usuario',
    reply,
    [],
    users[0]?.avatar_url || null
  );
  if (!msg.isDeleted) {
    const map = await loadReactionsSummary([row.id], viewerUserId);
    msg.reactions = map.get(row.id) || [];
    const receipts = await loadReadReceipts([row.id]);
    const r = receipts.get(row.id) || { readCount: 0, peerCount: 0 };
    msg.readCount = r.readCount;
    msg.peerCount = r.peerCount;
    msg.readFully = r.peerCount > 0 && r.readCount >= r.peerCount;
  } else {
    msg.reactions = [];
    msg.readCount = 0;
    msg.peerCount = 0;
    msg.readFully = false;
  }
  return msg;
}

export function formatMessage(row, displayName, reply = null, reactions = [], senderAvatarUrl = null) {
  const deleted = Boolean(row.deleted_at);
  const mediaUrl = !deleted && row.media_url ? `/api/media/${row.id}` : null;
  const sticker =
    !deleted && row.type === 'sticker' ? getStickerById(row.body) : null;
  const openedBody = deleted ? null : openMessageBody(row.type, row.body);
  const avatarPath =
    senderAvatarUrl ||
    row.sender_avatar_url ||
    row.avatar_url ||
    null;
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    displayName: displayName || 'Usuario',
    senderAvatarUrl: avatarPath ? String(avatarPath) : null,
    type: deleted ? 'text' : row.type,
    body: deleted ? null : row.type === 'sticker' ? null : openedBody,
    sticker: sticker
      ? {
          id: sticker.id,
          kind: sticker.kind,
          value: sticker.value,
          label: sticker.label,
          packId: sticker.packId,
        }
      : null,
    mediaUrl,
    mediaMime: deleted ? null : row.media_mime || null,
    mediaName: deleted ? null : row.media_name || null,
    mediaSize: deleted ? null : row.media_size || null,
    replyToId: row.reply_to_id || null,
    reply: reply || null,
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null,
    isDeleted: deleted,
    reactions: deleted ? [] : reactions || [],
    readCount: 0,
    peerCount: 0,
    readFully: false,
    createdAt: row.created_at,
  };
}

/** Mensaje recién insertado: sin queries extra de reacciones/lecturas. */
export function formatFreshMessage(row, displayName, reply = null, senderAvatarUrl = null) {
  return formatMessage(row, displayName, reply, [], senderAvatarUrl);
}

export { MAX_BODY };

