import { esMsg } from './esMsg';
import { getDeviceId } from './deviceId';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'tacticalptx_session';

export async function api(path, { token, method = 'GET', body, _retried, cache } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...(cache ? { cache } : {}),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !_retried && !path.includes('/auth/')) {
    const refreshed = await tryRefreshStoredSession();
    if (refreshed?.token) {
      return api(path, { token: refreshed.token, method, body, _retried: true });
    }
  }

  if (!res.ok) {
    throw new Error(esMsg(data.error || `Error ${res.status}`));
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
      body: JSON.stringify({
        refreshToken: session.refreshToken,
        deviceId: getDeviceId() || undefined,
      }),
    }).then((r) => r.json());
    if (!data.ok) return null;
    const next = {
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
      crypto: data.crypto || undefined,
      avatarTicket: data.avatarTicket || undefined,
    };
    persistSession(next);
    window.dispatchEvent(new CustomEvent('tacticalptx:session', { detail: next }));
    return next;
  } catch {
    return null;
  }
}

/** Exp. del JWT en ms epoch (solo lectura del payload; no verifica firma). */
export function jwtExpiresAtMs(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Renueva el access token antes de que caduque (despacho 24h+).
 * @param {{ minTtlMs?: number, force?: boolean }} [opts]
 * @returns {Promise<object|null>} sesión actualizada o la vigente si aún es fresca
 */
export async function ensureFreshSession(opts = {}) {
  const minTtlMs = opts.minTtlMs ?? 10 * 60 * 1000;
  const force = Boolean(opts.force);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token) return null;
    if (!force) {
      const exp = jwtExpiresAtMs(session.token);
      if (exp != null && exp - Date.now() > minTtlMs) return session;
      if (exp == null && !session.refreshToken) return session;
    }
    if (!session.refreshToken) return session;
    return (await tryRefreshStoredSession()) || session;
  } catch {
    return null;
  }
}

/** Guarda sesión sin claves AES en disco (wireKey solo en memoria). */
export function persistSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const toStore = { ...session };
  if (toStore.crypto) {
    toStore.crypto = {
      alg: toStore.crypto.alg,
      wireEnabled: Boolean(toStore.crypto.wireEnabled),
    };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function changePassword(token, { currentPassword, newPassword }) {
  return api('/api/auth/change-password', {
    token,
    method: 'POST',
    body: {
      currentPassword,
      newPassword,
      deviceId: getDeviceId() || undefined,
    },
  });
}

export async function login(username, password) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      password,
      deviceId: getDeviceId() || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(esMsg(data.error || `Error ${res.status}`));
    err.code = data.code;
    err.warn = Boolean(data.warn);
    err.locked = Boolean(data.locked);
    err.attemptsRemaining = data.attemptsRemaining;
    err.lockdown = Boolean(data.lockdown);
    throw err;
  }
  return data;
}

export function fetchAuthMe(token) {
  return api('/api/auth/me', { token });
}

export function refreshAuth(refreshToken) {
  return api('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken, deviceId: getDeviceId() || undefined },
  });
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

export function fetchContacts(token, { scope } = {}) {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return api(`/api/dm/contacts${q}`, { token });
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

export function editDmMessage(token, userId, messageId, body) {
  return api(`/api/dm/${userId}/messages/${messageId}`, {
    token,
    method: 'PATCH',
    body: { body },
  });
}

export function deleteDmMessage(token, userId, messageId) {
  return api(`/api/dm/${userId}/messages/${messageId}`, {
    token,
    method: 'DELETE',
  });
}

export function reactToDmMessage(token, userId, messageId, emoji) {
  return api(`/api/dm/${userId}/messages/${messageId}/reactions`, {
    token,
    method: 'POST',
    body: { emoji },
  });
}

export function startPrivateCall(token, targetUserId, { mode = 'call', intent } = {}) {
  const m = mode === 'radio' ? 'radio' : mode === 'video' ? 'video' : 'call';
  const body = { targetUserId, mode: m };
  if (intent === 'remote_camera') body.intent = 'remote_camera';
  return api('/api/calls/private', {
    token,
    method: 'POST',
    body,
  });
}

export function acceptPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/accept`, { token, method: 'POST' });
}

export function fetchPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}`, { token });
}

export function pingPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/ping`, { token, method: 'POST' });
}

export function refreshPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/refresh`, { token, method: 'POST' });
}

export function endPrivateCall(token, callId, reason = 'hangup') {
  return api(`/api/calls/private/${callId}/end`, {
    token,
    method: 'POST',
    body: { reason },
  });
}

