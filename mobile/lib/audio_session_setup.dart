// La API de sesión de audio de livekit_client está marcada @experimental,
// pero es la única forma soportada de elegir el AudioManager.mode en Android.
// ignore_for_file: experimental_member_use

import 'dart:async';
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
  static bool _manualArmed = false;

  /// true = no forzar MODE_NORMAL (PTT / llamada 1:1 / video / mic remoto).
  static bool Function()? shouldKeepVoiceMode;

  static final List<Timer> _reclaimTimers = [];

  /// LiveKit en automatic reaplica `communication` en cada connect; pasamos a
  /// manual para que el volumen quede en multimedia salvo PTT/llamada.
  static Future<void> _ensureManualMode() async {
    if (kIsWeb || !Platform.isAndroid) return;
    if (_manualArmed &&
        AudioManager.instance.managementMode ==
            AudioSessionManagementMode.manual) {
      return;
    }
    try {
      await AudioManager.instance
          .setAudioSessionManagementMode(AudioSessionManagementMode.manual);
      _manualArmed = true;
    } catch (e) {
      debugPrint('AudioSessionSetup._ensureManualMode: $e');
    }
  }

  /// Escucha de canal: volumen **multimedia**, mix con otras apps.
  static Future<void> acquireRadio() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = true;
    _voiceMode = false;
    await _ensureManualMode();
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
    await _applyLiveKitProfile(_LkProfile.media, force: true);
    await NativeAudioMode.ensureNormal();
  }

  /// PTT al aire o llamada 1:1. Foco exclusivo: no dejar que otras apps
  /// (ni el canal de radio) bajen el volumen de la conversación.
  static Future<void> acquireVoice() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = true;
    _voiceMode = true;
    await _ensureManualMode();
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.defaultToSpeaker,
          avAudioSessionMode: AVAudioSessionMode.voiceChat,
          avAudioSessionRouteSharingPolicy:
              AVAudioSessionRouteSharingPolicy.defaultPolicy,
          avAudioSessionSetActiveOptions: AVAudioSessionSetActiveOptions.none,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (e) {
      debugPrint('AudioSessionSetup.acquireVoice: $e');
    }
    await _applyLiveKitProfile(_LkProfile.voice, force: true);
  }

  /// Libera foco y restaura ruta de audio del sistema.
  static Future<void> release() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _wanted = false;
    _voiceMode = false;
    await _ensureManualMode();
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
    await _applyLiveKitProfile(_LkProfile.none, force: true);
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
  static Future<void> _applyLiveKitProfile(
    _LkProfile profile, {
    bool force = false,
  }) async {
    // iOS lo gestiona AVAudioSession vía `session.configure` de arriba.
    if (kIsWeb || !Platform.isAndroid) return;
    await _ensureManualMode();
    final owned = AudioManager.instance.managementMode ==
        AudioSessionManagementMode.manual;
    if (!force && owned && _lkProfile == profile) {
      if (profile != _LkProfile.voice) {
        await NativeAudioMode.ensureNormal();
      }
      return;
    }
    _lkProfile = profile;
    try {
      if (profile == _LkProfile.voice) {
        await AudioManager.instance
            .setAudioSessionOptions(const AudioSessionOptions.communication());
      } else if (profile == _LkProfile.media) {
        await AudioManager.instance.setAudioSessionOptions(
          const AudioSessionOptions.mediaPlayback(android: _kLkRadioAndroid),
        );
        await NativeAudioMode.ensureNormal();
      } else {
        await AudioManager.instance.deactivateAudioSession();
        await NativeAudioMode.ensureNormal();
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

  /// Tras minimizar / FGS: fuerza volumen multimedia salvo PTT/llamada/video.
  /// Camino barato si ya está en MODE_NORMAL (no rearmar LiveKit en el UI thread).
  static DateTime? _lastFullReclaimAt;
  static Future<void>? _reclaimInFlight;

  static Future<void> reclaimNormalVolume({bool forceFull = false}) async {
    if (kIsWeb || !Platform.isAndroid) return;
    if (shouldKeepVoiceMode?.call() == true) return;

    // Serializa llamadas concurrentes (lifecycle + FGS).
    if (_reclaimInFlight != null) {
      await _reclaimInFlight;
      return;
    }
    _reclaimInFlight = _reclaimNormalVolumeBody(forceFull: forceFull);
    try {
      await _reclaimInFlight;
    } finally {
      _reclaimInFlight = null;
    }
  }

  static Future<void> _reclaimNormalVolumeBody({required bool forceFull}) async {
    if (shouldKeepVoiceMode?.call() == true) return;

    // Solo nativo: barato. Si ya es normal, no tocar LiveKit (evita lag en Radio).
    final mode = await NativeAudioMode.mode();
    if (!forceFull && mode == 'normal' && !_voiceMode) {
      return;
    }

    final now = DateTime.now();
    if (!forceFull &&
        _lastFullReclaimAt != null &&
        now.difference(_lastFullReclaimAt!) < const Duration(seconds: 4)) {
      if (mode != 'normal' && mode != 'inCall') {
        await NativeAudioMode.ensureNormal();
      }
      return;
    }
    _lastFullReclaimAt = now;

    if (_voiceMode) {
      await downgradeFromVoice();
    } else if (_wanted && (forceFull || mode == 'inCommunication')) {
      // Solo rearmar media si el sistema cree que hay VoIP.
      await acquireRadio();
    }
    await NativeAudioMode.ensureNormal();

    // Reintentos solo si seguía en comunicación (LiveKit a veces lo repone).
    final after = await NativeAudioMode.mode();
    if (after == 'inCommunication') {
      _scheduleReclaimRetries();
    } else {
      _cancelReclaimTimers();
    }
  }

  /// Tick FGS (~12 s): corrige modo nativo; si LiveKit dejó VoIP, reafirma media.
  static Future<void> lightEnsureNormal() async {
    if (kIsWeb || !Platform.isAndroid) return;
    if (shouldKeepVoiceMode?.call() == true) return;
    if (_voiceMode) return;
    final mode = await NativeAudioMode.mode();
    if (mode == 'inCommunication' || mode == 'ringtone') {
      await NativeAudioMode.ensureNormal();
      // Escucha en 2º plano: volver a perfil media (sin release completo).
      if (_wanted) {
        try {
          await _applyLiveKitProfile(_LkProfile.media, force: true);
        } catch (e) {
          debugPrint('AudioSessionSetup.lightEnsureNormal media: $e');
        }
        await NativeAudioMode.ensureNormal();
      }
    }
  }

  static void _cancelReclaimTimers() {
    for (final t in _reclaimTimers) {
      t.cancel();
    }
    _reclaimTimers.clear();
  }

  static void _scheduleReclaimRetries() {
    _cancelReclaimTimers();
    for (final ms in const [500, 2000]) {
      _reclaimTimers.add(Timer(Duration(milliseconds: ms), () {
        unawaited(() async {
          if (shouldKeepVoiceMode?.call() == true) return;
          if (_voiceMode) return;
          try {
            final mode = await NativeAudioMode.mode();
            if (mode != 'inCommunication') return;
            if (_wanted) {
              await _applyLiveKitProfile(_LkProfile.media, force: true);
            }
            await NativeAudioMode.ensureNormal();
          } catch (e) {
            debugPrint('AudioSessionSetup.reclaim retry: $e');
          }
        }());
      }));
    }
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
    await _applyLiveKitProfile(_LkProfile.none, force: true);
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

void unawaited(Future<void> f) {
  f.catchError((Object e, StackTrace st) {
    debugPrint('AudioSessionSetup async: $e\n$st');
  });
}
