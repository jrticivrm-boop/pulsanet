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
    backgroundColor: kInstSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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

class _PanicConfirmBodyState extends State<_PanicConfirmBody> {
  late List<String> _selected;
  bool _allScope = false;
  String _reason = '';
  final _note = TextEditingController();

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

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return ChoiceChip(
      label: Text(label),
      selected: on,
      onSelected: (_) => onTap(),
      selectedColor: kInstDangerSoft,
      labelStyle: TextStyle(
        color: on ? Colors.white : kInstInk,
        fontWeight: on ? FontWeight.w700 : FontWeight.w500,
      ),
      showCheckmark: false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final allMine = _ids.isNotEmpty && _selected.length == _ids.length;
    final canSend = _allScope || _selected.isNotEmpty;
    final maxListH = MediaQuery.of(context).size.height * 0.32;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          14,
          20,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: kInstDangerSoft, size: 28),
                SizedBox(width: 8),
                Text(
                  '¿Enviar alerta?',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: kInstDangerSoft,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Se enviará la alerta con tu ubicación a $_summary.',
              style: const TextStyle(color: kInstMuted),
            ),
            const SizedBox(height: 12),
            const Text('DESTINO', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                _chip('Todos mis canales', !_allScope && allMine, () {
                  setState(() {
                    _allScope = false;
                    _selected = List.of(_ids);
                  });
                }),
                if (widget.canAlertAll)
                  _chip('Todos (mi alcance)', _allScope, () {
                    setState(() => _allScope = !_allScope);
                  }),
              ],
            ),
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: maxListH),
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final id in _ids)
                    CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: kInstDangerSoft,
                      value: _allScope || _selected.contains(id),
                      onChanged: _allScope
                          ? null
                          : (v) => setState(() {
                                if (v == true) {
                                  if (!_selected.contains(id)) _selected = [..._selected, id];
                                } else {
                                  _selected = _selected.where((x) => x != id).toList();
                                }
                              }),
                      title: Text(_nameOf(id)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'MOTIVO (OPCIONAL)',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final r in kPanicReasons)
                  _chip(r, _reason == r, () {
                    setState(() => _reason = _reason == r ? '' : r);
                  }),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _note,
              maxLength: 200,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _submit(),
              decoration: const InputDecoration(
                hintText: 'Detalle (opcional)',
                isDense: true,
                counterText: '',
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: kInstDangerSoft,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(52),
                      textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                    ),
                    onPressed: canSend ? _submit : null,
                    icon: const Icon(Icons.campaign),
                    label: const Text('Enviar alerta'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