/** Anexar participante a llamada/videollamada en curso. */
export function invitePrivateCallParticipant(token, callId, targetUserId) {
  return api(`/api/calls/private/${callId}/invite`, {
    token,
    method: 'POST',
    body: { targetUserId },
  });
}

/** Unirse tras invitación (guest) o re-entrar. */
export function joinPrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/join`, { token, method: 'POST' });
}

/** Rechazar invitación sin colgar a los demás. */
export function declinePrivateCallInvite(token, callId) {
  return api(`/api/calls/private/${callId}/decline-invite`, { token, method: 'POST' });
}

/** Salir de la llamada (los demás siguen si quedan ≥2). */
export function leavePrivateCall(token, callId) {
  return api(`/api/calls/private/${callId}/leave`, { token, method: 'POST' });
}

export function requestPrivateCallVideo(token, callId) {
  return api(`/api/calls/private/${callId}/video/request`, { token, method: 'POST' });
}

export function respondPrivateCallVideo(token, callId, accept) {
  return api(`/api/calls/private/${callId}/video/respond`, {
    token,
    method: 'POST',
    body: { accept: Boolean(accept) },
  });
}

export function stopPrivateCallVideo(token, callId) {
  return api(`/api/calls/private/${callId}/video/stop`, { token, method: 'POST' });
}

/** Control remoto de cámara/mic del dispositivo (Ver cámara). */
export function controlRemoteCamera(token, callId, { facing, mic, cmdId } = {}) {
  const body = {};
  if (facing != null) body.facing = facing;
  if (mic != null) body.mic = Boolean(mic);
  if (cmdId != null) body.cmdId = cmdId;
  return api(`/api/calls/private/${callId}/remote-control`, {
    token,
    method: 'POST',
    body,
  });
}

export function fetchGroupVideoStatus(token, groupId) {
  return api(`/api/group-video/${groupId}/status`, { token });
}

export function startGroupVideo(token, groupId, { groupIds } = {}) {
  return api(`/api/group-video/${groupId}/start`, {
    token,
    method: 'POST',
    body: groupIds?.length ? { groupIds } : undefined,
  });
}

/** Videollamada unificada: miembros de varios grupos en una sola sala. */
export function startGroupVideoMulti(token, groupIds) {
  return api('/api/group-video/multi/start', {
    token,
    method: 'POST',
    body: { groupIds },
  });
}

export function joinGroupVideo(token, groupId) {
  return api(`/api/group-video/${groupId}/join`, { token, method: 'POST' });
}

export function leaveGroupVideo(token, groupId) {
  return api(`/api/group-video/${groupId}/leave`, { token, method: 'POST' });
}

export function endGroupVideo(token, groupId) {
  return api(`/api/group-video/${groupId}/end`, { token, method: 'POST' });
}

export function pingGroupVideo(token, groupId) {
  return api(`/api/group-video/${groupId}/ping`, { token, method: 'POST' });
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

export function sendDmSticker(token, userId, stickerId, { replyToId } = {}) {
  return api(`/api/dm/${userId}/messages/sticker`, {
    token,
    method: 'POST',
    body: { stickerId, replyToId },
  });
}

export function sendDmNudge(token, userId) {
  return api(`/api/dm/${userId}/messages/nudge`, {
    token,
    method: 'POST',
    body: {},
  });
}

export function markMessagesRead(token, groupId, upToMessageId) {
  return api(`/api/groups/${groupId}/messages/read`, {
    token,
    method: 'POST',
    body: { upToMessageId },
  });
}

export function markDmRead(token, userId, upToMessageId) {
  return api(`/api/dm/${userId}/messages/read`, {
    token,
    method: 'POST',
    body: { upToMessageId },
  });
}

export function fetchOverview(token) {
  return api('/api/admin/overview', { token });
}

export function fetchOrgSettings(token) {
  return api('/api/admin/org-settings', { token });
}

export function patchOrgSettings(token, body) {
  return api('/api/admin/org-settings', { token, method: 'PATCH', body });
}

/** Ajustes GPS de la org (cualquier sesión autenticada). */
export function fetchGpsSettings(token) {
  return api('/api/me/gps-settings', { token });
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

export function unlockAdminUserLogin(token, id) {
  return api(`/api/admin/users/${id}/unlock-login`, { token, method: 'POST', body: {} });
}

export function deleteAdminUser(token, id) {
  return api(`/api/admin/users/${id}`, { token, method: 'DELETE' });
}

export function fetchAdminGroups(token) {
  return api('/api/admin/groups', { token });
}

export function fetchOrgUnits(token) {
  return api('/api/admin/org-units', { token });
}

export function fetchDependencias(token) {
  return api('/api/admin/dependencias', { token });
}

export function createDependenciaRegion(token, body) {
  return api('/api/admin/dependencias/region', { token, method: 'POST', body });
}

export function createDependenciaZona(token, regionId, body) {
  return api(`/api/admin/dependencias/region/${regionId}/zona`, { token, method: 'POST', body });
}

export function createDependenciaUnidad(token, zoneId, body) {
  return api(`/api/admin/dependencias/zona/${zoneId}/unidad`, { token, method: 'POST', body });
}

export function patchDependencia(token, id, body) {
  return api(`/api/admin/dependencias/${id}`, { token, method: 'PATCH', body });
}

export function deleteDependencia(token, id) {
  return api(`/api/admin/dependencias/${id}`, { token, method: 'DELETE' });
}

export function fetchGradesEmpleos(token) {
  return api('/api/catalogs/grades-empleos', { token });
}

export function fetchCatalogJerarquias(token) {
  return api('/api/catalogs/jerarquias', { token });
}

export function createCatalogJerarquia(token, body) {
  return api('/api/catalogs/jerarquias', { token, method: 'POST', body });
}

export function patchCatalogJerarquia(token, id, body) {
  return api(`/api/catalogs/jerarquias/${id}`, { token, method: 'PATCH', body });
}

export function reorderCatalogJerarquias(token, ids) {
  return api('/api/catalogs/jerarquias/reorder', { token, method: 'POST', body: { ids } });
}

export function deleteCatalogJerarquia(token, id) {
  return api(`/api/catalogs/jerarquias/${id}`, { token, method: 'DELETE' });
}

export function createCatalogGrade(token, body) {
  return api('/api/catalogs/grades', { token, method: 'POST', body });
}

export function reorderCatalogGrades(token, ids) {
  return api('/api/catalogs/grades/reorder', { token, method: 'POST', body: { ids } });
}

export function patchCatalogGrade(token, id, body) {
  return api(`/api/catalogs/grades/${id}`, { token, method: 'PATCH', body });
}

export function deleteCatalogGrade(token, id) {
  return api(`/api/catalogs/grades/${id}`, { token, method: 'DELETE' });
}

export function createCatalogEmpleo(token, body) {
  return api('/api/catalogs/empleos', { token, method: 'POST', body });
}

export function patchCatalogEmpleo(token, id, body) {
  return api(`/api/catalogs/empleos/${id}`, { token, method: 'PATCH', body });
}

export function deleteCatalogEmpleo(token, id) {
  return api(`/api/catalogs/empleos/${id}`, { token, method: 'DELETE' });
}

export function fetchBackups(token) {
  return api('/api/backups', { token });
}

/** Historial / auditoría (solo root/admin). */
export function fetchAdminActivity(token, { limit = 100, offset = 0, action = '', q = '' } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (action) params.set('action', action);
  if (q) params.set('q', q);
  return api(`/api/admin/activity?${params}`, { token });
}

/** Eventos legibles por operador (Configuración → Eventos). */
export function fetchUserEvents(
  token,
  { userId, kind = '', from = '', to = '', limit = 200 } = {}
) {
  const params = new URLSearchParams();
  params.set('userId', String(userId || ''));
  params.set('limit', String(limit));
  if (kind) params.set('kind', kind);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return api(`/api/admin/user-events?${params}`, { token });
}

/** Chat DM solo lectura (auditoría Eventos). */
export function fetchAuditDmMessages(token, userId, peerId, { around = '', limit = 120 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (around) params.set('around', around);
  return api(
    `/api/admin/users/${encodeURIComponent(userId)}/dm/${encodeURIComponent(peerId)}/messages?${params}`,
    { token }
  );
}

/** Chat de grupo solo lectura (auditoría Eventos). */
export function fetchAuditGroupMessages(token, userId, groupId, { around = '', limit = 120 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (around) params.set('around', around);
  return api(
    `/api/admin/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}/messages?${params}`,
    { token }
  );
}

export function saveBackupConfig(token, body) {
  return api('/api/backups/config', { token, method: 'PUT', body });
}

export function runBackupNow(token) {
  return api('/api/backups/run', { token, method: 'POST' });
}

export function deleteBackupFile(token, filename) {
  return api(`/api/backups/${encodeURIComponent(filename)}`, { token, method: 'DELETE' });
}

export function restoreBackupFile(token, filename) {
  return api(`/api/backups/restore/${encodeURIComponent(filename)}`, {
    token,
    method: 'POST',
    body: { confirm: 'RESTAURAR' },
  });
}

export async function restoreBackupUpload(token, file) {
  const fd = new FormData();
  fd.append('sqlfile', file);
  fd.append('confirm', 'RESTAURAR');
  const res = await fetch(`${API_BASE}/api/backups/restore-upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al restaurar');
  return data;
}

