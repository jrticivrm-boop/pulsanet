import { useEffect, useRef, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_MIN_ZOOM, MAP_WORLD_BOUNDS } from './mapTiles.js';
import { CARGO_LABEL_MIN_ZOOM } from './mapLabelUtils.js';

/** True cuando el zoom es suficiente para mostrar etiquetas de Cargo. */
export function useCargoLabelsVisible(minZoom = CARGO_LABEL_MIN_ZOOM) {
  const map = useMap();
  const [visible, setVisible] = useState(() => {
    try {
      return map.getZoom() >= minZoom;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      try {
        setVisible(map.getZoom() >= minZoom);
      } catch {
        setVisible(false);
      }
    };
    update();
    map.on('zoom', update);
    map.on('zoomend', update);
    return () => {
      map.off('zoom', update);
      map.off('zoomend', update);
    };
  }, [map, minZoom]);

  return visible;
}

/** Render-prop: hijos reciben `showCargo` según zoom del mapa. */
export function CargoZoomGate({ children, minZoom = CARGO_LABEL_MIN_ZOOM }) {
  const showCargo = useCargoLabelsVisible(minZoom);
  return typeof children === 'function' ? children(showCargo) : null;
}

/** Curva suave tipo Google Earth (acelera y frena sin brusquedad). */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Acerca el mapa al punto con pan + zoom en línea recta (sin arco de flyTo).
 * Devuelve función cancel.
 */
export function smoothMapFocus(map, { lat, lng, zoom }, options = {}) {
  const durationMs = options.durationMs ?? 2200;
  const minZoom = map.getMinZoom?.() ?? 0;
  const maxZoom = map.getMaxZoom?.() ?? 22;
  const targetZoom = Math.max(minZoom, Math.min(maxZoom, Number(zoom) || 19));

  map.stop();

  const startCenter = map.getCenter();
  const startLat = startCenter.lat;
  const startLng = startCenter.lng;
  const startZoom = map.getZoom();
  const startTime = performance.now();
  let rafId = 0;

  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    const e = easeInOutCubic(t);
    const curLat = startLat + (lat - startLat) * e;
    const curLng = startLng + (lng - startLng) * e;
    const curZoom = startZoom + (targetZoom - startZoom) * e;
    map.setView([curLat, curLng], curZoom, { animate: false });
    if (t < 1) rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/** Lee foco de pánico desde query (?lat=&lng=&zoom=). Ignora (0,0) / inválidos. */
export function focusFromSearchParams(searchParams) {
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const zoomRaw = Number(searchParams.get('zoom'));
  const user = searchParams.get('user') || '';
  const panic = searchParams.get('panic') || '';
  const stamp = searchParams.get('t') || '';
  // Rechaza NaN y Null Island (0,0) — no dibujar pin fantasma.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return null;
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? Math.min(zoomRaw, 22) : 19;
  const key = `${panic}|${lat}|${lng}|${user}|${stamp}`;
  return { lat, lng, zoom, token: key, userId: user || null, key };
}

/** Vista de mapa guardada en localStorage (centro + zoom). */
export function loadMapView(storageKey) {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const lat = Number(v?.lat);
    const lng = Number(v?.lng);
    const zoom = Number(v?.zoom);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (zoom < 0 || zoom > 22) return null;
    return { lat, lng, zoom, center: [lat, lng] };
  } catch {
    return null;
  }
}

/** Persiste centro/zoom al mover o hacer zoom (debounce corto). */
export function PersistMapView({ storageKey, enabled = true }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !storageKey) return undefined;
    let timer = 0;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          const c = map.getCenter();
          const z = map.getZoom();
          if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || !Number.isFinite(z)) return;
          localStorage.setItem(
            storageKey,
            JSON.stringify({ lat: c.lat, lng: c.lng, zoom: z })
          );
        } catch {
          /* ignore */
        }
      }, 180);
    };
    map.on('moveend', save);
    map.on('zoomend', save);
    return () => {
      window.clearTimeout(timer);
      map.off('moveend', save);
      map.off('zoomend', save);
    };
  }, [map, storageKey, enabled]);
  return null;
}

/** Recalcula tamaño Leaflet cuando el panel flex/grid cambia de alto. */
export function MapSizeFix() {
  const map = useMap();
  useEffect(() => {
    const host = map.getContainer()?.parentElement;
    if (!host) return undefined;
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null;
    ro?.observe(host);
    return () => ro?.disconnect();
  }, [map]);
  return null;
}

/**
 * Zoom mínimo dinámico: el mundo siempre cubre el viewport (sin “cuadrado” gris).
 * Al reducir / salir de maximizar, sube el minZoom y clamp si hace falta.
 */
