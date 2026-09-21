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
import { useIsPhone, useIsCoarsePointer } from '../useMediaQuery.js';
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
  updateGeofence,
  deleteGeofence,
  fetchPanicEvents,
} from '../api';
import { socketWireKey, unwrapDispatchPayload, applyDispatchJoinedWire } from '../wireCrypto.js';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { socketAuth } from '../deviceId';
import {
  LOCATION_POLL_MS,
  mergeLocations,
  upsertLocation,
} from './liveTiming.js';
import {
  clampTrackRange,
  rangeEndingNow,
  startOfDay,
  trackPollMsForSpan,
} from './trackRange.js';
import TrackRangePicker from './TrackRangePicker.jsx';
import AppDialog from '../AppDialog';
import { mapAvatarIcon } from './mapAvatarIcon.js';
import PresenceMapLegend, { countPresenceLegend } from './PresenceMapLegend.jsx';
import { MapMaximizeNearZoom } from './MapMaximizeButton.jsx';
import { useMapViewportMaximize } from './useMapViewportMaximize.js';
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
import { TacticalSitesLayer, TACTICAL_SITE_COLORS } from './TacticalSitesLayer.jsx';
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
/** Preferencia: mostrar ruta probable (huecos GPS) en Consola Ruta. */
const SHOW_PROBABLE_ROUTE_KEY = 'tacticalptx_show_probable_route';
/** Preferencia: barra Operadores/Ruta/Geocerca/Sitios visible (también en maximizado). */
const OPS_CHROME_OPEN_KEY = 'tacticalptx_ops_chrome_open';

