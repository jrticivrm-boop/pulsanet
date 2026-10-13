import { query } from '../db.js';
import { emitDispatch, emitDispatchTrack } from '../socket/dispatch.js';
import { evaluateGeofences } from './geofences.js';
import { getUserUnitId } from './orgUnits.js';
import { broadcastPresence, heartbeatServicePresence, touchLastSeen } from './presence.js';

/** Una posición recibida también mantiene viva la presencia (focus=service), como mucho cada 45 s. */
const PRESENCE_FROM_LOCATION_MS = 45_000;
const lastPresenceAt = new Map();

function toIsoUtc(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function validateCoords(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return 'latitude y longitude numéricos requeridos';
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return 'Coordenadas fuera de rango';
  }
  return null;
}

async function presenceFromLocation(io, user) {
  const now = Date.now();
  const prev = lastPresenceAt.get(user.sub) || 0;
  if (now - prev < PRESENCE_FROM_LOCATION_MS) return;
  lastPresenceAt.set(user.sub, now);
  if (lastPresenceAt.size > 20_000) lastPresenceAt.clear();
  const result = await heartbeatServicePresence({
    orgId: user.orgId,
    userId: user.sub,
    displayName: user.displayName || 'Usuario',
    focus: 'service',
  });
  if (!result.focusChanged) return;
  emitDispatch(io, 'dispatch:presence', {
    orgId: user.orgId,
    userId: user.sub,
    focus: result.focus || 'service',
  });
  for (const groupId of result.changedGroupIds || []) {
    try {
      await broadcastPresence(io, groupId);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Guarda la posición propia, la emite a despacho con alcance y evalúa geocercas.
 * `presence: true` (APK) = la posición cuenta como latido de presencia.
 */
export async function recordOwnLocation(io, user, { latitude, longitude, accuracyM }, opts = {}) {
  const { rows } = await query(
    `INSERT INTO locations (user_id, latitude, longitude, accuracy_m)
     VALUES ($1, $2, $3, $4)
     RETURNING id, latitude, longitude, accuracy_m, recorded_at`,
    [user.sub, latitude, longitude, accuracyM ?? null]
  );
  if (opts.presence) {
    presenceFromLocation(io, user).catch((err) =>
      console.warn('presence from location:', err.message)
    );
  } else {
    void touchLastSeen(user.sub);
  }

  const { rows: me } = await query(`SELECT avatar_url, unit_id, cargo FROM users WHERE id = $1`, [
    user.sub,
  ]);
  const avatarUrl = me[0]?.avatar_url
    ? `/api/avatars/file/${encodeURIComponent(me[0].avatar_url)}`
    : null;
  const unitId = me[0]?.unit_id || (await getUserUnitId(user.sub));
  const cargo = me[0]?.cargo || null;

  const loc = rows[0];
  emitDispatchTrack(
    io,
    'dispatch:location',
    {
      userId: user.sub,
      displayName: user.displayName || null,
      cargo,
      unitId: unitId || null,
      avatarUrl,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracyM: loc.accuracy_m,
      recordedAt: toIsoUtc(loc.recorded_at),
    },
    { unitId }
  );

  let geofenceEvents = [];
  try {
    geofenceEvents = await evaluateGeofences(io, {
      orgId: user.orgId,
      userId: user.sub,
      displayName: user.displayName || null,
      latitude: loc.latitude,
      longitude: loc.longitude,
      unitId: unitId || null,
    });
  } catch (err) {
    console.error('geofence eval:', err.message);
  }
  return { loc, geofenceEvents };
}
