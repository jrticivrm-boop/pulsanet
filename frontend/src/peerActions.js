/**
 * Acciones peer unificadas (DM / llamada / video / ver cámara / UI).
 * Los hosts escuchan estos CustomEvents en window.
 */

export const PEER_EVENTS = {
  OPEN_DM: 'tacticalptx:open-dm',
  START_CALL: 'tacticalptx:start-private-call',
  OPEN_PEER_SHEET: 'tacticalptx:open-peer-sheet',
  OPEN_PEOPLE_PALETTE: 'tacticalptx:open-people-palette',
  CALL_ACTIVE: 'tacticalptx:private-call-active',
};

function normalizePeer(peer) {
  if (!peer) return null;
  const id = peer.id || peer.userId || peer.peerId;
  if (!id) return null;
  return {
    id: String(id),
    displayName: peer.displayName || peer.peerName || peer.name || peer.callerName || 'Usuario',
    avatarUrl: peer.avatarUrl || peer.peerAvatarUrl || null,
    username: peer.username || null,
    role: peer.role || null,
  };
}

export function openDm(peer) {
  const p = normalizePeer(peer);
  if (!p) return;
  window.dispatchEvent(new CustomEvent(PEER_EVENTS.OPEN_DM, { detail: { peer: p } }));
}

/** @param {'call'|'video'} mode */
export function startPeerCall(peer, { mode = 'call', intent = null } = {}) {
  const p = normalizePeer(peer);
  if (!p) return;
  const m = mode === 'video' ? 'video' : 'call';
  window.dispatchEvent(
    new CustomEvent(PEER_EVENTS.START_CALL, {
      detail: { peer: p, mode: m, intent: intent || null },
    })
  );
}

export function startVoiceCall(peer) {
  startPeerCall(peer, { mode: 'call' });
}

export function startVideoCall(peer) {
  startPeerCall(peer, { mode: 'video' });
}

export function startRemoteCamera(peer) {
  startPeerCall(peer, { mode: 'video', intent: 'remote_camera' });
}

export function openPeerSheet(peer) {
  const p = normalizePeer(peer);
  if (!p) return;
  window.dispatchEvent(new CustomEvent(PEER_EVENTS.OPEN_PEER_SHEET, { detail: { peer: p } }));
}

export function openPeoplePalette(opts = {}) {
  window.dispatchEvent(
    new CustomEvent(PEER_EVENTS.OPEN_PEOPLE_PALETTE, {
      detail: { query: opts.query || '', focus: opts.focus || null },
    })
  );
}

export function publishCallActive(call) {
  window.dispatchEvent(new CustomEvent(PEER_EVENTS.CALL_ACTIVE, { detail: { call: call || null } }));
}

export { normalizePeer };
