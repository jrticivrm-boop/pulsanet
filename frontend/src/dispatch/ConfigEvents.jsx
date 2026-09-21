import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchAdminUsers,
  fetchAuditDmMessages,
  fetchAuditGroupMessages,
  fetchUserEvents,
} from '../api';

const KIND_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'session', label: 'Sesión' },
  { value: 'presence', label: 'Presencia' },
  { value: 'geofence', label: 'Geocerca' },
  { value: 'message', label: 'Mensajes' },
  { value: 'call', label: 'Llamadas' },
  { value: 'radio', label: 'Radio / PTT' },
  { value: 'panic', label: 'Pánico' },
  { value: 'account', label: 'Cuenta' },
];

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

function kindLabel(kind) {
  const map = {
    geofence: 'Geocerca',
    account: 'Cuenta',
    session: 'Sesión',
    presence: 'Presencia',
    message: 'Mensaje',
    call: 'Llamada',
    radio: 'Radio',
    panic: 'Pánico',
  };
  return map[kind] || kind || '—';
}

function todayLocalInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoLocalInput(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function canOpenChat(ev) {
  const m = ev?.meta;
  if (!m || !m.canOpen) return false;
  if (m.peerId && m.messageId) return true;
  if (m.groupId && m.messageId) return true;
  return false;
}

/**
 * Modal solo lectura: conversación del operador auditado.
 */
function EventChatPeek({ session, subjectUserId, subjectName, open, onClose }) {
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

/**
 * Configuración → Eventos: historial legible por operador (select usuario → lista).
 */
export default function ConfigEvents({ session }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState(() => daysAgoLocalInput(30));
  const [to, setTo] = useState(() => todayLocalInput());
  const [events, setEvents] = useState([]);
  const [subject, setSubject] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [peek, setPeek] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const data = await fetchAdminUsers(session.token);
        if (cancelled) return;
        const list = (data.users || []).slice().sort((a, b) =>
          String(a.displayName || a.username || '').localeCompare(
            String(b.displayName || b.username || ''),
            'es'
          )
        );
        setUsers(list);
        setErr('');
      } catch (e) {
        if (!cancelled) setErr(e.message || 'No se pudo cargar usuarios');
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const loadEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setSubject(null);
      return;
    }
    setLoading(true);
    try {
      const fromIso = from ? `${from}T00:00:00` : '';
      const toIso = to ? `${to}T23:59:59.999` : '';
      const data = await fetchUserEvents(session.token, {
        userId,
        kind,
        from: fromIso,
        to: toIso,
        limit: 300,
      });
      setEvents(data.events || []);
      setSubject(data.user || null);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar eventos');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [session.token, userId, kind, from, to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: `${u.displayName || u.username || 'Usuario'}${
          u.username ? ` (@${u.username})` : ''
        }`,
      })),
    [users]
  );

  return (
    <div className="cc-events">
      <header className="cc-backups-head">
        <div>
          <h1>Eventos</h1>
          <p className="cc-hint">
            Actividad del día del operador: sesión, presencia, geocercas, mensajes, llamadas, radio
            y más. En mensajes usa <strong>Ver</strong> para abrir el chat en solo lectura.
          </p>
        </div>
        <button
          type="button"
          className="cc-btn"
          disabled={loading || !userId}
          onClick={() => loadEvents()}
        >
          Actualizar
        </button>
      </header>

      <section className="cc-card cc-events-filters">
        <label>
          Operador
          <select
            value={userId}
            disabled={loadingUsers}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Selecciona un operador…</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!userId}>
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={!userId}
          />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!userId} />
        </label>
      </section>

      {err ? <p className="cc-error">{err}</p> : null}

      {!userId ? (
        <p className="cc-hint">Selecciona un operador para ver sus eventos.</p>
      ) : loading && !events.length ? (
        <p className="cc-hint">Cargando eventos…</p>
      ) : events.length === 0 ? (
        <p className="cc-hint">
          Sin eventos{subject?.displayName ? ` para ${subject.displayName}` : ''} con estos filtros.
        </p>
      ) : (
        <ul className="cc-events-list" aria-label="Eventos del operador">
          {events.map((ev) => (
            <li key={ev.id} className={`cc-events-item kind-${ev.kind || 'other'}`}>
              <time dateTime={ev.createdAt}>{fmtWhen(ev.createdAt)}</time>
              <span className="cc-events-kind">{kindLabel(ev.kind)}</span>
              <span className="cc-events-summary">{ev.summary}</span>
              {canOpenChat(ev) ? (
                <button
                  type="button"
                  className="cc-events-open"
                  onClick={() =>
                    setPeek({
                      peerId: ev.meta.peerId || null,
                      peerName: ev.meta.peerName || null,
                      groupId: ev.meta.groupId || null,
                      groupName: ev.meta.groupName || null,
                      messageId: ev.meta.messageId || null,
                    })
                  }
                >
                  Ver
                </button>
              ) : (
                <span className="cc-events-open-spacer" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}

      <EventChatPeek
        session={session}
        subjectUserId={userId}
        subjectName={subject?.displayName}
        open={peek}
        onClose={() => setPeek(null)}
      />
    </div>
  );
}
