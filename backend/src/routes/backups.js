import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin, isRoot } from '../services/roles.js';
import {
  createBackup,
  deleteBackup,
  getBackupPath,
  getBackupPublicInfo,
  restoreFromArchive,
  restoreNamedBackup,
  updateBackupConfig,
  UPLOAD_DIR,
} from '../services/backup.js';

export const backupsRouter = Router();
backupsRouter.use(authMiddleware);

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root o admin' });
  }
  next();
}

function requireRoot(req, res, next) {
  if (!isRoot(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root puede restaurar respaldos' });
  }
  next();
}

backupsRouter.use(requireAdmin);

const upload = multer({
  dest: UPLOAD_DIR,
  // Default 2 GB para ZIP con multimedia; override con BACKUP_UPLOAD_MAX_MB
  limits: { fileSize: (Number(process.env.BACKUP_UPLOAD_MAX_MB) || 2048) * 1024 * 1024 },
});

backupsRouter.get('/', (_req, res) => {
  res.json({ ok: true, ...getBackupPublicInfo() });
});

backupsRouter.get('/config', (_req, res) => {
  res.json({ ok: true, config: getBackupPublicInfo().config });
});

backupsRouter.put('/config', (req, res) => {
  const config = updateBackupConfig(req.body || {});
  res.json({ ok: true, config });
});

backupsRouter.post('/run', async (_req, res) => {
  try {
    const result = await createBackup({ manual: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

backupsRouter.get('/download/:filename', (req, res) => {
  const full = getBackupPath(req.params.filename);
  if (!full) return res.status(404).json({ ok: false, error: 'No encontrado' });
  res.download(full, path.basename(full));
});

backupsRouter.delete('/:filename', (req, res) => {
  try {
    deleteBackup(req.params.filename);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Restaurar = DROP SCHEMA: solo root + confirm RESTAURAR */
backupsRouter.post('/restore/:filename', requireRoot, async (req, res) => {
  try {
    if (String(req.body?.confirm || '').trim() !== 'RESTAURAR') {
      return res.status(400).json({
        ok: false,
        error: 'Confirmación requerida: envía confirm: "RESTAURAR"',
      });
    }
    const result = await restoreNamedBackup(req.params.filename);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

backupsRouter.post('/restore-upload', requireRoot, upload.single('sqlfile'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: 'Falta archivo' });
  const tmp = file.path;
  try {
    const confirm =
      String(req.body?.confirm || req.query?.confirm || '').trim() ||
      String(req.headers['x-tacticalptx-restore-confirm'] || '').trim();
    if (confirm !== 'RESTAURAR') {
      return res.status(400).json({
        ok: false,
        error: 'Confirmación requerida: envía confirm: "RESTAURAR"',
      });
    }
    const name = String(file.originalname || '').toLowerCase();
    if (!/\.(zip|sql)$/i.test(name)) {
      return res.status(400).json({ ok: false, error: 'Solo .zip o .sql' });
    }
    const result = await restoreFromArchive(tmp, { createSafetyBackup: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    try {
      if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
});
