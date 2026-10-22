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

function summaryLabel(items, selectedIds, allWord = 'Todas') {
  const selected = items.filter((it) => selectedIds.includes(String(it.id)));
  const n = items.length;
  if (selected.length === 0) return '— ninguna —';
  if (n > 0 && selected.length === n) return n === 1 ? selected[0].label : `${allWord} (${n})`;
  if (selected.length === 1) return selected[0].label;
  if (selected.length === 2) return selected.map((it) => it.label).join(', ');
  return `${selected.length} ${allWord.toLowerCase()}`;
}

/**
 * Multi-check estilo Parque Vehicular / Operadores → Grupos:
 * Ascendente·Descendente, Marcar·Desmarcar, buscar, checks (sin opción «Todos»).
 */
export default function MapCheckSelect({
  items = [],
  selectedIds = [],
  onChange,
  fieldLabel = 'Lista',
  ariaLabel,
  hintTitle = 'Ascendente/Descendente ordena la lista. Marcar/Desmarcar alterna los visibles.',
  emptyMessage = 'Sin opciones',
  allWord = 'Todas',
  searchPlaceholder = 'Buscar en lista…',
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('chk'));
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const [collapsed, setCollapsed] = useState(() => new Set());

  const sorted = useMemo(() => {
    const list = [...(items || [])];
    const hasGroups = list.some((it) => it?.group);
    list.sort((a, b) => {
      if (hasGroups) {
        const gcmp = String(a?.group || '').localeCompare(String(b?.group || ''), 'es', {
          sensitivity: 'base',
        });
        if (gcmp !== 0) return gcmp;
      }
      const cmp = String(a?.label || '').localeCompare(String(b?.label || ''), 'es', {
        sensitivity: 'base',
      });
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [items, sortDir]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((it) => {
      const hay = `${it?.label || ''} ${it?.group || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, q]);

  const grouped = useMemo(() => {
    if (!visible.some((it) => it?.group)) {
      return [{ name: '', items: visible }];
    }
    const order = [];
    const map = new Map();
    for (const it of visible) {
      const name = String(it.group || '');
      if (!map.has(name)) {
        map.set(name, []);
        order.push(name);
      }
      map.get(name).push(it);
    }
    return order.map((name) => ({ name, items: map.get(name) }));
  }, [visible]);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = msPanelWidthFromTrigger(el, { minWidth: 200, preferMin: 240 });
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

  useEffect(() => subscribeMsPanelExclusive(panelIdRef.current, () => setOpen(false)), []);
  useEffect(() => {
    if (open) claimMsPanel(panelIdRef.current);
  }, [open]);

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
  }, [open, placePanel]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placePanel();
    const id = requestAnimationFrame(() => {
      fitMsPanelHeight(panelRef.current, { preferred: 280, maxCap: 400 });
    });
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, items.length, visible.length, query, sortDir, collapsed.size]);

  useEffect(() => {
    if (!open) return undefined;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const floor = Math.round(parseFloat(el.style.minHeight) || 0);
      if (floor > 0 && el.offsetHeight < floor) el.style.height = `${floor}px`;
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

  function toggle(itemId) {
    const id = String(itemId);
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => String(x) !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  function isGroupCollapsed(name) {
    return Boolean(name) && !q && collapsed.has(name);
  }

  function toggleGroupCollapsed(name) {
    if (!name) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleIds(ids, allOn) {
    if (!ids.length) return;
    if (allOn) {
      const drop = new Set(ids);
      onChange(selectedIds.filter((id) => !drop.has(String(id))));
      return;
    }
    const next = new Set(selectedIds.map(String));
    ids.forEach((id) => next.add(id));
    onChange([...next]);
  }

  const shownItems = grouped.flatMap((g) => (isGroupCollapsed(g.name) ? [] : g.items));
  const visibleIds = shownItems.map((it) => String(it.id));
  const allVisibleOn = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  function toggleMarkVisible() {
    toggleIds(visibleIds, allVisibleOn);
  }

  function toggleGroupItems(groupItems) {
    const ids = groupItems.map((it) => String(it.id));
    const allOn = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    toggleIds(ids, allOn);
  }

  const total = items.length;
  const nSel = selectedIds.length;
  const label = summaryLabel(items, selectedIds.map(String), allWord);
  const panelHost = resolveDropdownPortalHost(triggerRef.current || rootRef.current);

  const panel =
    open && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="cc-tactical-ms-panel cc-ms-panel cc-group-ms-panel"
            style={panelStyle}
            role="listbox"
            aria-multiselectable="true"
            aria-label={ariaLabel || fieldLabel}
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
                  {nSel} de {total} seleccionados
                  {q && visible.length !== total ? ` · ${visible.length} visibles` : ''}
                </span>
                <span className="cc-ms-hint" title={hintTitle}>
                  ?
                </span>
              </div>
              <input
                type="search"
                className="cc-ms-search"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={`Buscar ${fieldLabel.toLowerCase()}`}
                autoComplete="off"
              />
            </div>
            <div className="cc-ms-list">
              {items.length === 0 ? (
                <div className="cc-route-ms-empty">{emptyMessage}</div>
              ) : visible.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                grouped.map((g) => {
                  const groupOn = Boolean(g.name);
                  const folded = isGroupCollapsed(g.name);
                  const groupIds = g.items.map((it) => String(it.id));
                  const groupSel = groupIds.filter((id) => selectedSet.has(id)).length;
                  const groupAllOn = groupIds.length > 0 && groupSel === groupIds.length;
                  const groupSome = groupSel > 0 && !groupAllOn;
                  return (
                    <div key={g.name || '_'} className="cc-ms-group">
                      {groupOn ? (
                        <div className={`cc-ms-group-head${groupAllOn ? ' is-on' : ''}${folded ? ' is-folded' : ''}`}>
                          <label className="cc-ms-group-check">
                            <input
                              type="checkbox"
                              checked={groupAllOn}
                              ref={(el) => {
                                if (el) el.indeterminate = groupSome;
                              }}
                              onChange={() => toggleGroupItems(g.items)}
                              aria-label={`Marcar ${g.name}`}
                            />
                          </label>
                          <button
                            type="button"
                            className="cc-ms-group-toggle"
                            aria-expanded={!folded}
                            onClick={() => toggleGroupCollapsed(g.name)}
                          >
                            <span className="cc-ms-group-caret" aria-hidden>
                              {folded ? '▸' : '▾'}
                            </span>
                            <span className="cc-ms-group-title">{g.name}</span>
                            <span className="cc-ms-group-n">
                              {groupSel}/{g.items.length}
                            </span>
                          </button>
                        </div>
                      ) : null}
                      {folded
                        ? null
                        : g.items.map((it) => {
                            const id = String(it.id);
                            const checked = selectedSet.has(id);
                            return (
                              <label
                                key={id}
                                className={`cc-tactical-ms-option${checked ? ' is-on' : ''}${groupOn ? ' cc-ms-group-item' : ''}`}
                              >
                                <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
                                <span className="cc-tactical-ms-name">{it.label}</span>
                              </label>
                            );
                          })}
                    </div>
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
      <span>{fieldLabel}</span>
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
