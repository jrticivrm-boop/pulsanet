import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

/// Resultado de agrupación por proximidad en pantalla (estilo Google Maps).
class GpsMapClusterItem<T> {
  GpsMapClusterItem.point(T p)
      : point = p,
        members = [p],
        center = null;

  GpsMapClusterItem.cluster(this.members, this.center)
      : assert(members.length >= 2),
        point = null;

  final T? point;
  final List<T> members;
  final LatLng? center;

  bool get isCluster => members.length >= 2;
  int get count => members.length;
}

typedef GpsClusterLatLng = ({double lat, double lng});

/// Agrupa puntos cercanos en píxeles a un zoom dado.
///
/// [pixelRadius] ~ radio de agrupación en px (≈ Google cluster).
/// A zoom ≥ [maxClusterZoom] no agrupa (se ven pines individuales).
List<GpsMapClusterItem<T>> clusterByMapZoom<T>({
  required List<T> items,
  required double Function(T) latOf,
  required double Function(T) lngOf,
  required double zoom,
  double pixelRadius = 55,
  double maxClusterZoom = 16.5,
  bool Function(T)? keepSeparate,
}) {
  if (items.isEmpty) return const [];
  if (zoom >= maxClusterZoom) {
    return items.map(GpsMapClusterItem.point).toList();
  }

  final remaining = List<T>.from(items);
  final out = <GpsMapClusterItem<T>>[];

  while (remaining.isNotEmpty) {
    final seed = remaining.removeAt(0);
    if (keepSeparate != null && keepSeparate(seed)) {
      out.add(GpsMapClusterItem.point(seed));
      continue;
    }
    final sx = _lngToX(lngOf(seed), zoom);
    final sy = _latToY(latOf(seed), zoom);
    final members = <T>[seed];
    for (var i = remaining.length - 1; i >= 0; i--) {
      final p = remaining[i];
      if (keepSeparate != null && keepSeparate(p)) continue;
      final dx = _lngToX(lngOf(p), zoom) - sx;
      final dy = _latToY(latOf(p), zoom) - sy;
      if (dx * dx + dy * dy <= pixelRadius * pixelRadius) {
        members.add(p);
        remaining.removeAt(i);
      }
    }
    if (members.length == 1) {
      out.add(GpsMapClusterItem.point(members.first));
    } else {
      var latSum = 0.0;
      var lngSum = 0.0;
      for (final m in members) {
        latSum += latOf(m);
        lngSum += lngOf(m);
      }
      out.add(
        GpsMapClusterItem.cluster(
          members,
          LatLng(latSum / members.length, lngSum / members.length),
        ),
      );
    }
  }
  return out;
}

double _lngToX(double lng, double z) =>
    ((lng + 180.0) / 360.0) * math.pow(2.0, z) * 256.0;

double _latToY(double lat, double z) {
  final s = math.sin(lat * math.pi / 180.0);
  final clamped = s.clamp(-0.9999, 0.9999);
  return (0.5 - math.log((1 + clamped) / (1 - clamped)) / (4 * math.pi)) *
      math.pow(2.0, z) *
      256.0;
}
