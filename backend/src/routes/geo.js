import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import { logActivity } from '../services/activity.js';
import { isAdmin, isDispatch } from '../services/roles.js';
import { geoSearch, geoReverse, geoAdminAt, geoPlaceOutline, geoOsmOutline, ownGeocoderStatus } from '../services/geoSearch.js';
import { ETA_MAX_ORIGINS, PLAN_MAX_STOPS, ownRoutingStatus, routeEta, routeOptions } from '../services/routeHint.js';

export const geoRouter = Router();
const router = geoRouter;
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!isDispatch(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' });
  }
  next();
});

function num(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Autocompletado: direcciones, calles, carreteras, localidades, municipios, estados y ejidos. */
router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  const biasOk = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const src = ['local', 'osm', 'propio', 'full'].includes(req.query.src) ? req.query.src : undefined;
  // La consola cancela al teclear otra letra: no seguir esperando turno ni salir a internet.
  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) ac.abort();
  });
  const out = await geoSearch(q, {
    lat: biasOk ? lat : null,
    lng: biasOk ? lng : null,
    world: req.query.world === '1',
    src,
    signal: ac.signal,
  });
  if (ac.signal.aborted) return;
  res.json(out);
});

let mapStatusCache = { at: 0, value: null };

/** Mapa propio de SICOM (respaldo sin internet): ¿responde? y de qué fecha son los datos. */
router.get('/estado', async (_req, res) => {
  if (!mapStatusCache.value || Date.now() - mapStatusCache.at > 5 * 60_000) {
    const [buscador, rutas] = await Promise.all([ownGeocoderStatus(), ownRoutingStatus()]);
    mapStatusCache = { at: Date.now(), value: { ok: true, buscador, rutas } };
  }
  res.json(mapStatusCache.value);
});

