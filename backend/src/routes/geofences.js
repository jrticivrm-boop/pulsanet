import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { isDispatch } from '../services/roles.js';

const DEFAULT_GEOFENCE_COLOR = '#243d20';

function requireDispatch(req, res, next) {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root, admin o despachador' });
  }
  next();
}

/** Hex seguro #rgb / #rrggbb → #rrggbb en minúsculas, o null. */
function normalizeHexColor(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

function mapFence(r) {
  return {
    id: r.id,
    name: r.name,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    radiusM: r.radius_m,
    color: normalizeHexColor(r.color) || DEFAULT_GEOFENCE_COLOR,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

const FENCE_COLS =
  'id, name, center_lat, center_lng, radius_m, color, is_active, created_at';

export const geofencesRouter = Router();
geofencesRouter.use(authMiddleware);
geofencesRouter.use(requireDispatch);

geofencesRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${FENCE_COLS}
     FROM geofences
     WHERE organization_id = $1
     ORDER BY name`,
    [req.user.orgId]
  );
  res.json({ ok: true, geofences: rows.map(mapFence) });
});

geofencesRouter.post('/', async (req, res) => {
  const { name, centerLat, centerLng, radiusM, color } = req.body || {};
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
  let col = DEFAULT_GEOFENCE_COLOR;
  if (color != null && String(color).trim() !== '') {
    const normalized = normalizeHexColor(color);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'color inválido (usa #RRGGBB)' });
    }
    col = normalized;
  }

  const { rows } = await query(
    `INSERT INTO geofences (organization_id, name, center_lat, center_lng, radius_m, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${FENCE_COLS}`,
    [req.user.orgId, n, centerLat, centerLng, radius, col]
  );

  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'geofence.create',
    entityType: 'geofence',
    entityId: rows[0].id,
    meta: { name: n, radiusM: radius, color: col },
  });

  res.status(201).json({ ok: true, geofence: mapFence(rows[0]) });
});

geofencesRouter.patch('/:id', async (req, res) => {
  const { name, centerLat, centerLng, radiusM, isActive, color } = req.body || {};
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
  if (color != null) {
    const normalized = normalizeHexColor(color);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'color inválido (usa #RRGGBB)' });
    }
    sets.push(`color = $${i++}`);
    vals.push(normalized);
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
     RETURNING ${FENCE_COLS}`,
    vals
  );

  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'geofence.update',
    entityType: 'geofence',
    entityId: rows[0].id,
    meta: { name: rows[0].name, radiusM: rows[0].radius_m, color: rows[0].color },
  });

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
