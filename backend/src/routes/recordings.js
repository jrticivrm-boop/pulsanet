import fs from 'fs';
import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertGroupMember } from '../services/presence.js';
import { isDispatch } from '../services/roles.js';
import { uploadAudio, mediaDiskPath, prepareGroupUploadDir, storedUploadRel } from '../services/uploads.js';
import { emitDispatch } from '../socket/dispatch.js';

function mapRec(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    groupName: r.group_name || null,
    userId: r.user_id,
    displayName: r.display_name || null,
    mimeType: r.mime_type,
    byteSize: r.byte_size,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
    audioUrl: `/api/recordings/${r.id}/audio`,
  };
}

export function createRecordingsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Listado org (admin/dispatcher) o de un grupo (miembro) */
  router.get('/', async (req, res) => {
    const hours = Math.min(Math.max(parseInt(req.query.hours || '24', 10) || 24, 1), 168);
    const groupId = req.query.groupId || null;
    const dispatch = isDispatch(req.user.role);

    if (groupId) {
      const ok = await assertGroupMember(groupId, req.user.sub);
      if (!ok && !dispatch) {
        return res.status(403).json({ ok: false, error: 'No eres miembro' });
      }
    } else if (!dispatch) {
      return res.status(403).json({ ok: false, error: 'Solo despacho puede listar toda la org' });
    }

    const params = [req.user.orgId, hours];
    let filter = 'r.organization_id = $1 AND r.created_at > NOW() - make_interval(hours => $2)';
    if (groupId) {
      params.push(groupId);
      filter += ` AND r.group_id = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT r.id, r.group_id, r.user_id, r.mime_type, r.byte_size, r.duration_ms, r.created_at,
              u.display_name, g.name AS group_name
       FROM ptt_recordings r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN groups g ON g.id = r.group_id
       WHERE ${filter}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    );

    res.json({ ok: true, hours, recordings: rows.map(mapRec) });
  });

  router.get('/:id/audio', async (req, res) => {
    const { rows } = await query(
      `SELECT r.*, g.organization_id
       FROM ptt_recordings r
       INNER JOIN groups g ON g.id = r.group_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    const rec = rows[0];
    if (!rec || rec.organization_id !== req.user.orgId) {
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    }

    if (!isDispatch(req.user.role)) {
      const ok = await assertGroupMember(rec.group_id, req.user.sub);
      if (!ok) {
        return res.status(403).json({ ok: false, error: 'Sin acceso' });
      }
    }

    const disk = mediaDiskPath(rec.file_path);
    if (!fs.existsSync(disk)) {
      return res.status(404).json({ ok: false, error: 'Archivo ausente' });
    }
    res.setHeader('Content-Type', rec.mime_type || 'audio/webm');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    const total = fs.statSync(disk).size;
    const range = req.headers.range;
    // Peticiones parciales: permiten buscar dentro del audio sin bajarlo entero.
    const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (!match[1] && match[2]) {
        start = Math.max(0, total - parseInt(match[2], 10));
        end = total - 1;
      }
      if (Number.isNaN(start) || Number.isNaN(end) || start >= total || start > end) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      end = Math.min(end, total - 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      return fs.createReadStream(disk, { start, end }).pipe(res);
    }

    res.setHeader('Content-Length', total);
    fs.createReadStream(disk).pipe(res);
  });

  router.post('/groups/:groupId', prepareGroupUploadDir('groupId'), (req, res) => {
    uploadAudio(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message || 'Upload inválido' });
      }
      try {
        const groupId = req.params.groupId;
        const ok = await assertGroupMember(groupId, req.user.sub);
        if (!ok) {
          if (req.file?.path) fs.unlinkSync(req.file.path);
          return res.status(403).json({ ok: false, error: 'No eres miembro' });
        }
        if (!req.file) {
          return res.status(400).json({ ok: false, error: 'audio requerido' });
        }

        const durationMs = Math.min(
          Math.max(parseInt(req.body?.durationMs || '0', 10) || 0, 0),
          600000
        );
        const mime = (req.file.mimetype || 'audio/webm').split(';')[0];

        const { rows: orgRows } = await query(
          `SELECT organization_id FROM groups WHERE id = $1`,
          [groupId]
        );
        if (!orgRows[0]) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
        }

        const filePath = storedUploadRel(req) || req.file.filename;
        const { rows } = await query(
          `INSERT INTO ptt_recordings
             (organization_id, group_id, user_id, file_path, mime_type, byte_size, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, group_id, user_id, mime_type, byte_size, duration_ms, created_at`,
          [
            orgRows[0].organization_id,
            groupId,
            req.user.sub,
            filePath,
            mime,
            req.file.size,
            durationMs || null,
          ]
        );

        const { rows: nameRows } = await query(
          `SELECT display_name FROM users WHERE id = $1`,
          [req.user.sub]
        );
        const { rows: gRows } = await query(`SELECT name FROM groups WHERE id = $1`, [groupId]);

        const recording = mapRec({
          ...rows[0],
          display_name: nameRows[0]?.display_name,
          group_name: gRows[0]?.name,
        });

        emitDispatch(io, 'dispatch:recording', recording);
        res.status(201).json({ ok: true, recording });
      } catch (e) {
        console.error('recording upload:', e);
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {
            /* ignore */
          }
        }
        res.status(500).json({ ok: false, error: 'Error al guardar grabación' });
      }
    });
  });

  return router;
}
