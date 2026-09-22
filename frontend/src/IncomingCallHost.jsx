import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { acceptPrivateCall, endPrivateCall } from './api';
import { notifyIncomingCall, stopCallRingtone } from './appNotify';
import { warmUpVideoCallMedia } from './callMedia';
import { esMsg } from './esMsg';
import PersonAvatar from './PersonAvatar';
import PrivateCallOverlay from './PrivateCallOverlay';
import { socketIoOptions, socketUrl } from './socketConfig';

/**
 * Banner global de llamada entrante (arriba/costado) + overlay al contestar.
 * Funciona en cualquier ruta sin abrir el panel de chat.
 */
export default function IncomingCallHost({ session }) {
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError] = useState('');
  const incomingRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  useEffect(() => {
    activeRef.current = activeCall;
  }, [activeCall]);

  const clearIncoming = useCallback(() => {
    stopCallRingtone();
    setIncoming(null);
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    const token = session.token;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token } });

    const onIncoming = (payload) => {
      if (!payload?.callId) return;
      if (payload.mode === 'radio') {
        void endPrivateCall(token, payload.callId, 'reject').catch(() => {});
        return;
      }
      if (activeRef.current?.callId) return;
      setIncoming(payload);
      setError('');
      notifyIncomingCall({
        callerName: payload?.callerName,
        callId: payload?.callId,
        mode: payload?.mode,
      });
    };

    const onEnded = ({ callId }) => {
      if (!callId) return;
      if (String(incomingRef.current?.callId) === String(callId)) {
        clearIncoming();
      }
      if (String(activeRef.current?.callId) === String(callId)) {
        setActiveCall(null);
      }
    };

    const onAccepted = () => {
      stopCallRingtone();
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:ended', onEnded);
    socket.on('call:accepted', onAccepted);
    socket.connect();

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:ended', onEnded);
      socket.off('call:accepted', onAccepted);
      socket.disconnect();
      stopCallRingtone();
    };
  }, [session?.token, clearIncoming]);

  useEffect(() => {
    if (!incoming) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      const cur = incomingRef.current;
      if (!cur || !session?.token) return;
      stopCallRingtone();
      void endPrivateCall(session.token, cur.callId, 'reject').catch(() => {});
      setIncoming(null);
      setError('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [incoming, session?.token]);

  async function acceptCall() {
    if (!incoming || !session?.token) return;
    const token = session.token;
    const mode = incoming.mode === 'video' ? 'video' : 'call';
    stopCallRingtone();
    try {
      if (mode === 'video') {
        await warmUpVideoCallMedia();
      }
      const data = await acceptPrivateCall(token, incoming.callId);
      setIncoming(null);
      setActiveCall({
        callId: data.call.callId,
        peerId: incoming.callerId,
        room: data.call.room,
        token: data.token,
        authToken: token,
        url: data.url,
        peerName: incoming.callerName,
        peerAvatarUrl: incoming.callerAvatarUrl || null,
        role: 'callee',
        e2eeKey: data.e2eeKey || null,
        e2ee: Boolean(data.e2ee),
        mode,
        intent: incoming.intent || null,
      });
    } catch (e) {
      setError(esMsg(e.message, 'No se pudo contestar'));
    }
  }

  async function rejectCall() {
    if (!incoming || !session?.token) return;
    stopCallRingtone();
    try {
      await endPrivateCall(session.token, incoming.callId, 'reject');
    } catch {
      /* ignore */
    }
    setIncoming(null);
    setError('');
  }

  async function hangup(opts = {}) {
    if (!activeCall) return;
    stopCallRingtone();
    if (opts?.remote !== true) {
      try {
        await endPrivateCall(session.token, activeCall.callId, 'hangup');
      } catch {
        /* ignore */
      }
    }
    setActiveCall(null);
  }

  const banner =
    incoming &&
    createPortal(
      <div
        className="incoming-call-banner"
        role="dialog"
        aria-modal="false"
        aria-label="Llamada entrante"
      >
        <div className="incoming-call-banner-avatar">
          <PersonAvatar
            userId={incoming.callerId}
            name={incoming.callerName}
            avatarUrl={incoming.callerAvatarUrl}
            token={session.token}
            className="incoming-call-banner-photo"
          />
          <span className="incoming-call-banner-pulse" aria-hidden="true" />
        </div>
        <div className="incoming-call-banner-text">
          <strong>{incoming.callerName || 'Usuario'}</strong>
          <span>
            {incoming.mode === 'video' ? 'Videollamada entrante' : 'Llamada de voz entrante'}
          </span>
          {error ? <small className="incoming-call-banner-err">{error}</small> : null}
        </div>
        <div className="incoming-call-banner-actions">
          <button type="button" className="incoming-call-banner-btn reject" onClick={rejectCall}>
            Rechazar
          </button>
          <button type="button" className="incoming-call-banner-btn accept" onClick={acceptCall}>
            Contestar
          </button>
        </div>
      </div>,
      document.body
    );

  const overlay =
    activeCall &&
    createPortal(<PrivateCallOverlay call={activeCall} onHangup={hangup} />, document.body);

  return (
    <>
      {banner}
      {overlay}
    </>
  );
}
