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
import 'panic_vibration.dart';
import 'remote_camera_prefs.dart';
import 'remote_camera_wake.dart';
import 'ringer_mode.dart';
import 'sound_prefs.dart';

const kPushChannelId = 'tacticalptx_alerts_v3';
const kPushChannelName = 'Alertas SICOM';
/// v4: sin sonido de canal — CallRingtone es la única fuente de audio.
const kCallChannelId = 'tacticalptx_calls_v4_silent';
const kCallChannelName = 'Llamadas SICOM';
/// v2: Importance.max + sonido zumbido.
const kNudgeChannelId = 'tacticalptx_nudge_v2';
const kNudgeChannelName = 'Zumbidos SICOM';
/// Defaults (cuando prefs no cargan).
const kMessageSoundRaw = 'tactical_msg';
const kMessageSoundIos = 'tactical_msg.wav';
const kNudgeSoundRaw = 'nudge_buzz';
const kNudgeSoundIos = 'nudge_buzz.wav';

/// Canal Android v4 + sufijo de tono (Android no cambia el sonido de un id fijo).
Future<({
  String channelId,
  String channelName,
  bool playSound,
  RawResourceAndroidNotificationSound? androidSound,
  String? iosSound,
})> _resolveChatNotifAudio({required bool nudge}) async {
  final tone =
      nudge ? await SoundPrefs.nudgeTone() : await SoundPrefs.messageTone();
  final baseId = nudge ? 'tacticalptx_nudge_v4' : 'tacticalptx_alerts_v4';
  final baseName = nudge ? 'Zumbidos SICOM' : 'Alertas SICOM';
  final suffix = SoundPrefs.channelSuffix(tone);
  if (tone == AppToneId.silent) {
    return (
      channelId: '${baseId}_silent',
      channelName: '$baseName (silencio)',
      playSound: false,
      androidSound: null,
      iosSound: null,
    );
  }
  final raw = tone.androidRaw ?? (nudge ? kNudgeSoundRaw : kMessageSoundRaw);
  final ios = tone.iosFileName ?? (nudge ? kNudgeSoundIos : kMessageSoundIos);
  return (
    channelId: '${baseId}_$suffix',
    channelName: '$baseName (${tone.labelEs})',
    playSound: true,
    androidSound: RawResourceAndroidNotificationSound(raw),
    iosSound: ios,
  );
}

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
      type == 'private_call_invite' ||
      type == 'private_video_invite' ||
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

  final title = message.data['title']?.toString() ?? 'SICOM';
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
  } else if ((type == 'dm' || type == 'dm_nudge') && peerId != null) {
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
  final nudge = type == 'dm_nudge';
  final audio = isCall
      ? null
      : await _resolveChatNotifAudio(nudge: nudge);
  final channelId = isCall
      ? kCallChannelId
      : (audio?.channelId ?? (nudge ? kNudgeChannelId : kPushChannelId));
  final channelName = isCall
      ? kCallChannelName
      : (audio?.channelName ?? (nudge ? kNudgeChannelName : kPushChannelName));
  await androidPlugin?.createNotificationChannel(
    AndroidNotificationChannel(
      channelId,
      channelName,
      description: nudge
          ? 'Zumbidos DM'
          : (isCall
              ? 'Llamadas y videollamadas (timbre vía app)'
              : 'Mensajes y alertas'),
      importance: Importance.max,
      playSound: isCall ? false : (audio?.playSound ?? true),
      enableVibration: true,
      audioAttributesUsage: isCall
          ? AudioAttributesUsage.notificationRingtone
          : AudioAttributesUsage.notification,
      sound: isCall ? null : audio?.androidSound,
    ),
  );

  final notifId = _stableId(tag ?? 'msg:${message.messageId ?? body}');
  // Llamadas: audio solo vía CallRingtone; notificación sin segundo tono.
  final vibrate = isCall
      ? (await incomingCallNotifPrefs()).enableVibration
      : true;
  final bodyShow = nudge
      ? ((body.isEmpty || body == 'nudge') ? '¡Zumbido!' : body)
      : body;
  await local.show(
    notifId,
    title,
    bodyShow,
    NotificationDetails(
      android: AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: nudge
            ? 'Zumbidos DM'
            : (isCall
                ? 'Llamadas y videollamadas (timbre vía app)'
                : 'Mensajes y alertas'),
        importance: Importance.max,
        priority: Priority.max,
        icon: '@mipmap/ic_launcher',
        tag: tag,
        category: isCall ? AndroidNotificationCategory.call : AndroidNotificationCategory.message,
        fullScreenIntent: isCall,
        visibility: NotificationVisibility.public,
        // Galaxy/Samsung: ongoing + timeout ayuda a que FSI no quede solo heads-up.
        ongoing: isCall,
        autoCancel: !isCall,
        timeoutAfter: isCall ? 55000 : null,
        playSound: isCall ? false : (audio?.playSound ?? true),
        enableVibration: vibrate,
        audioAttributesUsage: isCall
            ? AudioAttributesUsage.notificationRingtone
            : AudioAttributesUsage.notification,
        sound: isCall ? null : audio?.androidSound,
        actions: isCall
            ? <AndroidNotificationAction>[
                const AndroidNotificationAction(
                  'call_accept',
                  'Contestar',
                  showsUserInterface: true,
                  cancelNotification: true,
                ),
                const AndroidNotificationAction(
                  'call_reject',
                  'Rechazar',
                  cancelNotification: true,
                ),
              ]
            : null,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentSound: isCall ? false : (audio?.playSound ?? true),
        sound: isCall ? null : audio?.iosSound,
        interruptionLevel: InterruptionLevel.timeSensitive,
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

  if (type == 'dm_nudge') {
    try {
      // Background: vibra aquí + suena el canal de notificación (`nudge_buzz` /
      // kNudgeChannelId vía _showFromBackgroundMessage). NUNCA AudioPlayer /
      // playNudgeTone / applyReceivedNudgeFeedback en este isolate — pelea el
      // mic con WhatsApp («no se pueden grabar mensajes de voz durante una llamada»).
      await PanicVibration.nudge();
    } catch (e) {
      debugPrint('FCM nudge vibrate: $e');
    }
  }

  try {
    await _showFromBackgroundMessage(message);
  } catch (e) {
    debugPrint('FCM background local: $e');
  }
}

/// Acciones Contestar/Rechazar con app en background/killed.
@pragma('vm:entry-point')
void notificationActionBackground(NotificationResponse resp) {
  final action = resp.actionId;
  final payload = resp.payload ?? '';
  final callId = payload.startsWith('call:') ? payload.substring(5) : payload;
  if (callId.isEmpty) return;
  if (action == 'call_reject') {
    // ignore: unawaited_futures
    IncomingCallWake.rejectFromNotification(callId);
    return;
  }
  if (action == 'call_accept') {
    // ignore: unawaited_futures
    IncomingCallWake.persistAction(callId: callId, action: 'accept');
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
          _handleLocalNotificationResponse(resp);
        },
        onDidReceiveBackgroundNotificationResponse: notificationActionBackground,
      );

      // Cold start: tap de notificación local (data-only FCM → showLocal).
      final launch = await _local.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp == true &&
          launch?.notificationResponse != null) {
        _handleLocalNotificationResponse(
          launch!.notificationResponse!,
          invokeCallbacks: false,
        );
      }

      final androidPlugin = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      // Canales legacy (compat builds anteriores) + v4 según preferencia actual.
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          kPushChannelId,
          kPushChannelName,
          description: 'Mensajes y alertas (prioridad alta)',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          sound: RawResourceAndroidNotificationSound(kMessageSoundRaw),
        ),
      );
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          kCallChannelId,
          kCallChannelName,
          description: 'Llamadas y videollamadas (timbre vía app)',
          importance: Importance.max,
          playSound: false,
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
        ),
      );
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          kNudgeChannelId,
          kNudgeChannelName,
          description: 'Zumbidos DM (nudge_buzz)',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          sound: RawResourceAndroidNotificationSound(kNudgeSoundRaw),
        ),
      );
      try {
        final msgAudio = await _resolveChatNotifAudio(nudge: false);
        await androidPlugin?.createNotificationChannel(
          AndroidNotificationChannel(
            msgAudio.channelId,
            msgAudio.channelName,
            description: 'Mensajes y alertas',
            importance: Importance.max,
            playSound: msgAudio.playSound,
            enableVibration: true,
            sound: msgAudio.androidSound,
          ),
        );
        final nudgeAudio = await _resolveChatNotifAudio(nudge: true);
        await androidPlugin?.createNotificationChannel(
          AndroidNotificationChannel(
            nudgeAudio.channelId,
            nudgeAudio.channelName,
            description: 'Zumbidos DM',
            importance: Importance.max,
            playSound: nudgeAudio.playSound,
            enableVibration: true,
            sound: nudgeAudio.androidSound,
          ),
        );
      } catch (e) {
        debugPrint('pref notification channels: $e');
      }
      await androidPlugin?.requestNotificationsPermission();
      try {
        await androidPlugin?.requestFullScreenIntentPermission();
      } catch (e) {
        debugPrint('Full screen intent permission: $e');
      }
      // Samsung Tab: si el SO deniega FSI, abrir pantalla de ajustes una vez.
      try {
        await IncomingCallWake.ensureFullScreenIntent(openSettings: true);
      } catch (e) {
        debugPrint('ensureFullScreenIntent: $e');
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
    bool isNudge = false,
    CallRingKind ringKind = CallRingKind.voice,
    String? groupId,
    String? peerId,
    String? callId,
  }) async {
    if (!localReady) return;
    // Chat abierto en primer plano: tono tenue, sin notificación de bandeja.
    if (!isCall &&
        isViewingConversation(peerId: peerId, groupId: groupId)) {
      if (isNudge) {
        await applyReceivedNudgeFeedback(peerId: peerId);
      } else {
        await playInChatMessageTone();
      }
      return;
    }
    final tag =
        _conversationTag(groupId: groupId, peerId: peerId, callId: callId);
    final notifId =
        _stableId(tag ?? 't:${DateTime.now().millisecondsSinceEpoch}');
    final callPrefs = isCall ? await incomingCallNotifPrefs() : null;
    final audio =
        isCall ? null : await _resolveChatNotifAudio(nudge: isNudge);
    final channelId = isCall
        ? kCallChannelId
        : (audio?.channelId ?? (isNudge ? kNudgeChannelId : kPushChannelId));
    final channelName = isCall
        ? kCallChannelName
        : (audio?.channelName ??
            (isNudge ? kNudgeChannelName : kPushChannelName));
    if (!isCall && audio != null) {
      final androidPlugin = _local.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        AndroidNotificationChannel(
          audio.channelId,
          audio.channelName,
          description: isNudge ? 'Zumbidos DM' : 'Mensajes y alertas',
          importance: Importance.max,
          playSound: audio.playSound,
          enableVibration: true,
          sound: audio.androidSound,
        ),
      );
    }
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
              : (isNudge ? 'Zumbidos DM' : 'Mensajes y alertas'),
          importance: Importance.max,
          priority: Priority.max,
          icon: '@mipmap/ic_launcher',
          tag: tag,
          category: isCall
              ? AndroidNotificationCategory.call
              : AndroidNotificationCategory.message,
          fullScreenIntent: isCall,
          visibility: NotificationVisibility.public,
          ongoing: isCall,
          autoCancel: !isCall,
          timeoutAfter: isCall ? 55000 : null,
          // Llamadas: CallRingtone es la única fuente de audio (evita doble tono).
          playSound: isCall ? false : (audio?.playSound ?? true),
          enableVibration: callPrefs?.enableVibration ?? true,
          audioAttributesUsage: isCall
              ? AudioAttributesUsage.notificationRingtone
              : AudioAttributesUsage.notification,
          sound: isCall ? null : audio?.androidSound,
          actions: isCall
              ? <AndroidNotificationAction>[
                  const AndroidNotificationAction(
                    'call_accept',
                    'Contestar',
                    showsUserInterface: true,
                    cancelNotification: true,
                  ),
                  const AndroidNotificationAction(
                    'call_reject',
                    'Rechazar',
                    cancelNotification: true,
                  ),
                ]
              : null,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: isCall ? false : (audio?.playSound ?? true),
          sound: isCall ? null : audio?.iosSound,
          interruptionLevel: InterruptionLevel.timeSensitive,
        ),
      ),
      payload: payload,
    );
    // Primer plano: arrancar timbre nativo ya (la UI de Contestar también lo inicia).
    if (isCall && !appInBackground) {
      // ignore: unawaited_futures
      CallRingtone.start(kind: ringKind);
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
      if (type == 'dm_nudge') {
        // ignore: unawaited_futures
        applyReceivedNudgeFeedback(peerId: peerId);
        onNotificationData?.call(Map<String, dynamic>.from(msg.data));
      }
      return;
    }
    // Llamada en primer plano: no banner; la UI Contestar ya se abrió.
    if (isCall && !appInBackground) {
      return;
    }

    final n = msg.notification;
    final title = n?.title ?? msg.data['title']?.toString() ?? 'SICOM';
    var body = n?.body ?? msg.data['body']?.toString() ?? '';
    if (type == 'dm_nudge' && (body.isEmpty || body == 'nudge')) {
      body = '¡Zumbido!';
    }
    String? payload;
    if (isCall) {
      if (type == 'group_video' && groupId != null && groupId.isNotEmpty) {
        payload = 'gvideo:$groupId';
      } else {
        payload = 'call:${callId ?? ''}';
      }
    } else if ((type == 'dm' || type == 'dm_nudge') && peerId != null) {
      payload = 'peer:$peerId';
    } else {
      payload = groupId;
    }

    await showLocal(
      title: title,
      body: body,
      payload: payload,
      isCall: isCall,
      isNudge: type == 'dm_nudge',
      ringKind: (type != null && type.contains('video')) || type == 'group_video'
          ? CallRingKind.video
          : CallRingKind.voice,
      groupId: groupId,
      peerId: peerId,
      callId: callId,
    );
  }

  /// Interpreta tap / Contestar / Rechazar de notificación local.
  void _handleLocalNotificationResponse(
    NotificationResponse resp, {
    bool invokeCallbacks = true,
  }) {
    final action = resp.actionId;
    final payload = resp.payload ?? '';
    if (action == 'call_accept' || action == 'call_reject') {
      final callId =
          payload.startsWith('call:') ? payload.substring(5) : payload;
      if (callId.isEmpty) return;
      if (action == 'call_reject') {
        // ignore: unawaited_futures
        IncomingCallWake.rejectFromNotification(callId);
        clearConversationNotifications(callId: callId);
        return;
      }
      // ignore: unawaited_futures
      IncomingCallWake.persistAction(callId: callId, action: 'accept');
      final data = <String, dynamic>{
        'type': 'private_call',
        'callId': callId,
        'autoAccept': '1',
      };
      pendingIncomingCall = data;
      if (invokeCallbacks) {
        onNotificationData?.call(data);
      }
      clearConversationNotifications(callId: callId);
      // ignore: unawaited_futures
      IncomingCallWake.bringUiToFront();
      return;
    }
    _applyLocalPayload(payload, invokeCallbacks: invokeCallbacks);
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
    if (type == 'dm' || type == 'dm_nudge') {
      pendingPeerId = data['peerId']?.toString();
      if (invokeCallbacks) {
        onNotificationData?.call({
          ...data,
          'type': 'dm',
        });
      }
      clearConversationNotifications(peerId: pendingPeerId);
      return;
    }
    if (type == 'private_call' ||
        type == 'private_radio' ||
        type == 'private_video' ||
        type == 'private_call_invite' ||
        type == 'private_video_invite' ||
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
