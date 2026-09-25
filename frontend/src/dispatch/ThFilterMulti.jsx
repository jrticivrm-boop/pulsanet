import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** undefined = todos; [] = ninguno; string[] = parcial (estilo PV / Usuarios). */
export function colFilterIsAll(selected) {
  return selected == null;
}
export function colFilterIsNone(selected) {
  return Array.isArray(selected) && selected.length === 0;
}
export function colFilterIsActive(selected) {
  return !colFilterIsAll(selected);
}

function defaultOptionLabel(_key, value) {
  return value;
}

const BTN_LABEL_MAX = 56;

function btnLabel(selected, options, colKey, optionLabel) {
  if (colFilterIsAll(selected)) return '— Todos —';
  if (colFilterIsNone(selected)) return 'Ninguno';
  if (selected.length === 1) {
    const t = String(optionLabel(colKey, selected[0]) || '');
    /* Truncar solo etiquetas extremadamente largas; el CSS hace ellipsis por ancho de columna. */
    return t.length > BTN_LABEL_MAX ? `${t.slice(0, BTN_LABEL_MAX - 1)}…` : t;
  }
  const total = Array.isArray(options) ? options.length : selected.length;
  return `${selected.length} de ${total} seleccionados`;
}

/** Texto completo para tooltip (sin truncar). */
function btnTitleText(selected, colKey, optionLabel, colLabel, displayLabel) {
  if (colFilterIsAll(selected)) return `Filtrar por ${colLabel}`;
  if (colFilterIsNone(selected)) return 'Ninguno seleccionado';
  if (Array.isArray(selected) && selected.length === 1) {
    return String(optionLabel(colKey, selected[0]) || displayLabel);
  }
  return displayLabel;
}

function visualClass(selected) {
  if (colFilterIsAll(selected)) return '';
  if (colFilterIsNone(selected)) return 'none';
  return 'partial';
}

function sortOptions(options, colKey, sortDir, optionLabel) {
  const cmp = (a, b) =>
    String(optionLabel(colKey, a)).localeCompare(String(optionLabel(colKey, b)), 'es', {
      sensitivity: 'base',
      numeric: true,
    });
  const sorted = [...options].sort(cmp);
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}

/** Contenedor del portal: .cc-shell lleva las vars de tema (claro/verde/obscuro). */
function filterMenuPortalRoot() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.cc-shell') || document.body;
}

function collectTreeSelectableValues(nodes) {
  const out = [];
  for (const n of nodes || []) {
    if (n.value && n.selectable !== false) out.push(n.value);
    if (n.children?.length) out.push(...collectTreeSelectableValues(n.children));
  }
  return out;
}

function nodeMatchesSearch(node, q, colKey, optionLabel) {
  if (!q) return true;
  const label = String(node.label || optionLabel(colKey, node.value) || '').toLowerCase();
  if (label.includes(q)) return true;
  return (node.children || []).some((c) => nodeMatchesSearch(c, q, colKey, optionLabel));
}

function filterTreeBySearch(nodes, q, colKey, optionLabel) {
  if (!q) return nodes || [];
  const out = [];
  for (const n of nodes || []) {
    if (!nodeMatchesSearch(n, q, colKey, optionLabel)) continue;
    const kids = filterTreeBySearch(n.children || [], q, colKey, optionLabel);
    const selfHit = String(n.label || optionLabel(colKey, n.value) || '')
      .toLowerCase()
      .includes(q);
    out.push({
      ...n,
      children: selfHit ? n.children || [] : kids,
    });
  }
  return out;
}

function collectExpandableIds(nodes) {
  const ids = [];
  for (const n of nodes || []) {
    if (n.children?.length) {
      ids.push(n.id);
      ids.push(...collectExpandableIds(n.children));
    }
  }
  return ids;
}

/**
 * Filtro por columna estilo Parque Vehicular / Usuarios.
 * `optionGroups`: secciones planas (legado).
 * `optionTree`: árbol Región→Zona→Unidad con expandir/contraer.
 * Cada check marca solo ese nodo (no toda la rama).
 */
