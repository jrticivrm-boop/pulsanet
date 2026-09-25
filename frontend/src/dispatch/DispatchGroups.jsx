import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addGroupMember,
  canManageUsers,
  createGroup,
  deleteAdminGroup,
  deleteGroupAvatar,
  fetchAdminGroupMembers,
  fetchAdminGroups,
  fetchAdminUsers,
  fetchOrgUnits,
  isRootUser,
  patchAdminGroup,
  patchGroupMember,
  purgeGroupMessages,
  removeGroupMember,
  uploadGroupAvatar,
} from '../api';
import { canModuleAction, canViewModule } from './modulePermissions.js';
import AppDialog from '../AppDialog';
import PersonAvatar from '../PersonAvatar';
import { invalidateGroupAvatarBlob, peekGroupAvatarBlobUrl } from '../avatarBlobCache.js';
import ThFilterMulti, {
  colFilterIsActive,
  colFilterIsNone,
  COLS_BTN_SVG,
  FILTER_BTN_SVG,
  NEW_CHANNEL_BTN_SVG,
} from './ThFilterMulti.jsx';
import useAdminStickyToolbarHeight from './useAdminStickyToolbarHeight.js';

const MEMBER_ROLES = [
  { value: 'member', label: 'Miembro' },
  { value: 'leader', label: 'Líder' },
  { value: 'listen_only', label: 'Solo escucha' },
];

/** Columnas ocultables/reordenables. Orden por defecto: Alcance → Canal → … */
const GROUP_TABLE_COLS = [
  { key: 'scope', label: 'Alcance' },
  { key: 'canal', label: 'Canal' },
  { key: 'desc', label: 'Descripción' },
  { key: 'members', label: 'Miembros' },
  { key: 'status', label: 'Estado' },
];

const GROUP_COL_CLASS = {
  canal: 'cc-gt-col-canal',
  desc: 'cc-gt-col-desc',
  scope: 'cc-gt-col-scope',
  members: 'cc-gt-col-n',
  status: 'cc-gt-col-state',
};

/** v2: orden Alcance primero + vista árbol. */
const GROUPS_COL_CONFIG_STORAGE_KEY = 'tacticalptx.groups.colConfig.v2';

function defaultGroupColConfig() {
  return GROUP_TABLE_COLS.map((c) => ({ ...c, visible: true }));
}

function loadGroupColConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(GROUPS_COL_CONFIG_STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved)) return defaultGroupColConfig();
    const validKeys = new Set(GROUP_TABLE_COLS.map((c) => c.key));
    const ordered = [];
    const seen = new Set();
    for (const s of saved) {
      if (!validKeys.has(s.key) || seen.has(s.key)) continue;
      seen.add(s.key);
      const base = GROUP_TABLE_COLS.find((d) => d.key === s.key);
      ordered.push({ ...base, visible: s.visible !== false });
    }
    for (const d of GROUP_TABLE_COLS) {
      if (!seen.has(d.key)) ordered.push({ ...d, visible: true });
    }
    return ordered.length ? ordered : defaultGroupColConfig();
  } catch {
    return defaultGroupColConfig();
  }
}

