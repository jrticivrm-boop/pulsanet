/**
 * Globo de mensaje estilo WhatsApp Web — global en toda la app.
 */

import { isPrivateCallUiOpen } from './privateCallUi.js';

const CHAT_TOAST_EVENT = 'tacticalptx:chat-toast';

/** @type {{ kind: string|null, id: string|null }} */
const activeView = { kind: null, id: null };

/** Registra qué chat tiene el usuario abierto (para no duplicar globo). */
export function setActiveChatView(kind, id) {
  activeView.kind = kind || null;
  activeView.id = id ? String(id) : null;
}

export function clearActiveChatView() {
  activeView.kind = null;
  activeView.id = null;
}

/** ¿Está leyendo este hilo con la pestaña visible? */
export function isViewingChat(kind, id) {
  if (document.hidden) return false;
  if (isPrivateCallUiOpen()) return false;
  if (!kind || !id) return false;
  return activeView.kind === kind && activeView.id === String(id);
}

/**
 * @param {{ kind: 'dm'|'group', peerId?: string, groupId?: string, peerName?: string, title?: string, preview?: string }} payload
 */
export function showChatMessageToast(payload) {
  if (!payload?.kind) return;
  window.dispatchEvent(new CustomEvent(CHAT_TOAST_EVENT, { detail: payload }));
}

export function subscribeChatMessageToast(handler) {
  const onEvt = (e) => handler(e.detail);
  window.addEventListener(CHAT_TOAST_EVENT, onEvt);
  return () => window.removeEventListener(CHAT_TOAST_EVENT, onEvt);
}
