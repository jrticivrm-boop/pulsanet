import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'background_radio.dart';
import 'remote_camera_prefs.dart';

/// Persistencia + wake para «Ver cámara» con app cerrada / pantalla bloqueada.
class RemoteCameraWake {
  RemoteCameraWake._();

  static const _pendingKey = 'tacticalptx_pending_remote_camera_v1';
  static const _channel = MethodChannel('com.tacticalptx.app/notifications');

  static bool _isRemoteCameraPayload(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    final intent = data['intent']?.toString();
    return type == 'private_remote_camera' || intent == 'remote_camera';
  }

  static Future<void> persist(Map<String, dynamic> data) async {
    if (!_isRemoteCameraPayload(data)) return;
    final callId = data['callId']?.toString() ?? '';
    if (callId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _pendingKey,
      jsonEncode({
        'callId': callId,
        'callerId': data['callerId']?.toString(),
        'callerName': data['callerName']?.toString() ?? 'Despacho',
        'mode': data['mode']?.toString() ?? 'video',
        'intent': 'remote_camera',
        'type': 'private_remote_camera',
        'savedAt': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  /// True si hay solicitud pendiente válida (sin consumirla).
  static Future<bool> hasPending() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null || raw.isEmpty) return false;
    try {
      final map = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      final callId = map['callId']?.toString() ?? '';
      if (callId.isEmpty) return false;
      final savedAt = int.tryParse(map['savedAt']?.toString() ?? '') ?? 0;
      if (savedAt > 0 &&
          DateTime.now().millisecondsSinceEpoch - savedAt > 120000) {
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Lee y borra la solicitud pendiente (ignora si > 2 min).
  static Future<Map<String, dynamic>?> takePending() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null || raw.isEmpty) return null;
    await prefs.remove(_pendingKey);
    try {
      final map = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      final savedAt = int.tryParse(map['savedAt']?.toString() ?? '') ?? 0;
      if (savedAt > 0 &&
          DateTime.now().millisecondsSinceEpoch - savedAt > 120000) {
        return null;
      }
      return map;
    } catch (_) {
      return null;
    }
  }

  /// Trae UI sin recrear Activity si ya está en primer plano.
  static Future<void> _bringUiSoft() async {
    if (kIsWeb) return;
    try {
      await _channel.invokeMethod<void>('bringToFrontForCall');
    } catch (e) {
      debugPrint('RemoteCameraWake.bringToFront: $e');
    }
    try {
      final onFg = await FlutterForegroundTask.isAppOnForeground;
      if (!onFg) {
        FlutterForegroundTask.launchApp('/');
      }
    } catch (e) {
      debugPrint('RemoteCameraWake.launchApp: $e');
    }
  }

  /// Desde isolate FCM: persistir y despertar UI.
  /// No arranca FGS tipo `camera` aquí (Android 14+ desde background isolate).
  /// El isolate principal / RadioShell hace setRemoteCameraActive + startSilent.
  static Future<void> handleBackgroundWake(Map<String, dynamic> data) async {
    if (!_isRemoteCameraPayload(data)) return;
    try {
      await persist(data);
      await BackgroundRadio.init();
      await BackgroundRadio.requestPermissions();
      final canAuto = await RemoteCameraPrefs.canAutoAccept();
      if (canAuto) {
        // Auto-accept: solo despertar motor principal; Shell drenará pending.
        await _bringUiSoft();
        return;
      }
      // Sin consentimiento: traer UI para Contestar / permiso.
      await _bringUiSoft();
    } catch (e, st) {
      debugPrint('RemoteCameraWake.handleBackgroundWake: $e\n$st');
    }
  }
}
