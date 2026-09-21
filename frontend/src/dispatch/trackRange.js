/** Span máximo seleccionable (30 días). */
export const TRACK_SPAN_MAX_DAYS = 30;
/** Mirada atrás absoluta (margen 1 día sobre el span). */
export const TRACK_LOOKBACK_DAYS = 31;

export const TRACK_SPAN_MAX_HOURS = TRACK_SPAN_MAX_DAYS * 24;
export const TRACK_LOOKBACK_HOURS = TRACK_LOOKBACK_DAYS * 24;

export const TRACK_SPAN_MAX_MS = TRACK_SPAN_MAX_HOURS * 3600 * 1000;
export const TRACK_LOOKBACK_MS = TRACK_LOOKBACK_HOURS * 3600 * 1000;

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Etiqueta compacta para el disparador: «20 sep 2026 · 08:32». */
export function formatTrackRangeLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatMonthYear(date) {
  const d = date instanceof Date ? date : new Date(date);
  const name = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export { WEEKDAYS };

/**
 * Celdas del mes (lunes = primer día). `null` = hueco vacío.
 * @returns {(Date|null)[]}
 */
export function buildMonthCells(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  let startPad = first.getDay() - 1; // Mon=0 … Sun=6
  if (startPad < 0) startPad = 6;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewYear, viewMonth, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function combineDateAndTime(dayDate, hours, minutes) {
  const d = new Date(dayDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Acota [from, to]: sin futuro, no antes de lookback 31 d, span ≤ 30 d.
 * Si from≥to, deja 1 h de span hacia atrás desde to.
 */
export function clampTrackRange(fromDate, toDate, nowMs = Date.now()) {
  const earliest = nowMs - TRACK_LOOKBACK_MS;
  let toMs = toDate instanceof Date ? toDate.getTime() : Number(toDate);
  let fromMs = fromDate instanceof Date ? fromDate.getTime() : Number(fromDate);
  if (!Number.isFinite(toMs)) toMs = nowMs;
  if (!Number.isFinite(fromMs)) fromMs = toMs - 8 * 3600 * 1000;

  if (toMs > nowMs) toMs = nowMs;
  if (toMs < earliest) toMs = earliest;
  if (fromMs < earliest) fromMs = earliest;
  if (fromMs > toMs) fromMs = Math.max(earliest, toMs - 3600 * 1000);
  if (toMs - fromMs > TRACK_SPAN_MAX_MS) {
    fromMs = toMs - TRACK_SPAN_MAX_MS;
  }
  if (fromMs < earliest) fromMs = earliest;

  return {
    from: new Date(fromMs),
    to: new Date(toMs),
    spanHours: Math.max(1, Math.ceil((toMs - fromMs) / 3600000)),
  };
}

export function rangeEndingNow(hours, nowMs = Date.now()) {
  const h = Math.min(Math.max(Number(hours) || 8, 1), TRACK_SPAN_MAX_HOURS);
  return clampTrackRange(new Date(nowMs - h * 3600 * 1000), new Date(nowMs), nowMs);
}

export function trackPollMsForSpan(spanHours) {
  if (spanHours <= 2) return 5_000;
  if (spanHours <= 8) return 10_000;
  if (spanHours <= 24) return 20_000;
  if (spanHours <= 48) return 30_000;
  if (spanHours <= 120) return 45_000;
  return 60_000;
}

/** ¿El día calendario es seleccionable dentro de [earliest, latest]? */
export function isDaySelectable(dayDate, earliestMs, latestMs) {
  const start = startOfDay(dayDate).getTime();
  const end = start + 86400000 - 1;
  return end >= earliestMs && start <= latestMs;
}
