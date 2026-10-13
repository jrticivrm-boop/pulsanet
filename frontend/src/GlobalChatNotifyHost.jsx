import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { canDispatch } from './api';
import { unlockAppNotifyAudio } from './appNotify';
import { subscribeChatMessageToast } from './chatNotify';
import { openChatsPanel } from './chatsPanel';
import PersonAvatar from './PersonAvatar';
import {
  NOTICE_KIND_LABEL,
  bindNoticeOwner,
  markConversationNoticesRead,
  markNoticeRead,
  noticeTimeLabel,
  pushNotice,
  subscribeNoticeToasts,
} from './notifyCenter';
import NoticeIcon from './NoticeIcon.jsx';
import NotifyBell from './NotifyBell.jsx';

const MAX_VISIBLE = 3;
const TOAST_MS = 9000;
const TOAST_HIDDEN_MS = 30000;
const STICKY_KINDS = new Set(['panic']);

/**
 * Avisos en cualquier ruta (Radio, Despacho, Config…): tarjetas apiladas con foto,
 * canal, tipo y hora; la campana guarda el historial.
 */
export default function GlobalChatNotifyHost({ session }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const pausedRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    bindNoticeOwner(session?.user?.id || null);
  }, [session?.user?.id]);

  const dismiss = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) window.clearTimeout(t.handle);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback(
    (id, ms) => {
      const prev = timersRef.current.get(id);
      if (prev) window.clearTimeout(prev.handle);
      const handle = window.setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, { handle, endsAt: Date.now() + ms, left: ms });
    },
    [dismiss]
  );

  const present = useCallback(
    (item) => {
      if (!item) return;
      setToasts((prev) => [item, ...prev.filter((x) => x.dedupeKey !== item.dedupeKey || !item.dedupeKey)].slice(0, 12));
      if (!STICKY_KINDS.has(item.kind)) {
        arm(item.id, document.hidden ? TOAST_HIDDEN_MS : TOAST_MS);
      }
    },
    [arm]
  );

  useEffect(() => subscribeNoticeToasts(present), [present]);

  /* Mensajes (DM / canal) llegan por chatNotify: se registran en la campana. */
  useEffect(
    () =>
      subscribeChatMessageToast((payload) => {
        if (!payload?.kind) return;
        const isGroup = payload.kind === 'group';
        pushNotice({
          kind: isGroup ? 'group' : 'dm',
          title: isGroup ? payload.peerName || 'Operador' : payload.title || payload.peerName || 'Mensaje',
          body: payload.preview || '',
          groupId: isGroup ? payload.groupId || payload.peerId : undefined,
          groupName: isGroup ? payload.title : undefined,
          peerId: isGroup ? undefined : payload.peerId,
          userId: payload.senderId || (isGroup ? undefined : payload.peerId),
          msgType: payload.msgType,
        });
      }),
    []
  );

  /* Pausa del temporizador al pasar el mouse (se puede leer con calma). */
  const pauseAll = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    const t0 = Date.now();
    for (const [id, t] of timersRef.current) {
      window.clearTimeout(t.handle);
      timersRef.current.set(id, { ...t, handle: null, left: Math.max(1500, t.endsAt - t0) });
    }
  }, []);

  const resumeAll = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    for (const [id, t] of timersRef.current) arm(id, t.left);
  }, [arm]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return;
      // Al volver a la pestaña: dar tiempo de leer lo que llegó mientras no se veía.
      for (const id of timersRef.current.keys()) arm(id, TOAST_MS);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [arm]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [toasts.length]);

  useEffect(
    () => () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t.handle);
      timersRef.current.clear();
    },
    []
  );

  useEffect(() => {
    unlockAppNotifyAudio().catch(() => {});
  }, []);

  const openNotice = useCallback(
    (t) => {
      if (!t || !session?.user) return;
      markNoticeRead(t.id);
      dismiss(t.id);
      const isDm = t.kind === 'dm' || t.kind === 'missed_call';
      const gid = t.groupId;
      if (t.kind === 'dm' || t.kind === 'group') {
        markConversationNoticesRead({ peerId: isDm ? t.peerId : null, groupId: gid });
      }
      if (t.route && (canDispatch(session.user) || !t.route.startsWith('/despacho'))) {
        navigate(t.route);
        return;
      }
      if (canDispatch(session.user)) {
        if (isDm && t.peerId) openChatsPanel({ peerId: t.peerId });
        else if (t.kind === 'group' && gid) openChatsPanel({ groupId: gid });
        else openChatsPanel();
        return;
      }
      if (isDm && t.peerId) navigate('/radio', { state: { focusPeerId: t.peerId } });
      else if (gid) navigate('/radio', { state: { focusGroupId: gid } });
    },
    [dismiss, navigate, session?.user]
  );

  if (!session?.token) return null;

  const visible = toasts.slice(0, MAX_VISIBLE);
  const hiddenCount = toasts.length - visible.length;

  return (
    <>
      <NotifyBell session={session} onOpenNotice={openNotice} />
      {toasts.length
        ? createPortal(
            <div
              className="nt-stack"
              aria-live="polite"
              aria-relevant="additions"
              onMouseEnter={pauseAll}
              onMouseLeave={resumeAll}
            >
              {visible.map((t) => {
                const sticky = STICKY_KINDS.has(t.kind);
                const timer = timersRef.current.get(t.id);
                const dur = document.hidden ? TOAST_HIDDEN_MS : TOAST_MS;
                const meta =
                  t.kind === 'group'
                    ? t.groupName || 'Canal'
                    : NOTICE_KIND_LABEL[t.kind] || 'Aviso';
                return (
                  <div key={t.id} className={`nt-card nt-card--${t.kind}`} role="status">
                    <button type="button" className="nt-card-main" onClick={() => openNotice(t)}>
                      <span className="nt-card-avatar">
                        {t.userId && (t.kind === 'dm' || t.kind === 'group' || t.kind === 'missed_call') ? (
                          <PersonAvatar
                            userId={t.userId}
                            name={t.title}
                            token={session.token}
                            className="nt-card-avatar-img"
                          />
                        ) : (
                          <span className="nt-card-avatar-ico">
                            <NoticeIcon kind={t.kind} msgType={t.msgType} />
                          </span>
                        )}
                        <span className="nt-card-kind" aria-hidden="true">
                          <NoticeIcon kind={t.kind} msgType={t.msgType} />
                        </span>
                      </span>
                      <span className="nt-card-text">
                        <span className="nt-card-meta">
                          <span className="nt-card-chip">{meta}</span>
                          <span className="nt-card-time">{noticeTimeLabel(t.at, now)}</span>
                        </span>
                        <strong className="nt-card-title">{t.title}</strong>
                        {t.body ? <span className="nt-card-body">{t.body}</span> : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="nt-card-close"
                      aria-label="Cerrar aviso"
                      onClick={() => dismiss(t.id)}
                    >
                      ×
                    </button>
                    {!sticky && timer ? (
                      <span
                        className="nt-card-progress"
                        style={{ animationDuration: `${dur}ms` }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                );
              })}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  className="nt-more"
                  onClick={() => {
                    for (const t of toasts.slice(MAX_VISIBLE)) dismiss(t.id);
                  }}
                >
                  +{hiddenCount} más · descartar
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
