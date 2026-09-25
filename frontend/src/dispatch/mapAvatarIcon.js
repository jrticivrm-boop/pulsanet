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
 * Foto del marcador según modo Operadores:
 * - Por operador → foto del usuario
 * - Por grupo → foto del grupo si `groupPhotoSrc` viene resuelto;
 *   si no (varios grupos filtrados / sin avatar de grupo) → foto del usuario
 */
export function pickMapMarkerPhotoSrc({
  operatorMode = 'operator',
  userPhotoSrc,
  groupPhotoSrc,
} = {}) {
  if (operatorMode === 'group' && groupPhotoSrc) return groupPhotoSrc;
  return userPhotoSrc || null;
}

/**
 * Elige el grupo cuya foto mostrar en el pin (modo Por grupo).
 *
 * Regla:
 * - Pertenece a exactamente 1 de los grupos filtrados → foto de ese grupo
 *   (si tiene avatar; si no, null → fallback a foto de usuario).
 * - Pertenece a 2+ de los grupos filtrados → null → foto de perfil
 *   (evita conflicto de cuál grupo mostrar).
 *
 * @param {object} opts
 * @param {string[]} [opts.selectedGroupIds] — grupos marcados en el filtro
 * @param {string[]} [opts.memberGroupIds] — grupos del operador ∩ selección
 * @param {(groupId: string) => boolean} [opts.groupHasAvatar]
 * @returns {string|null} groupId o null
 */
export function resolveOperatorGroupForMarker({
  selectedGroupIds = [],
  memberGroupIds = [],
  groupHasAvatar,
} = {}) {
  const memberSet = new Set((memberGroupIds || []).map(String));
  const inFilter = (selectedGroupIds || []).map(String).filter((id) => memberSet.has(id));
  // Varios grupos filtrados a la vez → no elegir uno al azar; foto de perfil.
  if (inFilter.length !== 1) return null;
  const onlyId = inFilter[0];
  const hasAv =
    typeof groupHasAvatar === 'function' ? groupHasAvatar : () => false;
  return hasAv(onlyId) ? onlyId : null;
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
 * @param {number} [opts.absenceMinutes]
 * @param {boolean} [opts.showAway]
 * @param {boolean} [opts.showOffline]
 * @param {boolean} [opts.selected]
 * @param {string} [opts.photoSrc] — foto del usuario
 * @param {string} [opts.groupPhotoSrc] — foto del grupo (solo modo Por grupo)
 * @param {string} [opts.operatorMode] — operator|group
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
  absenceMinutes,
  showAway = true,
  showOffline = true,
  selected,
  photoSrc,
  groupPhotoSrc,
  operatorMode = 'operator',
  panic,
  awaySince,
}) {
  const effectivePhoto = pickMapMarkerPhotoSrc({
    operatorMode,
    userPhotoSrc: photoSrc,
    groupPhotoSrc,
  });
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const hasPhoto = Boolean(effectivePhoto);
  const status =
    resolvePresenceStatus({
      presence: presence || (live ? 'online' : undefined),
      focus,
      lastSeenAt,
      awaySince,
      offlineRedMinutes,
      absenceMinutes,
      showAway,
      showOffline,
    }) || (live ? 'online' : 'offline');
  const pinPresence = presencePinClass(status);
  const showRings = Boolean(status === 'online' || status === 'away' || panic);
  const label = showCargo
    ? cargoLabelFromText(cargo) || cargoLabelFromText(name)
    : '';
  const face = hasPhoto
    ? `<span class="lt-wa-photo-bg" style="background-image:url('${escapeCssUrl(effectivePhoto)}')" aria-hidden="true"></span>`
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
