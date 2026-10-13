import { useEffect, useRef } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { fetchLiveKitToken } from './api';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { isFinalDisconnect } from './livekitRoomState';

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
    /** Incluye salas aún conectando: al cancelar también se cierran (si no, quedan huérfanas). */
    const rooms = new Set();
    const retryTimers = new Set();

    const attach = (track) => attachRemoteAudio(track, mutedRef.current);

    const scheduleRetry = (g, attempt) => {
      const t = setTimeout(() => {
        retryTimers.delete(t);
        if (!cancelled) void openRoom(g, attempt + 1);
      }, Math.min(30000, 3000 * 2 ** Math.min(attempt, 4)));
      retryTimers.add(t);
    };

    const openRoom = async (g, attempt = 0) => {
      let room = null;
      try {
        const lk = await fetchLiveKitToken(token, g.id, { listenOnly: true });
        if (cancelled) return;
        room = await createEncryptedRoom(
          {
            adaptiveStream: false,
            dynacast: false,
          },
          lk.e2eeKey
        );
        rooms.add(room);
        room.on(RoomEvent.TrackSubscribed, attach);
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });
        const opened = room;
        await room.connect(publicLiveKitUrl(lk.url), lk.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        // El SDK reanuda solo; si se rinde, reabrir esta sala.
        opened.on(RoomEvent.Disconnected, (reason) => {
          rooms.delete(opened);
          if (!cancelled && !isFinalDisconnect(reason)) scheduleRetry(g, 0);
        });
      } catch (e) {
        if (room) {
          rooms.delete(room);
          try {
            room.disconnect();
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        console.warn('Dispatch listen', g.name, e.message);
        scheduleRetry(g, attempt);
      }
    };

    (async () => {
      const list = groupsRef.current || [];
      for (const g of list) {
        if (cancelled) return;
        if (!g?.id || skipSet.has(g.id)) continue;
        await openRoom(g);
      }
    })();

    return () => {
      cancelled = true;
      retryTimers.forEach((t) => clearTimeout(t));
      retryTimers.clear();
      rooms.forEach((room) => {
        try {
          room.disconnect();
        } catch {
          /* ignore */
        }
      });
      rooms.clear();
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
