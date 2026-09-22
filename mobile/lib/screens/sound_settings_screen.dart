import 'package:flutter/material.dart';

import '../message_tone.dart';
import '../sound_prefs.dart';
import '../theme.dart';

/// Elige tonos de mensajes / llamadas / video / zumbido (misma fuente que
/// AudioPlayer y canales de notificación).
class SoundSettingsScreen extends StatefulWidget {
  const SoundSettingsScreen({super.key});

  @override
  State<SoundSettingsScreen> createState() => _SoundSettingsScreenState();
}

class _SoundSettingsScreenState extends State<SoundSettingsScreen> {
  AppToneId _message = AppToneId.tacticalMsg;
  AppToneId _call = AppToneId.system;
  AppToneId _video = AppToneId.system;
  AppToneId _nudge = AppToneId.nudgeBuzz;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final m = await SoundPrefs.messageTone();
    final c = await SoundPrefs.callTone();
    final v = await SoundPrefs.videoTone();
    final n = await SoundPrefs.nudgeTone();
    if (!mounted) return;
    setState(() {
      _message = m;
      _call = c;
      _video = v;
      _nudge = n;
      _loading = false;
    });
  }

  Future<void> _pick({
    required String title,
    required List<AppToneId> choices,
    required AppToneId current,
    required Future<void> Function(AppToneId) save,
  }) async {
    final selected = await showModalBottomSheet<AppToneId>(
      context: context,
      backgroundColor: kInstSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFC2CBB8),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              ListTile(
                title: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              for (final t in choices)
                ListTile(
                  leading: Icon(
                    t == current
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                    color: t == current ? kInstOlive : kInstMuted,
                  ),
                  title: Text(t.labelEs),
                  trailing: t == AppToneId.silent
                      ? null
                      : IconButton(
                          tooltip: 'Probar',
                          icon: const Icon(Icons.play_arrow_rounded),
                          onPressed: () => previewAppTone(t),
                        ),
                  onTap: () => Navigator.pop(ctx, t),
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    if (selected == null) return;
    await save(selected);
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Tono: ${selected.labelEs}'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kInstPaper,
      appBar: AppBar(
        title: const Text('Sonidos'),
        backgroundColor: kInstSurface,
        foregroundColor: kInstInk,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                Text(
                  'Los mismos tonos se usan en la app y en las notificaciones '
                  '(mensajes / zumbidos). Llamadas y video pueden usar el '
                  'timbre del teléfono.',
                  style: TacticalFonts.body(fontSize: 13, color: kInstMuted),
                ),
                const SizedBox(height: 12),
                _tile(
                  icon: Icons.chat_bubble_outline,
                  title: 'Mensajes',
                  value: _message.labelEs,
                  onTap: () => _pick(
                    title: 'Tono de mensajes',
                    choices: SoundPrefs.messageChoices,
                    current: _message,
                    save: SoundPrefs.setMessageTone,
                  ),
                ),
                _tile(
                  icon: Icons.call_outlined,
                  title: 'Llamadas de voz',
                  value: _call.labelEs,
                  onTap: () => _pick(
                    title: 'Tono de llamadas',
                    choices: SoundPrefs.callChoices,
                    current: _call,
                    save: SoundPrefs.setCallTone,
                  ),
                ),
                _tile(
                  icon: Icons.videocam_outlined,
                  title: 'Videollamadas',
                  value: _video.labelEs,
                  onTap: () => _pick(
                    title: 'Tono de videollamadas',
                    choices: SoundPrefs.callChoices,
                    current: _video,
                    save: SoundPrefs.setVideoTone,
                  ),
                ),
                _tile(
                  icon: Icons.vibration,
                  title: 'Zumbidos (DM)',
                  value: _nudge.labelEs,
                  onTap: () => _pick(
                    title: 'Tono de zumbido',
                    choices: SoundPrefs.messageChoices,
                    current: _nudge,
                    save: SoundPrefs.setNudgeTone,
                  ),
                ),
              ],
            ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String title,
    required String value,
    required VoidCallback onTap,
  }) {
    return Card(
      color: kInstSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: kInstBorder),
      ),
      child: ListTile(
        leading: Icon(icon, color: kInstOlive),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(value, style: const TextStyle(color: kInstMuted)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
