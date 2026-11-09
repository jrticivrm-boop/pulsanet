import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCatalogTerritorio,
  fetchDependencias,
  fetchGeoEstados,
  fetchGeoMunicipios,
  fetchUiPrefs,
  patchUiPrefs,
  putCatalogTerritorio,
  putCatalogTerritorioUnitColor,
} from '../api';
import { canModuleAction, canViewTab } from './modulePermissions.js';
import {
  IV_RM_COVERAGE_EVENT,
  IV_RM_ZONAS,
  setOrgUnitColorOverrides,
  unidadColor,
} from './ivRmTerritoryConfig.js';
import AppDialog from '../AppDialog.jsx';

const PREFS_FOLDS_KEY = 'territorioFolds';
const PREFS_ORDER_KEY = 'territorioRegionOrder';
const NO_COVER_COLOR = '#9aa3ad';
/** Umbral: clic pliega; arrastre reordena. */
const DRAG_THRESHOLD_PX = 6;

function orderRegions(list, orderIds) {
  if (!Array.isArray(list) || !list.length) return list || [];
  if (!Array.isArray(orderIds) || !orderIds.length) return list;
  const byId = new Map(list.map((r) => [String(r.id), r]));
  const next = [];
  for (const id of orderIds) {
    const item = byId.get(String(id));
    if (item) {
      next.push(item);
      byId.delete(String(id));
    }
  }
  for (const item of list) {
    if (byId.has(String(item.id))) next.push(item);
  }
  return next;
}

function mergeRegionOrder(prev, regionIds) {
  const known = new Set(regionIds.map(String));
  const next = (Array.isArray(prev) ? prev : []).map(String).filter((id) => known.has(id));
  for (const id of regionIds) {
    const s = String(id);
    if (!next.includes(s)) next.push(s);
  }
  return next;
}

function zonaMeta(zonaKey, zonaShort, zoneName) {
  const z = IV_RM_ZONAS.find((row) => row.id === zonaKey);
  const short = zonaShort || z?.short || zoneName || zonaKey || '';
  return {
    key: zonaKey || short || '',
    short,
    label: z ? `${z.short} · ${z.estado}` : short || 'Zona',
  };
}

