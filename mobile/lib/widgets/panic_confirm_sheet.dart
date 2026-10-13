import 'package:flutter/material.dart';

import '../theme.dart';

const List<String> kPanicReasons = ['Emergencia', 'Apoyo', 'Médica', 'Agresión'];

class PanicConfirmResult {
  const PanicConfirmResult({required this.groupIds, this.target, this.note});

  final List<String> groupIds;

  /// `'all'` = todos los canales del alcance (solo administración).
  final String? target;
  final String? note;
}

/// Hoja de confirmación antes de enviar una alerta: destino + motivo opcional.
/// Devuelve null si el usuario cancela.
Future<PanicConfirmResult?> showPanicConfirmSheet(
  BuildContext context, {
  required List<Map<String, dynamic>> groups,
  required List<String> initialIds,
  bool canAlertAll = false,
}) {
  return showModalBottomSheet<PanicConfirmResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: kInstSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => _PanicConfirmBody(
      groups: groups,
      initialIds: initialIds,
      canAlertAll: canAlertAll,
    ),
  );
}

class _PanicConfirmBody extends StatefulWidget {
  const _PanicConfirmBody({
    required this.groups,
    required this.initialIds,
    required this.canAlertAll,
  });

  final List<Map<String, dynamic>> groups;
  final List<String> initialIds;
  final bool canAlertAll;

  @override
  State<_PanicConfirmBody> createState() => _PanicConfirmBodyState();
}

const Map<String, IconData> _kReasonIcons = {
  'Emergencia': Icons.emergency_rounded,
  'Apoyo': Icons.groups_rounded,
  'Médica': Icons.medical_services_rounded,
  'Agresión': Icons.gpp_maybe_rounded,
};

