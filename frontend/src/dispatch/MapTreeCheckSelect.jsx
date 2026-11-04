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
import { unidadColor } from './ivRmTerritoryConfig.js';

function ColorDot({ unidad, zonaKey, title }) {
  const color = unidadColor(unidad, zonaKey);
  return (
    <span
      className="cc-ms-color-dot"
      style={{ background: color }}
      title={title || undefined}
      aria-hidden
    />
  );
}

function ZoneColorDots({ zone }) {
  const units = zone?.children || [];
  if (!units.length) return null;
  const shown = units.slice(0, 5);
  const zonaKey = zone?.id;
  return (
    <span className="cc-ms-color-dots" aria-hidden>
      {shown.map((u) => (
        <ColorDot key={String(u.id)} unidad={u.label || u.id} zonaKey={zonaKey} />
      ))}
      {units.length > 5 ? <span className="cc-ms-color-dots-more">+</span> : null}
    </span>
  );
}

function walkLeaves(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.children?.length) walkLeaves(n.children, out);
    else out.push(n);
  }
  return out;
}

function zoneUnitIds(zoneNode) {
  return (zoneNode.children || []).map((u) => String(u.id));
}

function regionZoneIds(regionNode) {
  return (regionNode.children || []).map((z) => String(z.id));
}

function regionUnitIds(regionNode) {
  return (regionNode.children || []).flatMap((z) => zoneUnitIds(z));
}

function summaryLabel(nodes, zonaIds, unidadIds) {
  const zonas = walkZones(nodes);
  const units = walkLeaves(nodes);
  const zSel = zonas.filter((z) => zonaIds.includes(String(z.id)));
  const uSel = units.filter((u) => unidadIds.includes(String(u.id)));
  if (!zSel.length && !uSel.length) return '— ninguna —';
  if (zonas.length && zSel.length === zonas.length && units.length && uSel.length === units.length) {
    return `Todas (${zonas.length} · ${units.length})`;
  }
  if (uSel.length === 1) return uSel[0].label;
  if (uSel.length === 2) return uSel.map((u) => u.label).join(', ');
  if (uSel.length) return `${uSel.length} unidades`;
  if (zSel.length === 1) return zSel[0].label;
  return `${zSel.length} zonas`;
}

function walkZones(nodes, out = []) {
  for (const n of nodes || []) {
    for (const z of n.children || []) out.push(z);
  }
  return out;
}

/**
 * Multi-check en árbol Región → Zona → Unidad (misma cáscara que MapCheckSelect).
 * onChange({ zonaIds, unidadIds }).
 */
