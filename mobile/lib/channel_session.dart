import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'app_focus.dart';
import 'audio_session_setup.dart';
import 'config.dart';
import 'livekit_e2ee.dart';
import 'location_heartbeat.dart';
import 'chat_message_banner.dart';
import 'message_tone.dart';
import 'panic_vibration.dart';
import 'push_service.dart';
import 'screens/group_video_screen.dart';

const _kRadioListenMuteKey = 'tacticalptx_radio_mute';

enum PresenceFocus { foreground, background }

/// Skype-like: active in app / away (bg) / offline (not in presence list).
enum PresenceStatus { active, away, offline }

class PresenceMember {
  PresenceMember({
    required this.userId,
    required this.displayName,
    this.focus = PresenceFocus.foreground,
  });
  final String userId;
  final String displayName;
  final PresenceFocus focus;

  PresenceStatus get status =>
      focus == PresenceFocus.background ? PresenceStatus.away : PresenceStatus.active;

  static PresenceFocus focusFromWire(dynamic raw) {
    if (raw == 'background' || raw == true) return PresenceFocus.background;
    return PresenceFocus.foreground;
  }
}

class ChatReaction {
  ChatReaction({required this.emoji, required this.count, this.mine = false});
  factory ChatReaction.fromJson(Map<String, dynamic> j) => ChatReaction(
        emoji: j['emoji']?.toString() ?? '',
        count: (j['count'] as num?)?.toInt() ?? 0,
        mine: j['mine'] == true,
      );
  final String emoji;
  final int count;
  final bool mine;
}

class ChatReplyPreview {
  ChatReplyPreview({
    required this.id,
    required this.displayName,
    this.body,
    this.type = 'text',
    this.mediaName,
    this.isDeleted = false,
  });
  factory ChatReplyPreview.fromJson(Map<String, dynamic> j) => ChatReplyPreview(
        id: j['id']?.toString() ?? '',
        displayName: j['displayName']?.toString() ?? 'Usuario',
        body: j['body']?.toString(),
        type: j['type']?.toString() ?? 'text',
        mediaName: j['mediaName']?.toString(),
        isDeleted: j['isDeleted'] == true,
      );
  final String id;
  final String displayName;
  final String? body;
  final String type;
  final String? mediaName;
  final bool isDeleted;
}

class ChatSticker {
  ChatSticker({required this.kind, required this.value, this.label});
  factory ChatSticker.fromJson(Map<String, dynamic> j) => ChatSticker(
        kind: j['kind']?.toString() ?? 'emoji',
        value: j['value']?.toString() ?? '',
        label: j['label']?.toString(),
      );
  final String kind;
  final String value;
  final String? label;
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.groupId,
    required this.senderId,
    required this.displayName,
    this.body,
    this.type = 'text',
    this.mediaUrl,
    this.mediaMime,
    this.mediaName,
    this.mediaSize,
    this.createdAt,
    this.editedAt,
    this.isDeleted = false,
    this.reply,
    this.reactions = const [],
    this.sticker,
    this.readCount = 0,
    this.peerCount = 0,
    this.readFully = false,
    this.clientMsgId,
    this.isLocal = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> j) {
    final replyRaw = j['reply'];
    final stickerRaw = j['sticker'];
    final reactionsRaw = j['reactions'];
    return ChatMessage(
      id: j['id']?.toString() ?? '',
      groupId: j['groupId']?.toString() ?? '',
      senderId: j['senderId']?.toString() ?? '',
      displayName: j['displayName']?.toString() ?? 'Usuario',
      body: j['body'] as String?,
      type: j['type']?.toString() ?? 'text',
      mediaUrl: j['mediaUrl'] as String?,
      mediaMime: j['mediaMime'] as String?,
      mediaName: j['mediaName'] as String?,
      mediaSize: j['mediaSize'] as int?,
      createdAt: j['createdAt']?.toString(),
      editedAt: j['editedAt']?.toString(),
      isDeleted: j['isDeleted'] == true,
      reply: replyRaw is Map
          ? ChatReplyPreview.fromJson(Map<String, dynamic>.from(replyRaw))
          : null,
      reactions: reactionsRaw is List
          ? reactionsRaw
              .whereType<Map>()
              .map((e) => ChatReaction.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      sticker: stickerRaw is Map
          ? ChatSticker.fromJson(Map<String, dynamic>.from(stickerRaw))
          : null,
      readCount: (j['readCount'] as num?)?.toInt() ?? 0,
      peerCount: (j['peerCount'] as num?)?.toInt() ?? 0,
      readFully: j['readFully'] == true,
      clientMsgId: j['clientMsgId']?.toString(),
      isLocal: j['_local'] == true,
    );
  }

  ChatMessage copyWith({
    String? body,
    String? editedAt,
    bool? isDeleted,
    List<ChatReaction>? reactions,
    int? readCount,
    int? peerCount,
    bool? readFully,
  }) =>
      ChatMessage(
        id: id,
        groupId: groupId,
        senderId: senderId,
        displayName: displayName,
        body: body ?? this.body,
        type: type,
        mediaUrl: mediaUrl,
        mediaMime: mediaMime,
        mediaName: mediaName,
        mediaSize: mediaSize,
        createdAt: createdAt,
        editedAt: editedAt ?? this.editedAt,
        isDeleted: isDeleted ?? this.isDeleted,
        reply: reply,
        reactions: reactions ?? this.reactions,
        sticker: sticker,
        readCount: readCount ?? this.readCount,
        peerCount: peerCount ?? this.peerCount,
        readFully: readFully ?? this.readFully,
        clientMsgId: clientMsgId,
        isLocal: isLocal,
      );

  final String id;
  final String groupId;
  final String senderId;
  final String displayName;
  final String? body;
  final String type;
  final String? mediaUrl;
  final String? mediaMime;
  final String? mediaName;
  final int? mediaSize;
  final String? createdAt;
  final String? editedAt;
  final bool isDeleted;
  final ChatReplyPreview? reply;
  final List<ChatReaction> reactions;
  final ChatSticker? sticker;
  final int readCount;
  final int peerCount;
  final bool readFully;
  final String? clientMsgId;
  final bool isLocal;
}

