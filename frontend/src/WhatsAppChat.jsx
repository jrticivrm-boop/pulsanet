import { useEffect, useMemo, useRef, useState } from 'react';
import ChatMedia from './ChatMedia';
import AppDialog from './AppDialog';
import { fetchGroupMembers, fetchMediaBlobUrl } from './api';
import {
  clampMenuPos,
  copyImageFromObjectUrl,
  copyTextToClipboard,
  downloadFromObjectUrl,
  friendlyMediaName,
  isImageMessage,
} from './chatMediaActions';
import ImageGalleryLightbox, { collectImageMessages } from './ImageGalleryLightbox';
import LinkifiedText from './LinkifiedText';
import MediaComposerModal from './MediaComposerModal';
import { DOC_ACCEPT, VIDEO_ACCEPT, isDocumentFile } from './mediaKind';
import { filesFromClipboard, isImageFile } from './mediaComposerUtils';
import { createVoiceRecorder, getVoiceStream, voiceFileExtension } from './voiceRecord';
import WaEmojiPicker from './WaEmojiPicker';
import PersonAvatar from './PersonAvatar';
import StarIcon from './StarIcon';
import { openPeerSheet as openGlobalPeerSheet, startVideoCall, startVoiceCall } from './peerActions';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function replyPreview(reply) {
  if (!reply) return '';
  if (reply.isDeleted) return 'Mensaje eliminado';
  if (reply.type === 'sticker') return 'Sticker';
  if (reply.type === 'image') return '📷 Imagen';
  if (reply.type === 'audio') return '🎤 Audio';
  if (reply.type === 'video' || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(reply.mediaName || '')) {
    return '🎬 Video';
  }
  if (reply.type === 'file' || reply.mediaName) return `📎 ${reply.mediaName || 'Archivo'}`;
  return (reply.body || '').slice(0, 80);
}

/**
 * Chat de grupo (Radio).
 */
