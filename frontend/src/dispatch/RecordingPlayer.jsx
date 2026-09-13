import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecordingBlobUrl } from '../api';
import { downloadFromObjectUrl } from '../chatMediaActions';

/**
 * Mini reproductor embebido en las filas de «Grabaciones PTT».
 *
 * Modelado sobre la nota de voz del chat (ChatMedia.jsx) pero con los
 * controles que pide despacho: saltos de ±10 s, velocidad y realce de voz
 * por encima del 100 % (Web Audio: GainNode + DynamicsCompressorNode).
 *
 * El `src` se asigna al elemento de forma imperativa —no por prop de React—
 * porque `play()` se llama en el mismo tick que la descarga del blob y un
 * `setState` todavía no habría pintado el atributo (el elemento se quedaba
 * «sin fuentes» y `play()` rechazaba con NotSupportedError).
 */

/** Solo una grabación suena a la vez. */
const recBus = typeof window !== 'undefined' ? new EventTarget() : null;

/** Avisa a los mini reproductores que otro audio tomó la salida. */
export function pauseOtherRecordings(id = 'external') {
  recBus?.dispatchEvent(new CustomEvent('rec-play', { detail: { id } }));
}

/** Permite a reproductores externos pausarse cuando una fila toma la salida. */
export function onRecordingPlay(handler) {
  if (!recBus) return () => {};
  const listener = (ev) => handler(ev.detail?.id);
  recBus.addEventListener('rec-play', listener);
  return () => recBus.removeEventListener('rec-play', listener);
}

const SPEEDS = [0.5, 1, 1.5, 2];
const BOOSTS = [1, 2, 3];
const SKIP = 10;

const MEDIA_ERR = {
  2: 'Se cortó la descarga del audio',
  3: 'El audio está dañado y no se pudo decodificar',
  4: 'Este navegador no soporta el formato de la grabación',
};

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Traduce la excepción real a un mensaje que diga qué pasó. */
function describeError(e) {
  const http = /^Audio (\d+)$/.exec(e?.message || '');
  if (http) {
    if (http[1] === '401' || http[1] === '403') return 'Sin permiso para oír esta grabación';
    if (http[1] === '404') return 'El archivo de la grabación ya no está en el servidor';
    return `No se pudo descargar el audio (HTTP ${http[1]})`;
  }
  if (e?.name === 'NotAllowedError') return 'El navegador pidió otro toque: pulsa de nuevo ▶';
  if (e?.name === 'NotSupportedError') return 'Este navegador no soporta el formato de la grabación';
  if (e?.name === 'TypeError') return 'No se pudo contactar al servidor de audio';
  return e?.message ? `No se pudo reproducir: ${e.message}` : 'No se pudo reproducir el audio';
}

