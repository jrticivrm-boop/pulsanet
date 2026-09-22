import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { playGeofenceBellTone, unlockAppNotifyAudio } from '../appNotify.js';
import { socketIoOptions, socketUrl } from '../socketConfig';
import { sessionWireKey, socketWireKey, unwrapDispatchPayload, applyDispatchJoinedWire } from '../wireCrypto.js';

const SOCKET_URL = socketUrl();
const TOAST_MS = 7000;

/**
 * Toast flotante + campanita al enter/exit de geocerca (consola despacho).
 */
export default function DispatchGeofenceToastHost({ session }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    if (!session?.token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      ...socketIoOptions,
    });

    const offWire = applyDispatchJoinedWire(socket);
    socket.on('connect', () => {
      socket.emit('dispatch:join');
    });
    socket.on('reconnect', () => {
      socket.emit('dispatch:join');
    });

    socket.on('dispatch:geofence', (raw) => {
      void (async () => {
        const g = await unwrapDispatchPayload(
          raw,
          socketWireKey(socket, session) || sessionWireKey(session)
        );
        if (!g?.event || !g?.name) return;
        const entra = g.event === 'enter';
        const id = `${g.geofenceId || 'g'}-${g.userId || 'u'}-${g.at || Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const title = entra ? 'Entró a zona' : 'Salió de zona';
        const body = `${g.displayName || 'Operador'} · «${g.name}»`;
        unlockAppNotifyAudio().catch(() => {});
        playGeofenceBellTone({ soft: Boolean(document.hidden) });
        setToasts((prev) => [{ id, title, body, event: g.event }, ...prev].slice(0, 4));
        const t = window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
          timersRef.current.delete(id);
        }, TOAST_MS);
        timersRef.current.set(id, t);
      })();
    });

    return () => {
      try {
        offWire?.();
      } catch {
        /* ignore */
      }
      socket.disconnect();
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };
  }, [session?.token]);

  function dismiss(id) {
    const t = timersRef.current.get(id);
    if (t) window.clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  if (!toasts.length) return null;

  return createPortal(
    <div className="cc-geofence-toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cc-geofence-toast${t.event === 'enter' ? ' is-enter' : ' is-exit'}`}
          role="status"
        >
          <div className="cc-geofence-toast-text">
            <strong>{t.title}</strong>
            <span>{t.body}</span>
          </div>
          <button
            type="button"
            className="cc-geofence-toast-close"
            aria-label="Cerrar"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
