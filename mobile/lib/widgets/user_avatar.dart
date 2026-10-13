import 'dart:async';
import 'dart:collection';
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
/// Memoria (LRU) + disco. Lo guardado se muestra al instante y se revalida en
/// segundo plano (ETag → 304); «sin foto» (404) se recuerda en disco para no
/// pedirlo en cada pantalla. La clave es la ruta `/api/avatars/...` sin host,
/// así Wi‑Fi (IP LAN) y datos (dominio) comparten la misma copia.
class AvatarBytesCache {
  AvatarBytesCache._();
  static final LinkedHashMap<String, Uint8List> _byKey = LinkedHashMap();
  static final Map<String, Future<Uint8List?>> _inflight = {};
  static final Map<String, DateTime> _failedAt = {};
  static final Map<String, DateTime> _missingAt = {};
  static final Set<String> _revalidating = {};
  static final StreamController<String> _updates =
      StreamController<String>.broadcast();
  static const _maxInMemory = 300;
  static const _failRetry = Duration(minutes: 2);
  static const _missingTtl = Duration(hours: 6);
  /// Igual que `Cache-Control: max-age=3600` del servidor.
  static const _diskFresh = Duration(hours: 1);
  static const _fileFresh = Duration(days: 7);
  static const _netTimeout = Duration(seconds: 15);
  static final http.Client _http =
      IOClient(HttpClient()..idleTimeout = const Duration(seconds: 75));
  static Directory? _dir;

  /// Emite la clave ([keyFor]) cuando una foto cambió tras revalidar.
  static Stream<String> get updates => _updates.stream;

  static String keyFor(String url) {
    final u = Uri.tryParse(url);
    if (u == null || u.path.isEmpty) return url;
    return u.path;
  }

  static Uint8List? get(String url) {
    final k = keyFor(url);
    final hit = _byKey.remove(k);
    if (hit != null) _byKey[k] = hit;
    return hit;
  }

  /// true si el servidor dijo «sin foto» hace poco: mostrar iniciales sin pedir.
  static bool isMissing(String url) {
    final at = _missingAt[keyFor(url)];
    return at != null && DateTime.now().difference(at) < _missingTtl;
  }

  static void put(String url, Uint8List bytes) => _putKey(keyFor(url), bytes);

  static void _putKey(String k, Uint8List bytes) {
    _byKey.remove(k);
    _byKey[k] = bytes;
    while (_byKey.length > _maxInMemory) {
      _byKey.remove(_byKey.keys.first);
    }
    _failedAt.remove(k);
    _missingAt.remove(k);
  }

  static void remove(String url) {
    final k = keyFor(url);
    _byKey.remove(k);
    _failedAt.remove(k);
    _missingAt.remove(k);
    unawaited(_diskFile(k).then((f) async {
      for (final x in [f, File('${f.path}.etag'), File('${f.path}.none')]) {
        if (await x.exists()) await x.delete();
      }
    }).catchError((_) {}));
    _updates.add(k);
  }

  static void clear() {
    _byKey.clear();
    _failedAt.clear();
    _missingAt.clear();
    unawaited(_avatarDir().then((d) async {
      if (await d.exists()) await d.delete(recursive: true);
      _dir = null;
    }).catchError((_) {}));
  }

  /// Bytes del avatar: memoria → disco (al instante) → red. null si no hay foto.
  static Future<Uint8List?> load(String url, {String? auth}) {
    final k = keyFor(url);
    final hit = get(url);
    if (hit != null) return Future.value(hit);
    if (isMissing(url)) return Future.value(null);
    final failed = _failedAt[k];
    if (failed != null && DateTime.now().difference(failed) < _failRetry) {
      return Future.value(null);
    }
    final pending = _inflight[k];
    if (pending != null) return pending;
    final fut =
        _loadUncached(url, k, auth).whenComplete(() => _inflight.remove(k));
    _inflight[k] = fut;
    return fut;
  }

  static Future<Uint8List?> _loadUncached(
    String url,
    String k,
    String? auth,
  ) async {
    File? file;
    try {
      file = await _diskFile(k);
      if (await file.exists()) {
        final disk = await file.readAsBytes();
        if (disk.isNotEmpty) {
          _putKey(k, disk);
          final age = DateTime.now().difference(await file.lastModified());
          // `/api/avatars/file/<uuid>` no cambia nunca (cada subida = nombre nuevo).
          final fresh =
              k.contains('/avatars/file/') ? _fileFresh : _diskFresh;
          if (age >= fresh) unawaited(_revalidate(url, k, auth, file, disk));
          return disk;
        }
      }
      final none = File('${file.path}.none');
      if (await none.exists()) {
        final at = await none.lastModified();
        if (DateTime.now().difference(at) < _missingTtl) {
          _missingAt[k] = at;
          return null;
        }
      }
    } catch (_) {}
    return _fetch(url, k, auth, file, null, null);
  }

