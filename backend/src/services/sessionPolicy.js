/**
 * Política de sesión: admin/root = multi-dispositivo.
 * Resto: una sesión por dispositivo; solo se avisa/cierra al entrar en OTRO equipo.
 */
import { isAdmin } from './roles.js';

let _io = null;

export function bindSessionIo(io) {
  _io = io;
}

/** Normaliza deviceId del cliente (UUID / id estable). */
export function normalizeDeviceId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 80);
  if (!s || s.length < 8) return null;
  return s;
}

/**
 * Avisa a otras sesiones del mismo usuario (no al dispositivo que acaba de entrar).
 * No fuerza disconnect: el cliente decide con deviceId (evita tumbar pestañas del mismo PC).
 */
export async function notifySessionReplaced(userId, role, { exceptDeviceId = null } = {}) {
  if (isAdmin(role)) return { notified: false };
  if (!_io) return { notified: false };
  _io.to(`user:${userId}`).emit('session:replaced', {
    reason: 'login_elsewhere',
    message: 'Se inició sesión en otro dispositivo',
    deviceId: exceptDeviceId || null,
  });
  return { notified: true, exceptDeviceId };
}

/** Cierra todas las consolas/apps conectadas por socket (p. ej. force-logout admin). */
export async function forceLogoutUserSockets(userId, message = 'Sesión cerrada') {
  if (!_io || !userId) return { notified: false };
  _io.to(`user:${userId}`).emit('session:replaced', {
    reason: 'force_logout',
    message,
    deviceId: null,
  });
  return { notified: true };
}

/** @deprecated usar notifySessionReplaced */
export async function enforceSingleSession(userId, role, opts = {}) {
  return notifySessionReplaced(userId, role, {
    exceptDeviceId: opts.exceptDeviceId ?? null,
  });
}
