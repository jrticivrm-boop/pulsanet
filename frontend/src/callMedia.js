import { esMsg } from './esMsg';

/**
 * Reserva permisos de cámara/mic en el mismo gesto del usuario (clic Contestar / Video).
 * Sin esto, getUserMedia falla si se llama tras awaits de red.
 * Si el mic está bloqueado, intenta solo video (no tumba toda la sesión).
 * @param {{ audio?: boolean, video?: boolean }} [opts]
 * @returns {Promise<{ audio: boolean, video: boolean }>}
 */
export async function warmUpVideoCallMedia(opts = {}) {
  const wantAudio = opts.audio !== false;
  const wantVideo = opts.video !== false;
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

  const stopAll = (stream) => {
    stream?.getTracks?.().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
  };

  const tryGet = async (constraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stopAll(stream);
    return true;
  };

  let audio = false;
  let video = false;

  if (wantAudio && wantVideo) {
    try {
      await tryGet({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      return { audio: true, video: true };
    } catch {
      /* degradar */
    }
  }

  if (wantVideo) {
    try {
      await tryGet({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video = true;
    } catch {
      /* ignore */
    }
  }

  if (wantAudio) {
    try {
      await tryGet({ video: false, audio: true });
      audio = true;
    } catch {
      /* ignore */
    }
  }

  if (!audio && !video && (wantAudio || wantVideo)) {
    // Sin permisos aún: no lanzar — la sesión puede unirse y pedir mic/cámara al pulsar el botón.
    return { audio: false, video: false };
  }

  return { audio, video };
}