  static Future<void> _revalidate(
    String url,
    String k,
    String? auth,
    File file,
    Uint8List disk,
  ) async {
    if (!_revalidating.add(k)) return;
    try {
      String? etag;
      try {
        final tagFile = File('${file.path}.etag');
        if (await tagFile.exists()) etag = (await tagFile.readAsString()).trim();
      } catch (_) {}
      final fresh = await _fetch(url, k, auth, file, disk, etag);
      if (!identical(fresh, disk)) _updates.add(k);
    } finally {
      _revalidating.remove(k);
    }
  }

  static Future<Uint8List?> _fetch(
    String url,
    String k,
    String? auth,
    File? file,
    Uint8List? disk,
    String? etag,
  ) async {
    try {
      final res = await _http.get(Uri.parse(url), headers: {
        if (auth != null && auth.isNotEmpty) 'Authorization': auth,
        if (disk != null && disk.isNotEmpty && etag != null && etag.isNotEmpty)
          'If-None-Match': etag,
      }).timeout(_netTimeout);
      if (res.statusCode == 304 && disk != null && disk.isNotEmpty) {
        try {
          await file?.setLastModified(DateTime.now());
        } catch (_) {}
        return disk;
      }
      if (res.statusCode >= 200 &&
          res.statusCode < 300 &&
          res.bodyBytes.isNotEmpty) {
        final bytes = res.bodyBytes;
        _putKey(k, bytes);
        try {
          await file?.writeAsBytes(bytes, flush: false);
          final tag = res.headers['etag'];
          final tagFile = file == null ? null : File('${file.path}.etag');
          if (tag != null && tag.isNotEmpty) {
            await tagFile?.writeAsString(tag);
          } else if (tagFile != null && await tagFile.exists()) {
            await tagFile.delete();
          }
          final none = file == null ? null : File('${file.path}.none');
          if (none != null && await none.exists()) await none.delete();
        } catch (_) {}
        return bytes;
      }
      if (res.statusCode == 404) {
        _byKey.remove(k);
        _missingAt[k] = DateTime.now();
        try {
          if (file != null) {
            if (await file.exists()) await file.delete();
            await File('${file.path}.none').writeAsString('');
          }
        } catch (_) {}
        return null;
      }
    } catch (_) {
      // Sin red: mejor la foto vieja que las iniciales.
    }
    if (disk != null && disk.isNotEmpty) return disk;
    _failedAt[k] = DateTime.now();
    return null;
  }

  static Future<Directory> _avatarDir() async {
    final cached = _dir;
    if (cached != null) return cached;
    final base = await getApplicationSupportDirectory();
    final d = Directory('${base.path}${Platform.pathSeparator}avatars');
    if (!await d.exists()) await d.create(recursive: true);
    _dir = d;
    return d;
  }

  static Future<File> _diskFile(String key) async {
    final d = await _avatarDir();
    final name = sha1.convert(utf8.encode(key)).toString();
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
  StreamSubscription<String>? _updatesSub;

  @override
  void initState() {
    super.initState();
    _updatesSub = AvatarBytesCache.updates.listen(_onCacheUpdate);
    final url = widget.avatarUrl;
    if (url == null || url.isEmpty) return;
    final cached = AvatarBytesCache.get(url);
    if (cached != null) {
      _bytes = cached;
      _loadedFor = url;
      return;
    }
    if (AvatarBytesCache.isMissing(url)) return;
    _fetch(url);
  }

  void _onCacheUpdate(String key) {
    final url = widget.avatarUrl;
    if (!mounted || url == null || url.isEmpty) return;
    if (AvatarBytesCache.keyFor(url) != key) return;
    setState(() => _bytes = AvatarBytesCache.get(url));
  }

  @override
  void dispose() {
    _updatesSub?.cancel();
    super.dispose();
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
    if (AvatarBytesCache.isMissing(url)) return;
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

    Widget face;
    if (photo == null || photo.isEmpty || _bytes == null) {
      // Mientras carga: iniciales (sin spinner) para no ensuciar listas largas.
      face = _initials();
    } else {
      final px = (size * MediaQuery.devicePixelRatioOf(context)).round();
      face = ClipOval(
        child: Image.memory(
          _bytes!,
          width: size,
          height: size,
          cacheWidth: px,
          fit: BoxFit.cover,
          gaplessPlayback: true,
          errorBuilder: (_, _, _) => _initials(),
        ),
      );
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
