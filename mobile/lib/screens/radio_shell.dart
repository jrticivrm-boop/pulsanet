import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../app_focus.dart';
import '../audio_session_setup.dart';
import '../background_radio.dart';
import '../channel_session.dart';
import '../config.dart';
import '../es_msg.dart';
import '../location_heartbeat.dart';
import '../chat_message_banner.dart';
import '../user_display.dart';
import '../message_tone.dart';
import '../panic_maps.dart';
import '../push_service.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets/tactical_backdrop.dart';
import '../widgets/user_avatar.dart';
import 'chat_inbox_screen.dart';
import 'direct_pane.dart';
import 'incoming_call_screen.dart';
import 'personal_radio_bar.dart';
import 'private_call_screen.dart';
import 'radio_screen.dart';

/// Home post-login: Chats (WhatsApp) + Radio PTT en dos pestañas.
class RadioShell extends StatefulWidget {
  const RadioShell({super.key, required this.api, required this.onLogout});

  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<RadioShell> createState() => _RadioShellState();
}

enum _MainTab { chats, radio }

enum _OverlayPane { none, location, groups }

class _RadioShellState extends State<RadioShell> with WidgetsBindingObserver {
  final _inboxKey = GlobalKey<ChatInboxScreenState>();
  List<Map<String, dynamic>> _groups = [];
  int _channelIndex = 0;
  ChannelSession? _session;
  _MainTab _tab = _MainTab.chats;
  _OverlayPane _overlay = _OverlayPane.none;
  bool _loading = true;
  String? _loadError;
  bool _privateCallDialogOpen = false;
  Map<String, dynamic>? _personalRadio;
  int _chatUnread = 0;
  bool _conversationOpen = false;
  String? _viewingKind;
  String? _viewingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ChatMessageBanner.instance.onTap = _onMessageBannerTap;
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
      if (type == 'dm') {
        _openFromNotification(
          peerId: data['peerId']?.toString(),
          messageId: data['messageId']?.toString(),
        );
        return;
      }
      if (type == 'private_call' || type == 'private_radio') {
        unawaited(_openIncomingCallFromPush(Map<String, dynamic>.from(data)));
        return;
      }
      if (type == 'panic') {
        unawaited(_openPanicFromNotification(data));
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

    if (idx >= 0 && idx != _channelIndex) {
      await _changeChannel(idx, forChatOpen: true);
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
    if (idx >= 0 && idx != _channelIndex) {
      await _changeChannel(idx, forChatOpen: true);
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
    final panic = push.pendingPanicData;
    final peerId = push.pendingPeerId;
    final groupId = push.pendingGroupId;
    final messageId = push.pendingMessageId;
    push.clearPendingNavigation();
    if (incomingCall != null) {
      unawaited(_openIncomingCallFromPush(Map<String, dynamic>.from(incomingCall)));
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
      // Pantalla bloqueada / app minimizada: FGS + GPS + audio.
      BackgroundRadio.start(channelName: name).catchError((_) {});
      LocationHeartbeat.start(widget.api).catchError((_) {});
      _session?.ensureBackgroundAudio();
    } else if (state == AppLifecycleState.resumed) {
      BackgroundRadio.start(channelName: name).catchError((_) {});
      LocationHeartbeat.start(widget.api).catchError((_) {});
      _session?.ensureBackgroundAudio();
      // Recuperar mensajes perdidos mientras el socket estuvo caído / app inactiva.
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

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      // Renovar ticket de avatares; el display usa Bearer (no depende del ticket).
      unawaited(widget.api.ensureAvatarTicket(force: true));

      // Permisos / FGS / GPS en paralelo; no bloquean abrir un DM desde notificación.
      // No AudioSessionSetup aquí: solo al conectar LiveKit / llamada.
      final bgFut = BackgroundRadio.init().then((_) => BackgroundRadio.requestPermissions());
      final locFut = LocationHeartbeat.start(widget.api);

      final groups = await widget.api.fetchGroups();
      final prefs = await SharedPreferences.getInstance();
      var idx = prefs.getInt('tacticalptx_channel_index') ?? 0;
      if (groups.isEmpty) {
        await Future.wait([bgFut, locFut]).catchError((_) => <void>[]);
        setState(() {
          _groups = [];
          _loading = false;
          _loadError = 'Sin grupos asignados';
        });
        // DM pendiente aún se puede abrir.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _consumePendingNotificationNav();
        });
        return;
      }
      if (idx < 0 || idx >= groups.length) idx = 0;

      // Si hay DM pendiente, liberar UI antes de terminar radio/LiveKit.
      final pendingDm = PushService.instance.pendingPeerId;
      if (pendingDm != null && pendingDm.isNotEmpty) {
        setState(() {
          _groups = groups;
          _channelIndex = idx;
          _loading = false;
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _consumePendingNotificationNav();
        });
        await _bindChannel(groups, idx, light: true);
        await Future.wait([bgFut, locFut]).catchError((_) => <void>[]);
        return;
      }

      await _bindChannel(groups, idx, light: true);
      await Future.wait([bgFut, locFut]).catchError((_) => <void>[]);
      setState(() {
        _groups = groups;
        _channelIndex = idx;
        _loading = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _consumePendingNotificationNav();
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadError = _friendlyBootError(e);
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _consumePendingNotificationNav();
      });
    }
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

  Future<void> _bindChannel(
    List<Map<String, dynamic>> groups,
    int index, {
    bool light = false,
  }) async {
    final g = groups[index];
    final old = _session;
    if (old != null) {
      old.removeListener(_onSession);
      // dispose completo es lento (LiveKit); en apertura de chat no esperamos FGS.
      if (light) {
        // ignore: unawaited_futures
        old.disposeSession();
      } else {
        await old.disposeSession();
      }
    }
    final session = ChannelSession(api: widget.api, group: g);
    session.addListener(_onSession);
    // ignore: unawaited_futures
    session.start();
    _session = session;
    // Prefs + FGS no deben retrasar el chat.
    // ignore: unawaited_futures
    SharedPreferences.getInstance().then((prefs) {
      return prefs.setInt('tacticalptx_channel_index', index);
    });
    // ignore: unawaited_futures
    BackgroundRadio.start(
      channelName: g['name']?.toString() ?? 'Canal',
      forceRestart: true,
    );
  }

  Future<void> _changeChannel(int index, {bool forChatOpen = false}) async {
    if (index == _channelIndex || index < 0 || index >= _groups.length) return;
    setState(() => _channelIndex = index);
    await _bindChannel(_groups, index, light: forChatOpen);
    if (mounted) setState(() {});
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
      final coveredByCall = PrivateCallScreen.uiOpen;
      final sameOpenDm = _conversationOpen &&
          _viewingKind == 'dm' &&
          peerId != null &&
          _viewingId == peerId &&
          !appInBackground &&
          !coveredByCall;
      if (sameOpenDm) {
        playInChatMessageTone();
      } else {
        if (peerId != null && peerId.isNotEmpty) {
          _inboxKey.currentState?.bumpUnread('dm', peerId);
        }
        if (appInBackground) {
          PushService.instance.showLocal(
            title: peerName,
            body: preview,
            payload: peerId != null ? 'peer:$peerId' : null,
            peerId: peerId,
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
    if (lat == null || lng == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sin ubicación disponible para esta alerta')),
      );
      return;
    }
    final ok = await openPanicLocation(
      latitude: lat,
      longitude: lng,
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
    if (_privateCallDialogOpen || PrivateCallScreen.uiOpen) return;

    final callId = data['callId']?.toString() ?? '';
    if (callId.isEmpty) return;

    PushService.instance.clearConversationNotifications(callId: callId);
    PushService.instance.pendingIncomingCall = null;

    Map<String, dynamic> call = {
      'callId': callId,
      'callerId': data['callerId']?.toString(),
      'callerName':
          data['callerName']?.toString() ?? data['title']?.toString() ?? 'Usuario',
      'mode': data['mode']?.toString() ??
          (data['type']?.toString() == 'private_radio' ? 'radio' : 'call'),
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
    await _showIncomingPrivateCall(call);
  }

  Future<void> _showIncomingPrivateCall(Map<String, dynamic> call) async {

    final who = call['callerName']?.toString() ?? 'Usuario';
    final callId = call['callId']?.toString();
    if (callId == null) {
      _privateCallDialogOpen = false;
      return;
    }

    // Radio personal: abrir chat 1:1 con barra PTT (visible; no debajo de otra ruta).
    if (call['mode']?.toString() == 'radio') {
      try {
        final data = await widget.api.acceptPrivateCall(callId);
        _session?.incomingPrivateCall = null;
        _privateCallDialogOpen = false;
        if (!mounted) return;
        final accepted = data['call'] as Map? ?? {};
        final peerId = accepted['callerId']?.toString() ??
            call['callerId']?.toString() ??
            '';
        final radioSession = <String, dynamic>{
          'callId': accepted['callId']?.toString() ?? callId,
          'peerName': who,
          'token': data['token'] as String,
          'url': AppConfig.publicLiveKitUrl(data['url'] as String),
          'role': 'callee',
          'e2eeKey': data['e2eeKey']?.toString(),
        };
        if (peerId.isEmpty) {
          setState(() => _personalRadio = radioSession);
          return;
        }
        final nav = Navigator.of(context);
        await nav.push<void>(
          MaterialPageRoute(
            builder: (_) => DirectPane(
              api: widget.api,
              initialPeerId: peerId,
              threadOnly: true,
              initialPersonalRadio: radioSession,
              onBack: () => nav.popUntil((route) => route.isFirst),
            ),
          ),
        );
      } catch (e) {
        _privateCallDialogOpen = false;
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
      return;
    }

    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, anim, secondary) {
        return IncomingCallScreen(
          api: widget.api,
          callerId: call['callerId']?.toString(),
          callerName: who,
          mode: 'call',
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
              final accepted = data['call'] as Map? ?? {};
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
                    mode: 'call',
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

  /// Un toque envía pánico (sin diálogo de confirmación).
  Future<void> _sendPanic() async {
    final session = _session;
    if (session == null || session.panicSending) return;
    final success = await session.triggerPanic();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Alerta de pánico enviada' : (session.error ?? 'No se pudo enviar')),
        backgroundColor: success ? kRadioDanger : null,
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
    if (idx >= 0 && idx != _channelIndex) {
      await _changeChannel(idx, forChatOpen: true);
      if (!mounted) return;
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
    setState(() {
      _tab = tab;
      _overlay = _OverlayPane.none;
    });
    if (tab == _MainTab.chats) {
      PushService.instance.clearAllNotifications();
    }
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

    final mainBody = IndexedStack(
      index: _tab == _MainTab.chats ? 0 : 1,
      children: [
        ChatInboxScreen(
          key: _inboxKey,
          api: widget.api,
          groups: _groups,
          session: session,
          viewingKind: _viewingKind,
          viewingId: _viewingId,
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
        RadioScreen(
          key: const ValueKey('radio-main'),
          session: session,
          displayName: userDisplayLabel(widget.api.user),
          avatarUrl: widget.api.avatarNetworkUrl(),
          avatarHeaders: widget.api.avatarAuthHeaders(),
          groups: _groups,
          channelIndex: _channelIndex,
          onChannelChanged: _changeChannel,
          onOpenMenu: () => setState(() => _overlay = _OverlayPane.groups),
          onOpenLocation: () => setState(() => _overlay = _OverlayPane.location),
          onPanic: _sendPanic,
          onOpenProfile: _openProfileSheet,
          api: widget.api,
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
              selectedIndex: _channelIndex,
              displayName: userDisplayLabel(widget.api.user),
              onBack: () => setState(() => _overlay = _OverlayPane.none),
              onSelect: (i) async {
                await _changeChannel(i);
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
          if (_personalRadio != null)
            SafeArea(
              bottom: false,
              child: PersonalRadioBar(
                api: widget.api,
                callId: _personalRadio!['callId'] as String,
                peerName: _personalRadio!['peerName'] as String,
                token: _personalRadio!['token'] as String,
                url: _personalRadio!['url'] as String,
                role: _personalRadio!['role'] as String? ?? 'callee',
                e2eeKey: _personalRadio!['e2eeKey'] as String?,
                onClosed: () {
                  if (mounted) setState(() => _personalRadio = null);
                },
              ),
            ),
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
                          icon: Icons.cell_tower_rounded,
                          label: 'Radio',
                          selected: _tab == _MainTab.radio && _overlay == _OverlayPane.none,
                          onTap: () => _onMainTabTap(_MainTab.radio),
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
        shell,
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
                              'ALERTA DE PÁNICO',
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
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: ChatMessageBannerOverlay(),
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
