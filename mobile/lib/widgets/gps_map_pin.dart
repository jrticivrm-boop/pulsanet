import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../theme.dart';
import 'user_avatar.dart';

/// Pin estilo web `.lt-wa`: círculo con borde sólido de presencia + punta.
class GpsMapPin extends StatefulWidget {
  const GpsMapPin({
    super.key,
    required this.name,
    this.photoUrl,
    this.headers,
    this.presenceColor = kInstOk,
    this.rimColor = const Color(0xFFE8F5E4),
    this.live = false,
    this.selected = false,
    this.panic = false,
    this.showLabel = false,
    this.cargo,
  });

  final String name;
  final String? photoUrl;
  final Map<String, String>? headers;
  /// Borde sólido del círculo (verde / rojo / gris), como web `--pin-green`.
  final Color presenceColor;
  /// Aro interior claro (`--pin-rim`).
  final Color rimColor;
  final bool live;
  final bool selected;
  final bool panic;
  /// Etiqueta bajo el pin (cargo / nombre): solo si zoom cercano.
  final bool showLabel;
  final String? cargo;

  @override
  State<GpsMapPin> createState() => _GpsMapPinState();
}

class _GpsMapPinState extends State<GpsMapPin>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Uint8List? _bytes;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    if (widget.live || widget.panic) _pulse.repeat();
    unawaited(_loadPhoto());
  }

  @override
  void didUpdateWidget(covariant GpsMapPin oldWidget) {
    super.didUpdateWidget(oldWidget);
    final shouldPulse = widget.live || widget.panic;
    if (shouldPulse && !_pulse.isAnimating) {
      _pulse.repeat();
    } else if (!shouldPulse && _pulse.isAnimating) {
      _pulse
        ..stop()
        ..value = 0;
    }
    if (oldWidget.photoUrl != widget.photoUrl) {
      unawaited(_loadPhoto());
    }
  }

  Future<void> _loadPhoto() async {
    final url = widget.photoUrl;
    if (url == null || url.isEmpty) {
      if (mounted) setState(() => _bytes = null);
      return;
    }
    final cached = AvatarBytesCache.get(url);
    if (cached != null) {
      if (mounted) setState(() => _bytes = cached);
      return;
    }
    try {
      final res = await http.get(
        Uri.parse(url),
        headers: widget.headers ?? const {},
      );
      if (!mounted || widget.photoUrl != url) return;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AvatarBytesCache.put(url, res.bodyBytes);
        setState(() => _bytes = res.bodyBytes);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Color get _borderColor {
    if (widget.panic) return const Color(0xFFC62828);
    return widget.presenceColor;
  }

  Color get _rimColor {
    if (widget.panic) return const Color(0xFFFFCDD2);
    return widget.rimColor;
  }

  @override
  Widget build(BuildContext context) {
    final face = widget.selected ? 52.0 : 40.0;
    final borderW = widget.selected ? 4.5 : 3.5;
    final tip = face * 0.32;
    final totalH = face + tip * 0.55 + 4;
    final initial = userAvatarInitials(widget.name);
    final showPulse = widget.live || widget.panic;
    final label = widget.showLabel ? widget.cargo?.trim() : null;
    final border = _borderColor;
    final rim = _rimColor;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: face + 24,
          height: totalH + (showPulse ? 8 : 0),
          child: Stack(
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
            children: [
              // Punta (rombito) — mismo color del borde sólido
              Positioned(
                top: face - tip * 0.35,
                child: Transform.rotate(
                  angle: 0.785398, // 45°
                  child: Container(
                    width: tip,
                    height: tip,
                    decoration: BoxDecoration(
                      color: border,
                      borderRadius: BorderRadius.circular(2),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black38,
                          blurRadius: 3,
                          offset: Offset(0, 1),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // Anillos de latido (solo en línea / pánico) — borde fino, sin glow difuso
              if (showPulse)
                Positioned(
                  top: 0,
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, _) {
                      return SizedBox(
                        width: face + 24,
                        height: face + 24,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            _PulseRing(
                              progress: _pulse.value,
                              color: border,
                              base: face,
                            ),
                            _PulseRing(
                              progress: (_pulse.value + 0.5) % 1.0,
                              color: border,
                              base: face,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              // Cara: círculo con borde sólido de presencia + aro interior
              Positioned(
                top: 0,
                child: Container(
                  width: face,
                  height: face,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _bytes != null
                        ? const Color(0xFF1A2220)
                        : border.withValues(alpha: 0.85),
                    border: Border.all(color: border, width: borderW),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.35),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                      if (widget.selected)
                        BoxShadow(
                          color: border.withValues(alpha: 0.4),
                          blurRadius: 0,
                          spreadRadius: 3,
                        ),
                    ],
                    image: _bytes != null
                        ? DecorationImage(
                            image: MemoryImage(_bytes!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Aro interior claro (como inset box-shadow web)
                      IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: rim, width: 2.2),
                          ),
                        ),
                      ),
                      if (_bytes == null)
                        Center(
                          child: Text(
                            initial,
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: face * 0.34,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (label != null && label.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxWidth: 96),
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.62),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}

class _PulseRing extends StatelessWidget {
  const _PulseRing({
    required this.progress,
    required this.color,
    required this.base,
  });

  final double progress;
  final Color color;
  final double base;

  @override
  Widget build(BuildContext context) {
    final t = progress;
    final scale = 1.0 + t * 0.85;
    final opacity = (1.0 - t).clamp(0.0, 1.0);
    return Container(
      width: base * scale,
      height: base * scale,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: 0.7 * opacity),
          width: 2,
        ),
      ),
    );
  }
}
