import { useEffect, useState } from 'react';
import {
  fetchAvatarBlobUrl,
  peekAvatarBlobUrl,
  fetchGroupAvatarBlobUrl,
  peekGroupAvatarBlobUrl,
} from './avatarBlobCache.js';

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
 */
export default function PersonAvatar({
  userId,
  groupId,
  avatarUrl,
  name,
  token,
  className = 'wa-inbox-avatar',
  group = false,
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

  if (photo) {
    return (
      <span className={cls} aria-hidden="true">
        <img src={photo} alt="" />
      </span>
    );
  }

  return (
    <span className={cls} aria-hidden="true">
      {group ? '👥' : initials(name)}
    </span>
  );
}
