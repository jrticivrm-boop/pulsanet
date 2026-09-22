import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { logActivity } from '../services/activity.js';
import {
  UPLOADS_DIR,
  mediaDiskPath,
  storedUploadRel,
  ensureUploadAbsDir,
} from '../services/uploads.js';
import {
  listTacticalSiteGroups,
  createTacticalSiteGroup,
  updateTacticalSiteGroup,
  deleteTacticalSiteGroup,
  listTacticalSites,
  createTacticalSite,
  updateTacticalSite,
  deleteTacticalSite,
  getTacticalSiteGroupIconRow,
  setTacticalSiteGroupIcon,
  clearTacticalSiteGroupIcon,
} from '../services/tacticalSites.js';

function requireDispatch(req, res, next) {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root, admin o despachador' });
  }
  next();
}

function sendErr(res, err) {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Error' });
}

function prepareTacticalIconDir(req, res, next) {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(400).json({ ok: false, error: 'Organización requerida' });
    const rel = path.posix.join('orgs', String(orgId), 'tactical-sites');
    ensureUploadAbsDir(rel);
    req.uploadRelDir = rel;
    next();
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'No se pudo preparar carpeta' });
  }
}

/** Instancia multer propia (no usar uploadMedia.single: uploadMedia ya es middleware `.single('file')`). */
const uploadGroupIcon = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      try {
        const abs = ensureUploadAbsDir(req.uploadRelDir || 'tmp');
        cb(null, abs);
      } catch (e) {
        cb(e);
      }
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 12) || '.png';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || '').split(';')[0].toLowerCase().trim();
    if (mime.startsWith('image/')) return cb(null, true);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if ((!mime || mime === 'application/octet-stream') && ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Solo PNG o JPG'));
  },
}).single('icon');

export const tacticalSitesRouter = Router();
tacticalSitesRouter.use(authMiddleware);
tacticalSitesRouter.use(requireDispatch);

tacticalSitesRouter.get('/groups', async (req, res) => {
  try {
    const groups = await listTacticalSiteGroups(req.user.orgId);
    res.json({ ok: true, groups });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.post('/groups', async (req, res) => {
  try {
    const group = await createTacticalSiteGroup(req.user.orgId, req.body || {});
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.group_create',
      entityType: 'tactical_site_group',
      entityId: group.id,
      meta: { name: group.name },
    });
    res.status(201).json({ ok: true, group });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.patch('/groups/:id', async (req, res) => {
  try {
    const group = await updateTacticalSiteGroup(req.user.orgId, req.params.id, req.body || {});
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.group_update',
      entityType: 'tactical_site_group',
      entityId: group.id,
      meta: { name: group.name },
    });
    res.json({ ok: true, group });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.delete('/groups/:id', async (req, res) => {
  try {
    await deleteTacticalSiteGroup(req.user.orgId, req.params.id);
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.group_delete',
      entityType: 'tactical_site_group',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

/** Icono de agrupación: todos los puntos de la agrupación lo usan en el mapa. */
tacticalSitesRouter.post('/groups/:id/icon', prepareTacticalIconDir, (req, res) => {
  uploadGroupIcon(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'El icono supera el límite de 5 MB'
          : err.message || 'Error al subir';
      return res.status(400).json({ ok: false, error: msg });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Imagen requerida (campo icon, PNG/JPG)' });
      }
      const prev = await getTacticalSiteGroupIconRow(req.user.orgId, req.params.id);
      if (!prev) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
      }
      const stored = storedUploadRel(req);
      const group = await setTacticalSiteGroupIcon(req.user.orgId, req.params.id, stored);
      if (prev.icon_url && prev.icon_url !== stored) {
        const oldPath = mediaDiskPath(prev.icon_url);
        if (oldPath.startsWith(UPLOADS_DIR) && fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            /* ignore */
          }
        }
      }
      await logActivity({
        organizationId: req.user.orgId,
        actorId: req.user.sub,
        action: 'tactical_site.group_icon',
        entityType: 'tactical_site_group',
        entityId: group.id,
      });
      res.json({ ok: true, group });
    } catch (e) {
      sendErr(res, e);
    }
  });
});

tacticalSitesRouter.get('/groups/:id/icon', async (req, res) => {
  try {
    const row = await getTacticalSiteGroupIconRow(req.user.orgId, req.params.id);
    if (!row?.icon_url) return res.status(404).json({ ok: false, error: 'Sin icono' });
    const disk = mediaDiskPath(row.icon_url);
    if (!fs.existsSync(disk)) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    res.sendFile(disk);
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.delete('/groups/:id/icon', async (req, res) => {
  try {
    const old = await clearTacticalSiteGroupIcon(req.user.orgId, req.params.id);
    if (old) {
      const disk = mediaDiskPath(old);
      if (disk.startsWith(UPLOADS_DIR) && fs.existsSync(disk)) {
        try {
          fs.unlinkSync(disk);
        } catch {
          /* ignore */
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.get('/', async (req, res) => {
  try {
    const groupId = req.query.groupId || null;
    const sites = await listTacticalSites(req.user.orgId, { groupId });
    res.json({ ok: true, sites });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.post('/', async (req, res) => {
  try {
    const site = await createTacticalSite(req.user.orgId, req.body || {});
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.create',
      entityType: 'tactical_site',
      entityId: site.id,
      meta: { name: site.name, groupId: site.groupId },
    });
    res.status(201).json({ ok: true, site });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.patch('/:id', async (req, res) => {
  try {
    const site = await updateTacticalSite(req.user.orgId, req.params.id, req.body || {});
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.update',
      entityType: 'tactical_site',
      entityId: site.id,
      meta: { name: site.name },
    });
    res.json({ ok: true, site });
  } catch (err) {
    sendErr(res, err);
  }
});

tacticalSitesRouter.delete('/:id', async (req, res) => {
  try {
    await deleteTacticalSite(req.user.orgId, req.params.id);
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.sub,
      action: 'tactical_site.delete',
      entityType: 'tactical_site',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});
