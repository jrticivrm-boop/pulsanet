import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RoomEvent,
  Track,
  VideoPresets,
  createLocalAudioTrack,
  createLocalVideoTrack,
  AudioPresets,
} from 'livekit-client';
import { io } from 'socket.io-client';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { esMsg } from './esMsg';
import { assertMediaDevices } from './voiceRecord';
import { warmUpVideoCallMedia } from './callMedia';
import { socketIoOptions, socketUrl } from './socketConfig';
import { mergeStreamingRoomOptions, getVideoCaptureDefaults, oppositeFacingMode } from './videoStreaming';
import {
  joinGroupVideo,
  leaveGroupVideo,
  endGroupVideo,
  pingGroupVideo,
} from './api';

const PING_MS = 15000;

async function createStreamingVideoTrack(facingMode = 'user') {
  try {
    return await createLocalVideoTrack(getVideoCaptureDefaults(facingMode));
  } catch {
    return await createLocalVideoTrack({
      facingMode: facingMode === 'environment' ? 'environment' : 'user',
      resolution: VideoPresets.h540.resolution,
    });
  }
}

function readCameraTrack(participant) {
  if (!participant) return null;
  const pub = participant.getTrackPublication(Track.Source.Camera);
  return pub?.track || pub?.videoTrack || null;
}

/**
 * Hook de video grupal — sala LiveKit paralela al PTT (no modifica usePtt).
 */
