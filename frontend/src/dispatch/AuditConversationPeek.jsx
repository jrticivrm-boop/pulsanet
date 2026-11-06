import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  downloadReservedThread,
  fetchAuditDmMessages,
  fetchAuditGroupMessages,
  fetchMediaBlobUrl,
  searchReservedThread,
} from '../api';
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

function isImage(m) {
  return m?.type === 'image' || String(m?.mediaMime || '').startsWith('image/');
}

function isAudio(m) {
  return m?.type === 'audio' || String(m?.mediaMime || '').startsWith('audio/');
}

function isVideo(m) {
  return m?.type === 'video' || String(m?.mediaMime || '').startsWith('video/');
}

function ReservedPhoto({ token, message }) {
  const [src, setSrc] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    let url = '';
    (async () => {
      try {
        url = await fetchMediaBlobUrl(token, message.mediaUrl);
        if (!dead) setSrc(url);
      } catch (e) {
        if (!dead) setErr(e.message || 'No se pudo abrir la foto');
      }
    })();
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, message.mediaUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="cc-rsv-photo">
      <div className="cc-rsv-photo-frame">
        {src ? (
          <img
            src={src}
            alt=""
            onError={() => {
              setSrc('');
              setErr('No se pudo mostrar la foto');
            }}
          />
        ) : (
          <span>{err || 'Cargando foto…'}</span>
        )}
      </div>
      <button
        type="button"
        className="cc-btn cc-rsv-photo-open"
        disabled={!src}
        title="Abre la foto en grande. Escape o Cerrar la quita."
        onClick={() => setOpen(true)}
      >
        Ampliar
      </button>
      {open && src
        ? createPortal(
            <div className="cc-rsv-lightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada">
              <button type="button" className="cc-btn" onClick={() => setOpen(false)}>
                Cerrar
              </button>
              <img src={src} alt="" />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function MessageBody({ token, message }) {
  if (message.contentWiped) {
    return <p className="cc-hint">El contenido ya no está en el servidor. Queda quién lo envió y cuándo.</p>;
  }
  const caption = message.body || '';
  return (
    <>
      {message.mediaUrl && token && isImage(message) ? (
        <ReservedPhoto token={token} message={message} />
      ) : null}
      {message.mediaUrl && token && (isAudio(message) || isVideo(message)) ? (
        <ChatMedia token={token} message={message} />
      ) : null}
      {message.mediaUrl && token && !isImage(message) && !isAudio(message) && !isVideo(message) ? (
        <ChatMedia token={token} message={message} />
      ) : null}
      {message.type === 'sticker' ? <p>Sticker</p> : null}
      {message.type === 'nudge' ? <p>¡Zumbido!</p> : null}
      {caption && message.type !== 'nudge' && message.type !== 'sticker' ? <p>{caption}</p> : null}
    </>
  );
}

function badges(m) {
  const out = [];
  if (m.isDeleted) out.push(isImage(m) ? 'Imagen eliminada' : 'Mensaje eliminado');
  if (m.viewOnce) out.push('Solo 1 vez');
  return out;
}

/**
 * Conversación solo lectura. En RESERVADO incluye búsqueda y exportación.
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
  tools = false,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [highlightId, setHighlightId] = useState('');
  const [q, setQ] = useState('');
  const [onlyDeleted, setOnlyDeleted] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [search, setSearch] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [jumpNote, setJumpNote] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setHighlightId(open.messageId || '');
    setSearch(null);
    setSearchErr('');
    setJumpNote('');
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
          setTitle(`Chat con ${data.peer?.displayName || open.peerName || 'usuario'}`);
          setMessages(data.messages || []);
          setTruncated(Boolean(data.truncated));
        } else if (open.groupId) {
          const data = await fetchAuditGroupMessages(session.token, subjectUserId, open.groupId, {
            around: open.messageId || '',
            from,
            to,
            limit: from && to ? 800 : 120,
          });
          if (cancelled) return;
          setTitle(`Grupo «${data.group?.name || open.groupName || '…'}»`);
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
  }, [messages, highlightId]);

  useEffect(() => {
    if (!open || embedded) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, embedded]);

  async function runSearch(offset = 0) {
    if (!open) return;
    setSearching(true);
    setSearchErr('');
    setJumpNote('');
    try {
      const data = await searchReservedThread(session.token, {
        userId: subjectUserId,
        peerId: open.peerId,
        groupId: open.groupId,
        from,
        to,
        q: q.trim(),
        onlyDeleted,
        offset,
      });
      setSearch((prev) =>
        offset > 0 && prev
          ? { ...data, hits: [...prev.hits, ...(data.hits || [])] }
          : data
      );
    } catch (e) {
      setSearch(null);
      setSearchErr(e.message || 'No se pudo buscar');
    } finally {
      setSearching(false);
    }
  }

  function jumpTo(messageId) {
    setHighlightId(messageId);
    const el = listRef.current?.querySelector(`[data-id="${messageId}"]`);
    if (el) {
      setJumpNote('');
      el.scrollIntoView({ block: 'center' });
      return;
    }
    setJumpNote(
      'Ese mensaje está en el periodo, fuera de los 800 más recientes que se muestran abajo. El extracto de la lista es el registro.'
    );
  }

  async function onExport() {
    if (!open) return;
    setExporting(true);
    setSearchErr('');
    try {
      await downloadReservedThread(session.token, {
        userId: subjectUserId,
        peerId: open.peerId,
        groupId: open.groupId,
        from,
        to,
      });
    } catch (e) {
      setSearchErr(e.message || 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  const periodHint = from && to ? `${from} a ${to}` : 'sin periodo';
  const panel = (
    <>
      <header className="cc-events-peek-head">
        <div>
          <strong>{title || 'Conversación'}</strong>
          <p className="cc-hint">
            {subjectName || 'Operador'} · {periodHint} · solo lectura
          </p>
        </div>
        {embedded ? null : (
          <button type="button" className="cc-btn" onClick={onClose}>
            Cerrar
          </button>
        )}
      </header>
      {tools ? (
        <div className="cc-rsv-tools">
          <label title="Busca en el texto y en el pie de las fotos de este hilo y este periodo. No lee el interior de las imágenes.">
            Buscar en este hilo
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch(0);
                }
              }}
              placeholder="Palabra o frase"
              aria-label="Buscar en este hilo"
              maxLength={80}
            />
          </label>
          <label
            className="cc-rsv-check"
            title="Muestra solo mensajes que alguien eliminó. RESERVADO conserva el contenido; el teléfono ve eliminado."
          >
            <input
              type="checkbox"
              checked={onlyDeleted}
              onChange={(e) => setOnlyDeleted(e.target.checked)}
            />
            Solo eliminados
          </label>
          <button type="button" className="cc-btn" disabled={searching} onClick={() => void runSearch(0)}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
          <button
            type="button"
            className="cc-btn"
            disabled={exporting}
            title="Descarga este hilo y este periodo: un ZIP con un HTML y la carpeta de fotos y audios."
            onClick={() => void onExport()}
          >
            {exporting ? 'Armando ZIP…' : 'Exportar ZIP'}
          </button>
        </div>
      ) : null}
      {searchErr ? <p className="cc-error">{searchErr}</p> : null}
      {search ? (
        <div className="cc-rsv-hits">
          <p className="cc-hint">
            {search.query
              ? `${search.occurrences} apariciones en ${search.messages} mensajes`
              : `${search.messages} mensajes eliminados`}
            {search.truncated ? ' · el periodo se cortó en 4 000 mensajes' : ''}
          </p>
          {search.hits.length === 0 ? <p className="cc-hint">Sin coincidencias.</p> : null}
          <ul>
            {search.hits.map((hit, i) => (
              <li key={`${hit.messageId}-${i}`}>
                <button type="button" onClick={() => jumpTo(hit.messageId)}>
                  <span>
                    {hit.senderName}
                    <time dateTime={hit.createdAt}>{fmtWhen(hit.createdAt)}</time>
                  </span>
                  <em>
                    {hit.contentWiped
                      ? 'El contenido ya no está en el servidor.'
                      : (
                        <>
                          {hit.snippet?.before}
                          <mark>{hit.snippet?.match}</mark>
                          {hit.snippet?.after}
                        </>
                      )}
                  </em>
                </button>
              </li>
            ))}
          </ul>
          {search.hits.length < search.total ? (
            <button
              type="button"
              className="cc-btn"
              disabled={searching}
              onClick={() => void runSearch(search.hits.length)}
            >
              Ver más
            </button>
          ) : null}
          {jumpNote ? <p className="cc-hint">{jumpNote}</p> : null}
        </div>
      ) : null}
      {err ? <p className="cc-error">{err}</p> : null}
      {loading ? (
        <p className="cc-hint">Cargando conversación…</p>
      ) : (
        <div className="cc-events-peek-list" ref={listRef}>
          {truncated ? (
            <p className="cc-hint">Se muestran los 800 más recientes de este periodo. La búsqueda recorre el periodo completo, hasta 4 000.</p>
          ) : null}
          {messages.length === 0 ? (
            <p className="cc-hint">Sin mensajes en este hilo, en el periodo elegido.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                data-id={m.id}
                className={`cc-events-peek-msg${m.mine ? ' is-mine' : ''}${
                  String(highlightId) === String(m.id) ? ' is-highlight' : ''
                }${m.isDeleted ? ' is-deleted' : ''}`}
              >
                <div className="cc-events-peek-meta">
                  <span>{m.senderName}</span>
                  <time dateTime={m.createdAt}>{fmtWhen(m.createdAt)}</time>
                  {badges(m).map((b) => (
                    <em key={b} className="cc-rsv-badge" title={b}>
                      {b}
                    </em>
                  ))}
                </div>
                <div className="cc-events-peek-body">
                  <MessageBody token={session?.token} message={m} />
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
