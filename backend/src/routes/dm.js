import fs from 'fs';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import { uploadMedia, classifyMedia, mediaPreviewLabel, sizeLimitError, LIMITS, prepareDmUploadDir, storedUploadRel } from '../services/uploads.js';
import {
  assertSameOrgPeer,
  listOrgContacts,
  listSharedGroupContacts,
  listDmConversations,
  listDmMessages,
  insertDmMessage,
  dmSocketRoom,
  softDeleteDmMessage,
  editDmMessage,
  clearDmThread,
  toggleDmReaction,
  markDmMessagesDelivered,
} from '../services/dm.js';
import { listOrgPresence } from '../services/presence.js';
import { getStickerById } from '../data/stickers.js';
import { notifyUserDevices } from '../services/fcm.js';
import { isDispatch } from '../services/roles.js';

const MAX_BODY = 2000;

async function withOnlineFlags(orgId, selfId, contacts) {
  /** @type {Map<string, { focus?: string }>} */
  const byId = new Map();
  try {
    const members = await listOrgPresence(orgId);
    for (const m of members || []) {
      byId.set(String(m.userId), m);
    }
  } catch {
    /* ignore */
  }
  const self = String(selfId);
  return (contacts || []).map((c) => {
    const id = String(c.id);
    const isSelf = id === self;
    const p = byId.get(id);
    let presence = 'offline';
    if (isSelf) {
      presence = 'online';
    } else if (p) {
      const f = String(p.focus || 'foreground');
      presence = f === 'background' || f === 'service' ? 'away' : 'online';
    }
    return {
      ...c,
      online: presence !== 'offline',
      presence,
      focus: p?.focus || (isSelf ? 'foreground' : null),
      isSelf,
    };
  });
}

