/**
 * Avisos in-app / navegador estilo WhatsApp Web:
 * - Misma conversación abierta y pestaña visible → silencio
 * - Otra conversación / lista → tono + banner (caller)
 * - Pestaña en segundo plano → tono + Notification del SO (service worker)
 * - Llamada a pantalla completa → banner encima del overlay
 */

import { isPrivateCallUiOpen } from './privateCallUi.js';

const MESSAGE_SOUND = '/sounds/message.wav';
const BASE_TITLE = 'SICOM';

let unlocked = false;
let callLoopTimer = null;
let callAudioEl = null;
let lastToneAt = 0;
let swReadyPromise = null;

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!getCtx._ctx || getCtx._ctx.state === 'closed') {
    getCtx._ctx = new AC();
  }
  return getCtx._ctx;
}

function buildToneUri({
  durationSec = 0.35,
  freq = 880,
  sampleRate = 22050,
  dual = false,
} = {}) {
  const n = Math.floor(sampleRate * durationSec);
  const data = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const f = dual && Math.floor(t / 0.4) % 2 === 1 ? freq * 1.25 : freq;
    const env = Math.min(1, t * 20) * Math.min(1, (durationSec - t) * 12);
    const sample = Math.sin(2 * Math.PI * f * t) * env * 0.35;
    data[i] = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
  }
  const bytes = data.byteLength;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, bytes, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(data.buffer));
  let binary = '';
  const u8 = new Uint8Array(buffer);
  for (let i = 0; i < u8.length; i += 1) binary += String.fromCharCode(u8[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Registra SW de notificaciones (necesario para avisos con pestaña minimizada en Chrome/Edge). */
export function ensureNotifyServiceWorker() {
  if (swReadyPromise) return swReadyPromise;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    swReadyPromise = Promise.resolve(null);
    return swReadyPromise;
  }
  swReadyPromise = navigator.serviceWorker
    .register('/sw-notify.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => reg.ready)
    .catch(() => null);
  return swReadyPromise;
}

export async function unlockAppNotifyAudio() {
  const ctx = getCtx();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      unlocked = ctx.state === 'running';
    } catch {
      /* ignore */
    }
  }
  try {
    const el = new Audio(MESSAGE_SOUND);
    el.volume = 0.01;
    await el.play();
    el.pause();
    el.currentTime = 0;
    unlocked = true;
  } catch {
    /* puede fallar hasta el primer gesto; unlock se reintenta */
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    ensureNotifyServiceWorker().catch(() => {});
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') ensureNotifyServiceWorker().catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

function playUri(uri, { volume = 0.55 } = {}) {
  try {
    const el = new Audio(uri);
    el.volume = volume;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (uri !== MESSAGE_SOUND) return;
        playUri(buildToneUri({ durationSec: 0.28, freq: 980, dual: true }), { volume });
      });
    }
    return el;
  } catch {
    return null;
  }
}

/** Tono de mensaje (estilo WhatsApp). soft ≈ pestaña visible. */
export function playMessageTone({ soft = false } = {}) {
  const now = Date.now();
  if (now - lastToneAt < 280) return;
  lastToneAt = now;
  if (!unlocked) {
    unlockAppNotifyAudio().catch(() => {});
  }
  playUri(MESSAGE_SOUND, { volume: soft ? 0.22 : 0.62 });
}

/** Pitido breve cuando alguien suelta el PTT y el canal queda libre. */
export function playChannelFreeTone({ soft = false } = {}) {
  const now = Date.now();
  if (now - lastToneAt < 180) return;
  lastToneAt = now;
  if (!unlocked) {
    unlockAppNotifyAudio().catch(() => {});
  }
  playUri(buildToneUri({ durationSec: 0.11, freq: 620 }), {
    volume: soft ? 0.2 : 0.42,
  });
}

/** Campanita corta para enter/exit de geocerca (consola). */
export function playGeofenceBellTone({ soft = false } = {}) {
  const now = Date.now();
  if (now - lastToneAt < 220) return;
  lastToneAt = now;
  if (!unlocked) {
    unlockAppNotifyAudio().catch(() => {});
  }
  playUri(buildToneUri({ durationSec: 0.22, freq: 1040, dual: true }), {
    volume: soft ? 0.28 : 0.55,
  });
}

/** Pitido fuerte al pulsar PTT. */
export function playPttPressTone() {
  const now = Date.now();
  if (now - lastToneAt < 90) return;
  lastToneAt = now;
  if (!unlocked) {
    unlockAppNotifyAudio().catch(() => {});
  }
  playUri('/sounds/ptt_press.wav', { volume: 0.78 });
}

