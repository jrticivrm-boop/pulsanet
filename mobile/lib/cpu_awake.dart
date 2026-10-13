import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Wakelock parcial (CPU) solo mientras hay actividad real: radio al aire o
/// recibiendo, llamada 1:1, video grupal o cámara/mic remoto.
/// El servicio en primer plano ya no lo retiene de forma permanente.
class CpuAwake {
  CpuAwake._();

  static const _channel = MethodChannel('com.tacticalptx.app/audio');
  static final Set<String> _reasons = <String>{};
  static bool _held = false;

  static bool get held => _held;

  static void hold(String reason) {
    _reasons.add(reason);
    _sync();
  }

  static void release(String reason) {
    _reasons.remove(reason);
    _sync();
  }

  static void set(String reason, bool on) => on ? hold(reason) : release(reason);

  static void _sync() {
    final want = _reasons.isNotEmpty;
    if (want == _held) return;
    _held = want;
    if (kIsWeb || !Platform.isAndroid) return;
    _channel.invokeMethod<bool>('setCpuAwake', {'on': want}).catchError((Object e) {
      debugPrint('CpuAwake: $e');
      return false;
    });
  }
}
