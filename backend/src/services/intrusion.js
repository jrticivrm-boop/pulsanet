/**
 * Intrusión / lockdown TacticalPtx
 * - Fallos de login → aviso + bloqueo de CUENTA (no tumba el servicio)
 * - Lockdown GLOBAL solo manual (root / LOCKDOWN.ps1 / tool de host)
 * - Aviso a consola (socket security:login_abuse) + FCM a root/admin
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { timingSafeEqual } from 'crypto';
import { getRedis, isRedisReady } from '../redis.js';
import { query } from '../db.js';
import { config } from '../config.js';
import { logActivity } from './activity.js';
import { notifyUserDevices } from './fcm.js';
import { clearUserProfileCache } from './userProfile.js';
import { isRoot } from './roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const FLAG_FILE = path.join(DATA_DIR, 'LOCKDOWN.flag');
const SIGNAL_FILE = path.join(DATA_DIR, 'LOCKDOWN.request');
const REDIS_KEY = 'security:lockdown';
const FAIL_IP_PREFIX = 'security:fail:ip:';
const FAIL_USER_PREFIX = 'security:fail:user:';

/**
 * Perfil Administrador (role root): no se bloquea por intentos fallidos (política temporal).
 */
export function isLoginLockExempt(role) {
  return isRoot(role);
}

let memoryLock = null;
let ioRef = null;