/** Pitido fuerte distinto al soltar PTT. */
export function playPttReleaseTone() {
  const now = Date.now();
  if (now - lastToneAt < 90) return;
  lastToneAt = now;
  if (!unlocked) {
    unlockAppNotifyAudio().catch(() => {});
  }
  playUri('/sounds/ptt_release.wav', { volume: 0.72 });
}

/** @deprecated usar playMessageTone */
export function playDmChime() {
  playMessageTone({ soft: !document.hidden });
}

export function startCallRingtone() {
  stopCallRingtone();
  if (!unlocked) unlockAppNotifyAudio().catch(() => {});
  const uri = buildToneUri({ durationSec: 1.2, freq: 740, dual: true });
  const tick = () => {
    callAudioEl = playUri(uri, { volume: 0.65 });
  };
  tick();
  callLoopTimer = window.setInterval(tick, 1600);
}

export function stopCallRingtone() {
  if (callLoopTimer) {
    clearInterval(callLoopTimer);
    callLoopTimer = null;
  }
  if (callAudioEl) {
    try {
      callAudioEl.pause();
    } catch {
      /* ignore */
    }
    callAudioEl = null;
  }
}

function notifyIconUrl() {
  try {
    return new URL('/brand/sicom.png', window.location.origin).href;
  } catch {
    return '/brand/sicom.png';
  }
}

/**
 * Muestra notificación del sistema. Prefiere service worker (pestaña en segundo plano).
 * @returns {Promise<boolean>}
 */
export async function showBrowserNotification({
  title,
  body,
  tag,
  requireInteraction = false,
  silent = false,
} = {}) {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const options = {
    body: body || 'Nuevo mensaje',
    tag: tag || `tacticalptx-${Date.now()}`,
    requireInteraction,
    silent,
    icon: notifyIconUrl(),
    data: { ts: Date.now() },
  };

  try {
    const reg = await ensureNotifyServiceWorker();
    if (reg?.showNotification) {
      await reg.showNotification(title || 'SICOM', options);
      return true;
    }
  } catch {
    /* fallback abajo */
  }

  try {
    const n = new Notification(title || 'SICOM', options);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
    if (!requireInteraction) {
      window.setTimeout(() => {
        try {
          n.close();
        } catch {
          /* ignore */
        }
      }, 12000);
    }
    return true;
  } catch {
    return false;
  }
}

function previewBody(message) {
  if (!message) return 'Nuevo mensaje';
  const t = message.type || 'text';
  if (t === 'image') return '📷 Imagen';
  if (t === 'audio') return '🎤 Audio';
  if (t === 'video') return '🎬 Video';
  const mime = String(message.mediaMime || '').toLowerCase();
  const name = String(message.mediaName || '');
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name)) {
    return '🎬 Video';
  }
  if (t === 'file') return `📎 ${name || 'Archivo'}`;
  if (t === 'sticker') return 'Sticker';
  return String(message.body || '').slice(0, 120) || 'Nuevo mensaje';
}

/**
 * Notificación unificada estilo WhatsApp Web.
 * @returns {boolean} true si debe mostrarse banner in-app
 */
export function notifyIncomingMessage({
  title,
  body,
  tag,
  viewingThisChat = false,
  messageId = null,
} = {}) {
  const hidden = Boolean(document.hidden);

  if (!hidden && viewingThisChat && !isPrivateCallUiOpen()) {
    playMessageTone({ soft: true });
    return false;
  }

  playMessageTone({ soft: !hidden });

  if (hidden) {
    const uniqueTag = messageId ? `${tag || 'msg'}-${messageId}` : `${tag || 'msg'}-${Date.now()}`;
    void showBrowserNotification({
      title: title || 'SICOM',
      body: body || 'Nuevo mensaje',
      tag: uniqueTag,
      silent: false,
    });
  }

  return true;
}

/**
 * @param {{ peerId: string, peerName: string, message: object, viewingPeer: boolean, panelVisible: boolean }} opts
 * @returns {boolean} true si debe mostrar banner
 */
export function notifyDmMessage({ peerId, peerName, message, viewingPeer, panelVisible }) {
  const viewingThisChat = Boolean(panelVisible && viewingPeer);
  return notifyIncomingMessage({
    title: peerName || 'Mensaje directo',
    body: previewBody(message),
    tag: `dm-${peerId}`,
    messageId: message?.id || null,
    viewingThisChat,
  });
}

