import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../app_focus.dart';
import '../background_radio.dart';
import '../channel_session.dart';
import '../config.dart';
import '../location_heartbeat.dart';
import '../push_service.dart';
import '../theme.dart';
import 'chat_panel.dart';
import 'direct_pane.dart';
import 'incoming_call_screen.dart';
import 'radio_screen.dart';

/// Home post-login: Radio PTT + atajos inferiores (Chat, GPS, Cámara, Directos, Grupos).
class RadioShell extends StatefulWidget {
  const RadioShell({super.key, required this.api, required this.onLogout});

  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<RadioShell> createState() => _RadioShellState();
}

enum _ShellPane { radio, chat, location, direct, groups }

class _RadioShellState extends State<RadioShell> with WidgetsBindingObserver {
  List<Map<String, dynamic>> _groups = [];
  int _channelIndex = 0;
  ChannelSession? _session;
  _ShellPane _pane = _ShellPane.radio;
  bool _loading = true;
  String? _loadError;
  bool _panicDialogOpen = false;
  bool _privateCallDialogOpen = false;
  bool _dmBadge = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    BackgroundRadio.stop();
    LocationHeartbeat.stop();
    final s = _session;
    if (s != null) {
      s.removeListener(_onSession);
      s.disposeSession();
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    appInBackground = state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached;
    if (state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      final name = _session?.groupName;
      BackgroundRadio.start(channelName: name).catchError((_) {});
    }
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      await BackgroundRadio.init();
      await BackgroundRadio.requestPermissions();
      await LocationHeartbeat.start(widget.api);
      final groups = await widget.api.fetchGroups();
      final prefs = await SharedPreferences.getInstance();
      var idx = prefs.getInt('tacticalptx_channel_index') ??
          prefs.getInt('pulsanet_channel_index') ??
          0;
      if (groups.isEmpty) {
        setState(() {
          _groups = [];
          _loading = false;
          _loadError = 'Sin grupos asignados';
        });
        return;
      }
      if (idx < 0 || idx >= groups.length) idx = 0;
      await _bindChannel(groups, idx);
      setState(() {
        _groups = groups;
        _channelIndex = idx;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  Future<void> _bindChannel(List<Map<String, dynamic>> groups, int index) async {
    final g = groups[index];
    final old = _session;
    if (old != null) {
      old.removeListener(_onSession);
      await old.disposeSession();
    }
    final session = ChannelSession(api: widget.api, group: g);
    session.addListener(_onSession);
    session.start();
    _session = session;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('tacticalptx_channel_index', index);
    await BackgroundRadio.start(channelName: g['name']?.toString() ?? 'Canal');
  }

  void _onSession() {
    if (!mounted) return;
    final session = _session;
    if (session == null) return;
    setState(() {});

    if (session.incomingPrivateCall != null && !_privateCallDialogOpen) {
      _privateCallDialogOpen = true;
      final call = Map<String, dynamic>.from(session.incomingPrivateCall!);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showIncomingPrivateCall(call);
      });
    } else if (session.incomingPrivateCall == null && _privateCallDialogOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        if (nav.canPop()) nav.pop();
        _privateCallDialogOpen = false;
      });
    }

