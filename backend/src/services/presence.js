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

/**
 * Adquiere floor atómicamente (SET NX). Si ya lo tiene el mismo user, renueva TTL.
 */
export async function tryAcquireFloor(groupId, speaker) {
  const payload = JSON.stringify({
    userId: speaker.userId,
    displayName: speaker.displayName,
    since: speaker.since || Date.now(),
  });
  const key = floorKey(groupId);
  const acquired = await getRedis().set(key, payload, 'EX', FLOOR_TTL_SEC, 'NX');
  if (acquired === 'OK') {
    return { ok: true, renewed: false };
  }
  const current = await getFloor(groupId);
  if (current?.userId === speaker.userId) {
    await getRedis().set(key, payload, 'EX', FLOOR_TTL_SEC);
    return { ok: true, renewed: true };
  }
  return { ok: false, current };
}

export async function setFloor(groupId, speaker) {
  const payload = JSON.stringify({
    userId: speaker.userId,
    displayName: speaker.displayName,
    since: speaker.since || Date.now(),
  });
  await getRedis().set(floorKey(groupId), payload, 'EX', FLOOR_TTL_SEC);
}

export async function clearFloor(groupId, userId) {
  const script = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local ok, data = pcall(cjson.decode, raw)
    if not ok or type(data) ~= 'table' then return 0 end
    if data.userId ~= ARGV[1] then return 0 end
    redis.call('DEL', KEYS[1])
    return 1
  `;
  const n = await getRedis().eval(script, 1, floorKey(groupId), String(userId));
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

/**
 * Color/estado unificado mapa + chat.
 * online (verde) = app abierta, minimizada o FGS alcanzable;
 * offline (gris) = desconectado; stale (rojo) = desconectado > umbral.
 * (Ya no se distingue «En espera» / service en UI.)
 */
export function resolvePresenceStatus({
  focus = null,
  lastSeenAt = null,
  recordedAt = null,
  offlineRedMs,
  now = Date.now(),
}) {
  const f = focus ? normalizePresenceFocus(focus) : null;
  if (f === 'foreground' || f === 'background' || f === 'service') return 'online';
  const redMs = Math.max(60_000, Number(offlineRedMs) || 15 * 60_000);
  let seenMs = null;
  for (const v of [lastSeenAt, recordedAt]) {
    if (v == null) continue;
    const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
    if (!Number.isNaN(t)) seenMs = seenMs == null ? t : Math.max(seenMs, t);
  }
  if (seenMs != null) {
    const age = now - seenMs;
    if (age < 150_000) return 'online';
    if (age >= redMs) return 'stale';
  }
  return 'offline';
}

export async function getOrgPresenceOfflineRedMs(orgId) {
  const { rows } = await query(
    `SELECT presence_offline_red_minutes FROM organizations WHERE id = $1`,
    [orgId]
  );
  const minutes = Number(rows[0]?.presence_offline_red_minutes);
  const safe = Number.isFinite(minutes) && minutes >= 1 ? minutes : 15;
  return safe * 60_000;
}

export async function touchLastSeen(userId) {
  if (!userId) return;
  try {
    await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [userId]);
  } catch {
    /* ignore */
  }
}

function encodePresenceValue(displayName, focus) {
  const f = normalizePresenceFocus(focus);
  return JSON.stringify({
    displayName: displayName || 'Usuario',
    focus: f,
  });
}

/** Compat: valor plano = solo displayName (focus foreground). */
function decodePresenceValue(raw) {
  if (!raw) return { displayName: 'Usuario', focus: 'foreground' };
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw);
      return {
        displayName: o.displayName || 'Usuario',
        focus: normalizePresenceFocus(o.focus),
      };
    } catch {
      /* fallthrough */
    }
  }
  return { displayName: String(raw), focus: 'foreground' };
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
  const focusChanged = !prevRaw || prev.focus !== focus;
  const now = String(Date.now());
  const pipe = redis.pipeline();
  pipe.hset(key, userId, encodePresenceValue(displayName, focus));
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
  const now = String(Date.now());
  const pipe = redis.pipeline();
  pipe.hset(key, String(userId), encodePresenceValue(displayName, focus));
  pipe.hset(tsKey, String(userId), now);
  pipe.expire(key, 86400);
  pipe.expire(tsKey, 86400);
  await pipe.exec();
}

async function clearOrgPresence(orgId, userId) {
  if (!orgId || !userId) return;
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.hdel(orgPresenceKey(orgId), String(userId));
  pipe.hdel(orgPresenceTsKey(orgId), String(userId));
  await pipe.exec();
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
    const now = String(Date.now());
    const pipe = redis.pipeline();
    pipe.hset(key, uid, encodePresenceValue(displayName, normalized));
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
    const { displayName, focus } = decodePresenceValue(raw);
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= staleCutoffForFocus(focus, now)) {
      members.push({ userId, displayName, focus });
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
    const { displayName, focus } = decodePresenceValue(raw);
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= staleCutoffForFocus(focus, now)) {
      members.push({ userId, displayName, focus });
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
 * Heartbeat FGS: marca focus=service en org + grupos del usuario (sin socket).
 * No degrada si ya hay UI (fg/bg) fresca.
 */
export async function heartbeatServicePresence({ orgId, userId, displayName }) {
  const uid = String(userId);
  const name = displayName || 'Usuario';
  await writeOrgPresence(orgId, uid, name, 'service');

  const { rows } = await query(
    `SELECT gm.group_id
     FROM group_members gm
     INNER JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1 AND g.organization_id = $2 AND g.is_active = TRUE`,
    [uid, orgId]
  );

  let anyChanged = false;
  for (const row of rows) {
    const { focusChanged } = await addPresence(row.group_id, uid, name, 'service', null, orgId);
    if (focusChanged) anyChanged = true;
  }
  await touchLastSeen(uid);
  return { focusChanged: anyChanged, groupIds: rows.map((r) => r.group_id) };
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
