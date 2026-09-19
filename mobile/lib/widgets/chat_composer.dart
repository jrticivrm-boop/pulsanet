import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

import '../api_client.dart';
import '../chat_bubble_style.dart';
import '../theme.dart';
import 'chat_attach_sheet.dart';
import 'chat_emoji_panel.dart';
import 'composer_error_balloon.dart';

/// Composer unificado estilo WhatsApp (grupo + 1:1):
/// [emoji] [zumbido?] Mensaje [clip] [cámara]  ·  (mic | enviar)
/// Al grabar: panel timer + onda + borrar / pausar / enviar.
/// [onNudge] solo en DM (paridad web); en chat de grupo queda null.
class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.api,
    required this.controller,
    required this.focusNode,
    required this.onSendText,
    required this.onSendSticker,
    required this.onSendVoice,
    required this.onPickCamera,
    required this.onPickGallery,
    required this.onPickVideo,
    required this.onPickFile,
    this.onTyping,
    this.onBeforeVoiceStart,
    this.onAfterVoiceEnd,
    this.onNudge,
    this.nudgeBusy = false,
    this.uploading = false,
    this.errorText,
    this.onDismissError,
    this.autofocus = false,
    this.enabled = true,
  });

  final ApiClient api;
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSendText;
  final FutureOr<void> Function(Map<String, dynamic> sticker) onSendSticker;
  final Future<void> Function({
    required String path,
    required String filename,
    required String mime,
  }) onSendVoice;
  final Future<void> Function() onPickCamera;
  final Future<void> Function() onPickGallery;
  final Future<void> Function() onPickVideo;
  final Future<void> Function() onPickFile;
  final ValueChanged<bool>? onTyping;
  final Future<void> Function()? onBeforeVoiceStart;
  final Future<void> Function()? onAfterVoiceEnd;
  /// DM: envía zumbido (Icons.vibration). Null en chat de grupo.
  final FutureOr<void> Function()? onNudge;
  final bool nudgeBusy;
  final bool uploading;
  final String? errorText;
  final VoidCallback? onDismissError;
  final bool autofocus;
  final bool enabled;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  static const _iconGrey = Color(0xFF54656F);
  static const _recPanel = Color(0xFF1F2C34);
  static const _recPausePill = Color(0xFF2A3942);
  static const _recDelete = Color(0xFF6B3A3A);
  static const _recSend = Color(0xFF00A884);
  static const _waveIdle = Color(0xFF8696A0);
  static const _barCount = 36;

  final _recorder = AudioRecorder();
  bool _recording = false;
  bool _paused = false;
  bool _showEmoji = false;
  DateTime? _segmentStartedAt;
  Duration _elapsedBase = Duration.zero;
  String? _voicePath;
  Timer? _tick;
  StreamSubscription<Amplitude>? _ampSub;
  Duration _elapsed = Duration.zero;
  bool _busyVoice = false;
  final List<double> _bars = List<double>.filled(_barCount, 0.18);

  bool get _hasText => widget.controller.text.trim().isNotEmpty;
  bool get _blocked => !widget.enabled || widget.uploading || _busyVoice;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onDraftChanged);
  }

  @override
  void dispose() {
    _tick?.cancel();
    unawaited(_ampSub?.cancel() ?? Future<void>.value());
    widget.controller.removeListener(_onDraftChanged);
    unawaited(_recorder.dispose());
    super.dispose();
  }

  void _onDraftChanged() {
    if (mounted) setState(() {});
  }

  Duration _liveElapsed() {
    if (_paused || _segmentStartedAt == null) return _elapsedBase;
    return _elapsedBase + DateTime.now().difference(_segmentStartedAt!);
  }

  Future<void> _toggleEmoji() async {
    if (_blocked || _recording) return;
    if (_showEmoji) {
      setState(() => _showEmoji = false);
      widget.focusNode.requestFocus();
      return;
    }
    widget.focusNode.unfocus();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    if (!mounted) return;
    setState(() => _showEmoji = true);
  }

  void _hideEmojiForKeyboard() {
    if (_showEmoji) setState(() => _showEmoji = false);
  }

  Future<void> _openAttach() async {
    if (_blocked || _recording) return;
    final choice = await showChatAttachSheet(context);
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'gallery':
        await widget.onPickGallery();
        break;
      case 'camera':
        await widget.onPickCamera();
        break;
      case 'video':
        await widget.onPickVideo();
        break;
      case 'file':
        await widget.onPickFile();
        break;
    }
  }

  Future<void> _quickCamera() async {
    if (_blocked || _recording) return;
    await widget.onPickCamera();
  }

  Future<void> _startVoice() async {
    if (_blocked || _recording || _hasText) return;
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Se necesita micrófono para notas de voz')),
      );
      return;
    }

    try {
      await widget.onBeforeVoiceStart?.call();
    } catch (_) {}

    try {
      final dir = await getTemporaryDirectory();
      final path = p.join(
        dir.path,
        'nota-voz-${DateTime.now().millisecondsSinceEpoch}.m4a',
      );
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
        path: path,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      widget.focusNode.unfocus();
      await _ampSub?.cancel();
      _ampSub = _recorder
          .onAmplitudeChanged(const Duration(milliseconds: 80))
          .listen(_onAmplitude);
      _tick?.cancel();
      _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
        if (!mounted || !_recording || _paused) return;
        setState(() => _elapsed = _liveElapsed());
      });
      setState(() {
        _recording = true;
        _paused = false;
        _showEmoji = false;
        _segmentStartedAt = DateTime.now();
        _elapsedBase = Duration.zero;
        _voicePath = path;
        _elapsed = Duration.zero;
        for (var i = 0; i < _bars.length; i++) {
          _bars[i] = 0.18;
        }
      });
    } catch (e) {
      try {
        await widget.onAfterVoiceEnd?.call();
      } catch (_) {}
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudo grabar: $e')),
      );
    }
  }

  void _onAmplitude(Amplitude a) {
    if (!mounted || !_recording || _paused) return;
    // dBFS típico ~ -60 (silencio) … 0 (pico). Normalizar a 0..1.
    final raw = ((a.current + 55) / 55).clamp(0.0, 1.0);
    final level = math.pow(raw, 0.85).toDouble();
    setState(() {
      for (var i = 0; i < _bars.length - 1; i++) {
        _bars[i] = _bars[i + 1];
      }
      _bars[_bars.length - 1] = 0.14 + level * 0.86;
      _elapsed = _liveElapsed();
    });
  }

  Future<void> _togglePause() async {
    if (!_recording || _busyVoice) return;
    try {
      if (_paused) {
        await _recorder.resume();
        if (!mounted) return;
        HapticFeedback.selectionClick();
        setState(() {
          _paused = false;
          _segmentStartedAt = DateTime.now();
        });
      } else {
        await _recorder.pause();
        if (!mounted) return;
        HapticFeedback.selectionClick();
        final now = _liveElapsed();
        setState(() {
          _paused = true;
          _elapsedBase = now;
          _segmentStartedAt = null;
          _elapsed = now;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudo pausar: $e')),
      );
    }
  }

  Future<void> _finishVoice({required bool send}) async {
    if (!_recording) return;
    final total = _liveElapsed();
    String? path;
    try {
      path = await _recorder.stop();
    } catch (_) {
      path = _voicePath;
    }
    _tick?.cancel();
    _tick = null;
    await _ampSub?.cancel();
    _ampSub = null;
    if (!mounted) return;
    setState(() {
      _recording = false;
      _paused = false;
      _segmentStartedAt = null;
      _elapsedBase = Duration.zero;
      _voicePath = null;
      _elapsed = Duration.zero;
    });

    Future<void> cleanup(String? pth) async {
      try {
        final f = File(pth ?? '');
        if (await f.exists()) await f.delete();
      } catch (_) {}
    }

    if (!send || path == null) {
      await cleanup(path);
      try {
        await widget.onAfterVoiceEnd?.call();
      } catch (_) {}
      return;
    }

    final file = File(path);
    final exists = await file.exists();
    final len = exists ? await file.length() : 0;
    if (total.inMilliseconds < 500 || !exists || len < 800) {
      await cleanup(path);
      try {
        await widget.onAfterVoiceEnd?.call();
      } catch (_) {}
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nota demasiado corta'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    setState(() => _busyVoice = true);
    try {
      await widget.onSendVoice(
        path: path,
        filename: p.basename(path),
        mime: 'audio/mp4',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo enviar audio: $e')),
        );
      }
    } finally {
      await cleanup(path);
      try {
        await widget.onAfterVoiceEnd?.call();
      } catch (_) {}
      if (mounted) setState(() => _busyVoice = false);
    }
  }

  String _fmtElapsed(Duration d) {
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Widget _buildRecordingPanel() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: _recPanel,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              SizedBox(
                width: 44,
                child: Text(
                  _fmtElapsed(_elapsed),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              Expanded(
                child: SizedBox(
                  height: 28,
                  child: CustomPaint(
                    painter: _VoiceWavePainter(
                      levels: List<double>.from(_bars),
                      color: _waveIdle,
                      paused: _paused,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _RecCircleButton(
                color: _recDelete,
                icon: Icons.delete_outline_rounded,
                onTap: _busyVoice ? null : () => _finishVoice(send: false),
                tooltip: 'Eliminar',
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Material(
                  color: _recPausePill,
                  borderRadius: BorderRadius.circular(28),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(28),
                    onTap: _busyVoice ? null : _togglePause,
                    child: SizedBox(
                      height: 48,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _paused ? 'Reanudar' : 'Pausar',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _RecCircleButton(
                color: _recSend,
                icon: Icons.send_rounded,
                onTap: _busyVoice ? null : () => _finishVoice(send: true),
                tooltip: 'Enviar',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIdleComposer() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE0E0E0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: _blocked ? null : _toggleEmoji,
                  icon: Icon(
                    _showEmoji
                        ? Icons.keyboard_alt_outlined
                        : Icons.sticky_note_2_outlined,
                    color: _iconGrey,
                    size: 24,
                  ),
                  tooltip: _showEmoji ? 'Teclado' : 'Emojis y stickers',
                ),
                if (widget.onNudge != null)
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: (_blocked || widget.nudgeBusy)
                        ? null
                        : () {
                            final result = widget.onNudge!.call();
                            if (result is Future) unawaited(result);
                          },
                    icon: Icon(
                      Icons.vibration,
                      color: widget.nudgeBusy
                          ? _iconGrey.withValues(alpha: 0.4)
                          : _iconGrey,
                      size: 22,
                    ),
                    tooltip: 'Enviar zumbido',
                  ),
                Expanded(
                  child: TextField(
                    controller: widget.controller,
                    focusNode: widget.focusNode,
                    autofocus: widget.autofocus,
                    enabled: widget.enabled && !widget.uploading,
                    minLines: 1,
                    maxLines: 5,
                    textCapitalization: TextCapitalization.sentences,
                    style: const TextStyle(
                      fontSize: 15.5,
                      height: 1.3,
                      color: kInstInk,
                    ),
                    decoration: InputDecoration(
                      hintText: widget.uploading ? 'Subiendo…' : 'Mensaje',
                      hintStyle: const TextStyle(
                        color: kChatMeta,
                        fontSize: 15.5,
                      ),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 11),
                    ),
                    onTap: _hideEmojiForKeyboard,
                    onChanged: (v) {
                      widget.onTyping?.call(v.trim().isNotEmpty);
                    },
                    onSubmitted: (_) {
                      if (_hasText && !_blocked) widget.onSendText();
                    },
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: _blocked ? null : _openAttach,
                  icon: const Icon(
                    Icons.attach_file,
                    color: _iconGrey,
                    size: 22,
                  ),
                  tooltip: 'Adjuntar',
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: _blocked ? null : _quickCamera,
                  icon: const Icon(
                    Icons.photo_camera_outlined,
                    color: _iconGrey,
                    size: 22,
                  ),
                  tooltip: 'Cámara',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 6),
        if (_hasText)
          _RoundAction(
            color: kInstOlive,
            icon: Icons.send_rounded,
            onTap: _blocked ? null : widget.onSendText,
          )
        else
          _RoundAction(
            color: kInstOlive,
            icon: Icons.mic_none,
            onTap: _blocked ? null : _startVoice,
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: _recording ? _recPanel : kComposerBar,
          child: SafeArea(
            top: false,
            bottom: !_showEmoji || _recording,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!_recording &&
                      widget.errorText != null &&
                      widget.errorText!.isNotEmpty)
                    ComposerErrorBalloon(
                      message: widget.errorText!,
                      onDismiss: widget.onDismissError ?? () {},
                    ),
                  if (_recording) _buildRecordingPanel() else _buildIdleComposer(),
                ],
              ),
            ),
          ),
        ),
        if (_showEmoji && !_recording)
          ChatEmojiPanel(
            api: widget.api,
            onRequestKeyboard: () {
              setState(() => _showEmoji = false);
              widget.focusNode.requestFocus();
            },
            onEmoji: (e) {
              final t = widget.controller.text;
              final sel = widget.controller.selection;
              final start = sel.isValid ? sel.start : t.length;
              final end = sel.isValid ? sel.end : t.length;
              final next = t.replaceRange(start, end, e);
              widget.controller.value = TextEditingValue(
                text: next,
                selection: TextSelection.collapsed(offset: start + e.length),
              );
              widget.onTyping?.call(next.trim().isNotEmpty);
            },
            onSticker: (s) {
              final id = s['id']?.toString() ?? '';
              if (id.isEmpty) return;
              setState(() => _showEmoji = false);
              widget.onSendSticker(s);
            },
          ),
      ],
    );
  }
}

class _RecCircleButton extends StatelessWidget {
  const _RecCircleButton({
    required this.color,
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final Color color;
  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final btn = Material(
      color: color,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(icon, color: Colors.white, size: 24),
        ),
      ),
    );
    if (tooltip == null) return btn;
    return Tooltip(message: tooltip!, child: btn);
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.color,
    required this.icon,
    this.onTap,
  });

  final Color color;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      shape: const CircleBorder(),
      elevation: 1,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _VoiceWavePainter extends CustomPainter {
  _VoiceWavePainter({
    required this.levels,
    required this.color,
    required this.paused,
  });

  final List<double> levels;
  final Color color;
  final bool paused;

  @override
  void paint(Canvas canvas, Size size) {
    if (levels.isEmpty) return;
    final paint = Paint()
      ..color = paused ? color.withValues(alpha: 0.45) : color
      ..style = PaintingStyle.fill;
    final n = levels.length;
    final gap = 2.0;
    final barW = math.max(2.0, (size.width - gap * (n - 1)) / n);
    final midY = size.height / 2;
    for (var i = 0; i < n; i++) {
      final h = math.max(3.0, levels[i] * size.height);
      final x = i * (barW + gap);
      final rect = RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(x + barW / 2, midY),
          width: barW,
          height: h,
        ),
        const Radius.circular(2),
      );
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _VoiceWavePainter oldDelegate) {
    return oldDelegate.paused != paused ||
        oldDelegate.color != color ||
        oldDelegate.levels != levels;
  }
}
