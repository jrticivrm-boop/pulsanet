import { query } from '../db.js';
import { emitDispatchTrack } from '../socket/dispatch.js';
import { logUserEvent } from './userEvents.js';

const EARTH_M = 6371000;

/** Distancia Haversine en metros */
export function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Evalúa enter/exit de geocercas activas de la org tras un reporte GPS.
 * Emite dispatch:geofence por cada transición y persiste en user_events.
 */
export async function evaluateGeofences(
  io,
  { orgId, userId, displayName, latitude, longitude, unitId = null }
) {
  const { rows: fences } = await query(
    `SELECT id, name, center_lat, center_lng, radius_m
     FROM geofences
     WHERE organization_id = $1 AND is_active = TRUE`,
    [orgId]
  );
  if (!fences.length) return [];

  const { rows: prevRows } = await query(
    `SELECT geofence_id, inside FROM geofence_presence
     WHERE user_id = $1 AND geofence_id = ANY($2::uuid[])`,
    [userId, fences.map((f) => f.id)]
  );
  const prev = new Map(prevRows.map((r) => [r.geofence_id, r.inside]));

  const events = [];
  for (const f of fences) {
    const dist = haversineM(latitude, longitude, f.center_lat, f.center_lng);
    const inside = dist <= f.radius_m;
    const was = prev.has(f.id) ? prev.get(f.id) : null;

    await query(
      `INSERT INTO geofence_presence (geofence_id, user_id, inside, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (geofence_id, user_id)
       DO UPDATE SET inside = EXCLUDED.inside, updated_at = NOW()`,
      [f.id, userId, inside]
    );

    if (was === null) {
      if (!inside) continue;
    } else if (was === inside) {
      continue;
    }

    const event = inside ? 'enter' : 'exit';
    const fenceName = f.name || 'Geocerca';
    const payload = {
      userId,
      displayName: displayName || null,
      geofenceId: f.id,
      name: fenceName,
      event,
      distanceM: Math.round(dist),
      latitude,
      longitude,
      at: new Date().toISOString(),
    };
    events.push(payload);
    emitDispatchTrack(io, 'dispatch:geofence', payload, { unitId });
    void logUserEvent({
      organizationId: orgId,
      subjectUserId: userId,
      kind: 'geofence',
      summary: inside
        ? `Entró a la geocerca «${fenceName}»`
        : `Salió de la geocerca «${fenceName}»`,
      meta: {
        event,
        geofenceId: f.id,
        name: fenceName,
        distanceM: Math.round(dist),
        latitude,
        longitude,
      },
    });
  }
  return events;
}
