/** Teléfono guardado como `8112345678` o `+525512345678` (ver backend/services/phone.js). */

function digitsOf(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/** 81 1234 5678 · +52 55 1234 5678 */
export function formatPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const d = digitsOf(s);
  if (!s.startsWith('+') && d.length === 10) {
    return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  }
  if (s.startsWith('+') && d.length === 12 && d.startsWith('52')) {
    return `+52 ${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
  }
  return s.startsWith('+') ? `+${d}` : d;
}

export function telHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return `tel:${s.startsWith('+') ? '+' : ''}${digitsOf(s)}`;
}

/** WhatsApp: 10 dígitos sin lada = México (+52). */
export function whatsappHref(raw) {
  const s = String(raw || '').trim();
  const d = digitsOf(s);
  if (!d) return '';
  const intl = !s.startsWith('+') && d.length === 10 ? `52${d}` : d;
  return `https://wa.me/${intl}`;
}
