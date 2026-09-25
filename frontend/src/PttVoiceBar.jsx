/**
 * Barra de voz PTT (archivada — no montada en Radio).
 * Para reactivar: import './PttVoiceBar.css' y montar en RadioPage
 * con mediaStreamTrack={getMicMediaStreamTrack()} de usePtt.
 */
import { useEffect, useRef } from 'react';

const BAR_COUNT = 72;
const SEG_GAP = 2.2;

/** Neón por tema — saturación alta, legible sobre cualquier fondo. */
const NEON_BY_THEME = {
  light: { edge: '#7cb83a', mid: '#20b2aa', core: '#e0b44a' },
  verde: { edge: '#e0b84a', mid: '#c6f04a', core: '#6ed0ff' },
  obscuro: { edge: '#f472b6', mid: '#22d3ee', core: '#818cf8' },
};

function readThemeId(el) {
  const root = el?.closest?.('[data-theme]') || document.documentElement;
  const t = root.getAttribute?.('data-theme') || 'light';
  return t === 'verde' || t === 'obscuro' ? t : 'light';
}

function readNeon(el) {
  const cs = getComputedStyle(el || document.documentElement);
  const pick = (name) => cs.getPropertyValue(name).trim();
  const theme = readThemeId(el);
  const fallback = NEON_BY_THEME[theme] || NEON_BY_THEME.obscuro;
  return {
    edge: pick('--ptt-voice-edge') || fallback.edge,
    mid: pick('--ptt-voice-mid') || fallback.mid,
    core: pick('--ptt-voice-core') || fallback.core,
  };
}

function parseRgb(input) {
  if (!input) return [96, 165, 250];
  const s = String(input).trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.slice(0, 6);
    if (full.length < 6) return [96, 165, 250];
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [96, 165, 250];
}

