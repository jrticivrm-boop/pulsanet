import { query } from '../db.js';
import { isDispatch } from './roles.js';
import { loadTrackScope, unitInTrackScope, getUserUnitId } from './orgUnits.js';

/** Tope de la transmisión de cámara/mic de una alerta. */
export const PANIC_LIVE_MAX_MS = 15 * 60 * 1000;

/**
 * Sesiones en memoria. Una alerta = varios panic_events (uno por canal) con la misma sala.
 * `panicId` = primer evento de la alerta (el que recibe el emisor en la respuesta).
 */
const sessions = new Map();
const byEvent = new Map();
let ioRef = null;

export function bindPanicLiveIo(io) {
  ioRef = io;
}

function roomFor(panicId) {
  return `panic-live-${panicId}`;
}

function register(session) {
  sessions.set(session.panicId, session);
  for (const id of session.eventIds) byEvent.set(id, session.panicId);
  const left = session.expiresAt - Date.now();
  if (left <= 0) return session;
  session.timer = setTimeout(() => {
    void endPanicLive(session.panicId, 'timeout');
  }, left);
  session.timer.unref?.();
  return session;
}

export function openPanicLive({ orgId, userId, events }) {
  const panicId = events[0].id;
  const createdAt = Date.now();
  return register({
    panicId,
    orgId,
    userId,
    eventIds: events.map((e) => e.id),
    roomName: roomFor(panicId),
    createdAt,
    expiresAt: createdAt + PANIC_LIVE_MAX_MS,
  });
}

/**
 * Tras reiniciar el API la memoria se pierde: reconstruye la sesión desde la BD
 * (eventos hermanos del mismo emisor creados en la misma alerta, aún activos y < 15 min).
 */
async function restoreFromDb(eventId, orgId) {
  const { rows } = await query(
    `SELECT id, user_id, organization_id, created_at FROM panic_events
     WHERE id = $1 AND organization_id = $2`,
    [eventId, orgId]
  );
  const ev = rows[0];
  if (!ev) return null;
  const { rows: siblings } = await query(
    `SELECT id, status, created_at FROM panic_events
     WHERE user_id = $1 AND organization_id = $2
       AND created_at BETWEEN $3::timestamptz - INTERVAL '5 seconds' AND $3::timestamptz + INTERVAL '5 seconds'
     ORDER BY created_at ASC, id ASC`,
    [ev.user_id, orgId, ev.created_at]
  );
  if (!siblings.length) return null;
  const createdAt = new Date(siblings[0].created_at).getTime();
  const expiresAt = createdAt + PANIC_LIVE_MAX_MS;
  if (expiresAt <= Date.now()) return null;
  if (!siblings.some((s) => s.status === 'active' || s.status === 'acked')) return null;
  const panicId = siblings[0].id;
  if (sessions.has(panicId)) return sessions.get(panicId);
  return register({
    panicId,
    orgId,
    userId: ev.user_id,
    eventIds: siblings.map((s) => s.id),
    roomName: roomFor(panicId),
    createdAt,
    expiresAt,
  });
}

export async function findPanicLive(eventId, orgId) {
  const key = byEvent.get(eventId);
  const s = key ? sessions.get(key) : null;
  if (s) return s.orgId === orgId && s.expiresAt > Date.now() ? s : null;
  return restoreFromDb(eventId, orgId);
}

/** Solo despacho cuyo alcance de seguimiento cubre al emisor (igual que «Ver cámara»). */
export async function canViewPanicLive(user, session) {
  if (!user?.sub || !session) return false;
  if (String(user.sub) === String(session.userId)) return false;
  if (!isDispatch(user.role)) return false;
  const scope = await loadTrackScope(user);
  return unitInTrackScope(scope, await getUserUnitId(session.userId));
}

async function viewerIds(session) {
  const { rows } = await query(
    `SELECT id, role FROM users WHERE organization_id = $1 AND is_active = TRUE AND id <> $2`,
    [session.orgId, session.userId]
  );
  const out = [];
  for (const r of rows) {
    if (!isDispatch(r.role)) continue;
    try {
      if (await canViewPanicLive({ sub: r.id, orgId: session.orgId, role: r.role }, session)) {
        out.push(r.id);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function endPanicLive(panicId, reason = 'resolved') {
  const s = sessions.get(panicId);
  if (!s) return;
  sessions.delete(panicId);
  for (const id of s.eventIds) byEvent.delete(id);
  if (s.timer) clearTimeout(s.timer);
  if (!ioRef) return;
  const payload = { panicId, reason };
  ioRef.to(`user:${s.userId}`).emit('panic:live_end', payload);
  for (const uid of await viewerIds(s).catch(() => [])) {
    ioRef.to(`user:${uid}`).emit('panic:live_end', payload);
  }
}

/** Resuelta/cancelada en todos sus canales → corta la transmisión. */
export async function maybeEndPanicLiveForEvent(eventId, orgId) {
  const s = await findPanicLive(eventId, orgId);
  if (!s) return;
  const { rows } = await query(
    `SELECT COUNT(*)::int AS open FROM panic_events
     WHERE id = ANY($1::uuid[]) AND status IN ('active', 'acked')`,
    [s.eventIds]
  );
  if ((rows[0]?.open ?? 0) === 0) await endPanicLive(s.panicId, 'resolved');
}