/// Floor PTT (Socket.IO) + audio (LiveKit) + presencia + chat.
class ChannelSession extends ChangeNotifier {
  ChannelSession({required this.api, required this.group});

  /// Sesión de canal activa (para liberar mic antes de radio/llamada 1:1).
  static ChannelSession? current;

  final ApiClient api;
  final Map<String, dynamic> group;

  io.Socket? _socket;
  Room? _room;
  LocalAudioTrack? _mic;
  LocalTrackPublication? _micPub;
  Timer? _ping;
  Timer? _panicAlarm;
  AudioPlayer? _panicPlayer;
  EventsListener<RoomEvent>? _roomEvents;


  bool connected = false;
  bool livekitReady = false;
  /// Silencia el audio entrante del canal (sigue en el canal; PTT propio no cambia).
  bool listenMuted = false;
  /// Llamada privada entrante (señal global, aunque no estés en Directos).
  Map<String, dynamic>? incomingPrivateCall;
  /// Transmisión grupal entrante (socket user:* / FCM).
  Map<String, dynamic>? incomingGroupVideo;
  /// Último callId finalizado remotamente (para UI que necesite reaccionar).
  String? lastEndedPrivateCallId;
  /// Último DM entrante (SnackBar / badge). Consumir y poner null.
  Map<String, dynamic>? lastDmNotify;
  bool holding = false;
  bool gpsOk = false;
  bool panicSending = false;
  bool panicAcking = false;
  String? error;
  String? speakerName;
  String? speakerId;
  String? lastPanicId;
  String? incomingPanicLabel;
  bool incomingPanicActive = false;
  double? incomingPanicLat;
  double? incomingPanicLng;
  double? incomingPanicAccuracyM;
  String? incomingPanicUserId;
  double? lastLatitude;
  double? lastLongitude;
  double? lastAccuracyM;
  List<PresenceMember> online = [];
  List<ChatMessage> messages = [];
  String typingLabel = '';
  ChatMessage? replyTo;
  final Map<String, String> _typingUsers = {};
  Timer? _typingIdle;

  String get groupId => group['id'] as String;
  String get groupName => group['name'] as String? ?? 'Canal';

  void _applyIncomingGroupVideoInvite(Map<String, dynamic> data) {
    if (GroupVideoScreen.uiOpen) return;
    final me = api.user?['id']?.toString();
    final starter =
        data['startedBy']?.toString() ?? data['by']?.toString();
    if (me != null && starter != null && me == starter) return;

    final gid = data['groupId']?.toString() ?? '';
    if (gid.isEmpty) return;
    if (incomingGroupVideo?['groupId']?.toString() == gid) return;

    incomingGroupVideo = Map<String, dynamic>.from(data);
    notifyListeners();
    final gname = incomingGroupVideo?['groupName']?.toString() ?? 'Grupo';
    final who = incomingGroupVideo?['startedByName']?.toString() ??
        data['displayName']?.toString() ??
        'Operador';
    PushService.instance.showLocal(
      title: 'Transmisión grupal en vivo',
      body: '$who inició video en «$gname»',
      payload: 'gvideo:$gid',
      isCall: true,
      groupId: gid,
    );
  }

  Future<void> start() async {
    current = this;
    error = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      listenMuted = prefs.getBool(_kRadioListenMuteKey) ?? false;
    } catch (_) {
      listenMuted = false;
    }
    try {
      final hist = await api.fetchMessages(groupId);
      messages = hist.map(ChatMessage.fromJson).toList();
      notifyListeners();
      if (messages.isNotEmpty) {
        markRead(messages.last.id);
      }
    } catch (e) {
      error = e.toString();
      notifyListeners();
    }

