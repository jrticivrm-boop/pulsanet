import {
  FLOOR_TTL_SEC,
  PRESENCE_STALE_MS,
  floorKey,
  getRedis,
  presenceKey,
  presenceSocketsKey,
  presenceTsKey,
} from '../redis.js';
import { query } from '../db.js';

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
  // Compare-and-del atómico: evita borrar el floor de otro speaker tras carrera TTL/SET NX.
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
  if (backgroundFlag === true) return 'background';
  if (focus === 'background' || focus === true) return 'background';
  return 'foreground';
}

function encodePresenceValue(displayName, focus) {
  return JSON.stringify({
    displayName: displayName || 'Usuario',
    focus: focus === 'background' ? 'background' : 'foreground',
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
        focus: o.focus === 'background' ? 'background' : 'foreground',
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
      focus: o?.focus === 'background' ? 'background' : 'foreground',
    };
  } catch {
    return null;
  }
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
 * foreground gana si algún dispositivo está en primer plano.
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
  const focus = entriesForUser.some((e) => e.focus === 'foreground')
    ? 'foreground'
    : 'background';
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

/**
 * Registra presencia de un socket (multi-dispositivo).
 * @param {string} [socketId] si falta, comportamiento legado (1 entrada por user).
 * @returns {Promise<{ focusChanged: boolean }>}
 */
export async function addPresence(groupId, userId, displayName, focus = 'foreground', socketId = null) {
  const redis = getRedis();
  const normalized = normalizePresenceFocus(focus);
  const uid = String(userId);

  if (!socketId) {
    const key = presenceKey(groupId);
    const tsKey = presenceTsKey(groupId);
    const prevRaw = await redis.hget(key, uid);
    const prev = decodePresenceValue(prevRaw);
    const focusChanged = !prevRaw || prev.focus !== normalized;
    const now = String(Date.now());
    const pipe = redis.pipeline();
    pipe.hset(key, uid, encodePresenceValue(displayName, normalized));
    pipe.hset(tsKey, uid, now);
    pipe.expire(key, 86400);
    pipe.expire(tsKey, 86400);
    await pipe.exec();
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
  return { focusChanged };
}

/**
 * Quita solo este socket. Si el user aún tiene otros sockets en el grupo, permanece online.
 * @returns {Promise<{ removedUser: boolean, userId: string|null, focusChanged: boolean }>}
 */
export async function removePresenceSocket(groupId, socketId) {
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
  const cutoff = Date.now() - PRESENCE_STALE_MS;
  const members = [];
  const stale = [];

  for (const [userId, raw] of Object.entries(map || {})) {
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= cutoff) {
      const { displayName, focus } = decodePresenceValue(raw);
      members.push({ userId, displayName, focus });
    } else {
      stale.push(userId);
    }
  }

  if (stale.length) {
    const pipe = redis.pipeline();
    pipe.hdel(key, ...stale);
    pipe.hdel(tsKey, ...stale);
    // Limpia sockets de usuarios stale
    const sockKey = presenceSocketsKey(groupId);
    const entries = await listSocketEntries(groupId);
    const staleSet = new Set(stale);
    const deadSocks = entries.filter((e) => staleSet.has(e.userId)).map((e) => e.socketId);
    if (deadSocks.length) pipe.hdel(sockKey, ...deadSocks);
    await pipe.exec();
  }

  return members;
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
