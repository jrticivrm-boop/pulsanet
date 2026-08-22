import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track, createLocalAudioTrack, AudioPresets } from 'livekit-client';
import { createEncryptedRoom } from './livekitE2ee';

/** Reescribe 127.0.0.1/localhost con el host de la página (LAN). */
function publicLiveKitUrl(url) {
  if (!url || typeof window === 'undefined') return url;
  const host = window.location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1') return url;
  return String(url).replace(/127\.0\.0\.1/g, host).replace(/localhost/gi, host);
}

/**
 * Overlay de llamada privada 1:1 (LiveKit + E2EE si hay e2eeKey).
 */
export default function PrivateCallOverlay({ call, onHangup }) {
  const [status, setStatus] = useState('Conectando…');
  const [muted, setMuted] = useState(false);
  const roomRef = useRef(null);
  const micRef = useRef(null);
  const audioEls = useRef([]);

  useEffect(() => {
    let cancelled = false;
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
            setStatus(`En llamada con ${call.peerName}`);
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus('Desconectado');
        });

        await room.connect(publicLiveKitUrl(call.url), call.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
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
        setStatus(
          call.role === 'caller'
            ? `Llamando a ${call.peerName}…`
            : `En llamada con ${call.peerName}`
        );
      } catch (e) {
        if (!cancelled) setStatus(e.message || 'Error de audio');
      }
    })();

    return () => {
      cancelled = true;
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
      audioEls.current.forEach((el) => {
        el.remove();
      });
      audioEls.current = [];
    };
  }, [call]);

  async function toggleMute() {
    const mic = micRef.current;
    if (!mic) return;
    if (muted) {
      await mic.unmute();
      setMuted(false);
    } else {
      await mic.mute();
      setMuted(true);
    }
  }

  return (
    <div className="private-call-overlay wa-call" role="dialog" aria-label="Llamada privada">
      <p className="private-call-label">Llamada de voz</p>
      <div className="private-call-avatar" aria-hidden="true">
        {(call.peerName || '?')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join('')
          .toUpperCase() || '?'}
      </div>
      <h2>{call.peerName}</h2>
      <p className="private-call-status">{status}</p>
      <div className="private-call-actions wa-actions">
        <button type="button" className="wa-call-circle mute" onClick={toggleMute}>
          <span aria-hidden="true">{muted ? '🔇' : '🎤'}</span>
          {muted ? 'Mic off' : 'Silenciar'}
        </button>
        <button type="button" className="wa-call-circle hangup" onClick={onHangup}>
          <span aria-hidden="true">📵</span>
          Colgar
        </button>
      </div>
    </div>
  );
}
