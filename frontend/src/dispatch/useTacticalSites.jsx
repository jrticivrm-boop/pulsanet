import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchTacticalSiteGroups, fetchTacticalSites } from '../api';
import { useTacticalGroupIconBlobs } from './TacticalSitesLayer.jsx';

const VIS_KEY = 'tacticalptx_tactical_site_layers';

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

function TacticalSitesMultiSelect({ groups, visibleGroupIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 180);
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
  }, [open, placePanel, groups.length]);

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

  const label = summaryLabel(groups, visibleGroupIds);

  const panelHost =
    typeof document !== 'undefined'
      ? document.querySelector('.cc-shell') || document.body
      : null;

  const panel =
    open && panelStyle && panelHost
      ? createPortal(
          <div
            ref={panelRef}
            className="cc-tactical-ms-panel"
            style={panelStyle}
            role="listbox"
            aria-multiselectable="true"
          >
            {groups.map((g) => {
              const id = String(g.id);
              const checked = visibleGroupIds.has(id);
              return (
                <label key={g.id} className={`cc-tactical-ms-option${checked ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(g.id)}
                  />
                  <span className="cc-tactical-ms-name">{g.name}</span>
                  <span className="cc-tactical-dot" style={{ background: g.color }} aria-hidden />
                </label>
              );
            })}
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

  const toggleGroup = useCallback(
    (groupId) => {
      const id = String(groupId);
      setVisibleGroupIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistVisible(groups, next);
        return next;
      });
    },
    [groups]
  );

  const layerBar =
    groups.length > 0 ? (
      <TacticalSitesMultiSelect
        groups={groups}
        visibleGroupIds={visibleGroupIds}
        onToggle={toggleGroup}
      />
    ) : null;

  return useMemo(
    () => ({ groups, sites, visibleGroupIds, iconBlobs, reload, layerBar }),
    [groups, sites, visibleGroupIds, iconBlobs, reload, layerBar]
  );
}
