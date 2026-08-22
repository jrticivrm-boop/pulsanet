/**
 * Avisos in-app / del navegador para DM y llamadas privadas.
 * Complementa FCM (que puede estar apagado) con socket + Notification API + tono.
 */

let unlocked = false;
let callLoopTimer = null;
let callAudioEl = null;

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
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }
}

function playUri(uri, { volume = 0.55 } = {}) {
  try {
    const el = new Audio(uri);
    el.volume = volume;
    el.play().catch(() => {});
    return el;
  } catch {
    return null;
  }
}

export function playDmChime() {
  if (!unlocked) return;
  playUri(buildToneUri({ durationSec: 0.28, freq: 980 }));
}

export function startCallRingtone() {
  stopCallRingtone();
  if (!unlocked) return;
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

function showBrowserNotification({ title, body, tag, requireInteraction = false }) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag: tag || 'tacticalptx',
      requireInteraction,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

function previewBody(message) {
  if (!message) return 'Nuevo mensaje';
  const t = message.type || 'text';
  if (t === 'image') return '📷 Imagen';
  if (t === 'audio') return '🎤 Audio';
  if (t === 'video') return '🎬 Video';
  if (t === 'file') return '📎 Archivo';
  if (t === 'sticker') return 'Sticker';
  return String(message.body || '').slice(0, 120) || 'Nuevo mensaje';
}

/**
 * @param {{ peerId: string, peerName: string, message: object, viewingPeer: boolean, panelVisible: boolean }} opts
 * @returns {boolean} true si mostró aviso (no estaba mirando ese chat)
 */
export function notifyDmMessage({ peerId, peerName, message, viewingPeer, panelVisible }) {
  const quiet = panelVisible && viewingPeer && !document.hidden;
  if (quiet) return false;
  const title = peerName || 'Mensaje directo';
  const body = previewBody(message);
  playDmChime();
  if (document.hidden || !panelVisible || !viewingPeer) {
    showBrowserNotification({ title, body, tag: `dm-${peerId}` });
  }
  return true;
}

export function notifyIncomingCall({ callerName, callId }) {
  const title = 'Llamada privada';
  const body = `${callerName || 'Usuario'} te está llamando`;
  startCallRingtone();
  showBrowserNotification({
    title,
    body,
    tag: `call-${callId || 'private'}`,
    requireInteraction: true,
  });
}
