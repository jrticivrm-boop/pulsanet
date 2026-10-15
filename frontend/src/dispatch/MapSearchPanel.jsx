import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { geoSearch, geoReverse, fetchGeoPlaceOutline } from '../api';
import { MapCoordsLink } from './MapCoordsLink.jsx';

const RECENT_KEY = 'tacticalptx_map_search_recent';
const RECENT_MAX = 8;
const DEBOUNCE_MS = 260;

export const SEARCH_KIND_LABELS = {
  coordenadas: 'Coordenadas',
  pais: 'País',
  estado: 'Estado',
  municipio: 'Municipio',
  ciudad: 'Ciudad',
  pueblo: 'Pueblo',
  localidad: 'Localidad',
  colonia: 'Colonia',
  calle: 'Calle',
  carretera: 'Carretera',
  direccion: 'Dirección',
  lugar: 'Lugar',
  ejido: 'Ejido',
  comunidad: 'Comunidad agraria',
  sitio: 'Sitio táctico',
  geocerca: 'Geocerca',
  operador: 'Operador',
};

/** Zoom al elegir un punto sin recuadro. */
const KIND_ZOOM = {
  pais: 5,
  estado: 7,
  municipio: 11,
  ciudad: 12,
  pueblo: 14,
  localidad: 15,
  colonia: 15,
  calle: 17,
  carretera: 13,
  direccion: 18,
  lugar: 17,
  ejido: 14,
  comunidad: 14,
  sitio: 17,
  geocerca: 16,
  operador: 17,
  coordenadas: 17,
};

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function dmsToDecimal(deg, min, sec, hemi) {
  let v = Math.abs(Number(deg)) + (Number(min) || 0) / 60 + (Number(sec) || 0) / 3600;
  if (/[SsWwOo]/.test(hemi || '') || Number(deg) < 0) v = -v;
  return v;
}

/**
 * «19.4326, -99.1332», «19.4326 -99.1332» o «19°25'57"N 99°07'59"W».
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseCoordinates(text) {
  const s = String(text || '').trim();
  const dec = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (dec) {
    const lat = Number(dec[1]);
    const lng = Number(dec[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    return null;
  }
  const part = String.raw`(-?\d{1,3})\s*[°º]\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′])?\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:["″]|''))?\s*([NSEWOnsewo])?`;
  const dms = s.match(new RegExp(`^${part}\\s*[,;]?\\s*${part}$`));
  if (dms) {
    const lat = dmsToDecimal(dms[1], dms[2], dms[3], dms[4]);
    // Sin hemisferio en México la longitud es oeste.
    const lng = dmsToDecimal(dms[5], dms[6], dms[7], dms[8] || (Number(dms[5]) > 0 ? 'W' : ''));
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((r) => r && Number.isFinite(r.lat)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

function SearchKindIcon({ kind }) {
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
  if (kind === 'calle' || kind === 'carretera') {
    return (
      <svg {...common}>
        <path d="M8 3 5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" />
      </svg>
    );
  }
  if (kind === 'estado' || kind === 'municipio' || kind === 'pais' || kind === 'ejido' || kind === 'comunidad') {
    return (
      <svg {...common}>
        <path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </svg>
    );
  }
  if (kind === 'ciudad' || kind === 'pueblo' || kind === 'localidad' || kind === 'colonia') {
    return (
      <svg {...common}>
        <path d="M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13" />
        <path d="M13.5 10h2M13.5 13.5h2M13.5 17h2" />
      </svg>
    );
  }
  if (kind === 'operador') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }
  if (kind === 'geocerca') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7.5" strokeDasharray="3 2.4" />
        <circle cx="12" cy="12" r="1.8" />
      </svg>
    );
  }
  if (kind === 'coordenadas') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="6.5" />
        <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      </svg>
    );
  }
  if (kind === 'reciente') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function localMatches(items, q) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items
    .filter((it) => {
      const hay = normalize(`${it.name} ${it.detail || ''}`);
      return words.every((w) => hay.includes(w));
    })
    .slice(0, 5);
}

/**
 * Pestaña «Buscar» del mapa: autocompletado (Photon/OSM + ejidos RAN + datos propios).
 *
 * @param {{
 *   token: string,
 *   localItems: Array<{ id: string, kind: string, name: string, detail?: string, lat: number, lng: number }>,
 *   getBias: () => ({ lat: number, lng: number } | null),
 *   selected: object | null,
 *   onSelect: (result: object) => void,
 *   onClear: () => void,
 *   onRecenter: () => void,
 *   onCreateGeofence?: (result: object) => void,
 * }} props
 */
