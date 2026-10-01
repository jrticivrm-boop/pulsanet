import 'dart:async';
import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';

/// GPS continuo hacia despacho, adaptativo; sigue con pantalla bloqueada vía FGS location.
/// - En movimiento: alta precisión al intervalo de la organización (Admin, 5 s por defecto).
/// - Quieto ≥ 2 min: precisión media (Wi‑Fi/celda) cada 30 s y un envío cada 60 s con la
///   última posición buena. Al desplazarse ≥ 25 m vuelve a alta precisión.
/// - Pánico ([boost]): alta precisión forzada 5 min.
class LocationHeartbeat {
  LocationHeartbeat._();

  static const _minMoveMeters = 4.0;
  static const _stillRadiusM = 25.0;
  static const _stillAfter = Duration(minutes: 2);
  static const _stillInterval = Duration(seconds: 30);
  static const _keepaliveEvery = Duration(seconds: 60);
  static const _tickEvery = Duration(seconds: 15);
  static const _presenceGap = Duration(seconds: 50);
  static const _boostFor = Duration(minutes: 5);
  static const _settingsTtl = Duration(minutes: 30);
  static const _resumeMinGap = Duration(seconds: 15);

  static Timer? _timer;
  static StreamSubscription<Position>? _stream;
  static bool _busy = false;
  static bool _starting = false;
  static ApiClient? _api;
  static DateTime? _lastSentAt;
  static DateTime? _lastPresenceAt;
  static DateTime? _lastFixAt;
  static double? _lastLat;
  static double? _lastLng;
  static Position? _lastGood;

  static bool _moving = true;
  static double? _anchorLat;
  static double? _anchorLng;
  static DateTime? _lastMoveAt;
  static DateTime? _boostUntil;

  static Duration _interval = const Duration(seconds: 5);
  static double _maxAccuracyM = 50;
  static DateTime? _settingsAt;

  static void Function(bool ok, double? lat, double? lng, double? accuracyM)?
      onFix;

  static bool get running => _timer != null || _stream != null;

  static bool get _boosted =>
      _boostUntil != null && DateTime.now().isBefore(_boostUntil!);

  static Future<void> start(
    ApiClient api, {
    void Function(bool ok, double? lat, double? lng, double? accuracyM)?
        onFix,
  }) async {
    _api = api;
    if (onFix != null) LocationHeartbeat.onFix = onFix;
    if (_timer != null || _stream != null) {
      _pushIfStale();
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
      _pushIfStale();
      return;
    }

    await _loadSettings();
    _moving = true;
    _lastMoveAt = DateTime.now();
    await _push();
    _startStream();
    _timer = Timer.periodic(_tickEvery, (_) => _tick());
  }

  /// Pánico u otra urgencia: alta precisión inmediata durante [_boostFor].
  static void boost() {
    _boostUntil = DateTime.now().add(_boostFor);
    if (!running) return;
    _setMoving(true);
    unawaited(_push());
  }

  /// Reanudar/minimizar llama [start] seguido; no forzar GPS en cada cambio.
  static void _pushIfStale() {
    final last = _lastSentAt;
    if (last == null || DateTime.now().difference(last) >= _resumeMinGap) {
      unawaited(_push());
    }
  }

  static Future<void> _loadSettings() async {
    final api = _api;
    if (api == null) return;
    try {
      final gps = await api.fetchGpsSettings();
      final sec = (gps['intervalSec'] as num?)?.toInt();
      final acc = (gps['maxAccuracyM'] as num?)?.toDouble();
      if (sec != null) _interval = Duration(seconds: sec.clamp(2, 60).toInt());
      if (acc != null) _maxAccuracyM = acc.clamp(10, 200).toDouble();
      _settingsAt = DateTime.now();
    } catch (_) {
      /* defaults */
    }
  }

  static void _tick() {
    final now = DateTime.now();
    if (_settingsAt == null || now.difference(_settingsAt!) >= _settingsTtl) {
      _settingsAt = now;
      unawaited(_loadSettings().then((_) {
        if (_moving) _startStream();
      }));
    }

    if (_moving &&
        !_boosted &&
        _lastMoveAt != null &&
        now.difference(_lastMoveAt!) >= _stillAfter) {
      _setMoving(false);
    }

    // Stream sin entregar (OEM agresivo / sin señal): pedir un fix puntual.
    final silentLimit = _moving
        ? _interval * 3 + const Duration(seconds: 10)
        : _stillInterval * 3;
    if (_lastFixAt == null || now.difference(_lastFixAt!) >= silentLimit) {
      unawaited(_push());
      return;
    }

    final good = _lastGood;
    if (good != null &&
        (_lastSentAt == null ||
            now.difference(_lastSentAt!) >= _keepaliveEvery)) {
      unawaited(_send(good));
    }
  }

