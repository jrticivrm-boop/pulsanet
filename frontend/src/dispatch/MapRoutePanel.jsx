import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { qrcode } from 'qrcode-generator';
import {
  createSavedRoute,
  deleteSavedRoute,
  fetchSavedRoutes,
  geoEta,
  geoRoute,
  geoSearch,
  sendDmMessage,
} from '../api';
import { SEARCH_KIND_LABELS, SearchKindIcon, localMatches, parseCoordinates } from './MapSearchPanel.jsx';
import { ageLabel, recordedAtMs } from './liveTiming.js';
import { PRESENCE_LABELS } from './presenceStatus.js';

const DEBOUNCE_MS = 220;
const ROUTE_COLOR = '#1a73e8';
const ALT_COLOR = '#7a8794';
/** Paradas intermedias (el enlace de Google Maps admite 9). */
const MAX_STOPS = 9;
/** Más lejos que esto del camino: el punto real queda fuera de la ruta. */
const FAR_FROM_ROAD_M = 200;
/** Posición «reciente» pero ya no tan fresca: se marca en ámbar. */
const ETA_AGE_WARN_MS = 5 * 60_000;
const NOTICE_MS = 5000;

const ROUTE_ERRORS = {
  sin_ruta: 'No hay ruta en vehículo entre esos puntos.',
  fuera_de_rango: 'Los puntos están demasiado lejos entre sí.',
  routing_deshabilitado: 'El cálculo de rutas está deshabilitado en el servidor.',
  timeout: 'El servicio de rutas no respondió a tiempo. Intenta de nuevo.',
  sin_servicio: 'Sin servicio de rutas (revisa la salida a internet del servidor).',
};

const PUBLIC_SERVICE_NOTE =
  'Calculado con un servicio público externo: las coordenadas salen de la red de SICOM. Configura el servidor de rutas propio.';

export function formatDistance(m) {
  const v = Number(m) || 0;
  if (v < 1000) return `${Math.round(v / 10) * 10} m`;
  return `${(v / 1000).toFixed(v < 100000 ? 1 : 0)} km`;
}

export function formatDuration(s) {
  const min = Math.max(1, Math.round((Number(s) || 0) / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${String(rest).padStart(2, '0')} min` : `${h} h`;
}

function arrivalTime(s) {
  const d = new Date(Date.now() + (Number(s) || 0) * 1000);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Metros de `c` al segmento a–b (proyección local; válido para tramos de pocos km). */
function segmentDistM(c, a, b) {
  const k = Math.cos((c.lat * Math.PI) / 180);
  const ax = (a.lng - c.lng) * k;
  const ay = a.lat - c.lat;
  const bx = (b.lng - c.lng) * k;
  const by = b.lat - c.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111320;
}

/** Punto A/B a partir de un clic en el mapa o de un marcador arrastrado. */
export function routePointAt(lat, lng) {
  return {
    id: `coord:${lat.toFixed(6)},${lng.toFixed(6)}`,
    kind: 'coordenadas',
    name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    detail: 'Punto en el mapa',
    lat,
    lng,
  };
}

/** Lugar con nombre a punto de ruta (rutas guardadas, operadores). */
export function routePointFrom(p, kind = 'lugar') {
  return {
    id: p.id || `pt:${p.lat.toFixed(6)},${p.lng.toFixed(6)}`,
    kind,
    name: p.name || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
    detail: p.detail || '',
    lat: p.lat,
    lng: p.lng,
  };
}

const ll = (p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * Enlace de Google Maps (vehículo). Sin `origin` el celular usa su ubicación actual.
 * @param {Array<{lat:number,lng:number}>} points A, paradas…, B (o solo [B])
 */
export function googleMapsUrl(points, { fromHere = false } = {}) {
  const dest = points[points.length - 1];
  let url = `https://www.google.com/maps/dir/?api=1&destination=${ll(dest)}&travelmode=driving`;
  if (!fromHere && points.length > 1) url += `&origin=${ll(points[0])}`;
  const mid = fromHere ? [] : points.slice(1, -1);
  if (mid.length) url += `&waypoints=${mid.map(ll).join('%7C')}`;
  return url;
}

function routeShareText(points, route) {
  const a = points[0];
  const b = points[points.length - 1];
  const lines = [`Ruta: ${a.name} → ${b.name}`];
  const mid = points.slice(1, -1);
  if (mid.length) lines.push(`Paradas: ${mid.map((p, i) => `${i + 1}) ${p.name}`).join(' · ')}`);
  if (route) {
    const via = route.via?.length ? ` · vía ${route.via[0]}` : '';
    lines.push(`${formatDistance(route.distanceM)} · ~${formatDuration(route.durationS)} sin tráfico${via}`);
  }
  lines.push(googleMapsUrl(points));
  return lines.join('\n');
}

/** Copia en el mismo clic (antes de abrir otra pestaña, que quita el foco). */
function copyTextSync(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch {
    /* sigue con la API asíncrona */
  }
  navigator.clipboard?.writeText(text).catch(() => {});
  return Boolean(navigator.clipboard);
}

/** Geocercas activas que toca la ruta. */
function fencesCrossed(route, geofences) {
  if (!route?.points?.length || !geofences?.length) return [];
  const out = [];
  for (const g of geofences) {
    if (g.isActive === false) continue;
    const c = { lat: Number(g.centerLat), lng: Number(g.centerLng) };
    const r = Number(g.radiusM);
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || !(r > 0)) continue;
    const pts = route.points;
    const hit =
      pts.length === 1
        ? haversineM(c, { lat: pts[0][0], lng: pts[0][1] }) <= r
        : pts.some(
            (p, i) =>
              i > 0 &&
              segmentDistM(c, { lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: p[0], lng: p[1] }) <= r
          );
    if (hit) out.push(g);
  }
  return out;
}

