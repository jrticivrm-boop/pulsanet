import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, useMap } from 'react-leaflet';
import { clusterMapPoints, mapClusterIcon } from './clusterMapPoints.js';
import { MAP_FIT_PEOPLE_MAX_ZOOM } from './mapTiles.js';

/** Umbral alineado con clusterMapPoints (desagrupar pines). */
const CLUSTER_BREAK_ZOOM = 16.5;
/**
 * Tope de zoom al picar un cluster (más bajo que MAP_FIT_PEOPLE_MAX_ZOOM).
 * Con miembros muy juntos, maxZoom 18 + padding chico metía pines fuera de frame.
 */
const CLUSTER_FIT_MAX_ZOOM = 16.5;
/** Margen cómodo para que iconos/etiquetas queden dentro del viewport. */
const CLUSTER_FIT_PADDING = [96, 96];

/** Zoom al picar un cluster: encuadra a todos los miembros (no solo el centroide). */
function zoomMapToClusterMembers(map, members, currentZoom) {
  const positions = (members || [])
    .map((m) => {
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return L.latLng(lat, lng);
    })
    .filter(Boolean);

  if (!positions.length) return false;

  const maxZ = Math.min(
    CLUSTER_FIT_MAX_ZOOM,
    MAP_FIT_PEOPLE_MAX_ZOOM,
    Number(map.getMaxZoom?.()) || CLUSTER_FIT_MAX_ZOOM
  );
  const zoomNow = Number.isFinite(currentZoom) ? currentZoom : map.getZoom();
  const padPt = L.point(CLUSTER_FIT_PADDING[0], CLUSTER_FIT_PADDING[1]);

  if (positions.length === 1) {
    map.setView(positions[0], Math.min(maxZ, Math.max(zoomNow + 2, CLUSTER_BREAK_ZOOM)), {
      animate: true,
    });
    return true;
  }

  const bounds = L.latLngBounds(positions);
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const latSpan = Math.abs(ne.lat - sw.lat);
  const lngSpan = Math.abs(ne.lng - sw.lng);

  // Mismo punto (o casi): setView al centro, zoom para desagrupar.
  if (latSpan < 1e-6 && lngSpan < 1e-6) {
    map.setView(bounds.getCenter(), Math.min(maxZ, Math.max(zoomNow + 2, CLUSTER_BREAK_ZOOM)), {
      animate: true,
    });
    return true;
  }

  let fitted = map.getBoundsZoom(bounds, false, padPt);
  if (!Number.isFinite(fitted)) fitted = zoomNow + 1;
  fitted = Math.min(fitted, maxZ);

  // Si el encuadre casi no acerca: soft +1 (no +2 ni forzar CLUSTER_BREAK),
  // para no sobrepasar el marco de miembros compactos.
  if (fitted <= zoomNow + 0.25) {
    const softTarget = Math.min(maxZ, zoomNow + 1);
    if (softTarget > zoomNow + 0.1) {
      map.setView(bounds.getCenter(), softTarget, { animate: true });
    } else {
      map.fitBounds(bounds, {
        padding: CLUSTER_FIT_PADDING,
        maxZoom: maxZ,
        animate: true,
      });
    }
    return true;
  }

  map.fitBounds(bounds, {
    padding: CLUSTER_FIT_PADDING,
    maxZoom: maxZ,
    animate: true,
  });
  return true;
}

/** Zoom actual del mapa (reactivo a zoomend/moveend). */
export function useMapZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => {
    try {
      return map.getZoom();
    } catch {
      return 12;
    }
  });
  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      try {
        setZoom(map.getZoom());
      } catch {
        /* ignore */
      }
    };
    update();
    map.on('zoomend', update);
    map.on('moveend', update);
    return () => {
      map.off('zoomend', update);
      map.off('moveend', update);
    };
  }, [map]);
  return zoom;
}

function countClusterSlices(members, memberSliceKey) {
  const slices = {};
  if (typeof memberSliceKey !== 'function') return slices;
  for (const m of members || []) {
    const key = memberSliceKey(m);
    if (!key) continue;
    const k = String(key);
    slices[k] = (slices[k] || 0) + 1;
  }
  return slices;
}

/**
 * Agrupa ubicaciones cercanas; renderiza cluster o el marcador individual.
 *
 * @param {{
 *   points: Array<{id:string,lat:number,lng:number}>,
 *   keepSeparateIds?: string[]|Set<string>,
 *   memberSliceKey?: (point: object) => string|null|undefined,
 *   renderPoint: (point: object) => import('react').ReactNode,
 * }} props
 */
export function ClusteredLocationLayer({
  points,
  keepSeparateIds,
  memberSliceKey,
  renderPoint,
}) {
  const map = useMap();
  const zoom = useMapZoom();
  const clusters = useMemo(
    () =>
      clusterMapPoints(points, zoom, {
        keepSeparateIds,
      }),
    // keepSeparateIds: arrays/Sets se recrean; clusterMapPoints es barato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, zoom, JSON.stringify(keepSeparateIds ? [...keepSeparateIds] : null)]
  );

  return (
    <>
      {clusters.map((c) => {
        if (c.type === 'cluster') {
          const key = `c:${c.members.map((m) => m.id).sort().join(',')}`;
          const slices = countClusterSlices(c.members, memberSliceKey);
          return (
            <Marker
              key={key}
              position={[c.lat, c.lng]}
              icon={mapClusterIcon(c.count, { slices })}
              zIndexOffset={250}
              eventHandlers={{
                click: () => {
                  try {
                    const ok = zoomMapToClusterMembers(map, c.members, zoom);
                    if (!ok) {
                      const next = Math.min(
                        map.getMaxZoom?.() ?? 19,
                        Math.max(zoom + 2, 14)
                      );
                      map.setView([c.lat, c.lng], next, { animate: true });
                    }
                  } catch {
                    try {
                      map.setView(
                        [c.lat, c.lng],
                        Math.min(map.getMaxZoom?.() ?? 19, zoom + 2),
                        { animate: true }
                      );
                    } catch {
                      /* ignore */
                    }
                  }
                },
              }}
            />
          );
        }
        return renderPoint(c.point);
      })}
    </>
  );
}
