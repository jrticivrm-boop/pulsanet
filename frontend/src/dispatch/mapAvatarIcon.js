import L from 'leaflet';
import { cargoLabelFromText } from './mapLabelUtils.js';
import { presencePinClass, resolvePresenceStatus } from './presenceStatus.js';

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
 * Pin de ubicación (gota) con foto o inicial + etiqueta de Cargo debajo.
 * @param {object} opts
 * @param {string} [opts.name]
 * @param {string} [opts.cargo]
 * @param {boolean} [opts.showCargo]
 * @param {boolean} [opts.live] — legado; preferir opts.presence
 * @param {string} [opts.presence] — online|service|offline|stale
 * @param {string} [opts.focus]
 * @param {string} [opts.lastSeenAt]
 * @param {number} [opts.offlineRedMinutes]
 * @param {boolean} [opts.selected]
 * @param {string} [opts.photoSrc]
 * @param {boolean} [opts.panic] — pánico: color alerta + animación (sobrescribe presencia)
 */
export function mapAvatarIcon({
  name,
  cargo,
  showCargo = true,
  live,
  presence,
  focus,
  lastSeenAt,
  offlineRedMinutes,
  selected,
  photoSrc,
  panic,
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const hasPhoto = Boolean(photoSrc);
  const status =
    resolvePresenceStatus({
      presence: presence || (live ? 'online' : undefined),
      focus,
      lastSeenAt,
      offlineRedMinutes,
    }) || (live ? 'online' : 'offline');
  const pinPresence = presencePinClass(status);
  const showRings = Boolean(status === 'online' || status === 'service' || panic);
  const label = showCargo
    ? cargoLabelFromText(cargo) || cargoLabelFromText(name)
    : '';
  const face = hasPhoto
    ? `<span class="lt-wa-photo-bg" style="background-image:url('${escapeCssUrl(photoSrc)}')" aria-hidden="true"></span>`
    : `<span class="lt-wa-letter">${escapeHtml(initial)}</span>`;
  const labelHtml = label
    ? `<span class="lt-wa-cargo">${escapeHtml(label)}</span>`
    : '';
  const html = `
    <div class="lt-wa ${pinPresence}${panic ? ' is-panic' : ''}${selected ? ' is-selected' : ''}${selected ? '' : ' lt-wa--compact'}${label ? ' has-cargo' : ''}">
      ${showRings ? '<span class="lt-wa-ring" aria-hidden="true"></span><span class="lt-wa-ring lt-wa-ring--late" aria-hidden="true"></span>' : ''}
      <span class="lt-wa-pin${hasPhoto ? ' has-photo' : ''}" aria-hidden="true">
        <span class="lt-wa-pin-tip"></span>
        <span class="lt-wa-pin-face">${face}</span>
      </span>
      ${labelHtml}
    </div>`;
  // Más alto si el cargo es largo (texto completo, sin ellipsis).
  const cargoLines = label ? Math.min(4, Math.ceil(label.length / 22)) : 0;
  const cargoH = cargoLines ? 18 + cargoLines * 14 : 0;
  const iconW = label ? Math.min(280, Math.max(120, 40 + label.length * 6)) : 120;
  const iconH = selected ? 68 + cargoH : 64 + cargoH;
  const iconSize = [iconW, iconH];
  const iconAnchor = [Math.round(iconW / 2), selected ? 64 : 60];
  const popupAnchor = selected ? [0, -58] : [0, -54];
  return L.divIcon({
    className: 'lt-div-icon',
    html,
    iconSize,
    iconAnchor,
    popupAnchor,
  });
}
