import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';
import 'app_focus.dart';
import 'audio_session_setup.dart';
import 'call_ringtone.dart';
import 'config.dart';
import 'cpu_awake.dart';
import 'duckdns_hairpin.dart';
import 'incoming_call_wake.dart';
import 'livekit_e2ee.dart';
import 'location_heartbeat.dart';
import 'chat_message_banner.dart';
import 'message_tone.dart';
import 'native_audio_mode.dart';
import 'panic_live_session.dart';
import 'panic_vibration.dart';
import 'private_call_gate.dart';
import 'ptt_wake.dart';
import 'push_service.dart';
import 'remote_camera_prefs.dart';
import 'remote_camera_session.dart';
import 'roles.dart';
import 'screens/group_video_screen.dart';
import 'widgets/panic_confirm_sheet.dart' show splitPanicNote;

const _kRadioListenMuteKey = 'tacticalptx_radio_mute';

/// Radio bajo demanda (estilo WAVE PTX): sin salas LiveKit en reposo. La sala de
/// un canal se conecta al recibir `ptt:speaker` o al pulsar PTT y se cierra tras
/// [ChannelSession.radioHangSeconds] sin actividad. `false` = salas siempre abiertas.
const bool kRadioOnDemand = true;

/// Preferencia del cuelgue (segundos) tras la última transmisión.
const kRadioHangPrefKey = 'tacticalptx_radio_hang_s';

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
  ChannelSession({
    required this.api,
    required this.group,
    this.memberships = const [],
    this.openChannel = false,
  }) {
    _talkGroupId = group['id']?.toString() ?? '';
  }

  /// Id virtual del modo «Canal abierto» (≥2 membresías).
  static const kOpenChannelId = '__canal_abierto__';

  /// Sesión de canal activa (para liberar mic antes de radio/llamada 1:1).
  static ChannelSession? current;

  final ApiClient api;
  final Map<String, dynamic> group;
  /// Todas las membresías (solo usado en Canal abierto).
  final List<Map<String, dynamic>> memberships;
  final bool openChannel;

  io.Socket? _socket;
  Room? _room;
  final Map<String, Room> _roomsByGroup = {};
  LocalAudioTrack? _mic;
  LocalTrackPublication? _micPub;
  Timer? _ping;
  Timer? _panicAlarm;
  AudioPlayer? _panicPlayer;
  EventsListener<RoomEvent>? _roomEvents;
  final List<EventsListener<RoomEvent>> _extraRoomEvents = [];

  /// Radio bajo demanda: listener por sala, salas conectándose, cuelgue y tokens.
  final Map<String, EventsListener<RoomEvent>> _eventsByGroup = {};
  final Map<String, Future<Room?>> _roomWaking = {};
  final Map<String, Timer> _roomHang = {};
  /// Canales con alguien (otro) al aire ahora: su sala no se cierra.
  final Set<String> _liveGroups = {};
  final Map<String, ({Map<String, dynamic> lk, DateTime at})> _lkTokens = {};
  static const _lkTokenTtl = Duration(minutes: 45);

  /// Segundos que la sala sigue abierta tras la última transmisión (2–30).
  static int radioHangSeconds = 5;

  /// Copia local del PTT para RESERVADO (misma API que la consola web).
  final AudioRecorder _pttArchive = AudioRecorder();
  String? _pttArchivePath;
  DateTime? _pttArchiveStartedAt;
  String? _pttArchiveGroupId;

  bool connected = false;
  /// Último corte del socket (para decidir si hay que recargar al volver al frente).
  DateTime? lastDisconnectAt;
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
  /// Aviso de takeover (`ptt:taken`). Consumir en UI (SnackBar).
  String? pttTakenNotice;
  /// Cierre forzado / sesión reemplazada. Consumir en UI y llamar logout.
  String? sessionKickNotice;
  /// Feedback al emisor de alerta (Enterado / atendida). Consumir en SnackBar.
  String? panicSenderNotice;
  String? _lastPanicSenderFbKey;
  bool holding = false;
  /// Dedo/intención de transmitir (hold). Permite soltar antes de `ptt:granted`
  /// sin quedar al aire como si fuera latch (bug Pulsación Corta).
  bool _pttWantTransmit = false;
  /// true entre pressPtt y grant/release (aún sin `holding`).
  bool get pttArmed => _pttWantTransmit;
  /// Servidor despertando radios dormidos (`ptt:waking`) antes del grant.
  Map<String, dynamic>? pttWaking;
  bool get pttWakingActive =>
      pttWaking != null && _pttWantTransmit && !holding;
  DateTime? _lastLocalPttReleaseAt;
  bool gpsOk = false;
  bool panicSending = false;
  bool panicAcking = false;
  /// Error de chat/PTT visible al operador (compositor, etc.).
  String? error;

  void clearError() {
    if (error == null) return;
    error = null;
    notifyListeners();
  }
  String? speakerName;
  String? speakerId;
  /// Canal del último hablante remoto (Canal abierto → destino PTT).
  String? lastHeardGroupId;
  String? lastHeardGroupName;
  DateTime? _lastHeardAt;
  Timer? _lastHeardExpire;
  String _talkGroupId = '';
  static const _lastHeardTtl = Duration(seconds: 60);
  String? lastPanicId;
  String? incomingPanicLabel;
  bool incomingPanicActive = false;
  double? incomingPanicLat;
  double? incomingPanicLng;
  double? incomingPanicAccuracyM;
  String? incomingPanicUserId;
  String? incomingPanicReason;
  String? incomingPanicDetail;
  String? incomingPanicGroupName;
  DateTime? incomingPanicAt;

  /// Aviso global (warning) pendiente de Enterado.
  String? announcementId;
  String? announcementBody;
  String? announcementFrom;
  bool announcementActive = false;
  bool announcementAcking = false;
  Timer? _announcementAlarm;
  /// Evita que un FCM/socket tardío reinicie vibración tras Enterado.
  final Set<String> _ackedAnnouncementIds = <String>{};
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
  /// Canal “home” al entrar a Canal abierto (fallback PTT / caducidad 60 s).
  String get homeGroupId => groupId;
  String get groupName =>
      openChannel ? 'Canal abierto' : (group['name'] as String? ?? 'Canal');
  /// Canal donde se habla (PTT). Chat/pánico siguen en [groupId] (home).
  String get talkGroupId =>
      _talkGroupId.isNotEmpty ? _talkGroupId : groupId;

  String get talkGroupName => _nameForGroup(talkGroupId);

  /// Destino efectivo del PTT en Canal abierto (último fresco o home).
  String get effectivePttGroupId {
    if (!openChannel) return talkGroupId;
    final last = lastHeardGroupId;
    final at = _lastHeardAt;
    if (last != null &&
        at != null &&
        DateTime.now().difference(at) < _lastHeardTtl &&
        _isListenGroup(last)) {
      return last;
    }
    return homeGroupId;
  }

  String get effectivePttGroupName => _nameForGroup(effectivePttGroupId);

  /// Hay “último” válido para el chip (ventana 60 s).
  bool get hasFreshLastHeard {
    if (!openChannel) return false;
    final last = lastHeardGroupId;
    final at = _lastHeardAt;
    if (last == null || at == null) return false;
    return DateTime.now().difference(at) < _lastHeardTtl &&
        _isListenGroup(last);
  }

  List<String> get listenGroupIds {
    if (!openChannel || memberships.length < 2) return [groupId];
    final ids = <String>[];
    final seen = <String>{};
    for (final g in memberships) {
      final id = g['id']?.toString() ?? '';
      if (id.isEmpty || !seen.add(id)) continue;
      ids.add(id);
    }
    if (ids.isEmpty) return [groupId];
    return ids;
  }

  String _nameForGroup(String gid) {
    for (final g in memberships) {
      if (g['id']?.toString() == gid) {
        return g['name']?.toString() ?? 'Canal';
      }
    }
    if (gid == groupId) return group['name']?.toString() ?? 'Canal';
    return 'Canal';
  }

  bool _isListenGroup(String? gid) {
    if (gid == null || gid.isEmpty) return false;
    return listenGroupIds.contains(gid);
  }

  /// Cambia / fija el canal de PTT (chip «Último» o política automática).
  void setTalkGroup(String gid, {bool renewLastHeard = true}) {
    if (!_isListenGroup(gid) || holding) return;
    _talkGroupId = gid;
    final room = _roomsByGroup[gid];
    if (room != null) _room = room;
    if (renewLastHeard && openChannel) {
      lastHeardGroupId = gid;
      lastHeardGroupName = _nameForGroup(gid);
      _lastHeardAt = DateTime.now();
      _armLastHeardExpiry();
    }
    notifyListeners();
  }

  void _armLastHeardExpiry() {
    _lastHeardExpire?.cancel();
    if (!openChannel) return;
    _lastHeardExpire = Timer(_lastHeardTtl, () {
      lastHeardGroupId = null;
      lastHeardGroupName = null;
      _lastHeardAt = null;
      if (!holding && openChannel) {
        _talkGroupId = homeGroupId;
        final room = _roomsByGroup[homeGroupId];
        if (room != null) _room = room;
      }
      notifyListeners();
    });
  }

  /// Hablante remoto en Canal abierto: actualiza destino PTT (no si soy yo).
  void _noteRemoteSpeaker(String gid, String? userId, String? displayName) {
    speakerId = userId;
    speakerName = displayName;
    final me = api.user?['id']?.toString();
    if (userId != null && me != null && userId == me) {
      notifyListeners();
      return;
    }
    if (!_isListenGroup(gid)) {
      notifyListeners();
      return;
    }
    lastHeardGroupId = gid;
    lastHeardGroupName = _nameForGroup(gid);
    _lastHeardAt = DateTime.now();
    if (!holding) {
      _talkGroupId = gid;
      final room = _roomsByGroup[gid];
      if (room != null) _room = room;
    }
    _armLastHeardExpiry();
    if (kRadioOnDemand) {
      _liveGroups.add(gid);
      if (!_radioPlaybackMuted) {
        _cancelSleep(gid);
        unawaited(_wakeRoom(gid));
      }
    }
    notifyListeners();
  }

  String? consumePttTakenNotice() {
    final n = pttTakenNotice;
    pttTakenNotice = null;
    return n;
  }

  String? consumeSessionKickNotice() {
    final n = sessionKickNotice;
    sessionKickNotice = null;
    return n;
  }

  String? consumePanicSenderNotice() {
    final n = panicSenderNotice;
    panicSenderNotice = null;
    return n;
  }

  /// Tras llamada / radio 1:1: sesión de radio solo si hay salas de canal abiertas.
  static Future<void> restoreAudioAfterCall() async {
    final s = current;
    if (kRadioOnDemand && (s == null || s._roomsByGroup.isEmpty || s.listenMuted)) {
      await AudioSessionSetup.release();
      return;
    }
    await AudioSessionSetup.acquireRadio();
  }

  Future<void> _restoreRadioAudio() async {
    if (PrivateCallGate.uiOpen) return;
    if (kRadioOnDemand && _roomsByGroup.isEmpty) {
      await AudioSessionSetup.release();
      return;
    }
    try {
      await AudioSessionSetup.acquireRadio();
    } catch (_) {}
    try {
      await NativeAudioMode.ensureNormal();
    } catch (_) {}
    try {
      await AudioManager.instance.setSpeakerOutputPreferred(true);
    } catch (_) {}
  }

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
      ringKind: CallRingKind.video,
      groupId: gid,
    );
  }

  // ---------- Despertar por push (ptt_wake) ----------

  /// Canal → momento y emisor del push que despertó el radio.
  final Map<String, ({DateTime at, String? speakerId})> _pushWake = {};
  /// Canal → transmisión que terminó antes de conectar: reproducir su grabación.
  final Map<String, ({DateTime since, String? speakerId})> _replayWanted = {};
  AudioPlayer? _replayPlayer;

  /// Push `ptt_wake`: reconecta ya (sin esperar el backoff) y abre la sala del canal.
  void handlePushWake(Map<String, dynamic> data) {
    final gid = data['groupId']?.toString();
    if (gid == null || gid.isEmpty || !_isListenGroup(gid)) return;
    final speakerId = data['speakerId']?.toString();
    _pushWake[gid] = (at: DateTime.now(), speakerId: speakerId);
    if (!connected) {
      try {
        _socket?.connect();
      } catch (_) {}
    }
    if (!_radioPlaybackMuted) {
      _noteRemoteSpeaker(gid, speakerId, data['speakerName']?.toString());
    }
    // Si el socket no vuelve, no dejar la sala (y la CPU) despiertas.
    Timer(const Duration(seconds: 45), () {
      if (connected) return;
      _liveGroups.remove(gid);
      _scheduleSleep(gid);
    });
  }

  /// `ptt:state` sin hablante tras un push reciente: el mensaje ya terminó.
  void _armReplayIfLate(String gid) {
    final w = _pushWake.remove(gid);
    if (w == null) return;
    if (DateTime.now().difference(w.at) > const Duration(seconds: 40)) return;
    if (_radioPlaybackMuted) return;
    _replayWanted[gid] = (
      since: w.at.subtract(const Duration(seconds: 8)),
      speakerId: w.speakerId,
    );
    Timer(const Duration(seconds: 60), () => _replayWanted.remove(gid));
    unawaited(_replayFromServer(gid));
  }

  /// La grabación pudo subirse antes de reconectar: buscarla por REST.
  Future<void> _replayFromServer(String gid) async {
    for (final waitMs in const [0, 2500, 5000]) {
      if (waitMs > 0) await Future<void>.delayed(Duration(milliseconds: waitMs));
      final want = _replayWanted[gid];
      if (want == null) return;
      try {
        final recs = await api.fetchGroupRecordings(gid, hours: 1);
        for (final r in recs) {
          if (await _maybeReplay(r)) return;
        }
      } catch (e) {
        if (kDebugMode) debugPrint('replay fetch: $e');
      }
    }
  }

  /// `true` si la grabación correspondía a un mensaje perdido y se reprodujo.
  Future<bool> _maybeReplay(Map<String, dynamic> rec) async {
    final gid = rec['groupId']?.toString();
    if (gid == null) return false;
    final want = _replayWanted[gid];
    if (want == null) return false;
    final uid = rec['userId']?.toString();
    if (want.speakerId != null && want.speakerId!.isNotEmpty && uid != want.speakerId) {
      return false;
    }
    final created = DateTime.tryParse(rec['createdAt']?.toString() ?? '');
    if (created == null || created.isBefore(want.since)) return false;
    final audioUrl = rec['audioUrl']?.toString();
    if (audioUrl == null || audioUrl.isEmpty) return false;
    _replayWanted.remove(gid);
    try {
      final mime = rec['mimeType']?.toString() ?? '';
      final ext = mime.contains('webm')
          ? 'webm'
          : mime.contains('ogg')
              ? 'ogg'
              : mime.contains('mpeg')
                  ? 'mp3'
                  : 'm4a';
      final file = await api.downloadMediaToTemp(audioUrl, filename: 'ptt_replay_${rec['id']}.$ext');
      _replayPlayer ??= AudioPlayer(playerId: 'ptt_replay');
      await _replayPlayer!.play(DeviceFileSource(file.path));
      speakerName = rec['displayName']?.toString();
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('replay play: $e');
    }
    return true;
  }

  Future<void> start() async {
    current = this;
    error = null;
    PttWake.attach(handlePushWake);
    try {
      final prefs = await SharedPreferences.getInstance();
      listenMuted = prefs.getBool(_kRadioListenMuteKey) ?? false;
      radioHangSeconds = (prefs.getInt(kRadioHangPrefKey) ?? 5).clamp(2, 30);
    } catch (_) {
      listenMuted = false;
    }
    final pendingWake = await PttWake.takePending();
    final pendingGid = pendingWake?['groupId']?.toString();
    if (pendingGid != null && pendingGid.isNotEmpty) {
      _pushWake[pendingGid] = (
        at: DateTime.now().subtract(const Duration(seconds: 5)),
        speakerId: pendingWake?['speakerId']?.toString(),
      );
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

    await DuckDnsHairpin.ensure();

    _socket = io.io(
      AppConfig.socketUrl,
      () {
        final opts = io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .setAuth({'token': api.token})
            .enableReconnection()
            // Sin cobertura: reintentos cada 5 s mantenían la antena encendida.
            .setReconnectionDelay(1500)
            .setReconnectionDelayMax(15000)
            .enableForceNew()
            .build();
        // Fuerza puerto válido (nunca 0) aunque Uri.parse se confunda.
        opts['port'] = AppConfig.socketPortFor(AppConfig.apiBaseUrl);
        opts['secure'] = AppConfig.apiBaseUrl.toLowerCase().startsWith('https');
        return opts;
      }(),
    );

    _socket!
      ..onConnect((_) {
        try {
          _socket!.auth = {'token': api.token};
        } catch (_) {}
        connected = true;
        unawaited(warmPttCuePlayers());
        for (final gid in listenGroupIds) {
          _socket!.emit('ptt:join', {
            'groupId': gid,
            'focus': _presenceFocusWire,
            if (kRadioOnDemand) 'onDemand': true,
          });
        }
        LocationHeartbeat.socketSender = _sendLocationViaSocket;
        notifyListeners();
        unawaited(_ensureLiveKit());
      })
      ..onDisconnect((_) {
        connected = false;
        lastDisconnectAt = DateTime.now();
        notifyListeners();
      })
      ..onConnectError((e) async {
        final s = e.toString().toLowerCase();
        if (s.contains('token') || s.contains('unauthorized') || s.contains('jwt')) {
          try {
            if (await api.tryRefresh()) {
              _socket?.auth = {'token': api.token};
              _socket?.connect();
              return;
            }
          } catch (_) {}
        }
        error = e.toString();
        notifyListeners();
      })
      ..on('call:incoming', (data) {
        if (data is! Map) return;
        final payload = Map<String, dynamic>.from(data);
        final who = payload['callerName']?.toString() ?? 'Usuario';
        final callId = payload['callId']?.toString() ?? '';
        final callerId = payload['callerId']?.toString() ?? '';
        final mode = payload['mode']?.toString() ?? 'call';
        final intent = payload['intent']?.toString();
        final isRadio = mode == 'radio';
        final isRemoteCam = intent == 'remote_camera';
        final isVideo = mode == 'video';
        unawaited(() async {
          // Ya en llamada (misma u otra): no re-marcar Contestar encima.
          if (!isRemoteCam &&
              PrivateCallGate.isBusyWith(callId: callId, peerId: callerId)) {
            return;
          }
          // Auto-cámara: headless, sin ensuciar incomingPrivateCall (aislado de videollamada).
          if (isRemoteCam && await RemoteCameraPrefs.canAutoAccept()) {
            if (!RemoteCameraSession.instance.isActive) {
              await RemoteCameraSession.instance.startSilent(
                api: api,
                call: payload,
              );
            }
            return;
          }
          if (isRemoteCam && PrivateCallGate.uiOpen) {
            // No mezclar solicitud de cámara con llamada 1:1 activa.
            return;
          }
          incomingPrivateCall = payload;
          notifyListeners();
          // Traer UI Contestar al frente (no dejar solo el banner).
          unawaited(IncomingCallWake.bringUiToFront());
          final wakeData = Map<String, dynamic>.from(payload);
          wakeData['type'] = isRadio
              ? 'private_radio'
              : isRemoteCam
                  ? 'private_remote_camera'
                  : isVideo
                      ? 'private_video'
                      : 'private_call';
          unawaited(IncomingCallWake.persist(wakeData));
          // Solo notificación con full-screen intent si la app está en segundo plano
          // (Android la usa para abrir sobre bloqueo). En primer plano = solo pantalla.
          if (appInBackground) {
            await PushService.instance.showLocal(
              title: isRadio
                  ? 'Radio personal'
                  : isRemoteCam
                      ? 'Solicitud de cámara'
                      : isVideo
                          ? 'Videollamada'
                          : 'Llamada privada',
              body: isRadio
                  ? '$who te invita a radio 1:1'
                  : isRemoteCam
                      ? '$who solicita ver la cámara de tu dispositivo'
                      : isVideo
                          ? '$who te llama con video'
                          : '$who te está llamando',
              payload: 'call:$callId',
              isCall: true,
              ringKind:
                  isVideo ? CallRingKind.video : CallRingKind.voice,
              callId: callId.isNotEmpty ? callId : null,
            );
          }
        }());
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
          if (RemoteCameraSession.instance.activeCallId == id) {
            unawaited(RemoteCameraSession.instance.stop(reason: 'remote'));
          }
        }
      })
      ..on('call:remote_control', (data) {
        unawaited(RemoteCameraSession.instance.applyRemoteControl(data));
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
          } else if (t == 'nudge') {
            body = '¡Zumbido!';
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
            if (body == 'nudge') body = '¡Zumbido!';
            if (body.isEmpty) body = 'Nuevo mensaje';
            if (body.length > 120) body = body.substring(0, 120);
          }
        }
        lastDmNotify = {
          'peerId': peerId,
          'peerName': peerName,
          'preview': body,
          'messageType': message is Map
              ? (message['type']?.toString() ?? 'text')
              : 'text',
          if (message is Map) 'messageId': message['id']?.toString(),
          if (message is Map) 'mediaUrl': message['mediaUrl']?.toString(),
          if (message is Map) 'text': message['body']?.toString(),
        };
        notifyListeners();
      })
      ..on('ptt:state', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final gid = m['groupId']?.toString();
        if (!_isListenGroup(gid)) return;
        final speaker = m['speaker'] as Map?;
        if (gid != null) {
          if (speaker == null) {
            _armReplayIfLate(gid);
          } else {
            _pushWake.remove(gid);
          }
        }
        if (speaker == null) {
          if (kRadioOnDemand && gid != null) {
            _liveGroups.remove(gid);
            _scheduleSleep(gid);
          }
          if (gid == talkGroupId ||
              gid == lastHeardGroupId ||
              speakerId != null) {
            speakerId = null;
            speakerName = null;
            notifyListeners();
          }
        } else {
          _noteRemoteSpeaker(
            gid!,
            speaker['userId'] as String?,
            speaker['displayName'] as String?,
          );
        }
      })
      ..on('presence:update', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final gid = m['groupId']?.toString();
        // Presencia del home (chat) o del talk actual.
        if (gid != groupId && gid != talkGroupId) return;
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
      ..on('ptt:waking', (data) {
        if (!_pttWantTransmit || holding) return;
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        final gid = m['groupId']?.toString();
        if (gid != null && gid.isNotEmpty && gid != talkGroupId) return;
        pttWaking = {
          'groupId': gid ?? talkGroupId,
          'count': (m['count'] as num?)?.toInt() ?? 0,
          'delayMs': (m['delayMs'] as num?)?.toInt() ?? 0,
        };
        error = null;
        notifyListeners();
      })
      ..on('ptt:granted', (_) async {
        // Hold: el usuario ya soltó antes del grant → cancelar (como web floorWait).
        if (!_pttWantTransmit) {
          _socket?.emit('ptt:release', {'groupId': talkGroupId});
          return;
        }
        holding = true;
        pttWaking = null;
        error = null;
        notifyListeners();
        try {
          if (kRadioOnDemand) {
            _cancelSleep(talkGroupId);
            final room = await _wakeRoom(talkGroupId);
            if (room == null) throw Exception('Sin audio de red. Prueba Wi‑Fi/4G.');
            _room = room;
            if (!_pttWantTransmit) {
              await releasePtt();
              return;
            }
          }
          // Archivo primero (mismo micrófono / sesión de voz); luego LiveKit al aire.
          await _startPttArchive(talkGroupId);
          await _publishMic();
          // Race tardía: soltó mientras publicábamos.
          if (!_pttWantTransmit && holding) {
            await releasePtt();
          }
        } catch (e) {
          error = e.toString();
          _socket?.emit('ptt:release', {'groupId': talkGroupId});
          holding = false;
          _pttWantTransmit = false;
          pttWaking = null;
          notifyListeners();
          await _discardPttArchive();
          await _restoreRadioAudio();
        }
      })
      ..on('ptt:denied', (data) {
        holding = false;
        _pttWantTransmit = false;
        pttWaking = null;
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        final who = m['speakerName']?.toString();
        if (m['reason'] == 'listen_only') {
          error = 'Solo escucha (sin PTT)';
        } else if (who != null && who.isNotEmpty) {
          error = 'Canal ocupado por $who';
        } else {
          error = 'Canal ocupado';
        }
        notifyListeners();
        unawaited(_restoreRadioAudio());
      })
      ..on('ptt:taken', (data) async {
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        final by = m['byDisplayName']?.toString() ?? 'mando';
        final prev = m['previousUserId']?.toString();
        final me = api.user?['id']?.toString();
        final holderSock = m['holderSocketId']?.toString();
        final mySock = _socket?.id;
        if (holderSock != null &&
            mySock != null &&
            holderSock.isNotEmpty &&
            holderSock == mySock) {
          return;
        }
        if (prev != null && me != null && prev == me && holding) {
          holding = false;
          _pttWantTransmit = false;
          pttWaking = null;
          await _muteMic();
          unawaited(_finishPttArchive(upload: true));
          final reason = m['reason']?.toString();
          pttTakenNotice = reason == 'same_user_other_client'
              ? 'Micrófono pasado a otra sesión tuya'
              : 'Canal tomado por $by';
          notifyListeners();
          await _restoreRadioAudio();
        }
      })
      ..on('ptt:speaker', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final gid = m['groupId']?.toString();
        if (!_isListenGroup(gid)) return;
        final uid = m['userId']?.toString();
        _noteRemoteSpeaker(
          gid!,
          uid,
          m['displayName'] as String?,
        );
        // Destinatarios: mismo bip de press que el remitente.
        final me = api.user?['id']?.toString();
        if (uid != null && uid.isNotEmpty && uid != me) {
          unawaited(playPttPressTone());
        }
      })
      ..on('ptt:recording', (data) {
        if (data is! Map || _replayWanted.isEmpty) return;
        unawaited(_maybeReplay(Map<String, dynamic>.from(data)));
      })
      ..on('ptt:released', (data) async {
        final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        final gid = m['groupId']?.toString();
        if (gid != null) _pushWake.remove(gid);
        if (kRadioOnDemand && gid != null) {
          _liveGroups.remove(gid);
          _scheduleSleep(gid);
        }
        // Quita “quién habla ahora”; el último (60 s) se conserva para contestar.
        if (gid == null ||
            gid == lastHeardGroupId ||
            gid == talkGroupId ||
            speakerId != null) {
          speakerId = null;
          speakerName = null;
        }
        if (holding && (gid == null || gid == talkGroupId)) {
          holding = false;
          _pttWantTransmit = false;
          await _muteMic();
          await _restoreRadioAudio();
        } else if (!holding) {
          // Evita doble pitido tras soltar local (playPttReleaseTone).
          final sinceRelease = _lastLocalPttReleaseAt == null
              ? const Duration(days: 1)
              : DateTime.now().difference(_lastLocalPttReleaseAt!);
          if (sinceRelease.inMilliseconds > 450) {
            unawaited(playPttReleaseTone());
          }
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
          final mid = msg.id;
          if (mid.isNotEmpty) {
            _socket?.emit('chat:delivered', {
              'groupId': groupId,
              'messageIds': [mid],
            });
          }
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
                body: msg.body ?? '',
                payload: groupId,
                groupId: groupId,
                data: {
                  'type': 'chat',
                  'groupId': groupId,
                  'groupName': groupName,
                  'senderId': msg.senderId,
                  'senderName': msg.displayName,
                  'messageId': msg.id,
                  'msgKind': msg.type,
                  if (msg.mediaUrl != null) 'mediaUrl': msg.mediaUrl,
                },
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
        // El servidor ya elige destinatarios (canales destino + despacho con alcance).
        final gid = m['groupId']?.toString();
        final mine = gid == groupId ||
            memberships.any((g) => g['id']?.toString() == gid);
        if (!mine && !canManageUsers(api.user)) return;
        applyIncomingPanic(m);
      })
      ..on('announcement:alert', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        applyAnnouncement(m);
      })
      ..on('session:replaced', (data) {
        final m = data is Map
            ? Map<String, dynamic>.from(data)
            : const <String, dynamic>{};
        final reason = m['reason']?.toString() ?? '';
        final custom = m['message']?.toString().trim() ?? '';
        if (reason == 'force_logout') {
          sessionKickNotice = custom.isNotEmpty
              ? custom
              : 'Tu sesión fue cerrada por un administrador.';
        } else {
          sessionKickNotice = custom.isNotEmpty
              ? custom
              : 'Se inició sesión en otro dispositivo.';
        }
        notifyListeners();
      })
      ..on('panic:update', (data) {
        final m = Map<String, dynamic>.from(data as Map);
        final status = m['status']?.toString();
        if (status == null || status == 'active') return;
        final uid = m['userId']?.toString();
        final me = api.user?['id']?.toString();
        if (uid != null && me != null && uid == me) {
          final id = m['id']?.toString() ?? '';
          final fbKey = '$id:$status';
          if (_lastPanicSenderFbKey != fbKey) {
            _lastPanicSenderFbKey = fbKey;
            final who = m['ackedByName']?.toString();
            if (status == 'acked') {
              panicSenderNotice = (who != null && who.isNotEmpty)
                  ? '$who se dio por enterado de tu alerta'
                  : 'Un operador se dio por enterado de tu alerta';
            } else if (status == 'resolved') {
              panicSenderNotice = (who != null && who.isNotEmpty)
                  ? 'Tu alerta fue atendida por $who'
                  : 'Tu alerta fue atendida';
            } else if (status == 'cancelled') {
              panicSenderNotice = 'Tu alerta fue cancelada';
            }
            notifyListeners();
          }
          return;
        }
        // Enterado en otro dispositivo no apaga esta alarma
        if (status == 'acked') return;
        final id = m['id']?.toString();
        if (id != null && lastPanicId != null && id != lastPanicId) return;
        _clearIncomingPanicState();
        notifyListeners();
      })
      ..on('panic:live_end', (data) {
        final m = data is Map ? Map<String, dynamic>.from(data) : const <String, dynamic>{};
        unawaited(PanicLiveSession.instance.stopFor(m['panicId']?.toString()));
      });

    // El servidor renueva la presencia con el heartbeat del socket (25 s); este ping
    // es respaldo. Cambios de foco se envían al instante desde el ciclo de vida.
    _ping = Timer.periodic(const Duration(seconds: 60), (_) {
      if (connected) pingPresenceFocus();
    });

    _attachGps();
    // Si llegó pánico mientras la app estaba inactiva / sin socket.
    unawaited(syncActivePanic());
    unawaited(syncPendingAnnouncements());
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
    if (gid != null && gid.isNotEmpty && !_isListenGroup(gid) && gid != groupId) {
      return;
    }

    lastPanicId = m['id']?.toString() ?? m['panicId']?.toString();
    incomingPanicLabel = m['displayName']?.toString() ?? 'Operador';
    incomingPanicUserId = uid;
    incomingPanicLat = _toDouble(m['latitude']);
    incomingPanicLng = _toDouble(m['longitude']);
    incomingPanicAccuracyM =
        _toDouble(m['accuracyM']) ?? _toDouble(m['accuracy_m']);
    final parts = splitPanicNote(m['note']?.toString());
    final reason = m['reason']?.toString();
    final detail = m['detail']?.toString();
    incomingPanicReason = (reason != null && reason.isNotEmpty) ? reason : parts.reason;
    incomingPanicDetail = (detail != null && detail.isNotEmpty) ? detail : parts.detail;
    final gname = m['groupName']?.toString();
    incomingPanicGroupName = (gname != null && gname.isNotEmpty) ? gname : null;
    incomingPanicAt =
        DateTime.tryParse(m['createdAt']?.toString() ?? '')?.toLocal() ?? DateTime.now();
    incomingPanicActive = true;
    _startPanicAlarmLoop();
    notifyListeners();
  }

  void _clearIncomingPanicState() {
    _stopPanicAlarmLoop();
    unawaited(PushService.instance.clearPanicNotifications());
    incomingPanicActive = false;
    incomingPanicLabel = null;
    incomingPanicLat = null;
    incomingPanicLng = null;
    incomingPanicAccuracyM = null;
    incomingPanicUserId = null;
    incomingPanicReason = null;
    incomingPanicDetail = null;
    incomingPanicGroupName = null;
    incomingPanicAt = null;
  }

  /// Recupera pánico activo del canal (p. ej. tras abrir app por notificación).
  Future<void> syncActivePanic() async {
    try {
      final events = await api.fetchPanicEvents(status: 'active', limit: 20);
      final me = api.user?['id']?.toString();
      for (final e in events) {
        final gid = e['groupId']?.toString();
        if (gid != groupId && !memberships.any((g) => g['id']?.toString() == gid)) continue;
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
    final focus = _presenceFocusWire;
    if (connected && _socket != null) {
      // Sin groupId el servidor aplica a todos los canales unidos (ptt:join).
      _socket!.emit('presence:ping', {'focus': focus});
    }
    // foreground|background solo por socket. HTTP /presence/heartbeat = service (FGS).
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

  /// GPS por el socket abierto; `false` → LocationHeartbeat usa HTTP.
  Future<bool> _sendLocationViaSocket(double lat, double lng, double? acc) async {
    final s = _socket;
    if (!connected || s == null || !identical(ChannelSession.current, this)) {
      return false;
    }
    try {
      final res = await s
          .emitWithAckAsync('location:update', {
            'latitude': lat,
            'longitude': lng,
            'accuracyM': ?acc,
          })
          .timeout(const Duration(seconds: 6));
      return res is Map && res['ok'] == true;
    } catch (_) {
      return false;
    }
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
  /// Además, llamadas 1:1 pueden «duck» el radio sin tocar la preferencia del usuario.
  bool _radioDuckedForCall = false;

  bool get _radioPlaybackMuted => listenMuted || _radioDuckedForCall;

  /// Silencia el canal de radio mientras hay llamada/videollamada (sin cambiar Silenciar).
  Future<void> duckRadioForPrivateCall() async {
    if (_radioDuckedForCall) {
      await _applyListenMute();
      return;
    }
    _radioDuckedForCall = true;
    await _applyListenMute();
  }

  Future<void> unduckRadioAfterPrivateCall() async {
    if (!_radioDuckedForCall) return;
    _radioDuckedForCall = false;
    await _applyListenMute();
    if (!listenMuted &&
        livekitReady &&
        !PrivateCallGate.uiOpen &&
        (!kRadioOnDemand || _roomsByGroup.isNotEmpty)) {
      try {
        await AudioSessionSetup.acquireRadio();
      } catch (_) {}
    }
  }

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
      // Bajo demanda: silenciado = no gastar datos en salas abiertas.
      if (kRadioOnDemand) {
        for (final gid in _roomsByGroup.keys.toList()) {
          _scheduleSleep(gid);
        }
      }
    } else if (!muted &&
        livekitReady &&
        !_radioDuckedForCall &&
        (!kRadioOnDemand || _roomsByGroup.isNotEmpty)) {
      await AudioSessionSetup.acquireRadio();
    }
  }

  Future<void> toggleListenMuted() => setListenMuted(!listenMuted);

  Future<void> _applyListenMute() async {
    final muted = _radioPlaybackMuted;
    final rooms = _roomsByGroup.isNotEmpty
        ? _roomsByGroup.values.toList()
        : (_room != null ? [_room!] : <Room>[]);
    for (final room in rooms) {
      for (final p in room.remoteParticipants.values) {
        for (final pub in p.audioTrackPublications) {
          try {
            final track = pub.track;
            // Corta reproducción local sin dejar de recibir señal (mejor que solo disable).
            if (track is RemoteAudioTrack) {
              try {
                track.mediaStreamTrack.enabled = !muted;
              } catch (_) {}
            }
            if (muted) {
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
  }

  /// Reaplica altavoz de radio / mute de escucha (p. ej. tras bloquear pantalla).
  Future<void> ensureBackgroundAudio() async {
    // No pelear con la ruta de audio de una llamada 1:1 (auricular).
    if (PrivateCallGate.uiOpen) return;
    if ((_room == null && _roomsByGroup.isEmpty) || !livekitReady || listenMuted) {
      return;
    }
    await AudioSessionSetup.acquireRadio();
    try {
      await NativeAudioMode.ensureNormal();
    } catch (_) {}
    if (!listenMuted) {
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      } catch (_) {
        /* desktop / unsupported */
      }
    }
    await _applyListenMute();
  }

  /// Llamada 1:1 o video grupal ya tienen la sesión de voz. No bajar a media.
  bool _callOwnsAudio() =>
      PrivateCallGate.uiOpen || GroupVideoScreen.uiOpen;

  static bool _roomAlive(Room? r) =>
      r != null &&
      (r.connectionState == ConnectionState.connected ||
          r.connectionState == ConnectionState.reconnecting);

  /// Reconexión del socket (cambio de red, pantalla apagada): LiveKit reanuda sus
  /// salas por su cuenta. Rehacerlas todas duplicaba identidades y gastaba datos.
  Future<void> _ensureLiveKit() async {
    if (kRadioOnDemand) {
      // Sin salas en reposo: el canal está «listo» con el socket; el token del
      // canal de PTT se precarga para que la primera conexión sea rápida.
      if (!livekitReady) {
        livekitReady = true;
        error = null;
        notifyListeners();
      }
      unawaited(_liveKitToken(talkGroupId).then((_) {}, onError: (_) {}));
      return;
    }
    final talkId = talkGroupId;
    final talk = _roomsByGroup[talkId];
    if (!_roomAlive(talk) || !identical(_room, talk)) {
      await _connectLiveKit();
      return;
    }
    if (!livekitReady) {
      livekitReady = true;
      error = null;
      notifyListeners();
    }
    final missing = listenGroupIds
        .where((gid) => gid != talkId && !_roomAlive(_roomsByGroup[gid]))
        .toSet();
    for (final gid in missing) {
      if (!identical(ChannelSession.current, this)) return;
      final dead = _roomsByGroup.remove(gid);
      if (dead != null) {
        try {
          dead.removeListener(_onRoomChanged);
          await dead.disconnect();
          await dead.dispose();
        } catch (_) {}
      }
      try {
        await _connectRoom(gid);
        await _applyListenMute();
        notifyListeners();
      } catch (e) {
        if (kDebugMode) debugPrint('LiveKit listen skip [$gid]: $e');
      }
    }
  }

  /// Token LiveKit (TTL 1 h en servidor) cacheado 45 min por canal.
  Future<Map<String, dynamic>> _liveKitToken(String gid) async {
    final hit = _lkTokens[gid];
    if (hit != null && DateTime.now().difference(hit.at) < _lkTokenTtl) {
      return hit.lk;
    }
    final lk = await api.fetchLiveKitToken(gid);
    _lkTokens[gid] = (lk: lk, at: DateTime.now());
    return lk;
  }

  void _cancelSleep(String gid) {
    _roomHang.remove(gid)?.cancel();
  }

  /// Cuelgue: cerrar la sala del canal tras [radioHangSeconds] sin transmisión.
  void _scheduleSleep(String gid) {
    if (!kRadioOnDemand) return;
    _cancelSleep(gid);
    if (!_roomsByGroup.containsKey(gid) && !_roomWaking.containsKey(gid)) return;
    _roomHang[gid] = Timer(Duration(seconds: radioHangSeconds), () {
      _roomHang.remove(gid);
      unawaited(_sleepRoom(gid));
    });
  }

  /// Conecta (o reutiliza) la sala del canal. null si no se pudo.
  Future<Room?> _wakeRoom(String gid) {
    final alive = _roomsByGroup[gid];
    if (_roomAlive(alive)) return Future.value(alive);
    final pending = _roomWaking[gid];
    if (pending != null) return pending;
    final fut = () async {
      try {
        if (alive != null) await _sleepRoom(gid, keepAudio: true);
        if (!_callOwnsAudio() && !holding && !_pttWantTransmit) {
          await AudioSessionSetup.acquireRadio();
        }
        CpuAwake.hold('radio');
        try {
          await _connectRoom(gid, isTalk: gid == talkGroupId);
        } catch (e) {
          // Token vencido/revocado: un reintento con token nuevo.
          _lkTokens.remove(gid);
          if (kDebugMode) debugPrint('LiveKit wake retry [$gid]: $e');
          await _connectRoom(gid, isTalk: gid == talkGroupId);
        }
        final room = _roomsByGroup[gid];
        if (gid == talkGroupId && room != null) _room = room;
        await _applyListenMute();
        if (!holding && !_pttWantTransmit && !_radioPlaybackMuted && !_callOwnsAudio()) {
          try {
            await AudioManager.instance.setSpeakerOutputPreferred(true);
          } catch (_) {}
        }
        notifyListeners();
        // Se reprograma en cada fin de transmisión; aquí cubre «despertó y nadie habló».
        _roomHang.remove(gid)?.cancel();
        _roomHang[gid] = Timer(Duration(seconds: radioHangSeconds + 10), () {
          _roomHang.remove(gid);
          unawaited(_sleepRoom(gid));
        });
        return room;
      } catch (e) {
        if (kDebugMode) debugPrint('LiveKit wake fail [$gid]: $e');
        error = _friendlyLiveKitError(e);
        if (_roomsByGroup.isEmpty) CpuAwake.release('radio');
        notifyListeners();
        return null;
      } finally {
        _roomWaking.remove(gid);
      }
    }();
    _roomWaking[gid] = fut;
    return fut;
  }

  /// Cierra la sala del canal (fin del cuelgue). Sin salas: suelta audio y CPU.
  Future<void> _sleepRoom(String gid, {bool keepAudio = false}) async {
    if (!keepAudio) {
      if ((holding || _pttWantTransmit) && gid == talkGroupId) return;
      if (_liveGroups.contains(gid) || _roomWaking.containsKey(gid)) return;
    }
    final room = _roomsByGroup.remove(gid);
    if (room == null) return;
    final ev = _eventsByGroup.remove(gid);
    if (ev != null) {
      _extraRoomEvents.remove(ev);
      if (identical(_roomEvents, ev)) _roomEvents = null;
      try {
        await ev.dispose();
      } catch (_) {}
    }
    if (identical(_room, room)) {
      _room = null;
      _mic = null;
      _micPub = null;
    }
    try {
      room.removeListener(_onRoomChanged);
      await room.disconnect();
      await room.dispose();
    } catch (_) {}
    if (_roomsByGroup.isEmpty && !keepAudio) {
      CpuAwake.release('radio');
      if (!_callOwnsAudio()) await AudioSessionSetup.release();
    }
    notifyListeners();
  }

  Future<bool> _connectRoom(String gid, {bool isTalk = false}) async {
    final lk = kRadioOnDemand ? await _liveKitToken(gid) : await api.fetchLiveKitToken(gid);
    final e2ee = await buildVoiceE2eeOptions(
      lk['e2eeKey']?.toString(),
      required: lk['e2ee'] == true,
    );
    final room = Room(
      roomOptions: RoomOptions(
        adaptiveStream: false,
        dynacast: false,
        encryption: e2ee,
        defaultAudioPublishOptions: const AudioPublishOptions(
          dtx: true,
          red: false,
          encoding: AudioEncoding.presetSpeech,
        ),
        defaultAudioCaptureOptions: const AudioCaptureOptions(
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          highPassFilter: true,
          stopAudioCaptureOnMute: true,
        ),
      ),
    );
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
    if (isTalk) {
      _roomEvents = ev;
    } else {
      _extraRoomEvents.add(ev);
    }
    _eventsByGroup[gid] = ev;
    final lkUrl = AppConfig.publicLiveKitUrl(lk['url'] as String);
    if (kDebugMode) debugPrint('LiveKit connect [$gid] → $lkUrl');
    try {
      await room.connect(
        lkUrl,
        lk['token'] as String,
        connectOptions: const ConnectOptions(autoSubscribe: true),
      );
    } catch (_) {
      _eventsByGroup.remove(gid);
      _extraRoomEvents.remove(ev);
      if (identical(_roomEvents, ev)) _roomEvents = null;
      try {
        await ev.dispose();
        room.removeListener(_onRoomChanged);
        await room.dispose();
      } catch (_) {}
      rethrow;
    }
    _roomsByGroup[gid] = room;
    if (isTalk) {
      _room = room;
    }
    return true;
  }

  Future<void> _connectLiveKit() async {
    try {
      await _disposeAllRooms();
      // Sesión media ANTES de PeerConnection (evita MODE_IN_COMMUNICATION al conectar).
      // No pisar llamada/video en curso: acquireRadio fuerza MODE_NORMAL y silencia WebRTC.
      if (!listenMuted && !_callOwnsAudio()) {
        await AudioSessionSetup.acquireRadio();
        await NativeAudioMode.ensureNormal();
      }

      final ids = List<String>.from(listenGroupIds);
      final talkId = talkGroupId;
      // Primero el canal de PTT; el resto (Canal abierto) en segundo plano.
      ids.removeWhere((id) => id == talkId);
      ids.insert(0, talkId);

      var talkOk = false;
      Object? lastErr;

      Future<bool> connectOne(String gid, {bool isTalk = false}) =>
          _connectRoom(gid, isTalk: isTalk);

      // Talk: hasta 2 intentos (ICE a veces falla al primer PeerConnection).
      for (var attempt = 0; attempt < 2 && !talkOk; attempt++) {
        if (attempt > 0) {
          await Future<void>.delayed(const Duration(milliseconds: 700));
          if (kDebugMode) debugPrint('LiveKit retry talk [$talkId]');
        }
        try {
          talkOk = await connectOne(talkId, isTalk: true);
        } catch (e) {
          lastErr = e;
          if (kDebugMode) debugPrint('LiveKit fail talk [$talkId]: $e');
          try {
            final bad = _roomsByGroup.remove(talkId);
            await bad?.disconnect();
            await bad?.dispose();
          } catch (_) {}
          _room = null;
        }
      }

      if (talkOk) {
        livekitReady = true;
        error = null;
        notifyListeners();
        await ensureBackgroundAudio();
        await _applyListenMute();
      } else {
        livekitReady = false;
        error = _friendlyLiveKitError(lastErr ?? 'Sin audio');
        notifyListeners();
        return;
      }

      // Escucha adicional (Canal abierto): no tumba el PTT si falla ICE.
      final extras = ids.skip(1).toList();
      if (extras.isEmpty) return;
      unawaited(() async {
        for (final gid in extras) {
          await Future<void>.delayed(const Duration(milliseconds: 450));
          if (!identical(ChannelSession.current, this)) return;
          if (_roomsByGroup.containsKey(gid)) continue;
          try {
            await connectOne(gid, isTalk: false);
            await _applyListenMute();
            notifyListeners();
          } catch (e) {
            if (kDebugMode) debugPrint('LiveKit listen skip [$gid]: $e');
          }
        }
        if (!listenMuted && identical(ChannelSession.current, this)) {
          await AudioSessionSetup.acquireRadio();
          await NativeAudioMode.ensureNormal();
        }
      }());
    } catch (e) {
      livekitReady = false;
      error = _friendlyLiveKitError(e);
      notifyListeners();
    }
  }

  String _friendlyLiveKitError(Object e) {
    final s = e.toString();
    final low = s.toLowerCase();
    if (low.contains('mediaconnect') ||
        low.contains('peerconnection') ||
        low.contains('ice') ||
        low.contains('timed out') ||
        low.contains('timeout')) {
      return 'Sin audio de red. Prueba Wi‑Fi/4G o cambia de canal.';
    }
    if (s.length > 160) return '${s.substring(0, 160)}…';
    return s;
  }

  Future<void> _disposeAllRooms() async {
    for (final t in _roomHang.values) {
      t.cancel();
    }
    _roomHang.clear();
    _eventsByGroup.clear();
    await _roomEvents?.dispose();
    _roomEvents = null;
    for (final ev in _extraRoomEvents) {
      try {
        await ev.dispose();
      } catch (_) {}
    }
    _extraRoomEvents.clear();
    for (final room in _roomsByGroup.values) {
      try {
        room.removeListener(_onRoomChanged);
        await room.disconnect();
        await room.dispose();
      } catch (_) {}
    }
    _roomsByGroup.clear();
    _room = null;
  }

  void _onRoomChanged() {
    // Fuerza rebuild cuando llegan/salen tracks remotos (audio PTT).
    notifyListeners();
  }

  Future<void> pressPtt() async {
    if (!connected || holding || _pttWantTransmit) return;
    error = null;
    if (openChannel) {
      final dest = effectivePttGroupId;
      _talkGroupId = dest;
      final room = _roomsByGroup[dest];
      if (room != null) {
        _room = room;
      } else if (!kRadioOnDemand && !_roomsByGroup.containsKey(dest)) {
        // Sala aún no lista: no pedir floor a ciegas.
        error = 'Audio de «${_nameForGroup(dest)}» aún no listo';
        notifyListeners();
        return;
      }
    }
    _pttWantTransmit = true;
    pttWaking = null;
    error = null;
    notifyListeners();
    if (kRadioOnDemand) {
      // Conectar la sala en paralelo al bip y al pedido de floor.
      _cancelSleep(talkGroupId);
      unawaited(_wakeRoom(talkGroupId));
    }
    // Bip primero (players lowLatency); luego voz — evita que acquireVoice mutee el cue.
    await playPttPressTone();
    // Si soltó durante el bip, no pedir floor (releasePtt ya limpió).
    if (!_pttWantTransmit) {
      notifyListeners();
      return;
    }
    await AudioSessionSetup.acquireVoice();
    if (!_pttWantTransmit) {
      await _restoreRadioAudio();
      notifyListeners();
      return;
    }
    // Precalentar en paralelo al request
    unawaited(_ensureMicReady());
    _socket?.emit('ptt:request', {'groupId': talkGroupId});
    notifyListeners();
  }

  Future<void> releasePtt() async {
    // Hold: cancelar también si aún no llegó `ptt:granted` (web: floorWait.requested).
    if (!_pttWantTransmit && !holding) return;
    final wasHolding = holding;
    final hadPending = _pttWantTransmit;
    _pttWantTransmit = false;
    holding = false;
    pttWaking = null;
    _lastLocalPttReleaseAt = DateTime.now();
    if (wasHolding || hadPending) {
      await playPttReleaseTone();
    }
    if (wasHolding) {
      await _muteMic();
      unawaited(_finishPttArchive(upload: true));
    } else {
      await _discardPttArchive();
    }
    _socket?.emit('ptt:release', {'groupId': talkGroupId});
    await _restoreRadioAudio();
    if (kRadioOnDemand) _scheduleSleep(talkGroupId);
    notifyListeners();
  }

  /// Toque 1 = al aire; toque 2 = liberar (Pulsación Larga / latch).
  Future<void> togglePtt() async {
    if (holding || _pttWantTransmit) {
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
        _mic = pubs.first.track;
      }
    } catch (e) {
      final mic = await LocalAudioTrack.create(
        const AudioCaptureOptions(
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          highPassFilter: true,
          stopAudioCaptureOnMute: true,
        ),
      );
      await mic.mute(stopOnMute: true);
      _mic = mic;
      _micPub = await lp.publishAudioTrack(
        mic,
        publishOptions: const AudioPublishOptions(
          dtx: true,
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
        _mic = pubs.first.track;
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

  /// Empieza a grabar el PTT local para subirlo a RESERVADO al soltar.
  Future<void> _startPttArchive(String groupId) async {
    await _discardPttArchive();
    if (groupId.isEmpty) return;
    try {
      final ok = await _pttArchive.hasPermission();
      if (!ok) return;
      final dir = await getTemporaryDirectory();
      final path = p.join(
        dir.path,
        'ptt-${DateTime.now().millisecondsSinceEpoch}.m4a',
      );
      await _pttArchive.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 16000,
          numChannels: 1,
          audioInterruption: AudioInterruptionMode.none,
          androidConfig: AndroidRecordConfig(
            audioSource: AndroidAudioSource.voiceCommunication,
            manageBluetooth: false,
            audioManagerMode: AudioManagerMode.modeInCommunication,
          ),
        ),
        path: path,
      );
      _pttArchivePath = path;
      _pttArchiveStartedAt = DateTime.now();
      _pttArchiveGroupId = groupId;
    } catch (e) {
      debugPrint('PTT archive start: $e');
      _pttArchivePath = null;
      _pttArchiveStartedAt = null;
      _pttArchiveGroupId = null;
    }
  }

  Future<void> _discardPttArchive() async {
    try {
      if (await _pttArchive.isRecording()) {
        final path = await _pttArchive.stop();
        if (path != null) {
          try {
            await File(path).delete();
          } catch (_) {}
        }
      }
    } catch (_) {}
    final leftover = _pttArchivePath;
    _pttArchivePath = null;
    _pttArchiveStartedAt = null;
    _pttArchiveGroupId = null;
    if (leftover != null) {
      try {
        await File(leftover).delete();
      } catch (_) {}
    }
  }

  /// Detiene la grabación local y la sube (fire-and-forget).
  Future<void> _finishPttArchive({required bool upload}) async {
    final groupId = _pttArchiveGroupId;
    final started = _pttArchiveStartedAt;
    String? path = _pttArchivePath;
    _pttArchivePath = null;
    _pttArchiveStartedAt = null;
    _pttArchiveGroupId = null;

    try {
      if (await _pttArchive.isRecording()) {
        path = await _pttArchive.stop() ?? path;
      }
    } catch (e) {
      debugPrint('PTT archive stop: $e');
    }

    if (!upload || path == null || groupId == null || groupId.isEmpty) {
      if (path != null) {
        try {
          await File(path).delete();
        } catch (_) {}
      }
      return;
    }

    final durationMs =
        started != null ? DateTime.now().difference(started).inMilliseconds : 0;
    // Misma ventana mínima que la consola web (usePtt).
    if (durationMs < 450) {
      try {
        await File(path).delete();
      } catch (_) {}
      return;
    }

    final file = File(path);
    try {
      if (!await file.exists() || await file.length() < 800) {
        try {
          await file.delete();
        } catch (_) {}
        return;
      }
    } catch (_) {
      return;
    }

    unawaited(() async {
      try {
        await api.uploadPttRecording(
          groupId,
          filePath: path!,
          durationMs: durationMs,
        );
      } catch (e) {
        debugPrint('PTT archive upload: $e');
      } finally {
        try {
          await File(path!).delete();
        } catch (_) {}
      }
    }());
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

  /// Libera el mic del canal para grabar nota de voz (paquete `record`).
  Future<void> pauseMicForVoiceNote() => pauseForPersonalRadio();

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

  /// Tras enviar/cancelar nota de voz: rearmar audio de canal.
  Future<void> resumeAfterVoiceNote() => resumeAfterPersonalRadio();

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
        'replyToId': ?replyId,
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
      unawaited(
        api
            .markMessagesRead(groupId, upToMessageId)
            .catchError((_) => <String, dynamic>{}),
      );
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
          'replyToId': ?replyId,
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

  void applyAnnouncement(Map<String, dynamic> m) {
    final rawId = m['id']?.toString() ?? m['announcementId']?.toString();
    final id = rawId?.trim().toLowerCase();
    final text = m['body']?.toString();
    if (id == null || id.isEmpty || text == null || text.isEmpty) return;
    if (_ackedAnnouncementIds.contains(id)) return;
    if (announcementId == id && announcementActive) return;
    announcementId = id;
    announcementBody = text;
    announcementFrom = m['createdBy']?.toString() ??
        m['createdByName']?.toString();
    announcementActive = true;
    _startAnnouncementAlarm();
    notifyListeners();
  }

  void _startAnnouncementAlarm() {
    // Un solo waveform nativo en bucle (no Timer+plugin: OEM no cancelaba).
    unawaited(PanicVibration.startAlarm());
  }

  Future<void> _stopAnnouncementAlarm() async {
    _announcementAlarm?.cancel();
    _announcementAlarm = null;
    await PanicVibration.stop();
  }

  Future<void> syncPendingAnnouncements() async {
    try {
      await _loadAckedAnnouncementIds();
      final list = await api.fetchPendingAnnouncements();
      if (list.isEmpty) return;
      Map<String, dynamic>? next;
      for (final a in list) {
        final aid = (a['id']?.toString() ?? '').trim().toLowerCase();
        if (aid.isEmpty || _ackedAnnouncementIds.contains(aid)) continue;
        next = a;
        break;
      }
      if (next == null) return;
      applyAnnouncement(next);
    } catch (e) {
      debugPrint('syncPendingAnnouncements: $e');
    }
  }

  static const _kAckedAnnKey = 'tacticalptx_acked_announcements_v1';

  Future<void> _loadAckedAnnouncementIds() async {
    if (_ackedAnnouncementIds.isNotEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList(_kAckedAnnKey) ?? const <String>[];
      _ackedAnnouncementIds.addAll(raw.map((e) => e.trim().toLowerCase()));
    } catch (_) {}
  }

  Future<void> _persistAckedAnnouncementIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _ackedAnnouncementIds.take(40).toList();
      await prefs.setStringList(_kAckedAnnKey, list);
    } catch (_) {}
  }

  Future<bool> ackAnnouncement() async {
    if (announcementAcking) return false;
    announcementAcking = true;
    final id = announcementId;
    // Cortar vibración YA (antes de red / sync).
    announcementActive = false;
    await _stopAnnouncementAlarm();
    announcementBody = null;
    announcementFrom = null;
    announcementId = null;
    if (id != null && id.isNotEmpty) {
      _ackedAnnouncementIds.add(id);
      if (_ackedAnnouncementIds.length > 40) {
        final drop = _ackedAnnouncementIds.take(20).toList();
        _ackedAnnouncementIds.removeAll(drop);
        _ackedAnnouncementIds.add(id);
      }
      unawaited(_persistAckedAnnouncementIds());
      unawaited(PushService.instance.clearAnnouncementNotifications(id));
    }
    notifyListeners();
    try {
      if (id != null) await api.ackAnnouncement(id);
      // No reabrir el mismo aviso; solo el siguiente pendiente distinto.
      await syncPendingAnnouncements();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      // Por si un OEM reanudó el motor tras el primer cancel.
      unawaited(PanicVibration.stop());
      announcementAcking = false;
      notifyListeners();
    }
  }

  /// Alerta a los canales elegidos (o `target: 'all'`, solo administración) + despacho con alcance.
  Future<bool> triggerPanic({
    List<String> groupIds = const [],
    String? target,
    String? note,
  }) async {
    if (panicSending) return false;
    panicSending = true;
    error = null;
    notifyListeners();
    LocationHeartbeat.boost();
    try {
      final ids = groupIds.isEmpty && target != 'all' ? [groupId] : groupIds;
      final data = await api.triggerPanic(
        groupIds: ids,
        target: target,
        latitude: lastLatitude,
        longitude: lastLongitude,
        accuracyM: lastAccuracyM,
        note: note,
      );
      final event = data['event'] as Map<String, dynamic>?;
      lastPanicId = event?['id'] as String?;
      final livePanicId =
          (event?['live'] as Map?)?['panicId']?.toString() ?? lastPanicId;
      if (livePanicId != null) {
        // Enviar la alerta = consentimiento. Primero sale la alerta; luego el sistema
        // pide cámara/mic (solo si faltan) y arranca la transmisión.
        unawaited(() async {
          await PanicLiveSession.requestPermissions();
          await PanicLiveSession.instance.start(api: api, panicId: livePanicId);
        }());
      }
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
    if (identical(current, this)) {
      current = null;
      PttWake.detach();
    }
    try {
      await _replayPlayer?.dispose();
    } catch (_) {}
    _replayPlayer = null;
    _ping?.cancel();
    _typingIdle?.cancel();
    _lastHeardExpire?.cancel();
    _lastHeardExpire = null;
    _stopPanicAlarmLoop();
    announcementActive = false;
    await _stopAnnouncementAlarm();
    await _discardPttArchive();
    try {
      await _pttArchive.dispose();
    } catch (_) {}
    await _stopMic();
    for (final gid in listenGroupIds) {
      _socket?.emit('ptt:leave', {'groupId': gid});
    }
    if (LocationHeartbeat.socketSender == _sendLocationViaSocket) {
      LocationHeartbeat.socketSender = null;
    }
    for (final t in _roomHang.values) {
      t.cancel();
    }
    _roomHang.clear();
    _socket?.dispose();
    _socket = null;
    await _disposeAllRooms();
    CpuAwake.release('radio');
    await AudioSessionSetup.release();
    try {
      await NativeAudioMode.ensureNormal();
    } catch (_) {}
  }
}

