import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'duckdns_hairpin.dart';
import 'secure_store.dart';

class ApiClient {
  ApiClient();

  static const _timeout = Duration(seconds: 8);

  String? _token;
  Map<String, dynamic>? _user;
  String? _avatarTicket;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  /// Proxy/SPA devolvió HTML en vez de JSON (p. ej. Caddy sin `/api*` → Vite).
  static bool isHtmlOrRoutingError(Object e) {
    final s = e.toString().toLowerCase();
    return s.contains('devolvió html') ||
        s.contains('en lugar de json') ||
        (s.contains('caddy') && s.contains('/api'));
  }

  /// Auth real: no soft-fail (hay que mostrar / re-login).
  static bool isAuthError(Object e) {
    final s = e.toString().toLowerCase();
    return s.contains('token requerido') ||
        s.contains('token inválido') ||
        s.contains('token invalido') ||
        s.contains('no autorizado') ||
        s.contains('unauthorized') ||
        s.contains('sesión vencida') ||
        s.contains('sesion vencida') ||
        s.contains('jwt') ||
        RegExp(r'\b401\b').hasMatch(s);
  }

  Future<void> loadSession() async {
    final s = await SecureStore.readSession();
    _token = s.token;
    _avatarTicket = s.avatarTicket;
    if (s.userJson != null && s.userJson!.isNotEmpty) {
      try {
        _user = jsonDecode(s.userJson!) as Map<String, dynamic>;
      } catch (_) {
        _user = null;
      }
    }
  }

  bool get mustChangePassword =>
      _user != null && (_user!['mustChangePassword'] == true);

