/// Configuración de la app.
/// Emulador Android → 10.0.2.2 = localhost del PC.
/// Dispositivo físico → API_BASE vía --dart-define o default público HTTPS.
class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://189.152.200.238.sslip.io',
  );

  /// Debe coincidir con APP_UPDATE_SECRET del servidor (header OTA).
  static const appUpdateSecret = String.fromEnvironment(
    'APP_UPDATE_SECRET',
    defaultValue: '',
  );

  /// URL para `socket_io_client`.
  ///
  /// En Dart, `Uri.parse('https://host').port` es **0** si no hay puerto en la
  /// cadena; el cliente IO entonces abre `https://host:0/...` y falla el upgrade
  /// WebSocket. Aquí forzamos 443/80 cuando falte.
  static String get socketUrl => socketUrlFor(apiBaseUrl);

  /// Normaliza base HTTP(S) para Socket.IO (puerto explícito).
  static String socketUrlFor(String base) {
    final u = Uri.tryParse(base.trim());
    if (u == null || u.host.isEmpty) return base;
    final scheme = u.scheme.isEmpty ? 'https' : u.scheme;
    var port = u.hasPort ? u.port : 0;
    if (port <= 0) {
      port = switch (scheme) {
        'https' => 443,
        'http' => 80,
        _ => 0,
      };
    }
    if (port <= 0) return '$scheme://${u.host}';
    return '$scheme://${u.host}:$port';
  }

  /// URL LiveKit alcanzable desde el dispositivo.
  ///
  /// - `ws://192.168.x:7880` (LAN) → se conserva aunque API sea HTTPS.
  /// - API HTTPS + URL pública → `wss://mismo-host` (Caddy `/rtc`, puerto 443).
  static String publicLiveKitUrl(String url) {
    final apiUri = Uri.tryParse(apiBaseUrl);
    if (apiUri == null || apiUri.host.isEmpty) return url;

    final host = apiUri.host;
    final parsed = Uri.tryParse(url);

    if (parsed != null && parsed.scheme == 'ws' && _isPrivateHost(parsed.host)) {
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

  static bool _isPrivateHost(String h) {
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
