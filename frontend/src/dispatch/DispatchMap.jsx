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
import { useOutletContext } from 'react-router-dom';
import MapPttFloat from './MapPttFloat.jsx';
import {
  MapContainer,
  TileLayer,
  Popup,
  Circle,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import {
  fetchLocations,
  fetchOverview,
  fetchUserTrack,
  fetchGeofences,
  createGeofence,
  deleteGeofence,
  fetchPanicEvents,
} from '../api';
import { socketWireKey, unwrapDispatchPayload, applyDispatchJoinedWire } from '../wireCrypto.js';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { socketAuth } from '../deviceId';
import {
  LOCATION_POLL_MS,
  TRACK_POLL_MS,
  mergeLocations,
  upsertLocation,
} from './liveTiming.js';
import AppDialog from '../AppDialog';
import { mapAvatarIcon } from './mapAvatarIcon.js';
import PresenceMapLegend, { countPresenceLegend } from './PresenceMapLegend.jsx';
import { MapMaximizeNearZoom } from './MapMaximizeButton.jsx';
import { PRESENCE_LABELS, resolvePresenceStatus, visiblePresenceStatusIds } from './presenceStatus.js';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import {
  CursorZoom,
  MapCursorFix,
  MapSizeFix,
  MapWorldFillMinZoom,
  SmoothMarker,
  loadMapView,
  PersistMapView,
  CargoZoomGate,
} from './mapLeafletUtils.jsx';
import { ClusteredLocationLayer } from './ClusteredLocationLayer.jsx';
import { useMapAvatarPhotos } from './useMapAvatarPhotos.js';
import {
  MAP_TILE_LAYERS,
  MAP_MAX_ZOOM,
  loadStoredMapLayer,
  mapWorldProps,
  storeMapLayer,
  tileLayerProps,
} from './mapTiles.js';
import { TacticalSitesLayer } from './TacticalSitesLayer.jsx';
import { useTacticalSites } from './useTacticalSites.jsx';
import IvRmStatesLayer from './IvRmStatesLayer.jsx';
import IvRmStatesLegend from './IvRmStatesLegend.jsx';
import {
  enabledIvRmStates,
  isSurfaceEnabled,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';
import HighlighterTrack, { PREDICTED_COLOR } from './HighlighterTrack.jsx';
import {
  RouteTrackPicker,
  TRACK_HIGHLIGHT_COLORS,
  sortLocationsByName,
} from './RouteTrackPicker.jsx';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GDL = [20.6736, -103.344];
const MAP_VIEW_KEY = 'tacticalptx_map_view_ops';
/** Preferencias de la barra Consola: operadores / ruta (este navegador). */
const OPS_MAP_FILTERS_KEY = 'tacticalptx_ops_map_filters_v1';
/** Claves legacy (migración de lectura). */
const OP_FILTER_MODE_KEY = 'tacticalptx_ops_operator_filter_mode';
const OP_FILTER_GROUP_KEY = 'tacticalptx_ops_operator_group_id';
const ALLOWED_TRACK_HOURS = new Set([2, 8, 24, 48]);
const SOCKET_URL = socketUrl();

const MAP_LAYERS = MAP_TILE_LAYERS;

/**
 * Cadencia de refresco del historial según la ventana elegida.
 * La posición en vivo sigue a 5 s (poll de ubicaciones); esto solo espacia la
 * recarga de la cola histórica, que con 24–48 h no necesita ir a 5 s.
 */
function trackPollMs(hours) {
  if (hours <= 2) return TRACK_POLL_MS;
  if (hours <= 8) return TRACK_POLL_MS * 2;
  if (hours <= 24) return TRACK_POLL_MS * 4;
  return TRACK_POLL_MS * 6;
}

function loadStored(key, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v != null && v !== '' ? v : fallback;
  } catch {
    return fallback;
  }
}

function normalizeOperatorGroupIds(raw) {
  if (Array.isArray(raw?.operatorGroupIds)) {
    return [...new Set(raw.operatorGroupIds.map(String).filter(Boolean))];
  }
  // Migración desde id singular (v1 inicial).
  if (typeof raw?.operatorGroupId === 'string' && raw.operatorGroupId) {
    return [String(raw.operatorGroupId)];
  }
  return [];
}

/**
 * ¿El modo de operadores tiene ya una selección concreta?
 * Encadena la barra: modo → selección → Ruta (picker + horas). Sin selección
 * no hay universo de gente que enrutar, así que «Ruta» queda deshabilitada.
 * Modos: all | group (el antiguo «one» se migró; persona suelta se elige en Ruta).
 */
function hasOperatorSelection(mode, groupIds) {
  if (mode === 'group') return (groupIds || []).length >= 1;
  return true;
}

const OPS_TAB_KEY = 'tacticalptx_map_ops_tab';
const OPS_TAB_ORDER_KEY = 'tacticalptx_map_ops_tab_order';
const OPS_TAB_DEFAULT_ORDER = ['sitios', 'operadores', 'ruta', 'geocerca'];
const OPS_TAB_IDS = new Set(OPS_TAB_DEFAULT_ORDER);
const OPS_TAB_DRAG_THRESHOLD_PX = 8;

function readOpsTabOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(OPS_TAB_ORDER_KEY) || 'null');
    if (!Array.isArray(raw) || !raw.length) return [...OPS_TAB_DEFAULT_ORDER];
    const next = raw.filter((id) => OPS_TAB_IDS.has(id));
    for (const id of OPS_TAB_DEFAULT_ORDER) {
      if (!next.includes(id)) next.push(id);
    }
    return next;
  } catch {
    return [...OPS_TAB_DEFAULT_ORDER];
  }
}

function writeOpsTabOrder(order) {
  try {
    localStorage.setItem(OPS_TAB_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function opsTabIdFromPoint(clientX, clientY, listEl) {
  const el = document.elementFromPoint(clientX, clientY);
  const btn = el?.closest?.('button[data-ops-tab-id]');
  if (!btn || !listEl?.contains(btn)) return null;
  return btn.getAttribute('data-ops-tab-id');
}

/** Formatea un número de coordenada para los inputs Latitud / Longitud. */
function formatFenceCoord(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toFixed(5);
}

/**
 * Valida lat/lng desde los dos campos del formulario.
 * @returns {{ ok: true, lat: number, lng: number } | { ok: false, reason: 'empty' | 'format' | 'range' }}
 */
function parseFenceLatLng(latRaw, lngRaw) {
  const latS = String(latRaw ?? '').trim();
  const lngS = String(lngRaw ?? '').trim();
  if (!latS || !lngS) return { ok: false, reason: 'empty' };
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: 'format' };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: 'range' };
  }
  return { ok: true, lat, lng };
}

/** Centro de borrador válido para preview en mapa (ambos campos numéricos). */
function draftFenceCenter(draft) {
  const parsed = parseFenceLatLng(draft?.centerLat, draft?.centerLng);
  return parsed.ok ? { lat: parsed.lat, lng: parsed.lng } : null;
}

function readOpsTab() {
  try {
    const v = localStorage.getItem(OPS_TAB_KEY);
    // Migración: pestaña «Horas» se unificó dentro de «Ruta».
    if (v === 'horas') return 'ruta';
    if (OPS_TAB_IDS.has(v)) return v;
  } catch {
    /* ignore */
  }
  return 'operadores';
}

