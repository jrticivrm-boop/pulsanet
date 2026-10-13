import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'config.dart';
import 'es_msg.dart';
import 'screens/direct_pane.dart';
import 'screens/private_call_screen.dart';
import 'theme.dart';
import 'widgets/user_avatar.dart';

/// Menú para contactar a un miembro del canal (DM o llamada).
Future<void> showChannelPeerActions({
  required BuildContext context,
  required ApiClient api,
  required String peerId,
  required String displayName,
  String? myUserId,
}) async {
  if (peerId.isEmpty) return;
  if (myUserId != null && peerId == myUserId) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ese eres tú')),
    );
    return;
  }

  final choice = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => _PeerContactSheet(
      api: api,
      peerId: peerId,
      displayName: displayName,
    ),
  );

  if (!context.mounted || choice == null) return;

  if (choice == 'dm') {
    final nav = Navigator.of(context);
    await nav.push<void>(
      MaterialPageRoute(
        builder: (_) => DirectPane(
          api: api,
          initialPeerId: peerId,
          threadOnly: true,
          onBack: () => nav.popUntil((route) => route.isFirst),
        ),
      ),
    );
    return;
  }

  if (choice == 'call') {
    await startPersonalCall(
      context: context,
      api: api,
      peerId: peerId,
      peerName: displayName,
    );
    return;
  }

  if (choice == 'video') {
    await startPersonalVideoCall(
      context: context,
      api: api,
      peerId: peerId,
      peerName: displayName,
    );
  }
}

Future<void> startPersonalCall({
  required BuildContext context,
  required ApiClient api,
  required String peerId,
  required String peerName,
}) async {
  try {
    final data = await api.startPrivateCall(peerId, mode: 'call');
    if (!context.mounted) return;
    final call = data['call'] as Map? ?? {};
    await Navigator.of(context).push(
      PrivateCallScreen.route(
        child: PrivateCallScreen(
          api: api,
          callId: call['callId']?.toString() ?? '',
          peerId: peerId,
          peerName: peerName,
          token: data['token'] as String,
          url: AppConfig.publicLiveKitUrl(data['url'] as String),
          role: 'caller',
          e2eeKey: data['e2eeKey']?.toString(),
          e2ee: data['e2ee'] == true,
          mode: 'call',
        ),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(esMsg(e, 'No se pudo iniciar la llamada'))),
    );
  }
}

Future<void> startPersonalVideoCall({
  required BuildContext context,
  required ApiClient api,
  required String peerId,
  required String peerName,
}) async {
  try {
    final data = await api.startPrivateCall(peerId, mode: 'video');
    if (!context.mounted) return;
    final call = data['call'] as Map? ?? {};
    await Navigator.of(context).push(
      PrivateCallScreen.route(
        child: PrivateCallScreen(
          api: api,
          callId: call['callId']?.toString() ?? '',
          peerId: peerId,
          peerName: peerName,
          token: data['token'] as String,
          url: AppConfig.publicLiveKitUrl(data['url'] as String),
          role: 'caller',
          e2eeKey: data['e2eeKey']?.toString(),
          e2ee: data['e2ee'] == true,
          mode: 'video',
        ),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(esMsg(e, 'No se pudo iniciar la videollamada'))),
    );
  }
}

String _phoneDigits(String raw) => raw.replaceAll(RegExp(r'\D'), '');

/// 81 1234 5678 · +52 55 1234 5678
String formatPhone(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return '';
  final d = _phoneDigits(s);
  if (!s.startsWith('+') && d.length == 10) {
    return '${d.substring(0, 2)} ${d.substring(2, 6)} ${d.substring(6)}';
  }
  if (s.startsWith('+') && d.length == 12 && d.startsWith('52')) {
    return '+52 ${d.substring(2, 4)} ${d.substring(4, 8)} ${d.substring(8)}';
  }
  return s.startsWith('+') ? '+$d' : d;
}

Uri _telUri(String raw) =>
    Uri(scheme: 'tel', path: '${raw.trim().startsWith('+') ? '+' : ''}${_phoneDigits(raw)}');

/// WhatsApp: 10 dígitos sin lada = México (+52).
Uri _whatsappUri(String raw) {
  final s = raw.trim();
  final d = _phoneDigits(s);
  final intl = !s.startsWith('+') && d.length == 10 ? '52$d' : d;
  return Uri.parse('https://wa.me/$intl');
}

/// Ficha de contacto: avatar con presencia, Mensaje / Llamada SICOM / Video
/// y celular (llamar, copiar, WhatsApp). Devuelve 'dm' | 'call' | 'video'.
class _PeerContactSheet extends StatefulWidget {
  const _PeerContactSheet({
    required this.api,
    required this.peerId,
    required this.displayName,
  });

  final ApiClient api;
  final String peerId;
  final String displayName;

  @override
  State<_PeerContactSheet> createState() => _PeerContactSheetState();
}

