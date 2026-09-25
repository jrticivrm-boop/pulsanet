import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  fetchOverview,
  fetchGroupVideoStatus,
  startPrivateCall,
} from '../api';
import { esMsg } from '../esMsg';
import GroupVideoPanel from '../GroupVideoPanel';
import RemoteMonitorConference from './RemoteMonitorConference';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { startVideoCall as peerStartVideo } from '../peerActions';

import { useIsPhone } from '../useMediaQuery.js';

const SOCKET_URL = socketUrl();
const POLL_MS = 12000;

/**
 * Consola de Video (módulo Despacho): operadores en línea (Ver cámara / Videollamada)
 * y activación explícita de la cámara web del puesto.
 */
export default function DispatchVideo({ session }) {
  const isPhone = useIsPhone();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [groupVideoLive, setGroupVideoLive] = useState({});
  const [groupVideo, setGroupVideo] = useState(null);
  /** Varias «Ver cámara» apiladas en el panel. */
  const [remoteMonitors, setRemoteMonitors] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [camStatus, setCamStatus] = useState('idle'); // idle | on | error
  const [camError, setCamError] = useState('');
  const previewRef = useRef(null);
  const streamRef = useRef(null);

  const attachPreviewStream = useCallback(async (stream) => {
    const el = previewRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    try {
      await el.play();
    } catch {
      /* autoplay bloqueado: muted+playsInline suele bastar al siguiente tick */
      try {
        el.muted = true;
        await el.play();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const stopPreview = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    if (previewRef.current) previewRef.current.srcObject = null;
    setCamStatus('idle');
  }, []);

  const activateConsoleCamera = useCallback(async () => {
    setCamError('');
    try {
      // No usar warmUp aquí: abre y cierra la cámara y en Windows suele dejar preview negra.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = stream;
      setCamStatus('on');
      // El <video> estable ya está montado; enganchar en el siguiente frame.
      requestAnimationFrame(() => {
        void attachPreviewStream(stream);
      });
    } catch (e) {
      setCamStatus('error');
      setCamError(esMsg(e, 'No se pudo activar la cámara web'));
      stopPreview();
    }
  }, [attachPreviewStream, stopPreview]);

  // Re-enganchar si el video remonta o el stream ya existe (evita cuadro negro).
  useEffect(() => {
    if (camStatus !== 'on' || !streamRef.current) return undefined;
    void attachPreviewStream(streamRef.current);
    return undefined;
  }, [camStatus, groupVideo, remoteMonitors.length, attachPreviewStream]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const reload = useCallback(async () => {
    try {
      const ov = await fetchOverview(session.token);
      setOverview(ov.overview || null);
      setError('');
      const channels = ov.overview?.channels || [];
      const statuses = await Promise.all(
        channels.map((ch) =>
          fetchGroupVideoStatus(session.token, ch.id)
            .then((d) => ({ id: ch.id, active: Boolean(d?.active) }))
            .catch(() => ({ id: ch.id, active: false }))
        )
      );
      setGroupVideoLive((prev) => {
        const next = { ...prev };
        statuses.forEach((s) => {
          next[s.id] = s.active;
        });
        return next;
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar canales');
    }
  }, [session.token]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled && !document.hidden) reload();
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reload]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });
    const join = () => {
      setLive(true);
      socket.emit('dispatch:join');
    };
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('disconnect', () => setLive(false));
    socket.on('dispatch:presence', () => reload());
    socket.on('group:video_started', (p) => {
      const gid = p?.groupId;
      if (gid) setGroupVideoLive((prev) => ({ ...prev, [gid]: true }));
    });
    socket.on('group:video_ended', (p) => {
      const gid = p?.groupId;
      if (!gid) return;
      setGroupVideoLive((prev) => {
        const next = { ...prev };
        delete next[gid];
        return next;
      });
      setGroupVideo((cur) => (cur?.groupId === gid ? null : cur));
    });
    socket.on('call:ended', ({ callId }) => {
      if (!callId) return;
      setRemoteMonitors((list) => list.filter((m) => String(m.callId) !== String(callId)));
    });
    return () => {
      socket.emit('dispatch:leave');
      socket.disconnect();
    };
  }, [session.token, reload]);

  const channels = overview?.channels || [];
  const people = useMemo(() => {
    const map = new Map();
    channels.forEach((ch) => {
      (ch.online || []).forEach((m) => {
        if (!m?.userId || m.userId === session.user?.id) return;
        const prev = map.get(m.userId);
        if (!prev) {
          map.set(m.userId, {
            userId: m.userId,
            name: m.displayName || m.name || 'Operador',
            channels: [ch.name],
          });
        } else if (!prev.channels.includes(ch.name)) {
          prev.channels.push(ch.name);
        }
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [channels, session.user?.id]);

  function startVideoCall(person) {
    if (!person?.userId) return;
    if (remoteMonitors.some((m) => m.peerId === person.userId)) {
      setError('Ese dispositivo ya está en Ver cámara. Cuélgalo antes de videollamada.');
      return;
    }
    stopPreview();
    setGroupVideo(null);
    setSelectedUser(person);
    peerStartVideo({ id: person.userId, displayName: person.name });
  }

  /** Activa/solicita la cámara del dispositivo y la apila en el panel (varias a la vez). */
  async function startRemoteCamera(person) {
    if (!person?.userId) return;
    if (remoteMonitors.some((m) => m.peerId === person.userId)) {
      setSelectedUser(person);
      return;
    }
    try {
      stopPreview();
      setGroupVideo(null);
      const data = await startPrivateCall(session.token, person.userId, {
        mode: 'video',
        intent: 'remote_camera',
      });
      const monitor = {
        callId: data.call?.callId,
        peerId: person.userId,
        peerName: person.name,
        token: data.token,
        authToken: session.token,
        url: data.url,
        e2eeKey: data.e2eeKey,
        role: 'caller',
        mode: 'video',
        intent: 'remote_camera',
      };
      setRemoteMonitors((list) => {
        const next = [...list, monitor];
        if (isPhone && next.length > 2) {
          setError('En teléfono máximo 2 monitores; se reemplazó el más antiguo.');
          return next.slice(-2);
        }
        return next;
      });
      setSelectedUser(person);
    } catch (e) {
      setError(esMsg(e.message || e, 'No se pudo solicitar la cámara del dispositivo'));
    }
  }

  useEffect(() => {
    const onRemote = (e) => {
      const peer = e.detail?.peer;
      if (!peer?.id) return;
      e.detail.handled = true;
      void startRemoteCamera({ userId: peer.id, name: peer.displayName });
    };
    window.addEventListener('tacticalptx:dispatch-remote-camera', onRemote);
    return () => window.removeEventListener('tacticalptx:dispatch-remote-camera', onRemote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, remoteMonitors.length]);

  const hasVideoSession = Boolean(groupVideo || remoteMonitors.length > 0);

  return (
    <div className={`dv-page${hasVideoSession ? ' with-session' : ''}`}>
      <header className="dv-head">
        <div>
          <h1>Video</h1>
          <p className="dv-hint">
            Videollamadas y cámara remota de dispositivos ·{' '}
            <span className={live ? 'dv-live-on' : ''}>{live ? 'Tiempo real' : 'Reconectando'}</span>
          </p>
        </div>
        <div className="dv-head-actions">
          {camStatus === 'on' ? (
            <button type="button" className="cc-btn" onClick={stopPreview}>
              Apagar cámara web
            </button>
          ) : (
            <button
              type="button"
              className="cc-btn primary"
              onClick={activateConsoleCamera}
              title="Activa la cámara web de este puesto (permiso del navegador)"
            >
              Activar cámara web
            </button>
          )}
          <button type="button" className="cc-btn" onClick={reload}>
            Actualizar
          </button>
        </div>
      </header>

      {error ? <p className="dv-error">{error}</p> : null}
      {camError ? <p className="dv-error">{camError}</p> : null}

      <div
        className={`dv-cam-preview-wrap${
          camStatus === 'on' && !groupVideo && remoteMonitors.length === 0
            ? ''
            : ' is-idle'
        }`}
        aria-hidden={camStatus !== 'on'}
      >
        <video
          ref={previewRef}
          className="dv-cam-preview"
          muted
          playsInline
          autoPlay
        />
        {camStatus === 'on' && !groupVideo && remoteMonitors.length === 0 ? (
          <span className="dv-cam-preview-label">Cámara web del puesto · vista previa</span>
        ) : null}
      </div>

      {hasVideoSession && (
        <section className="dv-stage" aria-label="Sesión de video">
          {groupVideo && (
            <GroupVideoPanel
              token={session.token}
              groupId={groupVideo.groupId}
              groupName={groupVideo.groupName}
              layout="console"
              onClose={() => setGroupVideo(null)}
              onRemoteEnded={() => setGroupVideo(null)}
            />
          )}
          {remoteMonitors.length > 0 && (
            <RemoteMonitorConference
              monitors={remoteMonitors}
              sessionToken={session.token}
              onHangupMonitor={(mon) => {
                setRemoteMonitors((list) => list.filter((m) => String(m.callId) !== String(mon.callId)));
              }}
            />
          )}
        </section>
      )}

      <div className="dv-grid">
        <section className="cc-panel dv-panel">
          <div className="cc-panel-head">
            <div>
              <h2>Operadores en línea</h2>
              <p className="cc-hint">
                Ver cámara (puedes abrir varias a la vez; se apilan) o videollamada 1:1
              </p>
            </div>
          </div>
          <div className="dv-people-list">
            {people.length === 0 && (
              <p className="cc-empty">Nadie en línea en los canales visibles.</p>
            )}
            {people.map((p) => {
              const monitoring = remoteMonitors.some((m) => m.peerId === p.userId);
              return (
              <article
                key={p.userId}
                className={`dv-person${selectedUser?.userId === p.userId ? ' selected' : ''}`}
              >
                <button type="button" className="dv-person-main" onClick={() => setSelectedUser(p)}>
                  <strong>{p.name}</strong>
                  <span>{p.channels.join(' · ')}</span>
                </button>
                <div className="dv-person-actions">
                  <button
                    type="button"
                    className="cc-btn primary"
                    onClick={() => startRemoteCamera(p)}
                    disabled={monitoring}
                    title="Solicita activar la cámara del teléfono y proyectarla aquí (varias a la vez)"
                  >
                    {monitoring ? 'En panel' : 'Ver cámara'}
                  </button>
                  <button
                    type="button"
                    className="cc-btn"
                    onClick={() => startVideoCall(p)}
                    title="Videollamada 1:1 (ambos con cámara)"
                  >
                    Videollamada
                  </button>
                </div>
              </article>
            );
            })}
          </div>
        </section>
      </div>

      {!hasVideoSession && (
        <p className="dv-foot-hint">
          <strong>Ver cámara</strong> solicita al dispositivo de campo activar su cámara y proyecta
          el feed en este panel (en el móvil: permiso de cámara una vez; luego acepta solo).{' '}
          <strong>Activar cámara web</strong> solo prueba la cámara de este puesto.
        </p>
      )}
    </div>
  );
}