export async function downloadBackupFile(token, filename) {
  const res = await fetch(`${API_BASE}/api/backups/download/${encodeURIComponent(filename)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

export function fetchGroupMembers(token, groupId) {
  return api(`/api/groups/${groupId}/members`, { token });
}

export function fetchLocations(token, { groupIds } = {}) {
  const q = new URLSearchParams();
  if (groupIds?.length) q.set('groupIds', groupIds.join(','));
  const qs = q.toString();
  return api(`/api/locations${qs ? `?${qs}` : ''}`, { token });
}

export function postLocation(token, { latitude, longitude, accuracyM }) {
  return api('/api/locations', {
    token,
    method: 'POST',
    body: { latitude, longitude, accuracyM },
  });
}

export function fetchUserTrack(token, userId, hoursOrOpts = 8) {
  const q = new URLSearchParams();
  if (hoursOrOpts && typeof hoursOrOpts === 'object') {
    const { hours, from, to } = hoursOrOpts;
    if (from && to) {
      q.set('from', from instanceof Date ? from.toISOString() : String(from));
      q.set('to', to instanceof Date ? to.toISOString() : String(to));
    } else if (hours != null) {
      q.set('hours', String(hours));
    } else {
      q.set('hours', '8');
    }
  } else {
    q.set('hours', String(hoursOrOpts ?? 8));
  }
  return api(`/api/locations/${userId}/track?${q}`, { token });
}

/** Ruta probable por calles para un hueco de señal (tramo predictivo del mapa). */
export function fetchTrackGapRoute(token, { from, to, headingDeg } = {}) {
  const q = new URLSearchParams({
    from: `${from[0]},${from[1]}`,
    to: `${to[0]},${to[1]}`,
  });
  if (headingDeg != null && Number.isFinite(Number(headingDeg))) {
    q.set('heading', String(Number(headingDeg)));
  }
  return api(`/api/locations/track-gap-route?${q.toString()}`, { token });
}

/** URL de icono usable en <img>. Preferir ?atk= (ticket); no poner el JWT en la query. */
export function avatarImgUrl(avatarUrl, tokenOrTicket, maybeTicket) {
  if (!avatarUrl) return null;
  const base = API_BASE || '';
  const path = avatarUrl.startsWith('http') ? avatarUrl : `${base}${avatarUrl}`;
  const sep = path.includes('?') ? '&' : '?';
  const ticket =
    typeof maybeTicket === 'string'
      ? maybeTicket
      : tokenOrTicket && typeof tokenOrTicket === 'object'
        ? tokenOrTicket.avatarTicket
        : typeof tokenOrTicket === 'string' && tokenOrTicket.startsWith('v1.')
          ? tokenOrTicket
          : null;
  if (ticket) return `${path}${sep}atk=${encodeURIComponent(ticket)}`;
  return null;
}

/** Foto de perfil por userId (Bearer vía fetch/blob, o ?atk= en <img>). */
export function avatarUserImgUrl(userId, tokenOrSession) {
  if (!userId) return null;
  const base = API_BASE || '';
  const ticket =
    tokenOrSession && typeof tokenOrSession === 'object'
      ? tokenOrSession.avatarTicket
      : typeof tokenOrSession === 'string' && tokenOrSession.startsWith('v1.')
        ? tokenOrSession
        : null;
  if (!ticket) return null;
  return `${base}/api/avatars/${encodeURIComponent(userId)}?atk=${encodeURIComponent(ticket)}`;
}

/** URL de avatar para lista/mapa — preferir blob cache (Bearer); fallback ticket. */
export function mapPersonAvatarUrl(person, tokenOrSession) {
  if (!person?.userId || !person?.avatarUrl) return null;
  return avatarUserImgUrl(person.userId, tokenOrSession);
}

export async function uploadMyAvatar(token, file) {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${API_BASE}/api/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
  return data;
}

export function deleteMyAvatar(token) {
  return api('/api/me/avatar', { token, method: 'DELETE' });
}

export async function uploadGroupAvatar(token, groupId, file) {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${API_BASE}/api/admin/groups/${encodeURIComponent(groupId)}/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
  return data;
}

export function deleteGroupAvatar(token, groupId) {
  return api(`/api/admin/groups/${encodeURIComponent(groupId)}/avatar`, {
    token,
    method: 'DELETE',
  });
}

/** URL de icono de grupo vía ticket corto (?atk=). */
export function avatarGroupImgUrl(groupId, tokenOrSession) {
  if (!groupId) return null;
  const base = API_BASE || '';
  const ticket =
    tokenOrSession && typeof tokenOrSession === 'object'
      ? tokenOrSession.avatarTicket
      : typeof tokenOrSession === 'string' && tokenOrSession.startsWith('v1.')
        ? tokenOrSession
        : null;
  if (!ticket) return null;
  return `${base}/api/avatars/group/${encodeURIComponent(groupId)}?atk=${encodeURIComponent(ticket)}`;
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

/** Sitios / POI agrupados */
export function fetchTacticalSiteGroups(token) {
  return api('/api/tactical-sites/groups', { token, cache: 'no-store' });
}

export function createTacticalSiteGroup(token, body) {
  return api('/api/tactical-sites/groups', { token, method: 'POST', body });
}

export function patchTacticalSiteGroup(token, id, body) {
  return api(`/api/tactical-sites/groups/${id}`, { token, method: 'PATCH', body });
}

export function deleteTacticalSiteGroup(token, id) {
  return api(`/api/tactical-sites/groups/${id}`, { token, method: 'DELETE' });
}

export function fetchTacticalSites(token, { groupId } = {}) {
  const q = new URLSearchParams();
  if (groupId) q.set('groupId', groupId);
  const qs = q.toString();
  return api(`/api/tactical-sites${qs ? `?${qs}` : ''}`, { token, cache: 'no-store' });
}

export function createTacticalSite(token, body) {
  return api('/api/tactical-sites', { token, method: 'POST', body });
}

export function patchTacticalSite(token, id, body) {
  return api(`/api/tactical-sites/${id}`, { token, method: 'PATCH', body });
}

export function deleteTacticalSite(token, id) {
  return api(`/api/tactical-sites/${id}`, { token, method: 'DELETE' });
}

export async function uploadTacticalSiteGroupIcon(token, groupId, file) {
  const form = new FormData();
  form.append('icon', file);
  const res = await fetch(
    `${API_BASE}/api/tactical-sites/groups/${encodeURIComponent(groupId)}/icon`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
  return data;
}

export function deleteTacticalSiteGroupIcon(token, groupId) {
  return api(`/api/tactical-sites/groups/${groupId}/icon`, { token, method: 'DELETE' });
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
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
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
  // Forzar MIME: si el Blob queda sin type (o como octet-stream), Chromium
  // marca MEDIA_ERR_SRC_NOT_SUPPORTED y el player dice «No se pudo reproducir».
  const headerType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const type =
    headerType && headerType !== 'application/octet-stream' ? headerType : 'audio/webm';
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error('Audio vacío');
  return URL.createObjectURL(new Blob([buf], { type }));
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
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
  return data;
}

/** Media en chat directo (DM). */
export async function uploadDmMedia(token, peerId, file, { type, body, replyToId } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (type) form.append('type', type);
  if (body) form.append('body', body);
  if (replyToId) form.append('replyToId', replyToId);

  const res = await fetch(`${API_BASE}/api/dm/${peerId}/messages/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(esMsg(data.error || `Error ${res.status}`));
  return data;
}

/** Descarga media autenticada → blob URL (revocar con URL.revokeObjectURL). */
export async function fetchMediaBlobUrl(token, mediaUrl) {
  const path = String(mediaUrl || '');
  if (!path) throw new Error('Sin URL de media');
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'Sin permiso para ver la imagen'
        : res.status === 404
          ? 'Imagen no encontrada'
          : `No se pudo cargar media (${res.status})`
    );
  }
  const blob = await res.blob();
  if (!blob || blob.size < 1) throw new Error('Archivo vacío');
  return URL.createObjectURL(blob);
}

export function usersCsvUrl() {
  return `${API_BASE}/api/admin/users.csv`;
}

export function canDispatch(user) {
  return (
    user &&
    ['root', 'admin', 'zone_admin', 'unit_admin', 'dispatcher'].includes(user.role)
  );
}

export function isRootUser(user) {
  return user?.role === 'root';
}

export function isAdminUser(user) {
  return user && ['root', 'admin'].includes(user.role);
}

/** Alta/edición de usuarios (org, zona o unidad). */
export function canManageUsers(user) {
  return user && ['root', 'admin', 'zone_admin', 'unit_admin'].includes(user.role);
}
