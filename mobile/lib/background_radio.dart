import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Mantiene Radio / socket / audio / GPS vivos con app minimizada o pantalla bloqueada.
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
        channelDescription:
            'Mantiene el canal y la ubicación con pantalla bloqueada (sin retener el micrófono)',
        channelImportance: NotificationChannelImportance.DEFAULT,
        priority: NotificationPriority.DEFAULT,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        // Ping frecuente: menos riesgo de que el OEM suspenda audio/socket/GPS.
        eventAction: ForegroundTaskEventAction.repeat(15000),
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

  /// Arranca (o refresca) el servicio en primer plano.
  /// [forceRestart] recrea el FGS para aplicar tipos microphone|mediaPlayback|location.
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
    final title = 'TacticalPtx activo';
    final text =
        '$_channelLabel · radio y ubicación en segundo plano';

    if (running && forceRestart) {
      await FlutterForegroundTask.stopService();
    } else if (running) {
      await FlutterForegroundTask.updateService(
        notificationTitle: title,
        notificationText: text,
      );
      return;
    }

    await FlutterForegroundTask.startService(
      serviceTypes: const [
        ForegroundServiceTypes.mediaPlayback,
        ForegroundServiceTypes.location,
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
    // Ping ligero para que el SO no mate el proceso (audio LiveKit + socket + GPS).
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
