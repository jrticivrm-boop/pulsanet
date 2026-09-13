/**
 * Estados de presencia unificados (mapa + chat).
 * online = verde (app abierta, minimizada, FGS o GPS en vivo)
 * offline = gris
 * stale = rojo (sin señal > umbral)
 * (service / «En espera» se unifica a online)
 */

import { CLOCK_SKEW_MS, LIVE_FRESH_MS, recordedAtMs } from './liveTiming.js';

export const PRESENCE_LABELS = {
  online: 'En línea',
  offline: 'Desconectado',
  stale: 'Fuera de línea',
  // Compat: datos viejos con presence=service
  service: 'En línea',
};

/** @param {string|null|undefined} focus */
export function presenceFromFocus(focus) {
  if (focus === 'foreground' || focus === 'background' || focus === 'service') return 'online';
  return null;
}

function latestSeenMs(lastSeenAt, recordedAt) {
  const a = recordedAtMs(lastSeenAt);
  const b = recordedAtMs(recordedAt);
  return Math.max(a || 0, b || 0) || 0;
}

/**
 * @param {{ presence?: string, focus?: string|null, lastSeenAt?: string|null, recordedAt?: string|null, offlineRedMinutes?: number, now?: number }} opts
 */
export function resolvePresenceStatus({
  presence,
  focus,
  lastSeenAt,
  recordedAt,
  offlineRedMinutes = 15,
  now = Date.now(),
} = {}) {
  if (presence === 'service') return 'online';
  const fromFocus = presenceFromFocus(focus);
  if (fromFocus) return fromFocus;

  const latest = latestSeenMs(lastSeenAt, recordedAt);
  if (latest) {
    const age = now - latest;
    if (age < 0) {
      if (age > -CLOCK_SKEW_MS) return 'online';
    } else if (age < LIVE_FRESH_MS + CLOCK_SKEW_MS) {
      return 'online';
    }
  }

  if (presence === 'online') return 'online';

  const redMs = Math.max(1, Number(offlineRedMinutes) || 15) * 60_000;
  if (latest && now - latest >= redMs) return 'stale';
  if (presence === 'stale') return 'stale';
  return 'offline';
}

/** Clase CSS del punto de chat / lista. */
export function presenceDotClass(status) {
  switch (status) {
    case 'online':
    case 'service':
      return 'active';
    case 'stale':
      return 'stale';
    default:
      return 'offline';
  }
}

export function presencePinClass(status) {
  switch (status) {
    case 'online':
    case 'service':
      return 'is-live';
    case 'stale':
      return 'is-stale';
    default:
      return 'is-offline';
  }
}
