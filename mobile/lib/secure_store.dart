import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tokens JWT en almacén cifrado del SO; preferencias no sensibles en SharedPreferences.
class SecureStore {
  SecureStore._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
  );

  static const _kToken = 'tpx_token';
  static const _kRefresh = 'tpx_refresh';
  static const _kUser = 'tpx_user';
  static const _kAvatarTicket = 'tpx_avatar_ticket';

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
    var token = await _storage.read(key: _kToken);
    var refresh = await _storage.read(key: _kRefresh);
    var userJson = await _storage.read(key: _kUser);
    var avatarTicket = await _storage.read(key: _kAvatarTicket);

    // Migración desde SharedPreferences (versiones ≤1.8.0)
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
}
