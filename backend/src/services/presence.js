import {
  FLOOR_TTL_SEC,
  PRESENCE_SERVICE_STALE_MS,
  PRESENCE_STALE_MS,
  floorKey,
  getRedis,
  orgPresenceKey,
  orgPresenceTsKey,
  presenceKey,
  presenceSocketsKey,
  presenceTsKey,
} from '../redis.js';
import { query } from '../db.js';
import { logPresenceTransition } from './userEvents.js';

const FOCUS_RANK = { foreground: 3, background: 2, service: 1 };

export async function getFloor(groupId) {
  const raw = await getRedis().get(floorKey(groupId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Prioridad de floor PTT por rol de organización (no por rol de membresía). */
export function pttFloorRank(orgRole) {
  if (orgRole === 'root') return 100;
  if (orgRole === 'admin' || orgRole === 'zone_admin' || orgRole === 'unit_admin') {
    return 50;
  }
  return 0;
}

/**
 * ¿Puede el solicitante quitar el floor al titular?
 * - root > admin/zona/unidad > operador
 * - mismo rango: no (dos admins no se quitan)
 * - root no puede ser quitado
 */
export function canPttTakeover(requesterRole, holderRole) {
  const r = pttFloorRank(requesterRole);
  const h = pttFloorRank(holderRole || 'operator');
  return r > h;
}

function floorPayload(speaker) {
  const role = speaker.role || 'operator';
  const out = {
    userId: speaker.userId,
    displayName: speaker.displayName,
    since: speaker.since || Date.now(),
    role,
    rank: speaker.rank ?? pttFloorRank(role),
  };
  if (speaker.socketId) out.socketId = String(speaker.socketId);
  if (speaker.deviceId) out.deviceId = String(speaker.deviceId);
  return JSON.stringify(out);
}

/**
 * Adquiere floor atómicamente (SET NX).
 * - Mismo user + mismo socket → renueva TTL.
 * - Mismo user + otro socket/dispositivo → mueve el mic (selfMove); el cliente viejo debe soltar.
 * - Otro user con menor rango → takeover.
 */
export async function tryAcquireFloor(groupId, speaker) {
  const payload = floorPayload(speaker);
  const key = floorKey(groupId);
  const acquired = await getRedis().set(key, payload, 'EX', FLOOR_TTL_SEC, 'NX');
  if (acquired === 'OK') {
    return { ok: true, renewed: false, takeover: false, selfMove: false };
  }
  const current = await getFloor(groupId);
  if (current?.userId === speaker.userId) {
    const sameSocket =
      speaker.socketId &&
      current.socketId &&
      String(current.socketId) === String(speaker.socketId);
    await getRedis().set(key, payload, 'EX', FLOOR_TTL_SEC);
    if (sameSocket || !speaker.socketId) {
      return { ok: true, renewed: true, takeover: false, selfMove: false };
    }
    // Otro cliente del mismo usuario toma el mic.
    return {
      ok: true,
      renewed: false,
      takeover: false,
      selfMove: true,
      previous: current,
    };
  }
  if (current && canPttTakeover(speaker.role, current.role)) {
    await getRedis().set(key, payload, 'EX', FLOOR_TTL_SEC);
    return { ok: true, renewed: false, takeover: true, selfMove: false, previous: current };
  }
  return { ok: false, current };
}

export async function setFloor(groupId, speaker) {
  await getRedis().set(floorKey(groupId), floorPayload(speaker), 'EX', FLOOR_TTL_SEC);
}

/**
 * Libera el floor si userId coincide.
 * Si se pasa socketId y el floor tiene socketId distinto, no borra (otro cliente tiene el mic).
 */
export async function clearFloor(groupId, userId, socketId = null) {
  const script = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local ok, data = pcall(cjson.decode, raw)
    if not ok or type(data) ~= 'table' then return 0 end
    if data.userId ~= ARGV[1] then return 0 end
    if ARGV[2] ~= '' and data.socketId and data.socketId ~= ARGV[2] then
      return 0
    end
    redis.call('DEL', KEYS[1])
    return 1
  `;
  const n = await getRedis().eval(
    script,
    1,
    floorKey(groupId),
    String(userId),
    socketId != null && socketId !== '' ? String(socketId) : ''
  );
  return Number(n) === 1;
}

export async function refreshFloorTtl(groupId) {
  await getRedis().expire(floorKey(groupId), FLOOR_TTL_SEC);
}

/** @param {unknown} focus @param {boolean} [backgroundFlag] */
export function normalizePresenceFocus(focus, backgroundFlag) {
  if (focus === 'service') return 'service';
  if (backgroundFlag === true) return 'background';
  if (focus === 'background' || focus === true) return 'background';
  return 'foreground';
}

/** Mejor focus entre varios sockets / fuentes. */
export function pickBestFocus(focuses) {
  let best = 'service';
  let bestRank = 0;
  for (const f of focuses || []) {
    const focus = normalizePresenceFocus(f);
    const rank = FOCUS_RANK[focus] || 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = focus;
    }
  }
  return bestRank ? best : 'foreground';
}

function isAwayFocus(focus) {
  const f = normalizePresenceFocus(focus);
  return f === 'background' || f === 'service';
}

/**
 * Inicio de ausencia (minimizada / 2º plano / service).
 * Se conserva entre pings; se reinicia al volver a foreground.
 */
export function nextAwaySince(prevFocus, prevAwaySince, newFocus, now = Date.now()) {
  if (!isAwayFocus(newFocus)) return null;
  if (isAwayFocus(prevFocus) && prevAwaySince != null) {
    const n = Number(prevAwaySince);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return now;
}

/** Minutos de org → ms; 0 es válido. */
export function minutesToMs(minutes, fallbackMinutes = 15) {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return Math.max(0, fallbackMinutes) * 60_000;
  return Math.min(10080, Math.max(0, Math.trunc(n))) * 60_000;
}

/**
 * Color/estado unificado mapa + chat.
 * online (verde) | away (amarillo Ausente) | offline (gris) | stale (rojo)
 * showAway/showOffline (org): apagan colores intermedios (away→online, offline→stale).
 */
export function applyPresenceDisplayFlags(
  status,
  { showAway = true, showOffline = true } = {}
) {
  let s = status;
  if (s === 'away' && showAway === false) s = 'online';
  if (s === 'offline' && showOffline === false) s = 'stale';
  return s;
}

export function resolvePresenceStatus({
  focus = null,
  lastSeenAt = null,
  recordedAt = null,
  awaySince = null,
  offlineRedMs,
  absenceMs,
  showAway = true,
  showOffline = true,
  now = Date.now(),
} = {}) {
  const f = focus ? normalizePresenceFocus(focus) : null;
  let status = 'offline';

  if (f === 'foreground') {
    status = 'online';
  } else if (f === 'background' || f === 'service') {
    const abs = Number(absenceMs);
    if (!Number.isFinite(abs) || abs <= 0 || showAway === false) {
      status = 'online';
    } else {
      const since = awaySince != null ? Number(awaySince) : NaN;
      if (Number.isFinite(since) && since > 0 && now - since >= abs) status = 'away';
      else status = 'online';
    }
  } else {
    // Sin focus en Redis = desconectado (gris) o fuera de línea (rojo).
    const redMs = Number(offlineRedMs);
    if (!Number.isFinite(redMs) || redMs <= 0 || showOffline === false) {
      // Umbral 0 o gris desactivado → rojo al perder presencia.
      status = 'stale';
    } else {
      let seenMs = null;
      for (const v of [lastSeenAt, recordedAt]) {
        if (v == null) continue;
        const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
        if (!Number.isNaN(t)) seenMs = seenMs == null ? t : Math.max(seenMs, t);
      }
      if (seenMs != null && now - seenMs >= redMs) status = 'stale';
      else status = 'offline';
    }
  }

  return applyPresenceDisplayFlags(status, { showAway, showOffline });
}

export async function getOrgPresenceOfflineRedMs(orgId) {
  const { rows } = await query(
    `SELECT presence_offline_red_minutes FROM organizations WHERE id = $1`,
    [orgId]
  );
  const minutes = Number(rows[0]?.presence_offline_red_minutes);
  return minutesToMs(Number.isFinite(minutes) ? minutes : 15, 15);
}

export async function getOrgPresenceAbsenceMs(orgId) {
  const { rows } = await query(
    `SELECT presence_absence_minutes FROM organizations WHERE id = $1`,
    [orgId]
  );
  const minutes = Number(rows[0]?.presence_absence_minutes);
  return minutesToMs(Number.isFinite(minutes) ? minutes : 15, 15);
}

export async function getOrgPresenceThresholds(orgId) {
  const { rows } = await query(
    `SELECT presence_offline_red_minutes, presence_absence_minutes,
            presence_show_away, presence_show_offline
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  const red = Number(rows[0]?.presence_offline_red_minutes);
  const abs = Number(rows[0]?.presence_absence_minutes);
  const offlineRedMinutes = Number.isFinite(red)
    ? Math.min(10080, Math.max(0, Math.trunc(red)))
    : 15;
  const absenceMinutes = Number.isFinite(abs)
    ? Math.min(10080, Math.max(0, Math.trunc(abs)))
    : 15;
  const showAway = rows[0]?.presence_show_away !== false;
  const showOffline = rows[0]?.presence_show_offline !== false;
  return {
    offlineRedMinutes,
    absenceMinutes,
    offlineRedMs: minutesToMs(offlineRedMinutes, 15),
    absenceMs: minutesToMs(absenceMinutes, 15),
    showAway,
    showOffline,
  };
}

export async function touchLastSeen(userId) {
  if (!userId) return;
  try {
    await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [userId]);
  } catch {
    /* ignore */
  }
}

function encodePresenceValue(displayName, focus, awaySince = null) {
  const f = normalizePresenceFocus(focus);
  const o = {
    displayName: displayName || 'Usuario',
    focus: f,
  };
  if (isAwayFocus(f) && awaySince != null) {
    const n = Number(awaySince);
    if (Number.isFinite(n) && n > 0) o.awaySince = n;
  }
  return JSON.stringify(o);
}

/** Compat: valor plano = solo displayName (focus foreground). */
function decodePresenceValue(raw) {
  if (!raw) return { displayName: 'Usuario', focus: 'foreground', awaySince: null };
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw);
      const focus = normalizePresenceFocus(o.focus);
      const awaySince =
        isAwayFocus(focus) && o.awaySince != null && Number.isFinite(Number(o.awaySince))
          ? Number(o.awaySince)
          : null;
      return {
        displayName: o.displayName || 'Usuario',
        focus,
        awaySince,
      };
    } catch {
      /* fallthrough */
    }
  }
  return { displayName: String(raw), focus: 'foreground', awaySince: null };
}

