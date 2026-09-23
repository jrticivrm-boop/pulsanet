import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { ackAnnouncement, fetchPendingAnnouncements } from '../api';
import { unlockAppNotifyAudio, playMessageTone } from '../appNotify';
import { socketIoOptions, socketUrl } from '../socketConfig';

/**
 * Aviso crítico global: modal obligatorio hasta Enterado (no es chat).
 */
export default function GlobalAnnouncementHost({ session }) {
  const [queue, setQueue] = useState([]);
  const [acking, setAcking] = useState(false);
  const seenRef = useRef(new Set());

  const pushAlert = useCallback((item) => {
    if (!item?.id || !item?.body) return;
    if (seenRef.current.has(item.id)) return;
    seenRef.current.add(item.id);
    setQueue((prev) => {
      if (prev.some((p) => p.id === item.id)) return prev;
      return [...prev, item];
    });
    unlockAppNotifyAudio().catch(() => {});
    playMessageTone({ soft: false }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    let cancelled = false;
    fetchPendingAnnouncements(session.token)
      .then((data) => {
        if (cancelled) return;
        for (const a of data.announcements || []) pushAlert(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.token, pushAlert]);

  useEffect(() => {
    if (!session?.token) return undefined;
    const socket = io(socketUrl(), {
      ...socketIoOptions,
      auth: { token: session.token },
    });
    const onAlert = (payload) => {
      pushAlert({
        id: payload.id,
        body: payload.body,
        createdBy: payload.createdBy,
        createdAt: payload.createdAt,
        audienceLabel: payload.audienceLabel,
      });
    };
    socket.on('announcement:alert', onAlert);
    socket.connect();
    return () => {
      socket.off('announcement:alert', onAlert);
      socket.disconnect();
    };
  }, [session?.token, pushAlert]);

  const current = queue[0] || null;

  async function onAck() {
    if (!current || acking) return;
    setAcking(true);
    try {
      await ackAnnouncement(session.token, current.id);
      setQueue((prev) => prev.filter((p) => p.id !== current.id));
    } catch {
      /* keep visible */
    } finally {
      setAcking(false);
    }
  }

  if (!current) return null;

  return createPortal(
    <div className="cc-announce-overlay" role="alertdialog" aria-modal="true" aria-labelledby="cc-announce-title">
      <div className="cc-announce-modal">
        <header className="cc-announce-head">
          <h2 id="cc-announce-title">AVISO</h2>
          {current.createdBy ? <p className="cc-announce-from">{current.createdBy}</p> : null}
        </header>
        <div className="cc-announce-body">
          <p>{current.body}</p>
        </div>
        <footer className="cc-announce-actions">
          <button type="button" className="cc-btn primary" disabled={acking} onClick={onAck}>
            {acking ? '…' : 'Enterado'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
