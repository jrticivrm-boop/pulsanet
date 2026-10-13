import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RoomEvent, Track } from 'livekit-client';
import { panicLiveView } from './api';
import { createEncryptedRoom } from './livekitE2ee';
import { publicLiveKitUrl } from './livekitUrl';
import { mergeStreamingRoomOptions } from './videoStreaming';
import { esMsg } from './esMsg';

/**
 * Cámara + micrófono en vivo del emisor de una alerta (solo mando con alcance).
 * La transmisión arranca sola al enviar la alerta y termina al resolverse (máx. 15 min).
 */
export default function PanicLiveViewer({ token, panicId, name, reason, onClose }) {
  const videoBoxRef = useRef(null);
  const roomRef = useRef(null);
  const audioEls = useRef([]);
  const [status, setStatus] = useState('Conectando…');
  const [hasVideo, setHasVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState('back');
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let endTimer = null;

    const clearVideo = () => {
      const box = videoBoxRef.current;
      if (box) box.replaceChildren();
      setHasVideo(false);
    };

    (async () => {
      try {
        const cred = await panicLiveView(token, panicId);
        if (cancelled) return;
        const room = await createEncryptedRoom(mergeStreamingRoomOptions(), cred.e2eeKey, {
          requireKey: cred.e2ee === true,
        });
        roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video) {
            const el = track.attach();
            el.playsInline = true;
            el.muted = true;
            el.className = 'plv-video';
            const box = videoBoxRef.current;
            if (box) box.replaceChildren(el);
            setHasVideo(true);
            setStatus('');
          } else if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.dataset.panicLive = '1';
            document.body.appendChild(el);
            audioEls.current.push(el);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
          if (track.kind === Track.Kind.Video) {
            clearVideo();
            setStatus('Esperando video del emisor…');
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          clearVideo();
          setStatus('El emisor perdió conexión. Esperando que vuelva…');
        });
        await room.connect(publicLiveKitUrl(cred.url), cred.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        if (!room.remoteParticipants.size) {
          setStatus('Esperando que el emisor abra su cámara…');
        }
        const left = (Number(cred.expiresAt) || 0) - Date.now();
        if (left > 0) {
          endTimer = window.setTimeout(() => {
            setEnded(true);
            setStatus('La transmisión terminó (tiempo máximo).');
            room.disconnect();
          }, left);
        }
      } catch (e) {
        if (cancelled) return;
        setEnded(true);
        setStatus(esMsg(e?.message, 'No se pudo abrir la cámara en vivo'));
      }
    })();

    return () => {
      cancelled = true;
      if (endTimer) window.clearTimeout(endTimer);
      audioEls.current.forEach((el) => el.remove());
      audioEls.current = [];
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [token, panicId]);

  useEffect(() => {
    audioEls.current.forEach((el) => {
      el.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function switchCamera() {
    const next = facing === 'back' ? 'front' : 'back';
    const lp = roomRef.current?.localParticipant;
    if (!lp?.publishData) return;
    try {
      await lp.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'panic_live_ctrl', facing: next })),
        { reliable: true }
      );
      setFacing(next);
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div className="plv-overlay" role="dialog" aria-modal="true" aria-label="Cámara en vivo de la alerta">
      <div className="plv-modal">
        <header className="plv-head">
          <span className={`plv-live${ended ? ' plv-live--off' : ''}`}>
            {ended ? 'FINALIZADA' : '● EN VIVO'}
          </span>
          <div className="plv-title">
            <strong>{name || 'Operador'}</strong>
            {reason ? <span>{reason}</span> : null}
          </div>
          <button type="button" className="plv-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="plv-stage">
          <div ref={videoBoxRef} className="plv-video-box" />
          {!hasVideo || status ? <p className="plv-status">{status || 'Conectando…'}</p> : null}
        </div>
        <footer className="plv-foot">
          <button type="button" className="plv-btn" onClick={switchCamera} disabled={ended}>
            🔄 Cámara {facing === 'back' ? 'trasera' : 'frontal'}
          </button>
          <button type="button" className="plv-btn" onClick={() => setMuted((m) => !m)} disabled={ended}>
            {muted ? '🔇 Activar audio' : '🔊 Silenciar audio'}
          </button>
          <button type="button" className="plv-btn plv-btn--close" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
