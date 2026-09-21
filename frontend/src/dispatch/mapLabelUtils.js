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
 * Partes del indicativo «Grado Apellido[, Cargo]» para triggers compactos.
 * Preferir campos `grade`/`cargo` si vienen; si no, inferir del displayName.
 */
export function operatorCallSignParts({ displayName, grade, cargo } = {}) {
  const full = String(displayName || '').trim();
  let cargoOut = String(cargo || '').trim();
  let gradeOut = String(grade || '').trim();

  if (!cargoOut && full.includes(',')) {
    cargoOut = full.slice(full.lastIndexOf(',') + 1).trim();
  }

  if (!gradeOut && full) {
    const left = full.includes(',') ? full.slice(0, full.lastIndexOf(',')).trim() : full;
    const toks = left.split(/\s+/).filter(Boolean);
    gradeOut = toks.length >= 2 ? toks.slice(0, -1).join(' ') : toks[0] || '';
  }

  const compact = [gradeOut, cargoOut].filter(Boolean).join(', ');
  return {
    full: full || compact || '',
    grade: gradeOut,
    cargo: cargoOut,
    compact: compact || full || '',
  };
}

/**
 * Zoom mínimo para etiquetas de Cargo bajo el pin.
 * Antes 14 ≈ calle/punto (había que estar encima). 11 ≈ barrio/ciudad cercana.
 * Consola, Seguimiento, CC y sitios usan este umbral.
 */
export const CARGO_LABEL_MIN_ZOOM = 11;
