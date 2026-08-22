import crypto from 'crypto';

/**
 * Contraseña temporal legible (sin ambigüedad 0/O, 1/I/l).
 * Formato: 4 letras + 4 dígitos + 2 letras ≈ 10 caracteres.
 */
export function generateTemporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (alphabet, n) => {
    const bytes = crypto.randomBytes(n);
    let out = '';
    for (let i = 0; i < n; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  };
  return `${pick(letters, 4)}${pick(digits, 4)}${pick(letters, 2)}`;
}

export function validateNewPassword(password) {
  const p = String(password || '');
  if (p.length < 8) {
    return 'La nueva contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return 'La nueva contraseña debe incluir letras y números';
  }
  return null;
}
