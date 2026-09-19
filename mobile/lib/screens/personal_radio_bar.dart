import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../audio_session_setup.dart';
import '../channel_session.dart';
import '../config.dart';
import '../livekit_e2ee.dart';
import '../private_call_stabilizer.dart';
import '../theme.dart';

/// Radio personal 1:1 — franja superior; PTT por toque (abre / libera).
class PersonalRadioBar extends StatefulWidget {
  const PersonalRadioBar({
    super.key,
    required this.api,
    required this.callId,
    required this.peerName,
    required this.token,
    required this.url,
    required this.role,
    this.e2eeKey,
    this.e2ee = false,
    required this.onClosed,
  });

  final ApiClient api;
  final String callId;
  final String peerName;
  final String token;
  final String url;
  final String role;
  final String? e2eeKey;
  /// Si el API marcó `e2ee: true`, no conectar sin clave.
  final bool e2ee;
  final VoidCallback onClosed;

  @override
  State<PersonalRadioBar> createState() => PersonalRadioBarState();
}

class PersonalRadioBarState extends State<PersonalRadioBar> {
  Room? _room;
  String _status = 'Conectando…';
  bool _ready = false;
  bool _pttOn = false;
  bool _closing = false;
  bool _busy = false;
  bool _connectFailed = false;
  io.Socket? _signalSocket;
  PrivateCallStabilizer? _stabilizer;
  EventsListener<RoomEvent>? _roomListener;

  bool get pttHeld => _pttOn;

  @override
  void initState() {
    super.initState();
    _listenSignals();
    unawaited(_connect());
  }

