import {
  FLOOR_TTL_SEC,
  PRESENCE_STALE_MS,
  floorKey,
  getRedis,
  presenceKey,
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
  const current = await getFloor(groupId);
  if (!current || current.userId !== userId) return false;
  await getRedis().del(floorKey(groupId));
  return true;
}

export async function refreshFloorTtl(groupId) {
  await getRedis().expire(floorKey(groupId), FLOOR_TTL_SEC);
}

export async function addPresence(groupId, userId, displayName) {
  const key = presenceKey(groupId);
  const tsKey = presenceTsKey(groupId);
  const now = String(Date.now());
  const pipe = getRedis().pipeline();
  pipe.hset(key, userId, displayName || 'Usuario');
  pipe.hset(tsKey, userId, now);
  pipe.expire(key, 86400);
  pipe.expire(tsKey, 86400);
  await pipe.exec();
}

export async function removePresence(groupId, userId) {
  const pipe = getRedis().pipeline();
  pipe.hdel(presenceKey(groupId), userId);
  pipe.hdel(presenceTsKey(groupId), userId);
  await pipe.exec();
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

  for (const [userId, displayName] of Object.entries(map || {})) {
    const ts = parseInt(tsMap?.[userId] || '0', 10);
    if (ts >= cutoff) {
      members.push({ userId, displayName });
    } else {
      stale.push(userId);
    }
  }

  if (stale.length) {
    const pipe = redis.pipeline();
    pipe.hdel(key, ...stale);
    pipe.hdel(tsKey, ...stale);
    await pipe.exec();
  }

  return members;
}

export async function broadcastPresence(io, groupId) {
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
