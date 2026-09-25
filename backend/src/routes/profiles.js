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
  canManageUsers,
} from '../services/roles.js';
import { invalidateUsersWithProfile } from '../services/userProfile.js';

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

/** Nivel de compartición: Alcance 3 — nadie oculta ni ajusta ubicación. */
profilesRouter.patch('/location-share/:userId', async (_req, res) => {
  return res.status(403).json({
    ok: false,
    error:
      'La ubicación ya no se oculta ni se ajusta manualmente; solo aplica la jerarquía del mapa.',
  });
});

profilesRouter.patch('/:id', async (req, res) => {
  try {
    assertProfileManager(req.user.role);
    const profile = await updateProfile(req.user.orgId, req.params.id, req.body || {});
    await invalidateUsersWithProfile(profile?.id || req.params.id);
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
