import 'package:flutter/services.dart';

import 'android_native.dart';

/// En Telmex HG8145 el Wi‑Fi no habla con el PC por cable (aislamiento SSID)
/// y el router no hace hairpin NAT. Si la LAN no responde, esta API pide a
/// Android usar **datos móviles** para DuckDNS aunque el Wi‑Fi siga activo.
/// En iOS no aplica (el sistema elige la interfaz); no-op seguro.
class ApiNetwork {
  ApiNetwork._();

  static const _ch = MethodChannel('com.tacticalptx.app/network');

  static Future<bool> preferCellular() async {
    if (!kIsAndroidNative) return false;
    try {
      return await _ch.invokeMethod<bool>('preferCellular') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> clearBind() async {
    if (!kIsAndroidNative) return;
    try {
      await _ch.invokeMethod('clearBind');
    } catch (_) {}
  }
}
