import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';

class ChatGalleryItem {
  const ChatGalleryItem({
    required this.mediaUrl,
    this.caption,
  });

  final String mediaUrl;
  final String? caption;
}

/// Visor a pantalla completa con swipe entre imágenes del chat (estilo WhatsApp).
Future<void> openChatImageGallery({
  required BuildContext context,
  required ApiClient api,
  required List<ChatGalleryItem> items,
  required int initialIndex,
}) async {
  if (items.isEmpty) return;
  final idx = initialIndex.clamp(0, items.length - 1);
  await Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black87,
      pageBuilder: (ctx, anim, secondary) {
        return _ChatImageGalleryPage(
          api: api,
          items: items,
          initialIndex: idx,
        );
      },
      transitionsBuilder: (ctx, anim, secondary, child) {
        return FadeTransition(opacity: anim, child: child);
      },
    ),
  );
}

class _ChatImageGalleryPage extends StatefulWidget {
  const _ChatImageGalleryPage({
    required this.api,
    required this.items,
    required this.initialIndex,
  });

  final ApiClient api;
  final List<ChatGalleryItem> items;
  final int initialIndex;

  @override
  State<_ChatImageGalleryPage> createState() => _ChatImageGalleryPageState();
}

class _ChatImageGalleryPageState extends State<_ChatImageGalleryPage> {
  late final PageController _page;
  late int _index;
  final Map<int, Uint8List> _cache = {};
  final Set<int> _loading = {};
  final Map<int, String> _errors = {};

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _page = PageController(initialPage: _index);
    _ensureLoaded(_index);
    if (_index > 0) _ensureLoaded(_index - 1);
    if (_index < widget.items.length - 1) _ensureLoaded(_index + 1);
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  Future<void> _ensureLoaded(int i) async {
    if (i < 0 || i >= widget.items.length) return;
    if (_cache.containsKey(i) || _loading.contains(i)) return;
    _loading.add(i);
    try {
      final url = widget.api.mediaAbsoluteUrl(widget.items[i].mediaUrl);
      final res = await http.get(
        Uri.parse(url),
        headers: {
          if (widget.api.token != null) 'Authorization': 'Bearer ${widget.api.token}',
        },
      );
      if (!mounted) return;
      if (res.statusCode >= 400) {
        setState(() => _errors[i] = 'Error ${res.statusCode}');
      } else {
        setState(() => _cache[i] = res.bodyBytes);
      }
    } catch (e) {
      if (mounted) setState(() => _errors[i] = e.toString());
    } finally {
      _loading.remove(i);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.items[_index];
    final caption = (item.caption ?? '').trim();
    final total = widget.items.length;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            PageView.builder(
              controller: _page,
              itemCount: total,
              onPageChanged: (i) {
                setState(() => _index = i);
                _ensureLoaded(i);
                _ensureLoaded(i - 1);
                _ensureLoaded(i + 1);
              },
              itemBuilder: (ctx, i) {
                final err = _errors[i];
                final bytes = _cache[i];
                if (err != null) {
                  return Center(
                    child: Text(err, style: const TextStyle(color: Colors.white70)),
                  );
                }
                if (bytes == null) {
                  return const Center(
                    child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
                  );
                }
                return InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 5,
                  child: Center(
                    child: Image.memory(bytes, fit: BoxFit.contain),
                  ),
                );
              },
            ),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ),
            if (total > 1)
              Positioned(
                top: 14,
                left: 0,
                right: 0,
                child: IgnorePointer(
                  child: Text(
                    '${_index + 1} / $total',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (caption.isNotEmpty)
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: Text(
                  caption,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
