import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'widgets/panic_confirm_sheet.dart' show splitPanicNote;

const kPanicReasonEmoji = <String, String>{
  'Emergencia': '🆘',
  'Apoyo': '🤝',
  'Médica': '🚑',
  'Agresión': '⚠️',
};

/// Ícono monocromo de la barra de estado (res/drawable-*/ic_stat_sicom.png).
const kNotifSmallIcon = 'ic_stat_sicom';
const kNotifAccent = Color(0xFF1E88E5);
const kNotifDanger = Color(0xFFC62828);
const kNotifWarn = Color(0xFFF0B429);

/// false = mensajes como aviso nativo simple (tono/vibración del teléfono, sin foto
/// ni Responder). true = conversación acumulada con foto y Responder / Marcar leído.
const kRichChatNotifications = false;

const kNotifActionReply = 'msg_reply';
const kNotifActionRead = 'msg_read';

/// Partes visuales de un aviso de bandeja (no llamadas entrantes).
class RichNotifParts {
  RichNotifParts({
    required this.title,
    required this.body,
    this.style,
    this.largeIcon,
    this.color = kNotifAccent,
    this.actions,
    this.category,
    this.ongoing = false,
    this.autoCancel = true,
    this.subText,
    this.timeoutAfter,
    this.silent = false,
  });

  final String title;
  final String body;
  final StyleInformation? style;
  final AndroidBitmap<Object>? largeIcon;
  final Color color;
  final List<AndroidNotificationAction>? actions;
  final AndroidNotificationCategory? category;
  final bool ongoing;
  final bool autoCancel;
  final String? subText;
  final int? timeoutAfter;
  final bool silent;
}

/// Notificaciones con estilo de conversación: foto de quien escribe, canal,
/// últimos mensajes acumulados y acciones Responder / Marcar leído.
/// Funciona en el isolate de FCM (segundo plano) y en el principal.
class RichNotify {
  RichNotify._();

  static const _histPrefix = 'tacticalptx_notif_hist_v1_';
  static const _maxLines = 6;
  static const _avatarMaxAge = Duration(hours: 12);

  static bool isChatType(String? type) =>
      type == 'chat' || type == 'dm' || type == 'dm_nudge';

  /// Texto del mensaje según su tipo (foto, audio, archivo…).
  static String messageText(Map<String, dynamic> data, String fallback) {
    final kind = data['msgKind']?.toString() ?? '';
    final body = fallback.trim();
    String label;
    switch (kind) {
      case 'image':
        label = '📷 Foto';
        break;
      case 'audio':
        label = '🎤 Audio';
        break;
      case 'video':
        label = '🎬 Video';
        break;
      case 'file':
        label = '📎 Archivo';
        break;
      case 'sticker':
        label = '🏷️ Sticker';
        break;
      default:
        return body.isEmpty ? 'Nuevo mensaje' : body;
    }
    if (body.isEmpty || body == label || body.startsWith(label)) return label;
    if (body.startsWith('📷') || body.startsWith('🎤') || body.startsWith('🎬') ||
        body.startsWith('📎')) {
      return body;
    }
    return '$label · $body';
  }

  /// Construye el aviso según el tipo del push. [tag] agrupa la conversación.
  static Future<RichNotifParts> build({
    required Map<String, dynamic> data,
    required String title,
    required String body,
    String? tag,
  }) async {
    final type = data['type']?.toString();
    try {
      if (isChatType(type)) {
        if (kRichChatNotifications) {
          return await _buildChat(data: data, title: title, body: body, tag: tag);
        }
        return _buildPlainChat(data, title, body);
      }
      switch (type) {
        case 'panic':
          return _buildPanic(data, title, body);
        case 'missed_call':
          return _buildMissedCall(data, title, body);
        case 'announcement':
          return RichNotifParts(
            title: '📢 ${title.isEmpty ? 'AVISO' : title}',
            body: body,
            style: BigTextStyleInformation(body),
            color: kNotifWarn,
            category: AndroidNotificationCategory.reminder,
          );
        case 'geofence':
          return RichNotifParts(
            title: '📍 $title',
            body: body,
            style: BigTextStyleInformation(body),
            color: kNotifWarn,
            category: AndroidNotificationCategory.status,
          );
      }
    } catch (e) {
      debugPrint('RichNotify.build: $e');
    }
    return RichNotifParts(
      title: title,
      body: body,
      style: body.length > 40 ? BigTextStyleInformation(body) : null,
    );
  }