export function useGroupVideo({ token, groupId, groupName, enabled, onRemoteEnded }) {
  const [status, setStatus] = useState('');
  const [active, setActive] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [muted, setMuted] = useState(false);
  const [tiles, setTiles] = useState([]);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const camRef = useRef(null);
  const facingModeRef = useRef('user');
  const audioEls = useRef([]);
  const closingRef = useRef(false);
  const pingRef = useRef(null);
  const rebuildRef = useRef(() => {});

  const rebuildTiles = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setTiles([]);
      return;
    }

    const remotes = [];
    for (const p of room.remoteParticipants.values()) {
      remotes.push({
        id: p.sid,
        name: p.name || p.identity || 'Participante',
        track: readCameraTrack(p),
        isLocal: false,
      });
    }

    let localTrack = camRef.current || readCameraTrack(room.localParticipant);
    if (localTrack && !camRef.current) camRef.current = localTrack;

    remotes.push({
      id: 'local',
      name: 'Tú',
      track: localTrack,
      isLocal: true,
      muted,
    });
    setTiles(remotes);
  }, [muted]);

  rebuildRef.current = rebuildTiles;

  const teardown = useCallback(async () => {
    clearInterval(pingRef.current);
    pingRef.current = null;
    audioEls.current.forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
    audioEls.current = [];
    try {
      camRef.current?.stop();
    } catch {
      /* ignore */
    }
    camRef.current = null;
    try {
      micRef.current?.stop();
    } catch {
      /* ignore */
    }
    micRef.current = null;
    try {
      await roomRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    roomRef.current = null;
    setTiles([]);
    setCameraOn(false);
    setActive(false);
  }, []);

  const bindRoomEvents = useCallback((room) => {
    const onVideoChange = () => rebuildRef.current();
    const onAudioSubscribed = (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.dataset.groupVideo = '1';
      document.body.appendChild(el);
      audioEls.current.push(el);
    };

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Audio) onAudioSubscribed(track);
      if (track.kind === Track.Kind.Video) onVideoChange();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) onVideoChange();
    });
    room.on(RoomEvent.LocalTrackPublished, onVideoChange);
    room.on(RoomEvent.LocalTrackUnpublished, onVideoChange);
    room.on(RoomEvent.ParticipantConnected, () => {
      onVideoChange();
      setParticipantCount(room.remoteParticipants.size + 1);
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      onVideoChange();
      setParticipantCount(room.remoteParticipants.size + 1);
    });
    room.on(RoomEvent.Reconnecting, () => setStatus('Reconectando…'));
    room.on(RoomEvent.Reconnected, () => setStatus('Transmisión activa'));
    room.on(RoomEvent.Disconnected, () => {
      if (!closingRef.current) setStatus('Desconectado');
    });
  }, []);

  const connect = useCallback(async () => {
    if (!token || !groupId || closingRef.current) return false;
    setStatus('Conectando transmisión…');
    try {
      await warmUpVideoCallMedia();
      const data = await joinGroupVideo(token, groupId);
      const room = await createEncryptedRoom(mergeStreamingRoomOptions(), data.e2eeKey);
      roomRef.current = room;
      bindRoomEvents(room);

      await room.connect(publicLiveKitUrl(data.url), data.token);
      assertMediaDevices();

      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      micRef.current = mic;
      await room.localParticipant.publishTrack(mic, {
        source: Track.Source.Microphone,
        audioPreset: AudioPresets.speech,
      });

      let cam = null;
      try {
        cam = await createStreamingVideoTrack(facingModeRef.current);
        camRef.current = cam;
        await room.localParticipant.publishTrack(cam, { source: Track.Source.Camera });
        setCameraOn(true);
      } catch (e) {
        setCameraOn(false);
        setStatus(esMsg(e, 'Conectado sin cámara — pulsa el botón de cámara'));
      }

      setMuted(false);
      setActive(true);
      setParticipantCount(data.session?.participantCount || 1);
      if (cam) setStatus(`Transmisión · ${groupName || 'Grupo'}`);

      pingRef.current = setInterval(() => {
        pingGroupVideo(token, groupId).catch(() => {});
      }, PING_MS);

      rebuildRef.current();
      return true;
    } catch (e) {
      setStatus(esMsg(e, 'No se pudo unir a la transmisión'));
      await teardown();
      return false;
    }
  }, [token, groupId, groupName, bindRoomEvents, teardown]);

  const disconnect = useCallback(async ({ skipServer = false } = {}) => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      if (!skipServer && token && groupId) await leaveGroupVideo(token, groupId);
    } catch {
      /* ignore */
    }
    await teardown();
    closingRef.current = false;
    setStatus('');
  }, [token, groupId, teardown]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    const cam = camRef.current;
    if (!room) return;
    if (cameraOn && cam) {
      try {
        await room.localParticipant.unpublishTrack(cam, true);
      } catch {
        /* ignore */
      }
      try {
        cam.stop();
      } catch {
        /* ignore */
      }
      camRef.current = null;
      setCameraOn(false);
    } else {
      try {
        await warmUpVideoCallMedia();
        const next = await createStreamingVideoTrack(facingModeRef.current);
        camRef.current = next;
        await room.localParticipant.publishTrack(next, { source: Track.Source.Camera });
        setCameraOn(true);
        setStatus(`Transmisión · ${groupName || 'Grupo'}`);
      } catch (e) {
        setStatus(esMsg(e, 'No se pudo activar cámara'));
      }
    }
    rebuildRef.current();
  }, [cameraOn, groupName]);

  const switchCamera = useCallback(async () => {
    const room = roomRef.current;
    const cam = camRef.current;
    if (!room || !cam || !cameraOn) return;
    const nextFacing = oppositeFacingMode(facingModeRef.current);
    try {
      await cam.restartTrack(getVideoCaptureDefaults(nextFacing));
      facingModeRef.current = nextFacing;
      setFacingMode(nextFacing);
      rebuildRef.current();
    } catch (e) {
      try {
        await room.localParticipant.unpublishTrack(cam, true);
        cam.stop();
        const fresh = await createStreamingVideoTrack(nextFacing);
        camRef.current = fresh;
        await room.localParticipant.publishTrack(fresh, { source: Track.Source.Camera });
        facingModeRef.current = nextFacing;
        setFacingMode(nextFacing);
        setCameraOn(true);
        rebuildRef.current();
      } catch (err) {
        setStatus(esMsg(err.message || e.message, 'No se pudo cambiar de cámara'));
      }
    }
  }, [cameraOn]);

  const toggleMute = useCallback(async () => {
    const mic = micRef.current;
    if (!mic) return;
    try {
      if (muted) {
        await mic.unmute();
        setMuted(false);
      } else {
        await mic.mute();
        setMuted(true);
      }
    } catch {
      /* ignore */
    }
    rebuildRef.current();
  }, [muted]);

  const stopBroadcast = useCallback(async () => {
    try {
      if (token && groupId) await endGroupVideo(token, groupId);
    } catch {
      /* ignore */
    }
    await disconnect();
  }, [token, groupId, disconnect]);

  useEffect(() => {
    if (!enabled || !token || !groupId) return undefined;
    closingRef.current = false;
    connect();
    return () => {
      closingRef.current = true;
      disconnect();
    };
  }, [enabled, token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rebuildRef.current();
  }, [cameraOn, muted, rebuildTiles]);

  useEffect(() => {
    if (!token || !groupId) return undefined;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token } });
    const onEnded = (payload) => {
      if (String(payload?.groupId) !== String(groupId)) return;
      closingRef.current = true;
      teardown()
        .then(() => {
          closingRef.current = false;
          onRemoteEnded?.();
        })
        .catch(() => {
          closingRef.current = false;
          onRemoteEnded?.();
        });
    };
    socket.on('group:video_ended', onEnded);
    socket.connect();
    return () => {
      socket.off('group:video_ended', onEnded);
      socket.disconnect();
    };
  }, [token, groupId, teardown, onRemoteEnded]);

  const displayTiles = useMemo(
    () => tiles.map((t) => (t.isLocal ? { ...t, muted } : t)),
    [tiles, muted]
  );

  return {
    status,
    active,
    participantCount,
    cameraOn,
    muted,
    tiles: displayTiles,
    facingMode,
    connect,
    disconnect,
    toggleCamera,
    switchCamera,
    toggleMute,
    stopBroadcast,
  };
}
