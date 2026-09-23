/** Abrir la página de Chats en despacho (sin acoplar a Radio PTT). */

export const CHATS_EVENTS = {
  OPEN: 'tacticalptx:chats-open',
};

/**
 * @param {{ peerId?: string|null, groupId?: string|null } | undefined} detail
 */
export function openChatsPanel(detail) {
  window.dispatchEvent(new CustomEvent(CHATS_EVENTS.OPEN, { detail: detail || {} }));
}
