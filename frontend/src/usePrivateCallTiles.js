import { useCallback, useMemo, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';

const CLEAR_TRACK_MS = 2500;

/**
 * Tiles de video estables: no apaga el feed en unsubscribes breves.
 */
export function usePrivateCallTiles({ peerName, cameraOn, camRef }) {
  const [remoteVideos, setRemoteVideos] = useState([]);
  const [localTrackEpoch, setLocalTrackEpoch] = useState(0);
  const clearTimersRef = useRef(new Map());

  const notifyLocalTrackChanged = useCallback(() => {
    setLocalTrackEpoch((n) => n + 1);
  }, []);

  const upsertRemote = useCallback((participantSid, patch) => {
    setRemoteVideos((prev) => {
      const idx = prev.findIndex((r) => r.id === participantSid);
      if (idx === -1) {
        if (Object.prototype.hasOwnProperty.call(patch, 'track') && patch.track == null) {
          return prev;
        }
        return [...prev, { id: participantSid, name: patch.name || peerName, track: patch.track ?? null }];
      }
      const cur = prev[idx];
      const nextTrack = Object.prototype.hasOwnProperty.call(patch, 'track') ? patch.track : cur.track;
      const nextName = patch.name || cur.name || peerName;
      if (cur.track === nextTrack && cur.name === nextName) return prev;
      const next = [...prev];
      next[idx] = { ...cur, name: nextName, track: nextTrack };
      return next;
    });
  }, [peerName]);

  const removeRemote = useCallback((participantSid) => {
    const t = clearTimersRef.current.get(participantSid);
    if (t) {
      clearTimeout(t);
      clearTimersRef.current.delete(participantSid);
    }
    setRemoteVideos((prev) => prev.filter((r) => r.id !== participantSid));
  }, []);

  const scheduleClearTrack = useCallback(
    (participantSid) => {
      const existing = clearTimersRef.current.get(participantSid);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        clearTimersRef.current.delete(participantSid);
        upsertRemote(participantSid, { track: null });
      }, CLEAR_TRACK_MS);
      clearTimersRef.current.set(participantSid, timer);
    },
    [upsertRemote]
  );

  const readCameraTrack = (participant) => {
    const pub = participant.getTrackPublication?.(Track.Source.Camera);
    if (pub?.track) return pub.track;
    if (pub?.videoTrack) return pub.videoTrack;
    for (const p of participant.trackPublications?.values?.() || []) {
      if (p.kind === Track.Kind.Video && (p.track || p.videoTrack)) {
        return p.track || p.videoTrack;
      }
    }
    return null;
  };

  const bindRoomVideoEvents = useCallback(
    (room) => {
      if (!room) return () => {};

      const syncParticipant = (participant) => {
        const track = readCameraTrack(participant);
        if (track) {
          const pending = clearTimersRef.current.get(participant.sid);
          if (pending) {
            clearTimeout(pending);
            clearTimersRef.current.delete(participant.sid);
          }
          upsertRemote(participant.sid, {
            name: participant.name || participant.identity || peerName,
            track,
          });
        } else {
          upsertRemote(participant.sid, {
            name: participant.name || participant.identity || peerName,
          });
          scheduleClearTrack(participant.sid);
        }
      };

      const syncAllRemotes = () => {
        room.remoteParticipants.forEach(syncParticipant);
      };

      syncAllRemotes();

      const onSubscribed = (track, pub, participant) => {
        if (track.kind !== Track.Kind.Video) return;
        try {
          pub?.setSubscribed?.(true);
        } catch {
          /* ignore */
        }
        const pending = clearTimersRef.current.get(participant.sid);
        if (pending) {
          clearTimeout(pending);
          clearTimersRef.current.delete(participant.sid);
        }
        upsertRemote(participant.sid, {
          name: participant.name || participant.identity || peerName,
          track,
        });
      };

      const onUnsubscribed = (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Video) return;
        // Si aún hay otra publicación de cámara, no programar clear.
        const still = readCameraTrack(participant);
        if (still && still !== track) {
          upsertRemote(participant.sid, {
            name: participant.name || participant.identity || peerName,
            track: still,
          });
          return;
        }
        scheduleClearTrack(participant.sid);
      };

      const onConnected = (participant) => syncParticipant(participant);
      const onDisconnected = (participant) => removeRemote(participant.sid);
      const bumpLocal = (pub) => {
        if (pub?.source === Track.Source.Camera || pub?.track?.kind === Track.Kind.Video) {
          setLocalTrackEpoch((n) => n + 1);
        }
      };

      room.on(RoomEvent.TrackSubscribed, onSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.on(RoomEvent.ParticipantConnected, onConnected);
      room.on(RoomEvent.ParticipantDisconnected, onDisconnected);
      room.on(RoomEvent.LocalTrackPublished, bumpLocal);
      room.on(RoomEvent.LocalTrackUnpublished, bumpLocal);
      room.on(RoomEvent.Reconnected, syncAllRemotes);

      return () => {
        for (const t of clearTimersRef.current.values()) clearTimeout(t);
        clearTimersRef.current.clear();
        room.off(RoomEvent.TrackSubscribed, onSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
        room.off(RoomEvent.ParticipantConnected, onConnected);
        room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
        room.off(RoomEvent.LocalTrackPublished, bumpLocal);
        room.off(RoomEvent.LocalTrackUnpublished, bumpLocal);
        room.off(RoomEvent.Reconnected, syncAllRemotes);
      };
    },
    [peerName, removeRemote, scheduleClearTrack, upsertRemote]
  );

  const resetRemoteVideos = useCallback(() => {
    for (const t of clearTimersRef.current.values()) clearTimeout(t);
    clearTimersRef.current.clear();
    setRemoteVideos([]);
  }, []);

  const tiles = useMemo(() => {
    const localTrack = cameraOn ? camRef.current : null;
    const local = {
      id: 'local',
      name: 'Tú',
      track: localTrack,
      isLocal: true,
      muted: false,
    };

    const remotes =
      remoteVideos.length > 0
        ? remoteVideos.map((r) => ({
            id: r.id,
            name: r.name || peerName,
            track: r.track,
            isLocal: false,
          }))
        : [
            {
              id: 'remote-peer',
              name: peerName || 'Participante',
              track: null,
              isLocal: false,
            },
          ];

    return [local, ...remotes];
  }, [cameraOn, camRef, peerName, remoteVideos, localTrackEpoch]);

  return { tiles, bindRoomVideoEvents, resetRemoteVideos, notifyLocalTrackChanged };
}