export function bindIntrusionIo(io) {
  ioRef = io;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readLockdownFlagFile() {
  try {
    if (!fs.existsSync(FLAG_FILE)) return null;
    const raw = fs.readFileSync(FLAG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function isLockdownActive() {
  if (memoryLock?.active) return true;
  const file = readLockdownFlagFile();
  if (file?.active) {
    memoryLock = file;
    return true;
  }
  if (isRedisReady()) {
    try {
      const v = await getRedis().get(REDIS_KEY);
      if (v) {
        memoryLock = JSON.parse(v);
        return Boolean(memoryLock?.active);
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export async function getLockdownStatus() {
  if (await isLockdownActive()) {
    return memoryLock || readLockdownFlagFile() || { active: true };
  }
  return { active: false };
}

async function persistLockdown(payload) {
  memoryLock = payload;
  ensureDataDir();
  fs.writeFileSync(FLAG_FILE, JSON.stringify(payload, null, 2), 'utf8');
  if (isRedisReady()) {
    try {
      await getRedis().set(REDIS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

async function clearPersistedLockdown() {
  memoryLock = null;
  try {
    if (fs.existsSync(FLAG_FILE)) fs.unlinkSync(FLAG_FILE);
  } catch {
    /* ignore */
  }
  if (isRedisReady()) {
    try {
      await getRedis().del(REDIS_KEY);
    } catch {
      /* ignore */
    }
  }
}

async function revokeAllRefreshTokens() {
  await query(`DELETE FROM refresh_tokens`);
}

async function listAlertUserIds(orgId) {
  const envIds = String(process.env.SECURITY_ALERT_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envIds.length) return envIds;

  const { rows } = await query(
    `SELECT id FROM users
     WHERE organization_id = $1
       AND is_active = TRUE
       AND role IN ('root', 'admin')
     ORDER BY role ASC, username ASC
     LIMIT 50`,
    [orgId]
  );
  return rows.map((r) => r.id);
}

async function alertAdmins({ orgId, title, body, data }) {
  const ids = await listAlertUserIds(orgId);
  await Promise.allSettled(
    ids.map((userId) =>
      notifyUserDevices({
        userId,
        title,
        body,
        data: { type: 'security_lockdown', ...data },
      })
    )
  );
  return ids.length;
}

function writeIncidentSnapshot(payload) {
  try {
    const repoRoot = path.resolve(__dirname, '../../..');
    const external = 'C:\\pulsanet_soporte';
    const root = fs.existsSync(external)
      ? path.join(external, 'Respaldos')
      : path.join(repoRoot, 'var', 'respaldos');
    const dir = path.join(
      root,
      `incident-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'lockdown.json'), JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(dir, 'README.txt'),
      [
        'Incidente SICOM — lockdown por intrusión / seguridad',
        `UTC: ${payload.at}`,
        `Motivo: ${payload.reason}`,
        `Origen: ${payload.sourceIp || 'n/d'}`,
        '',
        'El servicio quedó fuera de servicio hasta desbloqueo con LOCKDOWN_UNLOCK_SECRET.',
        'Revisa activity_logs (security.lockdown) y este archivo.',
        'No dejes contraseñas ni tokens en este directorio.',
      ].join('\n'),
      'utf8'
    );
    return dir;
  } catch (err) {
    console.error('incident snapshot:', err.message);
    return null;
  }
}

function signalHostLockdown(payload) {
  try {
    ensureDataDir();
    fs.writeFileSync(SIGNAL_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('lockdown signal file:', err.message);
  }

  if (process.env.ALLOW_HOST_LOCKDOWN !== '1') return;

  const script = path.resolve(__dirname, '../../../infra/LOCKDOWN.ps1');
  if (!fs.existsSync(script)) return;
  try {
    spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Reason', String(payload.reason || 'intrusion')],
      { detached: true, stdio: 'ignore', windowsHide: true }
    ).unref();
  } catch (err) {
    console.error('host lockdown spawn:', err.message);
  }
}

/**
 * Activa fuera de servicio inmediato.
 */
export async function triggerLockdown({
  reason = 'intrusion',
  sourceIp = null,
  actorId = null,
  orgId = null,
  detail = null,
} = {}) {
  if (await isLockdownActive()) {
    return { ok: true, already: true, status: await getLockdownStatus() };
  }

  let resolvedOrg = orgId;
  if (!resolvedOrg) {
    const { rows } = await query(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`);
    resolvedOrg = rows[0]?.id || null;
  }

  const payload = {
    active: true,
    at: new Date().toISOString(),
    reason: String(reason).slice(0, 200),
    sourceIp: sourceIp ? String(sourceIp).slice(0, 80) : null,
    actorId: actorId || null,
    orgId: resolvedOrg,
    detail: detail ? String(detail).slice(0, 500) : null,
  };

  await persistLockdown(payload);

  try {
    await revokeAllRefreshTokens();
  } catch (err) {
    console.error('lockdown revoke tokens:', err.message);
  }

  try {
    clearUserProfileCache();
  } catch {
    /* ignore */
  }

  if (ioRef) {
    try {
      ioRef.emit('security:lockdown', {
        reason: payload.reason,
        at: payload.at,
      });
      for (const [, sock] of ioRef.of('/').sockets) {
        sock.disconnect(true);
      }
    } catch (err) {
      console.error('lockdown sockets:', err.message);
    }
  }

  if (resolvedOrg) {
    await logActivity({
      organizationId: resolvedOrg,
      actorId: actorId || null,
      action: 'security.lockdown',
      entityType: 'system',
      entityId: null,
      meta: {
        reason: payload.reason,
        sourceIp: payload.sourceIp,
        detail: payload.detail,
      },
    });
  }

  const alerted = resolvedOrg
    ? await alertAdmins({
        orgId: resolvedOrg,
        title: 'ALERTA DE SEGURIDAD',
        body: `Lockdown: ${payload.reason}${payload.sourceIp ? ` · IP ${payload.sourceIp}` : ''}`,
        data: { reason: payload.reason, at: payload.at },
      })
    : 0;

  const incidentDir = writeIncidentSnapshot({ ...payload, alerted });
  signalHostLockdown(payload);

  console.error(
    `[SECURITY] LOCKDOWN activo — ${payload.reason} ip=${payload.sourceIp || '-'} alerts=${alerted}`
  );

  return { ok: true, status: payload, alerted, incidentDir };
}

export async function clearLockdown({ unlockSecret, actorId = null, sourceIp = null } = {}) {
  const expected = String(process.env.LOCKDOWN_UNLOCK_SECRET || '').trim();
  if (!expected || expected.length < 16) {
    throw new Error('LOCKDOWN_UNLOCK_SECRET no configurado (≥16)');
  }
  const a = Buffer.from(String(unlockSecret || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Secreto de desbloqueo inválido');
  }

  const prev = await getLockdownStatus();
  await clearPersistedLockdown();
  try {
    if (fs.existsSync(SIGNAL_FILE)) fs.unlinkSync(SIGNAL_FILE);
  } catch {
    /* ignore */
  }

  // Sin esto, un fallo más re-dispara lockdown si los contadores Redis siguen altos.
  if (isRedisReady()) {
    try {
      const r = getRedis();
      const failKeys = await r.keys('security:fail:*');
      if (failKeys.length) await r.del(...failKeys);
    } catch {
      /* ignore */
    }
  }
  if (registerLoginFailure._mem) registerLoginFailure._mem.clear();

  if (prev.orgId) {
    await logActivity({
      organizationId: prev.orgId,
      actorId,
      action: 'security.unlock',
      entityType: 'system',
      entityId: null,
      meta: { sourceIp, previousReason: prev.reason },
    });
  }

  return { ok: true };
}

function stripIp(addr) {
  return String(addr || '').replace(/^::ffff:/, '');
}

function isLoopbackAddr(addr) {
  const a = stripIp(addr);
  return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

function clientIp(req) {
  const trust =
    process.env.TRUST_PROXY === '1' ||
    (process.env.TRUST_PROXY !== '0' &&
      Boolean(String(process.env.PUBLIC_DOMAIN || '').trim()));
  // Solo confiar XFF si el peer es loopback (Caddy → API). Evita spoof con API expuesta.
  const remote = stripIp(req.socket?.remoteAddress || '');
  if (trust && isLoopbackAddr(remote)) {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.length) {
      return stripIp(xf.split(',')[0].trim());
    }
  }
  const raw = req.socket?.remoteAddress || req.ip || 'unknown';
  return stripIp(raw);
}

function authFailLimits() {
  const warnAt = Math.max(1, parseInt(process.env.AUTH_FAIL_WARN_AT || '2', 10) || 2);
  const lockAt = Math.max(
    warnAt,
    parseInt(process.env.AUTH_FAIL_LOCK_AT || process.env.INTRUSION_MAX_FAIL_USER || '3', 10) || 3
  );
  const windowSec = Math.max(
    60,
    parseInt(process.env.AUTH_FAIL_WINDOW_SEC || process.env.INTRUSION_FAIL_WINDOW_SEC || '600', 10) ||
      600
  );
  const ipThrottleAt = Math.max(
    0,
    parseInt(process.env.AUTH_IP_THROTTLE_AT || process.env.INTRUSION_MAX_FAIL_IP || '30', 10) || 30
  );
  return { warnAt, lockAt, windowSec, ipThrottleAt };
}

function emitLoginAbuse(payload) {
  if (!ioRef) return;
  try {
    ioRef.to('security:alerts').emit('security:login_abuse', payload);
  } catch (err) {
    console.error('security:login_abuse emit:', err.message);
  }
}

async function notifyLoginAbuseFcm({ orgId, title, body, data }) {
  const ids = await listAlertUserIds(orgId);
  await Promise.allSettled(
    ids.map((userId) =>
      notifyUserDevices({
        userId,
        title,
        body,
        data: { type: 'security_login_abuse', ...data },
      })
    )
  );
  return ids.length;
}

/**
 * ¿Cuenta bloqueada por intentos de login?
 */
export async function getUserLoginLock(userId) {
  const { rows } = await query(
    `SELECT id, username, display_name, role, organization_id,
            login_fail_count, login_locked_at, login_locked_reason
     FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u) return null;
  return {
    locked: Boolean(u.login_locked_at),
    failCount: u.login_fail_count || 0,
    lockedAt: u.login_locked_at,
    reason: u.login_locked_reason,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    orgId: u.organization_id,
  };
}

/** Limpia contadores tras login OK (no desbloquea si ya estaba locked). */
export async function clearLoginFailuresForUser(user) {
  if (!user?.id) return;
  try {
    await query(
      `UPDATE users
       SET login_fail_count = 0, updated_at = NOW()
       WHERE id = $1 AND login_locked_at IS NULL`,
      [user.id]
    );
  } catch (err) {
    console.error('clearLoginFailuresForUser:', err.message);
  }
  if (isRedisReady() && user.username) {
    try {
      await getRedis().del(`${FAIL_USER_PREFIX}${String(user.username).toLowerCase()}`);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Admin libera cuenta bloqueada por intentos.
 */
export async function unlockUserLogin({
  userId,
  orgId,
  actorId = null,
  sourceIp = null,
} = {}) {
  const { rows } = await query(
    `UPDATE users
     SET login_fail_count = 0,
         login_locked_at = NULL,
         login_locked_reason = NULL,
         updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING id, username, display_name, organization_id`,
    [userId, orgId]
  );
  const u = rows[0];
  if (!u) throw new Error('Usuario no encontrado');

  if (isRedisReady()) {
    try {
      await getRedis().del(`${FAIL_USER_PREFIX}${String(u.username).toLowerCase()}`);
    } catch {
      /* ignore */
    }
  }

  await logActivity({
    organizationId: u.organization_id,
    actorId,
    action: 'security.user_unlocked',
    entityType: 'user',
    entityId: u.id,
    meta: { username: u.username, sourceIp },
  });

  emitLoginAbuse({
    type: 'security.login_abuse',
    level: 'info',
    action: 'unlocked',
    at: new Date().toISOString(),
    username: u.username,
    userId: u.id,
    displayName: u.display_name,
    ip: sourceIp,
  });

  return { ok: true, userId: u.id, username: u.username };
}

/**
 * Registra fallo de login: aviso → bloqueo de cuenta.
 * NUNCA dispara lockdown global del servicio.
 * El contador fiable es Postgres (login_fail_count); Redis es auxiliar.
 */
export async function registerLoginFailure(
  req,
  { user = null, usernameAttempt = null } = {}
) {
  const ip = clientIp(req);
  const { warnAt, lockAt, windowSec, ipThrottleAt } = authFailLimits();
  const attemptName = String(user?.username || usernameAttempt || 'unknown')
    .trim()
    .toLowerCase()
    .slice(0, 80);

  let userCount = 0;
  let ipCount = 0;

  if (isRedisReady()) {
    try {
      const r = getRedis();
      const ipKey = `${FAIL_IP_PREFIX}${ip}`;
      ipCount = await r.incr(ipKey);
      if (ipCount === 1) await r.expire(ipKey, windowSec);

      const uKey = `${FAIL_USER_PREFIX}${attemptName}`;
      const redisUserCount = await r.incr(uKey);
      if (redisUserCount === 1) await r.expire(uKey, windowSec);
      // Solo usamos Redis como contador si no hay fila de usuario (identidad inventada)
      if (!user?.id) userCount = redisUserCount;
    } catch {
      /* fall through */
    }
  }

  if (!user?.id && !userCount) {
    if (!registerLoginFailure._mem) registerLoginFailure._mem = new Map();
    const key = `u:${attemptName}`;
    userCount = (registerLoginFailure._mem.get(key) || 0) + 1;
    registerLoginFailure._mem.set(key, userCount);
    const ipMem = `ip:${ip}`;
    ipCount = (registerLoginFailure._mem.get(ipMem) || 0) + 1;
    registerLoginFailure._mem.set(ipMem, ipCount);
  }

  const ua = String(req.headers['user-agent'] || '').slice(0, 180);
  const orgId = user?.organization_id || null;

  // Contador canónico en BD para usuarios reales (incluye root)
  if (user?.id) {
    try {
      const { rows } = await query(
        `UPDATE users
         SET login_fail_count = COALESCE(login_fail_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1
         RETURNING login_fail_count, login_locked_at, role, username, display_name, organization_id`,
        [user.id]
      );
      if (rows[0]) {
        userCount = Number(rows[0].login_fail_count) || userCount;
        user = { ...user, ...rows[0] };
      }
    } catch (err) {
      console.error('login_fail_count update:', err.message);
    }
  }

  if (ipThrottleAt > 0 && ipCount >= ipThrottleAt && ipCount === ipThrottleAt) {
    emitLoginAbuse({
      type: 'security.login_abuse',
      level: 'warning',
      action: 'ip_throttle',
      at: new Date().toISOString(),
      username: attemptName,
      userId: user?.id || null,
      displayName: user?.display_name || null,
      ip,
      failCount: ipCount,
      windowSec,
      userAgent: ua,
    });
  }

  const alreadyLocked = Boolean(user?.login_locked_at);
  // Administrador (root): no bloquear la cuenta por intentos (sigue el aviso/contadores).
  const lockExempt = Boolean(user?.id && isLoginLockExempt(user.role));
  const shouldLock = Boolean(user?.id && !lockExempt && userCount >= lockAt);

  if (lockExempt && alreadyLocked) {
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
      console.error('unlock exempt admin:', err.message);
    }
  }

  if ((shouldLock || alreadyLocked) && !lockExempt) {
    const reason = `Exceso de intentos de ingreso (${userCount} en ventana de ${windowSec}s)`;
    if (!alreadyLocked) {
      await query(
        `UPDATE users
         SET login_locked_at = NOW(),
             login_locked_reason = $2,
             updated_at = NOW()
         WHERE id = $1 AND login_locked_at IS NULL`,
        [user.id, reason]
      );
    }

    // Invalidar SOLO las sesiones de esta cuenta (APK/web de ese usuario)
    try {
      await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [user.id]);
    } catch (err) {
      console.error('revoke locked user tokens:', err.message);
    }
    if (ioRef && user.id) {
      try {
        ioRef.to(`user:${user.id}`).emit('security:user_locked', {
          reason: 'login_attempts',
          at: new Date().toISOString(),
        });
        for (const [, sock] of ioRef.of('/').sockets) {
          if (sock.data?.user?.sub === user.id) sock.disconnect(true);
        }
      } catch (err) {
        console.error('disconnect locked user sockets:', err.message);
      }
    }

    if (orgId && !alreadyLocked) {
      await logActivity({
        organizationId: orgId,
        actorId: null,
        action: 'security.user_locked',
        entityType: 'user',
        entityId: user.id,
        meta: {
          username: user.username,
          sourceIp: ip,
          failCount: userCount,
          windowSec,
          userAgent: ua,
        },
      });
      await notifyLoginAbuseFcm({
        orgId,
        title: 'Usuario bloqueado por intentos',
        body: `${user.username} · IP ${ip} · ${userCount} fallos`,
        data: {
          username: user.username,
          userId: user.id,
          ip,
          failCount: String(userCount),
          action: 'locked',
        },
      });
    }

    if (!alreadyLocked) {
      emitLoginAbuse({
        type: 'security.login_abuse',
        level: 'warning',
        action: 'locked',
        at: new Date().toISOString(),
        username: user.username,
        userId: user.id,
        displayName: user.display_name,
        ip,
        failCount: userCount,
        windowSec,
        userAgent: ua,
      });
      console.warn(
        `[SECURITY] Usuario bloqueado ${user.username} ip=${ip} fails=${userCount}`
      );
    }

    return {
      locked: true,
      warn: true,
      code: 'USER_LOCKED',
      failCount: userCount,
      attemptsRemaining: 0,
      ipCount,
      ipThrottled: ipThrottleAt > 0 && ipCount >= ipThrottleAt,
    };
  }

  const attemptsRemaining = Math.max(0, lockAt - userCount);
  const warn = userCount >= warnAt;

  if (warn) {
    if (orgId) {
      await logActivity({
        organizationId: orgId,
        actorId: null,
        action: 'security.login_warn',
        entityType: 'user',
        entityId: user?.id || null,
        meta: {
          username: attemptName,
          sourceIp: ip,
          failCount: userCount,
          attemptsRemaining,
          windowSec,
          userAgent: ua,
        },
      });
    }
    emitLoginAbuse({
      type: 'security.login_abuse',
      level: 'warning',
      action: 'warned',
      at: new Date().toISOString(),
      username: attemptName,
      userId: user?.id || null,
      displayName: user?.display_name || null,
      ip,
      failCount: userCount,
      attemptsRemaining,
      windowSec,
      userAgent: ua,
    });
  }

  return {
    locked: false,
    warn,
    code: warn ? 'AUTH_WARN' : 'AUTH_FAIL',
    failCount: userCount,
    attemptsRemaining,
    ipCount,
    ipThrottled: ipThrottleAt > 0 && ipCount >= ipThrottleAt,
  };
}

/** @deprecated Usar registerLoginFailure — ya no dispara lockdown global. */
export async function registerAuthFailure(req, { username = null } = {}) {
  return registerLoginFailure(req, { usernameAttempt: username });
}

export function clientIpFromReq(req) {
  return clientIp(req);
}

/** Mensajes estándar hacia el cliente de login. */
export function loginFailureClientPayload(result) {
  if (result?.locked) {
    return {
      status: 423,
      body: {
        ok: false,
        error:
          'Tu usuario ha sido bloqueado por exceso de intentos. Contacta a un administrador para liberarlo.',
        code: 'USER_LOCKED',
        locked: true,
        warn: true,
        attemptsRemaining: 0,
      },
    };
  }
  if (result?.warn) {
    const n = result.attemptsRemaining ?? 0;
    return {
      status: 401,
      body: {
        ok: false,
        error:
          n > 0
            ? `Credenciales inválidas. Te quedan ${n} intento${n === 1 ? '' : 's'} antes del bloqueo.`
            : 'Credenciales inválidas.',
        code: 'AUTH_WARN',
        warn: true,
        attemptsRemaining: n,
      },
    };
  }
  return {
    status: 401,
    body: {
      ok: false,
      error: 'Credenciales inválidas',
      code: 'AUTH_FAIL',
      warn: false,
      attemptsRemaining: result?.attemptsRemaining,
    },
  };
}

/** Middleware: bloquea API si hay lockdown (excepto unlock + health mínimo). */
export function lockdownGuard(req, res, next) {
  const p = req.path || '';
  const full = req.originalUrl || p;
  const allow =
    p === '/' ||
    full === '/' ||
    full.startsWith('/api/health') ||
    full.startsWith('/api/app') ||
    full.startsWith('/api/security/unlock') ||
    full.startsWith('/api/security/unlock-user') ||
    full.startsWith('/api/security/status');


  Promise.resolve(isLockdownActive())
    .then((active) => {
      if (!active) return next();
      if (allow) return next();
      const st = memoryLock || readLockdownFlagFile() || { active: true };
      return res.status(503).json({
        ok: false,
        error: 'Servicio bloqueado por seguridad (lockdown)',
        lockdown: true,
        reason: st.reason || 'security',
        at: st.at || null,
      });
    })
    .catch(next);
}
