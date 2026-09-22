import 'package:flutter/material.dart';

import '../api_client.dart';
import '../emoji_data.dart';
import '../theme.dart';

/// Panel inferior tipo WhatsApp: emojis / stickers + cierre a teclado.
class ChatEmojiPanel extends StatefulWidget {
  const ChatEmojiPanel({
    super.key,
    required this.api,
    required this.onEmoji,
    required this.onSticker,
    required this.onRequestKeyboard,
    this.height = 280,
  });

  final ApiClient api;
  final ValueChanged<String> onEmoji;
  final ValueChanged<Map<String, dynamic>> onSticker;
  final VoidCallback onRequestKeyboard;
  final double height;

  @override
  State<ChatEmojiPanel> createState() => _ChatEmojiPanelState();
}

class _ChatEmojiPanelState extends State<ChatEmojiPanel> {
  int _tab = 0; // 0 emoji, 1 sticker
  int _cat = 0;
  int _pack = 0;
  List<Map<String, dynamic>> _packs = const [];
  bool _loadingPacks = false;
  String? _packErr;

  @override
  void initState() {
    super.initState();
    _loadPacks();
  }

  Future<void> _loadPacks() async {
    setState(() {
      _loadingPacks = true;
      _packErr = null;
    });
    try {
      final packs = await widget.api.fetchStickerPacks();
      if (!mounted) return;
      setState(() {
        _packs = packs;
        _loadingPacks = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPacks = false;
        _packErr = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cat = kEmojiCategories[_cat.clamp(0, kEmojiCategories.length - 1)];
    return Material(
      color: const Color(0xFF1F2C34),
      child: SizedBox(
        height: widget.height,
        child: Column(
          children: [
            SizedBox(
              height: 44,
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Teclado',
                    onPressed: widget.onRequestKeyboard,
                    icon: const Icon(Icons.keyboard_alt_outlined, color: Colors.white70),
                  ),
                  Expanded(
                    child: _tab == 0
                        ? ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: kEmojiCategories.length,
                            itemBuilder: (_, i) {
                              final c = kEmojiCategories[i];
                              final active = i == _cat;
                              return InkWell(
                                onTap: () => setState(() => _cat = i),
                                child: Container(
                                  width: 42,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    border: Border(
                                      bottom: BorderSide(
                                        color: active ? kInstOlive : Colors.transparent,
                                        width: 3,
                                      ),
                                    ),
                                  ),
                                  child: Text(c.icon, style: const TextStyle(fontSize: 20)),
                                ),
                              );
                            },
                          )
                        : ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: _packs.length,
                            itemBuilder: (_, i) {
                              final pack = _packs[i];
                              final stickers = pack['stickers'];
                              String icon = '📦';
                              if (stickers is List && stickers.isNotEmpty) {
                                final first = stickers.first;
                                if (first is Map && first['value'] != null) {
                                  icon = first['value'].toString();
                                }
                              }
                              final active = i == _pack;
                              return InkWell(
                                onTap: () => setState(() => _pack = i),
                                child: Container(
                                  width: 48,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    border: Border(
                                      bottom: BorderSide(
                                        color: active ? kInstOlive : Colors.transparent,
                                        width: 3,
                                      ),
                                    ),
                                  ),
                                  child: Text(icon, style: const TextStyle(fontSize: 22)),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFF2A3942)),
            Expanded(
              child: _tab == 0
                  ? GridView.builder(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 8,
                        mainAxisSpacing: 2,
                        crossAxisSpacing: 2,
                      ),
                      itemCount: cat.emojis.length,
                      itemBuilder: (_, i) {
                        final e = cat.emojis[i];
                        return InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: () => widget.onEmoji(e),
                          child: Center(
                            child: Text(e, style: const TextStyle(fontSize: 26)),
                          ),
                        );
                      },
                    )
                  : _buildStickers(),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _TabPill(
                    icon: Icons.emoji_emotions_rounded,
                    label: 'Emojis',
                    active: _tab == 0,
                    onTap: () => setState(() => _tab = 0),
                  ),
                  const SizedBox(width: 10),
                  _TabPill(
                    icon: Icons.sticky_note_2_rounded,
                    label: 'Stickers',
                    active: _tab == 1,
                    onTap: () => setState(() => _tab = 1),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStickers() {
    if (_loadingPacks) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    if (_packErr != null) {
      return Center(
        child: TextButton(
          onPressed: _loadPacks,
          child: Text('Reintentar\n$_packErr', textAlign: TextAlign.center),
        ),
      );
    }
    if (_packs.isEmpty) {
      return const Center(
        child: Text('No hay stickers', style: TextStyle(color: Colors.white54)),
      );
    }
    final pack = _packs[_pack.clamp(0, _packs.length - 1)];
    final raw = pack['stickers'];
    final stickers = raw is List
        ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : <Map<String, dynamic>>[];
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: stickers.length,
      itemBuilder: (_, i) {
        final s = stickers[i];
        final value = s['value']?.toString() ?? '';
        return Material(
          color: const Color(0xFF2A3942),
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => widget.onSticker(s),
            child: Center(
              child: Text(value, style: const TextStyle(fontSize: 40)),
            ),
          ),
        );
      },
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? kInstOlive : Colors.white70;
    return Material(
      color: active ? kInstOlive.withValues(alpha: 0.28) : const Color(0xFF2A3942),
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
