import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  AudioPresets,
} from 'livekit-client';
import { io } from 'socket.io-client';
import {
  requestPrivateCallVideo,
  respondPrivateCallVideo,
  stopPrivateCallVideo,
  refreshPrivateCall,
  controlRemoteCamera,
  endPrivateCall,
} from './api';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { esMsg } from './esMsg';
import { assertMediaDevices } from './voiceRecord';
import { socketIoOptions, socketUrl } from './socketConfig';
import { setPrivateCallUiOpen } from './privateCallUi';
import { warmUpVideoCallMedia } from './callMedia';
import { showChatMessageToast } from './chatNotify';
import VideoConferenceMosaic, { VideoSizeSegment } from './VideoConferenceMosaic';
import { usePrivateCallTiles } from './usePrivateCallTiles';
import { attachPrivateCallStabilizer } from './privateCallStabilizer';
import { mergeStreamingRoomOptions, getVideoCaptureDefaults, oppositeFacingMode, createStreamingVideoTrack, isCameraTrackDead } from './videoStreaming';
import PersonAvatar from './PersonAvatar';
import CallAddParticipantSheet from './CallAddParticipantSheet';

function previewFromMessage(message) {
  if (!message) return 'Nuevo mensaje';
  if (message.type === 'text') return String(message.body || '').slice(0, 80);
  if (message.type === 'image') return '📷 Imagen';
  if (message.type === 'audio') return '🎤 Audio';
  if (message.type === 'sticker') return 'Sticker';
  if (message.type === 'video') return '🎬 Video';
  if (message.mediaName) return `📎 ${message.mediaName}`;
  return 'Nuevo mensaje';
}

