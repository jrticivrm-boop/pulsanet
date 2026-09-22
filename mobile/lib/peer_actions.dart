import 'package:flutter/material.dart';

import 'api_client.dart';
import 'config.dart';
import 'es_msg.dart';
import 'screens/direct_pane.dart';
import 'screens/private_call_screen.dart';
import 'theme.dart';

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
    backgroundColor: kTacSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            ListTile(
              leading: CircleAvatar(
                backgroundColor: kInstOlive.withValues(alpha: 0.15),
                child: Text(
                  displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: kInstOlive,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              title: Text(
                displayName,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: const Text('Miembro del canal'),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline, color: kInstOlive),
              title: const Text('Mensaje personal'),
              subtitle: const Text('Abrir chat 1:1'),
              onTap: () => Navigator.pop(ctx, 'dm'),
            ),
            ListTile(
              leading: const Icon(Icons.call, color: kInstOlive),
              title: const Text('Llamada personal'),
              subtitle: const Text('Llamada de voz privada'),
              onTap: () => Navigator.pop(ctx, 'call'),
            ),
            ListTile(
              leading: const Icon(Icons.videocam, color: kInstOlive),
              title: const Text('Videollamada'),
              subtitle: const Text('Llamada con cámara 1:1'),
              onTap: () => Navigator.pop(ctx, 'video'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
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
