import 'dart:async';

import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'config.dart';

/// Estabilizador suave: deja que LiveKit reconecte; no cuelga por microcortes.
/// Tras N ciclos de grace/reconnect, abandona (onGiveUp / onRemoteEnd).
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
    this.onGiveUp,
    this.peerLabel = 'el otro usuario',
    this.peerGrace = const Duration(seconds: 45),
    this.maxPeerGraceCycles = 5,
    this.maxReconnectCycles = 6,
  });

  final ApiClient api;
  final String callId;
  final Room room;
  final String liveKitUrl;
  final String liveKitToken;
  final void Function(String status) onStatus;
  final Future<void> Function() onRemoteEnd;
  /// Si se agotan reintentos: cuelga en servidor + cierra UI.
  final Future<void> Function()? onGiveUp;
  final bool Function() isClosing;
  final String peerLabel;
  final Duration peerGrace;
  final int maxPeerGraceCycles;
  final int maxReconnectCycles;

  static const _pingEvery = Duration(seconds: 25);
  static const _reconnectDelays = [
    Duration(seconds: 3),
    Duration(seconds: 6),
    Duration(seconds: 12),
    Duration(seconds: 20),
  ];

  Timer? _peerGraceTimer;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  int _peerGraceCycles = 0;
  int _reconnectCycles = 0;
  EventsListener<RoomEvent>? _listener;
  bool _disposed = false;
  DateTime _quietUntil = DateTime.fromMillisecondsSinceEpoch(0);

  bool get _busy =>
      room.connectionState == ConnectionState.connected ||
      room.connectionState == ConnectionState.reconnecting ||
      room.connectionState == ConnectionState.connecting;

  Future<void> _abandon(String status) async {
    if (_disposed || isClosing()) return;
    onStatus(status);
    final fn = onGiveUp ?? onRemoteEnd;
    await fn();
  }

  void attach({io.Socket? signalSocket}) {
    _pingTimer = Timer.periodic(_pingEvery, (_) {
      if (_disposed || isClosing()) return;
      unawaited(_pingOrDie());
    });

    signalSocket?.onConnect((_) => _resyncFromBackend());
    signalSocket?.onReconnect((_) => _resyncFromBackend());

    final listener = room.createListener();
    _listener = listener;

    listener.on<ParticipantDisconnectedEvent>((_) => _schedulePeerGrace());
    listener.on<ParticipantConnectedEvent>((_) {
      _cancelPeerGrace();
      _reconnectAttempt = 0;
      _peerGraceCycles = 0;
      _reconnectCycles = 0;
      _quietUntil = DateTime.now().add(const Duration(seconds: 4));
    });
    listener.on<RoomReconnectingEvent>((_) {
      if (DateTime.now().isBefore(_quietUntil)) return;
      onStatus('Reconectando…');
    });
    listener.on<RoomReconnectedEvent>((_) {
      _cancelPeerGrace();
      _reconnectTimer?.cancel();
      _reconnectAttempt = 0;
      _peerGraceCycles = 0;
      _reconnectCycles = 0;
      _quietUntil = DateTime.now().add(const Duration(seconds: 6));
    });
    listener.on<RoomDisconnectedEvent>((e) {
      if (e.reason == DisconnectReason.clientInitiated ||
          e.reason == DisconnectReason.roomDeleted ||
          e.reason == DisconnectReason.duplicateIdentity) {
        return;
      }
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(milliseconds: 2500), () {
        if (_disposed || isClosing()) return;
        if (room.connectionState == ConnectionState.disconnected) {
          _scheduleReconnect();
        }
      });
    });
  }

  Future<void> _pingOrDie() async {
    try {
      await api.pingPrivateCall(callId);
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('404') ||
          msg.contains('no encontrada') ||
          msg.contains('not found') ||
          msg.contains('finalizada') ||
          msg.contains('ended')) {
        await onRemoteEnd();
      }
    }
  }

  /// true = sigue activa; false = terminada en servidor.
  Future<bool> _verifyCallActive() async {
    try {
      final data = await api.fetchPrivateCall(callId);
      final call = data['call'];
      if (call is! Map) return false;
      final status = call['status']?.toString();
      return status != null && status != 'ended';
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('404') ||
          msg.contains('no encontrada') ||
          msg.contains('not found') ||
          msg.contains('finalizada') ||
          msg.contains('ended')) {
        return false;
      }
      // Blip de red: no dar por muerta.
      return true;
    }
  }

  void _cancelPeerGrace() {
    _peerGraceTimer?.cancel();
    _peerGraceTimer = null;
  }

  void _schedulePeerGrace() {
    if (_disposed || isClosing()) return;
    _cancelPeerGrace();
    _peerGraceTimer = Timer(const Duration(seconds: 8), () {
      if (_disposed || isClosing()) return;
      if (DateTime.now().isBefore(_quietUntil)) return;
      onStatus('Reconectando con $peerLabel…');
      _peerGraceTimer = Timer(peerGrace, () async {
        if (_disposed || isClosing()) return;
        final alive = await _verifyCallActive();
        if (!alive) {
          await onRemoteEnd();
          return;
        }
        _peerGraceCycles += 1;
        if (_peerGraceCycles >= maxPeerGraceCycles) {
          await _abandon('Sin respuesta del otro usuario');
          return;
        }
        onStatus('Conexión inestable — manteniendo llamada…');
        _schedulePeerGrace();
      });
    });
  }

  void _scheduleReconnect() {
    if (_disposed || isClosing() || _busy) return;
    if (_reconnectCycles >= maxReconnectCycles) {
      unawaited(_abandon('No se pudo restaurar la conexión'));
      return;
    }
    if (_reconnectAttempt >= _reconnectDelays.length) {
      _reconnectAttempt = 0;
      _reconnectCycles += 1;
    }
    final delay = _reconnectDelays[_reconnectAttempt];
    _reconnectAttempt += 1;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () async {
      if (_disposed || isClosing() || _busy) return;
      final alive = await _verifyCallActive();
      if (!alive) {
        await onRemoteEnd();
        return;
      }
      try {
        onStatus('Restaurando enlace…');
        final fresh = await api.refreshPrivateCall(callId);
        final url = AppConfig.publicLiveKitUrl(fresh['url']?.toString() ?? liveKitUrl);
        final token = fresh['token']?.toString() ?? liveKitToken;
        if (_busy) return;
        await room.connect(url, token);
        _reconnectAttempt = 0;
        _reconnectCycles = 0;
        _quietUntil = DateTime.now().add(const Duration(seconds: 5));
        onStatus('Enlace restaurado');
      } catch (e) {
        final msg = e.toString().toLowerCase();
        if (msg.contains('404') || msg.contains('no encontrada') || msg.contains('not found')) {
          await onRemoteEnd();
          return;
        }
        _scheduleReconnect();
      }
    });
  }

  Future<void> _resyncFromBackend() async {
    if (_disposed || isClosing()) return;
    _quietUntil = DateTime.now().add(const Duration(seconds: 3));
    try {
      await api.pingPrivateCall(callId);
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('404') ||
          msg.contains('no encontrada') ||
          msg.contains('not found') ||
          msg.contains('finalizada')) {
        await onRemoteEnd();
        return;
      }
    }
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
