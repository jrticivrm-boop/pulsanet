import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAuditDmMessages, fetchAuditGroupMessages } from '../api';

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
export default function AuditConversationPeek({ session, subjectUserId, subjectName, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      setMessages([]);
      try {
        if (open.peerId) {
          const data = await fetchAuditDmMessages(session.token, subjectUserId, open.peerId, {
            around: open.messageId || '',
          });
          if (cancelled) return;
          setTitle(
            `Chat con ${data.peer?.displayName || open.peerName || 'usuario'} · solo lectura`
          );
          setMessages(data.messages || []);
        } else if (open.groupId) {
          const data = await fetchAuditGroupMessages(
            session.token,
            subjectUserId,
            open.groupId,
            { around: open.messageId || '' }
          );
          if (cancelled) return;
          setTitle(`Grupo «${data.group?.name || open.groupName || '…'}» · solo lectura`);
          setMessages(data.messages || []);
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
  }, [open, session.token, subjectUserId]);

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

  return createPortal(
    <div className="cc-events-peek-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cc-events-peek"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Conversación'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cc-events-peek-head">
          <div>
            <strong>{title || 'Conversación'}</strong>
            <p className="cc-hint">
              Operador: {subjectName || '—'} · no se puede enviar ni editar
            </p>
          </div>
          <button type="button" className="cc-btn" onClick={onClose}>
            Cerrar
          </button>
        </header>
        {err ? <p className="cc-error">{err}</p> : null}
        {loading ? (
          <p className="cc-hint">Cargando conversación…</p>
        ) : (
          <div className="cc-events-peek-list" ref={listRef}>
            {messages.length === 0 ? (
              <p className="cc-hint">Sin mensajes en este hilo.</p>
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
                    {m.isDeleted
                      ? 'Mensaje eliminado'
                      : m.type === 'text' || !m.type
                        ? m.body || '—'
                        : m.type === 'image'
                          ? m.mediaUrl
                            ? `[Foto] ${m.mediaName || ''}`.trim()
                            : 'Foto'
                          : m.type === 'audio'
                            ? 'Audio'
                            : m.type === 'file'
                              ? `Archivo: ${m.mediaName || 'archivo'}`
                              : m.type === 'sticker'
                                ? 'Sticker'
                                : m.body || m.type}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
