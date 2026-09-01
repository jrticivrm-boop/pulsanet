import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  Circle,
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
import { MapCoordsLink } from './MapCoordsLink.jsx';
import { CursorZoom, MapCursorFix, MapSizeFix, SmoothMarker } from './mapLeafletUtils.jsx';
import { useMapAvatarPhotos } from './useMapAvatarPhotos.js';
import { MAP_TILE_LAYERS } from './mapTiles.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GDL = [20.6736, -103.344];
const SOCKET_URL = socketUrl();

const MAP_LAYERS = MAP_TILE_LAYERS;

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  }, [map, positions]);
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
  const pageRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const { markerPhoto } = useMapAvatarPhotos(locations, session.token);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [trackUserId, setTrackUserId] = useState('');
  const [trackHours, setTrackHours] = useState(8);
  const [trackPoints, setTrackPoints] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [pickMode, setPickMode] = useState(false);
  const [draft, setDraft] = useState({ name: '', centerLat: null, centerLng: null, radiusM: 200 });
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [layer, setLayer] = useState('natural');
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [maximized, setMaximized] = useState(false);
  const tile = MAP_LAYERS[layer] || MAP_LAYERS.natural;

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
        const [loc, ov, gf] = await Promise.all([
          fetchLocations(session.token),
          fetchOverview(session.token),
          fetchGeofences(session.token),
        ]);
        if (cancelled) return;
        setLocations((prev) => mergeLocations(prev, loc.locations || []));
        const ids = new Set();
        (ov.overview?.channels || []).forEach((c) => {
          c.online.forEach((m) => ids.add(m.userId));
        });
        setOnlineIds(ids);
        setGeofences((gf.geofences || []).filter((g) => g.isActive !== false));
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
  }, [session.token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });
    const join = () => socket.emit('dispatch:join');
    socket.on('connect', join);
    socket.on('reconnect', join);
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
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, session.crypto?.wireKey]);

  useEffect(() => {
    if (!trackUserId) {
      setTrackPoints([]);
      return undefined;
    }
    let cancelled = false;
    const loadTrack = () => {
      if (cancelled || document.hidden) return;
      fetchUserTrack(session.token, trackUserId, trackHours)
        .then((data) => {
          if (!cancelled) setTrackPoints(data.points || []);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
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
  }, [session.token, trackUserId, trackHours]);

  const polyline = useMemo(
    () => trackPoints.map((p) => [p.latitude, p.longitude]),
    [trackPoints]
  );

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
      className={`dispatch-page map-page map-page--fill${maximized ? ' map-page--maximized' : ''}`}
      data-esc-close={maximized ? '' : undefined}
    >
      <header className="dispatch-header map-page-head">
        <div>
          <h1>Mapa en vivo</h1>
          <p className="muted cc-page-sub">Ubicación · rutas · geocercas · capas</p>
        </div>
        <div className="map-page-head-meta">
          <span className="map-kpi">{locations.length} con GPS</span>
          <span className="map-kpi">{geofences.length} geocercas</span>
          {trackUserId ? (
            <span className="map-kpi">{trackPoints.length} pts ruta</span>
          ) : null}
          <button
            type="button"
            className="lt-max-btn"
            onClick={toggleMaximize}
            title={maximized ? 'Reducir (Esc)' : 'Pantalla completa'}
            aria-label={maximized ? 'Reducir mapa' : 'Maximizar mapa a pantalla completa'}
            data-esc-close-btn={maximized ? '' : undefined}
          >
            {maximized ? '⛶ Reducir' : '⛶ Maximizar'}
          </button>
        </div>
      </header>

      <div className="map-toolbar map-toolbar--spread">
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
        <label className="map-field">
          <span>Ruta de</span>
          <select value={trackUserId} onChange={(e) => setTrackUserId(e.target.value)}>
            <option value="">— ninguna —</option>
            {locations.map((l) => (
              <option key={l.userId} value={l.userId}>
                {l.displayName}
              </option>
            ))}
          </select>
        </label>
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
        <MapContainer center={GDL} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={tile.attribution} url={tile.url} key={layer} />
          <CursorZoom />
          <MapCursorFix />
          <MapSizeFix />
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
          {locations.map((loc) => {
            const photo = markerPhoto(loc);
            const isLive = onlineIds.has(loc.userId);
            return (
            <SmoothMarker
              key={loc.userId}
              position={[loc.latitude, loc.longitude]}
              icon={mapAvatarIcon({
                name: loc.displayName,
                live: isLive,
                selected: false,
                photoSrc: photo,
              })}
              zIndexOffset={isLive ? 100 : 0}
            >
              <Popup>
                <strong>{loc.displayName}</strong>
                <br />
                {onlineIds.has(loc.userId) ? 'En línea' : 'Fuera de línea'}
                <br />
                <small>{new Date(loc.recordedAt).toLocaleString()}</small>
                <br />
                <MapCoordsLink lat={loc.latitude} lng={loc.longitude} />
                <br />
                <button type="button" onClick={() => setTrackUserId(loc.userId)}>
                  Ver ruta
                </button>
              </Popup>
            </SmoothMarker>
            );
          })}
          {polyline.length > 0 && (
            <>
              <Polyline positions={polyline} pathOptions={{ color: '#243d20', weight: 4 }} />
              <FitBounds positions={polyline} />
            </>
          )}
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
    </div>
  );
}