  void _listenSignals() {
    final token = widget.api.token;
    if (token == null || widget.callId.isEmpty) return;
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .disableAutoConnect()
          .enableForceNew()
          .build(),
    );
    socket.on('call:ended', (data) {
      if (data is! Map) return;
      if (data['callId']?.toString() == widget.callId) {
        unawaited(_close(remote: true));
      }
    });
    socket.connect();
    _signalSocket = socket;
  }

  Future<void> _connect() async {
    if (_closing) return;
    Room? room;
    try {
      if (mounted) {
        setState(() {
          _ready = false;
          _connectFailed = false;
          _status = 'Conectando…';
        });
      }

      // El canal grupal suele tener el mic ocupado → sin esto el 1:1 falla o no abre PTT.
      await ChannelSession.current?.pauseForPersonalRadio();

      final e2eeFuture = buildVoiceE2eeOptions(
        widget.e2eeKey,
        required: widget.e2ee,
      );
      await AudioSessionSetup.acquireRadio();
      final e2ee = await e2eeFuture;
      room = Room(roomOptions: RoomOptions(encryption: e2ee));
      final listener = room.createListener();
      // No cerrar por ParticipantDisconnected: caídas breves mataban el PTT del otro.
      _roomListener = listener;

      final url = AppConfig.publicLiveKitUrl(widget.url);
      await room
          .connect(url, widget.token)
          .timeout(const Duration(seconds: 20));

      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {}

      // Mic vía LiveKit (no LocalAudioTrack.create paralelo al del canal).
      await room.localParticipant?.setMicrophoneEnabled(false);

      if (!mounted) {
        await room.disconnect();
        return;
      }
      setState(() {
        _room = room;
        _ready = true;
        _connectFailed = false;
        _status = 'Listo · toca para hablar';
      });
      _stabilizer?.dispose();
      _stabilizer = PrivateCallStabilizer(
        api: widget.api,
        callId: widget.callId,
        room: room,
        liveKitUrl: widget.url,
        liveKitToken: widget.token,
        peerLabel: widget.peerName,
        isClosing: () => _closing,
        onStatus: (msg) {
          if (mounted && !_closing) setState(() => _status = msg);
        },
        onRemoteEnd: () => _close(remote: true),
      )..attach(signalSocket: _signalSocket);
    } catch (e) {
      try {
        await room?.disconnect();
      } catch (_) {}
      if (mounted) {
        setState(() {
          _room = null;
          _ready = false;
          _connectFailed = true;
          _status = 'Sin audio · toca para reintentar';
        });
      }
      debugPrint('PersonalRadioBar.connect: $e');
    }
  }

  Future<void> pttDown() => _setPtt(true);

  Future<void> pttUp() => _setPtt(false);

  Future<void> togglePtt() async {
    if (_closing || _busy) return;
    if (!_ready) {
      if (_connectFailed) await _connect();
      return;
    }
    await _setPtt(!_pttOn);
  }

  Future<void> _setPtt(bool on) async {
    if (!_ready || _closing || _busy) return;
    if (on == _pttOn) return;
    final room = _room;
    final lp = room?.localParticipant;
    if (lp == null) return;
    _busy = true;
    try {
      if (on) {
        await AudioSessionSetup.acquireVoice();
        await lp.setMicrophoneEnabled(true);
        if (mounted) {
          setState(() {
            _pttOn = true;
            _status = 'AL AIRE · toca para soltar';
          });
        }
        HapticFeedback.mediumImpact();
      } else {
        await lp.setMicrophoneEnabled(false);
        await AudioSessionSetup.acquireRadio();
        try {
          await AudioManager.instance.setSpeakerOutputPreferred(true);
        } catch (_) {}
        if (mounted) {
          setState(() {
            _pttOn = false;
            _status = 'Listo · toca para hablar';
          });
        }
        HapticFeedback.selectionClick();
      }
    } catch (e) {
      debugPrint('PersonalRadioBar.ptt: $e');
      // Si el mic del canal volvió a bloquear, liberar y reintentar una vez.
      if (on) {
        try {
          await ChannelSession.current?.pauseForPersonalRadio();
          await AudioSessionSetup.acquireVoice();
          await lp.setMicrophoneEnabled(true);
          if (mounted) {
            setState(() {
              _pttOn = true;
              _status = 'AL AIRE · toca para soltar';
            });
          }
          return;
        } catch (e2) {
          debugPrint('PersonalRadioBar.ptt.retry: $e2');
          if (mounted) {
            setState(() => _status = 'Mic ocupado · reintenta');
          }
        }
      }
    } finally {
      _busy = false;
    }
  }

  Future<void> _close({bool remote = false}) async {
    if (_closing) return;
    _closing = true;
    if (!remote) {
      try {
        await widget.api.endPrivateCall(widget.callId);
      } catch (_) {}
    }
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(false);
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    await ChannelSession.current?.resumeAfterPersonalRadio();
    await AudioSessionSetup.acquireRadio();
    if (mounted) widget.onClosed();
  }

  @override
  void dispose() {
    _stabilizer?.dispose();
    _roomListener?.dispose();
    try {
      _signalSocket?.dispose();
    } catch (_) {}
    final room = _room;
    _room = null;
    if (room != null) {
      unawaited(() async {
        try {
          await room.localParticipant?.setMicrophoneEnabled(false);
        } catch (_) {}
        try {
          await room.disconnect();
        } catch (_) {}
        await ChannelSession.current?.resumeAfterPersonalRadio();
      }());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shortName = widget.peerName.split(',').first.trim();
    return Material(
      color: Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: _pttOn
                  ? const [Color(0xFF1B5E20), Color(0xFF2E7D32)]
                  : const [Color(0xFF243528), Color(0xFF1A241C)],
            ),
            border: Border.all(
              color: _pttOn
                  ? const Color(0xFF69F0AE)
                  : kInstGold.withValues(alpha: 0.45),
              width: _pttOn ? 1.6 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.22),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: [
              const SizedBox(width: 10),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: (_pttOn ? const Color(0xFF69F0AE) : kInstGold)
                      .withValues(alpha: 0.18),
                ),
                child: Icon(
                  Icons.cell_tower_rounded,
                  size: 18,
                  color: _pttOn ? const Color(0xFF69F0AE) : kInstGoldSoft,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      shortName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: kInstOnPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      _status,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: kInstOnPrimary.withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Semantics(
                button: true,
                label: !_ready
                    ? (_connectFailed ? 'Reintentar radio' : 'Conectando')
                    : (_pttOn ? 'Soltar canal' : 'Abrir canal'),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _closing ? null : togglePtt,
                    customBorder: const CircleBorder(),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      width: 48,
                      height: 48,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: !_ready
                              ? (_connectFailed
                                  ? const [Color(0xFFC62828), Color(0xFF8E0000)]
                                  : const [Color(0xFF4A5560), Color(0xFF3A434C)])
                              : _pttOn
                                  ? const [Color(0xFF69F0AE), Color(0xFF00C853)]
                                  : const [kInstOliveMid, kInstOlive],
                        ),
                        boxShadow: _pttOn
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF69F0AE)
                                      .withValues(alpha: 0.45),
                                  blurRadius: 12,
                                  spreadRadius: 1,
                                ),
                              ]
                            : null,
                      ),
                      child: Icon(
                        !_ready
                            ? (_connectFailed
                                ? Icons.refresh_rounded
                                : Icons.hourglass_top_rounded)
                            : (_pttOn
                                ? Icons.graphic_eq_rounded
                                : Icons.mic_rounded),
                        color: _pttOn ? const Color(0xFF0C1410) : kInstOnPrimary,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Cerrar radio',
                onPressed: () => _close(),
                icon: Icon(
                  Icons.close_rounded,
                  color: kInstOnPrimary.withValues(alpha: 0.85),
                ),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
