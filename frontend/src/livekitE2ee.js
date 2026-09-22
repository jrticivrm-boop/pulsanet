import { ExternalE2EEKeyProvider, Room } from 'livekit-client';
import { RESILIENT_ROOM_OPTIONS } from './privateCallStabilizer.js';

/**
 * Crea una Room LiveKit con E2EE de aplicación cuando el API entrega e2eeKey.
 * WebRTC ya usa DTLS-SRTP; esto cifra medios antes del SFU.
 *
 * @param {object} [baseOptions]
 * @param {string|null|undefined} e2eeKey
 * @param {{ requireKey?: boolean }} [opts] — si requireKey y no hay clave, falla (no SRTP-only).
 */
export async function createEncryptedRoom(baseOptions = {}, e2eeKey, opts = {}) {
  const merged = { ...RESILIENT_ROOM_OPTIONS, ...baseOptions };
  const requireKey = Boolean(opts.requireKey);

  if (!e2eeKey) {
    if (requireKey) {
      throw new Error(
        'Cifrado E2EE obligatorio: el servidor no entregó clave de voz.'
      );
    }
    return new Room(merged);
  }

  try {
    const keyProvider = new ExternalE2EEKeyProvider();
    await keyProvider.setKey(e2eeKey);
    const worker = new Worker(new URL('livekit-client/e2ee-worker?worker', import.meta.url), {
      type: 'module',
    });
    return new Room({
      ...merged,
      encryption: {
        keyProvider,
        worker,
      },
    });
  } catch (err) {
    // No degradar en silencio a SRTP-only si el servidor entregó clave: fallar visible.
    console.error('LiveKit E2EE obligatorio falló:', err?.message || err);
    throw new Error(
      'Cifrado de voz (E2EE) no disponible. Revisa worker LiveKit / LIVEKIT_E2EE_SECRET.'
    );
  }
}
