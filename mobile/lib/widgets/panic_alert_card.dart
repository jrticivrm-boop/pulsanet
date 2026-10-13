import 'dart:async';

import 'package:flutter/material.dart';

import 'user_avatar.dart';

const Color _kRed = Color(0xFFE53935);
const Color _kRedDeep = Color(0xFFB71C1C);
const Color _kInk = Color(0xFF2B1A1A);
const Color _kMuted = Color(0xFF6D5A5A);

const Map<String, IconData> kPanicReasonIcons = {
  'Emergencia': Icons.emergency_rounded,
  'Apoyo': Icons.groups_rounded,
  'Médica': Icons.medical_services_rounded,
  'Agresión': Icons.gpp_maybe_rounded,
};

/// Acción de la tarjeta (Ver ubicación, Llamar, …). `onTap == null` = deshabilitada.
class PanicAlertAction {
  const PanicAlertAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlight = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool highlight;
}

/// Alerta entrante a pantalla completa: quién, motivo, ubicación, acciones y Enterado.
class PanicAlertCard extends StatefulWidget {
  const PanicAlertCard({
    super.key,
    required this.name,
    required this.onAck,
    required this.actions,
    this.userId,
    this.avatarUrl,
    this.avatarHeaders,
    this.reason,
    this.detail,
    this.groupName,
    this.at,
    this.locationText,
  });

  final String name;
  final String? userId;
  final String? avatarUrl;
  final Map<String, String>? avatarHeaders;
  final String? reason;
  final String? detail;
  final String? groupName;
  final DateTime? at;
  final String? locationText;
  final List<PanicAlertAction> actions;
  final VoidCallback onAck;

  @override
  State<PanicAlertCard> createState() => _PanicAlertCardState();
}

class _PanicAlertCardState extends State<PanicAlertCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  String get _ago {
    final at = widget.at;
    if (at == null) return 'ahora';
    final s = DateTime.now().difference(at).inSeconds;
    if (s < 45) return 'ahora';
    if (s < 3600) return 'hace ${(s / 60).round()} min';
    final h = at.hour.toString().padLeft(2, '0');
    final m = at.minute.toString().padLeft(2, '0');
    return 'a las $h:$m';
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_kRedDeep, _kRed],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, child) {
                final t = _pulse.value;
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 30 + 14 * t,
                      height: 30 + 14 * t,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.35 * (1 - t)),
                      ),
                    ),
                    child!,
                  ],
                );
              },
              child: const Icon(Icons.campaign_rounded, color: Colors.white, size: 26),
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'ALERTA',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (widget.groupName != null)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 150),
                  child: Text(
                    widget.groupName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                ),
              Text(
                _ago,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _who() {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(2.5),
          decoration: const BoxDecoration(shape: BoxShape.circle, color: _kRed),
          child: UserAvatar(
            name: widget.name,
            userId: widget.userId,
            avatarUrl: widget.avatarUrl,
            headers: widget.avatarHeaders,
            radius: 28,
            previewOnTap: false,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: _kInk,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'necesita ayuda',
                style: TextStyle(fontSize: 13.5, color: _kMuted, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reasonBox() {
    final reason = widget.reason;
    final detail = widget.detail;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kRed.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kRed.withValues(alpha: 0.45), width: 1.4),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: _kRed, shape: BoxShape.circle),
            child: Icon(
              kPanicReasonIcons[reason] ?? Icons.priority_high_rounded,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (reason ?? 'Sin motivo indicado').toUpperCase(),
                  style: const TextStyle(
                    color: _kRed,
                    fontWeight: FontWeight.w900,
                    fontSize: 17,
                    letterSpacing: 0.8,
                  ),
                ),
                if (detail != null && detail.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    '«$detail»',
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, color: _kInk, height: 1.3),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionTile(PanicAlertAction a, double width) {
    final on = a.onTap != null;
    final fg = a.highlight ? Colors.white : _kRed;
    return SizedBox(
      width: width,
      child: Opacity(
        opacity: on ? 1 : 0.45,
        child: Material(
          color: a.highlight ? _kRed : Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: a.onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kRed.withValues(alpha: a.highlight ? 1 : 0.35)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(a.icon, color: fg, size: 24),
                  const SizedBox(height: 6),
                  Text(
                    a.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: a.highlight ? Colors.white : _kInk,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
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

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final wide = mq.size.width >= 600;
    return MediaQuery(
      data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.15)),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: wide ? 560 : 460),
          child: Material(
            color: const Color(0xFFFFF5F4),
            borderRadius: BorderRadius.circular(22),
            clipBehavior: Clip.antiAlias,
            elevation: 12,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _header(),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                    child: LayoutBuilder(
                      builder: (context, box) {
                        final cols = wide ? 6 : 3;
                        const gap = 8.0;
                        final tileW = (box.maxWidth - gap * (cols - 1)) / cols;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _who(),
                            const SizedBox(height: 12),
                            _reasonBox(),
                            if (widget.locationText != null) ...[
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 17, color: _kMuted),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      widget.locationText!,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: _kMuted,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: gap,
                              runSpacing: gap,
                              children: [for (final a in widget.actions) _actionTile(a, tileW)],
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: SizedBox(
                    height: 56,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: _kRed,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        textStyle: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                        ),
                      ),
                      onPressed: widget.onAck,
                      icon: const Icon(Icons.check_circle_rounded, size: 24),
                      label: const Text('Enterado'),
                    ),
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
