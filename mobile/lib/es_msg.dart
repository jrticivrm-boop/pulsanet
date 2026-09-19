/// Mensajes de error de plataforma → español para la UI.
String esMsg(Object? raw, [String fallback = 'Ocurrió un error']) {
  if (raw == null) return fallback;
  final s = raw.toString().replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
  if (s.isEmpty) return fallback;
  final lower = s.toLowerCase();

  if (RegExp(r'permission denied|notallowed|user denied|microphone', caseSensitive: false).hasMatch(s)) {
    return 'Micrófono bloqueado. Permite el acceso en Ajustes del teléfono.';
  }
  if (RegExp(r'handshake|certificate_verify|certificat|ssl|tls', caseSensitive: false).hasMatch(s)) {
    return 'No se confió el certificado HTTPS. Instala la APK actualizada (1.8.3+9) o revisa el cert LAN.';
  }
  if (RegExp(r'failed to fetch|socketexception|network|connection refused|connection reset', caseSensitive: false)
      .hasMatch(s)) {
    return 'Sin conexión con el servidor. Revisa Wi‑Fi o la IP de la API.';
  }
  if (RegExp(r'timeout|timed out|timeoutexception', caseSensitive: false).hasMatch(s)) {
    return 'Sin respuesta del servidor. Revisa Wi‑Fi/datos o que el servidor esté encendido.';
  }
  if (RegExp(r'unauthorized|jwt|token expired|invalid token', caseSensitive: false).hasMatch(s)) {
    return 'Sesión vencida. Vuelve a iniciar sesión.';
  }
  if (RegExp(r'formato no válido|solo imágenes|mime|octet-stream', caseSensitive: false)
      .hasMatch(s)) {
    return 'Formato no válido. Elige otra foto o recórtala de nuevo.';
  }
  if (RegExp(r'no se pudo subir|subir la (foto|imagen)|3 mb', caseSensitive: false).hasMatch(s)) {
    return s.contains('3') ? s : 'No se pudo subir la foto. Intenta de nuevo.';
  }
  if (lower == 'error' || lower == 'unknown error') return fallback;
  return s;
}
