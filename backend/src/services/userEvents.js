import { query } from '../db.js';
import { getRedis } from '../redis.js';

/**
 * Registra un evento legible del operador. No rompe el request si falla.
 */
export async function logUserEvent({
  organizationId,
  subjectUserId,
  kind,
  summary,
  meta = null,
}) {
  if (!organizationId || !subjectUserId || !kind || !summary) return;
  try {
    await query(
      `INSERT INTO user_events (organization_id, subject_user_id, kind, summary, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        organizationId,
        subjectUserId,
        String(kind).slice(0, 32),
        String(summary).slice(0, 500),
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (err) {
    console.error('user_events:', err.message);
  }
}

const PRESENCE_LAST_KEY = (userId) => `user_events:presence:${userId}`;

/**
 * Registra transición de presencia solo si cambió el estado lógico.
 * Estados: online | away | offline
 */
export async function logPresenceTransition({
  organizationId,
  subjectUserId,
  status,
  summary,
  meta = null,
}) {
  if (!organizationId || !subjectUserId || !status || !summary) return;
  try {
    const redis = getRedis();
    const key = PRESENCE_LAST_KEY(subjectUserId);
    const prev = await redis.get(key);
    if (prev === status) return;
    await redis.set(key, status, 'EX', 86400 * 7);
    await logUserEvent({
      organizationId,
      subjectUserId,
      kind: 'presence',
      summary,
      meta: { ...(meta || {}), status },
    });
  } catch (err) {
    console.error('user_events presence:', err.message);
  }
}

export async function clearPresenceEventState(userId) {
  try {
    await getRedis().del(PRESENCE_LAST_KEY(userId));
  } catch {
    /* ignore */
  }
}
