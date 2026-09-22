import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_client.dart';
import 'app_update.dart';
import 'background_radio.dart';
import 'config.dart';
import 'duckdns_hairpin.dart';
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
  // Presupuesto corto: el discovery no debe congelar el splash.
  try {
    await DuckDnsHairpin.ensure().timeout(const Duration(milliseconds: 2500));
  } catch (_) {}
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

    // 1) Sesión local (disco) — única espera obligatoria antes de la UI.
    try {
      await api.loadSession().timeout(const Duration(seconds: 2));
    } catch (e, st) {
      debugPrint('loadSession: $e\n$st');
    }
    if (!mounted) return;

    // 1b) Ver cámara pendiente: accept en paralelo; no bloquear splash.
    var hadRemoteCamPending = false;
    if (api.isLoggedIn) {
      try {
        if (await RemoteCameraWake.hasPending() &&
            await RemoteCameraPrefs.canAutoAccept()) {
          hadRemoteCamPending = true;
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

    // 2) Entrar a la app de inmediato (no esperar red/OTA en el splash).
    if (!mounted) return;
    setState(() {
      _booting = false;
      _updateBlocked = false;
    });
    unawaited(_initBackgroundServices());

    // 3) OTA en segundo plano: solo bloquea UI si hay force y hay que actualizar.
    if (hadRemoteCamPending) {
      Future<void>.delayed(const Duration(seconds: 3), () {
        if (!mounted) return;
        unawaited(_recheckUpdate());
      });
    } else {
      unawaited(_recheckUpdate());
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
    const splashBg = Color(0xFF000000);
    return Scaffold(
      backgroundColor: splashBg,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  'assets/brand/sicom_round.png',
                  width: 220,
                  height: 220,
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.high,
                ),
                const SizedBox(height: 28),
                Text(
                  'Sistema de Comunicaciones\npara Operaciones Militares',
                  textAlign: TextAlign.center,
                  style: TacticalFonts.label(
                    color: kInstGoldSoft.withValues(alpha: 0.92),
                    fontSize: 12,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 36),
                SizedBox(
                  width: 36,
                  height: 36,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: kInstGoldSoft,
                    value: showRetry ? null : _bootProgress,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  _bootMessage,
                  textAlign: TextAlign.center,
                  style: TacticalFonts.body(
                    color: kInstOnPrimary.withValues(alpha: 0.85),
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (_bootProgress != null && !showRetry) ...[
                  const SizedBox(height: 8),
                  Text(
                    '${((_bootProgress ?? 0) * 100).round()}%',
                    style: TacticalFonts.label(
                      color: kInstGoldSoft,
                      fontSize: 11,
                    ),
                  ),
                ],
                if (showRetry) ...[
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _retryBoot,
                    child: const Text('Reintentar'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
 
  void _retryBoot() {
    setState(() {
      _updateBlocked = false;
      _bootError = null;
      _booting = true;
      _bootMessage = 'Buscando actualizacion...';
      _bootProgress = null;
    });
    unawaited(_recheckUpdate());
  }


  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SICOM',
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
