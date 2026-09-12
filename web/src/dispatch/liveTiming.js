import { isAbsurdGpsJump } from '../gpsQuality.js';

/** Tiempos alineados con el latido GPS de la app (LocationHeartbeat ~5 s). */
export const GPS_HEARTBEAT_MS = 5_000;
/** Poll de lista de ubicaciones en mapas de despacho. */
export const LOCATION_POLL_MS = GPS_HEARTBEAT_MS;
/** Refresco del rastro/historial del operador seleccionado. */
export const TRACK_POLL_MS = GPS_HEARTBEAT_MS;
/** “En vivo” = señal más reciente que este umbral (~6 latidos). */
export const LIVE_FRESH_MS = 30_000;
/**
 * Tolerancia si el reloj del Host PC va adelantado respecto al servidor.
 * Sin esto, en otra máquina el mapa nunca marca «en vivo» aunque el GPS esté OK.
 */
export const CLOCK_SKEW_MS = 120_000;

/**
 * Parsea recordedAt a epoch ms.
 * Si llega sin zona (p. ej. "2026-08-25 21:00:00"), se interpreta como UTC
 * para no desalinear con el navegador (México UTC−6, etc.).
 */
export function recordedAtMs(iso) {
  if (iso == null || iso === '') return 0;
  if (iso instanceof Date) {
    const t = iso.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof iso === 'number') {
    return Number.isFinite(iso) ? iso : 0;
  }
  let s = String(iso).trim();
  if (!s) return 0;
  // SQL / pg sin Z: "YYYY-MM-DD HH:MM:SS(.mmm)" o con T sin offset
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
  ) {
    s = `${s.replace(' ', 'T')}Z`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function isFresh(iso, now = Date.now()) {
  const t = recordedAtMs(iso);
  if (!t) return false;
  const age = now - t;
  // Reloj del Host atrasado → timestamp «en el futuro»: seguir en vivo
  if (age < 0) return age > -CLOCK_SKEW_MS;
  // Reloj adelantado infla la edad; tolerar desfase típico entre PCs
  return age < LIVE_FRESH_MS + CLOCK_SKEW_MS;
}

/** Etiqueta relativa clara (no implica “en vivo” si está vieja). */
export function ageLabel(iso, now = Date.now()) {
  const t = recordedAtMs(iso);
  if (!t) return 'Sin señal';
  const ms = now - t;
  if (!Number.isFinite(ms)) return 'Sin señal';
  if (ms < 0) return 'Ahora';
  if (ms < 8_000) return 'En vivo';
  if (ms < 60_000) return `Hace ${Math.max(1, Math.round(ms / 1000))} s`;
  if (ms < 3_600_000) return `Hace ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < 48 * 3_600_000) return `Hace ${Math.max(1, Math.round(ms / 3_600_000))} h`;
  const days = Math.max(1, Math.round(ms / 86_400_000));
  return `Hace ${days} d`;
}

/** Hora local absoluta para el popup (complementa ageLabel). */
export function recordedAtLocal(iso) {
  const t = recordedAtMs(iso);
  if (!t) return '';
  try {
    return new Date(t).toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Texto de estado GPS para mapa / ficha. */
export function gpsStatusLine(iso, now = Date.now()) {
  const label = ageLabel(iso, now);
  if (!recordedAtMs(iso)) return label;
  if (isFresh(iso, now)) return `${label} · compartiendo`;
  return `${label} · desactualizado`;
}

/** Fusiona ubicaciones sin pisar un fix más nuevo (socket vs poll). */
export function mergeLocations(prev, incoming) {
  const map = new Map((prev || []).map((l) => [l.userId, l]));
  for (const loc of incoming || []) {
    if (!loc?.userId) continue;
    const old = map.get(loc.userId);
    if (!old || recordedAtMs(loc.recordedAt) >= recordedAtMs(old.recordedAt)) {
      const next = {
        ...loc,
        displayName: loc.displayName || old?.displayName || loc.userId,
        cargo: loc.cargo ?? old?.cargo ?? null,
        avatarUrl: loc.avatarUrl ?? old?.avatarUrl ?? null,
      };
      if (old && isAbsurdGpsJump(old, next, recordedAtMs)) {
        // Conserva posición previa; actualiza avatar/nombre/cargo si vino en el poll.
        let patched = old;
        if (loc.avatarUrl && !old.avatarUrl) {
          patched = { ...patched, avatarUrl: loc.avatarUrl };
        }
        if (loc.displayName && loc.displayName !== old.displayName) {
          patched = { ...patched, displayName: loc.displayName };
        }
        if (loc.cargo && loc.cargo !== old.cargo) {
          patched = { ...patched, cargo: loc.cargo };
        }
        if (patched !== old) map.set(loc.userId, patched);
        continue;
      }
      map.set(loc.userId, next);
    } else if (loc.avatarUrl && !old.avatarUrl) {
      map.set(loc.userId, { ...old, avatarUrl: loc.avatarUrl });
    }
  }
  return [...map.values()];
}

export function upsertLocation(prev, payload) {
  if (!payload?.userId) return prev || [];
  const old = (prev || []).find((l) => l.userId === payload.userId);
  const nextLoc = {
    userId: payload.userId,
    displayName: payload.displayName || old?.displayName || payload.userId,
    cargo: payload.cargo ?? old?.cargo ?? null,
    avatarUrl: payload.avatarUrl ?? old?.avatarUrl ?? null,
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    accuracyM: payload.accuracyM,
    recordedAt: payload.recordedAt || new Date().toISOString(),
  };
  // Evita teletransporte en mapa si el salto es absurdo y la accuracy empeora.
  if (old && isAbsurdGpsJump(old, nextLoc, recordedAtMs)) {
    return prev || [];
  }
  const rest = (prev || []).filter((l) => l.userId !== payload.userId);
  return [...rest, nextLoc];
}
