import 'dart:async';

import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../audio_session_setup.dart';
import '../config.dart';
import '../es_msg.dart';
import '../livekit_e2ee.dart';
import '../theme.dart';
import '../video_streaming_config.dart';

/// Transmisión de video grupal (sala LiveKit `gvid_*`, paralela al PTT).
class GroupVideoScreen extends StatefulWidget {
  const GroupVideoScreen({
    super.key,
    required this.api,
    required this.groupId,
    required this.groupName,
    this.startIfNeeded = true,
  });

  final ApiClient api;
  final String groupId;
  final String groupName;

  /// Si true, inicia la sesión cuando no hay una activa.
  final bool startIfNeeded;

  static bool uiOpen = false;

  static Route<void> route({required GroupVideoScreen child}) {
    return PageRouteBuilder<void>(
      opaque: false,
      barrierDismissible: false,
      pageBuilder: (_, __, ___) => child,
      transitionsBuilder: (_, animation, __, child) {
        return FadeTransition(opacity: animation, child: child);
      },
    );
  }

  @override
  State<GroupVideoScreen> createState() => _GroupVideoScreenState();
}

class _RemoteTile {
  _RemoteTile({required this.sid, required this.name, this.track});

  final String sid;
  final String name;
  VideoTrack? track;
}

class _GroupVideoScreenState extends State<GroupVideoScreen> {
  Room? _room;
  LocalAudioTrack? _mic;
  LocalVideoTrack? _cam;
  String _status = 'Conectando…';
  bool _muted = false;
  bool _canPublishAudio = true;
  bool _cameraOn = false;
  bool _closing = false;
  CameraPosition _cameraPosition = CameraPosition.front;
  int _participantCount = 0;
  io.Socket? _signalSocket;
  EventsListener<RoomEvent>? _roomListener;
  Timer? _pingTimer;
  final List<_RemoteTile> _remotes = [];

  @override
  void initState() {
    super.initState();
    GroupVideoScreen.uiOpen = true;
    _listenSocket();
    _connect();
  }

  void _listenSocket() {
    final token = widget.api.token;
    if (token == null) return;
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    socket.on('group:video_ended', (data) {
      if (data is! Map) return;
      if (data['groupId']?.toString() != widget.groupId) return;
      _leaveLocal(notifyServer: false);
    });
    socket.connect();
    _signalSocket = socket;
  }

  Future<void> _connect() async {
    Room? room;
    LocalAudioTrack? mic;
    try {
      Map<String, dynamic> data;
      if (widget.startIfNeeded) {
        final status = await widget.api.fetchGroupVideoStatus(widget.groupId);
        if (status['active'] == true) {
          data = await widget.api.joinGroupVideo(widget.groupId);
        } else {
          data = await widget.api.startGroupVideo(widget.groupId);
        }
      } else {
        data = await widget.api.joinGroupVideo(widget.groupId);
      }

      final e2ee = await buildVoiceE2eeOptions(
        data['e2eeKey']?.toString(),
        required: data['e2ee'] == true,
      );
      room = Room(roomOptions: streamingRoomOptions(encryption: e2ee));
      final listener = room.createListener();
      listener.on<TrackSubscribedEvent>((e) {
        if (e.track is VideoTrack) _syncRemotes();
      });
      listener.on<TrackUnsubscribedEvent>((e) {
        if (e.track is VideoTrack) _syncRemotes();
      });
      listener.on<ParticipantConnectedEvent>((_) => _syncRemotes());
      listener.on<ParticipantDisconnectedEvent>((_) => _syncRemotes());
      _roomListener = listener;

      await room.connect(
        AppConfig.publicLiveKitUrl(data['url']?.toString() ?? ''),
        data['token']?.toString() ?? '',
      );

      // Solo escucha: imagen sí, micrófono no.
      final audioAllowed = data['canPublishAudio'] != false &&
          data['memberRole']?.toString() != 'listen_only';

      if (audioAllowed) {
        await AudioSessionSetup.acquireVoice();
        mic = await LocalAudioTrack.create(
          const AudioCaptureOptions(
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            stopAudioCaptureOnMute: false,
          ),
        );
        await room.localParticipant?.publishAudioTrack(mic);
      }

      await _enableCamera(room);

      if (!mounted) {
        await _cam?.stop();
        await mic?.stop();
        await room.disconnect();
        return;
      }

      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
        widget.api.pingGroupVideo(widget.groupId).catchError((_) {});
      });

