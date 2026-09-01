/**
 * Alarma de pánico: tono centrado (hi-lo medio ~780/980 Hz).
 * Suena en bucle hasta stopPanicAlarm() en ESTE dispositivo (Enterado local).
 * Un Enterado remoto no debe llamar stop aquí.
 */

let sharedCtx = null;
let unlocked = false;
let looping = false;
let loopTimer = null;
let activeHtml = null;
let unlockAudioEl = null;
let sirenUri = null;

const SIREN_ASSET = '/sounds/panic_siren.wav';
const SIREN_LOOP_MS = 2700;

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function buildSilentWavUri(durationSec = 0.05, sampleRate = 22050) {
  const n = Math.floor(sampleRate * durationSec);
  const data = new Int16Array(n);
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
  let binary = '';
  const u8 = new Uint8Array(buffer);
  for (let i = 0; i < u8.length; i += 1) binary += String.fromCharCode(u8[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Fallback: hi-lo centrado 780 ↔ 980 Hz. */
function buildCenteredWavUri({ durationSec = 2.8, sampleRate = 22050 } = {}) {
  const n = Math.floor(sampleRate * durationSec);
  const data = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const seg = Math.floor(t / 0.45) % 2;
    const freq = seg === 0 ? 780 : 980;
    const local = t % 0.45;
    const attack = Math.min(1, local / 0.04);
    const release = local > 0.38 ? Math.max(0, (0.45 - local) / 0.07) : 1;
    const env = attack * release * 0.62;
    const sample =
      Math.sin(2 * Math.PI * freq * t) * env +
      0.18 * Math.sin(2 * Math.PI * freq * 2 * t) * env;
    data[i] = Math.max(-32767, Math.min(32767, Math.floor(sample * 28000)));
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

function getSirenUri() {
  if (!sirenUri) sirenUri = buildCenteredWavUri();
  return sirenUri;
}

export async function unlockPanicAudio() {
  const ctx = getCtx();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'running') unlocked = true;
    } catch {
      /* ignore */
    }
  }
  try {
    if (!unlockAudioEl) {
      unlockAudioEl = new Audio(buildSilentWavUri());
      unlockAudioEl.volume = 0.01;
    }
    unlockAudioEl.currentTime = 0;
    await unlockAudioEl.play();
    unlockAudioEl.pause();
    unlocked = true;
  } catch {
    /* blocked */
  }
  return unlocked;
}

/** WebAudio: dos tonos medios alternados (no barrido extremo). */
function playWebAudioBurst() {
  const ctx = getCtx();
  if (!ctx) return;
  const run = () => {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32, now);
    master.connect(ctx.destination);

    const tone = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.55, start + 0.03);
      g.gain.setValueAtTime(0.55, start + dur - 0.06);
      g.gain.linearRampToValueAtTime(0.001, start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    let t = now;
    for (let i = 0; i < 6; i += 1) {
      tone(i % 2 === 0 ? 780 : 980, t, 0.4);
      t += 0.45;
    }

    setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* ignore */
      }
    }, (t - now + 0.2) * 1000);
  };
  if (ctx.state === 'suspended') ctx.resume().then(run).catch(() => {});
  else run();
}

function playHtmlBurst() {
  try {
    if (activeHtml) {
      try {
        activeHtml.pause();
      } catch {
        /* ignore */
      }
    }
    // cache-bust para forzar el WAV nuevo tras regenerar
    const el = new Audio(`${SIREN_ASSET}?v=centered`);
    el.volume = 0.9;
    activeHtml = el;
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        unlocked = true;
      }).catch(() => {
        try {
          const fb = new Audio(getSirenUri());
          fb.volume = 0.9;
          activeHtml = fb;
          fb.play().catch(() => playWebAudioBurst());
        } catch {
          playWebAudioBurst();
        }
      });
    }
  } catch {
    playWebAudioBurst();
  }
}

function playOneCycle() {
  playHtmlBurst();
}

export function stopPanicAlarm() {
  looping = false;
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  if (activeHtml) {
    try {
      activeHtml.pause();
      activeHtml.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeHtml = null;
  }
}

export function startPanicAlarm({ restart = false } = {}) {
  if (looping && !restart) return true;
  stopPanicAlarm();
  looping = true;
  playOneCycle();
  unlockPanicAudio().catch(() => {});
  loopTimer = setInterval(() => {
    if (!looping) return;
    playOneCycle();
  }, SIREN_LOOP_MS);
  return true;
}

export function playPanicAlarm() {
  if (looping) return Promise.resolve(true);
  playWebAudioBurst();
  try {
    const el = new Audio(`${SIREN_ASSET}?v=centered`);
    el.volume = 0.88;
    el.play().catch(() => {
      new Audio(getSirenUri()).play().catch(() => {});
    });
  } catch {
    /* ignore */
  }
  unlockPanicAudio().catch(() => {});
  return Promise.resolve(true);
}

export function isPanicAlarmPlaying() {
  return looping;
}
