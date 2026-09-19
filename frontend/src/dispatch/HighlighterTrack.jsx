import { Fragment, useMemo } from 'react';
import { CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { buildHighlighterLayers, gapKey } from './trackHighlighter.js';
import { TRACK_HIGHLIGHT_COLORS } from './RouteTrackPicker.jsx';
import { useGapRoutes } from './useGapRoutes.js';

/**
 * Naranja único de la "ruta probable" para los huecos de señal.
 * Solo se dibuja cuando hay geometría OSRM por calles (nunca cuerda recta).
 */
export const PREDICTED_COLOR = '#e87812';
/** Compat: alias del color unificado (antes era el naranja de "ruta estimada"). */
export const ESTIMATED_COLOR = PREDICTED_COLOR;
/**
 * Opacidad/grosor del tramo predictivo: un poco por encima del verde base (0.26)
 * para que en basemap «Claro» (crema/peach de carreteras) el ámbar se lea claro.
 */
const PREDICTED_STYLE = { opacity: 0.58, weight: 14 };

/**
 * Un renderer Canvas por mapa, compartido por todas las rutas.
 * Con 48 h y varios operadores el SVG por defecto mete miles de nodos al DOM.
 */
function useSharedCanvas(map) {
  return useMemo(() => {
    if (!map) return undefined;
    if (!map.__tacticalptxTrackCanvas) {
      map.__tacticalptxTrackCanvas = L.canvas({ padding: 0.4 });
    }
    return map.__tacticalptxTrackCanvas;
  }, [map]);
}

function kmLabel(m) {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function durLabel(s) {
  if (!s) return null;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

/**
 * Ruta histórica con trazo tipo marcatextos.
 *
 * - Verde translúcido y grueso: deja leer calles debajo.
 * - Los tramos repasados varias veces se dibujan en capas más opacas.
 * - Los huecos de señal NO se unen en verde: van en naranja como "ruta probable"
 *   **solo cuando OSRM devolvió geometría por calles**. Nunca se dibuja la
 *   cuerda recta A→B (atravesaría terreno sin vialidad).
 *
 * @param {{
 *   points: Array,
 *   color?: string,
 *   token?: string,
 *   displayName?: string,
 *   predictGaps?: boolean,
 *   gapOptions?: object,
 *   onStats?: (stats: { gaps: number, points: number, maxPasses: number }) => void,
 * }} props
 */
export default function HighlighterTrack({
  points,
  color = TRACK_HIGHLIGHT_COLORS[0],
  token = '',
  displayName = '',
  predictGaps = false,
  gapOptions = undefined,
}) {
  const map = useMap();
  const renderer = useSharedCanvas(map);

  const { layers, gaps } = useMemo(
    () => buildHighlighterLayers(points, { gap: gapOptions, detectGaps: predictGaps }),
    [points, gapOptions, predictGaps]
  );

  const gapRoutes = useGapRoutes(token, gaps, { enabled: predictGaps && Boolean(token) });

  return (
    <>
      {layers.map((layer) => (
        <Polyline
          key={`hl-${layer.tierIndex}`}
          positions={layer.lines}
          interactive={false}
          pathOptions={{
            renderer,
            color,
            weight: layer.weight,
            opacity: layer.opacity,
            lineCap: 'round',
            lineJoin: 'round',
            fill: false,
          }}
        />
      ))}

      {predictGaps
        ? gaps.map((gap) => {
            const key = gapKey(gap);
            const route = gapRoutes[key];
            // Solo se dibuja geometría vial real (OSRM). Nunca la cuerda A→B:
            // atravesaría campo/bases aunque haya avenidas al lado.
            const hasRoad =
              route &&
              !route.estimated &&
              Array.isArray(route.points) &&
              route.points.length >= 2;
            if (hasRoad) {
              return (
                <Polyline
                  key={`gap-${key}`}
                  positions={route.points}
                  pathOptions={{
                    renderer,
                    color: PREDICTED_COLOR,
                    weight: PREDICTED_STYLE.weight,
                    opacity: PREDICTED_STYLE.opacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                    fill: false,
                  }}
                >
                  <Popup>
                    <strong>Tramo sin señal{displayName ? ` · ${displayName}` : ''}</strong>
                    <br />
                    Ruta probable por calles
                    <br />
                    <span style={{ opacity: 0.75, fontSize: 12 }}>
                      Salto {kmLabel(gap.meters)}
                      {gap.seconds > 0
                        ? ` · sin reportar ${durLabel(gap.seconds) || `${Math.round(gap.seconds)} s`}`
                        : ''}
                      {route.distanceM ? ` · por carretera ${kmLabel(route.distanceM)}` : ''}
                      {route.durationS ? ` (~${durLabel(route.durationS)})` : ''}
                    </span>
                  </Popup>
                </Polyline>
              );
            }
            // Pendiente OSRM: marcas en extremos (sin recta por campo).
            // Solo mientras `pending` (reintentos activos); no eternizar puntos.
            if (route?.pending) {
              return (
                <Fragment key={`gap-pending-${key}`}>
                  <CircleMarker
                    center={[gap.from.lat, gap.from.lng]}
                    radius={5}
                    pathOptions={{
                      color: PREDICTED_COLOR,
                      weight: 2,
                      opacity: 0.85,
                      fillColor: PREDICTED_COLOR,
                      fillOpacity: 0.35,
                    }}
                  >
                    <Popup>
                      <strong>Sin señal{displayName ? ` · ${displayName}` : ''}</strong>
                      <br />
                      Calculando ruta por calles…
                      <br />
                      <span style={{ opacity: 0.75, fontSize: 12 }}>
                        Salto {kmLabel(gap.meters)}
                      </span>
                    </Popup>
                  </CircleMarker>
                  <CircleMarker
                    center={[gap.to.lat, gap.to.lng]}
                    radius={5}
                    pathOptions={{
                      color: PREDICTED_COLOR,
                      weight: 2,
                      opacity: 0.85,
                      fillColor: PREDICTED_COLOR,
                      fillOpacity: 0.35,
                    }}
                  />
                </Fragment>
              );
            }
            return null;
          })
        : null}
    </>
  );
}