      final session = data['session'];
      setState(() {
        _room = room;
        _mic = mic;
        _canPublishAudio = audioAllowed;
        _muted = !audioAllowed;
        _participantCount = session is Map ? (session['participantCount'] as int? ?? 1) : 1;
        _status = audioAllowed
            ? 'Transmisión · ${widget.groupName}'
            : 'Transmisión · ${widget.groupName} · solo imagen';
      });
      _syncRemotes();
    } catch (e) {
      if (mounted) {
        setState(() => _status = esMsg(e, 'No se pudo conectar'));
      }
      await Future<void>.delayed(const Duration(seconds: 2));
      if (mounted) Navigator.of(context).pop();
    }
  }

  void _syncRemotes() {
    final room = _room;
    if (room == null || !mounted) return;
    final next = <_RemoteTile>[];
    for (final p in room.remoteParticipants.values) {
      VideoTrack? track;
      for (final pub in p.videoTrackPublications) {
        if (pub.track is VideoTrack) {
          track = pub.track as VideoTrack;
          break;
        }
      }
      next.add(_RemoteTile(
        sid: p.sid,
        name: p.name.isNotEmpty ? p.name : (p.identity),
        track: track,
      ));
    }
    setState(() {
      _remotes
        ..clear()
        ..addAll(next);
      _participantCount = room.remoteParticipants.length + 1;
    });
  }

  Future<bool> _ensureCameraPermission() async {
    final status = await Permission.camera.request();
    return status.isGranted;
  }

  Future<void> _enableCamera([Room? roomOverride]) async {
    final room = roomOverride ?? _room;
    if (room == null) return;
    if (!await _ensureCameraPermission()) {
      if (mounted) setState(() => _status = 'Permiso de cámara denegado');
      return;
    }
    try {
      final lp = room.localParticipant;
      if (lp == null) return;
      final pub = await lp.setCameraEnabled(true, cameraCaptureOptions: streamingCameraCapture(position: _cameraPosition));
      _cam = pub?.track is LocalVideoTrack ? pub!.track as LocalVideoTrack : _cam;
      if (mounted) setState(() => _cameraOn = _cam != null);
    } catch (e) {
      if (mounted) setState(() => _status = esMsg(e, 'No se pudo activar cámara'));
    }
  }

  Future<void> _disableCamera() async {
    final lp = _room?.localParticipant;
    try {
      if (lp != null) {
        await lp.setCameraEnabled(
          false,
          cameraCaptureOptions: const CameraCaptureOptions(stopCameraCaptureOnMute: true),
        );
      }
    } catch (_) {}
    try {
      await _cam?.stop();
    } catch (_) {}
    _cam = null;
    if (mounted) setState(() => _cameraOn = false);
  }

  Future<void> _toggleCamera() async {
    if (_cameraOn) {
      await _disableCamera();
    } else {
      await _enableCamera();
    }
  }

  Future<void> _flipCamera() async {
    if (!_cameraOn) return;
    final cam = _cam;
    if (cam == null) return;
    final next = _cameraPosition == CameraPosition.front
        ? CameraPosition.back
        : CameraPosition.front;
    try {
      await cam.setCameraPosition(next);
      if (mounted) setState(() => _cameraPosition = next);
    } catch (e) {
      if (mounted) setState(() => _status = esMsg(e, 'No se pudo cambiar de cámara'));
    }
  }

  Future<void> _toggleMute() async {
    if (!_canPublishAudio) return;
    final mic = _mic;
    if (mic == null) return;
    try {
      if (_muted) {
        await mic.unmute();
      } else {
        await mic.mute();
      }
      if (mounted) setState(() => _muted = !_muted);
    } catch (_) {}
  }

  Future<void> _leaveLocal({bool notifyServer = true}) async {
    if (_closing) return;
    _closing = true;
    _pingTimer?.cancel();
    if (notifyServer) {
      try {
        await widget.api.leaveGroupVideo(widget.groupId);
      } catch (_) {}
    }
    try {
      await _disableCamera();
    } catch (_) {}
    try {
      await _mic?.stop();
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    // Salir del modo voz: si no, el sistema sigue «en llamada» y otras apps
    // (WhatsApp) no pueden grabar con el micrófono.
    await AudioSessionSetup.downgradeFromVoice();
    await AudioSessionSetup.resetRouting();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _endBroadcast() async {
    try {
      await widget.api.endGroupVideo(widget.groupId);
    } catch (_) {}
    await _leaveLocal(notifyServer: false);
  }

  @override
  void dispose() {
    GroupVideoScreen.uiOpen = false;
    _pingTimer?.cancel();
    _roomListener?.dispose();
    _signalSocket?.dispose();
    _cam?.stop();
    _mic?.stop();
    _room?.disconnect();
    super.dispose();
  }

  Widget _videoTile({required Widget child, String? label}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: Colors.black.withValues(alpha: 0.4), child: child),
          if (label != null && label.isNotEmpty)
            Positioned(
              left: 8,
              bottom: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  label,
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildGrid() {
    final tiles = <Widget>[];
    for (final r in _remotes) {
      tiles.add(
        _videoTile(
          label: r.name,
          child: r.track != null
              ? VideoTrackRenderer(r.track!, fit: VideoViewFit.cover)
              : Center(
                  child: Text(
                    r.name.isNotEmpty ? r.name[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white54, fontSize: 28),
                  ),
                ),
        ),
      );
    }
    if (_cam != null && _cameraOn) {
      tiles.add(
        _videoTile(
          label: 'Tú',
          child: VideoTrackRenderer(
            _cam!,
            fit: VideoViewFit.cover,
            mirrorMode: _cameraPosition == CameraPosition.front
                ? VideoViewMirrorMode.mirror
                : VideoViewMirrorMode.off,
          ),
        ),
      );
    }
    if (tiles.isEmpty) {
      return Center(
        child: Text(
          'Esperando participantes…',
          style: TextStyle(color: kInstOnPrimary.withValues(alpha: 0.7)),
        ),
      );
    }
    final crossCount = tiles.length <= 1 ? 1 : 2;
    return GridView.count(
      crossAxisCount: crossCount,
      padding: const EdgeInsets.all(12),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      children: tiles,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kInstCallBg.withValues(alpha: 0.96),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 4),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'EN VIVO',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.groupName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: kInstOnPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          '$_status · $_participantCount en transmisión',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: kInstOnPrimary.withValues(alpha: 0.65),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _leaveLocal,
                    icon: const Icon(Icons.close, color: kInstOnPrimary),
                  ),
                ],
              ),
            ),
            Expanded(child: _buildGrid()),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: kInstOnPrimary.withValues(alpha: 0.08)),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _ctrl(
                    icon: (!_canPublishAudio || _muted)
                        ? Icons.mic_off_rounded
                        : Icons.mic_rounded,
                    label: !_canPublishAudio
                        ? 'Sin mic'
                        : (_muted ? 'Mic off' : 'Mic'),
                    onTap: _canPublishAudio ? _toggleMute : () {},
                    active: _canPublishAudio && !_muted,
                  ),
                  _ctrl(
                    icon: _cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
                    label: _cameraOn ? 'Cámara' : 'Sin cam',
                    onTap: _toggleCamera,
                    active: _cameraOn,
                  ),
                  if (_cameraOn)
                    _ctrl(
                      icon: Icons.cameraswitch_outlined,
                      label: _cameraPosition == CameraPosition.front ? 'Trasera' : 'Frontal',
                      onTap: _flipCamera,
                      active: true,
                    ),
                  _ctrl(
                    icon: Icons.call_end_rounded,
                    label: 'Salir',
                    onTap: _leaveLocal,
                    danger: true,
                  ),
                  _ctrl(
                    icon: Icons.stop_circle_outlined,
                    label: 'Terminar',
                    onTap: _endBroadcast,
                    danger: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ctrl({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool active = true,
    bool danger = false,
  }) {
    final bg = danger
        ? Colors.redAccent.withValues(alpha: 0.85)
        : (active ? kInstOlive.withValues(alpha: 0.35) : Colors.white12);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
              child: Icon(icon, color: kInstOnPrimary),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(color: kInstOnPrimary.withValues(alpha: 0.75), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