function writeOpsTab(id) {
  try {
    localStorage.setItem(OPS_TAB_KEY, id);
  } catch {
    /* ignore */
  }
}

function OpsTabIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'sitios') {
    return (
      <svg {...common}>
        <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
    );
  }
  if (name === 'operadores') {
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="3.2" />
        <path d="M21 21v-2a3.6 3.6 0 0 0-2.6-3.4" />
        <path d="M16.2 3.9a3.2 3.2 0 0 1 0 6.2" />
      </svg>
    );
  }
  if (name === 'ruta') {
    return (
      <svg {...common}>
        <circle cx="6.5" cy="6.5" r="2.2" />
        <circle cx="17.5" cy="17.5" r="2.2" />
        <path d="M8.4 8.2c2.2 1.1 5 6.5 7.2 7.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="7.2" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 4.8v2.2M12 17v2.2M4.8 12h2.2M17 12h2.2" />
    </svg>
  );
}

const PRESENCE_STATUS_OPTIONS = [
  { id: 'online', label: 'En línea' },
  { id: 'away', label: 'Ausente' },
  { id: 'offline', label: 'Desconectados' },
  { id: 'stale', label: 'Fuera de línea' },
];
const ALL_PRESENCE_STATUS_IDS = ['online', 'away', 'offline', 'stale'];

function normalizePresenceStatusIds(raw, { showAway = true, showOffline = true } = {}) {
  const allowed = visiblePresenceStatusIds({ showAway, showOffline });
  // Legacy: string único «all» | online | away | …
  if (typeof raw?.presenceStatusFilter === 'string') {
    const ps = raw.presenceStatusFilter;
    if (ps === 'all' || !ps) return [...allowed];
    if (allowed.includes(ps)) return [ps];
  }
  const arr = Array.isArray(raw?.presenceStatusIds)
    ? raw.presenceStatusIds
    : Array.isArray(raw?.presenceStatusFilter)
      ? raw.presenceStatusFilter
      : null;
  if (!arr) return [...allowed];
  const next = [...new Set(arr.map(String).filter((id) => allowed.includes(id)))];
  return next.length ? next : [...allowed];
}

function presenceStatusSummaryLabel(selectedIds, allowedIds) {
  const allowed = allowedIds || ALL_PRESENCE_STATUS_IDS;
  const n = (selectedIds || []).length;
  const total = allowed.length;
  if (n === 0) return 'Ninguno';
  if (n === total) return `Todos (${total})`;
  if (n === 1) {
    const opt = PRESENCE_STATUS_OPTIONS.find((o) => o.id === selectedIds[0]);
    return opt?.label || selectedIds[0];
  }
  if (n === 2) {
    return selectedIds
      .map((id) => PRESENCE_STATUS_OPTIONS.find((o) => o.id === id)?.label || id)
      .join(', ');
  }
  return `${n} de ${total}`;
}

