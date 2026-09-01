import 'package:flutter/material.dart';

import '../api_client.dart';
import '../es_msg.dart';
import '../theme.dart';
import '../widgets/tactical_backdrop.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({
    super.key,
    required this.api,
    required this.onDone,
    required this.onLogout,
  });

  final ApiClient api;
  final VoidCallback onDone;
  final VoidCallback onLogout;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _obscureCurrent = true;
  bool _obscureNext = true;
  bool _obscureConfirm = true;
  String? _error;

  Future<void> _submit() async {
    if (_next.text != _confirm.text) {
      setState(() => _error = 'La confirmación no coincide');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.changePassword(
        currentPassword: _current.text,
        newPassword: _next.text,
      );
      widget.onDone();
    } catch (e) {
      setState(() => _error = esMsg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _pwdDecoration({
    required String label,
    required bool obscure,
    required VoidCallback onToggle,
  }) {
    return InputDecoration(
      labelText: label,
      suffixIcon: IconButton(
        onPressed: onToggle,
        tooltip: obscure ? 'Mostrar contraseña' : 'Ocultar contraseña',
        icon: Icon(
          obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          color: kInstMuted,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.api.user?['displayName'] ?? widget.api.user?['username'] ?? '';
    return Scaffold(
      backgroundColor: kTacBg,
      body: TacticalBackdrop(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 16),
              Text(
                'CAMBIAR CONTRASEÑA',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: kTacGold,
                      letterSpacing: 1.1,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Hola $name. Debes cambiar la contraseña temporal antes de continuar '
                '(mín. 8 caracteres, con letras y números).',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: kTacMuted,
                    ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _current,
                obscureText: _obscureCurrent,
                style: const TextStyle(color: kTacOnSurface),
                decoration: _pwdDecoration(
                  label: 'Contraseña temporal',
                  obscure: _obscureCurrent,
                  onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _next,
                obscureText: _obscureNext,
                style: const TextStyle(color: kTacOnSurface),
                decoration: _pwdDecoration(
                  label: 'Nueva contraseña',
                  obscure: _obscureNext,
                  onToggle: () => setState(() => _obscureNext = !_obscureNext),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirm,
                obscureText: _obscureConfirm,
                style: const TextStyle(color: kTacOnSurface),
                decoration: _pwdDecoration(
                  label: 'Confirmar nueva',
                  obscure: _obscureConfirm,
                  onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: kInstDanger, fontWeight: FontWeight.w600),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Guardando…' : 'Guardar y continuar'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _busy ? null : widget.onLogout,
                child: const Text('Salir', style: TextStyle(color: kTacMuted)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
