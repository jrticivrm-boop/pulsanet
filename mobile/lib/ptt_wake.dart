import 'dart:async';
import 'dart:convert';
import 'dart:isolate';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'push_service.dart' show notificationActionBackground;
import 'rich_notify.dart';

/// Push `ptt_wake`: alguien habla en un canal y este teléfono no tenía socket.
/// El isolate de FCM avisa al isolate principal (radio) por [IsolateNameServer];
/// si la app no está viva deja un pendiente y una notificación para abrirla.
class PttWake {
  PttWake._();

  static const _portName = 'tacticalptx_ptt_wake_v1';
  static const _pendingKey = 'tacticalptx_ptt_wake_pending_v1';
  static const channelId = 'tacticalptx_ptt_wake_v1';
  static const channelName = 'Radio: alguien habla';
  /// Push más viejo que esto ya no sirve para escuchar en vivo.
  static const _maxAge = Duration(seconds: 25);

  static ReceivePort? _port;
  static void Function(Map<String, dynamic> data)? _onWake;

  /// FCM con la app en primer plano (socket caído): directo al radio.
  static void deliverForeground(Map<String, dynamic> data) {
    if (isFresh(data)) _onWake?.call(data);
  }

  /// Isolate principal: recibe los avisos del isolate de FCM.
  static void attach(void Function(Map<String, dynamic> data) onWake) {
    _onWake = onWake;
    _port?.close();
    final port = ReceivePort();
    _port = port;
    IsolateNameServer.removePortNameMapping(_portName);
    IsolateNameServer.registerPortWithName(port.sendPort, _portName);
    port.listen((msg) {
      if (msg is! Map) return;
      final reply = msg['reply'];
      if (reply is SendPort) reply.send(true);
      final data = msg['data'];
      if (data is Map) onWake(Map<String, dynamic>.from(data));
    });
  }

  static void detach() {
    _onWake = null;
    IsolateNameServer.removePortNameMapping(_portName);
    _port?.close();
    _port = null;
  }

  static bool isFresh(Map<String, dynamic> data) {
    final at = int.tryParse(data['at']?.toString() ?? '') ?? 0;
    if (at <= 0) return true;
    return DateTime.now().millisecondsSinceEpoch - at < _maxAge.inMilliseconds;
  }

  /// Isolate de FCM (app en segundo plano o cerrada).
  static Future<void> handleBackground(Map<String, dynamic> data) async {
    if (!isFresh(data)) return;
    final live = await _deliverToMain(data);
    if (!live) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(
          _pendingKey,
          jsonEncode({...data, 'savedAt': DateTime.now().millisecondsSinceEpoch}),
        );
      } catch (_) {}
    }
    await showNotification(data, live: live);
  }

  /// `true` si el isolate principal (radio) respondió.
  static Future<bool> _deliverToMain(Map<String, dynamic> data) async {
    final send = IsolateNameServer.lookupPortByName(_portName);
    if (send == null) return false;
    final reply = ReceivePort();
    try {
      send.send({'data': data, 'reply': reply.sendPort});
      final ok = await reply.first.timeout(
        const Duration(milliseconds: 600),
        onTimeout: () => false,
      );
      return ok == true;
    } catch (_) {
      return false;
    } finally {
      reply.close();
    }
  }

  /// Pendiente de un push recibido con la app cerrada (≤ 60 s).
  static Future<Map<String, dynamic>?> takePending() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final raw = prefs.getString(_pendingKey);
      if (raw == null || raw.isEmpty) return null;
      await prefs.remove(_pendingKey);
      final m = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      final saved = (m['savedAt'] as num?)?.toInt() ?? 0;
      if (DateTime.now().millisecondsSinceEpoch - saved > 60000) return null;
      return m;
    } catch (_) {
      return null;
    }
  }

  static Future<void> showNotification(
    Map<String, dynamic> data, {
    required bool live,
  }) async {
    try {
      final gid = data['groupId']?.toString() ?? '';
      final parts = RichNotify.buildPttWake(data, live: live);
      final local = FlutterLocalNotificationsPlugin();
      await local.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings(kNotifSmallIcon),
          iOS: DarwinInitializationSettings(),
        ),
        onDidReceiveBackgroundNotificationResponse: notificationActionBackground,
      );
      final android = local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(
        const AndroidNotificationChannel(
          channelId,
          channelName,
          description: 'Aviso cuando el radio se activa por una transmisión',
          importance: Importance.high,
          playSound: false,
          enableVibration: false,
        ),
      );
      final tag = 'ptt:$gid';
      await local.show(
        tag.hashCode & 0x7fffffff,
        parts.title,
        parts.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            channelName,
            importance: Importance.high,
            priority: Priority.high,
            icon: kNotifSmallIcon,
            color: parts.color,
            category: parts.category,
            tag: tag,
            playSound: false,
            enableVibration: !live,
            onlyAlertOnce: true,
            timeoutAfter: parts.timeoutAfter,
            visibility: NotificationVisibility.public,
          ),
        ),
        payload: gid,
      );
    } catch (e) {
      debugPrint('PttWake notification: $e');
    }
  }
}
