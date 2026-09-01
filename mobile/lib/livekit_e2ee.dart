import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';

/// Activa E2EE de LiveKit si el API entrega `e2eeKey`.
Future<E2EEOptions?> buildVoiceE2eeOptions(String? e2eeKey) async {
  if (e2eeKey == null || e2eeKey.isEmpty) return null;
  try {
    final keyProvider = await BaseKeyProvider.create();
    await keyProvider.setKey(e2eeKey);
    return E2EEOptions(keyProvider: keyProvider);
  } catch (e) {
    debugPrint('LiveKit E2EE falló (no se omite si hay clave): $e');
    rethrow;
  }
}
