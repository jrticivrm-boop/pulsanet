import { query } from '../db.js';
import { normalizeModules } from './profiles.js';

const CACHE_TTL_MS = 15_000;
/** @type {Map<string, { at: number, profile: object|null }>} */
const cache = new Map();

/**
 * Perfil activo desde BD (nombre al aire, rol, org, módulos del access_profile).
 * Evita displayName/role congelados en el JWT tras altas o ediciones.
 */
export async function loadUserProfile(userId) {
  if (!userId) return null;
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;

  const { rows } = await query(
    `SELECT u.id, u.organization_id, u.username, u.email, u.display_name, u.role,
            u.is_active, u.avatar_url, p.modules AS profile_modules
     FROM users u
     LEFT JOIN access_profiles p ON p.id = u.profile_id
     WHERE u.id = $1`,
    [userId]
  );
  const u = rows[0];
  const profile = !u
    ? null
    : {
        sub: u.id,
        username: u.username,
        email: u.email,
        displayName: u.display_name || 'Usuario',
        role: u.role,
        orgId: u.organization_id,
        isActive: Boolean(u.is_active),
        avatarUrl: u.avatar_url || null,
        modules: normalizeModules(u.profile_modules || {}),
      };
  cache.set(key, { at: Date.now(), profile });
  return profile;
}

export function invalidateUserProfile(userId) {
  if (userId) cache.delete(String(userId));
}

/** Invalida caché de todos los usuarios con un profile_id (tras editar perfil). */
export async function invalidateUsersWithProfile(profileId) {
  if (!profileId) return;
  try {
    const { rows } = await query(`SELECT id FROM users WHERE profile_id = $1`, [profileId]);
    for (const r of rows) invalidateUserProfile(r.id);
  } catch {
    clearUserProfileCache();
  }
}

export function clearUserProfileCache() {
  cache.clear();
}

/** Fusiona claims JWT con perfil vivo de BD. */
export async function bindLiveUser(jwtPayload) {
  if (!jwtPayload?.sub) return null;
  const profile = await loadUserProfile(jwtPayload.sub);
  if (!profile || !profile.isActive) return null;
  return {
    ...jwtPayload,
    sub: profile.sub,
    username: profile.username || jwtPayload.username,
    email: profile.email ?? jwtPayload.email,
    displayName: profile.displayName,
    role: profile.role,
    orgId: profile.orgId,
    modules: profile.modules || {},
  };
}
