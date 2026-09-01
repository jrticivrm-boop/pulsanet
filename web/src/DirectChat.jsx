import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import {
  acceptPrivateCall,
  endPrivateCall,
  fetchContacts,
  fetchDmConversations,
  fetchDmMessages,
  markDmRead,
  sendDmMessage,
  sendDmSticker,
  startPrivateCall,
  uploadDmMedia,
} from './api';
import ChatMedia from './ChatMedia';
import PrivateCallOverlay from './PrivateCallOverlay';
import PrivateRadioBar from './PrivateRadioBar';
import ImageGalleryLightbox, { collectImageMessages } from './ImageGalleryLightbox';
import {
  notifyDmMessage,
  notifyIncomingCall,
  playMessageTone,
  stopCallRingtone,
  unlockAppNotifyAudio,
} from './appNotify';
import { isViewingChat, showChatMessageToast } from './chatNotify';
import { esMsg } from './esMsg';
import LinkifiedText from './LinkifiedText';
import MediaComposerModal from './MediaComposerModal';
import { classifyUploadFile, DOC_ACCEPT, VIDEO_ACCEPT } from './mediaKind';
import { filesFromClipboard, isImageFile } from './mediaComposerUtils';
import { socketIoOptions, socketUrl } from './socketConfig';
import StarIcon from './StarIcon';
import WaEmojiPicker from './WaEmojiPicker';
import PersonAvatar from './PersonAvatar';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = socketUrl();

const ROLE_LABEL = {
  root: 'Superadmin',
  admin: 'Admin',
  zone_admin: 'Admin zona',
  dispatcher: 'Despacho',
  operator: 'Operador',
};

