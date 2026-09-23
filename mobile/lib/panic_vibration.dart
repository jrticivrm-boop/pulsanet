import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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

  static const _audioChannel = MethodChannel('com.tacticalptx.app/audio');

  static DateTime? _lastNudgeAt;

  /// Invalidación de alarmas en vuelo (plugin Flutter / retries).
  static int _alarmSession = 0;
  static final List<Timer> _stopRetries = <Timer>[];

  static Future<bool> _ready() async {
    try {
      return await Vibration.hasVibrator() == true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> _nativeStart() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      await _audioChannel.invokeMethod<void>('startAlarmVibration');
    } catch (e) {
      debugPrint('PanicVibration native start: $e');
    }
  }

  static Future<void> _nativeStop() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      await _audioChannel.invokeMethod<void>('stopAlarmVibration');
    } catch (e) {
      debugPrint('PanicVibration native stop: $e');
    }
  }

  /// Alarma entrante: patrón fuerte en bucle hasta [stop].
  /// En Android usa Vibrator nativo (cancel fiable al Enterado).
  static Future<void> startAlarm() async {
    final session = ++_alarmSession;
    _cancelStopRetries();
    try {
      if (Platform.isAndroid && !kIsWeb) {
        await _nativeStop();
        if (session != _alarmSession) return;
        await _nativeStart();
        if (session != _alarmSession) {
          await _nativeStop();
        }
        return;
      }
      if (!await _ready()) return;
      if (session != _alarmSession) return;
      await Vibration.cancel();
      if (session != _alarmSession) return;
      final amp = await Vibration.hasAmplitudeControl() == true;
      if (session != _alarmSession) return;
      await Vibration.vibrate(
        pattern: _alarmPattern,
        intensities: amp ? _alarmIntensities : const [],
        repeat: 0,
      );
      if (session != _alarmSession) {
        await Vibration.cancel();
      }
    } catch (_) {}
  }

  /// Corta la alarma de inmediato + reintentos (OEM tardan en aplicar cancel).
  static Future<void> stop() async {
    final session = ++_alarmSession;
    _cancelStopRetries();
    await _stopOnce();
    for (final ms in const [80, 220, 500]) {
      _stopRetries.add(Timer(Duration(milliseconds: ms), () {
        if (session != _alarmSession) return;
        unawaited(_stopOnce());
      }));
    }
  }

  static Future<void> _stopOnce() async {
    try {
      await _nativeStop();
    } catch (_) {}
    try {
      await Vibration.cancel();
    } catch (_) {}
  }

  static void _cancelStopRetries() {
    for (final t in _stopRetries) {
      t.cancel();
    }
    _stopRetries.clear();
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
