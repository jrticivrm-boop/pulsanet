import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import WhatsAppChat from './WhatsAppChat';
import DirectChat from './DirectChat';
import { notifyIncomingMessage, setUnreadDocumentTitle, playMessageTone } from './appNotify';
import { setActiveChatView, clearActiveChatView, showChatMessageToast, isViewingChat } from './chatNotify';
import { socketIoOptions, socketUrl } from './socketConfig';
import StarIcon from './StarIcon';
import PersonAvatar from './PersonAvatar';
import { PEER_EVENTS, openPeoplePalette, startVideoCall, startVoiceCall } from './peerActions';
import { useIsPhone } from './useMediaQuery.js';
import NewChatSheet from './NewChatSheet.jsx';
import iconTelefono from './assets/icons/telefono.png';
import iconVideollamada from './assets/icons/videollamada.png';
import {
  INBOX_TAB_LABELS,
  compareByLastMessage,
  compareContactRows,
  loadInboxTabOrder,
  moveInboxTab,
  normalizeInboxTabOrder,
  saveInboxTabOrder,
} from './inboxTabOrder.js';

const FAV_KEY = 'tacticalptx_chat_favorites';

function isMemberGroup(g) {
  if (typeof g?.is_member === 'boolean') return g.is_member;
  if (typeof g?.isMember === 'boolean') return g.isMember;
  return true;
}

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
  if (msg.type === 'nudge') return '¡Zumbido!';
  if (msg.type === 'image') return '📷 Imagen';
  if (msg.type === 'audio') return '🎤 Audio';
  if (msg.type === 'sticker') return 'Sticker';
  if (msg.type === 'file') return '📎 Archivo';
  if (msg.type === 'system') return String(msg.body || 'Aviso').slice(0, 60);
  const body = String(msg.body || msg.type || 'Conversación');
  if (body === 'nudge') return '¡Zumbido!';
  return body.slice(0, 80);
}

