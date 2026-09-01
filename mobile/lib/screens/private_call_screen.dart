import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../audio_session_setup.dart';
import '../channel_session.dart';
import '../config.dart';
import '../es_msg.dart';
import '../livekit_e2ee.dart';
import '../chat_message_banner.dart';
import '../theme.dart';
import '../widgets/user_avatar.dart';

/// Pantalla de llamada / radio privada 1:1 (controles tipo teléfono / WhatsApp).
class PrivateCallScreen extends StatefulWidget {
  const PrivateCallScreen({
    super.key,
    required this.api,
    required this.callId,
    required this.peerName,
    required this.token,
    required this.url,
    required this.role,
    this.peerId,
    this.e2eeKey,
    this.mode = 'call',
  });

  final ApiClient api;
  final String callId;
  final String peerName;
  final String? peerId;
  final String token;
  final String url;
  final String role;
  final String? e2eeKey;

  /// `call` = full-duplex; `radio` = PTT (mic mute hasta mantener).
  final String mode;

  /// true mientras la UI de llamada está montada (minimizada o completa).
  static bool uiOpen = false;

  /// Ruta semi-transparente para poder minimizar sin cortar la llamada.
  static Route<void> route({required PrivateCallScreen child}) {
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
  State<PrivateCallScreen> createState() => _PrivateCallScreenState();
}

class _PrivateCallScreenState extends State<PrivateCallScreen> {
  Room? _room;
  LocalAudioTrack? _mic;
  String _status = 'Conectando…';
  bool _muted = false;
  bool _minimized = false;
  bool _speakerOn = true;
  bool _listenMuted = false;
  bool _pttHeld = false;
  bool _connected = false;
  bool _closing = false;
  bool _showKeypad = false;
  String _keypadBuffer = '';
  io.Socket? _signalSocket;
  EventsListener<RoomEvent>? _roomListener;
  Timer? _tick;
  DateTime? _connectedAt;
  Duration _elapsed = Duration.zero;
  void Function(ChatMessageBannerPayload)? _bannerTapPrev;

  bool get _isRadio => widget.mode == 'radio';

  @override
  void initState() {
    super.initState();
    PrivateCallScreen.uiOpen = true;
    _bannerTapPrev = ChatMessageBanner.instance.onTap;
    ChatMessageBanner.instance.onTap = _onBannerTap;
    _listenRemoteHangup();
    _connect();
  }

  void _onBannerTap(ChatMessageBannerPayload p) {
    final peerId = p.peerId;
    if (peerId != null &&
        peerId.isNotEmpty &&
        (widget.peerId == null || peerId == widget.peerId)) {
      // ignore: unawaited_futures
      _openMessageSheet();
      return;
    }
    _bannerTapPrev?.call(p);
  }

  void _listenRemoteHangup() {
    final token = widget.api.token;
    if (token == null || widget.callId.isEmpty) return;
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    socket.on('call:ended', (data) {
      if (data is! Map) return;
      final id = data['callId']?.toString();
      if (id != null && id == widget.callId) {
        _closeFromRemote(reason: data['reason']?.toString() ?? 'hangup');
      }
    });
    socket.on('call:accepted', (data) {
      if (data is! Map || !mounted) return;
      final id = data['callId']?.toString();
      if (id == widget.callId && widget.role == 'caller') {
        _markConnected();
        setState(() {
          _status = _isRadio
              ? 'Radio con ${widget.peerName}'
              : 'En llamada';
        });
      }
    });
    socket.on('dm:notify', (data) {
      if (data is! Map || !mounted || _closing) return;
      final m = Map<String, dynamic>.from(data);
      final peerId = m['peerId']?.toString();
      final peerName = m['peerName']?.toString() ?? 'Mensaje';
      final message = m['message'];
      final preview = _previewFromDmNotify(message);
      ChatMessageBanner.instance.show(
        kind: 'dm',
        peerId: peerId,
        title: peerName,
        preview: preview,
        playTone: true,
      );
    });
    socket.connect();
    _signalSocket = socket;
  }

  String _previewFromDmNotify(dynamic message) {
    if (message is! Map) return 'Nuevo mensaje';
    final t = message['type']?.toString() ?? 'text';
    if (t == 'image') return '📷 Imagen';
    if (t == 'audio') return '🎤 Audio';
    if (t == 'video') return '🎬 Video';
    if (t == 'sticker') return 'Sticker';
    if (t == 'file') {
      final name = message['mediaName']?.toString();
      return (name != null && name.isNotEmpty) ? '📎 $name' : '📎 Archivo';
    }
    var body = (message['body']?.toString() ?? '').trim();
    if (body.isEmpty) return 'Nuevo mensaje';
    if (body.length > 100) body = '${body.substring(0, 100)}…';
    return body;
  }