  static void _setMoving(bool moving) {
    if (_moving == moving) return;
    _moving = moving;
    if (moving) _lastMoveAt = DateTime.now();
    if (_stream != null) _startStream();
  }

  static LocationSettings _streamSettings() {
    final accuracy = _moving ? LocationAccuracy.high : LocationAccuracy.medium;
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: accuracy,
        // 0: entrega cada intervalo para detectar quietud; el envío lo decide _onPosition.
        distanceFilter: 0,
        intervalDuration: _moving ? _interval : _stillInterval,
        // El FGS de radio ya notifica; no abrir un segundo servicio de Geolocator.
        forceLocationManager: false,
      );
    }
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: accuracy,
        distanceFilter:
            _moving ? _minMoveMeters.round() : _stillRadiusM.round(),
        activityType: ActivityType.otherNavigation,
        pauseLocationUpdatesAutomatically: false,
        allowBackgroundLocationUpdates: true,
        showBackgroundLocationIndicator: true,
      );
    }
    return LocationSettings(
      accuracy: accuracy,
      distanceFilter: _moving ? _minMoveMeters.round() : _stillRadiusM.round(),
    );
  }

  static void _startStream() {
    _stream?.cancel();
    _stream = Geolocator.getPositionStream(locationSettings: _streamSettings()).listen(
      (pos) => _onPosition(pos),
      onError: (_) => onFix?.call(false, null, null, null),
    );
  }

  static Future<void> _push() async {
    final api = _api;
    if (api == null || _busy) return;
    _busy = true;
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: _moving ? LocationAccuracy.high : LocationAccuracy.medium,
          timeLimit: const Duration(seconds: 8),
        ),
      );
      _onPosition(pos, force: true);
    } catch (_) {
      onFix?.call(false, null, null, null);
    } finally {
      _busy = false;
    }
  }

  static bool _isGood(Position pos) =>
      pos.accuracy <= 0 || pos.accuracy <= _maxAccuracyM;

  static void _onPosition(Position pos, {bool force = false}) {
    final now = DateTime.now();
    _lastFixAt = now;
    final good = _isGood(pos);
    if (good) _lastGood = pos;

    // Movimiento real (no ruido): radio fijo o la precisión del fix, lo mayor.
    if (_anchorLat == null || _anchorLng == null) {
      if (good) {
        _anchorLat = pos.latitude;
        _anchorLng = pos.longitude;
      }
    } else {
      final fromAnchor = Geolocator.distanceBetween(
        _anchorLat!,
        _anchorLng!,
        pos.latitude,
        pos.longitude,
      );
      final threshold = pos.accuracy > _stillRadiusM ? pos.accuracy : _stillRadiusM;
      if (fromAnchor >= threshold) {
        _anchorLat = pos.latitude;
        _anchorLng = pos.longitude;
        _lastMoveAt = now;
        if (!_moving) {
          _setMoving(true);
          if (good) {
            unawaited(_send(pos));
            return;
          }
        }
      }
    }

    if (force) {
      unawaited(_send(pos));
      return;
    }
    if (!good || !_moving) return;

    final last = _lastSentAt;
    if (last != null) {
      if (now.difference(last) < _interval * 0.8) return;
      if (_lastLat != null && _lastLng != null) {
        final moved = Geolocator.distanceBetween(
          _lastLat!,
          _lastLng!,
          pos.latitude,
          pos.longitude,
        );
        if (moved < _minMoveMeters &&
            now.difference(last) < _keepaliveEvery) {
          return;
        }
      }
    }
    unawaited(_send(pos));
  }

  static Future<void> _send(Position pos) async {
    final api = _api;
    if (api == null) return;
    final now = DateTime.now();
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
      // Refuerzo presencia mientras el FGS de ubicación sigue vivo.
      if (_lastPresenceAt == null ||
          now.difference(_lastPresenceAt!) >= _presenceGap) {
        _lastPresenceAt = now;
        unawaited(
          api.presenceHeartbeat(
            // FGS de ubicación: solo focus=service (UI usa socket presence:ping).
            focus: 'service',
          ),
        );
      }
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
    _lastPresenceAt = null;
    _lastFixAt = null;
    _lastLat = null;
    _lastLng = null;
    _lastGood = null;
    _moving = true;
    _anchorLat = null;
    _anchorLng = null;
    _lastMoveAt = null;
    _boostUntil = null;
    _settingsAt = null;
  }
}
