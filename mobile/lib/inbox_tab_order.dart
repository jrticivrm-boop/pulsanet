import 'dart:convert';
import 'dart:ui' show Color;

import 'package:shared_preferences/shared_preferences.dart';

/// Chips de bandeja: Contactos · Grupos · No leídos · Favoritos (orden por usuario).
const kInboxTabIds = ['contacts', 'groups', 'unread', 'favorites'];

const kInboxTabLabels = {
  'contacts': 'Contactos',
  'groups': 'Grupos',
  'unread': 'No leídos',
  'favorites': 'Favoritos',
};

const _legacyMap = {
  'all': 'contacts',
  'contacts': 'contacts',
  'groups': 'groups',
  'unread': 'unread',
  'favorites': 'favorites',
};

String inboxTabOrderStorageKey(String? userId) =>
    'tacticalptx_chat_tab_order_${userId ?? 'anon'}';

List<String> normalizeInboxTabOrder(Iterable<dynamic>? raw) {
  final seen = <String>{};
  final out = <String>[];
  for (final id in raw ?? const []) {
    final mapped = _legacyMap[id?.toString()];
    if (mapped == null || seen.contains(mapped)) continue;
    seen.add(mapped);
    out.add(mapped);
  }
  for (final id in kInboxTabIds) {
    if (!seen.contains(id)) out.add(id);
  }
  return out;
}

Future<List<String>> loadInboxTabOrder(String? userId) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(inboxTabOrderStorageKey(userId));
    if (raw == null || raw.isEmpty) return List<String>.from(kInboxTabIds);
    final decoded = jsonDecode(raw);
    return normalizeInboxTabOrder(decoded is List ? decoded : null);
  } catch (_) {
    return List<String>.from(kInboxTabIds);
  }
}

Future<void> saveInboxTabOrder(String? userId, List<String> order) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      inboxTabOrderStorageKey(userId),
      jsonEncode(normalizeInboxTabOrder(order)),
    );
  } catch (_) {}
}

List<String> moveInboxTab(List<String> order, String fromId, String toId) {
  final next = normalizeInboxTabOrder(order);
  final from = next.indexOf(fromId);
  final to = next.indexOf(toId);
  if (from < 0 || to < 0 || from == to) return next;
  next.removeAt(from);
  next.insert(to, fromId);
  return next;
}

int compareContactRows({
  required bool aOnline,
  required bool bOnline,
  required int aGrade,
  required int bGrade,
  String? aAt,
  String? bAt,
  String? aPresence,
  String? bPresence,
}) {
  final ar = presenceSortRank(aPresence, aOnline);
  final br = presenceSortRank(bPresence, bOnline);
  if (ar != br) return ar.compareTo(br);
  if (aGrade != bGrade) return aGrade.compareTo(bGrade);
  final ta = aAt != null ? DateTime.tryParse(aAt)?.millisecondsSinceEpoch ?? 0 : 0;
  final tb = bAt != null ? DateTime.tryParse(bAt)?.millisecondsSinceEpoch ?? 0 : 0;
  return tb.compareTo(ta);
}

/// 0 en línea → 1 ausente → 2 desconectado → 3 fuera de línea.
int presenceSortRank(String? presence, bool online) {
  switch (normalizePresenceKey(presence, online)) {
    case 'online':
      return 0;
    case 'away':
      return 1;
    case 'stale':
      return 2;
    case 'offline':
    default:
      return 3;
  }
}

String normalizePresenceKey(String? presence, bool online) {
  final p = (presence ?? '').toLowerCase().trim();
  if (p == 'away' || p == 'background' || p == 'service') return 'away';
  if (p == 'online' ||
      p == 'radio' ||
      p == 'active' ||
      p == 'foreground') {
    return 'online';
  }
  if (p == 'stale') return 'stale';
  if (p == 'offline') return 'offline';
  return online ? 'online' : 'offline';
}

/// Colores semáforo (paridad GPS / mapa).
Color presenceSemaphoreColor(String? presence, {bool online = false}) {
  switch (normalizePresenceKey(presence, online)) {
    case 'online':
      return const Color(0xFF1F5A2E);
    case 'away':
      return const Color(0xFFA16207);
    case 'stale':
      return const Color(0xFF991B1B);
    case 'offline':
    default:
      return const Color(0xFF6B7280);
  }
}

String presenceSemaphoreLabel(String? presence, {bool online = false}) {
  switch (normalizePresenceKey(presence, online)) {
    case 'online':
      return 'En línea';
    case 'away':
      return 'Ausente';
    case 'stale':
      return 'Desconectado';
    case 'offline':
    default:
      return 'Fuera de línea';
  }
}


int compareByLastMessage(String? aAt, String? bAt) {
  final ta = aAt != null ? DateTime.tryParse(aAt)?.millisecondsSinceEpoch ?? 0 : 0;
  final tb = bAt != null ? DateTime.tryParse(bAt)?.millisecondsSinceEpoch ?? 0 : 0;
  return tb.compareTo(ta);
}
