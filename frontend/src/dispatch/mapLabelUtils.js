/**
 * Etiqueta de mapa = solo Cargo.
 * Si el texto viene como «Cap. 1/o. Luna, Jefe S.T.I.», se toma lo posterior a la coma.
 */
export function cargoLabelFromText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const comma = raw.lastIndexOf(',');
  if (comma >= 0) {
    const after = raw.slice(comma + 1).trim();
    if (after) return after;
  }
  return raw;
}

/**
 * Zoom mínimo para etiquetas de Cargo bajo el pin.
 * Antes 14 ≈ calle/punto (había que estar encima). 11 ≈ barrio/ciudad cercana.
 * Consola, Seguimiento, CC y sitios usan este umbral.
 */
export const CARGO_LABEL_MIN_ZOOM = 11;
