/**
 * Contador de overlays de llamada 1:1 visibles.
 * Los monitores «Ver cámara» (slot) NO deben usar esto — son independientes.
 */
let privateCallUiCount = 0;

export function setPrivateCallUiOpen(open) {
  if (open) {
    privateCallUiCount += 1;
  } else {
    privateCallUiCount = Math.max(0, privateCallUiCount - 1);
  }
}

export function isPrivateCallUiOpen() {
  return privateCallUiCount > 0;
}
