import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
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
import { socketIoOptions, socketUrl } from '../socketConfig';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GDL = [20.6736, -103.344];
const SOCKET_URL = socketUrl();

const MAP_LAYERS = {
  natural: {
    label: 'Natural',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  claro: {
    label: 'Claro',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
};

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

export default function DispatchMap({ session }) {
  const [locations, setLocations] = useState([]);
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
  const tile = MAP_LAYERS[layer] || MAP_LAYERS.natural;

  async function reloadFences() {
    const data = await fetchGeofences(session.token);
    setGeofences((data.geofences || []).filter((g) => g.isActive !== false));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [loc, ov, gf] = await Promise.all([
          fetchLocations(session.token),
          fetchOverview(session.token),
          fetchGeofences(session.token),
        ]);
        if (cancelled) return;
        setLocations(loc.locations || []);
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
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [session.token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });
    socket.emit('dispatch:join');
    socket.on('dispatch:location', (payload) => {
      setLocations((prev) => {
        const rest = prev.filter((l) => l.userId !== payload.userId);
        return [
          ...rest,
          {
            userId: payload.userId,
            displayName: payload.displayName || payload.userId,
            latitude: payload.latitude,
            longitude: payload.longitude,
            accuracyM: payload.accuracyM,
            recordedAt: payload.recordedAt,
          },
        ];
      });
    });
    socket.on('dispatch:geofence', (payload) => {
      setAlerts((prev) =>
        [
          {
            id: `${payload.geofenceId}-${payload.userId}-${payload.at}`,
            ...payload,
          },
          ...prev,
        ].slice(0, 12)
      );
    });
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token]);

  useEffect(() => {
    if (!trackUserId) {
      setTrackPoints([]);
      return;
    }
    let cancelled = false;
    fetchUserTrack(session.token, trackUserId, trackHours)
      .then((data) => {
        if (!cancelled) setTrackPoints(data.points || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
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
    if (!window.confirm('¿Eliminar esta geocerca?')) return;
    setBusy(true);
    try {
      await deleteGeofence(session.token, id);
      await reloadFences();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dispatch-page map-page map-page--fill">
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
        <MapContainer center={GDL} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={tile.attribution} url={tile.url} key={layer} />
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
          {locations.map((loc) => (
            <Marker key={loc.userId} position={[loc.latitude, loc.longitude]}>
              <Popup>
                <strong>{loc.displayName}</strong>
                <br />
                {onlineIds.has(loc.userId) ? 'En línea' : 'Offline'}
                <br />
                <small>{new Date(loc.recordedAt).toLocaleString()}</small>
                <br />
                <button type="button" onClick={() => setTrackUserId(loc.userId)}>
                  Ver ruta
                </button>
              </Popup>
            </Marker>
          ))}
          {polyline.length > 0 && (
            <>
              <Polyline positions={polyline} pathOptions={{ color: '#243d20', weight: 4 }} />
              <FitBounds positions={polyline} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
