import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Popup,
  Circle,
  Polyline,
  ZoomControl,
  useMap,
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
  fetchRecordings,
  fetchPanicEvents,
  startPrivateCall,
} from '../api';import RemoteMonitorConference from './RemoteMonitorConference';
import GroupVideoPanel from '../GroupVideoPanel';
import { startVideoCall, startVoiceCall } from '../peerActions';
import { esMsg } from '../esMsg';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { unlockPanicAudio } from '../panicSound';
import { unlockMediaAudio } from '../unlockMediaAudio';
import { useIsPhone, useIsTabletDown } from '../useMediaQuery.js';
import {
  LOCATION_POLL_MS,
  TRACK_POLL_MS,
  mergeLocations,
  upsertLocation,
  gpsStatusLine,
  recordedAtLocal,
} from './liveTiming.js';
import { sessionWireKey, unwrapDispatchPayload } from '../wireCrypto.js';
import { mapAvatarIcon } from './mapAvatarIcon.js';
import PresenceMapLegend, { countPresenceLegend } from './PresenceMapLegend.jsx';
import { PRESENCE_LABELS, resolvePresenceStatus } from './presenceStatus.js';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import { CursorZoom, MapCursorFix, MapSizeFix, MapWorldFillMinZoom, SmoothMarker, CargoZoomGate } from './mapLeafletUtils.jsx';
import { useMapAvatarPhotos } from './useMapAvatarPhotos.js';
import {
  MAP_TILE_LAYERS,
  MAP_MAX_ZOOM,
  loadStoredMapLayer,
  mapWorldProps,
  tileLayerProps,
} from './mapTiles.js';
import { TacticalSitesLayer } from './TacticalSitesLayer.jsx';
import { useTacticalSites } from './useTacticalSites.jsx';
import RecordingPlayer from './RecordingPlayer.jsx';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GDL = [20.6736, -103.344];
const SOCKET_URL = socketUrl();
const MAX_EVENTS = 40;

const KIND_LABEL = {
  radio: 'Radio',
  zone: 'Zona',
  presence: 'Presencia',
};

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [36, 36] });
  }, [map, positions]);
  return null;
}

function CenterOn({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], 15, { animate: true });
  }, [map, target]);
  return null;
}

function pushEvent(setEvents, evt) {
  setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
}

/**
 * @deprecated Sustituido por Consola de Operaciones (DispatchMap en /despacho).
 * Conservado para referencia / restauración desde Soporte/Respaldos/consola_ops_*.
 */
