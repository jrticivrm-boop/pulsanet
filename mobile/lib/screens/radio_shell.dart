import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../app_focus.dart';
import '../audio_session_setup.dart';
import '../background_radio.dart';
import '../call_ringtone.dart';
import '../channel_session.dart';
import '../config.dart';
import '../es_msg.dart';
import '../incoming_call_wake.dart';
import '../location_heartbeat.dart';
import '../chat_message_banner.dart';
import '../user_display.dart';
import '../message_tone.dart';
import '../nudge_shake.dart';
import '../panic_maps.dart';
import '../panic_vibration.dart';
import '../private_call_gate.dart';
import '../push_service.dart';
import '../remote_camera_prefs.dart';
import '../remote_camera_session.dart';
import '../remote_camera_wake.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets/tactical_backdrop.dart';
import '../widgets/user_avatar.dart';
import 'call_history_pane.dart';
import 'chat_inbox_screen.dart';
import 'direct_pane.dart';
import 'gps_track_screen.dart';
import 'group_video_screen.dart';
import 'incoming_call_screen.dart';
import 'private_call_screen.dart';
import 'radio_screen.dart';
import 'sound_settings_screen.dart';

/// Home post-login: Chats + Llamadas + Radio PTT (+ GPS para mando).
class RadioShell extends StatefulWidget {
  const RadioShell({super.key, required this.api, required this.onLogout});

  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<RadioShell> createState() => _RadioShellState();
}

enum _MainTab { chats, calls, radio, gps }

enum _OverlayPane { none, location, groups }

