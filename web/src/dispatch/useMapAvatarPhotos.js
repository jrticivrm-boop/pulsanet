import { useCallback, useEffect, useState } from 'react';
import {
  fetchAvatarBlobUrl,
  hasAvatarEntry,
  clearAvatarBlobCache,
  peekAvatarBlobUrl,
} from '../avatarBlobCache.js';

/**
 * Precarga avatares para lista (full) y marcadores (thumb circular).
 * @param {Array<{ userId: string, avatarUrl?: string|null }>} people
 */
export function useMapAvatarPhotos(people, token) {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!token || !people?.length) return undefined;
    let cancelled = false;
    (async () => {
      let changed = false;
      for (const p of people) {
        if (!p?.userId) continue;
        const av = p.avatarUrl || '';
        if (hasAvatarEntry(p.userId, av)) continue;
        await fetchAvatarBlobUrl(p.userId, token, av);
        changed = true;
      }
      if (!cancelled && changed) setRev((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [people, token]);

  useEffect(() => () => clearAvatarBlobCache(), []);

  const listPhoto = useCallback(
    (p) => {
      void rev;
      if (!p?.userId) return null;
      return peekAvatarBlobUrl(p.userId, p.avatarUrl) || null;
    },
    [rev]
  );

  const markerPhoto = useCallback(
    (p) => {
      void rev;
      if (!p?.userId) return null;
      const src = peekAvatarBlobUrl(p.userId, p.avatarUrl);
      return src === undefined ? null : src;
    },
    [rev]
  );

  return { listPhoto, markerPhoto, ready: rev };
}