/**
 * Pide la ruta cuando hay A y B (con paradas). Vive en el mapa (no en el panel) para que la
 * ruta siga dibujada al cambiar de pestaña.
 * @param {Array<{lat:number,lng:number}>} points A, paradas…, B ([] si falta A o B)
 */
export function useRoutePlan(token, points) {
  const [plan, setPlan] = useState(null);
  const key = points.length >= 2 ? points.map(ll).join('>') : '';
  useEffect(() => {
    if (!key) {
      setPlan(null);
      return undefined;
    }
    const ac = new AbortController();
    setPlan({ key, status: 'loading', routes: [] });
    geoRoute(token, points, ac.signal)
      .then((d) => {
        if (d?.ok && Array.isArray(d.routes) && d.routes.length) {
          setPlan({ key, status: 'ok', routes: d.routes, snapM: d.snapM || [], source: d.source });
        } else setPlan({ key, status: 'error', routes: [], reason: d?.reason || 'sin_servicio' });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setPlan({ key, status: 'error', routes: [], reason: 'sin_servicio' });
      });
    return () => ac.abort();
    // `points` se refleja en `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);
  return plan;
}

/* ------------------------------------------------------------------ íconos */

const svgProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function Icon({ name }) {
  switch (name) {
    case 'pick':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
        </svg>
      );
    case 'swap':
      return (
        <svg {...svgProps}>
          <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
        </svg>
      );
    case 'operator':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...svgProps}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'close':
      return (
        <svg {...svgProps}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case 'star':
      return (
        <svg {...svgProps}>
          <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      );
    case 'gmaps':
      return (
        <svg {...svgProps}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...svgProps}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" />
        </svg>
      );
    case 'send':
      return (
        <svg {...svgProps}>
          <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z" />
        </svg>
      );
    case 'race':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="13" r="7.5" />
          <path d="M12 9v4l2.5 2M9.5 2.5h5" />
        </svg>
      );
    case 'fit':
      return (
        <svg {...svgProps}>
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...svgProps}>
          <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...svgProps}>
          <path d="M12 3.5 2.5 20h19z" />
          <path d="M12 10v4.5M12 17.2v.3" />
        </svg>
      );
    case 'info':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5M12 7.8v.3" />
        </svg>
      );
    case 'fence':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" strokeDasharray="3 2.5" />
          <circle cx="12" cy="12" r="1.8" />
        </svg>
      );
    default:
      return null;
  }
}

/* -------------------------------------------------------------- campo A/B */

