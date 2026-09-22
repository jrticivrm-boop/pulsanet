import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:permission_handler/permission_handler.dart';
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
import '../widgets/chat_composer.dart';
import '../widgets/chat_attach_sheet.dart';
import '../widgets/chat_voice_bubble.dart';
import '../widgets/user_avatar.dart';
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
  bool _uploading = false;
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
    super.dispose();
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
      final x = await picker.pickImage(
        source: source,
        imageQuality: 92,
        maxWidth: 1920,
      );
      if (x == null) return;
      if (!mounted) return;
      final caption = await showMediaSendConfirm(
        context,
        path: x.path,
        kind: 'image',
        filename: x.name,
        initialCaption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
      );
      if (caption == null) return;
      setState(() => _uploading = true);
      try {
        await session.sendMediaFile(
          path: x.path,
          filename: x.name,
          mime: x.mimeType,
          caption: caption.isEmpty ? null : caption,
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
    if (!mounted) return;
    final caption = await showMediaSendConfirm(
      context,
      path: x.path,
      kind: 'video',
      filename: x.name,
      initialCaption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
    );
    if (caption == null) return;
    setState(() => _uploading = true);
    try {
      await session.sendMediaFile(
        path: x.path,
        filename: x.name,
        mime: x.mimeType ?? 'video/mp4',
        caption: caption.isEmpty ? null : caption,
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
      type: FileType.custom,
      allowedExtensions: kDocumentExtensions,
    );
    final f = result?.files.single;
    if (f?.path == null) return;
    if (!isDocumentFile(name: f!.name)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tipo no permitido (PDF, Office, ZIP, texto…)'),
        ),
      );
      return;
    }
    if (!mounted) return;
    final caption = await showMediaSendConfirm(
      context,
      path: f.path!,
      kind: 'file',
      filename: f.name,
      initialCaption: _chat.text.trim().isEmpty ? null : _chat.text.trim(),
    );
    if (caption == null) return;
    setState(() => _uploading = true);
    try {
      await session.sendMediaFile(
        path: f.path!,
        filename: f.name,
        caption: caption.isEmpty ? null : caption,
        type: 'file',
      );
      _chat.clear();
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
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

  void _send() {
    final t = _chat.text;
    _chat.clear();
    session.setTyping(false);
    session.sendChat(t);
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
                        onSwipeReply: (m.isDeleted || m.type == 'system')
                            ? null
                            : () {
                                session.setReplyTo(m);
                                _composerFocus.requestFocus();
                              },
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
          ChatComposer(
            api: widget.api,
            controller: _chat,
            focusNode: _composerFocus,
            uploading: _uploading,
            autofocus: widget.autofocusComposer,
            errorText: session.error,
            onDismissError: session.clearError,
            onTyping: session.setTyping,
            onSendText: _send,
            onSendSticker: (s) {
              final id = s['id']?.toString() ?? '';
              if (id.isEmpty) return;
              session.sendSticker(id);
            },
            onSendVoice: ({
              required String path,
              required String filename,
              required String mime,
            }) async {
              setState(() => _uploading = true);
              try {
                await session.sendMediaFile(
                  path: path,
                  filename: filename,
                  mime: mime,
                  type: 'audio',
                );
              } finally {
                if (mounted) setState(() => _uploading = false);
              }
            },
            onBeforeVoiceStart: () async {
              try {
                await session.pauseMicForVoiceNote();
              } catch (_) {}
            },
            onAfterVoiceEnd: () async {
              try {
                await session.resumeAfterVoiceNote();
              } catch (_) {}
            },
            onPickCamera: () => pickImage(source: ImageSource.camera),
            onPickGallery: () => pickImage(source: ImageSource.gallery),
            onPickVideo: _pickVideo,
            onPickFile: _pickFile,
          ),
        ],
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
    this.onSwipeReply,
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
  final VoidCallback? onSwipeReply;
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
            if (m.mediaUrl != null && !_isImage(m) && !_isVideo(m) && !isAudioMedia(type: m.type, mime: m.mediaMime, name: m.mediaName))
              _AuthFileChip(
                api: api,
                mediaUrl: m.mediaUrl!,
                name: m.mediaName ?? 'Archivo',
                mime: m.mediaMime,
                size: m.mediaSize,
              ),
            if (m.mediaUrl != null && isAudioMedia(type: m.type, mime: m.mediaMime, name: m.mediaName))
              ChatVoiceBubble(
                api: api,
                mediaUrl: m.mediaUrl!,
                senderName: m.displayName,
                senderId: m.senderId,
                mine: mine,
              ),
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
              child: Builder(
                builder: (context) {
                  Widget bubble = GestureDetector(
                    onLongPress: onLongPress,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.sizeOf(context).width * 0.72,
                        minWidth: chatBubbleMinWidth(
                          showMeta: time.isNotEmpty ||
                              mine ||
                              (m.editedAt != null && !m.isDeleted),
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
                  );
                  if (onSwipeReply != null && !m.isDeleted) {
                    bubble = wrapChatSwipeReply(
                      key: ValueKey('group-swipe-${m.id}'),
                      onReply: onSwipeReply!,
                      child: bubble,
                    );
                  }
                  return bubble;
                },
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
