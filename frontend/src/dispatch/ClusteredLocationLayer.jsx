import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import { clusterMapPoints, mapClusterIcon } from './clusterMapPoints.js';

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
                    const next = Math.min(
                      map.getMaxZoom?.() ?? 19,
                      Math.max(zoom + 2, 14)
                    );
                    map.setView([c.lat, c.lng], next, { animate: true });
                  } catch {
                    /* ignore */
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
