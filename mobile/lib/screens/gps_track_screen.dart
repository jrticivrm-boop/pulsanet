import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../api_client.dart';
import '../config.dart';
import '../gps_location_cluster.dart';
import '../theme.dart';
import '../widgets/gps_cluster_pin.dart';
import '../widgets/gps_map_pin.dart';
import '../widgets/user_avatar.dart';

/// GPS completo (paridad web): avatares con latido, sitios tácticos,
/// estados IV R.M., ruta + huecos OSRM al seleccionar.
class GpsTrackScreen extends StatefulWidget {
  const GpsTrackScreen({
    super.key,
    required this.api,
    this.channelGroupId,
    this.channelName,
    this.groups = const [],
  });

  final ApiClient api;
  final String? channelGroupId;
  final String? channelName;
  /// Membresías del operador: opciones del filtro GPS (además de «Todos»).
  final List<Map<String, dynamic>> groups;

  @override
  State<GpsTrackScreen> createState() => _GpsTrackScreenState();
}

class _GpsTrackScreenState extends State<GpsTrackScreen>
    with AutomaticKeepAliveClientMixin {
  final _map = MapController();
  Timer? _poll;
  List<_GpsPeer> _peers = [];
  String? _error;
  bool _loading = true;
  String? _selectedId;
  /// `null` = Todos; id concreto = solo ese grupo.
  String? _filterGroupId;
  bool _follow = true;
  bool _showStates = true;
  bool _showSites = true;
  bool _showTrack = true;
  bool _showList = true;
  double _mapZoom = 12;

  /// Como web `CARGO_LABEL_MIN_ZOOM` (~11); un poco más cerca en móvil.
  static const _labelMinZoom = 13.0;

  List<Polygon> _statePolygons = [];
  List<_TacticalSite> _sites = [];
  List<LatLng> _trackPts = [];
  List<List<LatLng>> _gapRoutes = [];
  List<LatLng> _gapPendingEnds = [];
  bool _trackLoading = false;

  static const _defaultCenter = LatLng(25.6866, -100.3161);
  static const _gapOrange = Color(0xFFE87812);
  static const _ivColors = {
    'NL': Color(0xFF2F6FED),
    'TM': Color(0xFFC97070),
    'SLP': Color(0xFF1F8A4C),
  };

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    final gid = (widget.channelGroupId ?? '').trim();
    _filterGroupId = gid.isNotEmpty ? gid : null;
    unawaited(_loadStates());
    unawaited(_loadSites());
    unawaited(_reload());
    _poll = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(_reload(silent: true));
    });
  }

  @override
  void didUpdateWidget(covariant GpsTrackScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channelGroupId != widget.channelGroupId) {
      final oldGid = (oldWidget.channelGroupId ?? '').trim();
      final newGid = (widget.channelGroupId ?? '').trim();
      // Si el filtro seguía al canal activo, acompaña el cambio de radio.
      if (_filterGroupId == oldGid) {
        _filterGroupId = newGid.isNotEmpty ? newGid : null;
      }
      unawaited(_reload());
    }
  }

  String get _filterLabel {
    final id = _filterGroupId;
    if (id == null || id.isEmpty) return 'Todos';
    for (final g in widget.groups) {
      if (g['id']?.toString() == id) {
        final n = (g['name']?.toString() ?? '').trim();
        if (n.isNotEmpty) return n;
      }
    }
    final ch = (widget.channelName ?? '').trim();
    if (ch.isNotEmpty && id == widget.channelGroupId) return ch;
    return 'Grupo';
  }

  @override
  void dispose() {
    _poll?.cancel();
    _map.dispose();
    super.dispose();
  }

  Future<void> _loadStates() async {
    try {
      final raw = await rootBundle.loadString('assets/geo/ivRmStates.json');
      final data = jsonDecode(raw);
      final features = data is Map ? data['features'] : null;
      if (features is! List) return;
      final polys = <Polygon>[];
      for (final f in features) {
        if (f is! Map) continue;
        final props = f['properties'];
        final id = props is Map ? props['id']?.toString() : null;
        if (id == null || !_ivColors.containsKey(id)) continue;
        final color = _ivColors[id]!;
        final geom = f['geometry'];
        if (geom is! Map) continue;
        final type = geom['type']?.toString();
        final coords = geom['coordinates'];
        if (coords is! List) continue;
        void addRing(List ring) {
          final pts = <LatLng>[];
          for (final c in ring) {
            if (c is List && c.length >= 2) {
              final lng = (c[0] as num).toDouble();
              final lat = (c[1] as num).toDouble();
              pts.add(LatLng(lat, lng));
            }
          }
          if (pts.length >= 3) {
            polys.add(
              Polygon(
                points: pts,
                color: color.withValues(alpha: 0.12),
                borderColor: color.withValues(alpha: 0.85),
                borderStrokeWidth: 1.6,
              ),
            );
          }
        }

        if (type == 'Polygon') {
          if (coords.isNotEmpty && coords[0] is List) addRing(coords[0] as List);
        } else if (type == 'MultiPolygon') {
          for (final poly in coords) {
            if (poly is List && poly.isNotEmpty && poly[0] is List) {
              addRing(poly[0] as List);
            }
          }
        }
      }
      if (mounted) setState(() => _statePolygons = polys);
    } catch (_) {}
  }

  Future<void> _loadSites() async {
    try {
      final data = await widget.api.fetchTacticalSites();
      final raw = data['sites'] ?? data['items'] ?? data;
      final list = <_TacticalSite>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is! Map) continue;
          final m = Map<String, dynamic>.from(e);
          if (m['isActive'] == false) continue;
          final lat = (m['latitude'] as num?)?.toDouble() ??
              (m['lat'] as num?)?.toDouble();
          final lng = (m['longitude'] as num?)?.toDouble() ??
              (m['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) continue;
          list.add(
            _TacticalSite(
              id: m['id']?.toString() ?? '$lat,$lng',
              name: m['name']?.toString() ?? 'Sitio',
              lat: lat,
              lng: lng,
              color: _parseColor(
                    m['groupColor']?.toString() ?? m['color']?.toString(),
                  ) ??
                  kInstGold,
              groupName: m['groupName']?.toString() ??
                  m['group']?['name']?.toString(),
              iconUrl: _absoluteApiUrl(
                m['groupIconUrl']?.toString() ?? m['iconUrl']?.toString(),
              ),
            ),
          );
        }
      }
      if (mounted) setState(() => _sites = list);
    } catch (_) {}
  }

  /// Rutas relativas del API (`/api/tactical-sites/groups/.../icon`) → URL absoluta.
  String? _absoluteApiUrl(String? path) {
    if (path == null || path.isEmpty || path == 'null') return null;
    if (path.startsWith('http')) return path.split('?').first;
    return '${AppConfig.apiBaseUrl}$path';
  }

  Color? _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    var s = hex.trim();
    if (s.startsWith('#')) s = s.substring(1);
    if (s.length == 3) {
      s = '${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}';
    }
    if (s.length != 6) return null;
    final v = int.tryParse(s, radix: 16);
    if (v == null) return null;
    return Color(0xFF000000 | v);
  }

  Future<void> _reload({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final gid = (_filterGroupId ?? '').trim();
      final data = await widget.api.fetchLocations(
        groupIds: gid.isNotEmpty ? [gid] : null,
      );
      final raw = data['locations'];
      final list = <_GpsPeer>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is! Map) continue;
          final m = Map<String, dynamic>.from(e);
          final lat = (m['latitude'] as num?)?.toDouble();
          final lng = (m['longitude'] as num?)?.toDouble();
          if (lat == null || lng == null) continue;
          if (!lat.isFinite || !lng.isFinite) continue;
          list.add(_GpsPeer.fromJson(m, lat, lng));
        }
      }
      if (!mounted) return;
      list.sort(_comparePeersLiveFirst);
      setState(() {
        _peers = list;
        _error = null;
        _loading = false;
      });
      if (_selectedId != null) {
        final still = list.where((p) => p.userId == _selectedId);
        if (still.isEmpty) {
          setState(() {
            _selectedId = null;
            _trackPts = [];
            _gapRoutes = [];
            _gapPendingEnds = [];
          });
        } else if (_follow) {
          final p = still.first;
          _map.move(
            LatLng(p.lat, p.lng),
            _map.camera.zoom < 14 ? 15 : _map.camera.zoom,
          );
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _selectPeer(_GpsPeer p, {bool moveMap = true}) async {
    setState(() {
      _selectedId = p.userId;
      _follow = true;
    });
    if (moveMap) {
      _map.move(LatLng(p.lat, p.lng), 15.5);
    }
    if (_showTrack) {
      unawaited(_loadTrack(p.userId));
    }
  }

  Future<void> _loadTrack(String userId) async {
    setState(() {
      _trackLoading = true;
      _trackPts = [];
      _gapRoutes = [];
      _gapPendingEnds = [];
    });
    try {
      final data = await widget.api.fetchUserTrack(userId, hours: 8);
      final raw = data['points'] ?? data['track'] ?? data['locations'];
      final pts = <LatLng>[];
      final timed = <({LatLng ll, DateTime? at, bool gapBefore})>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is! Map) continue;
          final m = Map<String, dynamic>.from(e);
          final lat = (m['latitude'] as num?)?.toDouble() ??
              (m['lat'] as num?)?.toDouble();
          final lng = (m['longitude'] as num?)?.toDouble() ??
              (m['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) continue;
          final ll = LatLng(lat, lng);
          pts.add(ll);
          timed.add((
            ll: ll,
            at: _parseAt(m['recordedAt'] ?? m['at'] ?? m['t']),
            gapBefore: m['gapBefore'] == true,
          ));
        }
      }
      if (!mounted || _selectedId != userId) return;
      setState(() {
        _trackPts = pts;
        _trackLoading = false;
      });
      unawaited(_resolveGaps(timed));
    } catch (_) {
      if (mounted && _selectedId == userId) {
        setState(() => _trackLoading = false);
      }
    }
  }

  DateTime? _parseAt(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    var s = v.toString().trim();
    if (RegExp(r'^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}').hasMatch(s) &&
        !RegExp(r'[zZ]|[+-]\d{2}:?\d{2}$').hasMatch(s)) {
      s = '${s.replaceFirst(' ', 'T')}Z';
    }
    return DateTime.tryParse(s);
  }

  double _haversineM(LatLng a, LatLng b) {
    const r = 6371000.0;
    final dLat = (b.latitude - a.latitude) * math.pi / 180;
    final dLng = (b.longitude - a.longitude) * math.pi / 180;
    final la1 = a.latitude * math.pi / 180;
    final la2 = b.latitude * math.pi / 180;
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(la1) * math.cos(la2) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(h));
  }

  Future<void> _resolveGaps(
    List<({LatLng ll, DateTime? at, bool gapBefore})> timed,
  ) async {
    if (timed.length < 2) return;
    final gaps = <(LatLng, LatLng)>[];
    for (var i = 1; i < timed.length; i++) {
      final a = timed[i - 1];
      final b = timed[i];
      final meters = _haversineM(a.ll, b.ll);
      var secs = 0;
      if (a.at != null && b.at != null) {
        secs = b.at!.difference(a.at!).inSeconds.abs();
      }
      final isGap = b.gapBefore ||
          (secs >= 120 && meters >= 300) ||
          meters >= 1500;
      if (isGap) gaps.add((a.ll, b.ll));
    }
    if (gaps.isEmpty || !mounted) return;

    final routes = <List<LatLng>>[];
    final pending = <LatLng>[];
    for (final g in gaps.take(12)) {
      try {
        final res = await widget.api.fetchTrackGapRoute(
          fromLat: g.$1.latitude,
          fromLng: g.$1.longitude,
          toLat: g.$2.latitude,
          toLng: g.$2.longitude,
        );
        final source = res['source']?.toString();
        final estimated = res['estimated'] == true;
        final geom = res['points'] ??
            res['coordinates'] ??
            res['geometry']?['coordinates'] ??
            res['route'];
        if (source == 'osrm' && !estimated && geom is List && geom.isNotEmpty) {
          final line = <LatLng>[];
          for (final c in geom) {
            if (c is List && c.length >= 2 && c[0] is num && c[1] is num) {
              // API routeHint: [lat, lng]
              line.add(
                LatLng((c[0] as num).toDouble(), (c[1] as num).toDouble()),
              );
            } else if (c is Map) {
              final lat = (c['lat'] as num?)?.toDouble();
              final lng = (c['lng'] as num?)?.toDouble();
              if (lat != null && lng != null) line.add(LatLng(lat, lng));
            }
          }
          if (line.length >= 2) {
            routes.add(line);
            continue;
          }
        }
        pending.addAll([g.$1, g.$2]);
      } catch (_) {
        pending.addAll([g.$1, g.$2]);
      }
    }
    if (!mounted) return;
    setState(() {
      _gapRoutes = routes;
      _gapPendingEnds = pending;
    });
  }

  /// Colores de borde del pin (paridad web `--pin-green`).
  Color _presenceColor(String? presence) {
    switch (presence) {
      case 'online':
      case 'radio':
      case 'active':
      case 'service':
        return const Color(0xFF1F5A2E); // is-live
      case 'away':
        return const Color(0xFFA16207); // is-away
      case 'stale':
        return const Color(0xFF991B1B); // is-stale (rojo sólido)
      case 'offline':
        return const Color(0xFF6B7280); // is-offline (gris)
      default:
        return const Color(0xFF6B7280);
    }
  }

  Color _presenceRim(String? presence) {
    switch (presence) {
      case 'online':
      case 'radio':
      case 'active':
      case 'service':
        return const Color(0xFFE8F5E4);
      case 'away':
        return const Color(0xFFFEF9C3);
      case 'stale':
        return const Color(0xFFFECACA);
      default:
        return const Color(0xFFE5E7EB);
    }
  }

  String _presenceLabel(String? presence) {
    switch (presence) {
      case 'online':
      case 'radio':
      case 'active':
      case 'service':
        return 'En línea';
      case 'away':
        return 'Ausente';
      case 'stale':
        return 'Fuera de línea';
      case 'offline':
        return 'Desconectado';
      default:
        return presence ?? '—';
    }
  }

  bool _isLive(String? presence) =>
      presence == 'online' ||
      presence == 'radio' ||
      presence == 'active' ||
      presence == 'service' ||
      presence == 'away';

  String _clusterSliceKey(_GpsPeer p) {
    if (p.panic) return 'panic';
    switch (p.presence) {
      case 'online':
      case 'radio':
      case 'active':
      case 'service':
        return 'online';
      case 'away':
        return 'away';
      case 'stale':
        return 'stale';
      case 'offline':
        return 'offline';
      default:
        return 'offline';
    }
  }

  Map<String, int> _clusterSlices(List<_GpsPeer> members) {
    final out = <String, int>{};
    for (final m in members) {
      final k = _clusterSliceKey(m);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }

  /// Lista: en línea primero; luego más recientes.
  int _comparePeersLiveFirst(_GpsPeer a, _GpsPeer b) {
    final la = _isLive(a.presence) ? 0 : 1;
    final lb = _isLive(b.presence) ? 0 : 1;
    if (la != lb) return la - lb;
    final ta = a.recordedAt?.millisecondsSinceEpoch ?? 0;
    final tb = b.recordedAt?.millisecondsSinceEpoch ?? 0;
    if (tb != ta) return tb.compareTo(ta);
    return a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase());
  }

  /// Mapa: dibujar offline abajo y en línea (verde) encima; selección al final.
  List<_GpsPeer> get _peersForMap {
    final list = List<_GpsPeer>.from(_peers);
    list.sort((a, b) {
      int rank(_GpsPeer p) {
        if (p.userId == _selectedId) return 2;
        if (_isLive(p.presence)) return 1;
        return 0;
      }

      return rank(a).compareTo(rank(b));
    });
    return list;
  }

  List<GpsMapClusterItem<_GpsPeer>> get _mapClusters {
    return clusterByMapZoom<_GpsPeer>(
      items: _peersForMap,
      latOf: (p) => p.lat,
      lngOf: (p) => p.lng,
      zoom: _mapZoom,
      keepSeparate: (p) => p.userId == _selectedId,
    );
  }

  void _onClusterTap(GpsMapClusterItem<_GpsPeer> cluster) {
    final members = cluster.members;
    if (members.isEmpty) return;

    // Tope conservador (no 18): miembros cercanos no deben salir de frame.
    const maxZ = 16.5;
    const breakZ = 16.5;
    const fitPad = 96.0;
    final zoomNow = _mapZoom;

    if (members.length == 1) {
      final p = members.first;
      final next = (zoomNow + 2).clamp(breakZ, maxZ);
      _map.move(LatLng(p.lat, p.lng), next);
      setState(() => _mapZoom = next);
      return;
    }

    var minLat = members.first.lat;
    var maxLat = members.first.lat;
    var minLng = members.first.lng;
    var maxLng = members.first.lng;
    for (final m in members.skip(1)) {
      if (m.lat < minLat) minLat = m.lat;
      if (m.lat > maxLat) maxLat = m.lat;
      if (m.lng < minLng) minLng = m.lng;
      if (m.lng > maxLng) maxLng = m.lng;
    }

    final latSpan = (maxLat - minLat).abs();
    final lngSpan = (maxLng - minLng).abs();
    final center = LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2);

    // Mismo punto (o casi): acercar al centro para desagrupar.
    if (latSpan < 1e-6 && lngSpan < 1e-6) {
      final next = (zoomNow + 2).clamp(breakZ, maxZ);
      _map.move(center, next);
      setState(() => _mapZoom = next);
      return;
    }

    final bounds = LatLngBounds(LatLng(minLat, minLng), LatLng(maxLat, maxLng));
    _map.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: EdgeInsets.all(fitPad),
        maxZoom: maxZ,
      ),
    );
    final fitted = _map.camera.zoom;
    // Soft +1 si no hubo progreso (evita over-zoom +2 / breakZ agresivo).
    if (fitted <= zoomNow + 0.25) {
      final soft = (zoomNow + 1).clamp(zoomNow, maxZ);
      if (soft > zoomNow + 0.1) {
        _map.move(center, soft);
        setState(() => _mapZoom = soft);
      } else {
        setState(() => _mapZoom = fitted);
      }
      return;
    }
    setState(() => _mapZoom = fitted);
  }

  int get _liveCount => _peers.where((p) => _isLive(p.presence)).length;

  _GpsPeer? get _selected => _peers
      .cast<_GpsPeer?>()
      .firstWhere((p) => p?.userId == _selectedId, orElse: () => null);

  String _ageLabel(_GpsPeer p) {
    final at = p.recordedAt;
    if (at == null) return 'Sin hora';
    final d = DateTime.now().difference(at);
    if (d.inSeconds < 45) return 'Ahora';
    if (d.inMinutes < 60) return 'Hace ${d.inMinutes} min';
    if (d.inHours < 24) return 'Hace ${d.inHours} h';
    return 'Hace ${d.inDays} d';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final selected = _selected;
    final headers = widget.api.avatarAuthHeaders();

    return ColoredBox(
      color: kInstPaper,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 8, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          'Seguimiento GPS',
                          style: TacticalFonts.display(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: kInstOlive,
                          ),
                        ),
                      ),
                      _GpsToolbarAction(
                        icon: Icons.layers_outlined,
                        label: 'Capas',
                        child: PopupMenuButton<String>(
                          tooltip: 'Capas del mapa',
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.layers_outlined, size: 20, color: kInstOlive),
                          onSelected: (v) {
                            setState(() {
                              switch (v) {
                                case 'states':
                                  _showStates = !_showStates;
                                case 'sites':
                                  _showSites = !_showSites;
                                case 'track':
                                  _showTrack = !_showTrack;
                                  if (_showTrack && _selectedId != null) {
                                    unawaited(_loadTrack(_selectedId!));
                                  } else {
                                    _trackPts = [];
                                    _gapRoutes = [];
                                    _gapPendingEnds = [];
                                  }
                              }
                            });
                          },
                          itemBuilder: (ctx) => [
                            CheckedPopupMenuItem(
                              value: 'states',
                              checked: _showStates,
                              child: const Text('Estados IV R.M.'),
                            ),
                            CheckedPopupMenuItem(
                              value: 'sites',
                              checked: _showSites,
                              child: const Text('Sitios tácticos'),
                            ),
                            CheckedPopupMenuItem(
                              value: 'track',
                              checked: _showTrack,
                              child: const Text('Ruta / huecos OSRM'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      _GpsToolbarAction(
                        icon: Icons.refresh_rounded,
                        label: 'Actualizar',
                        onPressed: _loading ? null : () => _reload(),
                        loading: _loading,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '$_liveCount en línea · ${_peers.length} en mapa',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TacticalFonts.label(
                      fontSize: 12,
                      color: kInstMuted,
                    ),
                  ),
                  const SizedBox(height: 6),
                  _GpsScopeDropdown(
                    label: _filterLabel,
                    selectedId: _filterGroupId,
                    groups: widget.groups,
                    channelGroupId: widget.channelGroupId,
                    channelName: widget.channelName,
                    onChanged: (id) {
                      setState(() => _filterGroupId = id);
                      unawaited(_reload());
                    },
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  _error!,
                  style: TacticalFonts.body(fontSize: 12, color: kInstDanger),
                ),
              ),
            Expanded(
              flex: _showList ? 6 : 10,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: kInstBorder),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Stack(
                      children: [
                        FlutterMap(
                          mapController: _map,
                          options: MapOptions(
                            initialCenter: _defaultCenter,
                            initialZoom: 11,
                            interactionOptions: const InteractionOptions(
                              flags:
                                  InteractiveFlag.all & ~InteractiveFlag.rotate,
                            ),
                            onPositionChanged: (camera, _) {
                              final z = camera.zoom;
                              final was = _mapZoom >= _labelMinZoom;
                              final now = z >= _labelMinZoom;
                              if ((z - _mapZoom).abs() > 0.15 || was != now) {
                                setState(() => _mapZoom = z);
                              } else {
                                _mapZoom = z;
                              }
                            },
                            onTap: (_, _) {
                              setState(() {
                                _selectedId = null;
                                _trackPts = [];
                                _gapRoutes = [];
                                _gapPendingEnds = [];
                              });
                            },
                          ),
                          children: [
                            TileLayer(
                              urlTemplate:
                                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName: 'com.tacticalptx.app',
                            ),
                            if (_showStates && _statePolygons.isNotEmpty)
                              PolygonLayer(polygons: _statePolygons),
                            if (_showTrack && _trackPts.length >= 2)
                              PolylineLayer(
                                polylines: [
                                  Polyline(
                                    points: _trackPts,
                                    color: const Color(0xFF1F5A2E)
                                        .withValues(alpha: 0.75),
                                    strokeWidth: 4.5,
                                  ),
                                ],
                              ),
                            if (_showTrack && _gapRoutes.isNotEmpty)
                              PolylineLayer(
                                polylines: _gapRoutes
                                    .map(
                                      (pts) => Polyline(
                                        points: pts,
                                        color: _gapOrange.withValues(alpha: 0.9),
                                        strokeWidth: 5,
                                      ),
                                    )
                                    .toList(),
                              ),
                            if (_showTrack && _gapPendingEnds.isNotEmpty)
                              CircleLayer(
                                circles: _gapPendingEnds
                                    .map(
                                      (p) => CircleMarker(
                                        point: p,
                                        radius: 5,
                                        color: _gapOrange,
                                        borderColor: Colors.white,
                                        borderStrokeWidth: 1.5,
                                      ),
                                    )
                                    .toList(),
                              ),
                            if (_showSites)
                              MarkerLayer(
                                markers: _sites
                                    .map(
                                      (s) => Marker(
                                        point: LatLng(s.lat, s.lng),
                                        width: 36,
                                        height: 36,
                                        child: Tooltip(
                                          message: s.name,
                                          child: _TacticalSitePin(
                                            color: s.color,
                                            iconUrl: s.iconUrl,
                                            headers: headers,
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            MarkerLayer(
                              markers: _mapClusters.map((item) {
                                if (item.isCluster) {
                                  final c = item.center!;
                                  final face =
                                      GpsClusterPin.sizeForCount(item.count);
                                  final box = face + 36;
                                  return Marker(
                                    point: c,
                                    width: box,
                                    height: box,
                                    alignment: Alignment.center,
                                    child: GestureDetector(
                                      onTap: () => _onClusterTap(item),
                                      child: GpsClusterPin(
                                        count: item.count,
                                        size: face,
                                        slices: _clusterSlices(item.members),
                                      ),
                                    ),
                                  );
                                }
                                final p = item.point!;
                                final selectedPin = p.userId == _selectedId;
                                final showLabel =
                                    _mapZoom >= _labelMinZoom || selectedPin;
                                final labelText = () {
                                  final cargo = p.cargo?.trim();
                                  if (cargo != null && cargo.isNotEmpty) {
                                    return cargo;
                                  }
                                  final n = p.displayName.trim();
                                  if (n.isEmpty) return null;
                                  return n.split(RegExp(r'\s+')).first;
                                }();
                                return Marker(
                                  point: LatLng(p.lat, p.lng),
                                  width: selectedPin ? 88 : 72,
                                  height: selectedPin
                                      ? (showLabel ? 100 : 86)
                                      : (showLabel ? 92 : 78),
                                  alignment: Alignment.bottomCenter,
                                  child: GestureDetector(
                                    onTap: () => _selectPeer(p),
                                    child: GpsMapPin(
                                      name: p.displayName,
                                      photoUrl: widget.api.peerAvatarNetworkUrl(
                                        p.userId,
                                        p.avatarUrl,
                                      ),
                                      headers: headers,
                                      presenceColor:
                                          _presenceColor(p.presence),
                                      rimColor: _presenceRim(p.presence),
                                      live: _isLive(p.presence),
                                      selected: selectedPin,
                                      panic: p.panic,
                                      showLabel: showLabel,
                                      cargo: labelText,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                        if (_showStates)
                          Positioned(
                            left: 8,
                            bottom: 8,
                            child: _StatesLegend(colors: _ivColors),
                          ),
                        if (_trackLoading)
                          const Positioned(
                            right: 10,
                            top: 10,
                            child: Card(
                              child: Padding(
                                padding: EdgeInsets.all(8),
                                child: SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (selected != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 4),
                child: _SelectedSheet(
                  peer: selected,
                  age: _ageLabel(selected),
                  presence: _presenceLabel(selected.presence),
                  presenceColor: _presenceColor(selected.presence),
                  follow: _follow,
                  api: widget.api,
                  onFollowChanged: (v) => setState(() => _follow = v),
                  onCenter: () {
                    _map.move(LatLng(selected.lat, selected.lng), 16);
                  },
                  onClose: () => setState(() {
                    _selectedId = null;
                    _trackPts = [];
                    _gapRoutes = [];
                    _gapPendingEnds = [];
                  }),
                ),
              ),
            Material(
              color: kInstSurface,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onVerticalDragEnd: (d) {
                  final vy = d.primaryVelocity ?? 0;
                  if (vy > 180 && _showList) {
                    setState(() => _showList = false);
                  } else if (vy < -180 && !_showList) {
                    setState(() => _showList = true);
                  }
                },
                onTap: () => setState(() => _showList = !_showList),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 6, 14, 8),
                  child: Column(
                    children: [
                      Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: kInstBorder,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _showList
                                  ? 'Arrastra hacia abajo para ocultar lista'
                                  : 'Arrastra hacia arriba o toca para ver lista',
                              style: TacticalFonts.body(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: kInstInk,
                              ),
                            ),
                            Text(
                              _peers.isEmpty
                                  ? 'Sin ubicaciones'
                                  : '$_liveCount en línea · ${_peers.length} en mapa'
                                      '${_mapZoom < _labelMinZoom ? ' · acerca para nombres' : ''}',
                              style: TacticalFonts.label(
                                fontSize: 11,
                                color: kInstMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_showList)
              Expanded(
                flex: 3,
                child: _peers.isEmpty && !_loading
                    ? Center(
                        child: Text(
                          'Nadie con GPS en este alcance.\nLos operadores deben tener ubicación activa.',
                          textAlign: TextAlign.center,
                          style: TacticalFonts.body(
                            fontSize: 13,
                            color: kInstMuted,
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
                        itemCount: _peers.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 4),
                        itemBuilder: (context, i) {
                          final p = _peers[i];
                          final sel = p.userId == _selectedId;
                          final fresh = _isLive(p.presence);
                          return Material(
                            color: sel
                                ? kInstOlive.withValues(alpha: 0.08)
                                : kInstSurface,
                            borderRadius: BorderRadius.circular(12),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: () => _selectPeer(p),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                child: Row(
                                  children: [
                                    Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        UserAvatar(
                                          name: p.displayName,
                                          userId: p.userId,
                                          avatarUrl:
                                              widget.api.peerAvatarNetworkUrl(
                                            p.userId,
                                            p.avatarUrl,
                                          ),
                                          headers: headers,
                                          radius: 20,
                                          previewOnTap: false,
                                        ),
                                        if (fresh)
                                          Positioned.fill(
                                            child: IgnorePointer(
                                              child: _ListPulseRing(
                                                color: _presenceColor(
                                                  p.presence,
                                                ),
                                              ),
                                            ),
                                          ),
                                        Positioned(
                                          right: -1,
                                          bottom: -1,
                                          child: Container(
                                            width: 12,
                                            height: 12,
                                            decoration: BoxDecoration(
                                              color: _presenceColor(
                                                p.presence,
                                              ),
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: kInstSurface,
                                                width: 1.5,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            p.displayName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TacticalFonts.body(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          Text(
                                            [
                                              _presenceLabel(p.presence),
                                              _ageLabel(p),
                                              if (p.cargo != null &&
                                                  p.cargo!.isNotEmpty)
                                                p.cargo!,
                                            ].join(' · '),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TacticalFonts.body(
                                              fontSize: 12,
                                              color: kInstMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(
                                      Icons.my_location,
                                      size: 18,
                                      color: sel ? kInstOlive : kInstMuted,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Ficha compacta sobre el mapa al seleccionar un operador.
class _SelectedSheet extends StatelessWidget {
  const _SelectedSheet({
    required this.peer,
    required this.age,
    required this.presence,
    required this.presenceColor,
    required this.follow,
    required this.api,
    required this.onFollowChanged,
    required this.onCenter,
    required this.onClose,
  });

  final _GpsPeer peer;
  final String age;
  final String presence;
  final Color presenceColor;
  final bool follow;
  final ApiClient api;
  final ValueChanged<bool> onFollowChanged;
  final VoidCallback onCenter;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final coords =
        '${peer.lat.toStringAsFixed(5)}, ${peer.lng.toStringAsFixed(5)}';
    final acc = peer.accuracyM != null
        ? '±${peer.accuracyM!.round()} m'
        : null;
    final cargo = peer.cargo?.trim();

    return Material(
      elevation: 0,
      color: kInstSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: kInstBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                UserAvatar(
                  name: peer.displayName,
                  userId: peer.userId,
                  avatarUrl:
                      api.peerAvatarNetworkUrl(peer.userId, peer.avatarUrl),
                  headers: api.avatarAuthHeaders(),
                  radius: 22,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        peer.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TacticalFonts.body(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (cargo != null && cargo.isNotEmpty) ...[
                        const SizedBox(height: 1),
                        Text(
                          cargo,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TacticalFonts.body(
                            fontSize: 12,
                            color: kInstOlive,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _InfoChip(
                            color: presenceColor,
                            label: presence,
                            filled: true,
                          ),
                          _InfoChip(label: age),
                          if (acc != null) _InfoChip(label: acc),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Cerrar',
                  visualDensity: VisualDensity.compact,
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.place_outlined, size: 14, color: kInstMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    coords,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TacticalFonts.label(
                      fontSize: 11,
                      color: kInstMuted,
                    ),
                  ),
                ),
                Text(
                  'Seguir',
                  style: TacticalFonts.label(fontSize: 11),
                ),
                Switch(
                  value: follow,
                  onChanged: onFollowChanged,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                IconButton(
                  tooltip: 'Centrar mapa',
                  visualDensity: VisualDensity.compact,
                  onPressed: onCenter,
                  icon: const Icon(Icons.center_focus_strong_rounded, size: 22),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.label,
    this.color,
    this.filled = false,
  });

  final String label;
  final Color? color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final c = color ?? kInstMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: filled
            ? c.withValues(alpha: 0.16)
            : kInstPaper.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: filled ? c.withValues(alpha: 0.45) : kInstBorder,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (filled) ...[
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: c, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TacticalFonts.label(
              fontSize: 11,
              color: filled ? c : kInstInk,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatesLegend extends StatelessWidget {
  const _StatesLegend({required this.colors});
  final Map<String, Color> colors;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kInstSurface.withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(8),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'IV R.M.',
              style: TacticalFonts.label(fontSize: 10, color: kInstMuted),
            ),
            for (final e in colors.entries)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: e.value.withValues(alpha: 0.35),
                        border: Border.all(color: e.value, width: 1.5),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      e.key,
                      style: TacticalFonts.body(fontSize: 11),
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

class _ListPulseRing extends StatefulWidget {
  const _ListPulseRing({required this.color});
  final Color color;

  @override
  State<_ListPulseRing> createState() => _ListPulseRingState();
}

class _ListPulseRingState extends State<_ListPulseRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        return Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: widget.color.withValues(alpha: (1 - t) * 0.6),
              width: 2,
            ),
          ),
          transform: Matrix4.identity()..scaleByDouble(1 + t * 0.35, 1 + t * 0.35, 1, 1),
          transformAlignment: Alignment.center,
        );
      },
    );
  }
}

class _GpsPeer {
  _GpsPeer({
    required this.userId,
    required this.displayName,
    required this.lat,
    required this.lng,
    this.avatarUrl,
    this.presence,
    this.cargo,
    this.accuracyM,
    this.recordedAt,
    this.panic = false,
  });

  final String userId;
  final String displayName;
  final double lat;
  final double lng;
  final String? avatarUrl;
  final String? presence;
  final String? cargo;
  final double? accuracyM;
  final DateTime? recordedAt;
  final bool panic;

  String get initials => userAvatarInitials(displayName);

  factory _GpsPeer.fromJson(Map<String, dynamic> m, double lat, double lng) {
    final name = m['displayName']?.toString() ??
        m['name']?.toString() ??
        m['username']?.toString() ??
        'Usuario';
    DateTime? at;
    final rawAt = m['recordedAt'] ?? m['lastSeenAt'] ?? m['updatedAt'];
    if (rawAt != null) {
      at = DateTime.tryParse(rawAt.toString());
    }
    return _GpsPeer(
      userId: m['userId']?.toString() ?? m['id']?.toString() ?? '',
      displayName: name,
      lat: lat,
      lng: lng,
      avatarUrl: m['avatarUrl']?.toString(),
      presence: m['presence']?.toString() ?? m['status']?.toString(),
      cargo: m['cargo']?.toString() ?? m['rank']?.toString(),
      accuracyM: (m['accuracyM'] as num?)?.toDouble(),
      recordedAt: at,
      panic: m['panic'] == true || m['inPanic'] == true,
    );
  }
}

/// Acción superior GPS con etiqueta visible (Capas / Actualizar).
class _GpsScopeDropdown extends StatelessWidget {
  const _GpsScopeDropdown({
    required this.label,
    required this.selectedId,
    required this.groups,
    required this.onChanged,
    this.channelGroupId,
    this.channelName,
  });

  final String label;
  final String? selectedId;
  final List<Map<String, dynamic>> groups;
  final ValueChanged<String?> onChanged;
  final String? channelGroupId;
  final String? channelName;

  static const _todosKey = '__todos__';

  @override
  Widget build(BuildContext context) {
    final items = <PopupMenuEntry<String>>[
      CheckedPopupMenuItem<String>(
        value: _todosKey,
        checked: selectedId == null || selectedId!.isEmpty,
        child: const Text('Todos'),
      ),
    ];
    final seen = <String>{};
    for (final g in groups) {
      final id = (g['id']?.toString() ?? '').trim();
      if (id.isEmpty || seen.contains(id)) continue;
      seen.add(id);
      final name = (g['name']?.toString() ?? 'Grupo').trim();
      items.add(
        CheckedPopupMenuItem<String>(
          value: id,
          checked: selectedId == id,
          child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      );
    }
    // Si el canal activo no está en la lista (p.ej. aún cargando), ofrecerlo.
    final chId = (channelGroupId ?? '').trim();
    if (chId.isNotEmpty && !seen.contains(chId)) {
      final chName = (channelName ?? '').trim();
      items.add(
        CheckedPopupMenuItem<String>(
          value: chId,
          checked: selectedId == chId,
          child: Text(
            chName.isNotEmpty ? chName : 'Grupo activo',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    return PopupMenuButton<String>(
      tooltip: 'Filtrar por grupo',
      onSelected: (v) {
        if (v == _todosKey) {
          onChanged(null);
        } else {
          onChanged(v);
        }
      },
      itemBuilder: (_) => items,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: kInstSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kInstBorder),
        ),
        child: Row(
          children: [
            const Icon(Icons.groups_outlined, size: 18, color: kInstOlive),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TacticalFonts.body(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: kInstInk,
                ),
              ),
            ),
            const Icon(Icons.arrow_drop_down_rounded, color: kInstOlive),
          ],
        ),
      ),
    );
  }
}

class _GpsToolbarAction extends StatelessWidget {
  const _GpsToolbarAction({
    required this.icon,
    required this.label,
    this.onPressed,
    this.child,
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final Widget? child;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 36,
          width: 40,
          child: child ??
              IconButton(
                padding: EdgeInsets.zero,
                tooltip: label,
                onPressed: onPressed,
                icon: loading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(icon, size: 22, color: kInstOlive),
              ),
        ),
        Text(
          label,
          style: TacticalFonts.label(fontSize: 10, color: kInstOlive),
        ),
      ],
    );
  }
}

class _TacticalSite {
  _TacticalSite({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.color,
    this.groupName,
    this.iconUrl,
  });

  final String id;
  final String name;
  final double lat;
  final double lng;
  final Color color;
  final String? groupName;
  /// URL absoluta del icono de agrupación (auth Bearer), o null.
  final String? iconUrl;
}

/// Pin de sitio táctico: icono de grupo con Bearer (como web `iconBlobs`).
/// Sin icono o si falla la descarga → círculo de color del grupo (sin banderita).
class _TacticalSitePin extends StatefulWidget {
  const _TacticalSitePin({
    required this.color,
    this.iconUrl,
    this.headers,
  });

  final Color color;
  final String? iconUrl;
  final Map<String, String>? headers;

  @override
  State<_TacticalSitePin> createState() => _TacticalSitePinState();
}

class _TacticalSitePinState extends State<_TacticalSitePin> {
  Uint8List? _bytes;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadIcon());
  }

  @override
  void didUpdateWidget(covariant _TacticalSitePin oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.iconUrl != widget.iconUrl) {
      _bytes = null;
      _failed = false;
      unawaited(_loadIcon());
    }
  }

  Future<void> _loadIcon() async {
    final url = widget.iconUrl;
    if (url == null || url.isEmpty) {
      if (mounted) setState(() {
        _bytes = null;
        _failed = false;
      });
      return;
    }
    final cached = AvatarBytesCache.get(url);
    if (cached != null) {
      if (mounted) setState(() {
        _bytes = cached;
        _failed = false;
      });
      return;
    }
    try {
      final res = await http.get(
        Uri.parse(url),
        headers: widget.headers ?? const {},
      );
      if (!mounted || widget.iconUrl != url) return;
      if (res.statusCode >= 200 && res.statusCode < 300 && res.bodyBytes.isNotEmpty) {
        AvatarBytesCache.put(url, res.bodyBytes);
        setState(() {
          _bytes = res.bodyBytes;
          _failed = false;
        });
      } else if (mounted) {
        setState(() => _failed = true);
      }
    } catch (_) {
      if (mounted && widget.iconUrl == url) {
        setState(() => _failed = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasIcon = _bytes != null && !_failed;
    return Container(
      decoration: BoxDecoration(
        color: hasIcon ? Colors.white : widget.color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [
          BoxShadow(color: Colors.black38, blurRadius: 3),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: hasIcon
          ? Padding(
              padding: const EdgeInsets.all(3),
              child: Image.memory(
                _bytes!,
                fit: BoxFit.contain,
                gaplessPlayback: true,
                errorBuilder: (_, __, ___) => ColoredBox(color: widget.color),
              ),
            )
          : null,
    );
  }
}
