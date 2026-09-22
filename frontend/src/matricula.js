/**
 * Matrícula (un solo campo): letra A/B/C/D + guion automático + números.
 * - No admite números al inicio (primero la letra).
 * - Al escribir la letra se muestra "A-" / "D-" de inmediato.
 * - Backspace sobre el guion borra letra+guion (para poder cambiar de letra).
 * - A → máx. 8 dígitos; B/C/D → máx. 7.
 * Misma regla en backend/src/services/matricula.js
 */

export const MATRICULA_LETRAS = ['A', 'B', 'C', 'D'];

export function matriculaDigitMax(letter) {
  return String(letter || '').toUpperCase() === 'A' ? 8 : 7;
}

export function isAllowedMatriculaLetter(letter) {
  return MATRICULA_LETRAS.includes(String(letter || '').toUpperCase());
}

/**
 * Normaliza mientras se escribe: `b123` → `B-123`, `D` → `D-`.
 * @param {string} raw
 * @param {{ prev?: string }} [opts] — valor anterior (para detectar Backspace en "D-")
 */
export function formatMatriculaInput(raw, opts = {}) {
  const prev = String(opts.prev ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const s = String(raw || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!s) return '';

  // Backspace: "D-" → "D"  ⇒  vaciar (no reinsertar el guion).
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

export function splitMatricula(value) {
  const formatted = formatMatriculaInput(value);
  const m = /^([ABCD])-(\d*)$/.exec(formatted);
  if (!m) return { letter: '', digits: '' };
  return { letter: m[1], digits: m[2] || '' };
}

/** Une letra + dígitos (A=8, B/C/D=7). */
export function joinMatricula(letter, digits) {
  const L = String(letter || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 1);
  if (!L || !isAllowedMatriculaLetter(L)) return '';
  const max = matriculaDigitMax(L);
  const D = String(digits || '')
    .replace(/\D/g, '')
    .slice(0, max);
  return `${L}-${D}`;
}

/** Completa: letra A–D, guion y exactamente 8 (A) o 7 (B/C/D) dígitos. */
export function isValidMatricula(value) {
  const formatted = formatMatriculaInput(value);
  const m = /^([ABCD])-(\d+)$/.exec(formatted);
  if (!m) return false;
  const max = matriculaDigitMax(m[1]);
  return m[2].length === max;
}
