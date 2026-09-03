import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { fetchPanicEvents, patchPanicEvent } from '../api';
import { startPanicAlarm, stopPanicAlarm, unlockPanicAudio } from '../panicSound';
import { openPanicLocation, isValidMapCoord } from '../panicMaps';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { sessionWireKey, unwrapDispatchPayload } from '../wireCrypto.js';

const SOCKET_URL = socketUrl();

function exitFullscreenIfAny() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

/**
 * Alerta de pánico en la consola de despacho (cualquier pestaña).
 * Portal a document.body para quedar por encima del mapa maximizado.
 */
export default function DispatchPanicHost({
  session,
  /** Fallback: pánico del canal PTT (usePtt.incomingPanic) cuando el socket dispatch falla. */
  channelPanic = null,
  onChannelPanicAck,
  onChannelPanicSilence,
}) {
  const navigate = useNavigate();
  const [activePanics, setActivePanics] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [mapDocked, setMapDocked] = useState(false);
  const alarmSilencedRef = useRef(false);

  const silenceAlarmLocally = useCallback(() => {
    alarmSilencedRef.current = true;
    stopPanicAlarm();
    onChannelPanicSilence?.();
  }, [onChannelPanicSilence]);

  const syncAlarm = useCallback((list) => {
    if (list.length > 0 && !alarmSilencedRef.current) startPanicAlarm();
    else stopPanicAlarm();
  }, []);

  const mergedPanics = useMemo(() => {
    if (!channelPanic?.id) return activePanics;
    if (activePanics.some((p) => p.id === channelPanic.id)) return activePanics;
    return [
      {
        id: channelPanic.id,
        userId: channelPanic.userId,
        displayName: channelPanic.displayName,
        groupId: channelPanic.groupId,
        groupName: channelPanic.groupName,
        latitude: channelPanic.latitude,
        longitude: channelPanic.longitude,
        accuracyM: channelPanic.accuracyM,
        status: 'active',
        _fromChannel: true,
      },
      ...activePanics,
    ];
  }, [activePanics, channelPanic]);

  useEffect(() => {
    if (mergedPanics.length === 0) {
      alarmSilencedRef.current = false;
      setMapDocked(false);
    }
  }, [mergedPanics.length]);

  useEffect(() => {
    if (!channelPanic?.id) return;
    exitFullscreenIfAny();
    alarmSilencedRef.current = false;
    startPanicAlarm();
  }, [channelPanic?.id]);

  const openOnDispatchMap = useCallback(
    (p) => {
      silenceAlarmLocally();
      setMapDocked(true);
      const params = new URLSearchParams();
      if (isValidMapCoord(p.latitude, p.longitude)) {
        params.set('lat', String(Number(p.latitude)));
        params.set('lng', String(Number(p.longitude)));
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
        exitFullscreenIfAny();
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

  async function resolvePanic(id, status, fromChannel = false) {
    setBusyId(id);
    setError('');
    try {
      if (fromChannel && status === 'acked' && onChannelPanicAck) {
        silenceAlarmLocally();
        await onChannelPanicAck();
        return;
      }
      await patchPanicEvent(session.token, id, status);
      setActivePanics((prev) => {
        const next = prev.filter((p) => p.id !== id);
        syncAlarm(next);
        return next;
      });
      if (status === 'acked' || status === 'resolved') {
        silenceAlarmLocally();
      }
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la alerta');
    } finally {
      setBusyId(null);
    }
  }

  if (mergedPanics.length === 0) return null;

  return createPortal(
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
            <div className="cc-panic-head-actions">
              <button
                type="button"
                className="cc-btn"
                onClick={silenceAlarmLocally}
                title="Silenciar sirena en este equipo"
              >
                Silenciar alarma
              </button>
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
          </div>
          <p>
            Hay {mergedPanics.length} alerta{mergedPanics.length === 1 ? '' : 's'} activa
            {mergedPanics.length === 1 ? '' : 's'}.
            {mapDocked ? ' Mapa centrado en el punto de pánico.' : ' Pulsa Enterado o Silenciar alarma.'}
          </p>
        </header>
        <div className="cc-panic-banner cc-panic-banner--modal" role="alert">
          {mergedPanics.map((p) => (
            <div key={p.id} className="cc-panic-item">
              <div>
                <strong>{p.displayName || 'Operador'}</strong>
                <span>
                  {p.groupName || 'Canal'}
                  {isValidMapCoord(p.latitude, p.longitude)
                    ? ` · ${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`
                    : ' · Sin ubicación GPS'}
                </span>
              </div>
              <div className="cc-panic-actions">
                {isValidMapCoord(p.latitude, p.longitude) && (
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
                {!isValidMapCoord(p.latitude, p.longitude) && (
                  <button
                    type="button"
                    className="cc-btn"
                    onClick={() => openOnDispatchMap(p)}
                    title="Sin GPS: abre seguimiento (sin pin)"
                  >
                    Ir a seguimiento
                  </button>
                )}
                <button
                  type="button"
                  className="cc-btn"
                  disabled={busyId === p.id}
                  onClick={() => resolvePanic(p.id, 'acked', Boolean(p._fromChannel))}
                >
                  Enterado
                </button>
                <button
                  type="button"
                  className="cc-btn primary"
                  disabled={busyId === p.id}
                  onClick={() => resolvePanic(p.id, 'resolved', Boolean(p._fromChannel))}
                >
                  Resolver
                </button>
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>,
    document.body
  );
}
