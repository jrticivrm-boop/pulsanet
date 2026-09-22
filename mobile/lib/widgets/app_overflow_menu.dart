import 'package:flutter/material.dart';

import '../theme.dart';

/// Menú ⋮ estilo WhatsApp (izquierda del título): canales, perfil, GPS, etc.
class AppOverflowMenuButton extends StatelessWidget {
  const AppOverflowMenuButton({
    super.key,
    required this.onSelected,
    this.iconColor = kTacOnSurface,
    this.showLogout = false,
    this.showClearCallLog = false,
    this.showRadioMute = false,
    this.radioMuted = false,
    this.showGroupVideo = false,
    this.locationMenuLabel = 'Ubicación GPS',
  });

  final ValueChanged<String> onSelected;
  final Color iconColor;
  final bool showLogout;
  final bool showClearCallLog;
  final bool showRadioMute;
  final bool radioMuted;
  final bool showGroupVideo;
  final String locationMenuLabel;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: Icon(Icons.more_vert_rounded, color: iconColor),
      tooltip: 'Menú',
      offset: const Offset(0, 40),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: onSelected,
      itemBuilder: (ctx) => [
        const PopupMenuItem(
          value: 'channels',
          child: ListTile(
            dense: true,
            leading: Icon(Icons.layers_outlined),
            title: Text('Canales'),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        const PopupMenuItem(
          value: 'profile_photo',
          child: ListTile(
            dense: true,
            leading: Icon(Icons.photo_camera_outlined),
            title: Text('Cambiar foto de perfil'),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        const PopupMenuItem(
          value: 'profile_info',
          child: ListTile(
            dense: true,
            leading: Icon(Icons.badge_outlined),
            title: Text('Datos e información'),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        const PopupMenuItem(
          value: 'settings',
          child: ListTile(
            dense: true,
            leading: Icon(Icons.settings_outlined),
            title: Text('Configuraciones'),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        const PopupMenuItem(
          value: 'sounds',
          child: ListTile(
            dense: true,
            leading: Icon(Icons.volume_up_outlined),
            title: Text('Sonidos'),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        PopupMenuItem(
          value: 'location',
          child: ListTile(
            dense: true,
            leading: const Icon(Icons.location_on_outlined),
            title: Text(locationMenuLabel),
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          ),
        ),
        if (showGroupVideo)
          const PopupMenuItem(
            value: 'group_video',
            child: ListTile(
              dense: true,
              leading: Icon(Icons.videocam_outlined),
              title: Text('Video en vivo'),
              contentPadding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
            ),
          ),
        if (showRadioMute)
          PopupMenuItem(
            value: 'radio_mute',
            child: ListTile(
              dense: true,
              leading: Icon(
                radioMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
              ),
              title: Text(
                radioMuted ? 'Activar audio radio' : 'Silenciar radio',
              ),
              contentPadding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
            ),
          ),
        if (showClearCallLog)
          const PopupMenuItem(
            value: 'clear_calls',
            child: ListTile(
              dense: true,
              leading: Icon(Icons.delete_sweep_outlined),
              title: Text('Borrar registro de llamadas'),
              contentPadding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
            ),
          ),
        if (showLogout) ...[
          const PopupMenuDivider(),
          const PopupMenuItem(
            value: 'logout',
            child: ListTile(
              dense: true,
              leading: Icon(Icons.logout, color: kInstDanger),
              title: Text('Salir', style: TextStyle(color: kInstDanger)),
              contentPadding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
            ),
          ),
        ],
      ],
    );
  }
}
