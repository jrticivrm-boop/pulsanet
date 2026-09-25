import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { config } from '../config.js';
import { authMiddleware, signAccessToken } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { logUserEvent, logPresenceTransition, clearPresenceEventState } from '../services/userEvents.js';
import { normalizeUsername } from '../services/rfcUsername.js';
import { validateNewPassword } from '../services/tempPassword.js';
import { isWireEncryptionEnabled } from '../services/wireCrypto.js';
import {
  isLockdownActive,
  registerLoginFailure,
  loginFailureClientPayload,
  clearLoginFailuresForUser,
  clientIpFromReq,
  isLoginLockExempt,
} from '../services/intrusion.js';
import { mintAvatarTicket } from '../services/avatarTicket.js';
import { isAdmin, isDispatch, isRoot } from '../services/roles.js';
import {
  normalizeDeviceId,
  notifySessionReplaced,
} from '../services/sessionPolicy.js';
import { loadUserProfile } from '../services/userProfile.js';
import { normalizeModules } from '../services/profiles.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_MAX || '25', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de acceso. Espera unos minutos.' },
});

/**
 * Wire: solo flag para consola de despacho. La clave AES se entrega en
 * dispatch:joined (por socket), no en login/me/refresh.
 */
function cryptoSessionPayload(user) {
  if (!isWireEncryptionEnabled()) return undefined;
  if (!user || !isDispatch(user.role)) return undefined;
  return {
    alg: 'aes-256-gcm',
    wireEnabled: true,
  };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function parseDurationToMs(spec) {
  const m = String(spec || '7d').match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[u] || mult.d);
}

async function issueRefreshToken(userId, deviceId = null) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + parseDurationToMs(config.jwtRefreshExpiresIn));
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_id)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt, deviceId]
  );
  return raw;
}

function mapPublicUser(user) {
  const modules =
    user.modules && typeof user.modules === 'object'
      ? user.modules
      : user.profile_modules && typeof user.profile_modules === 'object'
        ? user.profile_modules
        : undefined;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    organizationId: user.organization_id,
    canReceivePanic: Boolean(user.can_receive_panic),
    mustChangePassword: Boolean(user.must_change_password),
    avatarUrl: user.avatar_url ? `/api/avatars/file/${encodeURIComponent(user.avatar_url)}` : null,
    unitId: user.unit_id || null,
    adminScopeUnitId: user.admin_scope_unit_id || null,
    canSeeRegion: Boolean(user.can_see_region),
    canSeeZones: Boolean(user.can_see_zones),
    canSeeUnits: Boolean(user.can_see_units),
    ...(modules ? { modules } : {}),
  };
}

function sessionExtras(user) {
  try {
    const { ticket, expiresIn: avatarTicketExpiresIn } = mintAvatarTicket({
      id: user.id,
      organization_id: user.organization_id,
      sub: user.id,
      orgId: user.organization_id,
    });
    return {
      avatarTicket: ticket,
      avatarTicketExpiresIn,
      crypto: cryptoSessionPayload(user),
    };
  } catch {
    return { crypto: cryptoSessionPayload(user) };
  }
}

