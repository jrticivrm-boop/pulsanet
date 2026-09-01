import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RoomEvent, Track, createLocalAudioTrack, AudioPresets } from 'livekit-client';
import { io } from 'socket.io-client';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { esMsg } from './esMsg';
import { assertMediaDevices } from './voiceRecord';
import { socketIoOptions, socketUrl } from './socketConfig';
import { setPrivateCallUiOpen } from './privateCallUi';
import { showChatMessageToast } from './chatNotify';

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
 * Overlay llamada / radio privada 1:1 (LiveKit + E2EE).
 * mode=radio → mic muteado hasta PTT (mantener).
 * Atrás / Esc minimiza; solo «Colgar» corta la llamada.
 */
export default function PrivateCallOverlay({ call, onHangup }) {
  const isRadio = call?.mode === 'radio';
  const [status, setStatus] = useState('Conectando…');
  const [muted, setMuted] = useState(true);
  const [pttHeld, setPttHeld] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const audioEls = useRef([]);
  const closingRef = useRef(false);
  const onHangupRef = useRef(onHangup);
  const callRef = useRef(call);

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

  useEffect(() => {
    let cancelled = false;

    function remoteEnd(label) {
      if (cancelled || closingRef.current) return;
      closingRef.current = true;
      setStatus(label || (isRadio ? 'Radio finalizada' : 'Llamada finalizada'));
      onHangupRef.current?.({ remote: true });
    }

    const token = call?.authToken;
    let signalSocket = null;
    if (token && call?.callId) {
      signalSocket = io(socketUrl(), {
        ...socketIoOptions,
        auth: { token },
      });
      signalSocket.on('call:ended', (payload) => {
        if (payload?.callId === call.callId) {
          remoteEnd(payload?.reason === 'reject' ? 'Rechazada' : undefined);
        }
      });
      signalSocket.on('call:accepted', (payload) => {
        if (payload?.callId === call.callId && call.role === 'caller') {
          setStatus(isRadio ? `Radio con ${call.peerName}` : `En llamada con ${call.peerName}`);
        }
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
          {
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          },
          call.e2eeKey
        );
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.dataset.privateCall = '1';
            document.body.appendChild(el);
            audioEls.current.push(el);
            setStatus(isRadio ? `Radio con ${call.peerName}` : `En llamada con ${call.peerName}`);
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          remoteEnd(undefined);
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled && !closingRef.current) setStatus('Desconectado');
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
        setStatus(
          call.role === 'caller'
            ? isRadio
              ? `Esperando a ${call.peerName}…`
              : `Llamando a ${call.peerName}…`
            : isRadio
              ? `Radio con ${call.peerName}`
              : `En llamada con ${call.peerName}`
        );
      } catch (e) {
        if (!cancelled) {
          setStatus(esMsg(e, 'No se pudo conectar'));
          setTimeout(() => onHangupRef.current?.({ remote: true }), 1200);
        }
      }
    })();

    return () => {
      cancelled = true;
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
  }, [call?.callId, call?.token, call?.url, call?.e2eeKey, call?.peerName, call?.peerId, call?.role, isRadio]);

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
    await onHangupRef.current?.({ remote: false });
  }

  function minimize() {
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

  const ui = minimized ? (
    <div
      className="private-call-mini"
      role="status"
      aria-label="Llamada en curso"
      data-esc-close=""
    >
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
  ) : (
    <div
      className={`private-call-overlay wa-call${isRadio ? ' is-radio' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={isRadio ? 'Radio personal' : 'Llamada privada'}
      data-esc-close=""
    >
      <button
        type="button"
        className="private-call-back"
        onClick={minimize}
        data-esc-close-btn=""
        title="Minimizar (la llamada sigue)"
        aria-label="Minimizar"
      >
        ←
      </button>
      <p className="private-call-label">{isRadio ? 'Radio personal 1:1' : 'Llamada de voz'}</p>
      <div className="private-call-avatar" aria-hidden="true">
        {initials}
      </div>
      <h2>{call.peerName}</h2>
      <p className="private-call-status">{status}</p>
      <div className="private-call-actions wa-actions">
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
          <button type="button" className="wa-call-circle mute" onClick={toggleMute}>
            <span aria-hidden="true">{muted ? '🔇' : '🎤'}</span>
            {muted ? 'Mic off' : 'Silenciar'}
          </button>
        )}
        <button
          type="button"
          className="wa-call-circle hangup"
          onClick={hangupClick}
          title={isRadio ? 'Cerrar' : 'Colgar'}
        >
          <span aria-hidden="true">📵</span>
          {isRadio ? 'Cerrar' : 'Colgar'}
        </button>
      </div>
      {isRadio && <p className="private-radio-hint">Mantén PTT para transmitir · suelta para escuchar</p>}
    </div>
  );

  return createPortal(ui, document.body);
}
