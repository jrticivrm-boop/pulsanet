import 'package:flutter/services.dart';

const _notifyChannel = MethodChannel('com.tacticalptx.app/notifications');

enum PhoneRingerMode { silent, vibrate, normal, unknown }

Future<PhoneRingerMode> readPhoneRingerMode() async {
  try {
    final v = await _notifyChannel.invokeMethod<String>('getRingerMode');
    switch (v) {
      case 'silent':
        return PhoneRingerMode.silent;
      case 'vibrate':
        return PhoneRingerMode.vibrate;
      case 'normal':
        return PhoneRingerMode.normal;
      default:
        return PhoneRingerMode.unknown;
    }
  } catch (_) {
    return PhoneRingerMode.unknown;
  }
}

/// Vibrar en llamada/transmisión entrante salvo modo silencio estricto.
bool shouldVibrateForIncomingCall(PhoneRingerMode mode) {
  return mode != PhoneRingerMode.silent;
}

/// Sonido/vibración de notificación local según modo del teléfono.
Future<({bool playSound, bool enableVibration})> incomingCallNotifPrefs() async {
  final ringer = await readPhoneRingerMode();
  return (
    playSound: ringer == PhoneRingerMode.normal || ringer == PhoneRingerMode.unknown,
    enableVibration: shouldVibrateForIncomingCall(ringer),
  );
}
