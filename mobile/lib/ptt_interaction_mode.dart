import 'package:shared_preferences/shared_preferences.dart';

import 'roles.dart';

const kPttModePrefsKey = 'tpx_ptt_mode_v1';

/// Modo PTT: hold = Mantén; latch = Toque.
enum PttInteractionMode { hold, latch }

extension PttInteractionModeX on PttInteractionMode {
  bool get isLatch => this == PttInteractionMode.latch;

  String get storageValue =>
      this == PttInteractionMode.latch ? 'latch' : 'hold';

  String get label =>
      this == PttInteractionMode.latch ? 'Larga' : 'Corta';
}

PttInteractionMode defaultPttModeForUser(Map<String, dynamic>? user) {
  return canManageUsers(user) ? PttInteractionMode.latch : PttInteractionMode.hold;
}

PttInteractionMode? pttModeFromStorage(String? raw) {
  switch (raw) {
    case 'latch':
    case 'touch':
    case 'toque':
    case 'larga':
      return PttInteractionMode.latch;
    case 'hold':
    case 'manten':
    case 'mantener':
    case 'corta':
      return PttInteractionMode.hold;
    default:
      return null;
  }
}

Future<PttInteractionMode> loadPttInteractionMode(
  Map<String, dynamic>? user,
) async {
  final prefs = await SharedPreferences.getInstance();
  final stored = pttModeFromStorage(prefs.getString(kPttModePrefsKey));
  return stored ?? defaultPttModeForUser(user);
}

Future<void> savePttInteractionMode(PttInteractionMode mode) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kPttModePrefsKey, mode.storageValue);
}
