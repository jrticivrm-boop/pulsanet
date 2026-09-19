import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveDropdownPortalHost } from './dropdownPortalHost.js';
import {
  claimMsPanel,
  createMsPanelId,
  msPanelWidthFromTrigger,
  subscribeMsPanelExclusive,
} from './exclusiveMsPanel.js';
import { applyMsPanelListLayout, fitMsPanelHeight } from './fitMsPanelHeight.js';

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

export function sortLocationsByName(list, dir = 'asc') {
  const sorted = [...(list || [])].sort((a, b) =>
    String(a?.displayName || '').localeCompare(String(b?.displayName || ''), 'es', {
      sensitivity: 'base',
    })
  );
  return dir === 'desc' ? sorted.reverse() : sorted;
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
 * Selector multi-check de operadores para trazar rutas.
 * Cabecera al estilo Parque Vehicular / Grupo: orden, marcar, búsqueda + resize.
 * @param {{ people: Array<{userId:string,displayName?:string}>, selectedIds: string[], onChange: (ids:string[])=>void }} props
 */
export function RouteTrackPicker({
  people = [],
  selectedIds = [],
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const sizeRef = useRef({ width: null, height: null });
  const panelIdRef = useRef(createMsPanelId('route'));

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const ordered = useMemo(
    () => sortLocationsByName(people, sortDir),
    [people, sortDir]
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return ordered;
    return ordered.filter((p) =>
      String(p?.displayName || p?.userId || '')
        .toLowerCase()
        .includes(q)
    );
  }, [ordered, q]);

  const placePanel = useCallback((resetSize = false) => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const defaultW = msPanelWidthFromTrigger(el, { minWidth: 200, preferMin: 220 });
    if (resetSize || sizeRef.current.width == null) {
      sizeRef.current = { width: defaultW, height: null };
    }
    let width = sizeRef.current.width ?? defaultW;
    if (sizeRef.current.height == null) {
      width = defaultW;
      sizeRef.current.width = defaultW;
    } else {
      const cap = Math.max(defaultW, window.innerWidth - r.left - 8);
      width = Math.min(width, cap);
    }
    let left = r.left;
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    setPanelStyle({
      position: 'fixed',
      top: Math.round(r.bottom + 4),
      left: Math.round(left),
      width: Math.round(width),
      zIndex: 20050,
    });
  }, []);

  useEffect(() => {
    return subscribeMsPanelExclusive(panelIdRef.current, () => setOpen(false));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    claimMsPanel(panelIdRef.current);
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      sizeRef.current = { width: null, height: null };
      return undefined;
    }
    placePanel(true);
    const onWin = () => placePanel(false);
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, placePanel]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placePanel(false);
    const id = requestAnimationFrame(() => {
      fitMsPanelHeight(panelRef.current, { preferred: 280, maxCap: 400 });
    });
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, people.length, visible.length, query, sortDir]);

  useEffect(() => {
    if (!open) return undefined;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 80 || height < 60) {
        return;
      }
      const w = Math.round(width);
      const h = Math.round(height);
      sizeRef.current = { width: w, height: h };
      const floor = Math.round(parseFloat(el.style.minHeight) || 0);
      if (floor > 0 && h < floor) {
        el.style.height = `${floor}px`;
      }
      applyMsPanelListLayout(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

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

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function toggle(userId) {
    const id = String(userId);
    const has = selectedSet.has(id);
    if (has) {
      onChange(selectedIds.filter((x) => String(x) !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  const visibleIds = visible.map((p) => String(p.userId));
  const allVisibleOn =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  function toggleMarkVisible() {
    if (!visibleIds.length) return;
    if (allVisibleOn) {
      const drop = new Set(visibleIds);
      onChange(selectedIds.filter((id) => !drop.has(String(id))));
      return;
    }
    const next = new Set(selectedIds.map(String));
    visibleIds.forEach((id) => next.add(id));
    onChange([...next]);
  }

  const label = routeSummaryLabel(ordered, selectedIds);
  const nSel = selectedIds.length;
  const total = people.length;

  const panelHost = resolveDropdownPortalHost(triggerRef.current || rootRef.current);

  const panel =
    open && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="cc-tactical-ms-panel cc-ms-panel cc-route-ms-panel"
            style={panelStyle}
            role="listbox"
            aria-multiselectable="true"
            aria-label="Rutas a mostrar"
          >
            <div className="cc-ms-head">
              <div className="cc-ms-actions">
                <button
                  type="button"
                  className="cc-ms-link"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
                </button>
                <span className="cc-ms-sep" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="cc-ms-link"
                  onClick={toggleMarkVisible}
                  disabled={!visibleIds.length}
                >
                  {allVisibleOn ? 'Desmarcar' : 'Marcar'}
                </button>
              </div>
              <div className="cc-ms-meta">
                <span className="cc-ms-count">
                  {nSel === 0
                    ? `0 de ${total} seleccionados`
                    : `${nSel} de ${total} seleccionados`}
                  {q && visible.length !== total ? ` · ${visible.length} visibles` : ''}
                </span>
                <span
                  className="cc-ms-hint"
                  title="Marcar/Desmarcar alterna los visibles. Ascendente/Descendente ordena. Arrastra la esquina inferior para estirar."
                >
                  ?
                </span>
              </div>
              <input
                type="search"
                className="cc-ms-search"
                placeholder="Buscar en lista…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar operador"
                autoComplete="off"
              />
            </div>
            <div className="cc-ms-list">
              {people.length === 0 ? (
                <div className="cc-route-ms-empty">Sin operadores en el filtro actual</div>
              ) : visible.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visible.map((p) => {
                  const id = String(p.userId);
                  const checked = selectedSet.has(id);
                  const colorIdx = checked ? selectedIds.map(String).indexOf(id) : -1;
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
            </div>
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
