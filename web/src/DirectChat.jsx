import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  acceptPrivateCall,
  endPrivateCall,
  fetchContacts,
  fetchDmConversations,
  fetchDmMessages,
  sendDmMessage,
  startPrivateCall,
} from './api';
import PrivateCallOverlay from './PrivateCallOverlay';
import {
  notifyDmMessage,
  notifyIncomingCall,
  stopCallRingtone,
  unlockAppNotifyAudio,
} from './appNotify';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ROLE_LABEL = {
  root: 'Superadmin',
  admin: 'Admin',
  dispatcher: 'Despacho',
  operator: 'Operador',
};

function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function roleLabel(role) {
  return ROLE_LABEL[role] || role || '';
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Mensajes 1:1 + iniciar/recibir llamada privada.
 * @param {{ session: object, active?: boolean, embedded?: boolean, onDmToast?: (p: {peerId:string,peerName:string,preview:string}) => void }} props
 */
export default function DirectChat({ session, active = true, embedded = false, onDmToast }) {
  const token = session.token;
  const me = session.user;
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const socketRef = useRef(null);
  const logRef = useRef(null);
  const peerRef = useRef(null);
  const activeRef = useRef(active);
  const onDmToastRef = useRef(onDmToast);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onDmToastRef.current = onDmToast;
  }, [onDmToast]);

  useEffect(() => {
    unlockAppNotifyAudio().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, conv] = await Promise.all([
          fetchContacts(token),
          fetchDmConversations(token),
        ]);
        if (cancelled) return;
        setContacts(c.contacts || []);
        setConversations(conv.conversations || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const socket = io(API_BASE || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('dm:message', (msg) => {
      setMessages((prev) => {
        const withoutLocal = prev.filter(
          (m) =>
            !(
              m._local &&
              (m.clientMsgId === msg.clientMsgId ||
                (msg.clientMsgId && m.id === msg.clientMsgId))
            )
        );
        if (withoutLocal.some((m) => m.id === msg.id)) return withoutLocal;
        const currentPeer = peerRef.current;
        const peerId = msg.senderId === me.id ? msg.recipientId : msg.senderId;
        if (
          currentPeer &&
          (currentPeer.id === msg.senderId ||
            currentPeer.id === msg.recipientId ||
            currentPeer.id === peerId)
        ) {
          return [...withoutLocal, msg];
        }
        return withoutLocal;
      });
    });

    socket.on('dm:error', ({ error: msg, clientMsgId }) => {
      setError(msg || 'Error');
      if (clientMsgId) {
        setMessages((prev) =>
          prev.filter((m) => !(m._local && (m.clientMsgId === clientMsgId || m.id === clientMsgId)))
        );
      }
    });

    socket.on('dm:notify', ({ peerId, peerName, message }) => {
      setConversations((prev) => {
        const rest = prev.filter((c) => c.peerId !== peerId);
        return [
          {
            peerId,
            peerName,
            lastMessage: {
              id: message.id,
              body: message.body,
              type: message.type,
              createdAt: message.createdAt,
              mine: false,
            },
          },
          ...rest,
        ];
      });
      const viewingPeer = peerRef.current?.id === peerId;
      const shown = notifyDmMessage({
        peerId,
        peerName,
        message,
        viewingPeer,
        panelVisible: activeRef.current,
      });
      if (shown) {
        const preview =
          message?.type === 'text'
            ? String(message.body || '').slice(0, 80)
            : message?.type === 'image'
              ? '📷 Imagen'
              : message?.type === 'audio'
                ? '🎤 Audio'
                : message?.type === 'sticker'
                  ? 'Sticker'
                  : 'Nuevo mensaje';
        onDmToastRef.current?.({ peerId, peerName, preview });
      }
    });

    socket.on('dm:typing', ({ peerId, displayName, typing: t }) => {
      if (peerRef.current?.id === peerId) {
        setTyping(t ? `${displayName} escribe…` : '');
      }
    });

    socket.on('call:incoming', (payload) => {
      setIncomingCall(payload);
      notifyIncomingCall({
        callerName: payload?.callerName,
        callId: payload?.callId,
      });
    });

    socket.on('call:accepted', () => {
      stopCallRingtone();
    });

    socket.on('call:ended', ({ callId }) => {
      stopCallRingtone();
      setIncomingCall((c) => (c?.callId === callId ? null : c));
      setActiveCall((c) => (c?.callId === callId ? null : c));
    });

    return () => {
      stopCallRingtone();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, me.id]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  async function openPeer(p) {
    setError('');
    setPeer(p);
    setTyping('');
    try {
      socketRef.current?.emit('dm:join', { peerId: p.id });
      const data = await fetchDmMessages(token, p.id);
      setMessages(data.messages || []);
      setPeer(data.peer || p);
    } catch (e) {
      setError(e.message);
    }
  }

  async function onSend(e) {
    e.preventDefault();
    if (!peer || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    socketRef.current?.emit('dm:typing', { peerId: peer.id, typing: false });
    try {
      if (socketRef.current?.connected) {
        const clientMsgId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`;
        const optimistic = {
          id: clientMsgId,
          clientMsgId,
          _local: true,
          senderId: me.id,
          recipientId: peer.id,
          displayName: me.displayName || 'Tú',
          type: 'text',
          body,
          reactions: [],
          readCount: 0,
          peerCount: 1,
          readFully: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        socketRef.current.emit('dm:send', { peerId: peer.id, body, clientMsgId });
      } else {
        const data = await sendDmMessage(token, peer.id, body);
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function callPeer() {
    if (!peer) return;
    try {
      const data = await startPrivateCall(token, peer.id);
      setActiveCall({
        callId: data.call.callId,
        room: data.call.room,
        token: data.token,
        url: data.url,
        peerName: peer.displayName,
        role: 'caller',
        e2eeKey: data.e2eeKey || null,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function acceptCall() {
    if (!incomingCall) return;
    stopCallRingtone();
    try {
      const data = await acceptPrivateCall(token, incomingCall.callId);
      setIncomingCall(null);
      setActiveCall({
        callId: data.call.callId,
        room: data.call.room,
        token: data.token,
        url: data.url,
        peerName: incomingCall.callerName,
        role: 'callee',
        e2eeKey: data.e2eeKey || null,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function rejectCall() {
    if (!incomingCall) return;
    stopCallRingtone();
    try {
      await endPrivateCall(token, incomingCall.callId, 'reject');
    } catch {
      /* ignore */
    }
    setIncomingCall(null);
  }

  async function hangup() {
    if (!activeCall) return;
    stopCallRingtone();
    try {
      await endPrivateCall(token, activeCall.callId, 'hangup');
    } catch {
      /* ignore */
    }
    setActiveCall(null);
  }

  const recentIds = new Set(conversations.map((c) => c.peerId));
  const otherContacts = contacts.filter((c) => !recentIds.has(c.id));

  return (
    <div className={`dm-layout${embedded ? ' embedded' : ''}`}>
      <aside className="dm-sidebar">
        <header className="dm-sidebar-head">
          <h3>Directos</h3>
          <p>Mensajes y llamadas 1:1</p>
        </header>

        {conversations.length > 0 && (
          <div className="dm-section">
            <p className="dm-label">Recientes</p>
            <div className="dm-list">
              {conversations.map((c) => (
                <button
                  key={c.peerId}
                  type="button"
                  className={`dm-contact${peer?.id === c.peerId ? ' active' : ''}`}
                  onClick={() =>
                    openPeer({
                      id: c.peerId,
                      displayName: c.peerName,
                      email: c.peerEmail,
                    })
                  }
                >
                  <span className="dm-avatar" aria-hidden="true">
                    {initials(c.peerName)}
                  </span>
                  <span className="dm-contact-text">
                    <strong>{c.peerName}</strong>
                    <span>{c.lastMessage?.body || c.lastMessage?.type || 'Conversación'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="dm-section">
          <p className="dm-label">Contactos</p>
          <div className="dm-list">
            {(conversations.length ? otherContacts : contacts).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`dm-contact${peer?.id === c.id ? ' active' : ''}`}
                onClick={() => openPeer(c)}
              >
                <span className="dm-avatar" aria-hidden="true">
                  {initials(c.displayName)}
                </span>
                <span className="dm-contact-text">
                  <strong>{c.displayName}</strong>
                  <span>{roleLabel(c.role)}</span>
                </span>
              </button>
            ))}
            {contacts.length === 0 && <p className="dm-empty-side">Sin contactos en la organización</p>}
            {contacts.length > 0 && conversations.length > 0 && otherContacts.length === 0 && (
              <p className="dm-empty-side">Todos están en recientes</p>
            )}
          </div>
        </div>
      </aside>

      <section className="dm-chat">
        {!peer ? (
          <div className="dm-empty">
            <div className="dm-empty-icon" aria-hidden="true">
              ✉
            </div>
            <h2>Mensajes directos</h2>
            <p>Elige un contacto a la izquierda para escribir o iniciar una llamada privada.</p>
            <p className="muted">El PTT por canal sigue en la pestaña «Canal / grupo».</p>
          </div>
        ) : (
          <>
            <header className="dm-header">
              <div className="dm-header-person">
                <span className="dm-avatar dm-avatar-lg" aria-hidden="true">
                  {initials(peer.displayName)}
                </span>
                <div>
                  <h2>{peer.displayName}</h2>
                  <p className="dm-header-meta">
                    {typing ||
                      [peer.username, roleLabel(peer.role)].filter(Boolean).join(' · ') ||
                      peer.email ||
                      'Chat privado'}
                  </p>
                </div>
              </div>
              <button type="button" className="btn primary dm-call-btn" onClick={callPeer}>
                Llamar
              </button>
            </header>

            {error && <p className="error dm-error">{error}</p>}

            <div className="dm-log" ref={logRef}>
              {messages.length === 0 ? (
                <div className="dm-log-empty">
                  <p>Sin mensajes todavía</p>
                  <p className="muted">Escribe el primero o inicia una llamada.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === me.id;
                  return (
                    <div key={m.id} className={`dm-bubble${mine ? ' mine' : ''}`}>
                      {!mine && <small>{m.displayName}</small>}
                      <p>{m.isDeleted ? 'Mensaje eliminado' : m.body || m.mediaName || m.type}</p>
                      <time>{formatTime(m.createdAt)}</time>
                    </div>
                  );
                })
              )}
            </div>

            <form className="dm-compose" onSubmit={onSend}>
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  socketRef.current?.emit('dm:typing', {
                    peerId: peer.id,
                    typing: e.target.value.trim().length > 0,
                  });
                }}
                placeholder="Escribe un mensaje…"
                aria-label="Mensaje privado"
              />
              <button type="submit" className="btn primary" disabled={!draft.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </section>

      {incomingCall && (
        <div className="incoming-call-screen" role="dialog" aria-modal="true" aria-label="Llamada entrante">
          <p className="incoming-call-kicker">Llamada de voz entrante</p>
          <div className="incoming-call-avatar-wrap" aria-hidden="true">
            <span className="incoming-call-ring" />
            <span className="incoming-call-ring delay" />
            <span className="incoming-call-avatar">{initials(incomingCall.callerName)}</span>
          </div>
          <h2 className="incoming-call-name">{incomingCall.callerName}</h2>
          <p className="incoming-call-hint">Pulsa para contestar</p>
          <div className="incoming-call-actions">
            <button type="button" className="incoming-call-btn reject" onClick={rejectCall}>
              <span className="incoming-call-ico" aria-hidden="true">
                ✕
              </span>
              Rechazar
            </button>
            <button type="button" className="incoming-call-btn accept" onClick={acceptCall}>
              <span className="incoming-call-ico" aria-hidden="true">
                ☎
              </span>
              Contestar
            </button>
          </div>
        </div>
      )}

      {activeCall && <PrivateCallOverlay call={activeCall} onHangup={hangup} />}
    </div>
  );
}