function resolveZonaKey(zoneName, fallbackKey = '') {
  const name = String(zoneName || '');
  const z = IV_RM_ZONAS.find(
    (row) => name.includes(row.short) || name.toLowerCase().includes(row.id)
  );
  if (z) return z.id;
  const raw = String(fallbackKey || name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return raw || 'zona';
}

function unitKey(u) {
  return `${u.zonaKey || ''}|${u.unidadName || ''}`;
}

function isIvRmRegion(label) {
  const n = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return n.includes('iv r.m') || n.includes('iv rm') || /(^|\s)iv(\s|$)/.test(n);
}

function countAssigned(rows, u) {
  return (rows || []).filter(
    (r) => r.unidadName === u.unidadName && String(r.zonaKey || '') === String(u.zonaKey || '')
  ).length;
}

function sameCoverageUnit(row, unit) {
  return (
    row?.unidadName === unit?.unidadName &&
    String(row?.zonaKey || '') === String(unit?.zonaKey || '')
  );
}

function holderPhrase(list) {
  const names = [];
  const seen = new Set();
  for (const row of list || []) {
    const unit = row.unidadName || 'otra unidad';
    const repeated = list.filter((item) => item.unidadName === row.unidadName).length > 1;
    const zone = row.zonaShort || row.zonaKey;
    const label = repeated && zone ? `${unit} · ${zone}` : unit;
    if (seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  if (names.length <= 1) return names[0] || 'otra unidad';
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export default function CatalogTerritorio({ session }) {
  const canSee = canViewTab(session.user, 'configuracion', 'territorio');
  const canEdit = canSee && canModuleAction(session.user, 'configuracion', 'editar');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [rows, setRows] = useState([]);
  const [unitColors, setUnitColors] = useState({});
  const [depTree, setDepTree] = useState([]);
  const [estados, setEstados] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [estado, setEstado] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [muniLoading, setMuniLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [treeQuery, setTreeQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [saveFlash, setSaveFlash] = useState('');
  const [openRegions, setOpenRegions] = useState({});
  const [openZones, setOpenZones] = useState({});
  const [regionOrder, setRegionOrder] = useState([]);
  const [prefsReady, setPrefsReady] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const colorInputRef = useRef(null);
  const colorTargetRef = useRef(null);
  const prefsTimerRef = useRef(0);
  const flashTimerRef = useRef(0);
  const treeListRef = useRef(null);
  const dragSessionRef = useRef(null);
  const suppressRegionClickRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cov, deps, geo, prefsRes] = await Promise.all([
        fetchCatalogTerritorio(session.token),
        fetchDependencias(session.token).catch(() => ({ tree: [] })),
        fetchGeoEstados(session.token).catch(() => ({ estados: [] })),
        fetchUiPrefs(session.token).catch(() => ({ prefs: {} })),
      ]);
      setUnits(cov.units || []);
      setRows(cov.rows || []);
      const colors = cov.unitColors || {};
      setUnitColors(colors);
      setOrgUnitColorOverrides(colors);
      setDepTree(deps.tree || []);
      setEstados(geo.estados || []);
      const folds = prefsRes?.prefs?.[PREFS_FOLDS_KEY] || {};
      if (folds.regions && typeof folds.regions === 'object') setOpenRegions(folds.regions);
      if (folds.zones && typeof folds.zones === 'object') setOpenZones(folds.zones);
      const savedOrder = prefsRes?.prefs?.[PREFS_ORDER_KEY];
      if (Array.isArray(savedOrder)) setRegionOrder(savedOrder.map(String));
      setPrefsReady(true);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el territorio.');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      window.clearTimeout(prefsTimerRef.current);
      window.clearTimeout(flashTimerRef.current);
      const sess = dragSessionRef.current;
      if (sess?.onMove) window.removeEventListener('pointermove', sess.onMove, true);
      if (sess?.onUp) {
        window.removeEventListener('pointerup', sess.onUp, true);
        window.removeEventListener('pointercancel', sess.onUp, true);
      }
      dragSessionRef.current = null;
    },
    []
  );

  const persistPrefs = useCallback(
    (patch) => {
      if (!prefsReady || !session.token) return;
      window.clearTimeout(prefsTimerRef.current);
      prefsTimerRef.current = window.setTimeout(() => {
        patchUiPrefs(session.token, patch).catch(() => {
          /* silencioso: UI sigue usable */
        });
      }, 400);
    },
    [prefsReady, session.token]
  );

  const persistFolds = useCallback(
    (regions, zones) => {
      persistPrefs({
        [PREFS_FOLDS_KEY]: { regions, zones },
      });
    },
    [persistPrefs]
  );

  const persistRegionOrder = useCallback(
    (order) => {
      persistPrefs({
        [PREFS_ORDER_KEY]: order,
      });
    },
    [persistPrefs]
  );

  const regionTree = useMemo(() => {
    const countByKey = new Map();
    for (const u of units) {
      countByKey.set(unitKey(u), u.municipioCount || 0);
    }
    const byRegion = new Map();

    const ensureRegion = (id, label) => {
      const key = String(id || label || 'region');
      if (!byRegion.has(key)) {
        byRegion.set(key, {
          id: key,
          label: label || 'Región',
          zones: new Map(),
        });
      }
      return byRegion.get(key);
    };

    const ensureZone = (reg, zonaKey, zonaShort, zoneId, zoneName) => {
      const meta = zonaMeta(zonaKey, zonaShort, zoneName);
      const key = meta.key || String(zoneId || meta.short);
      if (!reg.zones.has(key)) {
        reg.zones.set(key, {
          id: key,
          zoneId,
          ...meta,
          units: [],
        });
      }
      return reg.zones.get(key);
    };

    for (const region of depTree || []) {
      const reg = ensureRegion(region.id, region.name);
      for (const zone of region.children || []) {
        const zonaKey = resolveZonaKey(zone.name);
        const zRow = IV_RM_ZONAS.find((r) => r.id === zonaKey);
        const zonaShort = zRow?.short || zone.name;
        const zoneBucket = ensureZone(reg, zonaKey, zonaShort, zone.id, zone.name);
        for (const org of zone.children || []) {
          const u = {
            unidadName: org.name,
            zonaKey,
            zonaShort,
            regionLabel: region.name,
            regionId: region.id,
            zoneId: zone.id,
            unitId: org.id,
            municipioCount: countByKey.get(`${zonaKey}|${org.name}`) || 0,
            fromDependencias: true,
          };
          if (!zoneBucket.units.some((x) => unitKey(x) === unitKey(u))) {
            zoneBucket.units.push(u);
          }
        }
      }
    }

    // Unidades solo en cobertura (sin fila en Dependencias) → bajo su región/zona.
    for (const u of units) {
      const reg = ensureRegion(u.regionId || u.regionLabel, u.regionLabel || 'Sin región');
      const zoneBucket = ensureZone(reg, u.zonaKey, u.zonaShort, u.zoneId, u.zonaShort);
      const k = unitKey(u);
      if (!zoneBucket.units.some((x) => unitKey(x) === k)) {
        zoneBucket.units.push({
          ...u,
          municipioCount: countByKey.get(k) || u.municipioCount || 0,
          fromDependencias: false,
        });
      } else {
        const existing = zoneBucket.units.find((x) => unitKey(x) === k);
        if (existing) existing.municipioCount = countByKey.get(k) || existing.municipioCount || 0;
      }
    }

    return [...byRegion.values()].map((r) => {
      const zones = [...r.zones.values()].map((z) => ({
        ...z,
        units: [...z.units].sort((a, b) =>
          String(a.unidadName).localeCompare(String(b.unidadName), 'es')
        ),
        unitCount: z.units.length,
        municipioCount: z.units.reduce(
          (n, u) => n + (countByKey.get(unitKey(u)) || u.municipioCount || 0),
          0
        ),
      }));
      return {
        id: r.id,
        label: r.label,
        zones,
        unitCount: zones.reduce((n, z) => n + z.unitCount, 0),
        municipioCount: zones.reduce((n, z) => n + z.municipioCount, 0),
      };
    });
  }, [depTree, units]);

  const orderedTree = useMemo(
    () => orderRegions(regionTree, regionOrder),
    [regionTree, regionOrder]
  );

  /** Incorporar regiones nuevas al orden guardado (sin reordenar las ya colocadas). */
  useEffect(() => {
    if (!prefsReady || !regionTree.length) return;
    const ids = regionTree.map((r) => String(r.id));
    setRegionOrder((prev) => {
      const next = mergeRegionOrder(prev, ids);
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [prefsReady, regionTree]);

  const defaultsAppliedRef = useRef(false);
  /** Primera expansión por defecto: región IV (o la de más municipios). */
  useEffect(() => {
    if (!prefsReady || !orderedTree.length || defaultsAppliedRef.current) return;
    if (Object.keys(openRegions).length || Object.keys(openZones).length) {
      defaultsAppliedRef.current = true;
      return;
    }
    defaultsAppliedRef.current = true;
    const preferred =
      orderedTree.find((r) => isIvRmRegion(r.label)) ||
      [...orderedTree].sort((a, b) => b.municipioCount - a.municipioCount)[0];
    if (!preferred) return;
    const nextRegions = { [preferred.id]: true };
    const nextZones = {};
    for (const z of preferred.zones || []) nextZones[`${preferred.id}|${z.id}`] = true;
    setOpenRegions(nextRegions);
    setOpenZones(nextZones);
    persistFolds(nextRegions, nextZones);
  }, [prefsReady, orderedTree, openRegions, openZones, persistFolds]);

  const nameCollision = useMemo(() => {
    const map = new Map();
    for (const r of orderedTree) {
      for (const z of r.zones) {
        for (const u of z.units) {
          const name = u.unidadName;
          if (!map.has(name)) map.set(name, []);
          map.get(name).push(u);
        }
      }
    }
    return map;
  }, [orderedTree]);

  const tq = treeQuery.trim().toLowerCase();
  const filtering = Boolean(tq);
  const filteredTree = useMemo(() => {
    if (!tq) return orderedTree;
    return orderedTree
      .map((r) => {
        const regionHit = String(r.label || '')
          .toLowerCase()
          .includes(tq);
        const zones = r.zones
          .map((z) => {
            const zoneHit =
              regionHit ||
              String(z.label || '')
                .toLowerCase()
                .includes(tq) ||
              String(z.short || '')
                .toLowerCase()
                .includes(tq);
            const unitsHit = z.units.filter(
              (u) =>
                zoneHit ||
                String(u.unidadName || '')
                  .toLowerCase()
                  .includes(tq)
            );
            if (!unitsHit.length && !zoneHit) return null;
            return {
              ...z,
              units: zoneHit ? z.units : unitsHit,
              unitCount: (zoneHit ? z.units : unitsHit).length,
            };
          })
          .filter(Boolean);
        if (!zones.length && !regionHit) return null;
        return { ...r, zones };
      })
      .filter(Boolean);
  }, [orderedTree, tq]);

  const flatUnits = useMemo(
    () => orderedTree.flatMap((r) => r.zones.flatMap((z) => z.units)),
    [orderedTree]
  );

  function regionIdFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const row = el?.closest?.('[data-region-id]');
    if (!row || !treeListRef.current?.contains(row)) return null;
    return row.getAttribute('data-region-id');
  }

  function clearRegionDrag() {
    const sess = dragSessionRef.current;
    if (sess) {
      if (sess.onMove) window.removeEventListener('pointermove', sess.onMove, true);
      if (sess.onUp) {
        window.removeEventListener('pointerup', sess.onUp, true);
        window.removeEventListener('pointercancel', sess.onUp, true);
      }
      if (sess.target) {
        try {
          if (sess.target.hasPointerCapture?.(sess.pointerId)) {
            sess.target.releasePointerCapture(sess.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
    }
    dragSessionRef.current = null;
    setDragFrom(null);
    setDragOver(null);
  }

  function reorderRegions(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setRegionOrder((prev) => {
      const base = mergeRegionOrder(
        prev,
        orderedTree.map((r) => String(r.id))
      );
      const next = [...base];
      const fromIdx = next.indexOf(String(fromId));
      const toIdx = next.indexOf(String(toId));
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, String(fromId));
      persistRegionOrder(next);
      return next;
    });
  }

  function onRegionPointerDown(e, regionId) {
    if (filtering || e.button !== 0) return;
    if (dragSessionRef.current) return;
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const session = {
      id: String(regionId),
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointerId,
      target,
      onMove: null,
      onUp: null,
    };
    dragSessionRef.current = session;
    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = dragSessionRef.current;
      if (!start || start.id !== String(regionId)) return;
      if (!start.moved) {
        if (
          Math.abs(ev.clientX - start.x) < DRAG_THRESHOLD_PX &&
          Math.abs(ev.clientY - start.y) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        start.moved = true;
        setDragFrom(String(regionId));
        setDragOver(regionIdFromPoint(ev.clientX, ev.clientY));
        return;
      }
      setDragOver(regionIdFromPoint(ev.clientX, ev.clientY));
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const start = dragSessionRef.current;
      if (start && start.id === String(regionId) && start.moved) {
        suppressRegionClickRef.current = true;
        const hit = regionIdFromPoint(ev.clientX, ev.clientY);
        if (hit) reorderRegions(String(regionId), hit);
      }
      clearRegionDrag();
    };

    session.onMove = onMove;
    session.onUp = onUp;
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }
  const selected = flatUnits.find((u) => unitKey(u) === selectedKey) || null;

  const assignedNames = useMemo(() => {
    if (!selected || !estado) return [];
    const est = String(estado).trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          sameCoverageUnit(r, selected) && String(r.estado || '').trim().toLowerCase() === est
      )
      .map((r) => r.municipio);
  }, [rows, selected, estado]);

  const takenByName = useMemo(() => {
    const map = new Map();
    if (!selected || !estado) return map;
    const est = String(estado).trim().toLowerCase();
    for (const row of rows) {
      if (String(row.estado || '').trim().toLowerCase() !== est) continue;
      if (sameCoverageUnit(row, selected)) continue;
      const key = String(row.municipio || '').trim().toLowerCase();
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [rows, selected, estado]);

  const estadoAssignedCount = useMemo(() => {
    const map = new Map();
    if (!selected) return map;
    for (const row of rows) {
      if (!sameCoverageUnit(row, selected)) continue;
      const key = String(row.estado || '').trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [rows, selected]);

  useEffect(() => {
    if (!selectedKey) return;
    const u = flatUnits.find((x) => unitKey(x) === selectedKey);
    if (!u) return;
    const first =
      rows.find(
        (r) =>
          r.unidadName === u.unidadName && String(r.zonaKey || '') === String(u.zonaKey || '')
      )?.estado || '';
    if (first) setEstado(first);
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!estado) {
      setMunicipios([]);
      return undefined;
    }
    let alive = true;
    setMuniLoading(true);
    fetchGeoMunicipios(session.token, { estado })
      .then((data) => {
        if (!alive) return;
        setMunicipios(data.municipios || []);
      })
      .catch(() => {
        if (alive) setMunicipios([]);
      })
      .finally(() => {
        if (alive) setMuniLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [estado, session.token]);

  const q = query.trim().toLowerCase();
  const visibleMunis = useMemo(() => {
    const list = municipios || [];
    if (!q) return list;
    return list.filter((m) => String(m.name || '').toLowerCase().includes(q));
  }, [municipios, q]);

  function showSaveFlash(msg) {
    setSaveFlash(msg);
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setSaveFlash(''), 4500);
  }

  async function saveMunicipios(nextNames, transfer) {
    if (!selected || !estado || !canEdit) return;
    setBusy(true);
    try {
      const zonaKey =
        selected.zonaKey ||
        IV_RM_ZONAS.find((z) => String(selected.zonaShort || '').includes(z.short))?.id ||
        selected.zonaShort;
      const data = await putCatalogTerritorio(session.token, {
        unidadName: selected.unidadName,
        zonaKey,
        zonaShort: selected.zonaShort || zonaKey,
        regionLabel: selected.regionLabel,
        regionId: selected.regionId,
        zoneId: selected.zoneId,
        unitId: selected.unitId,
        estado,
        municipios: nextNames,
      });
      setUnits(data.units || []);
      setRows(data.rows || []);
      if (data.unitColors) {
        setUnitColors(data.unitColors);
        setOrgUnitColorOverrides(data.unitColors);
      }
      setSelectedKey(`${zonaKey}|${selected.unidadName}`);
      window.dispatchEvent(new Event(IV_RM_COVERAGE_EVENT));
      const n = data.saved?.municipios ?? nextNames.length;
      const zona = selected.zonaShort || zonaKey;
      showSaveFlash(
        transfer?.name
          ? `${transfer.name} quedó en ${selected.unidadName}. ${transfer.who} ya no lo tiene.`
          : `Se asignaron ${n} municipio${n === 1 ? '' : 's'} a ${selected.unidadName} · ${zona} (${estado}).`
      );
    } catch (e) {
      setDialog({ title: 'Error', message: e.message || 'No se pudo guardar', alertOnly: true });
    } finally {
      setBusy(false);
    }
  }

  function toggleMuni(name) {
    const has = assignedNames.includes(name);
    if (has) {
      saveMunicipios(assignedNames.filter((n) => n !== name));
      return;
    }
    const holders = takenByName.get(String(name || '').trim().toLowerCase()) || [];
    if (holders.length) {
      const who = holderPhrase(holders);
      setDialog({
        title: 'Sustituir municipio',
        message: `${name} está en ${who}. ¿Sustituirlo? ${who} se queda sin este municipio.`,
        confirmLabel: 'Sustituir',
        onConfirm: () => saveMunicipios([...assignedNames, name], { name, who }),
      });
      return;
    }
    saveMunicipios([...assignedNames, name]);
  }

  function toggleRegion(id) {
    setOpenRegions((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persistFolds(next, openZones);
      return next;
    });
  }

  function toggleZone(regionId, zoneId) {
    const key = `${regionId}|${zoneId}`;
    setOpenZones((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistFolds(openRegions, next);
      return next;
    });
  }

  function colorForUnit(u) {
    const n = countAssigned(rows, u) || u.municipioCount || 0;
    if (n === 0) return NO_COVER_COLOR;
    const keyed = unitColors[unitKey(u)];
    if (keyed) return keyed;
    return unidadColor(u.unidadName, u.zonaKey);
  }

  function openUnitColorPicker(u, e) {
    e?.stopPropagation?.();
    if (!canEdit) return;
    colorTargetRef.current = u;
    const input = colorInputRef.current;
    if (!input) return;
    input.value = colorForUnit(u) || '#6a8f4a';
    try {
      input.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      /* fallback */
    }
    try {
      input.click();
    } catch {
      /* ignore */
    }
  }

  async function onColorPicked(e) {
    const u = colorTargetRef.current;
    const color = String(e.target.value || '').toLowerCase();
    if (!u || !canEdit || !/^#[0-9a-f]{6}$/.test(color)) return;
    try {
      const data = await putCatalogTerritorioUnitColor(session.token, {
        unidadName: u.unidadName,
        zonaKey: u.zonaKey,
        color,
      });
      const next = data.unitColors || {};
      setUnitColors(next);
      setOrgUnitColorOverrides(next);
      window.dispatchEvent(new Event(IV_RM_COVERAGE_EVENT));
      showSaveFlash(`Color de ${u.unidadName} · ${u.zonaShort || u.zonaKey} actualizado en el mapa.`);
    } catch (err) {
      const msg = err.message || 'No se pudo guardar el color';
      setDialog({
        title: 'Error',
        message:
          msg === 'Ruta no encontrada'
            ? 'No se pudo guardar el color: la API no tiene la ruta (reinicie pruebas / despliegue).'
            : msg,
        alertOnly: true,
      });
    }
  }

  const mapHasPolygons = selected ? isIvRmRegion(selected.regionLabel) : true;

  if (!canSee) {
    return (
      <p className="cc-error">
        Sin permiso para la pestaña Territorio. Un administrador puede habilitarla en Perfiles →
        Configuración → Territorio.
      </p>
    );
  }
  if (loading) return <p className="cc-hint">Cargando territorio…</p>;
  if (err) return <p className="cc-error">{err}</p>;

  return (
    <div className="cc-cat-grades-wrap cc-territorio-cat">
      <p className="cc-cat-hint">
        Aquí solo se asignan municipios; alta de región/zona/unidad en Catálogos → Dependencias.
        Editar cobertura: Configuración → editar + pestaña Territorio.
      </p>
      {saveFlash ? (
        <div className="cc-territorio-flash" role="status">
          {saveFlash}
        </div>
      ) : null}
      <input
        ref={colorInputRef}
        type="color"
        className="cc-territorio-color-input"
        aria-hidden
        tabIndex={-1}
        onChange={onColorPicked}
      />
      <div className="cc-territorio-split">
        <aside
          ref={treeListRef}
          className={`cc-territorio-units${dragFrom ? ' is-reordering' : ''}`}
          aria-label="Regiones, zonas y unidades"
        >
          <input
            type="search"
            className="cc-cat-input cc-territorio-tree-search"
            placeholder="Buscar región, zona o unidad…"
            value={treeQuery}
            onChange={(e) => setTreeQuery(e.target.value)}
            aria-label="Buscar en el árbol"
          />
          {filteredTree.length === 0 ? (
            <span className="cc-hint">Sin unidades. Revise Catálogos → Dependencias.</span>
          ) : (
            filteredTree.map((r) => {
              const forceOpen = Boolean(tq);
              const showRegion = forceOpen || Boolean(openRegions[r.id]);
              const rid = String(r.id);
              const isDragging = dragFrom === rid;
              const isOver = Boolean(dragOver === rid && dragFrom && dragOver !== dragFrom);
              return (
                <section
                  key={r.id}
                  className={[
                    'cc-territorio-region',
                    !filtering ? 'is-draggable' : '',
                    isDragging ? 'is-dragging' : '',
                    isOver ? 'is-drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-region-id={rid}
                >
                  <button
                    type="button"
                    className="cc-territorio-fold"
                    aria-expanded={showRegion}
                    title={!filtering ? 'Arrastre para reordenar (su orden)' : undefined}
                    onPointerDown={(e) => onRegionPointerDown(e, rid)}
                    onClick={() => {
                      if (suppressRegionClickRef.current) {
                        suppressRegionClickRef.current = false;
                        return;
                      }
                      toggleRegion(r.id);
                    }}
                  >
                    <span className="cc-territorio-fold-caret" aria-hidden>
                      {showRegion ? '▾' : '▸'}
                    </span>
                    <span className="cc-territorio-fold-label">
                      <span className="cc-territorio-fold-title">{r.label}</span>
                      <em>
                        {r.unitCount} unidad{r.unitCount === 1 ? '' : 'es'} · {r.municipioCount}{' '}
                        mpio{r.municipioCount === 1 ? '' : 's'}
                      </em>
                    </span>
                  </button>
                  {showRegion
                    ? r.zones.map((z) => {
                        const zKey = `${r.id}|${z.id}`;
                        const expanded = forceOpen || Boolean(openZones[zKey]);
                        return (
                          <div key={zKey} className="cc-territorio-zona">
                            <button
                              type="button"
                              className="cc-territorio-fold cc-territorio-fold--zona"
                              aria-expanded={expanded}
                              onClick={() => toggleZone(r.id, z.id)}
                            >
                              <span className="cc-territorio-fold-caret" aria-hidden>
                                {expanded ? '▾' : '▸'}
                              </span>
                              <span className="cc-territorio-fold-label">
                                <span className="cc-territorio-fold-title">{z.label}</span>
                                <em>
                                  {z.unitCount} · {z.municipioCount} mpios
                                </em>
                              </span>
                            </button>
                            {expanded ? (
                              <div className="cc-territorio-unit-list">
                                {z.units.map((u) => {
                                  const k = unitKey(u);
                                  const n = countAssigned(rows, u) || u.municipioCount || 0;
                                  const twins = nameCollision.get(u.unidadName) || [];
                                  const collision = twins.length > 1;
                                  const noCover = n === 0;
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      className={`cc-territorio-unit${k === selectedKey ? ' is-on' : ''}${noCover ? ' is-empty' : ''}`}
                                      onClick={() => {
                                        setSelectedKey(k);
                                        setQuery('');
                                      }}
                                      title={
                                        collision
                                          ? `Clave ${k} (mismo nombre en ${twins.length} zonas)`
                                          : k
                                      }
                                    >
                                      <span
                                        role="presentation"
                                        className="cc-territorio-unit-dot"
                                        style={{ background: colorForUnit(u) }}
                                        title={
                                          canEdit
                                            ? 'Doble clic para color del mapa'
                                            : 'Color en consola / mapa'
                                        }
                                        onDoubleClick={(e) => openUnitColorPicker(u, e)}
                                      />
                                      <span className="cc-territorio-unit-text">
                                        <span className="cc-territorio-unit-name">
                                          {u.unidadName}
                                        </span>
                                        <span className="cc-territorio-unit-meta">
                                          {u.zonaShort || z.short}
                                          {collision ? ' · misma clave zona|unidad' : ''}
                                          {noCover ? ' · sin municipios' : ''}
                                        </span>
                                      </span>
                                      <em className={noCover ? 'is-empty' : ''}>{n}</em>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                </section>
              );
            })
          )}
        </aside>
        <section className="cc-territorio-assign">
          {!selected ? (
            <p className="cc-hint">Seleccione una unidad para asignar municipios.</p>
          ) : (
            <>
              <header className="cc-territorio-assign-head">
                <strong>{selected.unidadName}</strong>
                <span className="cc-territorio-assign-path">
                  {selected.regionLabel || 'Región'} · {selected.zonaShort || selected.zonaKey}
                </span>
                <span className="cc-territorio-assign-key">
                  Clave <code>{unitKey(selected)}</code>
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    className="cc-territorio-color-btn"
                    onClick={(e) => openUnitColorPicker(selected, e)}
                  >
                    <i
                      className="cc-territorio-unit-dot"
                      style={{ background: colorForUnit(selected) }}
                      aria-hidden
                    />
                    Color en mapa
                  </button>
                ) : null}
              </header>
              {!mapHasPolygons ? (
                <p className="cc-territorio-geo-banner" role="note">
                  El mapa de la consola solo tiene polígonos GeoJSON de IV R.M. por ahora. Esta
                  asignación se guarda igual; los municipios se pintarán cuando exista la capa de{' '}
                  {selected.regionLabel}.
                </p>
              ) : null}
              <label className="cc-territorio-estado">
                Estado
                <select
                  value={estado}
                  onChange={(e) => {
                    setEstado(e.target.value);
                    setQuery('');
                  }}
                  aria-label="Estado"
                >
                  <option value="">Seleccione…</option>
                  {estados.map((e) => {
                    const n = estadoAssignedCount.get(String(e.name || '').trim().toLowerCase()) || 0;
                    return (
                      <option key={e.code || e.name} value={e.name}>
                        {n > 0 ? `${e.name} · ${n}` : e.name}
                      </option>
                    );
                  })}
                </select>
              </label>
              {!estado ? (
                <p className="cc-hint cc-territorio-assign-hint">
                  Elija un estado para ver sus municipios.
                </p>
              ) : muniLoading ? (
                <p className="cc-hint">Cargando municipios…</p>
              ) : (
                <>
                  <div className="cc-territorio-muni-tools">
                    <input
                      type="search"
                      className="cc-cat-input"
                      placeholder="Buscar municipio…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <span className="cc-hint">
                      {assignedNames.length} asignados
                      {q ? ` · ${visibleMunis.length} visibles` : ''}
                    </span>
                  </div>
                  {visibleMunis.length === 0 ? (
                    <p className="cc-hint">Sin municipios en este estado.</p>
                  ) : (
                    <div className="cc-territorio-munis">
                      {visibleMunis.map((m) => {
                        const on = assignedNames.includes(m.name);
                        const taken = !on && takenByName.has(String(m.name || '').trim().toLowerCase());
                        return (
                          <div
                            key={m.code || m.name}
                            className={`cc-territorio-muni${on ? ' is-on' : ''}${taken ? ' is-taken' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!canEdit || busy}
                              aria-label={m.name}
                              onChange={() => toggleMuni(m.name)}
                            />
                            <span className="cc-territorio-muni-name">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        alertOnly={dialog?.alertOnly}
        confirmLabel={dialog?.confirmLabel || 'Aceptar'}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          const run = dialog?.onConfirm;
          setDialog(null);
          if (typeof run === 'function') run();
        }}
      />
    </div>
  );
}
