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
import { operatorCallSignParts } from './mapLabelUtils.js';

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

function routeSummaryLabel(people, selectedIds, { singleSelect = false, emptyMeansAll = false } = {}) {
  if (singleSelect) {
    const id = selectedIds[0];
    if (!id) return '— Seleccionar —';
    const p = people.find((x) => String(x.userId) === String(id));
    return p?.displayName || '1 operador';
  }
  const effective =
    emptyMeansAll && selectedIds.length === 0
      ? people.map((p) => String(p.userId))
      : selectedIds.map(String);
  const selected = people.filter((p) => effective.includes(String(p.userId)));
  if (selected.length === 0) return '— ninguna —';
  if (selected.length === people.length) {
    return people.length === 1 ? selected[0].displayName : `Todos (${people.length})`;
  }
  if (selected.length === 1) return selected[0].displayName || '1';
  if (selected.length === 2) {
    return selected.map((p) => p.displayName).join(', ');
  }
  return `${selected.length} de ${people.length}`;
}

function routeTriggerLabels(people, selectedIds, { singleSelect = false, emptyMeansAll = false } = {}) {
  const full = routeSummaryLabel(people, selectedIds, { singleSelect, emptyMeansAll });
  const emptyHint = full === '— Seleccionar —' || full === '— ninguna —';

  let person = null;
  if (singleSelect && selectedIds[0]) {
    person = people.find((x) => String(x.userId) === String(selectedIds[0]));
  } else if (!singleSelect) {
    const effective =
      emptyMeansAll && selectedIds.length === 0
        ? people.map((p) => String(p.userId))
        : selectedIds.map(String);
    const selected = people.filter((p) => effective.includes(String(p.userId)));
    if (selected.length === 1) person = selected[0];
  }

  if (!person) {
    return { full, compact: full, tooltip: emptyHint ? '' : full };
  }
  const parts = operatorCallSignParts({
    displayName: person.displayName,
    grade: person.grade,
    cargo: person.cargo,
  });
  return {
    full: parts.full || full,
    compact: parts.compact || parts.full || full,
    tooltip: parts.full || full,
  };
}

/**
 * Selector de operadores para Ruta (radio) u Operadores (multi).
 * Cabecera PV: orden, marcar (multi), búsqueda + resize.
 */
