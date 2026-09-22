import fs from 'fs';
import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertGroupMember } from '../services/presence.js';
import {
  insertGroupMessage,
  insertStickerMessage,
  formatMessage,
  editGroupMessage,
  softDeleteGroupMessage,
  clearGroupMessages,
  toggleMessageReaction,
  loadReactionsSummary,
  markGroupMessagesRead,
  loadReadReceipts,
  REACTION_EMOJIS,
  MAX_BODY,
} from '../socket/chat.js';
import { openMessageBody } from '../services/contentCrypto.js';
import {
  uploadMedia,
  classifyMedia,
  mediaDiskPath,
  mediaPreviewLabel,
  sizeLimitError,
  LIMITS,
  prepareGroupUploadDir,
  storedUploadRel,
} from '../services/uploads.js';
import { inc } from '../services/metrics.js';
import { notifyGroupMembers } from '../services/fcm.js';

export function createMessagesRouter(io) {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get('/', async (req, res) => {
    const groupId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 200);

    const ok = await assertGroupMember(groupId, req.user.sub);
    if (!ok) {
      return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    }

    const { rows } = await query(
      `SELECT m.id, m.group_id, m.sender_id, m.type, m.body, m.media_url, m.media_mime,
              m.media_name, m.media_size, m.reply_to_id, m.edited_at, m.deleted_at, m.created_at,
              u.display_name, u.avatar_url AS sender_avatar_url,
              rm.body AS reply_body, rm.type AS reply_type, rm.media_name AS reply_media_name,
              rm.deleted_at AS reply_deleted_at, ru.display_name AS reply_display_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       WHERE m.group_id = $1
         AND m.type IN ('text', 'image', 'file', 'audio', 'sticker', 'system')
         AND m.created_at > NOW() - INTERVAL '90 days'
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [groupId, limit]
    );

    const messages = rows
      .map((r) =>
        formatMessage(
          r,
          r.display_name,
          r.reply_to_id
            ? {
                id: r.reply_to_id,
                body: r.reply_deleted_at
                  ? null
                  : openMessageBody(r.reply_type, r.reply_body),
                type: r.reply_type,
                mediaName: r.reply_deleted_at ? null : r.reply_media_name,
                displayName: r.reply_display_name || 'Usuario',
                isDeleted: Boolean(r.reply_deleted_at),
              }
            : null
        )
      )
      .reverse();

    const ids = messages.filter((m) => !m.isDeleted).map((m) => m.id);
    const reactMap = await loadReactionsSummary(ids, req.user.sub);
    const readMap = await loadReadReceipts(ids);
    for (const m of messages) {
      m.reactions = reactMap.get(m.id) || [];
      const r = readMap.get(m.id) || {
        readCount: 0,
        peerCount: 0,
        deliveredCount: 0,
      };
      m.readCount = r.readCount;
      m.peerCount = r.peerCount;
      m.readFully = r.peerCount > 0 && r.readCount >= r.peerCount;
      m.deliveredCount = r.deliveredCount || 0;
      m.delivered =
        m.readFully ||
        (r.peerCount > 0 && m.deliveredCount >= r.peerCount);
    }

    res.json({ ok: true, messages });
  });

  router.post('/', async (req, res) => {
    const groupId = req.params.id;
    const text = String(req.body?.body || '').trim();
    const replyToId = req.body?.replyToId || null;

    if (!text) {
      return res.status(400).json({ ok: false, error: 'Mensaje vacÃ­o' });
    }
    if (text.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: `MÃ¡ximo ${MAX_BODY} caracteres` });
    }

    const ok = await assertGroupMember(groupId, req.user.sub);
    if (!ok) {
      return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
    }

    const msg = await insertGroupMessage({
      groupId,
      senderId: req.user.sub,
      body: text,
      type: 'text',
      replyToId,
      displayName: req.user.displayName,
    });

    inc('chatSent');
    io.to(`group:${groupId}`).emit('chat:message', msg);
    notifyGroupMembers({
      groupId,
      excludeUserId: req.user.sub,
      title: msg.displayName || 'SICOM',
      body: text.slice(0, 120),
      data: { type: 'chat', messageId: msg.id },
    }).catch(() => {});
    res.status(201).json({ ok: true, message: msg });
  });

  /** Marcar mensajes como leÃ­dos (hasta un id) */
  router.post('/read', async (req, res) => {
    try {
      const payload = await markGroupMessagesRead({
        groupId: req.params.id,
        userId: req.user.sub,
        upToMessageId: req.body?.upToMessageId || null,
      });
      if (payload.updates?.length) {
        io.to(`group:${req.params.id}`).emit('chat:receipts', payload);
      }
      res.json({ ok: true, ...payload });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  /** Enviar sticker del pack integrado */
  router.post('/sticker', async (req, res) => {
    try {
      const msg = await insertStickerMessage({
        groupId: req.params.id,
        senderId: req.user.sub,
        stickerId: req.body?.stickerId,
        replyToId: req.body?.replyToId || null,
      });
      inc('chatSent');
      io.to(`group:${req.params.id}`).emit('chat:message', msg);
      notifyGroupMembers({
        groupId: req.params.id,
        excludeUserId: req.user.sub,
        title: msg.displayName || 'SICOM',
        body: msg.sticker?.label || 'Sticker',
        data: { type: 'chat', messageId: msg.id },
      }).catch(() => {});
      res.status(201).json({ ok: true, message: msg });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  /** Editar mensaje de texto propio (o admin/despacho) */
  router.patch('/:messageId', async (req, res) => {
    try {
      const msg = await editGroupMessage({
        groupId: req.params.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        body: req.body?.body,
        userRole: req.user.role,
      });
      io.to(`group:${req.params.id}`).emit('chat:edited', msg);
      res.json({ ok: true, message: msg });
    } catch (err) {
      const code = /no encontrado/i.test(err.message)
        ? 404
        : /no puedes|no eres|solo se|eliminado|vacÃ­o|MÃ¡ximo/i.test(err.message)
          ? 400
          : 400;
      res.status(code === 404 ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Vaciar chat del grupo (todos los miembros) */
  router.post('/clear', async (req, res) => {
    try {
      const deleted = await clearGroupMessages(
        req.params.id,
        req.user.sub,
        req.user.role,
      );
      io.to(`group:${req.params.id}`).emit('chat:cleared', {
        groupId: req.params.id,
        byUserId: req.user.sub,
        deleted,
      });
      res.json({ ok: true, deleted });
    } catch (err) {
      const forbidden = /no eres/i.test(err.message);
      res.status(forbidden ? 403 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Soft-delete (todos ven â€œeliminadoâ€) */
  router.delete('/:messageId', async (req, res) => {
    try {
      const msg = await softDeleteGroupMessage({
        groupId: req.params.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        userRole: req.user.role,
      });
      io.to(`group:${req.params.id}`).emit('chat:deleted', msg);
      res.json({ ok: true, message: msg });
    } catch (err) {
      const notFound = /no encontrado/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Toggle reacciÃ³n */
  router.post('/:messageId/reactions', async (req, res) => {
    try {
      const payload = await toggleMessageReaction({
        groupId: req.params.id,
        messageId: req.params.messageId,
        userId: req.user.sub,
        emoji: req.body?.emoji,
      });
      io.to(`group:${req.params.id}`).emit('chat:reaction', payload);
      res.json({ ok: true, ...payload, allowed: REACTION_EMOJIS });
    } catch (err) {
      const notFound = /no encontrado/i.test(err.message);
      res.status(notFound ? 404 : 400).json({ ok: false, error: err.message });
    }
  });

  /** Multipart: file + optional body (caption) + type=image|file|audio|video */
  router.post('/media', prepareGroupUploadDir('id'), (req, res) => {
    uploadMedia(req, res, async (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Archivo demasiado grande (máx ${Math.round(LIMITS.multer / (1024 * 1024))} MB)`
            : err.message;
        return res.status(400).json({ ok: false, error: msg });
      }
      try {
        const groupId = req.params.id;
        if (!req.file) {
          return res.status(400).json({ ok: false, error: 'Archivo requerido' });
        }

        const ok = await assertGroupMember(groupId, req.user.sub);
        if (!ok) {
          fs.unlink(req.file.path, () => {});
          return res.status(403).json({ ok: false, error: 'No eres miembro de este grupo' });
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
          return res.status(400).json({
            ok: false,
            error: sizeLimitError(classified),
          });
        }

        const caption = String(req.body?.body || '').trim().slice(0, MAX_BODY) || null;
        const replyToId = req.body?.replyToId || null;
        const mediaUrl = storedUploadRel(req) || req.file.filename;
        const msg = await insertGroupMessage({
          groupId,
          senderId: req.user.sub,
          body: caption,
          type: classified.type,
          mediaUrl,
          mediaMime: req.file.mimetype,
          mediaName: req.file.originalname || req.file.filename,
          mediaSize: req.file.size,
          replyToId,
          displayName: req.user.displayName,
        });

        inc('chatSent');
        io.to(`group:${groupId}`).emit('chat:message', msg);
        const preview = mediaPreviewLabel(classified, msg.mediaName, null);
        notifyGroupMembers({
          groupId,
          excludeUserId: req.user.sub,
          title: msg.displayName || 'SICOM',
          body: caption || preview,
          data: { type: 'chat', messageId: msg.id },
        }).catch(() => {});
        res.status(201).json({ ok: true, message: msg });
      } catch (e) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        console.error('media upload:', e);
        res.status(500).json({ ok: false, error: 'Error al guardar media' });
      }
    });
  });

  return router;
}