function decodeSocketPresence(raw) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      userId: String(o?.userId || ''),
      displayName: o?.displayName || 'Usuario',
      focus: normalizePresenceFocus(o?.focus),
    };
  } catch {
    return null;
  }
}

function staleCutoffForFocus(focus, now = Date.now()) {
  const f = normalizePresenceFocus(focus);
  const window = f === 'service' ? PRESENCE_SERVICE_STALE_MS : PRESENCE_STALE_MS;
  return now - window;
}

async function listSocketEntries(groupId) {
  const map = await getRedis().hgetall(presenceSocketsKey(groupId));
  const out = [];
  for (const [socketId, raw] of Object.entries(map || {})) {
    const parsed = decodeSocketPresence(raw);
    if (parsed?.userId) out.push({ socketId, ...parsed });
  }
  return out;
}

/**
 * Agrega displayName/focus del usuario a partir de todos sus sockets en el grupo.
 * foreground > background > service.
 */
async function writeAggregatedUser(groupId, userId, entriesForUser) {
  const redis = getRedis();
  const key = presenceKey(groupId);
  const tsKey = presenceTsKey(groupId);
  if (!entriesForUser.length) {
    const pipe = redis.pipeline();
    pipe.hdel(key, userId);
    pipe.hdel(tsKey, userId);
    await pipe.exec();
    return { focusChanged: true, removed: true };
  }
  const prevRaw = await redis.hget(key, userId);
  const prev = decodePresenceValue(prevRaw);
  const displayName =
    entriesForUser.find((e) => e.displayName)?.displayName || prev.displayName || 'Usuario';
  const focus = pickBestFocus(entriesForUser.map((e) => e.focus));
  const awaySince = nextAwaySince(prev.focus, prev.awaySince, focus);
  const focusChanged = !prevRaw || prev.focus !== focus;
  const now = String(Date.now());
  const pipe = redis.pipeline();
  pipe.hset(key, userId, encodePresenceValue(displayName, focus, awaySince));
  pipe.hset(tsKey, userId, now);
  pipe.expire(key, 86400);
  pipe.expire(tsKey, 86400);
  await pipe.exec();
  return { focusChanged, removed: false };
}

