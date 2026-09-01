import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../config.dart';
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
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  late final AnimationController _enter;

  @override
  void initState() {
    super.initState();
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
      await widget.api.login(_username.text.trim().toLowerCase(), _password.text);
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
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF2A4726),
                    kInstOlive,
                    kInstOliveDeep,
                    Color(0xFF121C14),
                  ],
                  stops: [0, 0.35, 0.72, 1],
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
                                  Container(
                                    width: 88,
                                    height: 88,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(22),
                                      border: Border.all(
                                        color: kInstGoldSoft.withValues(alpha: 0.7),
                                        width: 2,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.35),
                                          blurRadius: 24,
                                          offset: const Offset(0, 10),
                                        ),
                                      ],
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: Image.asset(
                                      'assets/brand/tacticalptx.png',
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Text.rich(
                                    TextSpan(
                                      style: TacticalFonts.display(
                                        fontSize: 36,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.4,
                                        height: 1.02,
                                      ),
                                      children: const [
                                        TextSpan(
                                          text: 'Tactical',
                                          style: TextStyle(color: kInstOnPrimary),
                                        ),
                                        TextSpan(
                                          text: 'Ptx',
                                          style: TextStyle(color: kInstGoldSoft),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Container(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    decoration: const BoxDecoration(
                                      border: Border(
                                        bottom: BorderSide(color: kInstGold, width: 2),
                                      ),
                                    ),
                                    child: Text(
                                      'RADIO INSTITUCIONAL',
                                      style: TacticalFonts.label(
                                        color: kInstGoldSoft,
                                        letterSpacing: 2.2,
                                        fontSize: 11,
                                      ),
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
