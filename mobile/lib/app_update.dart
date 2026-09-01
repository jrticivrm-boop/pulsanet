import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'config.dart';

/// Resultado del chequeo/aplicación de actualización al arrancar.
class AppUpdateOutcome {
  const AppUpdateOutcome({
    required this.blocked,
    this.message,
  });

  /// true = no continuar al login (instalación en curso / forzada fallida).
  final bool blocked;
  final String? message;
}

/// Actualización directa de APK: manifiesto en la API, descarga e instalación
/// con el instalador del sistema. Shorebird queda como parche opcional si el
/// build lo trae.
class AppUpdateService {
  AppUpdateService._();

  static const _channel = MethodChannel('com.tacticalptx.app/installer');
  /// Timeout corto: no dejar la app colgada en "Descargando configuracion...".
  static const _timeout = Duration(seconds: 3);

  /// Textos de estado neutrales (sin marcas de terceros ni mojibake UTF-8).
  static String _publicStatus(String? raw, {String fallback = 'Actualizando...'}) {
    var t = (raw ?? '').trim();
    if (t.isEmpty) return fallback;
    // Ellipsis UTF-8 mal leido como Latin-1: "â€¦"
    t = t
        .replaceAll(RegExp(r'â€¦|â€\u00a6|\u00e2\u20ac\u00a6'), '...')
        .replaceAll('\u2026', '...')
        .replaceAll('…', '...');
    if (RegExp(r'banje\s*cel', caseSensitive: false).hasMatch(t)) {
      return fallback;
    }
    return t;
  }

  /// [onStatus] mensaje + progreso 0..1 o null si indeterminado.
  static Future<AppUpdateOutcome> checkAndApply({
    required void Function(String message, double? progress) onStatus,
  }) async {
    onStatus('Descargando configuracion...', null);

    if (!Platform.isAndroid) {
      return const AppUpdateOutcome(blocked: false);
    }

    Map<String, dynamic>? remote;
    try {
      remote = await _fetchManifest();
    } catch (e, st) {
      debugPrint('AppUpdate.fetch: $e\n$st');
      return const AppUpdateOutcome(blocked: false);
    }

    if (remote == null || remote['ok'] != true) {
      return const AppUpdateOutcome(blocked: false);
    }

    final configured = remote['configured'] == true;
    final versionCode = _asInt(remote['versionCode']);
    final apkUrl = (remote['apkUrl'] as String?)?.trim() ?? '';
    final force = remote['force'] != false;
    final message = _publicStatus(
      remote['message'] as String?,
      fallback: 'Actualizando...',
    );
    final shaRaw = (remote['sha256'] as String?)?.trim().toLowerCase();
    final sha256Expected =
        (shaRaw != null && shaRaw.length == 64) ? shaRaw : null;

    if (!configured || versionCode < 1 || apkUrl.isEmpty) {
      return const AppUpdateOutcome(blocked: false);
    }

    final info = await PackageInfo.fromPlatform();
    final localCode = int.tryParse(info.buildNumber) ?? 0;
    if (localCode >= versionCode) {
      return const AppUpdateOutcome(blocked: false);
    }

    onStatus(message, 0);
    try {
      final file = await _downloadApk(
        apkUrl: apkUrl,
        versionCode: versionCode,
        expectedSha256: sha256Expected,
        onProgress: (prog) => onStatus(message, prog),
      );
      onStatus('Actualizando...', 1);
      final ok = await _installApk(file.path);
      if (!ok) {
        if (force) {
          return const AppUpdateOutcome(
            blocked: true,
            message:
                'No se pudo abrir el instalador. Permite instalar apps de esta fuente e inténtalo de nuevo.',
          );
        }
        return const AppUpdateOutcome(blocked: false);
      }
      return const AppUpdateOutcome(
        blocked: true,
        message: 'Actualizando...',
      );
    } catch (e, st) {
      debugPrint('AppUpdate.apply: $e\n$st');
      if (force) {
        return const AppUpdateOutcome(
          blocked: true,
          message:
              'No se pudo descargar la actualización. Verifica la red e inténtalo de nuevo.',
        );
      }
      return const AppUpdateOutcome(blocked: false);
    }
  }

  static Future<Map<String, dynamic>?> _fetchManifest() async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (AppConfig.appUpdateSecret.isNotEmpty) {
      headers['X-App-Update-Key'] = AppConfig.appUpdateSecret;
    }
    final res = await http
        .get(
          Uri.parse('${AppConfig.apiBaseUrl}/api/app/android'),
          headers: headers,
        )
        .timeout(_timeout);
    if (res.statusCode >= 400) return null;
    final data = jsonDecode(res.body);
    if (data is! Map<String, dynamic>) return null;
    return data;
  }

  static Future<File> _downloadApk({
    required String apkUrl,
    required int versionCode,
    required String? expectedSha256,
    required void Function(double progress) onProgress,
  }) async {
    final dir = await getTemporaryDirectory();
    final out = File(p.join(dir.path, 'tacticalptx-update-$versionCode.apk'));
    if (await out.exists()) {
      try {
        await out.delete();
      } catch (_) {}
    }

    final client = http.Client();
    try {
      final req = http.Request('GET', Uri.parse(apkUrl));
      final streamed =
          await client.send(req).timeout(const Duration(minutes: 15));
      if (streamed.statusCode >= 400) {
        throw Exception('Descarga APK HTTP ${streamed.statusCode}');
      }
      final total = streamed.contentLength ?? 0;
      final sink = out.openWrite();
      var received = 0;

      await for (final chunk in streamed.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) {
          onProgress((received / total).clamp(0.0, 1.0));
        } else if (received > 0) {
          onProgress(0.05);
        }
      }
      await sink.close();

      if (received < 1024) {
        throw Exception('APK demasiado pequeña');
      }

      if (expectedSha256 != null) {
        final digests = await sha256.bind(out.openRead()).toList();
        final hash = digests.single.toString();
        if (hash != expectedSha256) {
          try {
            await out.delete();
          } catch (_) {}
          throw Exception('Hash APK no coincide');
        }
      }

      onProgress(1);
      return out;
    } finally {
      client.close();
    }
  }

  static Future<bool> _installApk(String path) async {
    try {
      final result =
          await _channel.invokeMethod<bool>('installApk', {'path': path});
      return result == true;
    } on PlatformException catch (e) {
      debugPrint('installApk: ${e.message}');
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  static int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }
}
