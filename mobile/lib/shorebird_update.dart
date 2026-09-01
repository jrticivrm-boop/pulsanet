import 'package:flutter/foundation.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

/// Parches OTA Shorebird (solo builds publicados con Shorebird).
/// En APK normales (`flutter build apk`) no hace nada.
class ShorebirdUpdate {
  ShorebirdUpdate._();

  static final ShorebirdUpdater _updater = ShorebirdUpdater();

  /// Comprueba y aplica parche si hay. Devuelve true si hay que reiniciar.
  static Future<bool> checkAndApply() async {
    if (!_updater.isAvailable) return false;
    try {
      final status = await _updater.checkForUpdate();
      if (status != UpdateStatus.outdated) return false;
      await _updater.update();
      return true;
    } catch (e, st) {
      debugPrint('ShorebirdUpdate: $e\n$st');
      return false;
    }
  }

  /// Compat: comprueba en segundo plano (sin bloquear UI).
  static void checkInBackground({void Function()? onReadyToRestart}) {
    checkAndApply().then((ready) {
      if (ready) onReadyToRestart?.call();
    });
  }
}
