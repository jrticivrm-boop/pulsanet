import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'background_radio.dart';
import 'call_ringtone.dart';

/// Trae la app al frente y persiste llamada entrante (pantalla Contestar).
class IncomingCallWake {
  IncomingCallWake._();

  static const _pendingKey = 'tacticalptx_pending_incoming_call_v1';
  static const _rejectKey = 'tacticalptx_reject_call_id_v1';
  static const _channel = MethodChannel('com.tacticalptx.app/notifications');

  static bool _isCallPayload(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    return type == 'private_call' ||
        type == 'private_radio' ||
        type == 'private_video' ||
        type == 'private_call_invite' ||
        type == 'private_video_invite' ||
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
        'autoAccept': data['autoAccept']?.toString(),
        'savedAt': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  /// Contestar desde notificación (bandeja / lock).
  static Future<void> persistAction({
    required String callId,
    required String action,
  }) async {
    if (callId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    Map<String, dynamic> base = {
      'callId': callId,
      'type': 'private_call',
      'mode': 'call',
      'callerName': 'Usuario',
      'savedAt': DateTime.now().millisecondsSinceEpoch,
    };
    final raw = prefs.getString(_pendingKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final prev = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        if (prev['callId']?.toString() == callId) {
          base = {...prev, ...base};
        }
      } catch (_) {}
    }
    if (action == 'accept') {
      base['autoAccept'] = '1';
    }
    await prefs.setString(_pendingKey, jsonEncode(base));
    if (action == 'accept') {
      await bringUiToFront();
    }
  }

  /// Rechazar desde notificación sin abrir UI.
  static Future<void> rejectFromNotification(String callId) async {
    if (callId.isEmpty) return;
    try {
      await CallRingtone.stop();
    } catch (_) {}
    try {
      final api = ApiClient();
      await api.loadSession();
      if (api.isLoggedIn) {
        await api.endPrivateCall(callId, reason: 'reject');
      }
    } catch (e) {
      debugPrint('IncomingCallWake.rejectFromNotification: $e');
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_pendingKey);
      if (raw != null && raw.contains(callId)) {
        await prefs.remove(_pendingKey);
      }
    } catch (_) {}
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

  /// Rechazo desde CallStyle nativo (bandeja) mientras Dart no estaba vivo.
  static Future<String?> takeNativeRejectCallId() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString(_rejectKey);
    if (id == null || id.isEmpty) return null;
    await prefs.remove(_rejectKey);
    return id;
  }

  /// Abre ajustes de pantalla completa si Samsung/Android 14 la denegó (una vez).
  static Future<bool> ensureFullScreenIntent({bool openSettings = true}) async {
    if (kIsWeb || !Platform.isAndroid) return true;
    try {
      final can = await _channel.invokeMethod<bool>('canUseFullScreenIntent');
      if (can == true) return true;
      if (!openSettings) return false;
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool('tacticalptx_fsi_settings_prompted_v1') == true) {
        return false;
      }
      await prefs.setBool('tacticalptx_fsi_settings_prompted_v1', true);
      final ok = await _channel.invokeMethod<bool>('ensureFullScreenIntent');
      return ok == true;
    } catch (e) {
      debugPrint('IncomingCallWake.ensureFullScreenIntent: $e');
      return true;
    }
  }

  /// Trae Activity al frente (lock screen / background / killed).
  /// En isolate FCM el MethodChannel de MainActivity suele fallar: `launchApp`
  /// + el receiver nativo [CallWakeFirebaseMessagingReceiver] ya arrancó FGS.
  static Future<void> bringUiToFront() async {
    if (kIsWeb) return;
    try {
      final onFg = await FlutterForegroundTask.isAppOnForeground;
      if (!onFg) {
        FlutterForegroundTask.launchApp('/');
      }
    } catch (e) {
      debugPrint('IncomingCallWake.launchApp: $e');
      try {
        FlutterForegroundTask.launchApp('/');
      } catch (_) {}
    }
    try {
      await _channel.invokeMethod<void>('bringToFrontForCall');
    } catch (e) {
      debugPrint('IncomingCallWake.bringToFront: $e');
    }
  }

  /// Isolate FCM data-only: persistir + FGS + abrir app + timbre.
  /// El wake nativo (receiver → IncomingCallWakeService) ya corre en paralelo;
  /// aquí refuerzo timbre / launchApp / pending por si el proceso Dart llega primero.
  static Future<void> handleBackgroundWake(Map<String, dynamic> data) async {
    try {
      await persist(data);
      final type = data['type']?.toString() ?? '';
      final mode = data['mode']?.toString() ?? '';
      final video = type.contains('video') ||
          mode == 'video' ||
          mode == 'group_video' ||
          type == 'group_video';
      // ignore: unawaited_futures
      CallRingtone.start(
        kind: video ? CallRingKind.video : CallRingKind.voice,
      );
      try {
        await BackgroundRadio.init();
        await BackgroundRadio.start(
          channelName: 'Llamada entrante',
          forceRestart: false,
        );
        // Pedir al isolate FGS que lance la UI (contexto privilegiado).
        FlutterForegroundTask.sendDataToTask({
          'cmd': 'incoming_call_wake',
          'callId': data['callId']?.toString() ?? '',
        });
      } catch (e) {
        debugPrint('IncomingCallWake.fgs: $e');
      }
      await bringUiToFront();
      for (final ms in <int>[350, 900, 1800, 3200]) {
        // ignore: unawaited_futures
        Future<void>.delayed(Duration(milliseconds: ms), bringUiToFront);
      }
    } catch (e, st) {
      debugPrint('IncomingCallWake.handleBackgroundWake: $e\n$st');
    }
  }
}
