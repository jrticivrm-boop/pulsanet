import 'package:flutter/material.dart';

import '../channel_session.dart';
import '../theme.dart';

/// Consola PTT estilo walkie (READY + mic anillo + canales).
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
    this.onOpenProfile,
  });

  final ChannelSession session;
  final String displayName;
  final List<Map<String, dynamic>> groups;
  final int channelIndex;
  final ValueChanged<int> onChannelChanged;
  final VoidCallback onOpenMenu;
  final VoidCallback onPanic;
  final VoidCallback? onOpenProfile;

  String get _status {
    if (!session.connected) return 'SIN RED';
    if (!session.livekitReady) return 'AUDIO…';
    if (session.holding) return 'AL AIRE';
    if (session.speakerName != null) return 'OCUPADO';
    return 'READY';
  }

  Color get _statusColor {
    if (!session.connected) return kRadioDanger;
    if (session.holding) return kInstOlive;
    if (session.speakerName != null) return kInstGold;
    return kInstOliveMid;
  }

  String get _speakerHint {
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

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
            child: Row(
              children: [
                IconButton(
                  onPressed: onOpenMenu,
                  icon: const Icon(Icons.menu_rounded),
                  color: kRadioInk,
                ),
                const Spacer(),
                Icon(
                  session.connected && session.livekitReady
                      ? Icons.verified_user_outlined
                      : Icons.lock_open_outlined,
                  size: 20,
                  color: session.connected && session.livekitReady
                      ? kInstOlive
                      : kRadioDanger,
                ),
                const Spacer(),
                IconButton(
                  onPressed: onOpenProfile,
                  icon: CircleAvatar(
                    radius: 16,
                    backgroundColor: kRadioSurface,
                    child: Text(
                      displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                      style: const TextStyle(
                        color: kRadioBlue,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.person_outline, size: 18, color: kRadioMuted),
              const SizedBox(width: 6),
              Text(
                displayName,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: kRadioInk,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _status,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
              color: _statusColor,
            ),
          ),
          Text(
            _speakerHint,
            style: const TextStyle(fontSize: 13, color: kRadioMuted),
          ),
          Expanded(
            child: Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _SideChip(
                        label: zoneName,
                        icon: Icons.layers_outlined,
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTapDown: (_) => session.pressPtt(),
                    onTapUp: (_) => session.releasePtt(),
                    onTapCancel: () => session.releasePtt(),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 120),
                      width: 168,
                      height: 168,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: kInstSurface,
                        border: Border.all(
                          color: session.holding ? kInstOlive : kInstOliveMid,
                          width: 8,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kInstOlive.withValues(alpha: session.holding ? 0.28 : 0.1),
                            blurRadius: session.holding ? 22 : 10,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Container(
                          width: 88,
                          height: 88,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: session.holding ? kInstOlive : Colors.white,
                            border: Border.all(color: kInstOlive, width: 2),
                          ),
                          child: Icon(
                            Icons.mic,
                            size: 42,
                            color: session.holding ? Colors.white : kInstOlive,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _RoundIcon(
                        icon: Icons.emergency,
                        color: kRadioDanger,
                        onTap: onPanic,
                      ),
                      const SizedBox(height: 12),
                      _RoundIcon(
                        icon: Icons.volume_up_outlined,
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Audio del canal activo'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      _RoundIcon(
                        icon: Icons.headset_mic_outlined,
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                session.livekitReady ? 'LiveKit listo' : 'Conectando audio…',
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
          if (session.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                session.error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: kRadioDanger, fontWeight: FontWeight.w600, fontSize: 12),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: groups.length < 2
                      ? null
                      : () => onChannelChanged((idx - 1 + n) % n),
                  icon: const Icon(Icons.chevron_left, size: 32),
                  color: kRadioInk,
                ),
                ...List.generate(
                  n.clamp(1, 8),
                  (i) {
                    final selected = i == idx;
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Text(
                        '${i + 1}',
                        style: TextStyle(
                          fontSize: selected ? 28 : 18,
                          fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                          color: selected ? kRadioInk : kRadioMuted,
                        ),
                      ),
                    );
                  },
                ),
                IconButton(
                  onPressed: groups.length < 2
                      ? null
                      : () => onChannelChanged((idx + 1) % n),
                  icon: const Icon(Icons.chevron_right, size: 32),
                  color: kRadioInk,
                ),
              ],
            ),
          ),
          if (session.online.isNotEmpty)
            SizedBox(
              height: 28,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: session.online
                    .take(12)
                    .map(
                      (m) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Chip(
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          labelPadding: const EdgeInsets.symmetric(horizontal: 6),
                          avatar: const Icon(Icons.circle, size: 8, color: kRadioBlue),
                          label: Text(m.displayName, style: const TextStyle(fontSize: 11)),
                          backgroundColor: kRadioSurface,
                          side: BorderSide.none,
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          const SizedBox(height: 8),
        ],
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
      constraints: const BoxConstraints(maxWidth: 88),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF3A3F4B),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white70),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.onTap, this.color});
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kRadioSurface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20, color: color ?? kRadioInk),
        ),
      ),
    );
  }
}