function loadOpsChromeOpen() {
  try {
    const v = localStorage.getItem(OPS_CHROME_OPEN_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function writeOpsChromeOpen(open) {
  try {
    localStorage.setItem(OPS_CHROME_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}
/** Oliva histórico de círculos en Consola; mismo default en BD. */
const DEFAULT_GEOFENCE_COLOR = '#243d20';
/** Defaults de bolitas (como Sitios); la paleta mutable vive en localStorage. */
const GEOFENCE_COLOR_DEFAULTS = [
  DEFAULT_GEOFENCE_COLOR,
  ...TACTICAL_SITE_COLORS.filter((c) => c.toLowerCase() !== DEFAULT_GEOFENCE_COLOR),
];
const GEOFENCE_PALETTE_KEY = 'tacticalptx_geofence_palette';

function normalizeFenceHex(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

function loadFencePalette() {
  try {
    const raw = localStorage.getItem(GEOFENCE_PALETTE_KEY);
    if (!raw) return [...GEOFENCE_COLOR_DEFAULTS];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...GEOFENCE_COLOR_DEFAULTS];
    return GEOFENCE_COLOR_DEFAULTS.map((def, i) => normalizeFenceHex(arr[i]) || def);
  } catch {
    return [...GEOFENCE_COLOR_DEFAULTS];
  }
}

function saveFencePalette(colors) {
  try {
    localStorage.setItem(GEOFENCE_PALETTE_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
}

function loadShowProbableRoute() {
  try {
    const v = localStorage.getItem(SHOW_PROBABLE_ROUTE_KEY);
    if (v === '0' || v === 'false') return false;
    if (v === '1' || v === 'true') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function storeShowProbableRoute(on) {
  try {
    localStorage.setItem(SHOW_PROBABLE_ROUTE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function fenceColorOrDefault(c) {
  return normalizeFenceHex(c) || DEFAULT_GEOFENCE_COLOR;
}

function emptyFenceDraft() {
  return {
    name: '',
    centerLat: '',
    centerLng: '',
    radiusM: formatRadiusM(200),
    color: loadFencePalette()[0] || DEFAULT_GEOFENCE_COLOR,
  };
}
/** Claves legacy (migración de lectura). */
const OP_FILTER_MODE_KEY = 'tacticalptx_ops_operator_filter_mode';
const OP_FILTER_GROUP_KEY = 'tacticalptx_ops_operator_group_id';
const SOCKET_URL = socketUrl();

const MAP_LAYERS = MAP_TILE_LAYERS;

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

function normalizeOperatorUserIds(raw) {
  if (Array.isArray(raw?.operatorUserIds)) {
    return [...new Set(raw.operatorUserIds.map(String).filter(Boolean))];
  }
  return [];
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

const OPS_KPI_ORDER_KEY = 'tacticalptx_ops_kpi_order';
const OPS_KPI_DEFAULT_ORDER = ['channels', 'gps', 'geofences', 'alerts'];
const OPS_KPI_IDS = new Set(OPS_KPI_DEFAULT_ORDER);
const OPS_KPI_DRAG_THRESHOLD_PX = 8;

function readOpsKpiOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(OPS_KPI_ORDER_KEY) || 'null');
    if (!Array.isArray(raw) || !raw.length) return [...OPS_KPI_DEFAULT_ORDER];
    const next = raw.filter((id) => OPS_KPI_IDS.has(id));
    for (const id of OPS_KPI_DEFAULT_ORDER) {
      if (!next.includes(id)) next.push(id);
    }
    return next;
  } catch {
    return [...OPS_KPI_DEFAULT_ORDER];
  }
}

function writeOpsKpiOrder(order) {
  try {
    localStorage.setItem(OPS_KPI_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function opsKpiIdFromPoint(clientX, clientY, listEl) {
  const el = document.elementFromPoint(clientX, clientY);
  const item = el?.closest?.('[data-ops-kpi-id]');
  if (!item || !listEl?.contains(item)) return null;
  return item.getAttribute('data-ops-kpi-id');
}

/** Formatea un número de coordenada para los inputs Latitud / Longitud. */
function formatFenceCoord(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toFixed(5);
}

/** Radio en metros con separador de miles (es-MX → 40,000). */
function formatRadiusM(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('es-MX');
}

/** Parsea radio del input (quita comas/espacios); NaN si vacío o inválido. */
function parseRadiusM(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d]/g, '');
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
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
  const modeRaw = String(raw?.operatorFilterMode || 'operator');
  // Solo operator|group. Legacy «all» (o valor inválido) → Por operador.
  const migratedFromAll = modeRaw === 'all' || (modeRaw !== 'group' && modeRaw !== 'operator');
  const mode = modeRaw === 'group' ? 'group' : 'operator';
  const operatorGroupIds = normalizeOperatorGroupIds(raw);
  const legacyUserIds = normalizeOperatorUserIds(raw);
  // Persona y «En grupo» van por separado para no perder la selección al cambiar de modo.
  let operatorPersonIds = Array.isArray(raw?.operatorPersonIds)
    ? [...new Set(raw.operatorPersonIds.map(String).filter(Boolean))]
    : mode === 'operator'
      ? legacyUserIds
      : [];
  const groupMemberUserIds = Array.isArray(raw?.groupMemberUserIds)
    ? [...new Set(raw.groupMemberUserIds.map(String).filter(Boolean))]
    : mode === 'group'
      ? legacyUserIds
      : [];
  // «Todos» mostraba todos los pines: al migrar, re-sembrar Persona = todos.
  if (migratedFromAll) operatorPersonIds = [];
  // Primera vez (sin seed): al hidratar datos se marcan todos. Luego persiste lo del usuario.
  const operatorPersonSeeded = migratedFromAll
    ? false
    : raw?.operatorPersonSeeded === true || operatorPersonIds.length > 0;
  // Ids explícitos: vacío = ninguno. Flag aparte para no re-sembrar tras «Desmarcar».
  const groupMemberSeeded =
    raw?.groupMemberSeeded === true || groupMemberUserIds.length > 0;
  const operatorGroupSeeded =
    raw?.operatorGroupSeeded === true || operatorGroupIds.length > 0;
  let trackUserIds = Array.isArray(raw?.trackUserIds)
    ? [...new Set(raw.trackUserIds.map(String).filter(Boolean))]
    : [];
  // Ruta: un solo operador (radio).
  if (trackUserIds.length > 1) trackUserIds = trackUserIds.slice(0, 1);
  const presenceStatusIds = normalizePresenceStatusIds(raw);

  let range;
  if (raw?.trackFrom && raw?.trackTo) {
    const from = new Date(raw.trackFrom);
    const to = new Date(raw.trackTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      range = clampTrackRange(from, to);
    }
  }
  if (!range) {
    const hours = Number(raw?.trackHours);
    const presetH = [2, 8, 24, 48, 120, 168, 720].includes(hours) ? hours : 8;
    range = rangeEndingNow(presetH);
  }

  return {
    operatorFilterMode: mode,
    operatorGroupIds,
    operatorPersonIds,
    groupMemberUserIds,
    operatorPersonSeeded,
    groupMemberSeeded,
    operatorGroupSeeded,
    /** @deprecated compat lectura; se guarda vacío */
    operatorUserIds: [],
    presenceStatusIds,
    trackUserIds,
    trackFrom: range.from.toISOString(),
    trackTo: range.to.toISOString(),
    trackHours: range.spanHours,
  };
}

function loadOpsMapFilters() {
  try {
    // Limpiar clave legacy del select Persona (modo «one» eliminado).
    localStorage.removeItem('tacticalptx_ops_operator_user_id');
  } catch {
    /* ignore */
  }
  /** Ruta: nunca restaurar operador desde localStorage (cada visita/sesión = «— Seleccionar —»). */
  const withoutPersistedTrack = (filters) => ({ ...filters, trackUserIds: [] });
  try {
    const raw = localStorage.getItem(OPS_MAP_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return withoutPersistedTrack(normalizeOpsMapFilters(parsed));
      }
    }
  } catch {
    /* ignore */
  }
  // Migración desde claves sueltas de operadores (antes de v1 unificada).
  const legacyMode = loadStored(OP_FILTER_MODE_KEY, 'operator');
  const legacyGroup = loadStored(OP_FILTER_GROUP_KEY, '');
  const legacyNormalized = legacyMode === 'group' ? 'group' : 'operator';
  return withoutPersistedTrack(
    normalizeOpsMapFilters({
      operatorFilterMode: legacyNormalized,
      operatorGroupIds: legacyGroup ? [legacyGroup] : [],
      operatorPersonIds: [],
      groupMemberUserIds: [],
      operatorPersonSeeded: false,
      groupMemberSeeded: false,
      operatorGroupSeeded: Boolean(legacyGroup),
      trackUserIds: [],
      trackHours: 8,
    })
  );
}

function operatorGroupSummaryLabel(groups, selectedIds) {
  const selected = (groups || []).filter((g) => selectedIds.includes(String(g.id)));
  const n = groups?.length || 0;
  if (selected.length === 0) return '— Seleccionar —';
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
  onEdit,
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
                          <span className="muted"> · {formatRadiusM(g.radiusM)} m</span>
                        </span>
                        <span
                          className="cc-tactical-dot"
                          style={{ background: fenceColorOrDefault(g.color) }}
                          aria-hidden
                        />
                      </label>
                      <div className="cc-geofence-ms-actions">
                        {typeof onEdit === 'function' ? (
                          <button
                            type="button"
                            className="cc-cat-edit"
                            title="Editar"
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEdit(g);
                              setOpen(false);
                            }}
                          >
                            ✎
                          </button>
                        ) : null}
                        {typeof onDelete === 'function' ? (
                          <button
                            type="button"
                            className="cc-cat-rm"
                            title="Eliminar"
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onDelete(id);
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
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
    const timers = [];
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
    };
    const onFs = () => {
      timers.splice(0).forEach((id) => clearTimeout(id));
      run();
      // Stagger after Fullscreen API chrome hide/show (mitiga freeze Leaflet ~1–2s).
      [50, 120, 250, 450].forEach((ms) => timers.push(window.setTimeout(run, ms)));
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    window.addEventListener('resize', onFs);
    return () => {
      timers.forEach((id) => clearTimeout(id));
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
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
  const [operatorPersonIds, setOperatorPersonIds] = useState(
    () => initialFilters.operatorPersonIds || []
  );
  const [groupMemberUserIds, setGroupMemberUserIds] = useState(
    () => initialFilters.groupMemberUserIds || []
  );
  const [operatorPersonSeeded, setOperatorPersonSeeded] = useState(
    () => Boolean(initialFilters.operatorPersonSeeded)
  );
  const [groupMemberSeeded, setGroupMemberSeeded] = useState(
    () => Boolean(initialFilters.groupMemberSeeded)
  );
  const [operatorGroupSeeded, setOperatorGroupSeeded] = useState(
    () => Boolean(initialFilters.operatorGroupSeeded)
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
  /** Universo GPS completo (alcance), independiente del filtro de pines. */
  const [gpsPeople, setGpsPeople] = useState([]);
  const [trackFrom, setTrackFrom] = useState(() => initialFilters.trackFrom);
  const [trackTo, setTrackTo] = useState(() => initialFilters.trackTo);
  const [tracksByUser, setTracksByUser] = useState({});
  const [showProbableRoute, setShowProbableRoute] = useState(loadShowProbableRoute);
  /** true si el usuario tocó Desde/Hasta o ya había una ruta activa al usar «Ver ruta». */
  const trackRangeTouchedRef = useRef(false);
  /** Evita borrar rutas restauradas antes del primer fetch de ubicaciones. */
  const [locationsHydrated, setLocationsHydrated] = useState(false);
  const [geofences, setGeofences] = useState([]);
  /** IDs de geocercas visibles en el mapa (checks del multi-select). */
  const [visibleGeofenceIds, setVisibleGeofenceIds] = useState([]);
  /** false hasta el primer sync; evita que «ninguna marcada» se reinicie a todas en cada poll. */
  const geofenceVisInitRef = useRef(false);
  /** Formulario de nueva geocerca visible. */
  const [fenceFormOpen, setFenceFormOpen] = useState(false);
  const [editingFenceId, setEditingFenceId] = useState('');
  /** Toggle opcional: clic en mapa rellena lat/lng. */
  const [fixOnMap, setFixOnMap] = useState(false);
  const [draft, setDraft] = useState(emptyFenceDraft);
  const [fencePalette, setFencePalette] = useState(loadFencePalette);
  const fenceColorInputRef = useRef(null);
  const fenceColorEditIndexRef = useRef(0);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [opsChromeOpen, setOpsChromeOpen] = useState(loadOpsChromeOpen);
  const [opsKpiHost, setOpsKpiHost] = useState(null);
  const [mapLayer, setMapLayer] = useState(() => loadStoredMapLayer());
  const [opsTab, setOpsTab] = useState(() => readOpsTab());
  const [opsTabOrder, setOpsTabOrder] = useState(() => readOpsTabOrder());
  const [opsDragId, setOpsDragId] = useState(null);
  const [opsOverId, setOpsOverId] = useState(null);
  const opsTabsRef = useRef(null);
  const opsDragSessionRef = useRef(null);
  const opsDragIdRef = useRef(null);
  const opsOverIdRef = useRef(null);
  const opsSuppressClickRef = useRef(false);
  const [opsKpiOrder, setOpsKpiOrder] = useState(() => readOpsKpiOrder());
  const [kpiDragId, setKpiDragId] = useState(null);
  const [kpiOverId, setKpiOverId] = useState(null);
  const opsKpiRef = useRef(null);
  const kpiDragSessionRef = useRef(null);
  const kpiDragIdRef = useRef(null);
  const kpiOverIdRef = useRef(null);
  const isCoarsePointer = useIsCoarsePointer();
  const isPhoneLayout = useIsPhone();
  const allowOpsTabDrag = !isCoarsePointer && !isPhoneLayout;
  const allowOpsKpiDrag = allowOpsTabDrag;

  function setOpsDraggingClass(on) {
    const root = document.documentElement;
    if (on) root.classList.add('map-ops-tabs-dragging');
    else root.classList.remove('map-ops-tabs-dragging');
  }

  function setOpsDragState(nextDrag, nextOver) {
    if (opsDragIdRef.current !== nextDrag) {
      opsDragIdRef.current = nextDrag;
      setOpsDragId(nextDrag);
      setOpsDraggingClass(!!nextDrag);
    }
    if (opsOverIdRef.current !== nextOver) {
      opsOverIdRef.current = nextOver;
      setOpsOverId(nextOver);
    }
  }

  function clearOpsTabDrag() {
    const sess = opsDragSessionRef.current;
    if (sess) {
      if (sess.onMove || sess.onUp) {
        window.removeEventListener('pointermove', sess.onMove, true);
        window.removeEventListener('pointerup', sess.onUp, true);
        window.removeEventListener('pointercancel', sess.onUp, true);
      }
      if (sess.target) {
        try {
          if (sess.target.hasPointerCapture?.(sess.pointerId)) {
            sess.target.releasePointerCapture(sess.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
    }
    opsDragSessionRef.current = null;
    setOpsDragState(null, null);
    setOpsDraggingClass(false);
  }

  function reorderOpsTabs(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setOpsTabOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      writeOpsTabOrder(next);
      return next;
    });
  }

  function onOpsTabPointerDown(e, tabId) {
    if (!allowOpsTabDrag || e.button !== 0) return;
    if (opsDragSessionRef.current) return;

    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const session = {
      id: tabId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointerId,
      target,
      onMove: null,
      onUp: null,
    };
    opsDragSessionRef.current = session;

    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = opsDragSessionRef.current;
      if (!start || start.id !== tabId) return;
      if (!start.moved) {
        if (
          Math.abs(ev.clientX - start.x) < OPS_TAB_DRAG_THRESHOLD_PX &&
          Math.abs(ev.clientY - start.y) < OPS_TAB_DRAG_THRESHOLD_PX
        ) {
          return;
        }
        start.moved = true;
        setOpsDragState(tabId, opsTabIdFromPoint(ev.clientX, ev.clientY, opsTabsRef.current));
        return;
      }
      const hit = opsTabIdFromPoint(ev.clientX, ev.clientY, opsTabsRef.current);
      setOpsDragState(tabId, hit);
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = opsDragSessionRef.current;
      if (start && start.id === tabId && start.moved) {
        opsSuppressClickRef.current = true;
        const hit = opsTabIdFromPoint(ev.clientX, ev.clientY, opsTabsRef.current);
        if (hit) reorderOpsTabs(tabId, hit);
      }
      clearOpsTabDrag();
    };

    session.onMove = onMove;
    session.onUp = onUp;
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }

  function setKpiDraggingClass(on) {
    const root = document.documentElement;
    if (on) root.classList.add('cc-ops-kpi-dragging');
    else root.classList.remove('cc-ops-kpi-dragging');
  }

  function setKpiDragState(nextDrag, nextOver) {
    if (kpiDragIdRef.current !== nextDrag) {
      kpiDragIdRef.current = nextDrag;
      setKpiDragId(nextDrag);
      setKpiDraggingClass(!!nextDrag);
    }
    if (kpiOverIdRef.current !== nextOver) {
      kpiOverIdRef.current = nextOver;
      setKpiOverId(nextOver);
    }
  }

  function clearOpsKpiDrag() {
    const sess = kpiDragSessionRef.current;
    if (sess) {
      if (sess.onMove || sess.onUp) {
        window.removeEventListener('pointermove', sess.onMove, true);
        window.removeEventListener('pointerup', sess.onUp, true);
        window.removeEventListener('pointercancel', sess.onUp, true);
      }
      if (sess.target) {
        try {
          if (sess.target.hasPointerCapture?.(sess.pointerId)) {
            sess.target.releasePointerCapture(sess.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
    }
    kpiDragSessionRef.current = null;
    setKpiDragState(null, null);
    setKpiDraggingClass(false);
  }

  function reorderOpsKpis(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setOpsKpiOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      writeOpsKpiOrder(next);
      return next;
    });
  }

  function onOpsKpiPointerDown(e, kpiId) {
    if (!allowOpsKpiDrag || e.button !== 0) return;
    if (kpiDragSessionRef.current) return;

    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const session = {
      id: kpiId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointerId,
      target,
      onMove: null,
      onUp: null,
    };
    kpiDragSessionRef.current = session;

    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = kpiDragSessionRef.current;
      if (!start || start.id !== kpiId) return;
      if (!start.moved) {
        if (
          Math.abs(ev.clientX - start.x) < OPS_KPI_DRAG_THRESHOLD_PX &&
          Math.abs(ev.clientY - start.y) < OPS_KPI_DRAG_THRESHOLD_PX
        ) {
          return;
        }
        start.moved = true;
        setKpiDragState(kpiId, opsKpiIdFromPoint(ev.clientX, ev.clientY, opsKpiRef.current));
        return;
      }
      const hit = opsKpiIdFromPoint(ev.clientX, ev.clientY, opsKpiRef.current);
      setKpiDragState(kpiId, hit);
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = kpiDragSessionRef.current;
      if (start && start.id === kpiId && start.moved) {
        const hit = opsKpiIdFromPoint(ev.clientX, ev.clientY, opsKpiRef.current);
        if (hit) reorderOpsKpis(kpiId, hit);
      }
      clearOpsKpiDrag();
    };

    session.onMove = onMove;
    session.onUp = onUp;
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }

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
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (opsDragSessionRef.current || opsDragIdRef.current) {
        opsSuppressClickRef.current = true;
        clearOpsTabDrag();
      }
      if (kpiDragSessionRef.current || kpiDragIdRef.current) {
        clearOpsKpiDrag();
      }
    };
    const onVis = () => {
      if (document.visibilityState !== 'hidden') return;
      if (opsDragSessionRef.current || opsDragIdRef.current) {
        opsSuppressClickRef.current = true;
        clearOpsTabDrag();
      }
      if (kpiDragSessionRef.current || kpiDragIdRef.current) {
        clearOpsKpiDrag();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      clearOpsTabDrag();
      clearOpsKpiDrag();
    };
    // Intencional: montaje/desmontaje; clear* usa refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    if (operatorFilterMode === 'operator') {
      if (!operatorPersonIds.length) return [];
      const allow = new Set(operatorPersonIds.map(String));
      list = list.filter((loc) => allow.has(String(loc.userId)));
    } else if (operatorFilterMode === 'group') {
      // Ids explícitos (como Persona): vacío = ninguno en mapa.
      if (!groupMemberUserIds.length) return [];
      const allow = new Set(groupMemberUserIds.map(String));
      list = list.filter((loc) => allow.has(String(loc.userId)));
    }
    const allowed = visiblePresenceStatusIds({ showAway, showOffline });
    const statusSet = new Set(
      (presenceStatusIds || []).map(String).filter((id) => allowed.includes(id))
    );
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
    operatorPersonIds,
    groupMemberUserIds,
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
      operatorPersonIds,
      groupMemberUserIds,
      operatorPersonSeeded,
      groupMemberSeeded,
      operatorGroupSeeded,
      presenceStatusIds,
      trackUserIds,
      trackFrom,
      trackTo,
    });
  }, [
    operatorFilterMode,
    operatorGroupIds,
    operatorPersonIds,
    groupMemberUserIds,
    operatorPersonSeeded,
    groupMemberSeeded,
    operatorGroupSeeded,
    presenceStatusIds,
    trackUserIds,
    trackFrom,
    trackTo,
  ]);

  // Si la org apaga amarillo/gris, quitar esos ids del filtro guardado.
  useEffect(() => {
    const allowed = new Set(visiblePresenceStatusIds({ showAway, showOffline }));
    setPresenceStatusIds((prev) => {
      const next = prev.filter((id) => allowed.has(String(id)));
      if (next.length === prev.length) return prev;
      return next.length ? next : [...allowed];
    });
  }, [showAway, showOffline]);

  // Validar grupos restaurados; 1.ª vez → todos marcados.
  useEffect(() => {
    if (!radioGroups.length) return;
    const allIds = radioGroups.map((g) => String(g.id));
    const valid = new Set(allIds);
    if (!operatorGroupSeeded) {
      setOperatorGroupIds(allIds);
      setOperatorGroupSeeded(true);
      return;
    }
    setOperatorGroupIds((prev) => {
      const next = prev.map(String).filter((id) => valid.has(id));
      return next.length === prev.length && next.every((id, i) => id === String(prev[i]))
        ? prev
        : next;
    });
  }, [radioGroups, operatorGroupSeeded]);

  const routePeople = useMemo(() => sortLocationsByName(gpsPeople), [gpsPeople]);
  /** Personas del grupo actual (GPS) para subfiltro en Por grupo. */
  const groupPeople = useMemo(() => sortLocationsByName(locations), [locations]);
  const showTrackHours = trackUserIds.length >= 1;

  const orderedOpsTabs = useMemo(() => {
    const defs = [
      { id: 'sitios', label: 'Sitios' },
      { id: 'operadores', label: 'Operadores' },
      { id: 'ruta', label: 'Ruta' },
      { id: 'geocerca', label: 'Geocerca' },
    ];
    const byId = new Map(defs.map((t) => [t.id, t]));
    const next = [];
    for (const id of opsTabOrder) {
      const tab = byId.get(id);
      if (tab) {
        next.push(tab);
        byId.delete(id);
      }
    }
    for (const tab of defs) {
      if (byId.has(tab.id)) next.push(tab);
    }
    return next;
  }, [opsTabOrder]);

  // Ruta: un solo id y solo si sigue en el universo GPS.
  useEffect(() => {
    if (!locationsHydrated) return;
    const allowed = new Set(gpsPeople.map((l) => String(l.userId)));
    setTrackUserIds((prev) => {
      const next = prev.map(String).filter((id) => allowed.has(id)).slice(0, 1);
      if (next.length === prev.length && next[0] === prev[0]) return prev;
      return next;
    });
  }, [locationsHydrated, gpsPeople]);

  // Por operador: 1.ª vez todos; luego solo podar ids inválidos (no borrar la elección).
  useEffect(() => {
    if (!locationsHydrated || !gpsPeople.length) return;
    const allIds = gpsPeople.map((l) => String(l.userId));
    const allowed = new Set(allIds);
    if (!operatorPersonSeeded) {
      setOperatorPersonIds(allIds);
      setOperatorPersonSeeded(true);
      return;
    }
    setOperatorPersonIds((prev) => {
      const next = prev.filter((id) => allowed.has(String(id)));
      return next.length === prev.length ? prev : next;
    });
  }, [locationsHydrated, gpsPeople, operatorPersonSeeded]);

  // Por grupo «En grupo»: 1.ª vez todos; vacío = ninguno; Marcar/Desmarcar con ids explícitos.
  const groupPeopleUniverseRef = useRef([]);
  useEffect(() => {
    if (!locationsHydrated || operatorFilterMode !== 'group') return;
    if (!operatorGroupIds.length || !groupPeople.length) return;
    const allIds = groupPeople.map((l) => String(l.userId));
    const allowed = new Set(allIds);
    const prevUniverse = groupPeopleUniverseRef.current;
    groupPeopleUniverseRef.current = allIds;

    if (!groupMemberSeeded) {
      setGroupMemberUserIds(allIds);
      setGroupMemberSeeded(true);
      return;
    }

    setGroupMemberUserIds((prev) => {
      const prevStr = prev.map(String);
      const wasAll =
        prevUniverse.length > 0 &&
        prevStr.length === prevUniverse.length &&
        prevUniverse.every((id) => prevStr.includes(String(id)));
      if (wasAll) {
        const same =
          allIds.length === prevStr.length && allIds.every((id) => prevStr.includes(id));
        return same ? prev : allIds;
      }
      const next = prevStr.filter((id) => allowed.has(id));
      if (next.length === prevStr.length && next.every((id, i) => id === prevStr[i])) {
        return prev;
      }
      return next;
    });
  }, [
    locationsHydrated,
    groupPeople,
    operatorFilterMode,
    operatorGroupIds,
    groupMemberSeeded,
  ]);

  useEffect(() => {
    if (fenceFormOpen) setOpsTab('geocerca');
  }, [fenceFormOpen]);

  function openFenceForm() {
    setEditingFenceId('');
    setDraft(emptyFenceDraft());
    setFixOnMap(false);
    setError('');
    setFenceFormOpen(true);
    setOpsTab('geocerca');
  }

  function openFenceEdit(g) {
    if (!g) return;
    setEditingFenceId(String(g.id));
    setDraft({
      name: String(g.name || ''),
      centerLat: formatFenceCoord(g.centerLat),
      centerLng: formatFenceCoord(g.centerLng),
      radiusM: formatRadiusM(g.radiusM != null ? g.radiusM : 200) || '200',
      color: fenceColorOrDefault(g.color),
    });
    setFixOnMap(false);
    setError('');
    setFenceFormOpen(true);
    setOpsTab('geocerca');
  }

  function closeFenceForm() {
    setFenceFormOpen(false);
    setFixOnMap(false);
    setEditingFenceId('');
    setDraft(emptyFenceDraft());
  }

  /** Paridad Sitios: muta la bolita (índice) + selecciona ese color en el draft. */
  function paintFenceLiveColor(hex) {
    const color = normalizeFenceHex(hex);
    if (!color) return null;
    const idx = fenceColorEditIndexRef.current;
    setDraft((d) => ({ ...d, color }));
    setFencePalette((prev) => {
      const next = [...prev];
      next[idx] = color;
      saveFencePalette(next);
      return next;
    });
    return color;
  }

  /** Doble clic en bolita → paleta nativa (sin cuadro intermedio). */
  function openFenceColorPalette(index, hex) {
    fenceColorEditIndexRef.current = index;
    setDraft((d) => ({ ...d, color: hex }));
    const input = fenceColorInputRef.current;
    if (!input) return;
    input.value = fenceColorOrDefault(hex);
    try {
      input.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      /* fallback click */
    }
    try {
      input.click();
    } catch {
      /* ignore */
    }
  }

  function onFencePaletteColorInput(e) {
    paintFenceLiveColor(e.target.value);
  }

  // Ruta = gpsPeople; no podar trackUserIds contra visibleLocations (filtro de pines).

  const { enterMaximize, exitMaximize, toggleMaximize } = useMapViewportMaximize(
    pageRef,
    maximized,
    setMaximized
  );

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
        // allSettled: un fallo de GPS/overview no descarta geocercas (ni al revés).
        const [allLocR, pinLocR, ovR, gfR, panicR] = await Promise.allSettled([
          fetchLocations(session.token),
          needsGroup
            ? groupReady
              ? fetchLocations(session.token, { groupIds: filter.groupIds })
              : Promise.resolve({ locations: [] })
            : Promise.resolve(null),
          fetchOverview(session.token),
          fetchGeofences(session.token),
          fetchPanicEvents(session.token, { status: 'active' }),
        ]);
        if (cancelled) return;

        const settledOk = [allLocR, ovR, gfR].some((r) => r.status === 'fulfilled');
        if (settledOk) failStreak = 0;
        else {
          failStreak += 1;
          const reason =
            allLocR.status === 'rejected'
              ? allLocR.reason
              : ovR.status === 'rejected'
                ? ovR.reason
                : gfR.status === 'rejected'
                  ? gfR.reason
                  : null;
          if (failStreak >= 3 && reason) setError(reason.message || String(reason));
          return;
        }

        // Geocercas: solo aplicar si el GET OK; error transitorio no vacía la lista.
        if (gfR.status === 'fulfilled') {
          setGeofences((gfR.value?.geofences || []).filter((g) => g.isActive !== false));
        }

        const allLoc = allLocR.status === 'fulfilled' ? allLocR.value : null;
        const pinLoc = pinLocR.status === 'fulfilled' ? pinLocR.value : null;
        const ov = ovR.status === 'fulfilled' ? ovR.value : null;
        if (allLoc) {
          const universe = allLoc.locations || [];
          setGpsPeople((prev) => mergeLocations(prev, universe));
          const incoming = needsGroup ? pinLoc?.locations || [] : universe;
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
          if (ov) setOverview(ov.overview || null);
          const ids = new Set();
          const byUser = { ...(ov?.overview?.presence || {}) };
          (ov?.overview?.channels || []).forEach((c) => {
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
                      allLoc.presenceOfflineRedMinutes ??
                      ov?.overview?.presenceOfflineRedMinutes ??
                      15,
                    absenceMinutes:
                      allLoc.presenceAbsenceMinutes ??
                      ov?.overview?.presenceAbsenceMinutes ??
                      15,
                    showAway:
                      allLoc.presenceShowAway ?? ov?.overview?.presenceShowAway ?? true,
                    showOffline:
                      allLoc.presenceShowOffline ?? ov?.overview?.presenceShowOffline ?? true,
                  }),
                lastSeenAt: row.lastSeenAt,
              };
            }
          });
          setOnlineIds(ids);
          setPresenceByUser(byUser);
          setOfflineRedMinutes(
            allLoc.presenceOfflineRedMinutes ?? ov?.overview?.presenceOfflineRedMinutes ?? 15
          );
          if (
            allLoc.presenceAbsenceMinutes != null ||
            ov?.overview?.presenceAbsenceMinutes != null
          ) {
            setAbsenceMinutes(
              Number(allLoc.presenceAbsenceMinutes ?? ov?.overview?.presenceAbsenceMinutes) || 0
            );
          }
          const nextShowAway = allLoc.presenceShowAway ?? ov?.overview?.presenceShowAway;
          const nextShowOffline = allLoc.presenceShowOffline ?? ov?.overview?.presenceShowOffline;
          if (nextShowAway != null) setShowAway(nextShowAway !== false);
          if (nextShowOffline != null) setShowOffline(nextShowOffline !== false);
        } else if (ov) {
          setOverview(ov.overview || null);
        }

        if (panicR.status === 'fulfilled') {
          const next = new Set();
          const idMap = new Map();
          (panicR.value?.events || []).forEach((e) => {
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
  const trackRange = useMemo(() => {
    const from = new Date(trackFrom);
    const to = new Date(trackTo);
    return clampTrackRange(
      Number.isNaN(from.getTime()) ? new Date(Date.now() - 8 * 3600 * 1000) : from,
      Number.isNaN(to.getTime()) ? new Date() : to
    );
  }, [trackFrom, trackTo]);

  function applyTrackRange(next) {
    const clamped =
      next?.from && next?.to
        ? clampTrackRange(next.from, next.to)
        : clampTrackRange(next, trackRange.to);
    trackRangeTouchedRef.current = true;
    setTrackFrom(clamped.from.toISOString());
    setTrackTo(clamped.to.toISOString());
  }

  /** Pin «Ver ruta»: selecciona 1 operador en Ruta; conserva periodo o usa hoy 00:00→ahora. */
  function selectRouteFromPin(userId) {
    const id = String(userId);
    setOpsTab('ruta');
    setTrackUserIds((prev) => {
      if (prev.length === 1 && prev[0] === id) return [];
      if (!prev.length && !trackRangeTouchedRef.current) {
        const now = new Date();
        const day = clampTrackRange(startOfDay(now), now);
        setTrackFrom(day.from.toISOString());
        setTrackTo(day.to.toISOString());
      }
      return [id];
    });
  }

  useEffect(() => {
    if (!trackUserIds.length) {
      setTracksByUser({});
      return undefined;
    }
    let cancelled = false;
    const ids = [...trackUserIds];
    const clamped = clampTrackRange(new Date(trackFrom), new Date(trackTo));
    const fromIso = clamped.from.toISOString();
    const toIso = clamped.to.toISOString();
    const spanH = clamped.spanHours;
    const loadTracks = () => {
      if (cancelled || document.hidden) return;
      Promise.all(
        ids.map(async (uid) => {
          try {
            const data = await fetchUserTrack(session.token, uid, { from: fromIso, to: toIso });
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
    const t = setInterval(loadTracks, trackPollMsForSpan(spanH));
    const onVis = () => {
      if (!document.hidden) loadTracks();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session.token, trackIdsKey, trackFrom, trackTo]);

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

  async function handleSaveFence(e) {
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
    const body = {
      name: draft.name.trim() || 'Zona',
      centerLat: parsed.lat,
      centerLng: parsed.lng,
      radiusM: parseRadiusM(draft.radiusM) || 200,
      color: fenceColorOrDefault(draft.color),
    };
    setBusy(true);
    try {
      if (editingFenceId) {
        await updateGeofence(session.token, editingFenceId, body);
      } else {
        await createGeofence(session.token, body);
      }
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

  const kpiById = {
    channels: {
      value: overview?.groupsCount ?? '—',
      label: 'Grupos',
      className: '',
    },
    gps: {
      value: visibleLocations.length,
      label: 'Operadores',
      className: '',
    },
    geofences: {
      value: geofences.length,
      label: 'Geocercas',
      className: '',
    },
    alerts: {
      value: panicUserIds.size,
      label: 'Alertas',
      className: panicUserIds.size ? ' hot panic' : '',
    },
  };

  const opsKpi = (
    <div
      ref={opsKpiRef}
      className="cc-kpi ops-console-kpi"
      aria-label="Indicadores de operaciones"
    >
      {opsKpiOrder.map((id) => {
        const item = kpiById[id];
        if (!item) return null;
        const dragging = kpiDragId === id;
        const over = kpiOverId === id && kpiDragId && kpiOverId !== kpiDragId;
        return (
          <div
            key={id}
            data-ops-kpi-id={id}
            title={allowOpsKpiDrag ? `${item.label} · Arrastrar para reordenar` : item.label}
            className={[
              'cc-kpi-item',
              item.className.trim(),
              allowOpsKpiDrag ? 'is-draggable' : '',
              dragging ? 'is-dragging' : '',
              over ? 'is-drag-over' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={(e) => onOpsKpiPointerDown(e, id)}
          >
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );

  function setOpsChrome(open) {
    const next = Boolean(open);
    setOpsChromeOpen(next);
    writeOpsChromeOpen(next);
  }

  /*
   * Tras reparent a body (useMapViewportMaximize), los onClick de React 17+
   * dejan de llegar: la delegación vive en #root y el page ya no es descendiente.
   * Delegación nativa en el propio page (Ocultar/Mostrar panel + pestañas ops
   * + estilo de mapa .lt-layers).
   */
  useEffect(() => {
    const el = pageRef.current;
    if (!el || !maximized) return undefined;
    const onNativeOpsClick = (e) => {
      const chromeBtn = e.target?.closest?.('[data-ops-chrome]');
      if (chromeBtn && el.contains(chromeBtn)) {
        const raw = chromeBtn.getAttribute('data-ops-chrome');
        if (raw === '0' || raw === '1') {
          e.preventDefault();
          setOpsChrome(raw === '1');
          return;
        }
      }
      const layerBtn = e.target?.closest?.('[data-map-layer]');
      if (layerBtn && el.contains(layerBtn)) {
        const layerKey = layerBtn.getAttribute('data-map-layer');
        if (layerKey && MAP_LAYERS[layerKey]) {
          e.preventDefault();
          setMapLayer(layerKey);
          return;
        }
      }
      const tabBtn = e.target?.closest?.('[data-ops-tab-id]');
      if (!tabBtn || !el.contains(tabBtn) || tabBtn.disabled) return;
      if (opsSuppressClickRef.current) {
        opsSuppressClickRef.current = false;
        return;
      }
      const tabId = tabBtn.getAttribute('data-ops-tab-id');
      if (!OPS_TAB_IDS.has(tabId)) return;
      e.preventDefault();
      setOpsTab(tabId);
    };
    el.addEventListener('click', onNativeOpsClick);
    return () => el.removeEventListener('click', onNativeOpsClick);
  }, [maximized]);

  return (
    <div
      ref={pageRef}
      className={[
        'dispatch-page',
        'map-page',
        'map-page--fill',
        'ops-console',
        maximized ? 'map-page--maximized' : '',
        /*
         * Al maximizar, useMapViewportMaximize reparenta este nodo a body.
         * Las reglas `.cc-shell .map-*` dejan de aplicar sin ancestro shell;
         * marcamos el page como `.cc-shell` solo en maximizado (mismo patrón
         * que documenta command-center.css para body > .map-page--maximized).
         */
        maximized ? 'cc-shell' : '',
        /* Colapso visual solo con CSS .map-page--maximized.map-page--ops-collapsed */
        maximized && !opsChromeOpen ? 'map-page--ops-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-esc-close={maximized ? '' : undefined}
    >
      {opsKpiHost ? createPortal(opsKpi, opsKpiHost) : null}

      <div
        id="map-ops-toolbar"
        className="map-toolbar map-toolbar--spread map-toolbar--ops map-toolbar--ops-tabs"
        hidden={maximized && !opsChromeOpen}
        aria-hidden={maximized && !opsChromeOpen ? true : undefined}
        style={maximized && !opsChromeOpen ? { display: 'none' } : undefined}
      >
        <div className="map-ops-tabs-row">
          <div
            ref={opsTabsRef}
            className="map-ops-tabs"
            role="tablist"
            aria-label="Controles del mapa"
          >
            {orderedOpsTabs.map((tab) => {
              const dragging = opsDragId === tab.id;
              const over = opsOverId === tab.id && opsDragId && opsOverId !== opsDragId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`map-ops-tab-${tab.id}`}
                  data-ops-tab-id={tab.id}
                  aria-selected={opsTab === tab.id}
                  aria-controls={`map-ops-panel-${tab.id}`}
                  disabled={Boolean(tab.disabled)}
                  title={
                    allowOpsTabDrag
                      ? `${tab.label} · Arrastrar para reordenar`
                      : tab.label
                  }
                  className={[
                    'map-ops-tab',
                    opsTab === tab.id ? 'is-active' : '',
                    allowOpsTabDrag && !tab.disabled ? 'is-draggable' : '',
                    dragging ? 'is-dragging' : '',
                    over ? 'is-drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (opsSuppressClickRef.current) {
                      opsSuppressClickRef.current = false;
                      return;
                    }
                    setOpsTab(tab.id);
                  }}
                  onPointerDown={(e) => {
                    if (tab.disabled) return;
                    onOpsTabPointerDown(e, tab.id);
                  }}
                >
                  <OpsTabIcon name={tab.id} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-ops-panels">
          {opsTab === 'sitios' ? (
            <div
              className="map-ops-panel map-ops-panel--row"
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
              <label className="map-field map-field--ops-primary">
                <span className="map-field-label-row">
                  Operadores
                  <span
                    className="cc-ms-hint map-ops-field-hint"
                    title="Solo operadores que ya compartieron ubicación (GPS) al menos una vez. Quien nunca apareció en el mapa no sale en estos listados."
                  >
                    ?
                  </span>
                </span>
                <select
                  value={operatorFilterMode === 'group' ? 'group' : 'operator'}
                  onFocus={() => claimMsPanel('native-op-mode')}
                  onChange={(e) => {
                    const next = e.target.value;
                    const mode = next === 'group' ? 'group' : 'operator';
                    // No borrar Persona/Grupo: cada modo conserva su selección.
                    setOperatorFilterMode(mode);
                  }}
                >
                  <option value="operator">Por operador</option>
                  <option value="group">Por grupo</option>
                </select>
              </label>
              {operatorFilterMode === 'operator' ? (
                <RouteTrackPicker
                  fieldLabel="Persona"
                  people={routePeople}
                  selectedIds={operatorPersonIds}
                  onChange={(ids) => {
                    setOperatorPersonIds(ids);
                    setOperatorPersonSeeded(true);
                  }}
                  emptyMeansAll={false}
                  emptyMessage="Aún no hay operadores con GPS en el mapa"
                  hintTitle="Marca quién ver en el mapa. Solo quienes ya compartieron GPS. Ascendente/Descendente ordena. La selección se guarda en este navegador."
                />
              ) : null}
              {operatorFilterMode === 'group' ? (
                <>
                  <OperatorGroupMultiSelect
                    groups={radioGroups}
                    selectedIds={operatorGroupIds}
                    onChange={(ids) => {
                      setOperatorGroupIds(ids);
                      setOperatorGroupSeeded(true);
                    }}
                  />
                  {operatorGroupIds.length ? (
                    <RouteTrackPicker
                      fieldLabel="En grupo"
                      people={groupPeople}
                      selectedIds={groupMemberUserIds}
                      onChange={(ids) => {
                        setGroupMemberUserIds(ids);
                        setGroupMemberSeeded(true);
                      }}
                      emptyMeansAll={false}
                      emptyMessage="Sin GPS en los grupos elegidos"
                      hintTitle="Marca quién ver del grupo. Solo quienes ya compartieron GPS. Ascendente/Descendente ordena. La selección se guarda en este navegador."
                    />
                  ) : null}
                </>
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
              className="map-ops-panel map-ops-panel--row map-ops-panel--ruta"
              role="tabpanel"
              id="map-ops-panel-ruta"
              aria-labelledby="map-ops-tab-ruta"
            >
              <RouteTrackPicker
                fieldLabel="Ruta"
                people={routePeople}
                selectedIds={trackUserIds}
                onChange={(ids) => {
                  const next = ids.slice(0, 1);
                  if (next.length) trackRangeTouchedRef.current = true;
                  setTrackUserIds(next);
                }}
                singleSelect
                emptyMessage="Sin operadores con GPS registrado"
                hintTitle="Selecciona un operador y pulsa Aceptar (o cierra el panel: se conserva lo marcado). Solo quien ya compartió GPS. Historial hasta 30 días."
              />
              {showTrackHours ? (
                <>
                  <TrackRangePicker from={trackRange.from} to={trackRange.to} onChange={applyTrackRange} />
                  <label
                    className={`map-fix-toggle map-fix-toggle--probable${
                      showProbableRoute ? ' is-on' : ''
                    }`}
                    title="Rellena huecos sin GPS con ruta probable (calles o estimado). Si se desactiva, solo se ve la ruta recorrida."
                  >
                    <input
                      type="checkbox"
                      checked={showProbableRoute}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setShowProbableRoute(on);
                        storeShowProbableRoute(on);
                      }}
                    />
                    <span>Ruta probable</span>
                  </label>
                </>
              ) : (
                <p className="map-ops-hint muted">Selecciona un operador para ver su historial.</p>
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
                      onEdit={openFenceEdit}
                      onDelete={handleDeleteFence}
                      busy={busy}
                    />
                  ) : null}
                  <button type="button" className="map-action" onClick={openFenceForm}>
                    Nueva geocerca
                  </button>
                </>
              ) : (
                <form className="geofence-form geofence-form--in-panel" onSubmit={handleSaveFence}>
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
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.radiusM}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d]/g, '');
                        setDraft((d) => ({
                          ...d,
                          radiusM: digits ? Number(digits).toLocaleString('es-MX') : '',
                        }));
                      }}
                      aria-label="Radio en metros"
                    />
                  </label>
                  <div className="map-field map-field--color">
                    <span>Color</span>
                    <div className="cc-tactical-colors" role="group" aria-label="Color en mapa">
                      {fencePalette.map((c, i) => {
                        const hex = fenceColorOrDefault(c);
                        const selected = fenceColorOrDefault(draft.color);
                        const active = selected === hex;
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`cc-tactical-color${active ? ' is-active' : ''}`}
                            style={{ background: hex }}
                            title={`${hex} — clic elige · doble clic abre paleta`}
                            aria-pressed={active}
                            onClick={() => setDraft((d) => ({ ...d, color: hex }))}
                            onDoubleClick={(ev) => {
                              ev.preventDefault();
                              ev.stopPropagation();
                              openFenceColorPalette(i, hex);
                            }}
                          />
                        );
                      })}
                      <input
                        ref={fenceColorInputRef}
                        type="color"
                        className="cc-tactical-color-native"
                        aria-hidden="true"
                        tabIndex={-1}
                        defaultValue={fenceColorOrDefault(draft.color)}
                        onInput={onFencePaletteColorInput}
                        onChange={onFencePaletteColorInput}
                      />
                    </div>
                  </div>
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
                      {editingFenceId ? 'Guardar cambios' : 'Guardar'}
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
        {maximized ? (
          <button
            type="button"
            className="map-ops-chrome-btn map-ops-chrome-btn--dock"
            title={opsChromeOpen ? 'Ocultar panel' : 'Mostrar panel'}
            aria-label={opsChromeOpen ? 'Ocultar panel' : 'Mostrar panel'}
            aria-expanded={opsChromeOpen}
            aria-controls="map-ops-toolbar"
            data-ops-chrome={opsChromeOpen ? '0' : '1'}
          >
            {opsChromeOpen ? 'Ocultar panel' : 'Mostrar panel'}
          </button>
        ) : null}
        <div
          className={`map-frame-chrome${showIvRmEstados ? ' map-frame-chrome--has-estados' : ''}`}
        >
          <PresenceMapLegend
            overlay
            counts={presenceLegendCounts}
            showAway={showAway}
            showOffline={showOffline}
            selectedStatusIds={presenceStatusIds}
          />
          <div className="lt-layers" role="group" aria-label="Estilo de mapa">
            {Object.entries(MAP_LAYERS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={mapLayer === key ? 'active' : undefined}
                data-map-layer={key}
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
            {showProbableRoute ? (
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
            ) : null}
            {trackEmpty ? (
              <span className="track-route-legend__empty">
                Sin GPS en el periodo
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
          <InvalidateOnLayout
            tick={(maximized ? 1 : 0) + (maximized && !opsChromeOpen ? 2 : 0)}
          />
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
          {mapGeofences.map((g) => {
            const stroke = fenceColorOrDefault(g.color);
            return (
            <Circle
              key={g.id}
              center={[g.centerLat, g.centerLng]}
              radius={g.radiusM}
              pathOptions={{ color: stroke, fillColor: stroke, fillOpacity: 0.12, weight: 2 }}
            >
              <Popup>
                <strong>{g.name}</strong>
                <br />
                Radio {formatRadiusM(g.radiusM)} m
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
            );
          })}
          <TacticalSitesLayer
            sites={tacticalSites}
            visibleGroupIds={visibleGroupIds}
            iconBlobs={iconBlobs}
          />
          {fenceFormOpen && draftCenter ? (
            <Circle
              center={[draftCenter.lat, draftCenter.lng]}
              radius={parseRadiusM(draft.radiusM) || 200}
              pathOptions={{
                color: fenceColorOrDefault(draft.color),
                fillColor: fenceColorOrDefault(draft.color),
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
                        <button type="button" onClick={() => selectRouteFromPin(loc.userId)}>
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
              predictGaps={showProbableRoute}
            />
          ))}
          {allTrackPositions.length > 0 ? (
            <FitBounds
              positions={allTrackPositions}
              fitToken={`${trackIdsKey}|${trackFrom}|${trackTo}|${allTrackPositions.length > 1}`}
            />
          ) : null}
        </MapContainer>
      </div>

      <AppDialog
        open={Boolean(pendingDeleteId)}
        title="Eliminar geocerca"
        message={(() => {
          const fence = geofences.find((g) => String(g.id) === String(pendingDeleteId));
          const name = String(fence?.name || '').trim();
          return name
            ? `Se eliminará la geocerca «${name}». Esta acción no se puede deshacer.`
            : 'Se eliminará esta geocerca. Esta acción no se puede deshacer.';
        })()}
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
          onListenModeChange={dispatchCtx.onListenModeChange}
          onTalkModeChange={dispatchCtx.onTalkModeChange}
          onVideoModeChange={dispatchCtx.onVideoModeChange}
          onAlertModeChange={dispatchCtx.onAlertModeChange}
          portalHost={pageRef.current || document.fullscreenElement || document.body}
        />
      ) : null}
    </div>
  );
}
