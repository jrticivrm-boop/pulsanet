import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { canSeePerson } from '../services/visibility.js';
import { routeBetween } from '../services/routeHint.js';
import { loadUserTrack } from '../services/trackHistory.js';
import { recordOwnLocation, validateCoords } from '../services/ownLocation.js';
import {
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
} from '../services/presence.js';
import { resolveOrgAffiliation } from '../services/orgAffiliation.js';

function toIsoUtc(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const EFECTIVOS_GRUPO_ORDER = ['personal', 'armamento', 'vehs_sb', 'vehs_cb', 'otros'];
const EFECTIVOS_VEH_TAG = { vehs_sb: 'S/B.', vehs_cb: 'C/B.' };

async function loadEfectivosCatalog(orgId) {
  const { rows } = await query(
    `SELECT id::text AS id, grupo, name FROM cat_efectivos
     WHERE organization_id = $1 AND is_active
     ORDER BY array_position($2::text[], grupo::text), sort_order, name`,
    [orgId, EFECTIVOS_GRUPO_ORDER]
  );
  return rows;
}

/** ["1 GG.", "2 Vehs. Cheyenne", "55 Fx."…] en orden del catálogo; omite conceptos vacíos o en cero. */
function efectivosItems(efectivos, catalog) {
  if (!efectivos || typeof efectivos !== 'object') return [];
  const filled = catalog
    .map((it) => ({ ...it, n: Number(efectivos[it.id]) }))
    .filter((it) => Number.isInteger(it.n) && it.n > 0);
  // S/B. / C/B. solo si el mismo vehículo trae cantidad en ambos grupos.
  const vehGrupos = new Map();
  for (const it of filled) {
    if (!EFECTIVOS_VEH_TAG[it.grupo]) continue;
    const key = it.name.toLowerCase();
    vehGrupos.set(key, (vehGrupos.get(key) || new Set()).add(it.grupo));
  }
  return filled.map((it) => {
    const tag = EFECTIVOS_VEH_TAG[it.grupo];
    if (!tag) return `${it.n} ${it.name}`;
    const both = vehGrupos.get(it.name.toLowerCase()).size > 1;
    return `${it.n} ${it.n === 1 ? 'Veh.' : 'Vehs.'} ${it.name}${both ? ` ${tag}` : ''}`;
  });
}

/** «1 GG., 2 OO., 2 Vehs. Cheyenne, 55 Fx. y 3 Cams.» */
function efectivosResumen(items) {
  if (!items.length) return null;
  const text = items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  return text.endsWith('.') ? text : `${text}.`;
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

  /** Última ubicación: alcance jerárquico + perfil + ocultar/share. App y consola. */
  router.get('/', async (req, res) => {
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
      // Adscripción a la unidad O membresía en canal de esa unidad (servicios sin unit_id).
      unitFilter = `AND (
        u.unit_id = ANY($${params.length}::uuid[])
        OR u.id IN (
          SELECT gm.user_id
          FROM group_members gm
          INNER JOIN groups g ON g.id = gm.group_id AND g.is_active = TRUE
          WHERE g.organization_id = $1
            AND g.unit_id = ANY($${params.length}::uuid[])
        )
      )`;
    }

    const { rows } = await query(
      `SELECT u.id AS user_id, u.display_name, u.grade, u.cargo, u.service_nombre, u.phone,
              u.service_geo_municipio, u.service_geo_estado, u.service_efectivos,
              u.role, u.is_active, u.avatar_url, u.unit_id,
              u.admin_scope_unit_id, u.location_share, u.last_seen_at,
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
    const { rows: prof } = await query(
      `SELECT p.visibility
       FROM users u
       LEFT JOIN access_profiles p ON p.id = u.profile_id
       WHERE u.id = $1`,
      [req.user.sub]
    );
    const viewer = {
      id: req.user.sub,
      role: req.user.role,
      profileVisibility: prof[0]?.visibility || null,
    };
    const visibleRows = rows.filter((r) =>
      canSeePerson(viewer, {
        id: r.user_id,
        role: r.role,
        locationShare: r.location_share,
      })
    );

    // Cache de adscripción por ancla (unit_id | admin_scope) para no N+1 idénticos.
    const affCache = new Map();
    async function affiliationFor(unitId, adminScopeUnitId) {
      const key = `${unitId || ''}|${adminScopeUnitId || ''}`;
      if (affCache.has(key)) return affCache.get(key);
      const aff = await resolveOrgAffiliation(req.user.orgId, {
        unitId,
        adminScopeUnitId,
      });
      affCache.set(key, aff);
      return aff;
    }

    const efectivosCatalog = visibleRows.some((r) => r.service_efectivos)
      ? await loadEfectivosCatalog(req.user.orgId)
      : [];

    const locations = [];
    for (const r of visibleRows) {
      const online = presenceByUser.get(r.user_id);
      const focus = online?.focus || null;
      const awaySince = online?.awaySince ?? null;
      const lastSeenAt = toIsoUtc(r.last_seen_at);
      const recordedAt = toIsoUtc(r.recorded_at);
      const aff = await affiliationFor(r.unit_id, r.admin_scope_unit_id);
      const efectivos = efectivosItems(r.service_efectivos, efectivosCatalog);
      locations.push({
        userId: r.user_id,
        displayName: r.display_name,
        grade: r.grade || null,
        cargo: r.cargo || null,
        serviceNombre: r.service_nombre || null,
        serviceGeoMunicipio: r.service_geo_municipio || null,
        serviceGeoEstado: r.service_geo_estado || null,
        efectivos,
        efectivosResumen: efectivosResumen(efectivos),
        phone: r.phone || null,
        role: r.role,
        unitId: r.unit_id || null,
        unitName: aff.unitName,
        zoneName: aff.zoneName,
        regionName: aff.regionName,
        affiliationLabel: aff.label,
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
      });
    }

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
      locations,
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
    const headingRaw = Number(req.query.heading);
    const headingDeg = Number.isFinite(headingRaw) ? headingRaw : null;
    const route = await routeBetween(from, to, { headingDeg });
    res.json(route);
  });

  /** Historial de ruta — solo si el usuario está en el alcance de seguimiento. */
  router.get('/:userId/track', async (req, res) => {
    if (!isDispatch(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso' });
    }

    /** Ventana: span ≤ 30 d; mirada atrás ≤ 31 d; sin futuro. */
    const TRACK_SPAN_MAX_MS = 30 * 24 * 3600 * 1000;
    const TRACK_LOOKBACK_MS = 31 * 24 * 3600 * 1000;
    const now = Date.now();
    const earliest = now - TRACK_LOOKBACK_MS;

    let fromIso = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    let toIso = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    let hours = Math.min(
      Math.max(parseInt(req.query.hours || '8', 10) || 8, 1),
      31 * 24
    );

    let fromDate;
    let toDate;
    if (fromIso || toIso) {
      if (!fromIso || !toIso) {
        return res.status(400).json({ ok: false, error: 'Indica from y to (ISO) juntos' });
      }
      fromDate = new Date(fromIso);
      toDate = new Date(toIso);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ ok: false, error: 'from/to inválidos' });
      }
      let fromMs = fromDate.getTime();
      let toMs = toDate.getTime();
      if (toMs > now) toMs = now;
      if (fromMs < earliest) fromMs = earliest;
      if (toMs < earliest) toMs = earliest;
      if (fromMs > toMs) {
        return res.status(400).json({ ok: false, error: 'from debe ser anterior a to' });
      }
      if (toMs - fromMs > TRACK_SPAN_MAX_MS) {
        fromMs = toMs - TRACK_SPAN_MAX_MS;
      }
      fromDate = new Date(fromMs);
      toDate = new Date(toMs);
      hours = Math.max(1, Math.ceil((toMs - fromMs) / 3600000));
    } else {
      toDate = new Date(now);
      fromDate = new Date(Math.max(earliest, now - hours * 3600 * 1000));
    }

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

    const track = await loadUserTrack({
      userId: req.params.userId,
      from: fromDate,
      to: toDate,
    });

    res.json({
      ok: true,
      user: { id: users[0].id, displayName: users[0].display_name },
      hours,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
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
    const { latitude, longitude, accuracyM, presence } = req.body || {};
    const bad = validateCoords(latitude, longitude);
    if (bad) return res.status(400).json({ ok: false, error: bad });

    const { loc, geofenceEvents } = await recordOwnLocation(
      io,
      req.user,
      { latitude, longitude, accuracyM },
      { presence: presence === true }
    );
    res.status(201).json({ ok: true, location: loc, geofenceEvents });
  });

  return router;
}
