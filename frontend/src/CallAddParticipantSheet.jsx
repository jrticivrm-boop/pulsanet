import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchContacts, invitePrivateCallParticipant } from './api';
import PersonAvatar from './PersonAvatar';
import { esMsg } from './esMsg';

/**
 * Sheet para anexar contactos a una videollamada en curso.
 */
export default function CallAddParticipantSheet({
  open,
  onClose,
  authToken,
  callId,
  excludeIds = [],
  onInvited,
}) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !authToken) return undefined;
    setQuery('');
    setError('');
    setBusyId(null);
    setLoading(true);
    let cancelled = false;
    fetchContacts(authToken)
      .then((data) => {
        if (!cancelled) setContacts(data.contacts || []);
      })
      .catch((e) => {
        if (!cancelled) setError(esMsg(e.message, 'No se pudieron cargar contactos'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authToken]);

  useEffect(() => {
    if (!open) return undefined;
    const onEscClose = () => onClose?.();
    const root = document.querySelector('.call-add-sheet[data-esc-close]');
    root?.addEventListener('tacticalptx:esc-close', onEscClose);
    return () => root?.removeEventListener('tacticalptx:esc-close', onEscClose);
  }, [open, onClose]);

  const excluded = useMemo(
    () => new Set((excludeIds || []).map((id) => String(id)).filter(Boolean)),
    [excludeIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!c?.id || excluded.has(String(c.id))) return false;
      if (!q) return true;
      const blob = `${c.displayName || ''} ${c.username || ''} ${c.email || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [contacts, query, excluded]);

  if (!open) return null;

  async function invite(c) {
    if (!callId || !authToken || busyId) return;
    setBusyId(c.id);
    setError('');
    try {
      await invitePrivateCallParticipant(authToken, callId, c.id);
      onInvited?.(c);
      onClose?.();
    } catch (e) {
      setError(esMsg(e.message, 'No se pudo invitar'));
      setBusyId(null);
    }
  }

  return createPortal(
    <div className="call-add-overlay" role="presentation">
      <button type="button" className="call-add-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div
        className="call-add-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Añadir participante"
        data-esc-close=""
      >
        <header className="call-add-head">
          <button
            type="button"
            className="call-add-back"
            onClick={onClose}
            aria-label="Cerrar"
            data-esc-close-btn=""
          >
            ←
          </button>
          <div>
            <h2>Añadir participante</h2>
            <p>Se unirá a esta misma videollamada</p>
          </div>
        </header>
        <div className="call-add-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar contacto…"
            autoFocus
          />
        </div>
        {error ? <p className="call-add-err">{error}</p> : null}
        <div className="call-add-list">
          {loading && <p className="call-add-empty">Cargando…</p>}
          {!loading && filtered.length === 0 && (
            <p className="call-add-empty">
              {query.trim() ? 'Sin coincidencias.' : 'No hay más contactos disponibles.'}
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="call-add-row"
              disabled={Boolean(busyId)}
              onClick={() => invite(c)}
            >
              <PersonAvatar
                userId={c.id}
                name={c.displayName}
                avatarUrl={c.avatarUrl}
                token={authToken}
              />
              <span className="call-add-row-text">
                <strong>{c.displayName || 'Usuario'}</strong>
                {c.username ? <small>@{c.username}</small> : null}
              </span>
              <span className="call-add-row-action">{busyId === c.id ? '…' : '+'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
