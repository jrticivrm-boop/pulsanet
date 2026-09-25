import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMediaBlobUrl } from './api';
import {
  downloadFromObjectUrl,
  friendlyMediaName,
} from './chatMediaActions';

/** Pausa otras notas de voz del chat cuando una empieza a sonar. */
const voiceBus = typeof window !== 'undefined' ? new EventTarget() : null;

function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function VoiceNotePlayer({ src, label }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const idRef = useRef(`vn-${Math.random().toString(36).slice(2)}`);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const bars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const n = Math.sin(i * 0.55) * 0.35 + Math.cos(i * 1.1) * 0.25 + 0.55;
        return Math.round(22 + n * 58);
      }),
    []
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return undefined;

    const onMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        setReady(true);
      }
    };
    const onTime = () => {
      setCurrent(audio.currentTime || 0);
      if ((!Number.isFinite(audio.duration) || audio.duration === Infinity) && audio.seekable?.length) {
        const end = audio.seekable.end(audio.seekable.length - 1);
        if (Number.isFinite(end) && end > 0) {
          setDuration(end);
          setReady(true);
        }
      } else {
        onMeta();
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => setFailed(true);
    const onForeignPlay = (ev) => {
      if (ev.detail?.id !== idRef.current) {
        audio.pause();
      }
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onErr);
    voiceBus?.addEventListener('voice-play', onForeignPlay);

    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onErr);
      voiceBus?.removeEventListener('voice-play', onForeignPlay);
      audio.pause();
    };
  }, [src]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || failed) return;
    if (playing) {
      audio.pause();
      return;
    }
    voiceBus?.dispatchEvent(new CustomEvent('voice-play', { detail: { id: idRef.current } }));
    try {
      await audio.play();
    } catch {
      setFailed(true);
    }
  }

  function seekFromPointer(clientX) {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = ratio * duration;
    audio.currentTime = next;
    setCurrent(next);
  }

  if (failed) {
    return <p className="wa-voice-error">No se pudo reproducir el audio</p>;
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const shown = playing || current > 0.05 ? current : duration;

  return (
    <div className={`wa-voice${playing ? ' is-playing' : ''}`} role="group" aria-label={label || 'Nota de voz'}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        className="wa-voice-play"
        onClick={togglePlay}
        disabled={!src}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M8.2 5.6v12.8c0 .7.8 1.1 1.4.7l9.2-6.4c.5-.4.5-1.1 0-1.4L9.6 4.9c-.6-.4-1.4 0-1.4.7z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="wa-voice-body">
        <button
          type="button"
          className="wa-voice-track"
          ref={trackRef}
          disabled={!duration}
          aria-label="Posición del audio"
          onClick={(e) => seekFromPointer(e.clientX)}
          onKeyDown={(e) => {
            if (!audioRef.current || !duration) return;
            const step = duration * 0.05;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              const next = Math.min(duration, current + step);
              audioRef.current.currentTime = next;
              setCurrent(next);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              const next = Math.max(0, current - step);
              audioRef.current.currentTime = next;
              setCurrent(next);
            }
          }}
        >
          <span className="wa-voice-wave" aria-hidden="true">
            {bars.map((h, i) => {
              // Misma escala que left% del thumb (inicio de cada barra).
              const active = progress > (i / bars.length) * 100 || (i === 0 && progress > 0);
              return <i key={i} className={active ? 'on' : undefined} style={{ height: `${h}%` }} />;
            })}
          </span>
          <span className="wa-voice-thumb" style={{ left: `${progress}%` }} aria-hidden="true" />
        </button>

        <div className="wa-voice-meta">
          <span className="wa-voice-time">{ready ? formatDuration(shown) : '—:—'}</span>
          <span className="wa-voice-chip">Audio</span>
        </div>
      </div>
    </div>
  );
}

