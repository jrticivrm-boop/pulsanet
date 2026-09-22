/**
 * Captura y MediaRecorder orientados a voz inteligible (menos “robótico”).
 * El efecto metálico suele venir de noiseSuppression agresivo + bitrate Opus bajo.
 */

/** HTTP en IP pública/LAN no es secure context → navigator.mediaDevices es undefined. */
export const MIC_HTTPS_HINT =
  'Abre la consola por HTTPS (p. ej. https://IP:5173). En HTTP el navegador no permite el micrófono ni el PTT.';

export const VOICE_AUDIO_CONSTRAINTS = {
  channelCount: 1,
  sampleRate: 48000,
  sampleSize: 16,
  echoCancellation: true,
  // NS fuerte deforma formantes → voz tipo robot/IA
  noiseSuppression: false,
  autoGainControl: true,
};

/** Lanza error claro en español si getUserMedia no está disponible. */
export function assertMediaDevices() {
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const err = new Error(MIC_HTTPS_HINT);
  err.name = 'SecureContextRequired';
  throw err;
}

/** ~128 kbps Opus: claridad de voz sin inflar mucho el archivo */
export const VOICE_BITS_PER_SECOND = 128_000;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

export function pickVoiceMime() {
  return MIME_CANDIDATES.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

export function voiceFileExtension(mime) {
  const base = (mime || '').split(';')[0];
  if (base.includes('ogg')) return 'ogg';
  if (base.includes('mp4') || base.includes('m4a') || base.includes('aac')) return 'm4a';
  if (base.includes('wav')) return 'wav';
  return 'webm';
}

export async function getVoiceStream() {
  assertMediaDevices();
  return navigator.mediaDevices.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS });
}

/**
 * @param {MediaStream} stream
 * @returns {MediaRecorder}
 */
export function createVoiceRecorder(stream) {
  const mimeType = pickVoiceMime();
  const opts = { audioBitsPerSecond: VOICE_BITS_PER_SECOND };
  if (mimeType) opts.mimeType = mimeType;
  try {
    return new MediaRecorder(stream, opts);
  } catch {
    // Algunos navegadores rechazan audioBitsPerSecond con cierto mime
    try {
      return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      return new MediaRecorder(stream);
    }
  }
}
