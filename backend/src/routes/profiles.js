import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../db.js';
import {
  assertProfileManager,
  createProfile,
  deleteProfile,
  listProfiles,
  profileCatalog,
  updateProfile,
} from '../services/profiles.js';
import {
  canChooseLocationShare,
  canManageUsers,
  isRoot,
  normalizeRole,
  shareOptionsForRole,
} from '../services/roles.js';
import { loadAdminScope } from '../services/orgUnits.js';

export const profilesRouter = Router();
profilesRouter.use(authMiddleware);

/** Lectura: gestores de usuarios (nombres en Usuarios). Escritura: solo root. */
profilesRouter.get('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Sin permiso para listar perfiles' });
    }
    const profiles = await listProfiles(req.user.orgId);
    res.json({ ok: true, ...profileCatalog(), profiles });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
  }
});

profilesRouter.post('/', async (req, res) => {
  try {
    assertProfileManager(req.user.role);
    const profile = await createProfile(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, profile });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
  }
});

/** Nivel de compartición de ubicación (solo administradores de región/zona/unidad). */
profilesRouter.patch('/location-share/:userId', async (req, res) => {
  const share = String(req.body?.locationShare || '').trim();
  const allowed = new Set(['region', 'zone', 'unit', 'hidden', 'peers']);
  if (!allowed.has(share)) {
    return res.status(400).json({ ok: false, error: 'Nivel de ubicación inválido' });
  }
  const { rows } = await query(
    `SELECT id, role, unit_id, admin_scope_unit_id FROM users
     WHERE id = $1 AND organization_id = $2`,
    [req.params.userId, req.user.orgId]
  );
  const target = rows[0];
  if (!target) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  const self = String(target.id) === String(req.user.sub);
  if (!self && !isRoot(req.user.role)) {
    const scope = await loadAdminScope(req.user);
    if (!scope.orgWide) {
      const ids = new Set(scope.unitIds || []);
      const hit =
        (target.unit_id && ids.has(target.unit_id)) ||
        (target.admin_scope_unit_id && ids.has(target.admin_scope_unit_id));
      if (!hit) return res.status(403).json({ ok: false, error: 'Fuera de tu alcance' });
    }
  }
  const role = normalizeRole(target.role);
  if (!canChooseLocationShare(role)) {
    return res.status(403).json({ ok: false, error: 'Ese perfil no puede ocultar ni elegir nivel' });
  }
  const opts = shareOptionsForRole(role).map((o) => o.value);
  if (opts.length && !opts.includes(share)) {
    return res.status(400).json({ ok: false, error: 'Ese nivel no corresponde a su jerarquía' });
  }
  await query(`UPDATE users SET location_share = $2, updated_at = NOW() WHERE id = $1`, [
    target.id,
    share,
  ]);
  res.json({ ok: true, locationShare: share });
});

profilesRouter.patch('/:id', async (req, res) => {
  try {
    assertProfileManager(req.user.role);
    const profile = await updateProfile(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
  }
});

profilesRouter.delete('/:id', async (req, res) => {
  try {
    assertProfileManager(req.user.role);
    await deleteProfile(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || 'Error' });
  }
});
