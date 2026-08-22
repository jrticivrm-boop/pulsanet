/// Configuración de la app alpha (Mes 3).
/// Emulador Android → 10.0.2.2 = localhost del PC.
/// Dispositivo físico → IP LAN del PC (ej. http://192.168.1.10:4000).
class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:4000',
  );

  static String get socketUrl => apiBaseUrl;

  /// Si LiveKit viene como 127.0.0.1/localhost, usa el host de API_BASE.
  static String publicLiveKitUrl(String url) {
    final apiUri = Uri.tryParse(apiBaseUrl);
    final host = apiUri?.host;
    if (host == null || host.isEmpty) return url;
    if (host == '127.0.0.1' || host == 'localhost') return url;
    return url.replaceAll('127.0.0.1', host).replaceAll('localhost', host);
  }
}
