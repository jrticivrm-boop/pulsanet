import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PersonAvatar from './PersonAvatar';
import { PEER_EVENTS, openDm, startRemoteCamera, startVideoCall, startVoiceCall } from './peerActions';
import { canDispatch, fetchPeerContact } from './api';
import { PRESENCE_LABELS, normalizePresenceKey } from './dispatch/presenceStatus.js';
import { formatPhone, telHref, whatsappHref } from './phoneLinks.js';

const ICONS = {
  msg: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  call: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  video: 'M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5l4-2.5v10l-4-2.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  eye: 'M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  mobile: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v13h8V5zm4 14.2a1 1 0 1 0 0 .01z',
  copy: 'M9 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2zm0 4h6a2 2 0 0 1 2 2v6h2V5H9zM5 9v10h10V9z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z',
  wa: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z',
};

function Ico({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  );
}

/**
 * Ficha de contacto de una persona: mensaje / llamada SICOM / video / ver cámara
 * + celular (llamar, copiar, WhatsApp).
 */
export default function PeerActionSheet({ session, peer, onClose, allowRemoteCamera }) {
  const showCam =
    allowRemoteCamera != null ? Boolean(allowRemoteCamera) : canDispatch(session?.user);
  const [contact, setContact] = useState(null);
  const [contactState, setContactState] = useState('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!peer?.id || !session?.token) return undefined;
    let cancelled = false;
    setContact(null);
    setContactState('loading');
    setCopied(false);
    fetchPeerContact(session.token, peer.id)
      .then((data) => {
        if (cancelled) return;
        setContact(data?.contact || null);
        setContactState('ready');
      })
      .catch(() => {
        if (!cancelled) setContactState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [peer?.id, session?.token]);

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

  const name = contact?.displayName || peer.displayName || 'Usuario';
  const username = contact?.username || peer.username || '';
  const presence = normalizePresenceKey(contact?.presence || peer.presence, Boolean(peer.online));
  const grade = contact?.grade && !name.startsWith(contact.grade) ? contact.grade : '';
  const subtitle = [grade, contact?.cargo].filter(Boolean).join(' · ');
  const phone = contact?.phone || '';

  function run(fn) {
    fn(peer);
    onClose?.();
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(formatPhone(phone));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  return createPortal(
    <div className="peer-sheet-root" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <div className="peer-sheet peer-card" role="dialog" aria-modal="true" aria-label={`Contacto · ${name}`}>
        <button type="button" className="peer-card-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <header className="peer-card-head">
          <span className={`peer-card-ring is-${presence}`}>
            <PersonAvatar
              userId={peer.id}
              name={name}
              avatarUrl={contact?.avatarUrl || peer.avatarUrl}
              token={session?.token}
              className="peer-sheet-avatar peer-card-avatar"
            />
          </span>
          <strong className="peer-card-name">{name}</strong>
          {subtitle ? <span className="peer-card-sub">{subtitle}</span> : null}
          <span className={`peer-card-status is-${presence}`}>
            <i aria-hidden="true" />
            {PRESENCE_LABELS[presence] || PRESENCE_LABELS.offline}
            {username ? <em>@{username}</em> : null}
          </span>
        </header>

        <div className="peer-card-actions">
          <button type="button" className="peer-card-act" onClick={() => run(openDm)}>
            <span className="peer-card-act-ico"><Ico name="msg" /></span>
            Mensaje
          </button>
          <button type="button" className="peer-card-act is-primary" onClick={() => run(startVoiceCall)}>
            <span className="peer-card-act-ico"><Ico name="call" /></span>
            Llamada SICOM
          </button>
          <button type="button" className="peer-card-act" onClick={() => run(startVideoCall)}>
            <span className="peer-card-act-ico"><Ico name="video" /></span>
            Videollamada
          </button>
        </div>

        <section className="peer-card-phone" aria-label="Celular">
          <div className="peer-card-phone-row">
            <span className="peer-card-phone-ico"><Ico name="mobile" /></span>
            <span className="peer-card-phone-meta">
              <small>Celular</small>
              {contactState === 'loading' ? (
                <span className="peer-card-phone-muted">Cargando…</span>
              ) : phone ? (
                <a className="peer-card-phone-num" href={telHref(phone)}>
                  {formatPhone(phone)}
                </a>
              ) : (
                <span className="peer-card-phone-muted">
                  {contactState === 'error' ? 'No se pudo consultar' : 'Sin teléfono registrado'}
                </span>
              )}
            </span>
          </div>
          {phone ? (
            <div className="peer-card-phone-btns">
              <a className="peer-card-chip is-call" href={telHref(phone)}>
                <Ico name="call" />
                Llamar
              </a>
              <button type="button" className="peer-card-chip" onClick={copyPhone}>
                <Ico name={copied ? 'check' : 'copy'} />
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <a
                className="peer-card-chip is-wa"
                href={whatsappHref(phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Ico name="wa" />
                WhatsApp
              </a>
            </div>
          ) : null}
        </section>

        {showCam ? (
          <button
            type="button"
            className="peer-card-cam"
            onClick={() => run(startRemoteCamera)}
          >
            <Ico name="eye" />
            <span>
              Ver cámara remota
              <small>Solo administradores</small>
            </span>
          </button>
        ) : null}
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
