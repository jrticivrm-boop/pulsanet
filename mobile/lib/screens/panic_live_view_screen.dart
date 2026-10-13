import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

import '../api_client.dart';
import '../config.dart';
import '../es_msg.dart';
import '../livekit_e2ee.dart';
import '../video_streaming_config.dart';

/// Despacho: cámara + micrófono en vivo de quien envió la alerta.
class PanicLiveViewScreen extends StatefulWidget {
  const PanicLiveViewScreen({
    super.key,
    required this.api,
    required this.panicId,
    required this.name,
    this.reason,
  });

  final ApiClient api;
  final String panicId;
  final String name;
  final String? reason;

  @override
  State<PanicLiveViewScreen> createState() => _PanicLiveViewScreenState();
}

class _PanicLiveViewScreenState extends State<PanicLiveViewScreen> {
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  VideoTrack? _video;
  bool _hasAudio = false;
  bool _muted = false;
  String _facing = 'back';
  String _status = 'Conectando…';
  bool _ended = false;

  @override
  void initState() {
    super.initState();
    unawaited(_connect());
  }

  Future<void> _connect() async {
    try {
      final data = await widget.api.panicLiveView(widget.panicId);
      final e2ee = await buildVoiceE2eeOptions(
        data['e2eeKey']?.toString(),
        required: data['e2ee'] == true,
      );
      final room = Room(roomOptions: streamingRoomOptions(encryption: e2ee));
      final listener = room.createListener();
      listener
        ..on<TrackSubscribedEvent>((_) => _sync())
        ..on<TrackUnsubscribedEvent>((_) => _sync())
        ..on<ParticipantDisconnectedEvent>((_) => _sync())
        ..on<RoomDisconnectedEvent>((_) {
          if (mounted) setState(() => _status = 'Transmisión terminada');
        });
      await room.connect(AppConfig.publicLiveKitUrl(data['url'].toString()), data['token'].toString());
      if (!mounted) {
        await room.disconnect();
        return;
      }
      _room = room;
      _listener = listener;
      _sync();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _ended = true;
        _status = esMsg(e, 'No se pudo abrir la cámara');
      });
    }
  }

  void _sync() {
    final room = _room;
    if (room == null || !mounted) return;
    VideoTrack? video;
    var audio = false;
    for (final p in room.remoteParticipants.values) {
      for (final pub in p.videoTrackPublications) {
        final t = pub.track;
        if (t is VideoTrack) video ??= t;
      }
      for (final pub in p.audioTrackPublications) {
        if (pub.track != null) audio = true;
      }
    }
    setState(() {
      _video = video;
      _hasAudio = audio;
      _status = video != null
          ? 'En vivo'
          : room.remoteParticipants.isEmpty
              ? 'Esperando al dispositivo…'
              : 'Sin video (permiso de cámara denegado u ocupada)';
    });
  }

  Future<void> _sendCtrl(Map<String, dynamic> patch) async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    final payload = jsonEncode({
      'type': 'panic_live_ctrl',
      'cmdId': '${DateTime.now().millisecondsSinceEpoch}',
      ...patch,
    });
    try {
      await lp.publishData(utf8.encode(payload), reliable: true);
    } catch (_) {}
  }

  Future<void> _toggleFacing() async {
    final next = _facing == 'back' ? 'front' : 'back';
    setState(() => _facing = next);
    await _sendCtrl({'facing': next});
  }

  void _toggleMute() {
    final room = _room;
    if (room == null) return;
    _muted = !_muted;
    for (final p in room.remoteParticipants.values) {
      for (final pub in p.audioTrackPublications) {
        final t = pub.track;
        if (t is RemoteAudioTrack) {
          if (_muted) {
            unawaited(t.disable());
          } else {
            unawaited(t.enable());
          }
        }
      }
    }
    setState(() {});
  }

  @override
  void dispose() {
    try {
      _listener?.dispose();
    } catch (_) {}
    unawaited(_room?.disconnect());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final live = _video != null;
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: live
                  ? VideoTrackRenderer(_video!, fit: VideoViewFit.contain)
                  : Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!_ended)
                            const SizedBox(
                              width: 36,
                              height: 36,
                              child: CircularProgressIndicator(color: Colors.white70),
                            )
                          else
                            const Icon(Icons.videocam_off_rounded, color: Colors.white54, size: 48),
                          const SizedBox(height: 14),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              _status,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white70, fontSize: 15),
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            Positioned(
              left: 12,
              right: 12,
              top: 10,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: live ? const Color(0xFFE53935) : Colors.white24,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      live ? '● EN VIVO' : 'ALERTA',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.reason != null
                          ? '${widget.name} · ${widget.reason}'
                          : widget.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        shadows: [Shadow(blurRadius: 6, color: Colors.black)],
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Cerrar',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _RoundBtn(
                    icon: Icons.cameraswitch_rounded,
                    label: _facing == 'back' ? 'Frontal' : 'Trasera',
                    onTap: live ? _toggleFacing : null,
                  ),
                  const SizedBox(width: 22),
                  _RoundBtn(
                    icon: _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                    label: _muted ? 'Activar audio' : 'Silenciar',
                    onTap: _hasAudio ? _toggleMute : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  const _RoundBtn({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    return Opacity(
      opacity: on ? 1 : 0.4,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Material(
            color: Colors.white.withValues(alpha: 0.16),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Icon(icon, color: Colors.white, size: 26),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 12.5)),
        ],
      ),
    );
  }
}
