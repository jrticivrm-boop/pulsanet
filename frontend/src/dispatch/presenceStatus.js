/**
 * Estados de presencia unificados (mapa + chat).
 * online = verde (app abierta o ausente aún dentro del margen)
 * away = amarillo Ausente (minimizada/2º plano/cerrada ≥ tiempo de ausencia)
 * offline = gris
 * stale = rojo Fuera de línea
 *
 * showAway / showOffline (org): apagan colores intermedios.
 */

import { CLOCK_SKEW_MS, LIVE_FRESH_MS, recordedAtMs } from './liveTiming.js';

export const PRESENCE_LABELS = {
  online: 'En línea',
  away: 'Ausente',
  offline: 'Desconectado',
  stale: 'Fuera de línea',
  // Compat
  service: 'En línea',
};

function isAwayFocus(focus) {
  return focus === 'background' || focus === 'service';
}

function latestSeenMs(lastSeenAt, recordedAt) {
  const a = recordedAtMs(lastSeenAt);
  const b = recordedAtMs(recordedAt);
  return Math.max(a || 0, b || 0) || 0;
}

/** Fusiona estados desactivados: away→online, offline→stale. */
export function applyPresenceDisplayFlags(
  status,
  { showAway = true, showOffline = true } = {}
) {
  let s = status;
  if (s === 'away' && showAway === false) s = 'online';
  if (s === 'offline' && showOffline === false) s = 'stale';
  return s;
}

/**
 * @param {{
 *   presence?: string,
 *   focus?: string|null,
 *   lastSeenAt?: string|null,
 *   recordedAt?: string|null,
 *   awaySince?: number|string|null,
 *   offlineRedMinutes?: number,
 *   absenceMinutes?: number,
 *   showAway?: boolean,
 *   showOffline?: boolean,
 *   now?: number
 * }} opts
 */
export function resolvePresenceStatus({
  presence,
  focus,
  lastSeenAt,
  recordedAt,
  awaySince = null,
  offlineRedMinutes = 15,
  absenceMinutes = 15,
  showAway = true,
  showOffline = true,
  now = Date.now(),
} = {}) {
  let status;

  // Si el API ya resolvió el estado, respetarlo (salvo service legado → online).
  if (presence === 'away' || presence === 'offline' || presence === 'stale' || presence === 'online') {
    status = presence;
  } else if (focus === 'foreground') {
    status = 'online';
  } else if (isAwayFocus(focus) || presence === 'service') {
    const absMin = Number(absenceMinutes);
    if (!Number.isFinite(absMin) || absMin <= 0 || showAway === false) {
      status = 'online';
    } else {
      const since = awaySince != null ? Number(awaySince) : NaN;
      if (Number.isFinite(since) && since > 0 && now - since >= absMin * 60_000) {
        status = 'away';
      } else {
        status = 'online';
      }
    }
  } else {
    const redMin = Number(offlineRedMinutes);
    if (!Number.isFinite(redMin) || redMin <= 0 || showOffline === false) {
      status = 'stale';
    } else {
      const latest = latestSeenMs(lastSeenAt, recordedAt);
      if (latest) {
        const age = now - latest;
        if (age < 0 && age > -CLOCK_SKEW_MS) {
          /* clock skew */
        } else if (age >= 0 && age < LIVE_FRESH_MS + CLOCK_SKEW_MS && focus) {
          status = 'online';
        } else if (age >= redMin * 60_000) {
          status = 'stale';
        }
      }
      if (!status) {
        if (presence === 'stale') status = 'stale';
        else status = 'offline';
      }
    }
  }

  return applyPresenceDisplayFlags(status, { showAway, showOffline });
}

/** IDs de estado visibles según flags de org. */
export function visiblePresenceStatusIds({ showAway = true, showOffline = true } = {}) {
  const ids = ['online'];
  if (showAway) ids.push('away');
  if (showOffline) ids.push('offline');
  ids.push('stale');
  return ids;
}

/** Clase CSS del punto de chat / lista. */
export function presenceDotClass(status) {
  switch (status) {
    case 'online':
    case 'service':
      return 'active';
    case 'away':
      return 'away';
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
    case 'away':
      return 'is-away';
    case 'stale':
      return 'is-stale';
    default:
      return 'is-offline';
  }
}

/** Colores de pin / cluster pastel (paridad con `.lt-wa.is-* --pin-green`). */
export const PRESENCE_CLUSTER_COLORS = {
  online: '#1f5a2e',
  away: '#a16207',
  offline: '#6b7280',
  stale: '#991b1b',
  panic: '#c62828',
};

/** Orden estable de porciones en el pastel del cluster. */
export const PRESENCE_CLUSTER_SLICE_ORDER = [
  'online',
  'away',
  'offline',
  'stale',
  'panic',
];
