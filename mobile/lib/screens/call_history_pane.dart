import 'dart:async';

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../api_client.dart';
import '../config.dart';
import '../es_msg.dart';
import '../screens/private_call_screen.dart';
import '../theme.dart';
import '../widgets/app_overflow_menu.dart';
import '../widgets/user_avatar.dart';

enum CallHistoryFilter { all, received, missed }

/// Historial de llamadas estilo WhatsApp (voz, video, radio).
class CallHistoryPane extends StatefulWidget {
  const CallHistoryPane({
    super.key,
    required this.api,
    required this.onOpenDm,
    this.onOverflowMenu,
    this.showLogout = false,
    this.locationMenuLabel = 'Ubicación GPS',
    this.embedHeader = true,
  });

  final ApiClient api;
  final Future<void> Function(String peerId, String peerName) onOpenDm;
  final ValueChanged<String>? onOverflowMenu;
  final bool showLogout;
  final String locationMenuLabel;
  /// false = solo lista (el padre ya muestra título/menú).
  final bool embedHeader;

  @override
  State<CallHistoryPane> createState() => _CallHistoryPaneState();
}

class _CallHistoryPaneState extends State<CallHistoryPane> {
  CallHistoryFilter _filter = CallHistoryFilter.all;
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await widget.api.fetchCallHistory(
        missedOnly: _filter == CallHistoryFilter.missed,
        receivedOnly: _filter == CallHistoryFilter.received,
      );
      if (!mounted) return;
      setState(() {
        _items = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      // HTML 404/502 del borde (SPA) → lista vacía, sin Exception roja.
      // Auth (401/token) sí se muestra; el resto con mensaje corto.
      if (ApiClient.isHtmlOrRoutingError(e) && !ApiClient.isAuthError(e)) {
        setState(() {
          _items = [];
          _error = null;
          _loading = false;
        });
        return;
      }
      setState(() {
        _items = [];
        _error = esMsg(e, 'No se pudo cargar el historial');
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _items;
    return _items
        .where((e) => (e['peerName']?.toString() ?? '').toLowerCase().contains(q))
        .toList();
  }

  String _sectionLabel(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    if (day == today) return 'Hoy';
    if (day == today.subtract(const Duration(days: 1))) return 'Ayer';
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    if (d.year == now.year) return '${d.day} ${months[d.month - 1]}';
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final e in _filtered) {
      final raw = e['endedAt']?.toString() ?? e['startedAt']?.toString();
      final dt = raw != null ? DateTime.tryParse(raw)?.toLocal() : null;
      final key = dt != null ? _sectionLabel(dt) : 'Anteriores';
      map.putIfAbsent(key, () => []).add(e);
    }
    return map;
  }

  String _formatTime(String? value) {
    if (value == null || value.isEmpty) return '';
    try {
      final d = DateTime.parse(value).toLocal();
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  int? _durationSec(Map<String, dynamic> e) {
    final raw = e['durationSec'] ?? e['duration_sec'];
    if (raw == null) return null;
    if (raw is int) return raw;
    if (raw is num) return raw.round();
    return int.tryParse(raw.toString());
  }

  String _formatDuration(int? sec) {
    if (sec == null || sec <= 0) return '';
    final h = sec ~/ 3600;
    final m = (sec % 3600) ~/ 60;
    final s = sec % 60;
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String _subtitle(Map<String, dynamic> e) {
    final direction = e['direction']?.toString() ?? 'outgoing';
    final outcome = e['outcome']?.toString() ?? 'completed';
    final dur = _formatDuration(_durationSec(e));

    if (outcome == 'missed' || outcome == 'rejected') {
      return outcome == 'rejected' ? 'Rechazada' : 'Perdida';
    }
    if (direction == 'incoming') {
      return dur.isNotEmpty ? 'Recibida · $dur' : 'Recibida';
    }
    // Saliente contestada
    return dur.isNotEmpty ? 'Saliente · $dur' : 'Saliente';
  }

  Color _subtitleColor(Map<String, dynamic> e) {
    final direction = e['direction']?.toString() ?? 'outgoing';
    final outcome = e['outcome']?.toString() ?? 'completed';
    if (outcome == 'missed' || outcome == 'rejected') return kInstDanger;
    if (direction == 'incoming') return kInstOk;
    return kInstMuted;
  }

  /// Icono voz/video; color lo aporta [_subtitleColor] (rojo perdida / verde recibida).
  IconData _statusIcon(Map<String, dynamic> e) {
    final direction = e['direction']?.toString() ?? 'outgoing';
    final mode = e['mode']?.toString() ?? 'call';
    final outcome = e['outcome']?.toString() ?? 'completed';
    final missed = outcome == 'missed' || outcome == 'rejected';
    final incoming = direction == 'incoming';

    if (mode == 'video') {
      if (missed) return Icons.missed_video_call_rounded;
      if (incoming) return Icons.videocam_rounded;
      return Icons.video_call_rounded;
    }
    if (mode == 'radio') {
      return Icons.cell_tower_rounded;
    }
    if (missed) {
      return incoming ? Icons.call_missed_rounded : Icons.call_missed_outgoing_rounded;
    }
    return incoming ? Icons.call_received_rounded : Icons.call_made_rounded;
  }

  IconData _actionIcon(String mode) {
    if (mode == 'video') return Icons.videocam_rounded;
    return Icons.call_rounded;
  }

  Future<void> _startCall(String peerId, String peerName, String mode) async {
    if (mode == 'radio') return;
    if (mode == 'video') await Permission.camera.request();
    try {
      final data = await widget.api.startPrivateCall(peerId, mode: mode);
      if (!mounted) return;
      final call = data['call'] as Map? ?? {};
      await Navigator.of(context).push(
        PrivateCallScreen.route(
          child: PrivateCallScreen(
            api: widget.api,
            callId: call['callId']?.toString() ?? '',
            peerId: peerId,
            peerName: peerName,
            token: data['token'] as String,
            url: AppConfig.publicLiveKitUrl(data['url'] as String),
            role: 'caller',
            e2eeKey: data['e2eeKey']?.toString(),
            e2ee: data['e2ee'] == true,
            mode: mode == 'video' ? 'video' : 'call',
          ),
        ),
      );
      if (mounted) await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }

  Future<void> _showActions(Map<String, dynamic> e) async {
    final peerId = e['peerId']?.toString() ?? '';
    final peerName = e['peerName']?.toString() ?? 'Usuario';
    if (peerId.isEmpty) return;
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: kInstSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  UserAvatar(
                    name: peerName,
                    userId: peerId,
                    avatarUrl: widget.api.peerAvatarNetworkUrl(
                      peerId,
                      e['peerAvatarUrl']?.toString(),
                    ),
                    headers: widget.api.avatarAuthHeaders(),
                    radius: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      peerName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: kInstInk,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline, color: kInstOlive),
              title: const Text('Enviar mensaje'),
              onTap: () => Navigator.pop(ctx, 'dm'),
            ),
            ListTile(
              leading: const Icon(Icons.call, color: kInstOlive),
              title: const Text('Llamada de voz'),
              onTap: () => Navigator.pop(ctx, 'call'),
            ),
            ListTile(
              leading: const Icon(Icons.videocam, color: kInstOlive),
              title: const Text('Videollamada'),
              onTap: () => Navigator.pop(ctx, 'video'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'dm') {
      await widget.onOpenDm(peerId, peerName);
    } else if (choice == 'call') {
      await _startCall(peerId, peerName, 'call');
    } else if (choice == 'video') {
      await _startCall(peerId, peerName, 'video');
    }
  }

  Future<void> _confirmClearHistory() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Borrar registro'),
        content: const Text(
          'Se eliminará todo el historial de llamadas. Esta acción no se puede deshacer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: kInstDanger),
            child: const Text('Borrar'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await widget.api.clearCallHistory();
      if (!mounted) return;
      setState(() => _items = []);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registro de llamadas borrado')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(esMsg(e, 'No se pudo borrar el registro'))),
      );
    }
  }

  void _onMenuSelected(String value) {
    if (value == 'clear_calls') {
      unawaited(_confirmClearHistory());
      return;
    }
    widget.onOverflowMenu?.call(value);
  }

  String get _emptyTitle {
    switch (_filter) {
      case CallHistoryFilter.missed:
        return 'No hay llamadas perdidas';
      case CallHistoryFilter.received:
        return 'No hay llamadas recibidas';
      case CallHistoryFilter.all:
        return 'Sin llamadas recientes';
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _grouped;

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.embedHeader)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 4, 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 4, right: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'LLAMADAS',
                            style: TacticalFonts.display(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: kTacOnSurface,
                              letterSpacing: 0.3,
                            ),
                          ),
                          Text(
                            'Historial de voz y video',
                            style: TacticalFonts.body(
                              fontSize: 13,
                              color: kTacMuted.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Borrar registro de llamadas',
                    onPressed: _items.isEmpty ? null : _confirmClearHistory,
                    icon: const Icon(
                      Icons.delete_sweep_outlined,
                      color: kTacOnSurface,
                    ),
                  ),
                  if (widget.onOverflowMenu != null)
                    AppOverflowMenuButton(
                      showLogout: widget.showLogout,
                      showClearCallLog: true,
                      locationMenuLabel: widget.locationMenuLabel,
                      onSelected: _onMenuSelected,
                    ),
                ],
              ),
            )
          else
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _items.isEmpty ? null : _confirmClearHistory,
                icon: const Icon(Icons.delete_sweep_outlined, size: 18),
                label: const Text('Borrar registro'),
              ),
            ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _FilterChip(
                  label: 'Todas',
                  selected: _filter == CallHistoryFilter.all,
                  onTap: () {
                    setState(() => _filter = CallHistoryFilter.all);
                    _load();
                  },
                ),
                _FilterChip(
                  label: 'Recibidas',
                  selected: _filter == CallHistoryFilter.received,
                  onTap: () {
                    setState(() => _filter = CallHistoryFilter.received);
                    _load();
                  },
                ),
                _FilterChip(
                  label: 'Perdidas',
                  selected: _filter == CallHistoryFilter.missed,
                  onTap: () {
                    setState(() => _filter = CallHistoryFilter.missed);
                    _load();
                  },
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Buscar en llamadas…',
              hintStyle: const TextStyle(color: kInstMuted, fontSize: 14),
              prefixIcon: const Icon(Icons.search, color: kInstMuted, size: 20),
              filled: true,
              fillColor: kInstSurface,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(_error!, style: const TextStyle(color: kRadioDanger, fontSize: 12)),
          ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: kInstOlive))
              : groups.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(28),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.history_rounded, size: 56, color: kInstMuted.withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            Text(
                              _emptyTitle,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: kInstMuted, fontSize: 15),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Las llamadas y videollamadas aparecerán aquí',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: kInstMuted.withValues(alpha: 0.8), fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      color: kInstOlive,
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.only(bottom: 12),
                        children: [
                          for (final entry in groups.entries) ...[
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                              child: Text(
                                entry.key.toUpperCase(),
                                style: TacticalFonts.display(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: kInstOlive,
                                  letterSpacing: 1.1,
                                ),
                              ),
                            ),
                            for (final e in entry.value)
                              _CallLogTile(
                                entry: e,
                                time: _formatTime(
                                  e['endedAt']?.toString() ?? e['startedAt']?.toString(),
                                ),
                                subtitle: _subtitle(e),
                                subtitleColor: _subtitleColor(e),
                                statusIcon: _statusIcon(e),
                                actionIcon: _actionIcon(e['mode']?.toString() ?? 'call'),
                                avatarUrl: widget.api.peerAvatarNetworkUrl(
                                  e['peerId']?.toString() ?? '',
                                  e['peerAvatarUrl']?.toString(),
                                ),
                                headers: widget.api.avatarAuthHeaders(),
                                onTap: () => _showActions(e),
                                onCall: () => _startCall(
                                  e['peerId']?.toString() ?? '',
                                  e['peerName']?.toString() ?? 'Usuario',
                                  e['mode']?.toString() == 'video' ? 'video' : 'call',
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
        ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: selected ? kInstOlive : kInstSurface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                color: selected ? kInstOnPrimary : kInstInk,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CallLogTile extends StatelessWidget {
  const _CallLogTile({
    required this.entry,
    required this.time,
    required this.subtitle,
    required this.subtitleColor,
    required this.statusIcon,
    required this.actionIcon,
    required this.avatarUrl,
    required this.headers,
    required this.onTap,
    required this.onCall,
  });

  final Map<String, dynamic> entry;
  final String time;
  final String subtitle;
  final Color subtitleColor;
  final IconData statusIcon;
  final IconData actionIcon;
  final String? avatarUrl;
  final Map<String, String>? headers;
  final VoidCallback onTap;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final name = entry['peerName']?.toString() ?? 'Usuario';
    final peerId = entry['peerId']?.toString() ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              UserAvatar(
                name: name,
                userId: peerId,
                avatarUrl: avatarUrl,
                headers: headers,
                radius: 26,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: kInstInk,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(statusIcon, size: 16, color: subtitleColor),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 13, color: subtitleColor),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (time.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Text(
                    time,
                    style: const TextStyle(fontSize: 12, color: kInstMuted),
                  ),
                ),
              Material(
                color: kInstOlive.withValues(alpha: 0.1),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onCall,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Icon(actionIcon, color: kInstOlive, size: 20),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
