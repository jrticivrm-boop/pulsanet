import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_network.dart';
import 'config.dart';
import 'hairpin_state.dart';

/// En Wi‑Fi: si el servidor SICOM responde en LAN, API directa `https://192.168.1.150`.
/// Si el Wi‑Fi no llega ni a la LAN ni al dominio (router sin hairpin / Wi‑Fi aislado
/// del cable), la app usa datos móviles aunque el Wi‑Fi siga encendido.
/// En 4G: DuckDNS. Nunca forzar IP LAN sin probe OK (rompe datos móviles).
class DuckDnsHairpin {
  DuckDnsHairpin._();

  static const _prefsLanKey = 'duckdns_hairpin_lan_ip_v1';
  static const _probeTimeout = Duration(milliseconds: 1500);
  static const _ensureBudget = Duration(milliseconds: 2000);
  static const _cellularRetryGap = Duration(seconds: 60);

  static const _compileLanIp = String.fromEnvironment('SERVER_LAN_IP');
  static const _compileLanIps = String.fromEnvironment('SERVER_LAN_IPS');

  /// IPs LAN del servidor de producción (VM SICOM primero).
  static List<String> get lanCandidates {
    final out = <String>[];
    for (final raw in [_compileLanIp, ..._compileLanIps.split(','), '192.168.1.150']) {
      final ip = raw.trim();
      if (ip.isNotEmpty && AppConfig.isPrivateHost(ip) && !out.contains(ip)) out.add(ip);
    }
    return out;
  }

  static String get compileLanIp => lanCandidates.first;

  static bool _cellularBound = false;
  static DateTime? _cellularFailedAt;

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
    _cellularBound = false;
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
    _cellularBound = false;
    await ApiNetwork.clearBind();

    final base = AppConfig.logicalApiBaseUrl;
    final uri = Uri.tryParse(base);
    if (uri == null || uri.host.isEmpty) return;

    // Override privado (alguien puso .77): solo si el TCP llega. En 4G no llega.
    if (AppConfig.hasOverride && AppConfig.isPrivateHost(uri.host)) {
      if (await _probeLanApi(uri.host, requireProduction: false)) {
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

    // Build apuntando ya a IP LAN (APK de desarrollo): sin desvío hairpin.
    if (!AppConfig.hasOverride && AppConfig.isPrivateHost(uri.host)) return;

    final ip = await _findLan();
    if (ip != null) {
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

  /// Tras fallo de transporte: LAN si responde; si no, datos móviles; si ya
  /// estábamos en datos móviles, de vuelta a la red normal.
  static Future<void> failoverAfterTransportFail() async {
    if (_cellularBound) {
      await clear(forgetPrefs: false);
      debugPrint('DuckDnsHairpin: datos móviles fallaron → red normal');
      return;
    }

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

    // Estábamos en DuckDNS y falló → LAN solo si de verdad responde.
    final ip = await _findLan();
    if (ip != null) {
      lanIp = ip;
      AppConfig.setLanDirectBase('https://$ip');
      debugPrint('DuckDnsHairpin: failover → LAN $ip');
      return;
    }

    // Ni LAN ni dominio por esta red (Wi‑Fi sin hairpin): datos móviles.
    final failedAt = _cellularFailedAt;
    if (failedAt != null && DateTime.now().difference(failedAt) < _cellularRetryGap) return;
    final ok = await ApiNetwork.preferCellular();
    _cellularBound = ok;
    _cellularFailedAt = ok ? null : DateTime.now();
    debugPrint('DuckDnsHairpin: failover → datos móviles ${ok ? 'OK' : 'no disponibles'}');
  }

  static Future<String?> _findLan() async {
    final ips = lanCandidates;
    if (ips.isEmpty) return null;
    final found = Completer<String?>();
    var pending = ips.length;
    for (final ip in ips) {
      _probeLanApi(ip).then((ok) {
        pending--;
        if (ok && !found.isCompleted) found.complete(ip);
        if (pending == 0 && !found.isCompleted) found.complete(null);
      });
    }
    return found.future;
  }

  /// Solo cuenta si responde la API de producción de SICOM (no basta un puerto abierto).
  static Future<bool> _probeLanApi(String ip, {bool requireProduction = true}) async {
    final client = HttpClient()..connectionTimeout = _probeTimeout;
    try {
      final req = await client.getUrl(Uri.parse('https://$ip/api/health')).timeout(_probeTimeout);
      final res = await req.close().timeout(_probeTimeout);
      if (res.statusCode != 200) return false;
      final body = await res.transform(utf8.decoder).join().timeout(_probeTimeout);
      final j = jsonDecode(body);
      return j is Map &&
          j['service'] == 'tacticalptx-api' &&
          (!requireProduction || j['env'] == 'production');
    } catch (_) {
      return false;
    } finally {
      client.close(force: true);
    }
  }
}
