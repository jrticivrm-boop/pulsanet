import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_client.dart';
import '../config.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api, required this.onLoggedIn});

  final ApiClient api;
  final VoidCallback onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

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
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: kInstPaper,
        body: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(24, 56, 24, 28),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [kInstOlive, kInstOliveMid, Color(0xFF1C2E19)],
                ),
                border: Border(bottom: BorderSide(color: kInstGold, width: 4)),
              ),
              child: SafeArea(
                bottom: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Image.asset(
                          'assets/brand/tacticalptx.png',
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                        const SizedBox(width: 12),
                        Text.rich(
                          TextSpan(
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                              height: 1.05,
                            ),
                            children: const [
                              TextSpan(
                                text: 'Tactical',
                                style: TextStyle(color: Color(0xFFF4F7F0)),
                              ),
                              TextSpan(
                                text: 'Ptx',
                                style: TextStyle(color: Color(0xFFE0C56A)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'RADIO INSTITUCIONAL',
                      style: TextStyle(
                        color: Color(0xFFE0C56A),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.16,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Voz y mensajes cifrados · operación segura',
                      style: TextStyle(color: Color(0xFFD7DECE), fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                children: [
                  const Text(
                    'Iniciar sesión',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: kInstOlive,
                      letterSpacing: 0.02,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Usuario corporativo',
                    style: TextStyle(
                      color: kInstGold,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.1,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 22),
                  TextField(
                    controller: _username,
                    decoration: const InputDecoration(labelText: 'Usuario'),
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    enableSuggestions: false,
                    keyboardType: TextInputType.visiblePassword,
                    style: const TextStyle(color: kInstInk, fontWeight: FontWeight.w600),
                    onChanged: (v) {
                      final n = v.toLowerCase();
                      if (n != v) {
                        _username.value = TextEditingValue(
                          text: n,
                          selection: TextSelection.collapsed(offset: n.length),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          color: kInstMuted,
                        ),
                      ),
                    ),
                    obscureText: _obscure,
                    onSubmitted: (_) => _busy ? null : _submit(),
                    style: const TextStyle(color: kInstInk),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      color: const Color(0xFFF6EAEA),
                      child: Text(_error!, style: const TextStyle(color: kInstDanger)),
                    ),
                  ],
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Verificando…' : 'ENTRAR'),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Sesión cifrada · API ${Uri.tryParse(AppConfig.apiBaseUrl)?.host ?? ''}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: kInstMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