export default function WhatsAppChat({
  token,
  userId,
  userRole,
  groupId,
  groupName,
  groupAvatarUrl,
  onlineCount = 0,
  onlineMembers = [],
  typingLabel = '',
  messages = [],
  chatError,
  onDismissChatError,
  onSend,
  onSendMedia,
  onSendSticker,
  onMarkRead,
  onEdit,
  onDelete,
  onReact,
  onTyping,
  onOpenDm,
  onCallPeer,
  onVideoPeer,
  onGroupVideo,
  groupVideoActive = false,
  chatActive = true,
  favorite = false,
  onToggleFavorite,
}) {
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [actionHint, setActionHint] = useState('');
  const [reactPickerId, setReactPickerId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [peerMenu, setPeerMenu] = useState(null); // { userId, displayName, x, y }
  const [showMembers, setShowMembers] = useState(false);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [imageGallery, setImageGallery] = useState(null); // { items, index }
  const [mediaComposer, setMediaComposer] = useState(null); // { key, files, caption }
  const actionHintTimer = useRef(null);

  useEffect(() => {
    if (!chatError) return undefined;
    const t = window.setTimeout(() => onDismissChatError?.(), 6000);
    return () => window.clearTimeout(t);
  }, [chatError, onDismissChatError]);

  function openImageGallery(m) {
    closeMsgMenu();
    const items = collectImageMessages(messages);
    let idx = items.findIndex((x) => x.id === m?.id);
    if (idx < 0) idx = items.findIndex((x) => x.mediaUrl === m?.mediaUrl);
    if (idx < 0) idx = 0;
    setImageGallery({ items: items.length ? items : m ? [m] : [], index: idx });
  }

  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const endRef = useRef(null);
  const logRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const savedScrollRef = useRef(null);
  const chatActiveRef = useRef(chatActive);
  const typingTimer = useRef(null);
  const mediaRec = useRef(null);
  const chunks = useRef([]);

  const canModerate = (m) =>
    !m.isDeleted &&
    (m.senderId === userId ||
      userRole === 'root' ||
      userRole === 'admin' ||
      userRole === 'dispatcher');

  const members = useMemo(() => {
    const map = new Map();
    for (const r of roster || []) {
      if (r?.id && r.id !== userId) {
        map.set(r.id, {
          displayName: r.display_name || r.displayName || r.username || 'Usuario',
          avatarUrl: r.avatarUrl || null,
          username: r.username || null,
        });
      }
    }
    for (const m of onlineMembers || []) {
      if (m?.userId && m.userId !== userId) {
        const prev = map.get(m.userId) || {};
        map.set(m.userId, {
          displayName: m.displayName || prev.displayName || 'Usuario',
          avatarUrl: m.avatarUrl || prev.avatarUrl || null,
          username: prev.username || null,
          online: true,
        });
      }
    }
    for (const m of messages || []) {
      if (m?.senderId && m.senderId !== userId && m.type !== 'system') {
        if (!map.has(m.senderId)) {
          map.set(m.senderId, {
            displayName: m.displayName || 'Usuario',
            avatarUrl: m.senderAvatarUrl || m.avatarUrl || null,
          });
        }
      }
    }
    return [...map.entries()]
      .map(([uid, meta]) => ({
        userId: uid,
        displayName: meta.displayName,
        avatarUrl: meta.avatarUrl,
        username: meta.username,
        online: Boolean(meta.online),
      }))
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return String(a.displayName).localeCompare(String(b.displayName), 'es');
      });
  }, [roster, onlineMembers, messages, userId]);

  useEffect(() => {
    if (!showMembers || !groupId || !token) return undefined;
    let cancelled = false;
    setRosterLoading(true);
    fetchGroupMembers(token, groupId)
      .then((data) => {
        if (!cancelled) setRoster(data.members || []);
      })
      .catch(() => {
        if (!cancelled) setRoster([]);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showMembers, groupId, token]);

  function openPeerMenu(peerUserId, displayName, evt) {
    if (!peerUserId || peerUserId === userId) return;
    if (!onOpenDm && !onCallPeer && !onVideoPeer) return;
    evt?.preventDefault?.();
    evt?.stopPropagation?.();
    const x = evt?.clientX ?? Math.min(window.innerWidth - 200, 120);
    const y = evt?.clientY ?? 120;
    setPeerMenu({ userId: peerUserId, displayName: displayName || 'Usuario', x, y });
    setShowMembers(false);
  }

  useEffect(() => {
    if (!peerMenu && !showMembers) return undefined;
    const close = (e) => {
      if (e.target?.closest?.('.wa-peer-menu') || e.target?.closest?.('.wa-members-panel')) return;
      setPeerMenu(null);
      setShowMembers(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close);
    };
  }, [peerMenu, showMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if (m.isDeleted) return 'mensaje eliminado'.includes(q);
      const blob = `${m.displayName || ''} ${m.body || ''} ${m.mediaName || ''} ${m.sticker?.label || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [messages, search]);

  function nearBottom(el) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  function scrollLogToEnd(behavior = 'auto') {
    const el = logRef.current;
    if (!el) {
      endRef.current?.scrollIntoView({ behavior });
      return;
    }
    if (behavior === 'smooth') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  useEffect(() => {
    const el = logRef.current;
    if (chatActiveRef.current && !chatActive) {
      if (el) savedScrollRef.current = el.scrollTop;
    }
    if (!chatActiveRef.current && chatActive && el && savedScrollRef.current != null) {
      const top = savedScrollRef.current;
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = top;
      });
    }
    chatActiveRef.current = chatActive;
  }, [chatActive]);

  useEffect(() => {
    if (!chatActive || !stickToBottomRef.current) return;
    scrollLogToEnd('auto');
  }, [filtered.length, typingLabel, chatActive]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (chatActive && stickToBottomRef.current) scrollLogToEnd('auto');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chatActive]);

  useEffect(() => {
    if (!menuMsgId) return undefined;
    const close = () => {
      setMenuMsgId(null);
      setMenuPos(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', close), 0);
    const onEsc = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        close();
      }
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

  function closeMsgMenu() {
    setMenuMsgId(null);
    setMenuPos(null);
    setReactPickerId(null);
  }

  useEffect(
    () => () => {
      clearTimeout(actionHintTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!onMarkRead || !messages.length) return undefined;
    const last = [...messages].reverse().find((m) => !m.isDeleted && m.type !== 'system');
    if (!last?.id) return undefined;
    const t = setTimeout(() => onMarkRead(last.id), 400);
    return () => clearTimeout(t);
  }, [messages, onMarkRead]);

  function emitTyping(on) {
    onTyping?.(on);
  }

  function onDraftChange(value) {
    setDraft(value);
    if (!editing) {
      emitTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => emitTyping(false), 1200);
    }
  }

  function startEdit(m) {
    if (!canModerate(m) || m.type !== 'text' || !m.body) return;
    setEditing(m);
    setDraft(m.body);
    setReplyTo(null);
    setMenuMsgId(null);
    setShowAttach(false);
    setShowPicker(false);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  async function handleSend(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setShowPicker(false);
    emitTyping(false);

    if (editing) {
      const id = editing.id;
      setEditing(null);
      await onEdit?.(id, text);
      return;
    }

    const reply = replyTo;
    setReplyTo(null);
    await onSend(text, { replyToId: reply?.id });
  }

  async function confirmDelete(m) {
    setMenuMsgId(null);
    if (!canModerate(m)) return;
    setDeleteTarget(m);
  }

  async function runDeleteMessage() {
    const m = deleteTarget;
    if (!m) return;
    setDeleteBusy(true);
    try {
      if (editing?.id === m.id) cancelEdit();
      await onDelete?.(m.id);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  function pickReaction(m, emoji) {
    setReactPickerId(null);
    setMenuMsgId(null);
    onReact?.(m.id, emoji);
  }

  async function sendSticker(sticker) {
    if (!sticker?.id || editing) return;
    const reply = replyTo;
    setReplyTo(null);
    setShowPicker(false);
    await onSendSticker?.(sticker.id, { replyToId: reply?.id });
  }

  async function pickFile(file, type) {
    if (!file || editing) return;
    setShowAttach(false);
    if (type === 'image' || isImageFile(file)) {
      setMediaComposer({
        key: Date.now(),
        files: [file],
        caption: draft,
      });
      return;
    }
    setUploading(true);
    try {
      await onSendMedia(file, {
        type,
        body: draft.trim() || undefined,
        replyToId: replyTo?.id,
      });
      setDraft('');
      setReplyTo(null);
    } finally {
      setUploading(false);
    }
  }

  function openImages(fileList, caption) {
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) return;
    setShowAttach(false);
    setMediaComposer({
      key: Date.now(),
      files,
      caption: caption ?? draft,
    });
  }

  function takeFilesFromInput(input) {
    const files = Array.from(input?.files || []);
    if (input) input.value = '';
    return files;
  }

  function onComposerPaste(e) {
    if (editing) return;
    const imgs = filesFromClipboard(e.clipboardData);
    if (!imgs.length) return;
    e.preventDefault();
    openImages(imgs, draft);
  }

  async function sendComposerImages(files, caption) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        await onSendMedia(files[i], {
          type: 'image',
          body: i === 0 ? caption || undefined : undefined,
          replyToId: replyTo?.id,
        });
      }
      setDraft('');
      setReplyTo(null);
    } finally {
      setUploading(false);
    }
  }

  async function startVoice() {
    if (editing || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
    try {
      const stream = await getVoiceStream();
      const rec = createVoiceRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data?.size) chunks.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || 'audio/webm;codecs=opus';
        const blob = new Blob(chunks.current, { type: mime });
        if (blob.size < 800) return;
        const ext = voiceFileExtension(mime);
        const file = new File([blob], `nota-voz.${ext}`, { type: mime.split(';')[0] });
        setUploading(true);
        try {
          await onSendMedia(file, { type: 'audio', replyToId: replyTo?.id });
          setReplyTo(null);
        } finally {
          setUploading(false);
        }
      };
      mediaRec.current = rec;
      // Sin timeslice pequeño: un solo contenedor Opus al soltar (menos cortes/artefactos)
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  function stopVoice() {
    if (mediaRec.current && mediaRec.current.state !== 'inactive') {
      mediaRec.current.stop();
    }
    mediaRec.current = null;
    setRecording(false);
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

  async function copyMsg(m) {
    const text = m.body || m.mediaName || '';
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    showActionHint(ok ? 'Copiado' : 'No se pudo copiar');
    setMenuMsgId(null);
    setMenuPos(null);
  }

  async function copyMsgImage(m) {
    if (!m.mediaUrl || !isImageMessage(m)) return;
    setMenuMsgId(null);
    setMenuPos(null);
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
    setMenuMsgId(null);
    setMenuPos(null);
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
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              startEdit(m);
              setMenuPos(null);
            }}
          >
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

  return (
    <section className="wa-chat">
      <header className="wa-header">
        <div className="wa-header-main">
          <PersonAvatar
            groupId={groupId}
            avatarUrl={groupAvatarUrl}
            name={groupName}
            token={token}
            group
            className="wa-avatar"
          />
          <button
            type="button"
            className="wa-header-info"
            onClick={() => {
              if (!onOpenDm && !onCallPeer && !onVideoPeer) return;
              setShowMembers((v) => !v);
              setPeerMenu(null);
            }}
            title="Ver miembros · mensaje o llamada personal"
          >
            <h2>{groupName || 'Chat'}</h2>
            <p className="wa-subtitle">
              {typingLabel
                ? typingLabel
                : onlineCount > 0
                  ? `${onlineCount} en línea · tocar para contactar`
                  : 'Canal del grupo · tocar miembros'}
            </p>
          </button>
        </div>
        <div className="wa-header-actions">
          {onToggleFavorite && (
            <button
              type="button"
              className={`wa-inbox-fav-btn${favorite ? ' on' : ''}`}
              onClick={onToggleFavorite}
              title={favorite ? 'Quitar de favoritos' : 'Favorito'}
              aria-label="Favorito"
            >
              <StarIcon size="1rem" />
            </button>
          )}
          {onGroupVideo && (
            <button
              type="button"
              className={`wa-group-video-btn${groupVideoActive ? ' live' : ''}`}
              title={groupVideoActive ? 'Transmisión en curso — entrar' : 'Iniciar o unirse a video grupal en vivo'}
              onClick={() => onGroupVideo()}
            >
              <span className="wa-group-video-dot" aria-hidden="true" />
              Video en vivo
            </button>
          )}
          <button
            type="button"
            className="wa-icon-btn"
            title="Buscar"
            onClick={() => setShowSearch((v) => !v)}
          >
            🔍
          </button>
        </div>
      </header>

      {showMembers && (
        <div className="wa-members-panel" onMouseDown={(e) => e.stopPropagation()}>
          <strong>Miembros</strong>
          {rosterLoading && <p className="wa-empty">Cargando…</p>}
          {!rosterLoading && members.length === 0 && (
            <p className="wa-empty">Sin miembros visibles</p>
          )}
          {members.map((m) => (
            <div key={m.userId} className="wa-member-row">
              <button
                type="button"
                className="wa-member-row-main"
                onClick={() =>
                  openGlobalPeerSheet({
                    id: m.userId,
                    displayName: m.displayName,
                    avatarUrl: m.avatarUrl,
                    username: m.username,
                  })
                }
              >
                <PersonAvatar
                  userId={m.userId}
                  name={m.displayName}
                  avatarUrl={m.avatarUrl}
                  token={token}
                  className="wa-member-list-avatar"
                />
                <span>
                  {m.displayName}
                  {m.online ? ' · en línea' : ''}
                </span>
              </button>
              <span className="wa-member-row-actions">
                {onOpenDm && (
                  <button
                    type="button"
                    title="Mensaje"
                    onClick={() => {
                      onOpenDm({ id: m.userId, displayName: m.displayName });
                      setShowMembers(false);
                    }}
                  >
                    💬
                  </button>
                )}
                <button
                  type="button"
                  title="Llamada"
                  onClick={() => {
                    startVoiceCall({ id: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl });
                    setShowMembers(false);
                  }}
                >
                  📞
                </button>
                <button
                  type="button"
                  title="Videollamada"
                  onClick={() => {
                    startVideoCall({ id: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl });
                    setShowMembers(false);
                  }}
                >
                  📹
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {peerMenu && (
        <div
          className="wa-peer-menu wa-context-menu is-floating"
          style={{ top: peerMenu.y, left: peerMenu.x }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="wa-peer-menu-title">{peerMenu.displayName}</p>
          {onOpenDm && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenDm({ id: peerMenu.userId, displayName: peerMenu.displayName });
                setPeerMenu(null);
                setShowMembers(false);
              }}
            >
              Mensaje personal
            </button>
          )}
          {onCallPeer && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCallPeer({ id: peerMenu.userId, displayName: peerMenu.displayName });
                setPeerMenu(null);
                setShowMembers(false);
              }}
            >
              Llamada personal
            </button>
          )}
          {onVideoPeer && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onVideoPeer({ id: peerMenu.userId, displayName: peerMenu.displayName });
                setPeerMenu(null);
                setShowMembers(false);
              }}
            >
              Videollamada
            </button>
          )}
        </div>
      )}

      {showSearch && (
        <div className="wa-search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el chat…"
            autoFocus
          />
        </div>
      )}

      <div
        className="wa-log"
        role="log"
        ref={logRef}
        onScroll={() => {
          stickToBottomRef.current = nearBottom(logRef.current);
        }}
      >
        {filtered.length === 0 && (
          <p className="wa-empty">
            {search ? 'Sin resultados' : 'Sin mensajes aún. Escribe el primero.'}
          </p>
        )}
        {filtered.map((m, i) => {
          const mine = m.senderId === userId;
          const deleted = Boolean(m.isDeleted);
          const prev = i > 0 ? filtered[i - 1] : null;
          const clusteredAbove =
            !mine &&
            prev &&
            !prev.isDeleted &&
            prev.type !== 'system' &&
            prev.senderId === m.senderId;
          if (!deleted && m.type === 'system') {
            const isPanic =
              (m.body || '').includes('PÁNICO') || (m.body || '').includes('ALERTA');
            return (
              <div key={m.id} className={`wa-row system${isPanic ? ' panic' : ''}`}>
                <p className="wa-system-msg">{m.body}</p>
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`wa-row ${mine ? 'mine' : 'theirs'}${clusteredAbove ? ' clustered' : ''}`}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!deleted) openMsgMenu(m, e.clientX, e.clientY);
              }}
            >
              <div className="wa-msg-main">
                {!mine &&
                  (clusteredAbove ? (
                    <span className="wa-bubble-avatar-spacer" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className="wa-bubble-avatar-btn"
                      title={m.displayName || 'Operador'}
                      onClick={(e) => openPeerMenu(m.senderId, m.displayName, e)}
                    >
                      <PersonAvatar
                        userId={m.senderId}
                        name={m.displayName}
                        avatarUrl={m.senderAvatarUrl || null}
                        token={token}
                        className="wa-bubble-avatar"
                      />
                    </button>
                  ))}
                <div
                  className={`wa-bubble ${mine ? 'mine' : 'theirs'}${deleted ? ' deleted' : ''}${
                    !deleted && m.type === 'sticker' ? ' sticker' : ''
                  }`}
                >
                  {!mine && !clusteredAbove && (
                    <button
                      type="button"
                      className="wa-name wa-name-btn"
                      onClick={(e) => openPeerMenu(m.senderId, m.displayName, e)}
                    >
                      {m.displayName}
                    </button>
                  )}
                  {deleted ? (
                    <p className="wa-text wa-deleted">Mensaje eliminado</p>
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
                      {m.type === 'sticker' && m.sticker ? (
                        <div className="wa-sticker" title={m.sticker.label || 'Sticker'}>
                          {m.sticker.kind === 'emoji' ? (
                            <span className="wa-sticker-emoji" role="img" aria-label={m.sticker.label}>
                              {m.sticker.value}
                            </span>
                          ) : (
                            <img src={m.sticker.value} alt={m.sticker.label || 'Sticker'} />
                          )}
                        </div>
                      ) : (
                        <>
                          {m.mediaUrl && (
                            <ChatMedia
                              token={token}
                              message={m}
                              onActionHint={showActionHint}
                              onOpenImage={openImageGallery}
                              onLightboxChange={(open) => {
                                if (open) closeMsgMenu();
                              }}
                            />
                          )}
                          {m.body && <LinkifiedText text={m.body} className="wa-text" />}
                        </>
                      )}
                    </>
                  )}
                  <div className="wa-meta">
                    {!deleted && m.editedAt && <span className="wa-edited">editado</span>}
                    <time>{formatTime(m.createdAt)}</time>
                    {mine && !deleted && m.type !== 'system' && (
                      <span
                        className={`wa-ticks${m.readCount > 0 ? ' read' : ''}${m.readFully ? ' full' : ''}`}
                        title={
                          m.readFully
                            ? 'Leído por todos'
                            : m.readCount > 0
                              ? `Leído por ${m.readCount}`
                              : 'Enviado'
                        }
                      >
                        {'\u2713\u2713'}
                      </span>
                    )}
                  </div>
                </div>
                {!deleted && (
                  <button
                    type="button"
                    className="wa-bubble-menu-btn"
                    title="Opciones"
                    aria-label="Opciones del mensaje"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuMsgId === m.id) {
                        setMenuMsgId(null);
                        setMenuPos(null);
                      } else {
                        const r = e.currentTarget.getBoundingClientRect();
                        openMsgMenu(m, r.left, r.bottom + 4);
                      }
                    }}
                  >
                    ⋯
                  </button>
                )}
              </div>
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
                  {REACTION_EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => pickReaction(m, e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {menuMsgId === m.id && !deleted && !menuPos && renderMsgMenu(m)}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

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
              <strong>Respondiendo a {replyTo.displayName}</strong>
              <span>{replyPreview(replyTo)}</span>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar">
              ✕
            </button>
          </div>
        )
      )}

      {showAttach && !editing && (
        <div className="wa-attach-menu" role="menu" aria-label="Adjuntar">
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

      {menuMsgId && menuPos && (() => {
        const m = filtered.find((x) => x.id === menuMsgId);
        return m && !m.isDeleted ? renderMsgMenu(m) : null;
      })()}

      {actionHint && (
        <p className="wa-action-hint" role="status" aria-live="polite">
          {actionHint}
        </p>
      )}

      <div className="wa-composer-wrap">
        {chatError && (
          <button
            type="button"
            className="composer-error-balloon"
            onClick={() => onDismissChatError?.()}
            title="Cerrar"
          >
            {chatError}
          </button>
        )}
        <WaEmojiPicker
          token={token}
          open={showPicker && !editing}
          onClose={() => setShowPicker(false)}
          onPickEmoji={(e) => {
            onDraftChange(draft + e);
          }}
          onPickSticker={sendSticker}
        />
        <form className="wa-composer" onSubmit={handleSend}>
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
              pickFile(f, 'video');
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
                setActionHint('Solo documentos (PDF, Word, Excel, PowerPoint, texto, etc.)');
                return;
              }
              pickFile(f, 'file');
            }}
          />

          {!editing && (
            <>
              <button
                type="button"
                className="wa-icon-btn"
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
                className={`wa-icon-btn${showPicker ? ' is-active' : ''}`}
                title={showPicker ? 'Cerrar emojis' : 'Emojis y stickers'}
                onClick={() => {
                  setShowAttach(false);
                  setShowPicker((v) => !v);
                }}
              >
                {showPicker ? '⌨️' : '🙂'}
              </button>
            </>
          )}

          <input
            className="wa-input"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onPaste={onComposerPaste}
            placeholder={editing ? 'Editar mensaje…' : 'Escribe un mensaje'}
            maxLength={2000}
            autoComplete="off"
            onFocus={() => setShowPicker(false)}
          />

          {draft.trim() || editing ? (
            <button type="submit" className="wa-send" disabled={uploading || !draft.trim()}>
              {editing ? 'Guardar' : 'Enviar'}
            </button>
          ) : (
            <button
              type="button"
              className={`wa-send voice ${recording ? 'rec' : ''}`}
              disabled={uploading}
              onPointerDown={(e) => {
                e.preventDefault();
                startVoice();
              }}
              onPointerUp={stopVoice}
              onPointerCancel={stopVoice}
              title="Mantén para nota de voz"
            >
              {recording ? '■' : '🎤'}
            </button>
          )}
        </form>
      </div>

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

      {imageGallery && (
        <ImageGalleryLightbox
          token={token}
          items={imageGallery.items}
          index={imageGallery.index}
          onClose={() => setImageGallery(null)}
        />
      )}

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
    </section>
  );
}
