import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDispatch } from '../socket/dispatch.js';
import { evaluateGeofences } from '../services/geofences.js';

export function createLocationsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Última ubicación de usuarios de la org (mapa despacho) */
  router.get('/', async (req, res) => {
    const { rows } = await query(
      `SELECT u.id AS user_id, u.display_name, u.role, u.is_active,
              l.latitude, l.longitude, l.accuracy_m, l.recorded_at
       FROM users u
       INNER JOIN user_last_location l ON l.user_id = u.id
       WHERE u.organization_id = $1 AND u.is_active = TRUE
       ORDER BY u.display_name`,
      [req.user.orgId]
    );
    res.json({
      ok: true,
      locations: rows.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        role: r.role,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracyM: r.accuracy_m,
        recordedAt: r.recorded_at,
      })),
    });
  });

  /** Historial de ruta de un usuario (mismo org) */
  router.get('/:userId/track', async (req, res) => {
    const hours = Math.min(Math.max(parseInt(req.query.hours || '8', 10) || 8, 1), 72);
    const { rows: users } = await query(
      `SELECT id, display_name FROM users
       WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
      [req.params.userId, req.user.orgId]
    );
    if (!users[0]) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    const { rows } = await query(
      `SELECT latitude, longitude, accuracy_m, recorded_at
       FROM locations
       WHERE user_id = $1 AND recorded_at > NOW() - make_interval(hours => $2)
       ORDER BY recorded_at ASC
       LIMIT 5000`,
      [req.params.userId, hours]
    );

    res.json({
      ok: true,
      user: { id: users[0].id, displayName: users[0].display_name },
      hours,
      points: rows.map((r) => ({
        latitude: r.latitude,
        longitude: r.longitude,
        accuracyM: r.accuracy_m,
        recordedAt: r.recorded_at,
      })),
    });
  });

  /** Reportar ubicación propia */
  router.post('/', async (req, res) => {
    const { latitude, longitude, accuracyM } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ ok: false, error: 'latitude y longitude numéricos requeridos' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ ok: false, error: 'Coordenadas fuera de rango' });
    }

    const { rows } = await query(
      `INSERT INTO locations (user_id, latitude, longitude, accuracy_m)
       VALUES ($1, $2, $3, $4)
       RETURNING id, latitude, longitude, accuracy_m, recorded_at`,
      [req.user.sub, latitude, longitude, accuracyM ?? null]
    );

    const loc = rows[0];
    emitDispatch(io, 'dispatch:location', {
      userId: req.user.sub,
      displayName: req.user.displayName || null,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracyM: loc.accuracy_m,
      recordedAt: loc.recorded_at,
    });

    let geofenceEvents = [];
    try {
      geofenceEvents = await evaluateGeofences(io, {
        orgId: req.user.orgId,
        userId: req.user.sub,
        displayName: req.user.displayName || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    } catch (err) {
      console.error('geofence eval:', err.message);
    }

    res.status(201).json({ ok: true, location: loc, geofenceEvents });
  });

  return router;
}
