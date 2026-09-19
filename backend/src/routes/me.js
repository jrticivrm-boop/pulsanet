import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { mintAvatarTicket, verifyAvatarTicket } from '../services/avatarTicket.js';
import { UPLOADS_DIR, mediaDiskPath, prepareAvatarUploadDir, storedUploadRel, ensureUploadAbsDir, resolveAvatarUploadRel } from '../services/uploads.js';
import { logActivity } from '../services/activity.js';
import { bindLiveUser } from '../services/userProfile.js';
import { getOrgGpsSettings } from '../services/orgGpsSettings.js';

/** @deprecated prefer mediaDiskPath — mantenido para imports existentes */
const AVATAR_DIR = path.join(UPLOADS_DIR, 'avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/pjpeg']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Sniff JPEG / PNG / WebP magic bytes (Android a veces manda octet-stream vacío). */
function sniffImageKind(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const rel = req.uploadRelDir || resolveAvatarUploadRel(req.user?.orgId || 'unknown');
      cb(null, ensureUploadAbsDir(rel));
    } catch (e) {
      cb(e);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8) || '.jpg';
    const safe = IMAGE_EXT.has(ext) ? ext : '.jpg';
    cb(null, `${randomUUID()}${safe}`);
  },
});

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').split(';')[0].toLowerCase().trim();
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (IMAGE_MIME.has(mime) || mime.startsWith('image/')) return cb(null, true);
    // Android/HEIC→JPEG o pickers locales: mime vacío u octet-stream con extensión válida
    if ((!mime || mime === 'application/octet-stream') && IMAGE_EXT.has(ext)) {
      return cb(null, true);
    }
    cb(new Error('Formato no válido. Usa JPG, PNG o WebP'));
  },
}).single('avatar');

/** Bearer JWT, o ticket corto ?atk= (nunca el access JWT en query). */
function authFromHeaderOrQuery(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const raw = header.slice(7);
    try {
      const payload = jwt.verify(raw, config.jwtSecret);
      return bindLiveUser(payload)
        .then((user) => {
          if (!user) {
            return res.status(401).json({ ok: false, error: 'Usuario inactivo o no encontrado' });
          }
          req.user = user;
          next();
        })
        .catch((err) => {
          console.error('avatar auth profile:', err.message);
          res.status(500).json({ ok: false, error: 'Error de autenticación' });
        });
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
    }
  }

  const atk = typeof req.query?.atk === 'string' ? req.query.atk : null;
  if (atk) {
    const ticket = verifyAvatarTicket(atk);
    if (!ticket) {
      return res.status(401).json({ ok: false, error: 'Ticket de avatar inválido o expirado' });
    }
    req.user = { sub: ticket.sub, orgId: ticket.orgId };
    return next();
  }

  return res.status(401).json({ ok: false, error: 'Token requerido' });
}

function avatarPublicPath(stored) {
  if (!stored) return null;
  return `/api/avatars/file/${encodeURIComponent(stored)}`;
}

export function mapAvatarUrl(filename) {
  return avatarPublicPath(filename);
}

export async function removeOldAvatarFile(stored) {
  if (!stored) return;
  const disk = mediaDiskPath(stored);
  try {
    if (fs.existsSync(disk)) fs.unlinkSync(disk);
  } catch {
    /* ignore */
  }
}

export function runAvatarUpload(req, res, next) {
  prepareAvatarUploadDir(req, res, (err) => {
    if (err) return next(err);
    uploadAvatar(req, res, next);
  });
}

export function sniffUploadedAvatar(filePath) {
  const head = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, head, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  return sniffImageKind(head);
}

export { AVATAR_DIR };

