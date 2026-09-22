import 'package:flutter/services.dart';

/// En Telmex HG8145 el Wi‑Fi no habla con el PC por cable (aislamiento SSID)
/// y el router no hace hairpin NAT. Si la LAN no responde, esta API pide a
/// Android usar **datos móviles** para DuckDNS aunque el Wi‑Fi siga activo.
class ApiNetwork {
  ApiNetwork._();

  static const _ch = MethodChannel('com.tacticalptx.app/network');

  static Future<bool> preferCellular() async {
    try {
      return await _ch.invokeMethod<bool>('preferCellular') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> clearBind() async {
    try {
      await _ch.invokeMethod('clearBind');
    } catch (_) {}
  }
}
