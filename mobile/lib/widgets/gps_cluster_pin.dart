import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Colores de porción (paridad web `PRESENCE_CLUSTER_COLORS`).
const Map<String, Color> kGpsClusterSliceColors = {
  'online': Color(0xFF1F5A2E),
  'away': Color(0xFFA16207),
  'offline': Color(0xFF6B7280),
  'stale': Color(0xFF991B1B),
  'panic': Color(0xFFC62828),
};

const List<String> kGpsClusterSliceOrder = [
  'online',
  'away',
  'offline',
  'stale',
  'panic',
];

/// Cluster estilo pastel por presencia + cifras por color + anillos.
class GpsClusterPin extends StatefulWidget {
  const GpsClusterPin({
    super.key,
    required this.count,
    this.size = 44,
    this.slices = const <String, int>{},
  });

  final int count;
  final double size;

  /// Conteos por clave: online|away|offline|stale|panic
  final Map<String, int> slices;

  /// Tamaño del círculo: misma escala que web `mapClusterIcon`.
  static double sizeForCount(int count) {
    if (count >= 100) return 52;
    if (count >= 10) return 48;
    return 44;
  }

  @override
  State<GpsClusterPin> createState() => _GpsClusterPinState();
}

class _GpsClusterPinState extends State<GpsClusterPin>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  List<({String key, Color color, int count})> get _orderedSlices {
    final out = <({String key, Color color, int count})>[];
    final remaining = Map<String, int>.from(widget.slices);
    for (final key in kGpsClusterSliceOrder) {
      final n = remaining.remove(key) ?? 0;
      if (n > 0) {
        out.add((
          key: key,
          color: kGpsClusterSliceColors[key] ?? const Color(0xFF6B7280),
          count: n,
        ));
      }
    }
    for (final e in remaining.entries) {
      if (e.value <= 0) continue;
      out.add((
        key: e.key,
        color: kGpsClusterSliceColors[e.key] ?? const Color(0xFF6B7280),
        count: e.value,
      ));
    }
    return out;
  }

  Color get _ringColor {
    final slices = _orderedSlices;
    if (slices.isEmpty) return kGpsClusterSliceColors['online']!;
    var best = slices.first;
    for (final s in slices) {
      if (s.count > best.count) best = s;
    }
    return best.color;
  }

  @override
  Widget build(BuildContext context) {
    final face = widget.size;
    final ring = _ringColor;
    final slices = _orderedSlices;
    // 1 color → total al centro. 2+ → solo cifra en cada color (sin total encima).
    final multi = slices.length >= 2;
    final centerLabel = widget.count > 99 ? '99+' : '${widget.count}';
    final aria = multi
        ? slices.map((s) => '${s.count} ${_sliceAria(s.key)}').join(', ')
        : '$centerLabel en mapa';

    return Semantics(
      label: aria,
      child: SizedBox(
        width: face + 36,
        height: face + 36,
        child: AnimatedBuilder(
          animation: _pulse,
          builder: (context, _) {
            return Stack(
              alignment: Alignment.center,
              children: [
                _ring(progress: _pulse.value, color: ring, base: face),
                _ring(
                  progress: (_pulse.value + 0.33) % 1.0,
                  color: ring,
                  base: face,
                ),
                _ring(
                  progress: (_pulse.value + 0.66) % 1.0,
                  color: ring,
                  base: face,
                ),
                Container(
                  width: face,
                  height: face,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: ring.withValues(alpha: 0.45),
                        blurRadius: 10,
                        spreadRadius: 1,
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.28),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  // Pastel a tamaño completo + borde blanco encima (cuñas al centro real).
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ClipOval(
                        child: CustomPaint(
                          painter: _PieSlicePainter(
                            slices: slices
                                .map((s) => (color: s.color, count: s.count))
                                .toList(),
                            showSliceCounts: multi,
                          ),
                          child: multi
                              ? null
                              : Center(
                                  child: Text(
                                    centerLabel,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: face *
                                          (centerLabel.length > 2
                                              ? 0.32
                                              : 0.42),
                                      height: 1,
                                      shadows: const [
                                        Shadow(
                                          color: Colors.black87,
                                          blurRadius: 3,
                                          offset: Offset(0, 1),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                        ),
                      ),
                      IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 2.5,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  static String _sliceAria(String key) {
    switch (key) {
      case 'online':
        return 'en línea';
      case 'away':
        return 'ausente';
      case 'offline':
        return 'desconectado';
      case 'stale':
        return 'fuera de línea';
      case 'panic':
        return 'alerta';
      default:
        return key;
    }
  }

  Widget _ring({
    required double progress,
    required Color color,
    required double base,
  }) {
    final t = progress;
    final scale = 1.05 + t * 1.15;
    final opacity = ((1.0 - t) * 0.55).clamp(0.0, 1.0);
    return Container(
      width: base * scale,
      height: base * scale,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: opacity),
          width: 2.2,
        ),
      ),
    );
  }
}

class _PieSlicePainter extends CustomPainter {
  _PieSlicePainter({
    required this.slices,
    this.showSliceCounts = false,
  });

  final List<({Color color, int count})> slices;
  final bool showSliceCounts;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final total = slices.fold<int>(0, (s, x) => s + x.count);
    if (total <= 0 || slices.isEmpty) {
      canvas.drawRect(rect, Paint()..color = const Color(0xFF1F5A2E));
      return;
    }
    if (slices.length == 1) {
      canvas.drawRect(rect, Paint()..color = slices.first.color);
      return;
    }

    var start = -math.pi / 2;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final nSlices = slices.length;
    final fontSize = (size.width * (nSlices >= 4 ? 0.22 : 0.26)).clamp(8.0, 14.0);

    // 1) Porciones
    for (final sl in slices) {
      final sweep = (sl.count / total) * math.pi * 2;
      canvas.drawArc(rect, start, sweep, true, Paint()..color = sl.color);
      start += sweep;
    }

    // 2) Cifra en CADA color (también cuñas finas: radio un poco mayor).
    if (!showSliceCounts) return;
    start = -math.pi / 2;
    for (final sl in slices) {
      final sweep = (sl.count / total) * math.pi * 2;
      if (sl.count > 0) {
        final mid = start + sweep / 2;
        // Cuña fina → número más hacia el borde para que no caiga al centro.
        final frac = sweep / (math.pi * 2);
        final labelR = size.width * (frac < 0.12 ? 0.38 : 0.30);
        final tx = cx + math.cos(mid) * labelR;
        final ty = cy + math.sin(mid) * labelR;
        final text = sl.count > 99 ? '99+' : '${sl.count}';
        final tp = TextPainter(
          text: TextSpan(
            text: text,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: fontSize,
              height: 1,
              shadows: const [
                Shadow(
                  color: Colors.black87,
                  blurRadius: 3.5,
                  offset: Offset(0, 1),
                ),
              ],
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(tx - tp.width / 2, ty - tp.height / 2));
      }
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _PieSlicePainter oldDelegate) {
    if (oldDelegate.showSliceCounts != showSliceCounts) return true;
    if (oldDelegate.slices.length != slices.length) return true;
    for (var i = 0; i < slices.length; i++) {
      if (oldDelegate.slices[i].count != slices[i].count ||
          oldDelegate.slices[i].color != slices[i].color) {
        return true;
      }
    }
    return false;
  }
}
