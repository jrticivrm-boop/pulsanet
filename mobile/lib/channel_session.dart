import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'app_focus.dart';
import 'config.dart';
import 'livekit_e2ee.dart';
import 'location_heartbeat.dart';
import 'push_service.dart';

class PresenceMember {
  PresenceMember({required this.userId, required this.displayName});
  final String userId;
  final String displayName;
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
  });

  factory ChatMessage.fromJson(Map<String, dynamic> j) {
    final replyRaw = j['reply'];
    final stickerRaw = j['sticker'];
    final reactionsRaw = j['reactions'];
    return ChatMessage(
      id: j['id'] as String,
      groupId: j['groupId'] as String,
      senderId: j['senderId'] as String? ?? '',
      displayName: j['displayName'] as String? ?? 'Usuario',
      body: j['body'] as String?,
      type: j['type'] as String? ?? 'text',
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
}

/// Floor PTT (Socket.IO) + audio (LiveKit) + presencia + chat.
class ChannelSession extends ChangeNotifier {
  ChannelSession({required this.api, required this.group});

  final ApiClient api;
  final Map<String, dynamic> group;

  io.Socket? _socket;
  Room? _room;
  LocalAudioTrack? _mic;
  LocalTrackPublication? _micPub;
  Timer? _ping;
  Timer? _panicAlarm;

  bool connected = false;
  bool livekitReady = false;
  /// Llamada privada entrante (señal global, aunque no estés en Directos).
  Map<String, dynamic>? incomingPrivateCall;
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

  Future<void> start() async {
    error = null;
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
        _socket!.emit('ptt:join', {'groupId': groupId});
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
        PushService.instance.showLocal(
          title: 'Llamada privada',
          body: '$who te está llamando',
          payload: 'call:$callId',
          isCall: true,
        );
      })
      ..on('call:ended', (data) {
        if (data is! Map) return;
        final id = data['callId'];
        if (id != null && id == incomingPrivateCall?['callId']) {
          incomingPrivateCall = null;
          notifyListeners();
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
          } else if (t == 'file') {
            body = '📎 Archivo';
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
            .map((e) => PresenceMember(
                  userId: (e as Map)['userId'] as String,
                  displayName: e['displayName'] as String? ?? 'Usuario',
                ))
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
        }
        notifyListeners();
      })
      ..on('chat:message', (data) {
        final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data as Map));
        if (msg.groupId != groupId) return;
        if (messages.any((m) => m.id == msg.id)) return;
        messages = [...messages, msg];
        _typingUsers.remove(msg.senderId);
        _refreshTypingLabel();
        notifyListeners();
        final me = api.user?['id']?.toString();
        if (appInBackground && msg.senderId != me) {
          final preview = (msg.body ?? msg.type).toString();
          PushService.instance.showLocal(
            title: msg.displayName.isNotEmpty ? msg.displayName : groupName,
            body: preview.length > 120 ? '${preview.substring(0, 120)}…' : preview,
            payload: groupId,
          );
        }
        // Auto marcar leído hasta el último
        markRead(msg.id);
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
        error = m['error']?.toString();
        notifyListeners();
      })
      ..on('panic:alert', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        if (m['groupId']?.toString() != groupId) return;
        final uid = m['userId']?.toString();
        final me = api.user?['id']?.toString();
        if (uid != null && me != null && uid == me) return;
        lastPanicId = m['id']?.toString();
        incomingPanicLabel = m['displayName']?.toString() ?? 'Operador';
        incomingPanicActive = true;
        _startPanicAlarmLoop();
        notifyListeners();
      })
      ..on('panic:update', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final status = m['status']?.toString();
        if (status == null || status == 'active') return;
        final id = m['id']?.toString();
        if (id != null && lastPanicId != null && id != lastPanicId) return;
        _stopPanicAlarmLoop();
        incomingPanicActive = false;
        incomingPanicLabel = null;
        notifyListeners();
      });

    _ping = Timer.periodic(const Duration(seconds: 30), (_) {
      if (connected) {
        _socket?.emit('presence:ping', {'groupId': groupId});
      }
    });

    _attachGps();
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

  Future<void> _connectLiveKit() async {
    try {
      final lk = await api.fetchLiveKitToken(groupId);
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
            stopAudioCaptureOnMute: false,
          ),
        ),
      );
      _room = room;
      room.addListener(_onRoomChanged);
      await room.connect(
        AppConfig.publicLiveKitUrl(lk['url'] as String),
        lk['token'] as String,
      );
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {
        /* desktop / unsupported */
      }
      livekitReady = true;
      error = null;
      notifyListeners();
      // Mic muteado listo: el grant solo hace unmute
      await _ensureMicReady();
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
    // Precalentar en paralelo al request
    unawaited(_ensureMicReady());
    _socket?.emit('ptt:request', {'groupId': groupId});
  }

  Future<void> releasePtt() async {
    if (!holding) return;
    holding = false;
    await _muteMic();
    _socket?.emit('ptt:release', {'groupId': groupId});
    notifyListeners();
  }

  /// Publica el mic muteado una vez; PTT solo mute/unmute.
  Future<void> _ensureMicReady() async {
    if (_room == null || !livekitReady) return;
    if (_mic != null) return;
    final mic = await LocalAudioTrack.create(
      const AudioCaptureOptions(
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        stopAudioCaptureOnMute: false,
      ),
    );
    await mic.mute(stopOnMute: false);
    _mic = mic;
    _micPub = await _room!.localParticipant?.publishAudioTrack(
      mic,
      publishOptions: const AudioPublishOptions(
        dtx: false,
        red: false,
        encoding: AudioEncoding.presetSpeech,
        name: 'ptt',
      ),
    );
  }

  /// Al grant: solo unmute (track ya publicado).
  Future<void> _publishMic() async {
    if (_room == null) return;
    if (_mic == null) {
      await _ensureMicReady();
    }
    await _unmuteMic();
  }

  Future<void> _muteMic() async {
    // stopOnMute: false → no corta el track (evita huecos al volver a hablar)
    try {
      await _mic?.mute(stopOnMute: false);
    } catch (_) {
      try {
        await _micPub?.mute(stopOnMute: false);
      } catch (_) {}
    }
  }

  Future<void> _unmuteMic() async {
    try {
      await _mic?.unmute(stopOnMute: false);
    } catch (_) {
      try {
        await _micPub?.unmute(stopOnMute: false);
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

  void sendChat(String body) {
    final text = body.trim();
    if (text.isEmpty) return;
    final replyId = replyTo?.id;
    setReplyTo(null);
    setTyping(false);
    if (connected) {
      _socket?.emit('chat:send', {
        'groupId': groupId,
        'body': text,
        if (replyId != null) 'replyToId': replyId,
      });
    } else {
      api.sendMessage(groupId, text, replyToId: replyId).then((msg) {
        final m = ChatMessage.fromJson(msg);
        if (!messages.any((x) => x.id == m.id)) {
          messages = [...messages, m];
          notifyListeners();
        }
      }).catchError((e) {
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
    incomingPanicLabel = null;
    notifyListeners();
  }

  void _beepPanicOnce() {
    try {
      SystemSound.play(SystemSoundType.alert);
    } catch (_) {}
    try {
      HapticFeedback.heavyImpact();
    } catch (_) {}
  }

  void _startPanicAlarmLoop() {
    _panicAlarm?.cancel();
    _beepPanicOnce();
    _panicAlarm = Timer.periodic(const Duration(milliseconds: 1200), (_) {
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
  }

  /// Enterado: silencia y marca acked en servidor (también para otros clientes).
  Future<bool> ackIncomingPanic() async {
    if (panicAcking) return false;
    panicAcking = true;
    _stopPanicAlarmLoop();
    incomingPanicActive = false;
    final id = lastPanicId;
    incomingPanicLabel = null;
    notifyListeners();
    if (id == null) {
      panicAcking = false;
      return true;
    }
    try {
      await api.ackPanic(id);
      return true;
    } catch (e) {
      error = e.toString();
      notifyListeners();
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
    _ping?.cancel();
    _typingIdle?.cancel();
    _stopPanicAlarmLoop();
    await _stopMic();
    _socket?.emit('ptt:leave', {'groupId': groupId});
    _socket?.dispose();
    _socket = null;
    await _room?.disconnect();
    _room?.removeListener(_onRoomChanged);
    await _room?.dispose();
    _room = null;
  }
}

