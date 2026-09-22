import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../channel_session.dart';
import '../panic_vibration.dart';
import '../peer_actions.dart';
import '../ptt_interaction_mode.dart';
import '../theme.dart';
import '../widgets/app_overflow_menu.dart';
import '../widgets/ptt_wave_bars.dart';
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
    this.onOverflowMenu,
    this.showLogout = false,
    this.locationMenuLabel = 'Ubicación GPS',
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
  final ValueChanged<String>? onOverflowMenu;
  final bool showLogout;
  final String locationMenuLabel;
  final ApiClient? api;

  String get _status {
    if (!session.connected) return 'SIN RED';
    if (!session.livekitReady) return 'AUDIO…';
    if (session.listenMuted) return 'SILENCIO';
    if (session.holding) return 'AL AIRE';
    if (session.speakerName != null) return 'OCUPADO';
    return 'LISTO';
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
    if (session.holding) {
      return session.openChannel
          ? 'Tú al aire en ${session.effectivePttGroupName}'
          : 'Tú estás al aire';
    }
    if (session.speakerName != null) {
      final g = session.lastHeardGroupName;
      if (session.openChannel && g != null && g.isNotEmpty) {
        return '$g — ${session.speakerName} habla';
      }
      return '${session.speakerName} habla';
    }
    return 'Canal libre';
  }

  @override
  Widget build(BuildContext context) {
    final n = groups.isEmpty ? 1 : groups.length;
    final idx = channelIndex.clamp(0, n - 1);
    final zoneName = groups.isEmpty
        ? session.groupName
        : (groups[idx]['name'] as String? ?? session.groupName);
    final linkLabel = !session.connected
        ? 'SIN RED'
        : (!session.livekitReady ? 'AUDIO…' : 'SEGURA');
    final linkOk = session.connected && session.livekitReady;
    final linkWarn = session.connected && !session.livekitReady;

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
                    Expanded(
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
                              child: InkWell(
                                onTap: onOpenProfile,
                                borderRadius: BorderRadius.circular(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      zoneName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TacticalFonts.body(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      displayName,
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
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: linkOk
                            ? kInstOlive.withValues(alpha: 0.1)
                            : (linkWarn
                                ? kInstGold.withValues(alpha: 0.12)
                                : kInstDanger.withValues(alpha: 0.1)),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: linkOk
                              ? kInstOlive.withValues(alpha: 0.25)
                              : (linkWarn
                                  ? kInstGold.withValues(alpha: 0.35)
                                  : kInstDanger.withValues(alpha: 0.3)),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            linkOk
                                ? Icons.verified_user_rounded
                                : (linkWarn
                                    ? Icons.sync_rounded
                                    : Icons.lock_open_rounded),
                            size: 16,
                            color: linkOk
                                ? kInstOlive
                                : (linkWarn ? kInstGold : kInstDanger),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            linkLabel,
                            style: TacticalFonts.label(
                              fontSize: 10,
                              color: linkOk
                                  ? kInstOlive
                                  : (linkWarn ? kInstGold : kInstDanger),
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (onOverflowMenu != null)
                      AppOverflowMenuButton(
                        iconColor: kInstOlive,
                        showLogout: showLogout,
                        showRadioMute: true,
                        radioMuted: session.listenMuted,
                        showGroupVideo: onOpenGroupVideo != null,
                        locationMenuLabel: locationMenuLabel,
                        onSelected: (v) {
                          if (v == 'channels') {
                            onOpenMenu();
                            return;
                          }
                          if (v == 'location') {
                            onOpenLocation?.call();
                            return;
                          }
                          if (v == 'group_video') {
                            onOpenGroupVideo?.call();
                            return;
                          }
                          onOverflowMenu!(v);
                        },
                      )
                    else
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert_rounded, color: kInstOlive),
                        tooltip: 'Menú',
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
            if (session.openChannel) ...[
              const SizedBox(height: 6),
              Text(
                'PTT → ${session.effectivePttGroupName}',
                style: TacticalFonts.label(
                  fontSize: 12,
                  letterSpacing: 0.4,
                  color: kInstOlive,
                ),
              ),
              if (session.hasFreshLastHeard &&
                  session.lastHeardGroupId != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: ActionChip(
                    avatar: const Icon(Icons.mic_rounded, size: 16),
                    label: Text(
                      'Último: ${session.lastHeardGroupName ?? 'Canal'}'
                      '${session.speakerName != null ? ' — ${session.speakerName}' : ''}',
                      style: TacticalFonts.label(fontSize: 11),
                    ),
                    onPressed: session.holding
                        ? null
                        : () {
                            final gid = session.lastHeardGroupId;
                            if (gid == null) return;
                            session.setTalkGroup(gid);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'PTT → ${session.effectivePttGroupName}',
                                ),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                  ),
                ),
            ],
            Expanded(
              child: Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _SideChip(label: zoneName, icon: Icons.layers_rounded),
                    const SizedBox(width: 12),
                    _PttZone(session: session, user: api?.user),
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
                  'Radio en silencio — no se oye el canal',
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
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: groups.length < 2
                        ? null
                        : () => onChannelChanged((idx - 1 + n) % n),
                    icon: const Icon(Icons.chevron_left_rounded, size: 30),
                    color: kInstInk,
                  ),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: n,
                        separatorBuilder: (_, _) => const SizedBox(width: 6),
                        itemBuilder: (context, i) {
                          final selected = i == idx;
                          final name = groups.isEmpty
                              ? '${i + 1}'
                              : (groups[i]['name'] as String? ?? '${i + 1}');
                          // No seleccionados: número claro; seleccionado: nombre (acotado).
                          final label = selected
                              ? (name.length > 14
                                  ? '${name.substring(0, 13)}…'
                                  : name)
                              : (name.length <= 3 ? name : '${i + 1}');
                          return Material(
                            color: Colors.transparent,
                            child: InkWell(
                              customBorder: selected
                                  ? RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(18),
                                    )
                                  : const CircleBorder(),
                              onTap: () {
                                if (i == idx) return;
                                HapticFeedback.selectionClick();
                                onChannelChanged(i);
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 160),
                                padding: selected
                                    ? const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      )
                                    : EdgeInsets.zero,
                                width: selected ? null : 34,
                                height: selected ? 36 : 34,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: selected
                                      ? BorderRadius.circular(18)
                                      : null,
                                  shape: selected
                                      ? BoxShape.rectangle
                                      : BoxShape.circle,
                                  color: selected ? kInstOlive : kInstPanel2,
                                  border: Border.all(
                                    color: selected ? kInstGold : kInstBorder,
                                    width: selected ? 2.5 : 1,
                                  ),
                                  boxShadow: selected
                                      ? [
                                          BoxShadow(
                                            color: kInstOlive.withValues(
                                              alpha: 0.35,
                                            ),
                                            blurRadius: 8,
                                            offset: const Offset(0, 2),
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Text(
                                  label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TacticalFonts.label(
                                    fontSize: selected ? 11 : 12,
                                    fontWeight: FontWeight.w800,
                                    color: selected
                                        ? kInstOnPrimary
                                        : kInstInk,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
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

/// Zona PTT: selector Mantén | Toque + botón circular.
class _PttZone extends StatefulWidget {
  const _PttZone({required this.session, this.user});

  final ChannelSession session;
  final Map<String, dynamic>? user;

  @override
  State<_PttZone> createState() => _PttZoneState();
}

class _PttZoneState extends State<_PttZone> {
  PttInteractionMode _mode = PttInteractionMode.hold;
  bool _readyMode = false;
  /// Evita que el load async de prefs pise una elección ya hecha (salto Corta→Larga).
  bool _userPicked = false;

  @override
  void initState() {
    super.initState();
    _mode = defaultPttModeForUser(widget.user);
    loadPttInteractionMode(widget.user).then((m) {
      if (!mounted || _userPicked) return;
      setState(() {
        _mode = m;
        _readyMode = true;
      });
    });
  }

  @override
  void didUpdateWidget(covariant _PttZone oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user != widget.user && !_readyMode && !_userPicked) {
      _mode = defaultPttModeForUser(widget.user);
    }
  }

  Future<void> _setMode(PttInteractionMode next) async {
    if (next == _mode) return;
    _userPicked = true;
    // Al pasar a Corta (hold) con mic abierto, soltar para no quedar trabado.
    if (next == PttInteractionMode.hold && widget.session.holding) {
      await widget.session.releasePtt();
    }
    setState(() => _mode = next);
    await savePttInteractionMode(next);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Pulsación',
          style: TacticalFonts.label(
            fontSize: 11,
            letterSpacing: 1.6,
            color: kInstGoldSoft.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 6),
        _PttModeSegment(
          mode: _mode,
          enabled: !widget.session.holding,
          onChanged: _setMode,
        ),
        const SizedBox(height: 10),
        _PttPad(
          session: widget.session,
          latchMode: _mode.isLatch,
        ),
      ],
    );
  }
}

class _PttModeSegment extends StatelessWidget {
  const _PttModeSegment({
    required this.mode,
    required this.onChanged,
    this.enabled = true,
  });

  final PttInteractionMode mode;
  final ValueChanged<PttInteractionMode> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    // Consola radio es cromo oscuro institucional; no usar surface claro del Theme.
    final track = const Color(0xFF152018);
    final border = kInstGold.withValues(alpha: 0.45);
    final selectedBg = kInstOlive;
    final selectedFg = kInstOnPrimary;
    final idleFg = kInstGoldSoft;

    return Semantics(
      label: 'Pulsación: ${mode.label}',
      child: Opacity(
        opacity: enabled ? 1 : 0.55,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: track,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _segBtn(
                label: 'Corta',
                selected: mode == PttInteractionMode.hold,
                selectedBg: selectedBg,
                selectedFg: selectedFg,
                idleFg: idleFg,
                onTap: enabled
                    ? () => onChanged(PttInteractionMode.hold)
                    : null,
              ),
              _segBtn(
                label: 'Larga',
                selected: mode == PttInteractionMode.latch,
                selectedBg: selectedBg,
                selectedFg: selectedFg,
                idleFg: idleFg,
                onTap: enabled
                    ? () => onChanged(PttInteractionMode.latch)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _segBtn({
    required String label,
    required bool selected,
    required Color selectedBg,
    required Color selectedFg,
    required Color idleFg,
    VoidCallback? onTap,
  }) {
    return Material(
      color: selected ? selectedBg : Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(
            label,
            style: TacticalFonts.label(
              fontSize: 12,
              color: selected ? selectedFg : idleFg,
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón PTT circular — latch (Larga) o hold-to-talk (Corta).
class _PttPad extends StatelessWidget {
  const _PttPad({required this.session, required this.latchMode});

  final ChannelSession session;
  final bool latchMode;

  @override
  Widget build(BuildContext context) {
    final holding = session.holding;
    final ready = session.connected && session.livekitReady;
    final hint = !ready
        ? '…'
        : (latchMode
            ? (holding ? 'TOCAR · SOLTAR' : 'TOCAR')
            : (holding ? 'SUELTA' : 'MANTÉN'));

    final pad = AnimatedContainer(
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
              PttWaveBars(
                active: holding,
                color: holding ? kInstGoldSoft : kInstOnPrimary,
                height: 28,
                width: 36,
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
                hint,
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
    );

    return Semantics(
      button: true,
      enabled: ready,
      label: latchMode
          ? (holding
              ? 'Al aire, toca para dejar de transmitir'
              : 'PTT, toca para hablar')
          : (holding
              ? 'Al aire, suelta para dejar de transmitir'
              : 'PTT, mantén pulsado para hablar'),
      child: latchMode
          ? GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: ready
                  ? () {
                      HapticFeedback.selectionClick();
                      session.togglePtt();
                    }
                  : null,
              child: pad,
            )
          // Corta (hold): Listener — más fiable que onTapDown/Up (gesture arena).
          : Listener(
              behavior: HitTestBehavior.opaque,
              onPointerDown: ready
                  ? (_) {
                      HapticFeedback.selectionClick();
                      session.pressPtt();
                    }
                  : null,
              onPointerUp: ready
                  ? (_) {
                      session.releasePtt();
                    }
                  : null,
              onPointerCancel: ready
                  ? (_) {
                      session.releasePtt();
                    }
                  : null,
              child: pad,
            ),
    );
  }
}

class _PanicButton extends StatelessWidget {
  const _PanicButton({required this.onTap, this.busy = false});

  final VoidCallback onTap;
  final bool busy;

  /// Rojo puro pedido para Alerta (no el burgundy institucional).
  static const Color _alertaRed = Color(0xFFFF0000);

  /// Mismo diámetro que Silenciar.
  static const double _size = 70;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !busy,
      label: 'Alerta, un toque envía la alerta',
      child: Material(
        // Círculo #FF0000; icono amarillo + texto blanco.
        color: _alertaRed,
        shape: const CircleBorder(),
        elevation: 2,
        shadowColor: _alertaRed.withValues(alpha: 0.45),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: busy
              ? null
              : () {
                  unawaited(PanicVibration.confirmSend());
                  onTap();
                },
          child: SizedBox(
            width: _size,
            height: _size,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 28,
                  height: 28,
                  child: busy
                      ? const Icon(
                          Icons.hourglass_top_rounded,
                          color: Color(0xFFFFEB3B),
                          size: 22,
                        )
                      : const _PanicWaveIcon(),
                ),
                const SizedBox(height: 2),
                Text(
                  busy ? '…' : 'Alerta',
                  style: TacticalFonts.label(
                    fontSize: 9,
                    letterSpacing: 0.3,
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

class _PanicWaveIcon extends StatefulWidget {
  const _PanicWaveIcon();

  @override
  State<_PanicWaveIcon> createState() => _PanicWaveIconState();
}

class _PanicWaveIconState extends State<_PanicWaveIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1900))
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return CustomPaint(
          painter: _PanicWavePainter(progress: _ctrl.value),
          child: const Center(
            child: Icon(
              Icons.warning_amber_rounded,
              size: 18,
              color: Color(0xFFFFEB3B),
              shadows: [
                Shadow(color: Color(0x66000000), blurRadius: 2, offset: Offset(0, 1)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PanicWavePainter extends CustomPainter {
  _PanicWavePainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    for (var i = 0; i < 3; i++) {
      final t = (progress + i / 3) % 1.0;
      final scale = 0.35 + t * 1.8;
      final opacity = (1.0 - t).clamp(0.0, 1.0);
      // Ondas doradas sobre el círculo rojo sólido.
      final color = Color.lerp(
        const Color(0xFFFFF59D),
        const Color(0xFFFFEB3B),
        t,
      )!;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..color = color.withValues(alpha: opacity * 0.9);
      canvas.drawCircle(center, 6 * scale, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _PanicWavePainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class _ListenMuteButton extends StatelessWidget {
  const _ListenMuteButton({required this.muted, required this.onTap});

  final bool muted;
  final VoidCallback onTap;

  static const double _size = 70;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: muted ? 'Activar audio del radio' : 'Silenciar radio, no oír a otros',
      child: Material(
        color: muted ? kRadioDanger.withValues(alpha: 0.12) : kInstSurface,
        shape: CircleBorder(
          side: BorderSide(
            color: muted ? kRadioDanger.withValues(alpha: 0.35) : kInstBorder,
          ),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: _size,
            height: _size,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                  size: 24,
                  color: muted ? kRadioDanger : kInstOlive,
                ),
                const SizedBox(height: 2),
                Text(
                  muted ? 'Audio off' : 'Silenciar',
                  textAlign: TextAlign.center,
                  style: TacticalFonts.label(
                    fontSize: 9,
                    letterSpacing: 0.3,
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
