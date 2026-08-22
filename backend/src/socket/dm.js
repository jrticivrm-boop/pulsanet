import {
  assertSameOrgPeer,
  dmSocketRoom,
  insertDmMessage,
  listDmMessages,
} from '../services/dm.js';
import { query } from '../db.js';
import { notifyUserDevices } from '../services/fcm.js';

/**
 * Chat DM + presencia en room user:{id}
 */
export function registerDmHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.join(`user:${user.sub}`);

    socket.on('dm:join', async ({ peerId }) => {
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

    socket.on('dm:leave', ({ peerId }) => {
      if (!peerId) return;
      socket.leave(dmSocketRoom(user.sub, peerId));
    });

    socket.on('dm:typing', async ({ peerId, typing }) => {
      if (!peerId) return;
      socket.to(dmSocketRoom(user.sub, peerId)).emit('dm:typing', {
        peerId: user.sub,
        displayName: user.displayName,
        typing: Boolean(typing),
      });
    });

    socket.on('dm:send', async ({ peerId, body, replyToId, clientMsgId }) => {
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
        const msg = await insertDmMessage({
          senderId: user.sub,
          recipientId: peer.id,
          body: text,
          type: 'text',
          replyToId: replyToId || null,
          displayName: user.displayName,
        });
        if (clientMsgId) msg.clientMsgId = String(clientMsgId);
        const room = dmSocketRoom(user.sub, peer.id);
        io.to(room).emit('dm:message', msg);
        io.to(`user:${peer.id}`).emit('dm:notify', {
          peerId: user.sub,
          peerName: user.displayName,
          message: msg,
        });
        notifyUserDevices({
          userId: peer.id,
          title: user.displayName || 'TacticalPtx',
          body: text.slice(0, 120),
          data: { type: 'dm', peerId: user.sub },
        }).catch(() => {});
      } catch (e) {
        socket.emit('dm:error', { error: e.message || 'Error', clientMsgId });
      }
    });

    socket.on('dm:history', async ({ peerId }, ack) => {
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
