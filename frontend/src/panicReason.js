export const PANIC_REASONS = ['Emergencia', 'Apoyo', 'Médica', 'Agresión'];

export const PANIC_REASON_ICON = {
  Emergencia: '🆘',
  Apoyo: '🤝',
  Médica: '🚑',
  Agresión: '⚠️',
};

/** Motivo y detalle de una alerta (campos del servidor o, en eventos viejos, la nota «Motivo — detalle»). */
export function panicReasonOf(p) {
  if (p?.reason || p?.detail) return { reason: p.reason || null, detail: p.detail || null };
  const text = String(p?.note || '').trim();
  if (!text) return { reason: null, detail: null };
  const reason = PANIC_REASONS.find((r) => text.toLowerCase().startsWith(r.toLowerCase()));
  if (!reason) return { reason: null, detail: text };
  const detail = text.slice(reason.length).replace(/^\s*[—-]\s*/, '').trim();
  return { reason, detail: detail || null };
}
