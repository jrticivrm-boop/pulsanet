import fs from 'fs';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import { uploadMedia, classifyMedia } from '../services/uploads.js';
import {
  assertSameOrgPeer,
  listOrgContacts,
  listDmConversations,
  listDmMessages,
  insertDmMessage,
  dmSocketRoom,
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
  router.post('/:userId/messages/media', (req, res) => {
    uploadMedia(req, res, async (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Archivo demasiado grande (máx 25 MB)'
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
          return res.status(400).json({ ok: false, error: 'Archivo demasiado grande' });
        }
        const caption = String(req.body?.body || '').trim().slice(0, MAX_BODY) || null;
        const msg = await insertDmMessage({
          senderId: req.user.sub,
          recipientId: peer.id,
          body: caption,
          type: classified.type,
          mediaUrl: req.file.filename,
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
        const preview =
          classified.type === 'image'
            ? '📷 Imagen'
            : classified.type === 'audio'
              ? '🎤 Audio'
              : classified.type === 'video'
                ? '🎬 Video'
                : caption || '📎 Archivo';
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

  return router;
}
