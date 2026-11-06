import {
  assertSameOrgPeer,
  dmSocketRoom,
  insertDmMessage,
  listDmMessages,
  markDmMessagesDelivered,
} from '../services/dm.js';
import { redactViewOnceForViewer } from './chat.js';
import { query } from '../db.js';
import { notifyUserDevices } from '../services/fcm.js';
import { friendlyMessageDbError } from '../services/messageErrors.js';

/**
 * Chat DM + presencia en room user:{id}
 */
export function registerDmHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.join(`user:${user.sub}`);

    socket.on('dm:join', async ({ peerId } = {}) => {
      try {
        const { rows } = await query(
          `SELECT organization_id FROM users WHERE id = $1`,
          [user.sub]
        );
        const orgId = rows[0]?.organization_id;
        if (!orgId) return;
        const peer = await assertSameOrgPeer(orgId, user.sub, peerId);
        if (!peer) return;
        socket.join(dmSocketRoom(user.sub, peer.id));
      } catch {
        /* ignore */
      }
    });

    socket.on('dm:leave', ({ peerId } = {}) => {
      if (!peerId) return;
      socket.leave(dmSocketRoom(user.sub, peerId));
    });

    socket.on('dm:typing', async ({ peerId, typing } = {}) => {
      if (!peerId) return;
      socket.to(dmSocketRoom(user.sub, peerId)).emit('dm:typing', {
        peerId: user.sub,
        displayName: user.displayName,
        typing: Boolean(typing),
      });
    });

    socket.on('dm:delivered', async ({ peerId, messageIds, upToMessageId } = {}) => {
      try {
        if (!peerId) return;
        const { rows } = await query(
          `SELECT organization_id FROM users WHERE id = $1`,
          [user.sub]
        );
        const orgId = rows[0]?.organization_id;
        const peer = await assertSameOrgPeer(orgId, user.sub, peerId);
        if (!peer) return;
        const ids = await markDmMessagesDelivered({
          readerId: user.sub,
          peerId: peer.id,
          messageIds: Array.isArray(messageIds) ? messageIds : null,
          upToMessageId: upToMessageId || null,
        });
        if (!ids.length) return;
        const room = dmSocketRoom(user.sub, peer.id);
        io.to(room).emit('dm:delivery', {
          peerId: user.sub,
          messageIds: ids,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('dm:send', async ({ peerId, body, replyToId, clientMsgId, viewOnce } = {}) => {
      try {
        let orgId = user.orgId;
        if (!orgId) {
          const { rows } = await query(
            `SELECT organization_id FROM users WHERE id = $1`,
            [user.sub]
          );
          orgId = rows[0]?.organization_id;
        }
        const peer = await assertSameOrgPeer(orgId, user.sub, peerId);
        if (!peer) {
          socket.emit('dm:error', { error: 'Usuario no encontrado', clientMsgId });
          return;
        }
        const text = String(body || '').trim();
        if (!text) {
          socket.emit('dm:error', { error: 'Mensaje vacío', clientMsgId });
          return;
        }
        const once = viewOnce === true || viewOnce === 'true' || viewOnce === 1 || viewOnce === '1';
        const msg = await insertDmMessage({
          senderId: user.sub,
          recipientId: peer.id,
          body: text,
          type: 'text',
          replyToId: replyToId || null,
          displayName: user.displayName,
          viewOnce: once,
        });
        if (clientMsgId) msg.clientMsgId = String(clientMsgId);
        msg.delivered = false;
        msg.deliveredCount = 0;
        const room = dmSocketRoom(user.sub, peer.id);
        const preview = once ? 'Mensaje de una sola vez' : text.length > 100 ? `${text.slice(0, 100)}…` : text;
        if (once) {
          io.to(`user:${peer.id}`).emit('dm:message', redactViewOnceForViewer(msg, peer.id));
          socket.emit('dm:message', msg);
        } else {
          io.to(room).emit('dm:message', msg);
          socket.emit('dm:message', msg);
        }
        io.to(`user:${peer.id}`).emit('dm:notify', {
          peerId: user.sub,
          peerName: user.displayName,
          message: redactViewOnceForViewer(msg, peer.id),
        });
        notifyUserDevices({
          userId: peer.id,
          title: user.displayName || 'SICOM',
          body: preview,
          data: {
            type: 'dm',
            peerId: user.sub,
            messageId: msg.id,
            title: user.displayName || 'SICOM',
            body: preview,
          },
        }).catch(() => {});
      } catch (e) {
        socket.emit('dm:error', {
          error: friendlyMessageDbError(e),
          clientMsgId,
        });
      }
    });

    socket.on('dm:history', async ({ peerId } = {}, ack) => {
      try {
        const { rows } = await query(
          `SELECT organization_id FROM users WHERE id = $1`,
          [user.sub]
        );
        const orgId = rows[0]?.organization_id;
        const peer = await assertSameOrgPeer(orgId, user.sub, peerId);
        if (!peer) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Usuario no encontrado' });
          return;
        }
        socket.join(dmSocketRoom(user.sub, peer.id));
        const messages = await listDmMessages(user.sub, peer.id);
        if (typeof ack === 'function') {
          ack({
            ok: true,
            peer: {
              id: peer.id,
              displayName: peer.display_name,
              email: peer.email,
            },
            messages,
          });
        }
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });
  });
}