/** Multi-check de estados de presencia (sin opción «Todos»). */
function PresenceStatusMultiSelect({
  selectedIds = [],
  onChange,
  showAway = true,
  showOffline = true,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('presence-status'));
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const allowedIds = useMemo(
    () => visiblePresenceStatusIds({ showAway, showOffline }),
    [showAway, showOffline]
  );
  const options = useMemo(
    () => PRESENCE_STATUS_OPTIONS.filter((o) => allowedIds.includes(o.id)),
    [allowedIds]
  );

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = msPanelWidthFromTrigger(el, { minWidth: 180, preferMin: 220 });
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
      fitMsPanelHeight(panelRef.current, { preferred: 220, maxCap: 320 });
    });
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, selectedIds.length, options.length]);

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

  function toggle(id) {
    const key = String(id);
    if (selectedSet.has(key)) {
      onChange(selectedIds.filter((x) => String(x) !== key));
      return;
    }
    onChange([...selectedIds, key]);
  }

  const allOn = allowedIds.length > 0 && allowedIds.every((id) => selectedSet.has(id));

  function toggleMarkAll() {
    onChange(allOn ? [] : [...allowedIds]);
  }

  const label = presenceStatusSummaryLabel(selectedIds, allowedIds);
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
            aria-label="Estados a mostrar"
          >
            <div className="cc-ms-head">
              <div className="cc-ms-actions">
                <button type="button" className="cc-ms-link" onClick={toggleMarkAll}>
                  {allOn ? 'Desmarcar' : 'Marcar'}
                </button>
              </div>
              <div className="cc-ms-meta">
                <span className="cc-ms-count">
                  {selectedIds.length} de {allowedIds.length} seleccionados
                </span>
              </div>
            </div>
            <div className="cc-ms-list">
              {options.map((opt) => {
                const checked = selectedSet.has(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`cc-tactical-ms-option${checked ? ' is-on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.id)}
                    />
                    <span className="cc-tactical-ms-name">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>,
          panelHost
        )
      : null;

  return (
    <div className={`map-field cc-tactical-ms${open ? ' is-open' : ''}`} ref={rootRef}>
      <span>Estado</span>
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

function normalizeOpsMapFilters(raw) {
  // Migración: modo «one» (select Persona) eliminado — redundante con checks de Ruta.
  const mode = raw?.operatorFilterMode === 'group' ? 'group' : 'all';
  const hours = Number(raw?.trackHours);
  const operatorGroupIds = normalizeOperatorGroupIds(raw);
  const trackUserIds = Array.isArray(raw?.trackUserIds)
    ? [...new Set(raw.trackUserIds.map(String).filter(Boolean))]
    : [];
  const presenceStatusIds = normalizePresenceStatusIds(raw);
  return {
    operatorFilterMode: mode,
    operatorGroupIds,
    presenceStatusIds,
    // Sin selección de operadores el picker de Ruta no se muestra: no restaurar
    // rutas huérfanas que quedarían pintadas sin control visible.
    trackUserIds: hasOperatorSelection(mode, operatorGroupIds) ? trackUserIds : [],
    trackHours: ALLOWED_TRACK_HOURS.has(hours) ? hours : 8,
  };
}

function loadOpsMapFilters() {
  try {
    // Limpiar clave legacy del select Persona (modo «one» eliminado).
    localStorage.removeItem('tacticalptx_ops_operator_user_id');
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(OPS_MAP_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalizeOpsMapFilters(parsed);
    }
  } catch {
    /* ignore */
  }
  // Migración desde claves sueltas de operadores (antes de v1 unificada).
  const legacyMode = loadStored(OP_FILTER_MODE_KEY, 'all');
  const legacyGroup = loadStored(OP_FILTER_GROUP_KEY, '');
  const legacyNormalized = legacyMode === 'group' ? 'group' : 'all';
  return normalizeOpsMapFilters({
    operatorFilterMode: legacyNormalized,
    operatorGroupIds: legacyGroup ? [legacyGroup] : [],
    trackUserIds: [],
    trackHours: 8,
  });
}

function operatorGroupSummaryLabel(groups, selectedIds) {
  const selected = (groups || []).filter((g) => selectedIds.includes(String(g.id)));
  const n = groups?.length || 0;
  if (selected.length === 0) return '— elegir —';
  if (n > 0 && selected.length === n) return n === 1 ? selected[0].name : `Todas (${n})`;
  if (selected.length === 1) return selected[0].name;
  if (selected.length <= 2) return selected.map((g) => g.name).join(', ');
  return `${selected.length} grupos`;
}

/** Multi-check de grupos estilo Parque Vehicular (Ascendente / Marcar / buscar / checks). */
function OperatorGroupMultiSelect({ groups = [], selectedIds = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('group'));
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

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
  }, [open, placePanel, groups.length, visibleGroups.length, query, sortDir]);

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

  function toggle(groupId) {
    const id = String(groupId);
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => String(x) !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  const visibleIds = visibleGroups.map((g) => String(g.id));
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

  const total = groups.length;
  const nSel = selectedIds.length;
  const label = operatorGroupSummaryLabel(groups, selectedIds);
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
            aria-label="Grupos a filtrar"
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
                  {q && visibleGroups.length !== total
                    ? ` · ${visibleGroups.length} visibles`
                    : ''}
                </span>
                <span
                  className="cc-ms-hint"
                  title="Ascendente/Descendente ordena la lista. Marcar/Desmarcar alterna los grupos visibles. El mapa muestra la unión de miembros de los grupos marcados."
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
                aria-label="Buscar grupo"
                autoComplete="off"
              />
            </div>
            <div className="cc-ms-list">
              {groups.length === 0 ? (
                <div className="cc-route-ms-empty">Sin grupos</div>
              ) : visibleGroups.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visibleGroups.map((g) => {
                  const id = String(g.id);
                  const checked = selectedSet.has(id);
                  return (
                    <label key={id} className={`cc-tactical-ms-option${checked ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                      />
                      <span className="cc-tactical-ms-name">{g.name}</span>
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
      <span>Grupo</span>
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

function geofenceSummaryLabel(fences, selectedIds) {
  const n = (selectedIds || []).length;
  const total = (fences || []).length;
  if (!total) return 'Sin geocercas';
  if (n === 0) return 'Ninguna en mapa';
  if (n === total) return `Todas (${total})`;
  if (n === 1) {
    const id = String(selectedIds[0]);
    const g = fences.find((f) => String(f.id) === id);
    return g?.name || '1 geocerca';
  }
  return `${n} de ${total}`;
}

function GeofenceMultiSelect({
  fences = [],
  selectedIds = [],
  onChange,
  onDelete,
  busy = false,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelIdRef = useRef(createMsPanelId('geofence'));
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const sorted = useMemo(() => {
    const list = [...(fences || [])];
    list.sort((a, b) => {
      const cmp = String(a?.name || '').localeCompare(String(b?.name || ''), 'es', {
        sensitivity: 'base',
      });
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [fences, sortDir]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((g) => String(g?.name || '').toLowerCase().includes(q));
  }, [sorted, q]);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = msPanelWidthFromTrigger(el, { minWidth: 200, preferMin: 260 });
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
  }, [open, placePanel, fences.length, visible.length, query, sortDir]);

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

  function toggle(fenceId) {
    const id = String(fenceId);
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => String(x) !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  const visibleIds = visible.map((g) => String(g.id));
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

  const total = fences.length;
  const nSel = selectedIds.length;
  const label = geofenceSummaryLabel(fences, selectedIds);
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
            aria-label="Geocercas a mostrar en el mapa"
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
                  {nSel} de {total} en mapa
                  {q && visible.length !== total ? ` · ${visible.length} visibles` : ''}
                </span>
                <span
                  className="cc-ms-hint"
                  title="Marcar/Desmarcar alterna las geocercas visibles. Arrastra la esquina inferior para estirar."
                >
                  ?
                </span>
              </div>
              <input
                type="search"
                className="cc-ms-search"
                placeholder="Buscar geocerca…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar geocerca"
                autoComplete="off"
              />
            </div>
            <div className="cc-ms-list">
              {fences.length === 0 ? (
                <div className="cc-route-ms-empty">Sin geocercas</div>
              ) : visible.length === 0 ? (
                <div className="cc-route-ms-empty">Sin coincidencias</div>
              ) : (
                visible.map((g) => {
                  const id = String(g.id);
                  const checked = selectedSet.has(id);
                  return (
                    <div
                      key={id}
                      className={`cc-tactical-ms-option cc-geofence-ms-row${checked ? ' is-on' : ''}`}
                    >
                      <label className="cc-geofence-ms-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                        />
                        <span className="cc-tactical-ms-name">
                          {g.name}
                          <span className="muted"> · {Math.round(g.radiusM)} m</span>
                        </span>
                      </label>
                      {typeof onDelete === 'function' ? (
                        <button
                          type="button"
                          className="cc-btn ghost danger cc-btn-sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(id);
                          }}
                        >
                          Eliminar
                        </button>
                      ) : null}
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
      <span>Geocercas</span>
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

function storeOpsMapFilters(filters) {
  try {
    localStorage.setItem(OPS_MAP_FILTERS_KEY, JSON.stringify(normalizeOpsMapFilters(filters)));
  } catch {
    /* ignore */
  }
}

function FitBounds({ positions, fitToken }) {
  const map = useMap();
  const ready = Boolean(positions?.length);
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    // Solo al cambiar selección/horas o cuando llegan puntos por primera vez (ready).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- positions deliberadamente fuera
  }, [map, fitToken, ready]);
  return null;
}

function MapClickPicker({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function InvalidateOnLayout({ tick }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 80);
    return () => clearTimeout(id);
  }, [map, tick]);
  useEffect(() => {
    const onFs = () => map.invalidateSize({ animate: false });
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('resize', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('resize', onFs);
    };
  }, [map]);
  return null;
}

export default function DispatchMap({ session }) {
  const dispatchCtx = useOutletContext() || {};
  const ptt = dispatchCtx.ptt;
  const radioGroups = useMemo(() => {
    const list = Array.isArray(dispatchCtx.groups) ? dispatchCtx.groups : [];
    return [...list].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity: 'base' })
    );
  }, [dispatchCtx.groups]);
  const pageRef = useRef(null);
  const savedView = useMemo(() => loadMapView(MAP_VIEW_KEY), []);
  const initialCenter = savedView?.center || GDL;
  const initialZoom = savedView?.zoom ?? 12;
  const [locations, setLocations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [presenceByUser, setPresenceByUser] = useState({});
  const [offlineRedMinutes, setOfflineRedMinutes] = useState(15);
  const [absenceMinutes, setAbsenceMinutes] = useState(15);
  const [showAway, setShowAway] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [panicUserIds, setPanicUserIds] = useState(() => new Set());
  const panicIdToUserRef = useRef(new Map());
  const initialFilters = useMemo(() => loadOpsMapFilters(), []);
  const [operatorFilterMode, setOperatorFilterMode] = useState(
    () => initialFilters.operatorFilterMode
  );
  const [operatorGroupIds, setOperatorGroupIds] = useState(
    () => initialFilters.operatorGroupIds
  );
  const [presenceStatusIds, setPresenceStatusIds] = useState(
    () => initialFilters.presenceStatusIds || [...ALL_PRESENCE_STATUS_IDS]
  );
  const { markerPhoto, markerGroupPhoto } = useMapAvatarPhotos(locations, session.token, {
    operatorMode: operatorFilterMode,
    selectedGroupIds: operatorGroupIds,
    groups: radioGroups,
  });
  const [trackUserIds, setTrackUserIds] = useState(() => initialFilters.trackUserIds);
  const [trackHours, setTrackHours] = useState(() => initialFilters.trackHours);
  const [tracksByUser, setTracksByUser] = useState({});
  /** Evita borrar rutas restauradas antes del primer fetch de ubicaciones. */
  const [locationsHydrated, setLocationsHydrated] = useState(false);
  const [geofences, setGeofences] = useState([]);
  /** IDs de geocercas visibles en el mapa (checks del multi-select). */
  const [visibleGeofenceIds, setVisibleGeofenceIds] = useState([]);
  /** false hasta el primer sync; evita que «ninguna marcada» se reinicie a todas en cada poll. */
  const geofenceVisInitRef = useRef(false);
  /** Formulario de nueva geocerca visible. */
  const [fenceFormOpen, setFenceFormOpen] = useState(false);
  /** Toggle opcional: clic en mapa rellena lat/lng. */
  const [fixOnMap, setFixOnMap] = useState(false);
  const [draft, setDraft] = useState({ name: '', centerLat: '', centerLng: '', radiusM: 200 });
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [opsKpiHost, setOpsKpiHost] = useState(null);
  const [mapLayer, setMapLayer] = useState(() => loadStoredMapLayer());
  const [opsTab, setOpsTab] = useState(() => readOpsTab());
  useLayoutEffect(() => {
    setOpsKpiHost(document.getElementById('cc-ops-kpi-host'));
    return () => setOpsKpiHost(null);
  }, []);
  useEffect(() => {
    storeMapLayer(mapLayer);
  }, [mapLayer]);
  useEffect(() => {
    writeOpsTab(opsTab);
  }, [opsTab]);
  const tile = MAP_LAYERS[mapLayer] || MAP_LAYERS.natural;
  const { sites: tacticalSites, visibleGroupIds, iconBlobs, layerBar: tacticalLayerBar } = useTacticalSites(
    session.token
  );
  const [ivRmConfig] = useIvRmStatesConfig();
  const showIvRmEstados = useMemo(() => {
    if (!isSurfaceEnabled(ivRmConfig, 'consola')) return false;
    return enabledIvRmStates(ivRmConfig).length > 0;
  }, [ivRmConfig]);
  const locationFetchOpts = useMemo(() => {
    if (operatorFilterMode === 'group' && operatorGroupIds.length) {
      return { groupIds: operatorGroupIds };
    }
    return {};
  }, [operatorFilterMode, operatorGroupIds]);
  const visibleLocations = useMemo(() => {
    let list = locations;
    if (operatorFilterMode === 'group' && !operatorGroupIds.length) return [];
    const allowed = visiblePresenceStatusIds({ showAway, showOffline });
    const statusSet = new Set(
      (presenceStatusIds || []).map(String).filter((id) => allowed.includes(id))
    );
    // Sin checks = nadie; todos los permitidos = sin filtrar por estado.
    if (statusSet.size === 0) return [];
    if (statusSet.size < allowed.length) {
      const now = Date.now();
      list = list.filter((loc) => {
        const pInfo = presenceByUser[loc.userId];
        const status = resolvePresenceStatus({
          presence: loc.presence || pInfo?.status,
          focus: loc.focus || pInfo?.focus,
          lastSeenAt: loc.lastSeenAt || pInfo?.lastSeenAt,
          recordedAt: loc.recordedAt,
          awaySince: loc.awaySince ?? pInfo?.awaySince,
          offlineRedMinutes,
          absenceMinutes,
          showAway,
          showOffline,
          now,
        });
        return statusSet.has(status);
      });
    }
    return list;
  }, [
    locations,
    operatorFilterMode,
    operatorGroupIds,
    presenceStatusIds,
    presenceByUser,
    offlineRedMinutes,
    absenceMinutes,
    showAway,
    showOffline,
  ]);
  const operatorFilterRef = useRef({
    mode: operatorFilterMode,
    groupIds: operatorGroupIds,
  });
  operatorFilterRef.current = {
    mode: operatorFilterMode,
    groupIds: operatorGroupIds,
  };

  const speakingNow = useMemo(() => {
    return (overview?.channels || [])
      .filter((c) => c.speaker)
      .map((c) => ({
        channelId: c.id,
        channel: c.name,
        userId: c.speaker.userId,
        name: c.speaker.displayName,
      }));
  }, [overview]);

  const presenceLegendCounts = useMemo(() => {
    const enriched = visibleLocations.map((loc) => {
      const p = presenceByUser[loc.userId];
      return {
        ...loc,
        presence: loc.presence || p?.status,
        focus: loc.focus || p?.focus,
        lastSeenAt: loc.lastSeenAt || p?.lastSeenAt,
        awaySince: loc.awaySince ?? p?.awaySince,
      };
    });
    return countPresenceLegend(
      enriched,
      panicUserIds,
      offlineRedMinutes,
      absenceMinutes,
      showAway,
      showOffline
    );
  }, [
    visibleLocations,
    presenceByUser,
    panicUserIds,
    offlineRedMinutes,
    absenceMinutes,
    showAway,
    showOffline,
  ]);

  useEffect(() => {
    storeOpsMapFilters({
      operatorFilterMode,
      operatorGroupIds,
      presenceStatusIds,
      trackUserIds,
      trackHours,
    });
  }, [operatorFilterMode, operatorGroupIds, presenceStatusIds, trackUserIds, trackHours]);

  // Si la org apaga amarillo/gris, quitar esos ids del filtro guardado.
  useEffect(() => {
    const allowed = new Set(visiblePresenceStatusIds({ showAway, showOffline }));
    setPresenceStatusIds((prev) => {
      const next = prev.filter((id) => allowed.has(String(id)));
      if (next.length === prev.length) return prev;
      return next.length ? next : [...allowed];
    });
  }, [showAway, showOffline]);

  // Validar grupos restaurados contra datos vivos (sin romper si aún no cargan).
  useEffect(() => {
    if (!radioGroups.length) return;
    setOperatorGroupIds((prev) => {
      if (!prev.length) return prev;
      const valid = new Set(radioGroups.map((g) => String(g.id)));
      const next = prev.filter((id) => valid.has(String(id)));
      return next.length === prev.length ? prev : next;
    });
  }, [radioGroups]);

  const routePeople = useMemo(
    () => sortLocationsByName(visibleLocations),
    [visibleLocations]
  );

  /** «Ruta» solo cuando el modo ya tiene grupo(s) elegidos (o Todos). */
  const canPickRoutes = hasOperatorSelection(operatorFilterMode, operatorGroupIds);
  const showTrackHours = canPickRoutes && trackUserIds.length >= 1;

  // Al ocultar «Ruta» (cambio de modo o selección vacía) soltar las rutas para
  // que no queden trazos fantasma sin control visible en la barra.
  useEffect(() => {
    if (canPickRoutes) return;
    setTrackUserIds((prev) => (prev.length ? [] : prev));
  }, [canPickRoutes]);

  // Si la pestaña Ruta queda bloqueada (sin operadores), volver a Operadores.
  useEffect(() => {
    if (opsTab === 'ruta' && !canPickRoutes) setOpsTab('operadores');
  }, [opsTab, canPickRoutes]);

  useEffect(() => {
    if (fenceFormOpen) setOpsTab('geocerca');
  }, [fenceFormOpen]);

  function openFenceForm() {
    setDraft({ name: '', centerLat: '', centerLng: '', radiusM: 200 });
    setFixOnMap(false);
    setError('');
    setFenceFormOpen(true);
    setOpsTab('geocerca');
  }

  function closeFenceForm() {
    setFenceFormOpen(false);
    setFixOnMap(false);
    setDraft({ name: '', centerLat: '', centerLng: '', radiusM: 200 });
  }

  useEffect(() => {
    if (!locationsHydrated) return;
    setTrackUserIds((prev) => {
      if (!prev.length) return prev;
      const allowed = new Set(visibleLocations.map((l) => l.userId));
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [locationsHydrated, visibleLocations]);

  const exitMaximize = useCallback(() => {
    setMaximized(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enterMaximize = useCallback(() => {
    // Solo CSS fixed (.map-page--maximized): requestFullscreen congela el mapa ~1–2s.
    setMaximized(true);
  }, []);

  const toggleMaximize = useCallback(() => {
    if (maximized) exitMaximize();
    else enterMaximize();
  }, [maximized, enterMaximize, exitMaximize]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setMaximized(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !maximized) return undefined;
    const onEscClose = () => exitMaximize();
    el.addEventListener('tacticalptx:esc-close', onEscClose);
    return () => el.removeEventListener('tacticalptx:esc-close', onEscClose);
  }, [maximized, exitMaximize]);

  async function reloadFences() {
    const data = await fetchGeofences(session.token);
    setGeofences((data.geofences || []).filter((g) => g.isActive !== false));
  }

  // Mantener checks: 1.ª carga = todas visibles; luego solo podar borradas y añadir nuevas.
  // Importante: `prev.length === 0` tras desmarcar NO debe volver a «Todas» (el poll reescribe geofences).
  useEffect(() => {
    const ids = geofences.map((g) => String(g.id));
    const idSet = new Set(ids);
    setVisibleGeofenceIds((prev) => {
      if (!ids.length) {
        if (prev.length) return [];
        return prev;
      }
      if (!geofenceVisInitRef.current) {
        geofenceVisInitRef.current = true;
        return ids;
      }
      const prevStr = prev.map(String);
      const prevSet = new Set(prevStr);
      const kept = prevStr.filter((id) => idSet.has(id));
      const added = ids.filter((id) => !prevSet.has(id));
      const next = [...kept, ...added];
      if (
        next.length === prev.length &&
        next.every((id, i) => String(id) === String(prev[i]))
      ) {
        return prev;
      }
      return next;
    });
  }, [geofences]);

  const mapGeofences = useMemo(() => {
    const vis = new Set(visibleGeofenceIds.map(String));
    return geofences.filter((g) => vis.has(String(g.id)));
  }, [geofences, visibleGeofenceIds]);

  useEffect(() => {
    let cancelled = false;
    let failStreak = 0;
    async function load() {
      if (document.hidden) return;
      try {
        const filter = operatorFilterRef.current;
        const needsGroup = filter.mode === 'group';
        const groupReady = needsGroup && Array.isArray(filter.groupIds) && filter.groupIds.length > 0;
        const locOpts = groupReady ? { groupIds: filter.groupIds } : {};
        const [loc, ov, gf, panic] = await Promise.all([
          groupReady || !needsGroup
            ? fetchLocations(session.token, locOpts)
            : Promise.resolve({ locations: [] }),
          fetchOverview(session.token),
          fetchGeofences(session.token),
          fetchPanicEvents(session.token, { status: 'active' }).catch(() => ({ events: [] })),
        ]);
        if (cancelled) return;
        failStreak = 0;
        const incoming = loc.locations || [];
        setLocations((prev) => {
          if (needsGroup && !groupReady) return [];
          const merged = mergeLocations(prev, incoming);
          if (groupReady) {
            const allowed = new Set(incoming.map((l) => l.userId));
            return merged.filter((l) => allowed.has(l.userId));
          }
          return merged;
        });
        setLocationsHydrated(true);
        setOverview(ov.overview || null);
        const ids = new Set();
        const byUser = { ...(ov.overview?.presence || {}) };
        (ov.overview?.channels || []).forEach((c) => {
          (c.online || []).forEach((m) => {
            ids.add(m.userId);
            if (!byUser[m.userId]) {
              byUser[m.userId] = {
                userId: m.userId,
                focus: m.focus,
                status: resolvePresenceStatus({ focus: m.focus }),
              };
            }
          });
        });
        incoming.forEach((row) => {
          if (row.presence || row.focus) {
            byUser[row.userId] = {
              ...(byUser[row.userId] || {}),
              userId: row.userId,
              focus: row.focus || byUser[row.userId]?.focus,
              awaySince: row.awaySince ?? byUser[row.userId]?.awaySince ?? null,
              status:
                row.presence ||
                resolvePresenceStatus({
                  focus: row.focus,
                  awaySince: row.awaySince,
                  lastSeenAt: row.lastSeenAt,
                  recordedAt: row.recordedAt,
                  offlineRedMinutes:
                    loc.presenceOfflineRedMinutes ??
                    ov.overview?.presenceOfflineRedMinutes ??
                    15,
                  absenceMinutes:
                    loc.presenceAbsenceMinutes ??
                    ov.overview?.presenceAbsenceMinutes ??
                    15,
                  showAway:
                    loc.presenceShowAway ?? ov.overview?.presenceShowAway ?? true,
                  showOffline:
                    loc.presenceShowOffline ?? ov.overview?.presenceShowOffline ?? true,
                }),
              lastSeenAt: row.lastSeenAt,
            };
          }
        });
        setOnlineIds(ids);
        setPresenceByUser(byUser);
        setOfflineRedMinutes(
          loc.presenceOfflineRedMinutes ?? ov.overview?.presenceOfflineRedMinutes ?? 15
        );
        if (loc.presenceAbsenceMinutes != null || ov.overview?.presenceAbsenceMinutes != null) {
          setAbsenceMinutes(
            Number(loc.presenceAbsenceMinutes ?? ov.overview?.presenceAbsenceMinutes) || 0
          );
        }
        const nextShowAway = loc.presenceShowAway ?? ov.overview?.presenceShowAway;
        const nextShowOffline = loc.presenceShowOffline ?? ov.overview?.presenceShowOffline;
        if (nextShowAway != null) setShowAway(nextShowAway !== false);
        if (nextShowOffline != null) setShowOffline(nextShowOffline !== false);
        setGeofences((gf.geofences || []).filter((g) => g.isActive !== false));
        {
          const next = new Set();
          const idMap = new Map();
          (panic.events || []).forEach((e) => {
            if (e.userId) {
              next.add(e.userId);
              if (e.id) idMap.set(e.id, e.userId);
            }
          });
          panicIdToUserRef.current = idMap;
          setPanicUserIds(next);
        }
        setError('');
      } catch (e) {
        if (cancelled) return;
        failStreak += 1;
        // Turnos largos (24h+): un fallo de red puntual no debe pintar error en el mapa.
        if (failStreak >= 3) setError(e.message);
      }
    }
    load();
    const t = setInterval(load, LOCATION_POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session.token, locationFetchOpts]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: socketAuth(session.token),
      ...socketIoOptions,
    });
    const join = () => {
      socket.emit('dispatch:join');
    };
    socket.on('connect', join);
    socket.on('reconnect', join);
    const offWire = applyDispatchJoinedWire(socket);
    socket.on('dispatch:speaker', () => {
      fetchOverview(session.token)
        .then((ov) => setOverview(ov.overview || null))
        .catch(() => {});
    });
    socket.on('dispatch:released', () => {
      fetchOverview(session.token)
        .then((ov) => setOverview(ov.overview || null))
        .catch(() => {});
    });
    socket.on('dispatch:presence', () => {
      fetchOverview(session.token)
        .then((ov) => {
          setOverview(ov.overview || null);
          const ids = new Set();
          (ov.overview?.channels || []).forEach((c) => {
            c.online.forEach((m) => ids.add(m.userId));
          });
          setOnlineIds(ids);
        })
        .catch(() => {});
    });
    socket.on('dispatch:location', (payload) => {
      void (async () => {
        const loc = await unwrapDispatchPayload(payload, socketWireKey(socket, session));
        if (!loc?.userId) return;
        const filter = operatorFilterRef.current;
        setLocations((prev) => {
          if (filter.mode === 'group') {
            if (!filter.groupIds?.length) return prev;
            // Solo actualizar miembros ya en el set (el poll redefine la membresía).
            if (!prev.some((l) => l.userId === loc.userId)) return prev;
          }
          return upsertLocation(prev, loc);
        });
      })();
    });
    socket.on('dispatch:geofence', (payload) => {
      void (async () => {
        const g = await unwrapDispatchPayload(payload, socketWireKey(socket, session));
        if (!g) return;
        setAlerts((prev) =>
          [
            {
              id: `${g.geofenceId}-${g.userId}-${g.at}`,
              ...g,
            },
            ...prev,
          ].slice(0, 12)
        );
      })();
    });
    socket.on('dispatch:panic', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, socketWireKey(socket, session));
        const uid = payload?.userId;
        if (!uid) return;
        if (payload.id) panicIdToUserRef.current.set(payload.id, uid);
        setPanicUserIds((prev) => {
          if (prev.has(uid)) return prev;
          const next = new Set(prev);
          next.add(uid);
          return next;
        });
      })();
    });
    socket.on('dispatch:panic_update', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, socketWireKey(socket, session));
        if (!payload?.id) return;
        if (payload.status === 'acked' || payload.status === 'active') {
          const uid = payload.userId || panicIdToUserRef.current.get(payload.id);
          if (uid) {
            panicIdToUserRef.current.set(payload.id, uid);
            setPanicUserIds((prev) => {
              if (prev.has(uid)) return prev;
              const next = new Set(prev);
              next.add(uid);
              return next;
            });
          }
          return;
        }
        const uid = payload.userId || panicIdToUserRef.current.get(payload.id);
        panicIdToUserRef.current.delete(payload.id);
        if (!uid) return;
        setPanicUserIds((prev) => {
          if (!prev.has(uid)) return prev;
          for (const [, otherUid] of panicIdToUserRef.current) {
            if (otherUid === uid) return prev;
          }
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      })();
    });
    return () => {
      offWire();
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token]);

  const trackIdsKey = trackUserIds.join(',');

  useEffect(() => {
    if (!trackUserIds.length) {
      setTracksByUser({});
      return undefined;
    }
    let cancelled = false;
    const ids = [...trackUserIds];
    const loadTracks = () => {
      if (cancelled || document.hidden) return;
      Promise.all(
        ids.map(async (uid) => {
          try {
            const data = await fetchUserTrack(session.token, uid, trackHours);
            return [uid, data.points || []];
          } catch {
            return [uid, []];
          }
        })
      ).then((pairs) => {
        if (!cancelled) setTracksByUser(Object.fromEntries(pairs));
      });
    };
    loadTracks();
    const t = setInterval(loadTracks, trackPollMs(trackHours));
    const onVis = () => {
      if (!document.hidden) loadTracks();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session.token, trackIdsKey, trackHours]);

  const trackPolylines = useMemo(() => {
    return trackUserIds
      .map((uid, i) => {
        const pts = tracksByUser[uid] || [];
        const positions = pts.map((p) => [p.latitude, p.longitude]);
        if (positions.length < 2) return null;
        return {
          userId: uid,
          // `points` conserva recordedAt: necesario para detectar huecos de señal.
          points: pts,
          positions,
          color: TRACK_HIGHLIGHT_COLORS[i % TRACK_HIGHLIGHT_COLORS.length],
        };
      })
      .filter(Boolean);
  }, [trackUserIds, tracksByUser]);

  /** Fetch terminado para los IDs actuales (incluye respuesta vacía []). */
  const tracksReady =
    trackUserIds.length > 0 &&
    trackUserIds.every((uid) => Object.prototype.hasOwnProperty.call(tracksByUser, uid));
  const trackEmpty = tracksReady && trackPolylines.length === 0;

  const trackNameById = useMemo(() => {
    const m = new Map();
    for (const l of locations) m.set(String(l.userId), l.displayName);
    return m;
  }, [locations]);

  const allTrackPositions = useMemo(
    () => trackPolylines.flatMap((t) => t.positions),
    [trackPolylines]
  );

  const draftCenter = draftFenceCenter(draft);

  function toggleTrackUser(userId) {
    const id = String(userId);
    setTrackUserIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function handleCreateFence(e) {
    e.preventDefault();
    const parsed = parseFenceLatLng(draft.centerLat, draft.centerLng);
    if (!parsed.ok) {
      if (parsed.reason === 'empty') {
        setError('Indica latitud y longitud, o activa «Fijar en mapa» y haz clic');
      } else if (parsed.reason === 'range') {
        setError('Coordenadas fuera de rango: lat [-90, 90], lng [-180, 180]');
      } else {
        setError('Latitud o longitud inválidas (usa números decimales, ej. 26.96448)');
      }
      return;
    }
    setBusy(true);
    try {
      await createGeofence(session.token, {
        name: draft.name.trim() || 'Zona',
        centerLat: parsed.lat,
        centerLng: parsed.lng,
        radiusM: Number(draft.radiusM) || 200,
      });
      closeFenceForm();
      await reloadFences();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFence(id) {
    setPendingDeleteId(id);
  }

  async function confirmDeleteFence() {
    const id = pendingDeleteId;
    if (!id) return;
    setBusy(true);
    try {
      await deleteGeofence(session.token, id);
      await reloadFences();
      setPendingDeleteId('');
    } catch (err) {
      setError(err.message);
      setPendingDeleteId('');
    } finally {
      setBusy(false);
    }
  }

  const opsKpi = (
    <div className="cc-kpi ops-console-kpi" aria-label="Indicadores de operaciones">
      <div className={`cc-kpi-item${speakingNow.length ? ' hot' : ''}`}>
        <strong>{speakingNow.length}</strong>
        <span>Al aire ahora</span>
      </div>
      <div className="cc-kpi-item">
        <strong>{overview?.groupsCount ?? '—'}</strong>
        <span>Canales</span>
      </div>
      <div className="cc-kpi-item">
        <strong>{visibleLocations.length}</strong>
        <span>Con GPS</span>
      </div>
      <div className="cc-kpi-item">
        <strong>{geofences.length}</strong>
        <span>Geocercas</span>
      </div>
      <div className={`cc-kpi-item${panicUserIds.size ? ' hot panic' : ''}`}>
        <strong>{panicUserIds.size}</strong>
        <span>Alertas activas</span>
      </div>
    </div>
  );

  return (
    <div
      ref={pageRef}
      className={`dispatch-page map-page map-page--fill ops-console${maximized ? ' map-page--maximized' : ''}`}
      data-esc-close={maximized ? '' : undefined}
    >
      {opsKpiHost ? createPortal(opsKpi, opsKpiHost) : null}

      <div className="map-toolbar map-toolbar--spread map-toolbar--ops map-toolbar--ops-tabs">
        <div className="map-ops-tabs" role="tablist" aria-label="Controles del mapa">
          {[
            { id: 'sitios', label: 'Sitios' },
            { id: 'operadores', label: 'Operadores' },
            { id: 'ruta', label: 'Ruta', disabled: !canPickRoutes },
            { id: 'geocerca', label: 'Geocerca' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`map-ops-tab-${tab.id}`}
              aria-selected={opsTab === tab.id}
              aria-controls={`map-ops-panel-${tab.id}`}
              disabled={Boolean(tab.disabled)}
              title={
                tab.id === 'ruta' && !canPickRoutes
                  ? 'Elige operadores primero'
                  : tab.label
              }
              className={`map-ops-tab${opsTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setOpsTab(tab.id)}
            >
              <OpsTabIcon name={tab.id} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="map-ops-panels">
          {opsTab === 'sitios' ? (
            <div
              className="map-ops-panel"
              role="tabpanel"
              id="map-ops-panel-sitios"
              aria-labelledby="map-ops-tab-sitios"
            >
              {tacticalLayerBar}
            </div>
          ) : null}

          {opsTab === 'operadores' ? (
            <div
              className="map-ops-panel map-ops-panel--row"
              role="tabpanel"
              id="map-ops-panel-operadores"
              aria-labelledby="map-ops-tab-operadores"
            >
              <label className="map-field">
                <span>Operadores</span>
                <select
                  value={operatorFilterMode}
                  onFocus={() => claimMsPanel('native-op-mode')}
                  onChange={(e) => {
                    const next = e.target.value;
                    setOperatorFilterMode(next === 'group' ? 'group' : 'all');
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="group">Por grupo</option>
                </select>
              </label>
              {operatorFilterMode === 'group' ? (
                <OperatorGroupMultiSelect
                  groups={radioGroups}
                  selectedIds={operatorGroupIds}
                  onChange={setOperatorGroupIds}
                />
              ) : null}
              <PresenceStatusMultiSelect
                selectedIds={presenceStatusIds}
                onChange={setPresenceStatusIds}
                showAway={showAway}
                showOffline={showOffline}
              />
            </div>
          ) : null}

          {opsTab === 'ruta' ? (
            <div
              className="map-ops-panel map-ops-panel--row"
              role="tabpanel"
              id="map-ops-panel-ruta"
              aria-labelledby="map-ops-tab-ruta"
            >
              {canPickRoutes ? (
                <>
                  <RouteTrackPicker
                    people={routePeople}
                    selectedIds={trackUserIds}
                    onChange={setTrackUserIds}
                  />
                  {showTrackHours ? (
                    <label className="map-field">
                      <span>Horas</span>
                      <select
                        value={trackHours}
                        onFocus={() => claimMsPanel('native-track-hours')}
                        onChange={(e) => setTrackHours(parseInt(e.target.value, 10))}
                      >
                        <option value={2}>2</option>
                        <option value={8}>8</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </select>
                    </label>
                  ) : null}
                </>
              ) : (
                <p className="map-ops-hint muted">Elige operadores primero.</p>
              )}
            </div>
          ) : null}

          {opsTab === 'geocerca' ? (
            <div
              className={`map-ops-panel map-ops-panel--row map-ops-panel--geocerca${
                fenceFormOpen ? ' is-editing' : ''
              }`}
              role="tabpanel"
              id="map-ops-panel-geocerca"
              aria-labelledby="map-ops-tab-geocerca"
            >
              {!fenceFormOpen ? (
                <>
                  {geofences.length > 0 ? (
                    <GeofenceMultiSelect
                      fences={geofences}
                      selectedIds={visibleGeofenceIds}
                      onChange={setVisibleGeofenceIds}
                      onDelete={handleDeleteFence}
                      busy={busy}
                    />
                  ) : null}
                  <button type="button" className="map-action" onClick={openFenceForm}>
                    Nueva geocerca
                  </button>
                </>
              ) : (
                <form className="geofence-form geofence-form--in-panel" onSubmit={handleCreateFence}>
                  <label className="map-field">
                    <span>Nombre</span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Base / Bodega…"
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="map-field map-field--lat">
                    <span>Latitud</span>
                    <input
                      value={draft.centerLat}
                      onChange={(e) => setDraft((d) => ({ ...d, centerLat: e.target.value }))}
                      placeholder="26.96448"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Latitud del centro"
                    />
                  </label>
                  <label className="map-field map-field--lng">
                    <span>Longitud</span>
                    <input
                      value={draft.centerLng}
                      onChange={(e) => setDraft((d) => ({ ...d, centerLng: e.target.value }))}
                      placeholder="-108.86781"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Longitud del centro"
                    />
                  </label>
                  <label className="map-field map-field--radius">
                    <span>Radio (m)</span>
                    <input
                      type="number"
                      min={10}
                      max={50000}
                      value={draft.radiusM}
                      onChange={(e) => setDraft((d) => ({ ...d, radiusM: e.target.value }))}
                    />
                  </label>
                  <label
                    className={`map-fix-toggle${fixOnMap ? ' is-on' : ''}`}
                    title="Opcional: al activar, un clic en el mapa rellena latitud y longitud"
                  >
                    <input
                      type="checkbox"
                      checked={fixOnMap}
                      onChange={(e) => setFixOnMap(e.target.checked)}
                    />
                    <span>Fijar en mapa</span>
                  </label>
                  <div className="map-form-actions">
                    <button type="submit" className="cc-btn primary" disabled={busy}>
                      Guardar
                    </button>
                    <button type="button" className="cc-btn ghost" onClick={closeFenceForm}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="map-sideband">
          <ul className="geofence-alerts">
            {alerts.map((a) => (
              <li key={a.id} className={a.event === 'enter' ? 'enter' : 'exit'}>
                <strong>{a.displayName || a.userId}</strong>
                {a.event === 'enter' ? ' entró a ' : ' salió de '}
                <em>{a.name}</em>
                <span className="muted"> · {new Date(a.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className={`map-frame${fixOnMap ? ' pick-mode' : ''}`}>
        <div
          className={`map-frame-chrome${showIvRmEstados ? ' map-frame-chrome--has-estados' : ''}`}
        >
          <PresenceMapLegend
            overlay
            counts={presenceLegendCounts}
            showAway={showAway}
            showOffline={showOffline}
          />
          <div className="lt-layers" role="group" aria-label="Estilo de mapa">
            {Object.entries(MAP_LAYERS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={mapLayer === key ? 'active' : undefined}
                onClick={() => setMapLayer(key)}
              >
                {meta.label}
              </button>
            ))}
          </div>
          <IvRmStatesLegend surface="consola" />
        </div>
        {trackUserIds.length > 0 ? (
          <div className="track-route-legend" aria-label="Leyenda de rutas">
            <span className="track-route-legend__item">
              <i
                className="track-route-legend__bar"
                style={{ background: TRACK_HIGHLIGHT_COLORS[0], opacity: 0.4 }}
              />
              Ruta recorrida
            </span>
            <span className="track-route-legend__item">
              <i
                className="track-route-legend__bar"
                style={{ background: PREDICTED_COLOR, opacity: 0.65 }}
              />
              Sin señal
              <span className="track-route-legend__dot" aria-hidden="true">
                ·
              </span>
              ruta probable
            </span>
            {trackEmpty ? (
              <span className="track-route-legend__empty">
                Sin GPS en {trackHours} h
              </span>
            ) : null}
          </div>
        ) : null}
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          maxZoom={MAP_MAX_ZOOM}
          zoomSnap={0.25}
          zoomDelta={1}
          {...mapWorldProps()}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer key={mapLayer} {...tileLayerProps(tile)} />
          <ZoomControl position="bottomright" />
          <MapMaximizeNearZoom maximized={maximized} onClick={toggleMaximize} />
          <IvRmStatesLayer surface="consola" />
          <CursorZoom />
          <MapCursorFix />
          <MapSizeFix />
          <MapWorldFillMinZoom />
          <PersistMapView storageKey={MAP_VIEW_KEY} />
          <InvalidateOnLayout tick={maximized ? 1 : 0} />
          <MapClickPicker
            enabled={fenceFormOpen && fixOnMap}
            onPick={(lat, lng) => {
              setDraft((d) => ({
                ...d,
                centerLat: formatFenceCoord(lat),
                centerLng: formatFenceCoord(lng),
              }));
            }}
          />
          {mapGeofences.map((g) => (
            <Circle
              key={g.id}
              center={[g.centerLat, g.centerLng]}
              radius={g.radiusM}
              pathOptions={{ color: '#243d20', fillColor: '#243d20', fillOpacity: 0.12, weight: 2 }}
            >
              <Popup>
                <strong>{g.name}</strong>
                <br />
                Radio {Math.round(g.radiusM)} m
                <br />
                <button
                  type="button"
                  className="cc-btn ghost danger cc-btn-sm"
                  style={{ marginTop: '0.35rem' }}
                  onClick={() => handleDeleteFence(g.id)}
                  disabled={busy}
                >
                  Eliminar
                </button>
              </Popup>
            </Circle>
          ))}
          <TacticalSitesLayer
            sites={tacticalSites}
            visibleGroupIds={visibleGroupIds}
            iconBlobs={iconBlobs}
          />
          {fenceFormOpen && draftCenter ? (
            <Circle
              center={[draftCenter.lat, draftCenter.lng]}
              radius={Number(draft.radiusM) || 200}
              pathOptions={{
                color: '#9a7b2f',
                fillColor: '#9a7b2f',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          ) : null}
          <CargoZoomGate>
            {(showCargo) => (
              <ClusteredLocationLayer
                points={visibleLocations.map((loc) => ({
                  ...loc,
                  id: String(loc.userId),
                  lat: Number(loc.latitude),
                  lng: Number(loc.longitude),
                }))}
                memberSliceKey={(loc) => {
                  if (panicUserIds.has(loc.userId)) return 'panic';
                  const pInfo = presenceByUser[loc.userId];
                  return (
                    resolvePresenceStatus({
                      presence: loc.presence || pInfo?.status,
                      focus: loc.focus || pInfo?.focus,
                      lastSeenAt: loc.lastSeenAt || pInfo?.lastSeenAt,
                      recordedAt: loc.recordedAt,
                      awaySince: loc.awaySince ?? pInfo?.awaySince,
                      offlineRedMinutes,
                      absenceMinutes,
                      showAway,
                      showOffline,
                    }) || 'offline'
                  );
                }}
                renderPoint={(loc) => {
                  const photo = markerPhoto(loc);
                  const groupPhoto = markerGroupPhoto(loc);
                  const pInfo = presenceByUser[loc.userId];
                  const status = resolvePresenceStatus({
                    presence: loc.presence || pInfo?.status,
                    focus: loc.focus || pInfo?.focus,
                    lastSeenAt: loc.lastSeenAt || pInfo?.lastSeenAt,
                    recordedAt: loc.recordedAt,
                    awaySince: loc.awaySince ?? pInfo?.awaySince,
                    offlineRedMinutes,
                    absenceMinutes,
                    showAway,
                    showOffline,
                  });
                  const isLive = status === 'online' || status === 'away';
                  const inPanic = panicUserIds.has(loc.userId);
                  return (
                    <SmoothMarker
                      key={loc.userId}
                      position={[loc.latitude, loc.longitude]}
                      icon={mapAvatarIcon({
                        name: loc.displayName,
                        cargo: loc.cargo,
                        showCargo,
                        presence: status,
                        focus: loc.focus || pInfo?.focus,
                        awaySince: loc.awaySince ?? pInfo?.awaySince,
                        lastSeenAt: loc.lastSeenAt || pInfo?.lastSeenAt,
                        offlineRedMinutes,
                        absenceMinutes,
                        showAway,
                        showOffline,
                        selected: false,
                        photoSrc: photo,
                        groupPhotoSrc: groupPhoto,
                        operatorMode: operatorFilterMode,
                        panic: inPanic,
                      })}
                      zIndexOffset={inPanic ? 400 : isLive ? 100 : 0}
                    >
                      <Popup>
                        <strong>{loc.displayName}</strong>
                        <br />
                        {PRESENCE_LABELS[status] || status}
                        <br />
                        <small>{new Date(loc.recordedAt).toLocaleString()}</small>
                        <br />
                        <MapCoordsLink lat={loc.latitude} lng={loc.longitude} />
                        <br />
                        <button type="button" onClick={() => toggleTrackUser(loc.userId)}>
                          {trackUserIds.includes(String(loc.userId))
                            ? 'Quitar ruta'
                            : 'Ver ruta'}
                        </button>
                      </Popup>
                    </SmoothMarker>
                  );
                }}
              />
            )}
          </CargoZoomGate>
          {trackPolylines.map((tr) => (
            <HighlighterTrack
              key={tr.userId}
              points={tr.points}
              color={tr.color}
              token={session.token}
              displayName={trackNameById.get(tr.userId) || ''}
              predictGaps
            />
          ))}
          {allTrackPositions.length > 0 ? (
            <FitBounds
              positions={allTrackPositions}
              fitToken={`${trackIdsKey}|${trackHours}|${allTrackPositions.length > 1}`}
            />
          ) : null}
        </MapContainer>
      </div>

      <AppDialog
        open={Boolean(pendingDeleteId)}
        title="Eliminar geocerca"
        message="¿Eliminar esta geocerca?"
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingDeleteId('');
        }}
        onConfirm={confirmDeleteFence}
      />

      {maximized && ptt ? (
        <MapPttFloat
          ptt={ptt}
          group={dispatchCtx.group}
          groups={dispatchCtx.groups || []}
          talkIds={dispatchCtx.talkIds || []}
          listenIds={dispatchCtx.listenIds || []}
          videoIds={dispatchCtx.videoIds || []}
          alertIds={dispatchCtx.alertIds || []}
          listenMode={dispatchCtx.listenMode}
          talkMode={dispatchCtx.talkMode}
          videoMode={dispatchCtx.videoMode}
          alertMode={dispatchCtx.alertMode}
          onTalkIdsChange={dispatchCtx.onTalkIdsChange}
          onListenChange={dispatchCtx.onListenChange}
          onVideoIdsChange={dispatchCtx.onVideoIdsChange}
          onAlertIdsChange={dispatchCtx.onAlertIdsChange}
          portalHost={pageRef.current || document.fullscreenElement || document.body}
        />
      ) : null}
    </div>
  );
}
