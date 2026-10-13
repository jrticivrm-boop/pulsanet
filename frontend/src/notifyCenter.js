/**
 * Centro de avisos web: historial (campana) + tarjetas apiladas.
 * Tipos: dm | group | panic | missed_call | geofence | video | info.
 */

import { panicReasonOf } from './panicReason.js';

const STORE_PREFIX = 'tacticalptx_notify_center_v1:';
const MAX_ITEMS = 60;
const TOAST_EVENT = 'tacticalptx:notice-toast';

let ownerKey = null;
/** @type {Array<object>} */
let items = [];
const listeners = new Set();

function storageKey() {
  return ownerKey ? `${STORE_PREFIX}${ownerKey}` : null;
}

function persist() {
  const k = storageKey();
  if (!k) return;
  try {
    localStorage.setItem(k, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* cuota llena: el historial solo vive en memoria */
  }
}

function emit() {
  const snap = items.slice();
  for (const fn of listeners) {
    try {
      fn(snap);
    } catch {
      /* ignore */
    }
  }
}

/** Historial por usuario (cambio de sesión en el mismo navegador). */
export function bindNoticeOwner(userId) {
  const next = userId ? String(userId) : null;
  if (next === ownerKey) return;
  ownerKey = next;
  items = [];
  const k = storageKey();
  if (k) {
    try {
      const raw = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(raw)) items = raw.slice(0, MAX_ITEMS);
    } catch {
      items = [];
    }
  }
  emit();
}

export function getNotices() {
  return items.slice();
}

export function unreadNoticeCount(list = items) {
  return list.reduce((n, it) => n + (it.read ? 0 : 1), 0);
}

export function subscribeNotices(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Registra un aviso en el historial y (salvo `toast: false`) lo muestra como tarjeta.
 * @param {{ kind: string, title: string, body?: string, groupId?: string, peerId?: string,
 *   userId?: string, route?: string, dedupeKey?: string, toast?: boolean, sticky?: boolean,
 *   groupName?: string, senderName?: string, msgType?: string }} notice
 */
export function pushNotice(notice) {
  if (!notice?.kind || !notice?.title) return null;
  const at = Date.now();
  const id = `${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const item = { id, at, read: false, ...notice };
  delete item.toast;
  if (notice.dedupeKey) {
    items = items.filter((it) => it.dedupeKey !== notice.dedupeKey);
  }
  items = [item, ...items].slice(0, MAX_ITEMS);
  persist();
  emit();
  if (notice.toast !== false) {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: item }));
  }
  return item;
}

/** Pánico: el panel/sirena ya es la alerta visible; aquí solo queda en el historial. */
export function recordPanicNotice(ev) {
  if (!ev?.id) return;
  const params = new URLSearchParams();
  const lat = Number(ev.latitude);
  const lng = Number(ev.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
    params.set('zoom', '17');
  }
  if (ev.userId) params.set('user', String(ev.userId));
  params.set('panic', String(ev.id));
  const { reason, detail } = panicReasonOf(ev);
  const where = ev.groupName ? `Canal ${ev.groupName}` : 'Alerta de emergencia';
  pushNotice({
    kind: 'panic',
    title: `${reason ? reason : 'Pánico'} · ${ev.displayName || 'Operador'}`,
    body: detail ? `${detail} · ${where}` : where,
    userId: ev.userId,
    groupId: ev.groupId,
    route: `/despacho?${params.toString()}`,
    dedupeKey: `panic:${ev.id}`,
    toast: false,
  });
}

export function subscribeNoticeToasts(handler) {
  const onEvt = (e) => handler(e.detail);
  window.addEventListener(TOAST_EVENT, onEvt);
  return () => window.removeEventListener(TOAST_EVENT, onEvt);
}

export function markNoticeRead(id) {
  let changed = false;
  items = items.map((it) => {
    if (it.id !== id || it.read) return it;
    changed = true;
    return { ...it, read: true };
  });
  if (changed) {
    persist();
    emit();
  }
}

/** Al abrir una conversación: sus avisos quedan leídos. */
export function markConversationNoticesRead({ peerId, groupId }) {
  let changed = false;
  items = items.map((it) => {
    if (it.read) return it;
    const hit =
      (peerId && it.kind === 'dm' && String(it.peerId) === String(peerId)) ||
      (groupId && it.kind === 'group' && String(it.groupId) === String(groupId));
    if (!hit) return it;
    changed = true;
    return { ...it, read: true };
  });
  if (changed) {
    persist();
    emit();
  }
}

export function markAllNoticesRead() {
  if (!items.some((it) => !it.read)) return;
  items = items.map((it) => (it.read ? it : { ...it, read: true }));
  persist();
  emit();
}

export function clearNotices() {
  items = [];
  persist();
  emit();
}

/** «hace 3 min», «ayer 18:40»… */
export function noticeTimeLabel(at, now = Date.now()) {
  const diff = Math.max(0, now - at);
  if (diff < 45_000) return 'ahora';
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  const d = new Date(at);
  const hhmm = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return hhmm;
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return `ayer ${hhmm}`;
  return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} ${hhmm}`;
}

export const NOTICE_KIND_LABEL = {
  dm: 'Mensaje directo',
  group: 'Canal',
  panic: 'Alerta',
  missed_call: 'Llamada perdida',
  geofence: 'Geocerca',
  video: 'Video en vivo',
  info: 'Aviso',
};
