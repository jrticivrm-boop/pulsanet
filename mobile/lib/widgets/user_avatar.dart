import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:path_provider/path_provider.dart';

import '../theme.dart';

String userAvatarInitials(String? name) {
  final parts =
      (name ?? '?').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) {
    return parts.first.length >= 2
        ? parts.first.substring(0, 2).toUpperCase()
        : parts.first.substring(0, 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

/// Cache de avatares descargados con Bearer (Image.network falla con auth).
/// Memoria + disco (revalidación con ETag → 304 sin cuerpo) para no
/// re-descargar fotos en cada pantalla / arranque con datos móviles.
class AvatarBytesCache {
  AvatarBytesCache._();
  static final Map<String, Uint8List> _byUrl = {};
  static final Map<String, Future<Uint8List?>> _inflight = {};
  static final Map<String, DateTime> _failedAt = {};
  static const _failRetry = Duration(minutes: 5);
  /// Igual que `Cache-Control: max-age=3600` del servidor.
  static const _diskFresh = Duration(hours: 1);
  static final http.Client _http =
      IOClient(HttpClient()..idleTimeout = const Duration(seconds: 75));
  static Directory? _dir;

  static Uint8List? get(String url) => _byUrl[url];

  static void put(String url, Uint8List bytes) {
    if (_byUrl.length > 80) {
      _byUrl.remove(_byUrl.keys.first);
    }
    _byUrl[url] = bytes;
    _failedAt.remove(url);
  }

  static void remove(String url) {
    _byUrl.remove(url);
    _failedAt.remove(url);
    unawaited(_diskFile(url).then((f) async {
      for (final x in [f, File('${f.path}.etag')]) {
        if (await x.exists()) await x.delete();
      }
    }).catchError((_) {}));
  }

  static void clear() {
    _byUrl.clear();
    _failedAt.clear();
    unawaited(_avatarDir().then((d) async {
      if (await d.exists()) await d.delete(recursive: true);
      _dir = null;
    }).catchError((_) {}));
  }

  /// Bytes del avatar: memoria → disco (≤1 h) → red condicional. null si no hay.
  static Future<Uint8List?> load(String url, {String? auth}) {
    final hit = _byUrl[url];
    if (hit != null) return Future.value(hit);
    final failed = _failedAt[url];
    if (failed != null && DateTime.now().difference(failed) < _failRetry) {
      return Future.value(null);
    }
    final pending = _inflight[url];
    if (pending != null) return pending;
    final fut = _loadUncached(url, auth).whenComplete(() => _inflight.remove(url));
    _inflight[url] = fut;
    return fut;
  }

  static Future<Uint8List?> _loadUncached(String url, String? auth) async {
    File? file;
    Uint8List? disk;
    String? etag;
    try {
      file = await _diskFile(url);
      if (await file.exists()) {
        disk = await file.readAsBytes();
        final age = DateTime.now().difference(await file.lastModified());
        if (disk.isNotEmpty && age < _diskFresh) {
          put(url, disk);
          return disk;
        }
        final tagFile = File('${file.path}.etag');
        if (await tagFile.exists()) etag = (await tagFile.readAsString()).trim();
      }
    } catch (_) {}
    try {
      final res = await _http.get(Uri.parse(url), headers: {
        if (auth != null && auth.isNotEmpty) 'Authorization': auth,
        if (disk != null && disk.isNotEmpty && etag != null && etag.isNotEmpty)
          'If-None-Match': etag,
      });
      if (res.statusCode == 304 && disk != null && disk.isNotEmpty) {
        put(url, disk);
        try {
          await file?.setLastModified(DateTime.now());
        } catch (_) {}
        return disk;
      }
      if (res.statusCode >= 200 && res.statusCode < 300 && res.bodyBytes.isNotEmpty) {
        final bytes = res.bodyBytes;
        put(url, bytes);
        try {
          await file?.writeAsBytes(bytes, flush: false);
          final tag = res.headers['etag'];
          final tagFile = file == null ? null : File('${file.path}.etag');
          if (tag != null && tag.isNotEmpty) {
            await tagFile?.writeAsString(tag);
          } else if (tagFile != null && await tagFile.exists()) {
            await tagFile.delete();
          }
        } catch (_) {}
        return bytes;
      }
      if (res.statusCode == 404) {
        try {
          if (file != null && await file.exists()) await file.delete();
        } catch (_) {}
      }
    } catch (_) {
      // Sin red: mejor la foto vieja que las iniciales.
      if (disk != null && disk.isNotEmpty) {
        put(url, disk);
        return disk;
      }
    }
    _failedAt[url] = DateTime.now();
    return null;
  }

  static Future<Directory> _avatarDir() async {
    final cached = _dir;
    if (cached != null) return cached;
    final base = await getTemporaryDirectory();
    final d = Directory('${base.path}${Platform.pathSeparator}avatars');
    if (!await d.exists()) await d.create(recursive: true);
    _dir = d;
    return d;
  }

  static Future<File> _diskFile(String url) async {
    final d = await _avatarDir();
    final name = sha1.convert(utf8.encode(url)).toString();
    return File('${d.path}${Platform.pathSeparator}$name.img');
  }
}

/// Visor a pantalla completa de foto de perfil / grupo (estilo WhatsApp).
Future<void> openAvatarPreview({
  required BuildContext context,
  required String name,
  String? avatarUrl,
  Map<String, String>? headers,
  Uint8List? bytes,
  bool group = false,
}) async {
  final hasUrl = avatarUrl != null && avatarUrl.isNotEmpty;
  final cached = hasUrl ? AvatarBytesCache.get(avatarUrl) : null;
  final initial = bytes ?? cached;

  await Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black87,
      pageBuilder: (ctx, anim, secondary) {
        return _AvatarPreviewPage(
          name: name,
          avatarUrl: avatarUrl,
          headers: headers,
          initialBytes: initial,
          group: group,
        );
      },
      transitionsBuilder: (ctx, anim, secondary, child) {
        return FadeTransition(opacity: anim, child: child);
      },
    ),
  );
}

