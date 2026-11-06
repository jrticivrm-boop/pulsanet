import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchAuditChatAudio, fetchRecordings } from '../api';
import { socketIoOptions, socketUrl } from '../socketConfig';
import RecordingPlayer from './RecordingPlayer.jsx';
import ChatMedia from '../ChatMedia.jsx';
import ReservedWhoBar, { defaultWhoFilter, whoFilterReady } from './ReservedWhoBar.jsx';

const SOCKET_URL = socketUrl();
const POLL_MS = 12000;

function inRange(iso, from, to) {
  if (!iso || !from || !to) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();
  return t >= start && t <= end;
}

function RadioRecordingsSection({ token, filter }) {
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchRecordings(token, {
          userId: filter.userId,
          groupId: filter.groupId,
          from: filter.from,
          to: filter.to,
        });
        setRecordings(data.recordings || []);
        setError('');
      } catch (e) {
        if (!silent) setError(e.message || 'No se pudieron cargar grabaciones de radio');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, filter.userId, filter.groupId, filter.from, filter.to]
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
      if (String(rec.userId) !== String(filter.userId)) return;
      if (String(rec.groupId) !== String(filter.groupId)) return;
      if (!inRange(rec.createdAt, filter.from, filter.to)) return;
      setRecordings((prev) => {
        if (prev.some((r) => r.id === rec.id)) return prev;
        return [rec, ...prev].slice(0, 200);
      });
    });
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [token, filter.userId, filter.groupId, filter.from, filter.to]);

  return (
    <section className="cc-reserved-grab-section" aria-labelledby="reserved-radio-rec-h">
      <header className="cc-panel-head cc-reserved-grab-head">
        <div>
          <h2 id="reserved-radio-rec-h">Radio (PTT)</h2>
          <p className="cc-hint">
            {filter.userName || 'Operador'} en {filter.groupName || 'el canal'} · {filter.from} a {filter.to}
          </p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando grabaciones de radio…</p>}
      {!loading && (
        <div className="cc-rec-list">
          {recordings.length >= 500 && (
            <p className="cc-hint">Hay más PTT en este periodo. Acota las fechas para verlos todos.</p>
          )}
          {recordings.length === 0 && (
            <p className="cc-empty">No hay PTT de este operador en ese canal, en el periodo elegido.</p>
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

function ChatAudioRecordingsSection({ token, filter }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const personal = filter.withKind !== 'grupo';

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchAuditChatAudio(token, {
          limit: 500,
          userId: filter.userId,
          peerId: personal ? filter.peerId : undefined,
          groupId: personal ? undefined : filter.groupId,
          from: filter.from,
          to: filter.to,
        });
        setItems(data.items || []);
        setError('');
      } catch (e) {
        if (!silent) setError(e.message || 'No se pudieron cargar audios de chat');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, filter.userId, filter.peerId, filter.groupId, filter.from, filter.to, personal]
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

  const who = personal
    ? `${filter.userName || 'Operador'} con ${filter.peerName || 'el otro operador'}`
    : `${filter.userName || 'Operador'} en ${filter.groupName || 'el grupo'}`;

  return (
    <section className="cc-reserved-grab-section" aria-labelledby="reserved-chat-audio-h">
      <header className="cc-panel-head cc-reserved-grab-head">
        <div>
          <h2 id="reserved-chat-audio-h">Chat (notas de voz)</h2>
          <p className="cc-hint">
            {who} · {filter.from} a {filter.to} (solo lectura)
          </p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Buscando audios…</p>}
      {!loading && (
        <div className="cc-rec-list cc-reserved-chat-audio-list">
          {items.length >= 500 && (
            <p className="cc-hint">Hay más notas de voz en este periodo. Acota las fechas para verlas todas.</p>
          )}
          {items.length === 0 && <p className="cc-empty">No hay notas de voz en este periodo.</p>}
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
 * Grabaciones RESERVADO: solo el par o el canal elegido.
 */
export default function ReservedGrabaciones({ session }) {
  const [filter, setFilter] = useState(defaultWhoFilter);
  const ready = whoFilterReady(filter);

  return (
    <div className="cc-reserved-grabaciones">
      <ReservedWhoBar token={session.token} value={filter} onChange={setFilter} />
      {!ready ? (
        <p className="cc-hint cc-reserved-who-wait">
          Elige de quién y con quién. Hasta entonces no se lista nada.
        </p>
      ) : null}
      {ready && filter.withKind === 'operador' ? (
        <p className="cc-hint cc-reserved-who-note">
          La radio PTT es por canal, no entre dos personas. Aquí se escuchan las notas de voz de
          este par. Para el PTT, elige un grupo o canal.
        </p>
      ) : null}
      {ready && filter.withKind === 'grupo' ? (
        <RadioRecordingsSection token={session.token} filter={filter} />
      ) : null}
      {ready ? <ChatAudioRecordingsSection token={session.token} filter={filter} /> : null}
    </div>
  );
}
