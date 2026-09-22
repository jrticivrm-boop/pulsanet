/**
 * Matrícula estilo Reclutamiento IV R.M.:
 * letra A/B/C/D + guion + números.
 * A → 8 dígitos; B/C/D → 7 dígitos.
 */

export const MATRICULA_LETRAS = ['A', 'B', 'C', 'D'];

export function matriculaDigitMax(letter) {
  return String(letter || '').toUpperCase() === 'A' ? 8 : 7;
}

export function isAllowedMatriculaLetter(letter) {
  return MATRICULA_LETRAS.includes(String(letter || '').toUpperCase());
}

/** Normaliza: `b123` → `B-123`, `D` → `D-`. Solo A–D.
 * opts.prev: valor anterior (Backspace en "D-" limpia el campo).
 */
export function formatMatriculaInput(raw, opts = {}) {
  const prev = String(opts.prev ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const s = String(raw || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!s) return '';

  if (/^[ABCD]-$/.test(prev) && /^[ABCD]$/.test(s)) {
    return '';
  }

  let letter = '';
  const digits = [];
  for (const ch of s) {
    if (!letter && /[A-Z]/.test(ch)) {
      if (!isAllowedMatriculaLetter(ch)) continue;
      letter = ch;
      continue;
    }
    if (letter && /\d/.test(ch)) digits.push(ch);
  }

  if (!letter) return '';
  const max = matriculaDigitMax(letter);
  return `${letter}-${digits.join('').slice(0, max)}`;
}

/** Completa: letra A–D, guion y exactamente 8 (A) o 7 (B/C/D) dígitos. */
export function isValidMatricula(value) {
  const formatted = formatMatriculaInput(value);
  const m = /^([ABCD])-(\d+)$/.exec(formatted);
  if (!m) return false;
  const max = matriculaDigitMax(m[1]);
  return m[2].length === max;
}

/** Normaliza y valida; lanza Error con mensaje en español si falla. */
export function parseMatricula(raw) {
  const formatted = formatMatriculaInput(raw);
  if (!formatted || /^[ABCD]-$/.test(formatted)) {
    throw new Error('Matrícula requerida (ej. D-1412643 / A-12345678)');
  }
  if (!/^[ABCD]-/.test(formatted)) {
    throw new Error('Matrícula: debe iniciar con A-, B-, C- o D-');
  }
  if (!isValidMatricula(formatted)) {
    const letter = formatted[0];
    const max = matriculaDigitMax(letter);
    throw new Error(
      `Matrícula: ${letter}- lleva ${max} números (ej. ${letter === 'A' ? 'A-12345678' : 'D-1412643'})`,
    );
  }
  return formatted;
}
