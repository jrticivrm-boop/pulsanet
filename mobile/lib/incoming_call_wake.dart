import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'call_ringtone.dart';

/// Trae la app al frente y persiste llamada entrante (pantalla Contestar).
class IncomingCallWake {
  IncomingCallWake._();

  static const _pendingKey = 'tacticalptx_pending_incoming_call_v1';
  static const _channel = MethodChannel('com.tacticalptx.app/notifications');

  static bool _isCallPayload(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    return type == 'private_call' ||
        type == 'private_radio' ||
        type == 'private_video' ||
        type == 'private_video_request' ||
        type == 'group_video' ||
        (data['callId'] != null && data['mode'] != null);
  }

  static Future<void> persist(Map<String, dynamic> data) async {
    if (!_isCallPayload(data) && data['callId'] == null) return;
    final callId = data['callId']?.toString() ?? '';
    if (callId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _pendingKey,
      jsonEncode({
        'callId': callId,
        'callerId': data['callerId']?.toString(),
        'callerName':
            data['callerName']?.toString() ?? data['title']?.toString() ?? 'Usuario',
        'mode': data['mode']?.toString() ?? 'call',
        'intent': data['intent']?.toString(),
        'type': data['type']?.toString() ?? 'private_call',
        'title': data['title']?.toString(),
        'body': data['body']?.toString(),
        'savedAt': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  /// Lee y borra pendiente (máx. ~45 s).
  static Future<Map<String, dynamic>?> takePending() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null || raw.isEmpty) return null;
    await prefs.remove(_pendingKey);
    try {
      final map = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      final savedAt = int.tryParse(map['savedAt']?.toString() ?? '') ?? 0;
      if (savedAt > 0 &&
          DateTime.now().millisecondsSinceEpoch - savedAt > 45000) {
        return null;
      }
      return map;
    } catch (_) {
      return null;
    }
  }

  /// Trae Activity al frente (lock screen / background).
  /// Si la app ya está en primer plano, no llama `launchApp` (evita recrear Activity).
  static Future<void> bringUiToFront() async {
    if (kIsWeb) return;
    try {
      await _channel.invokeMethod<void>('bringToFrontForCall');
    } catch (e) {
      debugPrint('IncomingCallWake.bringToFront: $e');
    }
    try {
      final onFg = await FlutterForegroundTask.isAppOnForeground;
      if (!onFg) {
        FlutterForegroundTask.launchApp('/');
      }
    } catch (e) {
      debugPrint('IncomingCallWake.launchApp: $e');
    }
  }

  /// Isolate FCM data-only: persistir + abrir app + timbre.
  static Future<void> handleBackgroundWake(Map<String, dynamic> data) async {
    try {
      await persist(data);
      // ignore: unawaited_futures
      CallRingtone.start();
      await bringUiToFront();
    } catch (e, st) {
      debugPrint('IncomingCallWake.handleBackgroundWake: $e\n$st');
    }
  }
}
