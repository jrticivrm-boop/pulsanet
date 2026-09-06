import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';
import 'app_update.dart';
import 'background_radio.dart';
import 'config.dart';
import 'lan_tls.dart';
import 'location_heartbeat.dart';
import 'push_service.dart';
import 'remote_camera_prefs.dart';
import 'remote_camera_session.dart';
import 'remote_camera_wake.dart';
import 'screens/change_password_screen.dart';
import 'screens/login_screen.dart';
import 'screens/radio_shell.dart';
import 'shorebird_update.dart';
import 'theme.dart';
import 'audio_session_setup.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // TLS mínimo antes de cualquier HTTP; el resto en paralelo / diferido.
  await LanTls.install();
  await AppConfig.load();
  runApp(const TacticalPtxApp());
  // No activar AudioSession aquí: secuestra volumen/mic del teléfono.
  unawaited(BackgroundRadio.init());
}

void unawaited(Future<void> f) {
  f.catchError((Object e, StackTrace st) {
    debugPrint('init diferido: $e\n$st');
  });
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
  bool _updateBlocked = false;
  String _bootMessage = 'Iniciando...';
  double? _bootProgress;
  String? _bootError;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    setState(() {
      _booting = true;
      _updateBlocked = false;
      _bootError = null;
      _bootMessage = 'Cargando sesion...';
      _bootProgress = null;
    });

    // 1) Sesión local primero (rápido).
    try {
      await api.loadSession().timeout(const Duration(seconds: 4));
    } catch (e, st) {
      debugPrint('loadSession: $e\n$st');
    }
    if (!mounted) return;

    // 1b) Ver cámara pendiente: priorizar accept sobre OTA forzada (evita splash eterno).
    var deferForcedOta = false;
    if (api.isLoggedIn) {
      try {
        if (await RemoteCameraWake.hasPending() &&
            await RemoteCameraPrefs.canAutoAccept()) {
          deferForcedOta = true;
          final pending = await RemoteCameraWake.takePending();
          if (pending != null) {
            unawaited(
              RemoteCameraSession.instance.startSilent(
                api: api,
                call: pending,
              ),
            );
          }
        }
      } catch (e, st) {
        debugPrint('RemoteCamera boot accept: $e\n$st');
      }
    }

    // 2) OTA forzada: bloquear UI apenas hay versión nueva (no solo al final).
    //    Si hay remote cam pending, diferir el bloqueo para que monte RadioShell.
    if (!deferForcedOta) {
      try {
        final update = await AppUpdateService.checkAndApply(
          onUpdateAvailable: ({required force, required message}) {
            if (!mounted) return;
            if (!force) return;
            setState(() {
              _updateBlocked = true;
              _booting = true;
              _bootMessage = message;
              _bootProgress = 0;
              _bootError = null;
            });
          },
          onStatus: (message, progress) {
            if (!mounted) return;
            if (!_updateBlocked) return;
            setState(() {
              _bootMessage = message;
              _bootProgress = progress;
            });
          },
        );
        if (!mounted) return;
        if (update.blocked) {
          setState(() {
            _updateBlocked = true;
            _booting = true;
            _bootError = update.message;
            _bootMessage = update.message ?? 'Actualizando...';
            _bootProgress = null;
          });
          unawaited(_initBackgroundServices());
          return;
        }
      } catch (e, st) {
        debugPrint('AppUpdate boot: $e\n$st');
      }
    }

    if (!mounted) return;
    setState(() {
      _booting = false;
      _updateBlocked = false;
    });
    unawaited(_initBackgroundServices());
    if (deferForcedOta) {
      // Reintentar OTA forzada cuando el accept ya pudo arrancar.
      Future<void>.delayed(const Duration(seconds: 4), () {
        if (!mounted) return;
        unawaited(_recheckUpdate());
      });
    }
  }

  Future<void> _initBackgroundServices() async {
    final pushInit = PushService.instance.init();
    unawaited(Permission.microphone.request().then((_) {}));
    unawaited(pushInit.then((_) async {
      if (api.isLoggedIn) {
        await PushService.instance.registerWithApi(api);
      }
    }));
    ShorebirdUpdate.checkInBackground();
  }

  void _refresh() => setState(() {});

  Future<void> _onLoggedIn() async {
    await PushService.instance.registerWithApi(api);
    // Tras login: reintentar OTA (por si falló el chequeo al arrancar).
    unawaited(_recheckUpdate());
    _refresh();
  }

  Future<void> _recheckUpdate() async {
    try {
      final update = await AppUpdateService.checkAndApply(
        onUpdateAvailable: ({required force, required message}) {
          if (!mounted) return;
          if (!force) return;
          setState(() {
            _updateBlocked = true;
            _booting = true;
            _bootMessage = message;
            _bootProgress = 0;
            _bootError = null;
          });
        },
        onStatus: (message, progress) {
          if (!mounted || !_updateBlocked) return;
          setState(() {
            _bootMessage = message;
            _bootProgress = progress;
          });
        },
      );
      if (!mounted) return;
      if (update.blocked) {
        setState(() {
          _updateBlocked = true;
          _booting = true;
          _bootError = update.message;
          _bootMessage = update.message ?? 'Actualizando...';
          _bootProgress = null;
        });
      }
    } catch (e, st) {
      debugPrint('AppUpdate recheck: $e\n$st');
    }
  }

  Future<void> _onLogout() async {
    try {
      LocationHeartbeat.stop();
    } catch (_) {}
    try {
      await BackgroundRadio.stop();
    } catch (_) {}
    try {
      await AudioSessionSetup.releaseAll();
    } catch (_) {}
    try {
      await api.unregisterDevice(fcmToken: PushService.instance.token);
    } catch (_) {}
    await api.logout();
    _refresh();
  }

  Widget _bootScreen() {
    final showRetry = _updateBlocked && _bootError != null;
    return Scaffold(
      backgroundColor: kInstPaper,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/brand/tacticalptx.png',
                width: 120,
                height: 120,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 18),
              const Text(
                'TacticalPtx',
                style: TextStyle(
                  color: kInstOlive,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: 36,
                height: 36,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: kInstOlive,
                  value: showRetry ? null : _bootProgress,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                _bootMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: kInstInk,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (_bootProgress != null && !showRetry) ...[
                const SizedBox(height: 8),
                Text(
                  '${(_bootProgress! * 100).clamp(0, 100).toStringAsFixed(0)} %',
                  style: const TextStyle(color: kInstMuted, fontSize: 13),
                ),
              ],
              if (showRetry) ...[
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () {
                    setState(() {
                      _updateBlocked = false;
                      _bootError = null;
                      _booting = true;
                      _bootMessage = 'Buscando actualizacion...';
                      _bootProgress = null;
                    });
                    unawaited(_recheckUpdate());
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: kInstOlive,
                    foregroundColor: kInstOnPrimary,
                  ),
                  child: const Text('Reintentar'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TacticalPtx',
      scaffoldMessengerKey: _messengerKey,
      debugShowCheckedModeBanner: false,
      theme: tacticalTheme,
      home: (_booting || _updateBlocked)
          ? _bootScreen()
          : !api.isLoggedIn
              ? LoginScreen(api: api, onLoggedIn: _onLoggedIn)
              : (api.mustChangePassword)
                  ? ChangePasswordScreen(
                      api: api,
                      onDone: _refresh,
                      onLogout: _onLogout,
                    )
                  : RadioShell(api: api, onLogout: _onLogout),
    );
  }
}
