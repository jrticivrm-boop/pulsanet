import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { geoRoute, geoSearch } from '../api';
import { SEARCH_KIND_LABELS, SearchKindIcon, localMatches, parseCoordinates } from './MapSearchPanel.jsx';

const DEBOUNCE_MS = 220;
const ROUTE_COLOR = '#1a73e8';
const ALT_COLOR = '#7a8794';

const ROUTE_ERRORS = {
  sin_ruta: 'No hay ruta en vehículo entre esos puntos.',
  fuera_de_rango: 'Los puntos están demasiado lejos entre sí.',
  routing_deshabilitado: 'El cálculo de rutas está deshabilitado en el servidor.',
  timeout: 'El servicio de rutas no respondió a tiempo. Intenta de nuevo.',
  sin_servicio: 'Sin servicio de rutas (revisa la salida a internet del servidor).',
};

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

/**
 * Pide la ruta cuando hay A y B. Vive en el mapa (no en el panel) para que la ruta
 * siga dibujada al cambiar de pestaña.
 */
export function useRoutePlan(token, from, to) {
  const [plan, setPlan] = useState(null);
  const key = from && to ? `${from.lat.toFixed(6)},${from.lng.toFixed(6)}>${to.lat.toFixed(6)},${to.lng.toFixed(6)}` : '';
  useEffect(() => {
    if (!key) {
      setPlan(null);
      return undefined;
    }
    const ac = new AbortController();
    setPlan({ key, status: 'loading', routes: [] });
    geoRoute(token, from, to, ac.signal)
      .then((d) => {
        if (d?.ok && Array.isArray(d.routes) && d.routes.length) setPlan({ key, status: 'ok', routes: d.routes });
        else setPlan({ key, status: 'error', routes: [], reason: d?.reason || 'sin_servicio' });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setPlan({ key, status: 'error', routes: [], reason: 'sin_servicio' });
      });
    return () => ac.abort();
    // from/to se reflejan en `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);
  return plan;
}

function PickIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </svg>
  );
}