/** Imagen / archivo / audio de chat con Authorization Bearer. */
export default function ChatMedia({ token, message, onActionHint, onLightboxChange, onOpenImage }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(false);

  function openLightbox() {
    if (typeof onOpenImage === 'function') {
      onOpenImage(message);
      onLightboxChange?.(true);
      return;
    }
    setLightbox(true);
    onLightboxChange?.(true);
  }

  function closeLightbox() {
    setLightbox(false);
    onLightboxChange?.(false);
  }

  useEffect(() => {
    if (!message?.mediaUrl || !token) return undefined;
    let revoked = false;
    let objectUrl = null;
    fetchMediaBlobUrl(token, message.mediaUrl)
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch((e) => {
        if (!revoked) setErr(e.message);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, message?.mediaUrl, message?.id]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        window.dispatchEvent(new CustomEvent('tacticalptx:close-context-menus'));
        closeLightbox();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [lightbox]);

  if (err) return <span className="muted">[{err}]</span>;
  if (!message.mediaUrl) return null;

  const name = friendlyMediaName(message);
  const mime = (message.mediaMime || '').toLowerCase();
  const isImage =
    message.type === 'image' ||
    mime.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|jfif|bmp)$/i.test(message.mediaName || name);
  const isVideo =
    message.type === 'video' ||
    mime.startsWith('video/') ||
    /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(message.mediaName || name);

  if (isImage) {
    if (!url) {
      return (
        <div className="wa-image is-loading" aria-busy="true">
          <span className="muted">Cargando imagen…</span>
        </div>
      );
    }
    return (
      <>
        <button
          type="button"
          className="wa-image"
          onClick={openLightbox}
          onContextMenu={(e) => {
            e.preventDefault();
            openLightbox();
          }}
          title="Ver imagen"
        >
          <img
            src={url}
            alt={name || 'imagen'}
            className="wa-image-thumb"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
          <span className="wa-image-hint" aria-hidden="true">
            Ampliar
          </span>
        </button>
        {lightbox && (
          <div
            className="wa-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Vista de imagen"
            data-esc-close=""
            onClick={closeLightbox}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className="wa-lightbox-close"
              aria-label="Cerrar"
              data-esc-close-btn=""
              title="Cerrar (Esc)"
              onClick={closeLightbox}
            >
              ×
            </button>
            <img
              src={url}
              alt={name || 'imagen'}
              className="wa-lightbox-img"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            />
            {name ? <p className="wa-lightbox-caption">{name}</p> : null}
          </div>
        )}
      </>
    );
  }

  if (message.type === 'audio') {
    if (!url) {
      return (
        <div className="wa-voice is-loading">
          <div className="wa-voice-play is-skeleton" aria-hidden="true" />
          <div className="wa-voice-body">
            <div className="wa-voice-track is-skeleton" aria-hidden="true" />
            <div className="wa-voice-meta">
              <span className="wa-voice-time">Cargando…</span>
            </div>
          </div>
        </div>
      );
    }
    return <VoiceNotePlayer src={url} label={name || 'Nota de voz'} />;
  }

  if (isVideo) {
    if (!url) {
      return (
        <div className="wa-video is-loading" aria-busy="true">
          <span className="muted">Cargando video…</span>
        </div>
      );
    }
    return (
      <div className="wa-video">
        <video
          className="wa-video-player"
          src={url}
          controls
          playsInline
          preload="metadata"
          title={name || 'Video'}
        />
        <div className="wa-video-actions">
          <button
            type="button"
            className="wa-file-dl"
            onClick={() => downloadFromObjectUrl(url, name || 'Video.mp4')}
          >
            Descargar
          </button>
          {name ? <span className="wa-file-name">{name}</span> : null}
        </div>
      </div>
    );
  }

  if (!url) return <span className="muted">Cargando archivo…</span>;

  const icon =
    mime.includes('pdf') || /\.pdf$/i.test(name)
      ? '📄'
      : /\.(zip|rar|7z|gz|tar)$/i.test(name) || mime.includes('zip') || mime.includes('rar')
        ? '🗜️'
        : /\.(doc|docx)$/i.test(name)
          ? '📝'
          : /\.(xls|xlsx|csv)$/i.test(name)
            ? '📊'
            : '📎';
  const sizeLabel = message.mediaSize
    ? message.mediaSize < 1024 * 1024
      ? `${Math.round(message.mediaSize / 1024)} KB`
      : `${(message.mediaSize / (1024 * 1024)).toFixed(1)} MB`
    : '';

  return (
    <div className="wa-file-card">
      <span className="wa-file-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="wa-file-meta">
        <span className="wa-file-title">{name || 'Archivo'}</span>
        {sizeLabel ? <span className="wa-file-size">{sizeLabel}</span> : null}
      </div>
      <a
        href={url}
        download={name || 'archivo'}
        className="wa-file-dl"
        onClick={(e) => {
          e.preventDefault();
          downloadFromObjectUrl(url, name || 'Archivo');
          onActionHint?.('Descarga iniciada');
        }}
      >
        Abrir
      </a>
    </div>
  );
}
