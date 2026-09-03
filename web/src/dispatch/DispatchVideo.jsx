import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  fetchOverview,
  fetchGroupVideoStatus,
  startPrivateCall,
  endPrivateCall,
} from '../api';
import { warmUpVideoCallMedia } from '../callMedia';
import { esMsg } from '../esMsg';
import PrivateCallOverlay from '../PrivateCallOverlay';
import GroupVideoPanel from '../GroupVideoPanel';
import { socketIoOptions, socketUrl } from '../socketConfig';

const SOCKET_URL = socketUrl();
const POLL_MS = 12000;

/**
 * Consola de Video (módulo Despacho): transmisiones de canal + videollamadas 1:1
 * y activación explícita de la cámara web del puesto.
 */
export default function DispatchVideo({ session }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [groupVideoLive, setGroupVideoLive] = useState({});
  const [groupVideo, setGroupVideo] = useState(null);
  const [peerCall, setPeerCall] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [camStatus, setCamStatus] = useState('idle'); // idle | on | error
  const [camError, setCamError] = useState('');
  const previewRef = useRef(null);
  const streamRef = useRef(null);

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
      await warmUpVideoCallMedia();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play().catch(() => {});
      }
      setCamStatus('on');
    } catch (e) {
      setCamStatus('error');
      setCamError(esMsg(e, 'No se pudo activar la cámara web'));
      stopPreview();
    }
  }, [stopPreview]);

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
      setPeerCall((c) => (String(c?.callId) === String(callId) ? null : c));
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

  const liveCount = useMemo(
    () => Object.values(groupVideoLive).filter(Boolean).length,
    [groupVideoLive]
  );

  function openGroupVideo(groupId, groupName) {
    stopPreview();
    setPeerCall(null);
    setGroupVideo({ groupId, groupName: groupName || 'Grupo' });
  }

  async function startVideoCall(person) {
    if (!person?.userId) return;
    try {
      stopPreview();
      setGroupVideo(null);
      await warmUpVideoCallMedia();
      const data = await startPrivateCall(session.token, person.userId, { mode: 'video' });
      setPeerCall({
        callId: data.call?.callId,
        peerId: person.userId,
        peerName: person.name,
        token: data.token,
        authToken: session.token,
        url: data.url,
        e2eeKey: data.e2eeKey,
        role: 'caller',
        mode: 'video',
      });
      setSelectedUser(person);
    } catch (e) {
      setError(esMsg(e.message || e, 'No se pudo iniciar la videollamada'));
    }
  }

  return (
    <div className={`dv-page${groupVideo || peerCall?.mode === 'video' ? ' with-session' : ''}`}>
      <header className="dv-head">
        <div>
          <h1>Video</h1>
          <p className="dv-hint">
            Transmisiones de canal y videollamadas desde la consola ·{' '}
            <span className={live ? 'dv-live-on' : ''}>{live ? 'Tiempo real' : 'Reconectando'}</span>
            {liveCount > 0 ? ` · ${liveCount} canal${liveCount === 1 ? '' : 'es'} en vivo` : ''}
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

      {camStatus === 'on' && !groupVideo && peerCall?.mode !== 'video' ? (
        <div className="dv-cam-preview-wrap">
          <video ref={previewRef} className="dv-cam-preview" muted playsInline autoPlay />
          <span className="dv-cam-preview-label">Cámara web del puesto · vista previa</span>
        </div>
      ) : (
        <video ref={previewRef} className="dv-cam-preview hidden" muted playsInline />
      )}

      {(groupVideo || peerCall?.mode === 'video') && (
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
          {peerCall?.mode === 'video' && (
            <PrivateCallOverlay
              call={peerCall}
              layout="console"
              onHangup={async (opts) => {
                try {
                  if (peerCall.callId && opts?.remote !== true) {
                    await endPrivateCall(session.token, peerCall.callId, 'hangup');
                  }
                } catch {
                  /* ignore */
                }
                setPeerCall(null);
              }}
            />
          )}
        </section>
      )}

      <div className="dv-grid">
        <section className="cc-panel dv-panel">
          <div className="cc-panel-head">
            <div>
              <h2>Canales</h2>
              <p className="cc-hint">Inicia o únete a la transmisión de video del canal (PTT sigue activo)</p>
            </div>
          </div>
          <div className="dv-channel-list">
            {channels.length === 0 && <p className="cc-empty">No hay canales disponibles.</p>}
            {channels.map((ch) => {
              const isLive = Boolean(groupVideoLive[ch.id]);
              const isOpen = groupVideo?.groupId === ch.id;
              return (
                <article key={ch.id} className={`dv-channel${isLive ? ' live' : ''}${isOpen ? ' open' : ''}`}>
                  <div className="dv-channel-meta">
                    <h3>{ch.name}</h3>
                    <span className={isLive ? 'cc-badge air' : 'cc-badge idle'}>
                      {isLive ? 'Video en vivo' : 'Sin transmisión'}
                    </span>
                  </div>
                  <p className="dv-channel-online">
                    {(ch.online || []).length} en línea
                    {ch.speaker ? ` · al aire: ${ch.speaker.displayName}` : ''}
                  </p>
                  <button
                    type="button"
                    className={`cc-btn${isOpen ? '' : ' primary'} cc-group-video-btn${isLive ? ' live' : ''}`}
                    onClick={() => openGroupVideo(ch.id, ch.name)}
                    disabled={isOpen}
                  >
                    {isOpen ? 'En esta transmisión' : isLive ? 'Unirse al video' : 'Iniciar video'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cc-panel dv-panel">
          <div className="cc-panel-head">
            <div>
              <h2>Operadores en línea</h2>
              <p className="cc-hint">Videollamada 1:1 (activa cámara en ambos extremos)</p>
            </div>
          </div>
          <div className="dv-people-list">
            {people.length === 0 && (
              <p className="cc-empty">Nadie en línea en los canales visibles.</p>
            )}
            {people.map((p) => (
              <article
                key={p.userId}
                className={`dv-person${selectedUser?.userId === p.userId ? ' selected' : ''}`}
              >
                <button type="button" className="dv-person-main" onClick={() => setSelectedUser(p)}>
                  <strong>{p.name}</strong>
                  <span>{p.channels.join(' · ')}</span>
                </button>
                <button
                  type="button"
                  className="cc-btn primary"
                  onClick={() => startVideoCall(p)}
                  disabled={peerCall?.peerId === p.userId}
                >
                  Videollamada
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      {!groupVideo && peerCall?.mode !== 'video' && (
        <p className="dv-foot-hint">
          Usa <strong>Activar cámara web</strong> para probar el permiso del navegador en este puesto.
          Al iniciar video de canal o una videollamada, la cámara se usa en la sesión LiveKit.
        </p>
      )}

      {peerCall && peerCall.mode !== 'video' && (
        <PrivateCallOverlay
          call={peerCall}
          layout="overlay"
          onHangup={async (opts) => {
            try {
              if (peerCall.callId && opts?.remote !== true) {
                await endPrivateCall(session.token, peerCall.callId, 'hangup');
              }
            } catch {
              /* ignore */
            }
            setPeerCall(null);
          }}
        />
      )}
    </div>
  );
}
