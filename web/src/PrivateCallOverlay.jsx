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
} from './api';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { esMsg } from './esMsg';
import { assertMediaDevices } from './voiceRecord';
import { socketIoOptions, socketUrl } from './socketConfig';
import { setPrivateCallUiOpen } from './privateCallUi';
import { warmUpVideoCallMedia } from './callMedia';
import { showChatMessageToast } from './chatNotify';
import VideoConferenceMosaic from './VideoConferenceMosaic';
import { usePrivateCallTiles } from './usePrivateCallTiles';
import { attachPrivateCallStabilizer } from './privateCallStabilizer';
import { mergeStreamingRoomOptions, getVideoCaptureDefaults, oppositeFacingMode } from './videoStreaming';

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

/**
 * Overlay llamada / videollamada / radio privada 1:1 (LiveKit + E2EE).
 * layout: `overlay` (fullscreen portal) | `console` (panel embebido en despacho)
 */
export default function PrivateCallOverlay({ call, onHangup, layout = 'overlay' }) {
  const isRadio = call?.mode === 'radio';
  const isVideo = call?.mode === 'video';
  const isConsole = layout === 'console';
  const [status, setStatus] = useState('Conectando…');
  const [muted, setMuted] = useState(true);
  const [pttHeld, setPttHeld] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [videoRequest, setVideoRequest] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const camRef = useRef(null);
  const facingModeRef = useRef('user');
  const audioEls = useRef([]);
  const closingRef = useRef(false);
  const userCameraOffRef = useRef(false);
  const onHangupRef = useRef(onHangup);
  const callRef = useRef(call);
  const { tiles, bindRoomVideoEvents, resetRemoteVideos } = usePrivateCallTiles({
    peerName: call?.peerName,
    cameraOn,
    camRef,
  });
  const displayTiles = useMemo(
    () => tiles.map((t) => (t.isLocal ? { ...t, muted } : t)),
    [tiles, muted]
  );

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    onHangupRef.current = onHangup;
  }, [onHangup]);

  useEffect(() => {
    setPrivateCallUiOpen(true);
    return () => setPrivateCallUiOpen(false);
  }, []);

  async function enableCamera(explicitRoom) {
    const room = explicitRoom || roomRef.current;
    if (!room || userCameraOffRef.current) return false;
    if (camRef.current) return true;
    try {
      assertMediaDevices();
      const cam = await createLocalVideoTrack(getVideoCaptureDefaults(facingModeRef.current));
      camRef.current = cam;
      await room.localParticipant.publishTrack(cam, { source: Track.Source.Camera });
      setCameraOn(true);
      return true;
    } catch (e) {
      setCameraOn(false);
      setStatus(esMsg(e, 'No se pudo activar la cámara'));
      return false;
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
    } catch (e) {
      try {
        await room.localParticipant.unpublishTrack(cam, true);
        cam.stop();
        camRef.current = null;
        const fresh = await createLocalVideoTrack(getVideoCaptureDefaults(next));
        camRef.current = fresh;
        await room.localParticipant.publishTrack(fresh, { source: Track.Source.Camera });
        facingModeRef.current = next;
        setFacingMode(next);
        setCameraOn(true);
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
        setStatus(`En llamada con ${callRef.current.peerName}`);
      }
    } catch (e) {
      setStatus(esMsg(e.message, 'Error al responder solicitud'));
    }
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
          remoteEnd(payload?.reason === 'reject' ? 'Rechazada' : undefined);
        }
      });
      signalSocket.on('call:accepted', (payload) => {
        if (payload?.callId === call.callId && call.role === 'caller') {
          setStatus(
            isRadio
              ? `Radio con ${call.peerName}`
              : isVideo
                ? `Videollamada con ${call.peerName}`
                : `En llamada con ${call.peerName}`
          );
        }
      });
      signalSocket.on('call:video_request', (payload) => {
        if (payload?.callId !== call.callId) return;
        setVideoRequest(payload);
      });
      signalSocket.on('call:video_accepted', (payload) => {
        if (payload?.callId !== call.callId) return;
        setStatus(`${call.peerName} activó la cámara`);
      });
      signalSocket.on('call:video_rejected', (payload) => {
        if (payload?.callId !== call.callId) return;
        setStatus(`${call.peerName} rechazó compartir cámara`);
      });
      signalSocket.on('call:video_stopped', (payload) => {
        if (payload?.callId !== call.callId) return;
        resetRemoteVideos();
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
        const room = await createEncryptedRoom(mergeStreamingRoomOptions(), call.e2eeKey);
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
          getPeerLabel: () => call.peerName || 'el otro usuario',
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.dataset.privateCall = '1';
            document.body.appendChild(el);
            audioEls.current.push(el);
            setStatus(
              isRadio
                ? `Radio con ${call.peerName}`
                : isVideo
                  ? `Videollamada con ${call.peerName}`
                  : `En llamada con ${call.peerName}`
            );
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled && !closingRef.current) setStatus('Reconectando…');
        });

        await room.connect(publicLiveKitUrl(call.url), call.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
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
          red: false,
        });
        if (isRadio) {
          await mic.mute();
          setMuted(true);
        } else {
          setMuted(false);
        }
        if (isVideo && !userCameraOffRef.current) {
          await enableCamera(room);
        }
        setStatus(
          call.role === 'caller'
            ? isRadio
              ? `Esperando a ${call.peerName}…`
              : isVideo
                ? `Videollamando a ${call.peerName}…`
                : `Llamando a ${call.peerName}…`
            : isRadio
              ? `Radio con ${call.peerName}`
              : isVideo
                ? `Videollamada con ${call.peerName}`
                : `En llamada con ${call.peerName}`
        );
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
                setStatus(`En llamada con ${call.peerName}`);
                return;
              }
            } catch {
              /* fall through */
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

  const label = isRadio ? 'Radio personal 1:1' : isVideo ? 'Videollamada' : 'Llamada de voz';
  const showMosaic = isVideo || cameraOn || displayTiles.some((t) => t.track);
  const useFullscreen = !isConsole || expanded;

  const controls = (
    <div className={`private-call-actions wa-actions${isConsole ? ' console-bar' : ''}`}>
      {isRadio ? (
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
          <span aria-hidden="true">🎙️</span>
          {pttHeld ? 'AL AIRE' : 'PTT'}
        </button>
      ) : (
        <>
          <button type="button" className="wa-call-circle mute" onClick={toggleMute}>
            <span aria-hidden="true">{muted ? '🔇' : '🎤'}</span>
            {muted ? 'Mic off' : 'Silenciar'}
          </button>
          <button type="button" className="wa-call-circle video" onClick={toggleCamera}>
            <span aria-hidden="true">{cameraOn ? '📷' : '🚫'}</span>
            {cameraOn ? 'Apagar cam' : 'Encender cam'}
          </button>
          {cameraOn && (
            <button
              type="button"
              className="wa-call-circle video"
              onClick={switchCamera}
              title={facingMode === 'user' ? 'Cambiar a cámara trasera' : 'Cambiar a cámara frontal'}
            >
              <span aria-hidden="true">🔄</span>
              {facingMode === 'user' ? 'Trasera' : 'Frontal'}
            </button>
          )}
          {!isVideo && !cameraOn && (
            <button type="button" className="wa-call-circle video-req" onClick={requestPeerCamera}>
              <span aria-hidden="true">👁️</span>
              Pedir cam
            </button>
          )}
        </>
      )}
      <button type="button" className="wa-call-circle hangup" onClick={hangupClick}>
        <span aria-hidden="true">📵</span>
        {isRadio ? 'Cerrar' : 'Colgar'}
      </button>
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
            {initials}
          </span>
          <span className="private-call-mini-text">
            <strong>{call.peerName}</strong>
            <small>{status || (isRadio ? 'Radio en curso' : 'Llamada en curso')}</small>
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
    return isConsole ? mini : createPortal(mini, document.body);
  }

  const consolePanel = (
    <section className="cc-video-panel" aria-label="Videoconferencia en consola">
      <header className="cc-video-panel-head">
        <div>
          <h2>Videoconferencia</h2>
          <p className="cc-hint">
            {call.peerName} · {status}
          </p>
        </div>
        <div className="cc-video-panel-tools">
          <button type="button" className="cc-btn" onClick={() => setExpanded(true)} title="Pantalla completa">
            Expandir
          </button>
          <button type="button" className="cc-btn danger" onClick={hangupClick}>
            Colgar
          </button>
        </div>
      </header>
      <div className="cc-video-panel-body">
        <VideoConferenceMosaic tiles={displayTiles} compact />
      </div>
      <footer className="cc-video-panel-foot">
        {videoRequestUi}
        {controls}
      </footer>
    </section>
  );

  const overlayUi = (
    <div
      className={`private-call-overlay wa-call${isRadio ? ' is-radio' : ''}${showMosaic ? ' has-video mosaic' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={isRadio ? 'Radio personal' : isVideo ? 'Videollamada' : 'Llamada privada'}
      data-esc-close=""
    >
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

      {showMosaic ? (
        <div className="private-call-mosaic-wrap">
          <VideoConferenceMosaic tiles={displayTiles} />
        </div>
      ) : (
        <div className="private-call-avatar private-call-avatar-lg solo" aria-hidden="true">
          {initials}
        </div>
      )}

      <div className="private-call-meta">
        <p className="private-call-label">{label}</p>
        <h2>{call.peerName}</h2>
        <p className="private-call-status">{status}</p>
      </div>

      {videoRequestUi}
      {controls}
      {isRadio && <p className="private-radio-hint">Mantén PTT para transmitir · suelta para escuchar</p>}
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
