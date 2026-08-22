import 'package:flutter/foundation.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

/// Parches OTA Shorebird. En builds normales (flutter run) no hace nada.
class ShorebirdUpdate {
  ShorebirdUpdate._();

  static final ShorebirdUpdater _updater = ShorebirdUpdater();

  /// Comprueba y descarga parche sin bloquear el arranque.
  /// [onReadyToRestart] → mostrar aviso “cierra y abre la app”.
  static void checkInBackground({void Function()? onReadyToRestart}) {
    if (!_updater.isAvailable) return;

    _updater.checkForUpdate().then((status) async {
      if (status != UpdateStatus.outdated) return;
      try {
        await _updater.update();
        onReadyToRestart?.call();
      } catch (e, st) {
        debugPrint('ShorebirdUpdate.update: $e\n$st');
      }
    }).catchError((Object e, StackTrace st) {
      debugPrint('ShorebirdUpdate.check: $e\n$st');
    });
  }
}
