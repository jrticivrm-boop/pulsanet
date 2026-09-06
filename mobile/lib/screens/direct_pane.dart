import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../chat_image_gallery.dart';
import '../chat_message_actions.dart';
import '../config.dart';
import '../linkified_text.dart';
import '../media_kind.dart';
import '../message_tone.dart';
import '../push_service.dart';
import '../chat_bubble_style.dart';
import '../theme.dart';
import '../user_display.dart';
import '../audio_session_setup.dart';
import '../widgets/chat_attach_sheet.dart';
import '../widgets/chat_emoji_panel.dart';
import '../widgets/tactical_backdrop.dart';
import '../widgets/user_avatar.dart';
import 'private_call_screen.dart';

/// Contactos, chat 1:1 y llamada privada.
class DirectPane extends StatefulWidget {
  const DirectPane({
    super.key,
    required this.api,
    required this.onBack,
    this.initialPeerId,
    this.threadOnly = false,
  });

  final ApiClient api;
  final VoidCallback onBack;
  /// Si viene de notificación DM, abre ese hilo al cargar contactos.
  final String? initialPeerId;
  /// Solo hilo (desde inbox): sin lista de contactos; atrás cierra la ruta.
  final bool threadOnly;

  @override
  State<DirectPane> createState() => _DirectPaneState();
}

class _DirectPaneState extends State<DirectPane> with WidgetsBindingObserver {
  List<Map<String, dynamic>> _contacts = [];
  Map<String, dynamic>? _peer;
  List<Map<String, dynamic>> _messages = [];
  final _draft = TextEditingController();
  final _composerFocus = FocusNode();
  io.Socket? _socket;
  String? _error;
  bool _loading = true;
  bool _uploading = false;
  bool _showEmojiPanel = false;
  Map<String, dynamic>? _replyTo;
  Map<String, String>? _pinned;
  String? get _pinScope {
    final id = _peer?['id']?.toString();
    return id == null ? null : 'dm:$id';
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _connectSocket();
    if (widget.threadOnly &&
        widget.initialPeerId != null &&
        widget.initialPeerId!.isNotEmpty) {
      // Tap en notificación: abrir hilo al instante (sin esperar lista de contactos).
      _openPeerFast(widget.initialPeerId!);
      unawaited(_loadContactsInBackground());
    } else {
      _load();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _peer != null) {
      // Re-sincroniza historial tras inactividad (socket pudo perder mensajes).
      unawaited(_refreshPeerHistory());
    }
  }

  Future<void> _refreshPeerHistory() async {
    final peer = _peer;
    if (peer == null) return;
    final peerId = peer['id']?.toString();
    if (peerId == null || peerId.isEmpty) return;
    try {
      _socket?.emit('dm:join', {'peerId': peerId});
      final data = await widget.api.fetchDmMessages(peerId);
      if (!mounted || _peer?['id']?.toString() != peerId) return;
      final server = (data['messages'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final serverIds = server.map((m) => m['id']?.toString()).toSet();
      final pending = _messages
          .where(
            (m) =>
                m['_local'] == true &&
                !serverIds.contains(m['id']?.toString()) &&
                !serverIds.contains(m['clientMsgId']?.toString()),
          )
          .toList();
      setState(() {
        _peer = Map<String, dynamic>.from(data['peer'] as Map? ?? peer);
        _messages = [...server, ...pending];
        _error = null;
      });
      if (server.isNotEmpty) {
        final lastId = server.last['id']?.toString();
        if (lastId != null) {
          widget.api.markDmRead(peerId, lastId).catchError((_) {});
        }
      }
    } catch (_) {
      /* mantener mensajes en memoria */
    }
  }

  void unawaited(Future<void> f) {
    f.catchError((Object e) {
      debugPrint('DirectPane bg: $e');
    });
  }

  /// Abre DM de inmediato con stub; mensajes y nombre llegan en paralelo.
  Future<void> _openPeerFast(String peerId) async {
    final stub = <String, dynamic>{
      'id': peerId,
      'displayName': 'Chat',
    };
    setState(() {
      _peer = stub;
      _contacts = [];
      _loading = false;
      _messages = [];
      _error = null;
    });
    PushService.instance.clearConversationNotifications(peerId: peerId);
    unawaited(_openPeer(stub));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _composerFocus.requestFocus();
    });
  }