async function writeOrgPresence(orgId, userId, displayName, focus) {
  if (!orgId || !userId) return;
  const redis = getRedis();
  const key = orgPresenceKey(orgId);
  const tsKey = orgPresenceTsKey(orgId);
  const uid = String(userId);
  const prev = decodePresenceValue(await redis.hget(key, uid));
  const normalized = normalizePresenceFocus(focus);
  const awaySince = nextAwaySince(prev.focus, prev.awaySince, normalized);
  const now = String(Date.now());
  const pipe = redis.pipeline();
  pipe.hset(key, uid, encodePresenceValue(displayName, normalized, awaySince));
  pipe.hset(tsKey, uid, now);
  pipe.expire(key, 86400);
  pipe.expire(tsKey, 86400);
  await pipe.exec();

  const prevBand = presenceBand(prev.focus);
  const nextBand = presenceBand(normalized);
  if (prevBand !== nextBand) {
    if (nextBand === 'online') {
      void logPresenceTransition({
        organizationId: orgId,
        subjectUserId: uid,
        status: 'online',
        summary: prevBand === 'offline' ? 'En línea (volvió)' : 'En línea',
      });
    } else if (nextBand === 'away') {
      void logPresenceTransition({
        organizationId: orgId,
        subjectUserId: uid,
        status: 'away',
        summary: 'Ausente',
      });
    }
  }
}

