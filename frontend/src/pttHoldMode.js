import { canManageUsers } from './api';

export const PTT_MODE_KEY = 'tpx_ptt_mode_v1';
export const PTT_MODE_EVENT = 'tpx-ptt-mode';

/** Default por rol si no hay preferencia guardada. */
export function defaultPttLatch(user) {
  return canManageUsers(user);
}

/**
 * Preferencia de usuario: latch (Toque) vs hold (Mantén).
 * @returns {boolean|null} true/false o null si no hay valor guardado
 */
export function readStoredPttLatch() {
  try {
    const v = localStorage.getItem(PTT_MODE_KEY);
    if (v === 'latch' || v === 'touch' || v === 'toque' || v === 'larga') return true;
    if (v === 'hold' || v === 'manten' || v === 'mantener' || v === 'corta') return false;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolvePttLatch(user) {
  const stored = readStoredPttLatch();
  if (stored !== null) return stored;
  return defaultPttLatch(user);
}

export function setPttLatchMode(latch) {
  try {
    localStorage.setItem(PTT_MODE_KEY, latch ? 'latch' : 'hold');
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(PTT_MODE_EVENT, { detail: { latch: !!latch } }));
  } catch {
    /* ignore */
  }
}

/** @deprecated usar resolvePttLatch — se mantiene nombre histórico */
export function pttUsesLatch(user) {
  return resolvePttLatch(user);
}
