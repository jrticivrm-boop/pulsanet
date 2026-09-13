import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import './command-center.css';
import { fetchLocations, fetchOverview, fetchUserTrack, fetchGroupMembers, fetchPanicEvents } from '../api';
import { openPeerSheet } from '../peerActions';
import { esMsg } from '../esMsg';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { socketAuth } from '../deviceId';
import {
  LOCATION_POLL_MS,
  TRACK_POLL_MS,
  gpsStatusLine,
  isFresh,
  mergeLocations,
  recordedAtLocal,
  recordedAtMs,
  upsertLocation,
} from './liveTiming.js';
import { isAbsurdGpsJump } from '../gpsQuality.js';
import { mapAvatarIcon } from './mapAvatarIcon.js';
import PresenceMapLegend, { countPresenceLegend } from './PresenceMapLegend.jsx';
import MapMaximizeButton from './MapMaximizeButton.jsx';
import { PRESENCE_LABELS, resolvePresenceStatus } from './presenceStatus.js';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import { CursorZoom, MapCursorFix, MapSizeFix, MapWorldFillMinZoom, SmoothMarker, smoothMapFocus, focusFromSearchParams, loadMapView, PersistMapView, CargoZoomGate } from './mapLeafletUtils.jsx';
import { sessionWireKey, unwrapDispatchPayload } from '../wireCrypto.js';
import { useMapAvatarPhotos } from './useMapAvatarPhotos.js';
import {
  MAP_TILE_LAYERS,
  MAP_FIT_PEOPLE_MAX_ZOOM,
  MAP_FOCUS_MAX_ZOOM,
  MAP_MAX_ZOOM,
  loadStoredMapLayer,
  mapWorldProps,
  storeMapLayer,
  tileLayerProps,
} from './mapTiles.js';
import { TacticalSitesLayer } from './TacticalSitesLayer.jsx';
import { useTacticalSites } from './useTacticalSites.jsx';
import IvRmStatesLayer, { ivRmStates } from './IvRmStatesLayer.jsx';
import HighlighterTrack from './HighlighterTrack.jsx';
import {
  enabledIvRmStates,
  isSurfaceEnabled,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';
import { useIsPhone } from '../useMediaQuery.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Centro aproximado IV R.M. (NL / Tamaulipas / SLP). */
const IV_RM_CENTER = [24.15, -99.55];
const MAP_VIEW_KEY = 'tacticalptx_map_view_track';
const SOCKET_URL = socketUrl();
const TRAIL_MAX = 180;

const LAYERS = MAP_TILE_LAYERS;

function samePoint(a, b, eps = 0.00001) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

function appendTrail(map, userId, lat, lng) {
  const next = { ...map };
  const prev = next[userId] || [];
  const point = [lat, lng];
  if (prev.length && samePoint(prev[prev.length - 1], point)) return map;
  next[userId] = [...prev, point].slice(-TRAIL_MAX);
  return next;
}

function FollowSelected({ target, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !target) return;
    map.panTo([target.lat, target.lng], { animate: true, duration: 0.55 });
  }, [map, enabled, target?.lat, target?.lng, target?.t]);
  return null;
}

/** Acerca suave al punto de pánico (sin arco agresivo de flyTo). */
function FlyToFocus({ target }) {
  const map = useMap();
  const doneKey = useRef('');
  const cancelAnim = useRef(null);

  useEffect(() => {
    if (!target) return;
    const key = `${target.lat},${target.lng},${target.zoom},${target.token || ''}`;
    if (doneKey.current === key) return;
    doneKey.current = key;

    const zoom = Number.isFinite(target.zoom) ? target.zoom : MAP_FOCUS_MAX_ZOOM;
    const lat = target.lat;
    const lng = target.lng;

    const start = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
      cancelAnim.current?.();
      cancelAnim.current = smoothMapFocus(
        map,
        { lat, lng, zoom },
        { durationMs: 2200 }
      );
    }, 320);

    return () => {
      clearTimeout(start);
      cancelAnim.current?.();
      cancelAnim.current = null;
    };
  }, [map, target?.lat, target?.lng, target?.zoom, target?.token]);

  return null;
}

