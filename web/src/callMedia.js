/**
 * Reserva permisos de cámara/mic en el mismo gesto del usuario (clic Contestar / Video).
 * Sin esto, getUserMedia falla si se llama tras awaits de red.
 */
export async function warmUpVideoCallMedia() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
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
  } catch {
    return false;
  }
}