/** Unicode explícito — evita mojibake (âœ") si el archivo se guarda sin UTF-8. */
const ICON = {
  envelope: '\u2709',
  tick: '\u2713',
  ticks: '\u2713\u2713',
  send: '\u27A4',
  reject: '\u2715',
  phone: '\u260E',
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
 * @param {{ session: object, active?: boolean, visiblePeerId?: string|null, embedded?: boolean, hideSidebar?: boolean, openPeerId?: string|null, onInboxMeta?: Function, onUnread?: Function, onPeerOpened?: Function, favorite?: boolean, onToggleFavorite?: Function, onDmToast?: Function }} props
 */
export default function DirectChat({
  session,
  active = true,
  visiblePeerId = null,
  embedded = false,
  hideSidebar = false,
  openPeerId = null,
  onInboxMeta,
  onUnread,
  onPeerOpened,
  favorite = false,
  onToggleFavorite,
  onDmToast,
}) {
  const token = session.token;
  const me = session.user;
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [mediaComposer, setMediaComposer] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [activeRadio, setActiveRadio] = useState(null);
  const [imageGallery, setImageGallery] = useState(null);
  const radioBarRef = useRef(null);
  const radioStartingRef = useRef(false);

  function openImageGallery(m) {
    const items = collectImageMessages(messages);
    let idx = items.findIndex((x) => x.id === m?.id);
    if (idx < 0) idx = items.findIndex((x) => x.mediaUrl === m?.mediaUrl);
    if (idx < 0) idx = 0;
    setImageGallery({ items: items.length ? items : m ? [m] : [], index: idx });
  }
  const socketRef = useRef(null);
  const logRef = useRef(null);
  const peerRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const activeRef = useRef(active);
  const visiblePeerIdRef = useRef(visiblePeerId);
  const onDmToastRef = useRef(onDmToast);
  const onUnreadRef = useRef(onUnread);
  const onPeerOpenedRef = useRef(onPeerOpened);
  const onInboxMetaRef = useRef(onInboxMeta);
  const openPeerFnRef = useRef(null);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    visiblePeerIdRef.current = visiblePeerId;
  }, [visiblePeerId]);
  useEffect(() => {
    onDmToastRef.current = onDmToast;
  }, [onDmToast]);
  useEffect(() => {
    onUnreadRef.current = onUnread;
  }, [onUnread]);
  useEffect(() => {
    onPeerOpenedRef.current = onPeerOpened;
  }, [onPeerOpened]);
  useEffect(() => {
    onInboxMetaRef.current = onInboxMeta;
  }, [onInboxMeta]);

  useEffect(() => {
    onInboxMetaRef.current?.({ conversations, contacts });
  }, [conversations, contacts]);

  useEffect(() => {
    unlockAppNotifyAudio().catch(() => {});
  }, []);

  const markPeerRead = useCallback(
    (peerId, upToMessageId) => {
      if (!token || !peerId || !upToMessageId) return;
      markDmRead(token, peerId, upToMessageId).catch(() => {});
    },
    [token]
  );

  useEffect(() => {
    if (!active || !peer?.id || !messages.length) return undefined;
    const last = [...messages]
      .reverse()
      .find((m) => !m.isDeleted && m.senderId !== me.id);
    if (!last?.id) return undefined;
    const t = setTimeout(() => markPeerRead(peer.id, last.id), 400);
    return () => clearTimeout(t);
  }, [messages, peer?.id, active, me.id, markPeerRead]);

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
        if (!cancelled) setError(esMsg(e.message));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      ...socketIoOptions,
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
      const peerId = msg.senderId === me.id ? msg.recipientId : msg.senderId;
      if (
        msg.senderId !== me.id &&
        visiblePeerIdRef.current === peerId &&
        activeRef.current &&
        msg.id
      ) {
        markPeerRead(peerId, msg.id);
      }
    });

    socket.on('dm:receipts', ({ messageIds }) => {
      if (!messageIds?.length) return;
      const ids = new Set(messageIds);
      setMessages((prev) =>
        prev.map((m) =>
          ids.has(m.id) ? { ...m, readCount: 1, readFully: true, peerCount: 1 } : m
        )
      );
    });

    socket.on('dm:error', ({ error: msg, clientMsgId }) => {
      setError(esMsg(msg || 'Error'));
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
      const viewingThisChat = isViewingChat('dm', peerId);

      if (viewingThisChat) {
        playMessageTone({ soft: true });
      } else {
        notifyDmMessage({
          peerId,
          peerName,
          message,
          viewingPeer: false,
          panelVisible: false,
        });
        onUnreadRef.current?.({ peerId, peerName, message });
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
        showChatMessageToast({
          kind: 'dm',
          peerId,
          peerName,
          preview,
          title: peerName || 'Mensaje',
        });
      }
    });

    socket.on('dm:typing', ({ peerId, displayName, typing: t }) => {
      if (peerRef.current?.id === peerId) {
        setTyping(t ? `${displayName} escribe…` : '');
      }
    });

    socket.on('call:incoming', (payload) => {
      // Radio personal: auto-unirse (como canal grupal), sin UI de llamada.
      if (payload?.mode === 'radio') {
        (async () => {
          try {
            const data = await acceptPrivateCall(token, payload.callId);
            setActiveRadio({
              callId: data.call.callId,
              room: data.call.room,
              token: data.token,
              authToken: token,
              url: data.url,
              peerName: payload.callerName,
              role: 'callee',
              e2eeKey: data.e2eeKey || null,
              mode: 'radio',
            });
            notifyIncomingCall({
              callerName: payload?.callerName,
              callId: payload?.callId,
              mode: 'radio',
            });
            stopCallRingtone();
          } catch (e) {
            setError(esMsg(e.message));
          }
        })();
        return;
      }
      setIncomingCall(payload);
      notifyIncomingCall({
        callerName: payload?.callerName,
        callId: payload?.callId,
        mode: payload?.mode,
      });
    });

    socket.on('call:accepted', () => {
      stopCallRingtone();
    });

    socket.on('call:ended', ({ callId }) => {
      stopCallRingtone();
      setIncomingCall((c) => (c?.callId === callId ? null : c));
      setActiveCall((c) => (c?.callId === callId ? null : c));
      setActiveRadio((c) => (c?.callId === callId ? null : c));
      setRadioPttHeld(false);
    });

    return () => {
      stopCallRingtone();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, me.id, markPeerRead]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const stick = el.dataset.stick !== '0';
    const near =
      stick || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || messages.length <= 1;
    if (!near) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    el.dataset.stick = '1';
    const ro = new ResizeObserver(() => {
      if (el.dataset.stick === '0') return;
      el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function openPeer(p) {
    if (!p?.id) return;
    setError('');
    setPeer(p);
    setTyping('');
    onPeerOpenedRef.current?.(p);
    try {
      socketRef.current?.emit('dm:join', { peerId: p.id });
      const data = await fetchDmMessages(token, p.id);
      setMessages(data.messages || []);
      const nextPeer = data.peer || p;
      setPeer(nextPeer);
      onPeerOpenedRef.current?.(nextPeer);
      const last = [...(data.messages || [])]
        .reverse()
        .find((m) => !m.isDeleted && m.senderId !== me.id);
      if (last?.id) markPeerRead(p.id, last.id);
    } catch (e) {
      setError(esMsg(e.message));
    }
  }
  openPeerFnRef.current = openPeer;

  useEffect(() => {
    if (!openPeerId) return;
    if (peerRef.current?.id === openPeerId) return;
    const fromConv = conversations.find((c) => c.peerId === openPeerId);
    const fromContact = contacts.find((c) => c.id === openPeerId);
    const stub = fromContact || {
      id: openPeerId,
      displayName: fromConv?.peerName || 'Chat',
      email: fromConv?.peerEmail || '',
      avatarUrl: fromConv?.peerAvatarUrl || fromContact?.avatarUrl || null,
    };
    openPeerFnRef.current?.(stub);
  }, [openPeerId, conversations, contacts]);

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
      setError(esMsg(err.message));
    }
  }

  async function onSendMedia(file, type) {
    if (!peer || !file || uploading) return;
    setShowAttach(false);
    setShowPicker(false);
    if (type === 'image' || isImageFile(file)) {
      setMediaComposer({
        key: Date.now(),
        files: [file],
        caption: draft,
      });
      return;
    }
    setUploading(true);
    setError('');
    try {
      const caption = draft.trim() || undefined;
      const data = await uploadDmMedia(token, peer.id, file, {
        type,
        body: caption,
      });
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      setDraft('');
    } catch (err) {
      setError(esMsg(err.message));
    } finally {
      setUploading(false);
    }
  }

  function openImages(fileList, caption) {
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length || !peer) return;
    setShowAttach(false);
    setShowPicker(false);
    setMediaComposer({
      key: Date.now(),
      files,
      caption: caption ?? draft,
    });
  }

  function onComposerPaste(e) {
    const imgs = filesFromClipboard(e.clipboardData);
    if (!imgs.length) return;
    e.preventDefault();
    openImages(imgs, draft);
  }

  async function sendComposerImages(files, caption) {
    if (!peer || !files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (let i = 0; i < files.length; i += 1) {
        const data = await uploadDmMedia(token, peer.id, files[i], {
          type: 'image',
          body: i === 0 ? caption || undefined : undefined,
        });
        if (data?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      }
      setDraft('');
    } catch (err) {
      setError(esMsg(err.message));
    } finally {
      setUploading(false);
    }
  }

  async function onSendSticker(sticker) {
    if (!peer || !sticker?.id || uploading) return;
    setShowPicker(false);
    setError('');
    try {
      const data = await sendDmSticker(token, peer.id, sticker.id);
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      setError(esMsg(err.message));
    }
  }

  async function callPeer() {
    if (!peer) return;
    try {
      const data = await startPrivateCall(token, peer.id, { mode: 'call' });
      setActiveCall({
        callId: data.call.callId,
        room: data.call.room,
        token: data.token,
        authToken: token,
        url: data.url,
        peerName: peer.displayName,
        role: 'caller',
        e2eeKey: data.e2eeKey || null,
        mode: 'call',
      });
    } catch (e) {
      setError(esMsg(e.message));
    }
  }

  async function radioPeer() {
    if (!peer || activeRadio || radioStartingRef.current) return;
    radioStartingRef.current = true;
    try {
      const data = await startPrivateCall(token, peer.id, { mode: 'radio' });
      setActiveRadio({
        callId: data.call.callId,
        room: data.call.room,
        token: data.token,
        authToken: token,
        url: data.url,
        peerName: peer.displayName,
        role: 'caller',
        e2eeKey: data.e2eeKey || null,
        mode: 'radio',
      });
    } catch (e) {
      setError(esMsg(e.message));
    } finally {
      radioStartingRef.current = false;
    }
  }

  async function hangupRadio(opts) {
    try {
      if (activeRadio?.callId && opts?.remote !== true) {
        await endPrivateCall(token, activeRadio.callId, 'hangup');
      }
    } catch {
      /* ignore */
    }
    setActiveRadio(null);
  }

  async function acceptCall() {
    if (!incomingCall) return;
    stopCallRingtone();
    const mode = incomingCall.mode === 'radio' ? 'radio' : 'call';
    try {
      const data = await acceptPrivateCall(token, incomingCall.callId);
      setIncomingCall(null);
      if (mode === 'radio') {
        setActiveRadio({
          callId: data.call.callId,
          room: data.call.room,
          token: data.token,
          authToken: token,
          url: data.url,
          peerName: incomingCall.callerName,
          role: 'callee',
          e2eeKey: data.e2eeKey || null,
          mode: 'radio',
        });
        return;
      }
      setActiveCall({
        callId: data.call.callId,
        room: data.call.room,
        token: data.token,
        authToken: token,
        url: data.url,
        peerName: incomingCall.callerName,
        role: 'callee',
        e2eeKey: data.e2eeKey || null,
        mode: 'call',
      });
    } catch (e) {
      setError(esMsg(e.message));
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

  async function hangup(opts = {}) {
    if (!activeCall) return;
    stopCallRingtone();
    const remote = opts?.remote === true;
    if (!remote) {
      try {
        await endPrivateCall(token, activeCall.callId, 'hangup');
      } catch {
        /* ignore */
      }
    }
    setActiveCall(null);
  }

  const recentIds = new Set(conversations.map((c) => c.peerId));
  const otherContacts = contacts.filter((c) => !recentIds.has(c.id));

  return (
    <div
      className={`dm-layout${embedded ? ' embedded' : ''}${hideSidebar ? ' dm-layout--pane' : ''}`}
    >
      {!hideSidebar && (
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
                        avatarUrl: c.peerAvatarUrl,
                      })
                    }
                  >
                    <PersonAvatar
                      userId={c.peerId}
                      avatarUrl={c.peerAvatarUrl}
                      name={c.peerName}
                      token={token}
                      className="dm-avatar"
                    />
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
                  <PersonAvatar
                    userId={c.id}
                    avatarUrl={c.avatarUrl}
                    name={c.displayName}
                    token={token}
                    className="dm-avatar"
                  />
                  <span className="dm-contact-text">
                    <strong>{c.displayName}</strong>
                    <span>{roleLabel(c.role)}</span>
                  </span>
                </button>
              ))}
              {contacts.length === 0 && (
                <p className="dm-empty-side">Sin contactos en la organización</p>
              )}
              {contacts.length > 0 && conversations.length > 0 && otherContacts.length === 0 && (
                <p className="dm-empty-side">Todos están en recientes</p>
              )}
            </div>
          </div>
        </aside>
      )}

      <section className="dm-chat">
        {!peer ? (
          <div className="dm-empty">
            <div className="dm-empty-icon" aria-hidden="true">
              {ICON.envelope}
            </div>
            <h2>Mensajes directos</h2>
            <p>
              {hideSidebar
                ? 'Elige un chat en la lista de la izquierda.'
                : 'Elige un contacto a la izquierda para escribir o iniciar una llamada privada.'}
            </p>
          </div>
        ) : (
          <>
            <header className="dm-header">
              <div className="dm-header-person">
                <PersonAvatar
                  userId={peer.id}
                  avatarUrl={peer.avatarUrl}
                  name={peer.displayName}
                  token={token}
                  className="dm-avatar dm-avatar-lg"
                />
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
              <div className="dm-header-actions">
                {onToggleFavorite && (
                  <button
                    type="button"
                    className={`wa-inbox-fav-btn${favorite ? ' on' : ''}`}
                    onClick={onToggleFavorite}
                    title={favorite ? 'Quitar de favoritos' : 'Favorito'}
                    aria-label="Favorito"
                  >
                    <StarIcon size="1.1rem" />
                  </button>
                )}
                <button
                  type="button"
                  className={`btn ghost dm-call-btn radio-ptt-btn${activeRadio ? ' active-session' : ''}`}
                  onClick={() => {
                    if (!activeRadio) radioPeer();
                  }}
                  disabled={Boolean(activeRadio)}
                  title={
                    activeRadio
                      ? 'Radio activa — usa el botón PTT de la barra'
                      : 'Iniciar radio personal (PTT)'
                  }
                >
                  Radio
                </button>
                <button type="button" className="btn primary dm-call-btn" onClick={callPeer}>
                  Llamar
                </button>
              </div>
            </header>

            {activeRadio && (
              <PrivateRadioBar ref={radioBarRef} call={activeRadio} onHangup={hangupRadio} />
            )}

            {error && <p className="error dm-error">{error}</p>}

            <div
              className="dm-log"
              ref={logRef}
              onScroll={() => {
                const el = logRef.current;
                if (!el) return;
                el.dataset.stick =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 120 ? '1' : '0';
              }}
            >
              {messages.length === 0 ? (
                <div className="dm-log-empty">
                  <p>Sin mensajes todavía</p>
                  <p className="muted">Escribe el primero o inicia una llamada.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === me.id;
                  const ticks = mine
                    ? m.readFully || m.readCount > 0
                      ? ICON.ticks
                      : m._local
                        ? '…'
                        : ICON.tick
                    : '';
                  return (
                    <div key={m.id} className={`dm-bubble${mine ? ' mine' : ''}`}>
                      {!mine && <small>{m.displayName}</small>}
                      {m.isDeleted ? (
                        <p>Mensaje eliminado</p>
                      ) : (
                        <>
                          {m.type === 'sticker' && m.sticker ? (
                            <div className="wa-sticker" title={m.sticker.label || 'Sticker'}>
                              {m.sticker.kind === 'emoji' || !String(m.sticker.value || '').startsWith('http') ? (
                                <span className="wa-sticker-emoji" role="img" aria-label={m.sticker.label}>
                                  {m.sticker.value}
                                </span>
                              ) : (
                                <img src={m.sticker.value} alt={m.sticker.label || 'Sticker'} />
                              )}
                            </div>
                          ) : null}
                          {m.mediaUrl ? (
                            <ChatMedia token={token} message={m} onOpenImage={openImageGallery} />
                          ) : null}
                          {m.body ? <LinkifiedText text={m.body} className="wa-text" /> : null}
                          {!m.mediaUrl && !m.body && m.type !== 'sticker' ? (
                            <p>{m.mediaName || m.type}</p>
                          ) : null}
                        </>
                      )}
                      <span className="dm-bubble-meta">
                        <time>{formatTime(m.createdAt)}</time>
                        {ticks && (
                          <span
                            className={`dm-ticks${m.readFully || m.readCount > 0 ? ' read' : ''}`}
                            aria-hidden="true"
                          >
                            {ticks}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {showAttach && (
              <div className="wa-attach-menu dm-attach-menu">
                <button type="button" onClick={() => imageRef.current?.click()}>
                  📷 Foto
                </button>
                <button type="button" onClick={() => videoRef.current?.click()}>
                  🎬 Video
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  📄 Documento / archivo
                </button>
                <button type="button" onClick={() => setShowAttach(false)}>
                  Cancelar
                </button>
              </div>
            )}

            <div className="dm-compose-wrap">
              <WaEmojiPicker
                token={token}
                open={showPicker}
                onClose={() => setShowPicker(false)}
                onPickEmoji={(e) => setDraft((d) => d + e)}
                onPickSticker={onSendSticker}
              />
              <form className="dm-compose dm-compose--wa" onSubmit={onSend}>
                <input
                  ref={imageRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const list = e.target.files;
                    e.target.value = '';
                    openImages(list);
                  }}
                />
                <input
                  ref={videoRef}
                  type="file"
                  className="sr-only"
                  accept={VIDEO_ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    onSendMedia(f, 'video');
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept={DOC_ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    onSendMedia(f, classifyUploadFile(f));
                  }}
                />
                <button
                  type="button"
                  className="dm-attach-btn"
                  title="Adjuntar"
                  disabled={uploading}
                  onClick={() => {
                    setShowPicker(false);
                    setShowAttach((v) => !v);
                  }}
                >
                  {uploading ? '…' : '+'}
                </button>
                <button
                  type="button"
                  className={`dm-attach-btn${showPicker ? ' is-active' : ''}`}
                  title={showPicker ? 'Cerrar emojis' : 'Emojis y stickers'}
                  disabled={uploading}
                  onClick={() => {
                    setShowAttach(false);
                    setShowPicker((v) => !v);
                  }}
                >
                  {showPicker ? '⌨️' : '🙂'}
                </button>
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    socketRef.current?.emit('dm:typing', {
                      peerId: peer.id,
                      typing: e.target.value.trim().length > 0,
                    });
                  }}
                  onPaste={onComposerPaste}
                  onFocus={() => setShowPicker(false)}
                  placeholder={uploading ? 'Subiendo archivo…' : 'Escribe un mensaje'}
                  aria-label="Mensaje privado"
                  disabled={uploading}
                />
                <button
                  type="submit"
                  className="dm-send-btn"
                  disabled={!draft.trim() || uploading}
                  aria-label="Enviar"
                >
                  {ICON.send}
                </button>
              </form>
            </div>
          </>
        )}
      </section>

      {mediaComposer && (
        <MediaComposerModal
          key={mediaComposer.key}
          open
          files={mediaComposer.files}
          initialCaption={mediaComposer.caption || ''}
          onClose={() => setMediaComposer(null)}
          onSend={sendComposerImages}
        />
      )}

      {incomingCall &&
        createPortal(
          <div
            className="incoming-call-screen"
            role="dialog"
            aria-modal="true"
            aria-label="Llamada entrante"
            data-esc-close=""
          >
            <p className="incoming-call-kicker">Llamada de voz entrante</p>
            <div className="incoming-call-avatar-wrap" aria-hidden="true">
              <span className="incoming-call-ring" />
              <span className="incoming-call-ring delay" />
              <span className="incoming-call-avatar">{initials(incomingCall.callerName)}</span>
            </div>
            <h2 className="incoming-call-name">{incomingCall.callerName}</h2>
            <p className="incoming-call-hint">Pulsa para contestar · Esc rechaza</p>
            <div className="incoming-call-actions">
              <button
                type="button"
                className="incoming-call-btn reject"
                onClick={rejectCall}
                data-esc-close-btn=""
                title="Rechazar (Esc)"
              >
                <span className="incoming-call-ico" aria-hidden="true">
                  {ICON.reject}
                </span>
                Rechazar
              </button>
              <button type="button" className="incoming-call-btn accept" onClick={acceptCall}>
                <span className="incoming-call-ico" aria-hidden="true">
                  {ICON.phone}
                </span>
                Contestar
              </button>
            </div>
          </div>,
          document.body
        )}

      {activeCall &&
        createPortal(<PrivateCallOverlay call={activeCall} onHangup={hangup} />, document.body)}

      {imageGallery &&
        createPortal(
          <ImageGalleryLightbox
            token={token}
            items={imageGallery.items}
            index={imageGallery.index}
            onClose={() => setImageGallery(null)}
          />,
          document.body
        )}
    </div>
  );
}