/**
 * Inbox: Contactos | Grupos | No leídos | Favoritos (chips reordenables).
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
  scopeGroupIds: _scopeGroupIds = null,
}) {
  // scopeGroupIds: reservado (antes filtraba por canales de radio). Inbox WA = todos los grupos miembro + DM.
  const userId = session?.user?.id;
  const [tab, setTab] = useState('contacts');
  const [tabOrder, setTabOrder] = useState(() => loadInboxTabOrder(userId));
  const [favorites, setFavorites] = useState(loadFavorites);
  const [unread, setUnread] = useState({});
  const [dmMeta, setDmMeta] = useState({ conversations: [], contacts: [] });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [groupVideoLive, setGroupVideoLive] = useState({});
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [dragTab, setDragTab] = useState(null);
  const [overTab, setOverTab] = useState(null);
  const lastGroupMsgRef = useRef(null);
  const selectedRef = useRef(selected);
  const isPhone = useIsPhone();

  useEffect(() => {
    setTabOrder(loadInboxTabOrder(userId));
  }, [userId]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // WhatsApp: no forzar el canal de radio como chat abierto (lista primero).
  useEffect(() => {
    if (!group?.id) return;
    setSelected((prev) => {
      if (prev?.kind === 'group' && prev.id === group.id) {
        return {
          ...prev,
          name: group.name,
          avatarUrl: group.avatarUrl || prev.avatarUrl || null,
        };
      }
      return prev;
    });
  }, [group?.id, group?.name, group?.avatarUrl]);

  // Si te sacan de un grupo, quitarlo de la selección (DM viejos se mantienen).
  useEffect(() => {
    if (selected?.kind !== 'group') return;
    const still = groups.some((g) => g.id === selected.id && isMemberGroup(g));
    if (!still) setSelected(null);
  }, [groups, selected]);

  // Bottom nav «Chats» / deep-link: volver a la lista en phone.
  useEffect(() => {
    const onInboxList = () => {
      if (!isPhone) return;
      setSelected(null);
    };
    window.addEventListener('tacticalptx:inbox-list', onInboxList);
    return () => window.removeEventListener('tacticalptx:inbox-list', onInboxList);
  }, [isPhone]);

  useEffect(() => {
    if (!focusPeerId) return;
    const conv = dmMeta.conversations.find((c) => c.peerId === focusPeerId);
    const contact = dmMeta.contacts.find((c) => c.id === focusPeerId);
    const name = conv?.peerName || contact?.displayName || 'Chat';
    setSelected({ kind: 'dm', id: focusPeerId, name });
    setTab('contacts');
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
    const onOpenDm = (e) => {
      const peer = e.detail?.peer;
      if (!peer?.id) return;
      setSelected({
        kind: 'dm',
        id: peer.id,
        name: peer.displayName || 'Chat',
        avatarUrl: peer.avatarUrl || null,
      });
      clearUnread(`dm:${peer.id}`);
    };
    window.addEventListener(PEER_EVENTS.OPEN_DM, onOpenDm);
    return () => window.removeEventListener(PEER_EVENTS.OPEN_DM, onOpenDm);
  }, [clearUnread]);

  const openGroupVideo = useCallback((groupId, groupName) => {
    if (!groupId) return;
    window.dispatchEvent(
      new CustomEvent('tacticalptx:open-group-video', {
        detail: { groupId, groupName: groupName || 'Grupo' },
      })
    );
  }, []);

  useEffect(() => {
    if (!session.token) return undefined;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token: session.token } });
    const onStarted = (payload) => {
      const gid = payload?.groupId;
      if (!gid) return;
      setGroupVideoLive((prev) => ({ ...prev, [gid]: true }));
    };
    const onEnded = (payload) => {
      const gid = payload?.groupId;
      if (!gid) return;
      setGroupVideoLive((prev) => {
        const next = { ...prev };
        delete next[gid];
        return next;
      });
    };
    socket.on('group:video_started', onStarted);
    socket.on('group:video_ended', onEnded);
    socket.connect();
    return () => {
      socket.off('group:video_started', onStarted);
      socket.off('group:video_ended', onEnded);
      socket.disconnect();
    };
  }, [session.token]);

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
    if (!group?.id || !ptt?.messages?.length) {
      /* Al vaciar historial (cambio de canal PTT) no tratar el próximo fetch como mensaje nuevo. */
      if (!ptt?.messages?.length) lastGroupMsgRef.current = null;
      return;
    }
    const last = [...ptt.messages].reverse().find((m) => !m.isDeleted && m.type !== 'system');
    if (!last?.id) return;
    /* Durante el cambio de canal pueden quedar mensajes del grupo anterior un instante. */
    if (last.groupId && String(last.groupId) !== String(group.id)) return;
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

  /** Presencia en vivo desde canales de radio (focus → online/away). */
  const livePresenceById = useMemo(() => {
    const map = new Map();
    const ingest = (list) => {
      for (const m of list || []) {
        const id = String(m?.userId || m?.id || '');
        if (!id) continue;
        const focus = String(m?.focus || 'foreground');
        const next = focus === 'background' || focus === 'service' ? 'away' : 'online';
        const prev = map.get(id);
        if (!prev || (prev === 'away' && next === 'online')) map.set(id, next);
      }
    };
    ingest(ptt?.online);
    for (const list of Object.values(ptt?.onlineByGroup || {})) ingest(list);
    return map;
  }, [ptt?.online, ptt?.onlineByGroup]);

  const contactMetaById = useMemo(() => {
    const map = new Map();
    for (const c of dmMeta.contacts || []) {
      if (!c?.id) continue;
      const id = String(c.id);
      const isSelf = Boolean(c.isSelf) || id === String(userId);
      const live = livePresenceById.get(id);
      let presence = String(
        c.presence || (c.online || isSelf ? 'online' : 'offline')
      ).toLowerCase();
      if (isSelf) presence = 'online';
      else if (live) presence = live;
      map.set(id, {
        online: presence !== 'offline' || isSelf,
        presence,
        gradeSortOrder: Number(c.gradeSortOrder) || 999999,
        grade: c.grade || null,
        isSelf,
      });
    }
    return map;
  }, [dmMeta.contacts, userId, livePresenceById]);

  const rows = useMemo(() => {
    const items = [];
    const chatGroups = groups.filter(isMemberGroup);

    for (const g of chatGroups) {
      const isCurrent = g.id === group?.id;
      const last = isCurrent
        ? [...(ptt?.messages || [])].reverse().find((m) => !m.isDeleted)
        : null;
      const memberCount = Number(g.memberCount ?? g.member_count);
      const onlineN = Array.isArray(ptt?.onlineByGroup?.[g.id])
        ? ptt.onlineByGroup[g.id].length
        : g.id === group?.id
          ? (ptt?.online || []).length
          : 0;
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
        memberCount: Number.isFinite(memberCount) && memberCount > 0 ? memberCount : null,
        onlineCount: onlineN,
      });
    }

    const convPeerIds = new Set();
    for (const c of dmMeta.conversations) {
      const pid = String(c.peerId);
      convPeerIds.add(pid);
      const isSelf = pid === String(userId);
      const live = livePresenceById.get(pid);
      const meta = contactMetaById.get(pid) || {
        online: isSelf || Boolean(live),
        presence: isSelf ? 'online' : live || 'offline',
        gradeSortOrder: 999999,
        isSelf,
      };
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
        contactOnly: false,
        online: meta.online,
        presence: meta.presence,
        gradeSortOrder: meta.gradeSortOrder,
        isSelf: meta.isSelf,
      });
    }

    for (const c of dmMeta.contacts) {
      if (!c?.id || convPeerIds.has(String(c.id))) continue;
      const meta = contactMetaById.get(String(c.id)) || {
        online: Boolean(c.online) || String(c.id) === String(userId),
        presence: String(c.presence || (c.online ? 'online' : 'offline')).toLowerCase(),
        gradeSortOrder: Number(c.gradeSortOrder) || 999999,
        isSelf: Boolean(c.isSelf) || String(c.id) === String(userId),
      };
      items.push({
        key: `dm:${c.id}`,
        kind: 'dm',
        id: c.id,
        name: c.displayName || 'Usuario',
        avatarUrl: c.avatarUrl || null,
        preview: c.isSelf || String(c.id) === String(userId) ? 'Notas / yo mismo' : 'Toca para escribir',
        at: null,
        unread: unread[`dm:${c.id}`] || 0,
        favorite: favorites.dm.includes(c.id),
        contactOnly: true,
        online: meta.online,
        presence: meta.presence,
        gradeSortOrder: meta.gradeSortOrder,
        isSelf: meta.isSelf,
      });
    }

    return items;
  }, [
    groups,
    group?.id,
    ptt?.messages,
    ptt?.online,
    ptt?.onlineByGroup,
    dmMeta.conversations,
    dmMeta.contacts,
    unread,
    favorites,
    contactMetaById,
    livePresenceById,
    userId,
  ]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === 'contacts') {
      list = list.filter((r) => r.kind === 'dm');
      list = [...list].sort(compareContactRows);
    } else if (tab === 'groups') {
      list = list.filter((r) => r.kind === 'group');
      list = [...list].sort(compareByLastMessage);
    } else if (tab === 'unread') {
      list = list.filter((r) => r.unread > 0);
      list = [...list].sort(compareByLastMessage);
    } else if (tab === 'favorites') {
      list = list.filter((r) => r.favorite);
      list = [...list].sort(compareByLastMessage);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.preview).toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, query]);

  const orderedTabs = useMemo(
    () => normalizeInboxTabOrder(tabOrder).map((id) => ({ id, label: INBOX_TAB_LABELS[id] })),
    [tabOrder]
  );

  function persistTabOrder(next) {
    const normalized = normalizeInboxTabOrder(next);
    setTabOrder(normalized);
    saveInboxTabOrder(userId, normalized);
  }

  function onTabDragStart(id, e) {
    setDragTab(id);
    try {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      /* ignore */
    }
  }

  function onTabDrop(toId) {
    if (!dragTab || dragTab === toId) {
      setDragTab(null);
      setOverTab(null);
      return;
    }
    persistTabOrder(moveInboxTab(tabOrder, dragTab, toId));
    setDragTab(null);
    setOverTab(null);
  }

  const totalUnread = useMemo(
    () => Object.values(unread).reduce((sum, n) => sum + (n || 0), 0),
    [unread]
  );

  const phoneThread = isPhone && Boolean(selected);
  const phoneListOnly = isPhone && !selected;

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

  function clearPhoneSelection() {
    setSelected(null);
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
    <div
      className={[
        'wa-inbox',
        phoneThread ? 'wa-inbox--phone-thread' : '',
        phoneListOnly ? 'wa-inbox--phone-list' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside className="wa-inbox-list" aria-label="Chats">
        <header className="wa-inbox-head">
          <div>
            <h2>Chats</h2>
            <p>Grupos y mensajes directos</p>
          </div>
          <div className="wa-inbox-head-actions">
            <button
              type="button"
              className="wa-inbox-new-btn"
              title="Nuevo chat"
              aria-label="Nuevo chat"
              onClick={() => setNewChatOpen(true)}
            >
              +
            </button>
            <button
              type="button"
              className="btn ghost btn-personas"
              title="Buscar personas (Ctrl+K)"
              onClick={() => openPeoplePalette()}
            >
              Personas
            </button>
          </div>
        </header>

        <div className="wa-inbox-tabs" role="tablist" aria-label="Filtros de chat">
          {orderedTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              draggable
              title="Arrastra para reordenar"
              className={`wa-inbox-tab${tab === t.id ? ' active' : ''}${dragTab === t.id ? ' is-dragging' : ''}${overTab === t.id && dragTab && overTab !== dragTab ? ' is-drag-over' : ''}`}
              onClick={() => setTab(t.id)}
              onDragStart={(e) => onTabDragStart(t.id, e)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverTab(t.id);
              }}
              onDragLeave={() => setOverTab((cur) => (cur === t.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                onTabDrop(t.id);
              }}
              onDragEnd={() => {
                setDragTab(null);
                setOverTab(null);
              }}
            >
              {t.label}
              {t.id === 'unread' && totalUnread > 0 && (
                <span className="wa-inbox-tab-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </button>
          ))}
        </div>

        <div className="wa-inbox-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un chat o iniciar uno nuevo"
            aria-label="Buscar chats"
          />
        </div>

        <div className="wa-inbox-scroll">
          {filtered.length === 0 && (
            <p className="wa-inbox-empty">
              {tab === 'unread'
                ? 'No hay chats sin leer'
                : tab === 'favorites'
                  ? 'Marca chats con la estrella para verlos aquí'
                  : tab === 'groups'
                    ? 'No hay grupos'
                    : tab === 'contacts'
                      ? query.trim()
                        ? 'Sin resultados'
                        : 'Sin contactos en tus grupos'
                      : query.trim()
                        ? 'Sin resultados'
                        : 'Sin conversaciones. Pulsa + para iniciar un chat.'}
            </p>
          )}
          {filtered.map((row) => {
            const active = selected?.kind === row.kind && selected?.id === row.id;
            return (
              <div
                key={row.key}
                className={`wa-inbox-row${active ? ' active' : ''}${row.unread ? ' unread' : ''}`}
              >
                <button
                  type="button"
                  className="wa-inbox-row-main"
                  onClick={() => selectRow(row)}
                >
                <PersonAvatar
                  userId={row.kind === 'dm' ? row.id : null}
                  groupId={row.kind === 'group' ? row.id : null}
                  avatarUrl={row.avatarUrl}
                  name={row.name}
                  token={session.token}
                  group={row.kind === 'group'}
                  showPresence={row.kind === 'dm'}
                  presence={row.presence}
                  online={row.online}
                />
                <span className="wa-inbox-main">
                  <span className="wa-inbox-top">
                    <span className="wa-inbox-title">
                      <strong>{row.name}</strong>
                      {row.kind === 'group' && (
                        <span className="wa-inbox-members">
                          {row.memberCount != null
                            ? `${row.memberCount} integrante${row.memberCount === 1 ? '' : 's'}`
                            : ''}
                          {row.memberCount != null ? ' · ' : ''}
                          {row.onlineCount} en línea
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="wa-inbox-bottom">
                    <span className="wa-inbox-preview">
                      {row.kind === 'group' ? '👥 ' : ''}
                      {row.preview}
                    </span>
                    {row.unread > 0 && (
                      <span className="wa-inbox-meta">
                        <span className="wa-inbox-badge">
                          {row.unread > 99 ? '99+' : row.unread}
                        </span>
                      </span>
                    )}
                  </span>
                </span>
                </button>
                <span className="wa-inbox-row-end">
                  <time className="wa-inbox-time">{formatListTime(row.at)}</time>
                  <span className="wa-inbox-row-actions">
                    <button
                      type="button"
                      className={`wa-inbox-row-fav${row.favorite ? ' on' : ''}`}
                      title={row.favorite ? 'Quitar de favoritos' : 'Favorito'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(row.kind, row.id, e);
                      }}
                    >
                      <StarIcon size="1.1rem" />
                    </button>
                    {row.kind === 'dm' && (
                      <>
                        <button
                          type="button"
                          className="wa-inbox-call-btn"
                          title="Llamada"
                          onClick={(e) => {
                            e.stopPropagation();
                            startVoiceCall({ id: row.id, displayName: row.name, avatarUrl: row.avatarUrl });
                          }}
                        >
                          <img src={iconTelefono} alt="" width={18} height={18} draggable={false} />
                        </button>
                        <button
                          type="button"
                          className="wa-inbox-video-btn"
                          title="Videollamada"
                          onClick={(e) => {
                            e.stopPropagation();
                            startVideoCall({ id: row.id, displayName: row.name, avatarUrl: row.avatarUrl });
                          }}
                        >
                          <img src={iconVideollamada} alt="" width={18} height={18} draggable={false} />
                        </button>
                      </>
                    )}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="wa-inbox-pane">
        {isPhone && selected && (
          <div className="wa-inbox-pane-tools--back">
            <button
              type="button"
              className="wa-inbox-back-btn tp-coarse-touch"
              onClick={clearPhoneSelection}
            >
              <span className="wa-inbox-back-ico" aria-hidden="true">
                ←
              </span>
              <span>Chats</span>
            </button>
          </div>
        )}
        {!selected && (
          <div className="wa-inbox-placeholder">
            <div className="wa-inbox-placeholder-ico" aria-hidden="true">
              💬
            </div>
            <h3>Chat SICOM</h3>
            <p>
              {isPhone
                ? 'Elige un chat o grupo de la lista, o pulsa + para escribir a alguien.'
                : 'Elige una conversación de la lista, o pulsa + para un nuevo mensaje.'}
            </p>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: '1rem' }}
              onClick={() => setNewChatOpen(true)}
            >
              Nuevo chat
            </button>
          </div>
        )}

        {showGroup && (
          <div className="wa-inbox-group-wrap">
            <WhatsAppChat
              token={session.token}
              userId={session.user.id}
              userRole={session.user.role}
              groupId={selected.id}
              groupName={selected.name || group?.name}
              groupAvatarUrl={selected.avatarUrl || group?.avatarUrl || null}
              onlineCount={
                (ptt.onlineByGroup?.[selected.id] || (selected.id === group?.id ? ptt.online : []) || [])
                  .length
              }
              onlineMembers={
                ptt.onlineByGroup?.[selected.id] ||
                (selected.id === group?.id ? ptt.online : []) ||
                []
              }
              typingLabel={ptt.typingLabel}
              messages={ptt.messages}
              chatError={ptt.chatError}
              onDismissChatError={ptt.clearChatError}
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
              onCallPeer={(peer) => startVoiceCall(peer)}
              onVideoPeer={(peer) => startVideoCall(peer)}
              onGroupVideo={() =>
                openGroupVideo(selected.id, selected.name || group?.name || 'Grupo')
              }
              groupVideoActive={Boolean(groupVideoLive[selected.id])}
              favorite={isFavSelected}
              onToggleFavorite={() => toggleFavorite('group', selected.id)}
            />
          </div>
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

      <NewChatSheet
        session={session}
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onPick={(peer) => {
          setSelected({
            kind: 'dm',
            id: peer.id,
            name: peer.displayName || 'Chat',
            avatarUrl: peer.avatarUrl || null,
          });
          clearUnread(`dm:${peer.id}`);
          setTab('all');
        }}
      />
    </div>
  );
}
