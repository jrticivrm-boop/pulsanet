/**
 * Alarma de pánico: puede sonar en bucle hasta stopPanicAlarm() (Enterado / resuelto).
 * Arrancar play desde un gesto de usuario (clic/PTT) por la política de autoplay.
 */

let sharedCtx = null;
let unlocked = false;
let looping = false;
let loopTimer = null;
let activeHtml = null;
let unlockAudioEl = null;
let sirenUri = null;

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function buildWavDataUri({ durationSec = 2.4, sampleRate = 22050, silent = false } = {}) {
  const n = Math.floor(sampleRate * durationSec);
  const data = new Int16Array(n);
  if (!silent) {
    for (let i = 0; i < n; i += 1) {
      const t = i / sampleRate;
      const segment = Math.floor(t / 0.2) % 2;
      const freq = segment === 0 ? 880 : 1175;
      const local = t % 0.2;
      const env =
        local < 0.02 ? local / 0.02 : local > 0.18 ? Math.max(0, (0.2 - local) / 0.02) : 1;
      const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.55;
      data[i] = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    }
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
  if (!sirenUri) sirenUri = buildWavDataUri({ durationSec: 2.5, silent: false });
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
      unlockAudioEl = new Audio(buildWavDataUri({ durationSec: 0.05, silent: true }));
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

function playWebAudioBurst(loops = 6) {
  const ctx = getCtx();
  if (!ctx) return;
  const run = () => {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, now);
    master.connect(ctx.destination);
    const beep = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.5, start + 0.015);
      g.gain.linearRampToValueAtTime(0.001, start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    let t = now;
    for (let i = 0; i < loops; i += 1) {
      beep(880, t, 0.18);
      t += 0.2;
      beep(1175, t, 0.18);
      t += 0.22;
    }
    setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* ignore */
      }
    }, (t - now + 0.15) * 1000);
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
    const el = new Audio(getSirenUri());
    el.volume = 0.95;
    activeHtml = el;
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        unlocked = true;
      }).catch(() => {
        playWebAudioBurst(6);
      });
    }
  } catch {
    playWebAudioBurst(6);
  }
}

function playOneCycle() {
  playHtmlBurst();
}

/** Detiene la sirena en bucle (Enterado / resuelto / cancelado). */
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

/**
 * Sirena continua hasta stopPanicAlarm().
 * Si alreadyPlaying, no reinicia (evita cortes al recibir más eventos).
 */
export function startPanicAlarm({ restart = false } = {}) {
  if (looping && !restart) return true;
  stopPanicAlarm();
  looping = true;
  playOneCycle();
  unlockPanicAudio().catch(() => {});
  loopTimer = setInterval(() => {
    if (!looping) return;
    playOneCycle();
  }, 2600);
  return true;
}

/** Confirmación corta (emisor): no entra en bucle. */
export function playPanicAlarm({ loops = 4 } = {}) {
  if (looping) return Promise.resolve(true);
  playWebAudioBurst(loops);
  try {
    const el = new Audio(getSirenUri());
    el.volume = 0.85;
    el.play().catch(() => {});
  } catch {
    /* ignore */
  }
  unlockPanicAudio().catch(() => {});
  return Promise.resolve(true);
}

export function isPanicAlarmPlaying() {
  return looping;
}
