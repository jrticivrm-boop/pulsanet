import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAuditDmMessages, fetchAuditGroupMessages } from '../api';
import ChatMedia from '../ChatMedia.jsx';

function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return String(iso);
  }
}

/**
 * Modal solo lectura: conversación del operador auditado.
 */
export default function AuditConversationPeek({
  session,
  subjectUserId,
  subjectName,
  open,
  onClose,
  embedded = false,
  from = '',
  to = '',
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      setMessages([]);
      setTruncated(false);
      try {
        if (open.peerId) {
          const data = await fetchAuditDmMessages(session.token, subjectUserId, open.peerId, {
            around: open.messageId || '',
            from,
            to,
            limit: from && to ? 800 : 120,
          });
          if (cancelled) return;
          setTitle(
            `Chat con ${data.peer?.displayName || open.peerName || 'usuario'} · solo lectura`
          );
          setMessages(data.messages || []);
          setTruncated(Boolean(data.truncated));
        } else if (open.groupId) {
          const data = await fetchAuditGroupMessages(
            session.token,
            subjectUserId,
            open.groupId,
            { around: open.messageId || '', from, to, limit: from && to ? 800 : 120 }
          );
          if (cancelled) return;
          setTitle(`Grupo «${data.group?.name || open.groupName || '…'}» · solo lectura`);
          setMessages(data.messages || []);
          setTruncated(Boolean(data.truncated));
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || 'No se pudo cargar el chat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session.token, subjectUserId, from, to]);

  useEffect(() => {
    if (!messages.length || !listRef.current) return;
    const el = listRef.current.querySelector('.is-highlight');
    if (el) el.scrollIntoView({ block: 'center' });
    else listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const periodHint = from && to ? ` · ${from} a ${to}` : '';
  const panel = (
    <>
      <header className="cc-events-peek-head">
        <div>
          <strong>{title || 'Conversación'}</strong>
          <p className="cc-hint">
            Operador: {subjectName || '—'}
            {periodHint} · no se puede enviar ni editar
          </p>
        </div>
        {embedded ? null : (
          <button type="button" className="cc-btn" onClick={onClose}>
            Cerrar
          </button>
        )}
      </header>
      {err ? <p className="cc-error">{err}</p> : null}
      {loading ? (
        <p className="cc-hint">Cargando conversación…</p>
      ) : (
        <div className="cc-events-peek-list" ref={listRef}>
            {truncated ? (
              <p className="cc-hint">Se muestran los 800 más recientes de este periodo.</p>
            ) : null}
            {messages.length === 0 ? (
              <p className="cc-hint">Sin mensajes en este hilo, en el periodo elegido.</p>
            ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`cc-events-peek-msg${m.mine ? ' is-mine' : ''}${
                  m.highlight ? ' is-highlight' : ''
                }${m.isDeleted ? ' is-deleted' : ''}`}
              >
                <div className="cc-events-peek-meta">
                  <span>{m.senderName}</span>
                  <time dateTime={m.createdAt}>{fmtWhen(m.createdAt)}</time>
                </div>
                <div className="cc-events-peek-body">
                  {m.isDeleted ? (
                    'Mensaje eliminado'
                  ) : (
                    <>
                      {m.mediaUrl && session?.token ? (
                        <ChatMedia token={session.token} message={m} />
                      ) : null}
                      {m.type === 'text' || !m.type
                        ? m.body || '—'
                        : m.type === 'sticker'
                          ? 'Sticker'
                          : m.type === 'nudge'
                            ? '¡Zumbido!'
                            : m.body || (!m.mediaUrl ? m.type : '')}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="cc-events-peek cc-reserved-thread" role="region" aria-label={title || 'Conversación'}>
        {panel}
      </div>
    );
  }

  return createPortal(
    <div className="cc-events-peek-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cc-events-peek"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Conversación'}
        onClick={(e) => e.stopPropagation()}
      >
        {panel}
      </div>
    </div>,
    document.body
  );
}
