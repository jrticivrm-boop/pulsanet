import { useCallback, useMemo, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';

/**
 * Gestiona tiles de video (local + remotos) con suscripciones LiveKit estables.
 */
export function usePrivateCallTiles({ peerName, cameraOn, camRef }) {
  const [remoteVideos, setRemoteVideos] = useState([]);

  const upsertRemote = useCallback((participantSid, patch) => {
    setRemoteVideos((prev) => {
      const idx = prev.findIndex((r) => r.id === participantSid);
      if (idx === -1) {
        return [...prev, { id: participantSid, name: patch.name || peerName, track: patch.track ?? null }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, [peerName]);

  const removeRemote = useCallback((participantSid) => {
    setRemoteVideos((prev) => prev.filter((r) => r.id !== participantSid));
  }, []);

  const bindRoomVideoEvents = useCallback(
    (room) => {
      if (!room) return () => {};

      const syncParticipant = (participant) => {
        const pub = participant.getTrackPublication(Track.Source.Camera);
        const track = pub?.track || pub?.videoTrack || null;
        if (track) {
          upsertRemote(participant.sid, {
            name: participant.name || participant.identity || peerName,
            track,
          });
        }
      };

      room.remoteParticipants.forEach(syncParticipant);

      const onSubscribed = (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Video) return;
        upsertRemote(participant.sid, {
          name: participant.name || participant.identity || peerName,
          track,
        });
      };

      const onUnsubscribed = (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Video) return;
        upsertRemote(participant.sid, { track: null });
      };

      const onConnected = (participant) => syncParticipant(participant);
      const onDisconnected = (participant) => removeRemote(participant.sid);

      room.on(RoomEvent.TrackSubscribed, onSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.on(RoomEvent.ParticipantConnected, onConnected);
      room.on(RoomEvent.ParticipantDisconnected, onDisconnected);

      return () => {
        room.off(RoomEvent.TrackSubscribed, onSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
        room.off(RoomEvent.ParticipantConnected, onConnected);
        room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
      };
    },
    [peerName, removeRemote, upsertRemote]
  );

  const resetRemoteVideos = useCallback(() => setRemoteVideos([]), []);

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

    return [...remotes, local];
  }, [cameraOn, camRef, peerName, remoteVideos]);

  return { tiles, bindRoomVideoEvents, resetRemoteVideos };
}
