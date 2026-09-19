import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;

/// TLS para API/Socket.
///
/// - DuckDNS/4G: trust del sistema (Let's Encrypt).
/// - LAN `https://192.168.1.77`: solo el cert Caddy `tls internal` embebido
///   (`assets/certs/lan-cert.pem`). No se acepta un certificado arbitrario en LAN.
class LanTls {
  static bool _ready = false;
  static SecurityContext? _ctx;
  /// PEM normalizado (sin whitespace) del cert LAN embebido.
  static String? _pinnedPemNorm;

  static Future<void> install() async {
    if (_ready) return;
    await _loadPin();
    HttpOverrides.global = _LanHttpOverrides();
    _ready = true;
  }

  static Future<void> _loadPin() async {
    try {
      final pem = await rootBundle.loadString('assets/certs/lan-cert.pem');
      final ctx = SecurityContext(withTrustedRoots: true);
      ctx.setTrustedCertificatesBytes(utf8.encode(pem));
      _ctx = ctx;
      _pinnedPemNorm = _normalizePem(pem);
    } catch (_) {
      _ctx = SecurityContext(withTrustedRoots: true);
      _pinnedPemNorm = null;
    }
  }

  static String _normalizePem(String pem) {
    return pem.replaceAll(RegExp(r'\s+'), '');
  }

  static bool certMatchesPin(X509Certificate cert) {
    final pin = _pinnedPemNorm;
    if (pin == null || pin.isEmpty) return false;
    try {
      return _normalizePem(cert.pem) == pin;
    } catch (_) {
      return false;
    }
  }
}

class _LanHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(LanTls._ctx ?? context);
    client.badCertificateCallback =
        (X509Certificate cert, String host, int port) {
      if (!_isLanTlsHost(host)) return false;
      return LanTls.certMatchesPin(cert);
    };
    return client;
  }
}

/// Solo loopback / emulador / IP canónica del host Ethernet.
bool _isLanTlsHost(String host) {
  final h = host.trim().toLowerCase();
  if (h == 'localhost' || h == '127.0.0.1' || h == '10.0.2.2') return true;
  return h == '192.168.1.77';
}
