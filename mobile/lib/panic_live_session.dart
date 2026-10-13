import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';
import 'audio_session_setup.dart';
import 'background_radio.dart';
import 'camera_session_gate.dart';
import 'config.dart';
import 'livekit_e2ee.dart';
import 'video_streaming_config.dart';

/// Al enviar una alerta, el teléfono transmite cámara (trasera) + micrófono para que
/// despacho con alcance vea la situación. Sin UI de llamada; el emisor no la detiene:
/// termina al resolver/cancelar la alerta o a los 15 min.
class PanicLiveSession extends ChangeNotifier {
  PanicLiveSession._();
  static final PanicLiveSession instance = PanicLiveSession._();

  ApiClient? _api;
  String? _panicId;
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  Timer? _expiry;
  Timer? _watchdog;
  DateTime? _expiresAt;
  CameraPosition _facing = CameraPosition.back;
  bool _micOn = false;
  bool _starting = false;
  bool _closing = false;
  bool _hasCamera = false;

  bool get isActive => _panicId != null && !_closing;
  String? get panicId => _panicId;
  DateTime? get expiresAt => _expiresAt;
  bool get hasCamera => _hasCamera;

  /// Pide cámara y micrófono antes de enviar. La alerta se envía aunque los rechace.
  static Future<void> requestPermissions() async {
    try {
      await [Permission.camera, Permission.microphone].request();
    } catch (e) {
      debugPrint('PanicLiveSession.requestPermissions: $e');
    }
  }

