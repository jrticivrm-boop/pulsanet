import 'package:flutter/material.dart';

import '../api_client.dart';
import '../theme.dart';
import 'radio_shell.dart';

/// Lista de canales (legacy). La home post-login es [RadioShell].
class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key, required this.api, required this.onLogout});

  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchGroups();
  }

  void _reload() {
    setState(() => _future = widget.api.fetchGroups());
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.api.user?['displayName'] ?? 'Usuario';
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('TacticalPtx', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
            Text('$name', style: const TextStyle(fontSize: 13, color: kRadioMuted)),
          ],
        ),
        actions: [
          IconButton(onPressed: _reload, icon: const Icon(Icons.refresh)),
          IconButton(
            onPressed: () async {
              await widget.onLogout();
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: FutureBuilder(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Error: ${snap.error}'));
          }
          final groups = snap.data ?? [];
          if (groups.isEmpty) {
            return const Center(child: Text('Sin grupos asignados'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: groups.length,
            separatorBuilder: (_, i) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final g = groups[i];
              return ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
                ),
                tileColor: kRadioSurface,
                title: Text(
                  g['name'] as String? ?? 'Grupo',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: kRadioInk),
                ),
                subtitle: Text(
                  g['description'] as String? ?? g['livekit_room'] as String? ?? '',
                  style: const TextStyle(color: kRadioMuted),
                ),
                trailing: const Icon(Icons.chevron_right, color: kRadioMuted),
                onTap: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => RadioShell(
                        api: widget.api,
                        onLogout: widget.onLogout,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