function formatCallElapsed(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Overlay llamada / videollamada / radio privada 1:1 (LiveKit + E2EE).
 * layout: `overlay` | `console` | `slot` (celda de conferencia multi-cámara)
 */
export default function PrivateCallOverlay({
  call,
  onHangup,
  layout = 'overlay',
  selected = false,
  onSelect,
}) {
  const isRadio = call?.mode === 'radio';
  const isVideo = call?.mode === 'video';
  const isRemoteCamera = call?.intent === 'remote_camera';
  /** Despacho pide ver cámara del dispositivo: no publica cam local por defecto. */
  const isMonitorCaller = isRemoteCamera && call?.role === 'caller';
  const isConsole = layout === 'console';
  const isSlot = layout === 'slot';
  const [status, setStatus] = useState(
    isMonitorCaller ? 'Solicitando cámara…' : 'Conectando…'
  );
  const [callConnected, setCallConnected] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const connectedAtRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [pttHeld, setPttHeld] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [videoRequest, setVideoRequest] = useState(null);
  const [expanded, setExpanded] = useState(false);
  /** Tamaño del video en Expandir: sm | md | lg | xl | fill */
  const [panelSize, setPanelSize] = useState('fill');
  const soloHeight =
    panelSize === 'sm'
      ? '42%'
      : panelSize === 'md'
        ? '58%'
        : panelSize === 'lg'
          ? '72%'
          : panelSize === 'fill'
            ? '100%'
            : '88%';
  /** Control remoto del dispositivo (monitor). */
  const [remoteFacing, setRemoteFacing] = useState('back');
  const [remoteMic, setRemoteMic] = useState(false);
  const [remoteCtrlBusy, setRemoteCtrlBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState([]);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const camRef = useRef(null);
  const facingModeRef = useRef('user');
  const audioEls = useRef([]);
  const closingRef = useRef(false);
  const userCameraOffRef = useRef(isMonitorCaller);
  const onHangupRef = useRef(onHangup);
  const callRef = useRef(call);
  const { tiles, bindRoomVideoEvents, resetRemoteVideos, notifyLocalTrackChanged } = usePrivateCallTiles({
    peerName: call?.peerName,
    cameraOn,
    camRef,
  });
  const displayTiles = useMemo(() => {
    const mapped = tiles.map((t) => (t.isLocal ? { ...t, muted } : t));
    if (!isMonitorCaller) return mapped;
    // Monitor: un solo feed del dispositivo (centrado en pantalla).
    const remotes = mapped.filter((t) => !t.isLocal);
    const withTrack = remotes.find((t) => t.track) || remotes[0];
    const local = mapped.find((t) => t.isLocal && t.track);
    if (withTrack) return local ? [withTrack, local] : [withTrack];
    if (local) return [local];
    return [{ id: 'remote-wait', name: call?.peerName || 'Dispositivo', track: null, isLocal: false }];
  }, [tiles, muted, isMonitorCaller, call?.peerName]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    onHangupRef.current = onHangup;
  }, [onHangup]);

  function markConnected() {
    if (!connectedAtRef.current) {
      connectedAtRef.current = Date.now();
      setCallConnected(true);
      setElapsedSec(0);
    }
  }

  useEffect(() => {
    if (!callConnected) return undefined;
    const tick = () => {
      const start = connectedAtRef.current;
      if (!start) return;
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [callConnected]);

  useEffect(() => {
    // Monitores en slot no ensucian el flag de llamada 1:1 (chat/notificaciones).
    if (isSlot || isMonitorCaller) return undefined;
    setPrivateCallUiOpen(true);
    return () => setPrivateCallUiOpen(false);
  }, [isSlot, isMonitorCaller]);

  async function enableCamera(explicitRoom) {
    const room = explicitRoom || roomRef.current;
    if (!room || userCameraOffRef.current) return false;
    if (camRef.current) {
      notifyLocalTrackChanged();
      setCameraOn(true);
      return true;
    }
    try {
      assertMediaDevices();
      const cam = await createStreamingVideoTrack(createLocalVideoTrack, facingModeRef.current);
      camRef.current = cam;
      await room.localParticipant.publishTrack(cam, { source: Track.Source.Camera });
      setCameraOn(true);
      notifyLocalTrackChanged();
      return true;
    } catch (e) {
      setCameraOn(false);
      notifyLocalTrackChanged();
      setStatus(esMsg(e, 'No se pudo activar la cámara'));
      return false;
    }
  }

  async function republishCameraAfterReconnect() {
    if (userCameraOffRef.current || isMonitorCaller || !isVideo) return;
    const room = roomRef.current;
    if (!room) return;
    const existing = camRef.current;
    if (!isCameraTrackDead(existing)) {
      notifyLocalTrackChanged();
      return;
    }
    try {
      if (existing) {
        try {
          await room.localParticipant.unpublishTrack(existing, true);
        } catch {
          /* ignore */
        }
        try {
          existing.stop();
        } catch {
          /* ignore */
        }
        camRef.current = null;
      }
      setCameraOn(false);
      notifyLocalTrackChanged();
      await enableCamera(room);
    } catch (e) {
      setStatus(esMsg(e, 'No se pudo restaurar la cámara'));
    }
  }

  async function switchCamera() {
    const room = roomRef.current;
    const cam = camRef.current;
    if (!room || !cam || !cameraOn) return;
    const next = oppositeFacingMode(facingModeRef.current);
    try {
      await cam.restartTrack(getVideoCaptureDefaults(next));
      facingModeRef.current = next;
      setFacingMode(next);
      notifyLocalTrackChanged();
    } catch (e) {
      try {
        await room.localParticipant.unpublishTrack(cam, true);
        cam.stop();
        camRef.current = null;
        const fresh = await createStreamingVideoTrack(createLocalVideoTrack, next);
        camRef.current = fresh;
        await room.localParticipant.publishTrack(fresh, { source: Track.Source.Camera });
        facingModeRef.current = next;
        setFacingMode(next);
        setCameraOn(true);
        notifyLocalTrackChanged();
      } catch (err) {
        setStatus(esMsg(err.message || e.message, 'No se pudo cambiar de cámara'));
      }
    }
  }

  async function teardownMedia() {
    try {
      await disableCamera(false);
    } catch {
      /* ignore */
    }
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
    resetRemoteVideos();
  }

  async function disableCamera(notifyPeer = true) {
    const room = roomRef.current;
    const cam = camRef.current;
    try {
      if (cam && room) {
        await room.localParticipant.unpublishTrack(cam, true);
      } else if (room) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.track) {
          await room.localParticipant.unpublishTrack(pub.track, true);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      cam?.stop();
    } catch {
      /* ignore */
    }
    camRef.current = null;
    setCameraOn(false);
    notifyLocalTrackChanged();
    if (notifyPeer && callRef.current?.callId && callRef.current?.authToken) {
      stopPrivateCallVideo(callRef.current.authToken, callRef.current.callId).catch(() => {});
    }
  }

  async function toggleCamera() {
    if (cameraOn) {
      userCameraOffRef.current = true;
      await disableCamera(true);
    } else {
      userCameraOffRef.current = false;
      await enableCamera();
    }
  }

  async function requestPeerCamera() {
    if (!callRef.current?.authToken || !callRef.current?.callId) return;
    try {
      await requestPrivateCallVideo(callRef.current.authToken, callRef.current.callId);
      setStatus('Esperando que acepte la cámara…');
    } catch (e) {
      setStatus(esMsg(e.message, 'No se pudo solicitar cámara'));
    }
  }

  async function respondVideoRequest(accept) {
    const req = videoRequest;
    setVideoRequest(null);
    if (!callRef.current?.authToken || !callRef.current?.callId) return;
    try {
      await respondPrivateCallVideo(callRef.current.authToken, callRef.current.callId, accept);
      if (accept) {
        userCameraOffRef.current = false;
        await warmUpVideoCallMedia();
        await enableCamera();
        markConnected();
        setStatus('En llamada');
      }
    } catch (e) {
      setStatus(esMsg(e.message, 'Error al responder solicitud'));
    }
  }

  async function sendRemoteControl(patch) {
    const c = callRef.current;
    if (!c?.authToken || !c?.callId || remoteCtrlBusy) return;
    setRemoteCtrlBusy(true);
    const cmdId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // Un solo camino HTTP/socket — fallos de control NUNCA cuelgan la sesión.
      await controlRemoteCamera(c.authToken, c.callId, { ...patch, cmdId });
      try {
        const room = roomRef.current;
        const lp = room?.localParticipant;
        if (lp?.publishData) {
          const payload = JSON.stringify({
            type: 'remote_cam_ctrl',
            callId: c.callId,
            cmdId,
            ts: Date.now(),
            ...patch,
          });
          await lp.publishData(new TextEncoder().encode(payload), { reliable: true });
        }
      } catch {
        /* data packet opcional */
      }
      if (patch.facing != null) setRemoteFacing(patch.facing);
      if (patch.mic != null) setRemoteMic(Boolean(patch.mic));
      setStatus(
        patch.facing != null
          ? `Cambiando a cámara ${patch.facing === 'front' ? 'frontal' : 'trasera'}…`
          : patch.mic
            ? 'Micrófono del dispositivo activado'
            : 'Micrófono del dispositivo apagado'
      );
    } catch (e) {
      setStatus(esMsg(e.message, 'No se pudo controlar el dispositivo'));
    } finally {
      setRemoteCtrlBusy(false);
    }
  }

  function toggleRemoteFacing() {
    const next = remoteFacing === 'front' ? 'back' : 'front';
    void sendRemoteControl({ facing: next });
  }

  function toggleRemoteMic() {
    void sendRemoteControl({ mic: !remoteMic });
  }

  useEffect(() => {
    let cancelled = false;
    let unbindVideo = () => {};
    let detachStabilizer = () => {};
    let signalSocket = null;

    async function remoteEnd(label) {
      if (cancelled || closingRef.current) return;
      closingRef.current = true;
      setStatus(label || (isRadio ? 'Radio finalizada' : 'Llamada finalizada'));
      await teardownMedia();
      onHangupRef.current?.({ remote: true });
    }

    const token = call?.authToken;
    if (token && call?.callId) {
      signalSocket = io(socketUrl(), {
        ...socketIoOptions,
        auth: { token },
      });
      signalSocket.on('call:ended', (payload) => {
        if (String(payload?.callId) === String(call.callId)) {
          const reason = payload?.reason;
          const label =
            reason === 'reject'
              ? 'Rechazada'
              : reason === 'timeout' || reason === 'no_answer'
                ? 'Sin respuesta'
                : undefined;
          remoteEnd(label);
        }
      });
      signalSocket.on('call:accepted', (payload) => {
        if (payload?.callId === call.callId && call.role === 'caller') {
          markConnected();
          setStatus(
            isMonitorCaller
              ? 'Cámara en vivo'
              : isRadio
                ? 'Radio activa'
                : isVideo
                  ? 'Videollamada'
                  : 'En llamada'
          );
        }
      });
      signalSocket.on('call:video_request', (payload) => {
        if (payload?.callId !== call.callId) return;
        setVideoRequest(payload);
      });
      signalSocket.on('call:video_accepted', (payload) => {
        if (payload?.callId !== call.callId) return;
        setStatus('Cámara remota activada');
      });
      signalSocket.on('call:video_rejected', (payload) => {
        if (payload?.callId !== call.callId) return;
        setStatus('Cámara remota rechazada');
      });
      signalSocket.on('call:video_stopped', (payload) => {
        if (payload?.callId !== call.callId) return;
        resetRemoteVideos();
      });
      signalSocket.on('call:remote_control_ack', (payload) => {
        if (String(payload?.callId) !== String(call.callId)) return;
        if (payload?.facing === 'front' || payload?.facing === 'back') {
          setRemoteFacing(payload.facing);
        }
        if (typeof payload?.mic === 'boolean') setRemoteMic(payload.mic);
      });
      signalSocket.on('dm:notify', ({ peerId, peerName, message }) => {
        const active = callRef.current;
        if (!active?.peerId || String(peerId) !== String(active.peerId)) return;
        showChatMessageToast({
          kind: 'dm',
          peerId,
          peerName: peerName || active.peerName || 'Mensaje',
          preview: previewFromMessage(message),
          title: peerName || active.peerName || 'Mensaje',
        });
      });
    }

    (async () => {
      try {
        const room = await createEncryptedRoom(
          mergeStreamingRoomOptions(),
          call.e2eeKey,
          { requireKey: call.e2ee === true },
        );
        roomRef.current = room;
        unbindVideo = bindRoomVideoEvents(room);
        detachStabilizer = attachPrivateCallStabilizer({
          room,
          callId: call.callId,
          authToken: token,
          signalSocket,
          closingRef,
          onStatus: (msg) => {
            if (!cancelled && !closingRef.current) setStatus(msg);
          },
          onRemoteEnd: () => remoteEnd(undefined),
          onGiveUp: async () => {
            try {
              if (call.callId && token) {
                await endPrivateCall(token, call.callId, 'hangup');
              }
            } catch {
              /* ignore */
            }
            await remoteEnd(undefined);
          },
          getPeerLabel: () => call.peerName || 'el otro usuario',
          // Monitor: no colgar por cortes breves del despacho/dispositivo.
          peerGraceMs: isMonitorCaller ? 90_000 : undefined,
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication) => {
          if (track.kind === Track.Kind.Video) {
            try {
              publication?.setSubscribed?.(true);
            } catch {
              /* ignore */
            }
          }
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.dataset.privateCall = '1';
            document.body.appendChild(el);
            audioEls.current.push(el);
            markConnected();
            setStatus(
              isRadio
                ? 'Radio activa'
                : isMonitorCaller
                  ? 'Cámara en vivo'
                  : isVideo
                    ? 'Videollamada'
                    : 'En llamada'
            );
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          // LiveKit reconecta solo; no spamear "Reconectando…" en microcortes.
        });
        room.on(RoomEvent.Reconnected, () => {
          if (cancelled || closingRef.current) return;
          // No republicar cámara en monitor; en video solo si el track murió (debounce largo).
          window.clearTimeout(room._tpxRepublishTimer);
          room._tpxRepublishTimer = window.setTimeout(() => {
            if (cancelled || closingRef.current) return;
            void republishCameraAfterReconnect();
          }, 1500);
        });

        await room.connect(publicLiveKitUrl(call.url), call.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        assertMediaDevices();
        // Monitor: no publicar mic del puesto (independiente del mic del dispositivo).
        if (!isMonitorCaller) {
          const mic = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          });
          micRef.current = mic;
          await room.localParticipant.publishTrack(mic, {
            source: Track.Source.Microphone,
            audioPreset: AudioPresets.speech,
            dtx: false,
            red: false,
          });
          if (isRadio) {
            await mic.mute();
            setMuted(true);
          } else {
            setMuted(false);
          }
        } else {
          setMuted(true);
        }
        if (isVideo && !userCameraOffRef.current && !isMonitorCaller) {
          await enableCamera(room);
        }
        setStatus(
          call.role === 'caller'
            ? isMonitorCaller
              ? 'Esperando cámara…'
              : isRadio
                ? 'Esperando respuesta…'
                : isVideo
                  ? 'Videollamando…'
                  : 'Llamando…'
            : isRadio
              ? 'Radio activa'
              : isVideo
                ? 'Videollamada'
                : 'En llamada'
        );
        if (call.role !== 'caller') markConnected();
      } catch (e) {
        if (!cancelled) {
          setStatus(esMsg(e, 'No se pudo conectar — reintentando…'));
          setTimeout(async () => {
            if (cancelled || closingRef.current) return;
            try {
              const fresh = await refreshPrivateCall(call.authToken, call.callId);
              const room = roomRef.current;
              if (room && fresh?.token) {
                await room.connect(publicLiveKitUrl(fresh.url), fresh.token);
                markConnected();
                setStatus('En llamada');
                return;
              }
            } catch {
              /* fall through */
            }
            try {
              if (call.callId && call.authToken) {
                await endPrivateCall(call.authToken, call.callId, 'hangup');
              }
            } catch {
              /* ignore */
            }
            onHangupRef.current?.({ remote: true });
          }, 2400);
        }
      }
    })();

    return () => {
      cancelled = true;
      unbindVideo();
      detachStabilizer();
      try {
        signalSocket?.disconnect();
      } catch {
        /* ignore */
      }
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
      try {
        roomRef.current?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [
    bindRoomVideoEvents,
    call?.callId,
    call?.token,
    call?.url,
    call?.e2eeKey,
    call?.peerName,
    call?.peerId,
    call?.role,
    isRadio,
    isVideo,
    isMonitorCaller,
    resetRemoteVideos,
  ]);

  async function toggleMute() {
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
  }

  async function pttDown() {
    if (!isRadio || pttHeld) return;
    const mic = micRef.current;
    if (!mic) return;
    try {
      await mic.unmute();
      setMuted(false);
      setPttHeld(true);
    } catch {
      /* ignore */
    }
  }

  async function pttUp() {
    if (!isRadio || !pttHeld) return;
    const mic = micRef.current;
    setPttHeld(false);
    try {
      await mic.mute();
      setMuted(true);
    } catch {
      /* ignore */
    }
  }

  async function hangupClick() {
    if (closingRef.current) return;
    closingRef.current = true;
    await teardownMedia();
    await onHangupRef.current?.({ remote: false });
  }

  function minimize() {
    if (isConsole && expanded) {
      setExpanded(false);
      return;
    }
    setMinimized(true);
  }

  const initials =
    (call.peerName || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  const peerAvatar = call.peerId && call.authToken ? (
    <PersonAvatar
      userId={call.peerId}
      name={call.peerName}
      avatarUrl={call.peerAvatarUrl}
      token={call.authToken}
      className="private-call-avatar private-call-avatar-lg solo"
    />
  ) : (
    <div className="private-call-avatar private-call-avatar-lg solo" aria-hidden="true">
      {initials}
    </div>
  );

  const label = isRadio
    ? 'Radio personal'
    : isMonitorCaller
      ? 'Cámara remota'
      : isVideo
        ? 'Videollamada'
        : 'Llamada de voz';
  const showMosaic = isVideo || cameraOn || displayTiles.some((t) => t.track);
  const useFullscreen = (!isConsole && !isSlot) || expanded;
  const statusLine = callConnected ? formatCallElapsed(elapsedSec) : status;
  const statusTone = callConnected ? 'live' : /llamando|esperando|conectando|videollamando|invitando/i.test(status) ? 'ring' : 'idle';
  const canAddParticipant = isVideo && !isMonitorCaller && !isRadio && callConnected;
  const excludeForInvite = useMemo(() => {
    const ids = new Set();
    if (call?.userId) ids.add(String(call.userId));
    if (call?.peerId) ids.add(String(call.peerId));
    for (const id of invitedIds) ids.add(String(id));
    try {
      const room = roomRef.current;
      const localId = room?.localParticipant?.identity;
      if (localId) ids.add(String(localId));
      for (const p of room?.remoteParticipants?.values?.() || []) {
        if (p?.identity) ids.add(String(p.identity));
      }
    } catch {
      /* ignore */
    }
    return [...ids];
  }, [call?.userId, call?.peerId, invitedIds, tiles]);

  const controls = (
    <div
      className={`private-call-actions wa-actions${isConsole ? ' console-bar' : ''}${isMonitorCaller ? ' is-monitor' : ''}`}
    >
      {isMonitorCaller ? (
        <>
          <div className="private-call-monitor-status" aria-live="polite">
            <span className={`private-call-live-pill${displayTiles.some((t) => t.track && !t.isLocal) ? ' on' : ''}`}>
              {displayTiles.some((t) => t.track && !t.isLocal) ? 'EN VIVO' : 'ESPERANDO'}
            </span>
            <small className="private-call-monitor-status-line">{statusLine}</small>
          </div>
          <div className="private-call-monitor-actions">
            <button
              type="button"
              className="wa-call-circle video"
              onClick={toggleRemoteFacing}
              disabled={remoteCtrlBusy}
              title={remoteFacing === 'front' ? 'Cambiar a cámara trasera' : 'Cambiar a cámara frontal'}
            >
              <span aria-hidden="true">⟲</span>
              {remoteFacing === 'front' ? 'Frontal' : 'Trasera'}
            </button>
            <button
              type="button"
              className={`wa-call-circle mute${remoteMic ? '' : ' is-off'}`}
              onClick={toggleRemoteMic}
              disabled={remoteCtrlBusy}
              title={remoteMic ? 'Apagar micrófono del dispositivo' : 'Activar micrófono del dispositivo'}
            >
              <span aria-hidden="true">{remoteMic ? '🎙' : '🔇'}</span>
              {remoteMic ? 'Mic' : 'Mic off'}
            </button>
            <button type="button" className="wa-call-circle hangup" onClick={hangupClick}>
              <span aria-hidden="true">📵</span>
              Colgar
            </button>
          </div>
        </>
      ) : isRadio ? (
        <>
          <button
            type="button"
            className={`wa-call-circle ptt${pttHeld ? ' holding' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              pttDown();
            }}
            onPointerUp={() => pttUp()}
            onPointerCancel={() => pttUp()}
            onLostPointerCapture={() => pttUp()}
            onContextMenu={(e) => e.preventDefault()}
            aria-pressed={pttHeld}
            title="Mantén para hablar"
          >
            <span aria-hidden="true">🎙</span>
            {pttHeld ? 'AL AIRE' : 'PTT'}
          </button>
          <button type="button" className="wa-call-circle hangup" onClick={hangupClick}>
            <span aria-hidden="true">📵</span>
            Cerrar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`wa-call-circle mute${muted ? ' is-off' : ''}`}
            onClick={toggleMute}
            title={muted ? 'Activar micrófono' : 'Silenciar'}
          >
            <span aria-hidden="true">{muted ? '🔇' : '🎙'}</span>
            {muted ? 'Mic off' : 'Mic'}
          </button>
          <button
            type="button"
            className={`wa-call-circle video${cameraOn ? '' : ' is-off'}`}
            onClick={toggleCamera}
            title={cameraOn ? 'Apagar cámara' : 'Encender cámara'}
          >
            <span aria-hidden="true">{cameraOn ? '📷' : '🚫'}</span>
            {cameraOn ? 'Cámara' : 'Sin cam'}
          </button>
          {cameraOn && (
            <button
              type="button"
              className="wa-call-circle video"
              onClick={switchCamera}
              title={facingMode === 'user' ? 'Cambiar a cámara trasera' : 'Cambiar a cámara frontal'}
            >
              <span aria-hidden="true">⟲</span>
              Girar
            </button>
          )}
          {canAddParticipant && (
            <button
              type="button"
              className="wa-call-circle add-peer"
              onClick={() => setAddOpen(true)}
              title="Añadir participante"
            >
              <span aria-hidden="true">👤+</span>
              Añadir
            </button>
          )}
          {!isVideo && !cameraOn && (
            <button type="button" className="wa-call-circle video-req" onClick={requestPeerCamera}>
              <span aria-hidden="true">👁</span>
              Pedir cam
            </button>
          )}
          <button type="button" className="wa-call-circle hangup" onClick={hangupClick} title="Colgar">
            <span aria-hidden="true">📵</span>
            Colgar
          </button>
        </>
      )}
    </div>
  );

  const videoRequestUi = videoRequest && (
    <div className="private-call-video-request" role="alertdialog">
      <p>
        <strong>{videoRequest.fromName || 'Usuario'}</strong> solicita ver tu cámara
      </p>
      <div className="private-call-video-request-actions">
        <button type="button" className="btn ghost" onClick={() => respondVideoRequest(false)}>
          Rechazar
        </button>
        <button type="button" className="btn primary" onClick={() => respondVideoRequest(true)}>
          Activar cámara
        </button>
      </div>
    </div>
  );

  if (minimized && useFullscreen) {
    const mini = (
      <div className="private-call-mini" role="status" aria-label="Llamada en curso" data-esc-close="">
        <button
          type="button"
          className="private-call-mini-main"
          onClick={() => setMinimized(false)}
          data-esc-close-btn=""
        >
          <span className="private-call-mini-avatar" aria-hidden="true">
            {call.peerId && call.authToken ? (
              <PersonAvatar
                userId={call.peerId}
                name={call.peerName}
                avatarUrl={call.peerAvatarUrl}
                token={call.authToken}
                className="private-call-mini-photo"
              />
            ) : (
              initials
            )}
          </span>
          <span className="private-call-mini-text">
            <strong>{call.peerName}</strong>
            <small>{statusLine}</small>
          </span>
        </button>
        <button
          type="button"
          className="private-call-mini-hangup"
          onClick={hangupClick}
          title={isRadio ? 'Cerrar' : 'Colgar'}
        >
          📵
        </button>
      </div>
    );
    return isConsole || isSlot ? mini : createPortal(mini, document.body);
  }

  if (isSlot) {
    return (
      <article
        className={`rmc-slot${selected ? ' is-selected' : ''}${displayTiles.some((t) => t.track && !t.isLocal) ? ' is-live' : ''}`}
        aria-label={`Cámara de ${call.peerName}`}
        onClick={() => onSelect?.()}
      >
        <div className="rmc-slot-video">
          <VideoConferenceMosaic tiles={displayTiles} compact />
        </div>
        <footer className="rmc-slot-foot">
          <div className="rmc-slot-meta">
            <strong>{call.peerName}</strong>
            <small>{statusLine}</small>
          </div>
          <div className="rmc-slot-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rmc-slot-btn"
              onClick={toggleRemoteFacing}
              disabled={remoteCtrlBusy}
              title={remoteFacing === 'front' ? 'Cámara trasera' : 'Cámara frontal'}
            >
              {remoteFacing === 'front' ? 'Frontal' : 'Trasera'}
            </button>
            <button
              type="button"
              className={`rmc-slot-btn${remoteMic ? ' on' : ''}`}
              onClick={toggleRemoteMic}
              disabled={remoteCtrlBusy}
              title={remoteMic ? 'Apagar micrófono' : 'Activar micrófono'}
            >
              {remoteMic ? 'Mic ON' : 'Mic OFF'}
            </button>
            <button type="button" className="rmc-slot-btn danger" onClick={hangupClick} title="Colgar">
              Colgar
            </button>
          </div>
        </footer>
      </article>
    );
  }

  const consolePanel = (
    <section
      className={`cc-video-panel size-lg${expanded ? ' is-fs-away' : ''}`}
      aria-label="Videoconferencia en consola"
    >
      <header className="cc-video-panel-head">
        <div>
          <h2>{isMonitorCaller ? 'Cámara del dispositivo' : 'Videoconferencia'}</h2>
          <p className="cc-hint">
            {call.peerName} · {statusLine}
            {expanded ? ' · pantalla completa' : ''}
          </p>
        </div>
        <div className="cc-video-panel-tools">
          <button
            type="button"
            className="cc-btn"
            onClick={() => {
              setExpanded((v) => {
                if (!v) setPanelSize('fill');
                return !v;
              });
            }}
            title={expanded ? 'Volver al panel' : 'Pantalla completa'}
          >
            {expanded ? 'Reducir' : 'Expandir'}
          </button>
          <button type="button" className="cc-btn danger" onClick={hangupClick}>
            Colgar
          </button>
        </div>
      </header>
      <div className="cc-video-panel-body">
        {expanded ? (
          <p className="cc-video-fs-hint">Video en pantalla completa — ajusta el tamaño arriba o pulsa ← / Reducir</p>
        ) : (
          <VideoConferenceMosaic tiles={displayTiles} compact={false} />
        )}
      </div>
      <footer className="cc-video-panel-foot">
        {videoRequestUi}
        {controls}
      </footer>
    </section>
  );

  const overlayUi = (
    <div
      className={`private-call-overlay wa-call${isRadio ? ' is-radio' : ''}${showMosaic ? ' has-video mosaic' : ' is-voice'}${isConsole ? ' from-console' : ''}${isMonitorCaller ? ' is-monitor' : ''}${displayTiles.length <= 1 ? ' is-solo-feed' : ''} stage-${panelSize}`}
      style={isConsole ? { '--vc-solo-h': soloHeight } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={isRadio ? 'Radio personal' : isVideo ? 'Videollamada' : 'Llamada privada'}
      data-esc-close=""
    >
      <header className="private-call-fs-bar">
        <button
          type="button"
          className="private-call-back"
          onClick={minimize}
          data-esc-close-btn=""
          title={isConsole ? 'Volver al panel' : 'Minimizar (la llamada sigue)'}
          aria-label={isConsole ? 'Volver al panel' : 'Minimizar'}
        >
          ←
        </button>
        <div className="private-call-fs-meta">
          <strong>{isMonitorCaller ? 'Cámara remota' : label}</strong>
          {showMosaic || isConsole ? (
            <span title={call.peerName}>{call.peerName}</span>
          ) : (
            <span className={`private-call-status-chip tone-${statusTone}`} aria-live="polite">
              {statusLine}
            </span>
          )}
        </div>
        <div className="private-call-fs-tools">
          {isConsole && (
            <>
              <span className="private-call-fs-size-label">Tamaño</span>
              <VideoSizeSegment value={panelSize} onChange={setPanelSize} />
              <button type="button" className="cc-btn" onClick={() => setExpanded(false)} title="Volver al panel">
                Reducir
              </button>
            </>
          )}
        </div>
      </header>

      <div className="private-call-stage">
        {showMosaic ? (
          <div className={`private-call-mosaic-wrap stage-${panelSize}${displayTiles.length <= 1 ? ' is-solo-wrap' : ''}`}>
            <VideoConferenceMosaic tiles={displayTiles} />
          </div>
        ) : (
          <div className={`private-call-identity${statusTone === 'ring' ? ' is-ringing' : ''}`}>
            <div className="private-call-avatar-halo" aria-hidden="true">
              {peerAvatar}
            </div>
          </div>
        )}
      </div>

      {!isConsole && !isMonitorCaller && (
        <div className="private-call-meta">
          <h2 title={call.peerName}>{call.peerName}</h2>
          <p className={`private-call-status tone-${statusTone}`} aria-live="polite">
            {showMosaic ? statusLine : callConnected ? statusLine : status}
          </p>
        </div>
      )}

      {videoRequestUi}
      <footer className="private-call-dock">{controls}</footer>
      {isRadio && <p className="private-radio-hint">Mantén PTT para transmitir · suelta para escuchar</p>}
      {canAddParticipant && (
        <CallAddParticipantSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          authToken={call.authToken}
          callId={call.callId}
          excludeIds={excludeForInvite}
          onInvited={(c) => {
            setInvitedIds((prev) => [...prev, c.id]);
            setStatus(`Invitando a ${c.displayName || 'contacto'}…`);
          }}
        />
      )}
    </div>
  );

  if (isConsole && !expanded) {
    return consolePanel;
  }

  if (isConsole && expanded) {
    return (
      <>
        {consolePanel}
        {createPortal(overlayUi, document.body)}
      </>
    );
  }

  return createPortal(overlayUi, document.body);
}
