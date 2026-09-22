/**
 * Mantiene audio/socket útiles con la pestaña en segundo plano o pantalla bloqueada
 * (dentro de lo que permite el navegador).
 */

import { notifyIncomingCall, stopCallRingtone, unlockAppNotifyAudio, showBrowserNotification } from './appNotify.js';

let keepaliveTimer = null;
let silentEl = null;
let audioCtx = null;
let oscillator = null;
let gain = null;
let started = false;

function ensureSilentLoop() {
  try {
    if (!silentEl) {
      // WAV silencioso corto en bucle: evita que el SO suspenda el audio de LiveKit.
      const sr = 8000;
      const n = sr;
      const data = new Int16Array(n);
      const buffer = new ArrayBuffer(44 + data.byteLength);
      const view = new DataView(buffer);
      const writeStr = (o, s) => {
        for (let i = 0; i < s.length; i += 1) view.setUint8(o + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + data.byteLength, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sr, true);
      view.setUint32(28, sr * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, data.byteLength, true);
      let binary = '';
      const u8 = new Uint8Array(buffer);
      for (let i = 0; i < u8.length; i += 1) binary += String.fromCharCode(u8[i]);
      silentEl = new Audio(`data:audio/wav;base64,${btoa(binary)}`);
      silentEl.loop = true;
      silentEl.volume = 0.001;
    }
    silentEl.play().catch(() => {});
  } catch {
    /* ignore */
  }

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (!oscillator) {
      oscillator = audioCtx.createOscillator();
      gain = audioCtx.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
    }
  } catch {
    /* ignore */
  }
}

function setMediaSession(channelName) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: channelName || 'Radio',
      artist: 'SICOM',
      album: 'Canal PTT',
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    /* ignore */
  }
}

export function isPageHidden() {
  return Boolean(document.hidden);
}

export async function startBackgroundKeepalive({ channelName } = {}) {
  started = true;
  await unlockAppNotifyAudio().catch(() => {});
  ensureSilentLoop();
  setMediaSession(channelName);

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }

  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = window.setInterval(() => {
    if (!started) return;
    ensureSilentLoop();
    setMediaSession(channelName);
  }, 20000);

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', ensureSilentLoop);
}

export function stopBackgroundKeepalive() {
  started = false;
  document.removeEventListener('visibilitychange', onVisibility);
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
  try {
    silentEl?.pause();
  } catch {
    /* ignore */
  }
  try {
    oscillator?.stop();
  } catch {
    /* ignore */
  }
  oscillator = null;
  gain = null;
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch {
      /* ignore */
    }
  }
}

function onVisibility() {
  if (!document.hidden) return;
  ensureSilentLoop();
}

/**
 * Aviso de canal/grupo.
 * @param {{ title?: string, body?: string, tag?: string, force?: boolean }} opts
 * force=true: también con pestaña visible (el banner in-app lo maneja ChatInbox).
 */
export function notifyBackgroundChat({ title, body, tag, force = false } = {}) {
  if (!force && !document.hidden) return;
  unlockAppNotifyAudio().catch(() => {});
  void showBrowserNotification({
    title: title || 'SICOM',
    body: body || 'Nuevo mensaje',
    tag: tag || `tacticalptx-chat-${Date.now()}`,
    silent: false,
  });
}

export function notifyBackgroundPtt({ speakerName }) {
  if (!document.hidden) return;
  notifyBackgroundChat({
    title: 'Canal al aire',
    body: `${speakerName || 'Operador'} está hablando`,
    tag: 'tacticalptx-ptt',
  });
}

export { notifyIncomingCall };
