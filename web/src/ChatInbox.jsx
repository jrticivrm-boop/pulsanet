import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WhatsAppChat from './WhatsAppChat';
import DirectChat from './DirectChat';
import PrivateCallOverlay from './PrivateCallOverlay';
import PrivateRadioBar from './PrivateRadioBar';
import { notifyIncomingMessage, setUnreadDocumentTitle, playMessageTone } from './appNotify';
import { setActiveChatView, clearActiveChatView, showChatMessageToast, isViewingChat } from './chatNotify';
import { startPrivateCall, endPrivateCall } from './api';
import StarIcon from './StarIcon';
import { esMsg } from './esMsg';
import PersonAvatar from './PersonAvatar';

const FAV_KEY = 'tacticalptx_chat_favorites';
const TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'unread', label: 'No leídos' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'groups', label: 'Grupos' },
];

function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || '{}');
    return {
      dm: Array.isArray(raw.dm) ? raw.dm : [],
      group: Array.isArray(raw.group) ? raw.group : [],
    };
  } catch {
    return { dm: [], group: [] };
  }
}

function saveFavorites(fav) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(fav));
  } catch {
    /* ignore */
  }
}

function formatListTime(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function previewText(msg) {
  if (!msg) return 'Sin mensajes';
  if (msg.type === 'image') return '📷 Imagen';
  if (msg.type === 'audio') return '🎤 Audio';
  if (msg.type === 'sticker') return 'Sticker';
  if (msg.type === 'file') return '📎 Archivo';
  if (msg.type === 'system') return String(msg.body || 'Aviso').slice(0, 60);
  return String(msg.body || msg.type || 'Conversación').slice(0, 80);
}

/**
 * Inbox estilo WhatsApp: Todos | No leídos | Favoritos | Grupos
 * + panel de chat (grupo o DM).
 */
export default function ChatInbox({
  session,
  groups = [],
  group,
  onSelectGroup,
  ptt,
  focusPeerId,
  focusGroupId,
  chatPanelVisible = true,
  /** Solo chats de estos canales (Hablar en + escucha). Oculta DMs y otros grupos. */
  scopeGroupIds = null,
}) {
  const channelScoped = Array.isArray(scopeGroupIds) && scopeGroupIds.length > 0;
  const [tab, setTab] = useState('all');
  const [favorites, setFavorites] = useState(loadFavorites);
  const [unread, setUnread] = useState({});
  const [dmMeta, setDmMeta] = useState({ conversations: [], contacts: [] });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [peerCall, setPeerCall] = useState(null);
  const lastGroupMsgRef = useRef(null);
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!group?.id) return;
    if (channelScoped) {
      setSelected({
        kind: 'group',
        id: group.id,
        name: group.name,
        avatarUrl: group.avatarUrl || null,
      });
      return;
    }
    setSelected((prev) => {
      if (prev?.kind === 'dm') return prev;
      if (prev?.kind === 'group' && prev.id === group.id) {
        return {
          ...prev,
          name: group.name,
          avatarUrl: group.avatarUrl || prev.avatarUrl || null,
        };
      }
      return {
        kind: 'group',
        id: group.id,
        name: group.name,
        avatarUrl: group.avatarUrl || null,
      };
    });
  }, [group?.id, group?.name, group?.avatarUrl, channelScoped]);

  useEffect(() => {
    if (!focusPeerId) return;
    const conv = dmMeta.conversations.find((c) => c.peerId === focusPeerId);
    const contact = dmMeta.contacts.find((c) => c.id === focusPeerId);
    const name = conv?.peerName || contact?.displayName || 'Chat';
    setSelected({ kind: 'dm', id: focusPeerId, name });
    setTab('all');
    setUnread((u) => {
      const next = { ...u };
      delete next[`dm:${focusPeerId}`];
      return next;
    });
  }, [focusPeerId, dmMeta.conversations, dmMeta.contacts]);

  const bumpUnread = useCallback((key) => {
    setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }, []);

  const clearUnread = useCallback((key) => {
    setUnread((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!focusGroupId) return;
    const g = groups.find((x) => x.id === focusGroupId);
    if (!g) return;
    setSelected({
      kind: 'group',
      id: g.id,
      name: g.name,
      avatarUrl: g.avatarUrl || null,
    });
    setTab('all');
    clearUnread(`group:${g.id}`);
  }, [focusGroupId, groups, clearUnread]);

  useEffect(() => {
    lastGroupMsgRef.current = null;
  }, [group?.id]);

  useEffect(() => {
    if (!chatPanelVisible) {
      clearActiveChatView();
      return;
    }
    if (selected?.kind === 'dm' && selected.id) {
      setActiveChatView('dm', selected.id);
    } else if (selected?.kind === 'group' && selected.id) {
      setActiveChatView('group', selected.id);
    } else {
      clearActiveChatView();
    }
  }, [chatPanelVisible, selected?.kind, selected?.id]);

  useEffect(() => {
    if (!group?.id || !ptt?.messages?.length) return;
    const last = [...ptt.messages].reverse().find((m) => !m.isDeleted && m.type !== 'system');
    if (!last?.id) return;
    if (lastGroupMsgRef.current === null) {
      lastGroupMsgRef.current = last.id;
      return;
    }
    if (lastGroupMsgRef.current === last.id) return;
    lastGroupMsgRef.current = last.id;
    if (last.senderId === session.user.id) return;

    const viewing = isViewingChat('group', group.id);
    if (viewing) {
      clearUnread(`group:${group.id}`);
      playMessageTone({ soft: true });
      return;
    }
    bumpUnread(`group:${group.id}`);
    const title = group.name || 'Grupo';
    const body = `${last.displayName || 'Operador'}: ${previewText(last)}`;
    const showBanner = notifyIncomingMessage({
      title,
      body,
      tag: `group-${group.id}-${last.id}`,
      viewingThisChat: false,
    });
    if (showBanner) {
      showChatMessageToast({
        kind: 'group',
        peerId: group.id,
        peerName: last.displayName || group.name || 'Grupo',
        preview: previewText(last),
        title: group.name || 'Grupo',
        groupId: group.id,
      });
    }
  }, [ptt?.messages, group?.id, group?.name, session.user.id, bumpUnread, clearUnread]);

  useEffect(() => {
    setUnreadDocumentTitle(Object.values(unread).reduce((a, n) => a + (n || 0), 0));
    return () => setUnreadDocumentTitle(0);
  }, [unread]);

  const toggleFavorite = useCallback((kind, id, e) => {
    e?.stopPropagation?.();
    setFavorites((prev) => {
      const list = prev[kind] || [];
      const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      const next = { ...prev, [kind]: nextList };
      saveFavorites(next);
      return next;
    });
  }, []);

  const rows = useMemo(() => {
    const items = [];
    const visibleGroups = channelScoped
      ? groups.filter((g) => scopeGroupIds.includes(g.id))
      : groups;

    for (const g of visibleGroups) {
      const isCurrent = g.id === group?.id;
      const last = isCurrent
        ? [...(ptt?.messages || [])].reverse().find((m) => !m.isDeleted)
        : null;
      items.push({
        key: `group:${g.id}`,
        kind: 'group',
        id: g.id,
        name: g.name,
        avatarUrl: g.avatarUrl || null,
        preview: last ? previewText(last) : 'Canal de grupo',
        at: last?.createdAt || null,
        unread: unread[`group:${g.id}`] || 0,
        favorite: favorites.group.includes(g.id),
      });
    }

    if (!channelScoped) {
      for (const c of dmMeta.conversations) {
        items.push({
          key: `dm:${c.peerId}`,
          kind: 'dm',
          id: c.peerId,
          name: c.peerName,
          avatarUrl: c.peerAvatarUrl || null,
          preview: previewText(c.lastMessage),
          at: c.lastMessage?.createdAt || null,
          unread: unread[`dm:${c.peerId}`] || 0,
          favorite: favorites.dm.includes(c.peerId),
        });
      }

      for (const c of dmMeta.contacts) {
        if (items.some((i) => i.kind === 'dm' && i.id === c.id)) continue;
        items.push({
          key: `dm:${c.id}`,
          kind: 'dm',
          id: c.id,
          name: c.displayName,
          avatarUrl: c.avatarUrl || null,
          preview: 'Toca para escribir',
          at: null,
          unread: unread[`dm:${c.id}`] || 0,
          favorite: favorites.dm.includes(c.id),
          isContactOnly: true,
        });
      }
    }

    items.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if (a.isContactOnly !== b.isContactOnly) return a.isContactOnly ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), 'es');
    });

    return items;
  }, [groups, group?.id, ptt?.messages, dmMeta, unread, favorites, channelScoped, scopeGroupIds]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === 'unread') list = list.filter((r) => r.unread > 0);
    else if (tab === 'favorites') list = list.filter((r) => r.favorite);
    else if (tab === 'groups') list = list.filter((r) => r.kind === 'group');
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.preview).toLowerCase().includes(q)
      );
    } else if (tab === 'all' || tab === 'favorites') {
      list = list.filter((r) => !r.isContactOnly || r.favorite || r.unread > 0);
    }
    return list;
  }, [rows, tab, query]);

  const totalUnread = useMemo(
    () =>
      Object.entries(unread).reduce((sum, [key, n]) => {
        if (channelScoped && !key.startsWith('group:')) return sum;
        if (channelScoped) {
          const gid = key.slice(6);
          if (!scopeGroupIds.includes(gid)) return sum;
        }
        return sum + (n || 0);
      }, 0),
    [unread, channelScoped, scopeGroupIds]
  );

  const hideSidebar = channelScoped && filtered.length <= 1;

  function selectRow(row) {
    setSelected({
      kind: row.kind,
      id: row.id,
      name: row.name,
      avatarUrl: row.avatarUrl || null,
    });
    clearUnread(`${row.kind}:${row.id}`);
    if (row.kind === 'group') {
      onSelectGroup?.(row.id);
    }
  }

  const isFavSelected =
    selected &&
    (selected.kind === 'group'
      ? favorites.group.includes(selected.id)
      : favorites.dm.includes(selected.id));

  const showGroup = selected?.kind === 'group';
  const showDm = selected?.kind === 'dm';
  const visiblePeerId = showDm ? selected.id : null;

  return (
    <div className={`wa-inbox${hideSidebar ? ' wa-inbox--single-channel' : ''}`}>
      {!hideSidebar && (
      <aside className="wa-inbox-list" aria-label="Chats">
        <header className="wa-inbox-head">
          <h2>Chats</h2>
          <p>{channelScoped ? 'Canales seleccionados' : 'Grupos y mensajes directos'}</p>
        </header>

        {!channelScoped && (
        <div className="wa-inbox-tabs" role="tablist" aria-label="Filtros de chat">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`wa-inbox-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'unread' && totalUnread > 0 && (
                <span className="wa-inbox-tab-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </button>
          ))}
        </div>
        )}

        <div className="wa-inbox-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={channelScoped ? 'Buscar en canales…' : 'Buscar o empezar chat…'}
            aria-label="Buscar chat"
          />
        </div>

        <div className="wa-inbox-scroll">
          {filtered.length === 0 && (
            <p className="wa-inbox-empty">
              {channelScoped
                ? 'Sin canales en escucha'
                : tab === 'unread'
                ? 'No hay chats sin leer'
                : tab === 'favorites'
                  ? 'Marca chats con la estrella para verlos aquí'
                  : tab === 'groups'
                    ? 'No hay grupos'
                    : query.trim()
                      ? 'Sin resultados'
                      : 'Sin conversaciones'}
            </p>
          )}
          {filtered.map((row) => {
            const active = selected?.kind === row.kind && selected?.id === row.id;
            return (
              <button
                key={row.key}
                type="button"
                className={`wa-inbox-row${active ? ' active' : ''}${row.unread ? ' unread' : ''}`}
                onClick={() => selectRow(row)}
              >
                <PersonAvatar
                  userId={row.kind === 'dm' ? row.id : null}
                  groupId={row.kind === 'group' ? row.id : null}
                  avatarUrl={row.avatarUrl}
                  name={row.name}
                  token={session.token}
                  group={row.kind === 'group'}
                />
                <span className="wa-inbox-main">
                  <span className="wa-inbox-top">
                    <strong>{row.name}</strong>
                    <time>{formatListTime(row.at)}</time>
                  </span>
                  <span className="wa-inbox-bottom">
                    <span className="wa-inbox-preview">
                      {row.kind === 'group' ? '👥 ' : ''}
                      {row.preview}
                    </span>
                    <span className="wa-inbox-meta">
                      <span
                        className={`wa-inbox-star${row.favorite ? ' on' : ''}`}
                        role="button"
                        tabIndex={0}
                        title={row.favorite ? 'Quitar de favoritos' : 'Favorito'}
                        onClick={(e) => toggleFavorite(row.kind, row.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            toggleFavorite(row.kind, row.id, e);
                          }
                        }}
                      >
                        <StarIcon size="0.95rem" />
                      </span>
                      {row.unread > 0 && (
                        <span className="wa-inbox-badge">
                          {row.unread > 99 ? '99+' : row.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      )}

      <section className="wa-inbox-pane">
        {showDm && channelScoped && (
          <div className="wa-inbox-pane-tools wa-inbox-pane-tools--back">
            <button
              type="button"
              className="wa-inbox-back-btn"
              onClick={() => {
                if (group?.id) {
                  setSelected({
                    kind: 'group',
                    id: group.id,
                    name: group.name,
                    avatarUrl: group.avatarUrl || null,
                  });
                }
              }}
            >
              ← Volver al canal
            </button>
          </div>
        )}
        {!selected && (
          <div className="wa-inbox-placeholder">
            <div className="wa-inbox-placeholder-ico" aria-hidden="true">
              💬
            </div>
            <h3>TacticalPtx Chat</h3>
            <p>Elige un chat o grupo a la izquierda para ver mensajes.</p>
          </div>
        )}

        {showGroup && (
          <div className="wa-inbox-group-wrap">
            <div className="wa-inbox-pane-tools">
              <button
                type="button"
                className={`wa-inbox-fav-btn${isFavSelected ? ' on' : ''}`}
                onClick={() => toggleFavorite('group', selected.id)}
                title="Favorito"
              >
                <StarIcon size="1rem" />
              </button>
            </div>
            <WhatsAppChat
              token={session.token}
              userId={session.user.id}
              userRole={session.user.role}
              groupId={selected.id}
              groupName={selected.name || group?.name}
              groupAvatarUrl={selected.avatarUrl || group?.avatarUrl || null}
              onlineCount={ptt.online.length}
              onlineMembers={ptt.online || []}
              typingLabel={ptt.typingLabel}
              messages={ptt.messages}
              chatError={ptt.chatError}
              chatActive={chatPanelVisible}
              onSend={(text, opts) => ptt.postChat(text, opts)}
              onSendMedia={(file, opts) => ptt.postMedia(file, opts)}
              onEdit={(id, text) => ptt.editChat(id, text)}
              onDelete={(id) => ptt.deleteChat(id)}
              onReact={(id, emoji) => ptt.reactChat(id, emoji)}
              onSendSticker={(stickerId, opts) => ptt.postSticker(stickerId, opts)}
              onMarkRead={(upToId) => {
                ptt.markRead(upToId);
                clearUnread(`group:${selected.id}`);
              }}
              onTyping={ptt.setTyping}
              onOpenDm={(peer) => {
                setSelected({
                  kind: 'dm',
                  id: peer.id,
                  name: peer.displayName || 'Chat',
                });
                clearUnread(`dm:${peer.id}`);
              }}
              onCallPeer={async (peer) => {
                try {
                  const data = await startPrivateCall(session.token, peer.id, { mode: 'call' });
                  setPeerCall({
                    callId: data.call?.callId,
                    peerId: peer.id,
                    peerName: peer.displayName || 'Usuario',
                    token: data.token,
                    authToken: session.token,
                    url: data.url,
                    e2eeKey: data.e2eeKey,
                    role: 'caller',
                    mode: 'call',
                  });
                } catch (e) {
                  window.alert(esMsg(e.message || e, 'No se pudo iniciar la llamada'));
                }
              }}
              onRadioPeer={async (peer) => {
                try {
                  const data = await startPrivateCall(session.token, peer.id, { mode: 'radio' });
                  setPeerCall({
                    callId: data.call?.callId,
                    peerId: peer.id,
                    peerName: peer.displayName || 'Usuario',
                    token: data.token,
                    authToken: session.token,
                    url: data.url,
                    e2eeKey: data.e2eeKey,
                    role: 'caller',
                    mode: 'radio',
                  });
                  // Abrir DM del peer para usar radio en contexto de chat
                  setSelected({
                    kind: 'dm',
                    id: peer.id,
                    name: peer.displayName || 'Usuario',
                  });
                } catch (e) {
                  window.alert(esMsg(e.message || e, 'No se pudo iniciar la radio'));
                }
              }}
            />
          </div>
        )}

        {peerCall?.mode === 'radio' && (
          <div className="wa-inbox-radio-dock">
            <PrivateRadioBar
              call={peerCall}
              onHangup={async (opts) => {
                try {
                  if (peerCall.callId && opts?.remote !== true) {
                    await endPrivateCall(session.token, peerCall.callId, 'hangup');
                  }
                } catch {
                  /* ignore */
                }
                setPeerCall(null);
              }}
            />
          </div>
        )}

        {peerCall && peerCall.mode !== 'radio' && (
          <PrivateCallOverlay
            call={peerCall}
            onHangup={async (opts) => {
              try {
                if (peerCall.callId && opts?.remote !== true) {
                  await endPrivateCall(session.token, peerCall.callId, 'hangup');
                }
              } catch {
                /* ignore */
              }
              setPeerCall(null);
            }}
          />
        )}

        <div
          className={`wa-inbox-dm-host${showDm ? ' visible' : ''}`}
          style={{ display: showDm ? 'flex' : 'none' }}
          aria-hidden={!showDm}
        >
          <DirectChat
            session={session}
            active={showDm}
            visiblePeerId={visiblePeerId}
            embedded
            hideSidebar
            openPeerId={showDm ? selected.id : null}
            onInboxMeta={setDmMeta}
            onUnread={({ peerId }) => {
              const viewing =
                selectedRef.current?.kind === 'dm' && selectedRef.current.id === peerId;
              if (!viewing || document.hidden) bumpUnread(`dm:${peerId}`);
            }}
            onPeerOpened={(p) => {
              clearUnread(`dm:${p.id}`);
              if (selectedRef.current?.kind === 'dm' && selectedRef.current.id === p.id) {
                setSelected({
                  kind: 'dm',
                  id: p.id,
                  name: p.displayName || selectedRef.current.name,
                });
              }
            }}
        onDmToast={(t) => {
              showChatMessageToast(t);
            }}
            favorite={showDm ? isFavSelected : false}
            onToggleFavorite={showDm ? () => toggleFavorite('dm', selected.id) : undefined}
          />
        </div>
      </section>
    </div>
  );
}
