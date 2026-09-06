import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Mantiene Radio / socket / audio / GPS (/ cámara remota) vivos con pantalla bloqueada.
class BackgroundRadio {
  BackgroundRadio._();

  static bool _inited = false;
  static String _channelLabel = 'Canal activo';
  static bool _remoteCameraActive = false;
  static bool _remoteMicActive = false;

  static bool get remoteCameraActive => _remoteCameraActive;

  static Future<void> init() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    if (_inited) return;

    FlutterForegroundTask.initCommunicationPort();

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'tacticalptx_radio',
        channelName: 'Radio TacticalPtx',
        channelDescription:
            'Mantiene canal, ubicación y cámara remota con pantalla bloqueada',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
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

  /** Activa tipo FGS `camera` para que Android no suspenda el feed al bloquear. */
  static Future<void> setRemoteCameraActive(bool active) async {
    if (_remoteCameraActive == active) {
      if (active) {
        // Si ya está activo en memoria, refrescar título; tipos ya aplicados.
        await start(forceRestart: false);
      }
      return;
    }
    final enabling = active && !_remoteCameraActive;
    _remoteCameraActive = active;
    if (!active) _remoteMicActive = false;
    final running = await FlutterForegroundTask.isRunningService;
    // updateService no cambia serviceTypes: al añadir `camera` hay que reiniciar
    // (mismo patrón que mic). Al apagar, update basta si el servicio sigue.
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
    // Solo reiniciar al añadir tipo microphone; apagar no tumba el servicio.
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
    final title = _remoteCameraActive ? 'Cámara de despacho activa' : 'TacticalPtx activo';
    final text = _remoteCameraActive
        ? (_remoteMicActive
            ? 'Transmitiendo cámara y micrófono · $_channelLabel'
            : 'Transmitiendo cámara con pantalla bloqueada · $_channelLabel')
        : '$_channelLabel · radio y ubicación en segundo plano';

    final types = <ForegroundServiceTypes>[
      ForegroundServiceTypes.mediaPlayback,
      ForegroundServiceTypes.location,
      if (_remoteCameraActive) ForegroundServiceTypes.camera,
      if (_remoteMicActive) ForegroundServiceTypes.microphone,
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
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {
    FlutterForegroundTask.sendDataToMain({'ts': timestamp.millisecondsSinceEpoch});
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}

  @override
  void onReceiveData(Object data) {}

  @override
  void onNotificationButtonPressed(String id) {}

  @override
  void onNotificationPressed() {
    FlutterForegroundTask.launchApp('/');
  }

  @override
  void onNotificationDismissed() {}
}
