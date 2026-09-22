import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../api_client.dart';
import 'user_avatar.dart';

/// Una sola nota de voz suena a la vez en el chat.
final ValueNotifier<String?> _voicePlayingId = ValueNotifier<String?>(null);

/// Nota de voz estilo WhatsApp (avatar+mic, play, onda, duración).
/// Al terminar la reproducción vuelve al inicio (play + thumb en 0).
class ChatVoiceBubble extends StatefulWidget {
  const ChatVoiceBubble({
    super.key,
    required this.api,
    required this.mediaUrl,
    required this.senderName,
    this.senderId,
    this.mine = false,
  });

  final ApiClient api;
  final String mediaUrl;
  final String senderName;
  final String? senderId;
  final bool mine;

  @override
  State<ChatVoiceBubble> createState() => _ChatVoiceBubbleState();
}

class _ChatVoiceBubbleState extends State<ChatVoiceBubble> {
  /// Verde oscuro tipo WhatsApp (burbuja de audio).
  static const _bgMine = Color(0xFF075E54);
  static const _bgTheirs = Color(0xFF1F2C34);
  static const _fg = Color(0xFFD1E0D8);
  static const _fgDim = Color(0xFF8FA89C);

  final _player = AudioPlayer();
  late final String _id;
  String? _localPath;
  String? _err;
  bool _loading = true;
  bool _playing = false;
  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;
  late List<double> _bars;
  StreamSubscription<void>? _completeSub;
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<PlayerState>? _stateSub;

