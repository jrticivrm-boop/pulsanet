/**
 * Abre Google Maps en el punto del pánico o con navegación turn-by-turn.
 */
export function googleMapsSearchUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleMapsDirUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
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
