/**
 * Teléfono de contacto: 10 dígitos (México) o internacional con `+` (10–15 dígitos).
 * Se guarda sin espacios ni guiones: `5512345678` o `+15551234567`.
 * Vacío → null. Formato inválido → Error.
 */
export function parsePhone(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const intl = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (intl) {
    if (digits.length < 10 || digits.length > 15) {
      throw new Error('Teléfono inválido: con + usa de 10 a 15 dígitos');
    }
    return `+${digits}`;
  }
  if (digits.length !== 10) {
    throw new Error('Teléfono inválido: deben ser 10 dígitos');
  }
  return digits;
}