export default function MapTreeCheckSelect({
  nodes = [],
  zonaIds = [],
  unidadIds = [],
  onChange,
  onHoverPreview = null,
  fieldLabel = 'Adscripción',
  ariaLabel,
  hintTitle = 'Región → Zona → Unidad. Solo regiones con municipios asignados en Catálogos → Territorio. Bolita = color del mapa; al pasar el mouse se resaltan esos municipios.',
  emptyMessage = 'Sin regiones con cobertura',
  searchPlaceholder = 'Buscar región, zona o unidad…',
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('tree'));
  const zonaSet = useMemo(() => new Set(zonaIds.map(String)), [zonaIds]);
  const unidadSet = useMemo(() => new Set(unidadIds.map(String)), [unidadIds]);

  const q = query.trim().toLowerCase();

  const visibleNodes = useMemo(() => {
    if (!q) return nodes || [];
    const match = (text) => String(text || '').toLowerCase().includes(q);
    const out = [];
    for (const region of nodes || []) {
      const zones = [];
      for (const zone of region.children || []) {
        const units = (zone.children || []).filter(
          (u) => match(u.label) || match(u.id) || match(zone.label) || match(region.label)
        );
        if (units.length || match(zone.label) || match(region.label)) {
          zones.push({
            ...zone,
            children: units.length ? units : zone.children,
          });
        }
      }
      if (zones.length || match(region.label)) {
        out.push({ ...region, children: zones.length ? zones : region.children });
      }
    }
    return out;
  }, [nodes, q]);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = msPanelWidthFromTrigger(el, { minWidth: 240, preferMin: 280 });
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
      fitMsPanelHeight(panelRef.current, { preferred: 320, maxCap: 440 });
    });
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, nodes.length, visibleNodes.length, query, collapsed.size]);

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

  useEffect(() => {
    if (!open && typeof onHoverPreview === 'function') onHoverPreview(null);
  }, [open, onHoverPreview]);

  function emitPreview(next) {
    if (typeof onHoverPreview === 'function') onHoverPreview(next);
  }

  function isCollapsed(key) {
    return Boolean(key) && !q && collapsed.has(key);
  }

  function toggleCollapsed(key) {
    if (!key) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function emit(nextZonas, nextUnidades) {
    onChange({
      zonaIds: [...new Set(nextZonas.map(String))],
      unidadIds: [...new Set(nextUnidades.map(String))],
    });
  }

  function toggleUnit(zoneId, unitId) {
    const zid = String(zoneId);
    const uid = String(unitId);
    if (unidadSet.has(uid)) {
      const nextU = unidadIds.filter((x) => String(x) !== uid);
      emit(zonaIds, nextU);
      return;
    }
    const nextZ = zonaSet.has(zid) ? zonaIds : [...zonaIds, zid];
    emit(nextZ, [...unidadIds, uid]);
  }

  function toggleZone(zoneNode) {
    const zid = String(zoneNode.id);
    const uids = zoneUnitIds(zoneNode);
    const allOn = uids.length > 0 && uids.every((id) => unidadSet.has(id)) && zonaSet.has(zid);
    if (allOn) {
      emit(
        zonaIds.filter((x) => String(x) !== zid),
        unidadIds.filter((x) => !uids.includes(String(x)))
      );
      return;
    }
    const nextZ = zonaSet.has(zid) ? zonaIds : [...zonaIds, zid];
    const nextU = new Set(unidadIds.map(String));
    uids.forEach((id) => nextU.add(id));
    emit(nextZ, [...nextU]);
  }

  function toggleRegion(regionNode) {
    const zids = regionZoneIds(regionNode);
    const uids = regionUnitIds(regionNode);
    const allOn =
      zids.length > 0 &&
      zids.every((id) => zonaSet.has(id)) &&
      uids.every((id) => unidadSet.has(id));
    if (allOn) {
      const dropZ = new Set(zids);
      const dropU = new Set(uids);
      emit(
        zonaIds.filter((x) => !dropZ.has(String(x))),
        unidadIds.filter((x) => !dropU.has(String(x)))
      );
      return;
    }
    const nextZ = new Set(zonaIds.map(String));
    const nextU = new Set(unidadIds.map(String));
    zids.forEach((id) => nextZ.add(id));
    uids.forEach((id) => nextU.add(id));
    emit([...nextZ], [...nextU]);
  }

  function toggleMarkAll() {
    const allZ = walkZones(visibleNodes).map((z) => String(z.id));
    const allU = walkLeaves(visibleNodes).map((u) => String(u.id));
    const allOn =
      allZ.length > 0 &&
      allZ.every((id) => zonaSet.has(id)) &&
      allU.every((id) => unidadSet.has(id));
    if (allOn) {
      const dropZ = new Set(allZ);
      const dropU = new Set(allU);
      emit(
        zonaIds.filter((x) => !dropZ.has(String(x))),
        unidadIds.filter((x) => !dropU.has(String(x)))
      );
      return;
    }
    const nextZ = new Set(zonaIds.map(String));
    const nextU = new Set(unidadIds.map(String));
    allZ.forEach((id) => nextZ.add(id));
    allU.forEach((id) => nextU.add(id));
    emit([...nextZ], [...nextU]);
  }

  const allLeaves = walkLeaves(nodes);
  const allZones = walkZones(nodes);
  const nSel = unidadIds.length;
  const total = allLeaves.length;
  const allVisibleOn =
    walkZones(visibleNodes).every((z) => zonaSet.has(String(z.id))) &&
    walkLeaves(visibleNodes).every((u) => unidadSet.has(String(u.id))) &&
    walkLeaves(visibleNodes).length > 0;
  const label = summaryLabel(nodes, zonaIds.map(String), unidadIds.map(String));
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
                  onClick={toggleMarkAll}
                  disabled={!walkLeaves(visibleNodes).length}
                >
                  {allVisibleOn ? 'Desmarcar' : 'Marcar'}
                </button>
              </div>
              <div className="cc-ms-meta">
                <span className="cc-ms-count">
                  {nSel} de {total} unidades
                  {allZones.length ? ` · ${zonaIds.length}/${allZones.length} zonas` : ''}
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
              {!nodes.length ? (
                <div className="cc-route-ms-empty">{emptyMessage}</div>
              ) : !visibleNodes.length ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visibleNodes.map((region) => {
                  const rk = `r:${region.id}`;
                  const regionFolded = isCollapsed(rk);
                  const rZ = regionZoneIds(region);
                  const rU = regionUnitIds(region);
                  const rZon = rZ.filter((id) => zonaSet.has(id)).length;
                  const rUni = rU.filter((id) => unidadSet.has(id)).length;
                  const rAll = rZ.length > 0 && rZon === rZ.length && rUni === rU.length;
                  const rSome = (rZon > 0 || rUni > 0) && !rAll;
                  return (
                    <div key={rk} className="cc-ms-group cc-ms-tree-region">
                      <div
                        className={`cc-ms-group-head${rAll ? ' is-on' : ''}${regionFolded ? ' is-folded' : ''}`}
                      >
                        <label className="cc-ms-group-check">
                          <input
                            type="checkbox"
                            checked={rAll}
                            ref={(el) => {
                              if (el) el.indeterminate = rSome;
                            }}
                            onChange={() => toggleRegion(region)}
                            aria-label={`Marcar ${region.label}`}
                          />
                        </label>
                        <button
                          type="button"
                          className="cc-ms-group-toggle"
                          aria-expanded={!regionFolded}
                          onClick={() => toggleCollapsed(rk)}
                          onMouseEnter={() =>
                            emitPreview({
                              zonaIds: rZ,
                              unidadIds: rU,
                            })
                          }
                          onMouseLeave={() => emitPreview(null)}
                        >
                          <span className="cc-ms-group-caret" aria-hidden>
                            {regionFolded ? '▸' : '▾'}
                          </span>
                          <span className="cc-ms-group-title">{region.label}</span>
                          <span className="cc-ms-group-n">
                            {rUni}/{rU.length}
                          </span>
                        </button>
                      </div>
                      {regionFolded
                        ? null
                        : (region.children || []).map((zone) => {
                            const zk = `z:${zone.id}`;
                            const zoneFolded = isCollapsed(zk);
                            const uids = zoneUnitIds(zone);
                            const uSel = uids.filter((id) => unidadSet.has(id)).length;
                            const zOn = zonaSet.has(String(zone.id)) && uSel === uids.length && uids.length > 0;
                            const zSome =
                              (zonaSet.has(String(zone.id)) || uSel > 0) && !zOn;
                            return (
                              <div key={zk} className="cc-ms-group cc-ms-tree-zone">
                                <div
                                  className={`cc-ms-group-head cc-ms-tree-zone-head${zOn ? ' is-on' : ''}${zoneFolded ? ' is-folded' : ''}`}
                                >
                                  <label className="cc-ms-group-check">
                                    <input
                                      type="checkbox"
                                      checked={zOn}
                                      ref={(el) => {
                                        if (el) el.indeterminate = zSome;
                                      }}
                                      onChange={() => toggleZone(zone)}
                                      aria-label={`Marcar ${zone.label}`}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="cc-ms-group-toggle"
                                    aria-expanded={!zoneFolded}
                                    onClick={() => toggleCollapsed(zk)}
                                    onMouseEnter={() =>
                                      emitPreview({
                                        zonaIds: [String(zone.id)],
                                        unidadIds: uids,
                                      })
                                    }
                                    onMouseLeave={() => emitPreview(null)}
                                  >
                                    <span className="cc-ms-group-caret" aria-hidden>
                                      {zoneFolded ? '▸' : '▾'}
                                    </span>
                                    <span className="cc-ms-group-title">{zone.label}</span>
                                    <ZoneColorDots zone={zone} />
                                    <span className="cc-ms-group-n">
                                      {uSel}/{uids.length}
                                    </span>
                                  </button>
                                </div>
                                {zoneFolded
                                  ? null
                                  : (zone.children || []).map((unit) => {
                                      const id = String(unit.id);
                                      const checked = unidadSet.has(id);
                                      return (
                                        <label
                                          key={id}
                                          className={`cc-tactical-ms-option cc-ms-group-item cc-ms-tree-unit${checked ? ' is-on' : ''}`}
                                          onMouseEnter={() =>
                                            emitPreview({
                                              zonaIds: [String(zone.id)],
                                              unidadIds: [id],
                                            })
                                          }
                                          onMouseLeave={() => emitPreview(null)}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleUnit(zone.id, id)}
                                          />
                                          <ColorDot unidad={unit.label || id} title={unit.label || id} />
                                          <span className="cc-tactical-ms-name">{unit.label}</span>
                                        </label>
                                      );
                                    })}
                              </div>
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
