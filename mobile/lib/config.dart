import 'package:shared_preferences/shared_preferences.dart';

import 'hairpin_state.dart';

/// Configuración de la app.
/// Emulador Android → 10.0.2.2 = localhost del PC.
/// Dispositivo físico → API_BASE vía --dart-define, override en login, o default.
///
/// Preferir un dominio **estable** (DuckDNS) en el default: la IP del ISP puede
/// cambiar; el hostname permanente no, si Sync-PublicIp actualiza el DNS.
class AppConfig {
  static const compileTimeApiBaseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://pulsanet.duckdns.org',
  );

  static const _prefsKey = 'api_base_override';
  static String? _override;

  /// Base LAN en runtime (Wi‑Fi → https://192.168.1.77). No se persiste.
  static String? _lanDirectBase;

  /// Base lógica (override usuario o DuckDNS). No cambia con LAN directa.
  static String get logicalApiBaseUrl {
    final o = _override?.trim();
    if (o != null && o.isNotEmpty) return o.replaceAll(RegExp(r'/+$'), '');
    return compileTimeApiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  }

  /// Base efectiva HTTP/Socket: LAN directa si el discovery la encontró.
  static String get apiBaseUrl {
    final lan = _lanDirectBase?.trim();
    if (lan != null && lan.isNotEmpty) {
      return lan.replaceAll(RegExp(r'/+$'), '');
    }
    return logicalApiBaseUrl;
  }

  /// Activa/desactiva API por IP LAN (Wi‑Fi sin hairpin NAT al dominio).
  static void setLanDirectBase(String? httpsBaseOrIp) {
    final raw = httpsBaseOrIp?.trim() ?? '';
    if (raw.isEmpty) {
      _lanDirectBase = null;
      return;
    }
    var v = raw.replaceAll(RegExp(r'/+$'), '');
    if (!v.contains('://')) v = 'https://$v';
    _lanDirectBase = socketUrlFor(v);
    final host = Uri.tryParse(_lanDirectBase!)?.host;
    if (host != null && isPrivateHost(host)) {
      HairpinState.lanIp = host;
    }
  }

  static bool get hasLanDirect =>
      (_lanDirectBase?.trim().isNotEmpty ?? false);

  static bool get hasOverride =>
      (_override?.trim().isNotEmpty ?? false) &&
      _override!.trim().replaceAll(RegExp(r'/+$'), '') !=
          compileTimeApiBaseUrl.replaceAll(RegExp(r'/+$'), '');

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey)?.trim();
    _override = (raw != null && raw.isNotEmpty) ? raw : null;
  }

  /// Persiste servidor (ej. `https://otro.duckdns.org`). Vacío = default del build.
  static Future<void> setApiBaseOverride(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    final cleaned = url?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
    if (cleaned.isEmpty) {
      await prefs.remove(_prefsKey);
      _override = null;
      return;
    }
    var value = cleaned;
    if (!value.contains('://')) value = 'https://$value';
    // Evitar persistir `https://host:0` (Uri.hasPort + port 0 → WS roto).
    value = socketUrlFor(value);
    await prefs.setString(_prefsKey, value);
    _override = value;
  }

  /// Debe coincidir con APP_UPDATE_SECRET del servidor (header OTA).
  static const appUpdateSecret = String.fromEnvironment(
    'APP_UPDATE_SECRET',
    defaultValue: '',
  );

  /// URL para `socket_io_client`. Nunca incluye `:0` (rompe el upgrade WS).
  ///
  /// Omite puerto por defecto (443/80): Dart/`socket_io_client` usan el default
  /// del esquema. Si el override trae `:0` u otro inválido, se corrige.
  static String get socketUrl => socketUrlFor(apiBaseUrl);

  static String socketUrlFor(String base) {
    final cleaned = base.trim().replaceAll(RegExp(r'/+$'), '');
    final u = Uri.tryParse(cleaned);
    if (u == null || u.host.isEmpty) return cleaned;
    final scheme = (u.scheme.isEmpty ? 'https' : u.scheme).toLowerCase();
    final secure = scheme == 'https' || scheme == 'wss';
    final defaultPort = secure ? 443 : (scheme == 'http' || scheme == 'ws' ? 80 : 0);
    var port = u.hasPort ? u.port : defaultPort;
    if (port <= 0) port = defaultPort;
    // Sin puerto en la URL → evita `host:0` en excepciones/HttpClient.
    if (port <= 0 || port == defaultPort) {
      return '$scheme://${u.host}';
    }
    return '$scheme://${u.host}:$port';
  }

  /// Puerto TCP efectivo para Socket.IO / hairpin (nunca 0).
  static int socketPortFor(String base) {
    final u = Uri.tryParse(socketUrlFor(base));
    if (u == null) return 443;
    final scheme = u.scheme.toLowerCase();
    final secure = scheme == 'https' || scheme == 'wss';
    if (u.hasPort && u.port > 0) return u.port;
    return secure ? 443 : 80;
  }

  /// URL LiveKit alcanzable desde el dispositivo.
  ///
  /// Solo reescribe a LAN cuando la API efectiva es IP privada (`hasLanDirect`
  /// o host privado). Evita audio a `.77` mientras el REST sigue en DuckDNS.
  static String publicLiveKitUrl(String url) {
    final apiUri = Uri.tryParse(apiBaseUrl);
    final apiHost = apiUri?.host ?? '';
    if (apiHost.isNotEmpty && isPrivateHost(apiHost)) {
      return 'wss://$apiHost';
    }
    if (hasLanDirect) {
      final bypassLan = HairpinState.lanIp;
      if (bypassLan != null && bypassLan.isNotEmpty) {
        return 'wss://$bypassLan';
      }
    }

    if (apiUri == null || apiUri.host.isEmpty) return url;

    final host = apiUri.host;
    final parsed = Uri.tryParse(url);

    if (parsed != null && parsed.scheme == 'ws' && isPrivateHost(parsed.host)) {
      return url;
    }

    if (apiUri.scheme == 'https') {
      if (parsed != null && parsed.scheme == 'wss') {
        if (parsed.host == '127.0.0.1' || parsed.host == 'localhost') {
          return url.replaceAll('127.0.0.1', host).replaceAll('localhost', host);
        }
        return url;
      }
      return 'wss://$host';
    }

    if (host == '127.0.0.1' || host == 'localhost') return url;
    return url.replaceAll('127.0.0.1', host).replaceAll('localhost', host);
  }

  static bool isPrivateHost(String h) {
    if (h == 'localhost' || h == '127.0.0.1') return true;
    if (h.startsWith('192.168.') || h.startsWith('10.')) return true;
    final parts = h.split('.');
    if (parts.length == 4 && parts[0] == '172') {
      final second = int.tryParse(parts[1]) ?? 0;
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  }
}