function mixRgb(a, b, t) {
  const [ar, ag, ab] = parseRgb(a);
  const [br, bg, bb] = parseRgb(b);
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function barRgb(neon, tPos) {
  // edge → mid → core → mid → edge (suave, 3 zonas)
  const d = Math.abs(tPos - 0.5) * 2;
  if (d < 0.35) return mixRgb(neon.core, neon.mid, d / 0.35);
  return mixRgb(neon.mid, neon.edge, (d - 0.35) / 0.65);
}

/**
 * Barra ecualizador simétrico (estilo LED neón).
 * Mic escala amplitud; onda viaja L↔R.
 */
export default function PttVoiceBar({
  active = false,
  transmitting = false,
  getMicTrack = null,
  className = '',
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const activeRef = useRef(active);
  const transmittingRef = useRef(transmitting);
  const getMicTrackRef = useRef(getMicTrack);
  const levelsRef = useRef(Float32Array.from({ length: BAR_COUNT }, () => 0.08));
  const targetsRef = useRef(Float32Array.from({ length: BAR_COUNT }, () => 0.08));
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const audioRef = useRef({
    ctx: null,
    analyser: null,
    source: null,
    trackId: null,
    freq: null,
  });

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    transmittingRef.current = transmitting;
  }, [transmitting]);

  useEffect(() => {
    getMicTrackRef.current = getMicTrack;
  }, [getMicTrack]);

  useEffect(() => {
    if (!active) {
      const a = audioRef.current;
      try {
        a.source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        a.analyser?.disconnect();
      } catch {
        /* ignore */
      }
      if (a.ctx && a.ctx.state !== 'closed') {
        a.ctx.close().catch(() => {});
      }
      audioRef.current = {
        ctx: null,
        analyser: null,
        source: null,
        trackId: null,
        freq: null,
      };
    }
  }, [active]);

  useEffect(() => {
    if (active && wrapRef.current && canvasRef.current) {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = Math.max(1, wrap.clientWidth);
        const h = Math.max(1, wrap.clientHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let disposed = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const ensureAnalyser = () => {
      if (!transmittingRef.current) return null;
      const track = typeof getMicTrackRef.current === 'function' ? getMicTrackRef.current() : null;
      if (!track || track.readyState === 'ended') return null;

      const a = audioRef.current;
      if (a.analyser && a.trackId === track.id) return a.analyser;

      try {
        a.source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        a.analyser?.disconnect();
      } catch {
        /* ignore */
      }

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      let actx = a.ctx;
      if (!actx || actx.state === 'closed') {
        actx = new AC();
      }
      if (actx.state === 'suspended') {
        actx.resume().catch(() => {});
      }

      const stream = new MediaStream([track]);
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      a.ctx = actx;
      a.source = source;
      a.analyser = analyser;
      a.trackId = track.id;
      a.freq = new Uint8Array(analyser.frequencyBinCount);
      return analyser;
    };

    const tick = () => {
      if (disposed) return;
      rafRef.current = requestAnimationFrame(tick);
      tRef.current += activeRef.current ? 0.048 : 0.012;
      const t = tRef.current;
      const levels = levelsRef.current;
      const targets = targetsRef.current;
      const live = activeRef.current;
      const tx = transmittingRef.current;

      const analyser = live && tx ? ensureAnalyser() : null;
      let voiceEnergy = 0.55;
      if (analyser && audioRef.current.freq) {
        analyser.getByteFrequencyData(audioRef.current.freq);
        const bins = audioRef.current.freq;
        const usable = Math.max(8, Math.floor(bins.length * 0.55));
        let sum = 0;
        for (let b = 0; b < usable; b++) sum += bins[b];
        voiceEnergy = Math.min(1, Math.max(0, (sum / usable / 255 - 0.03) * 2.1));
      }

      if (live) {
        const gain = tx ? 0.22 + voiceEnergy * 0.9 : 0.55;
        const speed = tx ? 1 + voiceEnergy * 0.75 : 1;
        for (let i = 0; i < BAR_COUNT; i++) {
          const mid = (BAR_COUNT - 1) / 2;
          const dist = Math.abs(i - mid) / mid;
          const envelope = 1 - dist * 0.5;
          const wave =
            0.35 +
            0.45 * Math.sin(t * 2.1 * speed + i * 0.38) +
            0.25 * Math.sin(t * 3.4 * speed - i * 0.22) +
            0.15 * Math.sin(t * 5.1 * speed + i * 0.55);
          targets[i] = Math.min(1, Math.max(0.08, wave * envelope * gain));
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) targets[i] = 0.05;
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        levels[i] += (targets[i] - levels[i]) * (live ? 0.34 : 0.12);
      }

      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 2 || h < 2) return;
      const neon = readNeon(wrap);
      ctx.clearRect(0, 0, w, h);

      const midY = h * 0.5;
      const barW = Math.max(1.4, (w - (BAR_COUNT - 1) * 2.2) / BAR_COUNT);
      const gap = (w - barW * BAR_COUNT) / (BAR_COUNT - 1 || 1);
      const maxHalf = h * 0.46;
      const segH = Math.max(1, Math.min(1.65, maxHalf / 18));

      // Eje central fino (sin halo / fondo difuminado)
      if (live) {
        const axis = ctx.createLinearGradient(0, 0, w, 0);
        const e = parseRgb(neon.edge);
        const m = parseRgb(neon.mid);
        const c = parseRgb(neon.core);
        axis.addColorStop(0, rgba(e, 0));
        axis.addColorStop(0.12, rgba(e, 0.28));
        axis.addColorStop(0.5, rgba(c, 0.7));
        axis.addColorStop(0.88, rgba(m, 0.28));
        axis.addColorStop(1, rgba(e, 0));
        ctx.fillStyle = axis;
        ctx.fillRect(0, midY - 0.35, w, 0.7);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (barW + gap);
        const amp = levels[i] * maxHalf;
        const tPos = i / (BAR_COUNT - 1);
        const rgb = barRgb(neon, tPos);
        // Fade en los extremos del canvas
        const edgeFade = Math.min(1, Math.min(tPos, 1 - tPos) / 0.06);

        const drawHalf = (up) => {
          let traveled = 0;
          let n = 0;
          while (traveled < amp - 0.4) {
            const sh = Math.min(segH, amp - traveled);
            const y = up ? midY - traveled - sh : midY + traveled;
            const along = traveled / Math.max(amp, 1);
            // Más brillante cerca del eje; punta un poco más intensa
            const tipBoost = along > 0.72 ? 0.18 : 0;
            const alpha = (0.28 + (1 - along) * 0.62 + tipBoost) * edgeFade;
            ctx.fillStyle = rgba(rgb, alpha);
            // Capsule suave: rectangulo + un pelín de inset
            const inset = barW > 2.2 ? 0.25 : 0;
            ctx.fillRect(x + inset, y, barW - inset * 2, sh);
            traveled += sh + SEG_GAP;
            n += 1;
            if (n > 40) break;
          }
        };

        // Punto del eje por columna
        ctx.fillStyle = rgba(rgb, 0.75 * edgeFade);
        ctx.fillRect(x, midY - 0.45, barW, 0.9);

        drawHalf(true);
        drawHalf(false);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      const a = audioRef.current;
      try {
        a.source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        a.analyser?.disconnect();
      } catch {
        /* ignore */
      }
      if (a.ctx && a.ctx.state !== 'closed') {
        a.ctx.close().catch(() => {});
      }
      audioRef.current = {
        ctx: null,
        analyser: null,
        source: null,
        trackId: null,
        freq: null,
      };
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`ptt-voice-bar${active ? ' is-live' : ' is-idle'}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="ptt-voice-bar-canvas" />
    </div>
  );
}
