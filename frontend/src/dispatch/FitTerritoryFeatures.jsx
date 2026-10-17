import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/** Encuadra el mapa a los features territoriales cuando cambia `fitToken`. */
export default function FitTerritoryFeatures({ features, fitToken }) {
  const map = useMap();
  useEffect(() => {
    if (!fitToken || !features?.length) return;
    try {
      const layer = L.geoJSON({ type: 'FeatureCollection', features });
      const b = layer.getBounds();
      if (b?.isValid?.()) {
        map.fitBounds(b.pad(0.08), { maxZoom: 11, animate: true });
      }
    } catch {
      /* ignore */
    }
  }, [map, fitToken, features]);
  return null;
}
