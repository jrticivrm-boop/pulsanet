import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;

import 'config.dart';

/// TLS para API/Socket.
///
/// - DuckDNS/4G: trust del sistema (Let's Encrypt).
/// - LAN VM SICOM `https://192.168.1.150`: cadena hasta la CA raíz de su Caddy
///   (`assets/certs/sicom-lan-root.pem`; el cert del servidor se renueva cada 12 h).
/// - LAN PC `https://192.168.1.77`: solo el cert embebido (`assets/certs/lan-cert.pem`).
/// No se acepta un certificado arbitrario en LAN.
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
    final ctx = SecurityContext(withTrustedRoots: true);
    try {
      final pem = await rootBundle.loadString('assets/certs/lan-cert.pem');
      ctx.setTrustedCertificatesBytes(utf8.encode(pem));
      _pinnedPemNorm = _normalizePem(pem);
    } catch (_) {
      _pinnedPemNorm = null;
    }
    try {
      final root = await rootBundle.loadString('assets/certs/sicom-lan-root.pem');
      ctx.setTrustedCertificatesBytes(utf8.encode(root));
    } catch (_) {}
    _ctx = ctx;
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

/// Loopback / emulador / IP privada (PC en Ethernet o en el Wi‑Fi mesh). El cert
/// debe coincidir exacto con el embebido, así que una IP privada no basta sola.
bool _isLanTlsHost(String host) {
  final h = host.trim().toLowerCase();
  if (h == '10.0.2.2') return true;
  return AppConfig.isPrivateHost(h);
}