  /// Aviso nativo simple (mismo formato que el push del servidor): remitente · canal y texto.
  static RichNotifParts _buildPlainChat(
    Map<String, dynamic> data,
    String title,
    String body,
  ) {
    final type = data['type']?.toString();
    final sender = (data['senderName']?.toString().trim().isNotEmpty ?? false)
        ? data['senderName'].toString().trim()
        : title;
    final groupName = data['groupName']?.toString().trim() ?? '';
    final head = type == 'chat' && groupName.isNotEmpty && !sender.contains(groupName)
        ? '$sender · $groupName'
        : sender;
    final text = type == 'dm_nudge' ? '📳 ¡Zumbido!' : messageText(data, body);
    return RichNotifParts(
      title: head,
      body: text,
      style: BigTextStyleInformation(text),
      category: AndroidNotificationCategory.message,
    );
  }

  static Future<RichNotifParts> _buildChat({
    required Map<String, dynamic> data,
    required String title,
    required String body,
    String? tag,
  }) async {
    final type = data['type']?.toString();
    final isGroup = type == 'chat';
    final nudge = type == 'dm_nudge';
    final senderId =
        data['senderId']?.toString() ?? (isGroup ? null : data['peerId']?.toString());
    final senderName = (data['senderName']?.toString().trim().isNotEmpty ?? false)
        ? data['senderName'].toString()
        : title;
    final groupName = data['groupName']?.toString().trim() ?? '';
    final text = nudge
        ? '📳 ¡Zumbido!'
        : messageText(data, body);

    final avatar = await _avatarFile(senderId);

    final history = await _pushHistory(
      tag ?? (isGroup ? 'g:${data['groupId']}' : 'dm:$senderId'),
      _HistLine(
        messageId: data['messageId']?.toString() ?? '',
        senderId: senderId ?? '',
        senderName: senderName,
        text: text,
        avatarPath: avatar?.path,
        at: DateTime.now(),
      ),
    );

    final messages = <Message>[
      for (final h in history)
        Message(
          h.text,
          h.at,
          Person(
            key: h.senderId.isEmpty ? h.senderName : h.senderId,
            name: h.senderName,
            icon: h.avatarPath != null && File(h.avatarPath!).existsSync()
                ? BitmapFilePathAndroidIcon(h.avatarPath!)
                : null,
          ),
        ),
    ];

    final convTitle = isGroup
        ? (groupName.isNotEmpty ? groupName : 'Canal')
        : null;
    final count = history.length;
    final picture = data['msgKind']?.toString() == 'image'
        ? await _mediaFile(data['mediaUrl']?.toString())
        : null;

    final StyleInformation style = picture != null && count <= 1
        ? BigPictureStyleInformation(
            FilePathAndroidBitmap(picture.path),
            largeIcon: avatar != null ? FilePathAndroidBitmap(avatar.path) : null,
            contentTitle: isGroup ? '$senderName · $convTitle' : senderName,
            summaryText: text,
            hideExpandedLargeIcon: true,
          )
        : MessagingStyleInformation(
            const Person(name: 'Tú', key: 'me'),
            conversationTitle: convTitle,
            groupConversation: isGroup,
            messages: messages,
          );

    return RichNotifParts(
      title: isGroup ? '$senderName · $convTitle' : senderName,
      body: text,
      style: style,
      largeIcon: avatar != null ? FilePathAndroidBitmap(avatar.path) : null,
      color: nudge ? kNotifWarn : kNotifAccent,
      subText: count > 1 ? '$count mensajes nuevos' : null,
      category: AndroidNotificationCategory.message,
      actions: const <AndroidNotificationAction>[
        AndroidNotificationAction(
          kNotifActionReply,
          'Responder',
          inputs: <AndroidNotificationActionInput>[
            AndroidNotificationActionInput(label: 'Escribe un mensaje…'),
          ],
          cancelNotification: false,
        ),
        AndroidNotificationAction(
          kNotifActionRead,
          'Marcar leído',
          cancelNotification: true,
        ),
      ],
    );
  }

