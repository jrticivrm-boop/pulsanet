import { useEffect, useRef } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { fetchLiveKitToken } from './api';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';

function attachRemoteAudio(track, muted) {
  if (track.kind !== Track.Kind.Audio) return;
  if (track.attachedElements?.length) return;
  const el = track.attach();
  el.dataset.lkAudio = '1';
  el.playsInline = true;
  el.autoplay = true;
  el.muted = muted;
  el.volume = muted ? 0 : 1;
  if (typeof track.setVolume === 'function') {
    track.setVolume(muted ? 0 : 1);
  }
  document.body.appendChild(el);
  if (!muted) el.play().catch(() => {});
}

/**
 * Consola: escucha LiveKit de canales marcados en Escuchar que NO están
 * en Hablar (esos los cubre usePtt con identidad publicable).
 */
export function useDispatchListen({
  token,
  groups,
  skipGroupId,
  skipGroupIds,
  muted,
}) {
  const mutedRef = useRef(Boolean(muted));
  mutedRef.current = Boolean(muted);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const skipSet = new Set(
    (skipGroupIds?.length
      ? skipGroupIds
      : skipGroupId
        ? [skipGroupId]
        : []
    ).filter(Boolean)
  );
  const skipKey = [...skipSet].sort().join(',');
  const groupKey = (groups || []).map((g) => g.id).sort().join(',');

  useEffect(() => {
    if (!token || !groupKey) return undefined;
    let cancelled = false;
    const rooms = [];

    const attach = (track) => attachRemoteAudio(track, mutedRef.current);

    (async () => {
      const list = groupsRef.current || [];
      for (const g of list) {
        if (!g?.id || skipSet.has(g.id)) continue;
        try {
          const lk = await fetchLiveKitToken(token, g.id, { listenOnly: true });
          if (cancelled) return;
          const room = await createEncryptedRoom(
            {
              adaptiveStream: false,
              dynacast: false,
            },
            lk.e2eeKey
          );
          room.on(RoomEvent.TrackSubscribed, attach);
          room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((el) => el.remove());
          });
          await room.connect(publicLiveKitUrl(lk.url), lk.token);
          rooms.push(room);
        } catch (e) {
          console.warn('Dispatch listen', g.name, e.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      rooms.forEach((room) => {
        try {
          room.disconnect();
        } catch {
          /* ignore */
        }
      });
    };
    // skipSet derived from skipKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, skipKey, groupKey]);

  useEffect(() => {
    document.querySelectorAll('[data-lk-audio]').forEach((el) => {
      el.muted = Boolean(muted);
      el.volume = muted ? 0 : 1;
    });
  }, [muted]);
}
