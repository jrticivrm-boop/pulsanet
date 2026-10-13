import { recordOwnLocation, validateCoords } from '../services/ownLocation.js';

const MIN_GAP_MS = 2_000;

/**
 * GPS del APK por el socket ya abierto (sin TCP/TLS nuevo por envío).
 * La posición cuenta como presencia (focus=service); ack `{ ok }` para reintentar por HTTP.
 */
export function registerLocationHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;
    let lastAt = 0;

    socket.on('location:update', async (payload = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const { latitude, longitude, accuracyM } = payload || {};
        const bad = validateCoords(latitude, longitude);
        if (bad) return reply({ ok: false, error: bad });
        const now = Date.now();
        if (now - lastAt < MIN_GAP_MS) return reply({ ok: true, throttled: true });
        lastAt = now;
        const acc = typeof accuracyM === 'number' && Number.isFinite(accuracyM) ? accuracyM : null;
        await recordOwnLocation(
          io,
          user,
          { latitude, longitude, accuracyM: acc },
          { presence: true }
        );
        reply({ ok: true });
      } catch (err) {
        console.warn('location:update:', err?.message || err);
        reply({ ok: false, error: 'No se pudo guardar la ubicación' });
      }
    });
  });
}
