/**
 * Intrusión / lockdown TacticalPtx
 * - Detecta intentos de acceso fallidos (IP / usuario)
 * - Activa fuera de servicio inmediato (flag + revoca sesiones)
 * - Avisa a root/admin por FCM + archivo de incidente
 * - Opcional: señal para LOCKDOWN.ps1 (firewall/UPnP/parar servicios)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getRedis, isRedisReady } from '../redis.js';
import { query } from '../db.js';
import { config } from '../config.js';
import { logActivity } from './activity.js';
import { notifyUserDevices } from './fcm.js';
import { clearUserProfileCache } from './userProfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const FLAG_FILE = path.join(DATA_DIR, 'LOCKDOWN.flag');
const SIGNAL_FILE = path.join(DATA_DIR, 'LOCKDOWN.request');
const REDIS_KEY = 'security:lockdown';
const FAIL_IP_PREFIX = 'security:fail:ip:';
const FAIL_USER_PREFIX = 'security:fail:user:';

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
    const root = path.resolve(__dirname, '../../../Soporte/Respaldos');
    const dir = path.join(
      root,
      `incident-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'lockdown.json'), JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(dir, 'README.txt'),
      [
        'Incidente TacticalPtx — lockdown por intrusión / seguridad',
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
  if (String(unlockSecret || '') !== expected) {
    throw new Error('Secreto de desbloqueo inválido');
  }

  const prev = await getLockdownStatus();
  await clearPersistedLockdown();
  try {
    if (fs.existsSync(SIGNAL_FILE)) fs.unlinkSync(SIGNAL_FILE);
  } catch {
    /* ignore */
  }

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

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Registra fallo de login; puede disparar lockdown.
 */
export async function registerAuthFailure(req, { username = null } = {}) {
  const ip = clientIp(req);
  const maxIp = parseInt(process.env.INTRUSION_MAX_FAIL_IP || '12', 10);
  const maxUser = parseInt(process.env.INTRUSION_MAX_FAIL_USER || '8', 10);
  const windowSec = parseInt(process.env.INTRUSION_FAIL_WINDOW_SEC || '600', 10);

  let ipCount = 0;
  let userCount = 0;

  if (isRedisReady()) {
    try {
      const r = getRedis();
      const ipKey = `${FAIL_IP_PREFIX}${ip}`;
      ipCount = await r.incr(ipKey);
      if (ipCount === 1) await r.expire(ipKey, windowSec);

      if (username) {
        const uKey = `${FAIL_USER_PREFIX}${String(username).toLowerCase()}`;
        userCount = await r.incr(uKey);
        if (userCount === 1) await r.expire(uKey, windowSec);
      }
    } catch {
      /* fall through */
    }
  } else {
    // Sin Redis: contador en memoria por proceso (menos preciso)
    if (!registerAuthFailure._mem) registerAuthFailure._mem = new Map();
    const key = `ip:${ip}`;
    const cur = (registerAuthFailure._mem.get(key) || 0) + 1;
    registerAuthFailure._mem.set(key, cur);
    ipCount = cur;
  }

  const trip =
    (maxIp > 0 && ipCount >= maxIp) || (maxUser > 0 && userCount >= maxUser);

  if (trip) {
    await triggerLockdown({
      reason: 'auth_bruteforce',
      sourceIp: ip,
      detail: `fallos ip=${ipCount} user=${userCount} ventana=${windowSec}s`,
    });
    return { tripped: true, ipCount, userCount };
  }

  return { tripped: false, ipCount, userCount };
}

export function clientIpFromReq(req) {
  return clientIp(req);
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