  @override
  void initState() {
    super.initState();
    _id = 'vn-${widget.mediaUrl.hashCode}-${identityHashCode(this)}';
    _bars = _buildBars(widget.mediaUrl);
    _player.setReleaseMode(ReleaseMode.stop);
    _stateSub = _player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;
      final playing = s == PlayerState.playing;
      setState(() => _playing = playing);
      if (s == PlayerState.completed) {
        unawaited(_resetToStart());
      }
    });
    _durSub = _player.onDurationChanged.listen((d) {
      if (!mounted) return;
      if (d > Duration.zero) setState(() => _dur = d);
    });
    _posSub = _player.onPositionChanged.listen((pos) {
      if (!mounted) return;
      setState(() => _pos = pos);
      // Fallback: algunos dispositivos no disparan completed.
      if (_dur > Duration.zero &&
          pos >= _dur - const Duration(milliseconds: 120) &&
          _playing) {
        unawaited(_resetToStart());
      }
    });
    _completeSub = _player.onPlayerComplete.listen((_) {
      unawaited(_resetToStart());
    });
    _voicePlayingId.addListener(_onBus);
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant ChatVoiceBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mediaUrl != widget.mediaUrl) {
      unawaited(_player.stop());
      _bars = _buildBars(widget.mediaUrl);
      setState(() {
        _localPath = null;
        _err = null;
        _loading = true;
        _playing = false;
        _pos = Duration.zero;
        _dur = Duration.zero;
      });
      unawaited(_load());
    }
  }

  @override
  void dispose() {
    _voicePlayingId.removeListener(_onBus);
    if (_voicePlayingId.value == _id) _voicePlayingId.value = null;
    unawaited(_completeSub?.cancel() ?? Future.value());
    unawaited(_posSub?.cancel() ?? Future.value());
    unawaited(_durSub?.cancel() ?? Future.value());
    unawaited(_stateSub?.cancel() ?? Future.value());
    unawaited(_player.dispose());
    super.dispose();
  }

  void _onBus() {
    if (_voicePlayingId.value != _id && _playing) {
      unawaited(_player.pause());
    }
  }

  List<double> _buildBars(String seed) {
    final rnd = math.Random(seed.hashCode);
    return List.generate(28, (i) {
      final n = math.sin(i * 0.55) * 0.35 + math.cos(i * 1.15) * 0.28 + 0.5;
      return (0.22 + n * 0.7 + rnd.nextDouble() * 0.1).clamp(0.18, 1.0);
    });
  }

  Future<void> _load() async {
    try {
      final url = widget.api.mediaAbsoluteUrl(widget.mediaUrl);
      final res = await http.get(
        Uri.parse(url),
        headers: {
          if (widget.api.token != null) 'Authorization': 'Bearer ${widget.api.token}',
        },
      );
      if (res.statusCode >= 400) {
        if (!mounted) return;
        setState(() {
          _err = 'Error ${res.statusCode}';
          _loading = false;
        });
        return;
      }
      final dir = await getTemporaryDirectory();
      final ext = widget.mediaUrl.contains('.')
          ? p.extension(widget.mediaUrl.split('?').first)
          : '.m4a';
      final file = File(p.join(dir.path, 'chat-audio-${url.hashCode}$ext'));
      await file.writeAsBytes(res.bodyBytes, flush: true);
      // Precargar duración.
      try {
        await _player.setSource(DeviceFileSource(file.path));
        final d = await _player.getDuration();
        if (d != null && d > Duration.zero && mounted) {
          setState(() => _dur = d);
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _localPath = file.path;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _err = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _resetToStart() async {
    try {
      await _player.seek(Duration.zero);
      await _player.stop();
    } catch (_) {}
    if (_voicePlayingId.value == _id) _voicePlayingId.value = null;
    if (!mounted) return;
    setState(() {
      _playing = false;
      _pos = Duration.zero;
    });
  }

  Future<void> _toggle() async {
    if (_localPath == null) return;
    if (_playing) {
      await _player.pause();
      if (_voicePlayingId.value == _id) _voicePlayingId.value = null;
      return;
    }
    _voicePlayingId.value = _id;
    try {
      if (_pos > Duration.zero && _dur > Duration.zero && _pos < _dur) {
        await _player.resume();
      } else {
        await _player.play(DeviceFileSource(_localPath!));
      }
    } catch (_) {
      try {
        await _player.play(DeviceFileSource(_localPath!));
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.maybeOf(context)?.showSnackBar(
            SnackBar(content: Text('No se pudo reproducir: $e')),
          );
        }
      }
    }
  }

  Future<void> _seekRatio(double ratio) async {
    if (_dur <= Duration.zero) return;
    final ms = (_dur.inMilliseconds * ratio.clamp(0.0, 1.0)).round();
    final d = Duration(milliseconds: ms);
    await _player.seek(d);
    if (mounted) setState(() => _pos = d);
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final bg = widget.mine ? _bgMine : _bgTheirs;
    if (_err != null) {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Text(_err!, style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
      );
    }
    if (_loading) {
      return Container(
        width: 236,
        height: 58,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: _fg),
        ),
      );
    }

    final progress = _dur.inMilliseconds <= 0
        ? 0.0
        : (_pos.inMilliseconds / _dur.inMilliseconds).clamp(0.0, 1.0);
    // Idle: muestra duración total; reproduciendo/pausado a mitad: posición.
    final shown = (_playing || _pos > const Duration(milliseconds: 80)) ? _pos : _dur;
    final avatarUrl = widget.api.peerAvatarNetworkUrl(widget.senderId);
    final headers = <String, String>{
      if (widget.api.token != null) 'Authorization': 'Bearer ${widget.api.token}',
    };

    return Container(
      width: 248,
      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _AvatarMic(
            name: widget.senderName,
            userId: widget.senderId,
            avatarUrl: avatarUrl,
            headers: headers,
          ),
          const SizedBox(width: 4),
          InkWell(
            onTap: _toggle,
            customBorder: const CircleBorder(),
            child: SizedBox(
              width: 32,
              height: 40,
              child: Icon(
                _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: _fg,
                size: 30,
              ),
            ),
          ),
          const SizedBox(width: 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (d) =>
                          _seekRatio(d.localPosition.dx / constraints.maxWidth),
                      onHorizontalDragUpdate: (d) =>
                          _seekRatio(d.localPosition.dx / constraints.maxWidth),
                      child: SizedBox(
                        height: 30,
                        width: constraints.maxWidth,
                        child: CustomPaint(
                          painter: _WavePainter(
                            bars: _bars,
                            progress: progress,
                            active: _fg,
                            idle: _fgDim.withValues(alpha: 0.5),
                            thumb: _fg,
                          ),
                        ),
                      ),
                    );
                  },
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 2, top: 1),
                  child: Text(
                    _fmt(shown),
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: _fg,
                      fontWeight: FontWeight.w500,
                      height: 1.05,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarMic extends StatelessWidget {
  const _AvatarMic({
    required this.name,
    this.userId,
    this.avatarUrl,
    this.headers,
  });

  final String name;
  final String? userId;
  final String? avatarUrl;
  final Map<String, String>? headers;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 44,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          UserAvatar(
            name: name,
            userId: userId,
            avatarUrl: avatarUrl,
            headers: headers,
            radius: 20,
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 17,
              height: 17,
              decoration: BoxDecoration(
                color: const Color(0xFF0F3D2E),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF075E54), width: 1.5),
              ),
              child: const Icon(Icons.mic, size: 10, color: Color(0xFFE8F0EA)),
            ),
          ),
        ],
      ),
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter({
    required this.bars,
    required this.progress,
    required this.active,
    required this.idle,
    required this.thumb,
  });

  final List<double> bars;
  final double progress;
  final Color active;
  final Color idle;
  final Color thumb;

  @override
  void paint(Canvas canvas, Size size) {
    if (bars.isEmpty) return;
    final n = bars.length;
    const gap = 2.2;
    final barW = ((size.width - gap * (n - 1)) / n).clamp(1.6, 3.2);
    final midY = size.height / 2;

    for (var i = 0; i < n; i++) {
      final h = bars[i] * (size.height * 0.9);
      final x = i * (barW + gap);
      final on = progress >= (i + 0.5) / n;
      final paint = Paint()
        ..color = on ? active : idle
        ..style = PaintingStyle.fill;
      final rect = RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(x + barW / 2, midY),
          width: barW,
          height: math.max(3.0, h),
        ),
        const Radius.circular(99),
      );
      canvas.drawRRect(rect, paint);
    }

    final tx = (progress * size.width).clamp(0.0, size.width);
    canvas.drawCircle(Offset(tx, midY), 4.5, Paint()..color = thumb);
  }

  @override
  bool shouldRepaint(covariant _WavePainter old) =>
      old.progress != progress || old.bars != bars;
}