/** GET /api/media/:messageId â€” miembro del grupo o participante DM */
export function createMediaRouter() {
  const router = Router();
  router.use(authMiddleware);

  router.get('/:messageId', async (req, res) => {
    const { rows } = await query(
      `SELECT id, group_id, sender_id, recipient_id, media_url, media_mime, media_name, deleted_at
       FROM messages WHERE id = $1 AND media_url IS NOT NULL`,
      [req.params.messageId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ ok: false, error: 'Media no encontrada' });
    if (row.deleted_at) {
      return res.status(410).json({ ok: false, error: 'Mensaje eliminado' });
    }

    let allowed = false;
    if (row.group_id) {
      allowed = await assertGroupMember(row.group_id, req.user.sub);
    } else if (row.recipient_id) {
      allowed = row.sender_id === req.user.sub || row.recipient_id === req.user.sub;
    }
    if (!allowed) return res.status(403).json({ ok: false, error: 'Sin acceso' });

    const disk = mediaDiskPath(row.media_url);
    if (!fs.existsSync(disk)) {
      return res.status(404).json({ ok: false, error: 'Archivo ausente' });
    }

    if (row.media_mime) res.type(row.media_mime);
    if (row.media_name) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(row.media_name)}`
      );
    }
    fs.createReadStream(disk).pipe(res);
  });

  return router;
}