function InvalidateOnLayout({ tick }) {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
    };
    run();
    const ids = [50, 120, 280].map((ms) => window.setTimeout(run, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
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

function FitPeople({ positions, locked, scopeKey }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
  }, [scopeKey]);
  useEffect(() => {
    if (locked || done.current || !positions?.length) return;
    done.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], MAP_FOCUS_MAX_ZOOM);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [56, 56], maxZoom: MAP_FIT_PEOPLE_MAX_ZOOM });
  }, [map, positions, locked, scopeKey]);
  return null;
}

/** Encuadre inicial a estados IV R.M. habilitados si aún no hay gente con GPS. */
function FitIvRmStates({ enabled, featureIds }) {
  const map = useMap();
  const done = useRef(false);
  const idsKey = Array.isArray(featureIds) ? featureIds.join(',') : '';
  useEffect(() => {
    if (!enabled || done.current || !ivRmStates?.features?.length) return;
    done.current = true;
    try {
      const idSet = idsKey ? new Set(idsKey.split(',')) : null;
      const features = (ivRmStates.features || []).filter((f) => {
        const id = f?.properties?.id;
        return id && (!idSet || idSet.has(id));
      });
      if (!features.length) {
        map.setView(IV_RM_CENTER, 7);
        return;
      }
      const layer = L.geoJSON({ type: 'FeatureCollection', features });
      const b = layer.getBounds();
      if (b?.isValid?.()) {
        map.fitBounds(b, { padding: [36, 36], maxZoom: 8 });
      } else {
        map.setView(IV_RM_CENTER, 7);
      }
    } catch {
      map.setView(IV_RM_CENTER, 7);
    }
  }, [map, enabled, idsKey]);
  return null;
}