  static RichNotifParts _buildPanic(
    Map<String, dynamic> data,
    String title,
    String body,
  ) {
    final who = data['displayName']?.toString() ?? 'Operador';
    final split = splitPanicNote(data['note']?.toString());
    final reason = (data['reason']?.toString().trim().isNotEmpty ?? false)
        ? data['reason'].toString().trim()
        : split.reason;
    final detail = (data['detail']?.toString().trim().isNotEmpty ?? false)
        ? data['detail'].toString().trim()
        : split.detail;
    final channel = data['groupName']?.toString().trim() ?? '';
    final hasLoc = (data['latitude']?.toString().isNotEmpty ?? false);
    final lines = <String>[
      if (reason != null) '${kPanicReasonEmoji[reason] ?? '⚠️'} Necesita: ${reason.toUpperCase()}',
      if (detail != null && detail.isNotEmpty) '“$detail”',
      if (channel.isNotEmpty) 'Canal: $channel',
      if (reason == null && detail == null && body.isNotEmpty) body,
      if (hasLoc) '📍 Con ubicación — toca para ver en el mapa',
    ];
    final text = lines.isEmpty ? 'Alerta de emergencia' : lines.join('\n');
    final head = reason != null ? '🚨 ${reason.toUpperCase()} · $who' : '🚨 ALERTA · $who';
    return RichNotifParts(
      title: head,
      body: text,
      style: BigTextStyleInformation(
        text,
        contentTitle: '<b>$head</b>',
        htmlFormatContentTitle: true,
        summaryText: 'Atiéndela para quitarla',
      ),
      color: kNotifDanger,
      category: AndroidNotificationCategory.alarm,
      ongoing: true,
      autoCancel: false,
    );
  }

  static RichNotifParts _buildMissedCall(
    Map<String, dynamic> data,
    String title,
    String body,
  ) {
    final video = data['mode']?.toString() == 'video';
    final who = data['callerName']?.toString() ?? body;
    return RichNotifParts(
      title: video ? '📹 Videollamada perdida' : '📞 Llamada perdida',
      body: '$who · toca para ver',
      color: kNotifDanger,
      category: AndroidNotificationCategory.missedCall,
    );
  }

  /// Aviso «Fulano habla en Canal X» al despertar el radio por push.
  static RichNotifParts buildPttWake(Map<String, dynamic> data, {required bool live}) {
    final who = data['speakerName']?.toString() ?? 'Alguien';
    final group = data['groupName']?.toString() ?? 'Canal';
    return RichNotifParts(
      title: '🔊 $who habla en $group',
      body: live
          ? 'DESPERTANDO radio · toca para abrir'
          : 'Canal al aire · toca para escuchar',
      color: kNotifAccent,
      category: AndroidNotificationCategory.status,
      timeoutAfter: 45000,
      silent: live,
    );
  }

  // ---------- Historial por conversación (compartido entre isolates) ----------

