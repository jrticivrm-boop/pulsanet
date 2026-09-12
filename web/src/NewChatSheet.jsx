import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchContacts } from './api';
import PersonAvatar from './PersonAvatar';
import { openDm } from './peerActions';

/**
 * Lista de contactos para «Nuevo chat» (estilo WhatsApp).
 * scope shared = solo quien comparte grupo contigo.
 */
export default function NewChatSheet({ session, open, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setError('');
    setLoading(true);
    let cancelled = false;
    fetchContacts(session.token, { scope: 'shared' })
      .then((data) => {
        if (!cancelled) setContacts(data.contacts || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'No se pudieron cargar contactos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, session.token]);

  useEffect(() => {
    if (!open) return undefined;
    const onEscClose = () => onClose?.();
    const root = document.querySelector('.wa-newchat-sheet[data-esc-close]');
    root?.addEventListener('tacticalptx:esc-close', onEscClose);
    return () => root?.removeEventListener('tacticalptx:esc-close', onEscClose);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const name = String(c.displayName || '').toLowerCase();
      const user = String(c.username || '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });
  }, [contacts, query]);

  if (!open) return null;

  function pick(c) {
    const peer = {
      id: c.id,
      displayName: c.displayName || 'Usuario',
      avatarUrl: c.avatarUrl || null,
      username: c.username || null,
    };
    onPick?.(peer);
    openDm(peer);
    onClose?.();
  }

  return createPortal(
    <div className="wa-newchat-overlay" role="presentation">
      <button type="button" className="wa-newchat-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div
        className="wa-newchat-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo chat"
        data-esc-close=""
      >
        <header className="wa-newchat-head">
          <button
            type="button"
            className="wa-newchat-back"
            onClick={onClose}
            aria-label="Cerrar"
            data-esc-close-btn=""
          >
            ←
          </button>
          <div>
            <h2>Nuevo chat</h2>
            <p>Contactos de tus grupos</p>
          </div>
        </header>
        <div className="wa-newchat-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar contacto…"
            autoFocus
          />
        </div>
        <div className="wa-newchat-list">
          {loading && <p className="wa-newchat-empty">Cargando…</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="wa-newchat-empty">
              {query.trim()
                ? 'Sin coincidencias.'
                : 'No hay contactos disponibles. Solo aparecen quienes comparten un grupo contigo.'}
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="wa-newchat-row"
              onClick={() => pick(c)}
            >
              <PersonAvatar userId={c.id} name={c.displayName} avatarUrl={c.avatarUrl} />
              <span className="wa-newchat-row-text">
                <strong>{c.displayName || 'Usuario'}</strong>
                {c.username ? <small>@{c.username}</small> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
