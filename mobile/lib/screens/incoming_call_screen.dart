import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Pantalla de llamada entrante estilo WhatsApp / teléfono.
class IncomingCallScreen extends StatefulWidget {
  const IncomingCallScreen({
    super.key,
    required this.callerName,
    required this.onAccept,
    required this.onReject,
  });

  final String callerName;
  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;

  @override
  State<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends State<IncomingCallScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _buzz();
  }

  Future<void> _buzz() async {
    while (mounted && !_busy) {
      try {
        await HapticFeedback.heavyImpact();
      } catch (_) {}
      await Future<void>.delayed(const Duration(milliseconds: 900));
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  String get _initials {
    final parts = widget.callerName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length.clamp(1, 2)).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0B141A),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text(
                'Llamada de voz entrante',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.72),
                  fontSize: 15,
                  letterSpacing: 0.2,
                ),
              ),
              const Spacer(flex: 2),
              AnimatedBuilder(
                animation: _pulse,
                builder: (context, child) {
                  final t = _pulse.value;
                  return SizedBox(
                    width: 200,
                    height: 200,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        for (final delay in [0.0, 0.35, 0.7])
                          Transform.scale(
                            scale: 0.85 + ((t + delay) % 1.0) * 0.55,
                            child: Opacity(
                              opacity: (1 - ((t + delay) % 1.0)) * 0.35,
                              child: Container(
                                width: 160,
                                height: 160,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFF25D366),
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        child!,
                      ],
                    ),
                  );
                },
                child: Container(
                  width: 118,
                  height: 118,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                    ),
                  ),
                  child: Text(
                    _initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                widget.callerName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _busy ? 'Conectando…' : 'Pulsa para contestar',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 15,
                ),
              ),
              const Spacer(flex: 3),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _CallActionButton(
                    color: const Color(0xFFE11D48),
                    icon: Icons.call_end,
                    label: 'Rechazar',
                    enabled: !_busy,
                    onTap: () => _run(widget.onReject),
                  ),
                  _CallActionButton(
                    color: const Color(0xFF25D366),
                    icon: Icons.call,
                    label: 'Contestar',
                    enabled: !_busy,
                    onTap: () => _run(widget.onAccept),
                  ),
                ],
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _CallActionButton extends StatelessWidget {
  const _CallActionButton({
    required this.color,
    required this.icon,
    required this.label,
    required this.onTap,
    required this.enabled,
  });

  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: enabled ? color : color.withValues(alpha: 0.45),
          shape: const CircleBorder(),
          elevation: 0,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: enabled ? onTap : null,
            child: SizedBox(
              width: 72,
              height: 72,
              child: Icon(icon, color: Colors.white, size: 32),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.8),
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
