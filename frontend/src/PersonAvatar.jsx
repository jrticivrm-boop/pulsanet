import { useEffect, useState } from 'react';
import {
  fetchAvatarBlobUrl,
  peekAvatarBlobUrl,
  fetchGroupAvatarBlobUrl,
  peekGroupAvatarBlobUrl,
} from './avatarBlobCache.js';
import {
  PRESENCE_LABELS,
  normalizePresenceKey,
  presenceDotClass,
} from './dispatch/presenceStatus.js';

function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Avatar de usuario o grupo (lista chat, cabecera).
 * Sin foto: iniciales (usuario) o 👥 (grupo).
 * presence + showPresence: punto semáforo (paridad APK Contactos / DM).
 */
export default function PersonAvatar({
  userId,
  groupId,
  avatarUrl,
  name,
  token,
  className = 'wa-inbox-avatar',
  group = false,
  presence = null,
  online = false,
  showPresence = false,
}) {
  const [rev, setRev] = useState(0);
  const id = group ? groupId : userId;

  useEffect(() => {
    if (!id || !token) return undefined;
    if (group && !avatarUrl) return undefined;
    let cancelled = false;
    (async () => {
      if (group) {
        await fetchGroupAvatarBlobUrl(id, token, avatarUrl || '');
      } else {
        await fetchAvatarBlobUrl(id, token, avatarUrl || '');
      }
      if (!cancelled) setRev((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, avatarUrl, token, group]);

  void rev;
  const photo = id
    ? group
      ? peekGroupAvatarBlobUrl(id, avatarUrl || '')
      : peekAvatarBlobUrl(id, avatarUrl || '')
    : null;
  const cls = `${className}${group ? ' group' : ''}${photo ? ' has-photo' : ''}`;

  const avatarEl = photo ? (
    <span className={cls} aria-hidden="true">
      <img src={photo} alt="" />
    </span>
  ) : (
    <span className={cls} aria-hidden="true">
      {group ? '👥' : initials(name)}
    </span>
  );

  if (!showPresence || group) return avatarEl;

  const status = normalizePresenceKey(presence, online);
  const dotCls = presenceDotClass(status, { online });
  const label = PRESENCE_LABELS[status] || PRESENCE_LABELS.offline;

  return (
    <span className="person-avatar-with-presence" title={label}>
      {avatarEl}
      <span className={`presence-avatar-dot ${dotCls}`} aria-label={label} />
    </span>
  );
}
