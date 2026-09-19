import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

import 'api_client.dart';

/// Mantiene Radio / socket / audio / GPS (/ cámara remota / llamada) vivos.
class BackgroundRadio {
  BackgroundRadio._();

  static bool _inited = false;
  static String _channelLabel = 'Canal activo';
  static bool _remoteCameraActive = false;
  static bool _remoteMicActive = false;
  static bool _privateCallActive = false;
  static bool _privateCallVideo = false;
  static String _privateCallPeer = '';

  static bool get remoteCameraActive => _remoteCameraActive;

  static Future<void> init({bool force = false}) async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    if (_inited && !force) return;

    FlutterForegroundTask.initCommunicationPort();

    final callMode = _privateCallActive;
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: callMode
            ? 'tacticalptx_ongoing_call_v1'
            : 'tacticalptx_radio',
        channelName: callMode ? 'Llamada en curso' : 'Radio SICOM',
        channelDescription: callMode
            ? 'Mantiene la llamada/videollamada activa en segundo plano'
            : 'Mantiene canal, ubicación y cámara remota con pantalla bloqueada',
        channelImportance: callMode
            ? NotificationChannelImportance.HIGH
            : NotificationChannelImportance.LOW,
        priority: callMode
            ? NotificationPriority.HIGH
            : NotificationPriority.LOW,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(12000),
        autoRunOnBoot: false,
        autoRunOnMyPackageReplaced: false,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
    _inited = true;
  }

  static Future<void> requestPermissions() async {
    if (kIsWeb || !Platform.isAndroid) return;
    final n = await FlutterForegroundTask.checkNotificationPermission();
    if (n != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }
    if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
      await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }
  }

  /// Llamada/videollamada 1:1: FGS alta prioridad + mic para seguir hablando
  /// con la app minimizada o pantalla bloqueada (estilo WhatsApp).
  static Future<void> setPrivateCallActive(
    bool active, {
    String? peerName,
    bool video = false,
  }) async {
    final was = _privateCallActive;
    _privateCallActive = active;
    _privateCallVideo = active && video;
    _privateCallPeer = active ? (peerName ?? _privateCallPeer) : '';
    if (was == active) {
      await start(forceRestart: false);
      return;
    }
    await init(force: true);
    final running = await FlutterForegroundTask.isRunningService;
    if (running) {
      await FlutterForegroundTask.stopService();
    }
    await start(forceRestart: true);
  }

  /** Activa tipo FGS `camera` para que Android no suspenda el feed al bloquear. */
  static Future<void> setRemoteCameraActive(bool active) async {
    if (_remoteCameraActive == active) {
      if (active) {
        await start(forceRestart: false);
      }
      return;
    }
    final enabling = active && !_remoteCameraActive;
    _remoteCameraActive = active;
    if (!active) _remoteMicActive = false;
    final running = await FlutterForegroundTask.isRunningService;
    await start(forceRestart: running && enabling);
  }

  /// Incluye tipo FGS `microphone` mientras el despacho activa el mic remoto.
  static Future<void> setRemoteMicActive(bool active) async {
    if (_remoteMicActive == active) return;
    final enabling = active && !_remoteMicActive;
    _remoteMicActive = active;
    if (active && !_remoteCameraActive) {
      _remoteCameraActive = true;
    }
    final running = await FlutterForegroundTask.isRunningService;
    await start(forceRestart: running && enabling);
  }

  /// Arranca (o refresca) el servicio en primer plano.
  static Future<void> start({
    String? channelName,
    bool forceRestart = false,
  }) async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    await init();
    if (channelName != null && channelName.isNotEmpty) {
      _channelLabel = channelName;
    }

    final running = await FlutterForegroundTask.isRunningService;
    String title;
    String text;
    if (_privateCallActive) {
      title = 'Llamada en curso';
      text = _privateCallPeer.isNotEmpty
          ? 'Con $_privateCallPeer · toca para volver'
          : 'Toca para volver a la llamada';
    } else if (_remoteCameraActive) {
      title = 'Cámara de despacho activa';
      text = _remoteMicActive
          ? 'Transmitiendo cámara y micrófono · $_channelLabel'
          : 'Transmitiendo cámara con pantalla bloqueada · $_channelLabel';
    } else {
      title = 'SICOM activo';
      text = '$_channelLabel · radio y ubicación en segundo plano';
    }

    final types = <ForegroundServiceTypes>[
      ForegroundServiceTypes.mediaPlayback,
      ForegroundServiceTypes.location,
      if (_remoteCameraActive || _privateCallVideo)
        ForegroundServiceTypes.camera,
      if (_remoteMicActive || _privateCallActive)
        ForegroundServiceTypes.microphone,
    ];

    if (running && !forceRestart) {
      await FlutterForegroundTask.updateService(
        notificationTitle: title,
        notificationText: text,
      );
      return;
    }

    if (running && forceRestart) {
      await FlutterForegroundTask.stopService();
    }

    await FlutterForegroundTask.startService(
      serviceTypes: types,
      notificationTitle: title,
      notificationText: text,
      callback: backgroundRadioCallback,
    );
  }

  static Future<void> stop() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    _remoteCameraActive = false;
    _remoteMicActive = false;
    _privateCallActive = false;
    _privateCallVideo = false;
    _privateCallPeer = '';
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
    }
  }
}

@pragma('vm:entry-point')
void backgroundRadioCallback() {
  FlutterForegroundTask.setTaskHandler(_RadioTaskHandler());
}

class _RadioTaskHandler extends TaskHandler {
  DateTime? _lastPresenceAt;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    // Isolate FGS: binding para SecureStore / HTTP de presencia.
    WidgetsFlutterBinding.ensureInitialized();
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    FlutterForegroundTask.sendDataToMain({'ts': timestamp.millisecondsSinceEpoch});
    // Mantener presencia viva con app “cerrada” (estilo WhatsApp) → mapa Ausente, no gris.
    // ignore: discarded_futures
    _heartbeatPresence();
  }

  Future<void> _heartbeatPresence() async {
    try {
      final now = DateTime.now();
      if (_lastPresenceAt != null &&
          now.difference(_lastPresenceAt!) < const Duration(seconds: 12)) {
        return;
      }
      _lastPresenceAt = now;
      final api = ApiClient();
      await api.loadSession();
      if (!api.isLoggedIn) return;
      await api.presenceHeartbeat(focus: 'service');
    } catch (e) {
      debugPrint('FGS presence heartbeat: $e');
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}

  @override
  void onReceiveData(Object data) {
    if (data is Map) {
      final cmd = data['cmd']?.toString();
      if (cmd == 'incoming_call_wake') {
        FlutterForegroundTask.launchApp('/');
        // ignore: discarded_futures
        Future<void>.delayed(const Duration(milliseconds: 400), () {
          FlutterForegroundTask.launchApp('/');
        });
        // ignore: discarded_futures
        Future<void>.delayed(const Duration(milliseconds: 1200), () {
          FlutterForegroundTask.launchApp('/');
        });
      }
    }
  }

  @override
  void onNotificationButtonPressed(String id) {}

  @override
  void onNotificationPressed() {
    FlutterForegroundTask.launchApp('/');
  }

  @override
  void onNotificationDismissed() {}
}
