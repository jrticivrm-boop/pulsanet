import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import {
  canPublishAnnouncements,
  canViewAnnouncements,
  createAnnouncement,
  listAnnouncements,
  listPendingAnnouncements,
  ackAnnouncement,
} from '../services/announcements.js';
import { logActivity } from '../services/activity.js';

export function createAnnouncementsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Pendientes de Enterado (web + app). */
  router.get('/pending', async (req, res) => {
    const list = await listPendingAnnouncements(req.user.sub, req.user.orgId);
    res.json({ ok: true, announcements: list });
  });

  router.post('/:id/ack', async (req, res) => {
    try {
      await ackAnnouncement(req.params.id, req.user.sub, req.user.orgId);
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
    }
  });

  /** Listado: consola con permiso ver. */
  router.get('/', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    if (!canViewAnnouncements(req.user)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso para ver avisos' });
    }
    const announcements = await listAnnouncements(req.user.orgId);
    res.json({ ok: true, announcements });
  });

  router.post('/', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const allowed = await canPublishAnnouncements(req.user);
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'Sin permiso para enviar avisos' });
    }
    try {
      const result = await createAnnouncement({
        orgId: req.user.orgId,
        actor: req.user,
        body: req.body?.body,
        audience: req.body?.audience,
        scopeUnitIds: req.body?.scopeUnitIds,
        targetIds: req.body?.targetIds,
        includeAdmins: req.body?.includeAdmins,
        io,
      });
      void logActivity({
        organizationId: req.user.orgId,
        actorId: req.user.sub,
        action: 'announcement.send',
        entityType: 'announcement',
        entityId: result.announcement.id,
        meta: {
          audience: result.announcement.audience,
          recipients: result.recipientCount,
        },
      });
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
    }
  });

  return router;
}
