import 'dart:async';
import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';

/// GPS continuo hacia despacho (stream + latido periódico).
/// Stream al moverse + latido cada 5 s; sigue con pantalla bloqueada vía FGS location.
class LocationHeartbeat {
  LocationHeartbeat._();

  static const interval = Duration(seconds: 5);
  static const _minSendGap = Duration(seconds: 3);
  static const _minMoveMeters = 4.0;

  static Timer? _timer;
  static StreamSubscription<Position>? _stream;
  static bool _busy = false;
  static bool _starting = false;
  static ApiClient? _api;
  static DateTime? _lastSentAt;
  static double? _lastLat;
  static double? _lastLng;
  static void Function(bool ok, double? lat, double? lng, double? accuracyM)?
      onFix;

  static bool get running => _timer != null || _stream != null;

  static Future<void> start(
    ApiClient api, {
    void Function(bool ok, double? lat, double? lng, double? accuracyM)?
        onFix,
  }) async {
    _api = api;
    if (onFix != null) LocationHeartbeat.onFix = onFix;
    if (_timer != null || _stream != null) {
      unawaited(_push());
      return;
    }
    if (_starting) return;
    _starting = true;

    try {
      var status = await Permission.locationWhenInUse.request();
      if (!status.isGranted) {
        LocationHeartbeat.onFix?.call(false, null, null, null);
        return;
      }
      // Siempre/background: necesario en algunos OEM para GPS con pantalla apagada.
      // Si el usuario niega, el FGS con tipo location aún puede mantener fixes.
      try {
        final always = await Permission.locationAlways.status;
        if (!always.isGranted) {
          await Permission.locationAlways.request();
        }
      } catch (_) {
        /* iOS/Android variantes */
      }
      final service = await Geolocator.isLocationServiceEnabled();
      if (!service) {
        LocationHeartbeat.onFix?.call(false, null, null, null);
        return;
      }
    } catch (_) {
      LocationHeartbeat.onFix?.call(false, null, null, null);
      return;
    } finally {
      _starting = false;
    }

    if (_timer != null || _stream != null) {
      unawaited(_push());
      return;
    }

    await _push();
    _startStream();
    _timer = Timer.periodic(interval, (_) => _push());
  }

  static LocationSettings _streamSettings() {
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: _minMoveMeters.round(),
        intervalDuration: const Duration(seconds: 3),
        // El FGS de radio ya notifica; no abrir un segundo servicio de Geolocator.
        forceLocationManager: false,
      );
    }
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: _minMoveMeters.round(),
        activityType: ActivityType.otherNavigation,
        pauseLocationUpdatesAutomatically: false,
        allowBackgroundLocationUpdates: true,
        showBackgroundLocationIndicator: true,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 4,
    );
  }

  static void _startStream() {
    _stream?.cancel();
    _stream = Geolocator.getPositionStream(locationSettings: _streamSettings()).listen(
      (pos) => unawaited(_send(pos, force: false)),
      onError: (_) => onFix?.call(false, null, null, null),
    );
  }

  static Future<void> _push() async {
    final api = _api;
    if (api == null || _busy) return;
    _busy = true;
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      await _send(pos, force: true);
    } catch (_) {
      onFix?.call(false, null, null, null);
    } finally {
      _busy = false;
    }
  }

  static Future<void> _send(Position pos, {required bool force}) async {
    final api = _api;
    if (api == null) return;

    final now = DateTime.now();
    if (!force && _lastSentAt != null) {
      final gap = now.difference(_lastSentAt!);
      if (gap < _minSendGap) {
        if (_lastLat != null && _lastLng != null) {
          final moved = Geolocator.distanceBetween(
            _lastLat!,
            _lastLng!,
            pos.latitude,
            pos.longitude,
          );
          if (moved < _minMoveMeters) return;
        } else {
          return;
        }
      }
    }

    try {
      await api.postLocation(
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracyM: pos.accuracy,
      );
      _lastSentAt = now;
      _lastLat = pos.latitude;
      _lastLng = pos.longitude;
      onFix?.call(true, pos.latitude, pos.longitude, pos.accuracy);
    } catch (_) {
      onFix?.call(false, null, null, null);
    }
  }

  static void stop() {
    _timer?.cancel();
    _timer = null;
    _stream?.cancel();
    _stream = null;
    _api = null;
    onFix = null;
    _starting = false;
    _busy = false;
    _lastSentAt = null;
    _lastLat = null;
    _lastLng = null;
  }
}
