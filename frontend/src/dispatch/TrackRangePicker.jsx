import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveDropdownPortalHost } from './dropdownPortalHost.js';
import {
  claimMsPanel,
  createMsPanelId,
  subscribeMsPanelExclusive,
} from './exclusiveMsPanel.js';
import {
  TRACK_LOOKBACK_MS,
  TRACK_SPAN_MAX_DAYS,
  WEEKDAYS,
  buildMonthCells,
  clampTrackRange,
  combineDateAndTime,
  formatMonthYear,
  formatTrackRangeLabel,
  isDaySelectable,
  sameCalendarDay,
  startOfDay,
} from './trackRange.js';

const MINUTE_STEP = 5;

function snapMinutes(m) {
  const n = Math.round(Number(m) / MINUTE_STEP) * MINUTE_STEP;
  if (n >= 60) return 55;
  if (n < 0) return 0;
  return n;
}

function TimeStepper({ label, value, onChange, min = 0, max = 23, step = 1 }) {
  function bump(delta) {
    let next = value + delta;
    if (next > max) next = min;
    if (next < min) next = max;
    onChange(next);
  }
  return (
    <div className="trp-stepper">
      <span className="trp-stepper__label">{label}</span>
      <div className="trp-stepper__ctrl">
        <button type="button" className="trp-stepper__btn" aria-label={`Bajar ${label}`} onClick={() => bump(-step)}>
          −
        </button>
        <span className="trp-stepper__value">{String(value).padStart(2, '0')}</span>
        <button type="button" className="trp-stepper__btn" aria-label={`Subir ${label}`} onClick={() => bump(step)}>
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Periodo de ruta: disparadores Desde/Hasta + popover calendario/hora (solo clic).
 */
export default function TrackRangePicker({ from, to, onChange }) {
  const [openWhich, setOpenWhich] = useState(null); // 'from' | 'to' | null
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const fromBtnRef = useRef(null);
  const toBtnRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('track-range'));

  const range = useMemo(() => clampTrackRange(from, to), [from, to]);
  const nowMs = Date.now();
  const earliestMs = nowMs - TRACK_LOOKBACK_MS;
  const latestMs = nowMs;

  const activeValue = openWhich === 'to' ? range.to : range.from;
  const [draftDay, setDraftDay] = useState(() => startOfDay(activeValue));
  const [draftHour, setDraftHour] = useState(() => activeValue.getHours());
  const [draftMinute, setDraftMinute] = useState(() => snapMinutes(activeValue.getMinutes()));
  const [viewYear, setViewYear] = useState(() => activeValue.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => activeValue.getMonth());

  useEffect(() => subscribeMsPanelExclusive(panelIdRef.current, () => setOpenWhich(null)), []);
  useEffect(() => {
    if (openWhich) claimMsPanel(panelIdRef.current);
  }, [openWhich]);

  useEffect(() => {
    if (!openWhich) return;
    const base = openWhich === 'to' ? range.to : range.from;
    setDraftDay(startOfDay(base));
    setDraftHour(base.getHours());
    setDraftMinute(snapMinutes(base.getMinutes()));
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [openWhich, range.from, range.to]);

  const placePanel = useCallback(() => {
    const btn = openWhich === 'to' ? toBtnRef.current : fromBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.min(292, Math.max(268, window.innerWidth - 16));
    let left = r.left;
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    let top = Math.round(r.bottom + 6);
    const approxH = 300;
    if (top + approxH > window.innerHeight - 8) {
      top = Math.max(8, Math.round(r.top - approxH - 6));
    }
    setPanelStyle({
      position: 'fixed',
      top,
      left: Math.round(left),
      width: Math.round(width),
      zIndex: 20060,
    });
  }, [openWhich]);

  useLayoutEffect(() => {
    if (!openWhich) {
      setPanelStyle(null);
      return undefined;
    }
    placePanel();
    const onWin = () => placePanel();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [openWhich, placePanel]);

  useEffect(() => {
    if (!openWhich) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpenWhich(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenWhich(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openWhich]);

  const monthCells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function applyDraft() {
    const combined = combineDateAndTime(draftDay, draftHour, draftMinute);
    if (openWhich === 'from') {
      onChange?.(clampTrackRange(combined, range.to));
    } else {
      onChange?.(clampTrackRange(range.from, combined));
    }
    setOpenWhich(null);
  }

  function setUntilNow() {
    const now = new Date();
    if (openWhich === 'from') {
      onChange?.(clampTrackRange(now, range.to));
    } else {
      onChange?.(clampTrackRange(range.from, now));
    }
    setOpenWhich(null);
  }

  const panelHost = resolveDropdownPortalHost();
  const panel =
    openWhich && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="trp-panel"
            style={panelStyle}
            role="dialog"
            aria-label={openWhich === 'from' ? 'Seleccionar inicio del periodo' : 'Seleccionar fin del periodo'}
          >
            <header className="trp-panel__head">
              <strong>{openWhich === 'from' ? 'Desde' : 'Hasta'}</strong>
              <span className="trp-panel__limit">Máx. {TRACK_SPAN_MAX_DAYS} días</span>
            </header>

            <div className="trp-cal">
              <div className="trp-cal__nav">
                <button type="button" className="trp-cal__nav-btn" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
                  ‹
                </button>
                <span className="trp-cal__title">{formatMonthYear(new Date(viewYear, viewMonth, 1))}</span>
                <button type="button" className="trp-cal__nav-btn" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
                  ›
                </button>
              </div>
              <div className="trp-cal__weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="trp-cal__grid">
                {monthCells.map((cell, i) => {
                  if (!cell) {
                    return <span key={`e-${i}`} className="trp-cal__cell trp-cal__cell--empty" />;
                  }
                  const enabled = isDaySelectable(cell, earliestMs, latestMs);
                  const selected = sameCalendarDay(cell, draftDay);
                  const isToday = sameCalendarDay(cell, new Date());
                  return (
                    <button
                      key={cell.toISOString()}
                      type="button"
                      disabled={!enabled}
                      className={`trp-cal__cell${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                      onClick={() => enabled && setDraftDay(startOfDay(cell))}
                    >
                      {cell.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="trp-time">
              <TimeStepper label="Hora" value={draftHour} onChange={setDraftHour} min={0} max={23} step={1} />
              <TimeStepper
                label="Min"
                value={draftMinute}
                onChange={setDraftMinute}
                min={0}
                max={55}
                step={MINUTE_STEP}
              />
            </div>

            <footer className="trp-panel__foot">
              <button type="button" className="trp-link" onClick={setUntilNow}>
                {openWhich === 'to' ? 'Hasta ahora' : 'Usar ahora'}
              </button>
              <div className="trp-panel__actions">
                <button type="button" className="cc-btn ghost trp-btn" onClick={() => setOpenWhich(null)}>
                  Cancelar
                </button>
                <button type="button" className="cc-btn primary trp-btn" onClick={applyDraft}>
                  Aplicar
                </button>
              </div>
            </footer>
          </div>,
          panelHost
        )
      : null;

  return (
    <div className="map-track-range" ref={rootRef} role="group" aria-label="Periodo de ruta">
      <div className={`map-field map-field--track-trigger${openWhich === 'from' ? ' is-open' : ''}`}>
        <span>Desde</span>
        <button
          ref={fromBtnRef}
          type="button"
          className="trp-trigger"
          aria-haspopup="dialog"
          aria-expanded={openWhich === 'from'}
          onClick={() => setOpenWhich((w) => (w === 'from' ? null : 'from'))}
        >
          <span className="trp-trigger__text">{formatTrackRangeLabel(range.from)}</span>
          <span className="trp-trigger__ico" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      <div className={`map-field map-field--track-trigger${openWhich === 'to' ? ' is-open' : ''}`}>
        <span>Hasta</span>
        <button
          ref={toBtnRef}
          type="button"
          className="trp-trigger"
          aria-haspopup="dialog"
          aria-expanded={openWhich === 'to'}
          onClick={() => setOpenWhich((w) => (w === 'to' ? null : 'to'))}
        >
          <span className="trp-trigger__text">{formatTrackRangeLabel(range.to)}</span>
          <span className="trp-trigger__ico" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      {panel}
    </div>
  );
}