    _socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': api.token})
          .enableReconnection()
          .enableForceNew()
          .build(),
    );

    _socket!
      ..onConnect((_) {
        connected = true;
        _socket!.emit('ptt:join', {
          'groupId': groupId,
          'focus': _presenceFocusWire,
        });
        notifyListeners();
        _connectLiveKit();
      })
      ..onDisconnect((_) {
        connected = false;
        notifyListeners();
      })
      ..onConnectError((e) {
        error = e.toString();
        notifyListeners();
      })
      ..on('call:incoming', (data) {
        if (data is! Map) return;
        incomingPrivateCall = Map<String, dynamic>.from(data);
        notifyListeners();
        final who = incomingPrivateCall?['callerName']?.toString() ?? 'Usuario';
        final callId = incomingPrivateCall?['callId']?.toString() ?? '';
        final mode = incomingPrivateCall?['mode']?.toString() ?? 'call';
        final isRadio = mode == 'radio';
        final isVideo = mode == 'video';
        PushService.instance.showLocal(
          title: isRadio
              ? 'Radio personal'
              : isVideo
                  ? 'Videollamada'
                  : 'Llamada privada',
          body: isRadio
              ? '$who te invita a radio 1:1'
              : isVideo
                  ? '$who te llama con video'
                  : '$who te está llamando',
          payload: 'call:$callId',
          isCall: true,
          callId: callId.isNotEmpty ? callId : null,
        );
      })
      ..on('call:ended', (data) {
        if (data is! Map) return;
        final id = data['callId']?.toString();
        if (id != null && id == incomingPrivateCall?['callId']?.toString()) {
          incomingPrivateCall = null;
        }
        lastEndedPrivateCallId = id;
        notifyListeners();
        if (id != null && id.isNotEmpty) {
          PushService.instance.clearConversationNotifications(callId: id);
        }
      })
      ..on('group:video_incoming', (data) {
        if (data is! Map) return;
        _applyIncomingGroupVideoInvite(Map<String, dynamic>.from(data));
      })
      ..on('group:video_started', (data) {
        if (data is! Map) return;
        _applyIncomingGroupVideoInvite(Map<String, dynamic>.from(data));
      })
      ..on('group:video_ended', (data) {
        if (data is! Map) return;
        final gid = data['groupId']?.toString();
        if (gid != null && gid == incomingGroupVideo?['groupId']?.toString()) {
          incomingGroupVideo = null;
          notifyListeners();
          PushService.instance.clearConversationNotifications(groupId: gid);
        }
      })
      ..on('dm:notify', (data) {
        if (data is! Map) return;
        final m = Map<String, dynamic>.from(data);
        final peerId = m['peerId']?.toString();
        final peerName = m['peerName']?.toString() ?? 'Mensaje';
        final message = m['message'];
        String body = 'Nuevo mensaje';
        if (message is Map) {
          final t = message['type']?.toString() ?? 'text';
          if (t == 'image') {
            body = '📷 Imagen';
          } else if (t == 'audio') {
            body = '🎤 Audio';
          } else if (t == 'sticker') {
            body = 'Sticker';
          } else if (t == 'video' ||
              (message['mediaMime']?.toString() ?? '').startsWith('video/') ||
              RegExp(r'\.(mp4|mov|webm|mkv|avi|m4v)$', caseSensitive: false)
                  .hasMatch(message['mediaName']?.toString() ?? '')) {
            body = '🎬 Video';
          } else if (t == 'file') {
            final name = message['mediaName']?.toString();
            body = name != null && name.isNotEmpty ? '📎 $name' : '📎 Archivo';
          } else {
            body = (message['body']?.toString() ?? '').trim();
            if (body.isEmpty) body = 'Nuevo mensaje';
            if (body.length > 120) body = body.substring(0, 120);
          }
        }
        lastDmNotify = {
          'peerId': peerId,
          'peerName': peerName,
          'preview': body,
        };
        notifyListeners();
      })
      ..on('ptt:state', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId'] != groupId) return;
        final speaker = m['speaker'] as Map?;
        if (speaker == null) {
          speakerId = null;
          speakerName = null;
        } else {
          speakerId = speaker['userId'] as String?;
          speakerName = speaker['displayName'] as String?;
        }
        notifyListeners();
      })
      ..on('presence:update', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId'] != groupId) return;
        final list = (m['members'] as List? ?? []);
        online = list
            .map((e) {
              final row = Map<String, dynamic>.from(e as Map);
              return PresenceMember(
                userId: row['userId'] as String,
                displayName: row['displayName'] as String? ?? 'Usuario',
                focus: PresenceMember.focusFromWire(row['focus']),
              );
            })
            .toList();
        notifyListeners();
      })
      ..on('ptt:granted', (_) async {
        holding = true;
        error = null;
        notifyListeners();
        try {
          await _publishMic();
        } catch (e) {
          error = e.toString();
          _socket?.emit('ptt:release', {'groupId': groupId});
          holding = false;
          notifyListeners();
        }
      })
      ..on('ptt:denied', (data) {
        holding = false;
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        error = m['reason'] == 'listen_only'
            ? 'Solo escucha (sin PTT)'
            : 'Canal ocupado';
        notifyListeners();
      })
      ..on('ptt:speaker', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId'] != groupId) return;
        speakerId = m['userId'] as String?;
        speakerName = m['displayName'] as String?;
        notifyListeners();
        // Sin notificación local en PTT (solo UI + audio LiveKit).
      })
      ..on('ptt:released', (_) async {
        speakerId = null;
        speakerName = null;
        if (holding) {
          holding = false;
          await _muteMic();
        } else {
          playChannelFreeTone();
        }
        notifyListeners();
      })
      ..on('chat:message', (data) {
        final raw = Map<String, dynamic>.from(data as Map);
        final msg = ChatMessage.fromJson(raw);
        if (msg.groupId != groupId) return;
        final cid = msg.clientMsgId ?? raw['clientMsgId']?.toString();
        final existingIdx = messages.indexWhere(
          (m) =>
              m.id == msg.id ||
              (cid != null &&
                  cid.isNotEmpty &&
                  (m.id == cid || m.clientMsgId == cid)),
        );
        if (existingIdx >= 0) {
          final next = [...messages];
          next[existingIdx] = msg;
          messages = next;
        } else {
          messages = [...messages, msg];
        }
        _typingUsers.remove(msg.senderId);
        _refreshTypingLabel();
        notifyListeners();
        final me = api.user?['id']?.toString();
        if (msg.senderId != me) {
          if (isViewingConversation(groupId: groupId)) {
            playInChatMessageTone();
          } else {
            final preview = (msg.body ?? msg.type).toString();
            final short = preview.length > 120
                ? '${preview.substring(0, 120)}…'
                : preview;
            ChatMessageBanner.instance.show(
              kind: 'group',
              groupId: groupId,
              title: msg.displayName.isNotEmpty ? msg.displayName : groupName,
              preview: short,
              playTone: !appInBackground,
            );
            if (appInBackground) {
              PushService.instance.showLocal(
                title: msg.displayName.isNotEmpty ? msg.displayName : groupName,
                body: short,
                payload: groupId,
                groupId: groupId,
              );
            }
          }
        }
        if (!appInBackground && isViewingConversation(groupId: groupId)) {
          markRead(msg.id);
        }
      })
      ..on('chat:edited', (data) {
        final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data as Map));
        if (msg.groupId != groupId) return;
        messages = messages.map((m) => m.id == msg.id ? msg : m).toList();
        notifyListeners();
      })
      ..on('chat:deleted', (data) {
        final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data as Map));
        if (msg.groupId != groupId) return;
        messages = messages.map((m) => m.id == msg.id ? msg : m).toList();
        notifyListeners();
      })
      ..on('chat:cleared', (data) {
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        if (m['groupId']?.toString() != groupId) return;
        clearLocalMessages();
      })
      ..on('chat:reaction', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId']?.toString() != groupId) return;
        final mid = m['messageId']?.toString();
        if (mid == null) return;
        final reactions = (m['reactions'] as List?)
                ?.whereType<Map>()
                .map((e) => ChatReaction.fromJson(Map<String, dynamic>.from(e)))
                .toList() ??
            const <ChatReaction>[];
        messages = messages
            .map((x) => x.id == mid ? x.copyWith(reactions: reactions) : x)
            .toList();
        notifyListeners();
      })
      ..on('chat:receipts', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId']?.toString() != groupId) return;
        final updates = m['updates'];
        if (updates is! List) return;
        final map = <String, Map>{};
        for (final u in updates.whereType<Map>()) {
          final id = u['messageId']?.toString();
          if (id != null) map[id] = u;
        }
        messages = messages.map((x) {
          final u = map[x.id];
          if (u == null) return x;
          return x.copyWith(
            readCount: (u['readCount'] as num?)?.toInt() ?? x.readCount,
            readFully: u['readFully'] == true,
          );
        }).toList();
        notifyListeners();
      })
      ..on('chat:typing', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId']?.toString() != groupId) return;
        final uid = m['userId']?.toString();
        final me = api.user?['id']?.toString();
        if (uid == null || uid == me) return;
        if (m['typing'] == true) {
          _typingUsers[uid] = m['displayName']?.toString() ?? 'Alguien';
        } else {
          _typingUsers.remove(uid);
        }
        _refreshTypingLabel();
        notifyListeners();
      })
      ..on('chat:error', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final cid = m['clientMsgId']?.toString();
        if (cid != null && cid.isNotEmpty) {
          messages = messages
              .where((x) => !(x.isLocal && (x.id == cid || x.clientMsgId == cid)))
              .toList();
        }
        error = m['error']?.toString();
        notifyListeners();
      })
      ..on('panic:alert', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId']?.toString() != groupId) return;
        applyIncomingPanic(m);
      })
      ..on('panic:update', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final status = m['status']?.toString();
        if (status == null || status == 'active') return;
        // Enterado en otro dispositivo no apaga esta alarma
        if (status == 'acked') return;
        final id = m['id']?.toString();
        if (id != null && lastPanicId != null && id != lastPanicId) return;
        _clearIncomingPanicState();
        notifyListeners();
      });

    _ping = Timer.periodic(const Duration(seconds: 30), (_) {
      if (connected) pingPresenceFocus();
    });

    _attachGps();
    // Si llegó pánico mientras la app estaba inactiva / sin socket.
    unawaited(syncActivePanic());
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  bool get incomingPanicHasLocation =>
      incomingPanicLat != null && incomingPanicLng != null;

  /// Aplica alerta entrante (socket, FCM o sync REST).
  void applyIncomingPanic(Map<String, dynamic> m) {
    final uid = m['userId']?.toString();
    final me = api.user?['id']?.toString();
    if (uid != null && me != null && uid == me) return;
    final gid = m['groupId']?.toString();
    if (gid != null && gid.isNotEmpty && gid != groupId) return;

    lastPanicId = m['id']?.toString() ?? m['panicId']?.toString();
    incomingPanicLabel = m['displayName']?.toString() ?? 'Operador';
    incomingPanicUserId = uid;
    incomingPanicLat = _toDouble(m['latitude']);
    incomingPanicLng = _toDouble(m['longitude']);
    incomingPanicAccuracyM =
        _toDouble(m['accuracyM']) ?? _toDouble(m['accuracy_m']);
    incomingPanicActive = true;
    _startPanicAlarmLoop();
    notifyListeners();
  }

  void _clearIncomingPanicState() {
    _stopPanicAlarmLoop();
    incomingPanicActive = false;
    incomingPanicLabel = null;
    incomingPanicLat = null;
    incomingPanicLng = null;
    incomingPanicAccuracyM = null;
    incomingPanicUserId = null;
  }

  /// Recupera pánico activo del canal (p. ej. tras abrir app por notificación).
  Future<void> syncActivePanic() async {
    try {
      final events = await api.fetchPanicEvents(status: 'active', limit: 20);
      final me = api.user?['id']?.toString();
      for (final e in events) {
        if (e['groupId']?.toString() != groupId) continue;
        if (e['userId']?.toString() == me) continue;
        if (e['status']?.toString() != 'active') continue;
        applyIncomingPanic(e);
        return;
      }
    } catch (e) {
      debugPrint('syncActivePanic: $e');
    }
  }

  String get _presenceFocusWire =>
      appInBackground ? 'background' : 'foreground';

  /// Heartbeat + estado foco (verde/amarillo). Llamar al cambiar lifecycle.
  void pingPresenceFocus() {
    if (!connected || _socket == null) return;
    final focus = _presenceFocusWire;
    _socket!.emit('presence:ping', {'groupId': groupId, 'focus': focus});
    final me = api.user?['id']?.toString();
    if (me == null) return;
    final want =
        focus == 'background' ? PresenceFocus.background : PresenceFocus.foreground;
    final i = online.indexWhere((m) => m.userId == me);
    if (i < 0) return;
    if (online[i].focus == want) return;
    final copy = List<PresenceMember>.from(online);
    copy[i] = PresenceMember(
      userId: me,
      displayName: copy[i].displayName,
      focus: want,
    );
    online = copy;
    notifyListeners();
  }

  Future<void> _attachGps() async {
    await LocationHeartbeat.start(
      api,
      onFix: (ok, lat, lng, accuracyM) {
        gpsOk = ok;
        if (ok) {
          lastLatitude = lat;
          lastLongitude = lng;
          lastAccuracyM = accuracyM;
        }
        notifyListeners();
      },
    );
  }

  /// Mute de escucha: no se oye el radio hasta desactivar.
  Future<void> setListenMuted(bool muted) async {
    if (listenMuted == muted) {
      await _applyListenMute();
      return;
    }
    listenMuted = muted;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kRadioListenMuteKey, muted);
    } catch (_) {}
    await _applyListenMute();
    if (muted && !holding) {
      await AudioSessionSetup.release();
    } else if (!muted && livekitReady) {
      await AudioSessionSetup.acquireRadio();
    }
  }

  Future<void> toggleListenMuted() => setListenMuted(!listenMuted);

  Future<void> _applyListenMute() async {
    final room = _room;
    if (room == null) return;
    for (final p in room.remoteParticipants.values) {
      for (final pub in p.audioTrackPublications) {
        try {
          final track = pub.track;
          // Corta reproducción local sin dejar de recibir señal (mejor que solo disable).
          if (track is RemoteAudioTrack) {
            try {
              track.mediaStreamTrack.enabled = !listenMuted;
            } catch (_) {}
          }
          if (listenMuted) {
            await pub.disable();
          } else {
            await pub.enable();
          }
        } catch (e) {
          debugPrint('listenMute: $e');
        }
      }
    }
  }

  /// Reaplica altavoz de radio / mute de escucha (p. ej. tras bloquear pantalla).
  Future<void> ensureBackgroundAudio() async {
    if (_room == null || !livekitReady || listenMuted) return;
    await AudioSessionSetup.acquireRadio();
    if (!listenMuted) {
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {
        /* desktop / unsupported */
      }
    }
    await _applyListenMute();
  }

  Future<void> _connectLiveKit() async {
    try {
      final lk = await api.fetchLiveKitToken(groupId);
      await _roomEvents?.dispose();
      _roomEvents = null;
      await _room?.disconnect();
      final e2ee = await buildVoiceE2eeOptions(lk['e2eeKey']?.toString());
      final room = Room(
        roomOptions: RoomOptions(
          adaptiveStream: false,
          dynacast: false,
          encryption: e2ee,
          defaultAudioPublishOptions: const AudioPublishOptions(
            dtx: false,
            // Sin RED: menos latencia en LAN/Wi‑Fi local
            red: false,
            encoding: AudioEncoding.presetSpeech,
          ),
          defaultAudioCaptureOptions: const AudioCaptureOptions(
            echoCancellation: true,
            // NS agresivo suma latencia y deforma la voz
            noiseSuppression: false,
            autoGainControl: true,
            // Libera el micrófono del SO cuando no hablas (cámara / otras apps).
            stopAudioCaptureOnMute: true,
          ),
        ),
      );
      _room = room;
      room.addListener(_onRoomChanged);
      final ev = room.createListener();
      ev
        ..on<TrackSubscribedEvent>((e) {
          if (e.track is! RemoteAudioTrack) return;
          unawaited(_applyListenMute());
        })
        ..on<TrackPublishedEvent>((e) {
          if (e.publication.kind != TrackType.AUDIO) return;
          unawaited(_applyListenMute());
        });
      _roomEvents = ev;
      if (!listenMuted) {
        await AudioSessionSetup.acquireRadio();
      }
      final lkUrl = AppConfig.publicLiveKitUrl(lk['url'] as String);
      if (kDebugMode) debugPrint('LiveKit connect → $lkUrl');
      await room.connect(
        lkUrl,
        lk['token'] as String,
        connectOptions: const ConnectOptions(autoSubscribe: true),
      );
      await ensureBackgroundAudio();
      livekitReady = true;
      error = null;
      notifyListeners();
      // No abrir mic aquí: solo al PTT (evita pelear con cámara/volumen del móvil).
      await _applyListenMute();
    } catch (e) {
      livekitReady = false;
      error = e.toString();
      notifyListeners();
    }
  }

  void _onRoomChanged() {
    // Fuerza rebuild cuando llegan/salen tracks remotos (audio PTT).
    notifyListeners();
  }

  Future<void> pressPtt() async {
    if (!connected || holding) return;
    error = null;
    await AudioSessionSetup.acquireVoice();
    // Precalentar en paralelo al request
    unawaited(_ensureMicReady());
    _socket?.emit('ptt:request', {'groupId': groupId});
  }

  Future<void> releasePtt() async {
    if (!holding) return;
    holding = false;
    await _muteMic();
    _socket?.emit('ptt:release', {'groupId': groupId});
    await AudioSessionSetup.acquireRadio();
    try {
      await AudioManager.instance.setSpeakerOutputPreferred(true);
    } catch (_) {}
    notifyListeners();
  }

  /// Toque 1 = al aire; toque 2 = liberar.
  Future<void> togglePtt() async {
    if (holding) {
      await releasePtt();
    } else {
      await pressPtt();
    }
  }

  /// Publica el mic solo cuando hace falta (PTT); al mutear libera hardware.
  Future<void> _ensureMicReady() async {
    if (_room == null || !livekitReady) return;
    final lp = _room!.localParticipant;
    if (lp == null) return;
    if (_mic != null || lp.audioTrackPublications.isNotEmpty) {
      try {
        await lp.setMicrophoneEnabled(false);
      } catch (_) {}
      return;
    }
    try {
      await lp.setMicrophoneEnabled(false);
      final pubs = lp.audioTrackPublications;
      if (pubs.isNotEmpty) {
        _micPub = pubs.first;
        _mic = pubs.first.track as LocalAudioTrack?;
      }
    } catch (e) {
      final mic = await LocalAudioTrack.create(
        const AudioCaptureOptions(
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          stopAudioCaptureOnMute: true,
        ),
      );
      await mic.mute(stopOnMute: true);
      _mic = mic;
      _micPub = await lp.publishAudioTrack(
        mic,
        publishOptions: const AudioPublishOptions(
          dtx: false,
          red: false,
          encoding: AudioEncoding.presetSpeech,
          name: 'ptt',
        ),
      );
    }
  }

  /// Al grant: solo unmute (track ya publicado).
  Future<void> _publishMic() async {
    if (_room == null) return;
    final lp = _room!.localParticipant;
    if (lp == null) return;
    try {
      await lp.setMicrophoneEnabled(true);
      final pubs = lp.audioTrackPublications;
      if (pubs.isNotEmpty) {
        _micPub = pubs.first;
        _mic = pubs.first.track as LocalAudioTrack?;
      }
      await _unmuteMic();
    } catch (_) {
      if (_mic == null) {
        await _ensureMicReady();
      }
      await _unmuteMic();
    }
  }

  Future<void> _muteMic() async {
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(false);
    } catch (_) {}
    try {
      await _mic?.mute(stopOnMute: true);
    } catch (_) {
      try {
        await _micPub?.mute(stopOnMute: true);
      } catch (_) {}
    }
  }

  Future<void> _unmuteMic() async {
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(true);
    } catch (_) {}
    try {
      await _mic?.unmute();
    } catch (_) {
      try {
        await _micPub?.unmute();
      } catch (_) {}
    }
  }

  Future<void> _stopMic() async {
    final pub = _micPub;
    final mic = _mic;
    _micPub = null;
    _mic = null;
    if (pub != null) {
      try {
        await _room?.localParticipant?.removePublishedTrack(pub.sid);
      } catch (_) {}
    }
    if (mic != null) {
      try {
        await mic.stop();
        await mic.dispose();
      } catch (_) {}
    }
  }

  /// Libera el micrófono del SO para que otras apps / cámara del sistema funcionen.
  Future<void> pauseMicForSystemCamera() => _stopMic();

  /// Libera el mic del canal grupal para que radio/llamada 1:1 pueda capturar audio.
  Future<void> pauseForPersonalRadio() async {
    if (holding) {
      try {
        await releasePtt();
      } catch (_) {}
    }
    await _stopMic();
  }

  /// Reactiva el mic del canal tras cerrar radio/llamada 1:1.
  Future<void> resumeAfterPersonalRadio() async {
    if (_room == null || !livekitReady) return;
    unawaited(_ensureMicReady());
  }

  /// Recarga historial del servidor (tras inactividad / al abrir el chat).
  Future<void> refreshChatHistory() async {
    try {
      final hist = await api.fetchMessages(groupId);
      final server = hist.map(ChatMessage.fromJson).toList();
      final serverIds = server.map((m) => m.id).toSet();
      final serverClientIds = server
          .map((m) => m.clientMsgId)
          .whereType<String>()
          .where((c) => c.isNotEmpty)
          .toSet();
      final pendingLocal = messages
          .where(
            (m) =>
                m.isLocal &&
                !serverIds.contains(m.id) &&
                (m.clientMsgId == null ||
                    !serverClientIds.contains(m.clientMsgId)),
          )
          .toList();
      messages = [...server, ...pendingLocal];
      error = null;
      notifyListeners();
      if (!appInBackground &&
          isViewingConversation(groupId: groupId) &&
          messages.isNotEmpty) {
        markRead(messages.last.id);
      }
    } catch (e) {
      // No borrar lo que ya hay en memoria si falla la red.
      debugPrint('refreshChatHistory: $e');
    }
  }

  void sendChat(String body) {
    final text = body.trim();
    if (text.isEmpty) return;
    final replyId = replyTo?.id;
    final replySnap = replyTo;
    setReplyTo(null);
    setTyping(false);
    final me = api.user?['id']?.toString() ?? '';
    final clientMsgId = 'local-${DateTime.now().microsecondsSinceEpoch}';
    final optimistic = ChatMessage(
      id: clientMsgId,
      groupId: groupId,
      senderId: me,
      displayName: api.user?['displayName']?.toString() ?? 'Tú',
      body: text,
      type: 'text',
      createdAt: DateTime.now().toUtc().toIso8601String(),
      reply: replySnap != null
          ? ChatReplyPreview(
              id: replySnap.id,
              body: replySnap.body,
              type: replySnap.type,
              displayName: replySnap.displayName,
              isDeleted: replySnap.isDeleted,
            )
          : null,
      clientMsgId: clientMsgId,
      isLocal: true,
    );
    messages = [...messages, optimistic];
    notifyListeners();

    if (connected) {
      _socket?.emit('chat:send', {
        'groupId': groupId,
        'body': text,
        'clientMsgId': clientMsgId,
        if (replyId != null) 'replyToId': replyId,
      });
    } else {
      api.sendMessage(groupId, text, replyToId: replyId).then((msg) {
        final m = ChatMessage.fromJson(msg);
        final idx = messages.indexWhere(
          (x) => x.id == clientMsgId || x.clientMsgId == clientMsgId,
        );
        if (idx >= 0) {
          final next = [...messages];
          next[idx] = m;
          messages = next;
        } else if (!messages.any((x) => x.id == m.id)) {
          messages = [...messages, m];
        }
        notifyListeners();
      }).catchError((e) {
        messages = messages
            .where((x) => !(x.id == clientMsgId || x.clientMsgId == clientMsgId))
            .toList();
        error = e.toString();
        notifyListeners();
      });
    }
  }

  void setReplyTo(ChatMessage? m) {
    replyTo = m;
    notifyListeners();
  }

  void _refreshTypingLabel() {
    final names = _typingUsers.values.take(2).toList();
    typingLabel = names.isEmpty
        ? ''
        : '${names.join(', ')} escribiendo…';
  }

  void setTyping(bool typing) {
    if (!connected) return;
    _socket?.emit('chat:typing', {'groupId': groupId, 'typing': typing});
    _typingIdle?.cancel();
    if (typing) {
      _typingIdle = Timer(const Duration(seconds: 3), () => setTyping(false));
    }
  }

  void clearLocalMessages() {
    messages = [];
    replyTo = null;
    notifyListeners();
  }

  void markRead(String upToMessageId) {
    if (upToMessageId.isEmpty) return;
    if (connected) {
      _socket?.emit('chat:read', {
        'groupId': groupId,
        'upToMessageId': upToMessageId,
      });
    } else {
      api.markMessagesRead(groupId, upToMessageId).catchError((_) {});
    }
    // Al leer en la app, quita avisos de bandeja de este canal (estilo WhatsApp).
    if (!appInBackground) {
      PushService.instance.clearConversationNotifications(groupId: groupId);
    }
  }

  void reactTo(String messageId, String emoji) {
    if (connected) {
      _socket?.emit('chat:react', {
        'groupId': groupId,
        'messageId': messageId,
        'emoji': emoji,
      });
    } else {
      api.reactToMessage(groupId, messageId, emoji).then((data) {
        final reactions = (data['reactions'] as List?)
                ?.whereType<Map>()
                .map((e) => ChatReaction.fromJson(Map<String, dynamic>.from(e)))
                .toList() ??
            const <ChatReaction>[];
        messages = messages
            .map((x) => x.id == messageId ? x.copyWith(reactions: reactions) : x)
            .toList();
        notifyListeners();
      }).catchError((e) {
        error = e.toString();
        notifyListeners();
      });
    }
  }

  void editChat(String messageId, String body) {
    final text = body.trim();
    if (text.isEmpty) return;
    if (connected) {
      _socket?.emit('chat:edit', {
        'groupId': groupId,
        'messageId': messageId,
        'body': text,
      });
    } else {
      api.editMessage(groupId, messageId, text).then((msg) {
        final m = ChatMessage.fromJson(msg);
        messages = messages.map((x) => x.id == m.id ? m : x).toList();
        notifyListeners();
      }).catchError((e) {
        error = e.toString();
        notifyListeners();
      });
    }
  }

  void deleteChat(String messageId) {
    if (connected) {
      _socket?.emit('chat:delete', {'groupId': groupId, 'messageId': messageId});
    } else {
      api.deleteMessage(groupId, messageId).then((msg) {
        final m = ChatMessage.fromJson(msg);
        messages = messages.map((x) => x.id == m.id ? m : x).toList();
        notifyListeners();
      }).catchError((e) {
        error = e.toString();
        notifyListeners();
      });
    }
  }

  Future<void> sendSticker(String stickerId) async {
    final replyId = replyTo?.id;
    setReplyTo(null);
    try {
      if (connected) {
        _socket?.emit('chat:sticker', {
          'groupId': groupId,
          'stickerId': stickerId,
          if (replyId != null) 'replyToId': replyId,
        });
      } else {
        final data = await api.sendSticker(groupId, stickerId, replyToId: replyId);
        final m = ChatMessage.fromJson(data['message'] as Map<String, dynamic>);
        if (!messages.any((x) => x.id == m.id)) {
          messages = [...messages, m];
          notifyListeners();
        }
      }
    } catch (e) {
      error = e.toString();
      notifyListeners();
    }
  }

  Future<void> sendMediaFile({
    required String path,
    required String filename,
    String? mime,
    String? caption,
    String type = 'file',
  }) async {
    try {
      final replyId = replyTo?.id;
      setReplyTo(null);
      final msg = await api.uploadMedia(
        groupId,
        filePath: path,
        filename: filename,
        mime: mime,
        type: type,
        body: caption,
        replyToId: replyId,
      );
      final m = ChatMessage.fromJson(msg);
      if (!messages.any((x) => x.id == m.id)) {
        messages = [...messages, m];
        notifyListeners();
      }
    } catch (e) {
      error = e.toString();
      notifyListeners();
    }
  }

  void clearIncomingPanic() {
    _clearIncomingPanicState();
    notifyListeners();
  }

  /// Silencia sirena/vibración en este dispositivo sin cerrar el overlay.
  void silenceIncomingPanicAlarm() {
    _stopPanicAlarmLoop();
  }

  void _beepPanicOnce() {
    unawaited(() async {
      try {
        _panicPlayer ??= AudioPlayer();
        await _panicPlayer!.stop();
        await _panicPlayer!.play(
          AssetSource('sounds/panic_siren.wav'),
          volume: 1.0,
        );
      } catch (_) {
        try {
          SystemSound.play(SystemSoundType.alert);
        } catch (_) {}
      }
    }());
  }

  void _startPanicAlarmLoop() {
    _panicAlarm?.cancel();
    unawaited(PanicVibration.startAlarm());
    _beepPanicOnce();
    _panicAlarm = Timer.periodic(const Duration(milliseconds: 3200), (_) {
      if (!incomingPanicActive) {
        _stopPanicAlarmLoop();
        return;
      }
      _beepPanicOnce();
    });
  }

  void _stopPanicAlarmLoop() {
    _panicAlarm?.cancel();
    _panicAlarm = null;
    unawaited(PanicVibration.stop());
    final player = _panicPlayer;
    if (player == null) return;
    // Errores del Future no los captura try/catch síncrono; evitar crash del isolate.
    unawaited(() async {
      try {
        await player.stop();
      } catch (_) {}
    }());
  }

  /// Enterado: silencia solo este dispositivo; registra acuse en servidor.
  Future<bool> ackIncomingPanic() async {
    if (panicAcking) return false;
    panicAcking = true;
    final id = lastPanicId;
    _clearIncomingPanicState();
    // Un solo notify al final del ack evita rebuild + pop duplicado en el shell.
    if (id == null) {
      panicAcking = false;
      notifyListeners();
      return true;
    }
    try {
      await api.ackPanic(id);
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      panicAcking = false;
      notifyListeners();
    }
  }

  /// Botón de pánico: notifica al grupo + admin/despacho + usuarios con permiso.
  Future<bool> triggerPanic({String? note}) async {
    if (panicSending) return false;
    panicSending = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.triggerPanic(
        groupId: groupId,
        latitude: lastLatitude,
        longitude: lastLongitude,
        accuracyM: lastAccuracyM,
        note: note,
      );
      final event = data['event'] as Map<String, dynamic>?;
      lastPanicId = event?['id'] as String?;
      final sys = data['message'];
      if (sys is Map<String, dynamic>) {
        final m = ChatMessage.fromJson(sys);
        if (!messages.any((x) => x.id == m.id)) {
          messages = [...messages, m];
        }
      }
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      panicSending = false;
      notifyListeners();
    }
  }

  Future<void> disposeSession() async {
    if (identical(current, this)) current = null;
    _ping?.cancel();
    _typingIdle?.cancel();
    _stopPanicAlarmLoop();
    await _stopMic();
    _socket?.emit('ptt:leave', {'groupId': groupId});
    _socket?.dispose();
    _socket = null;
    await _roomEvents?.dispose();
    _roomEvents = null;
    await _room?.disconnect();
    _room?.removeListener(_onRoomChanged);
    await _room?.dispose();
    _room = null;
    await AudioSessionSetup.release();
  }
}

