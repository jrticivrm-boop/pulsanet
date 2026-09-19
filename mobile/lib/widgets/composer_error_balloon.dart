import 'package:flutter/material.dart';

import '../es_msg.dart';
import '../theme.dart';

/// Globo de error anclado al compositor (no banner arriba de la pantalla).
class ComposerErrorBalloon extends StatelessWidget {
  const ComposerErrorBalloon({
    super.key,
    required this.message,
    this.onDismiss,
  });

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final text = esMsg(message, 'No se pudo enviar');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onDismiss,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF3A1818),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.28),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.error_outline, color: Color(0xFFF0B4B4), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  text,
                  style: const TextStyle(
                    color: Color(0xFFF0B4B4),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.25,
                  ),
                ),
              ),
              if (onDismiss != null)
                Icon(
                  Icons.close,
                  size: 16,
                  color: kRadioDanger.withValues(alpha: 0.7),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
