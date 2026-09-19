import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitDispatchTrack } from '../socket/dispatch.js';
import { evaluateGeofences } from '../services/geofences.js';
import { isDispatch } from '../services/roles.js';
import { routeBetween } from '../services/routeHint.js';
import { loadUserTrack } from '../services/trackHistory.js';
import {
  getUserUnitId,
  loadTrackScope,
  listVisibleGroups,
  unitInTrackScope,
} from '../services/orgUnits.js';
import {
  getOrgPresenceThresholds,
  listOrgPresence,
  listPresence,
  pickBestFocus,
  resolvePresenceStatus,
  touchLastSeen,
} from '../services/presence.js';

function toIsoUtc(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mergePresenceRow(prev, next) {
  if (!prev) return { ...next };
  const focus = pickBestFocus([prev.focus, next.focus]);
  const awayCandidates = [prev, next]
    .filter((x) => x?.awaySince != null && (x.focus === 'background' || x.focus === 'service'))
    .map((x) => Number(x.awaySince))
    .filter((n) => Number.isFinite(n) && n > 0);
  let awaySince = null;
  if (focus === 'background' || focus === 'service') {
    awaySince = awayCandidates.length ? Math.min(...awayCandidates) : next.awaySince || prev.awaySince || null;
  }
  return {
    userId: next.userId || prev.userId,
    displayName: next.displayName || prev.displayName,
    focus,
    awaySince,
  };
}

async function buildOrgPresenceMap(orgId) {
  /** @type {Map<string, { userId: string, displayName: string, focus: string, awaySince?: number|null }>} */
  const presenceByUser = new Map();
  const { rows: groups } = await query(
    `SELECT id FROM groups WHERE organization_id = $1 AND is_active = TRUE`,
    [orgId]
  );
  for (const g of groups) {
    const members = await listPresence(g.id);
    for (const m of members) {
      presenceByUser.set(m.userId, mergePresenceRow(presenceByUser.get(m.userId), m));
    }
  }
  try {
    for (const m of await listOrgPresence(orgId)) {
      presenceByUser.set(m.userId, mergePresenceRow(presenceByUser.get(m.userId), m));
    }
  } catch {
    /* ignore */
  }
  return presenceByUser;
}

export function createLocationsRouter(io) {
  const router = Router();
  router.use(authMiddleware);

  /** Última ubicación: solo usuarios en el alcance (Región / zona / unidad). */
  router.get('/', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const scope = await loadTrackScope(req.user);
    if (!scope.orgWide && !scope.unitIds?.length) {
      return res.json({ ok: true, locations: [], scope: { level: scope.level } });
    }

    const rawGroupIds = String(req.query.groupIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let groupMemberFilter = '';
    const params = [req.user.orgId];

    if (rawGroupIds.length) {
      const visible = await listVisibleGroups(req.user);
      const allowed = new Set(visible.map((g) => g.id));
      const groupIds = rawGroupIds.filter((id) => allowed.has(id));
      if (!groupIds.length) {
        return res.json({
          ok: true,
          locations: [],
          scope: { level: scope.level, groupIds: [] },
        });
      }
      params.push(groupIds);
      groupMemberFilter = `AND u.id IN (
        SELECT gm.user_id FROM group_members gm
        WHERE gm.group_id = ANY($${params.length}::uuid[])
      )`;
    }

    let unitFilter = '';
    if (!scope.orgWide) {
      params.push(scope.unitIds);
      unitFilter = `AND u.unit_id = ANY($${params.length}::uuid[])`;
    }

    const { rows } = await query(
      `SELECT u.id AS user_id, u.display_name, u.cargo, u.role, u.is_active, u.avatar_url, u.unit_id,
              u.last_seen_at,
              l.latitude, l.longitude, l.accuracy_m, l.recorded_at
       FROM users u
       INNER JOIN user_last_location l ON l.user_id = u.id
       WHERE u.organization_id = $1 AND u.is_active = TRUE
       ${unitFilter}
       ${groupMemberFilter}
       ORDER BY u.display_name`,
      params
    );

    const thresholds = await getOrgPresenceThresholds(req.user.orgId);
    const {
      offlineRedMs,
      absenceMs,
      offlineRedMinutes,
      absenceMinutes,
      showAway,
      showOffline,
    } = thresholds;
    const presenceByUser = await buildOrgPresenceMap(req.user.orgId);
    const now = Date.now();

    res.json({
      ok: true,
      scope: {
        level: scope.level,
        orgWide: Boolean(scope.orgWide),
        unitCount: scope.orgWide ? null : scope.unitIds.length,
        groupIds: rawGroupIds.length ? rawGroupIds.filter(Boolean) : null,
      },
      presenceOfflineRedMinutes: offlineRedMinutes,
      presenceAbsenceMinutes: absenceMinutes,
      presenceShowAway: showAway,
      presenceShowOffline: showOffline,
      locations: rows.map((r) => {
        const online = presenceByUser.get(r.user_id);
        const focus = online?.focus || null;
        const awaySince = online?.awaySince ?? null;
        const lastSeenAt = toIsoUtc(r.last_seen_at);
        const recordedAt = toIsoUtc(r.recorded_at);
        return {
          userId: r.user_id,
          displayName: r.display_name,
          cargo: r.cargo || null,
          role: r.role,
          unitId: r.unit_id || null,
          avatarUrl: r.avatar_url
            ? `/api/avatars/file/${encodeURIComponent(r.avatar_url)}`
            : null,
          latitude: r.latitude,
          longitude: r.longitude,
          accuracyM: r.accuracy_m,
          recordedAt,
          lastSeenAt,
          focus,
          awaySince,
          presence: resolvePresenceStatus({
            focus,
            awaySince,
            lastSeenAt,
            recordedAt,
            offlineRedMs,
            absenceMs,
            showAway,
            showOffline,
            now,
          }),
        };
      }),
    });
  });

  /**
   * Ruta probable por calles entre el último fix antes de perder señal y el
   * primero al reconectar (tramo predictivo naranja del mapa).
   * Se declara antes de `/:userId/track` por claridad (no colisionan: 1 vs 2 segmentos).
   */
  router.get('/track-gap-route', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const parse = (raw) => {
      const [lat, lng] = String(raw || '')
        .split(',')
        .map((s) => Number(s.trim()));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng };
    };
    const from = parse(req.query.from);
    const to = parse(req.query.to);
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'from y to como "lat,lng" requeridos' });
    }
    const route = await routeBetween(from, to);
    res.json(route);
  });

  /** Historial de ruta — solo si el usuario está en el alcance de seguimiento. */
  router.get('/:userId/track', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }
    const hours = Math.min(Math.max(parseInt(req.query.hours || '8', 10) || 8, 1), 72);
    const { rows: users } = await query(
      `SELECT id, display_name, unit_id FROM users
       WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
      [req.params.userId, req.user.orgId]
    );
    if (!users[0]) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    const scope = await loadTrackScope(req.user);
    if (!unitInTrackScope(scope, users[0].unit_id)) {
      return res.status(403).json({ ok: false, error: 'Fuera de tu alcance de seguimiento' });
    }

    // Antes: `ORDER BY recorded_at ASC LIMIT 5000` devolvía solo las primeras ~6 h
    // de la ventana (el latido GPS es de 5 s) y cortaba el recorrido reciente.
    const track = await loadUserTrack({ userId: req.params.userId, hours });

    res.json({
      ok: true,
      user: { id: users[0].id, displayName: users[0].display_name },
      hours,
      ...track.meta,
      points: track.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyM: p.accuracyM,
        recordedAt: toIsoUtc(p.recordedAt),
        // Marcado por el servidor: el mapa no puede deducir huecos de la
        // traza simplificada. Solo se envía cuando hay hueco.
        ...(p.gapBefore
          ? { gapBefore: true, gapMeters: p.gapMeters, gapSeconds: p.gapSeconds }
          : null),
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
    void touchLastSeen(req.user.sub);

    const { rows: me } = await query(
      `SELECT avatar_url, unit_id, cargo FROM users WHERE id = $1`,
      [req.user.sub]
    );
    const avatarUrl = me[0]?.avatar_url
      ? `/api/avatars/file/${encodeURIComponent(me[0].avatar_url)}`
      : null;
    const unitId = me[0]?.unit_id || (await getUserUnitId(req.user.sub));
    const cargo = me[0]?.cargo || null;

    const loc = rows[0];
    emitDispatchTrack(
      io,
      'dispatch:location',
      {
        userId: req.user.sub,
        displayName: req.user.displayName || null,
        cargo,
        unitId: unitId || null,
        avatarUrl,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyM: loc.accuracy_m,
        recordedAt: toIsoUtc(loc.recorded_at),
      },
      { unitId }
    );

    let geofenceEvents = [];
    try {
      geofenceEvents = await evaluateGeofences(io, {
        orgId: req.user.orgId,
        userId: req.user.sub,
        displayName: req.user.displayName || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        unitId: unitId || null,
      });
    } catch (err) {
      console.error('geofence eval:', err.message);
    }

    res.status(201).json({ ok: true, location: loc, geofenceEvents });
  });

  return router;
}