  void _markConnected() {
    if (_connectedAt != null) return;
    _connectedAt = DateTime.now();
    _connected = true;
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _connectedAt == null) return;
      setState(() => _elapsed = DateTime.now().difference(_connectedAt!));
    });
  }

  String get _elapsedLabel {
    final s = _elapsed.inSeconds;
    final m = s ~/ 60;
    final r = s % 60;
    return '${m.toString().padLeft(1, '0')}:${r.toString().padLeft(2, '0')}';
  }

  Future<void> _closeFromRemote({String reason = 'hangup'}) async {
    if (_closing) return;
    _closing = true;
    if (mounted) {
      setState(() {
        _status = reason == 'reject'
            ? (_isRadio ? 'Radio rechazada' : 'Llamada rechazada')
            : (_isRadio ? 'Radio finalizada' : 'Llamada finalizada');
      });
    }
    try {
      await _mic?.stop();
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    await _restorePhoneAudio();
    if (mounted) {
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (mounted) Navigator.of(context).pop();
    }
  }

  /// Tras colgar: no dejar el móvil en modo llamada; vuelve a audio de radio (media).
  Future<void> _restorePhoneAudio() async {
    try {
      await AudioSessionSetup.acquireRadio();
    } catch (_) {
      await AudioSessionSetup.resetRouting();
    }
  }

  Future<void> _applySpeaker(bool on) async {
    try {
      await AudioManager.instance.setSpeakerOutputPreferred(on);
    } catch (_) {}
    try {
      // ignore: deprecated_member_use
      await Hardware.instance.setSpeakerphoneOn(on);
    } catch (_) {}
  }

  Future<void> _applyListenMute() async {
    final room = _room;
    if (room == null) return;
    for (final participant in room.remoteParticipants.values) {
      for (final pub in participant.audioTrackPublications) {
        try {
          final track = pub.track;
          if (track != null) {
            try {
              track.mediaStreamTrack.enabled = !_listenMuted;
            } catch (_) {}
          }
          if (_listenMuted) {
            await pub.disable();
          } else {
            await pub.enable();
          }
        } catch (_) {}
      }
    }
  }

  Future<void> _connect() async {
    Room? room;
    LocalAudioTrack? mic;
    try {
      await ChannelSession.current?.pauseForPersonalRadio();
      final e2ee = await buildVoiceE2eeOptions(widget.e2eeKey);
      room = Room(roomOptions: RoomOptions(encryption: e2ee));
      final listener = room.createListener();
      listener.on<ParticipantDisconnectedEvent>((_) {
        _closeFromRemote(reason: 'peer_left');
      });
      listener.on<TrackSubscribedEvent>((e) {
        if (_listenMuted && e.track is AudioTrack) {
          _applyListenMute();
        }
      });
      _roomListener = listener;
      room.addListener(() {
        if (!mounted || _closing) return;
        setState(() {});
      });
      await room.connect(
        AppConfig.publicLiveKitUrl(widget.url),
        widget.token,
      );
      await AudioSessionSetup.acquireVoice();
      await _applySpeaker(_speakerOn);
      mic = await LocalAudioTrack.create(
        const AudioCaptureOptions(
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          stopAudioCaptureOnMute: true,
        ),
      );
      await room.localParticipant?.publishAudioTrack(mic);
      if (_isRadio) {
        await mic.mute(stopOnMute: true);
      }
      if (!mounted) {
        await mic.stop();
        await room.disconnect();
        return;
      }
      setState(() {
        _room = room;
        _mic = mic;
        _muted = _isRadio;
        _speakerOn = true;
        if (widget.role == 'callee') {
          _markConnected();
          _status = _isRadio ? 'Radio activa' : 'En llamada';
        } else if (_isRadio) {
          _status = 'Invitando a ${widget.peerName}…';
        } else {
          _status = 'Llamando…';
        }
      });
    } catch (e) {
      try {
        await mic?.stop();
      } catch (_) {}
      try {
        await room?.disconnect();
      } catch (_) {}
      try {
        await _mic?.stop();
      } catch (_) {}
      try {
        await _room?.disconnect();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _room = null;
        _mic = null;
        _status = e.toString();
      });
    }
  }

  Future<void> _toggleMute() async {
    if (_isRadio) return;
    final mic = _mic;
    if (mic == null) return;
    try {
      if (_muted) {
        await mic.unmute();
        setState(() => _muted = false);
      } else {
        await mic.mute(stopOnMute: true);
        setState(() => _muted = true);
      }
      HapticFeedback.selectionClick();
    } catch (_) {}
  }

  Future<void> _toggleSpeaker() async {
    final next = !_speakerOn;
    await _applySpeaker(next);
    if (mounted) setState(() => _speakerOn = next);
    HapticFeedback.selectionClick();
  }

  Future<void> _toggleListenMute() async {
    setState(() => _listenMuted = !_listenMuted);
    await _applyListenMute();
    HapticFeedback.selectionClick();
  }

  Future<void> _pttDown() async {
    if (!_isRadio || _closing) return;
    final mic = _mic;
    if (mic == null) return;
    try {
      await mic.unmute();
      if (mounted) {
        setState(() {
          _muted = false;
          _pttHeld = true;
          _status = 'AL AIRE';
        });
      }
      HapticFeedback.mediumImpact();
    } catch (_) {}
  }

  Future<void> _pttUp() async {
    if (!_isRadio || _closing) return;
    final mic = _mic;
    if (mic == null) return;
    try {
      await mic.mute(stopOnMute: true);
      if (mounted) {
        setState(() {
          _muted = true;
          _pttHeld = false;
          _status = _connected ? 'Radio activa' : 'Radio con ${widget.peerName}';
        });
      }
    } catch (_) {}
  }

  Future<void> _hangup() async {
    if (_closing) return;
    _closing = true;
    try {
      await widget.api.endPrivateCall(widget.callId);
    } catch (_) {}
    try {
      await _mic?.stop();
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    await ChannelSession.current?.resumeAfterPersonalRadio();
    await _restorePhoneAudio();
    if (mounted) Navigator.pop(context);
  }

  Future<void> _openMessageSheet() async {
    final peerId = widget.peerId;
    if (peerId == null || peerId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay chat vinculado a esta llamada')),
      );
      return;
    }
    final controller = TextEditingController();
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kInstCallSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Mensaje a ${widget.peerName}',
                style: const TextStyle(
                  color: kInstOnPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                maxLines: 4,
                minLines: 1,
                style: const TextStyle(color: kInstOnPrimary),
                decoration: InputDecoration(
                  hintText: 'Escribe un mensaje…',
                  hintStyle: TextStyle(
                    color: kInstOnPrimary.withValues(alpha: 0.45),
                  ),
                  filled: true,
                  fillColor: kInstCallBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: kInstOnPrimary.withValues(alpha: 0.2),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: kInstOnPrimary.withValues(alpha: 0.2),
                    ),
                  ),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) async {
                  final text = controller.text.trim();
                  if (text.isEmpty) return;
                  Navigator.of(ctx).pop(true);
                },
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: kInstOliveMid,
                  foregroundColor: kInstOnPrimary,
                ),
                onPressed: () {
                  if (controller.text.trim().isEmpty) return;
                  Navigator.of(ctx).pop(true);
                },
                icon: const Icon(Icons.send),
                label: const Text('Enviar'),
              ),
            ],
          ),
        );
      },
    );
    final text = controller.text.trim();
    controller.dispose();
    if (sent != true || text.isEmpty) return;
    try {
      await widget.api.sendDmMessage(peerId, text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mensaje enviado')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(esMsg(e, 'No se pudo enviar'))),
      );
    }
  }

  void _openMoreSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: kInstCallSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(
                  _listenMuted ? Icons.volume_off : Icons.volume_up,
                  color: kInstOnPrimary,
                ),
                title: Text(
                  _listenMuted ? 'Activar audio' : 'Silenciar audio entrante',
                  style: const TextStyle(color: kInstOnPrimary),
                ),
                subtitle: Text(
                  _listenMuted
                      ? 'Volver a oír a ${widget.peerName}'
                      : 'No oirás al otro (tú sigues en la llamada)',
                  style: TextStyle(
                    color: kInstOnPrimary.withValues(alpha: 0.55),
                  ),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleListenMute();
                },
              ),
              ListTile(
                leading: Icon(
                  _speakerOn ? Icons.phone_in_talk : Icons.volume_up,
                  color: kInstOnPrimary,
                ),
                title: Text(
                  _speakerOn ? 'Usar auricular' : 'Usar altavoz',
                  style: const TextStyle(color: kInstOnPrimary),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleSpeaker();
                },
              ),
              ListTile(
                leading: const Icon(Icons.chat_bubble_outline, color: kInstOnPrimary),
                title: const Text(
                  'Enviar mensaje',
                  style: TextStyle(color: kInstOnPrimary),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _openMessageSheet();
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    PrivateCallScreen.uiOpen = false;
    ChatMessageBanner.instance.onTap = _bannerTapPrev;
    _tick?.cancel();
    _roomListener?.dispose();
    try {
      _signalSocket?.dispose();
    } catch (_) {}
    _mic?.stop();
    _room?.disconnect();
    // Si no se colgó limpio, igual restaurar ruta (sin matar holders de radio).
    if (!_closing) {
      unawaited(_restorePhoneAudio());
    }
    super.dispose();
  }

  Widget _peerAvatar({required double radius}) {
    final id = widget.peerId;
    if (id != null && id.isNotEmpty) {
      return UserAvatar(
        name: widget.peerName,
        userId: id,
        avatarUrl: widget.api.peerAvatarNetworkUrl(id),
        headers: widget.api.avatarAuthHeaders(),
        radius: radius,
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: kInstOlive,
      child: Text(
        userAvatarInitials(widget.peerName),
        style: TextStyle(
          color: kInstOnPrimary,
          fontWeight: FontWeight.w700,
          fontSize: radius * 0.72,
        ),
      ),
    );
  }

  String get _initials {
    final parts = widget.peerName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length.clamp(1, 2)).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  Widget _actionButton({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    bool active = false,
    bool danger = false,
    double size = 58,
    Widget? holdChild,
  }) {
    final bg = danger
        ? kInstDanger
        : active
            ? kInstOnPrimary
            : kInstCallSurface;
    final fg = danger
        ? kInstOnPrimary
        : active
            ? kInstCallBg
            : kInstOnPrimary;
    final button = Material(
      color: bg,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: holdChild == null ? onTap : null,
        child: SizedBox(
          width: size,
          height: size,
          child: holdChild ?? Icon(icon, color: fg, size: size * 0.42),
        ),
      ),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        holdChild != null
            ? Listener(
                onPointerDown: (_) => _pttDown(),
                onPointerUp: (_) => _pttUp(),
                onPointerCancel: (_) => _pttUp(),
                child: button,
              )
            : button,
        const SizedBox(height: 8),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: kInstOnPrimary.withValues(alpha: 0.85),
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildKeypad() {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ];
    return Column(
      children: [
        Text(
          _keypadBuffer.isEmpty ? ' ' : _keypadBuffer,
          style: const TextStyle(
            color: kInstOnPrimary,
            fontSize: 28,
            letterSpacing: 2,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
        for (final row in keys)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final k in row)
                  Material(
                    color: kInstCallSurface,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          if (_keypadBuffer.length < 24) {
                            _keypadBuffer += k;
                          }
                        });
                      },
                      child: SizedBox(
                        width: 64,
                        height: 64,
                        child: Center(
                          child: Text(
                            k,
                            style: const TextStyle(
                              color: kInstOnPrimary,
                              fontSize: 26,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        TextButton(
          onPressed: () => setState(() {
            _showKeypad = false;
            _keypadBuffer = '';
          }),
          child: const Text('Ocultar teclado', style: TextStyle(color: kInstGoldSoft)),
        ),
      ],
    );
  }

  Widget _withCallChrome(Widget child) {
    return Stack(
      fit: StackFit.expand,
      children: [
        child,
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: ChatMessageBannerOverlay(),
        ),
      ],
    );
  }

  void _minimize() {
    if (_closing || _minimized) return;
    setState(() {
      _minimized = true;
      _showKeypad = false;
    });
  }

  void _expand() {
    if (_closing) return;
    setState(() => _minimized = false);
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = _connected ? _elapsedLabel : _status;

    if (_minimized) {
      return _withCallChrome(
        PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _minimize();
          },
          child: Align(
            alignment: Alignment.topCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Material(
                  color: kInstCallBg,
                  elevation: 8,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: _expand,
                    borderRadius: BorderRadius.circular(14),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                      child: Row(
                        children: [
                          _peerAvatar(radius: 18),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  widget.peerName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: kInstOnPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  _isRadio
                                      ? 'Radio en curso · toca para volver'
                                      : 'Llamada en curso · toca para volver',
                                  style: TextStyle(
                                    color: kInstOnPrimary.withValues(alpha: 0.65),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            subtitle,
                            style: const TextStyle(
                              color: kInstGoldSoft,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          if (_isRadio)
                            Padding(
                              padding: const EdgeInsets.only(left: 4),
                              child: _actionButton(
                                icon: Icons.mic,
                                label: _pttHeld ? 'AL AIRE' : 'PTT',
                                onTap: null,
                                active: _pttHeld,
                                size: 44,
                                holdChild: Icon(
                                  Icons.mic,
                                  color: _pttHeld ? kInstCallBg : kInstOnPrimary,
                                  size: 22,
                                ),
                              ),
                            ),
                          IconButton(
                            tooltip: _isRadio ? 'Cerrar' : 'Colgar',
                            onPressed: _hangup,
                            icon: const Icon(Icons.call_end, color: kInstDanger),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return _withCallChrome(
      PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _minimize();
        },
        child: Scaffold(
          backgroundColor: kInstCallBg,
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Minimizar (la llamada sigue)',
                        onPressed: _minimize,
                        icon: const Icon(Icons.arrow_back, color: kInstOnPrimary),
                      ),
                      Expanded(
                        child: Text(
                          _isRadio ? 'Radio personal' : 'Llamada de voz',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: kInstGoldSoft.withValues(alpha: 0.9),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (!_showKeypad)
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 112,
                            height: 112,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: _isRadio
                                  ? [
                                      BoxShadow(
                                        color: kInstOlive.withValues(alpha: 0.5),
                                        spreadRadius: 3,
                                      ),
                                    ]
                                  : [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.35),
                                        blurRadius: 10,
                                      ),
                                    ],
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: _peerAvatar(radius: 56),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            widget.peerName,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: kInstOnPrimary,
                              fontSize: 26,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            subtitle,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: kInstOnPrimary.withValues(alpha: 0.55),
                              fontSize: 15,
                            ),
                          ),
                          if (_listenMuted) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Audio entrante silenciado',
                              style: TextStyle(
                                color: kInstGoldSoft.withValues(alpha: 0.85),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    )
                  else ...[
                    const SizedBox(height: 12),
                    Text(
                      widget.peerName,
                      style: const TextStyle(
                        color: kInstOnPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: kInstOnPrimary.withValues(alpha: 0.55),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Expanded(child: SingleChildScrollView(child: _buildKeypad())),
                  ],
                  if (_isRadio) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _actionButton(
                          icon: Icons.mic,
                          label: _pttHeld ? 'AL AIRE' : 'PTT',
                          onTap: null,
                          active: _pttHeld,
                          size: 72,
                          holdChild: Icon(
                            Icons.mic,
                            color: _pttHeld ? kInstCallBg : kInstOnPrimary,
                            size: 32,
                          ),
                        ),
                        _actionButton(
                          icon: _speakerOn ? Icons.volume_up : Icons.phone_in_talk,
                          label: _speakerOn ? 'Altavoz' : 'Auricular',
                          onTap: _toggleSpeaker,
                          active: _speakerOn,
                        ),
                        _actionButton(
                          icon: Icons.chat_bubble_outline,
                          label: 'Mensaje',
                          onTap: _openMessageSheet,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Mantén PTT para transmitir',
                      style: TextStyle(
                        color: kInstOnPrimary.withValues(alpha: 0.45),
                        fontSize: 12,
                      ),
                    ),
                  ] else ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _actionButton(
                          icon: _muted ? Icons.mic_off : Icons.mic,
                          label: _muted ? 'Mic off' : 'Silenciar',
                          onTap: _toggleMute,
                          active: _muted,
                        ),
                        _actionButton(
                          icon: Icons.dialpad,
                          label: 'Teclado',
                          onTap: () => setState(() => _showKeypad = !_showKeypad),
                          active: _showKeypad,
                        ),
                        _actionButton(
                          icon: _speakerOn ? Icons.volume_up : Icons.phone_in_talk,
                          label: _speakerOn ? 'Altavoz' : 'Auricular',
                          onTap: _toggleSpeaker,
                          active: _speakerOn,
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _actionButton(
                          icon: Icons.chat_bubble_outline,
                          label: 'Mensaje',
                          onTap: _openMessageSheet,
                        ),
                        _actionButton(
                          icon: Icons.more_horiz,
                          label: 'Más',
                          onTap: _openMoreSheet,
                        ),
                        _actionButton(
                          icon: _listenMuted ? Icons.volume_off : Icons.hearing,
                          label: _listenMuted ? 'Sin audio' : 'Audio',
                          onTap: _toggleListenMute,
                          active: _listenMuted,
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 28),
                  _actionButton(
                    icon: Icons.call_end,
                    label: _isRadio ? 'Cerrar' : 'Colgar',
                    onTap: _hangup,
                    danger: true,
                    size: 72,
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
