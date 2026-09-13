import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  IV_RM_STATE_DEFS,
  isStateEnabled,
  isSurfaceEnabled,
  loadIvRmStatesConfig,
  stateColor,
  useIvRmStatesConfig,
} from './ivRmStatesConfig.js';
import {
  BUNDLED_STATE_IDS,
  availableStateFeatures,
  ivRmStates,
  loadExtraStates,
  loadedExtraStates,
} from './mxStatesGeo.js';

/**
 * Delimitación de estados con GeoJSON vectorial (mismo path fill+stroke).
 * Leaflet proyecta cada vértice en EPSG:3857 igual que las teselas — evita el
 * desfase del ImageOverlay rasterizado (stroke que engorda al zoom + stretch).
 *
 * `surface`: consola | seguimiento | radio — si está off en Config → Estados, no dibuja.
 *
 * Renderer: L.svg (L.canvas fallaba el relleno en MultiPolygon densos).
 * Geometría: fuente única INEGI para los 32 (ver mxStatesGeo.js). NL/TM/SLP van
 * en el bundle; los otros 29 se bajan solo si se habilita alguno.
 */
export default function IvRmStatesLayer({ surface = 'consola' }) {
  const map = useMap();
  const [config] = useIvRmStatesConfig();
  const surfaceOn = isSurfaceEnabled(config, surface);
  const configKey = JSON.stringify(config);
  /* null = aún no; [] = fetch falló; Feature[] = mxEstados listo */
  const [extraFeatures, setExtraFeatures] = useState(() => loadedExtraStates());
  const layerRef = useRef(null);
  const rendererRef = useRef(null);

  /* Solo hace falta la descarga si hay algún estado fuera del bundle IV R.M. */
  const needsExtra = useMemo(
    () =>
      surfaceOn &&
      IV_RM_STATE_DEFS.some(
        (d) => !BUNDLED_STATE_IDS.has(d.id) && isStateEnabled(config, d.id)
      ),
    [configKey, surfaceOn]
  );

  useEffect(() => {
    if (!needsExtra || extraFeatures != null) return undefined;
    let alive = true;
    loadExtraStates().then((features) => {
      if (!alive) return;
      setExtraFeatures(features?.length ? features : []);
    });
    return () => {
      alive = false;
    };
  }, [needsExtra, extraFeatures]);

  useEffect(() => {
    if (!surfaceOn) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return undefined;
    }

    if (!map.getPane('ivRmStatesPane')) {
      const pane = map.createPane('ivRmStatesPane');
      pane.style.zIndex = 350;
      pane.style.pointerEvents = 'none';
    }
    if (!rendererRef.current) {
      /* SVG: fill fiable; canvas dejaba borde sin relleno en polígonos densos. */
      rendererRef.current = L.svg({ padding: 0.5, pane: 'ivRmStatesPane' });
    }

    const cfg = config || loadIvRmStatesConfig();
    /*
     * Bundle IV R.M. siempre disponible (FitBounds / NL-TM-SLP sin red).
     * Si ya llegó mxEstados, se mezcla por id para cubrir los otros 29.
     */
    const features = availableStateFeatures(
      extraFeatures?.length ? extraFeatures : null
    ).filter((f) => {
      const id = f?.properties?.id;
      return id && isStateEnabled(cfg, id);
    });

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!features.length) return undefined;

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: 'ivRmStatesPane',
        renderer: rendererRef.current,
        interactive: false,
        style: (feature) => {
          const id = feature?.properties?.id;
          const color = stateColor(cfg, id);
          return {
            color,
            weight: 1.15,
            opacity: 0.85,
            fillColor: color,
            fillOpacity: 0.32,
            fillRule: 'nonzero',
            lineJoin: 'round',
            lineCap: 'round',
            stroke: true,
            fill: true,
          };
        },
      }
    );
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, configKey, extraFeatures, surfaceOn, needsExtra]);

  return null;
}

export { ivRmStates };
