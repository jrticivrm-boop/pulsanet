import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';
import 'app_focus.dart';
import 'call_ringtone.dart';
import 'incoming_call_wake.dart';
import 'message_tone.dart';
import 'remote_camera_prefs.dart';
import 'remote_camera_wake.dart';
import 'ringer_mode.dart';

const kPushChannelId = 'tacticalptx_alerts_radio';
const kPushChannelName = 'Alertas TacticalPtx';
/// v2: USAGE_NOTIFICATION_RINGTONE (Android no actualiza canales existentes).
const kCallChannelId = 'tacticalptx_calls_v2';
const kCallChannelName = 'Llamadas TacticalPtx';
/// Chirp radio táctico (doble pip) en `res/raw/tactical_msg.wav`.
const kMessageSoundRaw = 'tactical_msg';
const kMessageSoundIos = 'tactical_msg.wav';

const _notifyNative = MethodChannel('com.tacticalptx.app/notifications');

int _stableId(String key) => key.hashCode & 0x7fffffff;

String? _conversationTag({String? groupId, String? peerId, String? callId}) {
  if (callId != null && callId.isNotEmpty) return 'call:$callId';
  if (peerId != null && peerId.isNotEmpty) return 'dm:$peerId';
  if (groupId != null && groupId.isNotEmpty) return 'g:$groupId';
  return null;
}

bool _isCallPushType(String? type) {
  // private_remote_camera se maneja aparte (silencioso / headless).
  return type == 'private_call' ||
      type == 'private_radio' ||
      type == 'private_video' ||
      type == 'private_video_request' ||
      type == 'group_video';
}

bool _isRemoteCameraPush(Map<String, dynamic> data) {
  final type = data['type']?.toString();
  final intent = data['intent']?.toString();
  return type == 'private_remote_camera' || intent == 'remote_camera';
}

/// Muestra notificación local desde isolate de FCM (mensajes data-only).
Future<void> _showFromBackgroundMessage(RemoteMessage message) async {
  final type = message.data['type']?.toString();
  if (type == 'ptt') return;
  // Cámara remota silenciosa: no banner / vibración (el isolate principal activa el feed).
  if (type == 'private_remote_camera' ||
      message.data['intent']?.toString() == 'remote_camera' ||
      message.data['silent']?.toString() == '1') {
    return;
  }

  // Si ya viene payload `notification`, el sistema la muestra al estar killed.
  if (message.notification != null) return;

  final title = message.data['title']?.toString() ?? 'TacticalPtx';
  final body = message.data['body']?.toString() ?? 'Nuevo aviso';
  final isCall = _isCallPushType(type);
  final groupId = message.data['groupId']?.toString();
  final peerId = message.data['peerId']?.toString();
  final callId = message.data['callId']?.toString();
  final tag = _conversationTag(groupId: groupId, peerId: peerId, callId: callId);
  String? payload;
  if (isCall) {
    if (type == 'group_video' && groupId != null && groupId.isNotEmpty) {
      payload = 'gvideo:$groupId';
    } else {
      payload = 'call:${callId ?? ''}';
    }
  } else if (type == 'dm' && peerId != null) {
    payload = 'peer:$peerId';
  } else {
    payload = groupId;
  }

  final local = FlutterLocalNotificationsPlugin();
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  await local.initialize(
    const InitializationSettings(
      android: androidInit,
      iOS: DarwinInitializationSettings(),
    ),
  );
  final androidPlugin = local.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  await androidPlugin?.createNotificationChannel(
    AndroidNotificationChannel(
      isCall ? kCallChannelId : kPushChannelId,
      isCall ? kCallChannelName : kPushChannelName,
      importance: isCall ? Importance.max : Importance.high,
      playSound: true,
      enableVibration: true,
      audioAttributesUsage: isCall
          ? AudioAttributesUsage.notificationRingtone
          : AudioAttributesUsage.notification,
      sound: isCall
          ? null
          : const RawResourceAndroidNotificationSound(kMessageSoundRaw),
    ),
  );

  final notifId = _stableId(tag ?? 'msg:${message.messageId ?? body}');
  final callPrefs = isCall ? await incomingCallNotifPrefs() : null;
  await local.show(
    notifId,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        isCall ? kCallChannelId : kPushChannelId,
        isCall ? kCallChannelName : kPushChannelName,
        importance: isCall ? Importance.max : Importance.high,
        priority: isCall ? Priority.max : Priority.high,
        icon: '@mipmap/ic_launcher',
        tag: tag,
        category: isCall ? AndroidNotificationCategory.call : null,
        fullScreenIntent: isCall,
        playSound: callPrefs?.playSound ?? !isCall,
        enableVibration: callPrefs?.enableVibration ?? true,
        audioAttributesUsage: isCall
            ? AudioAttributesUsage.notificationRingtone
            : AudioAttributesUsage.notification,
        sound: isCall
            ? null
            : const RawResourceAndroidNotificationSound(kMessageSoundRaw),
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: callPrefs?.playSound ?? true,
        sound: isCall ? null : kMessageSoundIos,
      ),
    ),
    payload: payload,
  );
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Binding necesario para SharedPreferences / FGS desde isolate FCM.
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  debugPrint(
      'FCM background: ${message.messageId} ${message.data['type']}');

  final data = Map<String, dynamic>.from(message.data);
  final type = data['type']?.toString();
  final intent = data['intent']?.toString();
  if (type == 'private_remote_camera' || intent == 'remote_camera') {
    try {
      await RemoteCameraWake.handleBackgroundWake(data);
    } catch (e) {
      debugPrint('FCM remote camera wake: $e');
    }
    return;
  }

  if (_isCallPushType(type)) {
    try {
      await IncomingCallWake.handleBackgroundWake(data);
    } catch (e) {
      debugPrint('FCM incoming call wake: $e');
    }
  }

  try {
    await _showFromBackgroundMessage(message);
  } catch (e) {
    debugPrint('FCM background local: $e');
  }
}

