import 'package:livekit_client/livekit_client.dart';

/// Preset HD 720p (16:9) para streaming 1:1 y grupal.
CameraCaptureOptions streamingCameraCapture({
  CameraPosition position = CameraPosition.front,
}) {
  return CameraCaptureOptions(
    cameraPosition: position,
    params: VideoParametersPresets.h720_169,
  );
}

/// Compat: captura frontal por defecto.
final CameraCaptureOptions kStreamingCameraCapture = streamingCameraCapture();

/// Opciones de sala LiveKit optimizadas para video (adaptive + simulcast).
RoomOptions streamingRoomOptions({E2EEOptions? encryption}) {
  return RoomOptions(
    adaptiveStream: true,
    dynacast: true,
    defaultAudioCaptureOptions: const AudioCaptureOptions(
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      stopAudioCaptureOnMute: false,
    ),
    defaultCameraCaptureOptions: kStreamingCameraCapture,
    defaultVideoPublishOptions: const VideoPublishOptions(
      simulcast: true,
      videoSimulcastLayers: [
        VideoParametersPresets.h180_169,
        VideoParametersPresets.h360_169,
        VideoParametersPresets.h720_169,
      ],
    ),
    encryption: encryption,
  );
}
