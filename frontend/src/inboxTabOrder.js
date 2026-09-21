/** Orden de chips de bandeja (Contactos · Grupos · No leídos · Favoritos). */

export const INBOX_TAB_IDS = ['contacts', 'groups', 'unread', 'favorites'];

export const INBOX_TAB_LABELS = {
  contacts: 'Contactos',
  groups: 'Grupos',
  unread: 'No leídos',
  favorites: 'Favoritos',
};

const LEGACY_MAP = {
  all: 'contacts',
  contacts: 'contacts',
  groups: 'groups',
  unread: 'unread',
  favorites: 'favorites',
};

export function inboxTabOrderStorageKey(userId) {
  return `tacticalptx_chat_tab_order_${userId || 'anon'}`;
}

export function normalizeInboxTabOrder(raw) {
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    const mapped = LEGACY_MAP[String(id)] || null;
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  for (const id of INBOX_TAB_IDS) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function loadInboxTabOrder(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(inboxTabOrderStorageKey(userId)) || 'null');
    return normalizeInboxTabOrder(raw);
  } catch {
    return [...INBOX_TAB_IDS];
  }
}

export function saveInboxTabOrder(userId, order) {
  try {
    localStorage.setItem(
      inboxTabOrderStorageKey(userId),
      JSON.stringify(normalizeInboxTabOrder(order))
    );
  } catch {
    /* ignore */
  }
}

export function moveInboxTab(order, fromId, toId) {
  const next = normalizeInboxTabOrder(order);
  const from = next.indexOf(fromId);
  const to = next.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return next;
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

/** 0 en línea → 1 ausente → 2 fuera de línea → 3 desconectado (paridad APK). */
function presenceSortRank(presence, online) {
  const p = String(presence || '')
    .toLowerCase()
    .trim();
  if (p === 'online' || p === 'radio' || p === 'active' || p === 'foreground') return 0;
  if (p === 'away' || p === 'background' || p === 'service') return 1;
  if (p === 'stale') return 2;
  if (p === 'offline') return 3;
  return online ? 0 : 3;
}

/** Comparador Contactos: presencia → grado militar → último mensaje. */
export function compareContactRows(a, b) {
  const ar = presenceSortRank(a.presence, a.online);
  const br = presenceSortRank(b.presence, b.online);
  if (ar !== br) return ar - br;
  const ag = Number.isFinite(a.gradeSortOrder) ? a.gradeSortOrder : 999999;
  const bg = Number.isFinite(b.gradeSortOrder) ? b.gradeSortOrder : 999999;
  if (ag !== bg) return ag - bg;
  const ta = a.at ? new Date(a.at).getTime() : 0;
  const tb = b.at ? new Date(b.at).getTime() : 0;
  return tb - ta;
}

export function compareByLastMessage(a, b) {
  const ta = a.at ? new Date(a.at).getTime() : 0;
  const tb = b.at ? new Date(b.at).getTime() : 0;
  return tb - ta;
}
