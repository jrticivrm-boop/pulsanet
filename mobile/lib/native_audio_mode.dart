import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Lectura y rescate del `AudioManager.mode` de Android.
///
/// Red de seguridad: si algún plugin (WebRTC/LiveKit, reproductores, grabador)
/// deja el teléfono en `MODE_IN_COMMUNICATION`, todo el sistema lo trata como
/// llamada activa y apps como WhatsApp se niegan a grabar notas de voz.
class NativeAudioMode {
  NativeAudioMode._();

  static const _channel = MethodChannel('com.tacticalptx.app/audio');

  /// `normal` | `ringtone` | `inCall` | `inCommunication` | `callScreening`.
  static Future<String> mode() async {
    if (kIsWeb || !Platform.isAndroid) return 'unknown';
    try {
      return await _channel.invokeMethod<String>('getMode') ?? 'unknown';
    } catch (e) {
      debugPrint('NativeAudioMode.mode: $e');
      return 'unknown';
    }
  }

  /// Devuelve el modo a `MODE_NORMAL` **solo** si quedó en modo llamada.
  ///
  /// Llamar únicamente cuando la app ya no captura audio (sin PTT, sin llamada
  /// 1:1, sin video grupal): así no pelea con una sesión de voz legítima.
  static Future<void> ensureNormal() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      final result = await _channel.invokeMethod<String>('ensureNormalMode');
      if (result != null && result != 'normal') {
        debugPrint('NativeAudioMode: el modo sigue en $result');
      }
    } catch (e) {
      debugPrint('NativeAudioMode.ensureNormal: $e');
    }
  }
}
