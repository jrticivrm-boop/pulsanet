import 'package:flutter/material.dart';

import '../api_client.dart';
import 'radio_shell.dart';

/// Compat: rutas antiguas `/channel` redirigen al shell con el grupo indicado.
class ChannelScreen extends StatelessWidget {
  const ChannelScreen({super.key, required this.api, required this.group});

  final ApiClient api;
  final Map<String, dynamic> group;

  @override
  Widget build(BuildContext context) {
    return RadioShell(
      api: api,
      onLogout: () async {
        await api.logout();
        if (context.mounted) {
          Navigator.of(context).popUntil((r) => r.isFirst);
        }
      },
    );
  }
}
