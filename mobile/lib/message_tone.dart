import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'app_focus.dart';
import 'panic_vibration.dart';
import 'sound_prefs.dart';

/// Pitido breve cuando otro operador suelta el PTT (canal libre) — fallback.
DateTime? _lastChannelFreeToneAt;
DateTime? _lastPttCueAt;
bool _toneCtxReady = false;

/// Players separados: stop/play concurrente no cancela el otro (press vs release).
final AudioPlayer _pttPressPlayer = AudioPlayer(playerId: 'ptt_press');
final AudioPlayer _pttReleasePlayer = AudioPlayer(playerId: 'ptt_release');
bool _pttPlayersWarmed = false;

/// Precalienta contexto + players (llamar al entrar a radio).
Future<void> warmPttCuePlayers() async {
  try {
    await _ensureToneAudioContext();
    if (_pttPlayersWarmed) return;
    await Future.wait([
      _pttPressPlayer.setPlayerMode(PlayerMode.lowLatency),
      _pttReleasePlayer.setPlayerMode(PlayerMode.lowLatency),
      _pttPressPlayer.setReleaseMode(ReleaseMode.stop),
      _pttReleasePlayer.setReleaseMode(ReleaseMode.stop),
    ]);
    _pttPlayersWarmed = true;
  } catch (e) {
    debugPrint('ptt warm: $e');
  }
}

/// Pitido fuerte y claro al pulsar / soltar PTT (bip alto vs bip bajo).
Future<void> playPttPressTone() async {
  await _playPttCue(
    player: _pttPressPlayer,
    asset: 'sounds/ptt_press.wav',
    volume: 0.95,
  );
}

Future<void> playPttReleaseTone() async {
  await _playPttCue(
    player: _pttReleasePlayer,
    asset: 'sounds/ptt_release.wav',
    volume: 0.9,
  );
}

Future<void> _playPttCue({
  required AudioPlayer player,
  required String asset,
  required double volume,
}) async {
  final now = DateTime.now();
  // Throttle corto; no bloquear press→release seguidos.
  if (_lastPttCueAt != null &&
      now.difference(_lastPttCueAt!) < const Duration(milliseconds: 45)) {
    return;
  }
  _lastPttCueAt = now;
  try {
    await _ensureToneAudioContext();
    if (!_pttPlayersWarmed) {
      await warmPttCuePlayers();
    }
    // No await stop largo: dispara el asset al instante.
    unawaited(player.stop());
    await player.setVolume(volume);
    await player.play(AssetSource(asset), volume: volume, mode: PlayerMode.lowLatency);
  } catch (e) {
    debugPrint('ptt cue: $e');
    try {
      await SystemSound.play(SystemSoundType.click);
    } catch (_) {}
  }
}

/// Tonos cortos: NUNCA voiceCommunication (rompe grabación de voz en WhatsApp).
Future<void> _ensureToneAudioContext() async {
  if (_toneCtxReady) return;
  _toneCtxReady = true;
  try {
    await AudioPlayer.global.setAudioContext(
      AudioContext(
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.ambient,
          options: {AVAudioSessionOptions.mixWithOthers},
        ),
        android: const AudioContextAndroid(
          isSpeakerphoneOn: false,
          stayAwake: false,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.assistanceSonification,
          audioFocus: AndroidAudioFocus.none,
        ),
      ),
    );
  } catch (e) {
    debugPrint('tone audio context: $e');
  }
}

Future<void> playChannelFreeTone() async {
  final now = DateTime.now();
  if (_lastChannelFreeToneAt != null &&
      now.difference(_lastChannelFreeToneAt!) <
          const Duration(milliseconds: 200)) {
    return;
  }
  _lastChannelFreeToneAt = now;
  // Preferir el mismo WAV de release (más audible que SystemSound.click).
  try {
    await playPttReleaseTone();
  } catch (e) {
    debugPrint('channel free tone: $e');
    try {
      await SystemSound.play(SystemSoundType.click);
    } catch (_) {}
  }
}

final AudioPlayer _inChatTone = AudioPlayer();
final AudioPlayer _nudgeTone = AudioPlayer();
DateTime? _lastInChatToneAt;
DateTime? _lastNudgeToneAt;

Future<void> playInChatMessageTone() async {
  await _playMessageTone(volume: 0.16);
}

/// Globo / otra conversación en primer plano.
Future<void> playMessageNotificationTone() async {
  await _playMessageTone(volume: 0.48);
}

Future<void> playNudgeTone() async {
  final now = DateTime.now();
  if (_lastNudgeToneAt != null &&
      now.difference(_lastNudgeToneAt!) < const Duration(milliseconds: 400)) {
    return;
  }
  _lastNudgeToneAt = now;
  final tone = await SoundPrefs.nudgeTone();
  if (tone == AppToneId.silent) return;
  final asset = tone.assetPath ?? 'sounds/nudge_buzz.wav';
  try {
    await _ensureToneAudioContext();
    await _nudgeTone.stop();
    await _nudgeTone.setReleaseMode(ReleaseMode.stop);
    await _nudgeTone.setVolume(0.85);
    await _nudgeTone.play(AssetSource(asset), volume: 0.85);
  } catch (e) {
    debugPrint('nudge tone: $e');
  }
}

/// Preview desde la pantalla de sonidos (sin throttle agresivo).
Future<void> previewAppTone(AppToneId tone) async {
  if (tone == AppToneId.silent) return;
  if (tone == AppToneId.system) {
    try {
      await SystemSound.play(SystemSoundType.alert);
    } catch (_) {}
    return;
  }
  final asset = tone.assetPath;
  if (asset == null) return;
  try {
    await _ensureToneAudioContext();
    await _inChatTone.stop();
    await _inChatTone.setReleaseMode(ReleaseMode.stop);
    await _inChatTone.setVolume(0.55);
    await _inChatTone.play(AssetSource(asset), volume: 0.55);
  } catch (e) {
    debugPrint('preview tone: $e');
  }
}

Future<void> applyReceivedNudgeFeedback({String? peerId}) async {
  // ignore: unawaited_futures
  playNudgeTone();
  await PanicVibration.nudge();
}

Future<void> _playMessageTone({required double volume}) async {
  final now = DateTime.now();
  if (_lastInChatToneAt != null &&
      now.difference(_lastInChatToneAt!) < const Duration(milliseconds: 450)) {
    return;
  }
  _lastInChatToneAt = now;
  final tone = await SoundPrefs.messageTone();
  if (tone == AppToneId.silent) return;
  final asset = tone.assetPath ?? 'sounds/tactical_msg.wav';
  try {
    await _ensureToneAudioContext();
    await _inChatTone.stop();
    await _inChatTone.setReleaseMode(ReleaseMode.stop);
    await _inChatTone.setVolume(volume);
    await _inChatTone.play(AssetSource(asset), volume: volume);
  } catch (e) {
    debugPrint('message tone: $e');
  }
}

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