export function RouteTrackPicker({
  people = [],
  selectedIds = [],
  onChange,
  fieldLabel = 'Ruta',
  singleSelect = false,
  emptyMeansAll = false,
  /** Solo para multi-ruta con colores en mapa; filtros Persona/En grupo no lo usan. */
  showColorDots = false,
  emptyMessage = 'Sin operadores con GPS registrado',
  hintTitle = 'Solo operadores que ya compartieron ubicación al menos una vez. Ascendente/Descendente ordena. Arrastra la esquina inferior para estirar ancho y alto.',
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  /** Borrador en modo radio: Aceptar/fuera/exclusivo confirman; Cancelar/Esc descartan. */
  const [draftId, setDraftId] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const sizeRef = useRef({ width: null, height: null });
  const draftIdRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId(singleSelect ? 'route-radio' : 'route'));

  draftIdRef.current = draftId;

  const selectedSet = useMemo(() => {
    if (singleSelect && open) {
      return new Set(draftId ? [String(draftId)] : []);
    }
    if (emptyMeansAll && !singleSelect && selectedIds.length === 0) {
      return new Set(people.map((p) => String(p.userId)));
    }
    return new Set(selectedIds.map(String));
  }, [selectedIds, emptyMeansAll, singleSelect, people, open, draftId]);

  useEffect(() => {
    if (!open || !singleSelect) return;
    setDraftId(selectedIds[0] ? String(selectedIds[0]) : null);
  }, [open, singleSelect, selectedIds]);

  function commitSingleAndClose(id) {
    const next = id ? [String(id)] : [];
    onChange(next);
    setOpen(false);
  }

  function closePanel({ commitDraft = false } = {}) {
    if (singleSelect && commitDraft) {
      const id = draftIdRef.current;
      if (id) onChange([String(id)]);
    }
    setOpen(false);
  }

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
    return subscribeMsPanelExclusive(panelIdRef.current, () => {
      // Otro panel ms abre: igual que Aceptar (no Cancelar).
      closePanel({ commitDraft: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleSelect]);

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
      fitMsPanelHeight(panelRef.current, {
        preferred: singleSelect ? 300 : 280,
        maxCap: 400,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, people.length, visible.length, query, sortDir, singleSelect]);

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
    let closed = false;
    const onOutside = (e) => {
      if (closed) return;
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      // Clic fuera = Aceptar (commit); Cancelar/Esc descartan.
      closed = true;
      closePanel({ commitDraft: true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel({ commitDraft: false });
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, singleSelect]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function toggle(userId) {
    const id = String(userId);
    if (singleSelect) {
      setDraftId(id);
      return;
    }
    if (emptyMeansAll && selectedIds.length === 0) {
      onChange(people.map((p) => String(p.userId)).filter((x) => x !== id));
      return;
    }
    const has = selectedSet.has(id);
    if (has) {
      onChange(selectedIds.filter((x) => String(x) !== id));
      return;
    }
    onChange([...selectedIds.map(String), id]);
  }

  const visibleIds = visible.map((p) => String(p.userId));
  const allVisibleOn =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  function toggleMarkVisible() {
    if (!visibleIds.length || singleSelect) return;
    if (allVisibleOn) {
      const drop = new Set(visibleIds);
      if (emptyMeansAll && selectedIds.length === 0) {
        onChange(people.map((p) => String(p.userId)).filter((id) => !drop.has(id)));
        return;
      }
      onChange(selectedIds.filter((id) => !drop.has(String(id))));
      return;
    }
    if (emptyMeansAll && selectedIds.length === 0) {
      return;
    }
    const next = new Set(selectedIds.map(String));
    visibleIds.forEach((id) => next.add(id));
    if (emptyMeansAll && next.size >= people.length) {
      onChange([]);
      return;
    }
    onChange([...next]);
  }

  const labelParts = useMemo(
    () => routeTriggerLabels(ordered, selectedIds, { singleSelect, emptyMeansAll }),
    [ordered, selectedIds, singleSelect, emptyMeansAll]
  );
  const [triggerText, setTriggerText] = useState(labelParts.full);
  const valueRef = useRef(null);
  const measurePassRef = useRef(0);

  // Cerrado: intentar nombre completo; si desborda → Grado, Cargo. Hover = tooltip completo.
  // Aplica a Ruta (radio) y a Persona/En grupo con 1 seleccionado.
  useLayoutEffect(() => {
    const { full, compact } = labelParts;
    if (
      !full ||
      full === '— Seleccionar —' ||
      full === '— ninguna —' ||
      !compact ||
      compact === full
    ) {
      setTriggerText(full);
      measurePassRef.current = 0;
      return;
    }
    measurePassRef.current = 1;
    setTriggerText(full);
  }, [labelParts]);

  useLayoutEffect(() => {
    if (measurePassRef.current !== 1) return;
    const el = valueRef.current;
    const { full, compact } = labelParts;
    if (!el || !compact || compact === full) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      measurePassRef.current = 0;
      setTriggerText(compact);
    } else {
      measurePassRef.current = 0;
    }
  }, [triggerText, labelParts]);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const { full, compact } = labelParts;
      if (
        !full ||
        full === '— Seleccionar —' ||
        full === '— ninguna —' ||
        !compact ||
        compact === full
      ) {
        setTriggerText(full);
        return;
      }
      measurePassRef.current = 1;
      setTriggerText(full);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [labelParts]);

  const nSel = selectedSet.size;
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
            aria-multiselectable={!singleSelect}
            aria-label={fieldLabel}
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
                {!singleSelect ? (
                  <>
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
                  </>
                ) : null}
              </div>
              <div className="cc-ms-meta">
                <span className="cc-ms-count">
                  {singleSelect
                    ? nSel === 0
                      ? `Selecciona 1 de ${total}`
                      : `1 de ${total} seleccionado`
                    : nSel === 0
                      ? `0 de ${total} seleccionados`
                      : `${nSel} de ${total} seleccionados`}
                  {q && visible.length !== total ? ` · ${visible.length} visibles` : ''}
                </span>
                <span className="cc-ms-hint" title={hintTitle}>
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
                <div className="cc-route-ms-empty">{emptyMessage}</div>
              ) : visible.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visible.map((p) => {
                  const id = String(p.userId);
                  const checked = selectedSet.has(id);
                  const displayName = p.displayName || id;
                  const colorIdx =
                    showColorDots && checked ? [...selectedSet].indexOf(id) : -1;
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
                        type={singleSelect ? 'radio' : 'checkbox'}
                        name={singleSelect ? 'route-track-user' : undefined}
                        checked={checked}
                        onChange={() => toggle(id)}
                      />
                      <span className="cc-tactical-ms-name" title={displayName}>
                        {displayName}
                      </span>
                      {showColorDots && !singleSelect ? (
                        <span
                          className="cc-tactical-dot"
                          style={{
                            background: checked ? color : 'transparent',
                            border: checked ? 'none' : '1px solid var(--cc-border)',
                          }}
                          aria-hidden
                        />
                      ) : null}
                    </label>
                  );
                })
              )}
            </div>
            {singleSelect ? (
              <div className="cc-ms-footer">
                <button
                  type="button"
                  className="cc-ms-cancel"
                  onClick={() => closePanel({ commitDraft: false })}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="cc-ms-accept"
                  disabled={!draftId}
                  onClick={() => commitSingleAndClose(draftId)}
                >
                  Aceptar
                </button>
              </div>
            ) : null}
          </div>,
          panelHost
        )
      : null;

  return (
    <div className={`map-field cc-tactical-ms${open ? ' is-open' : ''}`} ref={rootRef}>
      <span>{fieldLabel}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`cc-tactical-ms-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={labelParts.tooltip || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cc-tactical-ms-value" ref={valueRef}>
          {triggerText}
        </span>
        <span className="cc-tactical-ms-caret" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}