  Future<void> start({required ApiClient api, required String panicId}) async {
    if (panicId.isEmpty || _starting) return;
    if (_panicId == panicId && _room != null) return;
    if (isActive && _panicId != panicId) await stop();
    _starting = true;
    _closing = false;
    _api = api;
    _panicId = panicId;
    _facing = CameraPosition.back;
    if (_expiry == null) {
      _expiresAt = DateTime.now().add(const Duration(minutes: 15));
      _expiry = Timer(const Duration(minutes: 15), () => unawaited(stop()));
    }
    notifyListeners();
    try {
      final data = await api.panicLivePublish(panicId);
      final token = data['token']?.toString();
      final url = data['url']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        throw StateError('Credenciales de transmisión incompletas');
      }
      final exp = (data['expiresAt'] as num?)?.toInt();
      _expiresAt = exp != null
          ? DateTime.fromMillisecondsSinceEpoch(exp)
          : DateTime.now().add(const Duration(minutes: 15));
      final left = _expiresAt!.difference(DateTime.now());
      _expiry?.cancel();
      _expiry = Timer(left.isNegative ? Duration.zero : left, () {
        unawaited(stop());
      });

      await BackgroundRadio.requestPermissions();

      final e2ee = await buildVoiceE2eeOptions(
        data['e2eeKey']?.toString(),
        required: data['e2ee'] == true,
      );
      final room = Room(roomOptions: streamingRoomOptions(encryption: e2ee));
      _listener = room.createListener();
      _listener!.on<DataReceivedEvent>((event) {
        unawaited(_onDataPacket(event));
      });
      await room.connect(AppConfig.publicLiveKitUrl(url), token);
      if (_closing || _panicId != panicId) {
        await room.disconnect();
        return;
      }
      _room = room;

      await _enableCamera();
      await _enableMic(true);
      _startWatchdog();
    } catch (e, st) {
      debugPrint('PanicLiveSession.start: $e\n$st');
      final msg = e.toString();
      final gone = msg.contains('no disponible') || msg.contains('404');
      final expired = _expiresAt != null && DateTime.now().isAfter(_expiresAt!);
      if (gone || expired) {
        await _reset();
      } else {
        // Sin red / API reiniciando: reintenta el watchdog hasta el tope de 15 min.
        await _reset(keepIdentity: true);
        _startWatchdog();
      }
    } finally {
      _starting = false;
      notifyListeners();
    }
  }

  Future<void> _enableCamera() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    if (!(await Permission.camera.status).isGranted) return;
    if (!CameraSessionGate.tryAcquire(CameraOwner.panicLive)) {
      debugPrint('PanicLiveSession: cámara ocupada por ${CameraSessionGate.owner}');
      return;
    }
    try {
      await BackgroundRadio.setRemoteCameraActive(true);
      await lp.setCameraEnabled(
        true,
        cameraCaptureOptions: streamingCameraCapture(position: _facing),
      );
      _hasCamera = true;
    } catch (e) {
      debugPrint('PanicLiveSession camera: $e');
    }
  }

  Future<void> _enableMic(bool on) async {
    final lp = _room?.localParticipant;
    if (lp == null || _micOn == on) return;
    if (on && !(await Permission.microphone.status).isGranted) return;
    try {
      if (on) await AudioSessionSetup.acquireVoice();
      await lp.setMicrophoneEnabled(on);
      _micOn = on;
      await BackgroundRadio.setRemoteMicActive(on);
    } catch (e) {
      debugPrint('PanicLiveSession mic: $e');
    }
  }

  Future<void> _switchFacing(CameraPosition next) async {
    if (_facing == next || _room == null) return;
    _facing = next;
    final lp = _room?.localParticipant;
    try {
      await lp?.setCameraEnabled(false);
      await Future<void>.delayed(const Duration(milliseconds: 280));
      await lp?.setCameraEnabled(
        true,
        cameraCaptureOptions: streamingCameraCapture(position: _facing),
      );
    } catch (e) {
      debugPrint('PanicLiveSession facing: $e');
    }
  }

  /// Despacho puede cambiar de cámara (y apagar/encender el mic) con el mismo
  /// paquete `remote_cam_ctrl` que usa «Ver cámara».
  Future<void> _onDataPacket(DataReceivedEvent event) async {
    try {
      final decoded = jsonDecode(utf8.decode(event.data));
      if (decoded is! Map) return;
      final type = decoded['type']?.toString();
      if (type != 'remote_cam_ctrl' && type != 'panic_live_ctrl') return;
      final facing = decoded['facing']?.toString();
      if (facing == 'front' || facing == 'user') {
        await _switchFacing(CameraPosition.front);
      } else if (facing == 'back' || facing == 'environment') {
        await _switchFacing(CameraPosition.back);
      }
      if (decoded.containsKey('mic')) {
        final v = decoded['mic'];
        await _enableMic(v == true || v == 'true' || v == 1);
      }
    } catch (e) {
      debugPrint('PanicLiveSession data: $e');
    }
  }

  void _startWatchdog() {
    _watchdog?.cancel();
    _watchdog = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (_closing || _panicId == null) return;
      final room = _room;
      if (room == null || room.connectionState == ConnectionState.disconnected) {
        final api = _api;
        final id = _panicId;
        if (api == null || id == null) return;
        await _reset(keepIdentity: true);
        await start(api: api, panicId: id);
        return;
      }
      if (_hasCamera && !BackgroundRadio.remoteCameraActive) {
        await BackgroundRadio.setRemoteCameraActive(true);
      }
    });
  }

  /// `panic:live_end` del servidor o fin de la alerta.
  Future<void> stopFor(String? panicId) async {
    if (panicId == null || panicId == _panicId) await stop();
  }

  Future<void> stop() async {
    if (_panicId == null && _room == null) return;
    _closing = true;
    await _reset();
  }

  Future<void> _reset({bool keepIdentity = false}) async {
    _watchdog?.cancel();
    _watchdog = null;
    if (!keepIdentity) {
      _expiry?.cancel();
      _expiry = null;
    }
    try {
      _listener?.dispose();
    } catch (_) {}
    _listener = null;
    final room = _room;
    _room = null;
    try {
      await room?.localParticipant?.setMicrophoneEnabled(false);
    } catch (_) {}
    try {
      await room?.localParticipant?.setCameraEnabled(false);
    } catch (_) {}
    try {
      await room?.disconnect();
    } catch (_) {}
    if (_micOn) {
      try {
        await BackgroundRadio.setRemoteMicActive(false);
      } catch (_) {}
      await AudioSessionSetup.downgradeFromVoice();
    }
    if (_hasCamera) {
      try {
        await BackgroundRadio.setRemoteCameraActive(false);
      } catch (_) {}
    }
    CameraSessionGate.release(CameraOwner.panicLive);
    _micOn = false;
    _hasCamera = false;
    if (!keepIdentity) {
      _panicId = null;
      _api = null;
      _expiresAt = null;
    }
    _closing = false;
    notifyListeners();
  }
}
