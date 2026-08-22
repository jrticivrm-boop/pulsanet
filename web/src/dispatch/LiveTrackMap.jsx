import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  Popup,
  useMap,
} from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { fetchLocations, fetchOverview, fetchUserTrack } from '../api';
import { socketIoOptions, socketUrl } from '../socketConfig';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GDL = [20.6736, -103.344];
const SOCKET_URL = socketUrl();
/** Consideramos “en vivo” como WhatsApp (señal reciente). */
const LIVE_MS = 20_000;
const TRAIL_MAX = 180;

const LAYERS = {
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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Bolita estilo ubicación en vivo de WhatsApp. */
function avatarIcon(name, live, selected) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const label = escapeHtml((name || '').trim().split(/\s+/)[0] || 'Operador');
  const html = `
    <div class="lt-wa${live ? ' is-live' : ''}${selected ? ' is-selected' : ''}">
      ${live ? '<span class="lt-wa-ring"></span><span class="lt-wa-ring lt-wa-ring--late"></span>' : ''}
      <span class="lt-wa-bubble"><span>${escapeHtml(initial)}</span></span>
      <span class="lt-wa-name">${label}</span>
    </div>`;
  return L.divIcon({
    className: 'lt-div-icon',
    html,
    iconSize: [72, 78],
    iconAnchor: [36, 36],
    popupAnchor: [0, -28],
  });
}