export function MapWorldFillMinZoom() {
  const map = useMap();
  useEffect(() => {
    const world = L.latLngBounds(MAP_WORLD_BOUNDS);
    let debounceId = 0;
    const apply = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
      if (!map.getSize || map.getSize().x < 2 || map.getSize().y < 2) return;
      let z = map.getBoundsZoom(world, true);
      if (!Number.isFinite(z)) z = MAP_MIN_ZOOM;
      z = Math.max(MAP_MIN_ZOOM, z);
      map.setMinZoom(z);
      if (map.getZoom() < z - 1e-6) {
        map.setZoom(z, { animate: false });
      }
      try {
        map.panInsideBounds(world, { animate: false });
      } catch {
        /* ignore */
      }
    };
    const schedule = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(apply, 80);
    };
    apply();
    const t = window.setTimeout(apply, 100);
    const host = map.getContainer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (host) ro?.observe(host);
    const parent = host?.parentElement;
    if (parent && parent !== host) ro?.observe(parent);
    window.addEventListener('resize', schedule);
    document.addEventListener('fullscreenchange', schedule);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(debounceId);
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('fullscreenchange', schedule);
    };
  }, [map]);
  return null;
}

/** Flecha en hover; move al pan (grab de Leaflet falla en algunos Windows). */
export function MapCursorFix() {
  const map = useMap();
  useEffect(() => {
    const root = map.getContainer();
    if (!root) return undefined;
    root.classList.add('tp-map-cursor');
    const panes = root.querySelectorAll('.leaflet-pane');
    panes.forEach((p) => p.classList.add('tp-map-cursor'));
    return () => {
      root.classList.remove('tp-map-cursor');
      panes.forEach((p) => p.classList.remove('tp-map-cursor'));
    };
  }, [map]);
  return null;
}

/**
 * Zoom con la rueda: fino y suave hacia el cursor.
 * Pasos 0.25 + acumulación de deltaY; botones +/- siguen en zoomDelta=1.
 */
export function CursorZoom() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const WHEEL_STEP = 0.25;
    const ACCUM_THRESHOLD = 48; // px de rueda (o equiv.) por escalón fino
    const ANIM_MS = 175;

    map.options.scrollWheelZoom = true;
    map.options.zoomSnap = WHEEL_STEP;
    map.options.zoomDelta = 1; // +/- del control Leaflet: un nivel entero
    map.scrollWheelZoom?.enable?.();
    L.DomEvent.disableScrollPropagation(el);

    let accum = 0;
    let lastDir = 0;
    let lastStepAt = 0;
    const STEP_COOLDOWN_MS = 40;

    const onWheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.deltaY) return;

      // Normalizar delta (líneas / páginas → px aprox.)
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 100;

      const dir = dy > 0 ? -1 : 1;
      if (dir !== lastDir) {
        accum = 0;
        lastDir = dir;
      }
      accum += Math.abs(dy);
      if (accum < ACCUM_THRESHOLD) return;

      const steps = Math.floor(accum / ACCUM_THRESHOLD);
      accum -= steps * ACCUM_THRESHOLD;

      const now = performance.now();
      if (now - lastStepAt < STEP_COOLDOWN_MS) return;
      lastStepAt = now;

      const cur = map.getZoom();
      const raw = cur + dir * WHEEL_STEP * steps;
      const snapped = Math.round(raw / WHEEL_STEP) * WHEEL_STEP;
      const next = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), snapped));
      if (Math.abs(next - cur) < WHEEL_STEP / 2) return;

      const point = map.mouseEventToContainerPoint(e);
      const latlng = map.containerPointToLatLng(point);
      map.setZoomAround(latlng, next, { animate: true, duration: ANIM_MS / 1000 });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    map.scrollWheelZoom?.disable?.();

    return () => {
      el.removeEventListener('wheel', onWheel);
      map.scrollWheelZoom?.enable?.();
    };
  }, [map]);
  return null;
}

function samePoint(a, b, eps = 0.000001) {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

/** Marker que se desliza al actualizar la posición y mantiene el icono estable. */
export function SmoothMarker({ position, icon, eventHandlers, children, zIndexOffset = 0 }) {
  const markerRef = useRef(null);
  const fromRef = useRef(position);
  const rafRef = useRef(0);
  const iconHtmlRef = useRef('');

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !icon) return;
    const html = icon.options?.html || '';
    if (iconHtmlRef.current !== html) {
      iconHtmlRef.current = html;
      marker.setIcon(icon);
    }
  }, [icon]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      fromRef.current = position;
      return undefined;
    }
    const from = fromRef.current || position;
    const to = position;
    if (samePoint(from, to)) {
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
      zIndexOffset={zIndexOffset}
    >
      {children}
    </Marker>
  );
}
