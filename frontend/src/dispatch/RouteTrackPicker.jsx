import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Colores estables por índice de selección (ciclo con %).
 * Soft-cap de rendimiento: el mapa puede ir pesado con muchas rutas largas
 * (p. ej. >50); no hay tope de UI — el usuario puede marcar todas las visibles.
 */
export const TRACK_ROUTE_COLORS = [
  '#243d20',
  '#1d4ed8',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0f766e',
  '#a16207',
  '#334155',
];

/**
 * Versión luminosa de cada color para el trazo marcatextos.
 *
 * Los tonos oscuros de arriba, a baja opacidad y con trazo grueso, se ven como
 * una banda gris/parda que tapa el mapa (era la queja: no se leían las calles).
 * Un marcatextos real usa tinta saturada y clara: tiñe en vez de oscurecer.
 * El índice 0 conserva el verde de marca, subido en luminosidad y saturación.
 */
export const TRACK_HIGHLIGHT_COLORS = [
  '#4fb833',
  '#3b82f6',
  '#f59e0b',
  '#a855f7',
  '#f43f5e',
  '#14b8a6',
  '#eab308',
  '#64748b',
];

export function sortLocationsByName(list) {
  return [...(list || [])].sort((a, b) =>
    String(a?.displayName || '').localeCompare(String(b?.displayName || ''), 'es', {
      sensitivity: 'base',
    })
  );
}

function routeSummaryLabel(people, selectedIds) {
  const selected = people.filter((p) => selectedIds.includes(p.userId));
  if (selected.length === 0) return '— ninguna —';
  if (selected.length === 1) return selected[0].displayName || '1 ruta';
  if (selected.length === 2) {
    return selected.map((p) => p.displayName).join(', ');
  }
  return `${selected.length} rutas`;
}

/**
 * Selector multi-check de operadores para trazar rutas (mismo patrón UI que Sitios).
 * Sin tope de selección: se pueden marcar todas las personas del filtro actual.
 * @param {{ people: Array<{userId:string,displayName?:string}>, selectedIds: string[], onChange: (ids:string[])=>void }} props
 */
export function RouteTrackPicker({
  people = [],
  selectedIds = [],
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const ordered = useMemo(() => sortLocationsByName(people), [people]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    let left = r.left;
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    setPanelStyle({
      position: 'fixed',
      top: Math.round(r.bottom + 4),
      left: Math.round(left),
      width: Math.round(width),
      zIndex: 20000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, placePanel, ordered.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(userId) {
    const id = String(userId);
    const has = selectedSet.has(id);
    if (has) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  function clearAll() {
    onChange([]);
  }

  const label = routeSummaryLabel(ordered, selectedIds);
  const nSel = selectedIds.length;

  const panelHost =
    typeof document !== 'undefined'
      ? document.querySelector('.cc-shell') || document.body
      : null;

  const panel =
    open && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="cc-tactical-ms-panel cc-route-ms-panel"
            style={panelStyle}
            role="listbox"
            aria-multiselectable="true"
            aria-label="Rutas a mostrar"
          >
            <div className="cc-route-ms-toolbar">
              <span className="cc-route-ms-hint">
                {nSel === 0
                  ? 'Ninguna seleccionada'
                  : nSel === 1
                    ? '1 seleccionada'
                    : `${nSel} seleccionadas`}
              </span>
              <button
                type="button"
                className="cc-route-ms-clear"
                disabled={nSel === 0}
                onClick={clearAll}
              >
                Limpiar
              </button>
            </div>
            {ordered.length === 0 ? (
              <div className="cc-route-ms-empty">Sin operadores en el filtro actual</div>
            ) : (
              ordered.map((p) => {
                const id = String(p.userId);
                const checked = selectedSet.has(id);
                const colorIdx = checked ? selectedIds.indexOf(id) : -1;
                // El punto usa el mismo tono que el trazo del mapa.
                const color =
                  colorIdx >= 0
                    ? TRACK_HIGHLIGHT_COLORS[colorIdx % TRACK_HIGHLIGHT_COLORS.length]
                    : TRACK_ROUTE_COLORS[0];
                return (
                  <label
                    key={id}
                    className={`cc-tactical-ms-option${checked ? ' is-on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                    />
                    <span className="cc-tactical-ms-name">{p.displayName || id}</span>
                    <span
                      className="cc-tactical-dot"
                      style={{
                        background: checked ? color : 'transparent',
                        border: checked ? 'none' : '1px solid var(--cc-border)',
                      }}
                      aria-hidden
                    />
                  </label>
                );
              })
            )}
          </div>,
          panelHost
        )
      : null;

  return (
    <div className={`map-field cc-tactical-ms${open ? ' is-open' : ''}`} ref={rootRef}>
      <span>Ruta</span>
      <button
        ref={triggerRef}
        type="button"
        className={`cc-tactical-ms-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cc-tactical-ms-value">{label}</span>
        <span className="cc-tactical-ms-caret" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}
