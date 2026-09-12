/**
 * Estados de presencia unificados (mapa + chat).
 * online = verde (app abierta, minimizada o FGS alcanzable)
 * offline = gris
 * stale = rojo (offline > umbral)
 * (service / «En espera» se unifica a online)
 */

export const PRESENCE_LABELS = {
  online: 'En línea',
  offline: 'Desconectado',
  stale: 'Desconectado prolongado',
  // Compat: datos viejos con presence=service
  service: 'En línea',
};

/** @param {string|null|undefined} focus */
export function presenceFromFocus(focus) {
  if (focus === 'foreground' || focus === 'background' || focus === 'service') return 'online';
  return null;
}

/**
 * @param {{ presence?: string, focus?: string|null, lastSeenAt?: string|null, offlineRedMinutes?: number, now?: number }} opts
 */
export function resolvePresenceStatus({
  presence,
  focus,
  lastSeenAt,
  offlineRedMinutes = 15,
  now = Date.now(),
} = {}) {
  if (presence === 'service') return 'online';
  if (presence === 'online' || presence === 'offline' || presence === 'stale') {
    return presence;
  }
  const fromFocus = presenceFromFocus(focus);
  if (fromFocus) return fromFocus;
  const redMs = Math.max(1, Number(offlineRedMinutes) || 15) * 60_000;
  if (lastSeenAt) {
    const t = Date.parse(lastSeenAt);
    if (!Number.isNaN(t) && now - t >= redMs) return 'stale';
  }
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
