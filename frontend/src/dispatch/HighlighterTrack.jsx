import { useMemo } from 'react';
import { Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { buildHighlighterLayers, gapKey } from './trackHighlighter.js';
import { TRACK_HIGHLIGHT_COLORS } from './RouteTrackPicker.jsx';
import { useGapRoutes } from './useGapRoutes.js';

/** Amarillo del tramo predictivo (no se usa en ninguna ruta real). */
export const PREDICTED_COLOR = '#f5b32a';
/**
 * Opacidad/grosor del tramo predictivo: mismo lenguaje marcatextos que el verde,
 * un punto más opaco porque el ámbar sobre basemap crema pierde contraste.
 */
const PREDICTED_STYLE = { opacity: 0.4, weight: 13 };

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
 * - Los huecos de señal NO se unen en verde: van en amarillo por la ruta real
 *   (o punteados si no hubo servicio de routing).
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
            const estimated = !route || route.estimated;
            const positions =
              route?.points?.length > 1
                ? route.points
                : [
                    [gap.from.lat, gap.from.lng],
                    [gap.to.lat, gap.to.lng],
                  ];
            return (
              <Polyline
                key={`gap-${key}`}
                positions={positions}
                pathOptions={{
                  renderer,
                  color: PREDICTED_COLOR,
                  weight: PREDICTED_STYLE.weight,
                  opacity: PREDICTED_STYLE.opacity,
                  lineCap: 'round',
                  lineJoin: 'round',
                  fill: false,
                  // Punteado = no es ruta real, es la aproximación más lógica.
                  dashArray: estimated ? '2 16' : undefined,
                }}
              >
                <Popup>
                  <strong>Tramo sin señal{displayName ? ` · ${displayName}` : ''}</strong>
                  <br />
                  {estimated ? 'Trayecto estimado (sin ruta disponible)' : 'Ruta probable por calles'}
                  <br />
                  <span style={{ opacity: 0.75, fontSize: 12 }}>
                    Salto {kmLabel(gap.meters)}
                    {gap.seconds > 0
                      ? ` · sin reportar ${durLabel(gap.seconds) || `${Math.round(gap.seconds)} s`}`
                      : ''}
                    {route && !route.estimated && route.distanceM
                      ? ` · por carretera ${kmLabel(route.distanceM)}`
                      : ''}
                    {route && !route.estimated && route.durationS
                      ? ` (~${durLabel(route.durationS)})`
                      : ''}
                  </span>
                </Popup>
              </Polyline>
            );
          })
        : null}
    </>
  );
}
