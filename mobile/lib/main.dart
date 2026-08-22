import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';
import 'background_radio.dart';
import 'location_heartbeat.dart';
import 'push_service.dart';
import 'screens/change_password_screen.dart';
import 'screens/login_screen.dart';
import 'screens/radio_shell.dart';
import 'shorebird_update.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BackgroundRadio.init();
  await PushService.instance.init();
  runApp(const TacticalPtxApp());
}

class TacticalPtxApp extends StatefulWidget {
  const TacticalPtxApp({super.key});

  @override
  State<TacticalPtxApp> createState() => _TacticalPtxAppState();
}

class _TacticalPtxAppState extends State<TacticalPtxApp> {
  final api = ApiClient();
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  bool _booting = true;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await api.loadSession();
    await Permission.microphone.request();
    if (api.isLoggedIn) {
      await PushService.instance.registerWithApi(api);
    }
    if (mounted) setState(() => _booting = false);

    ShorebirdUpdate.checkInBackground(
      onReadyToRestart: () {
        _messengerKey.currentState?.showSnackBar(
          const SnackBar(
            content: Text(
              'Actualización lista. Cierra TacticalPtx por completo y vuelve a abrir.',
            ),
            duration: Duration(seconds: 8),
          ),
        );
      },
    );
  }

  void _refresh() => setState(() {});

  Future<void> _onLoggedIn() async {
    await PushService.instance.registerWithApi(api);
    _refresh();
  }

  Future<void> _onLogout() async {
    try {
      LocationHeartbeat.stop();
    } catch (_) {}
    try {
      await BackgroundRadio.stop();
    } catch (_) {}
    try {
      await api.unregisterDevice(fcmToken: PushService.instance.token);
    } catch (_) {}
    await api.logout();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TacticalPtx',
      scaffoldMessengerKey: _messengerKey,
      debugShowCheckedModeBanner: false,
      theme: tacticalTheme,
      home: _booting
          ? const Scaffold(
              backgroundColor: kInstPaper,
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 36,
                      height: 36,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: kInstOlive,
                      ),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'TacticalPtx',
                      style: TextStyle(
                        color: kInstOlive,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : !api.isLoggedIn
              ? LoginScreen(api: api, onLoggedIn: _onLoggedIn)
              : (api.mustChangePassword)
                  ? ChangePasswordScreen(api: api, onDone: _refresh, onLogout: _onLogout)
                  : RadioShell(api: api, onLogout: _onLogout),
    );
  }
}
