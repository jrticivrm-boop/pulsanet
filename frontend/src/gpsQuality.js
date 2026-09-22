/**
 * Filtros ligeros de calidad GPS (reporte web + mapas de despacho).
 * No reescribe el stack: solo descarta fixes malos / saltos absurdos.
 */

/** No enviar si accuracy conocida es peor que esto (metros). null/undefined → sí enviar. */
export const GPS_MAX_ACCURACY_M = 50;

/** Salto absurdo: distancia (m) en ventana corta. */
export const GPS_JUMP_MAX_M = 250;

/** Ventana temporal para considerar salto absurdo (ms). */
export const GPS_JUMP_MAX_MS = 8_000;

/** Lecturas buenas (≤ umbral) antes de publicar el primer punto. */
export const GPS_WARMUP_GOOD_READINGS = 2;

/** Tras este timeout se publica aunque el warm-up no haya cerrado. */
export const GPS_WARMUP_TIMEOUT_MS = 20_000;

/** Mezcla ligera solo si el desplazamiento es jitter pequeño (m). */
export const GPS_SMOOTH_JITTER_M = 35;

/**
 * Distancia haversine en metros.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
export function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** true si accuracy es null/undefined o ≤ umbral. */
export function isAccuracyAcceptable(accuracyM, maxM = GPS_MAX_ACCURACY_M) {
  if (accuracyM == null || !Number.isFinite(Number(accuracyM))) return true;
  return Number(accuracyM) <= maxM;
}

/**
 * Salto absurdo vs punto anterior: mucha distancia en poco tiempo y peor accuracy.
 * @param {{ latitude: number, longitude: number, accuracyM?: number|null, recordedAt?: string|number|Date, t?: number }} prev
 * @param {{ latitude: number, longitude: number, accuracyM?: number|null, recordedAt?: string|number|Date, t?: number }} next
 * @param {(iso: any) => number} [recordedAtMsFn]
 */
export function isAbsurdGpsJump(prev, next, recordedAtMsFn) {
  if (!prev || !next) return false;
  const lat1 = Number(prev.latitude);
  const lng1 = Number(prev.longitude);
  const lat2 = Number(next.latitude);
  const lng2 = Number(next.longitude);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return false;

  const dist = haversineM(lat1, lng1, lat2, lng2);
  if (dist <= GPS_JUMP_MAX_M) return false;

  const tPrev =
    typeof prev.t === 'number'
      ? prev.t
      : recordedAtMsFn
        ? recordedAtMsFn(prev.recordedAt)
        : Number(prev.recordedAt) || 0;
  const tNext =
    typeof next.t === 'number'
      ? next.t
      : recordedAtMsFn
        ? recordedAtMsFn(next.recordedAt)
        : Number(next.recordedAt) || Date.now();
  const dt = tNext - tPrev;
  if (!(dt > 0 && dt < GPS_JUMP_MAX_MS)) return false;

  const newAcc = next.accuracyM;
  const oldAcc = prev.accuracyM;
  if (newAcc == null || !Number.isFinite(Number(newAcc))) return false;
  const n = Number(newAcc);
  if (oldAcc != null && Number.isFinite(Number(oldAcc)) && n <= Number(oldAcc)) return false;
  // Peor accuracy (o mala) + salto grande → descartar
  return n > (oldAcc != null && Number.isFinite(Number(oldAcc)) ? Number(oldAcc) : GPS_MAX_ACCURACY_M * 0.6);
}

/**
 * Suavizado ligero (lerp) solo ante jitter; movimiento real pasa tal cual.
 * @param {{ latitude: number, longitude: number, accuracyM?: number|null }} prev
 * @param {{ latitude: number, longitude: number, accuracyM?: number|null }} next
 */
export function softSmoothFix(prev, next) {
  if (!prev) return next;
  const dist = haversineM(
    Number(prev.latitude),
    Number(prev.longitude),
    Number(next.latitude),
    Number(next.longitude)
  );
  if (!(dist > 0) || dist > GPS_SMOOTH_JITTER_M) return next;
  const a = 0.65;
  return {
    ...next,
    latitude: Number(prev.latitude) * (1 - a) + Number(next.latitude) * a,
    longitude: Number(prev.longitude) * (1 - a) + Number(next.longitude) * a,
  };
}

/**
 * Estado de arranque: no publicar hasta N lecturas buenas o timeout.
 */
export function createGpsWarmupGate({
  goodReadings = GPS_WARMUP_GOOD_READINGS,
  timeoutMs = GPS_WARMUP_TIMEOUT_MS,
  maxAccuracyM = GPS_MAX_ACCURACY_M,
} = {}) {
  const startedAt = Date.now();
  let good = 0;
  let ready = false;

  return {
    /** @param {number|null|undefined} accuracyM */
    allow(accuracyM) {
      if (ready) return true;
      if (Date.now() - startedAt >= timeoutMs) {
        ready = true;
        return true;
      }
      if (isAccuracyAcceptable(accuracyM, maxAccuracyM)) {
        good += 1;
        if (good >= goodReadings) {
          ready = true;
          return true;
        }
        return false;
      }
      return false;
    },
    get isReady() {
      return ready;
    },
  };
}
