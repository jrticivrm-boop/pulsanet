import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { geoSearch, geoReverse, geoMapStatus, fetchGeoPlaceOutline, fetchGeoOsmOutline } from '../api';
import { MapCoordsLink } from './MapCoordsLink.jsx';
import { parseCoords } from './coordsParse.js';

const RECENT_KEY = 'tacticalptx_map_search_recent';
const RECENT_MAX = 8;
const DEBOUNCE_MS = 150;
const OWN_DEBOUNCE_MS = 110;

function shortDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
}

/** «Mapa propio: búsqueda 12 oct 2026 · rutas 01 oct 2026» (o aviso si no responde). */
function ownMapLabel(st) {
  const b = st?.buscador;
  const r = st?.rutas;
  if (!b?.configurado && !r?.configurado) return '';
  const part = (label, s) => {
    if (!s?.configurado) return null;
    if (!s.ok) return `${label} sin respuesta`;
    return shortDate(s.fecha) ? `${label} ${shortDate(s.fecha)}` : label;
  };
  return `Mapa propio: ${[part('búsqueda', b), part('rutas', r)].filter(Boolean).join(' · ')}`;
}

export const SEARCH_KIND_LABELS = {
  coordenadas: 'Coordenadas',
  pais: 'País',
  estado: 'Estado',
  municipio: 'Municipio',
  ciudad: 'Ciudad',
  pueblo: 'Pueblo',
  localidad: 'Localidad',
  colonia: 'Colonia',
  codigo_postal: 'Código postal',
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
  codigo_postal: 15,
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

/**
 * «19.4326, -99.1332», «19°25'57"N 99°07'59"W», cuadrícula «14Q MG 8601 4870» o liga de Google Maps.
 * @returns {{ lat: number, lng: number, format: string } | null}
 */
export function parseCoordinates(text) {
  return parseCoords(text);
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

export function SearchKindIcon({ kind }) {
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

export function localMatches(items, q) {
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
 *   onRouteTo?: (result: object) => void,
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
  onRouteTo,
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  /** Resultados por etapa; cada uno recuerda para qué texto llegó. */
  const [localRes, setLocalRes] = useState({ key: '', results: [], forced: false });
  const [osmRes, setOsmRes] = useState({ key: '', results: [], status: 'ok' });
  /** Photon propio de SICOM (México): responde al instante y sin internet. */
  const [ownRes, setOwnRes] = useState({ key: '', results: [], status: 'ok' });
  const [fullRes, setFullRes] = useState({ key: '', results: [], status: 'ok' });
  const [osmLoading, setOsmLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [world, setWorld] = useState(false);
  const [recent, setRecent] = useState(() => readRecent());
  const [copied, setCopied] = useState(false);
  const [mapStatus, setMapStatus] = useState(null);
  const cacheRef = useRef(new Map());
  const abortRef = useRef({ local: null, osm: null, propio: null, full: null });
  const autoFullRef = useRef('');
  const shownRef = useRef({ key: '', ids: [] });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const trimmed = q.trim();
  const coords = useMemo(() => parseCoordinates(trimmed), [trimmed]);
  const qKey = `${world ? 'w' : 'mx'}|${normalize(trimmed).replace(/\s+/g, ' ')}`;

  const fetchStage = useCallback(
    async (src, text, key) => {
      const cacheKey = `${src}|${key}`;
      const hit = cacheRef.current.get(cacheKey);
      if (hit) return hit;
      abortRef.current[src]?.abort();
      const ac = new AbortController();
      abortRef.current[src] = ac;
      const bias = getBias?.() || null;
      const data = await geoSearch(token, { q: text, lat: bias?.lat, lng: bias?.lng, world, src }, ac.signal);
      const value = {
        results: Array.isArray(data?.results) ? data.results : [],
        forced: Boolean(data?.forced),
        status: data?.status || 'ok',
      };
      if (value.status === 'ok') {
        cacheRef.current.set(cacheKey, value);
        if (cacheRef.current.size > 300) cacheRef.current.delete(cacheRef.current.keys().next().value);
      }
      return value;
    },
    // getBias se lee al disparar; no debe relanzar búsquedas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, world]
  );

  useEffect(() => {
    abortRef.current.full?.abort();
    setFullLoading(false);
    if (coords || trimmed.length < 2) {
      abortRef.current.local?.abort();
      abortRef.current.osm?.abort();
      abortRef.current.propio?.abort();
      setOsmLoading(false);
      return undefined;
    }
    const key = qKey;
    const timers = [];
    // Ejidos: casi inmediato (consulta local en el servidor).
    timers.push(
      window.setTimeout(() => {
        fetchStage('local', trimmed, key)
          .then((v) => setLocalRes({ key, results: v.results, forced: v.forced }))
          .catch(() => {});
      }, 90)
    );
    if (trimmed.length >= 3 && !world) {
      const ownCached = cacheRef.current.get(`propio|${key}`);
      if (ownCached) setOwnRes({ key, results: ownCached.results, status: ownCached.status });
      else {
        abortRef.current.propio?.abort();
        timers.push(
          window.setTimeout(() => {
            fetchStage('propio', trimmed, key)
              .then((v) => setOwnRes({ key, results: v.results, status: v.status }))
              .catch((err) => {
                if (err?.name === 'AbortError') return;
                setOwnRes({ key, results: [], status: 'sin_servicio' });
              });
          }, OWN_DEBOUNCE_MS)
        );
      }
    } else {
      abortRef.current.propio?.abort();
    }
    if (trimmed.length >= 3) {
      const cached = cacheRef.current.get(`osm|${key}`);
      if (cached) {
        setOsmRes({ key, results: cached.results, status: cached.status });
        setOsmLoading(false);
      } else {
        // Lo pedido para el texto anterior ya no sirve: liberar la fila del servidor.
        abortRef.current.osm?.abort();
        setOsmLoading(true);
        timers.push(
          window.setTimeout(() => {
            fetchStage('osm', trimmed, key)
              .then((v) => {
                setOsmRes({ key, results: v.results, status: v.status });
                setOsmLoading(false);
              })
              .catch((err) => {
                if (err?.name === 'AbortError') return;
                setOsmRes({ key, results: [], status: 'sin_servicio' });
                setOsmLoading(false);
              });
          }, DEBOUNCE_MS)
        );
      }
    } else {
      abortRef.current.osm?.abort();
      setOsmLoading(false);
    }
    return () => timers.forEach((id) => clearTimeout(id));
  }, [qKey, trimmed, coords, fetchStage, world]);

  useEffect(
    () => () => {
      Object.values(abortRef.current).forEach((ac) => ac?.abort());
    },
    []
  );

  useEffect(() => {
    if (!open || mapStatus || !token) return;
    geoMapStatus(token)
      .then((d) => setMapStatus(d))
      .catch(() => setMapStatus({}));
  }, [open, mapStatus, token]);

  /** Mientras llega la respuesta: lo ya encontrado para un texto anterior que sigue coincidiendo. */
  const provisionalOsm = useMemo(() => {
    if (osmRes.key === qKey) return osmRes.results;
    const [scope, text] = qKey.split('|');
    let best = null;
    for (const [k, v] of cacheRef.current) {
      if (!k.startsWith(`osm|${scope}|`)) continue;
      const prev = k.slice(`osm|${scope}|`.length);
      if (prev.length >= 3 && text.startsWith(prev) && (!best || prev.length > best.len)) {
        best = { len: prev.length, results: v.results };
      }
    }
    if (!best) return [];
    const words = text.split(' ').filter((w) => w && !/^\d+$/.test(w));
    return best.results.filter((r) => {
      const hay = normalize(`${r.name} ${r.detail || ''}`);
      return words.every((w) => hay.includes(w));
    });
  }, [osmRes, qKey]);

  const runFull = useCallback((auto) => {
    if (coords || trimmed.length < 3) return;
    const key = qKey;
    const manual = auto !== true;
    setFullLoading(true);
    if (manual) setOpen(true);
    fetchStage('full', trimmed, key)
      .then((v) => {
        setFullRes({ key, results: v.results, status: v.status });
        setFullLoading(false);
        if (manual) setActive(v.results.length ? 0 : -1);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setFullRes({ key, results: [], status: 'sin_servicio' });
        setFullLoading(false);
      });
  }, [coords, trimmed, qKey, fetchStage]);

  const hasFull = fullRes.key === qKey;
  const own = ownRes.key === qKey ? ownRes.results : [];
  /** En línea manda (más actualizado); lo propio cubre mientras llega o si no hay internet. */
  const photonList = useMemo(() => {
    const ids = new Set(provisionalOsm.map((r) => r.id));
    return [...provisionalOsm, ...own.filter((r) => !ids.has(r.id))];
  }, [provisionalOsm, own]);

  // Sin servicio en línea ni propio: búsqueda completa (Nominatim) sin esperar el Enter.
  const osmFailed = osmRes.key === qKey && osmRes.status !== 'ok' && !osmRes.results.length;
  const ownFailed = world || (ownRes.key === qKey && !own.length);
  useEffect(() => {
    if (!osmFailed || !ownFailed || hasFull || fullLoading || autoFullRef.current === qKey) return;
    autoFullRef.current = qKey;
    runFull(true);
  }, [osmFailed, ownFailed, hasFull, fullLoading, qKey, runFull]);

  const rawOptions = useMemo(() => {
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
    const ejidos = localRes.key === qKey ? localRes.results : [];
    const forced = localRes.key === qKey && localRes.forced;
    let remote;
    if (hasFull) {
      const ids = new Set(fullRes.results.map((r) => r.id));
      remote = [...fullRes.results, ...ejidos, ...photonList.filter((r) => !ids.has(r.id))];
    } else if (forced) {
      remote = [...ejidos, ...photonList];
    } else {
      remote = [...photonList.slice(0, 3), ...ejidos.slice(0, 4), ...photonList.slice(3)];
    }
    const seen = new Set(out.map((r) => r.id));
    for (const r of remote) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out.slice(0, 18);
  }, [trimmed, coords, recent, localItems, localRes, qKey, photonList, hasFull, fullRes]);

  // Si ya se está eligiendo con flechas, lo que llega después se agrega al final: la lista no salta.
  const options = useMemo(() => {
    const prev = shownRef.current;
    if (active < 0 || prev.key !== qKey) return rawOptions;
    const byId = new Map(rawOptions.map((o) => [o.id, o]));
    const kept = prev.ids.map((id) => byId.get(id)).filter(Boolean);
    const keptIds = new Set(kept.map((o) => o.id));
    return [...kept, ...rawOptions.filter((o) => !keptIds.has(o.id))].slice(0, 18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawOptions, qKey]);
  shownRef.current = { key: qKey, ids: options.map((o) => o.id) };

  // Al escribir no se resalta nada: Enter = búsqueda completa; flechas = elegir sugerencia.
  useEffect(() => {
    setActive(-1);
  }, [qKey]);

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
      if (open && active >= 0 && options[active]) choose(options[active]);
      else if (coords && options[0]) choose(options[0]);
      else if (trimmed.length >= 3) runFull();
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

  const loading = osmLoading || fullLoading;
  const showList = open && (options.length > 0 || (trimmed.length >= 2 && !coords));
  const status = hasFull ? fullRes.status : osmRes.key === qKey ? osmRes.status : 'ok';
  const offline = status === 'timeout' || status === 'sin_servicio';
  const statusMsg =
    offline && !hasFull && own.length
      ? 'Buscador en línea sin respuesta: resultados del mapa propio de SICOM.'
      : offline
      ? 'Sin conexión con el buscador en línea; solo datos propios y ejidos.'
      : status === 'ocupado'
        ? 'Buscador ocupado, intenta de nuevo en un momento.'
        : '';
  const canFull = trimmed.length >= 3 && !coords && !hasFull;
  const fullStartIdx = hasFull
    ? options.findIndex((o) => fullRes.results.some((r) => r.id === o.id))
    : -1;

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
            {options.map((opt, i) => [
              i === fullStartIdx ? (
                <li key="full-section" className="map-search-section">
                  Búsqueda completa
                </li>
              ) : null,
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
                <span
                  className={`map-search-item-kind${opt.approx ? ' is-approx' : ''}`}
                  title={opt.approx ? 'La calle existe, pero ese número no está registrado; el punto es aproximado' : undefined}
                >
                  {SEARCH_KIND_LABELS[opt.kind] || 'Lugar'}
                  {opt.approx ? ' · sin número exacto' : ''}
                </span>
              </li>,
            ])}
            {loading && trimmed.length >= 3 && !coords ? (
              <li className="map-search-empty map-search-loading">
                <span className="map-search-spinner" aria-hidden />
                {fullLoading ? 'Buscando dirección completa…' : 'Buscando direcciones…'}
              </li>
            ) : null}
            {trimmed.length >= 2 && !coords && !loading && !options.length ? (
              <li className="map-search-empty">Sin resultados. Prueba con menos palabras o agrega el municipio/estado.</li>
            ) : null}
            {statusMsg && trimmed ? <li className="map-search-empty">{statusMsg}</li> : null}
            {canFull && !fullLoading ? (
              <li
                className="map-search-action"
                onPointerDown={(e) => {
                  e.preventDefault();
                  runFull();
                }}
              >
                <SearchKindIcon kind="direccion" />
                <span>
                  Buscar dirección completa «{trimmed}» <kbd>Enter</kbd>
                </span>
              </li>
            ) : null}
            {trimmed.length >= 3 && !coords && !world && !loading && options.length < 3 ? (
              <li
                className="map-search-action"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setWorld(true);
                }}
              >
                <SearchKindIcon kind="pais" />
                <span>Buscar también fuera de México</span>
              </li>
            ) : null}
            {trimmed && !coords ? (
              <li className="map-search-attrib">
                Datos © OpenStreetMap · ejidos: RAN · C.P.: SEPOMEX e INEGI (DENUE)
                {ownMapLabel(mapStatus) ? <span title="Respaldo en el servidor de SICOM cuando no hay internet"> · {ownMapLabel(mapStatus)}</span> : null}
              </li>
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
              <em className={`map-search-item-kind${selected.approx ? ' is-approx' : ''}`}>
                {SEARCH_KIND_LABELS[selected.kind] || 'Lugar'}
                {selected.approx ? ' · sin número exacto' : ''}
                {selected.pinAt === 'cabecera' ? ' · pin en la cabecera' : ''}
              </em>
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
            {onRouteTo ? (
              <button
                type="button"
                className="cc-btn ghost cc-btn-sm"
                onClick={() => onRouteTo(selected)}
                title="Trazar la ruta hasta este lugar (pestaña Ruta)"
              >
                Cómo llegar
              </button>
            ) : null}
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={clearAll} title="Quitar marcador">
              Quitar
            </button>
          </span>
        </div>
      ) : (
        <p className="map-ops-hint muted map-search-hint">
          Escribe y elige una sugerencia; Enter busca la dirección completa. Clic derecho en el mapa: «¿Qué hay aquí?».
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
/** Resultados de OSM cuyo límite se dibuja al elegirlos (municipio, estado, colonia…). */
const OSM_OUTLINE_KINDS = new Set(['pais', 'estado', 'municipio', 'ciudad', 'pueblo', 'localidad', 'colonia']);

export function MapSearchLayer({ token, selected, flyToken, mapRef }) {
  const map = useMap();
  const [outline, setOutline] = useState(null);

  useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    setOutline(null);
    const osmRef = OSM_OUTLINE_KINDS.has(selected?.kind) ? String(selected?.id || '').match(/^osm:([RW]\d+)$/)?.[1] : null;
    const request = selected?.placeId && selected.hasOutline
      ? fetchGeoPlaceOutline(token, selected.placeId)
      : osmRef
        ? fetchGeoOsmOutline(token, osmRef)
        : null;
    if (!request) return undefined;
    let alive = true;
    request
      .then((d) => {
        if (alive && Array.isArray(d?.outline)) setOutline(d.outline);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, selected?.placeId, selected?.hasOutline, selected?.id, selected?.kind]);

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
export function MapReverseLookup({ token, enabled = true, onUse, onRoute }) {
  const [probe, setProbe] = useState(null);
  const seqRef = useRef(0);

  useMapEvents({
    contextmenu(e) {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      const seq = ++seqRef.current;
      setProbe({ seq, lat, lng, loading: true });
      geoReverse(token, lat, lng)
        .then((d) => {
          if (seq === seqRef.current) setProbe({ seq, lat, lng, loading: false, place: d?.place, ejido: d?.ejido });
        })
        .catch(() => {
          if (seq === seqRef.current) setProbe({ seq, lat, lng, loading: false, error: true });
        });
    },
  });

  // react-leaflet cierra y reabre el Popup si cambia la referencia de `position`.
  const probeSeq = probe?.seq;
  const probeLat = probe?.lat;
  const probeLng = probe?.lng;
  const popupPos = useMemo(
    () => (probeLat == null ? null : [probeLat, probeLng]),
    [probeSeq, probeLat, probeLng]
  );
  const popupHandlers = useMemo(
    () => ({ remove: () => setProbe((p) => (p && p.seq === probeSeq ? null : p)) }),
    [probeSeq]
  );

  if (!probe) return null;
  const place = probe.place;
  const probePlace = () => ({
    id: `coord:${probe.lat},${probe.lng}`,
    kind: place ? place.kind : 'coordenadas',
    name: place?.name || `${probe.lat.toFixed(6)}, ${probe.lng.toFixed(6)}`,
    detail: [place?.detail, probe.ejido ? `${SEARCH_KIND_LABELS[probe.ejido.kind] || 'Ejido'} ${probe.ejido.name}` : '']
      .filter(Boolean)
      .join(' · '),
    lat: probe.lat,
    lng: probe.lng,
  });
  return (
    <Popup position={popupPos} eventHandlers={popupHandlers}>
      <div className="map-reverse-pop">
        <div className="map-reverse-title">¿Qué hay aquí?</div>
        <div className="map-reverse-body">
          {probe.loading ? <div className="muted">Buscando dirección…</div> : null}
          {!probe.loading && place ? (
            <div>
              <div className="map-reverse-name">{place.name}</div>
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
        </div>
        {(onUse || onRoute) && !probe.loading ? (
          <div className="map-reverse-actions">
            {onUse ? (
              <button
                type="button"
                className="is-primary map-reverse-wide"
                onClick={() => {
                  onUse({ ...probePlace(), noFly: true });
                  setProbe(null);
                }}
              >
                Marcar este punto
              </button>
            ) : null}
            {onRoute ? (
              <>
                <button
                  type="button"
                  title="Usar este punto como origen (A) de la ruta"
                  onClick={() => {
                    onRoute('from', probePlace());
                    setProbe(null);
                  }}
                >
                  Ruta desde aquí
                </button>
                <button
                  type="button"
                  title="Usar este punto como destino (B) de la ruta"
                  onClick={() => {
                    onRoute('to', probePlace());
                    setProbe(null);
                  }}
                >
                  Ruta hasta aquí
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </Popup>
  );
}
