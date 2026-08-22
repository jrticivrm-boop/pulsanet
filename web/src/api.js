const API_BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'tacticalptx_session';

export async function api(path, { token, method = 'GET', body, _retried } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !_retried && !path.includes('/auth/')) {
    const refreshed = await tryRefreshStoredSession();
    if (refreshed?.token) {
      return api(path, { token: refreshed.token, method, body, _retried: true });
    }
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

async function tryRefreshStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.refreshToken) return null;
    const data = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).then((r) => r.json());
    if (!data.ok) return null;
    const next = {
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('tacticalptx:session', { detail: next }));
    return next;
  } catch {
    return null;
  }
}

export function changePassword(token, { currentPassword, newPassword }) {
  return api('/api/auth/change-password', {
    token,
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export function login(username, password) {
  return api('/api/auth/login', { method: 'POST', body: { username, password } });
}

export function refreshAuth(refreshToken) {
  return api('/api/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function fetchGroups(token) {
  return api('/api/groups', { token });
}

export function fetchLiveKitToken(token, groupId, { listenOnly = false } = {}) {
  return api('/api/livekit/token', {
    token,
    method: 'POST',
    body: { groupId, listenOnly: Boolean(listenOnly) },
  });
}

export function fetchLiveKitStatus(token) {
  return api('/api/livekit/status', { token });
}

export function fetchContacts(token) {
  return api('/api/dm/contacts', { token });
}

export function fetchDmConversations(token) {
  return api('/api/dm/conversations', { token });
}

export function fetchDmMessages(token, userId) {
  return api(`/api/dm/${userId}/messages`, { token });
}

export function sendDmMessage(token, userId, body, { replyToId } = {}) {
  return api(`/api/dm/${userId}/messages`, {
    token,
    method: 'POST',
    body: { body, replyToId },
  });
}

export function startPrivateCall(token, targetUserId) {
  return api('/api/calls/private', {
    token,
    method: 'POST',
    body: { targetUserId },
  });
}

export function acceptPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/accept`, { token, method: 'POST' });
}

export function endPrivateCall(token, callId, reason = 'hangup') {
  return api(`/api/calls/private/${callId}/end`, {
    token,
    method: 'POST',
    body: { reason },
  });
}

export function fetchMessages(token, groupId, limit = 50) {
  return api(`/api/groups/${groupId}/messages?limit=${limit}`, { token });
}

export function sendMessage(token, groupId, body, { replyToId } = {}) {
  return api(`/api/groups/${groupId}/messages`, {
    token,
    method: 'POST',
    body: { body, replyToId },
  });
}

export function editMessage(token, groupId, messageId, body) {
  return api(`/api/groups/${groupId}/messages/${messageId}`, {
    token,
    method: 'PATCH',
    body: { body },
  });
}

export function deleteMessage(token, groupId, messageId) {
  return api(`/api/groups/${groupId}/messages/${messageId}`, {
    token,
    method: 'DELETE',
  });
}

export function reactToMessage(token, groupId, messageId, emoji) {
  return api(`/api/groups/${groupId}/messages/${messageId}/reactions`, {
    token,
    method: 'POST',
    body: { emoji },
  });
}

export function fetchStickerPacks(token) {
  return api('/api/stickers', { token });
}

export function sendSticker(token, groupId, stickerId, { replyToId } = {}) {
  return api(`/api/groups/${groupId}/messages/sticker`, {
    token,
    method: 'POST',
    body: { stickerId, replyToId },
  });
}

export function markMessagesRead(token, groupId, upToMessageId) {
  return api(`/api/groups/${groupId}/messages/read`, {
    token,
    method: 'POST',
    body: { upToMessageId },
  });
}

export function fetchOverview(token) {
  return api('/api/admin/overview', { token });
}

export function fetchAdminUsers(token) {
  return api('/api/admin/users', { token });
}

export function previewAdminUsername(token, payload) {
  return api('/api/admin/users/preview-username', { token, method: 'POST', body: payload });
}

export function createAdminUser(token, payload) {
  return api('/api/admin/users', { token, method: 'POST', body: payload });
}

export function patchAdminUser(token, id, payload) {
  return api(`/api/admin/users/${id}`, { token, method: 'PATCH', body: payload });
}

export function deleteAdminUser(token, id) {
  return api(`/api/admin/users/${id}`, { token, method: 'DELETE' });
}

export function fetchAdminGroups(token) {
  return api('/api/admin/groups', { token });
}

export function createGroup(token, payload) {
  return api('/api/groups', { token, method: 'POST', body: payload });
}

export function patchAdminGroup(token, id, payload) {
  return api(`/api/admin/groups/${id}`, { token, method: 'PATCH', body: payload });
}

export function deleteAdminGroup(token, id, { hard = false } = {}) {
  const q = hard ? '?hard=1' : '';
  return api(`/api/admin/groups/${id}${q}`, { token, method: 'DELETE' });
}

export function addGroupMember(token, groupId, userId, role = 'member') {
  return api(`/api/admin/groups/${groupId}/members`, {
    token,
    method: 'POST',
    body: { userId, role },
  });
}

export function removeGroupMember(token, groupId, userId) {
  return api(`/api/admin/groups/${groupId}/members/${userId}`, {
    token,
    method: 'DELETE',
  });
}

export function fetchAdminGroupMembers(token, groupId) {
  return api(`/api/admin/groups/${groupId}/members`, { token });
}

export function purgeGroupMessages(token, groupId) {
  return api(`/api/admin/groups/${groupId}/messages/purge`, {
    token,
    method: 'POST',
  });
}

export function fetchLocations(token) {
  return api('/api/locations', { token });
}

export function postLocation(token, { latitude, longitude, accuracyM }) {
  return api('/api/locations', {
    token,
    method: 'POST',
    body: { latitude, longitude, accuracyM },
  });
}

export function fetchUserTrack(token, userId, hours = 8) {
  return api(`/api/locations/${userId}/track?hours=${hours}`, { token });
}

export function fetchGeofences(token) {
  return api('/api/geofences', { token });
}

export function createGeofence(token, body) {
  return api('/api/geofences', { token, method: 'POST', body });
}

export function updateGeofence(token, id, body) {
  return api(`/api/geofences/${id}`, { token, method: 'PATCH', body });
}

export function deleteGeofence(token, id) {
  return api(`/api/geofences/${id}`, { token, method: 'DELETE' });
}

export function fetchRecordings(token, { hours = 24, groupId } = {}) {
  const q = new URLSearchParams({ hours: String(hours) });
  if (groupId) q.set('groupId', groupId);
  return api(`/api/recordings?${q}`, { token });
}

export function fetchPanicEvents(token, { status } = {}) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  const qs = q.toString();
  return api(`/api/panic${qs ? `?${qs}` : ''}`, { token });
}

export function patchPanicEvent(token, id, status) {
  return api(`/api/panic/${id}`, { token, method: 'PATCH', body: { status } });
}

export function triggerPanic(token, payload) {
  return api('/api/panic', { token, method: 'POST', body: payload });
}

export async function uploadPttRecording(token, groupId, blob, durationMs) {
  const form = new FormData();
  const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', blob, `ptt.${ext}`);
  form.append('durationMs', String(durationMs || 0));

  const res = await fetch(`${API_BASE}/api/recordings/groups/${groupId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export function recordingAudioUrl(recordingId, token) {
  // token vía query no; el <audio> no manda Authorization — usamos blob fetch
  return { path: `/api/recordings/${recordingId}/audio`, token };
}

export async function fetchRecordingBlobUrl(token, recordingId) {
  const res = await fetch(`${API_BASE}/api/recordings/${recordingId}/audio`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Audio ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function uploadGroupMedia(token, groupId, file, { type, body, replyToId } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (type) form.append('type', type);
  if (body) form.append('body', body);
  if (replyToId) form.append('replyToId', replyToId);

  const res = await fetch(`${API_BASE}/api/groups/${groupId}/messages/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/** Descarga media autenticada → blob URL (revocar con URL.revokeObjectURL). */
export async function fetchMediaBlobUrl(token, mediaUrl) {
  const res = await fetch(`${API_BASE}${mediaUrl}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('No se pudo cargar media');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function usersCsvUrl() {
  return `${API_BASE}/api/admin/users.csv`;
}

export function canDispatch(user) {
  return user && ['root', 'admin', 'dispatcher'].includes(user.role);
}

export function isRootUser(user) {
  return user?.role === 'root';
}

export function isAdminUser(user) {
  return user && ['root', 'admin'].includes(user.role);
}
