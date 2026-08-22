/** URL Socket.IO: en Vite apunta directo a la API (el proxy WS es inestable). */
export function socketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.DEV) return 'http://127.0.0.1:4000';
  return undefined; // misma origen en producción
}

export const socketIoOptions = {
  transports: ['polling', 'websocket'],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
};
