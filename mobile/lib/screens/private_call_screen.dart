import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../audio_session_setup.dart';
import '../background_radio.dart';
import '../call_ringtone.dart';
import '../channel_session.dart';
import '../camera_session_gate.dart';
import '../config.dart';
import '../es_msg.dart';
import '../livekit_e2ee.dart';
import '../chat_message_banner.dart';
import '../message_tone.dart';
import '../private_call_gate.dart';
import '../private_call_stabilizer.dart';
import '../theme.dart';
import '../video_streaming_config.dart';
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
    this.e2ee = false,
    this.mode = 'call',
    this.intent,
  });

  final ApiClient api;
  final String callId;
  final String peerName;
  final String? peerId;
  final String token;
  final String url;
  final String role;
  final String? e2eeKey;
  /// Si el API marcó `e2ee: true`, no conectar sin clave.
  final bool e2ee;

  /// `call` = full-duplex; `video` = videollamada; `radio` = PTT (mic mute hasta mantener).
  final String mode;

  /// `remote_camera` = despacho pide ver la cámara del dispositivo (preferir trasera).
  final String? intent;

  /// true mientras la UI de llamada está montada (minimizada o completa).
  static bool get uiOpen => PrivateCallGate.uiOpen;
  static String? get activeCallId => PrivateCallGate.activeCallId;
  static String? get activePeerId => PrivateCallGate.activePeerId;

  static bool isBusyWith({String? callId, String? peerId}) =>
      PrivateCallGate.isBusyWith(callId: callId, peerId: peerId);

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
  LocalVideoTrack? _cam;
  VideoTrack? _remoteVideoTrack;
  String _status = 'Conectando…';
  bool _muted = false;
  bool _minimized = false;
  /// Posición del mini-video local. null = esquina superior derecha (layout original).
  Offset? _pipOffset;
  /// Voz: auricular por defecto. Video/radio: altavoz (manos libres).
  late bool _speakerOn;
  bool _listenMuted = false;
  bool _pttHeld = false;
  bool _connected = false;
  bool _closing = false;
  bool _showKeypad = false;
  bool _cameraOn = false;
  bool _remoteVideo = false;
  CameraPosition _cameraPosition = CameraPosition.front;
  Map<String, dynamic>? _videoRequest;
  String _keypadBuffer = '';
  io.Socket? _signalSocket;
  PrivateCallStabilizer? _stabilizer;
  EventsListener<RoomEvent>? _roomListener;
  Timer? _tick;
  DateTime? _connectedAt;
  Duration _elapsed = Duration.zero;
  int _connectAttempts = 0;
  static const _maxConnectAttempts = 5;
  void Function(ChatMessageBannerPayload)? _bannerTapPrev;

  bool get _isRadio => widget.mode == 'radio';
  bool get _isVideo => widget.mode == 'video';
  bool get _isRemoteCamera => widget.intent == 'remote_camera';
  bool get _showVideoStage => _isVideo || _cameraOn || _remoteVideo;

  @override
  void initState() {
    super.initState();
    _speakerOn = _isVideo || _isRadio;
    if (_isRemoteCamera) {
      _cameraPosition = CameraPosition.back;
    }
    final gateOwner =
        _isRemoteCamera ? CameraOwner.remoteCam : CameraOwner.privateCall;
    if (!CameraSessionGate.tryAcquire(gateOwner)) {
      // No pelear con otra sesión de cámara; colgar en servidor y salir.
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          await widget.api.endPrivateCall(widget.callId, reason: 'hangup');
        } catch (_) {}
        if (mounted) Navigator.of(context).maybePop();
      });
      return;
    }
    PrivateCallGate.bind(callId: widget.callId, peerId: widget.peerId);
    _bannerTapPrev = ChatMessageBanner.instance.onTap;
    ChatMessageBanner.instance.onTap = _onBannerTap;
    // FGS alta prioridad: seguir hablando con app minimizada / pantalla bloqueada.
    unawaited(
      BackgroundRadio.setPrivateCallActive(
        true,
        peerName: widget.peerName,
        video: _isVideo,
      ),
    );
    unawaited(CallRingtone.stop());
    if (widget.role == 'caller') {
      unawaited(CallRingtone.startOutgoing());
    }
    _listenRemoteHangup();
    _connectAttempts = 0;
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
          .enableReconnection()
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
    socket.on('call:remote_control', (data) {
      if (!_isRemoteCamera || data is! Map) return;
      final id = data['callId']?.toString();
      if (id != null && id.isNotEmpty && id != widget.callId) return;
      unawaited(_applyRemoteControl(Map<String, dynamic>.from(data)));
    });
    socket.on('call:accepted', (data) {
      if (data is! Map || !mounted) return;
      final id = data['callId']?.toString();
      if (id == widget.callId && widget.role == 'caller') {
        _markConnected();
        setState(() {
          _status = _isRadio
              ? 'Radio con ${widget.peerName}'
              : _isVideo
                  ? 'Videollamada con ${widget.peerName}'
                  : 'En llamada';
        });
      }
    });
    socket.on('call:video_request', (data) {
      if (data is! Map || !mounted || _closing) return;
      if (data['callId']?.toString() != widget.callId) return;
      setState(() => _videoRequest = Map<String, dynamic>.from(data));
    });
    socket.on('call:video_accepted', (data) {
      if (data is! Map || !mounted) return;
      if (data['callId']?.toString() != widget.callId) return;
      setState(() => _status = '${widget.peerName} activó la cámara');
    });
    socket.on('call:video_rejected', (data) {
      if (data is! Map || !mounted) return;
      if (data['callId']?.toString() != widget.callId) return;
      setState(() => _status = '${widget.peerName} rechazó compartir cámara');
    });
    socket.on('call:video_stopped', (data) {
      if (data is! Map || !mounted) return;
      if (data['callId']?.toString() != widget.callId) return;
      setState(() {
        _remoteVideo = false;
        _remoteVideoTrack = null;
      });
    });
    socket.on('dm:notify', (data) {
      if (data is! Map || !mounted || _closing) return;
      final m = Map<String, dynamic>.from(data);
      final peerId = m['peerId']?.toString();
      final peerName = m['peerName']?.toString() ?? 'Mensaje';
      final message = m['message'];
      final preview = _previewFromDmNotify(message);
      final isNudge = message is Map && message['type']?.toString() == 'nudge';
      if (isNudge) {
        // En llamada = no viendo ese DM: vibrar + tono.
        // ignore: unawaited_futures
        applyReceivedNudgeFeedback(peerId: peerId);
      }
      ChatMessageBanner.instance.show(
        kind: 'dm',
        peerId: peerId,
        title: peerName,
        preview: preview,
        playTone: !isNudge,
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
    if (t == 'nudge') return '¡Zumbido!';
    if (t == 'video') return '🎬 Video';
    if (t == 'sticker') return 'Sticker';
    if (t == 'file') {
      final name = message['mediaName']?.toString();
      return (name != null && name.isNotEmpty) ? '📎 $name' : '📎 Archivo';
    }
    var body = (message['body']?.toString() ?? '').trim();
    if (body == 'nudge') return '¡Zumbido!';
    if (body.isEmpty) return 'Nuevo mensaje';
    if (body.length > 100) body = '${body.substring(0, 100)}…';
    return body;
  }

  void _markConnected() {
    if (_connectedAt != null) return;
    _connectedAt = DateTime.now();
    _connected = true;
    unawaited(CallRingtone.stopOutgoing());
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
            : (reason == 'timeout' || reason == 'no_answer')
                ? 'Sin respuesta'
                : (_isRadio ? 'Radio finalizada' : 'Llamada finalizada');
      });
    }
    try {
      await _cam?.stop();
    } catch (_) {}
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

  void _onRemoteVideoTrack(VideoTrack? track) {
    if (!mounted || _closing) return;
    setState(() {
      _remoteVideoTrack = track;
      _remoteVideo = track != null;
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
      if (mounted) {
        setState(() => _status = 'Permiso de cámara denegado');
      }
      return;
    }
    try {
      final lp = room.localParticipant;
      if (lp == null) return;
      final pub = await lp.setCameraEnabled(
        true,
        cameraCaptureOptions: streamingCameraCapture(position: _cameraPosition),
      );
      _cam = pub?.track is LocalVideoTrack ? pub!.track as LocalVideoTrack : _cam;
      if (_cam == null) {
        for (final p in lp.videoTrackPublications) {
          if (p.track is LocalVideoTrack) {
            _cam = p.track as LocalVideoTrack;
            break;
          }
        }
      }
      if (mounted) setState(() => _cameraOn = _cam != null);
    } catch (e) {
      if (mounted) setState(() => _status = esMsg(e, 'No se pudo activar la cámara'));
    }
  }

  Future<void> _disableCamera({bool notifyPeer = true}) async {
    final room = _room;
    final lp = room?.localParticipant;
    try {
      if (lp != null) {
        await lp.setCameraEnabled(
          false,
          cameraCaptureOptions: const CameraCaptureOptions(stopCameraCaptureOnMute: true),
        );
        for (final pub in List<LocalTrackPublication>.from(lp.videoTrackPublications)) {
          try {
            await lp.removePublishedTrack(pub.sid);
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      await _cam?.stop();
    } catch (_) {}
    _cam = null;
    if (mounted) setState(() => _cameraOn = false);
    if (notifyPeer) {
      try {
        await widget.api.stopPrivateCallVideo(widget.callId);
      } catch (_) {}
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameraOn) {
      await _disableCamera();
    } else {
      await _enableCamera();
    }
    HapticFeedback.selectionClick();
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
      HapticFeedback.selectionClick();
    } catch (e) {
      // Fallback: reiniciar track (más fiable en algunos Android).
      try {
        await _room?.localParticipant?.setCameraEnabled(false);
        _cam = null;
        if (mounted) setState(() => _cameraOn = false);
        _cameraPosition = next;
        await _enableCamera();
      } catch (err) {
        if (mounted) {
          setState(() => _status = esMsg(err, 'No se pudo cambiar de cámara'));
        }
      }
    }
  }

  /// Control remoto desde despacho (solo intent remote_camera). Nunca cuelga la llamada.
  Future<void> _applyRemoteControl(Map<String, dynamic> data) async {
    try {
      final facingRaw = data['facing']?.toString();
      if (facingRaw == 'front' || facingRaw == 'user') {
        if (_cameraPosition != CameraPosition.front) {
          _cameraPosition = CameraPosition.back; // fuerza flip path
          await _flipCamera();
        }
      } else if (facingRaw == 'back' || facingRaw == 'environment') {
        if (_cameraPosition != CameraPosition.back) {
          _cameraPosition = CameraPosition.front;
          await _flipCamera();
        }
      }
      if (data.containsKey('mic')) {
        final on = data['mic'] == true || data['mic'] == 'true' || data['mic'] == 1;
        final lp = _room?.localParticipant;
        if (lp != null) {
          await lp.setMicrophoneEnabled(on);
          if (mounted) setState(() => _muted = !on);
        }
      }
    } catch (e) {
      debugPrint('PrivateCallScreen._applyRemoteControl: $e');
    }
  }

  Future<void> _requestPeerCamera() async {
    try {
      await widget.api.requestPrivateCallVideo(widget.callId);
      if (mounted) setState(() => _status = 'Esperando que acepte la cámara…');
    } catch (e) {
      if (mounted) setState(() => _status = esMsg(e, 'No se pudo solicitar cámara'));
    }
  }

  Future<void> _respondVideoRequest(bool accept) async {
    setState(() => _videoRequest = null);
    try {
      await widget.api.respondPrivateCallVideo(widget.callId, accept);
      if (accept) {
        await _enableCamera();
        if (mounted) setState(() => _status = 'En llamada');
      }
    } catch (e) {
      if (mounted) setState(() => _status = esMsg(e, 'Error al responder solicitud'));
    }
  }

  Future<void> _connect() async {
    Room? room;
    LocalAudioTrack? mic;
    try {
      await ChannelSession.current?.pauseForPersonalRadio();
      final e2ee = await buildVoiceE2eeOptions(
        widget.e2eeKey,
        required: widget.e2ee,
      );
      room = Room(roomOptions: streamingRoomOptions(encryption: e2ee));
      final listener = room.createListener();
      Timer? remoteClearTimer;
      listener.on<TrackSubscribedEvent>((e) {
        if (_listenMuted && e.track is AudioTrack) {
          _applyListenMute();
        }
        if (e.track is VideoTrack) {
          remoteClearTimer?.cancel();
          _onRemoteVideoTrack(e.track as VideoTrack);
        }
      });
      listener.on<TrackUnsubscribedEvent>((e) {
        if (e.track is VideoTrack) {
          // Debounce: unsubscribes breves (capa simulcast) no deben apagar el tile.
          remoteClearTimer?.cancel();
          remoteClearTimer = Timer(const Duration(milliseconds: 2500), () {
            if (!mounted || _closing) return;
            if (identical(_remoteVideoTrack, e.track)) {
              _onRemoteVideoTrack(null);
            }
          });
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
      // Reaplicar tras un tick: Android a veces restaura ruta de radio/media.
      unawaited(Future<void>.delayed(const Duration(milliseconds: 350), () async {
        if (!mounted || _closing) return;
        await _applySpeaker(_speakerOn);
      }));
      mic = await LocalAudioTrack.create(kCallAudioCapture);
      await room.localParticipant?.publishAudioTrack(
        mic,
        publishOptions: kCallAudioPublish,
      );
      if (_isRadio) {
        await mic.mute(stopOnMute: true);
      }
      if (_isVideo) {
        await _enableCamera(room);
      }
      if (!mounted) {
        await _cam?.stop();
        await mic.stop();
        await room.disconnect();
        return;
      }
      setState(() {
        _room = room;
        _mic = mic;
        _muted = _isRadio;
        // No forzar altavoz: respeta auricular por defecto en voz.
        if (widget.role == 'callee') {
          _markConnected();
          _status = _isRadio
              ? 'Radio activa'
              : _isVideo
                  ? 'Videollamada'
                  : 'En llamada';
        } else if (_isRadio) {
          _status = 'Invitando a ${widget.peerName}…';
        } else if (_isVideo) {
          _status = 'Videollamando…';
        } else {
          _status = 'Llamando…';
        }
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
        onRemoteEnd: () => _closeFromRemote(reason: 'peer_left'),
        onGiveUp: () async {
          if (_closing) return;
          try {
            await widget.api.endPrivateCall(widget.callId, reason: 'hangup');
          } catch (_) {}
          await _closeFromRemote(reason: 'give_up');
        },
      )..attach(signalSocket: _signalSocket);
      _connectAttempts = 0;
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
      if (!mounted || _closing) return;
      _connectAttempts += 1;
      if (_connectAttempts >= _maxConnectAttempts) {
        setState(() => _status = 'Sin conexión');
        try {
          await widget.api.endPrivateCall(widget.callId, reason: 'hangup');
        } catch (_) {}
        if (mounted) Navigator.of(context).maybePop();
        return;
      }
      setState(() {
        _room = null;
        _mic = null;
        _status = 'Sin conexión · reintentando… ($_connectAttempts/$_maxConnectAttempts)';
      });
      await Future<void>.delayed(const Duration(seconds: 2));
      if (!mounted || _closing) return;
      await _connect();
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
      await _cam?.stop();
    } catch (_) {}
    try {
      await _mic?.stop();
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    _room = null;
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
    PrivateCallGate.clear(callId: widget.callId);
    CameraSessionGate.release(
      _isRemoteCamera ? CameraOwner.remoteCam : CameraOwner.privateCall,
    );
    ChatMessageBanner.instance.onTap = _bannerTapPrev;
    _tick?.cancel();
    _stabilizer?.dispose();
    _roomListener?.dispose();
    try {
      _signalSocket?.dispose();
    } catch (_) {}
    _cam?.stop();
    _mic?.stop();
    _room?.disconnect();
    unawaited(CallRingtone.stopOutgoing());
    unawaited(BackgroundRadio.setPrivateCallActive(false));
    // Si no se colgó limpio, igual restaurar ruta (sin matar holders de radio).
    if (!_closing) {
      unawaited(_restorePhoneAudio());
    }
    super.dispose();
  }

  Widget _buildVideoStage() {
    const pipW = 88.0;
    const pipH = 124.0;
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final maxH = constraints.maxHeight;
        var w = maxW;
        var h = w * 4 / 3;
        if (h > maxH) {
          h = maxH;
          w = h * 3 / 4;
        }
        // Posición por defecto: arriba-derecha (como antes).
        final defaultPip = Offset(
          (w - pipW - 10).clamp(0.0, w),
          10,
        );
        final pip = _pipOffset ?? defaultPip;
        final left = pip.dx.clamp(0.0, (w - pipW).clamp(0.0, w));
        final top = pip.dy.clamp(0.0, (h - pipH).clamp(0.0, h));

        return Center(
          child: SizedBox(
            width: w,
            height: h,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(color: Colors.black.withValues(alpha: 0.35)),
                  if (_remoteVideoTrack != null)
                    VideoTrackRenderer(
                      _remoteVideoTrack!,
                      fit: VideoViewFit.cover,
                    )
                  else if (!_cameraOn)
                    Center(child: _peerAvatar(radius: 56)),
                  if (_cam != null && _cameraOn)
                    Positioned(
                      left: left,
                      top: top,
                      width: pipW,
                      height: pipH,
                      child: GestureDetector(
                        onPanUpdate: (d) {
                          setState(() {
                            final cur = _pipOffset ?? defaultPip;
                            _pipOffset = Offset(
                              (cur.dx + d.delta.dx)
                                  .clamp(0.0, (w - pipW).clamp(0.0, w)),
                              (cur.dy + d.delta.dy)
                                  .clamp(0.0, (h - pipH).clamp(0.0, h)),
                            );
                          });
                        },
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: kInstOnPrimary.withValues(alpha: 0.35),
                                width: 2,
                              ),
                            ),
                            child: VideoTrackRenderer(
                              _cam!,
                              fit: VideoViewFit.cover,
                              mirrorMode:
                                  _cameraPosition == CameraPosition.front
                                      ? VideoViewMirrorMode.mirror
                                      : VideoViewMirrorMode.off,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCallControlsDock() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
      decoration: BoxDecoration(
        color: kInstCallBg,
        border: Border(
          top: BorderSide(color: kInstOnPrimary.withValues(alpha: 0.18)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
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
                  icon: _cameraOn ? Icons.videocam : Icons.videocam_off,
                  label: _cameraOn ? 'Apagar cam' : 'Encender cam',
                  onTap: _toggleCamera,
                  active: _cameraOn,
                ),
                if (_cameraOn)
                  _actionButton(
                    icon: _cameraPosition == CameraPosition.front
                        ? Icons.cameraswitch_outlined
                        : Icons.cameraswitch,
                    label: _cameraPosition == CameraPosition.front
                        ? 'Trasera'
                        : 'Frontal',
                    onTap: _flipCamera,
                    active: true,
                  )
                else if (!_isVideo)
                  _actionButton(
                    icon: Icons.visibility_outlined,
                    label: 'Pedir cam',
                    onTap: _requestPeerCamera,
                  )
                else
                  _actionButton(
                    icon: Icons.dialpad,
                    label: 'Teclado',
                    onTap: () => setState(() => _showKeypad = !_showKeypad),
                    active: _showKeypad,
                  ),
                if (_cameraOn)
                  _actionButton(
                    icon: Icons.dialpad,
                    label: 'Teclado',
                    onTap: () => setState(() => _showKeypad = !_showKeypad),
                    active: _showKeypad,
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _actionButton(
                  icon: Icons.chat_bubble_outline,
                  label: 'Mensaje',
                  onTap: _openMessageSheet,
                ),
                _actionButton(
                  icon: _speakerOn ? Icons.volume_up : Icons.phone_in_talk,
                  label: _speakerOn ? 'Altavoz' : 'Auricular',
                  onTap: _toggleSpeaker,
                  active: _speakerOn,
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
          const SizedBox(height: 20),
          _actionButton(
            icon: Icons.call_end,
            label: _isRadio ? 'Cerrar' : 'Colgar',
            onTap: _hangup,
            danger: true,
            size: 72,
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _buildVideoRequestBanner() {
    final req = _videoRequest;
    if (req == null) return const SizedBox.shrink();
    final fromName = req['fromName']?.toString() ?? 'Usuario';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kInstCallSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kInstOnPrimary.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(
            '$fromName solicita ver tu cámara',
            textAlign: TextAlign.center,
            style: const TextStyle(color: kInstOnPrimary, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: () => _respondVideoRequest(false),
                child: const Text('Rechazar'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: kInstOliveMid),
                onPressed: () => _respondVideoRequest(true),
                child: const Text('Activar cámara'),
              ),
            ],
          ),
        ],
      ),
    );
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
        ? kInstDangerSoft
        : active
            ? kInstGoldSoft
            : kInstCallSurfaceHi;
    final fg = danger
        ? kInstOnPrimary
        : active
            ? kInstCallBg
            : kInstOnPrimary;
    final button = Material(
      color: bg,
      elevation: danger || active ? 4 : 2,
      shadowColor: Colors.black54,
      shape: CircleBorder(
        side: BorderSide(
          color: danger
              ? kInstOnPrimary.withValues(alpha: 0.25)
              : active
                  ? kInstGold.withValues(alpha: 0.55)
                  : kInstOnPrimary.withValues(alpha: 0.22),
          width: 1.2,
        ),
      ),
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
          style: const TextStyle(
            color: kInstOnPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
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
                                      : _isVideo
                                          ? 'Videollamada · toca para volver'
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
                        tooltip: 'Minimizar (sigue la llamada)',
                        onPressed: _minimize,
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: kInstOnPrimary, size: 28),
                      ),
                      Expanded(
                        child: Text(
                          _isRadio
                              ? 'Radio personal'
                              : _isVideo
                                  ? 'Videollamada'
                                  : 'Llamada de voz',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: kInstGoldSoft,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_videoRequest != null) _buildVideoRequestBanner(),
                  if (!_showKeypad)
                    Expanded(
                      child: Column(
                        children: [
                          Expanded(
                            child: Center(
                              child: _showVideoStage
                                  ? Padding(
                                      padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                                      child: _buildVideoStage(),
                                    )
                                  : Container(
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
                            ),
                          ),
                          if (!_showVideoStage || _remoteVideo) ...[
                            Text(
                              widget.peerName,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: kInstOnPrimary,
                                fontSize: 22,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              subtitle,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: kInstOnPrimary.withValues(alpha: 0.82),
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
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
                          const SizedBox(height: 8),
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
                  if (!_showKeypad) _buildCallControlsDock(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