export default function ThFilterMulti({
  colKey,
  colLabel,
  options,
  optionGroups = null,
  optionTree = null,
  selected,
  open,
  onOpenChange,
  onChange,
  disabled,
  optionLabel = defaultOptionLabel,
}) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 140 });
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const useTree = Array.isArray(optionTree) && optionTree.length > 0;

  const flatFromGroups = useMemo(() => {
    if (!Array.isArray(optionGroups) || optionGroups.length === 0) return null;
    const out = [];
    for (const g of optionGroups) {
      for (const v of g.options || []) out.push(v);
    }
    return out;
  }, [optionGroups]);

  const flatFromTree = useMemo(
    () => (useTree ? collectTreeSelectableValues(optionTree) : null),
    [useTree, optionTree]
  );

  const baseOptions = flatFromTree || flatFromGroups || options || [];

  const sortedOptions = useMemo(
    () => sortOptions(baseOptions, colKey, sortDir, optionLabel),
    [baseOptions, colKey, sortDir, optionLabel]
  );

  const sortedGroups = useMemo(() => {
    if (useTree) return null;
    if (!Array.isArray(optionGroups) || optionGroups.length === 0) return null;
    return optionGroups.map((g) => ({
      ...g,
      options: sortOptions(g.options || [], colKey, sortDir, optionLabel),
    }));
  }, [useTree, optionGroups, colKey, sortDir, optionLabel]);

  const selectedSet = useMemo(() => {
    if (colFilterIsAll(selected)) return null;
    return new Set(Array.isArray(selected) ? selected : []);
  }, [selected]);

  const checkedCount = colFilterIsAll(selected)
    ? sortedOptions.length
    : colFilterIsNone(selected)
      ? 0
      : selected.length;

  const visual = visualClass(selected);
  const label = btnLabel(selected, sortedOptions, colKey, optionLabel);

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) {
      setMenuSearch('');
      return undefined;
    }
    if (useTree) {
      /* Al abrir: expandir todo el árbol (regiones y zonas) para ver el desglose */
      setExpandedIds(new Set(collectExpandableIds(optionTree)));
    }
    function onDoc(e) {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onOpenChangeRef.current(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') onOpenChangeRef.current(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, useTree, optionTree]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return undefined;
    function place() {
      const r = btnRef.current.getBoundingClientRect();
      const gap = 2;
      const useGroups = Array.isArray(optionGroups) && optionGroups.length > 0;
      const minWidth = Math.max(r.width, useTree || useGroups ? 200 : 160);
      const maxW = useTree || useGroups ? 340 : 280;
      const width = Math.min(Math.max(minWidth, r.width), maxW);
      let left = Math.max(8, r.left);
      let top = r.bottom + gap;
      const estH = Math.min(360, window.innerHeight - 24);
      if (top + estH > window.innerHeight - 8) {
        top = Math.max(8, r.top - estH - gap);
      }
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setMenuPos({ top, left, minWidth: width });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, sortedOptions.length, useTree]);

  function emitSelection(nextChecked) {
    const total = sortedOptions.length;
    if (nextChecked.size >= total) onChange(undefined);
    else if (nextChecked.size === 0) onChange([]);
    else onChange(sortedOptions.filter((v) => nextChecked.has(v)));
  }

  function isChecked(v) {
    if (selectedSet == null) return true;
    return selectedSet.has(v);
  }

  function toggleOne(v) {
    const next = new Set(selectedSet == null ? sortedOptions : [...selectedSet]);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    emitSelection(next);
  }

  function toggleAllChecks() {
    if (checkedCount >= sortedOptions.length && sortedOptions.length > 0) onChange([]);
    else onChange(undefined);
  }

  function toggleGroup(groupOpts) {
    const opts = groupOpts || [];
    if (opts.length === 0) return;
    const next = new Set(selectedSet == null ? sortedOptions : [...selectedSet]);
    const allOn = opts.every((v) => next.has(v));
    if (allOn) opts.forEach((v) => next.delete(v));
    else opts.forEach((v) => next.add(v));
    emitSelection(next);
  }

  function groupCheckState(groupOpts) {
    const opts = groupOpts || [];
    if (opts.length === 0) return { checked: false, indeterminate: false };
    const n = opts.filter((v) => isChecked(v)).length;
    return { checked: n === opts.length, indeterminate: n > 0 && n < opts.length };
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = menuSearch.trim().toLowerCase();
  const matchesSearch = (v) =>
    !q || String(optionLabel(colKey, v)).toLowerCase().includes(q);

  const visibleOptions = q ? sortedOptions.filter(matchesSearch) : sortedOptions;

  const visibleGroups = useMemo(() => {
    if (!sortedGroups) return null;
    return sortedGroups
      .map((g) => ({
        ...g,
        options: (g.options || []).filter(matchesSearch),
      }))
      .filter((g) => g.options.length > 0);
  }, [sortedGroups, q, colKey, optionLabel]);

  const visibleTree = useMemo(() => {
    if (!useTree) return null;
    return filterTreeBySearch(optionTree, q, colKey, optionLabel);
  }, [useTree, optionTree, q, colKey, optionLabel]);

  /* Con búsqueda: expandir todo lo visible */
  const effectiveExpanded = useMemo(() => {
    if (!useTree) return expandedIds;
    if (q) return new Set(collectExpandableIds(visibleTree));
    return expandedIds;
  }, [useTree, q, visibleTree, expandedIds]);

  function renderScopeNodeRow(n, depth) {
    const hasKids = (n.children || []).length > 0;
    const expanded = effectiveExpanded.has(n.id);
    const ownValue = n.value && n.selectable !== false ? n.value : null;
    const isFolder = !ownValue && hasKids;
    const depthClass =
      n.level === 'region-folder' || (depth === 0 && isFolder)
        ? 'usr-th-filter-tree-node--region'
        : n.level === 'zone-folder' || n.level === 'zone'
          ? 'usr-th-filter-tree-node--zone'
          : n.level === 'region'
            ? 'usr-th-filter-tree-node--region-groups'
            : 'usr-th-filter-tree-node--unit';

    if (isFolder) {
      return (
        <div
          key={`${n.id}-row`}
          className={`usr-th-filter-tree-row usr-th-filter-tree-row--folder ${depthClass}`}
          style={{ paddingLeft: 6 + depth * 10 }}
        >
          <button
            type="button"
            className="usr-th-filter-tree-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? 'Contraer' : 'Expandir'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleExpand(n.id);
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
          <button
            type="button"
            className="usr-th-filter-tree-folder-label"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleExpand(n.id);
            }}
          >
            <span className="usr-th-filter-tree-name">{n.label}</span>
          </button>
        </div>
      );
    }

    const canSelect = Boolean(ownValue);
    const st = ownValue
      ? { checked: isChecked(ownValue), indeterminate: false }
      : { checked: false, indeterminate: false };

    return (
      <div
        key={`${n.id}-row`}
        className={`usr-th-filter-tree-row ${depthClass}`}
        style={{ paddingLeft: 6 + depth * 10 }}
      >
        <span className="usr-th-filter-tree-toggle-spacer" aria-hidden="true" />
        <label className="usr-th-filter-tree-label">
          <input
            type="checkbox"
            disabled={!canSelect}
            checked={canSelect ? st.checked : false}
            onChange={() => {
              if (!ownValue) return;
              toggleOne(ownValue);
            }}
          />
          <span className="usr-th-filter-tree-name">{n.label}</span>
        </label>
      </div>
    );
  }

  /** Región (carpeta) → grupos región / zonas (carpeta) → grupos zona + unidades. */
  function renderScopeTree(nodes, depth = 0) {
    return (nodes || []).map((n) => {
      const hasKids = (n.children || []).length > 0;
      const expanded = effectiveExpanded.has(n.id);
      return (
        <div key={n.id} className="usr-th-filter-tree-block">
          {renderScopeNodeRow(n, depth)}
          {hasKids && expanded ? (
            <div className="usr-th-filter-tree-children">
              {renderScopeTree(n.children, depth + 1)}
            </div>
          ) : null}
        </div>
      );
    });
  }

  const treeExpandableIds = useMemo(
    () => (useTree ? collectExpandableIds(optionTree) : []),
    [useTree, optionTree]
  );
  const treeAllExpanded =
    useTree &&
    treeExpandableIds.length > 0 &&
    treeExpandableIds.every((id) => expandedIds.has(id));

  return (
    <div
      ref={wrapRef}
      className={`usr-th-filter-multi${visual ? ` ${visual}` : ''}`}
      data-col-key={colKey}
    >
      <button
        ref={btnRef}
        type="button"
        className={`usr-th-filter-multi-btn${visual === 'partial' ? ' is-filter-partial' : ''}${visual === 'none' ? ' is-filter-none' : ''}`}
        title={btnTitleText(selected, colKey, optionLabel, colLabel, label)}
        aria-label={`Filtrar por ${colLabel}`}
        aria-expanded={open}
        disabled={disabled}
        draggable={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`usr-th-filter-multi-menu${useTree ? ' usr-th-filter-multi-menu--tree' : ''}`}
            role="dialog"
            aria-label={`Filtro ${colLabel}`}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              ['--usr-th-filter-w']: `${menuPos.minWidth}px`,
              zIndex: 10050,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="usr-th-filter-multi-head">
              <div className="usr-th-filter-multi-actions">
                {!useTree ? (
                  <>
                    <button
                      type="button"
                      className="usr-th-filter-multi-link"
                      onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    >
                      {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
                    </button>
                    <span className="usr-th-filter-multi-sep">·</span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="usr-th-filter-multi-link"
                      onClick={() =>
                        setExpandedIds(
                          treeAllExpanded ? new Set() : new Set(treeExpandableIds)
                        )
                      }
                    >
                      {treeAllExpanded ? 'Contraer' : 'Expandir'}
                    </button>
                    <span className="usr-th-filter-multi-sep">·</span>
                  </>
                )}
                <button type="button" className="usr-th-filter-multi-link" onClick={toggleAllChecks}>
                  {checkedCount >= sortedOptions.length && sortedOptions.length > 0
                    ? 'Desmarcar'
                    : 'Marcar'}
                </button>
              </div>
              <div className="usr-th-filter-multi-meta">
                <span className="usr-th-filter-multi-count">
                  {sortedOptions.length === 0
                    ? 'Sin opciones'
                    : `${checkedCount} de ${sortedOptions.length} seleccionados`}
                </span>
                <span
                  className="usr-th-filter-multi-hint"
                  title={
                    useTree
                      ? 'Por región: grupos de todas las zonas y unidades, luego zona (todas las unidades) y unidades. Solo filas con canales; cada check es un alcance.'
                      : sortedGroups
                        ? 'Tres tipos de canal: Regiones, Zonas, Unidades. La barra marca todo el tipo; cada fila es un canal concreto.'
                        : 'Marcar/Desmarcar alterna todos los checks. Ascendente/Descendente ordena la lista.'
                  }
                >
                  ?
                </span>
              </div>
              {!useTree && sortedGroups ? (
                <p className="usr-th-filter-tree-help">
                  Regiones / Zonas / Unidades = tipo de canal. La barra marca ese tipo; cada fila un canal.
                </p>
              ) : null}
              <input
                type="text"
                className="usr-th-filter-multi-search"
                placeholder="Buscar en lista…"
                value={menuSearch}
                autoComplete="off"
                onChange={(e) => setMenuSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="usr-th-filter-multi-list">
              {visibleTree ? (
                visibleTree.length === 0 ? (
                  <div className="usr-th-filter-multi-empty">Sin coincidencias</div>
                ) : (
                  <div className="usr-th-filter-tree">{renderScopeTree(visibleTree)}</div>
                )
              ) : visibleGroups ? (
                visibleGroups.length === 0 ? (
                  <div className="usr-th-filter-multi-empty">Sin coincidencias</div>
                ) : (
                  visibleGroups.map((g) => {
                    const st = groupCheckState(g.options);
                    return (
                      <div key={g.id || g.label} className="usr-th-filter-multi-group">
                        <label className="usr-th-filter-multi-group-head">
                          <input
                            type="checkbox"
                            checked={st.checked}
                            ref={(el) => {
                              if (el) el.indeterminate = st.indeterminate;
                            }}
                            onChange={() => toggleGroup(g.options)}
                          />
                          <span className="usr-th-filter-multi-group-title">{g.label}</span>
                          <span className="usr-th-filter-multi-group-count" aria-hidden="true">
                            {g.options.length}
                          </span>
                        </label>
                        {g.options.map((v) => (
                          <label
                            key={String(v)}
                            className="usr-th-filter-multi-item usr-th-filter-multi-item--nested"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked(v)}
                              onChange={() => toggleOne(v)}
                            />
                            <span>{optionLabel(colKey, v)}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })
                )
              ) : visibleOptions.length === 0 ? (
                <div className="usr-th-filter-multi-empty">Sin coincidencias</div>
              ) : (
                visibleOptions.map((v) => (
                  <label key={String(v)} className="usr-th-filter-multi-item">
                    <input type="checkbox" checked={isChecked(v)} onChange={() => toggleOne(v)} />
                    <span>{optionLabel(colKey, v)}</span>
                  </label>
                ))
              )}
            </div>
          </div>,
          filterMenuPortalRoot()
        )}
    </div>
  );
}

export const COLS_BTN_SVG = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4" />
  </svg>
);

export const FILTER_BTN_SVG = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3 6h18M7 12h10M10 18h4" />
  </svg>
);

/** Icono «crear canal»: círculo con + (mismo trazo que Filtros/Columnas). */
export const NEW_CHANNEL_BTN_SVG = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
