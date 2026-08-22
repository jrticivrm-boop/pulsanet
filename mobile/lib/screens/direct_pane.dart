import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api_client.dart';
import '../config.dart';
import '../livekit_e2ee.dart';
import '../theme.dart';

/// Contactos, chat 1:1 y llamada privada.
class DirectPane extends StatefulWidget {
  const DirectPane({super.key, required this.api, required this.onBack});

  final ApiClient api;
  final VoidCallback onBack;

  @override
  State<DirectPane> createState() => _DirectPaneState();
}

class _DirectPaneState extends State<DirectPane> {
  List<Map<String, dynamic>> _contacts = [];
  Map<String, dynamic>? _peer;
  List<Map<String, dynamic>> _messages = [];
  final _draft = TextEditingController();
  io.Socket? _socket;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    _connectSocket();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.fetchContacts();
      if (!mounted) return;
      setState(() {
        _contacts = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _connectSocket() {
    final token = widget.api.token;
    if (token == null) return;
    final socket = io.io(
      AppConfig.apiBaseUrl,
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).disableAutoConnect().build(),
    );
    socket.connect();
    socket.on('dm:message', (data) {
      if (data is! Map) return;
      final msg = Map<String, dynamic>.from(data);
      final peerId = _peer?['id'];
      if (peerId == null) return;
      if (msg['senderId'] == peerId || msg['recipientId'] == peerId) {
        setState(() {
          if (!_messages.any((m) => m['id'] == msg['id'])) {
            _messages = [..._messages, msg];
          }
        });
      }
    });
    // Llamadas entrantes: las maneja RadioShell (pantalla fullscreen).
    _socket = socket;
  }

  Future<void> _openPeer(Map<String, dynamic> peer) async {
    setState(() {
      _peer = peer;
      _messages = [];
      _error = null;
    });
    _socket?.emit('dm:join', {'peerId': peer['id']});
    try {
      final data = await widget.api.fetchDmMessages(peer['id'] as String);
      if (!mounted) return;
      setState(() {
        _peer = Map<String, dynamic>.from(data['peer'] as Map? ?? peer);
        _messages = (data['messages'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _send() async {
    final peer = _peer;
    final text = _draft.text.trim();
    if (peer == null || text.isEmpty) return;
    _draft.clear();
    try {
      if (_socket?.connected == true) {
        _socket!.emit('dm:send', {'peerId': peer['id'], 'body': text});
      } else {
        final data = await widget.api.sendDmMessage(peer['id'] as String, text);
        final msg = Map<String, dynamic>.from(data['message'] as Map);
        setState(() => _messages = [..._messages, msg]);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _startCall() async {
    final peer = _peer;
    if (peer == null) return;
    try {
      final data = await widget.api.startPrivateCall(peer['id'] as String);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PrivateCallScreen(
            api: widget.api,
            callId: data['call']['callId'] as String,
            peerName: peer['displayName']?.toString() ?? 'Usuario',
            token: data['token'] as String,
            url: AppConfig.publicLiveKitUrl(data['url'] as String),
            role: 'caller',
            e2eeKey: data['e2eeKey']?.toString(),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  @override
  void dispose() {
    _draft.dispose();
    _socket?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final me = widget.api.user?['id'];
    return SafeArea(
      child: Column(
        children: [
          Row(
            children: [
              IconButton(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back)),
              const Expanded(
                child: Text('Directos', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
              ),
              if (_peer != null)
                IconButton(
                  tooltip: 'Llamada privada',
                  onPressed: _startCall,
                  icon: const Icon(Icons.call, color: kRadioBlue),
                ),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: kRadioDanger)),
            ),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_peer == null)
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: _contacts.length,
                separatorBuilder: (_, i) => const SizedBox(height: 6),
                itemBuilder: (context, i) {
                  final c = _contacts[i];
                  return ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: kRadioSurface,
                    leading: CircleAvatar(
                      backgroundColor: kRadioBlue.withValues(alpha: 0.15),
                      child: Text(
                        (c['displayName'] as String? ?? '?').substring(0, 1).toUpperCase(),
                        style: const TextStyle(color: kRadioBlue, fontWeight: FontWeight.w700),
                      ),
                    ),
                    title: Text(c['displayName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(c['role']?.toString() ?? ''),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _openPeer(c),
                  );
                },
              ),
            )
          else
            Expanded(
              child: Column(
                children: [
                  ListTile(
                    dense: true,
                    title: Text(_peer!['displayName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: const Text('Chat privado'),
                    trailing: TextButton(
                      onPressed: () => setState(() {
                        _peer = null;
                        _messages = [];
                      }),
                      child: const Text('Contactos'),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) {
                        final m = _messages[i];
                        final mine = m['senderId'] == me;
                        return Align(
                          alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: MediaQuery.of(context).size.width * 0.78,
                            ),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              clipBehavior: Clip.hardEdge,
                              decoration: BoxDecoration(
                                color: mine ? const Color(0xFFDCE8D4) : kRadioSurface,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                m['isDeleted'] == true
                                    ? 'Mensaje eliminado'
                                    : (m['body']?.toString() ?? m['type']?.toString() ?? ''),
                                softWrap: true,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _draft,
                              decoration: const InputDecoration(hintText: 'Mensaje privado…', isDense: true),
                              onSubmitted: (_) => _send(),
                            ),
                          ),
                          IconButton.filled(onPressed: _send, icon: const Icon(Icons.send)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class PrivateCallScreen extends StatefulWidget {
  const PrivateCallScreen({
    super.key,
    required this.api,
    required this.callId,
    required this.peerName,
    required this.token,
    required this.url,
    required this.role,
    this.e2eeKey,
  });

  final ApiClient api;
  final String callId;
  final String peerName;
  final String token;
  final String url;
  final String role;
  final String? e2eeKey;

  @override
  State<PrivateCallScreen> createState() => _PrivateCallScreenState();
}

class _PrivateCallScreenState extends State<PrivateCallScreen> {
  Room? _room;
  LocalAudioTrack? _mic;
  String _status = 'Conectando…';
  bool _muted = false;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      final e2ee = await buildVoiceE2eeOptions(widget.e2eeKey);
      final room = Room(
        roomOptions: RoomOptions(encryption: e2ee),
      );
      room.addListener(() {
        if (!mounted) return;
        // Rebuild when remote tracks arrive so audio can attach.
        setState(() {});
      });
      await room.connect(
        AppConfig.publicLiveKitUrl(widget.url),
        widget.token,
      );
      try {
        await Hardware.instance.setSpeakerphoneOn(true);
      } catch (_) {
        /* unsupported */
      }
      final mic = await LocalAudioTrack.create(
        const AudioCaptureOptions(
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        ),
      );
      await room.localParticipant?.publishAudioTrack(mic);
      if (!mounted) {
        await room.disconnect();
        return;
      }
      setState(() {
        _room = room;
        _mic = mic;
        _status = widget.role == 'caller'
            ? 'Llamando a ${widget.peerName}…'
            : 'En llamada con ${widget.peerName}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = e.toString());
    }
  }

  Future<void> _toggleMute() async {
    final mic = _mic;
    if (mic == null) return;
    if (_muted) {
      await mic.unmute();
      setState(() => _muted = false);
    } else {
      await mic.mute();
      setState(() => _muted = true);
    }
  }

  Future<void> _hangup() async {
    try {
      await widget.api.endPrivateCall(widget.callId);
    } catch (_) {}
    try {
      await _mic?.stop();
    } catch (_) {}
    try {
      await _room?.disconnect();
    } catch (_) {}
    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    _mic?.stop();
    _room?.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final initials = () {
      final parts = widget.peerName.trim().split(RegExp(r'\s+'));
      if (parts.isEmpty || parts.first.isEmpty) return '?';
      if (parts.length == 1) {
        return parts.first.substring(0, parts.first.length.clamp(1, 2)).toUpperCase();
      }
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }();

    return Scaffold(
      backgroundColor: const Color(0xFF0B141A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text(
                widget.role == 'caller' ? 'Llamada de voz' : 'Llamada de voz',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.72),
                  fontSize: 15,
                ),
              ),
              const Spacer(flex: 2),
              Container(
                width: 118,
                height: 118,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                  ),
                ),
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 40,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                widget.peerName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _status,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 15,
                ),
              ),
              const Spacer(flex: 3),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Column(
                    children: [
                      Material(
                        color: Colors.white.withValues(alpha: 0.12),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _toggleMute,
                          child: SizedBox(
                            width: 64,
                            height: 64,
                            child: Icon(
                              _muted ? Icons.mic_off : Icons.mic,
                              color: Colors.white,
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _muted ? 'Mic off' : 'Silenciar',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    children: [
                      Material(
                        color: const Color(0xFFE11D48),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _hangup,
                          child: const SizedBox(
                            width: 72,
                            height: 72,
                            child: Icon(Icons.call_end, color: Colors.white, size: 32),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Colgar',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }
}