/** Catálogo nacional de estados (SEPOMEX / mx_postcodes) para formularios. */
router.get('/estados', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT c_estado::int AS code, MIN(estado) AS name
       FROM mx_postcodes
       GROUP BY c_estado
       ORDER BY MIN(estado)`
    );
    res.json({
      ok: true,
      estados: rows.map((r) => ({ code: r.code, name: r.name })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'No se pudieron listar estados' });
  }
});

/** Municipios de un estado (por nombre o c_estado). */
router.get('/municipios', async (req, res) => {
  const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
  const codeRaw = req.query.c_estado;
  const code = codeRaw != null && codeRaw !== '' ? Number(codeRaw) : null;
  if (!estado && !Number.isFinite(code)) {
    return res.status(400).json({ ok: false, error: 'estado o c_estado requerido' });
  }
  try {
    const { rows } = await query(
      `SELECT DISTINCT municipio AS name, c_mnpio::int AS code
       FROM mx_postcodes
       WHERE ($1::int IS NOT NULL AND c_estado = $1)
          OR ($1::int IS NULL AND LOWER(TRIM(estado)) = LOWER(TRIM($2)))
       ORDER BY municipio`,
      [Number.isFinite(code) ? code : null, estado || null]
    );
    res.json({
      ok: true,
      municipios: rows.map((r) => ({ name: r.name, code: r.code })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'No se pudieron listar municipios' });
  }
});

/** «¿Qué hay aquí?»: dirección aproximada y ejido que contiene el punto. */
router.get('/reverse', async (req, res) => {
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ ok: false, error: 'lat y lng requeridos' });
  }
  res.json(await geoReverse(lat, lng));
});

/** Estado, municipio, localidad, colonia, C.P. y ejido de unas coordenadas (alta de usuarios). */
router.get('/admin-at', async (req, res) => {
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ ok: false, error: 'lat y lng requeridos' });
  }
  res.json(await geoAdminAt(lat, lng));
});

/** Contorno de un ejido/comunidad del catálogo propio ([[lat,lng], …] por anillo). */
router.get('/places/:id/outline', async (req, res) => {
  const outline = await geoPlaceOutline(req.params.id);
  if (!outline) return res.status(404).json({ ok: false, error: 'Sin contorno' });
  res.set('Cache-Control', 'private, max-age=86400');
  res.json({ ok: true, outline });
});

function latLngParam(raw) {
  const [lat, lng] = String(raw || '').split(',').map(num);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Pestaña «Ruta»: cómo llegar de A a B (recomendada + alternativas).
 * `points=lat,lng;lat,lng;…` (A, paradas…, B) o `from` + `to`.
 */
router.get('/route', async (req, res) => {
  let points;
  if (typeof req.query.points === 'string') {
    points = req.query.points.split(';').map(latLngParam);
  } else {
    points = [latLngParam(req.query.from), latLngParam(req.query.to)];
  }
  if (points.length < 2 || points.length > PLAN_MAX_STOPS + 2 || points.some((p) => !p)) {
    return res.status(400).json({ ok: false, error: `De 2 a ${PLAN_MAX_STOPS + 2} puntos (lat,lng)` });
  }
  res.json(await routeOptions(points));
});

/** «¿Quién llega primero?»: tiempo por carretera de cada operador hasta el destino. */
router.post('/eta', async (req, res) => {
  const { to, origins } = req.body || {};
  const dest = to && latLngParam(`${to.lat},${to.lng}`);
  if (!dest || !Array.isArray(origins)) {
    return res.status(400).json({ ok: false, error: 'to {lat,lng} y origins [] requeridos' });
  }
  const list = [];
  for (const o of origins.slice(0, ETA_MAX_ORIGINS)) {
    const p = o && latLngParam(`${o.lat},${o.lng}`);
    if (p && typeof o.id === 'string' && o.id.length <= 64) list.push({ id: o.id, ...p });
  }
  res.json(await routeEta(dest, list));
});

/* --------------------------------------------- Rutas frecuentes (compartidas) */

function cleanRoutePoints(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > PLAN_MAX_STOPS + 2) return null;
  const out = [];
  for (const p of raw) {
    const ll = p && latLngParam(`${p.lat},${p.lng}`);
    if (!ll) return null;
    out.push({
      name: String(p.name || '').trim().slice(0, 160),
      detail: String(p.detail || '').trim().slice(0, 240),
      ...ll,
    });
  }
  return out;
}

function mapSavedRoute(r) {
  return {
    id: r.id,
    name: r.name,
    points: r.points,
    createdBy: r.created_by,
    createdByName: r.created_by_name || '',
    createdAt: r.created_at,
  };
}

router.get('/saved-routes', async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.points, s.created_by, s.created_at, u.display_name AS created_by_name
     FROM saved_routes s LEFT JOIN users u ON u.id = s.created_by
     WHERE s.organization_id = $1
     ORDER BY lower(s.name)`,
    [req.user.orgId]
  );
  res.json({ ok: true, routes: rows.map(mapSavedRoute) });
});

router.post('/saved-routes', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 120) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido (máx. 120)' });
  }
  const points = cleanRoutePoints(req.body?.points);
  if (!points) return res.status(400).json({ ok: false, error: 'Puntos inválidos' });
  const { rows } = await query(
    `INSERT INTO saved_routes (organization_id, name, points, created_by)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, name, points, created_by, created_at`,
    [req.user.orgId, name, JSON.stringify(points), req.user.sub]
  );
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'saved_route.create',
    entityType: 'saved_route',
    entityId: rows[0].id,
    meta: { name, points: points.length },
  });
  res.status(201).json({ ok: true, route: mapSavedRoute({ ...rows[0], created_by_name: req.user.displayName }) });
});

router.delete('/saved-routes/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, created_by FROM saved_routes WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user.orgId]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ ok: false, error: 'No encontrada' });
  if (row.created_by !== req.user.sub && !isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo quien la guardó o un administrador puede borrarla' });
  }
  await query(`DELETE FROM saved_routes WHERE id = $1`, [row.id]);
  await logActivity({
    organizationId: req.user.orgId,
    actorId: req.user.sub,
    action: 'saved_route.delete',
    entityType: 'saved_route',
    entityId: row.id,
    meta: { name: row.name },
  });
  res.json({ ok: true });
});

/** Límite de un municipio/estado/colonia de OpenStreetMap (ref «R5606424» / «W123»). */
router.get('/osm/:ref/outline', async (req, res) => {
  const outline = await geoOsmOutline(req.params.ref);
  if (!outline) return res.status(404).json({ ok: false, error: 'Sin contorno' });
  res.set('Cache-Control', 'private, max-age=86400');
  res.json({ ok: true, outline });
});
