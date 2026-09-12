import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
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
import { sessionWireKey, unwrapDispatchPayload } from '../wireCrypto.js';
import { socketIoOptions, socketUrl } from '../socketConfig';
import {
  LOCATION_POLL_MS,
  TRACK_POLL_MS,
  mergeLocations,
  upsertLocation,
} from './liveTiming.js';
import AppDialog from '../AppDialog';
import { mapAvatarIcon } from './mapAvatarIcon.js';
import PresenceMapLegend, { countPresenceLegend } from './PresenceMapLegend.jsx';
import { PRESENCE_LABELS, resolvePresenceStatus } from './presenceStatus.js';
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
import {
  MAX_TRACK_ROUTES,
  RouteTrackPicker,
  TRACK_ROUTE_COLORS,
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
const OP_FILTER_MODE_KEY = 'tacticalptx_ops_operator_filter_mode';
const OP_FILTER_GROUP_KEY = 'tacticalptx_ops_operator_group_id';
const OP_FILTER_USER_KEY = 'tacticalptx_ops_operator_user_id';
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

function storeValue(key, value) {
  try {
    if (value == null || value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
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
  const { markerPhoto } = useMapAvatarPhotos(locations, session.token);
  const [overview, setOverview] = useState(null);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [presenceByUser, setPresenceByUser] = useState({});
  const [offlineRedMinutes, setOfflineRedMinutes] = useState(15);
  const [panicUserIds, setPanicUserIds] = useState(() => new Set());
  const panicIdToUserRef = useRef(new Map());
  const [operatorFilterMode, setOperatorFilterMode] = useState(() => {
    const v = loadStored(OP_FILTER_MODE_KEY, 'all');
    return v === 'group' || v === 'one' ? v : 'all';
  });
  const [operatorGroupId, setOperatorGroupId] = useState(() => loadStored(OP_FILTER_GROUP_KEY, ''));
  const [operatorUserId, setOperatorUserId] = useState(() => loadStored(OP_FILTER_USER_KEY, ''));
  const [trackUserIds, setTrackUserIds] = useState([]);
  const [trackHours, setTrackHours] = useState(8);
  const [tracksByUser, setTracksByUser] = useState({});
  const [geofences, setGeofences] = useState([]);
  const [pickMode, setPickMode] = useState(false);
  const [draft, setDraft] = useState({ name: '', centerLat: null, centerLng: null, radiusM: 200 });
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [layer, setLayer] = useState(() => loadStoredMapLayer());
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [maximized, setMaximized] = useState(false);
  const tile = MAP_LAYERS[layer] || MAP_LAYERS.natural;

  useEffect(() => {
    storeMapLayer(layer);
  }, [layer]);
  const { sites: tacticalSites, visibleGroupIds, iconBlobs, layerBar: tacticalLayerBar } = useTacticalSites(
    session.token
  );
  const locationFetchOpts = useMemo(() => {
    if (operatorFilterMode === 'group' && operatorGroupId) {
      return { groupIds: [operatorGroupId] };
    }
    return {};
  }, [operatorFilterMode, operatorGroupId]);
  const visibleLocations = useMemo(() => {
    if (operatorFilterMode === 'group' && !operatorGroupId) return [];
    if (operatorFilterMode === 'one') {
      if (!operatorUserId) return [];
      return locations.filter((l) => l.userId === operatorUserId);
    }
    return locations;
  }, [locations, operatorFilterMode, operatorGroupId, operatorUserId]);
  const operatorFilterRef = useRef({ mode: operatorFilterMode, groupId: operatorGroupId, userId: operatorUserId });
  operatorFilterRef.current = {
    mode: operatorFilterMode,
    groupId: operatorGroupId,
    userId: operatorUserId,
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
      };
    });
    return countPresenceLegend(enriched, panicUserIds, offlineRedMinutes);
  }, [visibleLocations, presenceByUser, panicUserIds, offlineRedMinutes]);

  useEffect(() => {
    storeValue(OP_FILTER_MODE_KEY, operatorFilterMode);
  }, [operatorFilterMode]);

  useEffect(() => {
    storeValue(OP_FILTER_GROUP_KEY, operatorGroupId);
  }, [operatorGroupId]);

  useEffect(() => {
    storeValue(OP_FILTER_USER_KEY, operatorUserId);
  }, [operatorUserId]);

  const routePeople = useMemo(
    () => sortLocationsByName(visibleLocations),
    [visibleLocations]
  );

  useEffect(() => {
    setTrackUserIds((prev) => {
      if (!prev.length) return prev;
      const allowed = new Set(visibleLocations.map((l) => l.userId));
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleLocations]);

  const exitMaximize = useCallback(() => {
    setMaximized(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enterMaximize = useCallback(async () => {
    setMaximized(true);
    const el = pageRef.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
      } catch {
        /* CSS fixed fallback */
      }
    }
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (document.hidden) return;
      try {
        const filter = operatorFilterRef.current;
        const needsGroup = filter.mode === 'group';
        const groupReady = needsGroup && Boolean(filter.groupId);
        const locOpts = groupReady ? { groupIds: [filter.groupId] } : {};
        const [loc, ov, gf, panic] = await Promise.all([
          groupReady || !needsGroup
            ? fetchLocations(session.token, locOpts)
            : Promise.resolve({ locations: [] }),
          fetchOverview(session.token),
          fetchGeofences(session.token),
          fetchPanicEvents(session.token, { status: 'active' }).catch(() => ({ events: [] })),
        ]);
        if (cancelled) return;
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
              status: row.presence || resolvePresenceStatus({
                focus: row.focus,
                lastSeenAt: row.lastSeenAt,
                offlineRedMinutes:
                  loc.presenceOfflineRedMinutes ||
                  ov.overview?.presenceOfflineRedMinutes ||
                  15,
              }),
              lastSeenAt: row.lastSeenAt,
            };
          }
        });
        setOnlineIds(ids);
        setPresenceByUser(byUser);
        setOfflineRedMinutes(
          loc.presenceOfflineRedMinutes ||
            ov.overview?.presenceOfflineRedMinutes ||
            15
        );
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
        if (!cancelled) setError(e.message);
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
      auth: { token: session.token },
      ...socketIoOptions,
    });
    const join = () => {
      socket.emit('dispatch:join');
    };
    socket.on('connect', join);
    socket.on('reconnect', join);
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
        const loc = await unwrapDispatchPayload(payload, sessionWireKey(session));
        if (!loc?.userId) return;
        const filter = operatorFilterRef.current;
        setLocations((prev) => {
          if (filter.mode === 'group' && filter.groupId) {
            // Solo actualizar miembros ya en el set (el poll redefine la membresía).
            if (!prev.some((l) => l.userId === loc.userId)) return prev;
          }
          return upsertLocation(prev, loc);
        });
      })();
    });
    socket.on('dispatch:geofence', (payload) => {
      void (async () => {
        const g = await unwrapDispatchPayload(payload, sessionWireKey(session));
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
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
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
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
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
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, session.crypto?.wireKey]);

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
    const t = setInterval(loadTracks, TRACK_POLL_MS);
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
          positions,
          color: TRACK_ROUTE_COLORS[i % TRACK_ROUTE_COLORS.length],
        };
      })
      .filter(Boolean);
  }, [trackUserIds, tracksByUser]);

  const allTrackPositions = useMemo(
    () => trackPolylines.flatMap((t) => t.positions),
    [trackPolylines]
  );

  function toggleTrackUser(userId) {
    const id = String(userId);
    setTrackUserIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TRACK_ROUTES) return prev;
      return [...prev, id];
    });
  }

  async function handleCreateFence(e) {
    e.preventDefault();
    if (draft.centerLat == null || draft.centerLng == null) {
      setError('Haz clic en el mapa para fijar el centro');
      return;
    }
    setBusy(true);
    try {
      await createGeofence(session.token, {
        name: draft.name.trim() || 'Zona',
        centerLat: draft.centerLat,
        centerLng: draft.centerLng,
        radiusM: Number(draft.radiusM) || 200,
      });
      setDraft({ name: '', centerLat: null, centerLng: null, radiusM: 200 });
      setPickMode(false);
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

  return (
    <div
      ref={pageRef}
      className={`dispatch-page map-page map-page--fill ops-console${maximized ? ' map-page--maximized' : ''}`}
      data-esc-close={maximized ? '' : undefined}
    >
      <header className="dispatch-header map-page-head ops-console-head">
        <div className="ops-console-head-title">
          <h1>Consola de Operaciones</h1>
          <p className="muted cc-page-sub">Indicadores · ubicación · rutas · geocercas</p>
        </div>
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
      </header>

      <div className="map-toolbar map-toolbar--spread map-toolbar--ops">
        <label className="map-field map-field--layers">
          <span>Mapas</span>
          <div className="lt-layers" role="group" aria-label="Estilo de mapa">
            {Object.entries(MAP_LAYERS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={layer === key ? 'active' : undefined}
                onClick={() => setLayer(key)}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </label>
        {tacticalLayerBar}
        <div className="map-toolbar-trail">
          <label className="map-field">
            <span>Operadores</span>
            <select
              value={operatorFilterMode}
              onChange={(e) => {
                const next = e.target.value;
                setOperatorFilterMode(next === 'group' || next === 'one' ? next : 'all');
              }}
            >
              <option value="all">Todos</option>
              <option value="group">Por grupo</option>
              <option value="one">Uno</option>
            </select>
          </label>
          {operatorFilterMode === 'group' ? (
            <label className="map-field">
              <span>Grupo</span>
              <select
                value={operatorGroupId}
                onChange={(e) => setOperatorGroupId(e.target.value)}
              >
                <option value="">— elegir —</option>
                {radioGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {operatorFilterMode === 'one' ? (
            <label className="map-field">
              <span>Persona</span>
              <select
                value={operatorUserId}
                onChange={(e) => setOperatorUserId(e.target.value)}
              >
                <option value="">— elegir —</option>
                {[...locations]
                  .sort((a, b) =>
                    String(a.displayName || '').localeCompare(
                      String(b.displayName || ''),
                      'es',
                      { sensitivity: 'base' }
                    )
                  )
                  .map((l) => (
                    <option key={l.userId} value={l.userId}>
                      {l.displayName}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <RouteTrackPicker
            people={routePeople}
            selectedIds={trackUserIds}
            onChange={setTrackUserIds}
            max={MAX_TRACK_ROUTES}
          />
          <label className="map-field">
            <span>Horas</span>
            <select
              value={trackHours}
              onChange={(e) => setTrackHours(parseInt(e.target.value, 10))}
            >
              <option value={2}>2</option>
              <option value={8}>8</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </label>
          <button
            type="button"
            className={`map-action${pickMode ? ' is-on' : ''}`}
            onClick={() => setPickMode((v) => !v)}
          >
            {pickMode ? 'Clic en mapa…' : 'Nueva geocerca'}
          </button>
        </div>
      </div>

      {pickMode && (
        <form className="map-toolbar map-toolbar--spread geofence-form" onSubmit={handleCreateFence}>
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
          <label className="map-field">
            <span>Radio (m)</span>
            <input
              type="number"
              min={10}
              max={50000}
              value={draft.radiusM}
              onChange={(e) => setDraft((d) => ({ ...d, radiusM: e.target.value }))}
            />
          </label>
          <span className="muted map-coords">
            {draft.centerLat != null
              ? `${draft.centerLat.toFixed(5)}, ${draft.centerLng.toFixed(5)}`
              : 'Clic en el mapa = centro'}
          </span>
          <div className="map-form-actions">
            <button type="submit" disabled={busy}>
              Guardar
            </button>
            <button type="button" onClick={() => setPickMode(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {(geofences.length > 0 || alerts.length > 0) && (
        <div className="map-sideband">
          {geofences.length > 0 && (
            <ul className="geofence-list">
              {geofences.map((g) => (
                <li key={g.id}>
                  <strong>{g.name}</strong>
                  <span className="muted"> · {Math.round(g.radiusM)} m</span>
                  <button type="button" onClick={() => handleDeleteFence(g.id)} disabled={busy}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {alerts.length > 0 && (
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
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className={`map-frame${pickMode ? ' pick-mode' : ''}`}>
        <div className="map-frame-chrome">
          <button
            type="button"
            className="lt-max-btn lt-max-btn--map"
            onClick={toggleMaximize}
            title={maximized ? 'Reducir (Esc)' : 'Pantalla completa'}
            aria-label={maximized ? 'Reducir mapa' : 'Maximizar mapa a pantalla completa'}
            data-esc-close-btn={maximized ? '' : undefined}
          >
            {maximized ? '⛶ Reducir' : '⛶ Maximizar'}
          </button>
          {maximized ? (
            <span className="lt-max-hint">Esc o Reducir para salir</span>
          ) : null}
        </div>
        <PresenceMapLegend overlay counts={presenceLegendCounts} />
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
          <TileLayer key={layer} {...tileLayerProps(tile)} />
          <ZoomControl position="bottomright" />
          <CursorZoom />
          <MapCursorFix />
          <MapSizeFix />
          <MapWorldFillMinZoom />
          <PersistMapView storageKey={MAP_VIEW_KEY} />
          <InvalidateOnLayout tick={maximized ? 1 : 0} />
          <MapClickPicker
            enabled={pickMode}
            onPick={(lat, lng) => {
              setDraft((d) => ({ ...d, centerLat: lat, centerLng: lng }));
            }}
          />
          {geofences.map((g) => (
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
              </Popup>
            </Circle>
          ))}
          <TacticalSitesLayer
            sites={tacticalSites}
            visibleGroupIds={visibleGroupIds}
            iconBlobs={iconBlobs}
          />
          {pickMode && draft.centerLat != null && (
            <Circle
              center={[draft.centerLat, draft.centerLng]}
              radius={Number(draft.radiusM) || 200}
              pathOptions={{
                color: '#9a7b2f',
                fillColor: '#9a7b2f',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          )}
          <CargoZoomGate>
            {(showCargo) =>
              visibleLocations.map((loc) => {
                const photo = markerPhoto(loc);
                const pInfo = presenceByUser[loc.userId];
                const status = resolvePresenceStatus({
                  presence: loc.presence || pInfo?.status,
                  focus: loc.focus || pInfo?.focus,
                  lastSeenAt: loc.lastSeenAt || pInfo?.lastSeenAt,
                  offlineRedMinutes,
                });
                const isLive = status === 'online' || status === 'service';
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
                      selected: false,
                      photoSrc: photo,
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
              })
            }
          </CargoZoomGate>
          {trackPolylines.map((tr) => (
            <Polyline
              key={tr.userId}
              positions={tr.positions}
              pathOptions={{ color: tr.color, weight: 4, opacity: 0.9 }}
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

      {maximized &&
        ptt &&
        createPortal(
          <div className="lt-ptt-float" role="group" aria-label="PTT en pantalla completa">
            <button
              type="button"
              className={`lt-ptt-float-btn${ptt.holding ? ' holding' : ''}`}
              disabled={!dispatchCtx.group || !ptt.livekitReady}
              onClick={(e) => {
                e.preventDefault();
                ptt.unlockAudio?.().catch(() => {});
                ptt.toggle();
              }}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={ptt.holding}
              title={ptt.holding ? 'Toca o Espacio para soltar' : 'Toca o Espacio para hablar'}
            >
              <span className="lt-ptt-float-label">{ptt.holding ? 'AL AIRE' : 'PTT'}</span>
              <span className="lt-ptt-float-hint">{dispatchCtx.group?.name || 'Sin canal'}</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
