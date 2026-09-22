import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Botón Maximizar / Restaurar compartido por todos los mapas del panel.
 * Tooltip en maximizado: «Restaurar (Esc) para salir». Esc sigue cerrando vía data-esc-close-btn.
 */
export default function MapMaximizeButton({ maximized, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`lt-max-btn lt-max-btn--map${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={maximized ? 'Restaurar (Esc) para salir' : 'Pantalla completa'}
      aria-label={
        maximized ? 'Restaurar mapa (Esc para salir)' : 'Maximizar mapa a pantalla completa'
      }
      data-esc-close-btn={maximized ? '' : undefined}
    >
      {maximized ? '⛶ Restaurar' : '⛶ Maximizar'}
    </button>
  );
}

/**
 * Coloca Maximizar a la izquierda del control Leaflet +/− (bottomright).
 * Debe renderizarse dentro de `<MapContainer>`.
 */
export function MapMaximizeNearZoom({ maximized, onClick }) {
  const map = useMap();
  const wrapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const Ctrl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-control lt-max-near-zoom');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        wrapRef.current = div;
        setReady(true);
        return div;
      },
      onRemove() {
        wrapRef.current = null;
        setReady(false);
      },
    });
    const ctrl = new Ctrl();
    map.addControl(ctrl);
    return () => {
      map.removeControl(ctrl);
      wrapRef.current = null;
    };
  }, [map]);

  if (!ready || !wrapRef.current) return null;
  return createPortal(
    <MapMaximizeButton
      maximized={maximized}
      onClick={onClick}
      className="lt-max-btn--near-zoom"
    />,
    wrapRef.current
  );
}