  Future<Map<String, dynamic>> login(String username, String password) async {
    Future<http.Response> once() => http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}/api/auth/login'),
          headers: {'Content-Type': 'application/json', ..._ua()},
          body: jsonEncode({'username': username, 'password': password}),
        )
        .timeout(_timeout);

    Future<Map<String, dynamic>> attempt() async {
      final res = await once();
      return _parse(res, path: '/api/auth/login');
    }

    Map<String, dynamic> data;
    try {
      data = await attempt();
    } catch (e) {
      if (!DuckDnsHairpin.looksLikeTransportFail(e) &&
          !e.toString().contains('Respuesta inválida')) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      data = await attempt();
    }
    await _saveSession(
      data['token'] as String,
      data['user'] as Map<String, dynamic>,
      refreshToken: data['refreshToken'] as String?,
      avatarTicket: data['avatarTicket'] as String?,
    );
    return data;
  }

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final data = await _post('/api/auth/change-password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
    await _saveSession(
      data['token'] as String,
      data['user'] as Map<String, dynamic>,
      refreshToken: data['refreshToken'] as String?,
      avatarTicket: data['avatarTicket'] as String?,
    );
    return data;
  }

  Future<bool> tryRefresh() async {
    final s = await SecureStore.readSession();
    final refresh = s.refresh;
    if (refresh == null || refresh.isEmpty) return false;

    Future<http.Response> once() => http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}/api/auth/refresh'),
          headers: {'Content-Type': 'application/json', ..._ua()},
          body: jsonEncode({'refreshToken': refresh}),
        )
        .timeout(_timeout);

    http.Response res;
    try {
      res = await once();
    } catch (e) {
      if (!DuckDnsHairpin.looksLikeTransportFail(e)) rethrow;
      await DuckDnsHairpin.failoverAfterTransportFail();
      try {
        res = await once();
      } catch (_) {
        return false;
      }
    }

    Map<String, dynamic> data;
    try {
      data = await _parse(res, path: '/api/auth/refresh');
    } catch (_) {
      await logout();
      return false;
    }
    await _saveSession(
      data['token'] as String,
      data['user'] as Map<String, dynamic>,
      refreshToken: data['refreshToken'] as String?,
      avatarTicket: data['avatarTicket'] as String?,
    );
    return true;
  }

  Future<void> _saveSession(
    String token,
    Map<String, dynamic> user, {
    String? refreshToken,
    String? avatarTicket,
  }) async {
    _token = token;
    _user = user;
    if (avatarTicket != null && avatarTicket.isNotEmpty) {
      _avatarTicket = avatarTicket;
    }
    await SecureStore.writeSession(
      token: token,
      userJson: jsonEncode(user),
      refreshToken: refreshToken,
      avatarTicket: _avatarTicket,
    );
  }

  /// URL absoluta del avatar (sin ticket). Usar con [avatarAuthHeaders].
  String? avatarNetworkUrl([String? avatarUrl]) {
    final path = (avatarUrl ?? _user?['avatarUrl'])?.toString();
    if (path == null || path.isEmpty || path == 'null') return null;
    if (path.startsWith('http')) return path.split('?').first;
    return '${AppConfig.apiBaseUrl}$path';
  }

  /// Headers Bearer para descarga de avatar (sin Accept: application/json).
  Map<String, String>? avatarAuthHeaders() {
    if (_token == null || _token!.isEmpty) return null;
    return {'Authorization': 'Bearer $_token'};
  }

  /// URL de avatar de otro usuario (lista chat, contactos).
  String? peerAvatarNetworkUrl(String? userId, [String? avatarUrl]) {
    if (avatarUrl != null && avatarUrl.isNotEmpty && avatarUrl != 'null') {
      return avatarNetworkUrl(avatarUrl);
    }
    if (userId == null || userId.isEmpty) return null;
    return '${AppConfig.apiBaseUrl}/api/avatars/${Uri.encodeComponent(userId)}';
  }

  /// URL de icono de grupo/canal.
  String? groupAvatarNetworkUrl(String? groupId, [String? avatarUrl]) {
    if (avatarUrl != null && avatarUrl.isNotEmpty && avatarUrl != 'null') {
      return avatarNetworkUrl(avatarUrl);
    }
    if (groupId == null || groupId.isEmpty) return null;
    return '${AppConfig.apiBaseUrl}/api/avatars/group/${Uri.encodeComponent(groupId)}';
  }

  /// Renueva el ticket corto (?atk=) por si algún cliente legacy lo usa.
  Future<void> ensureAvatarTicket({bool force = false}) async {
    if (_token == null || _token!.isEmpty) return;
    if (!force && _avatarTicket != null && _avatarTicket!.isNotEmpty) return;
    try {
      final data = await _get('/api/me/avatar-ticket');
      final t = data['avatarTicket']?.toString();
      if (t != null && t.isNotEmpty && _token != null && _user != null) {
        await _saveSession(_token!, _user!, avatarTicket: t);
      }
    } catch (_) {
      /* ignore — el display usa Bearer */
    }
  }

  Future<Map<String, dynamic>> uploadAvatar(List<int> bytes, String filename) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/me/avatar');
    final req = http.MultipartRequest('POST', uri);
    req.headers.addAll({
      ..._ua(),
      if (_token != null) 'Authorization': 'Bearer $_token',
    });
    // Siempre JPEG + nombre .jpg para evitar rechazo MIME (HEIC / octet-stream)
    final safeName = filename.toLowerCase().endsWith('.jpg') ||
            filename.toLowerCase().endsWith('.jpeg')
        ? filename
        : 'avatar.jpg';
    req.files.add(
      http.MultipartFile.fromBytes(
        'avatar',
        bytes,
        filename: safeName,
        contentType: MediaType('image', 'jpeg'),
      ),
    );
    final streamed = await req.send().timeout(const Duration(seconds: 40));
    final res = await http.Response.fromStream(streamed);
    final data = await _parse(res, path: '/api/me/avatar');
    final nextUser = data['user'] is Map
        ? Map<String, dynamic>.from(data['user'] as Map)
        : {
            ...?_user,
            'avatarUrl': data['avatarUrl'],
          };
    if (_token != null) {
      await _saveSession(_token!, nextUser);
    }
    return data;
  }

  Future<void> clearAvatar() async {
    await _delete('/api/me/avatar');
    if (_user != null && _token != null) {
      final next = Map<String, dynamic>.from(_user!);
      next['avatarUrl'] = null;
      await _saveSession(_token!, next);
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _avatarTicket = null;
    await SecureStore.clearSession();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('tacticalptx_groups_cache');
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> fetchGroups({bool membersOnly = true}) async {
    final path = membersOnly ? '/api/groups?membersOnly=1' : '/api/groups';
    final data = await _get(path);
    return (data['groups'] as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchContacts() async {
    final data = await _get('/api/dm/contacts');
    return (data['contacts'] as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchDmConversations() async {
    final data = await _get('/api/dm/conversations');
    return (data['conversations'] as List? ?? [])
        .cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> fetchDmMessages(String userId) async {
    return _get('/api/dm/$userId/messages');
  }

  Future<Map<String, dynamic>> sendDmMessage(
    String userId,
    String body, {
    String? replyToId,
  }) async {
    return _post('/api/dm/$userId/messages', {
      'body': body,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  Future<void> markDmRead(String userId, String upToMessageId) async {
    await _post('/api/dm/$userId/messages/read', {
      'upToMessageId': upToMessageId,
    });
  }

  Future<Map<String, dynamic>> deleteDmMessage(String userId, String messageId) async {
    final data = await _delete('/api/dm/$userId/messages/$messageId');
    return data['message'] as Map<String, dynamic>;
  }

  /** Vacía el hilo DM (borra mensajes en servidor; ambos lados). */
  Future<int> clearDmThread(String userId) async {
    final data = await _post('/api/dm/$userId/messages/clear', {});
    return (data['deleted'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> reactToDmMessage(
    String userId,
    String messageId,
    String emoji,
  ) {
    return _post('/api/dm/$userId/messages/$messageId/reactions', {
      'emoji': emoji,
    });
  }

  Future<Map<String, dynamic>> startPrivateCall(
    String targetUserId, {
    String mode = 'call',
  }) async {
    final m = mode == 'radio'
        ? 'radio'
        : mode == 'video'
            ? 'video'
            : 'call';
    return _post('/api/calls/private', {
      'targetUserId': targetUserId,
      'mode': m,
    });
  }

  Future<Map<String, dynamic>> acceptPrivateCall(String callId) async {
    return _post('/api/calls/private/$callId/accept', {});
  }

  Future<Map<String, dynamic>> fetchPrivateCall(String callId) async {
    return _get('/api/calls/private/$callId');
  }

  Future<Map<String, dynamic>> pingPrivateCall(String callId) async {
    return _post('/api/calls/private/$callId/ping', {});
  }

  Future<Map<String, dynamic>> refreshPrivateCall(String callId) async {
    return _post('/api/calls/private/$callId/refresh', {});
  }

  Future<void> endPrivateCall(String callId, {String reason = 'hangup'}) async {
    await _post('/api/calls/private/$callId/end', {'reason': reason});
  }

  Future<void> requestPrivateCallVideo(String callId) async {
    await _post('/api/calls/private/$callId/video/request', {});
  }

  Future<void> respondPrivateCallVideo(String callId, bool accept) async {
    await _post('/api/calls/private/$callId/video/respond', {'accept': accept});
  }

  Future<void> stopPrivateCallVideo(String callId) async {
    await _post('/api/calls/private/$callId/video/stop', {});
  }

  Future<Map<String, dynamic>> fetchGroupVideoStatus(String groupId) async {
    return _get('/api/group-video/$groupId/status');
  }

  Future<Map<String, dynamic>> startGroupVideo(String groupId) async {
    return _post('/api/group-video/$groupId/start', {});
  }

  Future<Map<String, dynamic>> joinGroupVideo(String groupId) async {
    return _post('/api/group-video/$groupId/join', {});
  }

  Future<void> leaveGroupVideo(String groupId) async {
    await _post('/api/group-video/$groupId/leave', {});
  }

  Future<void> endGroupVideo(String groupId) async {
    await _post('/api/group-video/$groupId/end', {});
  }

  Future<void> pingGroupVideo(String groupId) async {
    await _post('/api/group-video/$groupId/ping', {});
  }

  Future<List<Map<String, dynamic>>> fetchCallHistory({
    int limit = 80,
    String? peerId,
    bool missedOnly = false,
    bool receivedOnly = false,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (peerId != null && peerId.isNotEmpty) 'peerId=$peerId',
      if (missedOnly) 'missed=1',
      if (receivedOnly) 'received=1',
    ].join('&');
    final data = await _get('/api/calls/history?$q');
    return (data['history'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<int> clearCallHistory() async {
    final data = await _delete('/api/calls/history');
    return (data['deleted'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> fetchLiveKitToken(String groupId) async {
    return _post('/api/livekit/token', {'groupId': groupId});
  }

  Future<List<Map<String, dynamic>>> fetchMessages(String groupId) async {
    final data = await _get('/api/groups/$groupId/messages?limit=100');
    return (data['messages'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> sendMessage(
    String groupId,
    String body, {
    String? replyToId,
  }) async {
    final data = await _post('/api/groups/$groupId/messages', {
      'body': body,
      if (replyToId != null) 'replyToId': replyToId,
    });
    return data['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> editMessage(
    String groupId,
    String messageId,
    String body,
  ) async {
    final data = await _patch('/api/groups/$groupId/messages/$messageId', {
      'body': body,
    });
    return data['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> deleteMessage(String groupId, String messageId) async {
    final data = await _delete('/api/groups/$groupId/messages/$messageId');
    return data['message'] as Map<String, dynamic>;
  }

  /** Vacía el chat de un grupo (borra mensajes en servidor para todos). */
  Future<int> clearGroupMessages(String groupId) async {
    final data = await _post('/api/groups/$groupId/messages/clear', {});
    return (data['deleted'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> reactToMessage(
    String groupId,
    String messageId,
    String emoji,
  ) {
    return _post('/api/groups/$groupId/messages/$messageId/reactions', {
      'emoji': emoji,
    });
  }

  Future<Map<String, dynamic>> markMessagesRead(
    String groupId,
    String upToMessageId,
  ) {
    return _post('/api/groups/$groupId/messages/read', {
      'upToMessageId': upToMessageId,
    });
  }

  Future<List<Map<String, dynamic>>> fetchStickerPacks() async {
    final data = await _get('/api/stickers');
    return (data['packs'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> sendSticker(
    String groupId,
    String stickerId, {
    String? replyToId,
  }) {
    return _post('/api/groups/$groupId/messages/sticker', {
      'stickerId': stickerId,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  Future<Map<String, dynamic>> sendDmSticker(
    String userId,
    String stickerId, {
    String? replyToId,
  }) {
    return _post('/api/dm/$userId/messages/sticker', {
      'stickerId': stickerId,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  Future<Map<String, dynamic>> sendDmNudge(String userId) {
    return _post('/api/dm/$userId/messages/nudge', {});
  }

  Future<void> postLocation({
    required double latitude,
    required double longitude,
    double? accuracyM,
  }) async {
    await _post('/api/locations', {
      'latitude': latitude,
      'longitude': longitude,
      'accuracyM': ?accuracyM,
    });
  }

  /// Refuerzo de presencia (socket + HTTP). focus: foreground|background|service.
  Future<void> presenceHeartbeat({String focus = 'service'}) async {
    try {
      await _post('/api/presence/heartbeat', {'focus': focus});
    } catch (_) {
      // Socket sigue siendo la vía principal.
    }
  }

  /// Últimas ubicaciones en alcance (root/admin/zona/unidad). Opcional: filtrar por grupos.
  Future<Map<String, dynamic>> fetchLocations({List<String>? groupIds}) async {
    var path = '/api/locations';
    if (groupIds != null && groupIds.isNotEmpty) {
      path =
          '$path?groupIds=${groupIds.map(Uri.encodeComponent).join(',')}';
    }
    return _get(path);
  }

  /// Historial de track de un usuario (horas 1–72).
  Future<Map<String, dynamic>> fetchUserTrack(
    String userId, {
    int hours = 8,
  }) async {
    final h = hours.clamp(1, 72);
    return _get(
      '/api/locations/${Uri.encodeComponent(userId)}/track?hours=$h',
    );
  }

  /// Ruta OSRM para un hueco de señal (sin recta A→B).
  Future<Map<String, dynamic>> fetchTrackGapRoute({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) async {
    final q = Uri(
      queryParameters: {
        'from': '$fromLat,$fromLng',
        'to': '$toLat,$toLng',
      },
    ).query;
    return _get('/api/locations/track-gap-route?$q');
  }

  Future<Map<String, dynamic>> fetchTacticalSiteGroups() =>
      _get('/api/tactical-sites/groups');

  Future<Map<String, dynamic>> fetchTacticalSites({String? groupId}) {
    final q = (groupId != null && groupId.isNotEmpty)
        ? '?groupId=${Uri.encodeComponent(groupId)}'
        : '';
    return _get('/api/tactical-sites$q');
  }

  Future<Map<String, dynamic>> uploadMedia(
    String groupId, {
    required String filePath,
    required String filename,
    String? mime,
    String type = 'file',
    String? body,
    String? replyToId,
  }) async {
    return _uploadChatMedia(
      () => Uri.parse(
        '${AppConfig.apiBaseUrl}/api/groups/$groupId/messages/media',
      ),
      filePath: filePath,
      filename: filename,
      mime: mime,
      type: type,
      body: body,
      replyToId: replyToId,
    );
  }

  Future<Map<String, dynamic>> uploadDmMedia(
    String peerId, {
    required String filePath,
    required String filename,
    String? mime,
    String type = 'file',
    String? body,
    String? replyToId,
  }) async {
    return _uploadChatMedia(
      () => Uri.parse('${AppConfig.apiBaseUrl}/api/dm/$peerId/messages/media'),
      filePath: filePath,
      filename: filename,
      mime: mime,
      type: type,
      body: body,
      replyToId: replyToId,
    );
  }

  Future<Map<String, dynamic>> _uploadChatMedia(
    Uri Function() uriBuilder, {
    required String filePath,
    required String filename,
    String? mime,
    String type = 'file',
    String? body,
    String? replyToId,
    bool hairpinRetried = false,
  }) async {
    MediaType? contentType;
    if (mime != null && mime.isNotEmpty) {
      try {
        contentType = MediaType.parse(mime.split(';').first.trim());
      } catch (_) {}
    }

    Future<http.MultipartRequest> build() async {
      final request = http.MultipartRequest('POST', uriBuilder());
      request.headers.addAll(_ua());
      if (_token != null) {
        request.headers['Authorization'] = 'Bearer $_token';
      }
      request.fields['type'] = type;
      if (body != null && body.isNotEmpty) request.fields['body'] = body;
      if (replyToId != null) request.fields['replyToId'] = replyToId;
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          filePath,
          filename: filename,
          contentType: contentType,
        ),
      );
      return request;
    }

    try {
      var request = await build();
      var streamed = await request.send().timeout(_timeout);
      if (streamed.statusCode == 401) {
        if (await tryRefresh()) {
          request = await build();
          streamed = await request.send().timeout(_timeout);
        }
      }
      final res = await http.Response.fromStream(streamed);
      final data = await _parse(
        res,
        path: '/api/media-upload',
        onNonJson: hairpinRetried
            ? null
            : () => _uploadChatMedia(
                  uriBuilder,
                  filePath: filePath,
                  filename: filename,
                  mime: mime,
                  type: type,
                  body: body,
                  replyToId: replyToId,
                  hairpinRetried: true,
                ),
      );
      return data['message'] as Map<String, dynamic>;
    } catch (e) {
      if (hairpinRetried || !DuckDnsHairpin.looksLikeTransportFail(e)) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      return _uploadChatMedia(
        uriBuilder,
        filePath: filePath,
        filename: filename,
        mime: mime,
        type: type,
        body: body,
        replyToId: replyToId,
        hairpinRetried: true,
      );
    }
  }

  /// Absolute URL for authenticated media (use with headers).
  String mediaAbsoluteUrl(String mediaUrl) {
    if (mediaUrl.startsWith('http')) return mediaUrl;
    return '${AppConfig.apiBaseUrl}$mediaUrl';
  }

  /// Descarga media autenticada a un archivo temporal (abrir / compartir).
  Future<File> downloadMediaToTemp(String mediaUrl, {String? filename}) async {
    final uri = Uri.parse(mediaAbsoluteUrl(mediaUrl));
    Future<http.Response> get() => http.get(
          uri,
          headers: _token != null ? {'Authorization': 'Bearer $_token'} : {},
        );
    var res = await get();
    if (res.statusCode == 401 && await tryRefresh()) {
      res = await get();
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('No se pudo descargar el archivo (${res.statusCode})');
    }
    final dir = await getTemporaryDirectory();
    final safe = (filename ?? 'archivo').replaceAll(RegExp(r'[<>:"/\\|?*]'), '_');
    final file = File(p.join(dir.path, 'chat_${DateTime.now().millisecondsSinceEpoch}_$safe'));
    await file.writeAsBytes(res.bodyBytes, flush: true);
    return file;
  }

  Future<void> registerDevice({
    required String platform,
    required String fcmToken,
    String? deviceName,
  }) async {
    await _post('/api/devices', {
      'platform': platform,
      'fcmToken': fcmToken,
      if (deviceName != null) 'deviceName': deviceName,
    });
  }

  Future<void> unregisterDevice({String? fcmToken}) async {
    final res = await http.delete(
      Uri.parse('${AppConfig.apiBaseUrl}/api/devices'),
      headers: _jsonHeaders(),
      body: jsonEncode({if (fcmToken != null) 'fcmToken': fcmToken}),
    );
    await _parse(res, path: '/api/devices');
  }

  Future<Map<String, dynamic>> triggerPanic({
    required String groupId,
    double? latitude,
    double? longitude,
    double? accuracyM,
    String? note,
  }) {
    return _post('/api/panic', {
      'groupId': groupId,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (accuracyM != null) 'accuracyM': accuracyM,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<List<Map<String, dynamic>>> fetchPanicEvents({
    String? status,
    int limit = 20,
  }) async {
    final q = <String, String>{
      'limit': '$limit',
      if (status != null && status.isNotEmpty) 'status': status,
    };
    final qs = q.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    final data = await _get('/api/panic?$qs');
    return (data['events'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> fetchPanicEvent(String panicId) async {
    final data = await _get('/api/panic/$panicId');
    return Map<String, dynamic>.from(data['event'] as Map? ?? {});
  }

  Future<Map<String, dynamic>> ackPanic(String panicId) {
    return _patch('/api/panic/$panicId', {'status': 'acked'});
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    bool retried = false,
    bool hairpinRetried = false,
  }) async {
    try {
      final res = await http
          .get(Uri.parse('${AppConfig.apiBaseUrl}$path'), headers: _headers())
          .timeout(_timeout);
      if (res.statusCode == 401 && !retried) {
        if (await tryRefresh()) {
          return _get(path, retried: true, hairpinRetried: hairpinRetried);
        }
      }
      return _parse(
        res,
        path: path,
        onNonJson: hairpinRetried
            ? null
            : () => _get(path, retried: retried, hairpinRetried: true),
      );
    } catch (e) {
      if (hairpinRetried || !DuckDnsHairpin.looksLikeTransportFail(e)) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      return _get(path, retried: retried, hairpinRetried: true);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    bool retried = false,
    bool hairpinRetried = false,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${AppConfig.apiBaseUrl}$path'),
            headers: _jsonHeaders(),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
      if (res.statusCode == 401 && !retried) {
        if (await tryRefresh()) {
          return _post(path, body, retried: true, hairpinRetried: hairpinRetried);
        }
      }
      return _parse(
        res,
        path: path,
        onNonJson: hairpinRetried
            ? null
            : () => _post(path, body, retried: retried, hairpinRetried: true),
      );
    } catch (e) {
      if (hairpinRetried || !DuckDnsHairpin.looksLikeTransportFail(e)) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      return _post(path, body, retried: true, hairpinRetried: true);
    }
  }

  Future<Map<String, dynamic>> _patch(
    String path,
    Map<String, dynamic> body, {
    bool retried = false,
    bool hairpinRetried = false,
  }) async {
    try {
      final res = await http
          .patch(
            Uri.parse('${AppConfig.apiBaseUrl}$path'),
            headers: _jsonHeaders(),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
      if (res.statusCode == 401 && !retried) {
        if (await tryRefresh()) {
          return _patch(path, body, retried: true, hairpinRetried: hairpinRetried);
        }
      }
      return _parse(
        res,
        path: path,
        onNonJson: hairpinRetried
            ? null
            : () => _patch(path, body, retried: retried, hairpinRetried: true),
      );
    } catch (e) {
      if (hairpinRetried || !DuckDnsHairpin.looksLikeTransportFail(e)) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      return _patch(path, body, retried: true, hairpinRetried: true);
    }
  }

  Future<Map<String, dynamic>> _delete(
    String path, {
    bool retried = false,
    bool hairpinRetried = false,
  }) async {
    try {
      final res = await http
          .delete(Uri.parse('${AppConfig.apiBaseUrl}$path'), headers: _headers())
          .timeout(_timeout);
      if (res.statusCode == 401 && !retried) {
        if (await tryRefresh()) {
          return _delete(path, retried: true, hairpinRetried: hairpinRetried);
        }
      }
      return _parse(
        res,
        path: path,
        onNonJson: hairpinRetried
            ? null
            : () => _delete(path, retried: retried, hairpinRetried: true),
      );
    } catch (e) {
      if (hairpinRetried || !DuckDnsHairpin.looksLikeTransportFail(e)) {
        rethrow;
      }
      await DuckDnsHairpin.failoverAfterTransportFail();
      return _delete(path, retried: true, hairpinRetried: true);
    }
  }

  Map<String, String> _ua() => {
        'X-TacticalPtx-Client': 'android-apk',
        'Accept': 'application/json',
      };

  /// GET/DELETE: sin Content-Type (algunos proxies responden 400 HTML).
  Map<String, String> _headers() {
    final h = <String, String>{..._ua()};
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  Map<String, String> _jsonHeaders() {
    final h = <String, String>{
      'Content-Type': 'application/json',
      ..._ua(),
    };
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  Future<Map<String, dynamic>> _parse(
    http.Response res, {
    String? path,
    Future<Map<String, dynamic>> Function()? onNonJson,
  }) async {
    late Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        data = decoded;
      } else if (decoded is Map) {
        data = Map<String, dynamic>.from(decoded);
      } else {
        throw const FormatException('not a json object');
      }
    } catch (_) {
      if (onNonJson != null && res.statusCode >= 400) {
        try {
          await DuckDnsHairpin.failoverAfterTransportFail();
          return await onNonJson();
        } catch (_) {
          /* caer al error descriptivo */
        }
      }
      final raw = res.body.trim();
      final where = (path != null && path.isNotEmpty) ? ' $path' : '';
      final looksHtml = raw.startsWith('<!') ||
          raw.toLowerCase().contains('<html') ||
          raw.toLowerCase().startsWith('<!doctype');
      if (looksHtml) {
        throw Exception(
          'El servidor devolvió HTML (${res.statusCode})$where '
          'en lugar de JSON. Comprueba que la API esté en marcha '
          'y que Caddy enrute /api* al backend.',
        );
      }
      final preview = raw.isEmpty
          ? 'vacío'
          : (raw.length <= 80 ? raw : '${raw.substring(0, 80)}…');
      throw Exception(
        'Respuesta inválida (${res.statusCode})$where: $preview',
      );
    }
    if (res.statusCode >= 400 || data['ok'] == false) {
      throw Exception(data['error'] ?? 'Error ${res.statusCode}');
    }
    return data;
  }
}
