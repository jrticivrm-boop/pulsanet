import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { canDispatch } from './api';
import { notifyIncomingGroupVideo, stopCallRingtone } from './appNotify';
import { socketIoOptions, socketUrl } from './socketConfig';

/**
 * Invitación global a transmisión grupal (socket user:* + tono de llamada).
 */
export default function GroupVideoIncomingHost({ session }) {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const incomingRef = useRef(null);

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  const dismiss = useCallback(() => {
    stopCallRingtone();
    setIncoming(null);
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token: session.token } });

    const onIncoming = (payload) => {
      if (!payload?.groupId) return;
      setIncoming(payload);
      notifyIncomingGroupVideo({
        groupId: payload.groupId,
        groupName: payload.groupName,
        startedByName: payload.startedByName || payload.displayName,
      });
    };

    const onEnded = (payload) => {
      const gid = payload?.groupId;
      if (!gid) return;
      if (String(incomingRef.current?.groupId) === String(gid)) {
        stopCallRingtone();
        setIncoming(null);
      }
    };

    socket.on('group:video_incoming', onIncoming);
    socket.on('group:video_ended', onEnded);
    socket.connect();

    return () => {
      socket.off('group:video_incoming', onIncoming);
      socket.off('group:video_ended', onEnded);
      socket.disconnect();
      stopCallRingtone();
    };
  }, [session?.token]);

  const accept = useCallback(() => {
    if (!incoming?.groupId) return;
    stopCallRingtone();
    const gid = incoming.groupId;
    const gname = incoming.groupName;
    setIncoming(null);
    window.dispatchEvent(
      new CustomEvent('tacticalptx:open-group-video', {
        detail: { groupId: gid, groupName: gname },
      })
    );
    const radioPath = canDispatch(session.user) ? '/despacho/radio' : '/radio';
    navigate(radioPath, { replace: true, state: { focusGroupId: gid } });
  }, [incoming, navigate, session?.user]);

  if (!incoming) return null;

  const who = incoming.startedByName || incoming.displayName || 'Un operador';
  const groupName = incoming.groupName || 'Grupo';

  return createPortal(
    <div className="incoming-call-screen" role="dialog" aria-modal="true" aria-label="Transmisión grupal">
      <p className="incoming-call-kicker">TRANSMISIÓN GRUPAL</p>
      <div className="incoming-call-avatar-wrap" aria-hidden="true">
        <span className="incoming-call-ring" />
        <span className="incoming-call-ring delay" />
        <span className="incoming-call-avatar">📹</span>
      </div>
      <h2 className="incoming-call-name">{groupName}</h2>
      <p className="incoming-call-hint">{who} inició video en vivo · pulsa Unirse</p>
      <div className="incoming-call-actions">
        <button type="button" className="incoming-call-btn reject" onClick={dismiss}>
          <span className="incoming-call-ico" aria-hidden="true">
            ✕
          </span>
          Ignorar
        </button>
        <button type="button" className="incoming-call-btn accept" onClick={accept}>
          <span className="incoming-call-ico" aria-hidden="true">
            ▶
          </span>
          Unirse
        </button>
      </div>
    </div>,
    document.body
  );
}