function presenceBand(focus) {
  const f = normalizePresenceFocus(focus);
  if (f === 'foreground') return 'online';
  if (f === 'background' || f === 'service') return 'away';
  return 'offline';
}

async function clearOrgPresence(orgId, userId) {
  if (!orgId || !userId) return;
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.hdel(orgPresenceKey(orgId), String(userId));
  pipe.hdel(orgPresenceTsKey(orgId), String(userId));
  await pipe.exec();
  void logPresenceTransition({
    organizationId: orgId,
    subjectUserId: String(userId),
    status: 'offline',
    summary: 'Desconectado',
  });
}

/**
 * Registra presencia de un socket (multi-dispositivo).
 * @param {string} [socketId] si falta, comportamiento legado (1 entrada por user).
 * @returns {Promise<{ focusChanged: boolean }>}
 */
export async function addPresence(groupId, userId, displayName, focus = 'foreground', socketId = null, orgId = null) {
  const redis = getRedis();
  const normalized = normalizePresenceFocus(focus);
  const uid = String(userId);

  if (!socketId) {
    const key = presenceKey(groupId);
    const tsKey = presenceTsKey(groupId);
    const prevRaw = await redis.hget(key, uid);
    const prev = decodePresenceValue(prevRaw);
    // No degradar UI (fg/bg) a service si el heartbeat llega mientras aún hay UI reciente.
    if (
      normalized === 'service' &&
      prevRaw &&
      (prev.focus === 'foreground' || prev.focus === 'background')
    ) {
      const ts = parseInt((await redis.hget(tsKey, uid)) || '0', 10);
      if (ts >= Date.now() - PRESENCE_STALE_MS) {
        return { focusChanged: false };
      }
    }
    const focusChanged = !prevRaw || prev.focus !== normalized;
    const awaySince = nextAwaySince(prev.focus, prev.awaySince, normalized);
    const now = String(Date.now());
    const pipe = redis.pipeline();
    pipe.hset(key, uid, encodePresenceValue(displayName, normalized, awaySince));
    pipe.hset(tsKey, uid, now);
    pipe.expire(key, 86400);
    pipe.expire(tsKey, 86400);
    await pipe.exec();
    if (orgId) await writeOrgPresence(orgId, uid, displayName, normalized);
    return { focusChanged };
  }

  const sockKey = presenceSocketsKey(groupId);
  await redis.hset(
    sockKey,
    socketId,
    JSON.stringify({
      userId: uid,
      displayName: displayName || 'Usuario',
      focus: normalized,
    })
  );
  await redis.expire(sockKey, 86400);

  const all = await listSocketEntries(groupId);
  const mine = all.filter((e) => e.userId === uid);
  const { focusChanged } = await writeAggregatedUser(groupId, uid, mine);
  if (orgId) {
    const best = pickBestFocus(mine.map((e) => e.focus));
    await writeOrgPresence(orgId, uid, displayName, best);
  }
  return { focusChanged };
}

