import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'background_radio.dart';
import 'camera_session_gate.dart';
import 'config.dart';
import 'livekit_e2ee.dart';
import 'private_call_stabilizer.dart';
import 'remote_camera_prefs.dart';
import 'video_streaming_config.dart';

/// Sesión headless: despacho «Ver cámara» sin UI de llamada.
/// Aislada de videollamadas/grupo: control remoto nunca cierra la sesión.
class RemoteCameraSession {
  RemoteCameraSession._();
  static final RemoteCameraSession instance = RemoteCameraSession._();

  ApiClient? _api;
  String? _callId;
  Room? _room;
  LocalVideoTrack? _cam;
  io.Socket? _signal;
  PrivateCallStabilizer? _stabilizer;
  EventsListener<RoomEvent>? _listener;
  Timer? _watchdog;
  bool _closing = false;
  bool _busy = false;
  bool _switchingCamera = false;
  Future<void>? _facingJob;
  CameraPosition _facing = CameraPosition.back;
  CameraPosition? _pendingFacing;
  bool _micOn = false;
  String? _lastCtrlKey;
  DateTime? _lastCtrlAt;

  bool get isActive => _callId != null && !_closing;

  String? get activeCallId => _callId;

  Future<bool> startSilent({
    required ApiClient api,
    required Map<String, dynamic> call,
  }) async {
    final callId = call['callId']?.toString() ?? '';
    if (callId.isEmpty) return false;
    if (_busy || isActive) {
      if (_callId == callId) return true;
      // Otra sesión de cámara remota distinta: no tumbar la activa.
      debugPrint('RemoteCameraSession: busy (active=$_callId, asked=$callId)');
      return false;
    }
    if (!await RemoteCameraPrefs.canAutoAccept()) return false;
    if (!CameraSessionGate.tryAcquire(CameraOwner.remoteCam)) {
      debugPrint('RemoteCameraSession: cámara ocupada por ${CameraSessionGate.owner}');
      try {
        await api.endPrivateCall(callId, reason: 'busy');
      } catch (_) {}
      return false;
    }

    _busy = true;
    _closing = false;
    _api = api;
    _callId = callId;
    _facing = CameraPosition.back;
    _pendingFacing = null;
    _micOn = false;

    try {
      final okCam = await RemoteCameraPrefs.ensureOsCameraPermission();
      if (!okCam) {
        try {
          await api.endPrivateCall(callId, reason: 'reject');
        } catch (_) {}
        await _reset();
        return false;
      }

      await BackgroundRadio.requestPermissions();
      await BackgroundRadio.setRemoteCameraActive(true);

      final data = await api.acceptPrivateCall(callId);
      final token = data['token']?.toString();
      final url = data['url']?.toString();
      final e2eeKey = data['e2eeKey']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        throw StateError('Credenciales LiveKit incompletas');
      }

      // Solo hangup en socket dedicado; el control llega por ChannelSession (una sola vía).
      _listenHangup(api, callId);

      final e2ee = await buildVoiceE2eeOptions(e2eeKey);
      final room = Room(roomOptions: streamingRoomOptions(encryption: e2ee));
      _listener = room.createListener();
      _listener!.on<DataReceivedEvent>((event) {
        unawaited(_onDataPacket(event));
      });
      await room.connect(AppConfig.publicLiveKitUrl(url), token);
      _room = room;

      await _enableCamera();
      _startWatchdog();

      _stabilizer = PrivateCallStabilizer(
        api: api,
        callId: callId,
        room: room,
        liveKitUrl: url,
        liveKitToken: token,
        peerLabel: call['callerName']?.toString() ?? 'despacho',
        isClosing: () => _closing,
        onStatus: (_) {},
        // Peer grace largo: cortes del despacho no deben matar el monitor.
        peerGrace: const Duration(seconds: 90),
        onRemoteEnd: () async {
          await stop(reason: 'remote');
        },
      );
      _stabilizer!.attach(signalSocket: _signal);

      _busy = false;
      return true;
    } catch (e, st) {
      debugPrint('RemoteCameraSession.startSilent: $e\n$st');
      try {
        await api.endPrivateCall(callId, reason: 'hangup');
      } catch (_) {}
      await _reset();
      return false;
    }
  }

  Future<void> _enableCamera() async {
    final room = _room;
    final lp = room?.localParticipant;
    if (lp == null) return;
    try {
      final pub = await lp.setCameraEnabled(
        true,
        cameraCaptureOptions: streamingCameraCapture(
          position: _facing,
        ),
      );
      if (pub?.track is LocalVideoTrack) {
        _cam = pub!.track as LocalVideoTrack;
      } else {
        for (final p in lp.videoTrackPublications) {
          if (p.track is LocalVideoTrack) {
            _cam = p.track as LocalVideoTrack;
            break;
          }
        }
      }
      debugPrint('RemoteCameraSession camera on facing=$_facing track=${_cam != null}');
    } catch (e) {
      debugPrint('RemoteCameraSession._enableCamera: $e');
    }
  }

  Future<void> _applyFacing(CameraPosition next) async {
    if (_closing) return;
    _pendingFacing = next;
    if (_facingJob != null) {
      // Coalesce: la última facing gana cuando termine el job actual.
      return _facingJob;
    }
    _facingJob = _runFacingSwitch();
    try {
      await _facingJob;
    } finally {
      _facingJob = null;
      final pending = _pendingFacing;
      if (pending != null && pending != _facing && !_closing) {
        await _applyFacing(pending);
      }
    }
  }

  Future<void> _runFacingSwitch() async {
    final next = _pendingFacing ?? _facing;
    if (_facing == next && _cam != null && !_cameraLooksDead()) {
      return;
    }
    _switchingCamera = true;
    _facing = next;
    debugPrint('RemoteCameraSession._runFacingSwitch -> $next');
    final lp = _room?.localParticipant;
    try {
      try {
        await lp?.setCameraEnabled(false);
      } catch (e) {
        debugPrint('RemoteCameraSession cam off: $e');
      }
      try {
        await _cam?.stop();
      } catch (_) {}
      _cam = null;
      await Future<void>.delayed(const Duration(milliseconds: 280));
      if (_closing) return;
      // Si llegó otra facing mientras apagábamos, úsala.
      if (_pendingFacing != null) _facing = _pendingFacing!;
      await _enableCamera();
    } catch (e) {
      // Nunca tumbar la sesión por fallo de switch.
      debugPrint('RemoteCameraSession._runFacingSwitch error: $e');
    } finally {
      _switchingCamera = false;
    }
  }

  Future<void> _applyMic(bool on) async {
    if (_micOn == on) return;
    final lp = _room?.localParticipant;
    if (lp == null) return;
    if (on) {
      var mic = await Permission.microphone.status;
      if (!mic.isGranted) {
        mic = await Permission.microphone.request();
      }
      if (!mic.isGranted) {
        debugPrint('RemoteCameraSession: sin permiso de micrófono');
        return;
      }
    }
    try {
      await lp.setMicrophoneEnabled(on);
      _micOn = on;
      await BackgroundRadio.setRemoteMicActive(on);
    } catch (e) {
      debugPrint('RemoteCameraSession.setMicrophoneEnabled: $e');
    }
  }

  Map<String, dynamic>? _asStringKeyedMap(dynamic data) {
    if (data is Map) {
      return data.map((k, v) => MapEntry(k.toString(), v));
    }
    if (data is List && data.isNotEmpty && data.first is Map) {
      return (data.first as Map).map((k, v) => MapEntry(k.toString(), v));
    }
    return null;
  }

  bool _isDuplicateControl(Map<String, dynamic> map) {
    final key =
        '${map['callId']}|${map['cmdId']}|${map['facing']}|${map['mic']}|${map['ts']}';
    final now = DateTime.now();
    if (_lastCtrlKey == key &&
        _lastCtrlAt != null &&
        now.difference(_lastCtrlAt!) < const Duration(milliseconds: 1200)) {
      return true;
    }
    _lastCtrlKey = key;
    _lastCtrlAt = now;
    return false;
  }

  /// Entrada pública (socket de ChannelSession). Fallos no detienen la sesión.
  Future<void> applyRemoteControl(dynamic data) async {
    try {
      await _onRemoteControl(data);
    } catch (e) {
      debugPrint('RemoteCameraSession.applyRemoteControl: $e');
    }
  }

  Future<void> _onRemoteControl(dynamic data) async {
    final map = _asStringKeyedMap(data);
    if (map == null) return;
    final id = map['callId']?.toString();
    if (id != null && id.isNotEmpty && id != _callId) return;
    if (_closing || _callId == null) return;
    if (_isDuplicateControl(map)) {
      debugPrint('RemoteCameraSession: control duplicado ignorado');
      return;
    }

    final facingRaw = map['facing']?.toString();
    if (facingRaw == 'front' || facingRaw == 'user') {
      await _applyFacing(CameraPosition.front);
    } else if (facingRaw == 'back' || facingRaw == 'environment') {
      await _applyFacing(CameraPosition.back);
    }
    if (map.containsKey('mic')) {
      final micVal = map['mic'];
      final on = micVal == true || micVal == 'true' || micVal == 1 || micVal == '1';
      await _applyMic(on);
    }
  }

  Future<void> _onDataPacket(DataReceivedEvent event) async {
    try {
      final raw = utf8.decode(event.data);
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      final type = decoded['type']?.toString();
      if (type != 'remote_cam_ctrl' && type != 'remote_control') return;
      await _onRemoteControl(decoded);
    } catch (e) {
      debugPrint('RemoteCameraSession data packet: $e');
    }
  }

  bool _cameraLooksDead() {
    final media = _cam?.mediaStreamTrack;
    if (media == null) return true;
    try {
      if (media.muted == true) return true;
    } catch (_) {}
    return false;
  }

  void _startWatchdog() {
    _watchdog?.cancel();
    _watchdog = Timer.periodic(const Duration(seconds: 8), (_) async {
      if (_closing || _room == null || _switchingCamera || _facingJob != null) {
        return;
      }
      if (!BackgroundRadio.remoteCameraActive) {
        await BackgroundRadio.setRemoteCameraActive(true);
      }
      if (_cameraLooksDead() ||
          _room?.connectionState == ConnectionState.disconnected) {
        try {
          await _enableCamera();
          if (_micOn) await _applyMic(true);
        } catch (_) {}
      }
    });
  }

  void _listenHangup(ApiClient api, String callId) {
    final token = api.token;
    if (token == null || token.isEmpty) return;
    try {
      _signal?.dispose();
    } catch (_) {}
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    socket.on('call:ended', (data) {
      final map = _asStringKeyedMap(data);
      final id = map?['callId']?.toString();
      if (id != null && id == callId) {
        unawaited(stop(reason: 'remote'));
      }
    });
    // No registrar call:remote_control aquí — evita doble aplicación (ChannelSession).
    socket.connect();
    _signal = socket;
  }

  Future<void> stop({String reason = 'local'}) async {
    if (_closing && _callId == null) return;
    _closing = true;
    final api = _api;
    final callId = _callId;
    final notifyServer = reason != 'remote' && api != null && callId != null;
    try {
      if (notifyServer) {
        await api.endPrivateCall(callId, reason: 'hangup');
      }
    } catch (_) {}
    await _reset();
  }

  Future<void> _reset() async {
    _watchdog?.cancel();
    _watchdog = null;
    _stabilizer?.dispose();
    _stabilizer = null;
    try {
      _listener?.dispose();
    } catch (_) {}
    _listener = null;
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(false);
    } catch (_) {}
    try {
      await _cam?.stop();
    } catch (_) {}
    _cam = null;
    try {
      await _room?.localParticipant?.setCameraEnabled(false);
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    _room = null;
    try {
      _signal?.dispose();
    } catch (_) {}
    _signal = null;
    try {
      await BackgroundRadio.setRemoteMicActive(false);
    } catch (_) {}
    try {
      await BackgroundRadio.setRemoteCameraActive(false);
    } catch (_) {}
    CameraSessionGate.release(CameraOwner.remoteCam);
    _api = null;
    _callId = null;
    _busy = false;
    _closing = false;
    _switchingCamera = false;
    _facingJob = null;
    _pendingFacing = null;
    _facing = CameraPosition.back;
    _micOn = false;
    _lastCtrlKey = null;
    _lastCtrlAt = null;
  }
}
