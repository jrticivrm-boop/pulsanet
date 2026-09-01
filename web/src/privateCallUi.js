/**
 * Flag global: overlay de llamada privada (full-screen) visible.
 * Evita silenciar el banner de chat y permite z-index correcto.
 */
let privateCallUiOpen = false;

export function setPrivateCallUiOpen(open) {
  privateCallUiOpen = Boolean(open);
}

export function isPrivateCallUiOpen() {
  return privateCallUiOpen;
}