export default function CommandCenter({ session }) {
  const isPhone = useIsPhone();
  const isTabletDown = useIsTabletDown();
  const [overview, setOverview] = useState(null);
  const [locations, setLocations] = useState([]);
  const [offlineRedMinutes, setOfflineRedMinutes] = useState(15);
  const { markerPhoto, listPhoto } = useMapAvatarPhotos(locations, session.token);
  const [geofences, setGeofences] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [trackUserId, setTrackUserId] = useState('');
  const [trackPoints, setTrackPoints] = useState([]);
  const [centerTarget, setCenterTarget] = useState(null);
  const [filter, setFilter] = useState('all'); // all | radio | zone | panic
  const [recordings, setRecordings] = useState([]);
  const [activePanics, setActivePanics] = useState([]);
  const [remoteMonitors, setRemoteMonitors] = useState([]);
  const [groupVideo, setGroupVideo] = useState(null);
  const [groupVideoLive, setGroupVideoLive] = useState({});
  /** Tablet/phone: una superficie primaria (mapa | actividad). */
  const [ccSurface, setCcSurface] = useState('map');
  const [mapLayer] = useState(() => loadStoredMapLayer());
  const mapTile = MAP_TILE_LAYERS[mapLayer] || MAP_TILE_LAYERS.natural;
  const { sites: tacticalSites, visibleGroupIds, iconBlobs, layerBar: tacticalLayerBar } = useTacticalSites(
    session.token
  );

  const panicUserIds = useMemo(
    () => new Set((activePanics || []).map((p) => p.userId).filter(Boolean)),
    [activePanics]
  );

  const presenceLegendCounts = useMemo(
    () => countPresenceLegend(locations, panicUserIds, offlineRedMinutes),
    [locations, panicUserIds, offlineRedMinutes]
  );

  const channelNameById = useMemo(() => {
    const m = new Map();
    (overview?.channels || []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [overview]);

  const channelNameRef = useRef(channelNameById);
  channelNameRef.current = channelNameById;

  const openGroupVideo = useCallback(
    async (groupId, groupName) => {
      if (!groupId) return;
      try {
        await warmUpVideoCallMedia();
        setGroupVideo({ groupId, groupName: groupName || 'Grupo' });
      } catch (e) {
        window.alert(esMsg(e.message || e, 'No se pudo abrir la transmisión grupal'));
      }
    },
    []
  );

  const reload = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchOverview(session.token),
      fetchLocations(session.token),
      fetchGeofences(session.token),
      fetchRecordings(session.token, { hours: 24 }),
      fetchPanicEvents(session.token, { status: 'active' }),
    ]);
    const [ov, loc, gf, rec, panic] = results;
    const errors = [];
    if (ov.status === 'fulfilled') setOverview(ov.value?.overview);
    else errors.push(ov.reason?.message || 'No se pudo cargar canales');
    if (loc.status === 'fulfilled') {
      setLocations((prev) => mergeLocations(prev, loc.value?.locations || []));
      if (loc.value?.presenceOfflineRedMinutes) {
        setOfflineRedMinutes(loc.value.presenceOfflineRedMinutes);
      } else if (ov.status === 'fulfilled' && ov.value?.overview?.presenceOfflineRedMinutes) {
        setOfflineRedMinutes(ov.value.overview.presenceOfflineRedMinutes);
      }
    } else errors.push(loc.reason?.message || 'No se pudo cargar GPS');
    if (gf.status === 'fulfilled') {
      setGeofences((gf.value?.geofences || []).filter((g) => g.isActive !== false));
    }
    if (rec.status === 'fulfilled') setRecordings(rec.value?.recordings || []);
    if (panic.status === 'fulfilled') setActivePanics(panic.value?.events || []);
    else setActivePanics([]);
    setError(errors[0] || '');
  }, [session.token]);

  useEffect(() => {
    const unlock = () => {
      unlockMediaAudio().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    reload();
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });

    socket.on('connect', () => {
      setLive(true);
      socket.emit('dispatch:join');
      unlockPanicAudio().catch(() => {});
    });
    socket.on('reconnect', () => {
      setLive(true);
      socket.emit('dispatch:join');
    });
    socket.on('disconnect', () => setLive(false));

    socket.on('dispatch:speaker', (p) => {
      const canal = channelNameRef.current.get(p.groupId) || 'canal';
      pushEvent(setEvents, {
        id: `ptt-${p.groupId}-${p.userId}-${Date.now()}`,
        kind: 'radio',
        title: `${p.displayName || 'Operador'} está al aire`,
        subtitle: `Canal «${canal}»`,
        userId: p.userId,
        channel: canal,
        at: new Date().toISOString(),
      });
      reload();
    });

    socket.on('dispatch:released', (p) => {
      const canal = channelNameRef.current.get(p.groupId) || 'canal';
      pushEvent(setEvents, {
        id: `rel-${p.groupId || ''}-${Date.now()}`,
        kind: 'radio',
        title: 'Canal libre',
        subtitle: `Terminó transmisión en «${canal}»`,
        channel: canal,
        at: new Date().toISOString(),
      });
      reload();
    });

    socket.on('dispatch:presence', () => reload());

    // GPS actualiza el mapa, NO satura la lista de actividad
    socket.on('dispatch:location', (payload) => {
      void (async () => {
        const loc = await unwrapDispatchPayload(payload, sessionWireKey(session));
        if (!loc?.userId) return;
        setLocations((prev) => upsertLocation(prev, loc));
      })();
    });

    socket.on('dispatch:geofence', (payload) => {
      void (async () => {
        const g = await unwrapDispatchPayload(payload, sessionWireKey(session));
        if (!g) return;
        const entra = g.event === 'enter';
        pushEvent(setEvents, {
          id: `geo-${g.geofenceId}-${g.userId}-${g.at}`,
          kind: 'zone',
          title: entra
            ? `${g.displayName || 'Operador'} entró a zona`
            : `${g.displayName || 'Operador'} salió de zona`,
          subtitle: `«${g.name}»`,
          userId: g.userId,
          lat: g.latitude,
          lng: g.longitude,
          at: g.at || new Date().toISOString(),
        });
      })();
    });

    socket.on('dispatch:panic', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
        // Si viene sealed y falla el unwrap, no usar raw (evitar coords/texto en claro).
        if (!payload?.id) return;
        // Sirena + modal: DispatchPanicHost (layout). Aquí solo feed/KPI.
        setActivePanics((prev) => {
          if (prev.some((p) => p.id === payload.id)) return prev;
          return [payload, ...prev];
        });
        pushEvent(setEvents, {
          id: `panic-${payload.id}`,
          kind: 'panic',
          title: `🚨 PÁNICO — ${payload.displayName || 'Operador'}`,
          subtitle: `Canal «${payload.groupName || '—'}»`,
          userId: payload.userId,
          lat: payload.latitude,
          lng: payload.longitude,
          panicId: payload.id,
          at: payload.createdAt || new Date().toISOString(),
        });
        if (payload.latitude != null && payload.longitude != null) {
          setCenterTarget({ lat: payload.latitude, lng: payload.longitude });
          setSelected({
            id: payload.userId,
            kind: 'panic',
            title: payload.displayName,
            subtitle: payload.groupName,
            userId: payload.userId,
            lat: payload.latitude,
            lng: payload.longitude,
            at: payload.createdAt,
          });
        }
      })();
    });

    socket.on('dispatch:panic_update', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
        if (!payload?.id) return;
        // acked por otro puesto/dispositivo: actualizar datos, no cortar sirena aquí
        if (payload.status === 'acked') {
          setActivePanics((prev) =>
            prev.map((p) => (p.id === payload.id ? { ...p, ...payload } : p))
          );
          pushEvent(setEvents, {
            id: `panic-upd-${payload.id}-${payload.status}`,
            kind: 'panic',
            title: `Pánico enterado: ${payload.displayName || 'Operador'}`,
            subtitle: `Canal «${payload.groupName || '—'}»`,
            at: new Date().toISOString(),
          });
          return;
        }
        setActivePanics((prev) => {
          if (payload.status === 'active') {
            return prev.map((p) => (p.id === payload.id ? payload : p));
          }
          return prev.filter((p) => p.id !== payload.id);
        });
        pushEvent(setEvents, {
          id: `panic-upd-${payload.id}-${payload.status}`,
          kind: 'panic',
          title: `Pánico ${payload.status}: ${payload.displayName || 'Operador'}`,
          subtitle: `Canal «${payload.groupName || '—'}»`,
          userId: payload.userId,
          at: new Date().toISOString(),
        });
      })();
    });

    socket.on('dispatch:recording', (rec) => {
      setRecordings((prev) => [rec, ...prev.filter((r) => r.id !== rec.id)].slice(0, 100));
      pushEvent(setEvents, {
        id: `rec-${rec.id}`,
        kind: 'radio',
        title: `Grabación de ${rec.displayName || 'operador'}`,
        subtitle: rec.groupName ? `Canal «${rec.groupName}»` : 'PTT',
        userId: rec.userId,
        channel: rec.groupName,
        at: rec.createdAt || new Date().toISOString(),
        recordingId: rec.id,
      });
    });

    socket.on('group:video_started', (payload) => {
      const gid = payload?.groupId;
      if (gid) setGroupVideoLive((prev) => ({ ...prev, [gid]: true }));
    });
    socket.on('group:video_ended', (payload) => {
      const gid = payload?.groupId;
      if (!gid) return;
      setGroupVideoLive((prev) => {
        const next = { ...prev };
        delete next[gid];
        return next;
      });
      setGroupVideo((cur) => (cur?.groupId === gid ? null : cur));
    });

    const t = setInterval(() => {
      if (!document.hidden) reload();
    }, 15000);
    const locPoll = setInterval(() => {
      if (document.hidden) return;
      fetchLocations(session.token)
        .then((data) => {
          setLocations((prev) => mergeLocations(prev, data.locations || []));
        })
        .catch(() => {});
    }, LOCATION_POLL_MS);
    const onVis = () => {
      if (!document.hidden) reload();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      clearInterval(locPoll);
      document.removeEventListener('visibilitychange', onVis);
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, session.crypto?.wireKey, reload]);

  useEffect(() => {
    if (!trackUserId) {
      setTrackPoints([]);
      return undefined;
    }
    let cancelled = false;
    const loadTrack = () => {
      if (cancelled || document.hidden) return;
      fetchUserTrack(session.token, trackUserId, 8)
        .then((data) => {
          if (!cancelled) setTrackPoints(data.points || []);
        })
        .catch(() => {});
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
  }, [session.token, trackUserId]);

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

  const locByUser = useMemo(() => {
    const m = new Map();
    locations.forEach((l) => m.set(l.userId, l));
    return m;
  }, [locations]);

  const polyline = useMemo(
    () => trackPoints.map((p) => [p.latitude, p.longitude]),
    [trackPoints]
  );

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.kind === filter);
  }, [events, filter]);

  function selectPerson({ userId, name, channel, at, kind, title, subtitle, lat, lng, id }) {
    const loc = userId ? locByUser.get(userId) : null;
    setSelected({
      id: id || `sel-${userId || name}`,
      kind: kind || 'presence',
      title: title || name,
      subtitle: subtitle || (channel ? `Canal «${channel}»` : 'Operador'),
      userId,
      channel,
      lat: lat ?? loc?.latitude,
      lng: lng ?? loc?.longitude,
      lastGps: loc?.recordedAt,
      at: at || new Date().toISOString(),
    });
  }

  function centerSelected() {
    if (selected?.lat == null || selected?.lng == null) return;
    setCenterTarget({ lat: selected.lat, lng: selected.lng, t: Date.now() });
  }

  async function stackRemoteCamera(peer) {
    const userId = peer?.id || peer?.userId;
    const name = peer?.displayName || peer?.name || selected?.title || 'Usuario';
    if (!userId) return;
    if (remoteMonitors.some((m) => m.peerId === userId)) return;
    try {
      const data = await startPrivateCall(session.token, userId, {
        mode: 'video',
        intent: 'remote_camera',
      });
      const callPayload = {
        callId: data.call?.callId,
        peerId: userId,
        peerName: name,
        token: data.token,
        authToken: session.token,
        url: data.url,
        e2eeKey: data.e2eeKey,
        e2ee: Boolean(data.e2ee),
        role: 'caller',
        mode: 'video',
        intent: 'remote_camera',
      };
      setRemoteMonitors((list) => {
        const next = [...list, callPayload];
        if (isPhone && next.length > 2) return next.slice(-2);
        return next;
      });
    } catch (e) {
      setError(esMsg(e.message || e, 'No se pudo iniciar la llamada'));
    }
  }

  async function pingSelectedLocation() {
    const userId = selected?.userId;
    if (!userId || locationPingBusy) return;
    setLocationPingBusy(true);
    setLocationPingHint('');
    setError('');
    try {
      const res = await requestLocationPing(session.token, userId);
      const fcm = res?.fcmSent ?? 0;
      setLocationPingHint(
        fcm > 0
          ? 'Ping enviado (socket + push). Esperando GPS…'
          : 'Ping por socket enviado. Si el teléfono está apagado, puede tardar o no llegar.'
      );
    } catch (e) {
      setError(esMsg(e.message || e, 'No se pudo pedir la ubicación'));
      setLocationPingHint('');
    } finally {
      setLocationPingBusy(false);
    }
  }

  function startPersonCall(mode = 'call', { intent } = {}) {
    const userId = selected?.userId;
    const name = selected?.title || 'Usuario';
    if (!userId) return;
    const peer = { id: userId, displayName: name };
    if (intent === 'remote_camera') {
      if (remoteMonitors.some((m) => m.peerId === userId)) return;
      void stackRemoteCamera(peer);
      return;
    }
    if (mode === 'video' && remoteMonitors.some((m) => m.peerId === userId)) {
      setError('Ese dispositivo ya está en Ver cámara. Cuélgalo antes de videollamada.');
      return;
    }
    if (mode === 'video') startVideoCall(peer);
    else startVoiceCall(peer);
  }

  useEffect(() => {
    const onRemote = (e) => {
      const peer = e.detail?.peer;
      if (!peer?.id) return;
      e.detail.handled = true;
      void stackRemoteCamera(peer);
    };
    window.addEventListener('tacticalptx:dispatch-remote-camera', onRemote);
    return () => window.removeEventListener('tacticalptx:dispatch-remote-camera', onRemote);
    // stackRemoteCamera cierra sobre remoteMonitors/session actuales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, remoteMonitors.length]);

  useEffect(() => {
    const token = session?.token;
    if (!token) return undefined;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token } });
    socket.on('call:ended', ({ callId }) => {
      if (!callId) return;
      setRemoteMonitors((list) => list.filter((m) => String(m.callId) !== String(callId)));
    });
    return () => socket.disconnect();
  }, [session.token]);

  return (
    <div className="cc-workspace">
      <div className="cc-kpi">
        <div className="cc-kpi-item">
          <strong>{overview?.onlineCount ?? '—'}</strong>
          <span>En línea</span>
        </div>
        <div className={`cc-kpi-item${speakingNow.length ? ' hot' : ''}`}>
          <strong>{speakingNow.length}</strong>
          <span>Al aire ahora</span>
        </div>
        <div className="cc-kpi-item">
          <strong>{overview?.groupsCount ?? '—'}</strong>
          <span>Canales</span>
        </div>
        <div className="cc-kpi-item">
          <strong>{locations.length}</strong>
          <span>Con GPS</span>
        </div>
        <div className="cc-kpi-item">
          <strong>{geofences.length}</strong>
          <span>Geocercas</span>
        </div>
        <div className={`cc-kpi-item${activePanics.length ? ' hot panic' : ''}`}>
          <strong>{activePanics.length}</strong>
          <span>Alertas activas</span>
        </div>
        <div className="cc-kpi-item">
          <strong>{recordings.length}</strong>
          <span>Grabaciones 24h</span>
        </div>
        <div className="cc-kpi-status">
          <span className={live ? 'cc-pill on' : 'cc-pill off'}>
            {live ? 'Conexión en vivo' : 'Reconectando…'}
          </span>
          {error && <span className="cc-pill err">{error}</span>}
        </div>
      </div>

      {speakingNow.length > 0 && (
        <div className="cc-air-banner" role="status">
          {speakingNow.map((s) => (
            <button
              key={s.channelId}
              type="button"
              onClick={() =>
                selectPerson({
                  userId: s.userId,
                  name: s.name,
                  channel: s.channel,
                  kind: 'radio',
                  title: `${s.name} está al aire`,
                  subtitle: `Canal «${s.channel}»`,
                })
              }
            >
              <em>AL AIRE</em> {s.name} · {s.channel}
            </button>
          ))}
        </div>
      )}

      {remoteMonitors.length > 0 && (
        <RemoteMonitorConference
          monitors={remoteMonitors}
          sessionToken={session.token}
          onHangupMonitor={(mon) => {
            setRemoteMonitors((list) => list.filter((m) => String(m.callId) !== String(mon.callId)));
          }}
        />
      )}

      {groupVideo && (
        <GroupVideoPanel
          token={session.token}
          groupId={groupVideo.groupId}
          groupName={groupVideo.groupName}
          layout="console"
          onClose={() => setGroupVideo(null)}
          onRemoteEnded={() => setGroupVideo(null)}
        />
      )}

      <div
        className={[
          'cc-workspace-grid',
          remoteMonitors.length > 0 || groupVideo ? 'with-video' : '',
          isTabletDown ? 'cc-workspace-grid--narrow' : '',
          isTabletDown ? `is-surface-${ccSurface}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
      {isTabletDown && (
        <div className="cc-surface-tabs" role="tablist" aria-label="Vista principal">
          <button
            type="button"
            role="tab"
            aria-selected={ccSurface === 'map'}
            className={`cc-surface-tab${ccSurface === 'map' ? ' active' : ''}`}
            onClick={() => setCcSurface('map')}
          >
            Mapa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ccSurface === 'activity'}
            className={`cc-surface-tab${ccSurface === 'activity' ? ' active' : ''}`}
            onClick={() => setCcSurface('activity')}
          >
            Actividad
          </button>
        </div>
      )}
      <div className="cc-upper">
        <section className="cc-panel cc-map-panel">
          <div className="cc-panel-head">
            <div>
              <h2>Mapa de unidades</h2>
              <p className="cc-hint">Operadores con GPS · geocercas · sitios</p>
            </div>
            <div className="cc-head-actions">
              {tacticalLayerBar}
              <label className="cc-inline">
                Ver ruta
                <select
                  value={trackUserId}
                  onChange={(e) => setTrackUserId(e.target.value)}
                >
                  <option value="">Ninguna</option>
                  {locations.map((l) => (
                    <option key={l.userId} value={l.userId}>
                      {l.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="cc-btn" onClick={reload}>
                Actualizar
              </button>
            </div>
          </div>
          <div className="cc-map-body">
            <PresenceMapLegend overlay counts={presenceLegendCounts} />
            <MapContainer
              center={GDL}
              zoom={12}
              maxZoom={MAP_MAX_ZOOM}
              zoomSnap={0.25}
              zoomDelta={1}
              {...mapWorldProps()}
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer key={mapLayer} {...tileLayerProps(mapTile)} />
              <ZoomControl position="bottomright" />
              <CursorZoom />
              <MapCursorFix />
              <MapSizeFix />
              <MapWorldFillMinZoom />
              <CenterOn target={centerTarget} />
              {geofences.map((g) => (
                <Circle
                  key={g.id}
                  center={[g.centerLat, g.centerLng]}
                  radius={g.radiusM}
                  pathOptions={{
                    color: '#5b9fd4',
                    fillColor: '#5b9fd4',
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
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
              <CargoZoomGate>
                {(showCargo) =>
                  locations.map((loc) => {
                    const photo = markerPhoto(loc);
                    const isSelected = selected?.userId === loc.userId;
                    const inPanic = panicUserIds.has(loc.userId);
                    const status = resolvePresenceStatus({
                      presence: loc.presence,
                      focus: loc.focus,
                      lastSeenAt: loc.lastSeenAt,
                      offlineRedMinutes,
                    });
                    const isLive = status === 'online' || status === 'service';
                    return (
                      <SmoothMarker
                        key={loc.userId}
                        position={[loc.latitude, loc.longitude]}
                        icon={mapAvatarIcon({
                          name: loc.displayName,
                          cargo: loc.cargo,
                          showCargo,
                          presence: status,
                          selected: isSelected,
                          photoSrc: photo,
                          panic: inPanic,
                        })}
                        zIndexOffset={isSelected ? 900 : inPanic ? 400 : isLive ? 100 : 0}
                        eventHandlers={{
                          click: () =>
                            selectPerson({
                              userId: loc.userId,
                              name: loc.displayName,
                              kind: 'presence',
                              title: loc.displayName,
                              subtitle: PRESENCE_LABELS[status] || 'Ubicación en mapa',
                              lat: loc.latitude,
                              lng: loc.longitude,
                              at: loc.recordedAt,
                            }),
                        }}
                      >
                        <Popup>
                          <strong>{loc.displayName}</strong>
                          <br />
                          {PRESENCE_LABELS[status] || status}
                          <br />
                          {gpsStatusLine(loc.recordedAt)}
                          {recordedAtLocal(loc.recordedAt) ? (
                            <>
                              <br />
                              <span style={{ opacity: 0.75, fontSize: 12 }}>
                                {recordedAtLocal(loc.recordedAt)}
                              </span>
                            </>
                          ) : null}
                          <br />
                          <MapCoordsLink lat={loc.latitude} lng={loc.longitude} />
                          <br />
                          <button type="button" onClick={() => setTrackUserId(loc.userId)}>
                            Ver ruta (8 h)
                          </button>
                        </Popup>
                      </SmoothMarker>
                    );
                  })
                }
              </CargoZoomGate>
              {polyline.length > 0 && (
                <>
                  <Polyline positions={polyline} pathOptions={{ color: '#3ecf9a', weight: 3 }} />
                  <FitBounds positions={polyline} />
                </>
              )}
            </MapContainer>
            {locations.length === 0 && (
              <div className="cc-map-empty">
                {error
                  ? `No se pudo cargar GPS: ${error}`
                  : (overview?.onlineCount || 0) > 0
                    ? 'Hay operadores en radio, pero aún no llega su ubicación. En el celular hay que permitir GPS.'
                    : 'Aún no hay GPS. Abre la app móvil (con ubicación) o Radio web para ver unidades aquí.'}
              </div>
            )}
          </div>
        </section>

        <section className="cc-panel cc-channels-panel">
          <div className="cc-panel-head">
            <div>
              <h2>Canales PTT</h2>
              <p className="cc-hint">Quién está conectado y quién habla</p>
            </div>
          </div>
          <div className="cc-channel-list">
            {(overview?.channels || []).length === 0 && (
              <p className="cc-empty">No hay canales. Crea uno en Grupos.</p>
            )}
            {(overview?.channels || []).map((ch) => (
              <article
                key={ch.id}
                className={`cc-channel${ch.speaker ? ' talking' : ''}`}
              >
                <header>
                  <h3>{ch.name}</h3>
                  <div className="cc-channel-head-actions">
                    <button
                      type="button"
                      className={`cc-btn cc-group-video-btn${groupVideoLive[ch.id] ? ' live' : ''}`}
                      title="Video en vivo del canal (paralelo al PTT)"
                      onClick={() => openGroupVideo(ch.id, ch.name)}
                    >
                      Video en vivo
                    </button>
                    <span className={ch.speaker ? 'cc-badge air' : 'cc-badge idle'}>
                      {ch.speaker ? 'Al aire' : 'Libre'}
                    </span>
                  </div>
                </header>
                {ch.speaker && (
                  <button
                    type="button"
                    className="cc-speaker-line"
                    onClick={() =>
                      selectPerson({
                        userId: ch.speaker.userId,
                        name: ch.speaker.displayName,
                        channel: ch.name,
                        kind: 'radio',
                        title: `${ch.speaker.displayName} está al aire`,
                        subtitle: `Canal «${ch.name}»`,
                      })
                    }
                  >
                    Habla: <strong>{ch.speaker.displayName}</strong>
                  </button>
                )}
                <ul>
                  {(ch.online || []).length === 0 && (
                    <li className="cc-muted">Nadie en este canal</li>
                  )}
                  {(ch.online || []).map((m) => (
                    <li key={m.userId}>
                      <button
                        type="button"
                        className={
                          selected?.userId === m.userId ? 'cc-person selected' : 'cc-person'
                        }
                        onClick={() =>
                          selectPerson({
                            userId: m.userId,
                            name: m.displayName,
                            channel: ch.name,
                          })
                        }
                      >
                        <span
                          className={`cc-dot${
                            ch.speaker?.userId === m.userId ? ' air' : ' on'
                          }`}
                        />
                        {m.displayName}
                        {locByUser.has(m.userId) && (
                          <span className="cc-gps-tag">GPS</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="cc-lower">
        <section className="cc-panel cc-panel--split">
          <div className="cc-lower-col">
            <div className="cc-panel-head">
              <div>
                <h2>Actividad reciente</h2>
                <p className="cc-hint">Radio, geocercas y pánico</p>
              </div>
              <div className="cc-filters">
                {[
                  { id: 'all', label: 'Todo' },
                  { id: 'radio', label: 'Radio' },
                  { id: 'zone', label: 'Zonas' },
                  { id: 'panic', label: 'Pánico' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={filter === f.id ? 'cc-btn primary' : 'cc-btn'}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cc-activity">
              {filteredEvents.length === 0 && (
                <p className="cc-empty">
                  Sin actividad aún. Cuando alguien pulse PTT o cruce una geocerca, aparecerá aquí.
                </p>
              )}
              {filteredEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`cc-activity-row${selected?.id === ev.id ? ' selected' : ''}`}
                  onClick={() => setSelected(ev)}
                >
                  <span className={`cc-kind ${ev.kind}`}>{KIND_LABEL[ev.kind] || ev.kind}</span>
                  <span className="cc-activity-text">
                    <strong>{ev.title}</strong>
                    <small>{ev.subtitle}</small>
                  </span>
                  <time>{new Date(ev.at).toLocaleTimeString()}</time>
                </button>
              ))}
            </div>
          </div>

          <div className="cc-lower-col">
            <div className="cc-panel-head">
              <div>
                <h2>Grabaciones PTT</h2>
                <p className="cc-hint">Últimas 24 h · al soltar PTT (web)</p>
              </div>
            </div>
            <div className="cc-rec-list">
              {recordings.length === 0 && (
                <p className="cc-empty">
                  Aún no hay grabaciones. Habla por Radio web (tocar PTT) para generar una.
                </p>
              )}
              {recordings.map((r) => (
                <div key={r.id} className="cc-rec-row">
                  <div>
                    <strong>{r.displayName || 'Operador'}</strong>
                    <small>
                      {r.groupName || 'Canal'}
                      {r.durationMs != null ? ` · ${(r.durationMs / 1000).toFixed(1)} s` : ''}
                      {' · '}
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </small>
                  </div>
                  <RecordingPlayer
                    token={session.token}
                    recordingId={r.id}
                    durationMs={r.durationMs}
                    label={`${r.displayName || 'Operador'} · ${r.groupName || 'Canal'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="cc-detail">
          <h2>Detalle</h2>
          {!selected && (
            <p className="cc-empty">
              Haz clic en una persona, un marcador del mapa o una fila de actividad.
            </p>
          )}
          {selected && (
            <>
              <p className={`cc-kind-lg ${selected.kind}`}>
                {KIND_LABEL[selected.kind] || 'Operador'}
              </p>
              <h3>{selected.title}</h3>
              <p className="cc-detail-sub">{selected.subtitle}</p>
              <dl>
                {selected.channel && (
                  <div>
                    <dt>Canal</dt>
                    <dd>{selected.channel}</dd>
                  </div>
                )}
                {selected.lat != null && (
                  <div>
                    <dt>Posición</dt>
                    <dd>
                      <MapCoordsLink lat={selected.lat} lng={selected.lng} />
                    </dd>
                  </div>
                )}
                {selected.lastGps && (
                  <div>
                    <dt>Último GPS</dt>
                    <dd>{new Date(selected.lastGps).toLocaleString()}</dd>
                  </div>
                )}
                {selected.at && (
                  <div>
                    <dt>Hora</dt>
                    <dd>{new Date(selected.at).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
              <div className="cc-detail-actions">
                <button
                  type="button"
                  className="cc-btn primary"
                  disabled={selected.lat == null}
                  onClick={centerSelected}
                  title={selected.lat == null ? 'Sin coordenadas GPS' : ''}
                >
                  Centrar en mapa
                </button>
                {selected.userId && (
                  <button
                    type="button"
                    className="cc-btn"
                    onClick={() => setTrackUserId(selected.userId)}
                  >
                    Ver ruta
                  </button>
                )}
                {selected.userId && (
                  <>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => startPersonCall('call')}
                    >
                      Llamada
                    </button>
                    <button
                      type="button"
                      className="cc-btn primary"
                      onClick={() => startPersonCall('video', { intent: 'remote_camera' })}
                      disabled={remoteMonitors.some((m) => m.peerId === selected.userId)}
                      title="Activa la cámara del dispositivo (varias a la vez se apilan)"
                    >
                      {remoteMonitors.some((m) => m.peerId === selected.userId) ? 'En panel' : 'Ver cámara'}
                    </button>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => startPersonCall('video')}
                    >
                      Videollamada
                    </button>
                  </>
                )}
              </div>
              {locationPingHint && selected?.userId && (
                <p className="cc-hint">{locationPingHint}</p>
              )}
              {selected.lat == null && selected.userId && (
                <p className="cc-hint">Esta persona aún no reportó GPS.</p>
              )}
            </>
          )}
        </aside>
      </div>
      </div>
    </div>
  );
}
