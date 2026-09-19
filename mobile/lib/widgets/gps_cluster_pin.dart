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

/// Cluster estilo pastel por presencia + número + anillos de pulso.
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

  List<({Color color, int count})> get _orderedSlices {
    final out = <({Color color, int count})>[];
    final remaining = Map<String, int>.from(widget.slices);
    for (final key in kGpsClusterSliceOrder) {
      final n = remaining.remove(key) ?? 0;
      if (n > 0) {
        out.add((
          color: kGpsClusterSliceColors[key] ?? const Color(0xFF6B7280),
          count: n,
        ));
      }
    }
    for (final e in remaining.entries) {
      if (e.value <= 0) continue;
      out.add((
        color: kGpsClusterSliceColors[e.key] ?? const Color(0xFF6B7280),
        count: e.value,
      ));
    }
    return out;
  }

  Color get _ringColor {
    final slices = _orderedSlices;
    // Paridad web: sin porciones → verde online (no azul Google).
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
    final label = widget.count > 99 ? '99+' : '${widget.count}';
    final ring = _ringColor;
    final slices = _orderedSlices;

    return SizedBox(
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
                  border: Border.all(color: Colors.white, width: 2.5),
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
                child: ClipOval(
                  child: CustomPaint(
                    painter: _PieSlicePainter(slices: slices),
                    child: Center(
                      child: Text(
                        label,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: face * (label.length > 2 ? 0.32 : 0.42),
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
              ),
            ],
          );
        },
      ),
    );
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
  _PieSlicePainter({required this.slices});

  final List<({Color color, int count})> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final total = slices.fold<int>(0, (s, x) => s + x.count);
    if (total <= 0 || slices.isEmpty) {
      canvas.drawRect(
        rect,
        Paint()..color = const Color(0xFF1F5A2E),
      );
      return;
    }
    if (slices.length == 1) {
      canvas.drawRect(rect, Paint()..color = slices.first.color);
      return;
    }
    var start = -math.pi / 2;
    for (final sl in slices) {
      final sweep = (sl.count / total) * math.pi * 2;
      canvas.drawArc(
        rect,
        start,
        sweep,
        true,
        Paint()..color = sl.color,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _PieSlicePainter oldDelegate) {
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
