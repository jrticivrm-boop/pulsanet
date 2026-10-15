import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isDispatch } from '../services/roles.js';
import { geoSearch, geoReverse, geoPlaceOutline } from '../services/geoSearch.js';

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
  const out = await geoSearch(q, {
    lat: biasOk ? lat : null,
    lng: biasOk ? lng : null,
    world: req.query.world === '1',
  });
  res.json(out);
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

/** Contorno de un ejido/comunidad del catálogo propio ([[lat,lng], …] por anillo). */
router.get('/places/:id/outline', async (req, res) => {
  const outline = await geoPlaceOutline(req.params.id);
  if (!outline) return res.status(404).json({ ok: false, error: 'Sin contorno' });
  res.set('Cache-Control', 'private, max-age=86400');
  res.json({ ok: true, outline });
});