/** Campo A / B con autocompletado (lugares propios + OpenStreetMap + coordenadas). */
function PlaceField({ letter, placeholder, token, value, onChange, localItems, getBias, picking, onPick }) {
  const [q, setQ] = useState(value?.name || '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQ(value?.name || '');
  }, [value?.id, value?.name]);

  const trimmed = q.trim();
  const editing = open && trimmed !== String(value?.name || '').trim();

  useEffect(() => {
    if (!editing || !trimmed) {
      setItems([]);
      setLoading(false);
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
    if (trimmed.length < 3) return undefined;
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      const bias = getBias?.() || null;
      geoSearch(token, { q: trimmed, lat: bias?.lat, lng: bias?.lng, src: 'osm' }, ac.signal)
        .then((d) => {
          const remote = Array.isArray(d?.results) ? d.results : [];
          setItems([...local, ...remote].slice(0, 10));
        })
        .catch(() => {})
        .finally(() => {
          if (abortRef.current === ac) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
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
    <div className={`map-route-field${picking ? ' is-picking' : ''}`}>
      <span className={`map-route-letter is-${letter.toLowerCase()}`} aria-hidden>
        {letter}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="map-route-input"
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
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
      <button
        type="button"
        className={`map-route-pick${picking ? ' is-on' : ''}`}
        onClick={onPick}
        title={picking ? 'Haz clic en el mapa para fijar el punto' : 'Elegir el punto en el mapa'}
        aria-pressed={picking}
      >
        <PickIcon />
      </button>
      {editing && (items.length || loading) ? (
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
          {loading ? <li className="map-search-empty muted">Buscando…</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Pestaña «Ruta»: cómo llegar de A a B en vehículo (OSRM), ruta recomendada y alternativas.
 */
export default function MapRoutePanel({
  token,
  localItems,
  getBias,
  from,
  to,
  onFrom,
  onTo,
  plan,
  active,
  onActive,
  pick,
  onPick,
  onClear,
  onFit,
  onFocusStep,
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const routes = plan?.status === 'ok' ? plan.routes : [];
  const current = routes[active] || routes[0] || null;
  const fastest = routes.length ? Math.min(...routes.map((r) => r.durationS)) : 0;

  useEffect(() => {
    setStepsOpen(false);
  }, [plan?.key]);

  const steps = useMemo(() => current?.steps || [], [current]);

  return (
    <div className="map-route">
      <div className="map-route-fields">
        <PlaceField
          letter="A"
          placeholder="Origen: dirección, lugar, operador o coordenadas"
          token={token}
          value={from}
          onChange={onFrom}
          localItems={localItems}
          getBias={getBias}
          picking={pick === 'from'}
          onPick={() => onPick(pick === 'from' ? null : 'from')}
        />
        <button
          type="button"
          className="map-route-swap"
          onClick={() => {
            onFrom(to);
            onTo(from);
          }}
          disabled={!from && !to}
          title="Intercambiar origen y destino"
          aria-label="Intercambiar origen y destino"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
          </svg>
        </button>
        <PlaceField
          letter="B"
          placeholder="Destino: dirección, lugar, operador o coordenadas"
          token={token}
          value={to}
          onChange={onTo}
          localItems={localItems}
          getBias={getBias}
          picking={pick === 'to'}
          onPick={() => onPick(pick === 'to' ? null : 'to')}
        />
      </div>

      <div className="map-route-summary">
        {!from || !to ? (
          <p className="map-ops-hint muted map-route-hint">
            {pick
              ? `Haz clic en el mapa para fijar ${pick === 'from' ? 'el origen (A)' : 'el destino (B)'}.`
              : 'Escribe origen y destino, o elígelos en el mapa (también con clic derecho). Los puntos se pueden arrastrar.'}
          </p>
        ) : plan?.status === 'loading' ? (
          <span className="map-route-status muted">
            <span className="map-search-spinner" aria-hidden /> Calculando ruta…
          </span>
        ) : plan?.status === 'error' ? (
          <span className="map-route-status is-error">{ROUTE_ERRORS[plan.reason] || ROUTE_ERRORS.sin_servicio}</span>
        ) : routes.length ? (
          <>
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
                      {i === 0 ? ' · recomendada' : extra > 0 ? ` · +${extra} min` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {current ? (
              <span className="map-route-eta muted" title="Tiempo estimado sin tráfico en tiempo real">
                {current.via?.length ? `Vía ${current.via[0]}` : ''}
                {current.via?.length ? ' · ' : ''}
                llegada ≈ {arrivalTime(current.durationS)}
              </span>
            ) : null}
            <span className="map-route-actions">
              <button
                type="button"
                className={`cc-btn ghost cc-btn-sm${stepsOpen ? ' is-on' : ''}`}
                onClick={() => setStepsOpen((v) => !v)}
                aria-expanded={stepsOpen}
              >
                Indicaciones
              </button>
              <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onFit} title="Ver toda la ruta">
                Ver ruta
              </button>
              <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onClear} title="Quitar la ruta">
                Quitar
              </button>
            </span>
          </>
        ) : null}
        {(from || to) && !(plan?.status === 'ok' && routes.length) ? (
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onClear}>
            Quitar
          </button>
        ) : null}
      </div>

      {stepsOpen && steps.length ? (
        <ol className="map-search-list map-route-steps">
          {steps.map((s, i) => (
            <li
              key={i}
              className="map-search-item"
              onPointerDown={(e) => {
                e.preventDefault();
                onFocusStep?.(s);
              }}
            >
              <span className="map-route-step-n">{i + 1}</span>
              <span className="map-search-item-text">
                <span className="map-search-item-name">{s.text}</span>
              </span>
              {s.distanceM ? <span className="map-search-item-kind">{formatDistance(s.distanceM)}</span> : null}
            </li>
          ))}
          <li className="map-search-attrib">Rutas © OpenStreetMap (OSRM) · tiempos sin tráfico en tiempo real</li>
        </ol>
      ) : null}
    </div>
  );
}

function letterIcon(letter) {
  return L.divIcon({
    className: 'map-route-pin-wrap',
    html: `<span class="map-route-pin is-${letter.toLowerCase()}">${letter}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const PIN_A = letterIcon('A');
const PIN_B = letterIcon('B');

/** Dibujo de la ruta en el mapa, marcadores A/B arrastrables y selección de puntos con clic. */
export function MapRouteLayer({ from, to, plan, active, onActive, fitToken, focus, pick, onPicked, onMove }) {
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

  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [map, focus]);

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