  static Future<List<_HistLine>> _pushHistory(String key, _HistLine line) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final k = '$_histPrefix$key';
    final list = <_HistLine>[];
    for (final raw in prefs.getStringList(k) ?? const <String>[]) {
      final h = _HistLine.decode(raw);
      if (h != null) list.add(h);
    }
    // Socket y FCM pueden avisar el mismo mensaje: no duplicar la línea.
    final dup = line.messageId.isNotEmpty &&
        list.any((h) => h.messageId == line.messageId);
    if (!dup) list.add(line);
    while (list.length > _maxLines) {
      list.removeAt(0);
    }
    await prefs.setStringList(k, list.map((e) => e.encode()).toList());
    return list;
  }

  /// Al leer o responder: la próxima notificación empieza de cero.
  static Future<void> clearHistory(String? tag) async {
    if (tag == null || tag.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_histPrefix$tag');
    } catch (_) {}
  }

  static Future<void> clearAllHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      for (final k in prefs.getKeys().where((k) => k.startsWith(_histPrefix)).toList()) {
        await prefs.remove(k);
      }
    } catch (_) {}
  }

  // ---------- Descargas (avatar / foto) ----------

  static ApiClient? _api;

  static Future<ApiClient?> _session() async {
    if (_api != null && _api!.isLoggedIn) return _api;
    final api = ApiClient();
    await api.loadSession();
    if (!api.isLoggedIn) return null;
    _api = api;
    return api;
  }

  static Future<File?> _avatarFile(String? userId) async {
    if (userId == null || userId.isEmpty) return null;
    try {
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/notif_av_$userId.img');
      if (f.existsSync() &&
          DateTime.now().difference(f.lastModifiedSync()) < _avatarMaxAge &&
          f.lengthSync() > 0) {
        return f;
      }
      final api = await _session();
      final url = api?.peerAvatarNetworkUrl(userId);
      if (api == null || url == null) return null;
      final res = await http.get(
        Uri.parse(url),
        headers: {if (api.token != null) 'Authorization': 'Bearer ${api.token}'},
      ).timeout(const Duration(seconds: 3));
      final ct = res.headers['content-type'] ?? '';
      if (res.statusCode != 200 || res.bodyBytes.isEmpty || !ct.startsWith('image/')) {
        return null;
      }
      await f.writeAsBytes(res.bodyBytes, flush: true);
      return f;
    } catch (e) {
      debugPrint('RichNotify avatar: $e');
      return null;
    }
  }

  static Future<File?> _mediaFile(String? mediaUrl) async {
    if (mediaUrl == null || mediaUrl.isEmpty) return null;
    try {
      final api = await _session();
      if (api == null) return null;
      final url = api.mediaAbsoluteUrl(mediaUrl);
      final res = await http.get(
        Uri.parse(url),
        headers: {if (api.token != null) 'Authorization': 'Bearer ${api.token}'},
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode != 200 || res.bodyBytes.isEmpty) return null;
      if (res.bodyBytes.length > 6 * 1024 * 1024) return null;
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/notif_pic_${mediaUrl.hashCode & 0x7fffffff}.img');
      await f.writeAsBytes(res.bodyBytes, flush: true);
      return f;
    } catch (e) {
      debugPrint('RichNotify media: $e');
      return null;
    }
  }

  // ---------- Acciones Responder / Marcar leído ----------

  /// [payload]: `peer:<id>` (DM) o `<groupId>` (canal).
  static Future<bool> handleAction({
    required String actionId,
    required String payload,
    String? input,
  }) async {
    if (actionId != kNotifActionReply && actionId != kNotifActionRead) return false;
    final api = await _session();
    if (api == null) return true;
    final isDm = payload.startsWith('peer:');
    final id = isDm ? payload.substring(5) : payload;
    if (id.isEmpty) return true;
    try {
      if (actionId == kNotifActionReply) {
        final text = input?.trim() ?? '';
        if (text.isEmpty) return true;
        if (isDm) {
          await api.sendDmMessage(id, text);
        } else {
          await api.sendMessage(id, text);
        }
      }
      if (isDm) {
        await api.markDmRead(id, '');
      } else {
        await api.markMessagesRead(id, '');
      }
    } catch (e) {
      debugPrint('RichNotify action: $e');
    }
    await clearHistory(isDm ? 'dm:$id' : 'g:$id');
    return true;
  }
}

class _HistLine {
  _HistLine({
    this.messageId = '',
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.at,
    this.avatarPath,
  });

  final String messageId;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime at;
  final String? avatarPath;

  String encode() => jsonEncode({
        if (messageId.isNotEmpty) 'm': messageId,
        'i': senderId,
        'n': senderName,
        't': text,
        'a': at.millisecondsSinceEpoch,
        if (avatarPath != null) 'p': avatarPath,
      });

  static _HistLine? decode(String raw) {
    try {
      final m = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      return _HistLine(
        messageId: m['m']?.toString() ?? '',
        senderId: m['i']?.toString() ?? '',
        senderName: m['n']?.toString() ?? 'Usuario',
        text: m['t']?.toString() ?? '',
        at: DateTime.fromMillisecondsSinceEpoch((m['a'] as num?)?.toInt() ?? 0),
        avatarPath: m['p']?.toString(),
      );
    } catch (_) {
      return null;
    }
  }
}
