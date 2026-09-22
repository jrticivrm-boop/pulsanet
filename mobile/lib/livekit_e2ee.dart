import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';

/// Activa E2EE de LiveKit si el API entrega `e2eeKey`.
///
/// [required]: si el servidor marcó `e2ee: true`, no conectar en claro.
Future<E2EEOptions?> buildVoiceE2eeOptions(
  String? e2eeKey, {
  bool required = false,
}) async {
  if (e2eeKey == null || e2eeKey.isEmpty) {
    if (required) {
      throw StateError(
        'Cifrado E2EE obligatorio: el servidor no entregó clave de voz.',
      );
    }
    return null;
  }
  try {
    final keyProvider = await BaseKeyProvider.create();
    await keyProvider.setKey(e2eeKey);
    return E2EEOptions(keyProvider: keyProvider);
  } catch (e) {
    debugPrint('LiveKit E2EE falló (no se omite si hay clave): $e');
    rethrow;
  }
}