function ageLabel(iso, now = Date.now()) {
  if (!iso) return 'Sin señal';
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'Ahora';
  if (ms < 8_000) return 'En vivo';
  if (ms < 60_000) return `Hace ${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return `Hace ${Math.round(ms / 60_000)} min`;
  return `Hace ${Math.round(ms / 3_600_000)} h`;
}

function isFresh(iso, now = Date.now()) {
  if (!iso) return false;
  return now - new Date(iso).getTime() < LIVE_MS;
}

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

function FitPeople({ positions, locked }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (locked || done.current || !positions?.length) return;
    done.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [56, 56], maxZoom: 15 });
  }, [map, positions, locked]);
  return null;
}

/** Marker que se desliza al actualizar (como WhatsApp). */
function SmoothMarker({ position, icon, eventHandlers, children }) {
  const markerRef = useRef(null);
  const fromRef = useRef(position);
  const rafRef = useRef(0);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      fromRef.current = position;
      return undefined;
    }
    const from = fromRef.current || position;
    const to = position;
    if (samePoint(from, to, 0.000001)) {
      marker.setLatLng(to);
      fromRef.current = to;
      return undefined;
    }

    const start = performance.now();
    const duration = 700;
    cancelAnimationFrame(rafRef.current);

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      const lat = from[0] + (to[0] - from[0]) * ease;
      const lng = from[1] + (to[1] - from[1]) * ease;
      marker.setLatLng([lat, lng]);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [position[0], position[1]]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      eventHandlers={eventHandlers}
    >
      {children}
    </Marker>
  );
}

export default function LiveTrackMap({ session }) {
  const [locations, setLocations] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState('');
  const [follow, setFollow] = useState(true);
  const [trails, setTrails] = useState({});
  const [historyTrack, setHistoryTrack] = useState([]);
  const [layer, setLayer] = useState('natural');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [loc, ov] = await Promise.all([
        fetchLocations(session.token),
        fetchOverview(session.token),
      ]);
      const list = loc.locations || [];
      setLocations(list);
      setTrails((prev) => {
        let next = prev;
        list.forEach((p) => {
          next = appendTrail(next, p.userId, Number(p.latitude), Number(p.longitude));
        });
        return next;
      });
      const ids = new Set();
      (ov.overview?.channels || []).forEach((c) => {
        (c.online || []).forEach((m) => ids.add(m.userId));
      });
      setOnlineIds(ids);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [session.token]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });
    socket.on('connect', () => {
      setLive(true);
      socket.emit('dispatch:join');
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('dispatch:location', (payload) => {
      const lat = Number(payload.latitude);
      const lng = Number(payload.longitude);
      setLocations((prev) => {
        const rest = prev.filter((l) => l.userId !== payload.userId);
        return [
          ...rest,
          {
            userId: payload.userId,
            displayName: payload.displayName || payload.userId,
            latitude: lat,
            longitude: lng,
            accuracyM: payload.accuracyM,
            recordedAt: payload.recordedAt || new Date().toISOString(),
          },
        ];
      });
      setTrails((prev) => appendTrail(prev, payload.userId, lat, lng));
    });
    socket.on('dispatch:presence', () => reload());
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, reload]);

  useEffect(() => {
    if (!selectedId) {
      setHistoryTrack([]);
      return undefined;
    }
    let cancelled = false;
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
    return () => {
      cancelled = true;
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

  const positions = useMemo(
    () => people.map((p) => [p.latitude, p.longitude]),
    [people]
  );

  const selected = people.find((p) => p.userId === selectedId) || null;
  const selectedTrail = selectedId ? trails[selectedId] || historyTrack : [];
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
  }

  return (
    <div className="lt-page">
      <aside className="lt-sheet">
        <header className="lt-sheet-head">
          <div>
            <h1>Seguimiento en vivo</h1>
            <p>
              {liveCount} en vivo · {people.length} con GPS
              <span className={live ? 'lt-live-dot on' : 'lt-live-dot'}>
                {live ? ' · Tiempo real' : ' · Reconectando'}
              </span>
            </p>
          </div>
        </header>

        <div className="lt-tools">
          <input
            type="search"
            placeholder="Buscar operador…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar operador"
          />
          <div className="lt-layers" role="group" aria-label="Estilo de mapa">
            {Object.entries(LAYERS).map(([key, meta]) => (
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
          {selected && (
            <label className="lt-follow">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />
              Seguir a {selected.displayName?.split(/\s+/)[0] || 'operador'} (como WhatsApp)
            </label>
          )}
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
            const online = onlineIds.has(p.userId);
            return (
              <li key={p.userId}>
                <button
                  type="button"
                  className={`lt-person${selectedId === p.userId ? ' selected' : ''}`}
                  onClick={() => focusPerson(p)}
                >
                  <span className={`lt-avatar${fresh ? ' live' : ''}`}>
                    {(p.displayName || '?').charAt(0).toUpperCase()}
                    {fresh ? <i className="lt-avatar-pulse" aria-hidden="true" /> : null}
                  </span>
                  <span className="lt-person-meta">
                    <strong>{p.displayName}</strong>
                    <em>
                      {ageLabel(p.recordedAt, now)}
                      {online ? ' · En radio' : ''}
                      {p.accuracyM != null ? ` · ±${Math.round(p.accuracyM)} m` : ''}
                    </em>
                  </span>
                  <span className={`lt-status-pill${fresh ? ' on' : ''}`}>
                    {fresh ? 'En vivo' : 'Última'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && (
          <div className="lt-detail">
            <strong>{selected.displayName}</strong>
            <p>
              {Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}
            </p>
            <p>
              {ageLabel(selected.recordedAt, now)} · rastro en vivo
              {selectedTrail.length > 1 ? ` (${selectedTrail.length} puntos)` : ''}
            </p>
          </div>
        )}
      </aside>

      <div className="lt-map">
        <MapContainer center={GDL} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={tile.attribution} url={tile.url} key={layer} />
          <FollowSelected target={followTarget} enabled={Boolean(selectedId && follow)} />
          {!selectedId && <FitPeople positions={positions} locked={Boolean(selectedId)} />}
          {people.map((p) => {
            const fresh = isFresh(p.recordedAt, now);
            const selected = p.userId === selectedId;
            return (
              <SmoothMarker
                key={p.userId}
                position={[Number(p.latitude), Number(p.longitude)]}
                icon={avatarIcon(p.displayName, fresh, selected)}
                eventHandlers={{ click: () => focusPerson(p) }}
              >
                <Popup>
                  <strong>{p.displayName}</strong>
                  <br />
                  {ageLabel(p.recordedAt, now)}
                  {fresh ? ' · compartiendo en vivo' : ''}
                </Popup>
              </SmoothMarker>
            );
          })}
          {people.map((p) =>
            p.accuracyM > 0 ? (
              <Circle
                key={`acc-${p.userId}`}
                center={[Number(p.latitude), Number(p.longitude)]}
                radius={Math.min(Math.max(Number(p.accuracyM) || 20, 14), 140)}
                pathOptions={{
                  color: isFresh(p.recordedAt, now) ? '#25d366' : '#9ca3af',
                  fillColor: isFresh(p.recordedAt, now) ? '#25d366' : '#9ca3af',
                  fillOpacity: isFresh(p.recordedAt, now) ? 0.14 : 0.08,
                  weight: 1,
                }}
              />
            ) : null
          )}
          {selectedTrail.length > 1 && (
            <Polyline
              positions={selectedTrail}
              pathOptions={{ color: '#25d366', weight: 5, opacity: 0.9, lineCap: 'round' }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
