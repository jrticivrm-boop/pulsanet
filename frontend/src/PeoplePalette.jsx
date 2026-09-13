import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchContacts } from './api';
import PersonAvatar from './PersonAvatar';
import {
  PEER_EVENTS,
  openDm,
  openPeerSheet,
  startRemoteCamera,
  startVideoCall,
  startVoiceCall,
} from './peerActions';
import { canDispatch } from './api';

const RECENTS_KEY = 'tacticalptx_people_recents';

function loadRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function pushRecent(peer) {
  if (!peer?.id) return;
  const prev = loadRecents().filter((p) => String(p.id) !== String(peer.id));
  const next = [
    {
      id: peer.id,
      displayName: peer.displayName || 'Usuario',
      avatarUrl: peer.avatarUrl || null,
      username: peer.username || null,
    },
    ...prev,
  ].slice(0, 12);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Paleta global de personas: buscar → actuar (Ctrl/Cmd+K).
 */
export default function PeoplePalette({ session, open, onClose, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [recents, setRecents] = useState(loadRecents);
  const inputRef = useRef(null);
  const allowCam = canDispatch(session?.user);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || '');
    setRecents(loadRecents());
    setErr('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open || !session?.token) return undefined;
    let cancelled = false;
    setLoading(true);
    const scope = canDispatch(session.user) ? 'org' : 'shared';
    fetchContacts(session.token, { scope })
      .then((data) => {
        if (!cancelled) setContacts(data.contacts || []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'No se pudieron cargar contactos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, session?.token, session?.user]);

  // Esc lo cierra GlobalEscapeClose vía data-esc-close-btn (captura);
  // también escuchamos el bus por si el diálogo no tiene botón clickable.
  useEffect(() => {
    if (!open) return undefined;
    const onEscClose = () => onClose?.();
    const root = document.querySelector('.people-palette[data-esc-close]');
    root?.addEventListener('tacticalptx:esc-close', onEscClose);
    return () => root?.removeEventListener('tacticalptx:esc-close', onEscClose);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = contacts.filter((c) => c.id !== session?.user?.id);
    if (!q) return list;
    return list.filter((c) => {
      const blob = `${c.displayName || ''} ${c.username || ''} ${c.email || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [contacts, query, session?.user?.id]);

  const showRecents = !query.trim() && recents.length > 0;

  const act = useCallback(
    (peer, kind) => {
      pushRecent(peer);
      if (kind === 'sheet') openPeerSheet(peer);
      else if (kind === 'dm') openDm(peer);
      else if (kind === 'voice') startVoiceCall(peer);
      else if (kind === 'video') startVideoCall(peer);
      else if (kind === 'cam') startRemoteCamera(peer);
      onClose?.();
    },
    [onClose]
  );

  if (!open || !session?.token) return null;

  return createPortal(
    <div
      className="people-palette-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="people-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Personas"
        data-esc-close=""
      >
        <header className="people-palette-head">
          <div>
            <h2>Personas</h2>
            <p>Buscar · mensaje · llamada · video{allowCam ? ' · ver cámara' : ''}</p>
          </div>
          <button
            type="button"
            className="people-palette-x"
            data-esc-close-btn=""
            aria-label="Cerrar"
            title="Cerrar (Esc)"
            onClick={() => onClose?.()}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className="people-palette-search">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, usuario o correo…"
            autoComplete="off"
          />
        </div>
        {err ? <p className="people-palette-err">{err}</p> : null}
        {loading ? <p className="people-palette-hint">Cargando contactos…</p> : null}
        <div className="people-palette-scroll">
          {showRecents && (
            <section className="people-palette-section">
              <h3>Recientes</h3>
              {recents.map((p) => (
                <PersonRow
                  key={`r-${p.id}`}
                  peer={p}
                  token={session.token}
                  allowCam={allowCam}
                  onAct={act}
                />
              ))}
            </section>
          )}
          <section className="people-palette-section">
            <h3>{query.trim() ? 'Resultados' : 'Contactos'}</h3>
            {!loading && filtered.length === 0 && (
              <p className="people-palette-hint">Sin coincidencias</p>
            )}
            {filtered.map((c) => (
              <PersonRow
                key={c.id}
                peer={{
                  id: c.id,
                  displayName: c.displayName,
                  avatarUrl: c.avatarUrl,
                  username: c.username,
                }}
                token={session.token}
                allowCam={allowCam}
                onAct={act}
              />
            ))}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PersonRow({ peer, token, allowCam, onAct }) {
  return (
    <div className="people-palette-row">
      <button type="button" className="people-palette-main" onClick={() => onAct(peer, 'sheet')}>
        <PersonAvatar
          userId={peer.id}
          name={peer.displayName}
          avatarUrl={peer.avatarUrl}
          token={token}
          className="people-palette-avatar"
        />
        <span className="people-palette-meta">
          <strong>{peer.displayName || 'Usuario'}</strong>
          {peer.username ? <small>@{peer.username}</small> : null}
        </span>
      </button>
      <div className="people-palette-quick">
        <button type="button" title="Mensaje" onClick={() => onAct(peer, 'dm')}>
          💬
        </button>
        <button type="button" title="Llamada" onClick={() => onAct(peer, 'voice')}>
          📞
        </button>
        <button type="button" title="Videollamada" onClick={() => onAct(peer, 'video')}>
          📹
        </button>
        {allowCam ? (
          <button type="button" title="Ver cámara" onClick={() => onAct(peer, 'cam')}>
            👁
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Host: Ctrl/Cmd+K + evento OPEN_PEOPLE_PALETTE. */
export function PeoplePaletteHost({ session }) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  useEffect(() => {
    const onOpen = (e) => {
      setInitialQuery(e.detail?.query || '');
      setOpen(true);
    };
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || (e.key !== 'k' && e.key !== 'K')) return;
      if (e.target?.closest?.('input[type="password"]')) return;
      e.preventDefault();
      setInitialQuery('');
      setOpen(true);
    };
    window.addEventListener(PEER_EVENTS.OPEN_PEOPLE_PALETTE, onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(PEER_EVENTS.OPEN_PEOPLE_PALETTE, onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!session?.token) return null;

  return (
    <PeoplePalette
      session={session}
      open={open}
      initialQuery={initialQuery}
      onClose={() => setOpen(false)}
    />
  );
}
