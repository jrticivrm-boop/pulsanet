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
import 'package:open_filex/open_filex.dart';
import 'package:record/record.dart';
import 'package:video_player/video_player.dart';

import '../api_client.dart';
import '../audio_session_setup.dart';
import '../channel_session.dart';
import '../chat_image_gallery.dart';
import '../chat_message_actions.dart';
import '../linkified_text.dart';
import '../media_kind.dart';
import '../peer_actions.dart';
import '../chat_bubble_style.dart';
import '../theme.dart';
import '../widgets/user_avatar.dart';
import '../widgets/chat_emoji_panel.dart';
import '../widgets/tactical_backdrop.dart';

/// Colores: ver chat_bubble_style.dart

/// Panel de chat del canal activo (layout tipo WhatsApp: sin huecos, burbujas compactas).
class ChatPanel extends StatefulWidget {
  const ChatPanel({
    super.key,
    required this.api,
    required this.session,
    this.showChannelTitle = false,
    this.autofocusComposer = false,
    this.scrollToMessageId,
  });

  final ApiClient api;
  final ChannelSession session;
  /// Si false, el título lo pone el shell (AppBar).
  final bool showChannelTitle;
  /// Al abrir desde notificación: foco en el compositor para responder.
  final bool autofocusComposer;
  /// Si viene en FCM, intenta acercar ese mensaje (lista reverse).
  final String? scrollToMessageId;

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> with AutomaticKeepAliveClientMixin {
  final _chat = TextEditingController();
  final _scroll = ScrollController();
  final _composerFocus = FocusNode();
  final _recorder = AudioRecorder();
  bool _uploading = false;
  bool _recordingVoice = false;
  bool _showEmojiPanel = false;
  DateTime? _voiceStartedAt;
  String? _voicePath;
  Map<String, String>? _pinned;

  ChannelSession get session => widget.session;

  String get _pinScope => 'group:${session.groupId}';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _chat.addListener(() {
      if (mounted) setState(() {});
    });
    session.addListener(_onUpdate);
    _loadPinned();
    if (widget.autofocusComposer || widget.scrollToMessageId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (widget.autofocusComposer) {
          _composerFocus.requestFocus();
        }
        _maybeScrollToMessage();
      });
    }
  }

  Future<void> _loadPinned() async {
    final pin = await ChatPinStore.get(_pinScope);
    if (!mounted) return;
    setState(() => _pinned = pin);
  }

  void _maybeScrollToMessage() {
    final target = widget.scrollToMessageId;
    if (target == null || target.isEmpty || !_scroll.hasClients) return;
    final msgs = session.messages;
    final idx = msgs.indexWhere((m) => m.id == target);
    if (idx < 0) return;
    // reverse: índice visual 0 = último mensaje.
    final visual = msgs.length - 1 - idx;
    // Aprox. por item (~72px); suficiente para acercar al hilo reciente.
    final offset = (visual * 72.0).clamp(0.0, _scroll.position.maxScrollExtent);
    _scroll.jumpTo(offset);
  }

  @override
  void didUpdateWidget(covariant ChatPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session != widget.session) {
      oldWidget.session.removeListener(_onUpdate);
      widget.session.addListener(_onUpdate);
    }
  }

  int _lastMsgCount = -1;

  void _onUpdate() {
    if (!mounted) return;
    final count = session.messages.length;
    final grew = _lastMsgCount >= 0 && count > _lastMsgCount;
    final stickToBottom =
        !_scroll.hasClients || _scroll.offset <= 96;
    _lastMsgCount = count;
    setState(() {});
    if (grew && stickToBottom && _scroll.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scroll.hasClients) return;
        _scroll.jumpTo(0);
      });
    }
  }

  @override
  void dispose() {
    session.removeListener(_onUpdate);
    _chat.dispose();
    _scroll.dispose();
    _composerFocus.dispose();
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

  Future<void> _openAttachMenu() async {
    if (_uploading || _recordingVoice) return;
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: kInstSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: kInstOlive),
              title: const Text('Galería'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined, color: kInstOlive),
              title: const Text('Cámara'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined, color: kInstOlive),
              title: const Text('Video'),
              onTap: () => Navigator.pop(ctx, 'video'),
            ),
            ListTile(
              leading: const Icon(Icons.attach_file, color: kInstOlive),
              title: const Text('Documento o archivo'),
              subtitle: const Text('PDF, Word, Excel, ZIP, RAR…'),
              onTap: () => Navigator.pop(ctx, 'file'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'gallery') {
      await pickImage(source: ImageSource.gallery);
    } else if (choice == 'camera') {
      await pickImage(source: ImageSource.camera);
    } else if (choice == 'video') {
      await _pickVideo();
    } else if (choice == 'file') {
      await _pickFile();
    }
  }

  Future<void> pickImage({ImageSource source = ImageSource.gallery}) async {
    await Permission.photos.request();
    await Permission.camera.request();
    await AudioSessionSetup.pauseForCamera();
    try {
      await session.pauseMicForSystemCamera();
    } catch (_) {}
    try {
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
    } finally {
      await AudioSessionSetup.resumeAfterCamera();
      try {
        await session.ensureBackgroundAudio();
      } catch (_) {}
    }
  }

  Future<void> _pickVideo() async {
    await Permission.photos.request();
    final picker = ImagePicker();
    final x = await picker.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(minutes: 5),
    );
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      await session.sendMediaFile(
        path: x.path,
        filename: x.name,
        mime: x.mimeType ?? 'video/mp4',
        caption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
        type: 'video',
      );
      _chat.clear();
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: false,
      type: FileType.any,
    );
    final f = result?.files.single;
    if (f?.path == null) return;
    setState(() => _uploading = true);
    try {
      final name = f!.name;
      final type = classifyUploadName(name);
      await session.sendMediaFile(
        path: f.path!,
        filename: name,
        caption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
        type: type,
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

  void _toggleEmojiPanel() {
    if (_uploading || _recordingVoice) return;
    final open = !_showEmojiPanel;
    setState(() => _showEmojiPanel = open);
    if (open) {
      _composerFocus.unfocus();
    } else {
      _composerFocus.requestFocus();
    }
  }

  void _showKeyboard() {
    setState(() => _showEmojiPanel = false);
    _composerFocus.requestFocus();
  }

  Future<void> _messageActions(ChatMessage m, bool mine) async {
    final hasText = (m.body?.trim().isNotEmpty ?? false) && !m.isDeleted;
    final hasMedia = (m.mediaUrl?.isNotEmpty ?? false) && !m.isDeleted;
    final pinnedId = _pinned?['id'];
    final choice = await showChatMessageActionsSheet(
      context: context,
      mine: mine,
      isDeleted: m.isDeleted,
      hasText: hasText,
      hasMedia: hasMedia,
      canReply: !m.isDeleted,
      canReact: !m.isDeleted,
      canCopy: hasText,
      canForward: !m.isDeleted,
      canPin: !m.isDeleted,
      isPinned: pinnedId == m.id,
      canEdit: mine && m.type == 'text' && !m.isDeleted,
      canDelete: mine && !m.isDeleted,
      canDownload: hasMedia,
    );
    if (!mounted || choice == null) return;

    switch (choice.id) {
      case 'reply':
        session.setReplyTo(m);
        _composerFocus.requestFocus();
        break;
      case 'react':
        if (choice.emoji != null) session.reactTo(m.id, choice.emoji!);
        break;
      case 'react_more':
        final emoji = await showModalBottomSheet<String>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 12,
                children: kChatReactionEmojis
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
        break;
      case 'copy':
        await copyChatText(m.body ?? '');
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mensaje copiado'), duration: Duration(seconds: 1)),
        );
        break;
      case 'forward':
        final peer = await pickForwardContact(
          context: context,
          loadContacts: () => widget.api.fetchContacts(),
        );
        if (peer == null || !mounted) return;
        final body = chatForwardPreview(
          type: m.type,
          body: m.body,
          mediaName: m.mediaName,
        );
        try {
          await widget.api.sendDmMessage(peer['id'].toString(), body);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Reenviado a ${peer['displayName'] ?? 'contacto'}')),
          );
        } catch (e) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
        }
        break;
      case 'pin':
        await ChatPinStore.set(
          scopeId: _pinScope,
          messageId: m.id,
          title: m.displayName,
          preview: chatForwardPreview(
            type: m.type,
            body: m.body,
            mediaName: m.mediaName,
          ),
        );
        await _loadPinned();
        break;
      case 'unpin':
        await ChatPinStore.clear(_pinScope);
        await _loadPinned();
        break;
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
        break;
      case 'delete':
        session.deleteChat(m.id);
        if (_pinned?['id'] == m.id) {
          await ChatPinStore.clear(_pinScope);
          await _loadPinned();
        }
        break;
      case 'download':
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Abre el archivo para guardarlo')),
        );
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final me = widget.api.user?['id'];
    final msgs = session.messages;
    final imageGallery = <ChatGalleryItem>[
      for (final x in msgs)
        if (!x.isDeleted &&
            (x.mediaUrl?.isNotEmpty ?? false) &&
            isImageMedia(type: x.type, mime: x.mediaMime, name: x.mediaName ?? x.mediaUrl))
          ChatGalleryItem(
            mediaUrl: x.mediaUrl!,
            caption: x.mediaName ?? x.body,
          ),
    ];

    return ColoredBox(
      color: kChatBg,
      child: TacticalBackdrop(
        intensity: 0.85,
        child: Column(
        children: [
          if (widget.showChannelTitle)
            Material(
              color: kTacHeader,
              elevation: 0.5,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    session.typingLabel.isNotEmpty ? session.typingLabel : session.groupName,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: session.typingLabel.isNotEmpty ? kTacGoldSoft : kTacOnSurface,
                      fontStyle:
                          session.typingLabel.isNotEmpty ? FontStyle.italic : FontStyle.normal,
                    ),
                  ),
                ),
              ),
            ),
          Expanded(
            child: Column(
              children: [
                if (_pinned != null)
                  Material(
                    color: kTacPanel,
                    child: ListTile(
                      dense: true,
                      leading: const Icon(Icons.push_pin, size: 18, color: kTacGold),
                      title: Text(
                        _pinned!['title'] ?? 'Fijado',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: kTacGoldSoft,
                        ),
                      ),
                      subtitle: Text(
                        _pinned!['preview'] ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: kTacMuted),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () async {
                          await ChatPinStore.clear(_pinScope);
                          await _loadPinned();
                        },
                      ),
                    ),
                  ),
                Expanded(
                  child: msgs.isEmpty
                ? Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 32),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0E6C8),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Sin mensajes en este canal.\nEscribe abajo para empezar.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: kInstMuted, height: 1.35),
                      ),
                    ),
                  )
                : ListView.builder(
                    key: PageStorageKey<String>('group-chat-${session.groupId}'),
                    controller: _scroll,
                    reverse: true,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                    itemCount: msgs.length,
                    itemBuilder: (context, i) {
                      // reverse: índice 0 = mensaje más reciente
                      final idx = msgs.length - 1 - i;
                      final m = msgs[idx];
                      final mine = m.senderId == me;
                      final prev = idx > 0 ? msgs[idx - 1] : null;
                      final next = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                      final sameAsPrev = prev != null &&
                          prev.senderId == m.senderId &&
                          prev.type != 'system' &&
                          m.type != 'system';
                      final sameAsNext = next != null &&
                          next.senderId == m.senderId &&
                          next.type != 'system' &&
                          m.type != 'system';
                      return _ChatBubble(
                        message: m,
                        mine: mine,
                        api: widget.api,
                        imageGallery: imageGallery,
                        clusteredAbove: sameAsPrev,
                        clusteredBelow: sameAsNext,
                        onLongPress: () => _messageActions(m, mine),
                        onReact: (emoji) => session.reactTo(m.id, emoji),
                        onPeerTap: mine
                            ? null
                            : () => showChannelPeerActions(
                                  context: context,
                                  api: widget.api,
                                  peerId: m.senderId,
                                  displayName: m.displayName,
                                  myUserId: me?.toString(),
                                ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          if (session.replyTo != null)
            Material(
              color: kInstSurface,
              child: Container(
                decoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: kInstOlive, width: 4)),
                ),
                child: ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  title: Text(
                    'Respondiendo a ${session.replyTo!.displayName}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kInstOlive),
                  ),
                  subtitle: Text(
                    session.replyTo!.body ?? session.replyTo!.type,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => session.setReplyTo(null),
                  ),
                ),
              ),
            ),
          Material(
            color: kComposerBar,
            child: SafeArea(
              top: false,
              bottom: !_showEmojiPanel,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_recordingVoice)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            Icon(Icons.mic, color: kRadioDanger, size: 18),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Grabando… suelta para enviar',
                                style: TextStyle(fontSize: 12, color: kRadioDanger),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: kTacPanel,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(color: kTacBorder),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  onPressed: (_uploading || _recordingVoice) ? null : _toggleEmojiPanel,
                                  icon: Icon(
                                    _showEmojiPanel ? Icons.keyboard_alt_outlined : Icons.emoji_emotions_outlined,
                                    color: kChatMeta,
                                  ),
                                  tooltip: _showEmojiPanel ? 'Teclado' : 'Emojis y stickers',
                                ),
                                Expanded(
                                  child: TextField(
                                    controller: _chat,
                                    focusNode: _composerFocus,
                                    autofocus: widget.autofocusComposer,
                                    enabled: !_recordingVoice,
                                    minLines: 1,
                                    maxLines: 5,
                                    textCapitalization: TextCapitalization.sentences,
                                    decoration: InputDecoration(
                                      hintText: _uploading
                                          ? 'Subiendo…'
                                          : _recordingVoice
                                              ? 'Grabando…'
                                              : 'Mensaje',
                                      hintStyle: const TextStyle(color: kChatMeta, fontSize: 15),
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      disabledBorder: InputBorder.none,
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                                    ),
                                    onTap: () {
                                      if (_showEmojiPanel) {
                                        setState(() => _showEmojiPanel = false);
                                      }
                                    },
                                    onChanged: (v) => session.setTyping(v.trim().isNotEmpty),
                                    onSubmitted: (_) => _send(),
                                  ),
                                ),
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  onPressed: (_uploading || _recordingVoice) ? null : _openAttachMenu,
                                  icon: const Icon(Icons.add_circle_outline, color: kInstOlive),
                                  tooltip: 'Adjuntar foto o archivo',
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (_chat.text.trim().isNotEmpty)
                          _RoundAction(
                            color: kInstOlive,
                            icon: Icons.send,
                            onTap: (_uploading || _recordingVoice) ? null : _send,
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
                            child: _RoundAction(
                              color: _recordingVoice ? kRadioDanger : kInstOlive,
                              icon: _recordingVoice ? Icons.mic : Icons.mic_none,
                              onTap: null,
                            ),
                          ),
                      ],
                    ),
                    if (_recordingVoice)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed: () => _stopVoice(send: false),
                          child: const Text('Cancelar'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          if (_showEmojiPanel)
            ChatEmojiPanel(
              api: widget.api,
              onRequestKeyboard: _showKeyboard,
              onEmoji: (e) {
                final t = _chat.text;
                final sel = _chat.selection;
                final start = sel.isValid ? sel.start : t.length;
                final end = sel.isValid ? sel.end : t.length;
                final next = t.replaceRange(start, end, e);
                _chat.value = TextEditingValue(
                  text: next,
                  selection: TextSelection.collapsed(offset: start + e.length),
                );
                session.setTyping(next.trim().isNotEmpty);
              },
              onSticker: (s) {
                final id = s['id']?.toString() ?? '';
                if (id.isEmpty) return;
                setState(() => _showEmojiPanel = false);
                session.sendSticker(id);
              },
            ),
        ],
      ),
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.color, required this.icon, this.onTap});
  final Color color;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      shape: const CircleBorder(),
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

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({
    required this.message,
    required this.mine,
    required this.api,
    required this.onLongPress,
    required this.onReact,
    this.imageGallery = const [],
    this.onPeerTap,
    this.clusteredAbove = false,
    this.clusteredBelow = false,
  });

  final ChatMessage message;
  final bool mine;
  final ApiClient api;
  final VoidCallback onLongPress;
  final void Function(String emoji) onReact;
  final List<ChatGalleryItem> imageGallery;
  final VoidCallback? onPeerTap;
  final bool clusteredAbove;
  final bool clusteredBelow;

  bool _isImage(ChatMessage m) {
    return isImageMedia(type: m.type, mime: m.mediaMime, name: m.mediaName ?? m.mediaUrl);
  }

  bool _isVideo(ChatMessage m) {
    return isVideoMedia(type: m.type, mime: m.mediaMime, name: m.mediaName ?? m.mediaUrl);
  }

  String _fmtTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    final m = message;
    final isPanic = m.type == 'system' && (m.body?.contains('PÁNICO') ?? false);
    if (m.type == 'system') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.85),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isPanic ? const Color(0xFFFFE4E1) : const Color(0xFFE2F3D9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                m.body ?? '',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: isPanic ? kRadioDanger : kInstMuted,
                  height: 1.25,
                ),
              ),
            ),
          ),
        ),
      );
    }

    final time = _fmtTime(m.createdAt);
    final showName = !mine && !clusteredAbove;
    final radius = chatBubbleRadius(
      mine: mine,
      clusteredAbove: clusteredAbove,
      clusteredBelow: clusteredBelow,
    );

    final meta = ChatBubbleMeta(
      time: time,
      mine: mine,
      read: m.readFully || m.readCount > 0,
      pending: m.isLocal,
      edited: m.editedAt != null && !m.isDeleted,
    );

    Widget content;
    if (m.isDeleted) {
      content = const Padding(
        padding: EdgeInsets.fromLTRB(10, 8, 10, 8),
        child: Text(
          'Mensaje eliminado',
          style: TextStyle(fontStyle: FontStyle.italic, color: kChatMeta, fontSize: 14),
        ),
      );
    } else {
      content = chatBubbleFramedContent(
        padding: EdgeInsets.fromLTRB(10, showName ? 6 : 7, 10, 6),
        meta: meta,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showName)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: InkWell(
                  onTap: onPeerTap,
                  borderRadius: BorderRadius.circular(4),
                  child: Text(
                    m.displayName,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: kInstOliveMid,
                    ),
                  ),
                ),
              ),
            if (m.reply != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 5),
                padding: const EdgeInsets.fromLTRB(8, 5, 8, 5),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: const Border(left: BorderSide(color: kInstOlive, width: 3)),
                ),
                child: Text(
                  m.reply!.isDeleted
                      ? 'Mensaje eliminado'
                      : '${m.reply!.displayName}: ${m.reply!.body ?? m.reply!.type}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: kChatMeta, height: 1.25),
                ),
              ),
            if (m.type == 'sticker' && m.sticker != null)
              Text(m.sticker!.value, style: const TextStyle(fontSize: 52)),
            if (m.mediaUrl != null && _isImage(m))
              Padding(
                padding: EdgeInsets.only(bottom: (m.body != null && m.body!.isNotEmpty) ? 4 : 0),
                child: _AuthImage(
                  api: api,
                  mediaUrl: m.mediaUrl!,
                  caption: m.mediaName ?? m.body,
                  gallery: imageGallery,
                ),
              ),
            if (m.mediaUrl != null && _isVideo(m) && !_isImage(m))
              _AuthVideo(api: api, mediaUrl: m.mediaUrl!, name: m.mediaName),
            if (m.mediaUrl != null && !_isImage(m) && !_isVideo(m) && m.type != 'audio')
              _AuthFileChip(
                api: api,
                mediaUrl: m.mediaUrl!,
                name: m.mediaName ?? 'Archivo',
                mime: m.mediaMime,
                size: m.mediaSize,
              ),
            if (m.mediaUrl != null && m.type == 'audio')
              _AuthAudio(api: api, mediaUrl: m.mediaUrl!),
            if (m.body != null && m.body!.isNotEmpty && m.type != 'sticker')
              LinkifiedText(
                m.body!,
                style: const TextStyle(
                  fontSize: 15.5,
                  height: 1.35,
                  color: kInstInk,
                  letterSpacing: 0.05,
                ),
              ),
            if (m.reactions.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Wrap(
                  spacing: 4,
                  runSpacing: 2,
                  children: m.reactions
                      .map(
                        (r) => InkWell(
                          onTap: () => onReact(r.emoji),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: r.mine ? const Color(0xFFC5D6B8) : const Color(0xFFF0F2F5),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${r.emoji}${r.count > 1 ? ' ${r.count}' : ''}',
                              style: const TextStyle(fontSize: 12.5),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      );
    }

    return Padding(
      padding: chatBubbleOuterPadding(
        mine: mine,
        clusteredAbove: clusteredAbove,
        clusteredBelow: clusteredBelow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!mine && !clusteredAbove) ...[
            UserAvatar(
              name: m.displayName,
              userId: m.senderId,
              avatarUrl: api.peerAvatarNetworkUrl(m.senderId),
              headers: api.avatarAuthHeaders(),
              radius: 14,
            ),
            const SizedBox(width: 6),
          ] else if (!mine)
            const SizedBox(width: 34),
          Flexible(
            child: Align(
              alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
              child: GestureDetector(
                onLongPress: onLongPress,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.72,
                    minWidth: chatBubbleMinWidth(
                      showMeta: time.isNotEmpty || mine || (m.editedAt != null && !m.isDeleted),
                    ),
                  ),
                  child: IntrinsicWidth(
                    child: Container(
                      decoration: BoxDecoration(
                        color: mine ? kBubbleMine : kBubbleOther,
                        borderRadius: radius,
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x1A000000),
                            blurRadius: 1.5,
                            offset: Offset(0, 0.5),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: content,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}


class _AuthImage extends StatefulWidget {
  const _AuthImage({
    required this.api,
    required this.mediaUrl,
    this.caption,
    this.gallery = const [],
  });
  final ApiClient api;
  final String mediaUrl;
  final String? caption;
  final List<ChatGalleryItem> gallery;

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

  void _openGallery() {
    final items = widget.gallery.isNotEmpty
        ? widget.gallery
        : [
            ChatGalleryItem(mediaUrl: widget.mediaUrl, caption: widget.caption),
          ];
    var initial = items.indexWhere((e) => e.mediaUrl == widget.mediaUrl);
    if (initial < 0) initial = 0;
    openChatImageGallery(
      context: context,
      api: widget.api,
      items: items,
      initialIndex: initial,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_err != null) {
      return Text(_err!, style: const TextStyle(fontSize: 12, color: Colors.red));
    }
    if (_bytes == null) {
      return const SizedBox(
        height: 120,
        width: 180,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return GestureDetector(
      onTap: _openGallery,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.memory(
          _bytes!,
          height: 180,
          width: 240,
          fit: BoxFit.cover,
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
        width: 160,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    final maxMs = _dur.inMilliseconds <= 0 ? 1 : _dur.inMilliseconds;
    return SizedBox(
      width: 220,
      child: Row(
        children: [
          IconButton(
            onPressed: _toggle,
            icon: Icon(_playing ? Icons.pause_circle_filled : Icons.play_circle_filled),
            color: kInstOlive,
            iconSize: 30,
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
                    activeColor: kInstOlive,
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
      ),
    );
  }
}

class _AuthVideo extends StatefulWidget {
  const _AuthVideo({required this.api, required this.mediaUrl, this.name});

  final ApiClient api;
  final String mediaUrl;
  final String? name;

  @override
  State<_AuthVideo> createState() => _AuthVideoState();
}

class _AuthVideoState extends State<_AuthVideo> {
  VideoPlayerController? _controller;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final file = await widget.api.downloadMediaToTemp(
        widget.mediaUrl,
        filename: widget.name ?? 'video.mp4',
      );
      if (!mounted) return;
      final c = VideoPlayerController.file(file);
      await c.initialize();
      if (!mounted) {
        await c.dispose();
        return;
      }
      setState(() {
        _controller = c;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar el video';
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 140,
        width: 220,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: kInstOlive)),
      );
    }
    if (_error != null || _controller == null) {
      return Text(_error ?? 'Error', style: const TextStyle(color: kRadioMuted, fontSize: 13));
    }
    final c = _controller!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: AspectRatio(
            aspectRatio: c.value.aspectRatio == 0 ? 16 / 9 : c.value.aspectRatio,
            child: Stack(
              alignment: Alignment.center,
              children: [
                VideoPlayer(c),
                Material(
                  color: Colors.black38,
                  shape: const CircleBorder(),
                  child: IconButton(
                    icon: Icon(
                      c.value.isPlaying ? Icons.pause : Icons.play_arrow,
                      color: Colors.white,
                    ),
                    onPressed: () {
                      setState(() {
                        if (c.value.isPlaying) {
                          c.pause();
                        } else {
                          c.play();
                        }
                      });
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        if (widget.name != null && widget.name!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(widget.name!, style: const TextStyle(fontSize: 12, color: kInstMuted)),
          ),
      ],
    );
  }
}

class _AuthFileChip extends StatefulWidget {
  const _AuthFileChip({
    required this.api,
    required this.mediaUrl,
    required this.name,
    this.mime,
    this.size,
  });

  final ApiClient api;
  final String mediaUrl;
  final String name;
  final String? mime;
  final int? size;

  @override
  State<_AuthFileChip> createState() => _AuthFileChipState();
}

class _AuthFileChipState extends State<_AuthFileChip> {
  bool _busy = false;

  Future<void> _open() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final file = await widget.api.downloadMediaToTemp(
        widget.mediaUrl,
        filename: widget.name,
      );
      await OpenFilex.open(file.path);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo abrir: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final emoji = fileKindEmoji(widget.name, widget.mime);
    final sizeLabel = widget.size != null ? formatBytes(widget.size) : '';
    return InkWell(
      onTap: _open,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: kInstInk),
                  ),
                  if (sizeLabel.isNotEmpty)
                    Text(sizeLabel, style: const TextStyle(fontSize: 11, color: kInstMuted)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: kInstOlive),
                  )
                : const Icon(Icons.open_in_new, size: 18, color: kInstOlive),
          ],
        ),
      ),
    );
  }
}
