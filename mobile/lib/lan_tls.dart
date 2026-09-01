import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

import 'config.dart';

/// Confía el certificado TLS LAN (autofirmado) en Dart/Flutter.
/// Android `network_security_config` no aplica al [HttpClient] de Dart.
class LanTls {
  static bool _ready = false;

  static Future<void> install() async {
    if (_ready) return;
    try {
      final pem = await rootBundle.loadString('assets/certs/lan-cert.pem');
      final ctx = SecurityContext(withTrustedRoots: true);
      ctx.setTrustedCertificatesBytes(utf8.encode(pem));
      HttpOverrides.global = _LanHttpOverrides(ctx);
      _ready = true;
    } catch (e) {
      HttpOverrides.global = _LanHttpOverrides(null);
      _ready = true;
      // ignore: avoid_print
      print('LanTls: sin asset de cert ($e); solo host de API configurado');
    }
  }
}

class _LanHttpOverrides extends HttpOverrides {
  _LanHttpOverrides(this._ctx);

  final SecurityContext? _ctx;

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(_ctx ?? context);
    // Solo el host de API (y localhost/emulador). No confiar en toda la LAN.
    client.badCertificateCallback = (X509Certificate cert, String host, int port) {
      return _isTrustedApiHost(host);
    };
    return client;
  }
}

bool _isTrustedApiHost(String host) {
  final h = host.trim().toLowerCase();
  if (h == 'localhost' || h == '127.0.0.1' || h == '10.0.2.2') return true;
  final apiHost = Uri.tryParse(AppConfig.apiBaseUrl)?.host.toLowerCase();
  if (apiHost != null && apiHost.isNotEmpty && h == apiHost) return true;
  return false;
}