/// Firebase Messaging + canal Android + registro en API.
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

  String? pendingGroupId;
  String? pendingPeerId;
  String? pendingMessageId;
  Map<String, dynamic>? pendingPanicData;
  /// Llamada/radio entrante pendiente (tap FCM / cold start).
  Map<String, dynamic>? pendingIncomingCall;
  /// Transmisión grupal entrante pendiente.
  Map<String, dynamic>? pendingIncomingGroupVideo;

  Future<void> init() async {
    if (kIsWeb) return;
    await _initLocalNotifications();

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      if (Platform.isIOS) {
        // Evita sonido/alerta del sistema en primer plano; lo manejamos en app.
        await messaging.setForegroundNotificationPresentationOptions(
          alert: false,
          badge: false,
          sound: false,
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

      FirebaseMessaging.onMessage.listen((msg) {
        final data = Map<String, dynamic>.from(msg.data);
        final type = data['type']?.toString();
        if (_isRemoteCameraPush(data)) {
          // ignore: unawaited_futures
          _handleForegroundRemoteCamera(data);
          // ignore: unawaited_futures
          _showForeground(msg);
          return;
        }
        if (_isCallPushType(type)) {
          // ignore: unawaited_futures
          IncomingCallWake.persist(data);
          // ignore: unawaited_futures
          IncomingCallWake.bringUiToFront();
          onNotificationData?.call(data);
        }
        // ignore: unawaited_futures
        _showForeground(msg);
        if (type == 'panic') {
          onNotificationData?.call(data);
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((msg) {
        _handleOpen(msg.data);
      });

      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        _handleOpen(initial.data, invokeCallbacks: false);
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
          _applyLocalPayload(resp.payload);
        },
      );

      // Cold start: tap de notificación local (data-only FCM → showLocal).
      final launch = await _local.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp == true) {
        _applyLocalPayload(
          launch!.notificationResponse?.payload,
          invokeCallbacks: false,
        );
      }

      final androidPlugin = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          kPushChannelId,
          kPushChannelName,
          description: 'Mensajes y alertas (tono SMS Nokia / Morse)',
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
          sound: RawResourceAndroidNotificationSound(kMessageSoundRaw),
        ),
      );
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          kCallChannelId,
          kCallChannelName,
          description: 'Llamadas y videollamadas entrantes (timbre)',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
        ),
      );
      await androidPlugin?.requestNotificationsPermission();
      try {
        await androidPlugin?.requestFullScreenIntentPermission();
      } catch (e) {
        debugPrint('Full screen intent permission: $e');
      }
      localReady = true;
    } catch (e) {
      debugPrint('Local notifications init: $e');
      localReady = false;
    }
  }

  /// Quita notificaciones de bandeja al leer (FCM + locales), estilo WhatsApp.
  ///
  /// [alsoClearAll] también limpia avisos viejos sin tag (p. ej. builds anteriores).
  Future<void> clearConversationNotifications({
    String? groupId,
    String? peerId,
    String? callId,
    bool alsoClearAll = false,
  }) async {
    if (callId != null && callId.isNotEmpty) {
      // ignore: unawaited_futures
      CallRingtone.stop();
    }
    final tag =
        _conversationTag(groupId: groupId, peerId: peerId, callId: callId);
    final id = _stableId(tag ?? 'misc');
    final futures = <Future<void>>[];
    try {
      if (localReady) {
        futures.add(_local.cancel(id));
        if (tag != null) {
          futures.add(_local.cancel(id, tag: tag));
        }
      }
    } catch (e) {
      debugPrint('clear local notif: $e');
    }
    if (Platform.isAndroid) {
      try {
        if (tag != null) {
          futures.add(_notifyNative
              .invokeMethod('cancelTag', {'tag': tag, 'id': 0})
              .then((_) {}));
          futures.add(_notifyNative
              .invokeMethod('cancelTag', {'tag': tag, 'id': id})
              .then((_) {}));
        }
      } catch (e) {
        debugPrint('clear native notif: $e');
      }
    }
    if (futures.isNotEmpty) {
      await Future.wait(futures).catchError((_) => <void>[]);
    }
    if (alsoClearAll) {
      // No bloquea al llamador si se invoca sin await; aquí sí se espera.
      await clearAllNotifications();
    }
  }

  /// Limpia todas las notificaciones de la app.
  Future<void> clearAllNotifications() async {
    try {
      if (localReady) await _local.cancelAll();
    } catch (_) {}
    if (Platform.isAndroid) {
      try {
        await _notifyNative.invokeMethod('cancelAll');
      } catch (e) {
        debugPrint('clearAll native: $e');
      }
    }
  }

  Future<void> showLocal({
    required String title,
    required String body,
    String? payload,
    bool isCall = false,
    String? groupId,
    String? peerId,
    String? callId,
  }) async {
    if (!localReady) return;
    // Chat abierto en primer plano: tono tenue, sin notificación de bandeja.
    if (!isCall &&
        isViewingConversation(peerId: peerId, groupId: groupId)) {
      await playInChatMessageTone();
      return;
    }
    final channelId = isCall ? kCallChannelId : kPushChannelId;
    final channelName = isCall ? kCallChannelName : kPushChannelName;
    final tag =
        _conversationTag(groupId: groupId, peerId: peerId, callId: callId);
    final notifId =
        _stableId(tag ?? 't:${DateTime.now().millisecondsSinceEpoch}');
    final callPrefs = isCall ? await incomingCallNotifPrefs() : null;
    await _local.show(
      notifId,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          channelDescription: isCall
              ? 'Llamadas y videollamadas entrantes (timbre)'
              : 'Mensajes y alertas (tono SMS Nokia / Morse)',
          importance: isCall ? Importance.max : Importance.high,
          priority: isCall ? Priority.max : Priority.high,
          icon: '@mipmap/ic_launcher',
          tag: tag,
          category: isCall ? AndroidNotificationCategory.call : null,
          fullScreenIntent: isCall,
          playSound: callPrefs?.playSound ?? !isCall,
          enableVibration: callPrefs?.enableVibration ?? true,
          audioAttributesUsage: isCall
              ? AudioAttributesUsage.notificationRingtone
              : AudioAttributesUsage.notification,
          sound: isCall
              ? null
              : const RawResourceAndroidNotificationSound(kMessageSoundRaw),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: callPrefs?.playSound ?? true,
          sound: isCall ? null : kMessageSoundIos,
          interruptionLevel: isCall
              ? InterruptionLevel.timeSensitive
              : InterruptionLevel.active,
        ),
      ),
      payload: payload,
    );
    // Primer plano: arrancar timbre nativo ya (la UI de Contestar también lo inicia).
    if (isCall && !appInBackground) {
      // ignore: unawaited_futures
      CallRingtone.start();
    }
  }

  /// FCM en primer plano: remote cam no usa wake de llamada si auto-accept.
  Future<void> _handleForegroundRemoteCamera(Map<String, dynamic> data) async {
    await RemoteCameraWake.persist(data);
    if (await RemoteCameraPrefs.canAutoAccept()) {
      // Socket / Shell hacen startSilent; no relaunch ni Contestar.
      onNotificationData?.call(data);
      return;
    }
    // Sin consentimiento: Contestar / pedir permiso.
    await IncomingCallWake.persist(data);
    await IncomingCallWake.bringUiToFront();
    onNotificationData?.call(data);
  }

  Future<void> _showForeground(RemoteMessage msg) async {
    final type = msg.data['type']?.toString();
    if (type == 'ptt') return;
    // Ver cámara remota: nunca aviso/vibración (solo socket + headless).
    if (type == 'private_remote_camera' ||
        msg.data['intent']?.toString() == 'remote_camera') {
      return;
    }

    final isCall = _isCallPushType(type);
    final groupId = msg.data['groupId']?.toString();
    final peerId = msg.data['peerId']?.toString();
    final callId = msg.data['callId']?.toString();

    // En primer plano el socket / onNotificationData ya abre Contestar.
    if (!isCall && !appInBackground) {
      if (type == 'panic') {
        onNotificationData?.call(Map<String, dynamic>.from(msg.data));
      }
      return;
    }
    // Llamada en primer plano: no banner; la UI Contestar ya se abrió.
    if (isCall && !appInBackground) {
      return;
    }

    final n = msg.notification;
    final title = n?.title ?? msg.data['title']?.toString() ?? 'TacticalPtx';
    final body = n?.body ?? msg.data['body']?.toString() ?? '';
    String? payload;
    if (isCall) {
      if (type == 'group_video' && groupId != null && groupId.isNotEmpty) {
        payload = 'gvideo:$groupId';
      } else {
        payload = 'call:${callId ?? ''}';
      }
    } else if (type == 'dm' && peerId != null) {
      payload = 'peer:$peerId';
    } else {
      payload = groupId;
    }

    await showLocal(
      title: title,
      body: body,
      payload: payload,
      isCall: isCall,
      groupId: groupId,
      peerId: peerId,
      callId: callId,
    );
  }

  /// Interpreta payload de notificación local (`peer:uuid` | `call:id` | groupId).
  void _applyLocalPayload(String? payload, {bool invokeCallbacks = true}) {
    final p = payload ?? '';
    if (p.startsWith('peer:')) {
      pendingPeerId = p.substring(5);
      if (invokeCallbacks) {
        onNotificationData?.call({'type': 'dm', 'peerId': pendingPeerId});
      }
      clearConversationNotifications(peerId: pendingPeerId);
      return;
    }
    if (p.startsWith('call:')) {
      final callId = p.substring(5);
      final data = <String, dynamic>{
        'type': 'private_call',
        'callId': callId,
      };
      pendingIncomingCall = data;
      if (invokeCallbacks) {
        onNotificationData?.call(data);
      }
      clearConversationNotifications(callId: callId);
      return;
    }
    if (p.startsWith('gvideo:')) {
      final groupId = p.substring(7);
      final data = <String, dynamic>{
        'type': 'group_video',
        'groupId': groupId,
      };
      pendingIncomingGroupVideo = data;
      if (invokeCallbacks) {
        onNotificationData?.call(data);
      }
      clearConversationNotifications(groupId: groupId);
      return;
    }
    if (p.isNotEmpty) {
      pendingGroupId = p;
      if (invokeCallbacks) {
        onNotificationOpen?.call(p);
      }
      clearConversationNotifications(groupId: p);
    }
  }

  void _handleOpen(Map<String, dynamic> data, {bool invokeCallbacks = true}) {
    final type = data['type']?.toString();
    final messageId = data['messageId']?.toString();
    if (messageId != null && messageId.isNotEmpty) {
      pendingMessageId = messageId;
    }
    if (type == 'dm') {
      pendingPeerId = data['peerId']?.toString();
      if (invokeCallbacks) {
        onNotificationData?.call(data);
      }
      clearConversationNotifications(peerId: pendingPeerId);
      return;
    }
    if (type == 'private_call' ||
        type == 'private_radio' ||
        type == 'private_video' ||
        type == 'private_remote_camera' ||
        type == 'private_video_request') {
      pendingIncomingCall = Map<String, dynamic>.from(data);
      if (invokeCallbacks) {
        onNotificationData?.call(Map<String, dynamic>.from(data));
      }
      clearConversationNotifications(callId: data['callId']?.toString());
      return;
    }
    if (type == 'missed_call') {
      pendingPeerId = data['callerId']?.toString() ?? data['peerId']?.toString();
      if (invokeCallbacks) {
        onNotificationData?.call(Map<String, dynamic>.from(data));
      }
      return;
    }
    if (type == 'group_video') {
      pendingIncomingGroupVideo = Map<String, dynamic>.from(data);
      if (invokeCallbacks) {
        onNotificationData?.call(Map<String, dynamic>.from(data));
      }
      clearConversationNotifications(groupId: data['groupId']?.toString());
      return;
    }
    if (type == 'panic') {
      pendingGroupId = data['groupId']?.toString();
      pendingPanicData = Map<String, dynamic>.from(data);
      if (invokeCallbacks) {
        onNotificationData?.call(data);
      }
      clearConversationNotifications(groupId: pendingGroupId);
      return;
    }
    final groupId = data['groupId']?.toString();
    if (groupId != null && groupId.isNotEmpty) {
      pendingGroupId = groupId;
      if (invokeCallbacks) {
        onNotificationOpen?.call(groupId);
      }
      clearConversationNotifications(groupId: groupId);
    }
  }

  void clearPendingNavigation() {
    pendingGroupId = null;
    pendingPeerId = null;
    pendingMessageId = null;
    pendingPanicData = null;
    pendingIncomingCall = null;
    pendingIncomingGroupVideo = null;
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