/**
 * Quita solo este socket. Si el user aún tiene otros sockets en el grupo, permanece online.
 * @returns {Promise<{ removedUser: boolean, userId: string|null, focusChanged: boolean }>}
 */
export async function removePresenceSocket(groupId, socketId, orgId = null) {
  if (!socketId) {
    return { removedUser: false, userId: null, focusChanged: false };
  }
  const redis = getRedis();
  const sockKey = presenceSocketsKey(groupId);
  const raw = await redis.hget(sockKey, socketId);
  if (!raw) {
    return { removedUser: false, userId: null, focusChanged: false };
  }
  const parsed = decodeSocketPresence(raw);
  await redis.hdel(sockKey, socketId);
  const userId = parsed?.userId || null;
  if (!userId) {
    return { removedUser: false, userId: null, focusChanged: false };
  }
  const remaining = (await listSocketEntries(groupId)).filter((e) => e.userId === userId);
  const { focusChanged, removed } = await writeAggregatedUser(groupId, userId, remaining);
  if (removed) {
    await touchLastSeen(userId);
    // Si no queda en ningún grupo online, se limpia en markUserOfflineIfIdle vía caller.
  } else if (orgId) {
    const best = pickBestFocus(remaining.map((e) => e.focus));
    await writeOrgPresence(orgId, userId, parsed.displayName, best);
  }
  return { removedUser: Boolean(removed), userId, focusChanged };
}

/** Elimina al usuario del agregado (p.ej. admin). También limpia sus sockets en el grupo. */
export async function removePresence(groupId, userId) {
  const uid = String(userId);
  const redis = getRedis();
  const sockKey = presenceSocketsKey(groupId);
  const all = await listSocketEntries(groupId);
  const mine = all.filter((e) => e.userId === uid).map((e) => e.socketId);
  const pipe = redis.pipeline();
  if (mine.length) pipe.hdel(sockKey, ...mine);
  pipe.hdel(presenceKey(groupId), uid);
  pipe.hdel(presenceTsKey(groupId), uid);
  await pipe.exec();
  await touchLastSeen(uid);
}

/**
 * Elimina entradas de sockets ya desconectados y re-agrega presencia.
 * @param {import('socket.io').Server} io
 */
export async function pruneDeadPresenceSockets(io, groupId) {
  if (!io?.sockets?.sockets) return;
  const all = await listSocketEntries(groupId);
  const dead = all.filter((e) => !io.sockets.sockets.has(e.socketId));
  if (!dead.length) return;
  for (const d of dead) {
    await removePresenceSocket(groupId, d.socketId);
  }
}

