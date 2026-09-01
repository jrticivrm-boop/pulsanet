import 'package:flutter/material.dart';

import '../theme.dart';

/// Fondo institucional claro (sin camo). Conserva la API usada por pantallas.
class TacticalBackdrop extends StatelessWidget {
  const TacticalBackdrop({
    super.key,
    this.child,
    this.showEmblem = true,
    this.intensity = 1,
  });

  final Widget? child;
  final bool showEmblem;
  final double intensity;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: kInstPaper,
      child: child,
    );
  }
}