export default function RecordingPlayer({ token, recordingId, durationMs, label }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const urlRef = useRef(null);
  const idRef = useRef(`rec-${Math.random().toString(36).slice(2)}`);
  const graphRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState('');
  const [note, setNote] = useState('');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(
    durationMs != null && durationMs > 0 ? durationMs / 1000 : 0
  );
  const [speed, setSpeed] = useState(1);
  const [boost, setBoost] = useState(1);
  const [volume, setVolume] = useState(1);
  const [tools, setTools] = useState(false);

  const bars = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => {
        const n = Math.sin(i * 0.55) * 0.35 + Math.cos(i * 1.1) * 0.25 + 0.55;
        return Math.round(22 + n * 58);
      }),
    []
  );

  /** Un solo enganche de listeners, al montar: el elemento ya existe. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const readDuration = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        return;
      }
      if (audio.seekable?.length) {
        const end = audio.seekable.end(audio.seekable.length - 1);
        if (Number.isFinite(end) && end > 0) setDuration(end);
      }
    };
    const onTime = () => {
      setCurrent(audio.currentTime || 0);
      readDuration();
    };
    const onPlay = () => {
      setPlaying(true);
      setFailed('');
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onErr = () => {
      const code = audio.error?.code;
      // code 1 = abortado por nosotros (cambio de src / desmontaje): no es fallo.
      if (!code || code === 1) return;
      setFailed(MEDIA_ERR[code] || 'No se pudo reproducir el audio');
    };
    const onForeignPlay = (ev) => {
      if (ev.detail?.id !== idRef.current) audio.pause();
    };

    audio.addEventListener('loadedmetadata', readDuration);
    audio.addEventListener('durationchange', readDuration);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onErr);
    recBus?.addEventListener('rec-play', onForeignPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', readDuration);
      audio.removeEventListener('durationchange', readDuration);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onErr);
      recBus?.removeEventListener('rec-play', onForeignPlay);
      audio.pause();
    };
  }, []);

  useEffect(
    () => () => {
      try {
        graphRef.current?.ctx?.close();
      } catch {
        /* ignore */
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  /** Descarga el audio con el token y lo engancha al elemento ya, sin esperar a React. */
  const ensureSrc = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return null;
    if (urlRef.current) {
      if (audio.src !== urlRef.current) {
        audio.src = urlRef.current;
        audio.load();
      }
      return urlRef.current;
    }
    setLoading(true);
    try {
      const url = await fetchRecordingBlobUrl(token, recordingId);
      urlRef.current = url;
      audio.src = url;
      audio.load();
      setFailed('');
      return url;
    } catch (e) {
      setFailed(describeError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, recordingId]);

  /**
   * Cadena Web Audio para amplificar más allá del 100 %: el compresor levanta
   * las partes bajitas y el gain sube el total sin saturar los picos.
   * Se construye solo dentro de un gesto del usuario (clic en ×2/×3) y con el
   * contexto ya reanudado; si algo falla, el audio sigue por la ruta simple.
   */
  const ensureGraph = useCallback(async () => {
    if (graphRef.current) {
      if (graphRef.current.ctx.state !== 'running') {
        try {
          await graphRef.current.ctx.resume();
        } catch {
          /* ignore */
        }
      }
      return graphRef.current;
    }
    const audio = audioRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audio || !Ctx) return null;
    let ctx;
    try {
      ctx = new Ctx();
      if (ctx.state !== 'running') await ctx.resume();
      if (ctx.state !== 'running') throw new Error('AudioContext suspendido');
      const source = ctx.createMediaElementSource(audio);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -32;
      comp.knee.value = 24;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(comp);
      comp.connect(gain);
      gain.connect(ctx.destination);
      graphRef.current = { ctx, gain };
      return graphRef.current;
    } catch {
      try {
        ctx?.close();
      } catch {
        /* ignore */
      }
      return null;
    }
  }, []);

  async function applyBoost(next) {
    if (next <= 1) {
      setBoost(1);
      setNote('');
      if (graphRef.current) graphRef.current.gain.gain.value = 1;
      return;
    }
    const graph = await ensureGraph();
    if (!graph) {
      setBoost(1);
      setNote('Realce no disponible aquí; suena al 100 %');
      return;
    }
    graph.gain.gain.value = next;
    setBoost(next);
    setNote('');
  }

  function applySpeed(next) {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function applyVolume(next) {
    setVolume(next);
    if (audioRef.current) audioRef.current.volume = next;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    const url = await ensureSrc();
    if (!url) return;
    recBus?.dispatchEvent(new CustomEvent('rec-play', { detail: { id: idRef.current } }));
    if (graphRef.current && graphRef.current.ctx.state !== 'running') {
      try {
        await graphRef.current.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    try {
      audio.playbackRate = speed;
      audio.volume = volume;
      await audio.play();
      setFailed('');
    } catch (e) {
      // `pause()` durante un `play()` pendiente aborta la promesa: no es un fallo.
      if (e?.name === 'AbortError') return;
      setFailed(describeError(e));
    }
  }

  function seekTo(next) {
    const audio = audioRef.current;
    const max = duration || 0;
    const clamped = Math.min(max || next, Math.max(0, next));
    if (audio && Number.isFinite(clamped)) {
      try {
        audio.currentTime = clamped;
      } catch {
        /* ignore */
      }
    }
    setCurrent(clamped);
  }

  function skip(delta) {
    seekTo((audioRef.current?.currentTime ?? current) + delta);
  }

  function seekFromPointer(clientX) {
    const track = trackRef.current;
    if (!track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }

  async function download() {
    const url = await ensureSrc();
    if (!url) return;
    await downloadFromObjectUrl(url, `${label || 'grabacion'}.webm`);
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className={`cc-rec-player${playing ? ' is-playing' : ''}`}
      role="group"
      aria-label={label ? `Reproductor de ${label}` : 'Reproductor de grabación'}
    >
      <audio ref={audioRef} preload="none" />

      <div className="cc-rec-main">
        <button
          type="button"
          className="cc-rec-play"
          onClick={togglePlay}
          aria-label={playing ? 'Pausar grabación' : 'Reproducir grabación'}
          title={playing ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
        >
          {loading ? (
            <span className="cc-rec-spin" aria-hidden="true" />
          ) : playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M8.2 5.6v12.8c0 .7.8 1.1 1.4.7l9.2-6.4c.5-.4.5-1.1 0-1.4L9.6 4.9c-.6-.4-1.4 0-1.4.7z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="cc-rec-skip"
          onClick={() => skip(-SKIP)}
          aria-label={`Retroceder ${SKIP} segundos`}
          title={`− ${SKIP} s`}
        >
          −{SKIP}
        </button>

        <div
          className="cc-rec-track"
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Posición de la grabación"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} de ${formatTime(duration)}`}
          onPointerDown={(e) => {
            if (!duration) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            seekFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            seekFromPointer(e.clientX);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              skip(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              skip(-1);
            } else if (e.key === 'Home') {
              e.preventDefault();
              seekTo(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              seekTo(duration);
            } else if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              togglePlay();
            }
          }}
        >
          <span className="cc-rec-wave" aria-hidden="true">
            {bars.map((h, i) => (
              <i
                key={i}
                className={progress >= ((i + 0.5) / bars.length) * 100 ? 'on' : undefined}
                style={{ height: `${h}%` }}
              />
            ))}
          </span>
          <span className="cc-rec-thumb" style={{ left: `${progress}%` }} aria-hidden="true" />
        </div>

        <span className="cc-rec-time">
          {formatTime(current)}
          <span className="cc-rec-time-sep"> / </span>
          {duration ? formatTime(duration) : '—:—'}
        </span>

        <button
          type="button"
          className="cc-rec-skip"
          onClick={() => skip(SKIP)}
          aria-label={`Adelantar ${SKIP} segundos`}
          title={`+ ${SKIP} s`}
        >
          +{SKIP}
        </button>

        <button
          type="button"
          className={`cc-rec-tool-btn${boost > 1 || speed !== 1 ? ' is-on' : ''}`}
          onClick={() => setTools((v) => !v)}
          aria-expanded={tools}
          aria-label="Ajustes de audio: velocidad, realce de voz y volumen"
          title="Velocidad · realce de voz · volumen"
        >
          {boost > 1 ? `×${boost}` : speed !== 1 ? `${speed}×` : '⚙'}
        </button>
      </div>

      {tools && (
        <div className="cc-rec-tools" role="group" aria-label="Ajustes de audio">
          <div className="cc-rec-tool-row">
            <span className="cc-rec-tool-lbl">Realce de voz</span>
            <div className="cc-rec-chips">
              {BOOSTS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`cc-rec-chip${boost === b ? ' on' : ''}`}
                  onClick={() => applyBoost(b)}
                  aria-pressed={boost === b}
                  aria-label={`Volumen por ${b}`}
                >
                  ×{b}
                </button>
              ))}
            </div>
          </div>
          <div className="cc-rec-tool-row">
            <span className="cc-rec-tool-lbl">Velocidad</span>
            <div className="cc-rec-chips">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`cc-rec-chip${speed === s ? ' on' : ''}`}
                  onClick={() => applySpeed(s)}
                  aria-pressed={speed === s}
                  aria-label={`Velocidad ${s}x`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <div className="cc-rec-tool-row">
            <span className="cc-rec-tool-lbl">Volumen</span>
            <input
              type="range"
              className="cc-rec-vol"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              aria-label="Volumen"
            />
          </div>
          <button type="button" className="cc-rec-dl" onClick={download}>
            Descargar audio
          </button>
        </div>
      )}

      {note && <span className="cc-rec-note">{note}</span>}
      {failed && <span className="cc-rec-err">{failed}</span>}
    </div>
  );
}
