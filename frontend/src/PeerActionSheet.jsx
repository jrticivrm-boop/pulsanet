import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PersonAvatar from './PersonAvatar';
import { PEER_EVENTS, openDm, startRemoteCamera, startVideoCall, startVoiceCall } from './peerActions';
import { canDispatch } from './api';

/**
 * Ficha de acciones sobre una persona (mensaje / llamada / video / ver cámara).
 */
export default function PeerActionSheet({ session, peer, onClose, allowRemoteCamera }) {
  const showCam =
    allowRemoteCamera != null ? Boolean(allowRemoteCamera) : canDispatch(session?.user);

  useEffect(() => {
    if (!peer) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peer, onClose]);

  if (!peer) return null;

  const name = peer.displayName || 'Usuario';

  function run(fn) {
    fn(peer);
    onClose?.();
  }

  return createPortal(
    <div className="peer-sheet-root" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <div className="peer-sheet" role="dialog" aria-modal="true" aria-label={`Acciones · ${name}`}>
        <header className="peer-sheet-head">
          <PersonAvatar
            userId={peer.id}
            name={name}
            avatarUrl={peer.avatarUrl}
            token={session?.token}
            className="peer-sheet-avatar"
          />
          <div className="peer-sheet-id">
            <strong>{name}</strong>
            {peer.username ? <span>@{peer.username}</span> : null}
          </div>
          <button type="button" className="peer-sheet-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="peer-sheet-actions">
          <button type="button" className="peer-sheet-btn" onClick={() => run(openDm)}>
            <span className="peer-sheet-ico" aria-hidden="true">
              💬
            </span>
            Mensaje
          </button>
          <button type="button" className="peer-sheet-btn primary" onClick={() => run(startVoiceCall)}>
            <span className="peer-sheet-ico" aria-hidden="true">
              📞
            </span>
            Llamada
          </button>
          <button type="button" className="peer-sheet-btn" onClick={() => run(startVideoCall)}>
            <span className="peer-sheet-ico" aria-hidden="true">
              📹
            </span>
            Videollamada
          </button>
          {showCam ? (
            <button
              type="button"
              className="peer-sheet-btn accent"
              onClick={() => run(startRemoteCamera)}
            >
              <span className="peer-sheet-ico" aria-hidden="true">
                👁
              </span>
              Ver cámara
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Host global: escucha OPEN_PEER_SHEET. */
export function PeerActionSheetHost({ session }) {
  const [peer, setPeer] = useState(null);

  useEffect(() => {
    const onOpen = (e) => {
      const p = e.detail?.peer;
      if (p?.id) setPeer(p);
    };
    window.addEventListener(PEER_EVENTS.OPEN_PEER_SHEET, onOpen);
    return () => window.removeEventListener(PEER_EVENTS.OPEN_PEER_SHEET, onOpen);
  }, []);

  if (!session?.token || !peer) return null;

  return (
    <PeerActionSheet
      session={session}
      peer={peer}
      onClose={() => setPeer(null)}
      allowRemoteCamera={canDispatch(session.user)}
    />
  );
}
