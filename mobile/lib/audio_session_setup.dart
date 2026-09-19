// La API de sesión de audio de livekit_client está marcada @experimental,
// pero es la única forma soportada de elegir el AudioManager.mode en Android.
// ignore_for_file: experimental_member_use

import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';

import 'native_audio_mode.dart';

/// Perfil de la sesión de audio **nativa** que gestiona LiveKit en Android.
enum _LkProfile { none, media, voice }

/// Escucha de radio: `MODE_NORMAL` (el sistema no cree que hay una llamada)
/// pero con enrutado gestionado para que el canal siga saliendo por el altavoz
/// y su volumen sea el multimedia.
const _kLkRadioAndroid = AndroidAudioSessionConfiguration(
  audioMode: AndroidAudioMode.normal,
  manageAudioFocus: true,
  focusMode: AndroidAudioFocusMode.gainTransientMayDuck,
  streamType: AndroidAudioStreamType.music,
  usageType: AndroidAudioAttributesUsageType.media,
  contentType: AndroidAudioAttributesContentType.speech,
  forceAudioRouting: true,
);

/// Sesión de audio **solo mientras** hay radio/llamada activa.
///
/// No activar al arrancar la app: secuestra volumen (modo llamada),
/// notificaciones de otras apps y pelea con cámara/mic del sistema.
class AudioSessionSetup {
  AudioSessionSetup._();

  /// Quiere sesión (canal LiveKit o llamada).
  static bool _wanted = false;
  static bool _voiceMode = false;
  static _LkProfile _lkProfile = _LkProfile.none;

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
    await _applyLiveKitProfile(_LkProfile.media);
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
    await _applyLiveKitProfile(_LkProfile.voice);
  }

  /// Libera foco y restaura ruta de audio del sistema.
  static Future<void> release() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = false;
    _voiceMode = false;
    try {
      final session = await AudioSession.instance;
      // Vuelve a playback/media antes de soltar (evita dejar MODE_IN_COMMUNICATION).
      await session.configure(
        const AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.ambient,
          avAudioSessionCategoryOptions: AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.defaultMode,
          androidAudioAttributes: AndroidAudioAttributes(
            contentType: AndroidAudioContentType.sonification,
            usage: AndroidAudioUsage.assistanceSonification,
            flags: AndroidAudioFlags.none,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gainTransientMayDuck,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(false);
    } catch (e) {
      debugPrint('AudioSessionSetup.release: $e');
    }
    await _applyLiveKitProfile(_LkProfile.none);
    await resetRouting();
    await NativeAudioMode.ensureNormal();
  }

  /// Elige el perfil de audio nativo que aplica LiveKit en Android.
  ///
  /// LiveKit aplica su preset `communication` (`AudioManager.MODE_IN_COMMUNICATION`
  /// + foco de llamada) al conectar **cualquier** Room y solo lo suelta al
  /// desconectar. Con el canal de radio abierto el teléfono queda «en llamada»
  /// para todo el sistema y WhatsApp se niega a grabar notas de voz. Aquí se
  /// usa modo voz solo mientras se captura micrófono y `media` (MODE_NORMAL)
  /// para la escucha del canal.
  static Future<void> _applyLiveKitProfile(_LkProfile profile) async {
    // iOS lo gestiona AVAudioSession vía `session.configure` de arriba.
    if (kIsWeb || !Platform.isAndroid) return;
    // Mientras LiveKit siga en modo automático vuelve a poner `communication`
    // en cada connect, así que no se puede confiar en el perfil memorizado.
    final owned = AudioManager.instance.managementMode ==
        AudioSessionManagementMode.manual;
    if (owned && _lkProfile == profile) return;
    _lkProfile = profile;
    try {
      if (profile == _LkProfile.voice) {
        await AudioManager.instance
            .setAudioSessionOptions(const AudioSessionOptions.communication());
      } else if (profile == _LkProfile.media) {
        await AudioManager.instance.setAudioSessionOptions(
          const AudioSessionOptions.mediaPlayback(android: _kLkRadioAndroid),
        );
      } else {
        await AudioManager.instance.deactivateAudioSession();
      }
      debugPrint('AudioSessionSetup: perfil LiveKit → ${profile.name}');
    } catch (e) {
      debugPrint('AudioSessionSetup: perfil LiveKit ${profile.name}: $e');
    }
  }

  static Future<void> releaseAll() => release();

  /// Si quedó modo voz/llamada (PTT a medias, race al minimizar), baja a media o suelta.
  /// Evita el aviso de WhatsApp «no se pueden grabar mensajes de voz durante una llamada».
  ///
  /// Se reaplica siempre (aunque el flag local diga que no hay modo voz) porque
  /// el modo real lo puede haber dejado en llamada un connect de LiveKit.
  static Future<void> downgradeFromVoice() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    if (_wanted) {
      await acquireRadio();
    } else {
      await release();
    }
    await NativeAudioMode.ensureNormal();
  }

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
    // La cámara del sistema graba con micrófono: hay que soltar modo y foco.
    await _applyLiveKitProfile(_LkProfile.none);
    await resetRouting();
    await NativeAudioMode.ensureNormal();
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