/** Solo miembros con heartbeat reciente (evita fantasmas offline). */
export async function listPresence(groupId) {
  const redis = getRedis();
  const key = presenceKey(groupId);
  const tsKey = presenceTsKey(groupId);
  const [map, tsMap] = await Promise.all([redis.hgetall(key), redis.hgetall(tsKey)]);
  const now = Date.now();
  const members = [];
  const stale = [];

  for (const [userId, raw] of Object.entries(map || {})) {
    const { displayName, focus, awaySince } = decodePresenceValue(raw);
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= staleCutoffForFocus(focus, now)) {
      members.push({ userId, displayName, focus, awaySince });
    } else {
      stale.push(userId);
    }
  }

  if (stale.length) {
    const pipe = redis.pipeline();
    pipe.hdel(key, ...stale);
    pipe.hdel(tsKey, ...stale);
    const sockKey = presenceSocketsKey(groupId);
    const entries = await listSocketEntries(groupId);
    const staleSet = new Set(stale);
    const deadSocks = entries.filter((e) => staleSet.has(e.userId)).map((e) => e.socketId);
    if (deadSocks.length) pipe.hdel(sockKey, ...deadSocks);
    await pipe.exec();
    for (const uid of stale) {
      await touchLastSeen(uid);
    }
  }

  return members;
}

/** Presencia org-wide (canales + FGS). */
export async function listOrgPresence(orgId) {
  const redis = getRedis();
  const key = orgPresenceKey(orgId);
  const tsKey = orgPresenceTsKey(orgId);
  const [map, tsMap] = await Promise.all([redis.hgetall(key), redis.hgetall(tsKey)]);
  const now = Date.now();
  const members = [];
  const stale = [];
  for (const [userId, raw] of Object.entries(map || {})) {
    const { displayName, focus, awaySince } = decodePresenceValue(raw);
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= staleCutoffForFocus(focus, now)) {
      members.push({ userId, displayName, focus, awaySince });
    } else {
      stale.push(userId);
    }
  }
  if (stale.length) {
    const pipe = redis.pipeline();
    pipe.hdel(key, ...stale);
    pipe.hdel(tsKey, ...stale);
    await pipe.exec();
    for (const uid of stale) await touchLastSeen(uid);
  }
  return members;
}

/**
 * Heartbeat HTTP (FGS o refuerzo UI): marca focus en org + grupos sin socket.
 * focus=service no degrada si ya hay UI (fg/bg) fresca (ver addPresence).
 */
export async function heartbeatServicePresence({
  orgId,
  userId,
  displayName,
  focus = 'service',
}) {
  const uid = String(userId);
  const name = displayName || 'Usuario';
  const normalized = normalizePresenceFocus(focus);
  await writeOrgPresence(orgId, uid, name, normalized);

  const { rows } = await query(
    `SELECT gm.group_id
     FROM group_members gm
     INNER JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1 AND g.organization_id = $2 AND g.is_active = TRUE`,
    [uid, orgId]
  );

  let anyChanged = false;
  for (const row of rows) {
    const { focusChanged } = await addPresence(
      row.group_id,
      uid,
      name,
      normalized,
      null,
      orgId
    );
    if (focusChanged) anyChanged = true;
  }
  await touchLastSeen(uid);
  return { focusChanged: anyChanged, groupIds: rows.map((r) => r.group_id), focus: normalized };
}

export async function clearOrgPresenceForUser(orgId, userId) {
  await clearOrgPresence(orgId, userId);
  await touchLastSeen(userId);
}

export async function broadcastPresence(io, groupId) {
  try {
    await pruneDeadPresenceSockets(io, groupId);
  } catch {
    /* ignore */
  }
  const members = await listPresence(groupId);
  io.to(`group:${groupId}`).emit('presence:update', { groupId, members });
}

export async function getMemberRole(groupId, userId) {
  const { rows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  return rows[0]?.role || null;
}

export async function assertGroupMember(groupId, userId) {
  return Boolean(await getMemberRole(groupId, userId));
}
