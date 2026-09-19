import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Ondas tipo equalizer: se mueven solo mientras [active] (PTT al aire).
class PttWaveBars extends StatefulWidget {
  const PttWaveBars({
    super.key,
    required this.active,
    this.color = kInstGoldSoft,
    this.height = 28,
    this.width = 36,
  });

  final bool active;
  final Color color;
  final double height;
  final double width;

  @override
  State<PttWaveBars> createState() => _PttWaveBarsState();
}

class _PttWaveBarsState extends State<PttWaveBars>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.active) {
      _ctrl.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant PttWaveBars oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_ctrl.isAnimating) {
      _ctrl.repeat();
    } else if (!widget.active && _ctrl.isAnimating) {
      _ctrl.stop();
      _ctrl.value = 0;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return Icon(Icons.mic_rounded, size: widget.height + 8, color: widget.color);
    }
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) {
          return CustomPaint(
            painter: _WaveBarsPainter(
              t: _ctrl.value,
              color: widget.color,
            ),
          );
        },
      ),
    );
  }
}

class _WaveBarsPainter extends CustomPainter {
  _WaveBarsPainter({required this.t, required this.color});

  final double t;
  final Color color;

  static const _phases = [0.0, 0.22, 0.45, 0.68, 0.88];

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    const barCount = 5;
    final gap = size.width * 0.08;
    final barW = (size.width - gap * (barCount - 1)) / barCount;
    final minH = size.height * 0.28;
    final maxH = size.height;

    for (var i = 0; i < barCount; i++) {
      final phase = _phases[i];
      // Ondas desfasadas: suben/bajan como equalizer al transmitir.
      final wave = (math.sin((t + phase) * math.pi * 2) + 1) / 2;
      final h = minH + (maxH - minH) * (0.25 + 0.75 * wave);
      final x = i * (barW + gap);
      final y = (size.height - h) / 2;
      final r = Radius.circular(barW / 2);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, y, barW, h), r),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WaveBarsPainter oldDelegate) =>
      oldDelegate.t != t || oldDelegate.color != color;
}
