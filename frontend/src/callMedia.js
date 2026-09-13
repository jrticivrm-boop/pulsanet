import { esMsg } from './esMsg';

/**
 * Reserva permisos de cámara/mic en el mismo gesto del usuario (clic Contestar / Video).
 * Sin esto, getUserMedia falla si se llama tras awaits de red.
 * @returns {Promise<boolean>}
 */
export async function warmUpVideoCallMedia() {
  if (!window.isSecureContext) {
    throw new Error(
      esMsg('Not a secure context', 'Abre la consola por HTTPS. En HTTP el navegador no permite cámara ni micrófono.')
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      esMsg(
        'mediaDevices unavailable',
        'Este navegador no expone cámara/micrófono. Usa HTTPS o un navegador reciente.'
      )
    );
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    return true;
  } catch (e) {
    throw new Error(esMsg(e?.message || e, 'No se pudo preparar cámara/micrófono'));
  }
}
