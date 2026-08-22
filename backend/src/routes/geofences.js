import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { isDispatch } from '../services/roles.js';

function requireDispatch(req, res, next) {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root, admin o despachador' });
  }
  next();
}

function mapFence(r) {
  return {
    id: r.id,
    name: r.name,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    radiusM: r.radius_m,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export const geofencesRouter = Router();
geofencesRouter.use(authMiddleware);
geofencesRouter.use(requireDispatch);

geofencesRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, center_lat, center_lng, radius_m, is_active, created_at
     FROM geofences
     WHERE organization_id = $1
     ORDER BY name`,
    [req.user.orgId]
  );
  res.json({ ok: true, geofences: rows.map(mapFence) });
});

geofencesRouter.post('/', async (req, res) => {
  const { name, centerLat, centerLng, radiusM } = req.body || {};
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n || n.length > 120) {
    return res.status(400).json({ ok: false, error: 'name requerido (máx 120)' });
  }
  if (typeof centerLat !== 'number' || typeof centerLng !== 'number') {
    return res.status(400).json({ ok: false, error: 'centerLat y centerLng numéricos' });
  }
  if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) {
    return res.status(400).json({ ok: false, error: 'Coordenadas fuera de rango' });
  }
  const radius = Number(radiusM);
  if (!Number.isFinite(radius) || radius <= 0 || radius > 50000) {
    return res.status(400).json({ ok: false, error: 'radiusM entre 1 y 50000' });
  }

  const { rows } = await query(
    `INSERT INTO geofences (organization_id, name, center_lat, center_lng, radius_m)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, center_lat, center_lng, radius_m, is_active, created_at`,
    [req.user.orgId, n, centerLat, centerLng, radius]
  );

  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'geofence.create',
    entityType: 'geofence',
    entityId: rows[0].id,
    meta: { name: n, radiusM: radius },
  });

  res.status(201).json({ ok: true, geofence: mapFence(rows[0]) });
});

geofencesRouter.patch('/:id', async (req, res) => {
  const { name, centerLat, centerLng, radiusM, isActive } = req.body || {};
  const { rows: existing } = await query(
    `SELECT id FROM geofences WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!existing[0]) {
    return res.status(404).json({ ok: false, error: 'Geocerca no encontrada' });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  if (typeof name === 'string' && name.trim()) {
    sets.push(`name = $${i++}`);
    vals.push(name.trim());
  }
  if (typeof centerLat === 'number' && typeof centerLng === 'number') {
    sets.push(`center_lat = $${i++}`, `center_lng = $${i++}`);
    vals.push(centerLat, centerLng);
  }
  if (radiusM != null) {
    const radius = Number(radiusM);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 50000) {
      return res.status(400).json({ ok: false, error: 'radiusM entre 1 y 50000' });
    }
    sets.push(`radius_m = $${i++}`);
    vals.push(radius);
  }
  if (typeof isActive === 'boolean') {
    sets.push(`is_active = $${i++}`);
    vals.push(isActive);
  }
  if (!sets.length) {
    return res.status(400).json({ ok: false, error: 'Nada que actualizar' });
  }

  vals.push(req.params.id, req.user.orgId);
  const { rows } = await query(
    `UPDATE geofences SET ${sets.join(', ')}
     WHERE id = $${i++} AND organization_id = $${i}
     RETURNING id, name, center_lat, center_lng, radius_m, is_active, created_at`,
    vals
  );

  res.json({ ok: true, geofence: mapFence(rows[0]) });
});

geofencesRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM geofences WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  if (!rowCount) {
    return res.status(404).json({ ok: false, error: 'Geocerca no encontrada' });
  }
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'geofence.delete',
    entityType: 'geofence',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});