class _RadioShellState extends State<RadioShell> with WidgetsBindingObserver {
  final _inboxKey = GlobalKey<ChatInboxScreenState>();
  List<Map<String, dynamic>> _groups = [];
  int _channelIndex = 0;
  /// Índice del grupo real usado como home en Canal abierto.
  int _homeGroupIndex = 0;
  ChannelSession? _session;
  _MainTab _tab = _MainTab.chats;
  _OverlayPane _overlay = _OverlayPane.none;
  bool _loading = true;
  String? _loadError;
  bool _privateCallDialogOpen = false;
  bool _groupVideoDialogOpen = false;
  int _chatUnread = 0;
  bool _conversationOpen = false;
  String? _viewingKind;
  String? _viewingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ChatMessageBanner.instance.onTap = _onMessageBannerTap;
    AudioSessionSetup.shouldKeepVoiceMode = () =>
        PrivateCallGate.uiOpen ||
        GroupVideoScreen.uiOpen ||
        _privateCallDialogOpen ||
        _groupVideoDialogOpen ||
        (_session?.holding == true) ||
        (_session?.pttArmed == true) ||
        BackgroundRadio.remoteMicActive ||
        BackgroundRadio.privateCallActive ||
        CallRingtone.isActive ||
        CallRingtone.isOutgoingActive;
    _registerPushNavHandlers();
    _bootstrap();
  }

  void _onMessageBannerTap(ChatMessageBannerPayload p) {
    if (p.kind == 'dm' && p.peerId != null && p.peerId!.isNotEmpty) {
      _openFromNotification(peerId: p.peerId);
      return;
    }
    if (p.kind == 'group') {
      final gid = p.groupId;
      if (gid != null && gid.isNotEmpty) {
        _openFromNotification(groupId: gid);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    AudioSessionSetup.shouldKeepVoiceMode = null;
    clearViewingChat();
    final push = PushService.instance;
    push.onNotificationOpen = null;
    push.onNotificationData = null;
    BackgroundRadio.stop();
    LocationHeartbeat.stop();
    final s = _session;
    if (s != null) {
      s.removeListener(_onSession);
      s.disposeSession();
    }
    AudioSessionSetup.releaseAll();
    super.dispose();
  }

  void _registerPushNavHandlers() {
    final push = PushService.instance;
    push.onNotificationOpen = (groupId) {
      final mid = push.pendingMessageId;
      _openFromNotification(groupId: groupId, messageId: mid);
    };
    push.onNotificationData = (data) {
      final type = data['type']?.toString();
      if (type == 'dm' || type == 'dm_nudge') {
        _openFromNotification(
          peerId: data['peerId']?.toString(),
          messageId: data['messageId']?.toString(),
        );
        return;
      }
      if (type == 'private_call' ||
          type == 'private_radio' ||
          type == 'private_video' ||
          type == 'private_call_invite' ||
          type == 'private_video_invite' ||
          type == 'private_remote_camera' ||
          type == 'private_video_request') {
        unawaited(_openIncomingCallFromPush(Map<String, dynamic>.from(data)));
        return;
      }
      if (type == 'missed_call') {
        final peerId = data['callerId']?.toString() ?? data['peerId']?.toString();
        if (peerId != null && peerId.isNotEmpty) {
          _openFromNotification(peerId: peerId);
        } else {
          setState(() => _tab = _MainTab.calls);
        }
        unawaited(CallRingtone.stop());
        return;
      }
      if (type == 'group_video') {
        unawaited(_openIncomingGroupVideoFromPush(Map<String, dynamic>.from(data)));
        return;
      }
      if (type == 'panic') {
        unawaited(_openPanicFromNotification(data));
        return;
      }
      if (type == 'announcement') {
        _session?.applyAnnouncement(Map<String, dynamic>.from(data));
        return;
      }
      final groupId = data['groupId']?.toString();
      if (groupId != null && groupId.isNotEmpty) {
        _openFromNotification(
          groupId: groupId,
          messageId: data['messageId']?.toString(),
        );
      }
    };
  }

  /// Tap en push de pánico: ir al canal Radio y mostrar overlay con ubicación.
  Future<void> _openPanicFromNotification(Map<String, dynamic> data) async {
    if (!mounted) return;
    final groupId = data['groupId']?.toString();
    if (groupId == null || groupId.isEmpty) return;

    if (_loading || _session == null || _groups.isEmpty) {
      PushService.instance.pendingGroupId = groupId;
      PushService.instance.pendingPanicData = data;
      return;
    }

    final idx = _groups.indexWhere((g) => g['id']?.toString() == groupId);
    setState(() {
      _tab = _MainTab.radio;
      _overlay = _OverlayPane.none;
    });
    PushService.instance.clearConversationNotifications(groupId: groupId);

    final radioIdx = idx >= 0 ? _radioIndexForGroupId(groupId) : -1;
    if (radioIdx >= 0 && radioIdx != _channelIndex) {
      await _changeChannel(radioIdx, forChatOpen: true);
      if (!mounted) return;
    }

    final session = _session;
    if (session == null) return;

    // Preferir coords del push; si faltan, sync REST.
    final hasCoords =
        data['latitude'] != null && data['longitude'] != null;
    if (hasCoords || data['panicId'] != null || data['id'] != null) {
      session.applyIncomingPanic({
        ...data,
        'id': data['id'] ?? data['panicId'],
        'displayName': data['displayName'] ?? data['title'] ?? 'Operador',
      });
    }
    if (!session.incomingPanicHasLocation) {
      final panicId = data['panicId']?.toString() ?? data['id']?.toString();
      if (panicId != null && panicId.isNotEmpty) {
        try {
          final event = await widget.api.fetchPanicEvent(panicId);
          if (!mounted) return;
          session.applyIncomingPanic(event);
        } catch (_) {
          await session.syncActivePanic();
        }
      } else {
        await session.syncActivePanic();
      }
    }
  }

  /// Abre chat de grupo o hilo DM tras tap en notificación (estilo WhatsApp).
  Future<void> _openFromNotification({
    String? groupId,
    String? peerId,
    String? messageId,
  }) async {
    if (!mounted) return;

    // DM: no depende de grupos ni de LiveKit — abrir ya.
    if (peerId != null && peerId.isNotEmpty) {
      setState(() {
        _tab = _MainTab.chats;
        _overlay = _OverlayPane.none;
      });
      PushService.instance.clearConversationNotifications(peerId: peerId);
      PushService.instance.pendingPeerId = null;
      PushService.instance.pendingMessageId = null;
      _inboxKey.currentState?.clearUnread('dm', peerId);
      // ignore: unawaited_futures
      _pushDmChat(peerId, 'Chat');
      return;
    }

    // Cold start / race grupo: aún cargando → pending.
    if (_loading || _session == null || _groups.isEmpty) {
      final push = PushService.instance;
      if (groupId != null && groupId.isNotEmpty) push.pendingGroupId = groupId;
      if (messageId != null && messageId.isNotEmpty) {
        push.pendingMessageId = messageId;
      }
      return;
    }

    if (groupId == null || groupId.isEmpty) return;

    final idx = _groups.indexWhere((g) => g['id']?.toString() == groupId);
    final gname = idx >= 0
        ? (_groups[idx]['name']?.toString() ?? 'Grupo')
        : 'Grupo';

    setState(() {
      _tab = _MainTab.chats;
      _overlay = _OverlayPane.none;
    });
    _inboxKey.currentState?.clearUnread('group', groupId);
    PushService.instance.clearConversationNotifications(groupId: groupId);

    // Cambiar canal sin bloquear la UI más de lo necesario; luego empujar chat.
    final radioIdx = idx >= 0 ? _radioIndexForGroupId(groupId) : -1;
    if (radioIdx >= 0 && radioIdx != _channelIndex) {
      await _changeChannel(radioIdx, forChatOpen: true);
      if (!mounted) return;
    }

    // ignore: unawaited_futures
    _pushGroupChat(
      groupId,
      gname,
      messageId: messageId,
      autofocus: messageId != null && messageId.isNotEmpty,
    );
    PushService.instance.pendingGroupId = null;
    PushService.instance.pendingMessageId = null;
  }

  void _consumePendingNotificationNav() {
    final push = PushService.instance;
    final incomingCall = push.pendingIncomingCall;
    final incomingGroupVideo = push.pendingIncomingGroupVideo;
    final panic = push.pendingPanicData;
    final peerId = push.pendingPeerId;
    final groupId = push.pendingGroupId;
    final messageId = push.pendingMessageId;
    push.clearPendingNavigation();
    if (incomingCall != null) {
      unawaited(_openIncomingCallFromPush(Map<String, dynamic>.from(incomingCall)));
      return;
    }
    if (incomingGroupVideo != null) {
      unawaited(_openIncomingGroupVideoFromPush(Map<String, dynamic>.from(incomingGroupVideo)));
      return;
    }
    if (panic != null) {
      unawaited(_openPanicFromNotification(panic));
      return;
    }
    if (peerId != null && peerId.isNotEmpty) {
      _openFromNotification(peerId: peerId, messageId: messageId);
    } else if (groupId != null && groupId.isNotEmpty) {
      _openFromNotification(groupId: groupId, messageId: messageId);
    }
    // Tras push/nav: drenar wakes persistidos.
    unawaited(_drainIncomingCallWake());
    unawaited(_drainRemoteCameraWake());
  }

  Future<void> _drainIncomingCallWake() async {
    if (!mounted) return;
    // Rechazo desde CallStyle nativo (app aún no viva).
    try {
      final rejectId = await IncomingCallWake.takeNativeRejectCallId();
      if (rejectId != null && rejectId.isNotEmpty) {
        await IncomingCallWake.rejectFromNotification(rejectId);
        unawaited(
          PushService.instance.clearConversationNotifications(callId: rejectId),
        );
      }
    } catch (e) {
      debugPrint('drain native reject: $e');
    }
    if (_privateCallDialogOpen || PrivateCallScreen.uiOpen) return;
    final pending = await IncomingCallWake.takePending();
    if (pending == null) return;
    final callId = pending['callId']?.toString() ?? '';
    final callerId = pending['callerId']?.toString() ?? '';
    if (PrivateCallScreen.isBusyWith(callId: callId, peerId: callerId)) return;
    await _openIncomingCallFromPush(Map<String, dynamic>.from(pending));
  }

  /// Activa cámara remota pendiente (FCM con app cerrada / pantalla bloqueada).
  Future<void> _drainRemoteCameraWake() async {
    if (!mounted) return;
    if (RemoteCameraSession.instance.isActive) return;
    final pending = await RemoteCameraWake.takePending();
    if (pending == null) return;
    if (!await RemoteCameraPrefs.canAutoAccept()) return;
    final callId = pending['callId']?.toString() ?? '';
    if (callId.isEmpty) return;
    _session?.incomingPrivateCall = null;
    _privateCallDialogOpen = false;
    await RemoteCameraSession.instance.startSilent(
      api: widget.api,
      call: pending,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    appInBackground = state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached;
    _session?.pingPresenceFocus();
    final name = _session?.groupName;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      // Minimizar / multitarea: volumen multimedia (no «llamadas»), salvo PTT/llamada.
      final sess = _session;
      if (!PrivateCallGate.uiOpen &&
          !GroupVideoScreen.uiOpen &&
          sess != null &&
          !sess.holding &&
          !sess.pttArmed) {
        unawaited(AudioSessionSetup.reclaimNormalVolume(forceFull: true));
      }
      BackgroundRadio.start(channelName: name).catchError((_) {});
      LocationHeartbeat.start(widget.api).catchError((_) {});
      _session?.ensureBackgroundAudio();
      if (RemoteCameraSession.instance.isActive) {
        unawaited(BackgroundRadio.setRemoteCameraActive(true));
      }
    } else if (state == AppLifecycleState.detached) {
      unawaited(AudioSessionSetup.reclaimNormalVolume(forceFull: true));
    } else if (state == AppLifecycleState.resumed) {
      BackgroundRadio.start(channelName: name).catchError((_) {});
      LocationHeartbeat.start(widget.api).catchError((_) {});
      // En llamada: no reclaim multimedia (baja el volumen / silencia WebRTC).
      if (PrivateCallGate.uiOpen ||
          GroupVideoScreen.uiOpen ||
          _privateCallDialogOpen ||
          BackgroundRadio.privateCallActive) {
        // Solo reafirmar presencia; el PrivateCallScreen reasegura voz.
      } else {
        _session?.ensureBackgroundAudio();
        unawaited(AudioSessionSetup.reclaimNormalVolume());
      }
      if (RemoteCameraSession.instance.isActive) {
        unawaited(BackgroundRadio.setRemoteCameraActive(true));
      }
      unawaited(_drainRemoteCameraWake());
      unawaited(_drainIncomingCallWake());
      unawaited(_session?.refreshChatHistory() ?? Future<void>.value());
      unawaited(_session?.syncActivePanic() ?? Future<void>.value());
      unawaited(_inboxKey.currentState?.refreshInbox() ?? Future<void>.value());
      if (_conversationOpen) {
        _clearCurrentChatNotifications(markMessages: true);
      } else if (_tab == _MainTab.chats) {
        PushService.instance.clearAllNotifications();
      }
    }
  }

  /// Al abrir el chat del canal (nav u otra ruta): limpia bandeja estilo WhatsApp.
  void _clearCurrentChatNotifications({bool markMessages = true}) {
    final gid = _session?.groupId;
    if (gid != null) {
      PushService.instance.clearConversationNotifications(
        groupId: gid,
        alsoClearAll: true,
      );
      if (markMessages) {
        final last = _session?.messages;
        if (last != null && last.isNotEmpty) {
          _session?.markRead(last.last.id);
        }
      }
    } else {
      PushService.instance.clearAllNotifications();
    }
  }

  static const _kGroupsCache = 'tacticalptx_groups_cache';

  Future<List<Map<String, dynamic>>?> _readGroupsCache(
    SharedPreferences prefs,
  ) async {
    final raw = prefs.getString(_kGroupsCache);
    if (raw == null || raw.isEmpty) return null;
    try {
      final list = jsonDecode(raw) as List;
      return [
        for (final e in list) Map<String, dynamic>.from(e as Map),
      ];
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeGroupsCache(
    SharedPreferences prefs,
    List<Map<String, dynamic>> groups,
  ) async {
    try {
      await prefs.setString(_kGroupsCache, jsonEncode(groups));
    } catch (_) {}
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loadError = null;
    });
    try {
      // Ticket ya viene de sesión; no forzar red al abrir (el display usa Bearer).
      unawaited(widget.api.ensureAvatarTicket());

      // Permisos / FGS / GPS en paralelo; no bloquean abrir un DM desde notificación.
      // No AudioSessionSetup aquí: solo al conectar LiveKit / llamada.
      final bgFut =
          BackgroundRadio.init().then((_) => BackgroundRadio.requestPermissions());
      final locFut = LocationHeartbeat.start(widget.api);

      final prefs = await SharedPreferences.getInstance();
      var idx = prefs.getInt('tacticalptx_channel_index') ?? 0;
      final cached = await _readGroupsCache(prefs);
      var usedCache = false;

      // Reapertura: pintar home al instante con el último listado de grupos.
      if (cached != null && cached.isNotEmpty) {
        final cachedCount =
            cached.length >= 2 ? cached.length + 1 : cached.length;
        if (idx < 0 || idx >= cachedCount) idx = 0;
        usedCache = true;
        await _bindChannel(cached, idx, light: true);
        if (!mounted) return;
        setState(() {
          _groups = cached;
          _channelIndex = idx;
          _loading = false;
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _consumePendingNotificationNav();
          if (mounted) unawaited(_ensureRemoteCameraConsent());
        });
      } else {
        setState(() => _loading = true);
      }

      final groups = await widget.api
          .fetchGroups()
          .timeout(const Duration(seconds: 8));
      await _writeGroupsCache(prefs, groups);

      if (groups.isEmpty) {
        await Future.wait([bgFut, locFut]).catchError((_) => <void>[]);
        setState(() {
          _groups = [];
          _loading = false;
          _loadError = 'Sin grupos asignados';
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _consumePendingNotificationNav();
          if (mounted) unawaited(_ensureRemoteCameraConsent());
        });
        return;
      }
      final channelCount = groups.length >= 2 ? groups.length + 1 : groups.length;
      if (idx < 0 || idx >= channelCount) idx = 0;

      final cacheId = usedCache && _radioChannels.isNotEmpty
          ? _radioChannels[
                  _channelIndex.clamp(0, _radioChannels.length - 1)]['id']
              ?.toString()
          : null;
      // Comparar por canal real de home si es abierto.
      final sel = (groups.length >= 2 && idx == 0)
          ? groups[_homeGroupIndex.clamp(0, groups.length - 1)]
          : groups[(groups.length >= 2 ? idx - 1 : idx)
              .clamp(0, groups.length - 1)];
      final freshId = sel['id']?.toString();

      setState(() {
        _groups = groups;
        _channelIndex = idx;
        _loading = false;
        _loadError = null;
      });
      if (!usedCache) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _consumePendingNotificationNav();
          if (mounted) unawaited(_ensureRemoteCameraConsent());
        });
      }

      // Rebind solo si no había cache o cambió el canal en esa posición.
      if (!usedCache || cacheId != freshId) {
        await _bindChannel(groups, idx, light: true);
      }
      await Future.wait([bgFut, locFut]).catchError((_) => <void>[]);
    } catch (e) {
      // Con cache ya visible, no tumbar la UI por un fallo de red puntual.
      if (_groups.isEmpty) {
        setState(() {
          _loading = false;
          _loadError = _friendlyBootError(e);
        });
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _consumePendingNotificationNav();
      });
    }
  }

  /// Primera vez: permiso de cámara.
  Future<void> _ensureRemoteCameraConsent() async {
    if (!mounted) return;
    if (await RemoteCameraPrefs.wasPrompted()) {
      if (await RemoteCameraPrefs.isEnabled()) {
        await RemoteCameraPrefs.ensureOsCameraPermission();
      }
      return;
    }

    if (!mounted) return;
    final allow = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Permiso de cámaras'),
        content: const Text('Permiso de cámaras únicamente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Ahora no'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Permitir'),
          ),
        ],
      ),
    );

    if (allow == true) {
      final granted = await RemoteCameraPrefs.ensureOsCameraPermission();
      await RemoteCameraPrefs.setEnabled(granted);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            granted
                ? 'Permiso de cámaras concedido.'
                : 'Permiso de cámaras denegado.',
          ),
        ),
      );
    } else {
      await RemoteCameraPrefs.setEnabled(false);
    }
  }

  Future<void> _toggleRemoteCameraPref(bool value) async {
    if (value) {
      final granted = await RemoteCameraPrefs.ensureOsCameraPermission();
      if (!granted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Permiso de cámaras únicamente.',
              ),
            ),
          );
        }
        await RemoteCameraPrefs.setEnabled(false);
        if (mounted) setState(() {});
        return;
      }
    }
    await RemoteCameraPrefs.setEnabled(value);
    if (mounted) setState(() {});
  }

  String _friendlyBootError(Object e) {
    final s = e.toString();
    if (s.contains('TimeoutException') ||
        s.contains('SocketException') ||
        s.contains('Failed host lookup') ||
        s.contains('Connection refused') ||
        s.contains('Connection timed out')) {
      return 'No hay conexión con el servidor '
          '(${AppConfig.apiBaseUrl}).\n\n'
          'Instala la APK más reciente o verifica la red 4G/Wi‑Fi.';
    }
    if (s.startsWith('Exception: ')) return s.substring(11);
    return s;
  }

  List<Map<String, dynamic>> get _radioChannels {
    if (_groups.length < 2) return _groups;
    return [
      {
        'id': ChannelSession.kOpenChannelId,
        'name': 'Canal abierto',
        '_open': true,
      },
      ..._groups,
    ];
  }

  bool get _hasOpenChannel => _groups.length >= 2;

  int _radioIndexForGroupId(String groupId) {
    final gi = _groups.indexWhere((g) => g['id']?.toString() == groupId);
    if (gi < 0) return _channelIndex;
    return _hasOpenChannel ? gi + 1 : gi;
  }

  Future<void> _bindChannel(
    List<Map<String, dynamic>> groups,
    int index, {
    bool light = false,
  }) async {
    final channels = _hasOpenChannel
        ? [
            {
              'id': ChannelSession.kOpenChannelId,
              'name': 'Canal abierto',
              '_open': true,
            },
            ...groups,
          ]
        : groups;
    if (index < 0 || index >= channels.length) index = 0;
    final selected = channels[index];
    final isOpen = selected['_open'] == true ||
        selected['id']?.toString() == ChannelSession.kOpenChannelId;

    Map<String, dynamic> home;
    if (isOpen) {
      final hi = _homeGroupIndex.clamp(0, groups.length - 1);
      home = groups[hi];
    } else {
      home = selected;
      final realIdx = groups.indexWhere((g) => g['id'] == home['id']);
      if (realIdx >= 0) _homeGroupIndex = realIdx;
    }

    final old = _session;
    if (old != null) {
      old.removeListener(_onSession);
      if (light) {
        // ignore: unawaited_futures
        old.disposeSession();
      } else {
        await old.disposeSession();
      }
    }
    final session = ChannelSession(
      api: widget.api,
      group: home,
      memberships: groups,
      openChannel: isOpen,
    );
    session.addListener(_onSession);
    // ignore: unawaited_futures
    session.start();
    _session = session;
    // ignore: unawaited_futures
    SharedPreferences.getInstance().then((prefs) {
      return prefs.setInt('tacticalptx_channel_index', index);
    });
    // ignore: unawaited_futures
    BackgroundRadio.start(
      channelName: isOpen
          ? 'Canal abierto'
          : (home['name']?.toString() ?? 'Canal'),
      forceRestart: true,
    );
  }

  Future<void> _changeChannel(int index, {bool forChatOpen = false}) async {
    final n = _radioChannels.length;
    if (index == _channelIndex || index < 0 || index >= n) return;
    setState(() => _channelIndex = index);
    await _bindChannel(_groups, index, light: forChatOpen);
    if (mounted) setState(() {});
  }

  bool _sessionUiScheduled = false;

  void _onSession() {
    if (!mounted) return;
    final session = _session;
    if (session == null) return;
    // Coalesce notifyListeners del canal en un solo setState por frame
    // (antes cada evento de presencia/PTT/chat reconstruía todo RadioShell).
    if (!_sessionUiScheduled) {
      _sessionUiScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _sessionUiScheduled = false;
        if (mounted) setState(() {});
      });
    }

    final taken = session.consumePttTakenNotice();
    if (taken != null && taken.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(taken), duration: const Duration(seconds: 3)),
        );
      });
    }
    if (session.incomingPrivateCall != null && !_privateCallDialogOpen) {
      final call = Map<String, dynamic>.from(session.incomingPrivateCall!);
      final intent = call['intent']?.toString();
      final callId = call['callId']?.toString() ?? '';
      final callerId = call['callerId']?.toString() ?? '';
      // Sesión headless ya activa: no abrir diálogo de “solicitud de cámara”.
      if (intent == 'remote_camera' && RemoteCameraSession.instance.isActive) {
        session.incomingPrivateCall = null;
      } else if (intent != 'remote_camera' &&
          PrivateCallScreen.isBusyWith(callId: callId, peerId: callerId)) {
        // Ya en llamada: no re-mostrar Contestar encima del mini-banner.
        session.incomingPrivateCall = null;
      } else {
        _privateCallDialogOpen = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _showIncomingPrivateCall(call);
        });
      }
    } else if (session.incomingPrivateCall == null && _privateCallDialogOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        if (nav.canPop()) nav.pop();
        _privateCallDialogOpen = false;
      });
    }

    if (session.incomingGroupVideo != null && !_groupVideoDialogOpen) {
      if (GroupVideoScreen.uiOpen) {
        session.incomingGroupVideo = null;
        return;
      }
      _groupVideoDialogOpen = true;
      final invite = Map<String, dynamic>.from(session.incomingGroupVideo!);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showIncomingGroupVideo(invite);
      });
    } else if (session.incomingGroupVideo == null && _groupVideoDialogOpen) {
      if (GroupVideoScreen.uiOpen) {
        _groupVideoDialogOpen = false;
        return;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        if (nav.canPop()) nav.pop();
        _groupVideoDialogOpen = false;
      });
    }

    final dm = session.lastDmNotify;
    if (dm != null) {
      session.lastDmNotify = null;
      final peerName = dm['peerName']?.toString() ?? 'Mensaje';
      final preview = dm['preview']?.toString() ?? '';
      final peerId = dm['peerId']?.toString();
      final isNudge = dm['messageType']?.toString() == 'nudge' ||
          preview == '¡Zumbido!';
      final coveredByCall = PrivateCallScreen.uiOpen;
      final sameOpenDm = _conversationOpen &&
          _viewingKind == 'dm' &&
          peerId != null &&
          _viewingId == peerId &&
          !appInBackground &&
          !coveredByCall;
      if (sameOpenDm) {
        // Nudge: DirectPane aplica tono (sin vibrar). Otros: tono in-chat.
        if (!isNudge) playInChatMessageTone();
      } else {
        if (peerId != null && peerId.isNotEmpty) {
          _inboxKey.currentState?.bumpUnread('dm', peerId);
        }
        if (appInBackground) {
          if (isNudge) {
            // Vibrar; sin AudioPlayer. Banner/sistema vía showLocal o FCM.
            // ignore: unawaited_futures
            PanicVibration.nudge();
          }
          PushService.instance.showLocal(
            title: peerName,
            body: preview,
            payload: peerId != null ? 'peer:$peerId' : null,
            peerId: peerId,
            isNudge: isNudge,
          );
        } else if (isNudge) {
          // Primer plano, otro hilo: sacudir la UI visible + aviso.
          NudgeShake.play();
          // ignore: unawaited_futures
          applyReceivedNudgeFeedback(peerId: peerId);
          ChatMessageBanner.instance.show(
            kind: 'dm',
            peerId: peerId,
            title: peerName,
            preview: preview,
            playTone: false,
          );
        } else {
          ChatMessageBanner.instance.show(
            kind: 'dm',
            peerId: peerId,
            title: peerName,
            preview: preview,
            playTone: true,
          );
        }
      }
    }

    if (session.incomingPanicActive) {
      // El overlay de pánico se pinta en build (visible en cualquier pestaña).
      return;
    }
  }

  void _ackPanic(ChannelSession session) {
    session.ackIncomingPanic();
  }

  Future<void> _openPanicMap(ChannelSession session, {required bool navigate}) async {
    session.silenceIncomingPanicAlarm();
    final lat = session.incomingPanicLat;
    final lng = session.incomingPanicLng;
    if (!isValidMapCoord(lat, lng)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sin ubicación GPS válida para esta alerta')),
      );
      return;
    }
    final ok = await openPanicLocation(
      latitude: lat!,
      longitude: lng!,
      navigate: navigate,
      label: session.incomingPanicLabel,
    );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el mapa')),
      );
    }
  }

  /// Tap en push de llamada: abrir UI Contestar (no depender solo del socket).
  Future<void> _openIncomingCallFromPush(Map<String, dynamic> data) async {
    if (!mounted) return;
    final callId = data['callId']?.toString() ?? '';
    final callerId = data['callerId']?.toString() ?? '';
    if (_privateCallDialogOpen ||
        PrivateCallScreen.isBusyWith(callId: callId, peerId: callerId)) {
      return;
    }
    if (callId.isEmpty) return;

    final earlyIntent = data['intent']?.toString() ??
        (data['type']?.toString() == 'private_remote_camera'
            ? 'remote_camera'
            : null);
    // Entrada única remote cam + auto-accept: headless, sin Contestar / launchApp.
    if (earlyIntent == 'remote_camera' &&
        await RemoteCameraPrefs.canAutoAccept()) {
      PushService.instance.clearConversationNotifications(callId: callId);
      PushService.instance.pendingIncomingCall = null;
      _session?.incomingPrivateCall = null;
      _privateCallDialogOpen = false;
      unawaited(
        RemoteCameraSession.instance.startSilent(
          api: widget.api,
          call: {
            'callId': callId,
            'callerId': data['callerId']?.toString(),
            'callerName': data['callerName']?.toString() ??
                data['title']?.toString() ??
                'Despacho',
            'mode': data['mode']?.toString() ?? 'video',
            'intent': 'remote_camera',
          },
        ),
      );
      return;
    }

    PushService.instance.clearConversationNotifications(callId: callId);
    PushService.instance.pendingIncomingCall = null;

    Map<String, dynamic> call = {
      'callId': callId,
      'callerId': data['callerId']?.toString(),
      'callerName':
          data['callerName']?.toString() ?? data['title']?.toString() ?? 'Usuario',
      'mode': data['mode']?.toString() ??
          (data['type']?.toString() == 'private_radio'
              ? 'radio'
              : (data['type']?.toString() == 'private_video' ||
                      data['type']?.toString() == 'private_remote_camera')
                  ? 'video'
                  : 'call'),
      'intent': earlyIntent,
    };

    try {
      final fetched = await widget.api.fetchPrivateCall(callId);
      final remote = fetched['call'];
      if (remote is Map) {
        call = {
          'callId': remote['callId']?.toString() ?? callId,
          'callerId': remote['callerId']?.toString() ?? call['callerId'],
          'callerName': remote['callerName']?.toString() ?? call['callerName'],
          'mode': remote['mode']?.toString() ?? call['mode'],
          'intent': remote['intent']?.toString() ?? call['intent'],
          'status': remote['status']?.toString(),
        };
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            esMsg(e, 'La llamada ya no está disponible. Pide que vuelvan a llamar.'),
          ),
        ),
      );
      return;
    }

    if (call['status']?.toString() == 'ended') {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('La llamada ya terminó')),
      );
      return;
    }

    _privateCallDialogOpen = true;
    // Push legacy remote_camera: si hay permiso, headless sin Contestar.
    if (call['intent']?.toString() == 'remote_camera' &&
        call['mode']?.toString() == 'video' &&
        await RemoteCameraPrefs.canAutoAccept()) {
      _privateCallDialogOpen = false;
      _session?.incomingPrivateCall = null;
      unawaited(
        RemoteCameraSession.instance.startSilent(
          api: widget.api,
          call: call,
        ),
      );
      return;
    }
    await IncomingCallWake.bringUiToFront();
    await _showIncomingPrivateCall(call);
  }

  Future<void> _showIncomingPrivateCall(Map<String, dynamic> call) async {
    var data = Map<String, dynamic>.from(call);
    var who = data['callerName']?.toString() ?? 'Usuario';
    final callId = data['callId']?.toString();
    if (callId == null) {
      _privateCallDialogOpen = false;
      return;
    }

    // Si solo viene callId (tap notificación), enriquecer desde API.
    if ((data['callerId'] == null || who == 'Usuario') && callId.isNotEmpty) {
      try {
        final fetched = await widget.api.fetchPrivateCall(callId);
        final remote = fetched['call'] as Map? ?? fetched;
        data = {
          ...data,
          'callerId': remote['callerId'] ?? data['callerId'],
          'callerName': remote['callerName'] ?? data['callerName'],
          'mode': remote['mode'] ?? data['mode'],
          'intent': remote['intent'] ?? data['intent'],
        };
        who = data['callerName']?.toString() ?? who;
      } catch (_) {}
    }

    // Contestar directo desde acción de notificación.
    final autoAccept = data['autoAccept']?.toString() == '1' ||
        data['autoAccept'] == true;
    if (autoAccept) {
      _privateCallDialogOpen = false;
      unawaited(CallRingtone.stop());
      await _acceptAndOpenPrivateCall(data);
      return;
    }

    // Radio personal 1:1 retirada: rechazar invitaciones residuales.
    if (data['mode']?.toString() == 'radio') {
      try {
        await widget.api.endPrivateCall(callId, reason: 'reject');
      } catch (_) {}
      _session?.incomingPrivateCall = null;
      _privateCallDialogOpen = false;
      return;
    }

    final callMode = data['mode']?.toString() ?? 'call';
    final callIntent = data['intent']?.toString();

    // Despacho «Ver cámara»: permiso previo → headless (sin UI / snack / push).
    if (callIntent == 'remote_camera' && callMode == 'video') {
      if (await RemoteCameraPrefs.canAutoAccept()) {
        _session?.incomingPrivateCall = null;
        _privateCallDialogOpen = false;
        unawaited(
          RemoteCameraSession.instance.startSilent(
            api: widget.api,
            call: data,
          ),
        );
        return;
      }
    }

    // Quitar banner: la pantalla Contestar es la UI.
    unawaited(PushService.instance.clearConversationNotifications(callId: callId));
    await IncomingCallWake.bringUiToFront();
    if (!mounted) return;

    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, anim, secondary) {
        return IncomingCallScreen(
          api: widget.api,
          callerId: data['callerId']?.toString(),
          callerName: who,
          mode: callMode,
          intent: callIntent,
          onReject: () async {
            try {
              await widget.api.endPrivateCall(callId, reason: 'reject');
            } catch (_) {}
            await CallRingtone.stop();
            await PushService.instance.clearConversationNotifications(callId: callId);
            _session?.incomingPrivateCall = null;
            if (ctx.mounted) Navigator.of(ctx).pop();
          },
          onAccept: () async {
            try {
              if (callMode == 'video') {
                await Permission.camera.request();
              }
              // API primero; luego cerrar Contestar; luego abrir llamada.
              final accepted = await _acceptPrivateCallOnly(data);
              if (ctx.mounted) Navigator.of(ctx).pop();
              if (!mounted) return;
              await _openAcceptedPrivateCall(accepted);
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

  Future<Map<String, dynamic>> _acceptPrivateCallOnly(
    Map<String, dynamic> call,
  ) async {
    final callId = call['callId']?.toString();
    if (callId == null || callId.isEmpty) {
      throw Exception('Llamada sin id');
    }
    final callMode = call['mode']?.toString() ?? 'call';
    if (callMode == 'video') {
      await Permission.camera.request();
    }
    final data = await widget.api.acceptPrivateCall(callId);
    _session?.incomingPrivateCall = null;
    await CallRingtone.stop();
    await PushService.instance.clearConversationNotifications(callId: callId);
    return {
      ...Map<String, dynamic>.from(call),
      '_accepted': data,
    };
  }

  Future<void> _openAcceptedPrivateCall(Map<String, dynamic> call) async {
    final data = call['_accepted'] as Map<String, dynamic>?;
    if (data == null) return;
    final who = call['callerName']?.toString() ?? 'Usuario';
    final callId = call['callId']?.toString() ?? '';
    final callMode = call['mode']?.toString() ?? 'call';
    final callIntent = call['intent']?.toString();
    final accepted = data['call'] as Map? ?? {};
    final mode = accepted['mode']?.toString() ?? callMode;
    final intent = accepted['intent']?.toString() ?? callIntent;
    // Gate antes de pop Contestar: evita reclaim multimedia en el hueco.
    PrivateCallGate.bind(
      callId: accepted['callId']?.toString() ?? callId,
      peerId: accepted['callerId']?.toString() ?? call['callerId']?.toString(),
    );
    unawaited(ChannelSession.current?.duckRadioForPrivateCall() ?? Future<void>.value());
    _privateCallDialogOpen = false;
    if (!mounted) return;
    await Navigator.of(context).push(
      PrivateCallScreen.route(
        child: PrivateCallScreen(
          api: widget.api,
          callId: accepted['callId']?.toString() ?? callId,
          peerId: accepted['callerId']?.toString() ??
              call['callerId']?.toString(),
          peerName: who,
          token: data['token'] as String,
          url: AppConfig.publicLiveKitUrl(data['url'] as String),
          role: 'callee',
          e2eeKey: data['e2eeKey']?.toString(),
          e2ee: data['e2ee'] == true,
          mode: mode == 'video' ? 'video' : 'call',
          intent: intent,
        ),
      ),
    );
  }

  Future<void> _acceptAndOpenPrivateCall(Map<String, dynamic> call) async {
    final who = call['callerName']?.toString() ?? 'Usuario';
    final callId = call['callId']?.toString();
    if (callId == null || callId.isEmpty) {
      _privateCallDialogOpen = false;
      return;
    }
    final callMode = call['mode']?.toString() ?? 'call';
    final callIntent = call['intent']?.toString();

    try {
      if (callMode == 'video') {
        await Permission.camera.request();
      }

      final data = await widget.api.acceptPrivateCall(callId);
      _session?.incomingPrivateCall = null;
      final accepted = data['call'] as Map? ?? {};
      PrivateCallGate.bind(
        callId: accepted['callId']?.toString() ?? callId,
        peerId: accepted['callerId']?.toString() ?? call['callerId']?.toString(),
      );
      unawaited(ChannelSession.current?.duckRadioForPrivateCall() ?? Future<void>.value());
      _privateCallDialogOpen = false;
      if (!mounted) return;

      await PushService.instance.clearConversationNotifications(callId: callId);
      if (!mounted) return;

      final mode = accepted['mode']?.toString() ?? callMode;
      final intent = accepted['intent']?.toString() ?? callIntent;

      await Navigator.of(context).push(
        PrivateCallScreen.route(
          child: PrivateCallScreen(
            api: widget.api,
            callId: accepted['callId']?.toString() ?? callId,
            peerId: accepted['callerId']?.toString() ??
                call['callerId']?.toString(),
            peerName: who,
            token: data['token'] as String,
            url: AppConfig.publicLiveKitUrl(data['url'] as String),
            role: 'callee',
            e2eeKey: data['e2eeKey']?.toString(),
            e2ee: data['e2ee'] == true,
            mode: mode == 'video' ? 'video' : 'call',
            intent: intent,
          ),
        ),
      );
    } catch (e) {
      _privateCallDialogOpen = false;
      _session?.incomingPrivateCall = null;
      await CallRingtone.stop();
      if (!mounted) return;
      final msg = e.toString().toLowerCase();
      final expired = msg.contains('404') ||
          msg.contains('no encontrada') ||
          msg.contains('not found') ||
          msg.contains('finalizada') ||
          msg.contains('ended') ||
          msg.contains('timeout');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            expired
                ? 'Llamada finalizada o sin respuesta'
                : esMsg(e, 'No se pudo aceptar la solicitud'),
          ),
        ),
      );
    }
  }

  Future<void> _joinGroupVideoDirect(String groupId, String groupName) async {
    if (!mounted) return;
    if (_groupVideoDialogOpen || GroupVideoScreen.uiOpen) return;
    _session?.incomingGroupVideo = null;
    _groupVideoDialogOpen = false;
    PushService.instance.pendingIncomingGroupVideo = null;
    PushService.instance.clearConversationNotifications(groupId: groupId);
    await Navigator.of(context).push(
      GroupVideoScreen.route(
        child: GroupVideoScreen(
          api: widget.api,
          groupId: groupId,
          groupName: groupName,
          startIfNeeded: false,
        ),
      ),
    );
  }

  Future<void> _openIncomingGroupVideoFromPush(Map<String, dynamic> data) async {
    if (!mounted) return;
    final groupId = data['groupId']?.toString() ?? '';
    if (groupId.isEmpty) return;
    await _joinGroupVideoDirect(
      groupId,
      data['groupName']?.toString() ?? 'Grupo',
    );
  }

  Future<void> _showIncomingGroupVideo(Map<String, dynamic> invite) async {
    final groupId = invite['groupId']?.toString() ?? '';
    final groupName = invite['groupName']?.toString() ?? 'Grupo';
    if (groupId.isEmpty) {
      _groupVideoDialogOpen = false;
      return;
    }

    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, anim, secondary) {
        return IncomingCallScreen(
          callerName: groupName,
          mode: 'group_video',
          onReject: () async {
            _session?.incomingGroupVideo = null;
            if (ctx.mounted) Navigator.of(ctx).pop();
          },
          onAccept: () async {
            _session?.incomingGroupVideo = null;
            _groupVideoDialogOpen = false;
            if (ctx.mounted) Navigator.of(ctx).pop();
            if (!mounted) return;
            PushService.instance.clearConversationNotifications(groupId: groupId);
            await _joinGroupVideoDirect(groupId, groupName);
          },
        );
      },
    ).whenComplete(() {
      _groupVideoDialogOpen = false;
    });
  }

  /// Un toque envía pánico (sin diálogo de confirmación).
  Future<void> _sendPanic() async {
    final session = _session;
    if (session == null || session.panicSending) return;
    final success = await session.triggerPanic();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Alerta enviada' : (session.error ?? 'No se pudo enviar')),
        backgroundColor: success ? kRadioDanger : null,
      ),
    );
  }

  Future<void> _handleOverflowMenu(String value) async {
    switch (value) {
      case 'channels':
        setState(() => _overlay = _OverlayPane.groups);
        break;
      case 'profile_photo':
        await _openProfileSheet();
        break;
      case 'profile_info':
        await _showProfileInfoDialog();
        break;
      case 'settings':
        await _showSettingsSheet();
        break;
      case 'sounds':
        await _openSoundSettings();
        break;
      case 'location':
        if (canViewGpsTrack(widget.api.user)) {
          _onMainTabTap(_MainTab.gps);
        } else {
          setState(() => _overlay = _OverlayPane.location);
        }
        break;
      case 'group_video':
        final g = _groups.isEmpty
            ? null
            : _groups[_channelIndex.clamp(0, _groups.length - 1)];
        final gid = g?['id']?.toString() ?? _session?.groupId;
        final gname = g?['name']?.toString() ?? _session?.groupName ?? '';
        if (gid == null || gid.isEmpty) return;
        unawaited(_joinGroupVideoDirect(gid, gname));
        break;
      case 'radio_mute':
        final session = _session;
        if (session == null) return;
        final next = !session.listenMuted;
        await session.setListenMuted(next);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              next
                  ? 'Radio silenciada — no oyes a nadie'
                  : 'Radio activa — oyes el canal',
            ),
            duration: const Duration(seconds: 2),
          ),
        );
        break;
      case 'logout':
        await widget.onLogout();
        break;
    }
  }

  Future<void> _showProfileInfoDialog() async {
    final u = widget.api.user;
    final name = u?['displayName']?.toString() ?? 'Usuario';
    final username = u?['username']?.toString() ?? '';
    final role = roleLabel(u?['role']?.toString());
    String version = '';
    try {
      final info = await PackageInfo.fromPlatform();
      version = '${info.version}+${info.buildNumber}';
    } catch (_) {}
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Datos e información'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            if (username.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('@$username', style: const TextStyle(color: kInstMuted)),
            ],
            if (role.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('Rol: $role'),
            ],
            if (version.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('App: $version', style: const TextStyle(color: kInstMuted, fontSize: 13)),
            ],
            const SizedBox(height: 8),
            Text(
              'API: ${AppConfig.apiBaseUrl}',
              style: const TextStyle(color: kInstMuted, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cerrar')),
        ],
      ),
    );
  }

  Future<void> _showSettingsSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: kInstSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFC2CBB8),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(height: 12),
                const ListTile(
                  title: Text(
                    'Configuraciones',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                ),
                FutureBuilder<bool>(
                  future: RemoteCameraPrefs.isEnabled(),
                  builder: (context, snap) {
                    final on = snap.data ?? false;
                    return SwitchListTile(
                      title: const Text(
                        'Permiso de cámaras',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Permite que el despacho solicite ver tu cámara',
                        style: TextStyle(fontSize: 12, color: kInstMuted),
                      ),
                      value: on,
                      onChanged: (v) async {
                        Navigator.pop(ctx);
                        await _toggleRemoteCameraPref(v);
                      },
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.photo_camera_outlined),
                  title: const Text('Foto de perfil'),
                  onTap: () {
                    Navigator.pop(ctx);
                    unawaited(_openProfileSheet());
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: Text(
                    canViewGpsTrack(widget.api.user)
                        ? 'Seguimiento GPS'
                        : 'Ubicación GPS',
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    if (canViewGpsTrack(widget.api.user)) {
                      _onMainTabTap(_MainTab.gps);
                    } else {
                      setState(() => _overlay = _OverlayPane.location);
                    }
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.volume_up_outlined),
                  title: const Text('Sonidos'),
                  subtitle: const Text(
                    'Mensajes, llamadas, video y zumbidos',
                    style: TextStyle(fontSize: 12, color: kInstMuted),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    unawaited(_openSoundSettings());
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.app_settings_alt_outlined),
                  title: const Text('Ajustes del sistema'),
                  subtitle: const Text(
                    'Permisos de micrófono, cámara y ubicación',
                    style: TextStyle(fontSize: 12, color: kInstMuted),
                  ),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await openAppSettings();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _openSoundSettings() async {
    if (!mounted) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => const SoundSettingsScreen(),
      ),
    );
  }

  Future<void> _openProfileSheet() async {
    final name = widget.api.user?['displayName']?.toString() ?? 'Usuario';
    final username = widget.api.user?['username']?.toString() ?? '';

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: kInstSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFC2CBB8),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(height: 16),
                UserAvatar(
                  name: name,
                  avatarUrl: widget.api.avatarNetworkUrl(),
                  headers: widget.api.avatarAuthHeaders(),
                  radius: 40,
                ),
                const SizedBox(height: 12),
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                if (username.isNotEmpty)
                  Text('@$username', style: const TextStyle(color: kInstMuted)),
                const SizedBox(height: 8),
                const Text(
                  'Tu icono aparece en el Seguimiento del despacho.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: kInstMuted, fontSize: 13),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await _changeAvatar(ImageSource.gallery);
                  },
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Elegir foto'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await _changeAvatar(ImageSource.camera);
                  },
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Tomar foto'),
                ),
                if (widget.api.avatarNetworkUrl() != null) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await widget.api.clearAvatar();
                        if (!mounted) return;
                        AvatarBytesCache.clear();
                        setState(() {});
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Icono restablecido')),
                        );
                      } catch (e) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              esMsg(e, 'No se pudo quitar el icono'),
                            ),
                          ),
                        );
                      }
                    },
                    child: const Text('Quitar icono'),
                  ),
                ],
                const SizedBox(height: 8),
                FutureBuilder<bool>(
                  future: RemoteCameraPrefs.isEnabled(),
                  builder: (context, snap) {
                    final on = snap.data ?? false;
                    return SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Permiso de cámaras',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Permiso de cámaras únicamente',
                        style: TextStyle(fontSize: 12, color: kInstMuted),
                      ),
                      value: on,
                      onChanged: (v) async {
                        Navigator.pop(ctx);
                        await _toggleRemoteCameraPref(v);
                      },
                    );
                  },
                ),
                if (canLogoutFromApp(widget.api.user)) ...[
                  const SizedBox(height: 16),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await widget.onLogout();
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('Salir'),
                    style: TextButton.styleFrom(foregroundColor: kInstDanger),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _changeAvatar(ImageSource source) async {
    final session = _session;
    try {
      await session?.releasePtt();
    } catch (_) {}
    await AudioSessionSetup.pauseForCamera();
    try {
      await session?.pauseMicForSystemCamera();
    } catch (_) {}

    try {
      final picker = ImagePicker();
      final x = await picker.pickImage(source: source, imageQuality: 95);
      if (x == null) return;

      CroppedFile? cropped;
      try {
        cropped = await ImageCropper().cropImage(
          sourcePath: x.path,
          aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
          compressFormat: ImageCompressFormat.jpg,
          compressQuality: 85,
          maxWidth: 800,
          maxHeight: 800,
          uiSettings: [
            AndroidUiSettings(
              toolbarTitle: 'Ajustar foto',
              toolbarColor: kInstOlive,
              statusBarLight: false,
              toolbarWidgetColor: const Color(0xFFF4F7F1),
              backgroundColor: kInstOliveDeep,
              activeControlsWidgetColor: kInstGold,
              dimmedLayerColor: const Color(0xCC000000),
              cropFrameColor: const Color(0xFFF4F7F1),
              cropGridColor: const Color(0x66F4F7F1),
              initAspectRatio: CropAspectRatioPreset.square,
              lockAspectRatio: true,
              hideBottomControls: false,
              cropStyle: CropStyle.circle,
            ),
            IOSUiSettings(
              title: 'Ajustar foto',
              aspectRatioLockEnabled: true,
              resetAspectRatioEnabled: false,
              cropStyle: CropStyle.circle,
            ),
          ],
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(esMsg(e, 'No se pudo ajustar la foto'))),
        );
        return;
      }
      if (cropped == null) return; // canceló el recorte

      if (!mounted) return;
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const PopScope(
          canPop: false,
          child: Center(
            child: Card(
              color: kInstSurface,
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: kInstOlive),
                    SizedBox(height: 16),
                    Text('Subiendo foto…'),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      try {
        final bytes = await cropped.readAsBytes();
        await widget.api.uploadAvatar(bytes, 'avatar.jpg');
        await widget.api.ensureAvatarTicket(force: true);
        if (!mounted) return;
        Navigator.of(context, rootNavigator: true).pop(); // loading
        AvatarBytesCache.clear();
        PaintingBinding.instance.imageCache.clear();
        PaintingBinding.instance.imageCache.clearLiveImages();
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto de perfil actualizada')),
        );
      } catch (e) {
        if (!mounted) return;
        Navigator.of(context, rootNavigator: true).pop(); // loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(esMsg(e, 'No se pudo subir la foto'))),
        );
      }
    } finally {
      await AudioSessionSetup.resumeAfterCamera();
      try {
        await session?.ensureBackgroundAudio();
      } catch (_) {}
    }
  }

  Future<void> _pushGroupChat(
    String groupId,
    String name, {
    String? messageId,
    bool autofocus = false,
  }) async {
    final session = _session;
    if (session == null) return;
    final idx = _groups.indexWhere((g) => g['id']?.toString() == groupId);
    if (idx >= 0) {
      final radioIdx = _radioIndexForGroupId(groupId);
      if (radioIdx != _channelIndex) {
        await _changeChannel(radioIdx, forChatOpen: true);
        if (!mounted) return;
      }
    }
    setState(() {
      _conversationOpen = true;
      _viewingKind = 'group';
      _viewingId = groupId;
    });
    setViewingChat(kind: 'group', id: groupId);
    _inboxKey.currentState?.clearUnread('group', groupId);
    // Tras inactividad el socket pudo perder mensajes: sincronizar historial.
    await (_session?.refreshChatHistory() ?? Future<void>.value());
    if (!mounted) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => GroupChatScreen(
          api: widget.api,
          session: _session!,
          groupName: name,
          groupAvatarUrl: widget.api.groupAvatarNetworkUrl(
            groupId,
            idx >= 0 ? _groups[idx]['avatarUrl']?.toString() : null,
          ),
          autofocusComposer: autofocus,
          scrollToMessageId: messageId,
        ),
      ),
    );
    if (!mounted) return;
    clearViewingChat();
    setState(() {
      _conversationOpen = false;
      _viewingKind = null;
      _viewingId = null;
    });
    _clearCurrentChatNotifications(markMessages: true);
  }

  Future<void> _pushDmChat(String peerId, String name) async {
    if (!mounted) return;
    // Evitar apilar varias veces el mismo hilo si el usuario toca dos veces.
    if (_conversationOpen && _viewingKind == 'dm' && _viewingId == peerId) {
      return;
    }
    setState(() {
      _conversationOpen = true;
      _viewingKind = 'dm';
      _viewingId = peerId;
    });
    setViewingChat(kind: 'dm', id: peerId);
    _inboxKey.currentState?.clearUnread('dm', peerId);
    PushService.instance.clearConversationNotifications(peerId: peerId);
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => DirectPane(
          api: widget.api,
          initialPeerId: peerId,
          threadOnly: true,
          onBack: () {
            final nav = Navigator.of(context);
            nav.popUntil((route) => route.isFirst);
          },
        ),
      ),
    );
    if (!mounted) return;
    clearViewingChat();
    setState(() {
      _conversationOpen = false;
      _viewingKind = null;
      _viewingId = null;
    });
  }

  Future<void> _openGroupFromInbox(
    String groupId,
    String name, {
    String? messageId,
  }) async {
    await _pushGroupChat(
      groupId,
      name,
      messageId: messageId,
      autofocus: messageId != null,
    );
  }

  Future<void> _openDmFromInbox(String peerId, String name) async {
    await _pushDmChat(peerId, name);
  }

  void _onMainTabTap(_MainTab tab) {
    if (tab == _MainTab.gps && !canViewGpsTrack(widget.api.user)) {
      return;
    }
    final leavingRadio = _tab == _MainTab.radio && tab != _MainTab.radio;
    setState(() {
      _tab = tab;
      _overlay = _OverlayPane.none;
    });
    if (tab == _MainTab.chats || tab == _MainTab.calls) {
      PushService.instance.clearAllNotifications();
    }
    // Volumen «llamadas» solo con PTT/llamada: al salir de Radio → multimedia.
    if (leavingRadio) {
      final sess = _session;
      if (!PrivateCallGate.uiOpen &&
          !GroupVideoScreen.uiOpen &&
          sess != null &&
          !sess.holding &&
          !sess.pttArmed) {
        unawaited(AudioSessionSetup.reclaimNormalVolume(forceFull: true));
      }
    }
  }

  bool get _showGpsTab => canViewGpsTrack(widget.api.user);

  String get _locationMenuLabel =>
      _showGpsTab ? 'Seguimiento GPS' : 'Ubicación GPS';

  int get _mainTabIndex {
    final tab = (_tab == _MainTab.gps && !_showGpsTab) ? _MainTab.radio : _tab;
    return switch (tab) {
      _MainTab.chats => 0,
      _MainTab.calls => 1,
      _MainTab.radio => 2,
      _MainTab.gps => 3,
    };
  }

  @override
  Widget build(BuildContext context) {
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
        appBar: AppBar(title: const Text('SICOM')),
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

    final mainBody = IndexedStack(
      index: _mainTabIndex,
      children: [
        ChatInboxScreen(
          key: _inboxKey,
          api: widget.api,
          groups: _groups,
          session: session,
          viewingKind: _viewingKind,
          viewingId: _viewingId,
          showLogout: canLogoutFromApp(widget.api.user),
          locationMenuLabel: _locationMenuLabel,
          onOverflowMenu: _handleOverflowMenu,
          onUnreadTotalChanged: (n) {
            if (_chatUnread != n && mounted) {
              setState(() => _chatUnread = n);
            }
          },
          onOpenGroup: (gid, gname, {messageId}) async {
            await _openGroupFromInbox(gid, gname, messageId: messageId);
          },
          onOpenDm: (pid, pname) async {
            await _openDmFromInbox(pid, pname);
          },
        ),
        CallHistoryPane(
          key: const ValueKey('calls-main'),
          api: widget.api,
          showLogout: canLogoutFromApp(widget.api.user),
          locationMenuLabel: _locationMenuLabel,
          onOverflowMenu: _handleOverflowMenu,
          onOpenDm: (pid, pname) async {
            await _openDmFromInbox(pid, pname);
          },
        ),
        RadioScreen(
          key: const ValueKey('radio-main'),
          session: session,
          displayName: userDisplayLabel(widget.api.user),
          avatarUrl: widget.api.avatarNetworkUrl(),
          avatarHeaders: widget.api.avatarAuthHeaders(),
          groups: _radioChannels,
          channelIndex: _channelIndex,
          onChannelChanged: _changeChannel,
          onOpenMenu: () => setState(() => _overlay = _OverlayPane.groups),
          onOpenLocation: () {
            if (canViewGpsTrack(widget.api.user)) {
              _onMainTabTap(_MainTab.gps);
            } else {
              setState(() => _overlay = _OverlayPane.location);
            }
          },
          onOverflowMenu: _handleOverflowMenu,
          showLogout: canLogoutFromApp(widget.api.user),
          locationMenuLabel: _locationMenuLabel,
          onOpenGroupVideo: () {
            final g = _groups.isEmpty
                ? null
                : _groups[_homeGroupIndex.clamp(0, _groups.length - 1)];
            final gid = g?['id']?.toString() ?? session.groupId;
            final gname = g?['name']?.toString() ?? session.groupName;
            if (gid.isEmpty) return;
            unawaited(_joinGroupVideoDirect(gid, gname));
          },
          onPanic: _sendPanic,
          onOpenProfile: _openProfileSheet,
          api: widget.api,
        ),
        if (_showGpsTab)
          GpsTrackScreen(
            key: const ValueKey('gps-track-main'),
            api: widget.api,
            channelGroupId: session.groupId,
            channelName: session.groupName,
            groups: _groups,
          ),
      ],
    );

    Widget body = Stack(
      children: [
        mainBody,
        if (_overlay == _OverlayPane.location)
          Positioned.fill(
            child: _LocationPane(
              session: session,
              onBack: () => setState(() => _overlay = _OverlayPane.none),
            ),
          ),
        if (_overlay == _OverlayPane.groups)
          Positioned.fill(
            child: _GroupsPane(
              groups: _groups,
              selectedIndex: _hasOpenChannel
                  ? (_channelIndex <= 0
                      ? _homeGroupIndex.clamp(0, _groups.isEmpty ? 0 : _groups.length - 1)
                      : (_channelIndex - 1)
                          .clamp(0, _groups.isEmpty ? 0 : _groups.length - 1))
                  : _channelIndex.clamp(
                      0, _groups.isEmpty ? 0 : _groups.length - 1),
              displayName: userDisplayLabel(widget.api.user),
              onBack: () => setState(() => _overlay = _OverlayPane.none),
              onSelect: (i) async {
                await _changeChannel(_hasOpenChannel ? i + 1 : i);
                if (mounted) setState(() => _overlay = _OverlayPane.none);
              },
              onReload: _bootstrap,
              showLogout: canLogoutFromApp(widget.api.user),
              onLogout: widget.onLogout,
            ),
          ),
      ],
    );

    final shell = Scaffold(
      body: Column(
        children: [
          Expanded(child: body),
        ],
      ),
      bottomNavigationBar: _conversationOpen
          ? null
          : Container(
              decoration: BoxDecoration(
                color: kInstSurface,
                border: const Border(top: BorderSide(color: kInstBorder)),
                boxShadow: [
                  BoxShadow(
                    color: kInstInk.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: _NavTab(
                          icon: Icons.forum_rounded,
                          label: 'Chats',
                          selected: _tab == _MainTab.chats && _overlay == _OverlayPane.none,
                          badge: _chatUnread > 0,
                          onTap: () => _onMainTabTap(_MainTab.chats),
                        ),
                      ),
                      Expanded(
                        child: _NavTab(
                          icon: Icons.call_rounded,
                          label: 'Llamadas',
                          selected: _tab == _MainTab.calls && _overlay == _OverlayPane.none,
                          onTap: () => _onMainTabTap(_MainTab.calls),
                        ),
                      ),
                      Expanded(
                        child: _NavTab(
                          icon: Icons.cell_tower_rounded,
                          label: 'Radio',
                          selected: _tab == _MainTab.radio && _overlay == _OverlayPane.none,
                          onTap: () => _onMainTabTap(_MainTab.radio),
                        ),
                      ),
                      if (_showGpsTab)
                        Expanded(
                          child: _NavTab(
                            icon: Icons.location_on_rounded,
                            label: 'GPS',
                            selected:
                                _tab == _MainTab.gps && _overlay == _OverlayPane.none,
                            onTap: () => _onMainTabTap(_MainTab.gps),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
    );

    return Stack(
      children: [
        NudgeShakeHost(child: shell),
        if (session.announcementActive)
          Positioned.fill(
            child: Material(
              color: const Color(0xB8000000),
              child: SafeArea(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Material(
                        color: const Color(0xFFFFEDD5),
                        borderRadius: BorderRadius.circular(16),
                        elevation: 10,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text(
                                'AVISO',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Color(0xFF9A3412),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 20,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              if (session.announcementFrom != null) ...[
                                const SizedBox(height: 6),
                                Text(
                                  session.announcementFrom!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Color(0xFF7C2D12),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 12),
                              // Texto largo: scroll; botón Enterado siempre visible (cel vs tablet).
                              ConstrainedBox(
                                constraints: BoxConstraints(
                                  maxHeight:
                                      MediaQuery.sizeOf(context).height * 0.48,
                                ),
                                child: SingleChildScrollView(
                                  child: Text(
                                    session.announcementBody ?? '',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 15,
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              FilledButton(
                                onPressed: session.announcementAcking
                                    ? null
                                    : () => session.ackAnnouncement(),
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF9A3412),
                                  minimumSize: const Size.fromHeight(48),
                                ),
                                child: Text(
                                  session.announcementAcking
                                      ? '…'
                                      : 'Enterado',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (session.incomingPanicActive)
          Positioned.fill(
            child: Material(
              color: Colors.black54,
              child: SafeArea(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Material(
                      color: const Color(0xFFFFE4E1),
                      borderRadius: BorderRadius.circular(16),
                      elevation: 8,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'ALERTA',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: kRadioDanger,
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              '${session.incomingPanicLabel ?? 'Operador'} necesita ayuda en este canal.\nLa alarma suena hasta pulsar Enterado.',
                              textAlign: TextAlign.center,
                            ),
                            if (session.incomingPanicHasLocation) ...[
                              const SizedBox(height: 10),
                              Text(
                                session.incomingPanicAccuracyM != null
                                    ? 'Ubicación registrada (±${session.incomingPanicAccuracyM!.round()} m)'
                                    : 'Ubicación registrada',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF5C4033),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: () =>
                                    _openPanicMap(session, navigate: false),
                                icon: const Icon(Icons.map_outlined),
                                label: const Text('Ver ubicación'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: kRadioDanger,
                                  side: const BorderSide(color: kRadioDanger),
                                ),
                              ),
                              const SizedBox(height: 8),
                              FilledButton.tonalIcon(
                                onPressed: () =>
                                    _openPanicMap(session, navigate: true),
                                icon: const Icon(Icons.directions),
                                label: const Text('Cómo llegar'),
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFFFFCDD2),
                                  foregroundColor: kRadioDanger,
                                ),
                              ),
                            ] else ...[
                              const SizedBox(height: 10),
                              const Text(
                                'Sin ubicación GPS del emisor.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF5C4033),
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: kRadioDanger,
                              ),
                              onPressed: () => _ackPanic(session),
                              child: const Text('Enterado'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: NudgeShakeHost(
            child: const ChatMessageBannerOverlay(),
          ),
        ),
      ],
    );
  }
}

class _NavTab extends StatelessWidget {
  const _NavTab({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = false,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final bool badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? kInstOlive : kInstMuted;
    return Material(
      color: selected ? kInstOlive.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 24, color: color),
                  if (badge)
                    Positioned(
                      top: -2,
                      right: -8,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: kInstGold,
                          shape: BoxShape.circle,
                          border: Border.all(color: kInstSurface, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TacticalFonts.body(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: color,
                  letterSpacing: 0.2,
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
    return Material(
      color: kInstPaper,
      child: SafeArea(
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
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                session.gpsOk
                    ? 'GPS activo — enviando al despacho cada 5 s'
                    : 'GPS no disponible o sin permiso',
                textAlign: TextAlign.center,
                style: const TextStyle(color: kRadioMuted),
              ),
            ),
            const Spacer(flex: 2),
          ],
        ),
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
    required this.showLogout,
    required this.onLogout,
  });

  final List<Map<String, dynamic>> groups;
  final int selectedIndex;
  final String displayName;
  final VoidCallback onBack;
  final ValueChanged<int> onSelect;
  final VoidCallback onReload;
  final bool showLogout;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kTacBg,
      child: TacticalBackdrop(
        child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back, color: kTacOnSurface)),
                Expanded(
                  child: Text(
                    displayName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      color: kTacOnSurface,
                    ),
                  ),
                ),
              IconButton(onPressed: onReload, icon: const Icon(Icons.refresh, color: kTacOnSurface)),
              if (showLogout)
                IconButton(
                  onPressed: () async => onLogout(),
                  tooltip: 'Salir',
                  icon: const Icon(Icons.logout, color: kTacOnSurface),
                ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text('CANALES', style: TextStyle(fontWeight: FontWeight.w700, color: kTacGold, letterSpacing: 1.2)),
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
                  selectedTileColor: kInstOlive.withValues(alpha: 0.28),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(
                      color: selected ? kTacGold : kTacBorder,
                    ),
                  ),
                  title: Text(
                    g['name'] as String? ?? 'Grupo',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: kTacOnSurface),
                  ),
                  subtitle: Text(
                    g['description'] as String? ?? '',
                    style: const TextStyle(color: kTacMuted),
                  ),
                  trailing: selected
                      ? const Icon(Icons.check_circle, color: kTacGold)
                      : const Icon(Icons.chevron_right, color: kTacMuted),
                  onTap: () => onSelect(i),
                );
              },
            ),
          ),
        ],
      ),
      ),
    ),
    );
  }
}
