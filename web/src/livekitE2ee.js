import { ExternalE2EEKeyProvider, Room } from 'livekit-client';
import { RESILIENT_ROOM_OPTIONS } from './privateCallStabilizer.js';

/**
 * Crea una Room LiveKit con E2EE de aplicación cuando el API entrega e2eeKey.
 * WebRTC ya usa DTLS-SRTP; esto cifra medios antes del SFU.
 */
export async function createEncryptedRoom(baseOptions = {}, e2eeKey) {
  const merged = { ...RESILIENT_ROOM_OPTIONS, ...baseOptions };
  if (!e2eeKey) {
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
