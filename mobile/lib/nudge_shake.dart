import 'package:flutter/widgets.dart';

/// Sacudida lateral del chat (~1.45 s), paridad con `.dm-nudge-shake` en web.
class NudgeShake {
  NudgeShake._();

  static final ValueNotifier<int> generation = ValueNotifier<int>(0);
  static DateTime? _last;

  /// Ignora el segundo evento del mismo zumbido (`dm:message` + `dm:nudge`).
  static void play() {
    final now = DateTime.now();
    if (_last != null &&
        now.difference(_last!) < const Duration(milliseconds: 400)) {
      return;
    }
    _last = now;
    generation.value++;
  }
}

class NudgeShakeHost extends StatefulWidget {
  const NudgeShakeHost({super.key, required this.child});

  final Widget child;

  @override
  State<NudgeShakeHost> createState() => _NudgeShakeHostState();
}

class _NudgeShakeHostState extends State<NudgeShakeHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  int _seen = 0;

  /// Mismos cortes que `@keyframes dm-nudge-shake` (px → dp).
  static const List<(double, double)> _keys = [
    (0.00, 0),
    (0.08, -8),
    (0.16, 9),
    (0.24, -7),
    (0.32, 8),
    (0.40, -6),
    (0.48, 7),
    (0.56, -5),
    (0.64, 5),
    (0.72, -4),
    (0.80, 3),
    (0.88, -2),
    (1.00, 0),
  ];

  @override
  void initState() {
    super.initState();
    _seen = NudgeShake.generation.value;
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1450),
    );
    NudgeShake.generation.addListener(_onPlay);
  }

  void _onPlay() {
    if (!mounted) return;
    final next = NudgeShake.generation.value;
    if (next == _seen) return;
    _seen = next;
    _controller.forward(from: 0);
  }

  double _dx(double t) {
    for (var i = 0; i < _keys.length - 1; i++) {
      final a = _keys[i];
      final b = _keys[i + 1];
      if (t <= b.$1) {
        final span = b.$1 - a.$1;
        final u = span == 0 ? 0.0 : ((t - a.$1) / span).clamp(0.0, 1.0);
        final eased = Curves.easeInOut.transform(u);
        return a.$2 + (b.$2 - a.$2) * eased;
      }
    }
    return 0;
  }

  @override
  void dispose() {
    NudgeShake.generation.removeListener(_onPlay);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final dx = _controller.isDismissed ? 0.0 : _dx(_controller.value);
        return Transform.translate(
          offset: Offset(dx, 0),
          child: child,
        );
      },
    );
  }
}
