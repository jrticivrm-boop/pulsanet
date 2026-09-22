import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import {
  canDispatch,
  fetchContacts,
  fetchDmConversations,
  fetchDmMessages,
  fetchMediaBlobUrl,
  markDmRead,
  sendDmMessage,
  sendDmSticker,
  sendDmNudge,
  editDmMessage,
  deleteDmMessage,
  reactToDmMessage,
  uploadDmMedia,
} from './api';
import AppDialog from './AppDialog';
import ChatMedia from './ChatMedia';
import ImageGalleryLightbox, { collectImageMessages } from './ImageGalleryLightbox';
import {
  clampMenuPos,
  copyImageFromObjectUrl,
  copyTextToClipboard,
  downloadFromObjectUrl,
  friendlyMediaName,
  isImageMessage,
} from './chatMediaActions';
import {
  notifyDmMessage,
  playMessageTone,
  unlockAppNotifyAudio,
} from './appNotify';
import { isViewingChat, showChatMessageToast } from './chatNotify';
import { esMsg } from './esMsg';
import LinkifiedText from './LinkifiedText';
import MediaComposerModal from './MediaComposerModal';
import { DOC_ACCEPT, VIDEO_ACCEPT, isDocumentFile } from './mediaKind';
import { filesFromClipboard, isImageFile } from './mediaComposerUtils';
import { socketIoOptions, socketUrl } from './socketConfig';
import StarIcon from './StarIcon';
import WaEmojiPicker from './WaEmojiPicker';
import PersonAvatar from './PersonAvatar';
import { startVideoCall, startVoiceCall } from './peerActions';
import iconTelefono from './assets/icons/telefono.png';
import iconVideollamada from './assets/icons/videollamada.png';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = socketUrl();
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Vibración + sacudida + buzz aproximado estilo Messenger (~1.5 s). */
function playNudgeEffect() {
  try {
    navigator.vibrate?.([
      0, 60, 45, 60, 45, 80, 50, 180, 60, 70, 45, 70, 45, 90, 55, 120, 50, 60,
    ]);
  } catch {
    /* ignore */
  }
  try {
    const a = new Audio('/sounds/nudge_buzz.wav');
    a.volume = 0.72;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
  const root =
    document.querySelector('.dm-layout.embedded') ||
    document.querySelector('.dm-layout') ||
    document.querySelector('.cc-shell');
  if (!root) return;
  root.classList.remove('dm-nudge-shake');
  void root.offsetWidth;
  root.classList.add('dm-nudge-shake');
  window.setTimeout(() => root.classList.remove('dm-nudge-shake'), 1600);
}

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

function replyPreview(reply) {
  if (!reply) return '';
  if (reply.isDeleted) return 'Mensaje eliminado';
  if (reply.type === 'sticker') return 'Sticker';
  if (reply.type === 'nudge') return '¡Zumbido!';
  if (reply.type === 'image') return '📷 Imagen';
  if (reply.type === 'audio') return '🎤 Audio';
  if (reply.type === 'video' || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(reply.mediaName || '')) {
    return '🎬 Video';
  }
  if (reply.type === 'file') return `📎 ${reply.mediaName || 'Archivo'}`;
  return String(reply.body || '').slice(0, 80);
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
  const [imageGallery, setImageGallery] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [reactPickerId, setReactPickerId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionHint, setActionHint] = useState('');
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const actionHintTimer = useRef(null);
  const menuOpenRef = useRef(false);

  function openImageGallery(m) {
    closeMsgMenu();
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
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const activeRef = useRef(active);
  const visiblePeerIdRef = useRef(visiblePeerId);
  const onDmToastRef = useRef(onDmToast);
  const onUnreadRef = useRef(onUnread);
  const onPeerOpenedRef = useRef(onPeerOpened);

  const canModerate = (m) =>
    !m?.isDeleted &&
    !m?._local &&
    (m.senderId === me.id ||
      me.role === 'root' ||
      me.role === 'admin' ||
      me.role === 'dispatcher');

  function closeMsgMenu() {
    setMenuMsgId(null);
    setMenuPos(null);
    setReactPickerId(null);
  }

  function showActionHint(text) {
    if (!text) return;
    setActionHint(text);
    clearTimeout(actionHintTimer.current);
    actionHintTimer.current = setTimeout(() => setActionHint(''), 2200);
  }

  function openMsgMenu(m, clientX, clientY) {
    setReactPickerId(null);
    setMenuMsgId(m.id);
    setMenuPos(clientX != null ? clampMenuPos(clientX, clientY) : null);
  }
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

  useEffect(() => {
    if (!menuMsgId) return undefined;
    const close = () => closeMsgMenu();
    const t = setTimeout(() => document.addEventListener('mousedown', close), 0);
    const onEsc = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') close();
    };
    const onBus = () => close();
    window.addEventListener('keydown', onEsc, true);
    window.addEventListener('tacticalptx:close-context-menus', onBus);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('tacticalptx:close-context-menus', onBus);
    };
  }, [menuMsgId]);

  useEffect(
    () => () => {
      clearTimeout(actionHintTimer.current);
    },
    []
  );

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
    if (!error || !peer) return undefined;
    const t = window.setTimeout(() => setError(''), 6000);
    return () => window.clearTimeout(t);
  }, [error, peer]);

  useEffect(() => {
    let cancelled = false;
    async function loadInboxMeta() {
      try {
        const scope = canDispatch(me) ? 'org' : 'shared';
        const [c, conv] = await Promise.all([
          fetchContacts(token, { scope }),
          fetchDmConversations(token),
        ]);
        if (cancelled) return;
        setContacts(c.contacts || []);
        setConversations(conv.conversations || []);
      } catch (e) {
        if (!cancelled) setError(esMsg(e.message));
      }
    }
    loadInboxMeta();

    /* Radio keepalive: al re-entrar al módulo, re-fetch sin desmontar el host PTT. */
    const onModuleRefresh = (e) => {
      if (e.detail?.module && e.detail.module !== 'radio') return;
      loadInboxMeta();
    };
    window.addEventListener('tacticalptx:module-refresh', onModuleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('tacticalptx:module-refresh', onModuleRefresh);
    };
  }, [token, me]);

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
      if (msg.type === 'nudge' && msg.senderId !== me.id) {
        playNudgeEffect();
      }
      if (
        msg.senderId !== me.id &&
        visiblePeerIdRef.current === peerId &&
        activeRef.current &&
        msg.id
      ) {
        markPeerRead(peerId, msg.id);
      }
    });

    socket.on('dm:nudge', () => {
      playNudgeEffect();
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

    socket.on('dm:deleted', (msg) => {
      if (!msg?.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    });

    socket.on('dm:edited', (msg) => {
      if (!msg?.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    });

    socket.on('dm:reaction', (payload) => {
      const mid = payload?.messageId;
      if (!mid) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === mid ? { ...m, reactions: payload.reactions || [] } : m
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
            : message?.type === 'nudge'
              ? '¡Zumbido!'
              : message?.type === 'image'
                ? '📷 Imagen'
                : message?.type === 'audio'
                  ? '🎤 Audio'
                  : message?.type === 'sticker'
                    ? 'Sticker'
                    : message?.body === 'nudge'
                      ? '¡Zumbido!'
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

    /* Actualiza semáforo DM cuando llega presencia de un grupo compartido. */
    socket.on('presence:update', ({ members }) => {
      if (!Array.isArray(members) || !members.length) return;
      const byId = new Map(
        members.map((m) => [String(m.userId || m.id || ''), m]).filter(([id]) => id)
      );
      setContacts((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          const m = byId.get(String(c.id));
          if (!m) return c;
          const focus = String(m.focus || 'foreground');
          const presence = focus === 'background' || focus === 'service' ? 'away' : 'online';
          if (c.presence === presence && c.online === true) return c;
          changed = true;
          return { ...c, online: true, presence, focus };
        });
        return changed ? next : prev;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, me.id, markPeerRead]);

  useEffect(() => {
    menuOpenRef.current = Boolean(menuMsgId);
  }, [menuMsgId]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    if (menuOpenRef.current) return;
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
      if (el.dataset.stick === '0' || menuOpenRef.current) return;
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
    setReplyTo(null);
    setEditing(null);
    setDraft('');
    closeMsgMenu();
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

    if (editing) {
      try {
        const data = await editDmMessage(token, peer.id, editing.id, body);
        if (data?.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === editing.id ? { ...m, ...data.message } : m))
          );
        }
        setEditing(null);
      } catch (err) {
        setError(esMsg(err.message));
        setDraft(body);
      }
      return;
    }

    const replyId = replyTo?.id || null;
    const replySnapshot = replyTo;
    setReplyTo(null);
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
          reply: replySnapshot
            ? {
                id: replySnapshot.id,
                body: replySnapshot.body,
                type: replySnapshot.type,
                displayName:
                  replySnapshot.displayName ||
                  (replySnapshot.senderId === me.id ? 'Tú' : peer.displayName),
                isDeleted: replySnapshot.isDeleted === true,
              }
            : null,
        };
        setMessages((prev) => [...prev, optimistic]);
        socketRef.current.emit('dm:send', {
          peerId: peer.id,
          body,
          clientMsgId,
          replyToId: replyId,
        });
      } else {
        const data = await sendDmMessage(token, peer.id, body, { replyToId: replyId });
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      setError(esMsg(err.message));
    }
  }

  async function pickReaction(m, emoji) {
    if (!peer || !m?.id || m._local) return;
    setReactPickerId(null);
    try {
      const data = await reactToDmMessage(token, peer.id, m.id, emoji);
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, reactions: data.reactions || [] } : x
        )
      );
    } catch (err) {
      setError(esMsg(err.message));
    }
  }

  function startEdit(m) {
    if (!canModerate(m) || m.type !== 'text' || !m.body) return;
    setEditing(m);
    setDraft(m.body);
    setReplyTo(null);
    closeMsgMenu();
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  function confirmDelete(m) {
    closeMsgMenu();
    setDeleteTarget(m);
  }

  async function runDeleteMessage() {
    if (!peer || !deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const data = await deleteDmMessage(token, peer.id, deleteTarget.id);
      if (data?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === deleteTarget.id ? { ...m, ...data.message } : m))
        );
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(esMsg(err.message));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function copyMsg(m) {
    const text = m.body || m.mediaName || '';
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    showActionHint(ok ? 'Copiado' : 'No se pudo copiar');
    closeMsgMenu();
  }

  async function copyMsgImage(m) {
    if (!m.mediaUrl || !isImageMessage(m)) return;
    closeMsgMenu();
    try {
      const blobUrl = await fetchMediaBlobUrl(token, m.mediaUrl);
      const ok = await copyImageFromObjectUrl(blobUrl);
      URL.revokeObjectURL(blobUrl);
      showActionHint(ok ? 'Imagen copiada' : 'No se pudo copiar la imagen');
    } catch {
      showActionHint('No se pudo copiar la imagen');
    }
  }

  async function downloadMsgMedia(m) {
    if (!m.mediaUrl) return;
    closeMsgMenu();
    try {
      const blobUrl = await fetchMediaBlobUrl(token, m.mediaUrl);
      await downloadFromObjectUrl(blobUrl, friendlyMediaName(m) || 'archivo');
      URL.revokeObjectURL(blobUrl);
      showActionHint('Descarga iniciada');
    } catch {
      showActionHint('No se pudo descargar');
    }
  }

  function renderMsgMenu(m) {
    const hasText = Boolean(m.body?.trim());
    const hasMedia = Boolean(m.mediaUrl);
    const image = isImageMessage(m);
    const displayName = friendlyMediaName(m);
    const style = menuPos ? { top: menuPos.y, left: menuPos.x } : undefined;

    return (
      <div
        className={`wa-context-menu${menuPos ? ' is-floating' : ''}`}
        style={style}
        role="menu"
        data-esc-close=""
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="sr-only"
          data-esc-close-btn=""
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeMsgMenu}
        >
          Cerrar
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setReactPickerId(m.id);
            closeMsgMenu();
          }}
        >
          Reaccionar
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setReplyTo(m);
            setEditing(null);
            closeMsgMenu();
          }}
        >
          Responder
        </button>
        {hasText && (
          <button type="button" role="menuitem" onClick={() => copyMsg(m)}>
            Copiar
          </button>
        )}
        {image && (
          <button type="button" role="menuitem" onClick={() => copyMsgImage(m)}>
            Copiar imagen
          </button>
        )}
        {hasMedia && (
          <button type="button" role="menuitem" onClick={() => downloadMsgMedia(m)}>
            Descargar{m.type === 'audio' ? ' audio' : image ? ' imagen' : ''}
          </button>
        )}
        {displayName && (
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              const ok = await copyTextToClipboard(displayName);
              showActionHint(ok ? 'Nombre copiado' : 'No se pudo copiar');
              closeMsgMenu();
            }}
          >
            Copiar nombre
          </button>
        )}
        {canModerate(m) && m.type === 'text' && m.body && (
          <button type="button" role="menuitem" onClick={() => startEdit(m)}>
            Editar
          </button>
        )}
        {canModerate(m) && (
          <button type="button" role="menuitem" className="danger" onClick={() => confirmDelete(m)}>
            Eliminar
          </button>
        )}
      </div>
    );
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

  function takeFilesFromInput(input) {
    // Copiar YA: en Chromium, resetear value vacía el FileList vivo.
    const files = Array.from(input?.files || []);
    if (input) input.value = '';
    return files;
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

  async function onSendNudge() {
    if (!peer || uploading || nudgeBusy) return;
    setShowAttach(false);
    setShowPicker(false);
    setNudgeBusy(true);
    setError('');
    try {
      const data = await sendDmNudge(token, peer.id);
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      // Feedback local al emisor (mismo efecto)
      playNudgeEffect();
    } catch (err) {
      setError(esMsg(err.message));
    } finally {
      window.setTimeout(() => setNudgeBusy(false), 400);
    }
  }

  function callPeer() {
    if (!peer) return;
    startVoiceCall({
      id: peer.id,
      displayName: peer.displayName,
      avatarUrl: peer.avatarUrl,
    });
  }

  function videoCallPeer() {
    if (!peer) return;
    startVideoCall({
      id: peer.id,
      displayName: peer.displayName,
      avatarUrl: peer.avatarUrl,
    });
  }

  const recentIds = new Set(conversations.map((c) => c.peerId));
  const otherContacts = contacts.filter((c) => !recentIds.has(c.id));

  const contactPresence = (c) => {
    if (!c) return 'offline';
    if (c.isSelf || String(c.id) === String(me.id)) return 'online';
    return String(c.presence || (c.online ? 'online' : 'offline')).toLowerCase();
  };

  const peerPresence = (() => {
    if (!peer?.id) return null;
    if (String(peer.id) === String(me.id)) return 'online';
    const fromContact = contacts.find((c) => String(c.id) === String(peer.id));
    if (fromContact) return contactPresence(fromContact);
    return String(peer.presence || (peer.online ? 'online' : 'offline')).toLowerCase();
  })();

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
                      showPresence
                      presence={contactPresence(
                        contacts.find((x) => String(x.id) === String(c.peerId))
                      )}
                      online={Boolean(
                        contacts.find((x) => String(x.id) === String(c.peerId))?.online
                      )}
                    />
                    <span className="dm-contact-text">
                      <strong>{c.peerName}</strong>
                      <span>
                        {c.lastMessage?.type === 'nudge' || c.lastMessage?.body === 'nudge'
                          ? '¡Zumbido!'
                          : c.lastMessage?.body || c.lastMessage?.type || 'Conversación'}
                      </span>
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
                    showPresence
                    presence={contactPresence(c)}
                    online={Boolean(c.online)}
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
            {error && <p className="error dm-error">{error}</p>}
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
                  showPresence
                  presence={peerPresence}
                  online={peerPresence !== 'offline'}
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
                    title="Favorito"
                    aria-label="Favorito"
                  >
                    <StarIcon size="1.35rem" />
                  </button>
                )}
                  <button
                    type="button"
                    className="dm-call-icon-btn"
                    title="Llamada"
                    aria-label="Llamada"
                    onClick={() => callPeer()}
                  >
                    <img src={iconTelefono} alt="" width={22} height={22} draggable={false} />
                  </button>
                  <button
                    type="button"
                    className="dm-call-icon-btn video"
                    title="Videollamada"
                    aria-label="Videollamada"
                    onClick={() => videoCallPeer()}
                  >
                    <img src={iconVideollamada} alt="" width={22} height={22} draggable={false} />
                  </button>
              </div>
            </header>

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
                  const deleted = Boolean(m.isDeleted);
                  const ticks = mine
                    ? m.readFully || m.readCount > 0
                      ? ICON.ticks
                      : m._local
                        ? '…'
                        : ICON.tick
                    : '';
                  return (
                    <div
                      key={m.id}
                      className={`dm-bubble${mine ? ' mine' : ''}${deleted ? ' deleted' : ''}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!deleted && !m._local) openMsgMenu(m, e.clientX, e.clientY);
                      }}
                    >
                      {!mine && <small>{m.displayName}</small>}
                      {deleted ? (
                        <p className="wa-deleted">Mensaje eliminado</p>
                      ) : (
                        <>
                          {m.reply && (
                            <button
                              type="button"
                              className="wa-quote"
                              onClick={() => setReplyTo(m.reply)}
                            >
                              <span>{m.reply.displayName}</span>
                              <em>{replyPreview(m.reply)}</em>
                            </button>
                          )}
                          {m.type === 'nudge' ? (
                            <p className="dm-nudge-msg" role="status">
                              <span className="dm-nudge-msg-ico" aria-hidden="true">
                                🫨
                              </span>
                              ¡Zumbido!
                            </p>
                          ) : null}
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
                          {m.body && m.type !== 'nudge' && m.type !== 'sticker' ? (
                            <LinkifiedText
                              text={m.body}
                              className={`wa-text${m.editedAt ? ' is-edited' : ''}`}
                            />
                          ) : null}
                          {!m.mediaUrl && !m.body && m.type !== 'sticker' ? (
                            <p>{m.mediaName || m.type}</p>
                          ) : null}
                        </>
                      )}
                      <span className="dm-bubble-meta">
                        <time>
                          {formatTime(m.createdAt)}
                          {m.editedAt && !deleted ? ' · editado' : ''}
                        </time>
                        {ticks && (
                          <span
                            className={`dm-ticks${m.readFully || m.readCount > 0 ? ' read' : ''}`}
                            aria-hidden="true"
                          >
                            {ticks}
                          </span>
                        )}
                      </span>
                      {!deleted && !m._local && (
                        <button
                          type="button"
                          className="wa-bubble-menu-btn dm-bubble-menu-btn"
                          title="Opciones"
                          aria-label="Opciones del mensaje"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (menuMsgId === m.id) closeMsgMenu();
                            else {
                              const r = e.currentTarget.getBoundingClientRect();
                              openMsgMenu(m, r.left, r.bottom + 4);
                            }
                          }}
                        >
                          ⋯
                        </button>
                      )}
                      {!deleted && Array.isArray(m.reactions) && m.reactions.length > 0 && (
                        <div className="wa-reactions">
                          {m.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              className={`wa-reaction-chip${r.mine ? ' mine' : ''}`}
                              title={r.mine ? 'Quitar reacción' : 'Reaccionar'}
                              onClick={() => pickReaction(m, r.emoji)}
                            >
                              <span>{r.emoji}</span>
                              <span className="wa-reaction-count">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {reactPickerId === m.id && !deleted && (
                        <div className="wa-react-picker" role="listbox" aria-label="Reacciones">
                          {REACTION_EMOJIS.map((em) => (
                            <button key={em} type="button" onClick={() => pickReaction(m, em)}>
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {menuMsgId &&
              (() => {
                const m = messages.find((x) => x.id === menuMsgId);
                if (!m || m.isDeleted) return null;
                // Siempre flotante: evita que el menú crezca el bubble y baje el scroll.
                if (!menuPos) return null;
                return createPortal(renderMsgMenu(m), document.body);
              })()}

            {actionHint ? (
              <div className="wa-action-hint" role="status">
                {actionHint}
              </div>
            ) : null}

            {editing ? (
              <div className="wa-reply-bar wa-edit-bar">
                <div>
                  <strong>Editando mensaje</strong>
                  <span>{editing.body?.slice(0, 80)}</span>
                </div>
                <button type="button" onClick={cancelEdit} aria-label="Cancelar edición">
                  ✕
                </button>
              </div>
            ) : (
              replyTo && (
                <div className="wa-reply-bar">
                  <div>
                    <strong>
                      Respondiendo a{' '}
                      {replyTo.displayName ||
                        (replyTo.senderId === me.id ? 'ti' : peer.displayName)}
                    </strong>
                    <span>{replyPreview(replyTo)}</span>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar">
                    ✕
                  </button>
                </div>
              )
            )}

            <div className="dm-compose-wrap">
              {showAttach && !editing && (
                <div className="wa-attach-menu dm-attach-menu" role="menu" aria-label="Adjuntar">
                  <button type="button" className="wa-attach-item" onClick={() => imageRef.current?.click()}>
                    <span className="wa-attach-ico photo" aria-hidden="true" />
                    <span className="label">Imagen</span>
                  </button>
                  <button type="button" className="wa-attach-item" onClick={() => cameraRef.current?.click()}>
                    <span className="wa-attach-ico camera" aria-hidden="true">📷</span>
                    <span className="label">Cámara</span>
                  </button>
                  <button type="button" className="wa-attach-item" onClick={() => videoRef.current?.click()}>
                    <span className="wa-attach-ico video" aria-hidden="true">🎬</span>
                    <span className="label">Video</span>
                  </button>
                  <button type="button" className="wa-attach-item" onClick={() => fileRef.current?.click()}>
                    <span className="wa-attach-ico file" aria-hidden="true">📄</span>
                    <span className="label">Documento</span>
                  </button>
                  <button type="button" className="wa-attach-cancel" onClick={() => setShowAttach(false)}>
                    Cancelar
                  </button>
                </div>
              )}
              {error && (
                <button
                  type="button"
                  className="composer-error-balloon"
                  onClick={() => setError('')}
                  title="Cerrar"
                >
                  {error}
                </button>
              )}
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
                    const list = takeFilesFromInput(e.target);
                    openImages(list);
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const list = takeFilesFromInput(e.target);
                    openImages(list);
                  }}
                />
                <input
                  ref={videoRef}
                  type="file"
                  className="sr-only"
                  accept={VIDEO_ACCEPT}
                  onChange={(e) => {
                    const [f] = takeFilesFromInput(e.target);
                    onSendMedia(f, 'video');
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept={DOC_ACCEPT}
                  onChange={(e) => {
                    const [f] = takeFilesFromInput(e.target);
                    if (!f) return;
                    if (!isDocumentFile(f)) {
                      setError('Solo documentos (PDF, Word, Excel, PowerPoint, texto, etc.)');
                      return;
                    }
                    onSendMedia(f, 'file');
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
                  className={`dm-attach-btn dm-nudge-btn${nudgeBusy ? ' is-busy' : ''}`}
                  title="Enviar zumbido"
                  aria-label="Enviar zumbido"
                  disabled={uploading || nudgeBusy || editing}
                  onClick={() => {
                    setShowAttach(false);
                    setShowPicker(false);
                    void onSendNudge();
                  }}
                >
                  <span className="dm-nudge-ico" aria-hidden="true">
                    🫨
                  </span>
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
                  placeholder={
                    uploading
                      ? 'Subiendo archivo…'
                      : editing
                        ? 'Editar mensaje…'
                        : 'Escribe un mensaje'
                  }
                  aria-label="Mensaje privado"
                  disabled={uploading}
                />
                <button
                  type="submit"
                  className="dm-send-btn"
                  disabled={!draft.trim() || uploading}
                  aria-label={editing ? 'Guardar' : 'Enviar'}
                  title={editing ? 'Guardar' : 'Enviar'}
                >
                  {editing ? '✓' : ICON.send}
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

      <AppDialog
        open={Boolean(deleteTarget)}
        title="Eliminar mensaje"
        message="¿Eliminar este mensaje para todos?"
        confirmLabel="Eliminar"
        danger
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={runDeleteMessage}
      />
    </div>
  );
}

