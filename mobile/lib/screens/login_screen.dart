import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../config.dart';
import '../duckdns_hairpin.dart';
import '../es_msg.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api, required this.onLoggedIn});

  final ApiClient api;
  final VoidCallback onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _server = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  bool _showServer = false;
  String? _error;
  late final AnimationController _enter;

  @override
  void initState() {
    super.initState();
    _server.text = AppConfig.apiBaseUrl;
    _showServer = AppConfig.hasOverride;
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 780),
    )..forward();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_showServer) {
        final raw = _server.text.trim();
        // Vacío = volver al DuckDNS del build (quita override LAN pegado).
        await AppConfig.setApiBaseOverride(raw.isEmpty ? null : raw);
      }
      await DuckDnsHairpin.clear(forgetPrefs: false);
      try {
        await DuckDnsHairpin.ensure()
            .timeout(const Duration(milliseconds: 2500));
      } catch (_) {}
      if (mounted) {
        setState(() {
          _server.text = AppConfig.apiBaseUrl;
        });
      }
      await widget.api.login(
        _username.text.trim().toLowerCase(),
        _password.text,
      );
      _password.clear();
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = esMsg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    _username.dispose();
    _password.dispose();
    _server.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final host = Uri.tryParse(AppConfig.apiBaseUrl)?.host ?? '';
    final fade = CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic);
    final slide = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(fade);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Stack(
          fit: StackFit.expand,
          children: [
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF1A2418),
                    Color(0xFF152017),
                    Color(0xFF101510),
                  ],
                ),
              ),
            ),
            Positioned(
              right: -80,
              bottom: -60,
              child: IgnorePointer(
                child: Container(
                  width: 280,
                  height: 280,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        kInstGoldSoft.withValues(alpha: 0.28),
                        kInstOliveMid.withValues(alpha: 0.12),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
                  child: FadeTransition(
                    opacity: fade,
                    child: SlideTransition(
                      position: slide,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Center(
                              child: Column(
                                children: [
                                  // Logotipo completo sin caja negra ni recorte.
                                  LayoutBuilder(
                                    builder: (context, constraints) {
                                      final w = constraints.maxWidth.clamp(
                                        0.0,
                                        360.0,
                                      );
                                      return Image.asset(
                                        'assets/brand/sicom.png',
                                        width: w,
                                        fit: BoxFit.contain,
                                        filterQuality: FilterQuality.high,
                                      );
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                  Text(
                                    'Sistema de Comunicaciones\npara Operaciones Militares',
                                    textAlign: TextAlign.center,
                                    style: TacticalFonts.label(
                                      color: kInstGoldSoft,
                                      letterSpacing: 1.2,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    'Voz PTT, mensajes y despacho seguros',
                                    textAlign: TextAlign.center,
                                    style: TacticalFonts.body(
                                      color: kInstOnPrimary.withValues(alpha: 0.78),
                                      fontSize: 14,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 28),
                            Material(
                              color: kInstSurface,
                              elevation: 0,
                              shadowColor: Colors.black26,
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: kInstBorder),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.18),
                                      blurRadius: 28,
                                      offset: const Offset(0, 14),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Container(
                                      height: 4,
                                      decoration: const BoxDecoration(
                                        borderRadius: BorderRadius.vertical(
                                          top: Radius.circular(15),
                                        ),
                                        gradient: LinearGradient(
                                          colors: [
                                            kInstOlive,
                                            kInstGold,
                                            kInstGoldSoft,
                                          ],
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.stretch,
                                        children: [
                                          Text(
                                            'Iniciar sesión',
                                            style: TacticalFonts.display(
                                              fontSize: 26,
                                              fontWeight: FontWeight.w600,
                                              color: kTacGold,
                                              letterSpacing: 0.4,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'USUARIO CORPORATIVO',
                                            style: TacticalFonts.label(
                                              color: kInstGold,
                                              letterSpacing: 1.4,
                                              fontSize: 11,
                                            ),
                                          ),
                                          const SizedBox(height: 20),
                                          TextField(
                                            controller: _username,
                                            decoration: const InputDecoration(
                                              labelText: 'Usuario',
                                              hintText: 'Ej. ggomezd2',
                                              prefixIcon: Icon(Icons.badge_outlined),
                                            ),
                                            textInputAction: TextInputAction.next,
                                            autocorrect: false,
                                            enableSuggestions: false,
                                            keyboardType: TextInputType.visiblePassword,
                                            style: TacticalFonts.body(
                                              color: kInstInk,
                                              fontWeight: FontWeight.w600,
                                            ),
                                            onChanged: (v) {
                                              final n = v.toLowerCase();
                                              if (n != v) {
                                                _username.value = TextEditingValue(
                                                  text: n,
                                                  selection: TextSelection.collapsed(
                                                    offset: n.length,
                                                  ),
                                                );
                                              }
                                            },
                                          ),
                                          const SizedBox(height: 12),
                                          TextField(
                                            controller: _password,
                                            decoration: InputDecoration(
                                              labelText: 'Contraseña',
                                              prefixIcon: const Icon(Icons.lock_outline_rounded),
                                              suffixIcon: IconButton(
                                                onPressed: () =>
                                                    setState(() => _obscure = !_obscure),
                                                icon: Icon(
                                                  _obscure
                                                      ? Icons.visibility_outlined
                                                      : Icons.visibility_off_outlined,
                                                  color: kInstMuted,
                                                ),
                                              ),
                                            ),
                                            obscureText: _obscure,
                                            onSubmitted: (_) => _busy ? null : _submit(),
                                            style: TacticalFonts.body(color: kInstInk),
                                          ),
                                          const SizedBox(height: 4),
                                          Align(
                                            alignment: Alignment.centerLeft,
                                            child: TextButton(
                                              onPressed: () =>
                                                  setState(() => _showServer = !_showServer),
                                              child: Text(
                                                _showServer
                                                    ? 'Ocultar servidor'
                                                    : 'Servidor (si no conecta)',
                                                style: TacticalFonts.label(
                                                  color: kInstGold,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ),
                                          ),
                                          if (_showServer) ...[
                                            TextField(
                                              controller: _server,
                                              decoration: const InputDecoration(
                                                labelText: 'URL del servidor',
                                                hintText:
                                                    'https://192.168.1.77 o DuckDNS',
                                                prefixIcon: Icon(Icons.dns_outlined),
                                              ),
                                              keyboardType: TextInputType.url,
                                              autocorrect: false,
                                              style: TacticalFonts.body(
                                                color: kInstInk,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                          ],
                                          if (_error != null) ...[
                                            const SizedBox(height: 12),
                                            Container(
                                              width: double.infinity,
                                              padding: const EdgeInsets.all(12),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF3A2222),
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(
                                                  color: kInstDanger.withValues(alpha: 0.45),
                                                ),
                                              ),
                                              child: Text(
                                                _error!,
                                                style: TacticalFonts.body(
                                                  color: const Color(0xFFFFB4A8),
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            if (!_showServer) ...[
                                              const SizedBox(height: 8),
                                              Text(
                                                'En 4G deja el servidor en DuckDNS. '
                                                'En Wi‑Fi la app elige sola la IP del PC.',
                                                style: TacticalFonts.label(
                                                  color: kInstMuted,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ],
                                          const SizedBox(height: 20),
                                          FilledButton(
                                            onPressed: _busy ? null : _submit,
                                            style: FilledButton.styleFrom(
                                              minimumSize: const Size.fromHeight(52),
                                              backgroundColor: kInstOlive,
                                              foregroundColor: kInstOnPrimary,
                                            ),
                                            child: Text(
                                              _busy ? 'Verificando…' : 'ENTRAR',
                                              style: TacticalFonts.display(
                                                fontSize: 18,
                                                fontWeight: FontWeight.w600,
                                                letterSpacing: 1.6,
                                                color: kInstOnPrimary,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(height: 14),
                                          Text(
                                            host.isEmpty
                                                ? 'Sesión cifrada'
                                                : 'Sesión cifrada · API $host',
                                            textAlign: TextAlign.center,
                                            style: TacticalFonts.body(
                                              color: kInstMuted,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
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
          ],
        ),
      ),
    );
  }
}
