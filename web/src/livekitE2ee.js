import { ExternalE2EEKeyProvider, Room } from 'livekit-client';

/**
 * Crea una Room LiveKit con E2EE de aplicación cuando el API entrega e2eeKey.
 * WebRTC ya usa DTLS-SRTP; esto cifra medios antes del SFU.
 */
export async function createEncryptedRoom(baseOptions = {}, e2eeKey) {
  if (!e2eeKey) {
    return new Room(baseOptions);
  }

  try {
    const keyProvider = new ExternalE2EEKeyProvider();
    await keyProvider.setKey(e2eeKey);
    const worker = new Worker(new URL('livekit-client/e2ee-worker?worker', import.meta.url), {
      type: 'module',
    });
    return new Room({
      ...baseOptions,
      encryption: {
        keyProvider,
        worker,
      },
    });
  } catch (err) {
    console.warn('LiveKit E2EE no disponible, conectando con SRTP solo:', err?.message || err);
    return new Room(baseOptions);
  }
}
