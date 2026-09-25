import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchAuditChatAudio, fetchRecordings } from '../api';
import { socketIoOptions, socketUrl } from '../socketConfig';
import RecordingPlayer from './RecordingPlayer.jsx';
import ChatMedia from '../ChatMedia.jsx';

const SOCKET_URL = socketUrl();
/** Refresco en vivo sin F5 / sin botón (misma idea que Video). */
const POLL_MS = 12000;

function RadioRecordingsSection({ token }) {
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchRecordings(token, { hours: 24 });
        setRecordings(data.recordings || []);
        setError('');
      } catch (e) {
        if (!silent) setError(e.message || 'No se pudieron cargar grabaciones de radio');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load({ silent: false });
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    };
    const onRefresh = () => void load({ silent: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('tacticalptx:module-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('tacticalptx:module-refresh', onRefresh);
    };
  }, [load]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      ...socketIoOptions,
    });
    const join = () => socket.emit('dispatch:join');
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('dispatch:recording', (rec) => {
      if (!rec?.id) return;
      setRecordings((prev) => {
        if (prev.some((r) => r.id === rec.id)) return prev;
        return [rec, ...prev].slice(0, 80);
      });
    });
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [token]);

  return (
    <section className="cc-reserved-grab-section" aria-labelledby="reserved-radio-rec-h">
      <header className="cc-panel-head cc-reserved-grab-head">
        <div>
          <h2 id="reserved-radio-rec-h">Radio (PTT)</h2>
          <p className="cc-hint">Últimas 24 h · app y consola web al soltar el PTT</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando grabaciones de radio…</p>}
      {!loading && (
        <div className="cc-rec-list">
          {recordings.length === 0 && (
            <p className="cc-empty">
              Aún no hay grabaciones de radio. Habla por PTT en la app o en la consola web.
            </p>
          )}
          {recordings.map((r) => (
            <div key={r.id} className="cc-rec-row">
              <div>
                <strong>{r.displayName || 'Operador'}</strong>
                <small>
                  {r.groupName || 'Canal'}
                  {r.durationMs != null
                    ? ` · ${Math.floor(r.durationMs / 60000)}:${String(
                        Math.floor((r.durationMs / 1000) % 60)
                      ).padStart(2, '0')}`
                    : ''}
                  {' · '}
                  {new Date(r.createdAt).toLocaleString('es-MX')}
                </small>
              </div>
              <RecordingPlayer
                token={token}
                recordingId={r.id}
                durationMs={r.durationMs}
                label={`${r.displayName || 'Operador'} · ${r.groupName || 'Canal'}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChatAudioRecordingsSection({ token }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchAuditChatAudio(token, { hours: 24, limit: 80 });
        setItems(data.items || []);
        setError('');
      } catch (e) {
        if (!silent) setError(e.message || 'No se pudieron cargar audios de chat');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void load({ silent: false });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    };
    const onRefresh = () => void load({ silent: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('tacticalptx:module-refresh', onRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('tacticalptx:module-refresh', onRefresh);
    };
  }, [load]);

  return (
    <section className="cc-reserved-grab-section" aria-labelledby="reserved-chat-audio-h">
      <header className="cc-panel-head cc-reserved-grab-head">
        <div>
          <h2 id="reserved-chat-audio-h">Chat (notas de voz)</h2>
          <p className="cc-hint">
            Audios enviados en conversaciones directas y de grupo · últimas 24 h (solo lectura)
          </p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Buscando audios en conversaciones…</p>}
      {!loading && (
        <div className="cc-rec-list cc-reserved-chat-audio-list">
          {items.length === 0 && (
            <p className="cc-empty">
              No hay notas de voz recientes en conversaciones de chat.
            </p>
          )}
          {items.map((row) => (
            <div key={row.id} className="cc-rec-row cc-reserved-chat-audio-row">
              <div>
                <strong>{row.displayName || 'Usuario'}</strong>
                <small>
                  {row.context || 'Chat'}
                  {' · '}
                  {new Date(row.createdAt).toLocaleString('es-MX')}
                </small>
              </div>
              <div className="cc-reserved-chat-audio-player">
                <ChatMedia token={token} message={row} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Grabaciones del módulo reservado: radio PTT + audios de chat.
 */
export default function ReservedGrabaciones({ session }) {
  return (
    <div className="cc-reserved-grabaciones">
      <RadioRecordingsSection token={session.token} />
      <ChatAudioRecordingsSection token={session.token} />
    </div>
  );
}