class _PanicConfirmBodyState extends State<_PanicConfirmBody>
    with SingleTickerProviderStateMixin {
  late List<String> _selected;
  bool _allScope = false;
  String _reason = '';
  final _note = TextEditingController();
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  List<String> get _ids =>
      widget.groups.map((g) => g['id']?.toString() ?? '').where((s) => s.isNotEmpty).toList();

  @override
  void initState() {
    super.initState();
    final valid = _ids.toSet();
    _selected = widget.initialIds.where(valid.contains).toList();
    if (_selected.isEmpty && _ids.isNotEmpty) _selected = [_ids.first];
  }

  @override
  void dispose() {
    _pulse.dispose();
    _note.dispose();
    super.dispose();
  }

  String _nameOf(String id) {
    final g = widget.groups.firstWhere(
      (g) => g['id']?.toString() == id,
      orElse: () => const {},
    );
    return g['name']?.toString() ?? 'Canal';
  }

  String get _summary {
    if (_allScope) return 'todos los canales de tu alcance';
    if (_selected.length == 1) return '«${_nameOf(_selected.first)}»';
    return '${_selected.length} canales';
  }

  void _submit() {
    if (!_allScope && _selected.isEmpty) return;
    final text = [_reason, _note.text.trim()].where((s) => s.isNotEmpty).join(' — ');
    final ordered = _ids.where(_selected.contains).toList();
    Navigator.pop(
      context,
      PanicConfirmResult(
        groupIds: _allScope ? const [] : ordered,
        target: _allScope ? 'all' : null,
        note: text.isEmpty ? null : text,
      ),
    );
  }

  String get _sendLabel {
    if (_allScope) return 'Enviar a todo mi alcance';
    if (_selected.length <= 1) return 'Enviar alerta';
    return 'Enviar a ${_selected.length} canales';
  }

  void _toggleGroup(String id) {
    setState(() {
      _selected = _selected.contains(id)
          ? _selected.where((x) => x != id).toList()
          : [..._selected, id];
    });
  }

  Widget _sectionLabel(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: kInstMuted),
          const SizedBox(width: 6),
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: kInstMuted,
            ),
          ),
        ],
      ),
    );
  }

  /// Píldora seleccionable (destino). Se acomoda sola al ancho del teléfono.
  Widget _pill({
    required String label,
    required bool on,
    required VoidCallback? onTap,
    IconData? icon,
    required double maxWidth,
  }) {
    final enabled = onTap != null;
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: on ? kInstDangerSoft : kInstPanel2,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: on ? kInstDangerSoft : kInstBorder,
                width: 1.4,
              ),
              boxShadow: on
                  ? [
                      BoxShadow(
                        color: kInstDangerSoft.withValues(alpha: 0.28),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ]
                  : null,
            ),
            child: Opacity(
              opacity: enabled || on ? 1 : 0.55,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    on ? Icons.check_circle_rounded : (icon ?? Icons.radio_button_unchecked),
                    size: 18,
                    color: on ? Colors.white : kInstMuted,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                        color: on ? Colors.white : kInstInk,
                      ),
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

  Widget _reasonTile(String r, double width) {
    final on = _reason == r;
    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => setState(() => _reason = on ? '' : r),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: on ? kInstDangerSoft.withValues(alpha: 0.12) : kInstPanel2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: on ? kInstDangerSoft : kInstBorder,
                width: on ? 2 : 1.2,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: on ? kInstDangerSoft : kInstDangerSoft.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _kReasonIcons[r] ?? Icons.report_rounded,
                    size: 19,
                    color: on ? Colors.white : kInstDangerSoft,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    r,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                      color: on ? kInstDangerSoft : kInstInk,
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

  Widget _header() {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            kInstDangerSoft.withValues(alpha: 0.16),
            kInstDangerSoft.withValues(alpha: 0.04),
          ],
        ),
        border: Border.all(color: kInstDangerSoft.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            height: 56,
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, child) {
                final t = _pulse.value;
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 40 + 16 * t,
                      height: 40 + 16 * t,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: kInstDangerSoft.withValues(alpha: 0.35 * (1 - t)),
                      ),
                    ),
                    child!,
                  ],
                );
              },
              child: Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: kInstDangerSoft,
                ),
                child: const Icon(Icons.campaign_rounded, color: Colors.white, size: 24),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Enviar alerta',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    color: kInstDangerSoft,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Icon(Icons.location_on_rounded, size: 15, color: kInstMuted),
                    ),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        'Con tu ubicación a $_summary',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: kInstMuted, height: 1.25),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final wide = mq.size.width >= 600;
    final allMine = _ids.isNotEmpty && _selected.length == _ids.length;
    final canSend = _allScope || _selected.isNotEmpty;

    final sendBtn = SizedBox(
      height: 56,
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: kInstDangerSoft,
          foregroundColor: Colors.white,
          disabledBackgroundColor: kInstDangerSoft.withValues(alpha: 0.35),
          disabledForegroundColor: Colors.white70,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: canSend ? 3 : 0,
          shadowColor: kInstDangerSoft.withValues(alpha: 0.5),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: 0.3),
        ),
        onPressed: canSend ? _submit : null,
        icon: const Icon(Icons.campaign_rounded, size: 24),
        label: FittedBox(fit: BoxFit.scaleDown, child: Text(_sendLabel)),
      ),
    );

    final cancelBtn = wide
        ? SizedBox(
            height: 56,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: kInstInk,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: () => Navigator.pop(context),
              child: const FittedBox(fit: BoxFit.scaleDown, child: Text('Cancelar')),
            ),
          )
        : SizedBox(
            height: 46,
            child: TextButton(
              style: TextButton.styleFrom(foregroundColor: kInstMuted),
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          );

    // Letra grande del sistema: legible pero sin romper la hoja.
    return MediaQuery(
      data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.15)),
      child: Padding(
        padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(wide ? 28 : 16, 10, wide ? 28 : 16, 12 + mq.padding.bottom),
          child: LayoutBuilder(
            builder: (context, box) {
              final w = box.maxWidth;
              final cols = wide ? 4 : 2;
              const gap = 10.0;
              final tileW = (w - gap * (cols - 1)) / cols;
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 42,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: kInstBorder,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                  _header(),
                  _sectionLabel(Icons.podcasts_rounded, 'DESTINO'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _pill(
                        label: 'Todos mis canales',
                        icon: Icons.select_all_rounded,
                        on: !_allScope && allMine,
                        maxWidth: w,
                        onTap: () => setState(() {
                          _allScope = false;
                          _selected = List.of(_ids);
                        }),
                      ),
                      if (widget.canAlertAll)
                        _pill(
                          label: 'Todo mi alcance',
                          icon: Icons.public_rounded,
                          on: _allScope,
                          maxWidth: w,
                          onTap: () => setState(() => _allScope = !_allScope),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: mq.size.height * 0.26),
                    child: SingleChildScrollView(
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final id in _ids)
                            _pill(
                              label: _nameOf(id),
                              on: _allScope || _selected.contains(id),
                              maxWidth: w,
                              onTap: _allScope ? null : () => _toggleGroup(id),
                            ),
                        ],
                      ),
                    ),
                  ),
                  _sectionLabel(Icons.label_important_outline_rounded, 'MOTIVO (OPCIONAL)'),
                  Wrap(
                    spacing: gap,
                    runSpacing: gap,
                    children: [for (final r in kPanicReasons) _reasonTile(r, tileW)],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _note,
                    maxLength: 200,
                    minLines: 1,
                    maxLines: 3,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      hintText: 'Detalle (opcional)',
                      prefixIcon: const Icon(Icons.edit_note_rounded),
                      isDense: true,
                      counterText: '',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: kInstBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: kInstDangerSoft, width: 1.6),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (wide)
                    Row(
                      children: [
                        Expanded(child: cancelBtn),
                        const SizedBox(width: 12),
                        Expanded(flex: 2, child: sendBtn),
                      ],
                    )
                  else ...[
                    sendBtn,
                    const SizedBox(height: 4),
                    cancelBtn,
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
