import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'app_focus.dart';

/// Pitido breve cuando otro operador suelta el PTT (canal libre).
DateTime? _lastChannelFreeToneAt;

Future<void> playChannelFreeTone() async {
  final now = DateTime.now();
  if (_lastChannelFreeToneAt != null &&
      now.difference(_lastChannelFreeToneAt!) <
          const Duration(milliseconds: 200)) {
    return;
  }
  _lastChannelFreeToneAt = now;
  try {
    await SystemSound.play(SystemSoundType.click);
  } catch (e) {
    debugPrint('channel free tone: $e');
  }
}

/// Tono corto táctico (chirp radio) cuando el hilo ya está abierto.
final AudioPlayer _inChatTone = AudioPlayer();
DateTime? _lastInChatToneAt;

Future<void> playInChatMessageTone() async {
  await _playMessageTone(volume: 0.16);
}

/// Globo / otra conversación en primer plano (más audible que in-chat, sin bandeja).
Future<void> playMessageNotificationTone() async {
  await _playMessageTone(volume: 0.48);
}

Future<void> _playMessageTone({required double volume}) async {
  final now = DateTime.now();
  if (_lastInChatToneAt != null &&
      now.difference(_lastInChatToneAt!) < const Duration(milliseconds: 450)) {
    return;
  }
  _lastInChatToneAt = now;
  try {
    await _inChatTone.stop();
    await _inChatTone.setReleaseMode(ReleaseMode.stop);
    await _inChatTone.setVolume(volume);
    await _inChatTone.play(AssetSource('sounds/tactical_msg.wav'), volume: volume);
  } catch (e) {
    debugPrint('message tone: $e');
  }
}

/// ¿Está el usuario viendo este DM/grupo en primer plano?
bool isViewingConversation({String? peerId, String? groupId}) {
  if (appInBackground) return false;
  final kind = viewingChatKind;
  final id = viewingChatId;
  if (kind == null || id == null || id.isEmpty) return false;
  if (peerId != null && peerId.isNotEmpty && kind == 'dm' && id == peerId) {
    return true;
  }
  if (groupId != null && groupId.isNotEmpty && kind == 'group' && id == groupId) {
    return true;
  }
  return false;
}
