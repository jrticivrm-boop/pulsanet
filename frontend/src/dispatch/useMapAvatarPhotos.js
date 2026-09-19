import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAvatarBlobUrl,
  hasAvatarEntry,
  peekAvatarBlobUrl,
  peekAvatarMarkerThumb,
  fetchGroupAvatarBlobUrl,
  hasGroupAvatarEntry,
  peekGroupAvatarBlobUrl,
} from '../avatarBlobCache.js';
import { fetchGroupMembers } from '../api.js';
import { resolveOperatorGroupForMarker } from './mapAvatarIcon.js';

/**
 * Precarga avatares para lista (full) y marcadores.
 * Los pines usan siempre la foto del usuario; en «Por grupo» también
 * precarga fotos de grupo como respaldo si el operador no tiene avatar.
 *
 * @param {Array<{ userId: string, avatarUrl?: string|null }>} people
 * @param {string} token
 * @param {object} [opts]
 * @param {'all'|'group'} [opts.operatorMode]
 * @param {string[]} [opts.selectedGroupIds]
 * @param {Array<{ id: string, avatarUrl?: string|null }>} [opts.groups]
 */
export function useMapAvatarPhotos(people, token, opts = {}) {
  const operatorMode = opts.operatorMode === 'group' ? 'group' : 'all';
  const selectedGroupIds = useMemo(
    () => [...new Set((opts.selectedGroupIds || []).map(String).filter(Boolean))],
    [opts.selectedGroupIds]
  );
  const groups = opts.groups || [];
  const groupsById = useMemo(() => {
    const m = new Map();
    for (const g of groups) {
      if (g?.id) m.set(String(g.id), g);
    }
    return m;
  }, [groups]);

  const [rev, setRev] = useState(0);
  /** userId → groupIds seleccionados a los que pertenece (orden de selección). */
  const [membershipByUser, setMembershipByUser] = useState(() => new Map());

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

  // Precarga avatares de grupos seleccionados (solo modo Por grupo).
  useEffect(() => {
    if (operatorMode !== 'group' || !token || !selectedGroupIds.length) return undefined;
    let cancelled = false;
    (async () => {
      let changed = false;
      for (const gid of selectedGroupIds) {
        const g = groupsById.get(gid);
        const av = g?.avatarUrl || '';
        if (!av) continue;
        if (hasGroupAvatarEntry(gid, av)) continue;
        await fetchGroupAvatarBlobUrl(gid, token, av);
        changed = true;
      }
      if (!cancelled && changed) setRev((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [operatorMode, selectedGroupIds, groupsById, token]);

  // Membresías: con 1 grupo el filtro de ubicaciones ya garantiza pertenencia;
  // con varios hay que resolver a cuál(es) pertenece cada operador.
  const selectedGroupsKey = selectedGroupIds.join(',');
  useEffect(() => {
    if (operatorMode !== 'group' || !token || !selectedGroupIds.length) {
      setMembershipByUser(new Map());
      return undefined;
    }
    if (selectedGroupIds.length === 1) {
      setMembershipByUser(new Map());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const next = new Map();
      for (const gid of selectedGroupIds) {
        try {
          const data = await fetchGroupMembers(token, gid);
          for (const mem of data.members || []) {
            const uid = String(mem.id || mem.userId || '');
            if (!uid) continue;
            const list = next.get(uid) || [];
            list.push(gid);
            next.set(uid, list);
          }
        } catch {
          /* ignore grupo sin permiso / error de red */
        }
      }
      if (!cancelled) setMembershipByUser(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [operatorMode, selectedGroupsKey, token, selectedGroupIds]);

  const groupHasAvatar = useCallback(
    (groupId) => {
      const g = groupsById.get(String(groupId));
      return Boolean(g?.avatarUrl);
    },
    [groupsById]
  );

  const memberGroupIdsFor = useCallback(
    (userId) => {
      if (!userId) return [];
      if (selectedGroupIds.length === 1) return selectedGroupIds;
      return membershipByUser.get(String(userId)) || [];
    },
    [selectedGroupIds, membershipByUser]
  );

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
      const src = peekAvatarMarkerThumb(p.userId, p.avatarUrl);
      return src === undefined ? null : src;
    },
    [rev]
  );

  const markerGroupPhoto = useCallback(
    (p) => {
      void rev;
      if (operatorMode !== 'group' || !p?.userId) return null;
      const gid = resolveOperatorGroupForMarker({
        selectedGroupIds,
        memberGroupIds: memberGroupIdsFor(p.userId),
        groupHasAvatar,
      });
      if (!gid) return null;
      const g = groupsById.get(gid);
      const av = g?.avatarUrl || '';
      if (!av) return null;
      const src = peekGroupAvatarBlobUrl(gid, av);
      return src || null;
    },
    [rev, operatorMode, selectedGroupIds, memberGroupIdsFor, groupHasAvatar, groupsById]
  );

  return { listPhoto, markerPhoto, markerGroupPhoto, ready: rev };
}
