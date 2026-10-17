import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../gps_location_cluster.dart';
import '../peer_actions.dart';
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
    this.active = true,
  });

  final ApiClient api;
  final String? channelGroupId;
  final String? channelName;
  /// Membresías del operador: opciones del filtro GPS (además de «Todos»).
  final List<Map<String, dynamic>> groups;
  /// Pestaña visible. Oculta (IndexedStack) no consulta ubicaciones.
  final bool active;

  @override
  State<GpsTrackScreen> createState() => _GpsTrackScreenState();
}

class _GpsTrackScreenState extends State<GpsTrackScreen>
    with AutomaticKeepAliveClientMixin, WidgetsBindingObserver {
  final _map = MapController();
  Timer? _poll;
  bool _appResumed = true;
  List<_GpsPeer> _peers = [];
  String? _error;
  bool _loading = true;
  String? _selectedId;
  /// `null` = Todos; id concreto = solo ese grupo.
  String? _filterGroupId;
  bool _follow = false;
  bool _showTrack = false;
  bool _showList = true;
  double _mapZoom = 12;

  /// Estilo de mapa: `natural` | `satelite` | `claro` (igual que la consola web).
  String _mapStyle = 'natural';
  bool _showAway = true;
  bool _showOffline = true;
  /// Nombres en los pines siempre (si no, solo al acercar).
  bool _labelsAlways = false;

  /// Preferencias leídas: hasta entonces no se dibuja el mapa (evita salto de cámara).
  bool _prefsReady = false;
  LatLng _initialCenter = _defaultCenter;
  double _initialZoom = 11;
  Timer? _saveViewDebounce;

  /// Como web `CARGO_LABEL_MIN_ZOOM` (~11); un poco más cerca en móvil.
  static const _labelMinZoom = 13.0;

  List<LatLng> _trackPts = [];
  bool _trackLoading = false;

  static const _defaultCenter = LatLng(25.6866, -100.3161);
  static const _prefsPrefix = 'gps_track_';

  static const _mapStyles = <String, ({String label, String url, int maxNative})>{
    'natural': (
      label: 'Calles',
      url:
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxNative: 19,
    ),
    'satelite': (
      label: 'Satélite',
      url:
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxNative: 19,
    ),
    'claro': (
      label: 'Claro',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxNative: 19,
    ),
  };

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    final gid = (widget.channelGroupId ?? '').trim();
    _filterGroupId = gid.isNotEmpty ? gid : null;
    WidgetsBinding.instance.addObserver(this);
    unawaited(_restorePrefs());
    _syncPoll();
  }

  Future<void> _restorePrefs() async {
    try {
      final p = await SharedPreferences.getInstance();
      String k(String s) => '$_prefsPrefix$s';
      if (p.containsKey(k('filter'))) {
        final f = p.getString(k('filter')) ?? '';
        _filterGroupId = f.isEmpty ? null : f;
      }
      _mapStyle = _mapStyles.containsKey(p.getString(k('style')))
          ? p.getString(k('style'))!
          : 'natural';
      _showAway = p.getBool(k('away')) ?? true;
      _showOffline = p.getBool(k('offline')) ?? true;
      _labelsAlways = p.getBool(k('labels')) ?? false;
      _showList = p.getBool(k('list')) ?? true;
      final lat = p.getDouble(k('lat'));
      final lng = p.getDouble(k('lng'));
      final z = p.getDouble(k('zoom'));
      if (lat != null && lng != null && lat.isFinite && lng.isFinite) {
        _initialCenter = LatLng(lat, lng);
      }
      if (z != null && z.isFinite) _initialZoom = z.clamp(3.0, 19.0);
      _mapZoom = _initialZoom;
      final sel = p.getString(k('selected'));
      if (sel != null && sel.isNotEmpty) {
        _selectedId = sel;
        _follow = p.getBool(k('follow')) ?? false;
        _showTrack = p.getBool(k('track')) ?? false;
      }
    } catch (_) {}
    if (!mounted) return;
    setState(() => _prefsReady = true);
    if (widget.active) unawaited(_reload());
    final sel = _selectedId;
    if (sel != null && _showTrack) unawaited(_loadTrack(sel));
  }

  Future<void> _savePrefs() async {
    try {
      final p = await SharedPreferences.getInstance();
      String k(String s) => '$_prefsPrefix$s';
      await p.setString(k('filter'), _filterGroupId ?? '');
      await p.setString(k('style'), _mapStyle);
      await p.setBool(k('away'), _showAway);
      await p.setBool(k('offline'), _showOffline);
      await p.setBool(k('labels'), _labelsAlways);
      await p.setBool(k('list'), _showList);
      await p.setString(k('selected'), _selectedId ?? '');
      await p.setBool(k('follow'), _follow);
      await p.setBool(k('track'), _showTrack);
    } catch (_) {}
  }

  void _saveViewSoon(MapCamera camera) {
    _saveViewDebounce?.cancel();
    _saveViewDebounce = Timer(const Duration(milliseconds: 900), () async {
      try {
        final p = await SharedPreferences.getInstance();
        await p.setDouble('${_prefsPrefix}lat', camera.center.latitude);
        await p.setDouble('${_prefsPrefix}lng', camera.center.longitude);
        await p.setDouble('${_prefsPrefix}zoom', camera.zoom);
      } catch (_) {}
    });
  }

  bool get _shouldPoll => widget.active && _appResumed;

  void _syncPoll() {
    if (_shouldPoll) {
      _poll ??= Timer.periodic(const Duration(seconds: 5), (_) {
        unawaited(_reload(silent: true));
      });
    } else {
      _poll?.cancel();
      _poll = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final resumed = state == AppLifecycleState.resumed;
    if (resumed == _appResumed) return;
    _appResumed = resumed;
    if (_shouldPoll) unawaited(_reload(silent: true));
    _syncPoll();
  }

  @override
  void didUpdateWidget(covariant GpsTrackScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) {
      if (_shouldPoll) unawaited(_reload(silent: true));
      _syncPoll();
    }
    // El filtro es del usuario: ya no cambia solo al cambiar de canal en Radio.
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
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _saveViewDebounce?.cancel();
    _map.dispose();
    super.dispose();
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
          _clearSelection();
        } else if (_follow) {
          // Seguir: solo recentra; respeta el zoom que eligió el usuario.
          final p = still.first;
          _moveMap(LatLng(p.lat, p.lng), null);
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

  void _moveMap(LatLng to, double? zoom) {
    try {
      _map.move(to, zoom ?? _map.camera.zoom);
    } catch (_) {}
  }

  /// Toca a alguien: lo selecciona y lo sigue. Tocarlo de nuevo lo deselecciona.
  void _selectPeer(_GpsPeer p) {
    if (_selectedId == p.userId) {
      _clearSelection();
      return;
    }
    setState(() {
      _selectedId = p.userId;
      _follow = true;
      _showTrack = false;
      _trackPts = [];
    });
    double zoom;
    try {
      zoom = _map.camera.zoom < 14 ? 15.5 : _map.camera.zoom;
    } catch (_) {
      zoom = 15.5;
    }
    _moveMap(LatLng(p.lat, p.lng), zoom);
    unawaited(_savePrefs());
  }

  void _clearSelection() {
    if (_selectedId == null) return;
    setState(() {
      _selectedId = null;
      _follow = false;
      _showTrack = false;
      _trackPts = [];
    });
    unawaited(_savePrefs());
  }

  void _setFollow(bool v) {
    if (_follow == v) return;
    setState(() => _follow = v);
    final s = _selected;
    if (v && s != null) _moveMap(LatLng(s.lat, s.lng), null);
    unawaited(_savePrefs());
  }

  void _toggleTrack() {
    final id = _selectedId;
    if (id == null) return;
    final next = !_showTrack;
    setState(() {
      _showTrack = next;
      if (!next) _trackPts = [];
    });
    if (next) unawaited(_loadTrack(id));
    unawaited(_savePrefs());
  }

  /// Encuadra a todos los visibles (botón «Ver a todos»).
  void _fitAll() {
    final pts = _visiblePeers;
    if (pts.isEmpty) return;
    _setFollow(false);
    if (pts.length == 1) {
      _moveMap(LatLng(pts.first.lat, pts.first.lng), 15);
      return;
    }
    try {
      _map.fitCamera(
        CameraFit.coordinates(
          coordinates: [for (final p in pts) LatLng(p.lat, p.lng)],
          padding: const EdgeInsets.all(56),
          maxZoom: 16,
        ),
      );
    } catch (_) {}
  }

  bool _isAwayOnly(String? presence) => presence == 'away';

  bool _isOnlineNow(String? presence) =>
      _isLive(presence) && !_isAwayOnly(presence);

  /// Personas que pasan los filtros «Mostrar» (la seleccionada y pánico siempre).
  List<_GpsPeer> get _visiblePeers => _peers.where((p) {
        if (p.userId == _selectedId || p.panic) return true;
        if (_isOnlineNow(p.presence)) return true;
        if (_isAwayOnly(p.presence)) return _showAway;
        return _showOffline;
      }).toList();

  Future<void> _loadTrack(String userId) async {
    setState(() {
      _trackLoading = true;
      _trackPts = [];
    });
    try {
      final data = await widget.api.fetchUserTrack(userId, hours: 8);
      final raw = data['points'] ?? data['track'] ?? data['locations'];
      final pts = <LatLng>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is! Map) continue;
          final lat = (e['latitude'] as num?)?.toDouble() ??
              (e['lat'] as num?)?.toDouble();
          final lng = (e['longitude'] as num?)?.toDouble() ??
              (e['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) continue;
          pts.add(LatLng(lat, lng));
        }
      }
      if (!mounted || _selectedId != userId) return;
      setState(() {
        _trackPts = pts;
        _trackLoading = false;
      });
      if (pts.length < 2 && mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          const SnackBar(content: Text('Sin recorrido en las últimas 8 h')),
        );
      }
    } catch (_) {
      if (mounted && _selectedId == userId) {
        setState(() => _trackLoading = false);
      }
    }
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
    final list = _visiblePeers;
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
    _setFollow(false);

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

  int get _onlineCount => _peers.where((p) => _isOnlineNow(p.presence)).length;

  int get _awayCount => _peers.where((p) => _isAwayOnly(p.presence)).length;

  Future<void> _openMapSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: kInstSurface,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          void apply(VoidCallback fn) {
            setState(fn);
            setSheet(() {});
            unawaited(_savePrefs());
          }

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Opciones del mapa',
                    style: TacticalFonts.display(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: kInstOlive,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const _SheetLabel('Estilo'),
                  const SizedBox(height: 6),
                  SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: [
                      for (final e in _mapStyles.entries)
                        ButtonSegment(
                          value: e.key,
                          label: Text(e.value.label),
                          icon: Icon(
                            switch (e.key) {
                              'satelite' => Icons.satellite_alt_rounded,
                              'claro' => Icons.light_mode_outlined,
                              _ => Icons.map_outlined,
                            },
                            size: 18,
                          ),
                        ),
                    ],
                    selected: {_mapStyle},
                    onSelectionChanged: (s) => apply(() => _mapStyle = s.first),
                  ),
                  const SizedBox(height: 18),
                  const _SheetLabel('Mostrar en el mapa'),
                  _SheetSwitch(
                    color: const Color(0xFF1F5A2E),
                    title: 'En línea',
                    subtitle: '$_onlineCount · siempre visibles',
                    value: true,
                  ),
                  _SheetSwitch(
                    color: const Color(0xFFA16207),
                    title: 'Ausentes',
                    subtitle: '$_awayCount',
                    value: _showAway,
                    onChanged: (v) => apply(() => _showAway = v),
                  ),
                  _SheetSwitch(
                    color: const Color(0xFF6B7280),
                    title: 'Desconectados / fuera de línea',
                    subtitle:
                        '${_peers.length - _onlineCount - _awayCount} · última ubicación conocida',
                    value: _showOffline,
                    onChanged: (v) => apply(() => _showOffline = v),
                  ),
                  const SizedBox(height: 10),
                  const _SheetLabel('Nombres en los pines'),
                  _SheetSwitch(
                    title: 'Mostrar siempre',
                    subtitle: _labelsAlways
                        ? 'Visibles a cualquier distancia'
                        : 'Solo al acercar el mapa',
                    value: _labelsAlways,
                    onChanged: (v) => apply(() => _labelsAlways = v),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final selected = _selected;
    final headers = widget.api.avatarAuthHeaders();
    final visible = _visiblePeers;
    final hidden = _peers.length - visible.length;

    return ColoredBox(
      color: kInstPaper,
      child: SafeArea(
        child: Column(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _clearSelection,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 6, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Seguimiento GPS',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TacticalFonts.display(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: kInstOlive,
                            ),
                          ),
                        ),
                        _GpsToolbarAction(
                          icon: Icons.tune_rounded,
                          label: 'Mapa',
                          onPressed: _openMapSheet,
                        ),
                        _GpsToolbarAction(
                          icon: Icons.refresh_rounded,
                          label: 'Actualizar',
                          onPressed: _loading ? null : () => _reload(),
                          loading: _loading,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _CountPill(
                          color: const Color(0xFF1F5A2E),
                          label: '$_onlineCount en línea',
                        ),
                        if (_awayCount > 0)
                          _CountPill(
                            color: const Color(0xFFA16207),
                            label: '$_awayCount ausentes',
                          ),
                        _CountPill(
                          color: kInstMuted,
                          label: '${visible.length} en mapa',
                        ),
                        if (hidden > 0)
                          _CountPill(
                            color: kInstMuted,
                            label: '$hidden ocultos',
                            outlined: true,
                            onTap: _openMapSheet,
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _GpsScopeDropdown(
                      label: _filterLabel,
                      selectedId: _filterGroupId,
                      groups: widget.groups,
                      channelGroupId: widget.channelGroupId,
                      channelName: widget.channelName,
                      onChanged: (id) {
                        setState(() => _filterGroupId = id);
                        unawaited(_savePrefs());
                        unawaited(_reload());
                      },
                    ),
                  ],
                ),
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
                padding: const EdgeInsets.fromLTRB(10, 2, 10, 6),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: kInstBorder),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Stack(
                      children: [
                        if (!_prefsReady)
                          const Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        else
                          FlutterMap(
                            mapController: _map,
                            options: MapOptions(
                              initialCenter: _initialCenter,
                              initialZoom: _initialZoom,
                              maxZoom: 19,
                              interactionOptions: const InteractionOptions(
                                flags: InteractiveFlag.all &
                                    ~InteractiveFlag.rotate,
                              ),
                              onPositionChanged: (camera, hasGesture) {
                                if (hasGesture && _follow) {
                                  _follow = false;
                                  unawaited(_savePrefs());
                                  setState(() {});
                                }
                                final z = camera.zoom;
                                final was = _mapZoom >= _labelMinZoom;
                                final now = z >= _labelMinZoom;
                                if ((z - _mapZoom).abs() > 0.15 || was != now) {
                                  setState(() => _mapZoom = z);
                                } else {
                                  _mapZoom = z;
                                }
                                _saveViewSoon(camera);
                              },
                              onTap: (_, _) => _clearSelection(),
                            ),
                            children: [
                              TileLayer(
                                key: ValueKey(_mapStyle),
                                urlTemplate: (_mapStyles[_mapStyle] ??
                                        _mapStyles['natural']!)
                                    .url,
                                maxNativeZoom: (_mapStyles[_mapStyle] ??
                                        _mapStyles['natural']!)
                                    .maxNative,
                                userAgentPackageName: 'com.tacticalptx.app',
                              ),
                              if (_showTrack && _trackPts.length >= 2)
                                PolylineLayer(
                                  polylines: [
                                    Polyline(
                                      points: _trackPts,
                                      color: const Color(0xFF2563EB)
                                          .withValues(alpha: 0.85),
                                      strokeWidth: 4.5,
                                      borderStrokeWidth: 1.5,
                                      borderColor: Colors.white70,
                                    ),
                                  ],
                                ),
                              if (_showTrack && _trackPts.length >= 2)
                                CircleLayer(
                                  circles: [
                                    CircleMarker(
                                      point: _trackPts.first,
                                      radius: 6,
                                      color: const Color(0xFF2563EB),
                                      borderColor: Colors.white,
                                      borderStrokeWidth: 2,
                                    ),
                                  ],
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
                                  final showLabel = _labelsAlways ||
                                      _mapZoom >= _labelMinZoom ||
                                      selectedPin;
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
                                        photoUrl:
                                            widget.api.peerAvatarNetworkUrl(
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
                        if (selected != null)
                          Positioned(
                            top: 10,
                            left: 56,
                            right: 56,
                            child: Center(
                              child: _MapPill(
                                icon: _follow
                                    ? Icons.gps_fixed_rounded
                                    : Icons.my_location_rounded,
                                label: _follow
                                    ? 'Siguiendo a ${_firstName(selected.displayName)}'
                                    : 'Volver a seguir',
                                active: _follow,
                                onTap: () => _setFollow(!_follow),
                              ),
                            ),
                          ),
                        if (_trackLoading)
                          const Positioned(
                            left: 10,
                            top: 10,
                            child: _MapRoundBox(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                          ),
                        if (_prefsReady && visible.isNotEmpty)
                          Positioned(
                            right: 10,
                            bottom: 10,
                            child: _MapRoundBox(
                              tooltip: 'Ver a todos',
                              onTap: _fitAll,
                              child: const Icon(
                                Icons.zoom_out_map_rounded,
                                size: 20,
                                color: kInstOlive,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              alignment: Alignment.topCenter,
              child: selected == null
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 4),
                      child: _SelectedSheet(
                        peer: selected,
                        age: _ageLabel(selected),
                        presence: _presenceLabel(selected.presence),
                        presenceColor: _presenceColor(selected.presence),
                        follow: _follow,
                        showTrack: _showTrack,
                        trackLoading: _trackLoading,
                        api: widget.api,
                        onFollowChanged: _setFollow,
                        onCenter: () {
                          _setFollow(false);
                          _moveMap(LatLng(selected.lat, selected.lng), 16.5);
                        },
                        onToggleTrack: _toggleTrack,
                        onClose: _clearSelection,
                      ),
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
                    unawaited(_savePrefs());
                  } else if (vy < -180 && !_showList) {
                    setState(() => _showList = true);
                    unawaited(_savePrefs());
                  }
                },
                onTap: () {
                  setState(() => _showList = !_showList);
                  unawaited(_savePrefs());
                },
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
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(
                            Icons.people_alt_outlined,
                            size: 18,
                            color: kInstOlive,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              visible.isEmpty
                                  ? 'Sin ubicaciones'
                                  : 'Operadores (${visible.length})',
                              style: TacticalFonts.body(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: kInstInk,
                              ),
                            ),
                          ),
                          Text(
                            _showList ? 'Ocultar' : 'Ver lista',
                            style: TacticalFonts.label(
                              fontSize: 12,
                              color: kInstMuted,
                            ),
                          ),
                          Icon(
                            _showList
                                ? Icons.keyboard_arrow_down_rounded
                                : Icons.keyboard_arrow_up_rounded,
                            size: 20,
                            color: kInstMuted,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_showList)
              Expanded(
                flex: 3,
                child: visible.isEmpty && !_loading
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
                        itemCount: visible.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 4),
                        itemBuilder: (context, i) {
                          final p = visible[i];
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

String _firstName(String name) {
  final n = name.trim();
  if (n.isEmpty) return 'operador';
  return n.split(RegExp(r'\s+')).first;
}

/// Ficha del operador seleccionado (debajo del mapa).
class _SelectedSheet extends StatelessWidget {
  const _SelectedSheet({
    required this.peer,
    required this.age,
    required this.presence,
    required this.presenceColor,
    required this.follow,
    required this.showTrack,
    required this.trackLoading,
    required this.api,
    required this.onFollowChanged,
    required this.onCenter,
    required this.onToggleTrack,
    required this.onClose,
  });

  final _GpsPeer peer;
  final String age;
  final String presence;
  final Color presenceColor;
  final bool follow;
  final bool showTrack;
  final bool trackLoading;
  final ApiClient api;
  final ValueChanged<bool> onFollowChanged;
  final VoidCallback onCenter;
  final VoidCallback onToggleTrack;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final coords =
        '${peer.lat.toStringAsFixed(5)}, ${peer.lng.toStringAsFixed(5)}';
    final acc = peer.accuracyM != null
        ? '±${peer.accuracyM!.round()} m'
        : null;
    final service = peer.serviceLine;
    final phone = peer.phoneLine;

    return Material(
      elevation: 2,
      shadowColor: Colors.black26,
      color: kInstSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: peer.panic ? kInstDanger : presenceColor.withValues(alpha: 0.5),
          width: peer.panic ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: presenceColor, width: 2),
                  ),
                  child: UserAvatar(
                    name: peer.displayName,
                    userId: peer.userId,
                    avatarUrl:
                        api.peerAvatarNetworkUrl(peer.userId, peer.avatarUrl),
                    headers: api.avatarAuthHeaders(),
                    radius: 22,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        peer.titleLine,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TacticalFonts.body(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (service.isNotEmpty)
                        Text(
                          service,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TacticalFonts.body(
                            fontSize: 12,
                            color: kInstOlive,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      if (phone.isNotEmpty)
                        Text(
                          phone,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TacticalFonts.body(
                            fontSize: 12,
                            color: kInstInk,
                          ),
                        ),
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (peer.panic)
                            const _InfoChip(
                              color: kInstDanger,
                              label: 'PÁNICO',
                              filled: true,
                            ),
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
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () {
                Clipboard.setData(ClipboardData(text: coords));
                ScaffoldMessenger.maybeOf(context)?.showSnackBar(
                  const SnackBar(
                    content: Text('Coordenadas copiadas'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                child: Row(
                  children: [
                    const Icon(Icons.place_outlined, size: 15, color: kInstMuted),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        coords,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TacticalFonts.label(
                          fontSize: 12,
                          color: kInstInk,
                        ),
                      ),
                    ),
                    const Icon(Icons.copy_rounded, size: 14, color: kInstMuted),
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Row(
                children: [
                  _SheetAction(
                    icon: follow
                        ? Icons.gps_fixed_rounded
                        : Icons.gps_not_fixed_rounded,
                    label: follow ? 'Siguiendo' : 'Seguir',
                    active: follow,
                    onTap: () => onFollowChanged(!follow),
                  ),
                  const SizedBox(width: 6),
                  _SheetAction(
                    icon: Icons.center_focus_strong_rounded,
                    label: 'Centrar',
                    onTap: onCenter,
                  ),
                  const SizedBox(width: 6),
                  _SheetAction(
                    icon: Icons.timeline_rounded,
                    label: trackLoading ? 'Cargando' : 'Ruta 8 h',
                    active: showTrack,
                    onTap: onToggleTrack,
                  ),
                  const SizedBox(width: 6),
                  _SheetAction(
                    icon: Icons.contact_phone_rounded,
                    label: 'Contactar',
                    onTap: () => showChannelPeerActions(
                      context: context,
                      api: api,
                      peerId: peer.userId,
                      displayName: peer.displayName,
                    ),
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

class _SheetAction extends StatelessWidget {
  const _SheetAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final fg = active ? Colors.white : kInstOlive;
    return Expanded(
      child: Material(
        color: active ? kInstOlive : kInstOlive.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 20, color: fg),
                const SizedBox(height: 3),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    maxLines: 1,
                    style: TacticalFonts.label(
                      fontSize: 11,
                      color: fg,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
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

class _CountPill extends StatelessWidget {
  const _CountPill({
    required this.color,
    required this.label,
    this.outlined = false,
    this.onTap,
  });

  final Color color;
  final String label;
  final bool outlined;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: outlined ? Colors.transparent : color.withValues(alpha: 0.12),
      shape: StadiumBorder(
        side: BorderSide(color: color.withValues(alpha: outlined ? 0.5 : 0.3)),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!outlined) ...[
                Container(
                  width: 7,
                  height: 7,
                  decoration:
                      BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TacticalFonts.label(
                  fontSize: 11,
                  color: outlined ? kInstMuted : color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Botón flotante tipo píldora sobre el mapa («Siguiendo» / «Volver a seguir»).
class _MapPill extends StatelessWidget {
  const _MapPill({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final fg = active ? Colors.white : kInstOlive;
    return Material(
      elevation: 3,
      shadowColor: Colors.black38,
      color: active ? kInstOlive : kInstSurface,
      shape: const StadiumBorder(),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TacticalFonts.label(
                    fontSize: 12,
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapRoundBox extends StatelessWidget {
  const _MapRoundBox({required this.child, this.onTap, this.tooltip});

  final Widget child;
  final VoidCallback? onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final box = Material(
      elevation: 3,
      shadowColor: Colors.black38,
      color: kInstSurface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(width: 42, height: 42, child: Center(child: child)),
      ),
    );
    return tooltip == null ? box : Tooltip(message: tooltip!, child: box);
  }
}

class _SheetLabel extends StatelessWidget {
  const _SheetLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TacticalFonts.label(
        fontSize: 11,
        color: kInstMuted,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _SheetSwitch extends StatelessWidget {
  const _SheetSwitch({
    required this.title,
    required this.value,
    this.subtitle,
    this.color,
    this.onChanged,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final Color? color;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      value: value,
      onChanged: onChanged,
      secondary: color == null
          ? null
          : Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
      title: Text(
        title,
        style: TacticalFonts.body(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: TacticalFonts.label(fontSize: 11, color: kInstMuted),
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
    this.serviceNombre,
    this.phone,
    this.role,
    this.grade,
    this.affiliation,
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
  final String? serviceNombre;
  final String? phone;
  final String? role;
  final String? grade;
  /// Unidad | zona | región (adscripción).
  final String? affiliation;
  final double? accuracyM;
  final DateTime? recordedAt;
  final bool panic;

  String get initials => userAvatarInitials(displayName);

  /// L1: Grado Apellido, unidad|zona|región (root sin adscripción → Administrador).
  String get titleLine {
    final name = displayName.trim();
    final isRoot = (role ?? '').trim().toLowerCase() == 'root';
    final aff = (affiliation ?? '').trim().isNotEmpty
        ? affiliation!.trim()
        : (isRoot ? 'Administrador' : '');
    if (isRoot) {
      if ((grade ?? '').trim().isEmpty) return 'Administrador';
      final base = name.split(',').first.trim();
      return base.isNotEmpty ? '$base, $aff' : aff;
    }
    if (name.contains(',')) return name;
    if (name.isNotEmpty && aff.isNotEmpty) return '$name, $aff';
    return name.isNotEmpty ? name : (aff.isNotEmpty ? aff : 'Operador');
  }

  /// L2: catálogo · nombre libre.
  String get serviceLine => [cargo, serviceNombre]
      .map((s) => (s ?? '').trim())
      .where((s) => s.isNotEmpty)
      .join(' · ');

  /// L3: teléfono.
  String get phoneLine => (phone ?? '').trim();

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
      serviceNombre: m['serviceNombre']?.toString(),
      phone: m['phone']?.toString(),
      role: m['role']?.toString(),
      grade: m['grade']?.toString(),
      affiliation: [
        m['unitName'],
        m['zoneName'],
        m['regionName'],
        m['affiliationLabel'],
      ]
          .map((v) => v?.toString().trim() ?? '')
          .firstWhere((s) => s.isNotEmpty, orElse: () => ''),
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
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 36,
          width: 40,
          child: IconButton(
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
