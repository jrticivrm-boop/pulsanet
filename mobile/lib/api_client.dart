import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'secure_store.dart';

class ApiClient {
  ApiClient();

  static const _timeout = Duration(seconds: 18);

  String? _token;
  Map<String, dynamic>? _user;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  Future<void> loadSession() async {
    final s = await SecureStore.readSession();
    _token = s.token;
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
    final res = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}/api/auth/login'),
          headers: {'Content-Type': 'application/json', ..._ua()},
          body: jsonEncode({'username': username, 'password': password}),
        )
        .timeout(_timeout);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400 || data['ok'] != true) {
      throw Exception(data['error'] ?? 'Login falló');
    }
    await _saveSession(
      data['token'] as String,
      data['user'] as Map<String, dynamic>,
      refreshToken: data['refreshToken'] as String?,
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
    );
    return data;
  }

  Future<bool> tryRefresh() async {
    final s = await SecureStore.readSession();
    final refresh = s.refresh;
    if (refresh == null || refresh.isEmpty) return false;
    final res = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}/api/auth/refresh'),
          headers: {'Content-Type': 'application/json', ..._ua()},
          body: jsonEncode({'refreshToken': refresh}),
        )
        .timeout(_timeout);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400 || data['ok'] != true) {
      await logout();
      return false;
    }
    await _saveSession(
      data['token'] as String,
      data['user'] as Map<String, dynamic>,
      refreshToken: data['refreshToken'] as String?,
    );
    return true;
  }

  Future<void> _saveSession(
    String token,
    Map<String, dynamic> user, {
    String? refreshToken,
  }) async {
    _token = token;
    _user = user;
    await SecureStore.writeSession(
      token: token,
      userJson: jsonEncode(user),
      refreshToken: refreshToken,
    );
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await SecureStore.clearSession();
  }

  Future<List<Map<String, dynamic>>> fetchGroups() async {
    final data = await _get('/api/groups');
    return (data['groups'] as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchContacts() async {
    final data = await _get('/api/dm/contacts');
    return (data['contacts'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> fetchDmMessages(String userId) async {
    return _get('/api/dm/$userId/messages');
  }

  Future<Map<String, dynamic>> sendDmMessage(String userId, String body) async {
    return _post('/api/dm/$userId/messages', {'body': body});
  }

  Future<Map<String, dynamic>> startPrivateCall(String targetUserId) async {
    return _post('/api/calls/private', {'targetUserId': targetUserId});
  }

  Future<Map<String, dynamic>> acceptPrivateCall(String callId) async {
    return _post('/api/calls/private/$callId/accept', {});
  }

  Future<void> endPrivateCall(String callId, {String reason = 'hangup'}) async {
    await _post('/api/calls/private/$callId/end', {'reason': reason});
  }

  Future<Map<String, dynamic>> fetchLiveKitToken(String groupId) async {
    return _post('/api/livekit/token', {'groupId': groupId});
  }

  Future<List<Map<String, dynamic>>> fetchMessages(String groupId) async {
    final data = await _get('/api/groups/$groupId/messages?limit=50');
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

  Future<Map<String, dynamic>> uploadMedia(
    String groupId, {
    required String filePath,
    required String filename,
    String? mime,
    String type = 'file',
    String? body,
    String? replyToId,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/groups/$groupId/messages/media');
    var request = http.MultipartRequest('POST', uri);
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
      ),
    );

    Future<http.StreamedResponse> send() => request.send();
    var streamed = await send();
    if (streamed.statusCode == 401) {
      if (await tryRefresh()) {
        request = http.MultipartRequest('POST', uri);
        request.headers['Authorization'] = 'Bearer $_token';
        request.fields['type'] = type;
        if (body != null && body.isNotEmpty) request.fields['body'] = body;
        if (replyToId != null) request.fields['replyToId'] = replyToId;
        request.files.add(
          await http.MultipartFile.fromPath('file', filePath, filename: filename),
        );
        streamed = await request.send();
      }
    }
    final res = await http.Response.fromStream(streamed);
    final data = _parse(res);
    return data['message'] as Map<String, dynamic>;
  }

  /// Absolute URL for authenticated media (use with headers).
  String mediaAbsoluteUrl(String mediaUrl) {
    if (mediaUrl.startsWith('http')) return mediaUrl;
    return '${AppConfig.apiBaseUrl}$mediaUrl';
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
      headers: _headers(),
      body: jsonEncode({if (fcmToken != null) 'fcmToken': fcmToken}),
    );
    _parse(res);
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

  Future<Map<String, dynamic>> ackPanic(String panicId) {
    return _patch('/api/panic/$panicId', {'status': 'acked'});
  }

  Future<Map<String, dynamic>> _get(String path, {bool retried = false}) async {
    final res = await http
        .get(Uri.parse('${AppConfig.apiBaseUrl}$path'), headers: _headers())
        .timeout(_timeout);
    if (res.statusCode == 401 && !retried) {
      if (await tryRefresh()) return _get(path, retried: true);
    }
    return _parse(res);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    bool retried = false,
  }) async {
    final res = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_timeout);
    if (res.statusCode == 401 && !retried) {
      if (await tryRefresh()) return _post(path, body, retried: true);
    }
    return _parse(res);
  }

  Future<Map<String, dynamic>> _patch(
    String path,
    Map<String, dynamic> body, {
    bool retried = false,
  }) async {
    final res = await http
        .patch(
          Uri.parse('${AppConfig.apiBaseUrl}$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(_timeout);
    if (res.statusCode == 401 && !retried) {
      if (await tryRefresh()) return _patch(path, body, retried: true);
    }
    return _parse(res);
  }

  Future<Map<String, dynamic>> _delete(String path, {bool retried = false}) async {
    final res = await http
        .delete(Uri.parse('${AppConfig.apiBaseUrl}$path'), headers: _headers())
        .timeout(_timeout);
    if (res.statusCode == 401 && !retried) {
      if (await tryRefresh()) return _delete(path, retried: true);
    }
    return _parse(res);
  }

  Map<String, String> _ua() => {
        'X-TacticalPtx-Client': 'android-apk',
        'Accept': 'application/json',
      };

  Map<String, String> _headers() {
    final h = <String, String>{
      'Content-Type': 'application/json',
      ..._ua(),
    };
    if (_token != null) h['Authorization'] = 'Bearer $_token';
    return h;
  }

  Map<String, dynamic> _parse(http.Response res) {
    late Map<String, dynamic> data;
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Respuesta inválida (${res.statusCode})');
    }
    if (res.statusCode >= 400 || data['ok'] == false) {
      throw Exception(data['error'] ?? 'Error ${res.statusCode}');
    }
    return data;
  }
}