export function createDmRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Contactos: shared = comparten grupo; org = toda la organización (despacho). */
  router.get('/contacts', async (req, res) => {
    const raw = String(req.query.scope || '').toLowerCase();
    let scope = raw === 'org' || raw === 'shared' ? raw : '';
    if (!scope) {
      scope = isDispatch(req.user.role) ? 'org' : 'shared';
    }
    if (scope === 'org' && !isDispatch(req.user.role)) {
      scope = 'shared';
    }
    let contacts =
      scope === 'org'
        ? await listOrgContacts(req.user.orgId, req.user.sub, { includeSelf: true })
        : await listSharedGroupContacts(req.user.orgId, req.user.sub);
    contacts = await withOnlineFlags(req.user.orgId, req.user.sub, contacts);
    res.json({ ok: true, scope, contacts });
  });

  /** Conversaciones DM recientes */
  router.get('/conversations', async (req, res) => {
    const conversations = await listDmConversations(req.user.sub);
    res.json({ ok: true, conversations });
  });

  /** Historial con un usuario */
  router.get('/:userId/messages', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const messages = await listDmMessages(req.user.sub, peer.id);
    res.json({
      ok: true,
      peer: {
        id: peer.id,
        username: peer.username,
        displayName: peer.display_name,
        email: peer.email,
        role: peer.role,
      },
      messages,
    });
  });

  /** Enviar texto */
  router.post('/:userId/messages', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const text = String(req.body?.body || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Mensaje vacío' });
    if (text.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: `Máximo ${MAX_BODY} caracteres` });
    }
    const msg = await insertDmMessage({
      senderId: req.user.sub,
      recipientId: peer.id,
      body: text,
      type: 'text',
      replyToId: req.body?.replyToId || null,
      displayName: req.user.displayName,
    });
    const room = dmSocketRoom(req.user.sub, peer.id);
    io.to(room).emit('dm:message', msg);
    if (String(peer.id) !== String(req.user.sub)) {
      io.to(`user:${peer.id}`).emit('dm:notify', {
        peerId: req.user.sub,
        peerName: req.user.displayName,
        message: msg,
      });
      notifyUserDevices({
        userId: peer.id,
        title: req.user.displayName || 'SICOM',
        body: text.slice(0, 120),
        data: { type: 'dm', peerId: req.user.sub },
      }).catch(() => {});
    }
    res.status(201).json({ ok: true, message: msg });
  });

  /** Sticker DM */
  router.post('/:userId/messages/sticker', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const sticker = getStickerById(req.body?.stickerId);
    if (!sticker) return res.status(400).json({ ok: false, error: 'Sticker no válido' });
    const msg = await insertDmMessage({
      senderId: req.user.sub,
      recipientId: peer.id,
      body: sticker.id,
      type: 'sticker',
      replyToId: req.body?.replyToId || null,
      displayName: req.user.displayName,
    });
    const room = dmSocketRoom(req.user.sub, peer.id);
    io.to(room).emit('dm:message', msg);
    io.to(`user:${peer.id}`).emit('dm:notify', {
      peerId: req.user.sub,
      peerName: req.user.displayName,
      message: msg,
    });
    notifyUserDevices({
      userId: peer.id,
      title: req.user.displayName || 'SICOM',
      body: 'Sticker',
      data: { type: 'dm', peerId: req.user.sub },
    }).catch(() => {});
    res.status(201).json({ ok: true, message: msg });
  });

  /** Zumbido DM (estilo Messenger): hasta 5 seguidos, luego 10 s de espera */
  const nudgeBurstLimit = 5;
  const nudgeCooldownMs = 10_000;
  /** `${sender}:${peer}` → { count, resetAt } */
  const nudgeBuckets = new Map();
  router.post('/:userId/messages/nudge', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const key = `${req.user.sub}:${peer.id}`;
    const now = Date.now();
    let bucket = nudgeBuckets.get(key) || { count: 0, resetAt: 0 };
    if (bucket.resetAt && now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: 0 };
    }
    if (bucket.count >= nudgeBurstLimit && bucket.resetAt && now < bucket.resetAt) {
      const waitSec = Math.ceil((bucket.resetAt - now) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Espera ${waitSec}s para otro zumbido`,
      });
    }
    if (bucket.count >= nudgeBurstLimit) {
      bucket = { count: 0, resetAt: 0 };
    }
    bucket.count += 1;
    if (bucket.count >= nudgeBurstLimit) {
      bucket.resetAt = now + nudgeCooldownMs;
    }
    nudgeBuckets.set(key, bucket);
    const msg = await insertDmMessage({
      senderId: req.user.sub,
      recipientId: peer.id,
      body: 'nudge',
      type: 'nudge',
      displayName: req.user.displayName,
    });
    const room = dmSocketRoom(req.user.sub, peer.id);
    io.to(room).emit('dm:message', msg);
    io.to(`user:${peer.id}`).emit('dm:nudge', {
      peerId: req.user.sub,
      peerName: req.user.displayName,
      message: msg,
    });
    io.to(`user:${peer.id}`).emit('dm:notify', {
      peerId: req.user.sub,
      peerName: req.user.displayName,
      message: msg,
    });
    notifyUserDevices({
      userId: peer.id,
      title: req.user.displayName || 'SICOM',
      body: '¡Zumbido!',
      data: {
        type: 'dm_nudge',
        peerId: req.user.sub,
        messageId: msg.id,
        title: req.user.displayName || 'SICOM',
        body: '¡Zumbido!',
      },
    }).catch(() => {});
    res.status(201).json({ ok: true, message: msg });
  });

  /** Media DM */
  router.post('/:userId/messages/media', prepareDmUploadDir, (req, res) => {
    uploadMedia(req, res, async (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Archivo demasiado grande (máx ${Math.round(LIMITS.multer / (1024 * 1024))} MB)`
            : err.message;
        return res.status(400).json({ ok: false, error: msg });
      }
      try {
        const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
        if (!peer) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
        }
        if (!req.file) {
          return res.status(400).json({ ok: false, error: 'Archivo requerido' });
        }
        const declared = String(req.body?.type || '').toLowerCase();
        const classified = classifyMedia(
          req.file.mimetype,
          declared,
          req.file.originalname || req.file.filename
        );
        if (!classified.ok) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ ok: false, error: classified.error });
        }
        if (req.file.size > classified.maxBytes) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ ok: false, error: sizeLimitError(classified) });
        }
        const caption = String(req.body?.body || '').trim().slice(0, MAX_BODY) || null;
        const mediaUrl = storedUploadRel(req) || req.file.filename;
        const msg = await insertDmMessage({
          senderId: req.user.sub,
          recipientId: peer.id,
          body: caption,
          type: classified.type,
          mediaUrl,
          mediaMime: req.file.mimetype,
          mediaName: req.file.originalname || req.file.filename,
          mediaSize: req.file.size,
          replyToId: req.body?.replyToId || null,
          displayName: req.user.displayName,
        });
        const room = dmSocketRoom(req.user.sub, peer.id);
        io.to(room).emit('dm:message', msg);
        io.to(`user:${peer.id}`).emit('dm:notify', {
          peerId: req.user.sub,
          peerName: req.user.displayName,
          message: msg,
        });
        const preview = mediaPreviewLabel(classified, msg.mediaName, caption);
        notifyUserDevices({
          userId: peer.id,
          title: req.user.displayName || 'SICOM',
          body: String(preview).slice(0, 120),
          data: { type: 'dm', peerId: req.user.sub },
        }).catch(() => {});
        res.status(201).json({ ok: true, message: msg });
      } catch (e) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        console.error('dm media:', e);
        res.status(500).json({ ok: false, error: 'Error al guardar media' });
      }
    });
  });

  /** Marcar entregados (llegó al dispositivo; 2 palomas grises) */
  router.post('/:userId/messages/delivered', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const messageIds = Array.isArray(req.body?.messageIds) ? req.body.messageIds : null;
    const upTo = req.body?.upToMessageId || null;
    const ids = await markDmMessagesDelivered({
      readerId: req.user.sub,
      peerId: peer.id,
      messageIds,
      upToMessageId: upTo,
    });
    if (ids.length) {
      const room = dmSocketRoom(req.user.sub, peer.id);
      io.to(room).emit('dm:delivery', {
        peerId: req.user.sub,
        messageIds: ids,
      });
    }
    res.json({ ok: true, delivered: ids.length, messageIds: ids });
  });

  /** Marcar leídos */
  router.post('/:userId/messages/read', async (req, res) => {
    const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
    if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    const upTo = req.body?.upToMessageId || null;
    const { rows } = await query(
      `SELECT id FROM messages
       WHERE group_id IS NULL AND recipient_id IS NOT NULL
         AND sender_id = $1 AND recipient_id = $2
         AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR created_at <= (SELECT created_at FROM messages WHERE id = $3))`,
      [peer.id, req.user.sub, upTo]
    );
    for (const r of rows) {
      await query(
        `INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.id, req.user.sub]
      );
      await query(
        `INSERT INTO message_deliveries (message_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.id, req.user.sub]
      );
    }
    const room = dmSocketRoom(req.user.sub, peer.id);
    const messageIds = rows.map((r) => r.id);
    if (messageIds.length) {
      io.to(room).emit('dm:delivery', {
        peerId: req.user.sub,
        messageIds,
      });
      io.to(room).emit('dm:receipts', {
        peerId: req.user.sub,
        messageIds,
      });
    }
    res.json({ ok: true, read: rows.length });
  });

  /** Vaciar hilo DM (ambos lados) */
  router.post('/:userId/messages/clear', async (req, res) => {
    try {
      const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
      if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const deleted = await clearDmThread(req.user.sub, peer.id);
      const room = dmSocketRoom(req.user.sub, peer.id);
      io.to(room).emit('dm:cleared', {
        peerId: peer.id,
        byUserId: req.user.sub,
        deleted,
      });
      res.json({ ok: true, deleted });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  /** Soft-delete DM */
  router.delete('/:userId/messages/:messageId', async (req, res) => {
    try {
      const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
      if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const msg = await softDeleteDmMessage({
        peerId: peer.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        userRole: req.user.role,
      });
      const room = dmSocketRoom(req.user.sub, peer.id);
      io.to(room).emit('dm:deleted', msg);
      res.json({ ok: true, message: msg });
    } catch (err) {
      const notFound = /no encontrado/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Editar mensaje de texto DM */
  router.patch('/:userId/messages/:messageId', async (req, res) => {
    try {
      const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
      if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const msg = await editDmMessage({
        peerId: peer.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        body: req.body?.body,
        userRole: req.user.role,
      });
      const room = dmSocketRoom(req.user.sub, peer.id);
      io.to(room).emit('dm:edited', msg);
      res.json({ ok: true, message: msg });
    } catch (err) {
      const notFound = /no encontrado/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Reacción DM */
  router.post('/:userId/messages/:messageId/reactions', async (req, res) => {
    try {
      const peer = await assertSameOrgPeer(req.user.orgId, req.user.sub, req.params.userId);
      if (!peer) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const payload = await toggleDmReaction({
        peerId: peer.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        emoji: req.body?.emoji,
      });
      const room = dmSocketRoom(req.user.sub, peer.id);
      io.to(room).emit('dm:reaction', payload);
      res.json({ ok: true, ...payload });
    } catch (err) {
      const notFound = /no encontrado/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  return router;
}