export default function LiveTrackMap({ session, dispatchEmbed = null, embed = null }) {
  const dispatchCtx = dispatchEmbed || useOutletContext() || {};
  const embedRadio = embed === 'radio';
  const ptt = dispatchCtx.ptt;
  const scopeGroupIds = useMemo(() => {
    const ids = new Set();
    if (dispatchCtx.group?.id) ids.add(dispatchCtx.group.id);
    for (const id of dispatchCtx.listenIds || []) {
      if (id) ids.add(id);
    }
    return ids.size ? [...ids] : null;
  }, [dispatchCtx.group?.id, dispatchCtx.listenIds]);
  const scopeKey = scopeGroupIds?.join(',') || 'all';
  const scopeMemberIdsRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFocus = focusFromSearchParams(searchParams);
  const savedView = useMemo(
    () => (initialFocus ? null : loadMapView(MAP_VIEW_KEY)),
    // solo al montar / si hay foco por URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const isPhone = useIsPhone();
  const [locations, setLocations] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [offlineRedMinutes, setOfflineRedMinutes] = useState(15);
  const [selectedId, setSelectedId] = useState(() => initialFocus?.userId || '');
  const [follow, setFollow] = useState(true);
  const [locationPingBusy, setLocationPingBusy] = useState(false);
  const [locationPingHint, setLocationPingHint] = useState('');
  const [trails, setTrails] = useState({});
  const [historyTrack, setHistoryTrack] = useState([]);
  const [layer, setLayer] = useState(() => loadStoredMapLayer());
  useEffect(() => {
    storeMapLayer(layer);
  }, [layer]);
  const { sites: tacticalSites, visibleGroupIds, iconBlobs } = useTacticalSites(
    session.token
  );
  const [ivRmConfig] = useIvRmStatesConfig();
  const ivRmSurface = embedRadio ? 'radio' : 'seguimiento';
  const ivRmLegend = useMemo(() => {
    if (!isSurfaceEnabled(ivRmConfig, ivRmSurface)) return [];
    return enabledIvRmStates(ivRmConfig);
  }, [ivRmConfig, ivRmSurface]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [maximized, setMaximized] = useState(false);
  const [panicUserIds, setPanicUserIds] = useState(() => new Set());
  const panicIdToUserRef = useRef(new Map());
  const [trackScope, setTrackScope] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('tacticalptx_lt_sheet');
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch {
      /* ignore */
    }
    try {
      return !window.matchMedia('(max-width: 720px)').matches;
    } catch {
      return true;
    }
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Punto forzado desde alerta de pánico (coords del evento, no solo GPS en vivo). */
  const [focusPin, setFocusPin] = useState(() =>
    initialFocus
      ? {
          lat: initialFocus.lat,
          lng: initialFocus.lng,
          zoom: initialFocus.zoom,
          token: initialFocus.token,
          userId: initialFocus.userId,
        }
      : null
  );
  /** Evita que «Seguir» pelee con el acercamiento inicial. */
  const [focusLock, setFocusLock] = useState(() => Boolean(initialFocus));
  const pageRef = useRef(null);
  const appliedFocusKey = useRef(initialFocus?.key || '');
  const { markerPhoto, listPhoto } = useMapAvatarPhotos(locations, session.token);

  // Miembros de los canales seleccionados (filtra GPS en tiempo real).
  useEffect(() => {
    if (!scopeGroupIds?.length) {
      scopeMemberIdsRef.current = null;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const parts = await Promise.all(
          scopeGroupIds.map((gid) => fetchGroupMembers(session.token, gid))
        );
        if (cancelled) return;
        const ids = new Set();
        parts.forEach((data) => {
          (data.members || []).forEach((m) => ids.add(m.id));
        });
        scopeMemberIdsRef.current = ids;
        setSelectedId((cur) => (cur && ids.has(cur) ? cur : ''));
        setLocations((prev) => prev.filter((l) => ids.has(l.userId)));
        setTrails((prev) =>
          Object.fromEntries(Object.entries(prev).filter(([uid]) => ids.has(uid)))
        );
      } catch {
        /* reload aplica filtro API */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopeGroupIds, session.token]);

  // Deep-link desde «Ver en mapa» en alerta de pánico.
  useEffect(() => {
    const hasFocusQuery =
      searchParams.has('lat') ||
      searchParams.has('lng') ||
      searchParams.has('panic') ||
      searchParams.has('user') ||
      searchParams.has('t');
    if (!hasFocusQuery) return;

    const focus = focusFromSearchParams(searchParams);
    const clearQuery = () => {
      const next = new URLSearchParams(searchParams);
      ['lat', 'lng', 'zoom', 'user', 'panic', 't'].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    };

    // Coords inválidas (p. ej. 0,0): limpiar URL y no pintar pin.
    if (!focus) {
      clearQuery();
      return;
    }

    if (appliedFocusKey.current === focus.key) {
      clearQuery();
      return;
    }
    appliedFocusKey.current = focus.key;

    setFocusPin({
      lat: focus.lat,
      lng: focus.lng,
      zoom: focus.zoom,
      token: focus.token,
      userId: focus.userId,
    });
    setFocusLock(true);
    if (focus.userId) {
      setSelectedId(focus.userId);
      setFollow(true);
    }

    clearQuery();
    window.setTimeout(() => setFocusLock(false), 2500);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const reloadFailStreakRef = useRef(0);
  const reload = useCallback(async () => {
    try {
      const [loc, ov, panic] = await Promise.all([
        fetchLocations(session.token, { groupIds: scopeGroupIds || undefined }),
        fetchOverview(session.token),
        fetchPanicEvents(session.token, { status: 'active' }).catch(() => ({ events: [] })),
      ]);
      const list = loc.locations || [];
      if (loc.scope) setTrackScope(loc.scope);
      setLocations(list);
      setTrails((prev) => {
        const allowed = new Set(list.map((p) => p.userId));
        let next = Object.fromEntries(
          Object.entries(prev).filter(([uid]) => allowed.has(uid))
        );
        list.forEach((p) => {
          next = appendTrail(next, p.userId, Number(p.latitude), Number(p.longitude));
        });
        return next;
      });
      const ids = new Set();
      const channels = ov.overview?.channels || [];
      const scopedChannels = scopeGroupIds?.length
        ? channels.filter((c) => scopeGroupIds.includes(c.id))
        : channels;
      scopedChannels.forEach((c) => {
        (c.online || []).forEach((m) => ids.add(m.userId));
      });
      setOnlineIds(ids);
      setOfflineRedMinutes(
        loc.presenceOfflineRedMinutes || ov.overview?.presenceOfflineRedMinutes || 15
      );
      setPanicUserIds(
        (() => {
          const next = new Set();
          const idMap = new Map();
          (panic.events || []).forEach((e) => {
            if (e.userId) {
              next.add(e.userId);
              if (e.id) idMap.set(e.id, e.userId);
            }
          });
          panicIdToUserRef.current = idMap;
          return next;
        })()
      );
      reloadFailStreakRef.current = 0;
      setError('');
    } catch (e) {
      reloadFailStreakRef.current += 1;
      if (reloadFailStreakRef.current >= 3) setError(e.message);
    }
  }, [session.token, scopeGroupIds]);

  // Lista de ubicaciones: mismo ritmo que el latido GPS de la app (~5 s).
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled && !document.hidden) reload();
    };
    tick();
    const t = setInterval(tick, LOCATION_POLL_MS);
    const onVis = () => {
      if (!document.hidden) reload();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reload]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: socketAuth(session.token),
      ...socketIoOptions,
    });
    const join = () => {
      setLive(true);
      socket.emit('dispatch:join');
    };
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('disconnect', () => setLive(false));
    socket.on('dispatch:location', (payload) => {
      void (async () => {
        const loc = await unwrapDispatchPayload(payload, sessionWireKey(session));
        if (!loc?.userId) return;
        const allowed = scopeMemberIdsRef.current;
        if (allowed && !allowed.has(loc.userId)) return;
        let accepted = true;
        setLocations((prev) => {
          const old = prev.find((l) => l.userId === loc.userId);
          if (
            old &&
            isAbsurdGpsJump(
              old,
              {
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
                accuracyM: loc.accuracyM,
                recordedAt: loc.recordedAt || new Date().toISOString(),
              },
              recordedAtMs
            )
          ) {
            accepted = false;
            return prev;
          }
          return upsertLocation(prev, loc);
        });
        if (accepted) {
          setTrails((prev) =>
            appendTrail(prev, loc.userId, Number(loc.latitude), Number(loc.longitude))
          );
        }
      })();
    });
    socket.on('dispatch:presence', () => reload());
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
          // ¿otro pánico activo del mismo usuario?
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
  }, [session.token, session.crypto?.wireKey, reload]);

  // Rastro del seleccionado: se refresca solo cada ~5 s (no solo al elegir).
  useEffect(() => {
    if (!selectedId) {
      setHistoryTrack([]);
      return undefined;
    }
    let cancelled = false;
    const loadTrack = () => {
      if (cancelled || document.hidden) return;
      fetchUserTrack(session.token, selectedId, 2)
        .then((data) => {
          if (cancelled) return;
          const pts = (data.points || []).map((p) => [p.latitude, p.longitude]);
          setHistoryTrack(pts);
          setTrails((prev) => {
            const liveTrail = prev[selectedId] || [];
            const merged = [...pts, ...liveTrail].slice(-TRAIL_MAX);
            return { ...prev, [selectedId]: merged };
          });
        })
        .catch(() => {
          if (!cancelled) setHistoryTrack([]);
        });
    };
    loadTrack();
    const t = setInterval(loadTrack, TRACK_POLL_MS);
    const onVis = () => {
      if (!document.hidden) loadTrack();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session.token, selectedId]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...locations]
      .filter((l) => !q || (l.displayName || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const af = isFresh(a.recordedAt, now) ? 0 : 1;
        const bf = isFresh(b.recordedAt, now) ? 0 : 1;
        if (af !== bf) return af - bf;
        return (a.displayName || '').localeCompare(b.displayName || '', 'es');
      });
  }, [locations, query, now]);

  const liveCount = useMemo(
    () => people.filter((p) => isFresh(p.recordedAt, now)).length,
    [people, now]
  );

  const presenceLegendCounts = useMemo(
    () => countPresenceLegend(people, panicUserIds, offlineRedMinutes),
    [people, panicUserIds, offlineRedMinutes]
  );

  const positions = useMemo(
    () => people.map((p) => [p.latitude, p.longitude]),
    [people]
  );

  const selected = people.find((p) => p.userId === selectedId) || null;
  const selectedTrail = selectedId ? trails[selectedId] || historyTrack : [];

  useEffect(() => {
    setLocationPingHint('');
  }, [selectedId]);

  const trackScopeLabel = useMemo(() => {
    if (scopeGroupIds?.length && dispatchCtx.groups?.length) {
      const names = dispatchCtx.groups
        .filter((g) => scopeGroupIds.includes(g.id))
        .map((g) => g.name);
      if (names.length) return names.join(' · ');
    }
    if (!trackScope) return '';
    if (trackScope.orgWide || trackScope.level === 'region') return 'Región (todos)';
    if (trackScope.level === 'zone') return 'Zona / C.G.';
    if (trackScope.level === 'unit') return 'Unidad';
    return '';
  }, [scopeGroupIds, dispatchCtx.groups, trackScope]);
  const tile = LAYERS[layer] || LAYERS.natural;

  const followTarget = selected
    ? {
        lat: Number(selected.latitude),
        lng: Number(selected.longitude),
        t: selected.recordedAt,
      }
    : null;

  function focusPerson(p) {
    setSelectedId(p.userId);
    setFollow(true);
    setFocusPin(null);
  }

  function toggleSheet() {
    setSheetOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tacticalptx_lt_sheet', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      ref={pageRef}
      className={`lt-page${maximized ? ' lt-page--maximized' : ''}${sheetOpen ? '' : ' lt-page--sheet-collapsed'}${isPhone ? ' lt-page--phone' : ''}${embedRadio ? ' lt-page--embed-radio' : ''}`}
      data-esc-close={maximized ? '' : undefined}
    >
      <aside className={`lt-sheet${sheetOpen ? '' : ' is-collapsed'}`} aria-label="Lista de operadores">
        <header className="lt-sheet-head">
          <div className="lt-sheet-head-row">
            <h1>Seguimiento en vivo</h1>
            <button
              type="button"
              className="lt-sheet-toggle"
              onClick={toggleSheet}
              aria-expanded={sheetOpen}
              aria-controls="lt-sheet-body"
              title={sheetOpen ? 'Ocultar lista' : 'Mostrar lista'}
            >
              <span className="lt-sheet-toggle-ico" aria-hidden="true">
                {sheetOpen ? '◂' : '▸'}
              </span>
              <span className="lt-sheet-toggle-label">
                {sheetOpen ? 'Ocultar' : 'Lista'}
              </span>
            </button>
          </div>
          {sheetOpen ? (
            <div className="lt-kpi-row" role="status" aria-live="polite">
              <span className={`lt-kpi${liveCount > 0 ? ' lt-kpi--live' : ''}`}>
                {liveCount} en vivo
              </span>
              <span className="lt-kpi">{people.length} con GPS</span>
              <span className="lt-kpi">cada {LOCATION_POLL_MS / 1000} s</span>
              {trackScopeLabel ? (
                <span className="lt-kpi lt-kpi--scope">{trackScopeLabel}</span>
              ) : null}
              <span className={`lt-kpi lt-kpi--conn${live ? ' on' : ''}`}>
                {live ? 'Tiempo real' : 'Reconectando'}
              </span>
            </div>
          ) : (
            <div className="lt-sheet-collapsed-meta" role="status">
              <span className={`lt-kpi${liveCount > 0 ? ' lt-kpi--live' : ''}`}>
                {liveCount} en vivo
              </span>
              <span className="lt-kpi">{people.length} GPS</span>
            </div>
          )}
        </header>

        <div
          id="lt-sheet-body"
          className="lt-sheet-body"
          hidden={!sheetOpen}
          aria-hidden={!sheetOpen}
        >
          <div className="lt-tools">
            <input
              type="search"
              placeholder="Buscar operador…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar operador"
            />
          </div>

          {error && <p className="lt-error">{error}</p>}

          <ul className="lt-people">
            {people.length === 0 && (
              <li className="lt-empty">
                Nadie comparte GPS aún. Abre la app móvil o Radio web con ubicación activa.
              </li>
            )}
            {people.map((p) => {
              const fresh = isFresh(p.recordedAt, now);
              const status = resolvePresenceStatus({
                presence: p.presence,
                focus: p.focus,
                lastSeenAt: p.lastSeenAt,
                recordedAt: p.recordedAt,
                offlineRedMinutes,
                now,
              });
              const photo = listPhoto(p);
              return (
                <li key={p.userId}>
                  <button
                    type="button"
                    className={`lt-person${selectedId === p.userId ? ' selected' : ''}`}
                    onClick={() => focusPerson(p)}
                  >
                    <span className={`lt-avatar${fresh ? ' live' : ''}`}>
                      {photo ? (
                        <img src={photo} alt="" />
                      ) : (
                        (p.displayName || '?').charAt(0).toUpperCase()
                      )}
                      {fresh ? <i className="lt-avatar-pulse" aria-hidden="true" /> : null}
                    </span>
                    <span className="lt-person-meta">
                      <strong>{p.displayName}</strong>
                      <em>
                        {gpsStatusLine(p.recordedAt, now)}
                        {` · ${PRESENCE_LABELS[status] || status}`}
                        {p.accuracyM != null ? ` · ±${Math.round(p.accuracyM)} m` : ''}
                      </em>
                    </span>
                    <span
                      className={`lt-status-pill${
                        status === 'online' || status === 'service'
                          ? ' on'
                          : status === 'stale'
                            ? ' stale'
                            : ' off'
                      }`}
                    >
                      {status === 'online' || status === 'service'
                        ? 'En línea'
                        : status === 'stale'
                          ? 'Fuera de línea'
                          : 'Desconectado'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <div className="lt-detail">
              <div className="lt-detail-head">
                <strong>{selected.displayName}</strong>
                <label className="lt-follow">
                  <input
                    type="checkbox"
                    checked={follow}
                    onChange={(e) => setFollow(e.target.checked)}
                  />
                  Seguir
                </label>
              </div>
              <p>
                <MapCoordsLink lat={selected.latitude} lng={selected.longitude} />
              </p>
              <p>
                {gpsStatusLine(selected.recordedAt, now)}
                {selectedTrail.length > 1 ? ` (${selectedTrail.length} puntos)` : ''}
              </p>
              <button
                type="button"
                className="cc-btn primary"
                style={{ marginTop: '0.65rem', width: '100%' }}
                onClick={() =>
                  openPeerSheet({
                    id: selected.userId,
                    displayName: selected.displayName,
                  })
                }
              >
                Contactar
              </button>
              {locationPingHint ? (
                <p className="lt-detail-hint" style={{ marginTop: '0.45rem', fontSize: '0.85rem' }}>
                  {locationPingHint}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      <div className="lt-map-panel">
        <div className="lt-map">
          <div className="lt-map-chrome">
            {isPhone ? (
              <button
                type="button"
                className={`lt-filters-btn${filtersOpen ? ' active' : ''}`}
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                Capas
              </button>
            ) : null}
            <PresenceMapLegend overlay counts={presenceLegendCounts} />
            <div
              className={`lt-layers${isPhone && !filtersOpen ? ' is-drawer-closed' : ''}`}
              role="group"
              aria-label="Estilo de mapa"
              hidden={isPhone && !filtersOpen}
            >
              {Object.entries(LAYERS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  className={layer === key ? 'active' : undefined}
                  onClick={() => {
                    setLayer(key);
                    if (isPhone) setFiltersOpen(false);
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <MapMaximizeButton maximized={maximized} onClick={toggleMaximize} />
            {ivRmLegend.length > 0 ? (
              <div className="lt-state-legend" aria-label="Estados IV R.M.">
                {ivRmLegend.map((s) => (
                  <span key={s.id} className="lt-state-legend-item">
                    <i style={{ background: s.color }} /> {s.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <MapContainer
            className="lt-map-inner"
            center={
              initialFocus
                ? [initialFocus.lat, initialFocus.lng]
                : savedView?.center || IV_RM_CENTER
            }
            zoom={initialFocus?.zoom ?? savedView?.zoom ?? 7}
            maxZoom={MAP_MAX_ZOOM}
            {...mapWorldProps()}
            scrollWheelZoom={false}
            doubleClickZoom
            zoomSnap={0.25}
            zoomDelta={1}
          >
            <TileLayer key={layer} {...tileLayerProps(tile)} />
            <ZoomControl position="bottomright" />
            <IvRmStatesLayer surface={ivRmSurface} />
            <CursorZoom />
            <MapCursorFix />
            <InvalidateOnLayout tick={(maximized ? 1 : 0) + (sheetOpen ? 0 : 2)} />
            <MapSizeFix />
            <MapWorldFillMinZoom />
            <PersistMapView storageKey={MAP_VIEW_KEY} />
            <TacticalSitesLayer
              sites={tacticalSites}
              visibleGroupIds={visibleGroupIds}
              iconBlobs={iconBlobs}
            />
          <FlyToFocus target={focusPin} />
          <FollowSelected
            target={followTarget}
            enabled={Boolean(selectedId && follow && !focusLock)}
          />
          {!selectedId && !focusPin && !savedView && people.length > 0 && (
            <FitPeople
              positions={positions}
              locked={Boolean(selectedId || focusPin)}
              scopeKey={scopeKey}
            />
          )}
          {people.length === 0 && !focusPin && !savedView && (
            <FitIvRmStates enabled featureIds={ivRmLegend.map((s) => s.id)} />
          )}
          {focusPin ? (
            <CircleMarker
              center={[focusPin.lat, focusPin.lng]}
              radius={14}
              pathOptions={{
                color: '#b42318',
                fillColor: '#ff4d3a',
                fillOpacity: 0.85,
                weight: 3,
              }}
            >
              <Popup>
                <strong>Punto de pánico</strong>
                <br />
                <MapCoordsLink lat={focusPin.lat} lng={focusPin.lng} />
              </Popup>
            </CircleMarker>
          ) : null}
          {focusPin ? (
            <Circle
              center={[focusPin.lat, focusPin.lng]}
              radius={45}
              interactive={false}
              pathOptions={{
                color: '#b42318',
                fillColor: '#b42318',
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          ) : null}
          <CargoZoomGate>
            {(showCargo) =>
              people.map((p) => {
                const selected = p.userId === selectedId;
                const photo = markerPhoto(p);
                const inPanic = panicUserIds.has(p.userId);
                const status = resolvePresenceStatus({
                  presence: p.presence,
                  focus: p.focus,
                  lastSeenAt: p.lastSeenAt,
                  recordedAt: p.recordedAt,
                  offlineRedMinutes,
                  now,
                });
                const isLive = status === 'online' || status === 'service';
                return (
                  <SmoothMarker
                    key={p.userId}
                    position={[Number(p.latitude), Number(p.longitude)]}
                    zIndexOffset={selected ? 900 : inPanic ? 400 : isLive ? 100 : 0}
                    icon={mapAvatarIcon({
                      name: p.displayName,
                      cargo: p.cargo,
                      showCargo,
                      presence: status,
                      selected,
                      photoSrc: photo,
                      panic: inPanic,
                    })}
                    eventHandlers={{ click: () => focusPerson(p) }}
                  >
                    <Popup>
                      <strong>{p.displayName}</strong>
                      <br />
                      {PRESENCE_LABELS[status] || status}
                      <br />
                      {gpsStatusLine(p.recordedAt, now)}
                      {recordedAtLocal(p.recordedAt) ? (
                        <>
                          <br />
                          <span style={{ opacity: 0.75, fontSize: 12 }}>
                            {recordedAtLocal(p.recordedAt)}
                          </span>
                        </>
                      ) : null}
                      <br />
                      <MapCoordsLink lat={p.latitude} lng={p.longitude} />
                    </Popup>
                  </SmoothMarker>
                );
              })
            }
          </CargoZoomGate>
          {people.map((p) =>
            p.accuracyM > 0 ? (
              <Circle
                key={`acc-${p.userId}`}
                center={[Number(p.latitude), Number(p.longitude)]}
                radius={Math.min(Math.max(Number(p.accuracyM) || 20, 14), 140)}
                interactive={false}
                pathOptions={{
                  color: isFresh(p.recordedAt, now) ? '#1f5a2e' : '#5c6756',
                  fillColor: isFresh(p.recordedAt, now) ? '#1f5a2e' : '#5c6756',
                  fillOpacity: isFresh(p.recordedAt, now) ? 0.14 : 0.08,
                  weight: 1,
                }}
              />
            ) : null
          )}
          {selectedTrail.length > 1 && <HighlighterTrack points={selectedTrail} />}
        </MapContainer>
        </div>
      </div>

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
              <span className="lt-ptt-float-hint">
                {dispatchCtx.group?.name || 'Sin canal'}
              </span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
