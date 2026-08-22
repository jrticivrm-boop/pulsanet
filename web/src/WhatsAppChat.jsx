import { useEffect, useMemo, useRef, useState } from 'react';
import ChatMedia from './ChatMedia';
import { fetchStickerPacks } from './api';
import { createVoiceRecorder, getVoiceStream, voiceFileExtension } from './voiceRecord';

const EMOJIS = ['😀', '😂', '😍', '👍', '👎', '🙏', '🔥', '✅', '❌', '🎉', '📍', '⚠️', '📻', '💬'];
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
  if (reply.type === 'file') return `📎 ${reply.mediaName || 'Archivo'}`;
  return (reply.body || '').slice(0, 80);
}

/**
 * Chat de grupo estilo WhatsApp (Radio).
 */
export default function WhatsAppChat({
  token,
  userId,
  userRole,
  groupName,
  onlineCount = 0,
  typingLabel = '',
  messages = [],
  chatError,
  onSend,
  onSendMedia,
  onSendSticker,
  onMarkRead,
  onEdit,
  onDelete,
  onReact,
  onTyping,
}) {
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [stickerTab, setStickerTab] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [reactPickerId, setReactPickerId] = useState(null);

  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const mediaRec = useRef(null);
  const chunks = useRef([]);

  const canModerate = (m) =>
    !m.isDeleted &&
    (m.senderId === userId ||
      userRole === 'root' ||
      userRole === 'admin' ||
      userRole === 'dispatcher');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if (m.isDeleted) return 'mensaje eliminado'.includes(q);
      const blob = `${m.displayName || ''} ${m.body || ''} ${m.mediaName || ''} ${m.sticker?.label || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [messages, search]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length, typingLabel]);

  useEffect(() => {
    if (!onMarkRead || !messages.length) return undefined;
    const last = [...messages].reverse().find((m) => !m.isDeleted && m.type !== 'system');
    if (!last?.id) return undefined;
    const t = setTimeout(() => onMarkRead(last.id), 400);
    return () => clearTimeout(t);
  }, [messages, onMarkRead]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchStickerPacks(token)
      .then((data) => {
        if (!cancelled) setStickerPacks(data.packs || []);
      })
      .catch(() => {
        if (!cancelled) setStickerPacks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    setShowEmoji(false);
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
    setShowEmoji(false);
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
    if (!window.confirm('¿Eliminar este mensaje para todos?')) return;
    if (editing?.id === m.id) cancelEdit();
    await onDelete?.(m.id);
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
    setShowStickers(false);
    await onSendSticker?.(sticker.id, { replyToId: reply?.id });
  }

  async function pickFile(file, type) {
    if (!file || editing) return;
    setShowAttach(false);
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

  function copyMsg(m) {
    const text = m.body || m.mediaName || '';
    if (text) navigator.clipboard?.writeText(text).catch(() => {});
    setMenuMsgId(null);
  }

  return (
    <section className="wa-chat">
      <header className="wa-header">
        <div className="wa-header-main">
          <div className="wa-avatar" aria-hidden="true">
            {(groupName || 'C').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2>{groupName || 'Chat'}</h2>
            <p className="wa-subtitle">
              {typingLabel
                ? typingLabel
                : onlineCount > 0
                  ? `${onlineCount} en línea`
                  : 'Canal del grupo'}
            </p>
          </div>
        </div>
        <div className="wa-header-actions">
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

      <div className="wa-log" role="log">
        {filtered.length === 0 && (
          <p className="wa-empty">
            {search ? 'Sin resultados' : 'Sin mensajes aún. Escribe el primero.'}
          </p>
        )}
        {filtered.map((m) => {
          const mine = m.senderId === userId;
          const deleted = Boolean(m.isDeleted);
          if (!deleted && m.type === 'system') {
            const isPanic = (m.body || '').includes('PÁNICO');
            return (
              <div key={m.id} className={`wa-row system${isPanic ? ' panic' : ''}`}>
                <p className="wa-system-msg">{m.body}</p>
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`wa-row ${mine ? 'mine' : 'theirs'}`}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!deleted) {
                  setReactPickerId(null);
                  setMenuMsgId(m.id);
                }
              }}
            >
              <div className="wa-msg-main">
                <div
                  className={`wa-bubble ${mine ? 'mine' : 'theirs'}${deleted ? ' deleted' : ''}${
                    !deleted && m.type === 'sticker' ? ' sticker' : ''
                  }`}
                >
                  {!mine && <strong className="wa-name">{m.displayName}</strong>}
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
                          {m.mediaUrl && <ChatMedia token={token} message={m} />}
                          {m.body && <p className="wa-text">{m.body}</p>}
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
                        ✓✓
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
                      setMenuMsgId((id) => (id === m.id ? null : m.id));
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
              {menuMsgId === m.id && !deleted && (
                <div className="wa-msg-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setReactPickerId(m.id);
                      setMenuMsgId(null);
                    }}
                  >
                    Reaccionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(m);
                      setMenuMsgId(null);
                    }}
                  >
                    Responder
                  </button>
                  {m.body && (
                    <button type="button" onClick={() => copyMsg(m)}>
                      Copiar
                    </button>
                  )}
                  {canModerate(m) && m.type === 'text' && m.body && (
                    <button type="button" onClick={() => startEdit(m)}>
                      Editar
                    </button>
                  )}
                  {canModerate(m) && (
                    <button type="button" className="danger" onClick={() => confirmDelete(m)}>
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={() => setMenuMsgId(null)}>
                    Cerrar
                  </button>
                </div>
              )}
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

      {showEmoji && (
        <div className="wa-emoji-bar" role="listbox">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onDraftChange(draft + e);
                setShowEmoji(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {showStickers && (
        <div className="wa-sticker-panel">
          <div className="wa-sticker-tabs">
            {stickerPacks.map((pack, idx) => (
              <button
                key={pack.id}
                type="button"
                className={stickerTab === idx ? 'active' : ''}
                onClick={() => setStickerTab(idx)}
              >
                {pack.name}
              </button>
            ))}
            <button type="button" className="wa-sticker-close" onClick={() => setShowStickers(false)}>
              ✕
            </button>
          </div>
          <div className="wa-sticker-grid">
            {(stickerPacks[stickerTab]?.stickers || []).map((s) => (
              <button
                key={s.id}
                type="button"
                className="wa-sticker-pick"
                title={s.label}
                onClick={() => sendSticker(s)}
              >
                <span>{s.value}</span>
              </button>
            ))}
            {stickerPacks.length === 0 && (
              <p className="wa-empty">No hay stickers disponibles</p>
            )}
          </div>
        </div>
      )}

      {showAttach && !editing && (
        <div className="wa-attach-menu">
          <button type="button" onClick={() => imageRef.current?.click()}>
            📷 Foto
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            📄 Documento
          </button>
          <button type="button" onClick={() => setShowAttach(false)}>
            Cancelar
          </button>
        </div>
      )}

      {chatError && <p className="error wa-error">{chatError}</p>}

      <form className="wa-composer" onSubmit={handleSend}>
        <input
          ref={imageRef}
          type="file"
          className="sr-only"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            pickFile(f, 'image');
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.mp4,.mov,image/*,audio/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            const kind = f?.type?.startsWith('image/')
              ? 'image'
              : f?.type?.startsWith('audio/')
                ? 'audio'
                : 'file';
            pickFile(f, kind);
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
                setShowEmoji(false);
                setShowStickers(false);
                setShowAttach((v) => !v);
              }}
            >
              {uploading ? '…' : '+'}
            </button>
            <button
              type="button"
              className="wa-icon-btn"
              title="Stickers"
              onClick={() => {
                setShowAttach(false);
                setShowEmoji(false);
                setShowStickers((v) => !v);
              }}
            >
              🎭
            </button>
            <button
              type="button"
              className="wa-icon-btn"
              title="Emoji"
              onClick={() => {
                setShowAttach(false);
                setShowStickers(false);
                setShowEmoji((v) => !v);
              }}
            >
              🙂
            </button>
          </>
        )}

        <input
          className="wa-input"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={editing ? 'Editar mensaje…' : 'Mensaje'}
          maxLength={2000}
          autoComplete="off"
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
    </section>
  );
}
