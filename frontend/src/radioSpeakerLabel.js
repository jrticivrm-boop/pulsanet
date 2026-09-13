import { cargoLabelFromText } from './dispatch/mapLabelUtils.js';

/** Quién habla: cargo/empleo primero (como el pin del mapa); si no, nombre/indicativo. */
export function speakerWhoLabel(displayName, cargo) {
  return cargoLabelFromText(cargo) || cargoLabelFromText(displayName) || 'Alguien';
}

/**
 * Etiqueta de estado bajo el PTT.
 * @param {{ listenMuted?: boolean, holding?: boolean, speakers?: Array<{userId?: string, displayName?: string, cargo?: string, groupId?: string}>, selfUserId?: string, groupNameFor?: (groupId: string) => string|null|undefined, livekitReady?: boolean, hasPttGroup?: boolean }} opts
 */
export function radioSpeakerStatusLabel({
  listenMuted = false,
  holding = false,
  speakers = [],
  selfUserId,
  groupNameFor,
  livekitReady,
  hasPttGroup,
} = {}) {
  if (listenMuted && holding) return 'Radio silenciada · Estás al aire';
  if (holding) return 'Estás al aire';

  const others = (Array.isArray(speakers) ? speakers : []).filter(
    (s) => s?.userId && (!selfUserId || s.userId !== selfUserId)
  );

  if (listenMuted) {
    if (others.length >= 2) return 'Radio silenciada · varios al aire';
    if (others.length === 1) {
      const who = speakerWhoLabel(others[0].displayName, others[0].cargo);
      const gname = groupNameFor?.(others[0].groupId);
      const detail = gname ? `${who} · ${gname}` : `${who} habla`;
      return `Radio silenciada · ${detail}`;
    }
    return 'Radio silenciada';
  }

  if (others.length >= 2) return 'Varios al aire';
  if (others.length === 1) {
    const who = speakerWhoLabel(others[0].displayName, others[0].cargo);
    const gname = groupNameFor?.(others[0].groupId);
    return gname ? `${who} · ${gname}` : `${who} habla`;
  }

  if (livekitReady === false) {
    return hasPttGroup ? 'Conectando…' : 'Sin canal PTT';
  }
  return 'Canal libre';
}
