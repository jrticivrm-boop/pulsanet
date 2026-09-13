import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchRecordings } from '../api';
import { socketIoOptions, socketUrl } from '../socketConfig';
import RecordingPlayer from './RecordingPlayer.jsx';

const SOCKET_URL = socketUrl();

/**
 * Grabaciones PTT (antes en Operaciones) — Configuración.
 */
export default function ConfigRecordings({ session }) {
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchRecordings(session.token, { hours: 24 });
        if (!cancelled) {
          setRecordings(data.recordings || []);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudieron cargar grabaciones');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
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
  }, [session.token]);

  return (
    <div className="cc-config-recordings">
      <header className="cc-panel-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Grabaciones PTT</h2>
          <p className="cc-hint">Últimas 24 h · se generan al soltar el PTT (consola web)</p>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}
      {!loading && (
        <div className="cc-rec-list">
          {recordings.length === 0 && (
            <p className="cc-empty">
              Aún no hay grabaciones. Habla por Radio web (PTT) para generar una.
            </p>
          )}
          {recordings.map((r) => (
            <div key={r.id} className="cc-rec-row">
              <div>
                <strong>{r.displayName || 'Operador'}</strong>
                <small>
                  {r.groupName || 'Canal'}
                  {r.durationMs != null ? ` · ${(r.durationMs / 1000).toFixed(1)} s` : ''}
                  {' · '}
                  {new Date(r.createdAt).toLocaleTimeString()}
                </small>
              </div>
              <RecordingPlayer
                token={session.token}
                recordingId={r.id}
                durationMs={r.durationMs}
                label={`${r.displayName || 'Operador'} · ${r.groupName || 'Canal'}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
