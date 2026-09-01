import fs from 'fs';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import { uploadMedia, classifyMedia, mediaPreviewLabel, sizeLimitError, LIMITS, prepareDmUploadDir, storedUploadRel } from '../services/uploads.js';
import {
  assertSameOrgPeer,
  listOrgContacts,
  listDmConversations,
  listDmMessages,
  insertDmMessage,
  dmSocketRoom,
  softDeleteDmMessage,
  clearDmThread,
  toggleDmReaction,
} from '../services/dm.js';
import { getStickerById } from '../data/stickers.js';
import { notifyUserDevices } from '../services/fcm.js';

const MAX_BODY = 2000;

export function createDmRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Contactos de la misma organización */
  router.get('/contacts', async (req, res) => {
    const contacts = await listOrgContacts(req.user.orgId, req.user.sub);
    res.json({ ok: true, contacts });
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
    io.to(`user:${peer.id}`).emit('dm:notify', {
      peerId: req.user.sub,
      peerName: req.user.displayName,
      message: msg,
    });
    notifyUserDevices({
      userId: peer.id,
      title: req.user.displayName || 'TacticalPtx',
      body: text.slice(0, 120),
      data: { type: 'dm', peerId: req.user.sub },
    }).catch(() => {});
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
      title: req.user.displayName || 'TacticalPtx',
      body: 'Sticker',
      data: { type: 'dm', peerId: req.user.sub },
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
          title: req.user.displayName || 'TacticalPtx',
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
    }
    const room = dmSocketRoom(req.user.sub, peer.id);
    io.to(room).emit('dm:receipts', {
      peerId: req.user.sub,
      messageIds: rows.map((r) => r.id),
    });
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