class _AvatarPreviewPage extends StatefulWidget {
  const _AvatarPreviewPage({
    required this.name,
    this.avatarUrl,
    this.headers,
    this.initialBytes,
    this.group = false,
  });

  final String name;
  final String? avatarUrl;
  final Map<String, String>? headers;
  final Uint8List? initialBytes;
  final bool group;

  @override
  State<_AvatarPreviewPage> createState() => _AvatarPreviewPageState();
}

class _AvatarPreviewPageState extends State<_AvatarPreviewPage> {
  Uint8List? _bytes;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bytes = widget.initialBytes;
    if (_bytes == null) {
      final url = widget.avatarUrl;
      if (url != null && url.isNotEmpty) _load(url);
    }
  }

  Future<void> _load(String url) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bytes = await AvatarBytesCache.load(
        url,
        auth: widget.headers?['Authorization'],
      );
      if (!mounted) return;
      if (bytes == null) {
        setState(() {
          _loading = false;
          _error = 'No se pudo cargar la foto';
        });
        return;
      }
      setState(() {
        _bytes = bytes;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'No se pudo cargar la foto';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              behavior: HitTestBehavior.opaque,
              child: Center(child: _buildBody()),
            ),
            Positioned(
              top: 8,
              left: 16,
              right: 56,
              child: Text(
                widget.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TacticalFonts.display(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Positioned(
              top: 0,
              right: 4,
              child: IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                ),
                tooltip: 'Cerrar',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_bytes != null) {
      return InteractiveViewer(
        minScale: 0.8,
        maxScale: 5,
        child: Image.memory(
          _bytes!,
          fit: BoxFit.contain,
          gaplessPlayback: true,
        ),
      );
    }
    if (_loading) {
      return const CircularProgressIndicator(
        color: Colors.white54,
        strokeWidth: 2,
      );
    }
    if (_error != null) {
      return Text(_error!, style: const TextStyle(color: Colors.white70));
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 96,
          backgroundColor: widget.group
              ? kInstOlive.withValues(alpha: 0.35)
              : kInstOliveMid.withValues(alpha: 0.45),
          child: widget.group
              ? const Text('👥', style: TextStyle(fontSize: 72))
              : Text(
                  userAvatarInitials(widget.name),
                  style: const TextStyle(
                    color: kInstOnPrimary,
                    fontSize: 56,
                    fontWeight: FontWeight.w800,
                  ),
                ),
        ),
        const SizedBox(height: 16),
        Text(
          widget.group ? 'Sin foto de grupo' : 'Sin foto de perfil',
          style: const TextStyle(color: Colors.white54, fontSize: 14),
        ),
      ],
    );
  }
}

