import { googleMapsSearchUrl } from '../panicMaps.js';

/** Coordenadas clicables → Google Maps (nueva pestaña). */
export function MapCoordsLink({ lat, lng, decimals = 5, className = 'map-coords-link' }) {
  const url = googleMapsSearchUrl(lat, lng);
  if (!url) return null;
  const label = `${Number(lat).toFixed(decimals)}, ${Number(lng).toFixed(decimals)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title="Abrir en Google Maps"
    >
      {label}
    </a>
  );
}