  Future<void> _loadContactsInBackground() async {
    try {
      final list = await widget.api.fetchContacts();
      if (!mounted) return;
      setState(() => _contacts = list);
      final openId = widget.initialPeerId ?? _peer?['id']?.toString();
      if (openId == null) return;
      for (final c in list) {
        if (c['id']?.toString() == openId) {
          setState(() {
            _peer = {
              ...?_peer,
              ...c,
            };
          });
          break;
        }
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.fetchContacts();
      if (!mounted) return;
      setState(() {
        _contacts = list;
        _loading = false;
      });
      final openId = widget.initialPeerId;
      if (openId != null && openId.isNotEmpty) {
        Map<String, dynamic>? peer;
        for (final c in list) {
          if (c['id']?.toString() == openId) {
            peer = c;
            break;
          }
        }
        peer ??= {
          'id': openId,
          'displayName': 'Chat',
        };
        await _openPeer(peer);
        if (!mounted) return;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _composerFocus.requestFocus();
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _connectSocket() {
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
    socket.onConnect((_) {
      final peerId = _peer?['id'];
      if (peerId != null) {
        socket.emit('dm:join', {'peerId': peerId});
      }
    });
    socket.on('dm:message', (data) {
      if (data is! Map) return;
      final msg = Map<String, dynamic>.from(data);
      final peerId = _peer?['id']?.toString();
      if (peerId == null) return;
      final sender = msg['senderId']?.toString();
      final recipient = msg['recipientId']?.toString();
      final me = widget.api.user?['id']?.toString();
      if (sender != peerId && recipient != peerId && sender != me) return;
      setState(() {
        final cid = msg['clientMsgId']?.toString();
        if (cid != null && cid.isNotEmpty) {
          final idx = _messages.indexWhere(
            (m) =>
                m['id']?.toString() == cid ||
                m['clientMsgId']?.toString() == cid,
          );
          if (idx >= 0) {
            final next = [..._messages];
            next[idx] = msg;
            _messages = next;
            return;
          }
        }
        if (!_messages.any((m) => m['id'] == msg['id'])) {
          _messages = [..._messages, msg];
        }
      });
      final mid = msg['id']?.toString();
      if (mid != null && sender == peerId) {
        playInChatMessageTone();
        widget.api.markDmRead(peerId, mid).catchError((_) {});
      }
    });
    socket.on('dm:error', (data) {
      if (data is! Map) return;
      final m = Map<String, dynamic>.from(data);
      final cid = m['clientMsgId']?.toString();
      if (!mounted) return;
      setState(() {
        if (cid != null && cid.isNotEmpty) {
          _messages = _messages
              .where(
                (x) =>
                    !(x['_local'] == true &&
                        (x['id']?.toString() == cid ||
                            x['clientMsgId']?.toString() == cid)),
              )
              .toList();
        }
        _error = m['error']?.toString() ?? 'No se pudo enviar';
      });
    });
    socket.on('dm:receipts', (data) {
      if (data is! Map) return;
      final ids = (data['messageIds'] as List? ?? []).map((e) => e.toString()).toSet();
      if (ids.isEmpty) return;
      setState(() {
        _messages = _messages.map((m) {
          if (!ids.contains(m['id']?.toString())) return m;
          return {...m, 'readCount': 1, 'readFully': true};
        }).toList();
      });
    });
    socket.on('dm:deleted', (data) {
      if (data is! Map) return;
      final msg = Map<String, dynamic>.from(data);
      final mid = msg['id']?.toString();
      if (mid == null) return;
      setState(() {
        _messages = _messages.map((m) {
          if (m['id']?.toString() != mid) return m;
          return {...m, ...msg, 'isDeleted': true, 'body': null};
        }).toList();
      });
    });
    socket.on('dm:reaction', (data) {
      if (data is! Map) return;
      final mid = data['messageId']?.toString();
      if (mid == null) return;
      final reactions = (data['reactions'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      setState(() {
        _messages = _messages.map((m) {
          if (m['id']?.toString() != mid) return m;
          return {...m, 'reactions': reactions};
        }).toList();
      });
    });
    socket.on('dm:cleared', (data) {
      if (data is! Map) return;
      final peerId = _peer?['id']?.toString();
      if (peerId == null) return;
      final m = Map<String, dynamic>.from(data);
      final eventPeer = m['peerId']?.toString();
      final by = m['byUserId']?.toString();
      final me = widget.api.user?['id']?.toString();
      final threadPeer = by == me ? eventPeer : by;
      if (threadPeer != peerId) return;
      setState(() => _messages = []);
    });
    // Llamadas entrantes: las maneja RadioShell (pantalla fullscreen).
    _socket = socket;
    socket.connect();
  }

  Future<void> _clearCurrentThread() async {
    final peerId = _peer?['id']?.toString();
    final name = _peer?['displayName']?.toString() ?? 'Chat';
    if (peerId == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vaciar chat'),
        content: Text('Se borrarán todos los mensajes con «$name» para ambos.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Vaciar')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await widget.api.clearDmThread(peerId);
      if (!mounted) return;
      setState(() => _messages = []);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chat vaciado')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _loadPinned() async {
    final scope = _pinScope;
    if (scope == null) {
      setState(() => _pinned = null);
      return;
    }
    final pin = await ChatPinStore.get(scope);
    if (!mounted) return;
    setState(() => _pinned = pin);
  }

  Future<void> _openPeer(Map<String, dynamic> peer) async {
    final peerId = peer['id']?.toString();
    setState(() {
      _peer = peer;
      _messages = [];
      _error = null;
      _replyTo = null;
    });
    // Pin y mensajes en paralelo (antes se esperaba el pin y bloqueaba el hilo).
    final pinFut = _loadPinned();
    if (peerId != null && peerId.isNotEmpty) {
      PushService.instance.clearConversationNotifications(peerId: peerId);
    }
    _socket?.emit('dm:join', {'peerId': peer['id']});
    // Si el socket aún no conectó, onConnect reintentará el join.
    try {
      final data = await widget.api.fetchDmMessages(peer['id'] as String);
      if (!mounted) return;
      setState(() {
        _peer = Map<String, dynamic>.from(data['peer'] as Map? ?? peer);
        _messages = (data['messages'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
      if (_messages.isNotEmpty) {
        final lastId = _messages.last['id']?.toString();
        if (lastId != null) {
          widget.api.markDmRead(peer['id'].toString(), lastId).catchError((_) {});
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
    await pinFut;
  }

  Future<void> _send() async {
    final peer = _peer;
    final text = _draft.text.trim();
    if (peer == null || text.isEmpty) return;
    setState(() => _showEmojiPanel = false);
    final me = widget.api.user?['id'];
    final replySnapshot = _replyTo;
    final replyId = replySnapshot?['id']?.toString();
    final clientId = 'local-${DateTime.now().microsecondsSinceEpoch}';
    final optimistic = <String, dynamic>{
      'id': clientId,
      'clientMsgId': clientId,
      'senderId': me,
      'recipientId': peer['id'],
      'body': text,
      'type': 'text',
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'readCount': 0,
      'readFully': false,
      'isDeleted': false,
      '_local': true,
      if (replySnapshot != null)
        'reply': {
          'id': replySnapshot['id'],
          'body': replySnapshot['body'],
          'type': replySnapshot['type'],
          'displayName': replySnapshot['displayName'] ??
              (replySnapshot['senderId'] == me ? 'Tú' : _peer?['displayName']),
          'isDeleted': replySnapshot['isDeleted'] == true,
        },
    };
    _draft.clear();
    setState(() {
      _replyTo = null;
      _messages = [..._messages, optimistic];
    });
    try {
      // Asegura sala DM antes de enviar (por si el join inicial se perdió).
      if (_socket?.connected == true) {
        _socket!.emit('dm:join', {'peerId': peer['id']});
        _socket!.emit('dm:send', {
          'peerId': peer['id'],
          'body': text,
          'clientMsgId': clientId,
          if (replyId != null) 'replyToId': replyId,
        });
      } else {
        final data = await widget.api.sendDmMessage(
          peer['id'] as String,
          text,
          replyToId: replyId,
        );
        final msg = Map<String, dynamic>.from(data['message'] as Map);
        if (!mounted) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m['id'] == clientId);
          if (idx >= 0) {
            final next = [..._messages];
            next[idx] = msg;
            _messages = next;
          } else if (!_messages.any((m) => m['id'] == msg['id'])) {
            _messages = [..._messages, msg];
          }
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((m) => m['id'] != clientId).toList();
        _error = e.toString();
      });
    }
  }

  void _goBack() {
    if (widget.threadOnly) {
      widget.onBack();
      return;
    }
    if (_peer != null) {
      final peerId = _peer!['id'];
      _socket?.emit('dm:leave', {'peerId': peerId});
      setState(() {
        _peer = null;
        _messages = [];
        _replyTo = null;
        _error = null;
      });
      return;
    }
    widget.onBack();
  }

  String _fmtTime(dynamic iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso.toString())?.toLocal();
    if (dt == null) return '';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  void _toggleEmojiPanel() {
    if (_uploading) return;
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

  Future<void> _sendSticker(Map<String, dynamic> sticker) async {
    final peer = _peer;
    final id = sticker['id']?.toString() ?? '';
    if (peer == null || id.isEmpty || _uploading) return;
    setState(() => _showEmojiPanel = false);
    try {
      final data = await widget.api.sendDmSticker(
        peer['id'].toString(),
        id,
        replyToId: _replyTo?['id']?.toString(),
      );
      final msg = data['message'];
      if (msg is Map && mounted) {
        setState(() {
          _replyTo = null;
          final map = Map<String, dynamic>.from(msg);
          if (!_messages.any((m) => m['id'] == map['id'])) {
            _messages = [..._messages, map];
          }
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _openAttachMenu() async {
    if (_uploading || _peer == null) return;
    final choice = await showChatAttachSheet(context);
    if (!mounted || choice == null) return;
    if (choice == 'gallery') {
      await _pickImage(ImageSource.gallery);
    } else if (choice == 'camera') {
      await _pickImage(ImageSource.camera);
    } else if (choice == 'video') {
      await _pickVideo();
    } else if (choice == 'file') {
      await _pickFile();
    }
  }

  Future<void> _sendMediaFile({
    required String path,
    required String filename,
    String? mime,
    required String type,
    String? caption,
  }) async {
    final peer = _peer;
    if (peer == null) return;
    setState(() => _uploading = true);
    try {
      final msg = await widget.api.uploadDmMedia(
        peer['id'].toString(),
        filePath: path,
        filename: filename,
        mime: mime,
        type: type,
        body: (caption != null && caption.isNotEmpty)
            ? caption
            : (_draft.text.trim().isEmpty ? null : _draft.text.trim()),
        replyToId: _replyTo?['id']?.toString(),
      );
      _draft.clear();
      if (!mounted) return;
      setState(() {
        _replyTo = null;
        if (!_messages.any((x) => x['id'] == msg['id'])) {
          _messages = [..._messages, msg];
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    await Permission.photos.request();
    await Permission.camera.request();
    await AudioSessionSetup.pauseForCamera();
    try {
      final x = await ImagePicker().pickImage(
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
        initialCaption: _draft.text.trim().isEmpty ? null : _draft.text.trim(),
      );
      if (caption == null) return;
      await _sendMediaFile(
        path: x.path,
        filename: x.name,
        mime: x.mimeType,
        type: 'image',
        caption: caption,
      );
    } finally {
      await AudioSessionSetup.resumeAfterCamera();
    }
  }

  Future<void> _pickVideo() async {
    await Permission.photos.request();
    final x = await ImagePicker().pickVideo(
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
      initialCaption: _draft.text.trim().isEmpty ? null : _draft.text.trim(),
    );
    if (caption == null) return;
    await _sendMediaFile(
      path: x.path,
      filename: x.name,
      mime: x.mimeType ?? 'video/mp4',
      type: 'video',
      caption: caption,
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(withData: false, type: FileType.any);
    final f = result?.files.single;
    if (f?.path == null) return;
    if (!mounted) return;
    final caption = await showMediaSendConfirm(
      context,
      path: f!.path!,
      kind: 'file',
      filename: f.name,
      initialCaption: _draft.text.trim().isEmpty ? null : _draft.text.trim(),
    );
    if (caption == null) return;
    await _sendMediaFile(
      path: f.path!,
      filename: f.name,
      type: classifyUploadName(f.name),
      caption: caption,
    );
  }

  Future<void> _messageActions(Map<String, dynamic> m, bool mine) async {
    final peer = _peer;
    if (peer == null) return;
    final deleted = m['isDeleted'] == true;
    final body = m['body']?.toString() ?? '';
    final hasText = body.trim().isNotEmpty && !deleted;
    final hasMedia = (m['mediaUrl']?.toString().isNotEmpty ?? false) && !deleted;
    final pinnedId = _pinned?['id'];
    final choice = await showChatMessageActionsSheet(
      context: context,
      mine: mine,
      isDeleted: deleted,
      hasText: hasText,
      hasMedia: hasMedia,
      canReply: !deleted,
      canReact: !deleted,
      canCopy: hasText,
      canForward: !deleted,
      canPin: !deleted,
      isPinned: pinnedId == m['id']?.toString(),
      canDelete: mine && !deleted,
      canDownload: hasMedia,
    );
    if (!mounted || choice == null) return;
    final peerId = peer['id'].toString();
    final mid = m['id']?.toString();
    if (mid == null) return;

    switch (choice.id) {
      case 'reply':
        setState(() => _replyTo = m);
        _composerFocus.requestFocus();
        break;
      case 'react':
        if (choice.emoji != null) {
          try {
            final data = await widget.api.reactToDmMessage(peerId, mid, choice.emoji!);
            final reactions = (data['reactions'] as List? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            if (!mounted) return;
            setState(() {
              _messages = _messages.map((x) {
                if (x['id']?.toString() != mid) return x;
                return {...x, 'reactions': reactions};
              }).toList();
            });
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
          }
        }
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
        if (emoji != null && mounted) {
          try {
            final data = await widget.api.reactToDmMessage(peerId, mid, emoji);
            final reactions = (data['reactions'] as List? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            if (!mounted) return;
            setState(() {
              _messages = _messages.map((x) {
                if (x['id']?.toString() != mid) return x;
                return {...x, 'reactions': reactions};
              }).toList();
            });
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
          }
        }
        break;
      case 'copy':
        await copyChatText(body);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mensaje copiado'), duration: Duration(seconds: 1)),
        );
        break;
      case 'forward':
        final target = await pickForwardContact(
          context: context,
          loadContacts: () => widget.api.fetchContacts(),
        );
        if (target == null || !mounted) return;
        final fwd = chatForwardPreview(
          type: m['type']?.toString() ?? 'text',
          body: body,
          mediaName: m['mediaName']?.toString(),
          isDeleted: deleted,
        );
        try {
          await widget.api.sendDmMessage(target['id'].toString(), fwd);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Reenviado a ${target['displayName'] ?? 'contacto'}')),
          );
        } catch (e) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
        }
        break;
      case 'pin':
        final scope = _pinScope;
        if (scope == null) return;
        await ChatPinStore.set(
          scopeId: scope,
          messageId: mid,
          title: mine
              ? 'Tú'
              : (peer['displayName']?.toString() ?? 'Chat'),
          preview: chatForwardPreview(
            type: m['type']?.toString() ?? 'text',
            body: body,
            mediaName: m['mediaName']?.toString(),
          ),
        );
        await _loadPinned();
        break;
      case 'unpin':
        final scope = _pinScope;
        if (scope == null) return;
        await ChatPinStore.clear(scope);
        await _loadPinned();
        break;
      case 'delete':
        try {
          final data = await widget.api.deleteDmMessage(peerId, mid);
          final msg = Map<String, dynamic>.from(data);
          if (!mounted) return;
          setState(() {
            _messages = _messages.map((x) {
              if (x['id']?.toString() != mid) return x;
              return {...x, ...msg, 'isDeleted': true, 'body': null};
            }).toList();
          });
          if (_pinned?['id'] == mid) {
            await ChatPinStore.clear(_pinScope!);
            await _loadPinned();
          }
        } catch (e) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
        }
        break;
      case 'download':
        final mediaUrl = m['mediaUrl']?.toString();
        final mediaName = m['mediaName']?.toString() ?? 'archivo';
        if (mediaUrl == null || mediaUrl.isEmpty) break;
        try {
          final file = await widget.api.downloadMediaToTemp(
            mediaUrl,
            filename: mediaName,
          );
          await OpenFilex.open(file.path);
        } catch (e) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('No se pudo abrir: $e')),
          );
        }
        break;
    }
  }

  Future<void> _startCall({String mode = 'call'}) async {
    final peer = _peer;
    if (peer == null) return;
    if (mode == 'radio') return;
    final isVideo = mode == 'video';
    if (isVideo) {
      await Permission.camera.request();
    }
    try {
      final data = await widget.api.startPrivateCall(
        peer['id'] as String,
        mode: isVideo ? 'video' : 'call',
      );
      if (!mounted) return;
      final call = data['call'] as Map? ?? {};
      await Navigator.of(context).push(
        PrivateCallScreen.route(
          child: PrivateCallScreen(
            api: widget.api,
            callId: call['callId']?.toString() ?? '',
            peerId: peer['id']?.toString(),
            peerName: peer['displayName']?.toString() ?? 'Usuario',
            token: data['token'] as String,
            url: AppConfig.publicLiveKitUrl(data['url'] as String),
            role: 'caller',
            e2eeKey: data['e2eeKey']?.toString(),
            mode: isVideo ? 'video' : 'call',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _draft.dispose();
    _composerFocus.dispose();
    _socket?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final me = widget.api.user?['id'];
    final imageGallery = <ChatGalleryItem>[
      for (final x in _messages)
        if (x['isDeleted'] != true &&
            ((x['mediaUrl']?.toString().isNotEmpty) ?? false) &&
            isImageMedia(
              type: x['type']?.toString(),
              mime: x['mediaMime']?.toString(),
              name: x['mediaName']?.toString() ?? x['mediaUrl']?.toString(),
            ))
          ChatGalleryItem(
            mediaUrl: x['mediaUrl'].toString(),
            caption: x['mediaName']?.toString() ?? x['body']?.toString(),
          ),
    ];
    const bubbleMine = kBubbleMine;
    const bubbleOther = kBubbleOther;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _goBack();
      },
      child: Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: kTacBg,
      body: TacticalBackdrop(
        child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Material(
              color: kTacHeader,
              elevation: 1,
              shadowColor: Colors.black54,
              child: SizedBox(
                height: 56,
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _goBack,
                      icon: const Icon(Icons.arrow_back),
                    ),
                    if (_peer != null) ...[
                      UserAvatar(
                        name: userDisplayLabel(_peer),
                        userId: _peer!['id']?.toString(),
                        avatarUrl: widget.api.peerAvatarNetworkUrl(
                          _peer!['id']?.toString(),
                          _peer!['avatarUrl']?.toString(),
                        ),
                        headers: widget.api.avatarAuthHeaders(),
                        radius: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              userDisplayLabel(_peer),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                                color: kTacOnSurface,
                                letterSpacing: 0.4,
                              ),
                            ),
                            if (userDisplaySubtitle(_peer).isNotEmpty)
                              Text(
                                userDisplaySubtitle(_peer),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: kTacMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Llamada privada',
                        onPressed: () => _startCall(mode: 'call'),
                        icon: const Icon(Icons.call, color: kTacOnSurface),
                      ),
                      IconButton(
                        tooltip: 'Videollamada',
                        onPressed: () => _startCall(mode: 'video'),
                        icon: const Icon(Icons.videocam, color: kTacOnSurface),
                      ),
                      PopupMenuButton<String>(
                        tooltip: 'Opciones',
                        color: kTacSurface,
                        onSelected: (v) {
                          if (v == 'video') {
                            _startCall(mode: 'video');
                            return;
                          }
                          if (v == 'clear') _clearCurrentThread();
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'video',
                            child: ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(Icons.videocam_outlined, color: kTacOnSurface),
                              title: Text('Videollamada', style: TextStyle(color: kTacOnSurface)),
                            ),
                          ),
                          PopupMenuItem(
                            value: 'clear',
                            child: Text('Vaciar chat', style: TextStyle(color: kTacOnSurface)),
                          ),
                        ],
                      ),
                    ] else
                      const Expanded(
                        child: Text(
                          'Directos',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Text(_error!, style: const TextStyle(color: kRadioDanger, fontSize: 13)),
              ),
            if (_loading)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (_peer == null && widget.threadOnly)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (_peer == null)
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: _contacts.length,
                  itemBuilder: (context, i) {
                    final c = _contacts[i];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                      leading: CircleAvatar(
                        backgroundColor: kRadioBlue.withValues(alpha: 0.15),
                        child: Text(
                          (c['displayName'] as String? ?? '?').substring(0, 1).toUpperCase(),
                          style: const TextStyle(color: kRadioBlue, fontWeight: FontWeight.w700),
                        ),
                      ),
                      title: Text(
                        c['displayName']?.toString() ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(c['role']?.toString() ?? ''),
                      onTap: () => _openPeer(c),
                    );
                  },
                ),
              )
            else
              Expanded(
                child: Column(
                  children: [
                    if (_pinned != null)
                      Material(
                        color: const Color(0xFFE7F0D8),
                        child: ListTile(
                          dense: true,
                          leading: const Icon(Icons.push_pin, size: 18, color: kInstOlive),
                          title: Text(
                            _pinned!['title'] ?? 'Fijado',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: kInstOlive,
                            ),
                          ),
                          subtitle: Text(
                            _pinned!['preview'] ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () async {
                              final scope = _pinScope;
                              if (scope == null) return;
                              await ChatPinStore.clear(scope);
                              await _loadPinned();
                            },
                          ),
                        ),
                      ),
                    Expanded(
                      child: _messages.isEmpty
                          ? const Center(
                              child: Text(
                                'Sin mensajes aún',
                                style: TextStyle(color: kInstMuted),
                              ),
                            )
                          : ListView.builder(
                              reverse: true,
                              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                              itemCount: _messages.length,
                              itemBuilder: (context, i) {
                                final m = _messages[_messages.length - 1 - i];
                                final mine = m['senderId'] == me;
                                final deleted = m['isDeleted'] == true;
                                final mediaUrl = m['mediaUrl']?.toString();
                                final mediaName = m['mediaName']?.toString();
                                final mediaMime = m['mediaMime']?.toString();
                                final caption = m['body']?.toString();
                                final sticker = m['sticker'] is Map
                                    ? Map<String, dynamic>.from(m['sticker'] as Map)
                                    : null;
                                final isSticker = m['type']?.toString() == 'sticker' && sticker != null;
                                final body = deleted
                                    ? 'Mensaje eliminado'
                                    : (caption?.isNotEmpty == true
                                        ? caption!
                                        : (isSticker
                                            ? ''
                                            : (mediaUrl == null
                                                ? (mediaName ?? m['type']?.toString() ?? '')
                                                : '')));
                                final reply = m['reply'] is Map
                                    ? Map<String, dynamic>.from(m['reply'] as Map)
                                    : null;
                                final reactions = (m['reactions'] as List? ?? [])
                                    .map((e) => Map<String, dynamic>.from(e as Map))
                                    .toList();
                                final time = _fmtTime(m['createdAt']);
                                final readFully = m['readFully'] == true;
                                final readCount = m['readCount'] is int
                                    ? m['readCount'] as int
                                    : int.tryParse('${m['readCount'] ?? 0}') ?? 0;
                                final tickRead = readFully || readCount > 0;
                                final mid = m['id']?.toString() ?? 'm-$i';
                                final idx = _messages.length - 1 - i;
                                final prev = idx > 0 ? _messages[idx - 1] : null;
                                final next = idx < _messages.length - 1 ? _messages[idx + 1] : null;
                                final prevId = prev?['senderId']?.toString();
                                final nextId = next?['senderId']?.toString();
                                final myId = m['senderId']?.toString();
                                final clusteredAbove = prevId != null && prevId == myId;
                                final clusteredBelow = nextId != null && nextId == myId;
                                final radius = chatBubbleRadius(
                                  mine: mine,
                                  clusteredAbove: clusteredAbove,
                                  clusteredBelow: clusteredBelow,
                                );
                                final meta = ChatBubbleMeta(
                                  time: time,
                                  mine: mine,
                                  read: tickRead,
                                  pending: m['_local'] == true,
                                );
                                final bubble = Align(
                                    alignment:
                                        mine ? Alignment.centerRight : Alignment.centerLeft,
                                    child: ConstrainedBox(
                                      constraints: BoxConstraints(
                                        maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                                        minWidth: chatBubbleMinWidth(
                                          showMeta: time.isNotEmpty || mine,
                                        ),
                                      ),
                                      child: IntrinsicWidth(
                                        child: GestureDetector(
                                          onLongPress: () => _messageActions(m, mine),
                                          child: Container(
                                            decoration: BoxDecoration(
                                              color: mine ? bubbleMine : bubbleOther,
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
                                            child: deleted
                                                ? const Padding(
                                                    padding: EdgeInsets.fromLTRB(10, 8, 10, 8),
                                                    child: Text(
                                                      'Mensaje eliminado',
                                                      style: TextStyle(
                                                        fontStyle: FontStyle.italic,
                                                        color: kChatMeta,
                                                        fontSize: 14,
                                                      ),
                                                    ),
                                                  )
                                                : chatBubbleFramedContent(
                                                    padding: const EdgeInsets.fromLTRB(10, 7, 10, 6),
                                                    meta: meta,
                                                    body: Column(
                                                          crossAxisAlignment: CrossAxisAlignment.start,
                                                          mainAxisSize: MainAxisSize.min,
                                                          children: [
                                                            if (reply != null)
                                                              Container(
                                                                width: double.infinity,
                                                                margin: const EdgeInsets.only(bottom: 5),
                                                                padding: const EdgeInsets.fromLTRB(8, 5, 8, 5),
                                                                decoration: BoxDecoration(
                                                                  color: Colors.black.withValues(alpha: 0.05),
                                                                  borderRadius: BorderRadius.circular(8),
                                                                  border: const Border(
                                                                    left: BorderSide(color: kInstOlive, width: 3),
                                                                  ),
                                                                ),
                                                                child: Text(
                                                                  reply['isDeleted'] == true
                                                                      ? 'Mensaje eliminado'
                                                                      : '${reply['displayName'] ?? ''}: ${reply['body'] ?? reply['type'] ?? ''}',
                                                                  maxLines: 2,
                                                                  overflow: TextOverflow.ellipsis,
                                                                  style: const TextStyle(
                                                                    fontSize: 12.5,
                                                                    color: kChatMeta,
                                                                    height: 1.25,
                                                                  ),
                                                                ),
                                                              ),
                                                            if (isSticker)
                                                              Padding(
                                                                padding: const EdgeInsets.symmetric(vertical: 4),
                                                                child: Text(
                                                                  sticker['value']?.toString() ?? '🎭',
                                                                  style: const TextStyle(
                                                                    fontSize: 72,
                                                                    height: 1.05,
                                                                    fontFamilyFallback: [
                                                                      'Noto Color Emoji',
                                                                      'Segoe UI Emoji',
                                                                      'Apple Color Emoji',
                                                                    ],
                                                                  ),
                                                                ),
                                                              ),
                                                            if (mediaUrl != null && mediaUrl.isNotEmpty)
                                                              Padding(
                                                                padding: EdgeInsets.only(
                                                                  bottom: body.isNotEmpty ? 4 : 0,
                                                                ),
                                                                child: _DmMediaChip(
                                                                  api: widget.api,
                                                                  mediaUrl: mediaUrl,
                                                                  name: mediaName ?? 'Archivo',
                                                                  mime: mediaMime,
                                                                  type: m['type']?.toString(),
                                                                  size: m['mediaSize'] is int
                                                                      ? m['mediaSize'] as int
                                                                      : int.tryParse('${m['mediaSize'] ?? ''}'),
                                                                  gallery: imageGallery,
                                                                ),
                                                              ),
                                                            if (body.isNotEmpty)
                                                              LinkifiedText(
                                                                body,
                                                                style: const TextStyle(
                                                                  fontSize: 15.5,
                                                                  height: 1.35,
                                                                  color: kInstInk,
                                                                  letterSpacing: 0.05,
                                                                ),
                                                              ),
                                                            if (reactions.isNotEmpty)
                                                              Padding(
                                                                padding: const EdgeInsets.only(top: 4),
                                                                child: Wrap(
                                                                  spacing: 4,
                                                                  runSpacing: 2,
                                                                  children: reactions.map((r) {
                                                                    final emoji = r['emoji']?.toString() ?? '';
                                                                    final count = r['count'] ?? 1;
                                                                    return Container(
                                                                      padding: const EdgeInsets.symmetric(
                                                                        horizontal: 6,
                                                                        vertical: 2,
                                                                      ),
                                                                      decoration: BoxDecoration(
                                                                        color: Colors.white.withValues(alpha: 0.75),
                                                                        borderRadius: BorderRadius.circular(12),
                                                                      ),
                                                                      child: Text(
                                                                        '$emoji $count',
                                                                        style: const TextStyle(fontSize: 12.5),
                                                                      ),
                                                                    );
                                                                  }).toList(),
                                                                ),
                                                              ),
                                                          ],
                                                        ),
                                                  ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                return Padding(
                                  padding: chatBubbleOuterPadding(
                                    mine: mine,
                                    clusteredAbove: clusteredAbove,
                                    clusteredBelow: clusteredBelow,
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    mainAxisAlignment:
                                        mine ? MainAxisAlignment.end : MainAxisAlignment.start,
                                    children: [
                                      if (!mine && !clusteredAbove) ...[
                                        UserAvatar(
                                          name: m['displayName']?.toString() ?? '?',
                                          userId: m['senderId']?.toString(),
                                          avatarUrl: widget.api.peerAvatarNetworkUrl(
                                            m['senderId']?.toString(),
                                          ),
                                          headers: widget.api.avatarAuthHeaders(),
                                          radius: 14,
                                        ),
                                        const SizedBox(width: 6),
                                      ] else if (!mine)
                                        const SizedBox(width: 34),
                                      Flexible(
                                        child: deleted
                                            ? bubble
                                            : Dismissible(
                                                key: ValueKey('dm-swipe-$mid'),
                                                direction: DismissDirection.startToEnd,
                                                confirmDismiss: (_) async {
                                                  setState(() => _replyTo = m);
                                                  _composerFocus.requestFocus();
                                                  return false;
                                                },
                                                background: const Align(
                                                  alignment: Alignment.centerLeft,
                                                  child: Padding(
                                                    padding: EdgeInsets.only(left: 12),
                                                    child: Icon(Icons.reply, color: kInstOlive, size: 22),
                                                  ),
                                                ),
                                                child: bubble,
                                              ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                    if (_replyTo != null)
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
                              'Respondiendo a ${_replyTo!['senderId'] == me ? 'ti' : (_peer?['displayName'] ?? 'mensaje')}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: kInstOlive,
                              ),
                            ),
                            subtitle: Text(
                              _replyTo!['body']?.toString() ??
                                  _replyTo!['type']?.toString() ??
                                  '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () => setState(() => _replyTo = null),
                            ),
                          ),
                        ),
                      ),
                    Material(
                      color: kComposerBar,
                      elevation: 0,
                      child: SafeArea(
                        top: false,
                        bottom: !_showEmojiPanel,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(4, 6, 6, 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              IconButton(
                                onPressed: _uploading ? null : _openAttachMenu,
                                icon: Icon(
                                  _uploading ? Icons.hourglass_top : Icons.add_circle_outline,
                                  color: kInstOlive,
                                  size: 26,
                                ),
                                tooltip: 'Adjuntar',
                              ),
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(22),
                                    border: Border.all(color: const Color(0xFFE0E0E0)),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        onPressed: _uploading ? null : _toggleEmojiPanel,
                                        icon: Icon(
                                          _showEmojiPanel
                                              ? Icons.keyboard_alt_outlined
                                              : Icons.emoji_emotions_outlined,
                                          color: kChatMeta,
                                        ),
                                        tooltip: _showEmojiPanel ? 'Teclado' : 'Emojis y stickers',
                                      ),
                                      Expanded(
                                        child: TextField(
                                          controller: _draft,
                                          focusNode: _composerFocus,
                                          autofocus: widget.initialPeerId != null,
                                          minLines: 1,
                                          maxLines: 5,
                                          enabled: !_uploading,
                                          style: const TextStyle(
                                            fontSize: 15.5,
                                            height: 1.3,
                                            color: kInstInk,
                                          ),
                                          decoration: InputDecoration(
                                            hintText: _uploading ? 'Subiendo…' : 'Mensaje',
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
                                          onSubmitted: (_) => _send(),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Material(
                                color: kInstOlive,
                                shape: const CircleBorder(),
                                elevation: 1,
                                shadowColor: Colors.black26,
                                child: InkWell(
                                  customBorder: const CircleBorder(),
                                  onTap: _uploading ? null : _send,
                                  child: const SizedBox(
                                    width: 46,
                                    height: 46,
                                    child: Icon(Icons.send_rounded, color: Colors.white, size: 22),
                                  ),
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
                          final t = _draft.text;
                          final sel = _draft.selection;
                          final start = sel.isValid ? sel.start : t.length;
                          final end = sel.isValid ? sel.end : t.length;
                          final next = t.replaceRange(start, end, e);
                          _draft.value = TextEditingValue(
                            text: next,
                            selection: TextSelection.collapsed(offset: start + e.length),
                          );
                        },
                        onSticker: _sendSticker,
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
      ),
    ),
    );
  }
}

class _DmMediaChip extends StatefulWidget {
  const _DmMediaChip({
    required this.api,
    required this.mediaUrl,
    required this.name,
    this.mime,
    this.type,
    this.size,
    this.gallery = const [],
  });

  final ApiClient api;
  final String mediaUrl;
  final String name;
  final String? mime;
  final String? type;
  final int? size;
  final List<ChatGalleryItem> gallery;

  @override
  State<_DmMediaChip> createState() => _DmMediaChipState();
}

class _DmMediaChipState extends State<_DmMediaChip> {
  bool _busy = false;

  Future<void> _open() async {
    final image = isImageMedia(type: widget.type, mime: widget.mime, name: widget.name);
    if (image) {
      final items = widget.gallery.isNotEmpty
          ? widget.gallery
          : [ChatGalleryItem(mediaUrl: widget.mediaUrl, caption: widget.name)];
      var initial = items.indexWhere((e) => e.mediaUrl == widget.mediaUrl);
      if (initial < 0) initial = 0;
      await openChatImageGallery(
        context: context,
        api: widget.api,
        items: items,
        initialIndex: initial,
      );
      return;
    }
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
    final video = isVideoMedia(type: widget.type, mime: widget.mime, name: widget.name);
    final image = isImageMedia(type: widget.type, mime: widget.mime, name: widget.name);
    if (image) {
      return _DmAuthThumb(
        api: widget.api,
        mediaUrl: widget.mediaUrl,
        caption: widget.name,
        gallery: widget.gallery,
        onOpen: _open,
      );
    }
    final emoji = video ? '🎬' : fileKindEmoji(widget.name, widget.mime);
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13.5,
                      color: kInstInk,
                    ),
                  ),
                  Text(
                    [
                      if (video) 'Video',
                      if (sizeLabel.isNotEmpty) sizeLabel,
                      'Tocar para abrir',
                    ].where((e) => e.isNotEmpty).join(' · '),
                    style: const TextStyle(fontSize: 11, color: kInstMuted),
                  ),
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

class _DmAuthThumb extends StatefulWidget {
  const _DmAuthThumb({
    required this.api,
    required this.mediaUrl,
    required this.onOpen,
    this.caption,
    this.gallery = const [],
  });

  final ApiClient api;
  final String mediaUrl;
  final String? caption;
  final List<ChatGalleryItem> gallery;
  final VoidCallback onOpen;

  @override
  State<_DmAuthThumb> createState() => _DmAuthThumbState();
}

class _DmAuthThumbState extends State<_DmAuthThumb> {
  Uint8List? _bytes;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _DmAuthThumb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mediaUrl != widget.mediaUrl) {
      _bytes = null;
      _err = null;
      _load();
    }
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
      if (!mounted) return;
      if (res.statusCode >= 400) {
        setState(() => _err = 'Error ${res.statusCode}');
        return;
      }
      setState(() => _bytes = res.bodyBytes);
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_err != null) {
      return Text(_err!, style: const TextStyle(fontSize: 12, color: Colors.red));
    }
    if (_bytes == null) {
      return const SizedBox(
        height: 160,
        width: 220,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: kInstOlive)),
      );
    }
    return GestureDetector(
      onTap: widget.onOpen,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
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
