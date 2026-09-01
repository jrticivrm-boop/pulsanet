/**
 * URL Socket.IO.
 * Preferir mismo origen (undefined): Vite/Caddy proxy `/socket.io` → API.
 * Evita mixed content (HTTPS página → HTTP :4000) y un segundo cert en :4000.
 * Si VITE_SOCKET_URL / VITE_API_URL es http:// bajo página https, se ignora.
 */
export function socketUrl() {
  const explicit = (
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).trim();
  if (explicit) {
    if (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      /^http:\/\//i.test(explicit)
    ) {
      return undefined;
    }
    return explicit.replace(/\/$/, '');
  }
  return undefined;
}

export const socketIoOptions = {
  path: '/socket.io',
  // WebSocket primero (menos frágil que long-poll por proxy Vite en 4G);
  // polling queda como fallback.
  transports: ['websocket', 'polling'],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: true,
};
