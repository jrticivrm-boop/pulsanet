import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchOverview } from '../api';
import { socketIoOptions, socketUrl } from '../socketConfig';

const SOCKET_URL = socketUrl();

export default function DispatchHome({ session }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await fetchOverview(session.token);
      setOverview(data.overview);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [session.token]);

  useEffect(() => {
    reload();
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });
    socket.on('connect', () => {
      setLive(true);
      socket.emit('dispatch:join');
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('dispatch:speaker', () => reload());
    socket.on('dispatch:released', () => reload());
    socket.on('dispatch:presence', () => reload());
    const t = setInterval(reload, 15000);
    return () => {
      clearInterval(t);
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, reload]);

  if (!overview && !error) {
    return <p className="muted">Cargando resumen…</p>;
  }

  return (
    <div className="dispatch-page">
      <header className="dispatch-header">
        <h1>Centro de despacho</h1>
        <p className={live ? 'ok' : 'muted'}>{live ? 'En vivo' : 'Reconectando…'}</p>
      </header>
      {error && <p className="error">{error}</p>}
      {overview && (
        <>
          <div className="stat-row">
            <div className="stat">
              <strong>{overview.onlineCount}</strong>
              <span>En línea</span>
            </div>
            <div className="stat">
              <strong>{overview.usersActive}</strong>
              <span>Usuarios activos</span>
            </div>
            <div className="stat">
              <strong>{overview.groupsCount}</strong>
              <span>Grupos</span>
            </div>
          </div>

          <h2>Canales PTT</h2>
          <div className="channel-cards">
            {overview.channels.map((c) => (
              <article key={c.id} className={`channel-card ${c.speaker ? 'talking' : ''}`}>
                <h3>{c.name}</h3>
                <p>
                  {c.speaker
                    ? `${c.speaker.displayName} al aire`
                    : 'Canal libre'}
                </p>
                <p className="muted">{c.online.length} en canal</p>
                <ul>
                  {c.online.map((m) => (
                    <li key={m.userId}>{m.displayName}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