const USER_SELECT =
  'id, organization_id, username, email, password_hash, display_name, role, is_active, can_receive_panic, must_change_password, avatar_url, unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units, login_fail_count, login_locked_at, login_locked_reason';

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  const rawLogin = req.body?.username ?? req.body?.login ?? req.body?.email;
  if (!rawLogin || !password) {
    return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });
  }

  const loginRaw = String(rawLogin).trim();
  const isEmail = loginRaw.includes('@');
  const username = normalizeUsername(loginRaw);

  // Lockdown global solo emergencia manual — sigue bloqueando login si está activo
  if (await isLockdownActive()) {
    return res.status(503).json({
      ok: false,
      error: 'Servicio bloqueado por seguridad (lockdown)',
      lockdown: true,
    });
  }

  let user;
  try {
    const { rows } = await query(
      isEmail
        ? `SELECT ${USER_SELECT} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`
        : `SELECT ${USER_SELECT} FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [isEmail ? loginRaw.toLowerCase() : username]
    );
    user = rows[0];
  } catch (err) {
    // Compat: si aún no corrió migración 030, reintentar sin columnas nuevas
    if (String(err.message || '').includes('login_locked') || String(err.code) === '42703') {
      const { rows } = await query(
        isEmail
          ? `SELECT id, organization_id, username, email, password_hash, display_name, role, is_active, can_receive_panic, must_change_password, avatar_url, unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`
          : `SELECT id, organization_id, username, email, password_hash, display_name, role, is_active, can_receive_panic, must_change_password, avatar_url, unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [isEmail ? loginRaw.toLowerCase() : username]
      );
      user = rows[0];
    } else {
      throw err;
    }
  }

  if (user?.login_locked_at) {
    // Perfil Administrador (root): no aplicar bloqueo por intentos.
    if (isLoginLockExempt(user.role) || isRoot(user.role)) {
      try {
        await query(
          `UPDATE users
           SET login_locked_at = NULL,
               login_locked_reason = NULL,
               login_fail_count = 0,
               updated_at = NOW()
           WHERE id = $1`,
          [user.id]
        );
        user = { ...user, login_locked_at: null, login_locked_reason: null, login_fail_count: 0 };
      } catch (err) {
        console.error('clear root login lock:', err.message);
      }
    } else {
      return res.status(423).json({
        ok: false,
        error:
          'Tu usuario ha sido bloqueado por exceso de intentos. Contacta a un administrador para liberarlo.',
        code: 'USER_LOCKED',
        locked: true,
        warn: true,
        attemptsRemaining: 0,
      });
    }
  }

  if (!user || !user.is_active) {
    const result = await registerLoginFailure(req, {
      user: null,
      usernameAttempt: loginRaw,
    });
    const { status, body } = loginFailureClientPayload(result);
    return res.status(status).json(body);
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const result = await registerLoginFailure(req, { user });
    const { status, body } = loginFailureClientPayload(result);
    return res.status(status).json(body);
  }

  // Consola web: solo administradores. Móvil no envía client=web.
  const clientHint = String(
    req.body?.client || req.get('x-tacticalptx-client') || ''
  ).toLowerCase();
  const isWebConsole =
    clientHint === 'web' || clientHint === 'dispatch' || clientHint === 'console';
  if (isWebConsole && !isDispatch(user.role)) {
    return res.status(403).json({
      ok: false,
      error:
        'Tu usuario solo puede ingresar desde la aplicación móvil. La consola web es para administradores.',
      code: 'WEB_APP_ONLY',
      appOnly: true,
    });
  }

  await clearLoginFailuresForUser(user);

  await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

  const deviceId = normalizeDeviceId(req.body?.deviceId);

  // No-admin/root: una sesión por dispositivo. Solo revoca OTROS equipos.
  // Sin deviceId (cliente viejo): no tumbar sesiones abiertas (web/app siguen dentro).
  let singleSession = false;
  if (!isAdmin(user.role) && deviceId) {
    singleSession = true;
    await query(
      `DELETE FROM refresh_tokens
       WHERE user_id = $1 AND (device_id IS NULL OR device_id <> $2)`,
      [user.id, deviceId]
    );
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND device_id = $2`, [
      user.id,
      deviceId,
    ]);
    await notifySessionReplaced(user.id, user.role, { exceptDeviceId: deviceId });
  }

  await logActivity({
    organizationId: user.organization_id,
    actorId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    meta: {
      username: user.username,
      mustChangePassword: Boolean(user.must_change_password),
      singleSession,
      deviceId: deviceId || null,
      sourceIp: clientIpFromReq(req),
    },
  });
  void logUserEvent({
    organizationId: user.organization_id,
    subjectUserId: user.id,
    kind: 'session',
    summary: 'Inició sesión',
    meta: { deviceId: deviceId || null },
  });
  void logPresenceTransition({
    organizationId: user.organization_id,
    subjectUserId: user.id,
    status: 'online',
    summary: 'En línea',
    meta: { reason: 'login' },
  });

  const token = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, deviceId);
  const live = await loadUserProfile(user.id);
  res.json({
    ok: true,
    token,
    refreshToken,
    expiresIn: config.jwtExpiresIn,
    user: mapPublicUser({
      ...user,
      modules: live?.modules || normalizeModules({}),
    }),
    ...sessionExtras(user),
  });
});

authRouter.post('/refresh', async (req, res) => {
  if (await isLockdownActive()) {
    return res.status(503).json({
      ok: false,
      error: 'Servicio bloqueado por seguridad (lockdown)',
      lockdown: true,
    });
  }
  const raw = req.body?.refreshToken;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ ok: false, error: 'refreshToken requerido' });
  }

  const tokenHash = hashToken(raw);
  const { rows } = await query(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.device_id,
            u.id AS uid, u.organization_id, u.username, u.email, u.display_name, u.role, u.is_active,
            u.can_receive_panic, u.must_change_password, u.password_hash, u.avatar_url,
            u.unit_id, u.admin_scope_unit_id, u.can_see_region, u.can_see_zones, u.can_see_units,
            u.login_locked_at
     FROM refresh_tokens rt
     INNER JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  const row = rows[0];
  if (!row || !row.is_active) {
    return res.status(401).json({ ok: false, error: 'Refresh inválido' });
  }
  if (row.login_locked_at) {
    if (isLoginLockExempt(row.role) || isRoot(row.role)) {
      await query(
        `UPDATE users
         SET login_locked_at = NULL,
             login_locked_reason = NULL,
             login_fail_count = 0,
             updated_at = NOW()
         WHERE id = $1`,
        [row.uid]
      );
    } else {
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.uid]);
      return res.status(423).json({
        ok: false,
        error:
          'Tu usuario ha sido bloqueado por exceso de intentos. Contacta a un administrador para liberarlo.',
        code: 'USER_LOCKED',
        locked: true,
      });
    }
  }
  if (new Date(row.expires_at) < new Date()) {
    await query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
    return res.status(401).json({ ok: false, error: 'Refresh expirado' });
  }

  await query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);

  const user = {
    id: row.uid,
    organization_id: row.organization_id,
    username: row.username,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    can_receive_panic: row.can_receive_panic,
    must_change_password: row.must_change_password,
    avatar_url: row.avatar_url,
    unit_id: row.unit_id,
    admin_scope_unit_id: row.admin_scope_unit_id,
    can_see_region: row.can_see_region,
    can_see_zones: row.can_see_zones,
    can_see_units: row.can_see_units,
  };
  const deviceId =
    normalizeDeviceId(req.body?.deviceId) || normalizeDeviceId(row.device_id);
  const token = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, deviceId);
  const live = await loadUserProfile(user.id);

  res.json({
    ok: true,
    token,
    refreshToken,
    expiresIn: config.jwtExpiresIn,
    user: mapPublicUser({
      ...user,
      modules: live?.modules || normalizeModules({}),
    }),
    ...sessionExtras(user),
  });
});

authRouter.post('/logout', authMiddleware, async (req, res) => {
  const raw = req.body?.refreshToken;
  if (raw) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(raw)]);
  } else {
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.sub]);
  }
  void logUserEvent({
    organizationId: req.user.orgId,
    subjectUserId: req.user.sub,
    kind: 'session',
    summary: 'Cerró sesión',
  });
  void logPresenceTransition({
    organizationId: req.user.orgId,
    subjectUserId: req.user.sub,
    status: 'offline',
    summary: 'Desconectado',
    meta: { reason: 'logout' },
  });
  void clearPresenceEventState(req.user.sub).catch(() => {});
  res.json({ ok: true });
});

authRouter.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT id, username, email, display_name, role, organization_id, last_seen_at,
            can_receive_panic, must_change_password, avatar_url,
            unit_id, admin_scope_unit_id, can_see_region, can_see_zones, can_see_units
     FROM users WHERE id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }
  const u = rows[0];
  res.json({
    ok: true,
    user: {
      ...mapPublicUser({
        ...u,
        modules: req.user.modules || normalizeModules({}),
      }),
      lastSeenAt: u.last_seen_at,
    },
    ...sessionExtras(u),
  });
});

/** Cambio de contraseña (obligatorio en primer ingreso). */
authRouter.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      ok: false,
      error: 'Contraseña actual y nueva son requeridas',
    });
  }

  const errMsg = validateNewPassword(newPassword);
  if (errMsg) {
    return res.status(400).json({ ok: false, error: errMsg });
  }
  if (String(currentPassword) === String(newPassword)) {
    return res.status(400).json({
      ok: false,
      error: 'La nueva contraseña debe ser distinta a la actual',
    });
  }

  const { rows } = await query(
    `SELECT id, organization_id, username, email, password_hash, display_name, role,
            is_active, can_receive_panic, must_change_password, avatar_url
     FROM users WHERE id = $1`,
    [req.user.sub]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ ok: false, error: 'Usuario no válido' });
  }

  const match = await bcrypt.compare(String(currentPassword), user.password_hash);
  if (!match) {
    return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta' });
  }

  const hash = await bcrypt.hash(String(newPassword), 12);
  await query(
    `UPDATE users SET
       password_hash = $2,
       must_change_password = FALSE,
       updated_at = NOW()
     WHERE id = $1`,
    [user.id, hash]
  );
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [user.id]);

  await logActivity({
    organizationId: user.organization_id,
    actorId: user.id,
    action: 'auth.change_password',
    entityType: 'user',
    entityId: user.id,
    meta: { firstLogin: Boolean(user.must_change_password) },
  });

  const refreshed = {
    ...user,
    must_change_password: false,
  };
  const deviceId = normalizeDeviceId(req.body?.deviceId);
  const token = signAccessToken(refreshed);
  const refreshToken = await issueRefreshToken(user.id, deviceId);

  const live = await loadUserProfile(refreshed.id);
  res.json({
    ok: true,
    token,
    refreshToken,
    expiresIn: config.jwtExpiresIn,
    user: mapPublicUser({
      ...refreshed,
      modules: live?.modules || normalizeModules({}),
    }),
    ...sessionExtras(refreshed),
  });
});
