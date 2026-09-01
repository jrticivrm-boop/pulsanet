import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';

/// Sesión de audio **solo mientras** hay radio/llamada activa.
///
/// No activar al arrancar la app: secuestra volumen (modo llamada),
/// notificaciones de otras apps y pelea con cámara/mic del sistema.
class AudioSessionSetup {
  AudioSessionSetup._();

  /// Quiere sesión (canal LiveKit o llamada).
  static bool _wanted = false;
  static bool _voiceMode = false;

  /// Escucha de canal: volumen **multimedia**, mix con otras apps.
  static Future<void> acquireRadio() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = true;
    _voiceMode = false;
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playback,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.mixWithOthers |
                  AVAudioSessionCategoryOptions.allowBluetooth,
          avAudioSessionMode: AVAudioSessionMode.defaultMode,
          avAudioSessionRouteSharingPolicy:
              AVAudioSessionRouteSharingPolicy.defaultPolicy,
          avAudioSessionSetActiveOptions: AVAudioSessionSetActiveOptions.none,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.media,
            flags: AndroidAudioFlags.none,
          ),
          androidAudioFocusGainType:
              AndroidAudioFocusGainType.gainTransientMayDuck,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (e) {
      debugPrint('AudioSessionSetup.acquireRadio: $e');
    }
  }

  /// PTT al aire o llamada 1:1. Ducking: no silencia del todo otras apps.
  static Future<void> acquireVoice() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = true;
    _voiceMode = true;
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.voiceChat,
          avAudioSessionRouteSharingPolicy:
              AVAudioSessionRouteSharingPolicy.defaultPolicy,
          avAudioSessionSetActiveOptions: AVAudioSessionSetActiveOptions.none,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType:
              AndroidAudioFocusGainType.gainTransientMayDuck,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (e) {
      debugPrint('AudioSessionSetup.acquireVoice: $e');
    }
  }

  /// Libera foco y restaura ruta de audio del sistema.
  static Future<void> release() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = false;
    _voiceMode = false;
    try {
      final session = await AudioSession.instance;
      await session.setActive(false);
    } catch (e) {
      debugPrint('AudioSessionSetup.release: $e');
    }
    await resetRouting();
  }

  static Future<void> releaseAll() => release();

  static Future<void> resetRouting() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    try {
      await AudioManager.instance.setSpeakerOutputPreferred(false);
    } catch (_) {}
    try {
      // ignore: deprecated_member_use
      await Hardware.instance.setSpeakerphoneOn(false);
    } catch (_) {}
  }

  /// Antes de abrir la cámara: suelta la sesión (sin olvidar que sigue “wanted”).
  static Future<void> pauseForCamera() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    try {
      final session = await AudioSession.instance;
      await session.setActive(false);
    } catch (_) {}
    await resetRouting();
  }

  static Future<void> resumeAfterCamera() async {
    if (!_wanted) return;
    if (_voiceMode) {
      await acquireVoice();
    } else {
      await acquireRadio();
    }
  }
}
