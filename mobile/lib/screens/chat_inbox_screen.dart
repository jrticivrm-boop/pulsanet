import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../app_focus.dart';
import '../channel_session.dart';
import '../config.dart';
import '../peer_actions.dart';
import '../theme.dart';
import '../widgets/tactical_backdrop.dart';
import '../widgets/user_avatar.dart';
import 'call_history_pane.dart';
import 'group_video_screen.dart';
import 'chat_panel.dart';

const _favKey = 'tacticalptx_chat_favorites';
const _hiddenKey = 'tacticalptx_chat_hidden';

enum InboxTab { all, unread, favorites, groups }

enum InboxMainSection { chats, calls }

class ChatFavorites {
  ChatFavorites({this.dm = const [], this.group = const []});

  final List<String> dm;
  final List<String> group;

  factory ChatFavorites.fromJson(Map<String, dynamic> j) => ChatFavorites(
        dm: (j['dm'] as List? ?? []).map((e) => e.toString()).toList(),
        group: (j['group'] as List? ?? []).map((e) => e.toString()).toList(),
      );

  Map<String, dynamic> toJson() => {'dm': dm, 'group': group};

  bool isFavorite(String kind, String id) =>
      kind == 'group' ? group.contains(id) : dm.contains(id);
}

/// Chats ocultos del inbox (estilo WhatsApp «borrar chat»); reaparecen con mensaje nuevo.
class ChatHidden {
  ChatHidden({this.dm = const [], this.group = const []});

  final List<String> dm;
  final List<String> group;

  factory ChatHidden.fromJson(Map<String, dynamic> j) => ChatHidden(
        dm: (j['dm'] as List? ?? []).map((e) => e.toString()).toList(),
        group: (j['group'] as List? ?? []).map((e) => e.toString()).toList(),
      );

  Map<String, dynamic> toJson() => {'dm': dm, 'group': group};

  bool isHidden(String kind, String id) =>
      kind == 'group' ? group.contains(id) : dm.contains(id);
}

Future<ChatFavorites> loadChatFavorites() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_favKey);
    if (raw == null || raw.isEmpty) return ChatFavorites();
    return ChatFavorites.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
  } catch (_) {
    return ChatFavorites();
  }
}

Future<void> saveChatFavorites(ChatFavorites fav) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_favKey, jsonEncode(fav.toJson()));
  } catch (_) {}
}

Future<ChatHidden> loadChatHidden() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_hiddenKey);
    if (raw == null || raw.isEmpty) return ChatHidden();
    return ChatHidden.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
  } catch (_) {
    return ChatHidden();
  }
}

Future<void> saveChatHidden(ChatHidden hidden) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_hiddenKey, jsonEncode(hidden.toJson()));
  } catch (_) {}
}

class InboxRow {
  InboxRow({
    required this.key,
    required this.kind,
    required this.id,
    required this.name,
    required this.preview,
    this.avatarUrl,
    this.at,
    this.unread = 0,
    this.favorite = false,
    this.isContactOnly = false,
  });

  final String key;
  final String kind;
  final String id;
  final String name;
  final String preview;
  final String? avatarUrl;
  final String? at;
  final int unread;
  final bool favorite;
  final bool isContactOnly;
}

/// Bandeja estilo WhatsApp: Todos | No leídos | Favoritos | Grupos.
class ChatInboxScreen extends StatefulWidget {
  const ChatInboxScreen({
    super.key,
    required this.api,
    required this.groups,
    required this.session,
    required this.onOpenGroup,
    required this.onOpenDm,
    this.onUnreadTotalChanged,
    this.viewingKind,
    this.viewingId,
  });

  final ApiClient api;
  final List<Map<String, dynamic>> groups;
  final ChannelSession session;
  final Future<void> Function(String groupId, String name, {String? messageId})
      onOpenGroup;
  final Future<void> Function(String peerId, String name) onOpenDm;
  final ValueChanged<int>? onUnreadTotalChanged;
  /// Conversación abierta encima del inbox (evita badge mientras se lee).
  final String? viewingKind;
  final String? viewingId;

  @override
  State<ChatInboxScreen> createState() => ChatInboxScreenState();
}