export function notifyIncomingCall({ callerName, callId, mode = 'call' }) {
  const isRadio = mode === 'radio';
  const isVideo = mode === 'video';
  const title = isRadio ? 'Radio personal' : isVideo ? 'Videollamada entrante' : 'Llamada entrante';
  const body = isRadio
    ? `${callerName || 'Usuario'} — radio 1:1 (mantén PTT)`
    : isVideo
      ? `${callerName || 'Usuario'} te llama con video`
      : `${callerName || 'Usuario'} te está llamando`;
  if (!isRadio) startCallRingtone();
  void showBrowserNotification({
    title,
    body,
    tag: `call-${callId || 'private'}-${Date.now()}`,
    requireInteraction: !isRadio,
    silent: isRadio,
  });
  try {
    const prev = document.title;
    const icon = isRadio ? '📻' : isVideo ? '📹' : '📞';
    document.title = `${icon} ${callerName || 'Aviso'} — SICOM`;
    window.setTimeout(() => {
      try {
        if (document.title.startsWith('📞') || document.title.startsWith('📻') || document.title.startsWith('📹')) {
          document.title = prev;
        }
      } catch {
        /* ignore */
      }
    }, 12000);
  } catch {
    /* ignore */
  }
}

export function notifyIncomingGroupVideo({ groupName, startedByName, groupId }) {
  startCallRingtone();
  void showBrowserNotification({
    title: 'Transmisión grupal en vivo',
    body: `${startedByName || 'Un operador'} inició video en «${groupName || 'grupo'}»`,
    tag: `gvideo-${groupId || 'group'}`,
    requireInteraction: true,
    silent: false,
  });
  try {
    const prev = document.title;
    document.title = `📹 ${groupName || 'Transmisión'} — SICOM`;
    window.setTimeout(() => {
      try {
        if (document.title.startsWith('📹')) document.title = prev;
      } catch {
        /* ignore */
      }
    }, 12000);
  } catch {
    /* ignore */
  }
}

const ON_AIR_TITLE = '🔴 AL AIRE — SICOM';
const ON_AIR_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<circle cx="16" cy="16" r="15" fill="#b71c1c"/>' +
      '<circle cx="16" cy="16" r="7" fill="#ffffff"/>' +
      '</svg>'
  );

/** Favicon por tema actual (Obscuro = Tactical 4). */
function defaultFaviconHref() {
  try {
    if (document.documentElement.getAttribute('data-theme') === 'obscuro') {
      return '/brand/tactical_favicon_obscuro.png?v=2';
    }
  } catch {
    /* ignore */
  }
  return '/brand/sicom_round.png';
}

let onAirTabActive = false;
let lastUnreadCount = 0;
let savedFaviconHref = null;

function ensureFaviconLink() {
  let link =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

function applyOnAirFavicon(active) {
  try {
    const link = ensureFaviconLink();
    if (active) {
      if (savedFaviconHref === null) {
        const href = link.getAttribute('href') || '';
        savedFaviconHref = href && !href.startsWith('data:') ? href : defaultFaviconHref();
      }
      link.type = 'image/svg+xml';
      link.href = ON_AIR_FAVICON;
      return;
    }
    if (savedFaviconHref !== null) {
      link.type = 'image/png';
      /* Restaurar según tema vigente (pudo cambiar durante «al aire»). */
      link.href = defaultFaviconHref();
      savedFaviconHref = null;
    }
  } catch {
    /* ignore */
  }
}

function applyDocumentTitle() {
  try {
    if (onAirTabActive) {
      document.title = ON_AIR_TITLE;
      return;
    }
    const n = lastUnreadCount;
    document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${BASE_TITLE}` : BASE_TITLE;
  } catch {
    /* ignore */
  }
}

/** Título de pestaña con contador de no leídos, estilo WhatsApp. */
export function setUnreadDocumentTitle(count) {
  lastUnreadCount = Math.max(0, Number(count) || 0);
  applyDocumentTitle();
}

/**
 * Aviso al aire en pestaña: título «🔴 AL AIRE» + favicon rojo.
 * No corta el PTT; solo indica que el mic quedó abierto.
 */
export function setOnAirTabIndicator(active) {
  const next = Boolean(active);
  if (next === onAirTabActive) return;
  onAirTabActive = next;
  applyOnAirFavicon(next);
  applyDocumentTitle();
}