    final dm = session.lastDmNotify;
    if (dm != null) {
      session.lastDmNotify = null;
      final peerName = dm['peerName']?.toString() ?? 'Mensaje';
      final preview = dm['preview']?.toString() ?? '';
      final peerId = dm['peerId']?.toString();
      if (_pane != _ShellPane.direct || appInBackground) {
        _dmBadge = _pane != _ShellPane.direct;
        PushService.instance.showLocal(
          title: peerName,
          body: preview,
          payload: peerId != null ? 'peer:$peerId' : null,
        );
        if (!appInBackground && _pane != _ShellPane.direct) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('$peerName: $preview'),
                action: SnackBarAction(
                  label: 'Abrir',
                  onPressed: () {
                    setState(() {
                      _pane = _ShellPane.direct;
                      _dmBadge = false;
                    });
                  },
                ),
                duration: const Duration(seconds: 5),
              ),
            );
          });
        }
      }
    }

    if (session.incomingPanicActive && !_panicDialogOpen) {
      _panicDialogOpen = true;
      final who = session.incomingPanicLabel ?? 'Operador';
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => PopScope(
            canPop: false,
            child: AlertDialog(
              backgroundColor: const Color(0xFFFFE4E1),
              title: const Text(
                'ALERTA DE PÁNICO',
                style: TextStyle(color: kRadioDanger),
              ),
              content: Text(
                '$who necesita ayuda en este canal.\nLa alarma suena hasta pulsar Enterado.',
              ),
              actions: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: kRadioDanger),
                  onPressed: () async {
                    await session.ackIncomingPanic();
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  child: const Text('Enterado'),
                ),
              ],
            ),
          ),
        ).whenComplete(() {
          _panicDialogOpen = false;
        });
      });
    } else if (!session.incomingPanicActive && _panicDialogOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        if (nav.canPop()) nav.pop();
        _panicDialogOpen = false;
      });
    }
  }

  Future<void> _showIncomingPrivateCall(Map<String, dynamic> call) async {
    final who = call['callerName']?.toString() ?? 'Usuario';
    final callId = call['callId']?.toString();
    if (callId == null) {
      _privateCallDialogOpen = false;
      return;
    }
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, anim, secondary) {
        return IncomingCallScreen(
          callerName: who,
          onReject: () async {
            try {
              await widget.api.endPrivateCall(callId, reason: 'reject');
            } catch (_) {}
            _session?.incomingPrivateCall = null;
            if (ctx.mounted) Navigator.of(ctx).pop();
          },
          onAccept: () async {
            try {
              final data = await widget.api.acceptPrivateCall(callId);
              _session?.incomingPrivateCall = null;
              if (!ctx.mounted) return;
              Navigator.of(ctx).pop();
              if (!mounted) return;
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PrivateCallScreen(
                    api: widget.api,
                    callId: data['call']['callId'] as String,
                    peerName: who,
                    token: data['token'] as String,
                    url: AppConfig.publicLiveKitUrl(data['url'] as String),
                    role: 'callee',
                    e2eeKey: data['e2eeKey']?.toString(),
                  ),
                ),
              );
            } catch (e) {
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(e.toString())),
              );
              if (ctx.mounted) Navigator.of(ctx).pop();
            }
          },
        );
      },
    ).whenComplete(() {
      _privateCallDialogOpen = false;
    });
  }

  Future<void> _changeChannel(int index) async {
    if (index == _channelIndex || index < 0 || index >= _groups.length) return;
    setState(() => _channelIndex = index);
    await _bindChannel(_groups, index);
    setState(() {});
  }

  Future<void> _confirmPanic() async {
    final session = _session;
    if (session == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Alerta de pánico'),
        content: const Text(
          'Se avisará a tu grupo, a Administración, Despacho y a quienes tengan permiso de pánico. ¿Continuar?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: kRadioDanger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ENVIAR PÁNICO'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final success = await session.triggerPanic();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Alerta de pánico enviada' : (session.error ?? 'No se pudo enviar')),
        backgroundColor: success ? kRadioDanger : null,
      ),
    );
  }

  Future<void> _pickCamera() async {
    final session = _session;
    if (session == null) return;
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (x == null) return;
    try {
      await session.sendMediaFile(
        path: x.path,
        filename: x.name,
        mime: x.mimeType,
        type: 'image',
      );
      if (!mounted) return;
      setState(() => _pane = _ShellPane.chat);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Imagen enviada al canal')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  int get _navIndex {
    switch (_pane) {
      case _ShellPane.chat:
        return 0;
      case _ShellPane.location:
        return 1;
      case _ShellPane.radio:
        return -1; // no item
      case _ShellPane.direct:
        return 3;
      case _ShellPane.groups:
        return 4;
    }
  }

  void _onNavTap(int i) {
    switch (i) {
      case 0:
        setState(() => _pane = _ShellPane.chat);
        return;
      case 1:
        setState(() => _pane = _ShellPane.location);
        return;
      case 2:
        _pickCamera();
        return;
      case 3:
        setState(() {
          _pane = _ShellPane.direct;
          _dmBadge = false;
        });
        return;
      case 4:
        setState(() => _pane = _ShellPane.groups);
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.api.user?['displayName']?.toString() ?? 'Usuario';

    if (_loading) {
      return const Scaffold(
        backgroundColor: kInstPaper,
        body: Center(
          child: CircularProgressIndicator(color: kInstOlive, strokeWidth: 3),
        ),
      );
    }
    if (_loadError != null || _session == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('TacticalPtx')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_loadError ?? 'Sin sesión de canal', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: _bootstrap, child: const Text('Reintentar')),
                TextButton(onPressed: widget.onLogout, child: const Text('Salir')),
              ],
            ),
          ),
        ),
      );
    }

    final session = _session!;
    final selectedNav = _navIndex;

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        child: switch (_pane) {
          _ShellPane.radio => KeyedSubtree(
              key: const ValueKey('radio'),
              child: RadioScreen(
                session: session,
                displayName: name,
                groups: _groups,
                channelIndex: _channelIndex,
                onChannelChanged: _changeChannel,
                onOpenMenu: () => setState(() => _pane = _ShellPane.groups),
                onPanic: _confirmPanic,
                onOpenProfile: () => setState(() => _pane = _ShellPane.groups),
              ),
            ),
          _ShellPane.chat => KeyedSubtree(
              key: const ValueKey('chat'),
              child: Column(
                children: [
                  SafeArea(
                    bottom: false,
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => setState(() => _pane = _ShellPane.radio),
                          icon: const Icon(Icons.arrow_back),
                        ),
                        const Expanded(
                          child: Text(
                            'Chat',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(right: 12),
                          child: Text(
                            session.groupName,
                            style: const TextStyle(color: kRadioMuted, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: ChatPanel(api: widget.api, session: session),
                  ),
                ],
              ),
            ),
          _ShellPane.location => KeyedSubtree(
              key: const ValueKey('loc'),
              child: _LocationPane(
                session: session,
                onBack: () => setState(() => _pane = _ShellPane.radio),
              ),
            ),
          _ShellPane.direct => KeyedSubtree(
              key: const ValueKey('direct'),
              child: DirectPane(
                api: widget.api,
                onBack: () => setState(() => _pane = _ShellPane.radio),
              ),
            ),
          _ShellPane.groups => KeyedSubtree(
              key: const ValueKey('groups'),
              child: _GroupsPane(
                groups: _groups,
                selectedIndex: _channelIndex,
                displayName: name,
                onBack: () => setState(() => _pane = _ShellPane.radio),
                onSelect: (i) async {
                  await _changeChannel(i);
                  if (mounted) setState(() => _pane = _ShellPane.radio);
                },
                onReload: _bootstrap,
                onLogout: widget.onLogout,
              ),
            ),
        },
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: kRadioSurface,
          border: Border(top: BorderSide(color: Color(0xFFC2CBB8))),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _NavCircle(
                  icon: Icons.chat_bubble_outline,
                  selected: selectedNav == 0,
                  onTap: () => _onNavTap(0),
                ),
                _NavCircle(
                  icon: Icons.location_on_outlined,
                  selected: selectedNav == 1,
                  onTap: () => _onNavTap(1),
                ),
                _NavCircle(
                  icon: Icons.photo_camera_outlined,
                  selected: false,
                  onTap: () => _onNavTap(2),
                ),
                _NavCircle(
                  icon: Icons.person_outline,
                  selected: selectedNav == 3,
                  badge: _dmBadge && selectedNav != 3,
                  onTap: () => _onNavTap(3),
                ),
                _NavCircle(
                  icon: Icons.groups_outlined,
                  selected: selectedNav == 4,
                  onTap: () => _onNavTap(4),
                ),
              ],
            ),
          ),
        ),
      ),
          floatingActionButton: (_pane == _ShellPane.radio ||
                  _pane == _ShellPane.chat ||
                  _pane == _ShellPane.direct)
              ? null
              : FloatingActionButton.small(
                  tooltip: 'Radio PTT',
                  onPressed: () => setState(() => _pane = _ShellPane.radio),
                  backgroundColor: kRadioBlue,
                  child: const Icon(Icons.mic, color: Colors.white),
                ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}

