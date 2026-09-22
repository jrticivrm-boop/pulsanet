/**
 * Ajustes GPS por organización (umbral accuracy + intervalo de reporte).
 * Defaults alineados con LocationHeartbeat / gpsQuality actuales.
 */
import { query } from '../db.js';

export const GPS_DEFAULTS = Object.freeze({
  maxAccuracyM: 50,
  intervalSec: 5,
});

export function clampGpsMaxAccuracyM(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 10 || n > 200) return null;
  return n;
}

export function clampGpsIntervalSec(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 2 || n > 60) return null;
  return n;
}

export function normalizeGpsSettings(row) {
  const maxAccuracyM =
    Number(row?.gps_max_accuracy_m) || GPS_DEFAULTS.maxAccuracyM;
  const intervalSec = Number(row?.gps_interval_sec) || GPS_DEFAULTS.intervalSec;
  return {
    maxAccuracyM: Math.min(200, Math.max(10, maxAccuracyM)),
    intervalSec: Math.min(60, Math.max(2, intervalSec)),
  };
}

export async function getOrgGpsSettings(orgId) {
  const { rows } = await query(
    `SELECT gps_max_accuracy_m, gps_interval_sec
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  return normalizeGpsSettings(rows[0] || {});
}
