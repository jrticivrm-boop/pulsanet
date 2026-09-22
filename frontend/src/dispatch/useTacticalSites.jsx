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
import { fetchTacticalSiteGroups, fetchTacticalSites } from '../api';
import { useTacticalGroupIconBlobs } from './TacticalSitesLayer.jsx';

const VIS_KEY = 'tacticalptx_tactical_site_layers';
const TACTICAL_SITES_CHANGED = 'tacticalptx:tactical-sites-changed';

function loadVisible(groupIds) {
  try {
    const raw = localStorage.getItem(VIS_KEY);
    if (!raw) return new Set(groupIds.map(String));
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return new Set(groupIds.map(String));
    const next = new Set();
    for (const id of groupIds) {
      const key = String(id);
      if (parsed[key] !== false) next.add(key);
    }
    return next;
  } catch {
    return new Set(groupIds.map(String));
  }
}

function persistVisible(groups, visible) {
  const all = {};
  for (const g of groups) {
    all[String(g.id)] = visible.has(String(g.id));
  }
  try {
    localStorage.setItem(VIS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function summaryLabel(groups, visibleGroupIds) {
  const n = groups.length;
  const on = groups.filter((g) => visibleGroupIds.has(String(g.id)));
  if (on.length === 0) return '— ninguna —';
  if (on.length === n) return n === 1 ? on[0].name : `Todas (${n})`;
  if (on.length === 1) return on[0].name;
  if (on.length <= 2) return on.map((g) => g.name).join(', ');
  return `${on.length} de ${n}`;
}

/**
 * Capas de sitios: mismo despliegue que Ruta / Grupo (ordenar, marcar, buscar, resize).
 */
function TacticalSitesMultiSelect({ groups, visibleGroupIds, onChangeVisible }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const sizeRef = useRef({ width: null, height: null });
  const panelIdRef = useRef(createMsPanelId('sites'));

  const sortedGroups = useMemo(() => {
    const list = [...(groups || [])];
    list.sort((a, b) => {
      const cmp = String(a?.name || '').localeCompare(String(b?.name || ''), 'es', {
        sensitivity: 'base',
      });
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [groups, sortDir]);

  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!q) return sortedGroups;
    return sortedGroups.filter((g) => String(g?.name || '').toLowerCase().includes(q));
  }, [sortedGroups, q]);

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

  useEffect(() => subscribeMsPanelExclusive(panelIdRef.current, () => setOpen(false)), []);
  useEffect(() => {
    if (open) claimMsPanel(panelIdRef.current);
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
  }, [open, placePanel, groups.length, visibleGroups.length, query, sortDir]);

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
      sizeRef.current = { width: Math.round(width), height: Math.round(height) };
      const floor = Math.round(parseFloat(el.style.minHeight) || 0);
      if (floor > 0 && Math.round(height) < floor) {
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

  function toggle(groupId) {
    const id = String(groupId);
    const next = new Set(visibleGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeVisible(next);
  }

  const visibleIds = visibleGroups.map((g) => String(g.id));
  const allVisibleOn =
    visibleIds.length > 0 && visibleIds.every((id) => visibleGroupIds.has(id));

  function toggleMarkVisible() {
    if (!visibleIds.length) return;
    if (allVisibleOn) {
      const drop = new Set(visibleIds);
      const next = new Set([...visibleGroupIds].filter((id) => !drop.has(id)));
      onChangeVisible(next);
      return;
    }
    const next = new Set(visibleGroupIds);
    visibleIds.forEach((id) => next.add(id));
    onChangeVisible(next);
  }

  const total = groups.length;
  const nSel = groups.filter((g) => visibleGroupIds.has(String(g.id))).length;
  const label = summaryLabel(groups, visibleGroupIds);
  const panelHost = resolveDropdownPortalHost(triggerRef.current || rootRef.current);

  const panel =
    open && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="cc-tactical-ms-panel cc-ms-panel cc-sites-ms-panel"
            style={panelStyle}
            role="listbox"
            aria-multiselectable="true"
            aria-label="Capas de sitios"
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
                  {q && visibleGroups.length !== total ? ` · ${visibleGroups.length} visibles` : ''}
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
                aria-label="Buscar capa de sitios"
                autoComplete="off"
              />
            </div>
            <div className="cc-ms-list">
              {groups.length === 0 ? (
                <div className="cc-route-ms-empty">Sin agrupaciones</div>
              ) : visibleGroups.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visibleGroups.map((g) => {
                  const id = String(g.id);
                  const checked = visibleGroupIds.has(id);
                  return (
                    <label
                      key={g.id}
                      className={`cc-tactical-ms-option${checked ? ' is-on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(g.id)}
                      />
                      <span className="cc-tactical-ms-name">{g.name}</span>
                      <span
                        className="cc-tactical-dot"
                        style={{ background: g.color || 'var(--cc-muted)' }}
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
      <span>Sitios</span>
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

/** Carga sitios/grupos y control de capas visibles en mapas. */
export function useTacticalSites(token) {
  const [groups, setGroups] = useState([]);
  const [sites, setSites] = useState([]);
  const [visibleGroupIds, setVisibleGroupIds] = useState(() => new Set());
  const iconBlobs = useTacticalGroupIconBlobs(groups, token);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [gData, sData] = await Promise.all([
        fetchTacticalSiteGroups(token),
        fetchTacticalSites(token),
      ]);
      const gs = gData.groups || [];
      setGroups(gs);
      setSites(sData.sites || []);
      setVisibleGroupIds(loadVisible(gs.map((g) => g.id)));
    } catch {
      /* mapa sigue sin POI */
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onChanged = () => {
      reload();
    };
    window.addEventListener(TACTICAL_SITES_CHANGED, onChanged);
    return () => window.removeEventListener(TACTICAL_SITES_CHANGED, onChanged);
  }, [reload]);

  const setVisibleGroups = useCallback(
    (next) => {
      const set = next instanceof Set ? next : new Set([...(next || [])].map(String));
      setVisibleGroupIds(set);
      persistVisible(groups, set);
    },
    [groups]
  );

  const layerBar =
    groups.length > 0 ? (
      <TacticalSitesMultiSelect
        groups={groups}
        visibleGroupIds={visibleGroupIds}
        onChangeVisible={setVisibleGroups}
      />
    ) : null;

  return useMemo(
    () => ({ groups, sites, visibleGroupIds, iconBlobs, reload, layerBar }),
    [groups, sites, visibleGroupIds, iconBlobs, reload, layerBar]
  );
}
