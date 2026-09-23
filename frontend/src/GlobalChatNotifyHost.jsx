import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { canDispatch } from './api';
import { unlockAppNotifyAudio } from './appNotify';
import { subscribeChatMessageToast } from './chatNotify';
import { openChatsPanel } from './chatsPanel';

/**
 * Globo de mensaje en cualquier ruta (Radio, Despacho, Seguimiento, Config…).
 */
export default function GlobalChatNotifyHost({ session }) {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const toastRef = useRef(null);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const dismissTimer = useCallback((ms) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast(null);
      pendingRef.current = null;
    }, ms);
  }, []);

  const presentToast = useCallback(
    (payload) => {
      if (!payload) return;
      if (document.hidden) {
        pendingRef.current = payload;
      }
      setToast(payload);
      dismissTimer(document.hidden ? 30000 : 9000);
    },
    [dismissTimer]
  );

  useEffect(() => {
    return subscribeChatMessageToast(presentToast);
  }, [presentToast]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden || !pendingRef.current) return;
      const p = pendingRef.current;
      pendingRef.current = null;
      setToast(p);
      dismissTimer(10000);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [dismissTimer]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  useEffect(() => {
    unlockAppNotifyAudio().catch(() => {});
  }, []);

  function openToast() {
    const t = toastRef.current;
    if (!t || !session?.user) return;
    setToast(null);
    pendingRef.current = null;
    if (canDispatch(session.user)) {
      if (t.kind === 'dm' && t.peerId) {
        openChatsPanel({ peerId: t.peerId });
      } else if (t.kind === 'group') {
        openChatsPanel({ groupId: t.groupId || t.peerId });
      } else {
        openChatsPanel();
      }
      return;
    }
    if (t.kind === 'dm' && t.peerId) {
      navigate('/radio', { state: { focusPeerId: t.peerId } });
    } else if (t.kind === 'group') {
      const gid = t.groupId || t.peerId;
      navigate('/radio', { state: { focusGroupId: gid } });
    }
  }

  if (!session?.token || !toast) return null;

  return createPortal(
    <button type="button" className="wa-banner-toast wa-banner-toast--global" onClick={openToast}>
      <span className="wa-banner-toast-avatar" aria-hidden="true">
        {(toast.title || toast.peerName || '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="wa-banner-toast-body">
        <strong>{toast.title || toast.peerName || 'Mensaje'}</strong>
        <span>{toast.preview}</span>
      </span>
    </button>,
    document.body
  );
}
