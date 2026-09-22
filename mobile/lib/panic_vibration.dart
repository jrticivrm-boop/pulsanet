import 'package:vibration/vibration.dart';

/// Vibración fuerte vía API nativa (no solo HapticFeedback).
class PanicVibration {
  /// 500 ms on / 200 ms off, se repite hasta [stop].
  static const List<int> _alarmPattern = [0, 500, 200];
  static const List<int> _alarmIntensities = [0, 255, 0];

  /// Ráfaga de confirmación al pulsar PÁNICO.
  static const List<int> _sendBurst = [0, 250, 80, 250, 80, 500];
  static const List<int> _sendIntensities = [0, 255, 0, 255, 0, 255];

  /// Zumbido estilo Messenger (~1.45 s).
  static const List<int> _nudgeBurst = [
    0, 70, 45, 70, 45, 90, 50, 200, 60, 80,
    45, 80, 45, 100, 55, 140, 50, 70, 40, 60,
  ];
  static const List<int> _nudgeIntensities = [
    0, 230, 0, 230, 0, 255, 0, 255, 0, 220,
    0, 220, 0, 240, 0, 200, 0, 210, 0, 180,
  ];

  static DateTime? _lastNudgeAt;

  static Future<bool> _ready() async {
    try {
      return await Vibration.hasVibrator() == true;
    } catch (_) {
      return false;
    }
  }

  /// Alarma entrante: patrón fuerte en bucle hasta [stop].
  static Future<void> startAlarm() async {
    try {
      if (!await _ready()) return;
      await Vibration.cancel();
      final amp = await Vibration.hasAmplitudeControl() == true;
      await Vibration.vibrate(
        pattern: _alarmPattern,
        intensities: amp ? _alarmIntensities : const [],
        repeat: 0,
      );
    } catch (_) {}
  }

  static Future<void> stop() async {
    try {
      await Vibration.cancel();
    } catch (_) {}
  }

  /// Confirmación al emisor al tocar PÁNICO.
  static Future<void> confirmSend() async {
    try {
      if (!await _ready()) return;
      final amp = await Vibration.hasAmplitudeControl() == true;
      if (amp) {
        await Vibration.vibrate(
          pattern: _sendBurst,
          intensities: _sendIntensities,
        );
      } else {
        await Vibration.vibrate(pattern: _sendBurst);
      }
    } catch (_) {}
  }

  /// Zumbido DM: vibración larga + el tono se dispara aparte ([playNudgeTone]).
  static Future<void> nudge() async {
    final now = DateTime.now();
    if (_lastNudgeAt != null &&
        now.difference(_lastNudgeAt!) < const Duration(milliseconds: 400)) {
      return;
    }
    _lastNudgeAt = now;
    try {
      if (!await _ready()) return;
      await Vibration.cancel();
      final amp = await Vibration.hasAmplitudeControl() == true;
      if (amp) {
        await Vibration.vibrate(
          pattern: _nudgeBurst,
          intensities: _nudgeIntensities,
        );
      } else {
        await Vibration.vibrate(pattern: _nudgeBurst);
      }
    } catch (_) {}
  }
}
