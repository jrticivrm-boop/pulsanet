import 'package:livekit_client/livekit_client.dart';

/// Calidad despacho / 1:1: 720p @ ~3.2 Mbps, 30 FPS, VP8, sin simulcast.
/// Audio alineado con PTT: NS + paso alto contra el siseo, DTX para ahorrar datos.
const int kStreamFps = 30;
const int kStreamMaxBitrate = 3200 * 1000;

const VideoParameters kVideoLayer720 = VideoParameters(
  dimensions: VideoDimensionsPresets.h720_169,
  encoding: VideoEncoding(maxBitrate: kStreamMaxBitrate, maxFramerate: kStreamFps),
);

CameraCaptureOptions streamingCameraCapture({
  CameraPosition position = CameraPosition.front,
  VideoParameters params = kVideoLayer720,
}) {
  return CameraCaptureOptions(
    cameraPosition: position,
    params: params,
    focusMode: CameraFocusMode.auto,
  );
}

final CameraCaptureOptions kStreamingCameraCapture = streamingCameraCapture();

/// Captura de micrófono (llamadas): AEC+AGC con supresión de ruido y filtro paso
/// alto (el AGC sin NS amplificaba el siseo de fondo). Silenciar suelta el micrófono.
const AudioCaptureOptions kCallAudioCapture = AudioCaptureOptions(
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  highPassFilter: true,
  stopAudioCaptureOnMute: true,
);

/// DTX: no se envían paquetes en silencio (menos datos móviles).
const AudioPublishOptions kCallAudioPublish = AudioPublishOptions(
  dtx: true,
  red: false,
  encoding: AudioEncoding.presetSpeech,
);

RoomOptions streamingRoomOptions({E2EEOptions? encryption}) {
  return RoomOptions(
    // adaptiveStream ayuda en 4G (sin simulcast: una sola capa).
    adaptiveStream: true,
    dynacast: false,
    defaultAudioCaptureOptions: kCallAudioCapture,
    defaultCameraCaptureOptions: kStreamingCameraCapture,
    defaultAudioPublishOptions: kCallAudioPublish,
    defaultVideoPublishOptions: const VideoPublishOptions(
      videoCodec: 'vp8',
      videoEncoding: VideoEncoding(
        maxBitrate: kStreamMaxBitrate,
        maxFramerate: kStreamFps,
      ),
      simulcast: false,
      // Identificar personas/placas pesa más que la fluidez: el encoder baja
      // FPS antes que reescalar a 360p (maintainFramerate se veía borroso).
      degradationPreference: DegradationPreference.maintainResolution,
      videoSimulcastLayers: [],
    ),
    encryption: encryption,
  );
}