class ChatInboxScreenState extends State<ChatInboxScreen> {
  InboxMainSection _section = InboxMainSection.chats;
  InboxTab _tab = InboxTab.all;
  ChatFavorites _favorites = ChatFavorites();
  ChatHidden _hidden = ChatHidden();
  final Map<String, int> _unread = {};
  List<Map<String, dynamic>> _dmConversations = [];
  List<Map<String, dynamic>> _contacts = [];
  String _query = '';
  bool _loading = true;
  String? _error;
  io.Socket? _dmSocket;
  String? _lastGroupMsgId;
  int _lastMsgCount = 0;

  @override
  void initState() {
    super.initState();
    _lastMsgCount = widget.session.messages.length;
    widget.session.addListener(_onSession);
    _bootstrap();
    _connectDmSocket();
  }

  @override
  void didUpdateWidget(ChatInboxScreen old) {
    super.didUpdateWidget(old);
    if (old.session != widget.session) {
      old.session.removeListener(_onSession);
      widget.session.addListener(_onSession);
      _lastGroupMsgId = null;
      _lastMsgCount = widget.session.messages.length;
    }
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSession);
    _dmSocket?.dispose();
    super.dispose();
  }

  int get totalUnread =>
      _unread.values.fold<int>(0, (a, n) => a + (n > 0 ? n : 0));

  void clearUnread(String kind, String id) {
    final key = '$kind:$id';
    if (_unread.remove(key) != null) {
      _notifyUnreadTotal();
      if (mounted) setState(() {});
    }
  }

  void bumpUnread(String kind, String id) {
    final key = '$kind:$id';
    _unread[key] = (_unread[key] ?? 0) + 1;
    _unhideChat(kind, id);
    _notifyUnreadTotal();
    if (mounted) setState(() {});
  }

  void _unhideChat(String kind, String id) {
    if (!_hidden.isHidden(kind, id)) return;
    if (kind == 'group') {
      final list = List<String>.from(_hidden.group)..remove(id);
      _hidden = ChatHidden(dm: _hidden.dm, group: list);
    } else {
      final list = List<String>.from(_hidden.dm)..remove(id);
      _hidden = ChatHidden(group: _hidden.group, dm: list);
    }
    saveChatHidden(_hidden);
  }

  void _hideChat(String kind, String id) {
    setState(() {
      if (kind == 'group') {
        final list = List<String>.from(_hidden.group);
        if (!list.contains(id)) list.add(id);
        _hidden = ChatHidden(dm: _hidden.dm, group: list);
      } else {
        final list = List<String>.from(_hidden.dm);
        if (!list.contains(id)) list.add(id);
        _hidden = ChatHidden(group: _hidden.group, dm: list);
      }
      _unread.remove('$kind:$id');
    });
    saveChatHidden(_hidden);
    _notifyUnreadTotal();
  }

  Future<void> _clearChat(InboxRow row) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(row.kind == 'group' ? 'Vaciar grupo' : 'Vaciar chat'),
        content: Text(
          row.kind == 'group'
              ? 'Se borrarán todos los mensajes de «${row.name}» para todos los miembros.'
              : 'Se borrarán todos los mensajes con «${row.name}» para ambos.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Vaciar')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      if (row.kind == 'group') {
        await widget.api.clearGroupMessages(row.id);
        if (widget.session.groupId == row.id) {
          widget.session.clearLocalMessages();
        }
      } else {
        await widget.api.clearDmThread(row.id);
      }
      clearUnread(row.kind, row.id);
      await _reloadDmMeta();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(row.kind == 'group' ? 'Grupo vaciado' : 'Chat vaciado')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _showChatActions(InboxRow row) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.delete_sweep_outlined),
                title: Text(row.kind == 'group' ? 'Vaciar grupo' : 'Vaciar chat'),
                subtitle: const Text('Borra todos los mensajes'),
                onTap: () {
                  Navigator.pop(ctx);
                  _clearChat(row);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text('Borrar chat'),
                subtitle: const Text('Quita de la lista (reaparece con mensaje nuevo)'),
                onTap: () {
                  Navigator.pop(ctx);
                  _hideChat(row.kind, row.id);
                },
              ),
              ListTile(
                leading: Icon(row.favorite ? Icons.star : Icons.star_border),
                title: Text(row.favorite ? 'Quitar de favoritos' : 'Marcar favorito'),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleFavorite(row.kind, row.id);
                },
              ),
              ListTile(
                leading: const Icon(Icons.close),
                title: const Text('Cancelar'),
                onTap: () => Navigator.pop(ctx),
              ),
            ],
          ),
        );
      },
    );
  }

  void _notifyUnreadTotal() {
    widget.onUnreadTotalChanged?.call(totalUnread);
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final fav = await loadChatFavorites();
      final hidden = await loadChatHidden();
      final results = await Future.wait([
        widget.api.fetchDmConversations(),
        widget.api.fetchContacts(),
      ]);
      if (!mounted) return;
      setState(() {
        _favorites = fav;
        _hidden = hidden;
        _dmConversations = results[0];
        _contacts = results[1];
        _loading = false;
      });
      _notifyUnreadTotal();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _onSession() {
    if (!mounted) return;
    final session = widget.session;
    final me = widget.api.user?['id']?.toString();
    final gid = session.groupId;

    // DM notify desde ChannelSession (canal activo).
    final dm = session.lastDmNotify;
    if (dm != null) {
      session.lastDmNotify = null;
      final peerId = dm['peerId']?.toString();
      if (peerId != null && peerId.isNotEmpty) {
        _reloadDmMeta();
        final viewingDm =
            widget.viewingKind == 'dm' && widget.viewingId == peerId;
        if (!viewingDm) bumpUnread('dm', peerId);
      }
    }

    // Mensajes de grupo del canal enlazado.
    final msgs = session.messages;
    if (msgs.isEmpty) {
      _lastMsgCount = 0;
      setState(() {});
      return;
    }
    final last = msgs.last;
    if (_lastGroupMsgId == null) {
      _lastGroupMsgId = last.id;
      _lastMsgCount = msgs.length;
      setState(() {});
      return;
    }
    if (msgs.length <= _lastMsgCount && last.id == _lastGroupMsgId) {
      setState(() {});
      return;
    }
    _lastMsgCount = msgs.length;
    if (last.id == _lastGroupMsgId) {
      setState(() {});
      return;
    }
    _lastGroupMsgId = last.id;
    if (last.senderId == me || last.isDeleted || last.type == 'system') {
      setState(() {});
      return;
    }
    final viewingGroup =
        widget.viewingKind == 'group' && widget.viewingId == gid;
    if (!viewingGroup && !appInBackground) {
      bumpUnread('group', gid);
    }
    setState(() {});
  }

  void _connectDmSocket() {
    final token = widget.api.token;
    if (token == null) return;
    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    socket.connect();
    socket.on('dm:notify', (data) {
      if (data is! Map) return;
      final m = Map<String, dynamic>.from(data);
      final peerId = m['peerId']?.toString();
      if (peerId == null || peerId.isEmpty) return;
      _reloadDmMeta();
      final viewingDm =
          widget.viewingKind == 'dm' && widget.viewingId == peerId;
      if (!viewingDm) bumpUnread('dm', peerId);
    });
    socket.on('dm:message', (data) {
      if (data is! Map) return;
      final msg = Map<String, dynamic>.from(data);
      final me = widget.api.user?['id']?.toString();
      final senderId = msg['senderId']?.toString();
      if (senderId == me) return;
      final peerId = senderId;
      if (peerId == null || peerId.isEmpty) return;
      _reloadDmMeta();
      final viewingDm =
          widget.viewingKind == 'dm' && widget.viewingId == peerId;
      if (!viewingDm) bumpUnread('dm', peerId);
    });
    socket.on('dm:cleared', (data) {
      if (data is! Map) return;
      final m = Map<String, dynamic>.from(data);
      final peerId = m['peerId']?.toString();
      final by = m['byUserId']?.toString();
      final me = widget.api.user?['id']?.toString();
      // peerId = usuario con quien se vació (desde quien vació); by = quien vació.
      final other = by == me ? peerId : by;
      if (other != null && other.isNotEmpty) {
        clearUnread('dm', other);
      }
      _reloadDmMeta();
    });
    _dmSocket = socket;
  }

  Future<void> _reloadDmMeta() async {
    try {
      final conv = await widget.api.fetchDmConversations();
      if (!mounted) return;
      setState(() => _dmConversations = conv);
    } catch (_) {}
  }

  /// Tras volver de inactividad: refresca lista de chats.
  Future<void> refreshInbox() => _reloadDmMeta();

  void _toggleFavorite(String kind, String id) {
    setState(() {
      if (kind == 'group') {
        final list = List<String>.from(_favorites.group);
        if (list.contains(id)) {
          list.remove(id);
        } else {
          list.add(id);
        }
        _favorites = ChatFavorites(dm: _favorites.dm, group: list);
      } else {
        final list = List<String>.from(_favorites.dm);
        if (list.contains(id)) {
          list.remove(id);
        } else {
          list.add(id);
        }
        _favorites = ChatFavorites(group: _favorites.group, dm: list);
      }
    });
    saveChatFavorites(_favorites);
  }

  List<InboxRow> _buildRows() {
    final items = <InboxRow>[];
    final session = widget.session;
    final currentGid = session.groupId;

    for (final g in widget.groups) {
      final id = g['id']?.toString() ?? '';
      if (id.isEmpty) continue;
      if (_hidden.isHidden('group', id)) continue;
      final isCurrent = id == currentGid;
      ChatMessage? lastMsg;
      if (isCurrent && session.messages.isNotEmpty) {
        for (final m in session.messages.reversed) {
          if (!m.isDeleted) {
            lastMsg = m;
            break;
          }
        }
      }
      items.add(InboxRow(
        key: 'group:$id',
        kind: 'group',
        id: id,
        name: g['name']?.toString() ?? 'Grupo',
        avatarUrl: widget.api.groupAvatarNetworkUrl(
          id,
          g['avatarUrl']?.toString(),
        ),
        preview: lastMsg != null ? _previewText(lastMsg) : 'Canal de grupo',
        at: lastMsg?.createdAt,
        unread: _unread['group:$id'] ?? 0,
        favorite: _favorites.group.contains(id),
      ));
    }

    for (final c in _dmConversations) {
      final id = c['peerId']?.toString() ?? '';
      if (id.isEmpty) continue;
      if (_hidden.isHidden('dm', id)) continue;
      final last = c['lastMessage'] is Map
          ? Map<String, dynamic>.from(c['lastMessage'] as Map)
          : null;
      items.add(InboxRow(
        key: 'dm:$id',
        kind: 'dm',
        id: id,
        name: c['peerName']?.toString() ?? 'Chat',
        avatarUrl: widget.api.peerAvatarNetworkUrl(
          id,
          c['peerAvatarUrl']?.toString(),
        ),
        preview: _previewTextMap(last),
        at: last?['createdAt']?.toString(),
        unread: _unread['dm:$id'] ?? 0,
        favorite: _favorites.dm.contains(id),
      ));
    }

    for (final c in _contacts) {
      final id = c['id']?.toString() ?? '';
      if (id.isEmpty) continue;
      if (items.any((i) => i.kind == 'dm' && i.id == id)) continue;
      items.add(InboxRow(
        key: 'dm:$id',
        kind: 'dm',
        id: id,
        name: c['displayName']?.toString() ?? 'Usuario',
        avatarUrl: widget.api.peerAvatarNetworkUrl(
          id,
          c['avatarUrl']?.toString(),
        ),
        preview: 'Toca para escribir',
        unread: _unread['dm:$id'] ?? 0,
        favorite: _favorites.dm.contains(id),
        isContactOnly: true,
      ));
    }

    items.sort((a, b) {
      if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
      final ta = a.at != null ? DateTime.tryParse(a.at!) : null;
      final tb = b.at != null ? DateTime.tryParse(b.at!) : null;
      final na = ta?.millisecondsSinceEpoch ?? 0;
      final nb = tb?.millisecondsSinceEpoch ?? 0;
      if (nb != na) return nb.compareTo(na);
      if (a.isContactOnly != b.isContactOnly) {
        return a.isContactOnly ? 1 : -1;
      }
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return items;
  }

  List<InboxRow> _filteredRows(List<InboxRow> rows) {
    var list = rows;
    switch (_tab) {
      case InboxTab.unread:
        list = list.where((r) => r.unread > 0).toList();
        break;
      case InboxTab.favorites:
        list = list.where((r) => r.favorite).toList();
        break;
      case InboxTab.groups:
        list = list.where((r) => r.kind == 'group').toList();
        break;
      case InboxTab.all:
        break;
    }
    final q = _query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (r) =>
                r.name.toLowerCase().contains(q) ||
                r.preview.toLowerCase().contains(q),
          )
          .toList();
    } else if (_tab == InboxTab.all || _tab == InboxTab.favorites) {
      list = list
          .where((r) => !r.isContactOnly || r.favorite || r.unread > 0)
          .toList();
    }
    return list;
  }

  String _previewText(ChatMessage msg) {
    if (msg.isDeleted) return 'Mensaje eliminado';
    switch (msg.type) {
      case 'image':
        return '📷 Imagen';
      case 'audio':
        return '🎤 Audio';
      case 'sticker':
        return 'Sticker';
      case 'file':
        return '📎 Archivo';
      case 'system':
        return (msg.body ?? 'Aviso').toString().length > 60
            ? '${(msg.body ?? 'Aviso').toString().substring(0, 60)}…'
            : (msg.body ?? 'Aviso').toString();
      default:
        final b = msg.body ?? msg.type;
        final s = b.toString();
        return s.length > 80 ? '${s.substring(0, 80)}…' : s;
    }
  }

  String _previewTextMap(Map<String, dynamic>? msg) {
    if (msg == null) return 'Sin mensajes';
    if (msg['isDeleted'] == true) return 'Mensaje eliminado';
    final type = msg['type']?.toString() ?? 'text';
    switch (type) {
      case 'image':
        return '📷 Imagen';
      case 'audio':
        return '🎤 Audio';
      case 'sticker':
        return 'Sticker';
      case 'file':
        return '📎 Archivo';
      default:
        final s = msg['body']?.toString() ?? type;
        return s.length > 80 ? '${s.substring(0, 80)}…' : s;
    }
  }

  String _formatTime(String? value) {
    if (value == null || value.isEmpty) return '';
    try {
      final d = DateTime.parse(value).toLocal();
      final now = DateTime.now();
      final sameDay = d.year == now.year &&
          d.month == now.month &&
          d.day == now.day;
      if (sameDay) {
        final h = d.hour.toString().padLeft(2, '0');
        final m = d.minute.toString().padLeft(2, '0');
        return '$h:$m';
      }
      const months = [
        'ene', 'feb', 'mar', 'abr', 'may', 'jun',
        'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
      ];
      return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]}';
    } catch (_) {
      return '';
    }
  }

  Future<void> _selectRow(InboxRow row) async {
    _unhideChat(row.kind, row.id);
    clearUnread(row.kind, row.id);
    if (row.kind == 'group') {
      await widget.onOpenGroup(row.id, row.name);
    } else {
      await widget.onOpenDm(row.id, row.name);
    }
    if (mounted) await _reloadDmMeta();
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filteredRows(_buildRows());
    final total = totalUnread;

    return TacticalBackdrop(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _section == InboxMainSection.chats ? 'CHATS' : 'LLAMADAS',
                    style: TacticalFonts.display(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: kTacOnSurface,
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    _section == InboxMainSection.chats
                        ? 'Grupos y mensajes directos'
                        : 'Historial de voz, video y radio',
                    style: TextStyle(
                      fontSize: 13,
                      color: kTacMuted.withValues(alpha: 0.9),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _SectionToggle(
                    section: _section,
                    onChanged: (s) => setState(() => _section = s),
                  ),
                ],
              ),
            ),
            if (_section == InboxMainSection.calls)
              Expanded(
                child: CallHistoryPane(
                  api: widget.api,
                  onOpenDm: widget.onOpenDm,
                ),
              )
            else ...[
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _TabChip(
                    label: 'Todos',
                    selected: _tab == InboxTab.all,
                    onTap: () => setState(() => _tab = InboxTab.all),
                  ),
                  _TabChip(
                    label: 'No leídos',
                    selected: _tab == InboxTab.unread,
                    badge: total,
                    onTap: () => setState(() => _tab = InboxTab.unread),
                  ),
                  _TabChip(
                    label: 'Favoritos',
                    selected: _tab == InboxTab.favorites,
                    onTap: () => setState(() => _tab = InboxTab.favorites),
                  ),
                  _TabChip(
                    label: 'Grupos',
                    selected: _tab == InboxTab.groups,
                    onTap: () => setState(() => _tab = InboxTab.groups),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: 'Buscar o empezar chat…',
                  hintStyle: const TextStyle(color: kInstMuted, fontSize: 14),
                  prefixIcon: const Icon(Icons.search, color: kInstMuted, size: 20),
                  filled: true,
                  fillColor: kInstSurface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Text(_error!, style: const TextStyle(color: kRadioDanger, fontSize: 12)),
              ),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: kInstOlive),
                    )
                  : rows.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              _emptyLabel(),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: kInstMuted),
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: kInstOlive,
                          onRefresh: _bootstrap,
                          child: ListView.builder(
                            padding: const EdgeInsets.only(top: 4, bottom: 8),
                            itemCount: rows.length,
                            itemBuilder: (context, i) {
                              final row = rows[i];
                              return _InboxTile(
                                row: row,
                                time: _formatTime(row.at),
                                onTap: () => _selectRow(row),
                                onLongPress: () => _showChatActions(row),
                                avatarHeaders: widget.api.avatarAuthHeaders(),
                                onToggleFavorite: () =>
                                    _toggleFavorite(row.kind, row.id),
                              );
                            },
                          ),
                        ),
            ),
            ],
          ],
        ),
      ),
    );
  }

  String _emptyLabel() {
    switch (_tab) {
      case InboxTab.unread:
        return 'No hay chats sin leer';
      case InboxTab.favorites:
        return 'Marca chats con ★ para verlos aquí';
      case InboxTab.groups:
        return 'No hay grupos';
      case InboxTab.all:
        if (_query.trim().isNotEmpty) return 'Sin resultados';
        return 'Sin conversaciones';
    }
  }
}

