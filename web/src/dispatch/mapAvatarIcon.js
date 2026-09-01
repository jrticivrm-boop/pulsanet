import L from 'leaflet';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapa URL para background-image en CSS (evita romper comillas). */
function escapeCssUrl(url) {
  return String(url || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Pin de ubicación (gota / teardrop verde) con foto de perfil o inicial.
 * La punta inferior ancla la lat/lng exacta.
 */
export function mapAvatarIcon({ name, live, selected, photoSrc }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const label = escapeHtml((name || '').trim().split(/\s+/)[0] || 'Operador');
  const hasPhoto = Boolean(photoSrc);
  const face = hasPhoto
    ? `<span class="lt-wa-photo-bg" style="background-image:url('${escapeCssUrl(photoSrc)}')" aria-hidden="true"></span>`
    : `<span class="lt-wa-letter">${escapeHtml(initial)}</span>`;
  const nameHtml = selected ? `<span class="lt-wa-name">${label}</span>` : '';
  const html = `
    <div class="lt-wa${live ? ' is-live' : ''}${selected ? ' is-selected' : ''}${selected ? '' : ' lt-wa--compact'}">
      ${live ? '<span class="lt-wa-ring" aria-hidden="true"></span><span class="lt-wa-ring lt-wa-ring--late" aria-hidden="true"></span>' : ''}
      <span class="lt-wa-pin${hasPhoto ? ' has-photo' : ''}" aria-hidden="true">
        <span class="lt-wa-pin-tip"></span>
        <span class="lt-wa-pin-face">${face}</span>
      </span>
      ${nameHtml}
    </div>`;
  // Tamaño del DivIcon; ancla = punta del pin (centro-x, fondo)
  const iconSize = selected ? [72, 86] : [52, 64];
  const iconAnchor = selected ? [36, 78] : [26, 60];
  const popupAnchor = selected ? [0, -70] : [0, -54];
  return L.divIcon({
    className: 'lt-div-icon',
    html,
    iconSize,
    iconAnchor,
    popupAnchor,
  });
}
