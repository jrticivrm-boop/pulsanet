import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_network.dart';
import 'config.dart';
import 'hairpin_state.dart';

/// En Wi‑Fi: si el PC responde en LAN, API directa `https://192.168.1.77`.
/// En 4G: DuckDNS. Nunca forzar IP LAN sin probe OK (rompe datos móviles).
class DuckDnsHairpin {
  DuckDnsHairpin._();

  static const _prefsLanKey = 'duckdns_hairpin_lan_ip_v1';
  static const _probeTimeout = Duration(milliseconds: 1200);
  static const _ensureBudget = Duration(milliseconds: 2000);

  static const _compileLanIp = String.fromEnvironment('SERVER_LAN_IP');

  static String get compileLanIp {
    final v = _compileLanIp.trim();
    return v.isNotEmpty ? v : '192.168.1.77';
  }

  static String? get lanIp => HairpinState.lanIp;
  static set lanIp(String? v) => HairpinState.lanIp = v;

  static bool get active =>
      (lanIp != null && lanIp!.isNotEmpty) || AppConfig.hasLanDirect;

  static bool looksLikeNoRoute(Object e) {
    final msg = e.toString().toLowerCase();
    return msg.contains('no route to host') ||
        msg.contains('network is unreachable') ||
        msg.contains('errno = 113') ||
        msg.contains('errno = 101');
  }

  static bool looksLikeTransportFail(Object e) {
    if (e is TimeoutException || e is SocketException) return true;
    final msg = e.toString();
    return looksLikeNoRoute(e) ||
        msg.contains('TimeoutException') ||
        msg.contains('SocketException') ||
        msg.contains('ClientException') ||
        msg.contains('Failed host lookup') ||
        msg.contains('Connection refused') ||
        msg.contains('Connection timed out') ||
        msg.contains('Network is unreachable');
  }

  static Future<void> clear({bool forgetPrefs = false}) async {
    lanIp = null;
    AppConfig.setLanDirectBase(null);
    await ApiNetwork.clearBind();
    if (!forgetPrefs) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_prefsLanKey);
    } catch (_) {}
  }

  static Future<void> ensure() async {
    try {
      await _ensureInner().timeout(_ensureBudget);
    } catch (e) {
      debugPrint('DuckDnsHairpin: ensure $e');
    }
  }

  static Future<void> _ensureInner() async {
    await ApiNetwork.clearBind();

    final base = AppConfig.logicalApiBaseUrl;
    final uri = Uri.tryParse(base);
    if (uri == null || uri.host.isEmpty) return;

    // Override privado (alguien puso .77): solo si el TCP llega. En 4G no llega.
    if (AppConfig.hasOverride && AppConfig.isPrivateHost(uri.host)) {
      if (await _probeLanApi(uri.host)) {
        lanIp = uri.host;
        AppConfig.setLanDirectBase(base);
        return;
      }
      debugPrint('DuckDnsHairpin: override LAN inalcanzable → DuckDNS');
      await AppConfig.setApiBaseOverride(null);
      lanIp = null;
      AppConfig.setLanDirectBase(null);
    }

    lanIp = null;
    AppConfig.setLanDirectBase(null);

    final ip = compileLanIp;
    if (!AppConfig.isPrivateHost(ip)) return;

    if (await _probeLanApi(ip)) {
      lanIp = ip;
      AppConfig.setLanDirectBase('https://$ip');
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_prefsLanKey, ip);
      } catch (_) {}
      debugPrint('DuckDnsHairpin: LAN $ip');
      return;
    }
    debugPrint('DuckDnsHairpin: sin LAN → DuckDNS');
  }

  /// Tras fallo de transporte: LAN solo si el probe responde; si no, DuckDNS.
  static Future<void> failoverAfterTransportFail() async {
    final ip = compileLanIp;

    if (AppConfig.hasLanDirect) {
      // LAN falló → volver a DuckDNS (típico: override .77 en 4G).
      await clear(forgetPrefs: false);
      if (AppConfig.hasOverride) {
        final h = Uri.tryParse(AppConfig.logicalApiBaseUrl)?.host ?? '';
        if (AppConfig.isPrivateHost(h)) {
          await AppConfig.setApiBaseOverride(null);
        }
      }
      return;
    }

    // Estábamos en DuckDNS y falló → solo LAN si de verdad responde.
    if (ip.isNotEmpty && await _probeLanApi(ip)) {
      lanIp = ip;
      AppConfig.setLanDirectBase('https://$ip');
      debugPrint('DuckDnsHairpin: failover → LAN $ip');
    }
  }

  static Future<bool> _probeLanApi(String ip) async {
    Socket? raw;
    try {
      raw = await Socket.connect(
        InternetAddress(ip, type: InternetAddressType.IPv4),
        443,
        timeout: _probeTimeout,
      ).timeout(_probeTimeout);
      return true;
    } catch (_) {
      return false;
    } finally {
      try {
        await raw?.close();
      } catch (_) {}
    }
  }
}
