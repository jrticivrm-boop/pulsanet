import 'dart:async';

import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'config.dart';

/// Estabilizador virtual: mantiene llamadas voz/radio/video ante caídas breves.
class PrivateCallStabilizer {
  PrivateCallStabilizer({
    required this.api,
    required this.callId,
    required this.room,
    required this.liveKitUrl,
    required this.liveKitToken,
    required this.onStatus,
    required this.onRemoteEnd,
    required this.isClosing,
    this.peerLabel = 'el otro usuario',
  });

  final ApiClient api;
  final String callId;
  final Room room;
  final String liveKitUrl;
  final String liveKitToken;
  final void Function(String status) onStatus;
  final Future<void> Function() onRemoteEnd;
  final bool Function() isClosing;
  final String peerLabel;

  static const _peerGrace = Duration(seconds: 28);
  static const _pingEvery = Duration(seconds: 15);
  static const _reconnectDelays = [
    Duration(milliseconds: 400),
    Duration(milliseconds: 800),
    Duration(milliseconds: 1600),
    Duration(milliseconds: 3200),
    Duration(milliseconds: 6000),
    Duration(seconds: 10),
  ];

  Timer? _peerGraceTimer;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  EventsListener<RoomEvent>? _listener;
  bool _disposed = false;

  void attach({io.Socket? signalSocket}) {
    _pingTimer = Timer.periodic(_pingEvery, (_) {
      if (_disposed || isClosing()) return;
      unawaited(api.pingPrivateCall(callId).catchError((_) => <String, dynamic>{}));
    });

    signalSocket?.onConnect((_) => _resyncFromBackend());
    signalSocket?.onReconnect((_) => _resyncFromBackend());

    final listener = room.createListener();
    _listener = listener;

    listener.on<ParticipantDisconnectedEvent>((_) => _schedulePeerGrace());
    listener.on<ParticipantConnectedEvent>((_) {
      _cancelPeerGrace();
      _reconnectAttempt = 0;
      onStatus('En llamada');
    });
    listener.on<RoomReconnectingEvent>((_) => onStatus('Reconectando…'));
    listener.on<RoomReconnectedEvent>((_) {
      _cancelPeerGrace();
      _reconnectAttempt = 0;
      onStatus('Conexión restaurada');
    });
    listener.on<RoomDisconnectedEvent>((_) => _scheduleReconnect());
  }

  Future<bool> _verifyCallActive() async {
    try {
      final data = await api.fetchPrivateCall(callId);
      final call = data['call'];
      if (call is! Map) return false;
      final status = call['status']?.toString();
      return status != null && status != 'ended';
    } catch (_) {
      return false;
    }
  }

  void _cancelPeerGrace() {
    _peerGraceTimer?.cancel();
    _peerGraceTimer = null;
  }

  void _schedulePeerGrace() {
    if (_disposed || isClosing()) return;
    _cancelPeerGrace();
    onStatus('Reconectando con $peerLabel…');
    _peerGraceTimer = Timer(_peerGrace, () async {
      if (_disposed || isClosing()) return;
      final alive = await _verifyCallActive();
      if (!alive) {
        await onRemoteEnd();
        return;
      }
      onStatus('Conexión inestable — manteniendo llamada…');
      _schedulePeerGrace();
    });
  }

  void _scheduleReconnect() {
    if (_disposed || isClosing()) return;
    if (_reconnectAttempt >= _reconnectDelays.length) {
      _reconnectAttempt = 0;
    }
    final delay = _reconnectDelays[_reconnectAttempt];
    _reconnectAttempt += 1;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () async {
      if (_disposed || isClosing()) return;
      final alive = await _verifyCallActive();
      if (!alive) {
        await onRemoteEnd();
        return;
      }
      try {
        onStatus('Restaurando audio y video…');
        final fresh = await api.refreshPrivateCall(callId);
        final url = AppConfig.publicLiveKitUrl(fresh['url']?.toString() ?? liveKitUrl);
        final token = fresh['token']?.toString() ?? liveKitToken;
        if (room.connectionState == ConnectionState.connected) return;
        await room.connect(url, token);
        _reconnectAttempt = 0;
        onStatus('Conexión restaurada');
      } catch (_) {
        _scheduleReconnect();
      }
    });
  }

  Future<void> _resyncFromBackend() async {
    if (_disposed || isClosing()) return;
    final alive = await _verifyCallActive();
    if (!alive) {
      await onRemoteEnd();
      return;
    }
    try {
      await api.pingPrivateCall(callId);
    } catch (_) {}
    if (room.connectionState == ConnectionState.disconnected) {
      _scheduleReconnect();
    }
  }

  void dispose() {
    _disposed = true;
    _cancelPeerGrace();
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _listener?.dispose();
    _listener = null;
  }
}
