import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

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

/// Cache en memoria de avatares descargados con Bearer (Image.network falla con auth).
class AvatarBytesCache {
  AvatarBytesCache._();
  static final Map<String, Uint8List> _byUrl = {};

  static Uint8List? get(String url) => _byUrl[url];

  static void put(String url, Uint8List bytes) {
    if (_byUrl.length > 80) {
      _byUrl.remove(_byUrl.keys.first);
    }
    _byUrl[url] = bytes;
  }

  static void remove(String url) => _byUrl.remove(url);

  static void clear() => _byUrl.clear();
}

/// Avatar circular: descarga con Authorization Bearer → [Image.memory].
/// Si falla la red, muestra iniciales (o emoji en grupos).
class UserAvatar extends StatefulWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.userId,
    this.avatarUrl,
    this.headers,
    this.group = false,
    this.radius = 26,
  });

  final String name;
  final String? userId;
  final String? avatarUrl;
  final Map<String, String>? headers;
  final bool group;
  final double radius;

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
      final auth = widget.headers?['Authorization'];
      final res = await http.get(
        Uri.parse(url),
        headers: {
          if (auth != null && auth.isNotEmpty) 'Authorization': auth,
        },
      );
      if (!mounted || widget.avatarUrl != url) return;
      if (res.statusCode >= 400 || res.bodyBytes.isEmpty) {
        setState(() {
          _bytes = null;
          _loading = false;
        });
        return;
      }
      final bytes = res.bodyBytes;
      AvatarBytesCache.put(url, bytes);
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

  @override
  Widget build(BuildContext context) {
    final photo = widget.avatarUrl;
    final size = widget.radius * 2;
    final bg = widget.group
        ? kInstOlive.withValues(alpha: 0.18)
        : kRadioBlue.withValues(alpha: 0.15);
    final fg = widget.group ? kInstOlive : kRadioBlue;

    if (photo == null || photo.isEmpty) return _initials();

    if (_bytes != null) {
      return ClipOval(
        child: Image.memory(
          _bytes!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          gaplessPlayback: true,
        ),
      );
    }

    if (_loading) {
      return SizedBox(
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
    }

    return _initials();
  }
}
