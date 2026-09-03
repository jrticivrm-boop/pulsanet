import { VideoPresets } from 'livekit-client';

/** Preset principal HD; LiveKit baja capas con adaptiveStream/simulcast. */
export const VIDEO_CAPTURE_PRESET = VideoPresets.h720;

/** `user` = frontal, `environment` = trasera. */
export function getVideoCaptureDefaults(facingMode = 'user') {
  return {
    resolution: VIDEO_CAPTURE_PRESET.resolution,
    facingMode: facingMode === 'environment' ? 'environment' : 'user',
  };
}

export function oppositeFacingMode(facingMode) {
  return facingMode === 'environment' ? 'user' : 'environment';
}

/** Opciones LiveKit optimizadas para streaming (1:1 y grupal). */
export const STREAMING_ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  disconnectOnPageLeave: false,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  videoCaptureDefaults: getVideoCaptureDefaults('user'),
  publishDefaults: {
    stopMicTrackOnMute: false,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
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
