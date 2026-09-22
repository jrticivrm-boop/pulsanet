import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../call_ringtone.dart';
import '../theme.dart';
import '../ringer_mode.dart';
import '../widgets/user_avatar.dart';

/// Pantalla de llamada/videollamada entrante — estilo WhatsApp (grande e interactiva).
class IncomingCallScreen extends StatefulWidget {
  const IncomingCallScreen({
    super.key,
    required this.callerName,
    required this.onAccept,
    required this.onReject,
    this.mode = 'call',
    this.intent,
    this.api,
    this.callerId,
  });

  final String callerName;
  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;
  /// `call` | `video` | `radio` | `group_video`
  final String mode;
  /// `remote_camera` = despacho solicita ver la cámara del dispositivo
  final String? intent;
  final ApiClient? api;
  final String? callerId;

  @override
  State<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends State<IncomingCallScreen>
    with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _glow;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _glow = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    // ignore: unawaited_futures
    CallRingtone.start(
      kind: (widget.mode == 'video' || widget.mode == 'group_video')
          ? CallRingKind.video
          : CallRingKind.voice,
    );
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
    _glow.dispose();
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
        previewOnTap: false,
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
    final accent = isVideo || isGroupVideo ? const Color(0xFF2E7D32) : kInstGold;
    final title = isGroupVideo
        ? 'Videollamada de grupo'
        : isRadio
            ? 'Radio personal'
            : isVideo
                ? 'Videollamada entrante'
                : 'Llamada entrante';
    final hint = _busy
        ? 'Conectando…'
        : isVideo || isGroupVideo
            ? 'Videollamada — Contestar abre cámara y audio'
            : 'Llamada de voz — Contestar o Rechazar';

    return Material(
      child: AnimatedBuilder(
        animation: _glow,
        builder: (context, _) {
          final g = 0.35 + (_glow.value * 0.35);
          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isVideo || isGroupVideo
                    ? [
                        Color.lerp(const Color(0xFF0A1F12), accent, g * 0.25)!,
                        const Color(0xFF061008),
                        const Color(0xFF020403),
                      ]
                    : [
                        const Color(0xFF1A2218),
                        const Color(0xFF0D100C),
                        const Color(0xFF050605),
                      ],
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: accent.withValues(alpha: 0.45)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isGroupVideo
                                ? Icons.groups_rounded
                                : isVideo
                                    ? Icons.videocam_rounded
                                    : isRadio
                                        ? Icons.podcasts
                                        : Icons.call_rounded,
                            size: 18,
                            color: accent,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            title.toUpperCase(),
                            style: TacticalFonts.label(
                              fontSize: 12,
                              color: accent,
                              letterSpacing: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(flex: 2),
                    AnimatedBuilder(
                      animation: _pulse,
                      builder: (context, child) {
                        final t = _pulse.value;
                        return SizedBox(
                          width: 240,
                          height: 240,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              for (final delay in [0.0, 0.33, 0.66])
                                Transform.scale(
                                  scale: 0.78 + ((t + delay) % 1.0) * 0.62,
                                  child: Opacity(
                                    opacity: (1 - ((t + delay) % 1.0)) * 0.45,
                                    child: Container(
                                      width: 180,
                                      height: 180,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: accent,
                                          width: isVideo ? 3 : 2,
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
                        width: 132,
                        height: 132,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.55),
                              blurRadius: 22,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: _avatarFace(radius: 66),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      widget.callerName,
                      textAlign: TextAlign.center,
                      style: TacticalFonts.display(
                        color: kInstOnPrimary,
                        fontSize: 30,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      hint,
                      textAlign: TextAlign.center,
                      style: TacticalFonts.body(
                        color: kInstOnPrimary.withValues(alpha: 0.7),
                        fontSize: 16,
                      ),
                    ),
                    const Spacer(flex: 3),
                    if (isVideo || isGroupVideo)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 18),
                        child: Text(
                          'Al contestar se pedirá permiso de cámara',
                          style: TacticalFonts.body(
                            fontSize: 13,
                            color: kInstOnPrimary.withValues(alpha: 0.55),
                          ),
                        ),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: _BigCallAction(
                            color: const Color(0xFFE53935),
                            icon: Icons.call_end_rounded,
                            label: 'Rechazar',
                            enabled: !_busy,
                            onTap: () => _run(widget.onReject),
                          ),
                        ),
                        const SizedBox(width: 22),
                        Expanded(
                          child: _BigCallAction(
                            color: const Color(0xFF43A047),
                            icon: isVideo || isGroupVideo
                                ? Icons.videocam_rounded
                                : isRadio
                                    ? Icons.podcasts
                                    : Icons.call_rounded,
                            label: isRadio
                                ? 'Unirse'
                                : (isVideo || isGroupVideo)
                                    ? 'Contestar video'
                                    : 'Contestar',
                            enabled: !_busy,
                            glow: true,
                            onTap: () => _run(widget.onAccept),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'También Contestar / Rechazar desde la notificación',
                      textAlign: TextAlign.center,
                      style: TacticalFonts.body(
                        fontSize: 12,
                        color: kInstOnPrimary.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BigCallAction extends StatelessWidget {
  const _BigCallAction({
    required this.color,
    required this.icon,
    required this.label,
    required this.onTap,
    this.enabled = true,
    this.glow = false,
  });

  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool enabled;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: enabled ? color : color.withValues(alpha: 0.4),
          shape: const CircleBorder(),
          elevation: glow ? 10 : 4,
          shadowColor: glow ? color.withValues(alpha: 0.7) : Colors.black54,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: enabled ? onTap : null,
            child: SizedBox(
              width: 96,
              height: 96,
              child: Icon(icon, color: kInstOnPrimary, size: 40),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: TacticalFonts.body(
            color: kInstOnPrimary.withValues(alpha: 0.9),
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ],
    );
  }
}
