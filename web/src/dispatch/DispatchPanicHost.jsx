import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { fetchPanicEvents, patchPanicEvent } from '../api';
import { startPanicAlarm, stopPanicAlarm, unlockPanicAudio } from '../panicSound';
import { openPanicLocation } from '../panicMaps';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { sessionWireKey, unwrapDispatchPayload } from '../wireCrypto.js';

const SOCKET_URL = socketUrl();

/**
 * Alerta de pánico en la consola de despacho (cualquier pestaña).
 * Solo llegan eventos de grupos donde el operador es miembro
 * (backend: sala user:{id}, no org-wide).
 */
export default function DispatchPanicHost({ session }) {
  const navigate = useNavigate();
  const [activePanics, setActivePanics] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  /** Modal compacto arriba para no tapar el mapa de seguimiento. */
  const [mapDocked, setMapDocked] = useState(false);
  const alarmSilencedRef = useRef(false);

  const silenceAlarmLocally = useCallback(() => {
    alarmSilencedRef.current = true;
    stopPanicAlarm();
  }, []);

  const syncAlarm = useCallback((list) => {
    if (list.length > 0 && !alarmSilencedRef.current) startPanicAlarm();
    else stopPanicAlarm();
  }, []);

  useEffect(() => {
    if (activePanics.length === 0) {
      alarmSilencedRef.current = false;
      setMapDocked(false);
    }
  }, [activePanics.length]);

  const openOnDispatchMap = useCallback(
    (p) => {
      silenceAlarmLocally();
      setMapDocked(true);
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const params = new URLSearchParams();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('zoom', '17');
      }
      if (p.userId) params.set('user', String(p.userId));
      if (p.id) params.set('panic', String(p.id));
      params.set('t', String(Date.now()));
      const qs = params.toString();
      navigate(`/despacho/seguimiento${qs ? `?${qs}` : ''}`);
    },
    [navigate, silenceAlarmLocally]
  );

  useEffect(() => {
    let cancelled = false;
    fetchPanicEvents(session.token, { status: 'active' })
      .then((data) => {
        if (cancelled) return;
        const list = data?.events || [];
        setActivePanics(list);
        if (list.length > 0 && !alarmSilencedRef.current) startPanicAlarm();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  useEffect(() => {
    const unlock = () => {
      unlockPanicAudio().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });

    socket.on('connect', () => {
      socket.emit('dispatch:join');
      unlockPanicAudio().catch(() => {});
    });
    socket.on('reconnect', () => {
      socket.emit('dispatch:join');
    });

    socket.on('dispatch:panic', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
        if (!payload?.id) return;
        alarmSilencedRef.current = false;
        startPanicAlarm();
        setActivePanics((prev) => {
          if (prev.some((p) => p.id === payload.id)) return prev;
          return [payload, ...prev];
        });
      })();
    });

    socket.on('dispatch:panic_update', (raw) => {
      void (async () => {
        const payload = await unwrapDispatchPayload(raw, sessionWireKey(session));
        if (!payload?.id) return;
        if (payload.status === 'acked') {
          setActivePanics((prev) =>
            prev.map((p) => (p.id === payload.id ? { ...p, ...payload } : p))
          );
          return;
        }
        setActivePanics((prev) => {
          const next =
            payload.status === 'active'
              ? prev.map((p) => (p.id === payload.id ? payload : p))
              : prev.filter((p) => p.id !== payload.id);
          syncAlarm(next);
          return next;
        });
      })();
    });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      stopPanicAlarm();
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, session.crypto?.wireKey, syncAlarm]);

  async function resolvePanic(id, status) {
    setBusyId(id);
    setError('');
    try {
      await patchPanicEvent(session.token, id, status);
      setActivePanics((prev) => {
        const next = prev.filter((p) => p.id !== id);
        syncAlarm(next);
        return next;
      });
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la alerta');
    } finally {
      setBusyId(null);
    }
  }

  if (activePanics.length === 0) return null;

  return (
    <div
      className={`cc-panic-overlay${mapDocked ? ' cc-panic-overlay--docked' : ''}`}
      role="alertdialog"
      aria-modal={!mapDocked}
      aria-label="Alerta de pánico"
    >
      <div className="cc-panic-modal">
        <header className="cc-panic-modal-head">
          <div className="cc-panic-modal-head-row">
            <h2>🚨 Alerta de pánico</h2>
            {mapDocked ? (
              <button
                type="button"
                className="cc-btn"
                onClick={() => setMapDocked(false)}
                title="Ampliar alerta"
              >
                Ampliar
              </button>
            ) : null}
          </div>
          <p>
            Hay {activePanics.length} alerta{activePanics.length === 1 ? '' : 's'} activa
            {activePanics.length === 1 ? '' : 's'}.
            {mapDocked ? ' Mapa centrado en el punto de pánico.' : ''}
          </p>
        </header>
        <div className="cc-panic-banner cc-panic-banner--modal" role="alert">
          {activePanics.map((p) => (
            <div key={p.id} className="cc-panic-item">
              <div>
                <strong>{p.displayName || 'Operador'}</strong>
                <span>
                  {p.groupName || 'Canal'}
                  {p.latitude != null
                    ? ` · ${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`
                    : ''}
                </span>
              </div>
              <div className="cc-panic-actions">
                {p.latitude != null && (
                  <>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => {
                        silenceAlarmLocally();
                        openPanicLocation({
                          latitude: p.latitude,
                          longitude: p.longitude,
                          navigate: false,
                        });
                      }}
                    >
                      Ver ubicación
                    </button>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => {
                        silenceAlarmLocally();
                        openPanicLocation({
                          latitude: p.latitude,
                          longitude: p.longitude,
                          navigate: true,
                        });
                      }}
                    >
                      Cómo llegar
                    </button>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => openOnDispatchMap(p)}
                    >
                      Ver en mapa
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="cc-btn"
                  disabled={busyId === p.id}
                  onClick={() => resolvePanic(p.id, 'acked')}
                >
                  Enterado
                </button>
                <button
                  type="button"
                  className="cc-btn primary"
                  disabled={busyId === p.id}
                  onClick={() => resolvePanic(p.id, 'resolved')}
                >
                  Resolver
                </button>
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