class _SectionToggle extends StatelessWidget {
  const _SectionToggle({required this.section, required this.onChanged});

  final InboxMainSection section;
  final ValueChanged<InboxMainSection> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kTacPanel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kTacBorder.withValues(alpha: 0.35)),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: [
          _seg('Chats', InboxMainSection.chats, Icons.chat_bubble_outline),
          _seg('Llamadas', InboxMainSection.calls, Icons.history),
        ],
      ),
    );
  }

  Expanded _seg(String label, InboxMainSection value, IconData icon) {
    final selected = section == value;
    return Expanded(
      child: Material(
        color: selected ? kInstOlive.withValues(alpha: 0.45) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => onChanged(value),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: selected ? kTacGoldSoft : kTacMuted,
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? kTacGoldSoft : kTacMuted,
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

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: selected ? kInstOlive.withValues(alpha: 0.35) : kTacPanel,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? kTacGoldSoft : kTacMuted,
                  ),
                ),
                if (badge > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: kTacGold,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      style: const TextStyle(
                        color: Color(0xFF1A2A18),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InboxTile extends StatelessWidget {
  const _InboxTile({
    required this.row,
    required this.time,
    required this.onTap,
    required this.onLongPress,
    required this.onToggleFavorite,
    this.avatarHeaders,
  });

  final InboxRow row;
  final String time;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final VoidCallback onToggleFavorite;
  final Map<String, String>? avatarHeaders;

  @override
  Widget build(BuildContext context) {
    final unread = row.unread;
    return Material(
      color: unread > 0
          ? kInstOlive.withValues(alpha: 0.06)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              UserAvatar(
                name: row.name,
                userId: row.kind == 'dm' ? row.id : null,
                avatarUrl: row.avatarUrl,
                headers: avatarHeaders,
                group: row.kind == 'group',
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            row.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight:
                                  unread > 0 ? FontWeight.w800 : FontWeight.w700,
                              fontSize: 16,
                              color: kInstInk,
                            ),
                          ),
                        ),
                        if (time.isNotEmpty)
                          Text(
                            time,
                            style: TextStyle(
                              fontSize: 12,
                              color: unread > 0 ? kInstOlive : kInstMuted,
                              fontWeight:
                                  unread > 0 ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${row.kind == 'group' ? '👥 ' : ''}${row.preview}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              color: unread > 0 ? kInstInk : kInstMuted,
                              fontWeight:
                                  unread > 0 ? FontWeight.w500 : FontWeight.w400,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: onToggleFavorite,
                          behavior: HitTestBehavior.opaque,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: Icon(
                              row.favorite ? Icons.star : Icons.star_border,
                              size: 20,
                              color: row.favorite ? kInstGold : kInstMuted,
                            ),
                          ),
                        ),
                        if (unread > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: kInstOlive,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              unread > 99 ? '99+' : '$unread',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pantalla full-screen de chat de grupo (desde inbox).
class GroupChatScreen extends StatelessWidget {
  const GroupChatScreen({
    super.key,
    required this.api,
    required this.session,
    required this.groupName,
    this.groupAvatarUrl,
    this.autofocusComposer = false,
    this.scrollToMessageId,
  });

  final ApiClient api;
  final ChannelSession session;
  final String groupName;
  final String? groupAvatarUrl;
  final bool autofocusComposer;
  final String? scrollToMessageId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: kTacBg,
      body: Column(
        children: [
          Material(
            color: kTacHeader,
            elevation: 0.8,
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                height: 56,
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back, color: kTacOnSurface),
                    ),
                    UserAvatar(
                      name: groupName,
                      avatarUrl: groupAvatarUrl,
                      headers: api.avatarAuthHeaders(),
                      group: true,
                      radius: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          final me = api.user?['id']?.toString();
                          final members = session.online
                              .map(
                                (m) => (
                                  userId: m.userId,
                                  displayName: m.displayName,
                                ),
                              )
                              .toList();
                          showChannelMembersSheet(
                            context: context,
                            api: api,
                            members: members,
                            myUserId: me,
                          );
                        },
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              groupName.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: kTacOnSurface,
                                letterSpacing: 0.5,
                              ),
                            ),
                            ListenableBuilder(
                              listenable: session,
                              builder: (_, __) {
                                final typing = session.typingLabel;
                                final n = session.online.length;
                                return Text(
                                  typing.isNotEmpty
                                      ? typing
                                      : (n > 0
                                          ? '$n en línea · tocar para contactar'
                                          : 'Canal · tocar miembros'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    color: typing.isNotEmpty
                                        ? const Color(0xFF9BC48A)
                                        : kTacMuted,
                                    fontStyle: typing.isNotEmpty
                                        ? FontStyle.italic
                                        : FontStyle.normal,
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Video grupal en vivo',
                      onPressed: () {
                        Navigator.of(context).push(
                          GroupVideoScreen.route(
                            child: GroupVideoScreen(
                              api: api,
                              groupId: session.groupId,
                              groupName: groupName,
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.video_camera_front_outlined, color: kTacGoldSoft),
                    ),
                    PopupMenuButton<String>(
                      tooltip: 'Opciones',
                      color: kTacSurface,
                      onSelected: (v) async {
                        if (v == 'video') {
                          await Navigator.of(context).push(
                            GroupVideoScreen.route(
                              child: GroupVideoScreen(
                                api: api,
                                groupId: session.groupId,
                                groupName: groupName,
                              ),
                            ),
                          );
                          return;
                        }
                        if (v != 'clear') return;
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: kTacSurface,
                            title: const Text('Vaciar grupo', style: TextStyle(color: kTacOnSurface)),
                            content: Text(
                              'Se borrarán todos los mensajes de «$groupName» para todos los miembros.',
                              style: const TextStyle(color: kTacMuted),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancelar'),
                              ),
                              FilledButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Vaciar'),
                              ),
                            ],
                          ),
                        );
                        if (ok != true) return;
                        try {
                          await api.clearGroupMessages(session.groupId);
                          session.clearLocalMessages();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Grupo vaciado')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('$e')),
                            );
                          }
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'video',
                          child: ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.videocam_outlined, color: kTacOnSurface),
                            title: Text('Video en vivo', style: TextStyle(color: kTacOnSurface)),
                          ),
                        ),
                        PopupMenuItem(
                          value: 'clear',
                          child: Text('Vaciar grupo', style: TextStyle(color: kTacOnSurface)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: ChatPanel(
              api: api,
              session: session,
              showChannelTitle: false,
              autofocusComposer: autofocusComposer,
              scrollToMessageId: scrollToMessageId,
            ),
          ),
        ],
      ),
    );
  }
}
