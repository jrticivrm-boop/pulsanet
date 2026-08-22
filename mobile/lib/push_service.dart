import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

const kPushChannelId = 'tacticalptx_alerts';
const kPushChannelName = 'Alertas TacticalPtx';
const kCallChannelId = 'tacticalptx_calls';
const kCallChannelName = 'Llamadas TacticalPtx';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('FCM background: ${message.messageId} ${message.notification?.title}');
}

/// Firebase Messaging + canal Android + registro en API.
/// Las notificaciones locales funcionan aunque FCM no esté configurado.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  bool ready = false;
  bool localReady = false;
  String? token;
  ApiClient? _api;
  void Function(String? groupId)? onNotificationOpen;
  void Function(Map<String, dynamic> data)? onNotificationData;

  /// groupId pendiente si abrieron la app desde una push (cold start).
  String? pendingGroupId;
  String? pendingPeerId;

  Future<void> init() async {
    if (kIsWeb) return;
    await _initLocalNotifications();

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      if (Platform.isIOS) {
        await messaging.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }

      token = await messaging.getToken();
      ready = token != null && token!.isNotEmpty;

      messaging.onTokenRefresh.listen((t) async {
        token = t;
        if (_api != null) {
          await registerWithApi(_api!);
        }
      });

      FirebaseMessaging.onMessage.listen(_showForeground);

      FirebaseMessaging.onMessageOpenedApp.listen((msg) {
        _handleOpen(msg.data);
      });

      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        pendingGroupId = initial.data['groupId']?.toString();
        pendingPeerId = initial.data['peerId']?.toString();
        _handleOpen(initial.data);
      }
    } catch (e) {
      debugPrint('FCM init omitido (¿falta google-services.json?): $e');
      ready = false;
    }
  }

  Future<void> _initLocalNotifications() async {
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      await _local.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: (resp) {
          final payload = resp.payload ?? '';
          if (payload.startsWith('peer:')) {
            pendingPeerId = payload.substring(5);
            onNotificationData?.call({'type': 'dm', 'peerId': pendingPeerId});
            return;
          }
          if (payload.startsWith('call:')) {
            onNotificationData?.call({'type': 'private_call', 'callId': payload.substring(5)});
            return;
          }
          if (payload.isNotEmpty) {
            pendingGroupId = payload;
            onNotificationOpen?.call(payload);
          }
        },
      );

      final androidPlugin = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        kPushChannelId,
        kPushChannelName,
        description: 'Mensajes y alertas (sin PTT)',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ),
    );
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        kCallChannelId,
        kCallChannelName,
        description: 'Llamadas privadas entrantes',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      ),
    );
      await androidPlugin?.requestNotificationsPermission();
      localReady = true;
    } catch (e) {
      debugPrint('Local notifications init: $e');
      localReady = false;
    }
  }

  Future<void> showLocal({
    required String title,
    required String body,
    String? payload,
    bool isCall = false,
  }) async {
    if (!localReady) return;
    final channelId = isCall ? kCallChannelId : kPushChannelId;
    final channelName = isCall ? kCallChannelName : kPushChannelName;
    await _local.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: isCall
              ? 'Llamadas privadas entrantes'
              : 'Mensajes y alertas (sin PTT)',
          importance: isCall ? Importance.max : Importance.high,
          priority: isCall ? Priority.max : Priority.high,
          icon: '@mipmap/ic_launcher',
          category: isCall ? AndroidNotificationCategory.call : null,
          fullScreenIntent: isCall,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          interruptionLevel:
              isCall ? InterruptionLevel.timeSensitive : InterruptionLevel.active,
        ),
      ),
      payload: payload,
    );
  }

  Future<void> _showForeground(RemoteMessage msg) async {
    final type = msg.data['type']?.toString();
    // Sin notificación por PTT (cada transmisión); sí mensajes, llamadas y alertas.
    if (type == 'ptt') return;

    final n = msg.notification;
    final title = n?.title ?? msg.data['title']?.toString() ?? 'TacticalPtx';
    final body = n?.body ?? msg.data['body']?.toString() ?? '';
    final isCall = type == 'private_call';
    String? payload;
    if (isCall) {
      payload = 'call:${msg.data['callId'] ?? ''}';
    } else if (type == 'dm' && msg.data['peerId'] != null) {
      payload = 'peer:${msg.data['peerId']}';
    } else {
      payload = msg.data['groupId']?.toString();
    }

    await showLocal(
      title: title,
      body: body,
      payload: payload,
      isCall: isCall,
    );
  }

  void _handleOpen(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    if (type == 'dm') {
      pendingPeerId = data['peerId']?.toString();
      onNotificationData?.call(data);
      return;
    }
    if (type == 'private_call') {
      onNotificationData?.call(data);
      return;
    }
    final groupId = data['groupId']?.toString();
    if (groupId != null && groupId.isNotEmpty) {
      pendingGroupId = groupId;
      onNotificationOpen?.call(groupId);
    }
  }

  Future<void> registerWithApi(ApiClient api) async {
    _api = api;
    if (!api.isLoggedIn) return;
    try {
      if (token == null || token!.isEmpty) {
        token = await FirebaseMessaging.instance.getToken();
      }
      if (token == null || token!.isEmpty) return;
      await api.registerDevice(
        platform: Platform.isIOS ? 'ios' : 'android',
        fcmToken: token!,
        deviceName: Platform.localHostname,
      );
    } catch (e) {
      debugPrint('FCM register device: $e');
    }
  }
}
