import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { acceptPrivateCall, endPrivateCall, joinPrivateCall, declinePrivateCallInvite, leavePrivateCall, startPrivateCall } from './api';
import { notifyIncomingCall, stopCallRingtone } from './appNotify';
import { warmUpVideoCallMedia } from './callMedia';
import { esMsg } from './esMsg';
import PersonAvatar from './PersonAvatar';
import PrivateCallOverlay from './PrivateCallOverlay';
import { PEER_EVENTS, publishCallActive } from './peerActions';
import { socketIoOptions, socketUrl } from './socketConfig';

/**
 * Host global de llamadas privadas: entrantes + salientes (voz/video/ver cámara 1:1).
 * Ver cámara multi-slot en Despacho sigue gestionándose en CommandCenter/DispatchVideo.
 */
export default function PrivateCallHost({ session }) {
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const incomingRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  useEffect(() => {
    activeRef.current = activeCall;
    publishCallActive(activeCall);
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
      // remote_camera silenciosa: la UI del dispositivo la maneja en móvil; en web banner si aplica
      if (activeRef.current?.callId) return;
      setIncoming({ ...payload, isInvite: false });
      setError('');
      if (payload?.intent !== 'remote_camera') {
        notifyIncomingCall({
          callerName: payload?.callerName,
          callId: payload?.callId,
          mode: payload?.mode,
        });
      }
    };

    const onInvite = (payload) => {
      if (!payload?.callId) return;
      if (activeRef.current?.callId) return;
      const callerId = payload.invitedBy || payload.callerId;
      const callerName = payload.invitedByName || payload.callerName || 'Usuario';
      setIncoming({
        ...payload,
        callerId,
        callerName,
        isInvite: true,
        mode: payload.mode === 'video' ? 'video' : payload.mode || 'call',
      });
      setError('');
      notifyIncomingCall({
        callerName,
        callId: payload.callId,
        mode: payload.mode,
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
    socket.on('call:invite', onInvite);
    socket.on('call:ended', onEnded);
    socket.on('call:accepted', onAccepted);
    socket.connect();

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:invite', onInvite);
      socket.off('call:ended', onEnded);
      socket.off('call:accepted', onAccepted);
      socket.disconnect();
      stopCallRingtone();
    };
  }, [session?.token, clearIncoming]);

  useEffect(() => {
    if (!session?.token) return undefined;

    const onStart = async (e) => {
      const peer = e.detail?.peer;
      const mode = e.detail?.mode === 'video' ? 'video' : 'call';
      const intent = e.detail?.intent || null;
      if (!peer?.id) return;
      // Multi-monitor despacho: CommandCenter / DispatchVideo pueden marcar handled.
      // Si handled, no abrir overlay 1:1 (evita doble llamada).
      if (intent === 'remote_camera') {
        const detail = { peer, mode: 'video', intent, handled: false };
        window.dispatchEvent(new CustomEvent('tacticalptx:dispatch-remote-camera', { detail }));
        if (detail.handled === true) return;
        await beginOutbound(peer, 'video', 'remote_camera');
        return;
      }
      await beginOutbound(peer, mode, null);
    };

    async function beginOutbound(peer, mode, intent) {
      if (busy || activeRef.current?.callId) {
        setError('Ya hay una llamada en curso');
        return;
      }
      setBusy(true);
      setError('');
      try {
        if (mode === 'video') await warmUpVideoCallMedia();
        const data = await startPrivateCall(session.token, peer.id, {
          mode,
          intent: intent || undefined,
        });
        setActiveCall({
          callId: data.call?.callId,
          peerId: peer.id,
          peerName: peer.displayName || 'Usuario',
          room: data.call?.room,
          token: data.token,
          authToken: session.token,
          userId: session.user?.id,
          url: data.url,
          e2eeKey: data.e2eeKey || null,
          e2ee: Boolean(data.e2ee),
          role: 'caller',
          mode,
          intent: intent || data.call?.intent || null,
        });
      } catch (err) {
        setError(esMsg(err.message, 'No se pudo iniciar la llamada'));
        window.setTimeout(() => setError(''), 4000);
      } finally {
        setBusy(false);
      }
    }

    window.addEventListener(PEER_EVENTS.START_CALL, onStart);
    return () => window.removeEventListener(PEER_EVENTS.START_CALL, onStart);
  }, [session?.token, busy]);

  useEffect(() => {
    if (!incoming) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      const cur = incomingRef.current;
      if (!cur || !session?.token) return;
      stopCallRingtone();
      if (cur.isInvite) {
        void declinePrivateCallInvite(session.token, cur.callId).catch(() => {});
      } else {
        void endPrivateCall(session.token, cur.callId, 'reject').catch(() => {});
      }
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
      if (mode === 'video') await warmUpVideoCallMedia();
      const data = incoming.isInvite
        ? await joinPrivateCall(token, incoming.callId)
        : await acceptPrivateCall(token, incoming.callId);
      setIncoming(null);
      setActiveCall({
        callId: data.call.callId,
        peerId: incoming.callerId,
        room: data.call.room,
        token: data.token,
        authToken: token,
        userId: session.user?.id,
        url: data.url,
        peerName: incoming.callerName,
        role: incoming.isInvite ? 'guest' : 'callee',
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
      if (incoming.isInvite) {
        await declinePrivateCallInvite(session.token, incoming.callId);
      } else {
        await endPrivateCall(session.token, incoming.callId, 'reject');
      }
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
        await leavePrivateCall(session.token, activeCall.callId);
      } catch {
        try {
          await endPrivateCall(session.token, activeCall.callId, 'hangup');
        } catch {
          /* ignore */
        }
      }
    }
    setActiveCall(null);
  }

  const banner =
    incoming &&
    incoming.intent !== 'remote_camera' &&
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
            token={session.token}
            className="incoming-call-banner-photo"
          />
          <span className="incoming-call-banner-pulse" aria-hidden="true" />
        </div>
        <div className="incoming-call-banner-text">
          <strong>{incoming.callerName || 'Usuario'}</strong>
          <span>
            {incoming.isInvite
              ? incoming.mode === 'video'
                ? 'Te agregan a videollamada'
                : 'Te agregan a llamada'
              : incoming.mode === 'video'
                ? 'Videollamada entrante'
                : 'Llamada de voz entrante'}
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

  const toastErr =
    error &&
    !incoming &&
    createPortal(
      <div className="peer-call-toast-err" role="status">
        {error}
      </div>,
      document.body
    );

  return (
    <>
      {banner}
      {overlay}
      {toastErr}
    </>
  );
}