export default function MapSearchPanel({
  token,
  localItems,
  getBias,
  selected,
  onSelect,
  onClear,
  onRecenter,
  onCreateGeofence,
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState([]);
  const [status, setStatus] = useState('ok');
  const [active, setActive] = useState(-1);
  const [world, setWorld] = useState(false);
  const [recent, setRecent] = useState(() => readRecent());
  const [copied, setCopied] = useState(false);
  const seqRef = useRef(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const trimmed = q.trim();
  const coords = useMemo(() => parseCoordinates(trimmed), [trimmed]);

  useEffect(() => {
    const seq = ++seqRef.current;
    if (coords || trimmed.length < 2) {
      setRemote([]);
      setLoading(false);
      setStatus('ok');
      return undefined;
    }
    setLoading(true);
    const id = window.setTimeout(async () => {
      try {
        const bias = getBias?.() || null;
        const data = await geoSearch(token, {
          q: trimmed,
          lat: bias?.lat,
          lng: bias?.lng,
          world,
        });
        if (seq !== seqRef.current) return;
        setRemote(Array.isArray(data?.results) ? data.results : []);
        setStatus(data?.status || 'ok');
      } catch {
        if (seq !== seqRef.current) return;
        setRemote([]);
        setStatus('sin_servicio');
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // getBias se lee al disparar; no debe relanzar la búsqueda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, coords, world, token]);

  const options = useMemo(() => {
    if (!trimmed) return recent.map((r) => ({ ...r, recent: true }));
    const out = [];
    if (coords) {
      out.push({
        id: `coord:${coords.lat},${coords.lng}`,
        kind: 'coordenadas',
        name: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        detail: 'Ir a estas coordenadas',
        lat: coords.lat,
        lng: coords.lng,
      });
      return out;
    }
    out.push(...localMatches(localItems || [], trimmed));
    out.push(...remote);
    return out;
  }, [trimmed, coords, recent, localItems, remote]);

  useEffect(() => {
    setActive(options.length ? 0 : -1);
  }, [options]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const choose = useCallback(
    (opt) => {
      if (!opt) return;
      const clean = { ...opt };
      delete clean.recent;
      onSelect(clean);
      setOpen(false);
      setQ(clean.name);
      if (clean.kind !== 'operador') {
        setRecent((prev) => {
          const next = [clean, ...prev.filter((r) => r.id !== clean.id)].slice(0, RECENT_MAX);
          writeRecent(next);
          return next;
        });
      }
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0) choose(options[active]);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  const clearAll = () => {
    setQ('');
    setRemote([]);
    onClear();
    inputRef.current?.focus();
    setOpen(true);
  };

  const copyCoords = async () => {
    if (!selected) return;
    const text = `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const showList = open && (options.length > 0 || (trimmed.length >= 2 && !coords));
  const statusMsg =
    status === 'timeout' || status === 'sin_servicio'
      ? 'Sin conexión con el buscador en línea; solo datos propios y ejidos.'
      : status === 'ocupado'
        ? 'Buscador ocupado, intenta de nuevo en un momento.'
        : '';

  return (
    <div className="map-search" ref={wrapRef}>
      <div className="map-search-box">
        <span className="map-search-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          className="map-search-input"
          placeholder="Buscar estado, municipio, ciudad, colonia, calle, carretera, ejido o coordenadas…"
          value={q}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls="map-search-list"
          aria-autocomplete="list"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading ? <span className="map-search-spinner" aria-label="Buscando" /> : null}
        {q ? (
          <button type="button" className="map-search-clear" onClick={clearAll} title="Limpiar" aria-label="Limpiar búsqueda">
            ×
          </button>
        ) : null}
        <label className="map-search-world" title="Buscar también fuera de México">
          <input type="checkbox" checked={world} onChange={(e) => setWorld(e.target.checked)} />
          <span>Mundo</span>
        </label>

        {showList ? (
          <ul className="map-search-list" id="map-search-list" role="listbox">
            {!trimmed && options.length ? <li className="map-search-section">Recientes</li> : null}
            {options.map((opt, i) => (
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
                  <SearchKindIcon kind={opt.recent ? 'reciente' : opt.kind} />
                </span>
                <span className="map-search-item-text">
                  <span className="map-search-item-name">{opt.name}</span>
                  {opt.detail ? <span className="map-search-item-detail">{opt.detail}</span> : null}
                </span>
                <span className="map-search-item-kind">{SEARCH_KIND_LABELS[opt.kind] || 'Lugar'}</span>
              </li>
            ))}
            {trimmed.length >= 2 && !coords && !loading && !options.length ? (
              <li className="map-search-empty">Sin resultados. Prueba con menos palabras o agrega el municipio/estado.</li>
            ) : null}
            {statusMsg && trimmed ? <li className="map-search-empty">{statusMsg}</li> : null}
            {trimmed && !coords ? (
              <li className="map-search-attrib">Datos © OpenStreetMap · ejidos: RAN</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <div className="map-search-selected">
          <span className={`map-search-item-icon kind-${selected.kind}`}>
            <SearchKindIcon kind={selected.kind} />
          </span>
          <span className="map-search-item-text">
            <span className="map-search-item-name">
              {selected.name}
              <em className="map-search-item-kind">{SEARCH_KIND_LABELS[selected.kind] || 'Lugar'}</em>
            </span>
            <span className="map-search-item-detail">
              {selected.detail ? `${selected.detail} · ` : ''}
              <MapCoordsLink lat={selected.lat} lng={selected.lng} />
            </span>
          </span>
          <span className="map-search-actions">
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={onRecenter} title="Volver a centrar el mapa aquí">
              Centrar
            </button>
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={copyCoords} title="Copiar latitud, longitud">
              {copied ? 'Copiado' : 'Copiar coord.'}
            </button>
            {onCreateGeofence ? (
              <button
                type="button"
                className="cc-btn ghost cc-btn-sm"
                onClick={() => onCreateGeofence(selected)}
                title="Crear una geocerca con centro en este punto"
              >
                Crear geocerca
              </button>
            ) : null}
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={clearAll} title="Quitar marcador">
              Quitar
            </button>
          </span>
        </div>
      ) : (
        <p className="map-ops-hint muted map-search-hint">
          Escribe parte del nombre y elige una sugerencia. Clic derecho en el mapa: «¿Qué hay aquí?».
        </p>
      )}
    </div>
  );
}

const SEARCH_PIN_ICON = L.divIcon({
  className: 'map-search-pin',
  html:
    '<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true">' +
    '<path d="M15 39s13-12.4 13-23.5A13 13 0 0 0 2 15.5C2 26.6 15 39 15 39z" fill="#d93025" stroke="#7a1410" stroke-width="1.6"/>' +
    '<circle cx="15" cy="15.5" r="5" fill="#fff"/></svg>',
  iconSize: [30, 40],
  iconAnchor: [15, 39],
  popupAnchor: [0, -34],
});

/**
 * Capa del resultado elegido: marcador, contorno (ejidos) y vuelo al lugar.
 * También expone el mapa a la pestaña (sesgo por cercanía) vía `mapRef`.
 */
export function MapSearchLayer({ token, selected, flyToken, mapRef }) {
  const map = useMap();
  const [outline, setOutline] = useState(null);

  useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    setOutline(null);
    if (!selected?.placeId || !selected.hasOutline) return undefined;
    let alive = true;
    fetchGeoPlaceOutline(token, selected.placeId)
      .then((d) => {
        if (alive && Array.isArray(d?.outline)) setOutline(d.outline);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, selected?.placeId, selected?.hasOutline]);

  useEffect(() => {
    if (!selected || !flyToken) return;
    const bbox = selected.bbox;
    const spanOk =
      Array.isArray(bbox) &&
      bbox.length === 2 &&
      (Math.abs(bbox[1][0] - bbox[0][0]) > 0.0008 || Math.abs(bbox[1][1] - bbox[0][1]) > 0.0008);
    if (spanOk) {
      map.flyToBounds(L.latLngBounds(bbox), { padding: [40, 40], maxZoom: 17, duration: 0.8 });
    } else {
      const z = KIND_ZOOM[selected.kind] || 16;
      map.flyTo([selected.lat, selected.lng], Math.max(z, Math.min(map.getZoom(), 18)), { duration: 0.8 });
    }
    // Solo al elegir / «Centrar» (flyToken), no al reponer el mismo resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToken]);

  if (!selected) return null;
  return (
    <>
      {outline ? (
        <Polygon
          positions={outline}
          interactive={false}
          pathOptions={{ color: '#d93025', weight: 2, fillColor: '#d93025', fillOpacity: 0.08, dashArray: '6 4' }}
        />
      ) : null}
      <Marker position={[selected.lat, selected.lng]} icon={SEARCH_PIN_ICON} zIndexOffset={600}>
        <Popup>
          <strong>{selected.name}</strong>
          <br />
          <span className="muted">{SEARCH_KIND_LABELS[selected.kind] || 'Lugar'}</span>
          {selected.detail ? (
            <>
              <br />
              {selected.detail}
            </>
          ) : null}
          <br />
          <MapCoordsLink lat={selected.lat} lng={selected.lng} />
        </Popup>
      </Marker>
    </>
  );
}

/** Clic derecho (o pulsación larga) en el mapa: «¿Qué hay aquí?». */
export function MapReverseLookup({ token, enabled = true, onUse }) {
  const [probe, setProbe] = useState(null);
  const seqRef = useRef(0);

  useMapEvents({
    contextmenu(e) {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      const seq = ++seqRef.current;
      setProbe({ lat, lng, loading: true });
      geoReverse(token, lat, lng)
        .then((d) => {
          if (seq === seqRef.current) setProbe({ lat, lng, loading: false, place: d?.place, ejido: d?.ejido });
        })
        .catch(() => {
          if (seq === seqRef.current) setProbe({ lat, lng, loading: false, error: true });
        });
    },
  });

  if (!probe) return null;
  const place = probe.place;
  return (
    <Popup position={[probe.lat, probe.lng]} eventHandlers={{ remove: () => setProbe(null) }}>
      <div className="map-reverse-pop">
        <strong>¿Qué hay aquí?</strong>
        {probe.loading ? <div className="muted">Buscando dirección…</div> : null}
        {!probe.loading && place ? (
          <div>
            {place.name}
            {place.detail ? <div className="muted">{place.detail}</div> : null}
          </div>
        ) : null}
        {!probe.loading && probe.ejido ? (
          <div>
            {SEARCH_KIND_LABELS[probe.ejido.kind] || 'Ejido'}: <strong>{probe.ejido.name}</strong>
          </div>
        ) : null}
        {!probe.loading && !place && !probe.ejido ? (
          <div className="muted">{probe.error ? 'No se pudo consultar.' : 'Sin dirección conocida.'}</div>
        ) : null}
        <MapCoordsLink lat={probe.lat} lng={probe.lng} decimals={6} />
        {onUse && !probe.loading ? (
          <div>
            <button
              type="button"
              className="cc-btn ghost cc-btn-sm"
              onClick={() => {
                onUse({
                  id: `coord:${probe.lat},${probe.lng}`,
                  kind: place ? place.kind : 'coordenadas',
                  name: place?.name || `${probe.lat.toFixed(6)}, ${probe.lng.toFixed(6)}`,
                  detail: [place?.detail, probe.ejido ? `${SEARCH_KIND_LABELS[probe.ejido.kind] || 'Ejido'} ${probe.ejido.name}` : '']
                    .filter(Boolean)
                    .join(' · '),
                  lat: probe.lat,
                  lng: probe.lng,
                  noFly: true,
                });
                setProbe(null);
              }}
            >
              Marcar este punto
            </button>
          </div>
        ) : null}
      </div>
    </Popup>
  );
}
