/**
 * Abre Google Maps en el punto del pánico o con navegación turn-by-turn.
 */

/** GPS usable (rechaza NaN y el falso 0,0 / Null Island). */
export function isValidMapCoord(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // (0,0) en el Golfo de Guinea: casi siempre “sin GPS”, no una posición real.
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return false;
  return true;
}

export function googleMapsSearchUrl(latitude, longitude) {
  if (!isValidMapCoord(latitude, longitude)) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleMapsDirUrl(latitude, longitude) {
  if (!isValidMapCoord(latitude, longitude)) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function openPanicLocation({ latitude, longitude, navigate = false }) {
  const url = navigate
    ? googleMapsDirUrl(latitude, longitude)
    : googleMapsSearchUrl(latitude, longitude);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