export function createMeRouter() {
  const router = Router();

  /** Ticket corto para <img> / NetworkImage (?atk=) sin poner el JWT en la URL */
  router.get('/avatar-ticket', authMiddleware, (req, res) => {
    try {
      const { ticket, expiresIn, exp } = mintAvatarTicket(req.user);
      res.json({ ok: true, avatarTicket: ticket, expiresIn, exp });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'No se pudo emitir ticket' });
    }
  });

  /** Umbral/intervalo GPS de la org (cualquier usuario autenticado; sin admin). */
  router.get('/gps-settings', authMiddleware, async (req, res) => {
    const gps = await getOrgGpsSettings(req.user.orgId);
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json({
      ok: true,
      gps: {
        maxAccuracyM: gps.maxAccuracyM,
        intervalSec: gps.intervalSec,
      },
    });
  });

  /** Subir / cambiar icono de perfil */
  router.post('/avatar', authMiddleware, prepareAvatarUploadDir, (req, res) => {
    uploadAvatar(req, res, async (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'La foto supera el límite de 3 MB'
            : err.message || 'No se pudo subir la foto';
        return res.status(400).json({ ok: false, error: msg });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Imagen requerida (campo avatar)' });
      }
      try {
        // Confirmar que el contenido es imagen aunque el mime haya llegado vacío
        if (!sniffUploadedAvatar(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {
            /* ignore */
          }
          return res.status(400).json({
            ok: false,
            error: 'Formato no válido. Usa JPG, PNG o WebP',
          });
        }

        const stored = storedUploadRel(req) || req.file.filename;
        const { rows: prev } = await query(`SELECT avatar_url FROM users WHERE id = $1`, [
          req.user.sub,
        ]);
        const old = prev[0]?.avatar_url;
        const { rows } = await query(
          `UPDATE users SET avatar_url = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, username, email, display_name, role, organization_id,
                     can_receive_panic, must_change_password, avatar_url`,
          [req.user.sub, stored]
        );
        const u = rows[0];
        if (old && old !== stored) await removeOldAvatarFile(old);
        await logActivity({
          organizationId: req.user.orgId,
          actorId: req.user.sub,
          action: 'user.avatar',
          entityType: 'user',
          entityId: req.user.sub,
        });
        res.json({
          ok: true,
          avatarUrl: mapAvatarUrl(u.avatar_url),
          user: {
            id: u.id,
            username: u.username,
            email: u.email,
            displayName: u.display_name,
            role: u.role,
            organizationId: u.organization_id,
            canReceivePanic: Boolean(u.can_receive_panic),
            mustChangePassword: Boolean(u.must_change_password),
            avatarUrl: mapAvatarUrl(u.avatar_url),
          },
        });
      } catch (e) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        res.status(500).json({ ok: false, error: 'No se pudo guardar el icono' });
      }
    });
  });

  /** Quitar icono (vuelve a inicial) */
  router.delete('/avatar', authMiddleware, async (req, res) => {
    const { rows: prev } = await query(`SELECT avatar_url FROM users WHERE id = $1`, [req.user.sub]);
    const old = prev[0]?.avatar_url;
    await query(`UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`, [
      req.user.sub,
    ]);
    await removeOldAvatarFile(old);
    res.json({ ok: true, avatarUrl: null });
  });

  return router;
}

/** GET avatar por userId (Bearer o ?atk= ticket corto) — para <img> en mapa */
export function createAvatarsRouter() {
  const router = Router();

  router.get('/file/:filename', authFromHeaderOrQuery, async (req, res) => {
    let stored = '';
    try {
      stored = decodeURIComponent(req.params.filename || '');
    } catch {
      stored = req.params.filename || '';
    }
    stored = stored.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!stored || stored.includes('..')) {
      return res.status(400).json({ ok: false, error: 'Archivo no válido' });
    }
    const { rows: u } = await query(
      `SELECT id FROM users WHERE avatar_url = $1 AND organization_id = $2 AND is_active = TRUE LIMIT 1`,
      [stored, req.user.orgId]
    );
    if (!u[0]) {
      const { rows: g } = await query(
        `SELECT id FROM groups WHERE avatar_url = $1 AND organization_id = $2 AND is_active = TRUE LIMIT 1`,
        [stored, req.user.orgId]
      );
      if (!g[0]) {
        // legado: solo basename
        const base = path.basename(stored);
        const { rows: u2 } = await query(
          `SELECT id FROM users WHERE avatar_url = $1 AND organization_id = $2 AND is_active = TRUE LIMIT 1`,
          [base, req.user.orgId]
        );
        if (!u2[0]) {
          const { rows: g2 } = await query(
            `SELECT id FROM groups WHERE avatar_url = $1 AND organization_id = $2 AND is_active = TRUE LIMIT 1`,
            [base, req.user.orgId]
          );
          if (!g2[0]) return res.status(404).json({ ok: false, error: 'Icono no encontrado' });
          stored = base;
        } else {
          stored = base;
        }
      }
    }
    const disk = mediaDiskPath(stored);
    if (!fs.existsSync(disk)) return res.status(404).json({ ok: false, error: 'Archivo ausente' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(disk);
  });

  router.get('/group/:groupId', authFromHeaderOrQuery, async (req, res) => {
    const { rows } = await query(
      `SELECT id, avatar_url, organization_id FROM groups
       WHERE id = $1 AND is_active = TRUE`,
      [req.params.groupId]
    );
    const g = rows[0];
    if (!g || g.organization_id !== req.user.orgId) {
      return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
    }
    if (!g.avatar_url) return res.status(404).json({ ok: false, error: 'Sin icono' });
    const disk = mediaDiskPath(g.avatar_url);
    if (!fs.existsSync(disk)) return res.status(404).json({ ok: false, error: 'Archivo ausente' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(disk);
  });

  router.get('/:userId', authFromHeaderOrQuery, async (req, res) => {
    const { rows } = await query(
      `SELECT id, avatar_url, organization_id FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [req.params.userId]
    );
    const u = rows[0];
    if (!u || u.organization_id !== req.user.orgId) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    if (!u.avatar_url) return res.status(404).json({ ok: false, error: 'Sin icono' });
    const disk = mediaDiskPath(u.avatar_url);
    if (!fs.existsSync(disk)) return res.status(404).json({ ok: false, error: 'Archivo ausente' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(disk);
  });

  return router;
}
