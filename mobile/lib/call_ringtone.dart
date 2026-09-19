import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'ringer_mode.dart';
import 'sound_prefs.dart';

const _notifyChannel = MethodChannel('com.tacticalptx.app/notifications');

enum CallRingKind { voice, video }

/// Timbre entrante + ringback saliente.
///
/// - [AppToneId.system]: Ringtone / ToneGenerator nativo (Android).
/// - Assets: loop con AudioPlayer (mismo wav que notificaciones).
/// - [AppToneId.silent]: sin audio (sí vibra si el teléfono no está en silencio).
class CallRingtone {
  CallRingtone._();

  static bool _active = false;
  static bool _outgoingActive = false;
  static AudioPlayer? _assetPlayer;

  static bool get isActive => _active;
  static bool get isOutgoingActive => _outgoingActive;

  static Future<void> start({CallRingKind kind = CallRingKind.voice}) async {
    if (kIsWeb) return;
    final tone = kind == CallRingKind.video
        ? await SoundPrefs.videoTone()
        : await SoundPrefs.callTone();

    await stopOutgoing();
    await _stopAssetLoop();

    if (tone == AppToneId.silent) {
      _active = true;
      final ringer = await readPhoneRingerMode();
      if (ringer != PhoneRingerMode.silent) {
        // ignore: unawaited_futures
        _fallbackBuzz();
      }
      return;
    }

    if (tone == AppToneId.system) {
      try {
        final mode =
            await _notifyChannel.invokeMethod<String>('startCallRingtone');
        _active = true;
        debugPrint('CallRingtone.start system → $mode');
      } catch (e) {
        debugPrint('CallRingtone.start system fallback: $e');
        final ringer = await readPhoneRingerMode();
        if (ringer == PhoneRingerMode.silent) return;
        _active = true;
        // ignore: unawaited_futures
        _fallbackBuzz();
      }
      return;
    }

    final asset = tone.assetPath;
    if (asset == null) return;
    final ringer = await readPhoneRingerMode();
    if (ringer == PhoneRingerMode.silent) {
      _active = true;
      return;
    }
    _active = true;
    try {
      _assetPlayer ??= AudioPlayer();
      await _assetPlayer!.setReleaseMode(ReleaseMode.loop);
      await _assetPlayer!.setVolume(0.9);
      await _assetPlayer!.play(AssetSource(asset), volume: 0.9);
      if (ringer == PhoneRingerMode.vibrate) {
        // ignore: unawaited_futures
        _fallbackBuzz();
      }
    } catch (e) {
      debugPrint('CallRingtone.asset: $e');
      // ignore: unawaited_futures
      _fallbackBuzz();
    }
  }

  static Future<void> stop() async {
    _active = false;
    await _stopAssetLoop();
    if (kIsWeb) return;
    try {
      await _notifyChannel.invokeMethod<void>('stopCallRingtone');
    } catch (e) {
      debugPrint('CallRingtone.stop: $e');
    }
  }

  static Future<void> startOutgoing({int maxRings = 5}) async {
    if (kIsWeb) return;
    try {
      await stop();
      await _notifyChannel.invokeMethod<void>(
        'startOutgoingRingback',
        {'maxRings': maxRings},
      );
      _outgoingActive = true;
      debugPrint('CallRingtone.startOutgoing max=$maxRings');
    } catch (e) {
      debugPrint('CallRingtone.startOutgoing: $e');
      _outgoingActive = false;
    }
  }

  static Future<void> stopOutgoing() async {
    _outgoingActive = false;
    if (kIsWeb) return;
    try {
      await _notifyChannel.invokeMethod<void>('stopOutgoingRingback');
    } catch (e) {
      debugPrint('CallRingtone.stopOutgoing: $e');
    }
  }

  static Future<void> stopAll() async {
    await stop();
    await stopOutgoing();
  }

  static Future<void> _stopAssetLoop() async {
    try {
      await _assetPlayer?.stop();
    } catch (_) {}
  }

  static Future<void> _fallbackBuzz() async {
    while (_active) {
      try {
        await HapticFeedback.heavyImpact();
      } catch (_) {}
      await Future<void>.delayed(const Duration(milliseconds: 900));
    }
  }
}
