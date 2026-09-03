import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../channel_session.dart';
import '../panic_vibration.dart';
import '../peer_actions.dart';
import '../theme.dart';
import '../widgets/user_avatar.dart';

/// Consola PTT institucional (estado + mic circular + pánico).
class RadioScreen extends StatelessWidget {
  const RadioScreen({
    super.key,
    required this.session,
    required this.displayName,
    required this.groups,
    required this.channelIndex,
    required this.onChannelChanged,
    required this.onOpenMenu,
    required this.onPanic,
    this.onOpenLocation,
    this.onOpenProfile,
    this.onOpenGroupVideo,
    this.avatarUrl,
    this.avatarHeaders,
    this.api,
  });

  final ChannelSession session;
  final String displayName;
  final String? avatarUrl;
  final Map<String, String>? avatarHeaders;
  final List<Map<String, dynamic>> groups;
  final int channelIndex;
  final ValueChanged<int> onChannelChanged;
  final VoidCallback onOpenMenu;
  final VoidCallback onPanic;
  final VoidCallback? onOpenLocation;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onOpenGroupVideo;
  final ApiClient? api;

  String get _status {
    if (!session.connected) return 'SIN RED';
    if (!session.livekitReady) return 'AUDIO…';
    if (session.listenMuted) return 'MUTE';
    if (session.holding) return 'AL AIRE';
    if (session.speakerName != null) return 'OCUPADO';
    return 'READY';
  }

  Color get _statusColor {
    if (!session.connected) return kRadioDanger;
    if (session.listenMuted) return kRadioMuted;
    if (session.holding) return kInstOk;
    if (session.speakerName != null) return kInstGold;
    return kInstOliveMid;
  }

  String get _speakerHint {
    if (session.listenMuted) return 'Radio silenciada — toca Silenciar otra vez';
    if (session.holding) return 'Tú estás al aire';
    if (session.speakerName != null) return '${session.speakerName} habla';
    return 'Canal libre';
  }

