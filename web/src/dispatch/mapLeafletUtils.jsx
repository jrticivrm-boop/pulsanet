import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

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
  const maxZoom = map.getMaxZoom?.() ?? 19;
  const targetZoom = Math.max(minZoom, Math.min(maxZoom, Number(zoom) || 17));

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

/** Lee foco de pánico desde query (?lat=&lng=&zoom=). */
export function focusFromSearchParams(searchParams) {
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const zoomRaw = Number(searchParams.get('zoom'));
  const user = searchParams.get('user') || '';
  const panic = searchParams.get('panic') || '';
  const stamp = searchParams.get('t') || '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? Math.min(zoomRaw, 19) : 17;
  const key = `${panic}|${lat}|${lng}|${user}|${stamp}`;
  return { lat, lng, zoom, token: key, userId: user || null, key };
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

/** Cursor visible sobre tiles, marcadores y al arrastrar (grab falla en algunos Windows). */
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

/** Zoom con la rueda hacia el punto bajo el cursor (como Google Maps). */
export function CursorZoom() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    map.options.scrollWheelZoom = true;
    map.options.wheelPxPerZoomLevel = 80;
    map.options.wheelDebounceTime = 30;
    map.options.zoomSnap = 0.25;
    map.options.zoomDelta = 0.5;
    map.scrollWheelZoom?.enable?.();
    L.DomEvent.disableScrollPropagation(el);

    const onWheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const px = map.options.wheelPxPerZoomLevel || 80;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      if (e.deltaMode === 2) delta *= px;
      const zoomDelta = -delta / px;
      if (!zoomDelta) return;

      const point = map.mouseEventToContainerPoint(e);
      const latlng = map.containerPointToLatLng(point);
      const raw = map.getZoom() + zoomDelta;
      const next = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), raw));
      if (Math.abs(next - map.getZoom()) < 0.01) return;
      map.setZoomAround(latlng, next, { animate: false });
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
