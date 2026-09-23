import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// GPS usable (rechaza NaN y el falso 0,0 / Null Island).
bool isValidMapCoord(double? latitude, double? longitude) {
  if (latitude == null || longitude == null) return false;
  if (!latitude.isFinite || !longitude.isFinite) return false;
  if (latitude.abs() > 90 || longitude.abs() > 180) return false;
  if (latitude.abs() < 1e-5 && longitude.abs() < 1e-5) return false;
  return true;
}

/// Abre Maps externo en el punto del pánico o con navegación turn-by-turn.
Future<bool> openPanicLocation({
  required double latitude,
  required double longitude,
  bool navigate = false,
  String? label,
}) async {
  if (!isValidMapCoord(latitude, longitude)) return false;

  final lat = latitude;
  final lng = longitude;
  final name = Uri.encodeComponent(label?.trim().isNotEmpty == true
      ? label!.trim()
      : 'Alerta');

  final candidates = <Uri>[];
  if (navigate) {
    if (!kIsWeb && Platform.isIOS) {
      candidates.add(Uri.parse('maps://?daddr=$lat,$lng&dirflg=d'));
      candidates.add(
        Uri.parse('https://maps.apple.com/?daddr=$lat,$lng&dirflg=d'),
      );
    } else {
      candidates.add(Uri.parse('google.navigation:q=$lat,$lng&mode=d'));
    }
    candidates.add(
      Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
      ),
    );
  } else {
    if (!kIsWeb && Platform.isIOS) {
      candidates.add(Uri.parse('maps://?ll=$lat,$lng&q=$name'));
    }
    candidates.add(
      Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
      ),
    );
    candidates.add(Uri.parse('geo:$lat,$lng?q=$lat,$lng($name)'));
  }

  for (final uri in candidates) {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (ok) return true;
    } catch (_) {
      /* probar siguiente */
    }
  }
  return false;
}
