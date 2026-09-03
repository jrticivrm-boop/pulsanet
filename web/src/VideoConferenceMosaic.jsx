import { useEffect, useRef } from 'react';

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

/**
 * Tile de video con attach/detach estable (evita parpadeos al re-render).
 */
function VideoTile({ tile, compact }) {
  const videoRef = useRef(null);
  const track = tile.track;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return undefined;
    try {
      track.attach(el);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        track.detach(el);
      } catch {
        /* ignore */
      }
    };
  }, [track]);

  const hasVideo = Boolean(track);
  const label = tile.isLocal ? `${tile.name || 'Tú'} (Tú)` : tile.name || 'Participante';

  return (
    <article
      className={`vc-tile${hasVideo ? ' has-video' : ''}${tile.isLocal ? ' is-local' : ''}${tile.isSpeaking ? ' speaking' : ''}${compact ? ' compact' : ''}`}
      aria-label={label}
    >
      <div className="vc-tile-media">
        <video
          ref={videoRef}
          className={`vc-tile-video${hasVideo ? ' visible' : ''}`}
          autoPlay
          playsInline
          muted={tile.isLocal}
        />
        {!hasVideo && (
          <div className="vc-tile-placeholder" aria-hidden="true">
            <span className="vc-tile-avatar">{initialsFromName(tile.name)}</span>
          </div>
        )}
      </div>
      <footer className="vc-tile-footer">
        <span className="vc-tile-name">{label}</span>
        {tile.muted && <span className="vc-tile-badge muted">Mic off</span>}
        {!hasVideo && tile.isLocal && <span className="vc-tile-badge">Sin cámara</span>}
        {tile.isSpeaking && <span className="vc-tile-badge live">Hablando</span>}
      </footer>
    </article>
  );
}

/**
 * Mosaico de videoconferencia — grid adaptativo 1–N participantes.
 */
export default function VideoConferenceMosaic({ tiles = [], compact = false, className = '' }) {
  const list = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  const count = Math.max(list.length, 1);

  return (
    <div
      className={`vc-mosaic ${gridClass(count)}${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Videoconferencia"
    >
      {list.length === 0 ? (
        <article className="vc-tile empty">
          <div className="vc-tile-placeholder">
            <span className="vc-tile-avatar">?</span>
          </div>
          <footer className="vc-tile-footer">
            <span className="vc-tile-name">Esperando video…</span>
          </footer>
        </article>
      ) : (
        list.map((tile) => <VideoTile key={tile.id} tile={tile} compact={compact} />)
      )}
    </div>
  );
}