/// Avatar circular: descarga con Authorization Bearer → [Image.memory].
/// Si falla la red, muestra iniciales (o emoji en grupos).
/// Por defecto, un toque abre la foto en grande (estilo WhatsApp).
class UserAvatar extends StatefulWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.userId,
    this.avatarUrl,
    this.headers,
    this.group = false,
    this.radius = 26,
    this.previewOnTap = true,
  });

  final String name;
  final String? userId;
  final String? avatarUrl;
  final Map<String, String>? headers;
  final bool group;
  final double radius;
  /// Si es true, tocar abre visor a pantalla completa.
  final bool previewOnTap;

  @override
  State<UserAvatar> createState() => _UserAvatarState();
}

class _UserAvatarState extends State<UserAvatar> {
  Uint8List? _bytes;
  bool _loading = false;
  String? _loadedFor;

  @override
  void initState() {
    super.initState();
    final url = widget.avatarUrl;
    if (url == null || url.isEmpty) return;
    final cached = AvatarBytesCache.get(url);
    if (cached != null) {
      _bytes = cached;
      _loadedFor = url;
      return;
    }
    _fetch(url);
  }

  @override
  void didUpdateWidget(covariant UserAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.avatarUrl != widget.avatarUrl ||
        oldWidget.headers?['Authorization'] !=
            widget.headers?['Authorization']) {
      _syncFromCacheOrFetch();
    }
  }

  void _syncFromCacheOrFetch() {
    final url = widget.avatarUrl;
    if (url == null || url.isEmpty) {
      setState(() {
        _bytes = null;
        _loadedFor = null;
        _loading = false;
      });
      return;
    }
    final cached = AvatarBytesCache.get(url);
    if (cached != null) {
      setState(() {
        _bytes = cached;
        _loadedFor = url;
        _loading = false;
      });
      return;
    }
    setState(() {
      _bytes = null;
      _loadedFor = null;
    });
    _fetch(url);
  }

  Future<void> _fetch(String url) async {
    if (_loading && _loadedFor == url) return;
    setState(() {
      _loading = true;
      _loadedFor = url;
    });
    try {
      final bytes = await AvatarBytesCache.load(
        url,
        auth: widget.headers?['Authorization'],
      );
      if (!mounted || widget.avatarUrl != url) return;
      if (bytes == null) {
        setState(() {
          _bytes = null;
          _loading = false;
        });
        return;
      }
      setState(() {
        _bytes = bytes;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || widget.avatarUrl != url) return;
      setState(() {
        _bytes = null;
        _loading = false;
      });
    }
  }

  Widget _initials() {
    final bg = widget.group
        ? kInstOlive.withValues(alpha: 0.18)
        : kRadioBlue.withValues(alpha: 0.15);
    final fg = widget.group ? kInstOlive : kRadioBlue;
    if (widget.group) {
      return CircleAvatar(
        radius: widget.radius,
        backgroundColor: bg,
        child: Text('👥', style: TextStyle(fontSize: widget.radius * 0.85)),
      );
    }
    return CircleAvatar(
      radius: widget.radius,
      backgroundColor: bg,
      child: Text(
        userAvatarInitials(widget.name),
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w800,
          fontSize: widget.radius * 0.54,
        ),
      ),
    );
  }

  void _openPreview(BuildContext context) {
    openAvatarPreview(
      context: context,
      name: widget.name,
      avatarUrl: widget.avatarUrl,
      headers: widget.headers,
      bytes: _bytes,
      group: widget.group,
    );
  }

  @override
  Widget build(BuildContext context) {
    final photo = widget.avatarUrl;
    final size = widget.radius * 2;
    final bg = widget.group
        ? kInstOlive.withValues(alpha: 0.18)
        : kRadioBlue.withValues(alpha: 0.15);
    final fg = widget.group ? kInstOlive : kRadioBlue;

    Widget face;
    if (photo == null || photo.isEmpty) {
      face = _initials();
    } else if (_bytes != null) {
      face = ClipOval(
        child: Image.memory(
          _bytes!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          gaplessPlayback: true,
        ),
      );
    } else if (_loading) {
      face = SizedBox(
        width: size,
        height: size,
        child: DecoratedBox(
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Center(
            child: SizedBox(
              width: widget.radius * 0.7,
              height: widget.radius * 0.7,
              child: CircularProgressIndicator(strokeWidth: 2, color: fg),
            ),
          ),
        ),
      );
    } else {
      face = _initials();
    }

    if (!widget.previewOnTap) return face;

    return GestureDetector(
      onTap: () => _openPreview(context),
      behavior: HitTestBehavior.opaque,
      child: Semantics(
        button: true,
        label: widget.group
            ? 'Ver foto del grupo ${widget.name}'
            : 'Ver foto de ${widget.name}',
        child: face,
      ),
    );
  }
}