/** Campo A / B / parada con autocompletado (lugares propios + OpenStreetMap + coordenadas). */
function PlaceField({ letter, tone, placeholder, token, value, onChange, localItems, getBias, picking, onPick, extra, onRemove }) {
  const [q, setQ] = useState(value?.name || '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState('');
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQ(value?.name || '');
  }, [value?.id, value?.name]);

  const trimmed = q.trim();
  const editing = open && trimmed !== String(value?.name || '').trim();

  useEffect(() => {
    if (!editing || !trimmed) {
      abortRef.current?.abort();
      setItems([]);
      setLoading(false);
      setNote('');
      return undefined;
    }
    setActive(-1);
    const coords = parseCoordinates(trimmed);
    if (coords) {
      setItems([{ ...routePointAt(coords.lat, coords.lng), detail: 'Ir a estas coordenadas' }]);
      return undefined;
    }
    const local = localMatches(localItems || [], trimmed).slice(0, 4);
    setItems(local);
    setNote('');
    if (trimmed.length < 2) return undefined;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const bias = getBias?.() || null;
    const ask = (src) =>
      geoSearch(token, { q: trimmed, lat: bias?.lat, lng: bias?.lng, src }, ac.signal).then((d) => ({
        results: Array.isArray(d?.results) ? d.results : [],
        status: d?.status || 'ok',
      }));
    let catalog = [];
    let remote = [];
    let own = [];
    const show = () => {
      const seen = new Set();
      setItems(
        [...local, ...remote, ...own, ...catalog]
          .filter((o) => (seen.has(o.id) ? false : seen.add(o.id)))
          .slice(0, 10)
      );
    };
    // Catálogo propio (municipios, ejidos, C.P.): responde en milisegundos.
    const tLocal = window.setTimeout(() => {
      ask('local')
        .then((r) => {
          catalog = r.results.slice(0, 4);
          show();
        })
        .catch(() => {});
    }, 90);
    if (trimmed.length < 3) return () => window.clearTimeout(tLocal);
    // Mapa propio de SICOM: rápido y sin internet; lo en línea, al llegar, va primero.
    let ownDone = Promise.resolve();
    const tOwn = window.setTimeout(() => {
      ownDone = ask('propio')
        .then((r) => {
          own = r.results;
          show();
        })
        .catch(() => {});
    }, 110);
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const osm = await ask('osm');
        remote = osm.results;
        show();
        await ownDone;
        // Sin servicio en línea ni propio: la búsqueda completa (Nominatim) sigue respondiendo.
        if (osm.status !== 'ok' && !osm.results.length && !own.length && !ac.signal.aborted) {
          setNote('Sugerencias de calles sin servicio: búsqueda completa…');
          const full = await ask('full');
          remote = full.results;
          show();
          setNote(full.results.length ? '' : 'Sin resultados. Prueba con otro nombre, o elige el punto en el mapa.');
        }
      } catch {
        /* cancelada al seguir escribiendo */
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(tLocal);
      window.clearTimeout(tOwn);
      window.clearTimeout(t);
    };
    // getBias se lee al disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, editing, token, localItems]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const choose = (opt) => {
    if (!opt) return;
    onChange(opt);
    setQ(opt.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (items.length ? (i + 1) % items.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i <= 0 ? items.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active >= 0 ? active : 0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQ(value?.name || '');
    }
  };

  return (
    <div className={`map-route-field is-${tone}${picking ? ' is-picking' : ''}`}>
      <span className={`map-route-letter is-${tone}`} aria-hidden>
        {letter}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="map-route-input"
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        title={value?.detail ? `${value.name} · ${value.detail}` : value?.name || undefined}
        role="combobox"
        aria-expanded={editing && items.length > 0}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {extra}
      <button
        type="button"
        className={`map-route-icon-btn${picking ? ' is-on' : ''}`}
        onClick={onPick}
        title={picking ? 'Haz clic en el mapa para fijar el punto' : 'Elegir el punto en el mapa'}
        aria-pressed={picking}
      >
        <Icon name="pick" />
      </button>
      {onRemove ? (
        <button type="button" className="map-route-icon-btn" onClick={onRemove} title="Quitar esta parada">
          <Icon name="close" />
        </button>
      ) : null}
      {editing && (items.length || loading || note) ? (
        <ul className="map-search-list map-route-list" role="listbox">
          {items.map((opt, i) => (
            <li
              key={`${opt.id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`map-search-item${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                choose(opt);
              }}
            >
              <span className={`map-search-item-icon kind-${opt.kind}`}>
                <SearchKindIcon kind={opt.kind} />
              </span>
              <span className="map-search-item-text">
                <span className="map-search-item-name">{opt.name}</span>
                {opt.detail ? <span className="map-search-item-detail">{opt.detail}</span> : null}
              </span>
              <span className="map-search-item-kind">{SEARCH_KIND_LABELS[opt.kind] || 'Lugar'}</span>
            </li>
          ))}
          {note ? <li className="map-search-empty muted">{note}</li> : null}
          {loading && !note ? <li className="map-search-empty muted">Buscando…</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- ventanas */

function PopHeader({ icon, title, sub, onClose, children }) {
  return (
    <header className="map-route-pop-head">
      <span className="map-route-pop-icon">
        <Icon name={icon} />
      </span>
      <span className="map-route-pop-title">
        <strong>{title}</strong>
        {sub ? <span className="muted">{sub}</span> : null}
      </span>
      {children}
      <button type="button" className="map-route-icon-btn" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
        <Icon name="close" />
      </button>
    </header>
  );
}

function Avatar({ person }) {
  return (
    <span className="map-route-avatar">
      {person.photo ? <img src={person.photo} alt="" /> : (person.name || '?').charAt(0).toUpperCase()}
      <i className={`map-route-dot is-${person.status || 'offline'}`} aria-hidden />
    </span>
  );
}

function isFreshOperator(p, freshMinutes, now) {
  if (p.status !== 'online' && p.status !== 'away') return false;
  const t = recordedAtMs(p.recordedAt);
  if (!t) return false;
  return now - t <= Math.max(1, Number(freshMinutes) || 15) * 60_000;
}

/** «¿Quién llega primero?»: ranking por tiempo por carretera hasta B. */
function EtaPop({ token, dest, operators, freshMinutes, isAdmin, onClose, onRouteFrom, onSend }) {
  const [state, setState] = useState({ status: 'loading', rows: [], skipped: 0, at: 0, source: null });
  const [stamp, setStamp] = useState(0);
  const [showStale, setShowStale] = useState(false);
  const [sent, setSent] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const opsRef = useRef(operators);
  opsRef.current = operators;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const destKey = ll(dest);
  useEffect(() => {
    const at = Date.now();
    const fresh = opsRef.current
      .filter((p) => isFreshOperator(p, freshMinutes, at))
      .map((p) => ({ ...p, straightM: haversineM(p, dest) }))
      .sort((a, b) => a.straightM - b.straightM);
    const batch = fresh.slice(0, 25);
    if (!batch.length) {
      setState({ status: 'ok', rows: [], skipped: 0, at, source: null });
      return undefined;
    }
    const ac = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    geoEta(
      token,
      { lat: dest.lat, lng: dest.lng },
      batch.map((p) => ({ id: String(p.userId), lat: p.lat, lng: p.lng })),
      ac.signal
    )
      .then((d) => {
        if (!d?.ok) {
          setState({ status: 'error', rows: [], skipped: 0, at, reason: d?.reason || 'sin_servicio' });
          return;
        }
        const byId = new Map((d.results || []).map((r) => [r.id, r]));
        const rows = batch
          .map((p) => ({ ...p, eta: byId.get(String(p.userId)) || null }))
          .sort((a, b) => (a.eta?.durationS ?? Infinity) - (b.eta?.durationS ?? Infinity));
        setState({ status: 'ok', rows, skipped: fresh.length - batch.length, at, source: d.source });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setState({ status: 'error', rows: [], skipped: 0, at, reason: 'sin_servicio' });
      });
    return () => ac.abort();
    // Se recalcula al cambiar B o con «Actualizar»; las posiciones se toman en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, destKey, stamp, freshMinutes]);

  const stale = useMemo(
    () =>
      operators
        .filter((p) => !isFreshOperator(p, freshMinutes, now))
        .sort((a, b) => recordedAtMs(b.recordedAt) - recordedAtMs(a.recordedAt)),
    [operators, freshMinutes, now]
  );

  const send = async (p) => {
    setSent((s) => ({ ...s, [p.userId]: 'sending' }));
    const lines = [`Dirígete a: ${dest.name}`];
    if (p.eta?.durationS != null) {
      lines.push(`Desde tu posición: ${formatDistance(p.eta.distanceM)} · ~${formatDuration(p.eta.durationS)} sin tráfico`);
    }
    lines.push(googleMapsUrl([dest], { fromHere: true }));
    try {
      await onSend(p, lines.join('\n'));
      setSent((s) => ({ ...s, [p.userId]: 'sent' }));
    } catch {
      setSent((s) => ({ ...s, [p.userId]: 'error' }));
    }
  };

  const ranked = state.rows.filter((r) => r.eta?.durationS != null);
  const noRoad = state.rows.filter((r) => r.eta?.durationS == null);
  const best = ranked[0]?.eta?.durationS ?? 0;

  return (
    <div className="map-route-pop map-route-pop--eta" role="dialog" aria-label="¿Quién llega primero?">
      <PopHeader icon="race" title="¿Quién llega primero?" sub={`a ${dest.name}`} onClose={onClose}>
        <button
          type="button"
          className="cc-btn ghost cc-btn-sm map-route-btn"
          onClick={() => setStamp((n) => n + 1)}
          disabled={state.status === 'loading'}
          title="Recalcular con las posiciones actuales"
        >
          <Icon name="refresh" /> Actualizar
        </button>
      </PopHeader>
      <div className="map-route-pop-body">
        {state.status === 'loading' && !state.rows.length ? (
          <p className="map-route-pop-status muted">
            <span className="map-search-spinner" aria-hidden /> Calculando tiempos por carretera…
          </p>
        ) : null}
        {state.status === 'error' ? (
          <p className="map-route-pop-status is-error">{ROUTE_ERRORS[state.reason] || ROUTE_ERRORS.sin_servicio}</p>
        ) : null}
        {state.status === 'ok' && !state.rows.length ? (
          <p className="map-route-pop-status muted">
            Ningún operador con posición reciente (últimos {freshMinutes} min) en tu alcance.
          </p>
        ) : null}
        {ranked.length || noRoad.length ? (
          <ol className={`map-route-eta-list${state.status === 'loading' ? ' is-busy' : ''}`}>
            {[...ranked, ...noRoad].map((p, i) => {
              const ageMs = now - recordedAtMs(p.recordedAt);
              const extra = p.eta?.durationS != null ? Math.round((p.eta.durationS - best) / 60) : null;
              const st = sent[p.userId];
              return (
                <li key={p.userId} className={`map-route-eta-row${i === 0 && ranked.length ? ' is-first' : ''}`}>
                  <span className="map-route-eta-rank">{p.eta?.durationS != null ? i + 1 : '–'}</span>
                  <Avatar person={p} />
                  <span className="map-route-eta-who">
                    <strong title={p.name}>{p.name}</strong>
                    <span className={`map-route-eta-age${ageMs > ETA_AGE_WARN_MS ? ' is-old' : ''}`}>
                      {PRESENCE_LABELS[p.status] || ''} · posición {ageLabel(p.recordedAt, now).toLowerCase()}
                      {p.eta?.snapM > FAR_FROM_ROAD_M ? ` · a ${formatDistance(p.eta.snapM)} del camino` : ''}
                    </span>
                  </span>
                  <span className="map-route-eta-time">
                    {p.eta?.durationS != null ? (
                      <>
                        <strong>{formatDuration(p.eta.durationS)}</strong>
                        <span>
                          {formatDistance(p.eta.distanceM)}
                          {extra ? ` · +${extra} min` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="muted">sin ruta por carretera</span>
                    )}
                  </span>
                  <span className="map-route-eta-actions">
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() => onRouteFrom(p)}
                      title="Trazar la ruta desde su posición"
                    >
                      Ver ruta
                    </button>
                    <button
                      type="button"
                      className={`cc-btn cc-btn-sm map-route-send${st === 'sent' ? ' is-sent' : ''}`}
                      onClick={() => send(p)}
                      disabled={st === 'sending'}
                      title="Enviarle por chat el enlace de Google Maps hasta el destino"
                    >
                      {st === 'sending' ? 'Enviando…' : st === 'sent' ? 'Enviado ✓' : st === 'error' ? 'Reintentar' : 'Enviar'}
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {state.skipped > 0 ? (
          <p className="map-route-pop-note muted">
            {state.skipped} operador(es) más lejos en línea recta no se calcularon (máx. 25 por consulta).
          </p>
        ) : null}
        {stale.length ? (
          <div className="map-route-stale">
            <button
              type="button"
              className="map-route-stale-toggle"
              onClick={() => setShowStale((v) => !v)}
              aria-expanded={showStale}
            >
              {showStale ? '▾' : '▸'} Sin posición reciente ({stale.length})
            </button>
            {showStale ? (
              <ul>
                {stale.map((p) => (
                  <li key={p.userId}>
                    <Avatar person={p} />
                    <span className="map-route-eta-who">
                      <strong title={p.name}>{p.name}</strong>
                      <span className="muted">
                        {PRESENCE_LABELS[p.status] || ''} · última posición {ageLabel(p.recordedAt, now).toLowerCase()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <footer className="map-route-pop-foot muted">
        Tiempo por carretera sin tráfico desde su última posición (solo posiciones de los últimos {freshMinutes} min).
        Al abrir el enlace, Google Maps da el tiempo con tráfico.
        {isAdmin && state.source === 'publico' ? <span className="map-route-pop-warn"> {PUBLIC_SERVICE_NOTE}</span> : null}
      </footer>
    </div>
  );
}

/** Lista de operadores (origen «Desde operador…» o destinatario de «Enviar»). */
function OperatorPickPop({ icon, title, sub, operators, freshMinutes, onClose, actionLabel, onPickOne, statusOf, footer }) {
  const [q, setQ] = useState('');
  const now = Date.now();
  const list = useMemo(() => {
    const norm = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const nq = norm(q.trim());
    return operators
      .filter((p) => !nq || norm(`${p.name} ${p.cargo || ''}`).includes(nq))
      .map((p) => ({ ...p, fresh: isFreshOperator(p, freshMinutes, now) }))
      .sort((a, b) => Number(b.fresh) - Number(a.fresh) || a.name.localeCompare(b.name, 'es'));
    // `now` solo ordena; no hace falta recalcular cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operators, q, freshMinutes]);

  return (
    <div className="map-route-pop" role="dialog" aria-label={title}>
      <PopHeader icon={icon} title={title} sub={sub} onClose={onClose} />
      <div className="map-route-pop-body">
        <input
          type="search"
          className="map-route-pop-search"
          placeholder="Buscar operador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {!list.length ? <p className="map-route-pop-status muted">Sin operadores.</p> : null}
        <ul className="map-route-op-list">
          {list.map((p) => {
            const st = statusOf?.(p);
            return (
              <li key={p.userId} className={p.fresh ? '' : 'is-stale'}>
                <Avatar person={p} />
                <span className="map-route-eta-who">
                  <strong title={p.name}>{p.name}</strong>
                  <span className={`map-route-eta-age${p.fresh ? '' : ' is-old'}`}>
                    {PRESENCE_LABELS[p.status] || ''} · posición {ageLabel(p.recordedAt, now).toLowerCase()}
                  </span>
                </span>
                <button
                  type="button"
                  className={`cc-btn cc-btn-sm${st === 'sent' ? ' is-sent' : ''} map-route-send`}
                  onClick={() => onPickOne(p)}
                  disabled={st === 'sending'}
                >
                  {st === 'sending' ? 'Enviando…' : st === 'sent' ? 'Enviado ✓' : st === 'error' ? 'Reintentar' : actionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {footer ? <footer className="map-route-pop-foot muted">{footer}</footer> : null}
    </div>
  );
}

function QrPop({ url, onClose, onCopy }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [url]);
  return (
    <div className="map-route-pop map-route-pop--qr" role="dialog" aria-label="Código QR de la ruta">
      <PopHeader icon="qr" title="Abrir en el celular" sub="Escanéalo con la cámara: abre la ruta en Google Maps" onClose={onClose} />
      <div className="map-route-pop-body map-route-qr-body">
        <div className="map-route-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onCopy}>
          Copiar enlace
        </button>
      </div>
    </div>
  );
}

function SavedPop({ token, from, to, stops, userId, isAdmin, onClose, onLoad }) {
  const [state, setState] = useState({ status: 'loading', routes: [] });
  const [name, setName] = useState(() => (from && to ? `${from.name} → ${to.name}`.slice(0, 120) : ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');

  const load = useCallback(() => {
    fetchSavedRoutes(token)
      .then((d) => setState({ status: 'ok', routes: d?.routes || [] }))
      .catch((e) => setState({ status: 'error', routes: [], error: e?.message || 'No se pudo cargar' }));
  }, [token]);
  useEffect(load, [load]);

  const canSave = Boolean(from && to);
  const save = async (e) => {
    e.preventDefault();
    if (!canSave || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const points = [from, ...stops, to].map((p) => ({ name: p.name, detail: p.detail, lat: p.lat, lng: p.lng }));
      const d = await createSavedRoute(token, { name: name.trim(), points });
      setState((s) => ({
        status: 'ok',
        routes: [...s.routes, d.route].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }));
    } catch (err) {
      setError(err?.message || 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    setConfirmId('');
    try {
      await deleteSavedRoute(token, r.id);
      setState((s) => ({ ...s, routes: s.routes.filter((x) => x.id !== r.id) }));
    } catch (err) {
      setError(err?.message || 'No se pudo borrar');
    }
  };

  return (
    <div className="map-route-pop" role="dialog" aria-label="Rutas frecuentes">
      <PopHeader icon="star" title="Rutas frecuentes" sub="Compartidas con toda la organización" onClose={onClose} />
      <div className="map-route-pop-body">
        {canSave ? (
          <form className="map-route-save" onSubmit={save}>
            <input
              type="text"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la ruta"
              aria-label="Nombre de la ruta"
            />
            <button type="submit" className="cc-btn primary cc-btn-sm" disabled={busy || !name.trim()}>
              {busy ? 'Guardando…' : 'Guardar ruta actual'}
            </button>
          </form>
        ) : (
          <p className="map-route-pop-note muted">Marca origen y destino para guardar la ruta actual.</p>
        )}
        {error ? <p className="map-route-pop-status is-error">{error}</p> : null}
        {state.status === 'loading' ? (
          <p className="map-route-pop-status muted">
            <span className="map-search-spinner" aria-hidden /> Cargando…
          </p>
        ) : null}
        {state.status === 'error' ? <p className="map-route-pop-status is-error">{state.error}</p> : null}
        {state.status === 'ok' && !state.routes.length ? (
          <p className="map-route-pop-status muted">Aún no hay rutas guardadas.</p>
        ) : null}
        <ul className="map-route-saved-list">
          {state.routes.map((r) => {
            const pts = r.points || [];
            const mine = r.createdBy === userId;
            return (
              <li key={r.id}>
                <button type="button" className="map-route-saved-item" onClick={() => onLoad(r)} title="Cargar esta ruta">
                  <strong>{r.name}</strong>
                  <span className="muted">
                    {pts[0]?.name} → {pts[pts.length - 1]?.name}
                    {pts.length > 2 ? ` · ${pts.length - 2} parada(s)` : ''}
                    {r.createdByName ? ` · ${r.createdByName}` : ''}
                  </span>
                </button>
                {mine || isAdmin ? (
                  confirmId === r.id ? (
                    <span className="map-route-saved-confirm">
                      <button type="button" className="cc-btn cc-btn-sm danger" onClick={() => remove(r)}>
                        Borrar
                      </button>
                      <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => setConfirmId('')}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="map-route-icon-btn"
                      onClick={() => setConfirmId(r.id)}
                      title="Borrar ruta guardada"
                      aria-label={`Borrar ${r.name}`}
                    >
                      <Icon name="close" />
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- panel */

/**
 * Pestaña «Ruta»: cómo llegar en vehículo (OSRM) de A a B con paradas, ruta recomendada y
 * alternativas; Google Maps (copia y abre), QR, envío por chat, «¿Quién llega primero?»,
 * avisos de geocercas y de puntos lejos del camino, y rutas frecuentes compartidas.
 */
export default function MapRoutePanel({
  token,
  localItems,
  getBias,
  from,
  to,
  stops,
  onFrom,
  onTo,
  onStops,
  onLoadSaved,
  plan,
  active,
  onActive,
  pick,
  onPick,
  onClear,
  onFit,
  operators,
  freshMinutes,
  geofences,
  isAdmin,
  userId,
}) {
  const [pop, setPop] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendState, setSendState] = useState({});
  const rootRef = useRef(null);

  const routes = plan?.status === 'ok' ? plan.routes : [];
  const current = routes[active] || routes[0] || null;
  const fastest = routes.length ? Math.min(...routes.map((r) => r.durationS)) : 0;
  const filledStops = stops.filter(Boolean);
  const points = from && to ? [from, ...filledStops, to] : [];

  const say = useCallback((text, tone = 'ok') => setNotice({ text, tone, at: Date.now() }), []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!pop) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setPop(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setPop(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pop]);

  // La ventana flotante abre hacia donde haya más espacio y nunca se sale de la pantalla.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!pop || !el) return undefined;
    const place = () => {
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 320 && above > below;
      el.classList.toggle('is-pop-up', up);
      el.style.setProperty('--route-pop-max', `${Math.max(160, Math.floor(up ? above : below))}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      el.classList.remove('is-pop-up');
    };
  }, [pop]);

  useEffect(() => {
    setSendState({});
  }, [plan?.key]);

  const alerts = useMemo(() => {
    const out = [];
    if (plan?.status === 'ok' && from && to) {
      const labels = ['El origen (A)', ...filledStops.map((_, i) => `La parada ${i + 1}`), 'El destino (B)'];
      (plan.snapM || []).forEach((m, i) => {
        if (m > FAR_FROM_ROAD_M && labels[i]) {
          out.push({
            key: `snap${i}`,
            tone: 'warn',
            icon: 'warn',
            text: `${labels[i]} está a ${formatDistance(m)} del camino más cercano: la ruta llega hasta el camino, el resto es a pie o por brecha.`,
          });
        }
      });
      const crossed = fencesCrossed(current, geofences);
      if (crossed.length) {
        out.push({
          key: 'fences',
          tone: 'fence',
          icon: 'fence',
          text: `La ruta cruza ${crossed.length === 1 ? 'la geocerca' : `${crossed.length} geocercas`}:`,
          fences: crossed,
        });
      }
      if (isAdmin && plan.source === 'publico') {
        out.push({ key: 'public', tone: 'info', icon: 'info', text: PUBLIC_SERVICE_NOTE });
      }
    }
    return out;
    // filledStops/points derivan de from/stops/to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, current, geofences, isAdmin, from, to, stops]);

  const openGoogle = () => {
    if (!points.length) return;
    const text = routeShareText(points, current);
    const copied = copyTextSync(text);
    window.open(googleMapsUrl(points), '_blank', 'noopener');
    say(copied ? 'Ruta copiada: pégala donde quieras (WhatsApp, chat, correo…).' : 'Se abrió Google Maps; no se pudo copiar la ruta.', copied ? 'ok' : 'warn');
  };

  const copyLink = () => {
    if (!points.length) return;
    const ok = copyTextSync(routeShareText(points, current));
    say(ok ? 'Ruta copiada.' : 'No se pudo copiar.', ok ? 'ok' : 'warn');
  };

  const sendDm = async (p, text) => {
    await sendDmMessage(token, p.userId, text);
  };

  const sendCurrent = async (p) => {
    setSendState((s) => ({ ...s, [p.userId]: 'sending' }));
    try {
      await sendDm(p, routeShareText(points, current));
      setSendState((s) => ({ ...s, [p.userId]: 'sent' }));
      say(`Ruta enviada por chat a ${p.name}.`);
    } catch {
      setSendState((s) => ({ ...s, [p.userId]: 'error' }));
      say(`No se pudo enviar a ${p.name}.`, 'warn');
    }
  };

  const routeFromOperator = (p) => {
    onFrom(
      routePointFrom(
        {
          id: `op:${p.userId}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`,
          name: p.name,
          detail: `Posición ${ageLabel(p.recordedAt).toLowerCase()}`,
          lat: p.lat,
          lng: p.lng,
        },
        'operador'
      )
    );
    setPop(null);
  };

  const setStop = (i, p) => onStops(stops.map((s, k) => (k === i ? p : s)));
  const removeStop = (i) => {
    onStops(stops.filter((_, k) => k !== i));
    if (pick === `stop:${i}`) onPick(null);
  };
  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;
    onStops([...stops, null]);
    onPick(`stop:${stops.length}`);
  };
  const swap = () => {
    onFrom(to);
    onTo(from);
    onStops([...stops].reverse());
  };

  const togglePop = (name) => setPop((p) => (p === name ? null : name));
  const shareUrl = points.length ? googleMapsUrl(points) : '';

  return (
    <div className="map-route" ref={rootRef}>
      <div className="map-route-fields">
        <PlaceField
          letter="A"
          tone="a"
          placeholder="Origen: dirección, lugar, operador o coordenadas"
          token={token}
          value={from}
          onChange={onFrom}
          localItems={localItems}
          getBias={getBias}
          picking={pick === 'from'}
          onPick={() => onPick(pick === 'from' ? null : 'from')}
          extra={
            operators.length ? (
              <button
                type="button"
                className={`map-route-icon-btn${pop === 'opfrom' ? ' is-on' : ''}`}
                onClick={() => togglePop('opfrom')}
                title="Desde la posición actual de un operador"
                aria-pressed={pop === 'opfrom'}
              >
                <Icon name="operator" />
              </button>
            ) : null
          }
        />
        <button
          type="button"
          className="map-route-icon-btn map-route-swap"
          onClick={swap}
          disabled={!from && !to}
          title="Invertir el recorrido (B → A)"
          aria-label="Invertir el recorrido"
        >
          <Icon name="swap" />
        </button>
        {stops.map((s, i) => (
          <PlaceField
            key={`stop-${i}`}
            letter={String(i + 1)}
            tone="stop"
            placeholder={`Parada ${i + 1}`}
            token={token}
            value={s}
            onChange={(p) => setStop(i, p)}
            localItems={localItems}
            getBias={getBias}
            picking={pick === `stop:${i}`}
            onPick={() => onPick(pick === `stop:${i}` ? null : `stop:${i}`)}
            onRemove={() => removeStop(i)}
          />
        ))}
        <PlaceField
          letter="B"
          tone="b"
          placeholder="Destino: dirección, lugar, operador o coordenadas"
          token={token}
          value={to}
          onChange={onTo}
          localItems={localItems}
          getBias={getBias}
          picking={pick === 'to'}
          onPick={() => onPick(pick === 'to' ? null : 'to')}
        />
        <span className="map-route-tools">
          <button
            type="button"
            className="cc-btn ghost cc-btn-sm map-route-btn"
            onClick={addStop}
            disabled={stops.length >= MAX_STOPS}
            title={stops.length >= MAX_STOPS ? `Máximo ${MAX_STOPS} paradas` : 'Agregar una parada intermedia'}
          >
            <Icon name="plus" /> Parada
          </button>
          <button
            type="button"
            className={`cc-btn ghost cc-btn-sm map-route-btn${pop === 'saved' ? ' is-on' : ''}`}
            onClick={() => togglePop('saved')}
            title="Rutas frecuentes de la organización"
            aria-pressed={pop === 'saved'}
          >
            <Icon name="star" /> Frecuentes
          </button>
        </span>
      </div>

      {from || to ? (
        <div className="map-route-summary">
          {!from || !to ? (
            <p className="map-ops-hint muted map-route-hint">
              {pick
                ? `Haz clic en el mapa para fijar ${pick === 'from' ? 'el origen (A)' : pick === 'to' ? 'el destino (B)' : 'la parada'}.`
                : !from
                  ? 'Falta el origen (A): escríbelo, elígelo en el mapa o usa un operador.'
                  : 'Falta el destino (B): escríbelo o elígelo en el mapa.'}
            </p>
          ) : plan?.status === 'loading' ? (
            <span className="map-route-status muted">
              <span className="map-search-spinner" aria-hidden /> Calculando ruta…
            </span>
          ) : plan?.status === 'error' ? (
            <span className="map-route-status is-error">{ROUTE_ERRORS[plan.reason] || ROUTE_ERRORS.sin_servicio}</span>
          ) : routes.length ? (
            <>
              {routes.length === 1 ? (
                <div className="map-route-options">
                  <div
                    className="map-route-option is-active is-single"
                    title={routes[0].via?.length ? `Vía ${routes[0].via.join(' y ')}` : undefined}
                  >
                    <strong>{formatDuration(routes[0].durationS)}</strong>
                    <span>{formatDistance(routes[0].distanceM)}</span>
                  </div>
                </div>
              ) : (
              <div className="map-route-options" role="radiogroup" aria-label="Rutas">
                {routes.map((r, i) => {
                  const extra = Math.round((r.durationS - fastest) / 60);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={i === active}
                      className={`map-route-option${i === active ? ' is-active' : ''}`}
                      onClick={() => onActive(i)}
                      title={r.via?.length ? `Vía ${r.via.join(' y ')}` : undefined}
                    >
                      <strong>{formatDuration(r.durationS)}</strong>
                      <span>
                        {formatDistance(r.distanceM)}
                        {routes.length > 1 ? (i === 0 ? ' · recomendada' : extra > 0 ? ` · +${extra} min` : '') : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}
              {current ? (
                <span className="map-route-eta muted" title="Tiempo estimado sin tráfico en tiempo real">
                  {current.via?.length ? `Vía ${current.via[0]} · ` : ''}
                  llegada ≈ {arrivalTime(current.durationS)} · sin tráfico
                </span>
              ) : null}
            </>
          ) : null}
          <span className="map-route-actions">
            {points.length && routes.length ? (
              <>
                <button
                  type="button"
                  className="cc-btn primary cc-btn-sm map-route-btn"
                  onClick={openGoogle}
                  title="Abre la ruta en Google Maps (con tráfico y navegación) y la copia para enviarla"
                >
                  <Icon name="gmaps" /> Google Maps
                </button>
                <button
                  type="button"
                  className={`cc-btn ghost cc-btn-sm map-route-btn${pop === 'send' ? ' is-on' : ''}`}
                  onClick={() => togglePop('send')}
                  title="Enviar la ruta por el chat de SICOM"
                  aria-pressed={pop === 'send'}
                >
                  <Icon name="send" /> Enviar
                </button>
                <button
                  type="button"
                  className={`cc-btn ghost cc-btn-sm map-route-btn${pop === 'qr' ? ' is-on' : ''}`}
                  onClick={() => togglePop('qr')}
                  title="Código QR para abrir la ruta en un celular"
                  aria-pressed={pop === 'qr'}
                >
                  <Icon name="qr" /> QR
                </button>
              </>
            ) : null}
            {to && operators.length ? (
              <button
                type="button"
                className={`cc-btn ghost cc-btn-sm map-route-btn${pop === 'eta' ? ' is-on' : ''}`}
                onClick={() => togglePop('eta')}
                title="Ordena a los operadores por tiempo por carretera hasta el destino"
                aria-pressed={pop === 'eta'}
              >
                <Icon name="race" /> ¿Quién llega primero?
              </button>
            ) : null}
            {routes.length ? (
              <button type="button" className="cc-btn ghost cc-btn-sm map-route-btn" onClick={onFit} title="Ver toda la ruta">
                <Icon name="fit" /> Ver ruta
              </button>
            ) : null}
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onClear} title="Quitar la ruta">
              Quitar
            </button>
          </span>
        </div>
      ) : (
        <p className="map-ops-hint muted map-route-hint">
          Escribe origen y destino, elígelos en el mapa (también con clic derecho) o carga una ruta frecuente.
        </p>
      )}

      {alerts.length ? (
        <ul className="map-route-alerts">
          {alerts.map((a) => (
            <li key={a.key} className={`map-route-alert is-${a.tone}`}>
              <Icon name={a.icon} />
              <span>
                {a.text}
                {a.fences
                  ? a.fences.map((g) => (
                      <span key={g.id} className="map-route-fence-chip">
                        <i style={{ background: g.color || '#243d20' }} aria-hidden />
                        {g.name}
                      </span>
                    ))
                  : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <div className={`map-route-notice is-${notice.tone}`} role="status" key={notice.at}>
          {notice.text}
        </div>
      ) : null}

      {pop === 'eta' && to ? (
        <EtaPop
          token={token}
          dest={to}
          operators={operators}
          freshMinutes={freshMinutes}
          isAdmin={isAdmin}
          onClose={() => setPop(null)}
          onRouteFrom={routeFromOperator}
          onSend={sendDm}
        />
      ) : null}
      {pop === 'opfrom' ? (
        <OperatorPickPop
          icon="operator"
          title="Desde operador"
          sub="La ruta empieza en su posición actual"
          operators={operators}
          freshMinutes={freshMinutes}
          onClose={() => setPop(null)}
          actionLabel="Usar"
          onPickOne={routeFromOperator}
        />
      ) : null}
      {pop === 'send' && points.length ? (
        <OperatorPickPop
          icon="send"
          title="Enviar ruta por chat"
          sub={`${from.name} → ${to.name}`}
          operators={operators}
          freshMinutes={freshMinutes}
          onClose={() => setPop(null)}
          actionLabel="Enviar"
          onPickOne={sendCurrent}
          statusOf={(p) => sendState[p.userId]}
          footer="Le llega el enlace de Google Maps en su chat; lo abre con un toque."
        />
      ) : null}
      {pop === 'qr' && shareUrl ? <QrPop url={shareUrl} onClose={() => setPop(null)} onCopy={copyLink} /> : null}
      {pop === 'saved' ? (
        <SavedPop
          token={token}
          from={from}
          to={to}
          stops={filledStops}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setPop(null)}
          onLoad={(r) => {
            onLoadSaved(r);
            setPop(null);
            say(`Ruta «${r.name}» cargada.`);
          }}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- mapa */

function letterIcon(letter, tone) {
  return L.divIcon({
    className: 'map-route-pin-wrap',
    html: `<span class="map-route-pin is-${tone}">${letter}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const PIN_A = letterIcon('A', 'a');
const PIN_B = letterIcon('B', 'b');
const PIN_STOPS = Array.from({ length: MAX_STOPS }, (_, i) => letterIcon(String(i + 1), 'stop'));

/** Dibujo de la ruta en el mapa, marcadores A/paradas/B arrastrables y selección de puntos con clic. */
export function MapRouteLayer({ from, to, stops, plan, active, onActive, fitToken, pick, onPicked, onMove }) {
  const map = useMap();
  const routes = plan?.status === 'ok' ? plan.routes : [];

  useMapEvents({
    click(e) {
      if (!pick) return;
      onPicked(pick, e.latlng);
    },
  });

  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle('map-route-picking', Boolean(pick));
    return () => el.classList.remove('map-route-picking');
  }, [map, pick]);

  const fitKey = plan?.status === 'ok' ? `${plan.key}#${fitToken}` : '';
  useEffect(() => {
    if (!fitKey) return;
    const r = routes[active] || routes[0];
    if (!r?.points?.length) return;
    map.flyToBounds(L.latLngBounds(r.points), { padding: [50, 50], maxZoom: 17, duration: 0.8 });
    // Solo al llegar una ruta nueva o al pedir «Ver ruta».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <>
      {routes.map((r, i) =>
        i === active ? null : (
          <Polyline
            key={`alt-${plan.key}-${i}`}
            positions={r.points}
            pathOptions={{ color: ALT_COLOR, weight: 6, opacity: 0.75 }}
            eventHandlers={{ click: () => onActive(i) }}
          />
        )
      )}
      {routes[active] ? (
        <>
          <Polyline
            key={`casing-${plan.key}-${active}`}
            positions={routes[active].points}
            interactive={false}
            pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }}
          />
          <Polyline
            key={`main-${plan.key}-${active}`}
            positions={routes[active].points}
            interactive={false}
            pathOptions={{ color: ROUTE_COLOR, weight: 6, opacity: 0.95 }}
          />
        </>
      ) : null}
      {(stops || []).map((s, i) =>
        s ? (
          <Marker
            key={`stop-${i}`}
            position={[s.lat, s.lng]}
            icon={PIN_STOPS[i]}
            draggable
            zIndexOffset={650}
            eventHandlers={{ dragend: (e) => onMove(`stop:${i}`, e.target.getLatLng()) }}
          />
        ) : null
      )}
      {from ? (
        <Marker
          position={[from.lat, from.lng]}
          icon={PIN_A}
          draggable
          zIndexOffset={700}
          eventHandlers={{ dragend: (e) => onMove('from', e.target.getLatLng()) }}
        />
      ) : null}
      {to ? (
        <Marker
          position={[to.lat, to.lng]}
          icon={PIN_B}
          draggable
          zIndexOffset={700}
          eventHandlers={{ dragend: (e) => onMove('to', e.target.getLatLng()) }}
        />
      ) : null}
    </>
  );
}
