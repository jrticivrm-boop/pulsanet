import { useEffect, useRef, useState } from 'react';
import { bindVideoTrackToElement, unbindVideoElement } from './videoStreaming';

function initialsFromName(name) {
  return (
    (name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function gridClass(count) {
  if (count <= 1) return 'count-1';
  if (count === 2) return 'count-2';
  if (count === 3) return 'count-3';
  if (count === 4) return 'count-4';
  if (count <= 6) return 'count-6';
  return 'count-many';
}

function VideoTile({ tile, compact, solo }) {
  const videoRef = useRef(null);
  const boundRef = useRef(null);
  const track = tile.track;
  const [heldTrack, setHeldTrack] = useState(null);
  const [hasFrame, setHasFrame] = useState(false);
  /* Portrait por defecto: un solo feed (móvil) queda centrado antes de medir el track. */
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    if (track) {
      setHeldTrack(track);
      setHasFrame(false);
    }
  }, [track]);

  useEffect(() => {
    if (track) return undefined;
    const t = window.setTimeout(() => {
      setHeldTrack((cur) => (cur && !tile.track ? null : cur));
      setHasFrame(false);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [track, tile.track]);

  const active = track || heldTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    if (!active) {
      if (boundRef.current) {
        unbindVideoElement(boundRef.current, el);
        boundRef.current = null;
      }
      return undefined;
    }

    if (boundRef.current && boundRef.current !== active) {
      unbindVideoElement(boundRef.current, el);
      boundRef.current = null;
    }

    const ok = bindVideoTrackToElement(active, el, { muted: Boolean(tile.isLocal) });
    if (ok) boundRef.current = active;

    const markFrame = () => {
      if (el.videoWidth > 0 || el.videoHeight > 0) {
        setHasFrame(true);
        setOrientation(el.videoWidth >= el.videoHeight ? 'landscape' : 'portrait');
      }
    };
    el.addEventListener('loadeddata', markFrame);
    el.addEventListener('resize', markFrame);
    const poll = window.setInterval(markFrame, 500);
    // Re-bind por si el track llega muteado un instante.
    const retry = window.setTimeout(() => {
      bindVideoTrackToElement(active, el, { muted: Boolean(tile.isLocal) });
      markFrame();
    }, 400);

    return () => {
      el.removeEventListener('loadeddata', markFrame);
      el.removeEventListener('resize', markFrame);
      window.clearInterval(poll);
      window.clearTimeout(retry);
    };
  }, [active, tile.isLocal]);

  useEffect(() => {
    return () => {
      const el = videoRef.current;
      // Solo soltar el elemento; no detener el MediaStreamTrack (sigue vivo para otro mosaico).
      if (el) {
        try {
          boundRef.current?.detach?.(el);
        } catch {
          /* ignore */
        }
        try {
          el.srcObject = null;
        } catch {
          /* ignore */
        }
      }
      boundRef.current = null;
    };
  }, []);

  const showing = Boolean(active);
  const label = tile.isLocal ? `${tile.name || 'Tú'} (Tú)` : tile.name || 'Participante';

  return (
    <article
      className={`vc-tile${showing ? ' has-video' : ''}${hasFrame ? ' has-frame' : ''}${tile.isLocal ? ' is-local' : ''}${tile.isSpeaking ? ' speaking' : ''}${compact ? ' compact' : ''}${solo ? ' is-solo' : ''} orient-${orientation === 'landscape' ? 'landscape' : 'portrait'}`}
      aria-label={label}
    >
      <div className="vc-tile-media">
        <video
          ref={videoRef}
          className={`vc-tile-video${showing ? ' visible' : ''}`}
          autoPlay
          playsInline
          muted={Boolean(tile.isLocal)}
        />
        {!showing && (
          <div className="vc-tile-placeholder" aria-hidden="true">
            <span className="vc-tile-avatar">{initialsFromName(tile.name)}</span>
          </div>
        )}
        {showing && !hasFrame && (
          <div className="vc-tile-waiting" aria-hidden="true">
            Esperando imagen…
          </div>
        )}
      </div>
      <footer className="vc-tile-footer">
        <span className="vc-tile-name">{label}</span>
        {tile.muted && <span className="vc-tile-badge muted">Mic off</span>}
        {!showing && tile.isLocal && <span className="vc-tile-badge">Sin cámara</span>}
        {tile.isSpeaking && <span className="vc-tile-badge live">Hablando</span>}
      </footer>
    </article>
  );
}

export default function VideoConferenceMosaic({ tiles = [], compact = false, className = '' }) {
  const list = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  const count = Math.max(list.length, 1);
  const solo = list.length <= 1;

  return (
    <div
      className={`vc-mosaic ${gridClass(count)}${compact ? ' compact' : ''}${solo ? ' is-solo' : ' is-multi'}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Videoconferencia"
    >
      {list.length === 0 ? (
        <article className="vc-tile empty is-solo">
          <div className="vc-tile-placeholder">
            <span className="vc-tile-avatar">?</span>
          </div>
          <footer className="vc-tile-footer">
            <span className="vc-tile-name">Esperando video…</span>
          </footer>
        </article>
      ) : (
        list.map((tile) => <VideoTile key={tile.id} tile={tile} compact={compact} solo={solo} />)
      )}
    </div>
  );
}

/** Selector visual de tamaño (Expandir / pantalla completa). */
export function VideoSizeSegment({ value = 'lg', onChange }) {
  const opts = [
    { id: 'sm', title: 'Compacto' },
    { id: 'md', title: 'Mediano' },
    { id: 'lg', title: 'Grande' },
    { id: 'xl', title: 'Máximo' },
    { id: 'fill', title: 'Pantalla completa' },
  ];
  return (
    <div className="vc-size-seg" role="group" aria-label="Tamaño del video">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`vc-size-seg-btn${value === o.id ? ' is-active' : ''}${o.id === 'fill' ? ' is-fill' : ''}`}
          title={o.title}
          aria-label={o.title}
          aria-pressed={value === o.id}
          onClick={() => onChange?.(o.id)}
        >
          <span className={`vc-size-glyph size-${o.id}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
