import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Mantiene Radio / socket / audio vivos con la app minimizada o pantalla bloqueada.
class BackgroundRadio {
  BackgroundRadio._();

  static bool _inited = false;
  static String _channelLabel = 'Canal activo';

  static Future<void> init() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    if (_inited) return;

    FlutterForegroundTask.initCommunicationPort();

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'tacticalptx_radio',
        channelName: 'Radio TacticalPtx',
        channelDescription: 'Mantiene el canal PTT, mensajes y llamadas activos',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(20000),
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

  static Future<void> start({String? channelName}) async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    await init();
    if (channelName != null && channelName.isNotEmpty) {
      _channelLabel = channelName;
    }

    final running = await FlutterForegroundTask.isRunningService;
    final title = 'TacticalPtx Radio';
    final text = '$_channelLabel · escuchando (mensajes y llamadas activos)';

    if (running) {
      await FlutterForegroundTask.updateService(
        notificationTitle: title,
        notificationText: text,
      );
      return;
    }

    await FlutterForegroundTask.startService(
      serviceTypes: const [
        ForegroundServiceTypes.microphone,
        ForegroundServiceTypes.mediaPlayback,
      ],
      notificationTitle: title,
      notificationText: text,
      callback: backgroundRadioCallback,
    );
  }

  static Future<void> stop() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
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
    // Ping ligero para que el SO no mate el proceso.
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
