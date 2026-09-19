import 'package:shared_preferences/shared_preferences.dart';

/// Catálogo de tonos de la APK (alineado con assets + res/raw).
///
/// - [system]: ringtone del teléfono (solo llamadas/video).
/// - [tacticalMsg]: chirp radio (`tactical_msg.wav`).
/// - [nudgeBuzz]: zumbido DM (`nudge_buzz.wav`).
/// - [silent]: sin audio (sí puede vibrar según el canal).
enum AppToneId {
  system,
  tacticalMsg,
  nudgeBuzz,
  silent,
}

extension AppToneIdX on AppToneId {
  String get storageValue {
    switch (this) {
      case AppToneId.system:
        return 'system';
      case AppToneId.tacticalMsg:
        return 'tactical_msg';
      case AppToneId.nudgeBuzz:
        return 'nudge_buzz';
      case AppToneId.silent:
        return 'silent';
    }
  }

  String get labelEs {
    switch (this) {
      case AppToneId.system:
        return 'Tono del teléfono';
      case AppToneId.tacticalMsg:
        return 'Chirp táctico';
      case AppToneId.nudgeBuzz:
        return 'Zumbido';
      case AppToneId.silent:
        return 'Silencio';
    }
  }

  /// Ruta Flutter asset (null = sistema o silencio).
  String? get assetPath {
    switch (this) {
      case AppToneId.tacticalMsg:
        return 'sounds/tactical_msg.wav';
      case AppToneId.nudgeBuzz:
        return 'sounds/nudge_buzz.wav';
      case AppToneId.system:
      case AppToneId.silent:
        return null;
    }
  }

  /// Nombre en `res/raw` (Android notificación). Null = canal sin raw propio.
  String? get androidRaw {
    switch (this) {
      case AppToneId.tacticalMsg:
        return 'tactical_msg';
      case AppToneId.nudgeBuzz:
        return 'nudge_buzz';
      case AppToneId.system:
      case AppToneId.silent:
        return null;
    }
  }

  String? get iosFileName {
    switch (this) {
      case AppToneId.tacticalMsg:
        return 'tactical_msg.wav';
      case AppToneId.nudgeBuzz:
        return 'nudge_buzz.wav';
      case AppToneId.system:
      case AppToneId.silent:
        return null;
    }
  }
}

AppToneId appToneFromStorage(String? raw, {required AppToneId fallback}) {
  switch ((raw ?? '').trim()) {
    case 'system':
      return AppToneId.system;
    case 'tactical_msg':
      return AppToneId.tacticalMsg;
    case 'nudge_buzz':
      return AppToneId.nudgeBuzz;
    case 'silent':
      return AppToneId.silent;
    default:
      return fallback;
  }
}

/// Preferencias de sonido — una sola fuente para UI, AudioPlayer y notificaciones.
class SoundPrefs {
  SoundPrefs._();

  static const _kMessage = 'sound_tone_message_v1';
  static const _kCall = 'sound_tone_call_v1';
  static const _kVideo = 'sound_tone_video_v1';
  static const _kNudge = 'sound_tone_nudge_v1';

  /// Tonos disponibles para mensajes / zumbido (sin ringtone del sistema).
  static const messageChoices = <AppToneId>[
    AppToneId.tacticalMsg,
    AppToneId.nudgeBuzz,
    AppToneId.silent,
  ];

  /// Tonos para llamada / videollamada (incluye ringtone del SO).
  static const callChoices = <AppToneId>[
    AppToneId.system,
    AppToneId.tacticalMsg,
    AppToneId.nudgeBuzz,
    AppToneId.silent,
  ];

  static Future<AppToneId> messageTone() async {
    final p = await SharedPreferences.getInstance();
    return appToneFromStorage(p.getString(_kMessage), fallback: AppToneId.tacticalMsg);
  }

  static Future<AppToneId> callTone() async {
    final p = await SharedPreferences.getInstance();
    return appToneFromStorage(p.getString(_kCall), fallback: AppToneId.system);
  }

  static Future<AppToneId> videoTone() async {
    final p = await SharedPreferences.getInstance();
    // Si nunca se eligió video, hereda el tono de llamada (sin desfase).
    if (!p.containsKey(_kVideo)) return callTone();
    return appToneFromStorage(p.getString(_kVideo), fallback: AppToneId.system);
  }

  static Future<AppToneId> nudgeTone() async {
    final p = await SharedPreferences.getInstance();
    return appToneFromStorage(p.getString(_kNudge), fallback: AppToneId.nudgeBuzz);
  }

  static Future<void> setMessageTone(AppToneId id) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kMessage, id.storageValue);
  }

  static Future<void> setCallTone(AppToneId id) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kCall, id.storageValue);
  }

  static Future<void> setVideoTone(AppToneId id) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kVideo, id.storageValue);
  }

  static Future<void> setNudgeTone(AppToneId id) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kNudge, id.storageValue);
  }

  /// Sufijo de canal Android: al cambiar tono se crea canal nuevo (Android no
  /// actualiza el sonido de un channelId existente).
  static String channelSuffix(AppToneId id) => id.storageValue;
}
