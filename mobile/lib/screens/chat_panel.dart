import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

import '../api_client.dart';
import '../channel_session.dart';
import '../theme.dart';

/// Panel de chat del canal activo (compartido con RadioShell).
class ChatPanel extends StatefulWidget {
  const ChatPanel({super.key, required this.api, required this.session});

  final ApiClient api;
  final ChannelSession session;

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> {
  final _chat = TextEditingController();
  final _scroll = ScrollController();
  final _recorder = AudioRecorder();
  bool _uploading = false;
  bool _recordingVoice = false;
  DateTime? _voiceStartedAt;
  String? _voicePath;

  ChannelSession get session => widget.session;

  @override
  void initState() {
    super.initState();
    _chat.addListener(() {
      if (mounted) setState(() {});
    });
    session.addListener(_onUpdate);
  }

  @override
  void didUpdateWidget(covariant ChatPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session != widget.session) {
      oldWidget.session.removeListener(_onUpdate);
      widget.session.addListener(_onUpdate);
    }
  }

  void _onUpdate() {
    if (!mounted) return;
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    session.removeListener(_onUpdate);
    _chat.dispose();
    _scroll.dispose();
    unawaited(_recorder.dispose());
    super.dispose();
  }

  Future<void> _startVoice() async {
    if (_uploading || _recordingVoice) return;
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Se necesita micrófono para notas de voz')),
      );
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      final path = p.join(dir.path, 'nota-voz-${DateTime.now().millisecondsSinceEpoch}.m4a');
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
      setState(() {
        _recordingVoice = true;
        _voiceStartedAt = DateTime.now();
        _voicePath = path;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo grabar: $e')));
    }
  }