class _NavCircle extends StatelessWidget {
  const _NavCircle({
    required this.icon,
    required this.selected,
    required this.onTap,
    this.badge = false,
  });
  final IconData icon;
  final bool selected;
  final bool badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? kRadioBlue.withValues(alpha: 0.18) : kRadioSurface,
      shape: const CircleBorder(),
      elevation: 0,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(icon, color: selected ? kRadioBlue : kRadioInk),
              if (badge)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: kTacticalGold,
                      shape: BoxShape.circle,
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

class _LocationPane extends StatelessWidget {
  const _LocationPane({required this.session, required this.onBack});
  final ChannelSession session;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Row(
            children: [
              IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)),
              const Text('Ubicación', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            ],
          ),
          const Spacer(),
          Icon(
            session.gpsOk ? Icons.my_location : Icons.location_disabled,
            size: 64,
            color: session.gpsOk ? kRadioBlue : kRadioMuted,
          ),
          const SizedBox(height: 16),
          Text(
            session.gpsOk
                ? 'GPS activo — enviando al despacho cada 5 s'
                : 'GPS no disponible o sin permiso',
            textAlign: TextAlign.center,
            style: const TextStyle(color: kRadioMuted),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _GroupsPane extends StatelessWidget {
  const _GroupsPane({
    required this.groups,
    required this.selectedIndex,
    required this.displayName,
    required this.onBack,
    required this.onSelect,
    required this.onReload,
    required this.onLogout,
  });

  final List<Map<String, dynamic>> groups;
  final int selectedIndex;
  final String displayName;
  final VoidCallback onBack;
  final ValueChanged<int> onSelect;
  final VoidCallback onReload;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)),
              Expanded(
                child: Text(
                  displayName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                ),
              ),
              IconButton(onPressed: onReload, icon: const Icon(Icons.refresh)),
              IconButton(
                onPressed: () async => onLogout(),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text('Canales', style: TextStyle(fontWeight: FontWeight.w700, color: kRadioMuted)),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: groups.length,
              separatorBuilder: (_, i) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final g = groups[i];
                final selected = i == selectedIndex;
                return ListTile(
                  selected: selected,
                  selectedTileColor: kRadioBlue.withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(
                      color: selected ? kRadioBlue : Colors.black.withValues(alpha: 0.06),
                    ),
                  ),
                  title: Text(
                    g['name'] as String? ?? 'Grupo',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(g['description'] as String? ?? ''),
                  trailing: selected
                      ? const Icon(Icons.check_circle, color: kRadioBlue)
                      : const Icon(Icons.chevron_right),
                  onTap: () => onSelect(i),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