class _PeerContactSheetState extends State<_PeerContactSheet> {
  Map<String, dynamic>? _contact;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final c = await widget.api.fetchPeerContact(widget.peerId);
      if (!mounted) return;
      setState(() {
        _contact = c;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  String get _phone => _contact?['phone']?.toString() ?? '';

  String get _presence {
    final p = _contact?['presence']?.toString() ?? 'offline';
    return p == 'online' || p == 'away' ? p : 'offline';
  }

  Color get _presenceColor => switch (_presence) {
        'online' => const Color(0xFF2ECC71),
        'away' => const Color(0xFFE0B03A),
        _ => const Color(0xFF8A958F),
      };

  String get _presenceLabel => switch (_presence) {
        'online' => 'En línea',
        'away' => 'Ausente',
        _ => 'Desconectado',
      };

  void _toast(String text) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(text), duration: const Duration(seconds: 2)),
    );
  }

  Future<void> _open(Uri uri, String failText) async {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok) _toast(failText);
    } catch (_) {
      _toast(failText);
    }
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: formatPhone(_phone)));
    if (!mounted) return;
    HapticFeedback.selectionClick();
    _toast('Número copiado');
  }

  @override
  Widget build(BuildContext context) {
    final name = _contact?['displayName']?.toString() ?? widget.displayName;
    final grade = _contact?['grade']?.toString() ?? '';
    final cargo = _contact?['cargo']?.toString() ?? '';
    final username = _contact?['username']?.toString() ?? '';
    final subtitle = [
      if (grade.isNotEmpty && !name.startsWith(grade)) grade,
      if (cargo.isNotEmpty) cargo,
    ].join(' · ');

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1B2C22), Color(0xFF0F1813)],
          ),
          border: Border.all(color: const Color(0x473ECF9A)),
          boxShadow: const [
            BoxShadow(color: Color(0x80000000), blurRadius: 30, offset: Offset(0, 12)),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _presenceColor,
                boxShadow: [
                  BoxShadow(
                    color: _presenceColor.withValues(alpha: 0.45),
                    blurRadius: 18,
                  ),
                ],
              ),
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFF121D17),
                ),
                child: UserAvatar(
                  name: name,
                  userId: widget.peerId,
                  avatarUrl: widget.api.peerAvatarNetworkUrl(
                    widget.peerId,
                    _contact?['avatarUrl']?.toString(),
                  ),
                  headers: widget.api.avatarAuthHeaders(),
                  radius: 38,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              name,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 19,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (subtitle.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 13),
              ),
            ],
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _presenceColor,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _presenceLabel,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (username.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Text(
                      '@$username',
                      style: const TextStyle(color: Colors.white38, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: _RoundAction(
                    icon: Icons.chat_bubble_rounded,
                    label: 'Mensaje',
                    onTap: () => Navigator.pop(context, 'dm'),
                  ),
                ),
                Expanded(
                  child: _RoundAction(
                    icon: Icons.call_rounded,
                    label: 'Llamada SICOM',
                    primary: true,
                    onTap: () => Navigator.pop(context, 'call'),
                  ),
                ),
                Expanded(
                  child: _RoundAction(
                    icon: Icons.videocam_rounded,
                    label: 'Videollamada',
                    onTap: () => Navigator.pop(context, 'video'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _phoneCard(),
          ],
        ),
      ),
    );
  }

  Widget _phoneCard() {
    final has = _phone.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0x243ECF9A),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.smartphone_rounded, color: Color(0xFF7FE0B4)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CELULAR',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 11,
                        letterSpacing: 1.1,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (_loading)
                      const Text('Cargando…', style: TextStyle(color: Colors.white54))
                    else if (has)
                      Text(
                        formatPhone(_phone),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      )
                    else
                      Text(
                        _failed ? 'No se pudo consultar' : 'Sin teléfono registrado',
                        style: const TextStyle(color: Colors.white54),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (has) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _PhoneChip(
                    icon: Icons.call_rounded,
                    label: 'Llamar',
                    color: const Color(0xFF2ECC71),
                    onTap: () => _open(_telUri(_phone), 'No se pudo abrir el marcador'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PhoneChip(
                    icon: Icons.copy_rounded,
                    label: 'Copiar',
                    color: Colors.white,
                    onTap: _copy,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PhoneChip(
                    icon: Icons.chat_rounded,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () => _open(_whatsappUri(_phone), 'No se pudo abrir WhatsApp'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: primary
                    ? const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF2FBF71), Color(0xFF1D8A4D)],
                      )
                    : null,
                color: primary ? null : Colors.white.withValues(alpha: 0.08),
                border: Border.all(
                  color: primary
                      ? const Color(0x7378FFB4)
                      : Colors.white.withValues(alpha: 0.12),
                ),
                boxShadow: primary
                    ? const [
                        BoxShadow(
                          color: Color(0x592ECC71),
                          blurRadius: 16,
                          offset: Offset(0, 6),
                        ),
                      ]
                    : null,
              ),
              child: Icon(
                icon,
                color: primary ? Colors.white : const Color(0xFFCFE9D9),
                size: 26,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhoneChip extends StatelessWidget {
  const _PhoneChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withValues(alpha: 0.4)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
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

/// Lista rápida de miembros en línea del canal.
Future<void> showChannelMembersSheet({
  required BuildContext context,
  required ApiClient api,
  required List<({String userId, String displayName})> members,
  String? myUserId,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: kTacSurface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      final others = members.where((m) => m.userId != myUserId).toList();
      return SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(ctx).height * 0.5,
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Miembros del canal',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: others.isEmpty
                    ? const Center(
                        child: Text(
                          'Nadie más en el canal ahora',
                          style: TextStyle(color: kInstMuted),
                        ),
                      )
                    : ListView.builder(
                        itemCount: others.length,
                        itemBuilder: (_, i) {
                          final m = others[i];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: kInstOlive.withValues(alpha: 0.15),
                              child: Text(
                                m.displayName.isNotEmpty
                                    ? m.displayName[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                  color: kInstOlive,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            title: Text(
                              m.displayName,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: const Text('Mensaje o llamada personal'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () {
                              Navigator.pop(ctx);
                              showChannelPeerActions(
                                context: context,
                                api: api,
                                peerId: m.userId,
                                displayName: m.displayName,
                                myUserId: myUserId,
                              );
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
