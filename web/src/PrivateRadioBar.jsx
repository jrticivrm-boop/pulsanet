import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RoomEvent, Track, createLocalAudioTrack, AudioPresets } from 'livekit-client';
import { io } from 'socket.io-client';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { esMsg } from './esMsg';
import { assertMediaDevices } from './voiceRecord';
import { socketIoOptions, socketUrl } from './socketConfig';
import { setPrivateCallUiOpen } from './privateCallUi';
import { showChatMessageToast } from './chatNotify';
/**
 * Radio personal 1:1 — franja superior; PTT por toque (abre / libera).
 */
const PrivateRadioBar = forwardRef(function PrivateRadioBar({ call, onHangup }, ref) {
  const [status, setStatus] = useState('Conectando…');
  const [pttOn, setPttOn] = useState(false);
  const [ready, setReady] = useState(false);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const audioEls = useRef([]);
  const closingRef = useRef(false);
  const busyRef = useRef(false);
  const pttOnRef = useRef(false);
  const onHangupRef = useRef(onHangup);

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
      setStatus(label || 'Radio finalizada');
      onHangupRef.current?.({ remote: true });
    }

    const token = call?.authToken;
    let signalSocket = null;
    if (token && call?.callId) {
      signalSocket = io(socketUrl(), {
        ...socketIoOptions,
        auth: { token },
        transports: ['websocket'],
      });
      signalSocket.on('call:ended', (payload) => {
        if (payload?.callId === call.callId) {
          remoteEnd(payload?.reason === 'reject' ? 'Rechazada' : undefined);
        }
      });
      signalSocket.on('dm:notify', ({ peerId, peerName, message }) => {
        if (!call?.peerId || String(peerId) !== String(call.peerId)) return;
        const preview =
          message?.type === 'text'
            ? String(message.body || '').slice(0, 80)
            : message?.type === 'image'
              ? '📷 Imagen'
              : message?.type === 'audio'
                ? '🎤 Audio'
                : 'Nuevo mensaje';
        showChatMessageToast({
          kind: 'dm',
          peerId,
          peerName: peerName || call.peerName || 'Mensaje',
          preview,
          title: peerName || call.peerName || 'Mensaje',
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
            el.dataset.privateRadio = '1';
            document.body.appendChild(el);
            audioEls.current.push(el);
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          remoteEnd(undefined);
        });

        assertMediaDevices();
        const url = publicLiveKitUrl(call.url);
        // Conectar y crear mic en paralelo
        const [, mic] = await Promise.all([
          room.connect(url, call.token),
          createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }),
        ]);
        if (cancelled) {
          try {
            mic.stop();
          } catch {
            /* ignore */
          }
          room.disconnect();
          return;
        }
        micRef.current = mic;
        await room.localParticipant.publishTrack(mic, {
          source: Track.Source.Microphone,
          audioPreset: AudioPresets.speech,
          red: false,
        });
        await mic.mute();
        setReady(true);
        setStatus('Listo · toca para hablar');
      } catch (e) {
        if (!cancelled) setStatus(esMsg(e.message || 'Error de audio'));
      }
    })();

    return () => {
      cancelled = true;
      try {
        signalSocket?.disconnect();
      } catch {
        /* ignore */
      }
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
      audioEls.current.forEach((el) => el.remove());
      audioEls.current = [];
    };
  }, [call]);

  async function setPtt(on) {
    const mic = micRef.current;
    if (!mic || !ready || busyRef.current) return;
    if (on === pttOnRef.current) return;
    busyRef.current = true;
    try {
      if (on) {
        await mic.unmute();
        pttOnRef.current = true;
        setPttOn(true);
        setStatus('AL AIRE · toca para soltar');
      } else {
        await mic.mute();
        pttOnRef.current = false;
        setPttOn(false);
        setStatus('Listo · toca para hablar');
      }
    } catch {
      /* ignore */
    } finally {
      busyRef.current = false;
    }
  }

  async function pttDown() {
    await setPtt(true);
  }

  async function pttUp() {
    await setPtt(false);
  }

  async function togglePtt() {
    await setPtt(!pttOnRef.current);
  }

  useImperativeHandle(ref, () => ({
    pttDown,
    pttUp,
    togglePtt,
    get ready() {
      return ready;
    },
  }));

  async function closeClick() {
    if (closingRef.current) return;
    closingRef.current = true;
    await onHangupRef.current?.({ remote: false });
  }

  const shortName = String(call.peerName || 'Radio').split(',')[0].trim();

  return (
    <div
      className={`private-radio-bar private-radio-bar--card${pttOn ? ' holding' : ''}${ready ? ' ready' : ''}`}
      role="region"
      aria-label="Radio personal"
    >
      <div className="private-radio-bar-icon" aria-hidden="true">
        📡
      </div>
      <div className="private-radio-bar-meta">
        <span className="private-radio-bar-title">{shortName}</span>
        <span className="private-radio-bar-status">
          {!ready ? 'Conectando…' : pttOn ? 'Canal abierto' : 'Radio 1:1'}
        </span>
      </div>
      <button
        type="button"
        className={`private-radio-ptt private-radio-ptt--round${pttOn ? ' holding' : ''}`}
        disabled={!ready}
        onClick={(e) => {
          e.preventDefault();
          togglePtt();
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={pttOn}
        title={pttOn ? 'Toca para soltar' : 'Toca para hablar'}
      >
        {!ready ? '…' : pttOn ? 'AL AIRE' : 'MIC'}
      </button>
      <button
        type="button"
        className="btn ghost private-radio-close"
        onClick={closeClick}
        aria-label="Cerrar radio"
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  );
});

export default PrivateRadioBar;