function saveGroupColConfig(config) {
  try {
    localStorage.setItem(
      GROUPS_COL_CONFIG_STORAGE_KEY,
      JSON.stringify(config.map((c) => ({ key: c.key, visible: c.visible !== false })))
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Vacío para ordenar (estilo Parque Vehicular). */
function isSortEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

/**
 * Compara valores de columna. Vacío siempre es el menor:
 * ▲ asc → vacíos arriba; ▼ desc → vacíos abajo.
 */
function compareSortValues(va, vb, dir) {
  const aEmpty = isSortEmpty(va);
  const bEmpty = isSortEmpty(vb);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return -1 * dir;
  if (bEmpty) return 1 * dir;
  if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
  return (
    String(va).localeCompare(String(vb), 'es', { sensitivity: 'base', numeric: true }) * dir
  );
}

function getGroupSortValue(g, key) {
  switch (key) {
    case 'canal':
      return g.name || '';
    case 'desc':
      return g.description || '';
    case 'scope':
      return scopeNameOnly(g);
    case 'members': {
      const n = Number(g.member_count);
      return Number.isFinite(n) ? n : 0;
    }
    case 'status':
      return g.is_active ? 1 : 0;
    default:
      return '';
  }
}

/** Valor canónico para filtro de columna. Alcance: `level::unitId` (árbol orgánico). */
function getGroupColFilterVal(g, key) {
  switch (key) {
    case 'canal':
      return g.name || '';
    case 'desc':
      return g.description || '—';
    case 'scope': {
      const level = g.scopeLevel || g.scope_level || 'unit';
      const id = g.unitId || g.unit_id || '';
      if (id) return `${level}::${id}`;
      return `${level}::__${scopeNameOnly(g)}`;
    }
    case 'members':
      return String(g.member_count ?? 0);
    case 'status':
      return g.is_active ? 'active' : 'inactive';
    default:
      return '';
  }
}

/** Nombre de alcance sin prefijo Región/Zona/Unidad. */
function scopeNameOnly(group) {
  if (!group) return '—';
  const raw = group.unitName || group.unit_name || '';
  if (raw && String(raw).trim()) return String(raw).trim();
  const label = group.scopeLabel || '';
  if (label) {
    const stripped = String(label)
      .replace(/^(Región|Region|Zona|Unidad)\s*[·:\-–—]\s*/i, '')
      .trim();
    if (stripped) return stripped;
  }
  return '—';
}

function groupColFilterOptionLabel(key, value, scopeNameByValue) {
  if (key === 'status') {
    if (value === 'active') return 'Activo';
    if (value === 'inactive') return 'Inactivo';
  }
  if (key === 'scope') {
    if (scopeNameByValue && scopeNameByValue[value]) return scopeNameByValue[value];
    const s = String(value || '');
    const i = s.indexOf('::');
    const rest = i >= 0 ? s.slice(i + 2) : s;
    return rest.startsWith('__') ? rest.slice(2) : rest;
  }
  return value;
}

/**
 * Árbol de filtro Alcance (por región):
 *   Región
 *     ☐ Grupos (de todas las zonas y unidades)   ← canal región
 *     ▼ Zona
 *         ☐ Grupos (de todas las unidades)       ← canal zona
 *         ☐ Unidad                               ← canal unidad
 * Solo aparecen filas si hay canales de ese tipo. Check = alcance (level::id).
 */
function buildScopeFilterTree(orgTree, filterValues) {
  const present = new Set(filterValues || []);
  const nameByValue = {};

  function sortKids(list) {
    return [...list].sort((a, b) =>
      String(a.label).localeCompare(String(b.label), 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    );
  }

  const tree = [];
  const placed = new Set();

  for (const region of orgTree || []) {
    const rName = region.name || '—';
    const regionGroupNodes = [];
    const zoneFolders = [];
    const rv = `region::${region.id}`;
    if (present.has(rv)) {
      nameByValue[rv] = `${rName} · Grupos (de todas las zonas y unidades)`;
      regionGroupNodes.push({
        id: `${region.id}__region_groups`,
        value: rv,
        label: 'Grupos (de todas las zonas y unidades)',
        level: 'region',
        selectable: true,
        children: [],
      });
      placed.add(rv);
    }

    for (const zone of region.children || []) {
      const zName = zone.name || '—';
      const zoneChildren = [];
      const zv = `zone::${zone.id}`;
      if (present.has(zv)) {
        nameByValue[zv] = `${zName} · Grupos (de todas las unidades)`;
        zoneChildren.push({
          id: `${zone.id}__zone_groups`,
          value: zv,
          label: 'Grupos (de todas las unidades)',
          level: 'zone',
          selectable: true,
          children: [],
        });
        placed.add(zv);
      }
      const unitNodes = [];
      for (const unit of zone.children || []) {
        const uv = `unit::${unit.id}`;
        if (!present.has(uv)) continue;
        const uName = unit.name || '—';
        nameByValue[uv] = `${uName} · ${zName}`;
        unitNodes.push({
          id: unit.id,
          value: uv,
          label: uName,
          level: 'unit',
          selectable: true,
          children: [],
        });
        placed.add(uv);
      }
      /* Primero «Grupos (de todas las unidades)», luego unidades ordenadas */
      const zoneKids = [...zoneChildren, ...sortKids(unitNodes)];
      if (zoneKids.length === 0) continue;
      zoneFolders.push({
        id: zone.id,
        value: '',
        label: zName,
        level: 'zone-folder',
        selectable: false,
        children: zoneKids,
      });
    }

    const regionChildren = [...regionGroupNodes, ...sortKids(zoneFolders)];
    if (regionChildren.length === 0) continue;
    tree.push({
      id: region.id,
      value: '',
      label: rName,
      level: 'region-folder',
      selectable: false,
      children: regionChildren,
    });
  }

  const orphans = [];
  for (const v of present) {
    if (placed.has(v)) continue;
    const i = String(v).indexOf('::');
    const level = i >= 0 ? v.slice(0, i) : '';
    const rest = i >= 0 ? v.slice(i + 2) : v;
    const base = rest.startsWith('__') ? rest.slice(2) : rest;
    let label = base;
    if (level === 'region') label = `${base} · Grupos (de todas las zonas y unidades)`;
    else if (level === 'zone') label = `${base} · Grupos (de todas las unidades)`;
    nameByValue[v] = label;
    orphans.push({
      id: `orphan-${v}`,
      value: v,
      label,
      level: level || 'unit',
      selectable: true,
      children: [],
    });
  }
  if (orphans.length) {
    tree.push({
      id: '__otros__',
      value: '',
      label: 'Otros',
      level: 'region-folder',
      selectable: false,
      children: sortKids(orphans),
    });
  }

  return { tree: sortKids(tree), nameByValue };
}

/**
 * Filas de tabla en árbol: Región → C.G. → Zonas → Organismos → canales.
 * Incluye nodos del orgTree aunque no tengan canales (para «Agregar canal»).
 * @returns {{ type: 'folder'|'channel', id: string, depth: number, label?: string, kind?: string, channelCount?: number, group?: object, regionId?: string, zoneId?: string, unitId?: string }[]}
 */
function orgNodeSortKey(node) {
  const so = Number(node?.sortOrder ?? node?.sort_order ?? 0) || 0;
  const name = String(node?.name || '');
  return { so, name };
}

/**
 * Extrae el número de orden militar al inicio del nombre:
 * «7/a. Z.M.», «8/a. Zona», «12/a. Zona», «16/o. R.C.», «200/a. Cia.» → 7, 8, 12, 16, 200.
 */
function militaryOrdinal(name) {
  const s = String(name || '').trim();
  const m = s.match(/^(\d+)\s*\/\s*[ao]\.?/i);
  if (m) return Number(m[1]);
  const m2 = s.match(/^(\d+)\b/);
  if (m2) return Number(m2[1]);
  return null;
}

/** Prioridad de zona bajo una región: C.G. primero, luego Z.M., apoyo, resto. */
function zoneTypeRank(zone) {
  const t = String(zone?.zoneType || zone?.zone_type || '').toLowerCase();
  if (t === 'cg') return 0;
  const n = String(zone?.name || '');
  if (/\bc\.?\s*g\.?\b/i.test(n) || /^cg\b/i.test(n.trim())) return 0;
  if (t === 'zm') return 1;
  if (t === 'support') return 2;
  return 3;
}

function compareOrgSiblings(a, b) {
  const ra = zoneTypeRank(a);
  const rb = zoneTypeRank(b);
  if (ra !== rb) return ra - rb;

  const oa = militaryOrdinal(a?.name);
  const ob = militaryOrdinal(b?.name);
  if (oa != null && ob != null && oa !== ob) return oa - ob;
  if (oa != null && ob == null) return -1;
  if (oa == null && ob != null) return 1;

  const ka = orgNodeSortKey(a);
  const kb = orgNodeSortKey(b);
  if (ka.so !== kb.so) return ka.so - kb.so;
  return ka.name.localeCompare(kb.name, 'es', { sensitivity: 'base', numeric: true });
}

function buildGroupsTreeRows(orgTree, groups) {
  const list = Array.isArray(groups) ? groups : [];
  const byAnchor = new Map();
  const unanchored = [];

  for (const g of list) {
    const aid = g.unitId || g.unit_id || null;
    if (!aid) {
      unanchored.push(g);
      continue;
    }
    if (!byAnchor.has(aid)) byAnchor.set(aid, []);
    byAnchor.get(aid).push(g);
  }

  const sortGroups = (arr) =>
    [...arr].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    );

  const rows = [];
  const seenAnchors = new Set();

  function take(anchorId) {
    const got = byAnchor.get(anchorId) || [];
    if (got.length) seenAnchors.add(anchorId);
    return sortGroups(got);
  }

  function peek(anchorId) {
    return byAnchor.get(anchorId)?.length || 0;
  }

  function peekUnit(unit) {
    return peek(unit.id);
  }

  function peekZone(zone) {
    let n = peek(zone.id);
    for (const unit of zone.children || []) n += peekUnit(unit);
    return n;
  }

  function peekRegion(region) {
    let n = peek(region.id);
    for (const zone of region.children || []) n += peekZone(zone);
    return n;
  }

  const regions = [...(orgTree || [])].sort(compareOrgSiblings);

  for (const region of regions) {
    const rTotal = peekRegion(region);
    const rOwn = peek(region.id);

    rows.push({
      type: 'folder',
      id: `folder-region-${region.id}`,
      depth: 0,
      label: region.name || 'Región',
      kind: 'region',
      channelCount: rTotal,
      ownChannelCount: rOwn,
      nodeId: region.id,
      regionId: region.id,
      zoneId: '',
      unitId: '',
    });

    for (const g of take(region.id)) {
      rows.push({ type: 'channel', id: `ch-${g.id}`, depth: 1, group: g });
    }

    const zones = [...(region.children || [])].sort(compareOrgSiblings);

    for (const zone of zones) {
      const zTotal = peekZone(zone);
      const zOwn = peek(zone.id);
      const isCg = zoneTypeRank(zone) === 0;

      rows.push({
        type: 'folder',
        id: `folder-zone-${zone.id}`,
        depth: 1,
        label: zone.name || (isCg ? 'C.G.' : 'Zona'),
        kind: isCg ? 'cg' : 'zone',
        channelCount: zTotal,
        ownChannelCount: zOwn,
        nodeId: zone.id,
        regionId: region.id,
        zoneId: zone.id,
        unitId: '',
      });

      for (const g of take(zone.id)) {
        rows.push({ type: 'channel', id: `ch-${g.id}`, depth: 2, group: g });
      }

      const units = [...(zone.children || [])].sort(compareOrgSiblings);
      for (const unit of units) {
        const uGroups = take(unit.id);

        rows.push({
          type: 'folder',
          id: `folder-unit-${unit.id}`,
          depth: 2,
          label: unit.name || 'Organismo',
          kind: 'unit',
          channelCount: uGroups.length,
          ownChannelCount: uGroups.length,
          nodeId: unit.id,
          regionId: region.id,
          zoneId: zone.id,
          unitId: unit.id,
        });

        for (const g of uGroups) {
          rows.push({ type: 'channel', id: `ch-${g.id}`, depth: 3, group: g });
        }
      }
    }
  }

  for (const [aid, arr] of byAnchor) {
    if (seenAnchors.has(aid) || !arr.length) continue;
    unanchored.push(...arr);
  }

  if (unanchored.length) {
    const sorted = sortGroups(unanchored);
    rows.push({
      type: 'folder',
      id: 'folder-otros',
      depth: 0,
      label: 'Sin ubicación en el árbol',
      kind: 'other',
      channelCount: sorted.length,
      ownChannelCount: sorted.length,
      nodeId: '__otros__',
      regionId: '',
      zoneId: '',
      unitId: '',
    });
    for (const g of sorted) {
      rows.push({ type: 'channel', id: `ch-${g.id}`, depth: 1, group: g });
    }
  }

  if ((!orgTree || !orgTree.length) && list.length && !rows.length) {
    for (const g of sortGroups(list)) {
      rows.push({ type: 'channel', id: `ch-${g.id}`, depth: 0, group: g });
    }
  }

  return rows;
}

/**
 * Árbol cerrado por defecto: solo se muestran carpetas raíz y
 * descendientes bajo carpetas en `expanded` (Set de folder ids).
 */
function filterExpandedTreeRows(rows, expanded) {
  const exp = expanded || new Set();
  const out = [];
  let skipUntilDepth = null;
  for (const row of rows) {
    if (skipUntilDepth != null) {
      if (row.depth > skipUntilDepth) continue;
      skipUntilDepth = null;
    }
    out.push(row);
    if (row.type === 'folder' && !exp.has(row.id)) {
      skipUntilDepth = row.depth;
    }
  }
  return out;
}

function groupTableCell(g, key, session) {
  switch (key) {
    case 'canal':
      return (
        <span className="cc-gt-canal-cell">
          <PersonAvatar
            groupId={g.id}
            avatarUrl={g.avatarUrl}
            name={g.name}
            token={session.token}
            group
            className="cc-group-avatar cc-group-avatar--table"
          />
          <strong>{g.name}</strong>
        </span>
      );
    case 'desc':
      return (
        <span className="cc-gt-desc" title={g.description || ''}>
          {g.description || '—'}
        </span>
      );
    case 'scope':
      return <span className="cc-gt-scope">{scopeNameOnly(g)}</span>;
    case 'members':
      return g.member_count ?? 0;
    case 'status':
      return (
        <span className={`status-pill ${g.is_active ? 'on' : 'off'}`}>
          {g.is_active ? 'Activo' : 'Inactivo'}
        </span>
      );
    default:
      return '—';
  }
}

const ALC_ALL_ZONES = '__all__';
const ALC_ALL_UNITS = '__all__';

const ROLE_ALIAS = {
  admin: 'region_admin',
  dispatcher: 'region_user',
  operator: 'unit_user',
};

function normalizeClientRole(role) {
  const raw = String(role || '').trim();
  return ROLE_ALIAS[raw] || raw;
}

function findOrgPath(tree, unitId, adminScopeUnitId) {
  const targets = [unitId, adminScopeUnitId].filter(Boolean);
  if (!targets.length) return { regionId: '', zoneId: '', unitId: '' };
  for (const region of tree || []) {
    if (targets.includes(region.id)) {
      return { regionId: region.id, zoneId: '', unitId: '' };
    }
    for (const zone of region.children || []) {
      if (targets.includes(zone.id)) {
        return {
          regionId: region.id,
          zoneId: zone.id,
          unitId: unitId && unitId !== zone.id ? unitId : '',
        };
      }
      for (const unit of zone.children || []) {
        if (targets.includes(unit.id)) {
          return { regionId: region.id, zoneId: zone.id, unitId: unit.id };
        }
      }
    }
  }
  return { regionId: '', zoneId: '', unitId: unitId || '' };
}

/** Etiqueta legible del alcance guardado (no del formulario). Solo el nombre. */
function formatStoredGroupScope(group) {
  if (!group) return '—';
  const level = group.scopeLevel || group.scope_level || '';
  const anchor = group.unitId || group.unit_id;
  if (!anchor) {
    if (level === 'unit') return '(unidad sin ancla)';
    if (level === 'zone') return '(zona sin ancla)';
    if (level === 'region') return '—';
    return 'Sin alcance definido';
  }
  return scopeNameOnly(group);
}

function groupScopeNeedsFix(group) {
  if (!group) return false;
  const level = group.scopeLevel || group.scope_level || '';
  const anchor = group.unitId || group.unit_id;
  if (!anchor && level && level !== 'region') return true;
  if (!anchor && !level) return true;
  return false;
}

/** Rehidrata cascada de edición desde un grupo existente (scope_level + unit_id). */
function hydrateGroupScopeChoices(group, tree) {
  const level = group?.scopeLevel || group?.scope_level || '';
  const anchor = group?.unitId || group?.unit_id || null;
  if (!anchor) {
    return { regionId: '', zoneChoice: '', unitChoice: '' };
  }
  const path = findOrgPath(tree, anchor, anchor);
  if (level === 'region' || (!level && path.regionId === anchor)) {
    return { regionId: path.regionId || anchor, zoneChoice: ALC_ALL_ZONES, unitChoice: '' };
  }
  if (level === 'zone' || (!path.unitId && path.zoneId)) {
    return {
      regionId: path.regionId || '',
      zoneChoice: path.zoneId || anchor,
      unitChoice: ALC_ALL_UNITS,
    };
  }
  return {
    regionId: path.regionId || '',
    zoneChoice: path.zoneId || '',
    unitChoice: path.unitId || anchor,
  };
}

/**
 * Cascada de alcance → scope_level + ancla unit_id del canal.
 *
 * Administrador / admin de región:
 *   - Región obligatoria.
 *   - Zona opcional: vacía o «Todas las zonas y unidades» → canal de región.
 *   - Con zona concreta, Unidad opcional: vacía o «Todas las unidades» → canal de zona;
 *     unidad concreta → canal de unidad.
 *
 * Admin de zona: canal de su zona (unidad vacía/«Todos») o de una unidad de su zona.
 * Admin de unidad: canal fijo a su unidad.
 *
 * `hint` = falta un dato para poder guardar (bloquea); `error` = estado inválido.
 */
function resolveGroupScope({
  role,
  regionId,
  zoneChoice,
  unitChoice,
  lockedUnitId,
}) {
  const r = normalizeClientRole(role);
  if (r === 'unit_admin') {
    const uid = lockedUnitId || (unitChoice && unitChoice !== ALC_ALL_UNITS ? unitChoice : null);
    return {
      scopeLevel: 'unit',
      unitId: uid,
      hint: null,
      error: uid ? null : 'Tu cuenta no tiene unidad asignada.',
    };
  }

  if (r === 'zone_admin') {
    const zoneId = zoneChoice && zoneChoice !== ALC_ALL_ZONES ? zoneChoice : null;
    if (!zoneId) {
      return {
        scopeLevel: 'zone',
        unitId: null,
        hint: 'Falta la zona de tu alcance.',
        error: null,
      };
    }
    // Unidad opcional: vacía / «Todos» = canal de toda la zona.
    if (!unitChoice || unitChoice === ALC_ALL_UNITS) {
      return { scopeLevel: 'zone', unitId: zoneId, hint: null, error: null };
    }
    return { scopeLevel: 'unit', unitId: unitChoice, hint: null, error: null };
  }

  // region_admin / root — región obligatoria; zona y unidad opcionales.
  if (!regionId) {
    return {
      scopeLevel: 'region',
      unitId: null,
      hint: 'Selecciona la región del canal.',
      error: null,
    };
  }

  // Sin zona (o «Todas») → canal de región anclado a regionId.
  if (!zoneChoice || zoneChoice === ALC_ALL_ZONES) {
    return { scopeLevel: 'region', unitId: regionId, hint: null, error: null };
  }

  // Zona concreta; sin unidad (o «Todos») → canal de zona.
  if (!unitChoice || unitChoice === ALC_ALL_UNITS) {
    return { scopeLevel: 'zone', unitId: zoneChoice, hint: null, error: null };
  }

  return { scopeLevel: 'unit', unitId: unitChoice, hint: null, error: null };
}

function groupScopeHelp(actorRole) {
  const r = normalizeClientRole(actorRole);
  if (r === 'unit_admin') {
    return 'Creas un canal solo para tu unidad. Al asignar miembros solo verás gente de esa unidad.';
  }
  if (r === 'zone_admin') {
    return 'Puedes crear un canal de toda tu zona (deja Unidad en —) o de una sola unidad. No puedes agregar usuarios ni administradores de región.';
  }
  if (r === 'region_admin' || r === 'root') {
    return 'Elige la región. Zona y unidad opcionales: «Todas las zonas y unidades» = canal de región; zona + «Todas las unidades» = canal de zona; zona + unidad = canal de unidad.';
  }
  return 'El alcance del canal define quién puede entrar.';
}

function groupScopeLevelExplain(scopeLevel) {
  if (scopeLevel === 'region') {
    return 'Canal de región: puedes agregar personas de todas las zonas y unidades de esa región (y perfiles de región).';
  }
  if (scopeLevel === 'zone') {
    return 'Canal de zona: personas de esa zona y sus unidades. Un administrador de región también puede entrar o agregarse.';
  }
  if (scopeLevel === 'unit') {
    return 'Canal de unidad: personas de esa unidad. Admins de zona/región pueden entrar si quien asigna lo permite.';
  }
  return '';
}

/** Quién puede aparecer en «Asignar miembro» según el rol del que gestiona. */
function actorCanPickMember(actorRole, memberRole) {
  const actor = normalizeClientRole(actorRole);
  const member = normalizeClientRole(memberRole);
  if (actor === 'root' || actor === 'region_admin') return true;
  if (actor === 'zone_admin') {
    return ['zone_admin', 'zone_user', 'unit_admin', 'unit_user'].includes(member);
  }
  if (actor === 'unit_admin') {
    return member === 'unit_admin' || member === 'unit_user';
  }
  return false;
}

function collectDescendantIds(node) {
  const ids = new Set();
  if (!node?.id) return ids;
  ids.add(node.id);
  for (const child of node.children || []) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

/** Busca cualquier nodo (región / zona / unidad / vínculo) en el árbol. */
function findNodeInTree(tree, id) {
  if (!id) return null;
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
    return null;
  }
  return walk(tree);
}

/**
 * Membresía geográfica (cliente), alineada con groupPolicy.memberFitsGroupGeo:
 * - region_* / root: siempre
 * - canal región/zona: adscripción (unit_id / admin_scope) bajo el ancla
 * - canal unidad: misma unidad, o zone_admin cuya zona contiene esa unidad
 */
function memberFitsGroupGeoClient(u, group, orgTree) {
  const role = normalizeClientRole(u?.role);
  if (role === 'root' || role === 'region_admin' || role === 'region_user') return true;
  const level = group?.scopeLevel || group?.scope_level || 'unit';
  const anchor = group?.unitId || group?.unit_id || null;
  if (level === 'region' && !anchor) return true;
  if (!anchor) return false;

  if (u.unitId === anchor || u.adminScopeUnitId === anchor) return true;

  if (level === 'region' || level === 'zone') {
    const node = findNodeInTree(orgTree, anchor);
    const ids = collectDescendantIds(node);
    ids.add(anchor);
    return (
      (u.unitId && ids.has(u.unitId)) ||
      (u.adminScopeUnitId && ids.has(u.adminScopeUnitId))
    );
  }

  // unit: misma unidad, o admin de zona cuya zona contiene esa unidad
  // (no zone_user: alineado con groupPolicy.memberFitsGroupGeo / memberFitsGroup)
  if (role === 'zone_admin') {
    const zoneRootId = u.adminScopeUnitId || u.unitId;
    if (!zoneRootId) return false;
    const zoneNode = findNodeInTree(orgTree, zoneRootId);
    const ids = collectDescendantIds(zoneNode);
    ids.add(zoneRootId);
    return ids.has(anchor);
  }

  return u.unitId === anchor || u.adminScopeUnitId === anchor;
}

function roleTypeLabel(role) {
  const r = normalizeClientRole(role);
  const map = {
    root: 'Administrador',
    region_admin: 'Administrador de región',
    region_user: 'Usuario de región',
    zone_admin: 'Administrador de zona',
    zone_user: 'Usuario de zona',
    unit_admin: 'Administrador de unidad',
    unit_user: 'Usuario de unidad',
  };
  return map[r] || r || 'Usuario';
}

/** Etiqueta clara: rol · adscripción */
function memberAssignLabel(u) {
  const role = roleTypeLabel(u.role);
  const place = u.unitName || u.zoneName || '';
  if (place) return `${u.displayName} — ${role} · ${place}`;
  return `${u.displayName} — ${role}`;
}



export default function DispatchGroups({ session }) {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [orgTree, setOrgTree] = useState([]);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [regionId, setRegionId] = useState('');
  const [zoneChoice, setZoneChoice] = useState('');
  const [unitChoice, setUnitChoice] = useState('');
  const [editRegionId, setEditRegionId] = useState('');
  const [editZoneChoice, setEditZoneChoice] = useState('');
  const [editUnitChoice, setEditUnitChoice] = useState('');
  const [scopeBusy, setScopeBusy] = useState(false);
  const [scopeEditOpen, setScopeEditOpen] = useState(false);
  const [membersSectionOpen, setMembersSectionOpen] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  /** true = alta desde carpeta del árbol (modal corto, alcance fijado). */
  const [createFromTree, setCreateFromTree] = useState(false);
  const [createTreeContext, setCreateTreeContext] = useState(null);
  /** Ids de usuarios a agregar al crear desde el árbol (opcional). */
  const [createMemberIds, setCreateMemberIds] = useState([]);
  const [createMemberRole, setCreateMemberRole] = useState('member');
  const [createBusy, setCreateBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('member');
  const [roleBusyId, setRoleBusyId] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  /** Filtros por columna (undefined = todos; [] = ninguno; string[] = parcial). Estilo PV / Usuarios. */
  const [colFilters, setColFilters] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState(null);
  /** Columna de orden (null = sin ordenar); sortDir 1=▲ asc, -1=▼ desc. */
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  /** Tras un drag de columna, el click de cierre no debe ordenar (estilo PV). */
  const thDidDragRef = useRef(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [colConfig, setColConfig] = useState(loadGroupColConfig);
  const colsWrapRef = useRef(null);
  const { toolbarRef, stickyPageStyle } = useAdminStickyToolbarHeight();
  const [colDragIdx, setColDragIdx] = useState(null);
  const [thDragKey, setThDragKey] = useState(null);
  const [thDragOverKey, setThDragOverKey] = useState(null);
  const thDragKeyRef = useRef(null);
  /** Carpetas del árbol expandidas (vacío = todo cerrado salvo raíces visibles). */
  const [expandedTreeFolders, setExpandedTreeFolders] = useState(() => new Set());
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const canManage =
    canManageUsers(session.user) && canViewModule(session.user, 'grupos');
  const canAddGroup = canManage && canModuleAction(session.user, 'grupos', 'agregar');
  const canDeleteGroup = canManage && canModuleAction(session.user, 'grupos', 'eliminar');
  const canPurge = canModuleAction(session.user, 'grupos', 'eliminar');
  const isRoot = isRootUser(session.user);
  const isUnitAdmin = session.user?.role === 'unit_admin';
  const isZoneAdmin = session.user?.role === 'zone_admin';
  const isRegionScopeActor =
    session.user?.role === 'region_admin' || session.user?.role === 'root';
  const lockedUnitId =
    session.user?.adminScopeUnitId || session.user?.unitId || '';
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const orgRegions = useMemo(() => orgTree || [], [orgTree]);
  const orgZones = useMemo(() => {
    if (!regionId) return [];
    const region = orgRegions.find((r) => r.id === regionId);
    return region?.children || [];
  }, [orgRegions, regionId]);
  const selectedZoneId =
    zoneChoice && zoneChoice !== ALC_ALL_ZONES ? zoneChoice : '';
  const orgUnits = useMemo(() => {
    if (!selectedZoneId) return [];
    const zone = orgZones.find((z) => z.id === selectedZoneId);
    return zone?.children || [];
  }, [orgZones, selectedZoneId]);

  const editOrgZones = useMemo(() => {
    if (!editRegionId) return [];
    const region = orgRegions.find((r) => r.id === editRegionId);
    return region?.children || [];
  }, [orgRegions, editRegionId]);
  const editSelectedZoneId =
    editZoneChoice && editZoneChoice !== ALC_ALL_ZONES ? editZoneChoice : '';
  const editOrgUnits = useMemo(() => {
    if (!editSelectedZoneId) return [];
    const zone = editOrgZones.find((z) => z.id === editSelectedZoneId);
    return zone?.children || [];
  }, [editOrgZones, editSelectedZoneId]);

  const regionName = orgRegions.find((r) => r.id === regionId)?.name || 'la región';
  const zoneName = orgZones.find((z) => z.id === selectedZoneId)?.name || 'la zona';
  const allowAllZones = isRegionScopeActor;
  /** Zona visible tras elegir región (opcional) o fijada por zone/unit admin. */
  const showZoneStep = Boolean(regionId) || isUnitAdmin || isZoneAdmin;
  /** Unidad visible solo con zona concreta (opcional) o fijada por unit admin. */
  const showUnitStep =
    isUnitAdmin ||
    isZoneAdmin ||
    (Boolean(zoneChoice) && zoneChoice !== ALC_ALL_ZONES);
  /** Atajo «Todos» en unidad; también basta dejar Unidad en —. */
  const allowAllUnits = isRegionScopeActor || isZoneAdmin;

  const editShowZoneStep = Boolean(editRegionId) || isUnitAdmin || isZoneAdmin;
  const editShowUnitStep =
    isUnitAdmin ||
    isZoneAdmin ||
    (Boolean(editZoneChoice) && editZoneChoice !== ALC_ALL_ZONES);
  const editPreviewScope = useMemo(
    () =>
      resolveGroupScope({
        role: session.user?.role,
        regionId: editRegionId,
        zoneChoice: editZoneChoice,
        unitChoice: editUnitChoice,
        lockedUnitId,
      }),
    [session.user?.role, editRegionId, editZoneChoice, editUnitChoice, lockedUnitId]
  );

  const previewScope = useMemo(
    () =>
      resolveGroupScope({
        role: session.user?.role,
        regionId,
        zoneChoice,
        unitChoice,
        lockedUnitId,
      }),
    [session.user?.role, regionId, zoneChoice, unitChoice, lockedUnitId]
  );

  const assignableUsers = useMemo(() => {
    const actorRole = session.user?.role;
    const g = groups.find((x) => x.id === selectedGroupId);
    const already = new Set((members || []).map((m) => String(m.id)));
    return (users || []).filter((u) => {
      if (already.has(String(u.id))) return false;
      if (!actorCanPickMember(actorRole, u.role)) return false;
      if (selectedGroupId && !memberFitsGroupGeoClient(u, g, orgTree)) return false;
      return true;
    });
  }, [users, members, session.user?.role, selectedGroupId, groups, orgTree]);

  /** Candidatos a integrantes en el alta corta (alcance del árbol, sin grupo aún). */
  const createAssignableUsers = useMemo(() => {
    if (!createFromTree || !createOpen) return [];
    const draft = {
      scopeLevel: previewScope?.scopeLevel || 'unit',
      unitId: previewScope?.unitId || null,
    };
    if (previewScope?.error || previewScope?.hint) return [];
    const actorRole = session.user?.role;
    return (users || []).filter((u) => {
      if (!actorCanPickMember(actorRole, u.role)) return false;
      return memberFitsGroupGeoClient(u, draft, orgTree);
    });
  }, [
    createFromTree,
    createOpen,
    users,
    session.user?.role,
    orgTree,
    previewScope?.scopeLevel,
    previewScope?.unitId,
    previewScope?.error,
    previewScope?.hint,
  ]);

  const detailsDirty = useMemo(() => {
    if (!selectedGroup) return false;
    return (
      editName.trim() !== (selectedGroup.name || '').trim() ||
      editDescription.trim() !== (selectedGroup.description || '').trim()
    );
  }, [selectedGroup, editName, editDescription]);

  const colFilterOptions = useMemo(() => {
    const map = {};
    for (const col of GROUP_TABLE_COLS) {
      const set = new Set();
      for (const g of groups) {
        const v = getGroupColFilterVal(g, col.key);
        if (v != null && String(v).trim() !== '') set.add(v);
      }
      map[col.key] = [...set].sort((a, b) =>
        String(groupColFilterOptionLabel(col.key, a)).localeCompare(
          String(groupColFilterOptionLabel(col.key, b)),
          'es',
          { sensitivity: 'base', numeric: true }
        )
      );
    }
    return map;
  }, [groups]);

  const scopeFilterBuilt = useMemo(() => {
    const vals = colFilterOptions.scope || [];
    return buildScopeFilterTree(orgTree, vals);
  }, [orgTree, colFilterOptions.scope]);

  const scopeFilterTree = scopeFilterBuilt.tree;
  const scopeNameByValue = scopeFilterBuilt.nameByValue;

  const scopeOptionLabel = useMemo(
    () => (key, value) => groupColFilterOptionLabel(key, value, scopeNameByValue),
    [scopeNameByValue]
  );

  const filteredGroups = useMemo(() => {
    let list = groups;
    const q = filterQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => {
        const hay = [
          g.name,
          g.description,
          g.scopeLabel,
          g.unitName,
          formatStoredGroupScope(g),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    for (const [key, selected] of Object.entries(colFilters)) {
      if (!colFilterIsActive(selected)) continue;
      if (colFilterIsNone(selected)) {
        list = [];
        break;
      }
      const allow = new Set(selected);
      list = list.filter((g) => allow.has(getGroupColFilterVal(g, key)));
    }
    if (sortCol) {
      list = [...list].sort((a, b) =>
        compareSortValues(getGroupSortValue(a, sortCol), getGroupSortValue(b, sortCol), sortDir)
      );
    }
    return list;
  }, [groups, filterQuery, colFilters, sortCol, sortDir]);

  const groupsTreeRows = useMemo(
    () => buildGroupsTreeRows(orgTree, filteredGroups),
    [orgTree, filteredGroups]
  );

  const visibleTreeRows = useMemo(
    () => filterExpandedTreeRows(groupsTreeRows, expandedTreeFolders),
    [groupsTreeRows, expandedTreeFolders]
  );

  function toggleTreeFolder(folderId) {
    setExpandedTreeFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  /** Abre el alta de canal con alcance precargado en esa carpeta (modal corto). */
  function openCreateAtFolder(row) {
    if (!canAddGroup || !row || row.kind === 'other') return;
    if (row.kind === 'region') {
      setRegionId(row.regionId || row.nodeId);
      setZoneChoice(ALC_ALL_ZONES);
      setUnitChoice('');
    } else if (row.kind === 'zone' || row.kind === 'cg') {
      setRegionId(row.regionId || '');
      setZoneChoice(row.zoneId || row.nodeId);
      setUnitChoice(ALC_ALL_UNITS);
    } else if (row.kind === 'unit') {
      setRegionId(row.regionId || '');
      setZoneChoice(row.zoneId || '');
      setUnitChoice(row.unitId || row.nodeId);
    } else {
      return;
    }
    const kindLabel =
      row.kind === 'region'
        ? 'Región'
        : row.kind === 'cg'
          ? 'C.G.'
          : row.kind === 'zone'
            ? 'Zona'
            : row.kind === 'unit'
              ? 'Organismo'
              : '';
    setCreateTreeContext({
      kind: row.kind,
      kindLabel,
      label: row.label || '',
      nodeId: row.nodeId,
    });
    setCreateFromTree(true);
    setName('');
    setDescription('');
    setCreateMemberIds([]);
    setCreateMemberRole('member');
    setError('');
    setCreateOpen(true);
  }

  function openCreateFromToolbar() {
    setCreateFromTree(false);
    setCreateTreeContext(null);
    setName('');
    setDescription('');
    setCreateMemberIds([]);
    setCreateMemberRole('member');
    resetCreateCascade();
    setError('');
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (createBusy) return;
    setCreateOpen(false);
    setCreateFromTree(false);
    setCreateTreeContext(null);
    setName('');
    setDescription('');
    setCreateMemberIds([]);
    setCreateMemberRole('member');
    if (!isUnitAdmin && !isZoneAdmin) {
      setRegionId('');
      setZoneChoice('');
      setUnitChoice('');
    } else {
      applyOrgLocks(orgTree);
    }
    setError('');
  }

  function addCreateMemberFromSelect(userId) {
    const id = String(userId || '').trim();
    if (!id) return;
    setCreateMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeCreateMember(userId) {
    const id = String(userId);
    setCreateMemberIds((prev) => prev.filter((x) => x !== id));
  }

  function canAddChannelAtFolder(row) {
    if (!canAddGroup || !row || row.type !== 'folder') return false;
    if (row.kind === 'other') return false;
    const role = session.user?.role;
    if (role === 'root' || role === 'region_admin') return true;
    if (role === 'zone_admin') {
      if (row.kind === 'region') return false;
      if (row.kind === 'zone' || row.kind === 'cg') {
        return Boolean(lockedUnitId) && row.nodeId === lockedUnitId;
      }
      if (row.kind === 'unit') {
        return Boolean(lockedUnitId) && row.zoneId === lockedUnitId;
      }
      return false;
    }
    if (role === 'unit_admin') {
      return row.kind === 'unit' && Boolean(lockedUnitId) && row.nodeId === lockedUnitId;
    }
    return false;
  }

  function toggleColSort(key) {
    /* Un solo setState: no anidar setSortDir dentro de setSortCol
       (Strict Mode ejecuta el updater 2× y el ×-1×-1 deja el mismo sentido). */
    if (sortCol === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortCol(key);
      setSortDir(1);
    }
  }

  /** Clic en título → ordenar. No usa bandera de drag (el ⠿ es lo único arrastrable). */
  function onThTitleSortClick(e, key) {
    if (e.target.closest('.th-drag-icon')) return;
    e.stopPropagation();
    toggleColSort(key);
  }

  const activeColFilterCount = useMemo(
    () => Object.values(colFilters).filter((v) => colFilterIsActive(v)).length,
    [colFilters]
  );

  function setColFilter(key, selected) {
    setColFilters((prev) => {
      if (!colFilterIsActive(selected)) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: selected };
    });
  }

  useEffect(() => {
    if (!filtersVisible) setOpenFilterKey(null);
  }, [filtersVisible]);

  const visibleOrderedCols = useMemo(
    () => colConfig.filter((c) => c.visible !== false),
    [colConfig]
  );

  useEffect(() => {
    if (!colsOpen) return undefined;
    function onDocClick(e) {
      if (colsWrapRef.current && !colsWrapRef.current.contains(e.target)) {
        setColsOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [colsOpen]);

  function commitColConfig(next) {
    setColConfig(next);
    saveGroupColConfig(next);
  }

  function toggleColVisible(key) {
    commitColConfig(
      colConfig.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  }

  function moveCol(idx, dir) {
    const n = idx + dir;
    if (n < 0 || n >= colConfig.length) return;
    const next = colConfig.slice();
    [next[idx], next[n]] = [next[n], next[idx]];
    commitColConfig(next);
  }

  function resetColConfig() {
    commitColConfig(defaultGroupColConfig());
  }

  function onColDragStart(idx) {
    setColDragIdx(idx);
  }

  function onColDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  function onColDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onColDrop(e, idx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (colDragIdx === null || colDragIdx === idx) {
      setColDragIdx(null);
      return;
    }
    const next = colConfig.slice();
    const [moved] = next.splice(colDragIdx, 1);
    next.splice(idx, 0, moved);
    setColDragIdx(null);
    commitColConfig(next);
  }

  function onColDragEnd() {
    setColDragIdx(null);
  }

  function onThDragStart(e, key) {
    /* Como Parque Vehicular: dragstart solo al arrastrar de verdad; el clic limpio ordena. */
    thDidDragRef.current = true;
    thDragKeyRef.current = key;
    setThDragKey(key);
    setThDragOverKey(null);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', key);
    } catch {
      /* ignore */
    }
  }

  function onThDragEnd() {
    thDragKeyRef.current = null;
    setThDragKey(null);
    setThDragOverKey(null);
    /* PV: liberar bandera tras el click sintético post-drag */
    window.setTimeout(() => {
      thDidDragRef.current = false;
    }, 80);
  }

  function onThDragOver(e, key) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setThDragOverKey((prev) => (prev === key ? prev : key));
  }

  function onThDragLeave(key) {
    setThDragOverKey((prev) => (prev === key ? null : prev));
  }

  function onThDrop(e, dstKey) {
    e.preventDefault();
    const srcKey = thDragKeyRef.current || thDragKey;
    thDragKeyRef.current = null;
    setThDragKey(null);
    setThDragOverKey(null);
    if (!srcKey || srcKey === dstKey) return;
    const si = colConfig.findIndex((c) => c.key === srcKey);
    const di = colConfig.findIndex((c) => c.key === dstKey);
    if (si < 0 || di < 0) return;
    const next = colConfig.slice();
    const [moved] = next.splice(si, 1);
    next.splice(di, 0, moved);
    commitColConfig(next);
  }

  function closeDrawer() {
    setPhotoPreviewOpen(false);
    setSelectedGroupId('');
    setScopeEditOpen(false);
    setError('');
  }

  function openGroup(id) {
    setSelectedGroupId(id);
    setScopeEditOpen(false);
  }

  function applyOrgLocks(tree) {
    if (isUnitAdmin && lockedUnitId) {
      const path = findOrgPath(tree, lockedUnitId, lockedUnitId);
      setRegionId(path.regionId || '');
      setZoneChoice(path.zoneId || '');
      setUnitChoice(path.unitId || lockedUnitId);
      return;
    }
    if (isZoneAdmin && lockedUnitId) {
      const path = findOrgPath(tree, lockedUnitId, lockedUnitId);
      setRegionId(path.regionId || '');
      setZoneChoice(path.zoneId || '');
      setUnitChoice('');
    }
  }

  async function reload() {
    const [g, u, org] = await Promise.all([
      fetchAdminGroups(session.token),
      fetchAdminUsers(session.token),
      fetchOrgUnits(session.token).catch(() => ({ tree: [] })),
    ]);
    const tree = org.tree || org.units || [];
    setGroups(g.groups || []);
    setUsers(u.users || []);
    setOrgTree(tree);
    applyOrgLocks(tree);
  }

  async function loadMembers(groupId) {
    if (!groupId) {
      setMembers([]);
      return;
    }
    const data = await fetchAdminGroupMembers(session.token, groupId);
    setMembers(data.members || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  useEffect(() => {
    loadMembers(selectedGroupId).catch((e) => setError(e.message));
  }, [selectedGroupId, session.token]);

  useEffect(() => {
    if (!selectedGroup) {
      setEditName('');
      setEditDescription('');
      setAssignUserId('');
      setAssignRole('member');
      return;
    }
    setEditName(selectedGroup.name || '');
    setEditDescription(selectedGroup.description || '');
    setAssignUserId('');
    setAssignRole('member');
  }, [selectedGroupId, selectedGroup?.id, selectedGroup?.name, selectedGroup?.description]);

  useEffect(() => {
    if (!selectedGroupId || !orgTree?.length) {
      setEditRegionId('');
      setEditZoneChoice('');
      setEditUnitChoice('');
      setScopeEditOpen(false);
      return;
    }
    const g = groups.find((x) => x.id === selectedGroupId);
    if (!g) return;
    setScopeEditOpen(groupScopeNeedsFix(g));
    if (isUnitAdmin && lockedUnitId) {
      const path = findOrgPath(orgTree, lockedUnitId, lockedUnitId);
      setEditRegionId(path.regionId || '');
      setEditZoneChoice(path.zoneId || '');
      setEditUnitChoice(path.unitId || lockedUnitId);
      return;
    }
    if (isZoneAdmin && lockedUnitId) {
      const path = findOrgPath(orgTree, lockedUnitId, lockedUnitId);
      const hydrated = hydrateGroupScopeChoices(g, orgTree);
      setEditRegionId(path.regionId || hydrated.regionId || '');
      setEditZoneChoice(path.zoneId || hydrated.zoneChoice || '');
      setEditUnitChoice(hydrated.unitChoice || '');
      return;
    }
    const hydrated = hydrateGroupScopeChoices(g, orgTree);
    setEditRegionId(hydrated.regionId);
    setEditZoneChoice(hydrated.zoneChoice);
    setEditUnitChoice(hydrated.unitChoice);
  }, [selectedGroupId, groups, orgTree, isUnitAdmin, isZoneAdmin, lockedUnitId]);

  useEffect(() => {
    if (!selectedGroupId) return undefined;

    function isTypingTarget(el) {
      if (!el || !(el instanceof Element)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
    }

    function onKey(e) {
      if (dialog) return;
      if (createOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeCreateModal();
        }
        return;
      }
      if (photoPreviewOpen) {
        if (e.key === 'Escape') setPhotoPreviewOpen(false);
        return;
      }

      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (isTypingTarget(e.target)) return;

      const list = filteredGroups;
      if (!list.length) return;
      const idx = list.findIndex((g) => g.id === selectedGroupId);
      if (idx < 0) return;
      const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= list.length) return;

      e.preventDefault();
      const nextId = list[nextIdx].id;
      openGroup(nextId);
      requestAnimationFrame(() => {
        document
          .querySelector('.cc-groups-table-row.is-selected')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }

    function onDocDown(e) {
      if (createOpen || dialog || photoPreviewOpen) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.cc-groups-drawer')) return;
      /* Tabla + scrollbar del body de admin: no cerrar */
      if (t.closest('.cc-catalogs-body, .cc-groups-page, .cc-groups-table-wrap')) return;
      if (t.closest('.usr-th-filter-multi-menu')) return;
      if (t.closest('.sys-modal, .sys-modal-backdrop')) return;
      if (t.closest('.cc-group-photo-lightbox')) return;
      /* Rail de módulos: no cerrar (Contraer menú sigue ok). */
      if (t.closest('#cc-mod-rail, .cc-mod-rail')) return;
      closeDrawer();
    }

    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [
    selectedGroupId,
    createOpen,
    dialog,
    photoPreviewOpen,
    filteredGroups,
  ]);

  useEffect(() => {
    setPhotoPreviewOpen(false);
  }, [selectedGroupId]);

  /* Empuja topbar + radio + contenido: el drawer es fixed y tapa la derecha del shell */
  useEffect(() => {
    const shell = document.querySelector('.cc-shell');
    if (!shell) return undefined;
    if (selectedGroupId) shell.classList.add('cc-groups-drawer-open');
    else shell.classList.remove('cc-groups-drawer-open');
    return () => shell.classList.remove('cc-groups-drawer-open');
  }, [selectedGroupId]);

  function resetCreateCascade() {
    if (isUnitAdmin) {
      applyOrgLocks(orgTree);
      return;
    }
    if (isZoneAdmin) {
      applyOrgLocks(orgTree);
      return;
    }
    setRegionId('');
    setZoneChoice('');
    setUnitChoice('');
  }

  async function onCreate(e) {
    e.preventDefault();
    if (createBusy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre del canal es obligatorio.');
      return;
    }
    try {
      const resolved = resolveGroupScope({
        role: session.user?.role,
        regionId,
        zoneChoice,
        unitChoice,
        lockedUnitId,
      });
      if (resolved.error) {
        setError(resolved.error);
        return;
      }
      if (resolved.hint) {
        setError(resolved.hint);
        return;
      }
      setCreateBusy(true);
      const created = await createGroup(session.token, {
        name: trimmedName,
        description: description.trim() || undefined,
        unitId: resolved.unitId,
        scopeLevel: resolved.scopeLevel,
      });
      const newId = created?.group?.id;

      let memberWarn = '';
      if (newId && createFromTree && createMemberIds.length) {
        const fails = [];
        for (const uid of createMemberIds) {
          try {
            await addGroupMember(session.token, newId, uid, createMemberRole || 'member');
          } catch (err) {
            fails.push(err?.message || String(uid));
          }
        }
        if (fails.length) {
          memberWarn = `Canal creado; ${fails.length} integrante(s) no se pudieron agregar.`;
        }
      }

      setName('');
      setDescription('');
      setCreateMemberIds([]);
      setCreateMemberRole('member');
      setCreateFromTree(false);
      setCreateTreeContext(null);
      resetCreateCascade();
      await reload();
      if (newId) {
        setSelectedGroupId(newId);
        setCreateOpen(false);
      }
      setError(memberWarn || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateBusy(false);
    }
  }

  async function onSaveGroupScope(e) {
    e?.preventDefault?.();
    if (!selectedGroupId) return;
    const resolved = resolveGroupScope({
      role: session.user?.role,
      regionId: editRegionId,
      zoneChoice: editZoneChoice,
      unitChoice: editUnitChoice,
      lockedUnitId,
    });
    if (resolved.error) {
      setError(resolved.error);
      return;
    }
    if (resolved.hint) {
      setError(resolved.hint);
      return;
    }
    setScopeBusy(true);
    try {
      await patchAdminGroup(session.token, selectedGroupId, {
        unitId: resolved.unitId,
        scopeLevel: resolved.scopeLevel,
      });
      await reload();
      setScopeEditOpen(false);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setScopeBusy(false);
    }
  }

  async function onSaveGroupDetails(e) {
    e?.preventDefault?.();
    if (!selectedGroupId || !editName.trim()) {
      setError('El nombre del canal es obligatorio.');
      return;
    }
    setDetailsBusy(true);
    try {
      await patchAdminGroup(session.token, selectedGroupId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailsBusy(false);
    }
  }

  async function onAssignMember(e) {
    e.preventDefault();
    if (!selectedGroupId || !assignUserId) return;
    try {
      await addGroupMember(session.token, selectedGroupId, assignUserId, assignRole);
      setAssignUserId('');
      setAssignRole('member');
      await reload();
      await loadMembers(selectedGroupId);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onChangeMemberRole(userId, nextRole) {
    if (!selectedGroupId || !userId || !nextRole) return;
    const prev = members.find((m) => m.id === userId)?.role;
    if (prev === nextRole) return;
    setRoleBusyId(userId);
    setMembers((list) => list.map((m) => (m.id === userId ? { ...m, role: nextRole } : m)));
    try {
      await patchGroupMember(session.token, selectedGroupId, userId, nextRole);
      setError('');
    } catch (err) {
      setMembers((list) => list.map((m) => (m.id === userId ? { ...m, role: prev } : m)));
      setError(err.message);
    } finally {
      setRoleBusyId('');
    }
  }

  async function onAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await uploadGroupAvatar(session.token, selectedGroupId, file);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await deleteGroupAvatar(session.token, selectedGroupId);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function closeDialog() {
    if (dialogBusy) return;
    setDialog(null);
  }

  function askConfirm({ title, message, confirmLabel, danger, run }) {
    setDialog({
      title,
      message,
      confirmLabel,
      danger: Boolean(danger),
      alertOnly: false,
      run,
    });
  }

  async function runDialogAction() {
    if (!dialog?.run) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    try {
      const next = await dialog.run();
      if (next?.alert) {
        setDialog({
          title: next.alert.title || 'Aviso',
          message: next.alert.message,
          confirmLabel: next.alert.confirmLabel || 'Entendido',
          danger: false,
          alertOnly: true,
          run: async () => {},
        });
      } else {
        setDialog(null);
      }
      setError('');
    } catch (err) {
      setDialog(null);
      setError(err.message);
    } finally {
      setDialogBusy(false);
    }
  }

  function deactivateGroup(g) {
    askConfirm({
      title: 'Desactivar grupo',
      message: `¿Desactivar el grupo «${g.name}»?`,
      confirmLabel: 'Desactivar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: false });
        await reload();
      },
    });
  }

  function hardDeleteGroup(g) {
    askConfirm({
      title: 'Eliminar permanentemente',
      message: `¿Eliminar permanentemente «${g.name}» y todo su historial de chat?`,
      confirmLabel: 'Eliminar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: true });
        if (selectedGroupId === g.id) setSelectedGroupId('');
        await reload();
      },
    });
  }

  async function reactivateGroup(g) {
    try {
      await patchAdminGroup(session.token, g.id, { isActive: true });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function purgeChat(g) {
    askConfirm({
      title: 'Vaciar chat',
      message: `¿Vaciar todos los mensajes del chat «${g.name}»?`,
      confirmLabel: 'Vaciar',
      danger: true,
      run: async () => {
        const r = await purgeGroupMessages(session.token, g.id);
        return {
          alert: {
            title: 'Chat vaciado',
            message: `Mensajes eliminados: ${r.deleted ?? 0}`,
          },
        };
      },
    });
  }

  function kickMember(userId) {
    if (!selectedGroupId) return;
    askConfirm({
      title: 'Quitar miembro',
      message: '¿Quitar a este miembro del grupo?',
      confirmLabel: 'Quitar',
      danger: true,
      run: async () => {
        await removeGroupMember(session.token, selectedGroupId, userId);
        await loadMembers(selectedGroupId);
        await reload();
      },
    });
  }

  function renderScopeEditor() {
    if (!canManage || !selectedGroup) return null;
    const g = selectedGroup;
    return (
      <section
        className={`cc-group-detail-section cc-group-detail-section--scope cc-group-scope-panel${groupScopeNeedsFix(g) ? ' is-warn' : ''}${scopeEditOpen ? ' is-editing' : ''}`}
      >
        <div className="cc-group-detail-section-head">
          <h3>Alcance territorial</h3>
          {!scopeEditOpen ? (
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => setScopeEditOpen(true)}>
              Cambiar
            </button>
          ) : (
            <button
              type="button"
              className="cc-btn ghost cc-btn-sm"
              disabled={scopeBusy}
              onClick={() => {
                const hydrated = hydrateGroupScopeChoices(g, orgTree);
                if (isUnitAdmin && lockedUnitId) {
                  const path = findOrgPath(orgTree, lockedUnitId, lockedUnitId);
                  setEditRegionId(path.regionId || '');
                  setEditZoneChoice(path.zoneId || '');
                  setEditUnitChoice(path.unitId || lockedUnitId);
                } else if (isZoneAdmin && lockedUnitId) {
                  const path = findOrgPath(orgTree, lockedUnitId, lockedUnitId);
                  setEditRegionId(path.regionId || hydrated.regionId || '');
                  setEditZoneChoice(path.zoneId || hydrated.zoneChoice || '');
                  setEditUnitChoice(hydrated.unitChoice || '');
                } else {
                  setEditRegionId(hydrated.regionId);
                  setEditZoneChoice(hydrated.zoneChoice);
                  setEditUnitChoice(hydrated.unitChoice);
                }
                setScopeEditOpen(groupScopeNeedsFix(g));
                setError('');
              }}
            >
              Cerrar
            </button>
          )}
        </div>
        <p className="cc-group-scope-value">{formatStoredGroupScope(g)}</p>
        {groupScopeNeedsFix(g) ? (
          <p className="cc-group-scope-now-note">Incompleto: falta región, zona o unidad ancla.</p>
        ) : null}
        {scopeEditOpen && (
          <form className="cc-group-scope-edit" onSubmit={onSaveGroupScope}>
            <p className="cc-group-scope-edit-lead">Nuevo alcance (sustituye el actual al guardar)</p>
            <div className="cc-group-scope-fields">
              <label className="cc-group-scope-field">
                <span>Región</span>
                <select
                  value={editRegionId}
                  disabled={isUnitAdmin || isZoneAdmin || scopeBusy}
                  required
                  onChange={(e) => {
                    setEditRegionId(e.target.value);
                    setEditZoneChoice('');
                    setEditUnitChoice('');
                  }}
                >
                  <option value="">—</option>
                  {orgRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
              {editShowZoneStep && (
                <label className="cc-group-scope-field">
                  <span>Zona / C.G.{isUnitAdmin || isZoneAdmin ? '' : ' (opc.)'}</span>
                  <select
                    value={editZoneChoice}
                    disabled={isUnitAdmin || isZoneAdmin || !editRegionId || scopeBusy}
                    onChange={(e) => {
                      setEditZoneChoice(e.target.value);
                      setEditUnitChoice('');
                    }}
                  >
                    <option value="">—</option>
                    {allowAllZones ? (
                  <option value={ALC_ALL_ZONES}>Todas las zonas y unidades (toda la región)</option>
                    ) : null}
                    {editOrgZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {editShowUnitStep && (
                <label className="cc-group-scope-field">
                  <span>Unidad{isUnitAdmin ? ' *' : ' (opc.)'}</span>
                  <select
                    value={editUnitChoice}
                    disabled={isUnitAdmin || !editSelectedZoneId || scopeBusy}
                    required={isUnitAdmin}
                    onChange={(e) => setEditUnitChoice(e.target.value)}
                  >
                    <option value="">—</option>
                    {allowAllUnits ? (
                      <option value={ALC_ALL_UNITS}>Todas las unidades (toda la zona)</option>
                    ) : null}
                    {editOrgUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {editPreviewScope?.error ? (
              <p className="cc-group-scope-msg is-err">{editPreviewScope.error}</p>
            ) : editPreviewScope?.hint ? (
              <p className="cc-group-scope-msg">{editPreviewScope.hint}</p>
            ) : (
              <p className="cc-group-scope-msg is-ok">
                Quedará:{' '}
                {editPreviewScope.scopeLevel === 'region'
                  ? 'canal de región'
                  : editPreviewScope.scopeLevel === 'zone'
                    ? 'canal de zona'
                    : 'canal de unidad'}
              </p>
            )}
            <div className="cc-group-scope-actions">
              <button
                type="submit"
                className="cc-btn primary cc-btn-sm"
                disabled={scopeBusy || Boolean(editPreviewScope?.error || editPreviewScope?.hint)}
              >
                {scopeBusy ? 'Guardando…' : 'Guardar alcance'}
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  function renderNewChannelFields() {
    if (createFromTree) {
      const ctx = createTreeContext;
      const scopeOk = !previewScope?.error && !previewScope?.hint;
      const levelWord =
        previewScope?.scopeLevel === 'region'
          ? 'región'
          : previewScope?.scopeLevel === 'zone'
            ? 'zona'
            : 'organismo';
      return (
        <>
          <p className="cc-groups-create-context-line" role="status">
            <span className="muted">En</span>{' '}
            <strong>
              {ctx?.kindLabel ? `${ctx.kindLabel} · ` : ''}
              {ctx?.label || '—'}
            </strong>
            {scopeOk ? (
              <span className="muted"> · canal de {levelWord}</span>
            ) : (
              <span className="error"> · {previewScope?.error || previewScope?.hint || 'alcance no válido'}</span>
            )}
          </p>
          <label className="cc-groups-field">
            <span>Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={createBusy}
              placeholder="Nombre del canal"
            />
          </label>
          <label className="cc-groups-field">
            <span>Descripción</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createBusy}
              placeholder="Opcional"
            />
          </label>
          <div className="cc-groups-field cc-groups-create-members cc-groups-create-members--compact">
            <span className="cc-groups-create-members-title">Integrantes (opcional)</span>
            <div className="cc-groups-create-members-add">
              <select
                value=""
                disabled={createBusy || !scopeOk || createAssignableUsers.length === 0}
                aria-label="Agregar persona"
                onChange={(e) => {
                  addCreateMemberFromSelect(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">
                  {!scopeOk
                    ? 'Alcance no válido'
                    : createAssignableUsers.length === 0
                      ? 'Sin personas elegibles'
                      : 'Agregar persona…'}
                </option>
                {createAssignableUsers
                  .filter((u) => !createMemberIds.includes(String(u.id)))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {memberAssignLabel(u)}
                    </option>
                  ))}
              </select>
              <select
                value={createMemberRole}
                onChange={(e) => setCreateMemberRole(e.target.value)}
                disabled={createBusy || createMemberIds.length === 0}
                aria-label="Rol"
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {createMemberIds.length > 0 ? (
              <ul className="cc-groups-create-member-chips">
                {createMemberIds.map((id) => {
                  const u = users.find((x) => String(x.id) === id);
                  const label = u
                    ? u.displayName || u.fullName || u.username || id
                    : id;
                  return (
                    <li key={id}>
                      <span>{label}</span>
                      <button
                        type="button"
                        className="cc-groups-create-member-chip-x"
                        disabled={createBusy}
                        aria-label={`Quitar ${label}`}
                        onClick={() => removeCreateMember(id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="cc-hint cc-groups-create-members-hint">
                Opcional — también puedes agregarlos después en el panel.
              </p>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        <label className="cc-groups-field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={createBusy} />
        </label>
        <label className="cc-groups-field">
          <span>Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={createBusy}
            placeholder="Opcional — visible en el listado"
          />
        </label>
        <div className="cc-groups-field cc-groups-scope">
          <span className="cc-groups-scope-title">Alcance</span>
          <p className="cc-hint" style={{ margin: '0 0 0.65rem' }}>
            {groupScopeHelp(session.user?.role)}
          </p>
          <div className="cc-form-grid cc-form-grid--3">
            <label className="field">
              <span>Región{isRegionScopeActor || isZoneAdmin || isUnitAdmin ? ' *' : ''}</span>
              <select
                value={regionId}
                disabled={createBusy || isUnitAdmin || isZoneAdmin}
                required={isRegionScopeActor || isZoneAdmin || isUnitAdmin}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  setZoneChoice('');
                  setUnitChoice('');
                }}
              >
                <option value="">—</option>
                {orgRegions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            {showZoneStep && (
              <label className="field">
                <span>Zona / C.G.{isUnitAdmin || isZoneAdmin ? '' : ' (opc.)'}</span>
                <select
                  value={zoneChoice}
                  disabled={createBusy || isUnitAdmin || isZoneAdmin || !regionId}
                  onChange={(e) => {
                    setZoneChoice(e.target.value);
                    setUnitChoice('');
                  }}
                >
                  <option value="">—</option>
                  {allowAllZones ? (
                    <option value={ALC_ALL_ZONES}>Todas las zonas y unidades ({regionName})</option>
                  ) : null}
                  {orgZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {showUnitStep && (
              <label className="field">
                <span>Unidad{isUnitAdmin ? ' *' : ' (opc.)'}</span>
                <select
                  value={unitChoice}
                  disabled={createBusy || isUnitAdmin || !selectedZoneId}
                  required={isUnitAdmin}
                  onChange={(e) => setUnitChoice(e.target.value)}
                >
                  <option value="">—</option>
                  {allowAllUnits && !isUnitAdmin ? (
                    <option value={ALC_ALL_UNITS}>Todas las unidades ({zoneName})</option>
                  ) : null}
                  {orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="cc-hint cc-groups-scope-preview">
            {previewScope.error ? (
              <span className="error">{previewScope.error}</span>
            ) : previewScope.hint ? (
              <span>{previewScope.hint}</span>
            ) : (
              <>
                Canal de{' '}
                <strong>
                  {previewScope.scopeLevel === 'region'
                    ? 'región'
                    : previewScope.scopeLevel === 'zone'
                      ? 'zona'
                      : 'unidad'}
                </strong>
                . {groupScopeLevelExplain(previewScope.scopeLevel)}
              </>
            )}
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="dispatch-page cc-groups-page" style={stickyPageStyle}>
      <header ref={toolbarRef} className="cc-groups-toolbar">
        <div className="cc-groups-toolbar-start">
          <h1>Grupos y canales</h1>
          <span className="cc-groups-toolbar-count">{filteredGroups.length} de {groups.length}</span>
        </div>
        <div className="cc-groups-toolbar-end">
          <label className="cc-groups-search">
            <span className="visually-hidden">Buscar</span>
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Buscar…"
            />
          </label>
          <div className="cc-groups-toolbar-actions">
            <div className="usr-table-tools">
              <button
                type="button"
                className={`usr-btn-filters${filtersVisible ? ' active' : ''}`}
                title={filtersVisible ? 'Quitar filtros' : 'Mostrar filtros'}
                onClick={(e) => {
                  e.stopPropagation();
                  setFiltersVisible((v) => {
                    if (v) {
                      setColFilters({});
                      setOpenFilterKey(null);
                      return false;
                    }
                    return true;
                  });
                }}
              >
                {FILTER_BTN_SVG}
                Filtros
                {activeColFilterCount > 0 && (
                  <span className="usr-btn-filters-badge" aria-hidden="true">
                    {activeColFilterCount}
                  </span>
                )}
              </button>
              <div className="usr-col-panel-wrap" ref={colsWrapRef}>
                <button
                  type="button"
                  className={`usr-btn-cols${colsOpen ? ' active' : ''}`}
                  title="Mostrar/ocultar columnas"
                  onClick={(e) => {
                    e.stopPropagation();
                    setColsOpen((v) => !v);
                  }}
                >
                  {COLS_BTN_SVG}
                  Columnas
                </button>
                {colsOpen && (
                  <div className="usr-col-panel open" role="dialog" aria-label="Columnas visibles">
                    <div className="usr-col-panel-header">
                      <span>Columnas</span>
                      <button type="button" className="usr-col-panel-reset" onClick={resetColConfig}>
                        ↺ Restablecer
                      </button>
                    </div>
                    <div className="usr-col-panel-list">
                      {colConfig.map((col, idx) => (
                        <div
                          key={col.key}
                          className={`usr-col-panel-item${colDragIdx === idx ? ' dragging' : ''}`}
                          draggable
                          onDragStart={() => onColDragStart(idx)}
                          onDragEnd={onColDragEnd}
                          onDragOver={onColDragOver}
                          onDragLeave={onColDragLeave}
                          onDrop={(e) => onColDrop(e, idx)}
                        >
                          <span className="usr-col-drag-handle" title="Arrastra para reordenar">⠿</span>
                          <label className="usr-col-panel-label" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={col.visible !== false}
                              onChange={() => toggleColVisible(col.key)}
                            />
                            <span>{col.label}</span>
                          </label>
                          <div className="usr-col-panel-arrows">
                            <button
                              type="button"
                              title="Subir"
                              disabled={idx === 0}
                              onClick={(e) => { e.stopPropagation(); moveCol(idx, -1); }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Bajar"
                              disabled={idx === colConfig.length - 1}
                              onClick={(e) => { e.stopPropagation(); moveCol(idx, 1); }}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {canAddGroup ? (
              <span className="cc-groups-new-channel-wrap">
                <svg
                  className="cc-groups-new-channel-beam"
                  viewBox="0 0 100 36"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <rect
                    className="cc-groups-new-channel-beam-base"
                    x="1.25"
                    y="1.25"
                    width="97.5"
                    height="33.5"
                    rx="16.75"
                    ry="16.75"
                    pathLength="100"
                  />
                  {/* Cola → medio → punta: difuminado por partes a lo largo de cada luz */}
                  <rect
                    className="cc-groups-new-channel-beam-run cc-groups-new-channel-beam-run--tail"
                    x="1.25"
                    y="1.25"
                    width="97.5"
                    height="33.5"
                    rx="16.75"
                    ry="16.75"
                    pathLength="100"
                  />
                  <rect
                    className="cc-groups-new-channel-beam-run cc-groups-new-channel-beam-run--mid"
                    x="1.25"
                    y="1.25"
                    width="97.5"
                    height="33.5"
                    rx="16.75"
                    ry="16.75"
                    pathLength="100"
                  />
                  <rect
                    className="cc-groups-new-channel-beam-run cc-groups-new-channel-beam-run--tip"
                    x="1.25"
                    y="1.25"
                    width="97.5"
                    height="33.5"
                    rx="16.75"
                    ry="16.75"
                    pathLength="100"
                  />
                </svg>
                <button
                  type="button"
                  className="cc-btn primary cc-btn-sm cc-groups-new-channel-btn"
                  onClick={openCreateFromToolbar}
                >
                  {NEW_CHANNEL_BTN_SVG}
                  Nuevo canal
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {error && !selectedGroupId ? <p className="error cc-groups-page-error">{error}</p> : null}

      <div className="usr-table-wrap cc-groups-table-wrap">
        <table className="usr-users-table cc-groups-table">
          <thead>
            <tr>
              {visibleOrderedCols.map((c) => (
                <th
                  key={c.key}
                  className={[
                    GROUP_COL_CLASS[c.key] || '',
                    'th-draggable',
                    'th-sortable',
                    thDragKey === c.key ? 'th-dragging' : '',
                    thDragOverKey === c.key ? 'th-drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-col-key={c.key}
                  data-sort-title="Arrastra para mover · Clic para ordenar"
                  title="Arrastra para mover · Clic para ordenar"
                  onDragOver={(e) => onThDragOver(e, c.key)}
                  onDragLeave={() => onThDragLeave(c.key)}
                  onDrop={(e) => onThDrop(e, c.key)}
                >
                  <div className={`usr-th-stack${filtersVisible ? '' : ' filters-hidden'}`}>
                    <div
                      className="usr-th-title-row usr-th-title-row--sortable"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => onThTitleSortClick(e, c.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onThTitleSortClick(e, c.key);
                        }
                      }}
                    >
                      <span
                        className="th-drag-icon"
                        draggable
                        title="Arrastra para mover la columna"
                        aria-label="Arrastra para mover la columna"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          onThDragStart(e, c.key);
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          onThDragEnd();
                        }}
                      >
                        ⠿
                      </span>
                      <span className="th-col-label">{c.label}</span>
                      {sortCol === c.key ? (
                        <span className="th-sort-indicator" aria-hidden="true">
                          {sortDir === 1 ? '▲' : '▼'}
                        </span>
                      ) : null}
                    </div>
                    {filtersVisible && (
                      <ThFilterMulti
                        colKey={c.key}
                        colLabel={c.label}
                        options={colFilterOptions[c.key] || []}
                        optionTree={c.key === 'scope' ? scopeFilterTree : null}
                        selected={colFilters[c.key]}
                        open={openFilterKey === c.key}
                        onOpenChange={(next) =>
                          setOpenFilterKey(next ? c.key : null)
                        }
                        onChange={(sel) => setColFilter(c.key, sel)}
                        optionLabel={c.key === 'scope' ? scopeOptionLabel : groupColFilterOptionLabel}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupsTreeRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, visibleOrderedCols.length)} className="muted cc-groups-table-empty">
                  {groups.length === 0 && !(orgTree || []).length
                    ? 'Sin estructura orgánica ni canales. Crea dependencias o un canal con «Nuevo canal».'
                    : groups.length === 0
                      ? 'Sin canales. Usa «+ Agregar canal» en una carpeta o «Nuevo canal».'
                      : 'Ningún canal coincide con la búsqueda o filtros.'}
                </td>
              </tr>
            ) : (
              visibleTreeRows.map((row) => {
                if (row.type === 'folder') {
                  const expanded = expandedTreeFolders.has(row.id);
                  const kindLabel =
                    row.kind === 'region'
                      ? 'Región'
                      : row.kind === 'cg'
                        ? 'C.G.'
                        : row.kind === 'zone'
                          ? 'Zona'
                          : row.kind === 'unit'
                            ? 'Organismo'
                            : '';
                  const showAdd = canAddChannelAtFolder(row);
                  return (
                    <tr
                      key={row.id}
                      className={`cc-groups-tree-folder cc-groups-tree-folder--${row.kind || 'other'}`}
                      data-depth={row.depth}
                    >
                      <td colSpan={Math.max(1, visibleOrderedCols.length)}>
                        <div
                          className="cc-groups-tree-folder-bar"
                          style={{ paddingLeft: `${0.25 + row.depth * 1.05}rem` }}
                        >
                          <button
                            type="button"
                            className="cc-groups-tree-toggle"
                            aria-expanded={expanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTreeFolder(row.id);
                            }}
                          >
                            <span className="cc-groups-tree-chevron" aria-hidden="true">
                              {expanded ? '▼' : '▶'}
                            </span>
                            {kindLabel ? (
                              <span className="cc-groups-tree-kind">{kindLabel}</span>
                            ) : null}
                            <strong className="cc-groups-tree-label">{row.label}</strong>
                            <span className="cc-groups-tree-count">
                              {row.channelCount} canal{row.channelCount === 1 ? '' : 'es'}
                            </span>
                          </button>
                          {showAdd ? (
                            <button
                              type="button"
                              className="cc-groups-tree-add"
                              title={`Agregar canal en ${row.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateAtFolder(row);
                              }}
                            >
                              <span className="cc-groups-tree-add-ico" aria-hidden="true">
                                +
                              </span>
                              Agregar canal
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }

                const g = row.group;
                const isSelected = selectedGroupId === g.id;
                return (
                  <tr
                    key={row.id}
                    className={`cc-groups-table-row cc-groups-tree-channel${isSelected ? ' is-selected' : ''}${!g.is_active ? ' is-inactive' : ''}`}
                    data-depth={row.depth}
                    onClick={() => openGroup(g.id)}
                  >
                    {visibleOrderedCols.map((c, colIdx) => (
                      <td
                        key={c.key}
                        className={GROUP_COL_CLASS[c.key] || undefined}
                        style={
                          colIdx === 0
                            ? { paddingLeft: `${0.75 + row.depth * 1.05}rem` }
                            : undefined
                        }
                      >
                        {groupTableCell(g, c.key, session)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {filteredGroups.length > 0 ? (
          <div className="usr-pager">
            <span className="usr-pager-info">
              {filteredGroups.length} canal{filteredGroups.length === 1 ? '' : 'es'} en el árbol
              {filteredGroups.length !== groups.length
                ? ` · ${groups.length} en total`
                : ''}
            </span>
          </div>
        ) : null}
      </div>

      {canAddGroup && createOpen
        ? createPortal(
            <div
              className="sys-modal-backdrop"
              role="presentation"
              onClick={closeCreateModal}
            >
              <div
                className={`sys-modal ${createFromTree ? 'sys-modal--sm' : 'sys-modal--lg'} cc-groups-create-modal${createFromTree ? ' cc-groups-create-modal--tree' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cc-groups-create-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="sys-modal-head">
                  <h2 id="cc-groups-create-title">
                    {createFromTree ? 'Agregar canal' : 'Nuevo canal'}
                  </h2>
                  <button
                    type="button"
                    className="sys-modal-x"
                    aria-label="Cerrar"
                    disabled={createBusy}
                    onClick={closeCreateModal}
                  >
                    ×
                  </button>
                </header>
                <form
                  className="sys-modal-body cc-groups-create-form"
                  onSubmit={(e) => {
                    onCreate(e);
                  }}
                >
                  {error ? <p className="error">{error}</p> : null}
                  {renderNewChannelFields()}
                  <footer className="sys-modal-actions">
                    <button
                      type="button"
                      className="cc-btn ghost"
                      disabled={createBusy}
                      onClick={closeCreateModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="cc-btn primary"
                      disabled={
                        createBusy ||
                        !name.trim() ||
                        Boolean(previewScope?.error || previewScope?.hint)
                      }
                    >
                      {createBusy
                        ? 'Creando…'
                        : createFromTree && createMemberIds.length
                          ? `Crear canal (+${createMemberIds.length})`
                          : 'Crear canal'}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}

      {selectedGroup
        ? createPortal(
            <aside
                className="cc-groups-drawer"
                role="dialog"
                aria-modal="false"
                aria-label={`Editar ${selectedGroup.name}`}
              >
                <header className="cc-groups-drawer-head">
                  <div className="cc-groups-drawer-head-avatar">
                    {selectedGroup.avatarUrl ? (
                      <button
                        type="button"
                        className="cc-groups-drawer-avatar-btn"
                        title="Ver foto"
                        aria-label={`Ver foto de ${selectedGroup.name}`}
                        onClick={() => setPhotoPreviewOpen(true)}
                      >
                        <PersonAvatar
                          groupId={selectedGroup.id}
                          avatarUrl={selectedGroup.avatarUrl}
                          name={selectedGroup.name}
                          token={session.token}
                          group
                          className="cc-group-avatar cc-group-avatar--drawer"
                        />
                      </button>
                    ) : (
                      <PersonAvatar
                        groupId={selectedGroup.id}
                        avatarUrl={selectedGroup.avatarUrl}
                        name={selectedGroup.name}
                        token={session.token}
                        group
                        className="cc-group-avatar cc-group-avatar--drawer"
                      />
                    )}
                    {canManage ? (
                      <div className="cc-groups-drawer-photo">
                        <label className="cc-group-avatar-link">
                          {avatarBusy ? '…' : 'Cambiar foto'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            hidden
                            disabled={avatarBusy}
                            onChange={onAvatarFile}
                          />
                        </label>
                        {selectedGroup.avatarUrl ? (
                          <button
                            type="button"
                            className="cc-group-avatar-link"
                            disabled={avatarBusy}
                            onClick={onRemoveAvatar}
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="cc-groups-drawer-head-text">
                    <strong>{selectedGroup.name}</strong>
                    <span className="cc-group-meta">{formatStoredGroupScope(selectedGroup)}</span>
                  </div>
                  <span className={`status-pill ${selectedGroup.is_active ? 'on' : 'off'}`}>
                    <span className="status-pill-dot" aria-hidden="true" />
                    {selectedGroup.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    type="button"
                    className="cc-groups-drawer-close"
                    aria-label="Cerrar"
                    onClick={closeDrawer}
                  >
                    ×
                  </button>
                </header>

                <div className="cc-groups-drawer-body">
                  {error ? <p className="error">{error}</p> : null}

                  <form className="cc-groups-drawer-section" onSubmit={onSaveGroupDetails}>
                    <div className="cc-groups-drawer-section-head">
                      <h3>Identidad</h3>
                    </div>
                    <div className="cc-groups-drawer-grid">
                      <label className="cc-groups-field">
                        <span>Nombre</span>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={!canManage || detailsBusy}
                          required
                        />
                      </label>
                      <label className="cc-groups-field cc-groups-field--wide">
                        <span>Descripción</span>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={!canManage || detailsBusy}
                          rows={2}
                          placeholder="Opcional"
                        />
                      </label>
                    </div>
                    {canManage ? (
                      <div className="cc-groups-drawer-save">
                        <button
                          type="submit"
                          className="cc-btn primary cc-btn-sm"
                          disabled={detailsBusy || !editName.trim() || !detailsDirty}
                        >
                          {detailsBusy ? 'Guardando…' : 'Guardar'}
                        </button>
                        {detailsDirty ? (
                          <button
                            type="button"
                            className="cc-btn ghost cc-btn-sm"
                            disabled={detailsBusy}
                            onClick={() => {
                              setEditName(selectedGroup.name || '');
                              setEditDescription(selectedGroup.description || '');
                            }}
                          >
                            Descartar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </form>

                  {renderScopeEditor()}

                  <section
                    className={`cc-groups-drawer-section${membersSectionOpen ? '' : ' is-collapsed'}`}
                  >
                    <div className="cc-groups-drawer-section-head">
                      <button
                        type="button"
                        className="cc-groups-drawer-section-toggle"
                        aria-expanded={membersSectionOpen}
                        aria-controls="cc-groups-members-panel"
                        onClick={() => setMembersSectionOpen((open) => !open)}
                      >
                        <span className="cc-groups-drawer-section-chevron" aria-hidden>
                          {membersSectionOpen ? '▼' : '▶'}
                        </span>
                        <h3>Miembros ({members.length})</h3>
                        <span className="cc-groups-drawer-section-toggle-label">
                          {membersSectionOpen ? 'Contraer' : 'Expandir'}
                        </span>
                      </button>
                    </div>
                    {membersSectionOpen ? (
                      <div id="cc-groups-members-panel">
                        {canManage ? (
                          <form className="cc-groups-assign-inline" onSubmit={onAssignMember}>
                            <select
                              value={assignUserId}
                              onChange={(e) => setAssignUserId(e.target.value)}
                              aria-label="Usuario"
                            >
                              <option value="">Agregar persona…</option>
                              {assignableUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {memberAssignLabel(u)}
                                </option>
                              ))}
                            </select>
                            <select
                              value={assignRole}
                              onChange={(e) => setAssignRole(e.target.value)}
                              disabled={!assignUserId}
                              aria-label="Rol"
                            >
                              {MEMBER_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="cc-btn primary cc-btn-sm" disabled={!assignUserId}>
                              +
                            </button>
                          </form>
                        ) : null}
                        {members.length === 0 ? (
                          <p className="cc-hint cc-groups-members-empty">Sin miembros.</p>
                        ) : (
                          <table className="cc-groups-members-table">
                            <tbody>
                              {members.map((m) => (
                                <tr key={m.id}>
                                  <td>{m.displayName}</td>
                                  <td className="cc-gm-role">
                                    {canManage ? (
                                      <select
                                        className="cc-gm-role-select"
                                        value={m.role || 'member'}
                                        disabled={roleBusyId === m.id}
                                        aria-label={`Rol de ${m.displayName || m.username || 'miembro'}`}
                                        onChange={(e) => onChangeMemberRole(m.id, e.target.value)}
                                      >
                                        {MEMBER_ROLES.map((r) => (
                                          <option key={r.value} value={r.value}>
                                            {r.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      MEMBER_ROLES.find((r) => r.value === m.role)?.label || m.role
                                    )}
                                  </td>
                                  <td className="cc-gm-act">
                                    {canManage ? (
                                      <button
                                        type="button"
                                        className="cc-cat-rm"
                                        title="Quitar"
                                        onClick={() => kickMember(m.id)}
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ) : null}
                  </section>
                </div>

                <footer className="cc-groups-drawer-foot">
                  {canPurge && selectedGroup.is_active ? (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() => purgeChat(selectedGroup)}
                    >
                      Vaciar chat
                    </button>
                  ) : null}
                  {canManage && selectedGroup.is_active ? (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() => deactivateGroup(selectedGroup)}
                    >
                      Desactivar
                    </button>
                  ) : null}
                  {canManage && !selectedGroup.is_active ? (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() => reactivateGroup(selectedGroup)}
                    >
                      Reactivar
                    </button>
                  ) : null}
                  {canDeleteGroup && isRoot ? (
                    <button
                      type="button"
                      className="cc-btn danger cc-btn-sm"
                      onClick={() => hardDeleteGroup(selectedGroup)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </footer>
              </aside>,
            document.body
          )
        : null}

      {photoPreviewOpen && selectedGroup?.avatarUrl
        ? createPortal(
            <div
              className="cc-group-photo-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={`Foto de ${selectedGroup.name}`}
              data-esc-close=""
              onClick={() => setPhotoPreviewOpen(false)}
            >
              <button
                type="button"
                className="cc-group-photo-lightbox-close"
                aria-label="Cerrar"
                data-esc-close-btn=""
                title="Cerrar (Esc)"
                onClick={() => setPhotoPreviewOpen(false)}
              >
                ×
              </button>
              <figure
                className="cc-group-photo-lightbox-frame"
                onClick={() => setPhotoPreviewOpen(false)}
                title="Cerrar"
              >
                <img
                  src={
                    peekGroupAvatarBlobUrl(selectedGroup.id, selectedGroup.avatarUrl || '') ||
                    selectedGroup.avatarUrl
                  }
                  alt={selectedGroup.name}
                  className="cc-group-photo-lightbox-img"
                  draggable={false}
                />
                <figcaption className="cc-group-photo-lightbox-cap">
                  <strong>{selectedGroup.name}</strong>
                  <span>{formatStoredGroupScope(selectedGroup)}</span>
                </figcaption>
              </figure>
            </div>,
            document.body
          )
        : null}

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        busy={dialogBusy}
        onCancel={closeDialog}
        onConfirm={runDialogAction}
      />
    </div>
  );
}
