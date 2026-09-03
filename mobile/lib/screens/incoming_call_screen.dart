import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../theme.dart';
import '../ringer_mode.dart';
import '../widgets/user_avatar.dart';

/// Pantalla de llamada entrante — colores institucionales (oliva / oro).
class IncomingCallScreen extends StatefulWidget {
  const IncomingCallScreen({
    super.key,
    required this.callerName,
    required this.onAccept,
    required this.onReject,
    this.mode = 'call',
    this.api,
    this.callerId,
  });

  final String callerName;
  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;
  /// `call` | `video` | `radio` | `group_video`
  final String mode;
  final ApiClient? api;
  final String? callerId;

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
    final ringer = await readPhoneRingerMode();
    if (!shouldVibrateForIncomingCall(ringer)) return;
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

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _avatarFace({required double radius}) {
    final api = widget.api;
    final id = widget.callerId;
    if (api != null && id != null && id.isNotEmpty) {
      return UserAvatar(
        name: widget.callerName,
        userId: id,
        avatarUrl: api.peerAvatarNetworkUrl(id),
        headers: api.avatarAuthHeaders(),
        radius: radius,
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: kInstOlive,
      child: Text(
        userAvatarInitials(widget.callerName),
        style: TextStyle(
          color: kInstOnPrimary,
          fontSize: radius * 0.72,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isRadio = widget.mode == 'radio';
    final isVideo = widget.mode == 'video';
    final isGroupVideo = widget.mode == 'group_video';
    final modeLabel =
        isGroupVideo ? 'TRANSMISIÓN' : isRadio ? 'RADIO' : isVideo ? 'VIDEO' : 'VOZ';
    final modeIcon = isGroupVideo
        ? Icons.groups
        : isRadio
            ? Icons.podcasts
            : isVideo
                ? Icons.videocam
                : Icons.call;
    return Material(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1A2218), Color(0xFF0D100C), Color(0xFF050605)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              children: [
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: kInstOlive.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kInstGold.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(modeIcon, size: 16, color: kInstGoldSoft),
                      const SizedBox(width: 8),
                      Text(
                        modeLabel,
                        style: TextStyle(
                          color: kInstGoldSoft.withValues(alpha: 0.95),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  isGroupVideo
                      ? 'Transmisión grupal en vivo'
                      : isRadio
                          ? 'Radio personal entrante'
                          : isVideo
                              ? 'Videollamada entrante'
                              : 'Llamada de voz entrante',
                  style: TextStyle(
                    color: kInstGoldSoft.withValues(alpha: 0.9),
                    fontSize: 15,
                    letterSpacing: 0.2,
                    fontWeight: FontWeight.w600,
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
                                    color: kInstGold,
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
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: kInstOlive.withValues(alpha: 0.45),
                        blurRadius: 12,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _avatarFace(radius: 59),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                widget.callerName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: kInstOnPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _busy
                    ? 'Conectando…'
                    : (isRadio
                        ? 'Invitación a radio 1:1'
                        : isVideo
                            ? 'Te llama con video…'
                            : 'Te está llamando…'),
                style: TextStyle(
                  color: kInstOnPrimary.withValues(alpha: 0.55),
                  fontSize: 16,
                ),
              ),
              const Spacer(flex: 3),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _ActionCircle(
                    color: kInstDanger,
                    icon: Icons.call_end,
                    label: 'Rechazar',
                    enabled: !_busy,
                    onTap: () => _run(widget.onReject),
                  ),
                  _ActionCircle(
                    color: kInstOlive,
                    icon: isRadio ? Icons.podcasts : (isVideo ? Icons.videocam : Icons.call),
                    label: isRadio ? 'Unirse' : 'Contestar',
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
      ),
    );
  }
}

class _ActionCircle extends StatelessWidget {
  const _ActionCircle({
    required this.color,
    required this.icon,
    required this.label,
    required this.onTap,
    this.enabled = true,
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
          color: enabled ? color : color.withValues(alpha: 0.4),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: enabled ? onTap : null,
            child: SizedBox(
              width: 72,
              height: 72,
              child: Icon(icon, color: kInstOnPrimary, size: 32),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          style: TextStyle(
            color: kInstOnPrimary.withValues(alpha: 0.85),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