  Future<void> _stopVoice({required bool send}) async {
    if (!_recordingVoice) return;
    final started = _voiceStartedAt;
    String? path;
    try {
      path = await _recorder.stop();
    } catch (_) {
      path = _voicePath;
    }
    if (!mounted) return;
    setState(() {
      _recordingVoice = false;
      _voiceStartedAt = null;
      _voicePath = null;
    });
    if (!send || path == null) {
      try {
        final f = File(path ?? '');
        if (await f.exists()) await f.delete();
      } catch (_) {}
      return;
    }
    final ms = started == null ? 0 : DateTime.now().difference(started).inMilliseconds;
    final file = File(path);
    if (ms < 400 || !await file.exists() || await file.length() < 400) {
      try {
        await file.delete();
      } catch (_) {}
      return;
    }
    setState(() => _uploading = true);
    try {
      await session.sendMediaFile(
        path: path,
        filename: p.basename(path),
        mime: 'audio/mp4',
        type: 'audio',
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
      try {
        await file.delete();
      } catch (_) {}
    }
  }

  Future<void> pickImage({ImageSource source = ImageSource.gallery}) async {
    await Permission.photos.request();
    await Permission.camera.request();
    final picker = ImagePicker();
    final x = await picker.pickImage(source: source, imageQuality: 85);
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      await session.sendMediaFile(
        path: x.path,
        filename: x.name,
        mime: x.mimeType,
        caption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
        type: 'image',
      );
      _chat.clear();
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(withData: false);
    final f = result?.files.single;
    if (f?.path == null) return;
    setState(() => _uploading = true);
    try {
      final name = f!.name;
      final isImg = RegExp(r'\.(jpe?g|png|gif|webp|jfif|bmp)$', caseSensitive: false).hasMatch(name);
      await session.sendMediaFile(
        path: f.path!,
        filename: name,
        caption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
        type: isImg ? 'image' : 'file',
      );
      _chat.clear();
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _send() {
    final t = _chat.text;
    _chat.clear();
    session.setTyping(false);
    session.sendChat(t);
  }

  Future<void> _openStickers() async {
    try {
      final packs = await widget.api.fetchStickerPacks();
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        builder: (ctx) {
          final stickers = <Map<String, dynamic>>[];
          for (final pack in packs) {
            final items = pack['stickers'];
            if (items is List) {
              stickers.addAll(items.whereType<Map>().map((e) => Map<String, dynamic>.from(e)));
            }
          }
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: GridView.builder(
                shrinkWrap: true,
                itemCount: stickers.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 6,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                ),
                itemBuilder: (_, i) {
                  final s = stickers[i];
                  final value = s['value']?.toString() ?? '';
                  final id = s['id']?.toString() ?? '';
                  return InkWell(
                    onTap: () {
                      Navigator.pop(ctx);
                      session.sendSticker(id);
                    },
                    child: Center(child: Text(value, style: const TextStyle(fontSize: 32))),
                  );
                },
              ),
            ),
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _messageActions(ChatMessage m, bool mine) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Responder'),
              onTap: () => Navigator.pop(ctx, 'reply'),
            ),
            ListTile(
              leading: const Icon(Icons.emoji_emotions_outlined),
              title: const Text('Reaccionar'),
              onTap: () => Navigator.pop(ctx, 'react'),
            ),
            if (mine && m.type == 'text' && !m.isDeleted)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Editar'),
                onTap: () => Navigator.pop(ctx, 'edit'),
              ),
            if (mine && !m.isDeleted)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: kRadioDanger),
                title: const Text('Eliminar', style: TextStyle(color: kRadioDanger)),
                onTap: () => Navigator.pop(ctx, 'delete'),
              ),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'reply':
        session.setReplyTo(m);
      case 'react':
        final emoji = await showModalBottomSheet<String>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 12,
                children: ['👍', '❤️', '😂', '😮', '😢', '🙏']
                    .map(
                      (e) => InkWell(
                        onTap: () => Navigator.pop(ctx, e),
                        child: Text(e, style: const TextStyle(fontSize: 28)),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        );
        if (emoji != null) session.reactTo(m.id, emoji);
      case 'edit':
        final ctrl = TextEditingController(text: m.body ?? '');
        final body = await showDialog<String>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Editar mensaje'),
            content: TextField(controller: ctrl, autofocus: true),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, ctrl.text),
                child: const Text('Guardar'),
              ),
            ],
          ),
        );
        if (body != null) session.editChat(m.id, body);
      case 'delete':
        session.deleteChat(m.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = widget.api.user?['id'];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              session.typingLabel.isNotEmpty ? session.typingLabel : session.groupName,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: session.typingLabel.isNotEmpty ? kRadioBlue : kRadioInk,
                fontStyle: session.typingLabel.isNotEmpty ? FontStyle.italic : FontStyle.normal,
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: session.messages.length,
            itemBuilder: (context, i) {
              final m = session.messages[i];
              final mine = m.senderId == me;
              return _ChatBubble(
                message: m,
                mine: mine,
                api: widget.api,
                onLongPress: () => _messageActions(m, mine),
                onReact: (emoji) => session.reactTo(m.id, emoji),
              );
            },
          ),
        ),
        if (session.replyTo != null)
          Material(
            color: kRadioSurface,
            child: ListTile(
              dense: true,
              title: Text(
                'Respondiendo a ${session.replyTo!.displayName}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                session.replyTo!.body ?? session.replyTo!.type,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => session.setReplyTo(null),
              ),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 8, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_recordingVoice)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.mic, color: kRadioDanger, size: 18),
                        const SizedBox(width: 6),
                        const Expanded(
                          child: Text(
                            'Grabando… suelta para enviar',
                            style: TextStyle(fontSize: 12, color: kRadioDanger),
                          ),
                        ),
                        TextButton(
                          onPressed: () => _stopVoice(send: false),
                          child: const Text('Cancelar'),
                        ),
                      ],
                    ),
                  ),
                Row(
                  children: [
                    IconButton(
                      onPressed: (_uploading || _recordingVoice)
                          ? null
                          : () => pickImage(source: ImageSource.gallery),
                      icon: const Icon(Icons.image_outlined),
                    ),
                    IconButton(
                      onPressed: (_uploading || _recordingVoice) ? null : _pickFile,
                      icon: const Icon(Icons.attach_file),
                    ),
                    IconButton(
                      onPressed: (_uploading || _recordingVoice) ? null : _openStickers,
                      icon: const Icon(Icons.emoji_emotions_outlined),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _chat,
                        enabled: !_recordingVoice,
                        decoration: InputDecoration(
                          hintText: _uploading
                              ? 'Subiendo…'
                              : _recordingVoice
                                  ? 'Grabando…'
                                  : 'Mensaje…',
                          isDense: true,
                        ),
                        onChanged: (v) => session.setTyping(v.trim().isNotEmpty),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (_chat.text.trim().isNotEmpty)
                      IconButton.filled(
                        onPressed: (_uploading || _recordingVoice) ? null : _send,
                        icon: const Icon(Icons.send),
                      )
                    else
                      GestureDetector(
                        onLongPressStart: (_) => _startVoice(),
                        onLongPressEnd: (_) => _stopVoice(send: true),
                        onLongPressCancel: () => _stopVoice(send: false),
                        onTap: _uploading
                            ? null
                            : () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Mantén pulsado para nota de voz'),
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                        child: Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _recordingVoice ? kRadioDanger : kRadioBlue,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _recordingVoice ? Icons.mic : Icons.mic_none,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({
    required this.message,
    required this.mine,
    required this.api,
    required this.onLongPress,
    required this.onReact,
  });

  final ChatMessage message;
  final bool mine;
  final ApiClient api;
  final VoidCallback onLongPress;
  final void Function(String emoji) onReact;

  bool _isImage(ChatMessage m) {
    if (m.type == 'image') return true;
    final mime = (m.mediaMime ?? '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    return RegExp(r'\.(jpe?g|png|gif|webp|jfif|bmp)$', caseSensitive: false)
        .hasMatch(m.mediaName ?? m.mediaUrl ?? '');
  }

  @override
  Widget build(BuildContext context) {
    final m = message;
    final isPanic = m.type == 'system' && (m.body?.contains('PÁNICO') ?? false);
    if (m.type == 'system') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isPanic ? const Color(0xFFFFE4E1) : kRadioSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              m.body ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: isPanic ? kRadioDanger : kRadioMuted,
              ),
            ),
          ),
        ),
      );
    }

    final ticks = !mine
        ? ''
        : m.readFully
            ? ' ✓✓'
            : m.readCount > 0
                ? ' ✓✓'
                : ' ✓';
    final tickColor = m.readFully ? const Color(0xFF53BDEB) : const Color(0xFF9AA8B5);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: GestureDetector(
          onLongPress: onLongPress,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
              clipBehavior: Clip.hardEdge,
              decoration: BoxDecoration(
                color: mine ? const Color(0xFFDCE8D4) : kRadioSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!mine)
                    Text(
                      m.displayName,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: kRadioBlueDark,
                      ),
                    ),
                  if (m.reply != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 6, top: 2),
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.black12,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        m.reply!.isDeleted
                            ? 'Mensaje eliminado'
                            : '${m.reply!.displayName}: ${m.reply!.body ?? m.reply!.type}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  if (m.isDeleted)
                    const Text(
                      'Mensaje eliminado',
                      style: TextStyle(fontStyle: FontStyle.italic, color: kRadioMuted),
                    )
                  else ...[
                    if (m.type == 'sticker' && m.sticker != null)
                      Text(m.sticker!.value, style: const TextStyle(fontSize: 48)),
                    if (m.mediaUrl != null && _isImage(m))
                      _AuthImage(
                        api: api,
                        mediaUrl: m.mediaUrl!,
                        caption: m.mediaName ?? m.body,
                      ),
                    if (m.mediaUrl != null && m.type == 'file' && !_isImage(m))
                      Text(
                        '📎 ${m.mediaName ?? 'Archivo'}',
                        style: const TextStyle(color: kRadioBlueDark),
                      ),
                    if (m.mediaUrl != null && m.type == 'audio')
                      _AuthAudio(api: api, mediaUrl: m.mediaUrl!),
                    if (m.body != null && m.body!.isNotEmpty && m.type != 'sticker')
                      Text(m.body!, softWrap: true),
                  ],
                  if (m.reactions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Wrap(
                        spacing: 4,
                        children: m.reactions
                            .map(
                              (r) => InkWell(
                                onTap: () => onReact(r.emoji),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: r.mine ? const Color(0xFFC5D6B8) : Colors.white70,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text('${r.emoji} ${r.count}', style: const TextStyle(fontSize: 12)),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (m.editedAt != null && !m.isDeleted)
                          const Text('editado ', style: TextStyle(fontSize: 10, color: kRadioMuted)),
                        if (mine)
                          Text(
                            ticks.trim(),
                            style: TextStyle(fontSize: 11, color: tickColor, fontWeight: FontWeight.w700),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthImage extends StatefulWidget {
  const _AuthImage({required this.api, required this.mediaUrl, this.caption});
  final ApiClient api;
  final String mediaUrl;
  final String? caption;

  @override
  State<_AuthImage> createState() => _AuthImageState();
}

class _AuthImageState extends State<_AuthImage> {
  Uint8List? _bytes;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
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
        setState(() => _err = 'Error ${res.statusCode}');
        return;
      }
      setState(() => _bytes = res.bodyBytes);
    } catch (e) {
      setState(() => _err = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_err != null) {
      return Text(_err!, style: const TextStyle(fontSize: 12, color: Colors.red));
    }
    if (_bytes == null) {
      return const SizedBox(
        height: 80,
        width: 80,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          PageRouteBuilder<void>(
            opaque: false,
            barrierColor: Colors.black87,
            pageBuilder: (ctx, anim, secondary) {
              return _ImageLightbox(
                bytes: _bytes!,
                caption: widget.caption,
              );
            },
            transitionsBuilder: (ctx, anim, secondary, child) {
              return FadeTransition(opacity: anim, child: child);
            },
          ),
        );
      },
      child: Hero(
        tag: 'chat-img-${widget.mediaUrl}',
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.memory(
            _bytes!,
            height: 140,
            width: 200,
            fit: BoxFit.cover,
          ),
        ),
      ),
    );
  }
}

class _ImageLightbox extends StatelessWidget {
  const _ImageLightbox({required this.bytes, this.caption});

  final Uint8List bytes;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 5,
                  child: Center(
                    child: GestureDetector(
                      onTap: () {}, // no cerrar al tocar la imagen
                      child: Image.memory(bytes, fit: BoxFit.contain),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
                tooltip: 'Cerrar',
              ),
            ),
            if (caption != null && caption!.trim().isNotEmpty)
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: Text(
                  caption!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AuthAudio extends StatefulWidget {
  const _AuthAudio({required this.api, required this.mediaUrl});
  final ApiClient api;
  final String mediaUrl;

  @override
  State<_AuthAudio> createState() => _AuthAudioState();
}

class _AuthAudioState extends State<_AuthAudio> {
  final _player = AudioPlayer();
  String? _localPath;
  String? _err;
  bool _loading = true;
  bool _playing = false;
  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;
      setState(() => _playing = s == PlayerState.playing);
    });
    _player.onDurationChanged.listen((d) {
      if (!mounted) return;
      setState(() => _dur = d);
    });
    _player.onPositionChanged.listen((pos) {
      if (!mounted) return;
      setState(() => _pos = pos);
    });
    _load();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
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
        setState(() {
          _err = 'Error ${res.statusCode}';
          _loading = false;
        });
        return;
      }
      final dir = await getTemporaryDirectory();
      final ext = widget.mediaUrl.contains('.') ? p.extension(widget.mediaUrl.split('?').first) : '.m4a';
      final file = File(p.join(dir.path, 'chat-audio-${url.hashCode}$ext'));
      await file.writeAsBytes(res.bodyBytes, flush: true);
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

  Future<void> _toggle() async {
    if (_localPath == null) return;
    if (_playing) {
      await _player.pause();
      return;
    }
    if (_pos > Duration.zero && _dur > Duration.zero && _pos < _dur) {
      await _player.resume();
    } else {
      await _player.play(DeviceFileSource(_localPath!));
    }
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(1, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    if (_err != null) {
      return Text(_err!, style: const TextStyle(fontSize: 12, color: Colors.red));
    }
    if (_loading) {
      return const SizedBox(
        height: 36,
        width: 120,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    final maxMs = _dur.inMilliseconds <= 0 ? 1 : _dur.inMilliseconds;
    return Row(
      children: [
        IconButton(
          onPressed: _toggle,
          icon: Icon(_playing ? Icons.pause_circle_filled : Icons.play_circle_filled),
          color: kRadioBlue,
          iconSize: 32,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 2,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 8),
                ),
                child: Slider(
                  value: _pos.inMilliseconds.clamp(0, maxMs).toDouble(),
                  max: maxMs.toDouble(),
                  onChanged: (v) async {
                    final d = Duration(milliseconds: v.round());
                    await _player.seek(d);
                    setState(() => _pos = d);
                  },
                ),
              ),
              Text(
                '${_fmt(_pos)} / ${_fmt(_dur)}',
                style: const TextStyle(fontSize: 10, color: kRadioMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
