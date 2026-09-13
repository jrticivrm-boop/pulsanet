import { AudioPresets, VideoPreset, VideoPresets } from 'livekit-client';

/**
 * Calidad visible en despacho (monitor / 1:1):
 *  - Captura 720p @ 30 FPS, ~3.2 Mbps (VP8 + E2EE)
 *  - Sin simulcast (una capa nítida; evita bajar a 360 automáticamente)
 */
export const STREAM_FPS = 30;

export const VIDEO_LAYER_720 = new VideoPreset(1280, 720, 3_200_000, STREAM_FPS);
export const VIDEO_LAYER_540 = new VideoPreset(960, 540, 1_800_000, STREAM_FPS);
export const VIDEO_LAYER_360 = new VideoPreset(640, 360, 700_000, STREAM_FPS);

export const VIDEO_CAPTURE_PRESET = VIDEO_LAYER_720;

const CAPTURE_FALLBACKS = [VIDEO_LAYER_720, VIDEO_LAYER_540, VIDEO_LAYER_360, VideoPresets.h360];

export function getVideoCaptureDefaults(facingMode = 'user', preset = VIDEO_CAPTURE_PRESET) {
  return {
    resolution: preset.resolution,
    frameRate: STREAM_FPS,
    facingMode: facingMode === 'environment' ? 'environment' : 'user',
  };
}

export function oppositeFacingMode(facingMode) {
  return facingMode === 'environment' ? 'user' : 'environment';
}

export async function createStreamingVideoTrack(createLocalVideoTrack, facingMode = 'user') {
  let lastErr;
  for (const preset of CAPTURE_FALLBACKS) {
    try {
      return await createLocalVideoTrack(getVideoCaptureDefaults(facingMode, preset));
    } catch (e) {
      lastErr = e;
    }
  }
  try {
    return await createLocalVideoTrack({
      facingMode: facingMode === 'environment' ? 'environment' : 'user',
      frameRate: STREAM_FPS,
    });
  } catch (e) {
    throw lastErr || e || new Error('No se pudo abrir la cámara');
  }
}

export function isCameraTrackDead(track) {
  if (!track) return true;
  const media = track.mediaStreamTrack;
  if (!media) return true;
  if (media.readyState === 'ended') return true;
  return false;
}

export function bindVideoTrackToElement(track, el, { muted = false } = {}) {
  if (!el || !track) return false;
  const media = track.mediaStreamTrack;
  try {
    el.autoplay = true;
    el.playsInline = true;
    el.muted = Boolean(muted);
    if (media && media.readyState !== 'ended') {
      const cur = el.srcObject;
      const same =
        cur instanceof MediaStream &&
        cur.getVideoTracks().length === 1 &&
        cur.getVideoTracks()[0] === media;
      if (!same) {
        el.srcObject = new MediaStream([media]);
      }
    } else if (typeof track.attach === 'function') {
      track.attach(el);
    } else {
      return false;
    }
    const p = el.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    try {
      track.attach?.(el);
      el.play?.()?.catch?.(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

export function unbindVideoElement(track, el) {
  if (!el) return;
  try {
    track?.detach?.(el);
  } catch {
    /* ignore */
  }
  try {
    el.srcObject = null;
  } catch {
    /* ignore */
  }
}

export const STREAMING_ROOM_OPTIONS = {
  // El mosaico enlaza por `srcObject` (ver bindVideoTrackToElement), así que
  // adaptiveStream no ve los elementos y solo puede pausar tracks visibles.
  adaptiveStream: false,
  dynacast: false,
  disconnectOnPageLeave: false,
  audioCaptureDefaults: {
    // Alineado con PTT: NS+DTX metálico; AEC+AGC sí.
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  },
  videoCaptureDefaults: getVideoCaptureDefaults('user'),
  publishDefaults: {
    stopMicTrackOnMute: false,
    videoCodec: 'vp8',
    videoEncoding: {
      maxBitrate: VIDEO_CAPTURE_PRESET.encoding.maxBitrate,
      maxFramerate: STREAM_FPS,
    },
    simulcast: false,
    videoSimulcastLayers: [],
    // Baja FPS antes que reescalar: nitidez sobre fluidez en despacho.
    degradationPreference: 'maintain-resolution',
    audioPreset: AudioPresets.speech,
    dtx: false,
    red: false,
    forceStereo: false,
  },
};

export function mergeStreamingRoomOptions(extra = {}) {
  return {
    ...STREAMING_ROOM_OPTIONS,
    ...extra,
    audioCaptureDefaults: {
      ...STREAMING_ROOM_OPTIONS.audioCaptureDefaults,
      ...(extra.audioCaptureDefaults || {}),
    },
    videoCaptureDefaults: {
      ...STREAMING_ROOM_OPTIONS.videoCaptureDefaults,
      ...(extra.videoCaptureDefaults || {}),
    },
    publishDefaults: {
      ...STREAMING_ROOM_OPTIONS.publishDefaults,
      ...(extra.publishDefaults || {}),
    },
  };
}
