import 'roles.dart';

/// Etiqueta principal en chat/radio (indicativo: SGTO GOMEZ, B.O. LINARES…).
String userDisplayLabel(Map<String, dynamic>? user, {String fallback = 'Usuario'}) {
  final name = user?['displayName']?.toString().trim();
  if (name != null && name.isNotEmpty) return name;
  final username = user?['username']?.toString().trim();
  if (username != null && username.isNotEmpty) return username;
  return fallback;
}

/// Subtítulo: usuario de login · rol (ej. aacunap2 · Operador).
String userDisplaySubtitle(Map<String, dynamic>? user) {
  final parts = <String>[];
  final username = user?['username']?.toString().trim();
  if (username != null && username.isNotEmpty) parts.add(username);
  final role = user?['role']?.toString();
  if (role != null && role.isNotEmpty) {
    parts.add(roleLabel(role));
  }
  return parts.join(' · ');
}
