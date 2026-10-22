import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tokens JWT en almacén cifrado del SO; preferencias no sensibles en SharedPreferences.
class SecureStore {
  SecureStore._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
      synchronizable: false,
    ),
  );

  static const _kToken = 'tpx_token';
  static const _kRefresh = 'tpx_refresh';
  static const _kUser = 'tpx_user';
  static const _kAvatarTicket = 'tpx_avatar_ticket';
  static const _kDeviceId = 'tpx_device_id';

  static Future<void> writeSession({
    required String token,
    required String userJson,
    String? refreshToken,
    String? avatarTicket,
  }) async {
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kUser, value: userJson);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _storage.write(key: _kRefresh, value: refreshToken);
    }
    if (avatarTicket != null && avatarTicket.isNotEmpty) {
      await _storage.write(key: _kAvatarTicket, value: avatarTicket);
    }
    // Limpia legado en claro
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('refreshToken');
    await prefs.remove('user');
  }

  static Future<({String? token, String? refresh, String? userJson, String? avatarTicket})>
      readSession() async {
    final results = await Future.wait([
      _storage.read(key: _kToken),
      _storage.read(key: _kRefresh),
      _storage.read(key: _kUser),
      _storage.read(key: _kAvatarTicket),
    ]);
    var token = results[0];
    var refresh = results[1];
    var userJson = results[2];
    var avatarTicket = results[3];

    // Última migración desde SharedPreferences (≤1.8.0); luego se borra el claro.
    if (token == null || token.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString('token');
      refresh = prefs.getString('refreshToken');
      userJson = prefs.getString('user');
      if (token != null && token.isNotEmpty) {
        await writeSession(
          token: token,
          userJson: userJson ?? '{}',
          refreshToken: refresh,
        );
      } else {
        await prefs.remove('token');
        await prefs.remove('refreshToken');
        await prefs.remove('user');
      }
    }

    return (token: token, refresh: refresh, userJson: userJson, avatarTicket: avatarTicket);
  }

  static Future<void> clearSession() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kUser);
    await _storage.delete(key: _kAvatarTicket);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('refreshToken');
    await prefs.remove('user');
  }

  static Future<String> deviceId() async {
    final existing = await _storage.read(key: _kDeviceId);
    if (existing != null && existing.length >= 8) return existing;
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int n) => n.toRadixString(16).padLeft(2, '0');
    final id =
        '${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}-'
        '${hex(bytes[4])}${hex(bytes[5])}-'
        '${hex(bytes[6])}${hex(bytes[7])}-'
        '${hex(bytes[8])}${hex(bytes[9])}-'
        '${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}${hex(bytes[13])}${hex(bytes[14])}${hex(bytes[15])}';
    await _storage.write(key: _kDeviceId, value: id);
    return id;
  }
}