  @override
  Widget build(BuildContext context) {
    final n = groups.isEmpty ? 1 : groups.length;
    final idx = channelIndex.clamp(0, n - 1);
    final zoneName = groups.isEmpty
        ? session.groupName
        : (groups[idx]['name'] as String? ?? session.groupName);
    final secure = session.connected && session.livekitReady;

    return ColoredBox(
      color: kInstPaper,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 6, 8, 6),
                decoration: BoxDecoration(
                  color: kInstSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kInstBorder),
                  boxShadow: [
                    BoxShadow(
                      color: kInstInk.withValues(alpha: 0.04),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.menu_rounded, color: kInstOlive),
                      tooltip: 'Más opciones',
                      onSelected: (v) async {
                        if (v == 'channels') onOpenMenu();
                        if (v == 'location') onOpenLocation?.call();
                        if (v == 'video') onOpenGroupVideo?.call();
                        if (v == 'mute') {
                          final next = !session.listenMuted;
                          await session.setListenMuted(next);
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                next
                                    ? 'Radio silenciada — no oyes a nadie'
                                    : 'Radio activa — oyes el canal',
                              ),
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(
                          value: 'channels',
                          child: ListTile(
                            leading: Icon(Icons.layers_outlined),
                            title: Text('Canales'),
                            contentPadding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        if (onOpenGroupVideo != null)
                          const PopupMenuItem(
                            value: 'video',
                            child: ListTile(
                              leading: Icon(Icons.videocam_outlined),
                              title: Text('Video en vivo'),
                              subtitle: Text('Transmisión grupal con cámara'),
                              contentPadding: EdgeInsets.zero,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        PopupMenuItem(
                          value: 'mute',
                          child: ListTile(
                            leading: Icon(
                              session.listenMuted
                                  ? Icons.volume_off_rounded
                                  : Icons.volume_up_rounded,
                            ),
                            title: Text(
                              session.listenMuted
                                  ? 'Activar audio radio'
                                  : 'Silenciar radio',
                            ),
                            contentPadding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'location',
                          child: ListTile(
                            leading: Icon(Icons.location_on_outlined),
                            title: Text('Ubicación GPS'),
                            contentPadding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ],
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: onOpenProfile,
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 4,
                          ),
                          child: Row(
                            children: [
                              UserAvatar(
                                name: displayName,
                                avatarUrl: avatarUrl,
                                headers:
                                    avatarHeaders ?? api?.avatarAuthHeaders(),
                                radius: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      displayName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TacticalFonts.body(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      zoneName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TacticalFonts.label(
                                        fontSize: 10,
                                        color: kInstMuted,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: secure
                            ? kInstOlive.withValues(alpha: 0.1)
                            : kInstDanger.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: secure
                              ? kInstOlive.withValues(alpha: 0.25)
                              : kInstDanger.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            secure
                                ? Icons.verified_user_rounded
                                : Icons.lock_open_rounded,
                            size: 16,
                            color: secure ? kInstOlive : kInstDanger,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            secure ? 'SEGURA' : 'SIN RED',
                            style: TacticalFonts.label(
                              fontSize: 10,
                              color: secure ? kInstOlive : kInstDanger,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _status,
              style: TacticalFonts.display(
                fontSize: 34,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.4,
                color: _statusColor,
                height: 1.0,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _speakerHint,
              style: TacticalFonts.body(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: kInstMuted,
              ),
            ),
            Expanded(
              child: Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _SideChip(label: zoneName, icon: Icons.layers_rounded),
                    const SizedBox(width: 12),
                    _PttPad(session: session),
                    const SizedBox(width: 12),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _PanicButton(
                          busy: session.panicSending,
                          onTap: onPanic,
                        ),
                        const SizedBox(height: 14),
                        _ListenMuteButton(
                          muted: session.listenMuted,
                          onTap: () async {
                            final next = !session.listenMuted;
                            await session.setListenMuted(next);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  next
                                      ? 'Radio silenciada — no oyes a nadie'
                                      : 'Radio activa — oyes el canal',
                                ),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (session.listenMuted)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  'Radio en mute — no se oye el canal',
                  style: TacticalFonts.body(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: kRadioDanger.withValues(alpha: 0.95),
                  ),
                ),
              ),
            if (session.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  session.error!,
                  textAlign: TextAlign.center,
                  style: TacticalFonts.body(
                    color: kRadioDanger,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: groups.length < 2
                        ? null
                        : () => onChannelChanged((idx - 1 + n) % n),
                    icon: const Icon(Icons.chevron_left_rounded, size: 30),
                    color: kInstInk,
                  ),
                  ...List.generate(n.clamp(1, 8), (i) {
                    final selected = i == idx;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: selected ? 28 : 22,
                      height: selected ? 28 : 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: selected
                            ? kInstOlive
                            : kInstPanel2,
                        border: Border.all(
                          color: selected ? kInstGold : kInstBorder,
                          width: selected ? 1.5 : 1,
                        ),
                      ),
                      child: Text(
                        '${i + 1}',
                        style: TacticalFonts.display(
                          fontSize: selected ? 14 : 11,
                          fontWeight: FontWeight.w600,
                          color: selected ? kInstOnPrimary : kInstMuted,
                          letterSpacing: 0,
                        ),
                      ),
                    );
                  }),
                  IconButton(
                    onPressed: groups.length < 2
                        ? null
                        : () => onChannelChanged((idx + 1) % n),
                    icon: const Icon(Icons.chevron_right_rounded, size: 30),
                    color: kInstInk,
                  ),
                ],
              ),
            ),
            if (session.online.isNotEmpty)
              SizedBox(
                height: 34,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: session.online
                      .take(12)
                      .map(
                        (m) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: api == null
                                ? null
                                : () => showChannelPeerActions(
                                      context: context,
                                      api: api!,
                                      peerId: m.userId,
                                      displayName: m.displayName,
                                      myUserId: api!.user?['id']?.toString(),
                                    ),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: kInstSurface,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: kInstBorder),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.circle,
                                    size: 8,
                                    color: _presenceDotColor(m),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    m.displayName,
                                    style: TacticalFonts.body(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}

Color _presenceDotColor(PresenceMember m) {
  switch (m.status) {
    case PresenceStatus.away:
      return const Color(0xFFEAB308);
    case PresenceStatus.offline:
      return const Color(0xFFEF4444);
    case PresenceStatus.active:
      return const Color(0xFF22C55E);
  }
}

/// Botón PTT circular — un toque abre el canal, otro lo libera.
class _PttPad extends StatelessWidget {
  const _PttPad({required this.session});

  final ChannelSession session;

  @override
  Widget build(BuildContext context) {
    final holding = session.holding;
    final ready = session.connected && session.livekitReady;

    return Semantics(
      button: true,
      enabled: ready,
      label: holding
          ? 'Al aire, toca para dejar de transmitir'
          : 'PTT, toca para hablar',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: ready
            ? () {
                HapticFeedback.mediumImpact();
                session.togglePtt();
              }
            : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          width: 172,
          height: 172,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: holding
                  ? const [Color(0xFF3F6B36), kInstOlive, kInstOliveDeep]
                  : const [kInstOliveMid, kInstOlive, kInstOliveDeep],
            ),
            border: Border.all(
              color: holding ? kInstGoldSoft : kInstGold,
              width: holding ? 3.5 : 2.5,
            ),
            boxShadow: [
              BoxShadow(
                color: (holding ? kInstOk : kInstOlive).withValues(
                  alpha: holding ? 0.35 : 0.22,
                ),
                blurRadius: holding ? 22 : 14,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 118,
              height: 118,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: holding ? const Color(0xFF152018) : const Color(0xFF1A2A16),
                border: Border.all(
                  color: kInstGoldSoft.withValues(alpha: holding ? 0.9 : 0.45),
                  width: 1.5,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    holding ? Icons.graphic_eq_rounded : Icons.mic_rounded,
                    size: 36,
                    color: holding ? kInstGoldSoft : kInstOnPrimary,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    holding ? 'AL AIRE' : 'PTT',
                    style: TacticalFonts.display(
                      fontSize: holding ? 15 : 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: holding ? 1.4 : 2.2,
                      color: holding ? kInstGoldSoft : kInstOnPrimary,
                      height: 1.05,
                    ),
                  ),
                  Text(
                    !ready ? '…' : (holding ? 'TOCAR · SOLTAR' : 'TOCAR'),
                    style: TacticalFonts.label(
                      fontSize: 9,
                      letterSpacing: 1.0,
                      color: kInstOnPrimary.withValues(alpha: 0.72),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PanicButton extends StatelessWidget {
  const _PanicButton({required this.onTap, this.busy = false});

  final VoidCallback onTap;
  final bool busy;

  static const Color _urgent = Color(0xFFB71C1C);
  static const Color _urgentDeep = Color(0xFF7F0000);

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !busy,
      label: 'Alerta de pánico, un toque envía la alerta',
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        elevation: 0,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: busy
              ? null
              : () {
                  unawaited(PanicVibration.confirmSend());
                  onTap();
                },
          child: Ink(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFD32F2F), _urgent, _urgentDeep],
              ),
              border: Border.all(color: const Color(0xFFFFCDD2), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: _urgent.withValues(alpha: 0.35),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  busy ? Icons.hourglass_top_rounded : Icons.warning_rounded,
                  color: Colors.white,
                  size: 24,
                ),
                const SizedBox(height: 2),
                Text(
                  busy ? '…' : 'PÁNICO',
                  style: TacticalFonts.display(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SideChip extends StatelessWidget {
  const _SideChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 86),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(
        color: kInstSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kInstBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: kInstGold),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TacticalFonts.body(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: kInstOlive,
              height: 1.15,
            ),
          ),
        ],
      ),
    );
  }
}

class _ListenMuteButton extends StatelessWidget {
  const _ListenMuteButton({required this.muted, required this.onTap});

  final bool muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: muted ? 'Activar audio del radio' : 'Silenciar radio, no oír a otros',
      child: Material(
        color: muted ? kRadioDanger.withValues(alpha: 0.1) : kInstSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: muted ? kRadioDanger.withValues(alpha: 0.35) : kInstBorder,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                  size: 24,
                  color: muted ? kRadioDanger : kInstOlive,
                ),
                const SizedBox(height: 3),
                Text(
                  muted ? 'MUTE' : 'Silenciar',
                  style: TacticalFonts.label(
                    fontSize: 10,
                    letterSpacing: 0.6,
                    color: muted ? kRadioDanger : kInstOlive,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
