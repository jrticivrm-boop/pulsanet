import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminGroups,
  fetchAdminUsers,
  fetchAdminUserGroups,
  fetchAccessProfiles,
  canManageUsers,
  unlockAdminUserLogin,
  forceLogoutAdminUser,
  isRootUser,
  patchAdminUser,
  previewAdminUsername,
  checkAdminMatricula,
  usersCsvUrl,
  fetchOrgUnits,
  fetchGradesEmpleos,
  createCatalogServicio,
  geoAdminAt,
  fetchEfectivosCatalog,
  createEfectivoItem,
  deleteEfectivoItem,
  addGroupMember,
  removeGroupMember,
} from '../api';
import { canModuleAction, canViewModule } from './modulePermissions.js';
import { EJERCITO_MEXICANO_GRADE_GROUPS } from './armyGrades.js';
import { formatMatriculaInput, isValidMatricula, matriculaDigitMax, splitMatricula } from '../matricula.js';
import { openPeerSheet } from '../peerActions';
import { NEW_CHANNEL_BTN_SVG } from './ThFilterMulti.jsx';
import useAdminStickyToolbarHeight from './useAdminStickyToolbarHeight.js';
import { exportInstitutionalReport } from '../excelReport.js';
import { formatDistintivo } from './mapOperatorPopup.jsx';
import { IV_RM_STATE_DEFS } from './ivRmStatesConfig.js';
import { analyzeCoords, parseCoords } from './coordsParse.js';

const ROLE_OPTIONS = [
  { value: 'root', label: 'Administrador' },
  { value: 'region_admin', label: 'Administrador de región' },
  { value: 'region_user', label: 'Usuario de región' },
  { value: 'zone_admin', label: 'Administrador de zona' },
  { value: 'zone_user', label: 'Usuario de zona' },
  { value: 'unit_admin', label: 'Administrador de unidad' },
  { value: 'unit_user', label: 'Usuario de unidad' },
];

/**
 * Nombres vivos desde access_profiles (code → name).
 * Usuarios referencia el perfil por `role` (código), no por el texto de Perfiles;
 * sin este mapa, ROLE_OPTIONS queda fijo y un rename no se refleja.
 */
let liveRoleLabelMap = null;

function applyLiveRoleLabels(profiles) {
  const map = Object.create(null);
  for (const p of profiles || []) {
    const code = p?.code != null ? String(p.code).trim() : '';
    const name = p?.name != null ? String(p.name).trim() : '';
    if (code && name) map[code] = name;
  }
  liveRoleLabelMap = map;
}

function roleCatalog() {
  return ROLE_OPTIONS.map((r) => ({
    value: r.value,
    label: (liveRoleLabelMap && liveRoleLabelMap[r.value]) || r.label,
  }));
}

/** Alias legacy → rol canónico (alineado con backend/services/roles.js). */
const ROLE_ALIAS = {
  admin: 'region_admin',
  dispatcher: 'region_user',
  operator: 'unit_user',
};

const MEMBER_ROLE_LABEL = {
  member: 'Miembro',
  leader: 'Líder',
  listen_only: 'Solo escucha',
};

function normalizeClientRole(role) {
  const raw = String(role || '').trim();
  return ROLE_ALIAS[raw] || raw;
}

/** Rol ACL derivado del perfil (sistema = code; custom = level+kind). */
function roleFromAccessProfile(p) {
  if (!p) return 'unit_user';
  if (p.code) return normalizeClientRole(p.code);
  const level = String(p.level || 'unit');
  const kind = String(p.kind || 'user');
  if (level === 'system') return 'root';
  if (kind === 'admin') {
    if (level === 'region') return 'region_admin';
    if (level === 'zone') return 'zone_admin';
    return 'unit_admin';
  }
  if (level === 'region') return 'region_user';
  if (level === 'zone') return 'zone_user';
  return 'unit_user';
}

function profileOptionLabel(p) {
  const role = roleFromAccessProfile(p);
  const roleLbl = roleLabel(role);
  const name = String(p?.name || '').trim() || roleLbl;
  if (p?.code && name === roleLbl) return name;
  if (p?.code) return name;
  return `${name} · ${roleLbl}`;
}

const ROLE_HELP = {
  region_admin: 'Administra la región: usuarios, zonas, unidades y grupos. En el alta solo elige la región.',
  region_user: 'App y mapa de toda su región (zonas y unidades). Sin consola web. Radio solo en canales donde es miembro.',
  zone_admin: 'Administra su zona y las unidades. Puede crear canales de zona o de una unidad.',
  zone_user: 'App y mapa de usuarios de su zona. Sin consola web.',
  unit_admin: 'Administra solo los usuarios de su unidad.',
  unit_user: 'Servicio desplegado. App y mapa de su unidad. Sin consola web.',
  root: 'Administrador del sistema. Único e inamovible. Ve a todos.',
};

/** Texto claro de qué ve en radio/mapa según el rol (no se edita a mano). */
function radioMapScopeHelp(role) {
  const r = normalizeClientRole(role);
  if (!r) {
    return 'Primero elige el rol arriba. Con eso se define solo qué puede oír en radio y ver en el mapa; no se cambia a mano.';
  }
  if (r === 'root') {
    return 'Como Administrador del sistema puede oír y ver el mapa de toda la organización (todas las regiones).';
  }
  if (r === 'region_admin') {
    return 'Como Administrador de región ve en el mapa a toda su región (zonas y unidades). Los canales se crean aparte con su propio alcance.';
  }
  if (r === 'zone_admin') {
    return 'Como Administrador de zona puede oír y ver en el mapa a su zona y a las unidades de esa zona. No ve otras zonas ni el resto de la región.';
  }
  if (r === 'unit_admin') {
    return 'Como Administrador de unidad solo oye y ve en el mapa a los de su unidad (servicios desplegados). No ve otras unidades ni la zona completa.';
  }
  if (r === 'region_user') {
    return 'Usuario de región (sin consola): ve en el mapa a toda su región. En radio solo los canales donde es miembro.';
  }
  if (r === 'zone_user') {
    return 'Usuario de zona (sin consola): ve en el mapa a usuarios de su zona. No administra ni ve región.';
  }
  if (r === 'unit_user') {
    return 'Usuario de unidad / servicio desplegado (sin consola): solo ve en el mapa a su propia unidad.';
  }
  return 'El rol fija qué se oye en radio y qué se ve en el mapa; no se elige aparte.';
}

function radioMapScopeEmptyHint(role) {
  const r = normalizeClientRole(role);
  if (!r) return 'Selecciona un rol para ver qué podrá oír y ver en el mapa.';
  if (r === 'region_user' || r === 'zone_user' || r === 'unit_user') {
    return 'Este perfil no amplía la vista: solo alcanza lo de su adscripción (lo que marcaste en Región / Zona / Unidad). En la app móvil usa radio y mapa dentro de ese límite.';
  }
  return 'Con este rol no hay niveles ampliados de radio/mapa.';
}

/** Alcance radio/mapa fijado por el rol (no se elige a mano en Alta/Editar). */
function visibilityForRole(role) {
  const r = normalizeClientRole(role);
  if (r === 'region_admin' || r === 'root') {
    return { canSeeRegion: true, canSeeZones: true, canSeeUnits: true };
  }
  if (r === 'zone_admin') {
    return { canSeeRegion: false, canSeeZones: true, canSeeUnits: true };
  }
  if (r === 'unit_admin') {
    return { canSeeRegion: false, canSeeZones: false, canSeeUnits: true };
  }
  return { canSeeRegion: false, canSeeZones: false, canSeeUnits: false };
}

/** Niveles que aplican al rol (Admin unidad: solo Unidades; Admin zona: Z+U; etc.). */
function visibilityLevelsForRole(role) {
  const r = normalizeClientRole(role);
  if (r === 'region_admin' || r === 'root') {
    return [
      { key: 'canSeeRegion', name: 'Ver Región', desc: 'canales y mapa de toda su región' },
      { key: 'canSeeZones', name: 'Ver Zonas / C.G.', desc: 'incluye las zonas y su gente' },
      { key: 'canSeeUnits', name: 'Ver Unidades', desc: 'incluye unidades / servicios desplegados' },
    ];
  }
  if (r === 'zone_admin') {
    return [
      { key: 'canSeeZones', name: 'Ver Zonas / C.G.', desc: 'su zona y la gente de esa zona' },
      { key: 'canSeeUnits', name: 'Ver Unidades', desc: 'unidades / servicios de su zona' },
    ];
  }
  if (r === 'unit_admin') {
    return [
      { key: 'canSeeUnits', name: 'Ver Unidades', desc: 'solo su unidad / servicios desplegados' },
    ];
  }
  return [];
}

/** Escalera de asignación: solo hacia abajo (no pares ni superiores). root ve todos. */
function allowedRoleOptions(sessionRole) {
  const role = normalizeClientRole(sessionRole);
  return roleCatalog().filter((r) => {
    if (role === 'root') return true;
    if (role === 'region_admin') {
      return ['region_user', 'zone_admin', 'zone_user', 'unit_admin', 'unit_user'].includes(r.value);
    }
    if (role === 'zone_admin') return ['zone_user', 'unit_admin', 'unit_user'].includes(r.value);
    if (role === 'unit_admin') return r.value === 'unit_user';
    return false;
  });
}

const EMPTY_FORM = {
  grade: '',
  specialty: '',
  cargo: '',
  serviceNombre: '',
  /** Texto libre «lat, lng» (o liga de Google Maps). */
  serviceCoords: '',
  /** Poblado / Mpio. / Estado: se rellenan desde las coordenadas o se escriben a mano. */
  serviceLocalidad: '',
  serviceMunicipio: '',
  serviceEstado: '',
  /** Cantidades por concepto del catálogo de efectivos: { [itemId]: '12' }. */
  serviceEfectivos: {},
  givenNames: '',
  paternalSurname: '',
  maternalSurname: '',
  matricula: '',
  phone: '',
  role: '',
  profileId: '',
  regionId: '',
  /** '' | '__all__' | uuid de zona */
  zoneChoice: '',
  /** '' | '__all__' | uuid de unidad */
  unitChoice: '',
  zoneId: '',
  unitId: '',
  adminScopeUnitId: '',
  canSeeRegion: false,
  canSeeZones: false,
  canSeeUnits: false,
};

const ALC_ALL_ZONES = '__all__';
const ALC_ALL_UNITS = '__all__';

function fieldFilled(value) {
  return String(value || '').trim().length > 0;
}

function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '';
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

/** Payload API: coordenadas del servicio (null borra). */
function serviceCoordsPayload(text) {
  if (!fieldFilled(text)) return { serviceLat: null, serviceLng: null };
  const c = parseCoords(text);
  return c ? { serviceLat: c.lat, serviceLng: c.lng } : null;
}

/** Payload API: Poblado / Mpio. / Estado (vacío = borrar). */
function servicePlacePayload(form) {
  return {
    serviceGeoLocalidad: String(form.serviceLocalidad || '').trim() || null,
    serviceGeoMunicipio: String(form.serviceMunicipio || '').trim() || null,
    serviceGeoEstado: String(form.serviceEstado || '').trim() || null,
  };
}

function servicePlaceLabel(form) {
  const parts = Object.values(servicePlacePayload(form)).filter(Boolean);
  return parts.filter((v, i) => parts.indexOf(v) === i).join(', ');
}

const MX_ESTADOS = IV_RM_STATE_DEFS.map((s) => s.name);

/** Grupos del paso «Efectivos» (mismas claves que cat_efectivos.grupo). */
const EFECTIVOS_GRUPOS = [
  { key: 'personal', label: 'Personal', abbr: 'Pers.' },
  { key: 'armamento', label: 'Armamento', abbr: 'Arm.' },
  { key: 'vehs_sb', label: 'Vehs. S/B.', abbr: 'S/B' },
  { key: 'vehs_cb', label: 'Vehs. C/B.', abbr: 'C/B' },
  { key: 'otros', label: 'Otros', abbr: 'Otros' },
];

/** Catálogo vivo de efectivos `[{ id, grupo, name }]` (lo carga la vista; lo usan tabla y Excel). */
let liveEfectivosItems = [];

function efectivosGrupoLabel(grupo) {
  return EFECTIVOS_GRUPOS.find((g) => g.key === grupo)?.label || grupo;
}

function efectivoQty(u, itemId) {
  const v = u?.serviceEfectivos?.[itemId];
  return v == null || String(v).trim() === '' ? null : Number(v);
}

/** Suma del grupo, o null si no se capturó ningún concepto. */
function efectivosGrupoTotal(u, grupo) {
  let total = null;
  for (const it of liveEfectivosItems) {
    if (it.grupo !== grupo) continue;
    const n = efectivoQty(u, it.id);
    if (n != null) total = (total ?? 0) + n;
  }
  return total;
}

/** «Pers. 58 · Arm. 72 · S/B 4» (totales por grupo, solo lo capturado). */
function formatEfectivos(u) {
  return EFECTIVOS_GRUPOS.map((g) => {
    const t = efectivosGrupoTotal(u, g.key);
    return t == null ? '' : `${g.abbr} ${t}`;
  })
    .filter(Boolean)
    .join(' · ');
}

/** «Personal: GG. 1, TT. 50 · Armamento: Fx. 55» (desglose para tooltip). */
function formatEfectivosDetail(u) {
  return EFECTIVOS_GRUPOS.map((g) => {
    const parts = liveEfectivosItems
      .filter((it) => it.grupo === g.key && efectivoQty(u, it.id) != null)
      .map((it) => `${it.name} ${efectivoQty(u, it.id)}`);
    return parts.length ? `${g.label}: ${parts.join(', ')}` : '';
  })
    .filter(Boolean)
    .join(' · ');
}

/** Payload API: solo conceptos vigentes y capturados (objeto vacío = borrar). */
function efectivosPayload(form) {
  const out = {};
  const vigentes = new Set(liveEfectivosItems.map((it) => it.id));
  for (const [id, v] of Object.entries(form.serviceEfectivos || {})) {
    if (!vigentes.has(id)) continue;
    const digits = String(v ?? '').replace(/\D/g, '');
    if (digits) out[id] = Number(digits);
  }
  return { serviceEfectivos: out };
}

function serviceGeoSummary(g) {
  if (!g) return '';
  return [
    g.colonia,
    g.localidad,
    g.municipio,
    g.estado,
    g.cp ? `C.P. ${g.cp}` : '',
    g.ejido ? `Ejido ${g.ejido}` : '',
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' · ');
}

function userServiceGeo(u) {
  return {
    estado: u.serviceGeoEstado,
    municipio: u.serviceGeoMunicipio,
    localidad: u.serviceGeoLocalidad,
    colonia: u.serviceGeoColonia,
    cp: u.serviceGeoCp,
    ejido: u.serviceGeoEjido,
  };
}

/** Teléfono: 10 dígitos (MX) o `+` y 10–15 dígitos. Misma regla que `backend/src/services/phone.js`. */
function isValidPhone(value) {
  const s = String(value || '').trim();
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return digits.length >= 10 && digits.length <= 15;
  return digits.length === 10;
}

/** Mensaje de error del teléfono o '' si es válido. En edición puede quedar vacío. */
function phoneValidationError(value, optional) {
  if (!fieldFilled(value)) return optional ? '' : 'Captura el No. de teléfono (10 dígitos).';
  return isValidPhone(value)
    ? ''
    : 'No. de teléfono inválido: 10 dígitos, o + con lada internacional (10 a 15 dígitos).';
}

/** Al escribir: solo dígitos (y `+` inicial); 10 dígitos MX se muestran `55 1234 5678`. */
function formatPhoneInput(value) {
  const s = String(value || '');
  const plus = s.trim().startsWith('+');
  const digits = s.replace(/\D/g, '').slice(0, 15);
  if (plus) return `+${digits}`;
  const d = digits.slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

/** Busca nodos en el árbol org por id. */
function findOrgNode(tree, id) {
  if (!id) return null;
  for (const region of tree || []) {
    if (region.id === id) return { kind: 'region', region, zone: null, unit: null };
    for (const zone of region.children || []) {
      if (zone.id === id) return { kind: 'zone', region, zone, unit: null };
      for (const unit of zone.children || []) {
        if (unit.id === id) return { kind: 'unit', region, zone, unit };
      }
    }
  }
  return null;
}

/**
 * Cascada Usuarios → unit_id / admin_scope_unit_id (Alcance 3).
 * - root: global
 * - region_*: solo región (pertenencia). Zona/unidad se eligen al crear canales.
 * - zone_*: región + zona (toda la zona). Sin unidad.
 * - unit_*: región + zona + unidad concreta
 */
function orgScopeForSave(role, form, { actingUnitAdmin = false, myScopeUnitId = '' } = {}) {
  const r = normalizeClientRole(role) || 'unit_user';
  if (actingUnitAdmin) {
    const uid = myScopeUnitId || form.unitId || form.unitChoice || null;
    return { role: 'unit_user', unitId: uid, adminScopeUnitId: null };
  }
  if (r === 'root') {
    return { unitId: null, adminScopeUnitId: null };
  }

  const regionId = String(form.regionId || '').trim() || null;
  const zoneChoice = String(form.zoneChoice || '').trim();
  const unitChoice = String(form.unitChoice || '').trim();
  const zoneId = zoneChoice && zoneChoice !== ALC_ALL_ZONES ? zoneChoice : null;
  const unitId = unitChoice && unitChoice !== ALC_ALL_UNITS ? unitChoice : null;

  if (r === 'region_admin' || r === 'region_user') {
    if (!regionId) {
      return { unitId: null, adminScopeUnitId: null, error: 'Selecciona la región.' };
    }
    return r === 'region_admin'
      ? { unitId: null, adminScopeUnitId: regionId }
      : { unitId: regionId, adminScopeUnitId: null };
  }

  if (r === 'zone_admin' || r === 'zone_user') {
    if (!regionId) return { unitId: null, adminScopeUnitId: null, error: 'Selecciona la región.' };
    if (!zoneId) {
      return {
        unitId: null,
        adminScopeUnitId: null,
        error: 'Selecciona la zona (alcance = toda esa zona).',
      };
    }
    return r === 'zone_admin'
      ? { unitId: null, adminScopeUnitId: zoneId }
      : { unitId: zoneId, adminScopeUnitId: null };
  }

  if (r === 'unit_admin' || r === 'unit_user') {
    if (!regionId || !zoneId || !unitId) {
      return {
        unitId: null,
        adminScopeUnitId: null,
        error: 'Selecciona región, zona y unidad.',
      };
    }
    return r === 'unit_admin'
      ? { unitId, adminScopeUnitId: unitId }
      : { unitId, adminScopeUnitId: null };
  }

  return { unitId: unitId || null, adminScopeUnitId: null };
}

/** Rehidrata zoneChoice/unitChoice desde unit_id + admin_scope al editar. */
function alcanceChoicesFromUser(u, tree) {
  const role = normalizeClientRole(u?.role);
  if (!u || role === 'root') {
    return { regionId: '', zoneChoice: '', unitChoice: '' };
  }
  const scopeId = u.adminScopeUnitId || null;
  const unitId = u.unitId || null;
  const scopeNode = findOrgNode(tree, scopeId);
  const unitNode = findOrgNode(tree, unitId);
  const path = findOrgPath(tree, unitId, scopeId);

  if (role === 'region_admin' || role === 'region_user') {
    const regionId =
      path.regionId ||
      (scopeNode?.kind === 'region' ? scopeId : '') ||
      (unitNode?.kind === 'region' ? unitId : '') ||
      scopeNode?.region?.id ||
      unitNode?.region?.id ||
      '';
    // Alcance 3: pertenencia solo región (no rehidratar zona en el formulario).
    return { regionId: regionId || '', zoneChoice: '', unitChoice: '' };
  }

  if (role === 'zone_admin' || role === 'zone_user') {
    const zoneId =
      path.zoneId ||
      (scopeNode?.kind === 'zone' ? scopeId : '') ||
      (unitNode?.kind === 'zone' ? unitId : '') ||
      (scopeNode?.kind === 'unit' ? scopeNode.zone?.id : '') ||
      (unitNode?.kind === 'unit' ? unitNode.zone?.id : '') ||
      '';
    return {
      regionId: path.regionId || scopeNode?.region?.id || unitNode?.region?.id || '',
      zoneChoice: zoneId || '',
      unitChoice: '',
    };
  }

  return {
    regionId: path.regionId || '',
    zoneChoice: path.zoneId || '',
    unitChoice: path.unitId || unitId || '',
  };
}

function alcanceLabel(u) {
  const role = normalizeClientRole(u?.role);
  if (role === 'root') return 'Todas las regiones';
  if (role === 'region_admin' || role === 'region_user') {
    if (u.zoneName && u.unitName && u.zoneName !== u.unitName) {
      return `${u.unitName}`;
    }
    if (u.zoneName) return `${u.zoneName} (toda la zona)`;
    if (u.unitName) return `${u.unitName} (toda la región)`;
    return 'Toda la región';
  }
  if (role === 'zone_admin' || role === 'zone_user') {
    if (u.unitName && u.zoneName && u.unitName !== u.zoneName) return u.unitName;
    return u.zoneName ? `${u.zoneName} (toda la zona)` : u.unitName || 'Su zona';
  }
  return u.unitName || u.zoneName || 'Su unidad';
}

/** Quién puede Editar/Eliminar.
 * - Otro usuario (admin u operador): edición completa (rol/perfil + alcance).
 * - Uno mismo: solo datos básicos (no auto-cambiar rol/alcance).
 * - root ajeno: solo root lo edita.
 */
function userEditFlags(sessionUser, u) {
  const canManage = canManageUsers(sessionUser) && canViewModule(sessionUser, 'usuarios');
  if (!canManage || !u) {
    return { canEdit: false, canDelete: false, basicsOnly: false };
  }
  const role = normalizeClientRole(u.role);
  if (role === 'root' && !isRootUser(sessionUser)) {
    return { canEdit: false, canDelete: false, basicsOnly: false };
  }
  const allowEdit = canModuleAction(sessionUser, 'usuarios', 'editar');
  const allowDelete = canModuleAction(sessionUser, 'usuarios', 'eliminar');
  const isSelf = u.id === sessionUser.id;
  if (isSelf) {
    return { canEdit: allowEdit, canDelete: false, basicsOnly: true };
  }
  return {
    canEdit: allowEdit,
    canDelete: allowDelete && role !== 'root',
    basicsOnly: false,
  };
}

function CreateStepIndicator({ step, editMode = false, basicsOnly = false }) {
  const steps = [
    { id: 'datos', n: 1, label: 'Generales' },
    { id: 'efectivos', n: 2, label: 'Efectivos' },
    ...(basicsOnly ? [] : [{ id: 'grupos', n: 3, label: 'Grupos' }]),
  ];
  const order = steps.map((s) => s.id);
  const currentIdx = order.indexOf(step);
  return (
    <nav className="cc-form-stepper" aria-label={editMode ? 'Pasos de edición' : 'Pasos del alta'}>
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = s.id === step;
        return (
          <div
            key={s.id}
            className={`cc-form-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
          >
            <span className="cc-form-step-num">{done ? '\u2713' : s.n}</span>
            <span className="cc-form-step-label">{s.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

const FORM_SECTION_ICONS = {
  identidad: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  nombre: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </>
  ),
  servicio: (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  efectivos: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.5c2.6.2 4.5 2.1 4.5 5" />
    </>
  ),
  perfil: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3" />
    </>
  ),
  organismo: (
    <>
      <path d="M3 21h18M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  mapa: (
    <>
      <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  grupos: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
};

function FormSectionTitle({ icon, hint, children }) {
  const glyph = FORM_SECTION_ICONS[icon];
  return (
    <h3 className="cc-form-section-title">
      {glyph ? (
        <span className="cc-form-section-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {glyph}
          </svg>
        </span>
      ) : null}
      <span className="cc-form-section-text">
        <span className="cc-form-section-name">{children}</span>
        {hint ? <small className="cc-form-section-hint">{hint}</small> : null}
      </span>
    </h3>
  );
}

/** Ficha en vivo del alta/edición: cómo se verá el operador (indicativo, distintivo, login). */
function UserFormFicha({ displayName, username, fullName, distintivo, initials }) {
  return (
    <section className="cc-user-ficha" aria-live="polite" aria-label="Vista previa del usuario">
      <div className="cc-user-ficha-avatar" aria-hidden="true">
        {initials || '?'}
      </div>
      <div className="cc-user-ficha-main">
        <div className={`cc-user-ficha-name${displayName ? '' : ' is-empty'}`}>
          {displayName || 'Grado Apellido, unidad'}
        </div>
        <div className="cc-user-ficha-meta">
          {fullName ? <span className="cc-user-ficha-full">{fullName}</span> : null}
          {distintivo ? (
            <span className="cc-user-ficha-chip" title="Así aparece en el mapa">
              {distintivo}
            </span>
          ) : null}
          <span className="cc-user-ficha-login" title="Usuario de acceso (automático)">
            <code>{username || 'usuario automático'}</code>
          </span>
        </div>
      </div>
    </section>
  );
}

function MissingFieldsList({ items }) {
  const pending = items.filter((x) => !x.ok);
  if (!pending.length) {
    return (
      <p className="cc-form-checklist ok" role="status">
        Listo para continuar — todos los campos obligatorios están completos.
      </p>
    );
  }
  return (
    <div className="cc-form-checklist warn" role="status">
      <strong>Falta completar:</strong>
      <ul>
        {pending.map((x) => (
          <li key={x.label}>{x.label}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sugiere General si existe; si no, el primer grupo activo. */
function suggestedGroupIds(groups) {
  const active = (groups || []).filter((g) => g.is_active !== false);
  if (!active.length) return [];
  const general = active.find((g) => String(g.name).toLowerCase() === 'general');
  return [(general || active[0]).id];
}

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SERVICIO_TIPOS_BASE = ['P.M.A.', 'P.M.M.', 'B.O.Mvl.', 'D.S.M.', 'P.M.S.', 'P.M.S.E.'];

/** Desplegable Tipo de servicio: base en orden fijo, luego los agregados; conserva el valor actual. */
function servicioTipoOptions(catalog, current) {
  const out = [...SERVICIO_TIPOS_BASE];
  for (const s of catalog || []) {
    const name = String(s?.name || '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  const cur = String(current || '').trim();
  if (cur && !out.includes(cur)) out.push(cur);
  return out;
}

const USER_TABLE_COLS = [
  { key: 'grade', label: 'Grado y especialidad' },
  { key: 'name', label: 'Nombre completo' },
  { key: 'user', label: 'Usuario' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'service', label: 'Tipo de servicio' },
  { key: 'serviceName', label: 'Distintivo' },
  { key: 'serviceGeo', label: 'Ubicación del servicio' },
  { key: 'efectivos', label: 'Efectivos' },
  { key: 'profile', label: 'Perfil' },
  { key: 'scope', label: 'Alcance' },
  { key: 'status', label: 'Estado' },
  { key: 'created', label: 'Registrado' },
  { key: 'seen', label: 'Último acceso' },
];

const USERS_COLS_STORAGE_KEY = 'tacticalptx_users_cols';

function defaultUserColConfig() {
  return USER_TABLE_COLS.map((c) => ({ ...c, visible: true }));
}

function loadUserColConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_COLS_STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved)) return defaultUserColConfig();
    const validKeys = new Set(USER_TABLE_COLS.map((c) => c.key));
    const ordered = [];
    const seen = new Set();
    for (const s of saved) {
      if (!validKeys.has(s.key) || seen.has(s.key)) continue;
      seen.add(s.key);
      const base = USER_TABLE_COLS.find((d) => d.key === s.key);
      ordered.push({ ...base, visible: s.visible !== false });
    }
    USER_TABLE_COLS.forEach((d, i) => {
      if (seen.has(d.key)) return;
      // Columna nueva: junto a la que la precede por defecto (no al final).
      const prevKey = USER_TABLE_COLS[i - 1]?.key;
      const at = prevKey ? ordered.findIndex((c) => c.key === prevKey) : -1;
      ordered.splice(at >= 0 ? at + 1 : ordered.length, 0, { ...d, visible: true });
      seen.add(d.key);
    });
    return ordered.length ? ordered : defaultUserColConfig();
  } catch {
    return defaultUserColConfig();
  }
}

function saveUserColConfig(config) {
  try {
    localStorage.setItem(
      USERS_COLS_STORAGE_KEY,
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

function sortTs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function getUserSortValue(u, key) {
  switch (key) {
    case 'grade':
      return [u.grade, u.specialty].filter(Boolean).join(' ') || '';
    case 'name':
      return u.fullName || u.displayName || '';
    case 'user':
      return u.username || '';
    case 'phone':
      return u.phone || '';
    case 'serviceName':
      return u.serviceNombre || '';
    case 'service':
      return u.cargo || '';
    case 'efectivos':
      return efectivosGrupoTotal(u, 'personal') ?? formatEfectivos(u);
    case 'profile':
      return roleLabel(u.role) || u.role || '';
    case 'scope':
      return alcanceLabel(u) || '';
    case 'status':
      return u.isActive ? 1 : 0;
    case 'created':
      return sortTs(u.createdAt);
    case 'seen':
      return sortTs(u.lastSeenAt);
    default:
      return '';
  }
}

const USR_COLS_BTN_SVG = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4" />
  </svg>
);

/** Icono Filtros (Parque Vehicular: líneas horizontales de embudo). */
const USR_FILTER_BTN_SVG = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="M3 6h18M7 12h10M10 18h4" />
  </svg>
);

/** Icono Exportar (Parque Vehicular: flecha de descarga). */
const USR_EXPORT_BTN_SVG = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M12 3v11m0 0-4-4m4 4 4-4" />
    <path d="M5 19h14" />
  </svg>
);

/** Columnas del Excel por columna visible de la tabla (algunas se desglosan en varias). */
const USER_EXPORT_COLS = {
  grade: [
    ['Grado', (u) => u.grade || ''],
    ['Especialidad', (u) => u.specialty || ''],
  ],
  name: [
    ['Nombre completo', (u) => u.fullName || u.displayName || ''],
    ['Matrícula', (u) => (u.matricula ? formatMatriculaInput(u.matricula) : '')],
  ],
  user: [['Usuario', (u) => u.username || '']],
  phone: [['No. Tel.', (u) => (u.phone ? formatPhoneInput(u.phone) : '')]],
  service: [['Tipo de servicio', (u) => u.cargo || '']],
  serviceName: [['Distintivo', (u) => u.serviceNombre || '']],
  serviceGeo: [
    ['Coordenadas', (u) => formatCoords(u.serviceLat, u.serviceLng)],
    ['Estado (ubicación)', (u) => u.serviceGeoEstado || ''],
    ['Municipio', (u) => u.serviceGeoMunicipio || ''],
    ['Localidad', (u) => u.serviceGeoLocalidad || ''],
    ['Colonia', (u) => u.serviceGeoColonia || ''],
    ['C.P.', (u) => u.serviceGeoCp || ''],
    ['Ejido', (u) => u.serviceGeoEjido || ''],
  ],
  get efectivos() {
    return EFECTIVOS_GRUPOS.flatMap((g) => {
      const items = liveEfectivosItems.filter((it) => it.grupo === g.key);
      if (!items.length) return [];
      return [
        ...items.map((it) => [`${g.label} ${it.name}`, (u) => efectivoQty(u, it.id) ?? '']),
        [`${g.label} total`, (u) => efectivosGrupoTotal(u, g.key) ?? ''],
      ];
    });
  },
  profile: [['Perfil', (u) => userExportValue(u, 'profile')]],
  scope: [['Alcance', (u) => userExportValue(u, 'scope')]],
  status: [['Estado', (u) => userExportValue(u, 'status')]],
  created: [['Registrado', (u) => userExportValue(u, 'created')]],
  seen: [['Último acceso', (u) => userExportValue(u, 'seen')]],
};

/** Hoja Resumen: conteos y listas de valores distintos según las columnas exportadas. */
function buildUsersExportSummary(list, visibleKeys) {
  const items = [];
  const distinct = (get) => {
    const counts = new Map();
    for (const u of list) {
      const v = String(get(u) ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }));
  };
  const pushList = (label, get) => {
    const entries = distinct(get);
    if (entries.length) items.push({ label, total: entries.length, detail: entries.map(([v]) => v).join(', ') });
  };
  const pushCounted = (label, get) => {
    const entries = distinct(get);
    if (entries.length) {
      items.push({ label, total: entries.length, detail: entries.map(([v, n]) => `${v} (${n})`).join(', ') });
    }
  };
  const pushCount = (label, n) => {
    if (n > 0) items.push({ label, total: n, detail: '' });
  };
  for (const key of visibleKeys) {
    switch (key) {
      case 'grade':
        pushList('Grados', (u) => u.grade);
        break;
      case 'name':
        pushCount('Usuarios registrados', list.length);
        break;
      case 'phone':
        pushCount('Con teléfono', list.filter((u) => u.phone).length);
        break;
      case 'service':
        pushCounted('Tipo de servicio', (u) => u.cargo);
        break;
      case 'serviceName':
        pushCount('Distintivos registrados', distinct((u) => u.serviceNombre).length);
        break;
      case 'serviceGeo':
        pushList('Estados (ubicación)', (u) => u.serviceGeoEstado);
        pushList('Municipios', (u) => u.serviceGeoMunicipio);
        break;
      case 'efectivos': {
        const sum = (get) => list.reduce((s, u) => s + (Number(get(u)) || 0), 0);
        for (const g of EFECTIVOS_GRUPOS) {
          for (const it of liveEfectivosItems.filter((x) => x.grupo === g.key)) {
            pushCount(`${g.label} — ${it.name}`, sum((u) => efectivoQty(u, it.id)));
          }
          pushCount(`${g.label} — Total`, sum((u) => efectivosGrupoTotal(u, g.key)));
        }
        break;
      }
      case 'profile':
        pushCounted('Perfil', (u) => roleLabel(u.role));
        break;
      case 'scope':
        pushCounted('Alcance', (u) => alcanceLabel(u));
        break;
      case 'status':
        pushCount('Estado — Activo', list.filter((u) => u.isActive).length);
        pushCount('Estado — Inactivo', list.filter((u) => !u.isActive).length);
        pushCount('Estado — Bloqueado', list.filter((u) => u.loginLocked).length);
        break;
      default:
        break;
    }
  }
  return items;
}

const USERS_PAGE_SIZE = 15;

/** Ventana de botones numerados (estilo Parque Vehicular: hasta 5 páginas). */
function usrPagerPages(current, totalPages) {
  const pags = Math.max(1, totalPages);
  const cur = Math.max(1, Math.min(current, pags));
  let start = Math.max(1, cur - 2);
  let end = Math.min(pags, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  const pages = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

function userTableCell(u, key) {
  switch (key) {
    case 'grade':
      return [u.grade, u.specialty].filter(Boolean).join(' ') || '—';
    case 'name':
      return u.fullName || u.displayName || '—';
    case 'user':
      return <code>{u.username}</code>;
    case 'phone':
      return u.phone ? formatPhoneInput(u.phone) : '—';
    case 'serviceName':
      return u.serviceNombre || '—';
    case 'service':
      return u.cargo || '—';
    case 'serviceGeo':
      return [u.serviceGeoMunicipio, u.serviceGeoEstado].filter(Boolean).join(', ') || '—';
    case 'efectivos': {
      const text = formatEfectivos(u);
      return text ? <span title={formatEfectivosDetail(u)}>{text}</span> : '—';
    }
    case 'profile':
      return roleLabel(u.role);
    case 'scope':
      return alcanceLabel(u);
    case 'status':
      return (
        <>
          <span className={`usr-status ${u.isActive ? 'on' : 'off'}`}>
            {u.isActive ? 'Activo' : 'Inactivo'}
          </span>
          {u.loginLocked ? ' · Bloqueado' : ''}
        </>
      );
    case 'created':
      return fmtWhen(u.createdAt);
    case 'seen':
      return fmtWhen(u.lastSeenAt);
    default:
      return '—';
  }
}

/** Texto plano de la celda para exportar a Excel. */
function userExportValue(u, key) {
  switch (key) {
    case 'user':
      return u.username || '';
    case 'status':
      return `${u.isActive ? 'Activo' : 'Inactivo'}${u.loginLocked ? ' · Bloqueado' : ''}`;
    default: {
      const v = userTableCell(u, key);
      return typeof v === 'string' ? v : '';
    }
  }
}

function roleLabel(role) {
  const r = normalizeClientRole(role);
  if (liveRoleLabelMap && liveRoleLabelMap[r]) return liveRoleLabelMap[r];
  return ROLE_OPTIONS.find((o) => o.value === r)?.label || r || '—';
}

/** Valor canónico para filtro de columna (select "— Todos —" + únicos). */
function getUserColFilterVal(u, key) {
  switch (key) {
    case 'grade':
      return [u.grade, u.specialty].filter(Boolean).join(' ') || '—';
    case 'name':
      return u.fullName || u.displayName || '—';
    case 'user':
      return u.username || '';
    case 'phone':
      return u.phone ? formatPhoneInput(u.phone) : '—';
    case 'serviceName':
      return u.serviceNombre || '—';
    case 'service':
      return u.cargo || '—';
    case 'serviceGeo':
      return [u.serviceGeoMunicipio, u.serviceGeoEstado].filter(Boolean).join(', ') || '—';
    case 'efectivos':
      return formatEfectivos(u) || '—';
    case 'profile':
      return u.role || '';
    case 'scope':
      return alcanceLabel(u);
    case 'status':
      return u.isActive ? 'active' : 'inactive';
    case 'created':
      return fmtWhen(u.createdAt);
    case 'seen':
      return fmtWhen(u.lastSeenAt);
    default:
      return '';
  }
}

function colFilterOptionLabel(key, value) {
  if (key === 'profile') return roleLabel(value);
  if (key === 'status') {
    if (value === 'active') return 'Activo';
    if (value === 'inactive') return 'Inactivo';
  }
  return value;
}

/** undefined = todos; [] = ninguno; string[] = selección parcial (estilo PV). */
function usrColFilterIsAll(selected) {
  return selected == null;
}
function usrColFilterIsNone(selected) {
  return Array.isArray(selected) && selected.length === 0;
}
function usrColFilterIsActive(selected) {
  return !usrColFilterIsAll(selected);
}
const USR_BTN_LABEL_MAX = 56;

function usrColFilterBtnLabel(selected, options, key) {
  if (usrColFilterIsAll(selected)) return '— Todos —';
  if (usrColFilterIsNone(selected)) return 'Ninguno';
  if (selected.length === 1) {
    const t = String(colFilterOptionLabel(key, selected[0]) || '');
    /* Truncar solo etiquetas extremadamente largas; el CSS hace ellipsis por ancho de columna. */
    return t.length > USR_BTN_LABEL_MAX ? `${t.slice(0, USR_BTN_LABEL_MAX - 1)}…` : t;
  }
  const total = Array.isArray(options) ? options.length : selected.length;
  return `${selected.length} de ${total} seleccionados`;
}

/** Texto completo para tooltip (sin truncar). */
function usrColFilterBtnTitle(selected, key, colLabel, displayLabel) {
  if (usrColFilterIsAll(selected)) return `Filtrar por ${colLabel}`;
  if (usrColFilterIsNone(selected)) return 'Ninguno seleccionado';
  if (Array.isArray(selected) && selected.length === 1) {
    return String(colFilterOptionLabel(key, selected[0]) || displayLabel);
  }
  return displayLabel;
}
function usrColFilterVisual(selected) {
  if (usrColFilterIsAll(selected)) return '';
  if (usrColFilterIsNone(selected)) return 'none';
  return 'partial';
}
function usrColFilterSortOptions(options, key, sortDir) {
  const cmp = (a, b) =>
    String(colFilterOptionLabel(key, a)).localeCompare(
      String(colFilterOptionLabel(key, b)),
      'es',
      { sensitivity: 'base', numeric: true }
    );
  const sorted = [...options].sort(cmp);
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Filtro por columna estilo Parque Vehicular:
 * botón «— Todos —» + menú con Ascendente/Descendente, Marcar/Desmarcar, búsqueda y checks.
 */
function UsrThFilterMulti({
  colKey,
  colLabel,
  options,
  selected,
  open,
  onOpenChange,
  onChange,
  disabled,
}) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 140 });

  const sortedOptions = useMemo(
    () => usrColFilterSortOptions(options || [], colKey, sortDir),
    [options, colKey, sortDir]
  );

  const selectedSet = useMemo(() => {
    if (usrColFilterIsAll(selected)) return null; // all
    return new Set(Array.isArray(selected) ? selected : []);
  }, [selected]);

  const checkedCount = usrColFilterIsAll(selected)
    ? sortedOptions.length
    : usrColFilterIsNone(selected)
      ? 0
      : selected.length;

  const visual = usrColFilterVisual(selected);
  const btnLabel = usrColFilterBtnLabel(selected, sortedOptions, colKey);

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) {
      setMenuSearch('');
      return undefined;
    }
    function onDoc(e) {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onOpenChangeRef.current(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') onOpenChangeRef.current(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return undefined;
    function place() {
      const r = btnRef.current.getBoundingClientRect();
      const gap = 2;
      const minWidth = Math.max(r.width, 160);
      const maxW = 280;
      const width = Math.min(Math.max(minWidth, r.width), maxW);
      let left = Math.max(8, r.left);
      let top = r.bottom + gap;
      const estH = Math.min(320, window.innerHeight - 24);
      if (top + estH > window.innerHeight - 8) {
        top = Math.max(8, r.top - estH - gap);
      }
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setMenuPos({ top, left, minWidth: width });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, sortedOptions.length]);

  function emitSelection(nextChecked) {
    const total = sortedOptions.length;
    if (nextChecked.size >= total) onChange(undefined);
    else if (nextChecked.size === 0) onChange([]);
    else onChange(sortedOptions.filter((v) => nextChecked.has(v)));
  }

  function isChecked(v) {
    if (selectedSet == null) return true;
    return selectedSet.has(v);
  }

  function toggleOne(v) {
    const next = new Set(
      selectedSet == null ? sortedOptions : [...selectedSet]
    );
    if (next.has(v)) next.delete(v);
    else next.add(v);
    emitSelection(next);
  }

  function toggleAllChecks() {
    if (checkedCount >= sortedOptions.length && sortedOptions.length > 0) {
      onChange([]);
    } else {
      onChange(undefined);
    }
  }

  function toggleSort() {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  const q = menuSearch.trim().toLowerCase();
  const visibleOptions = q
    ? sortedOptions.filter((v) =>
        String(colFilterOptionLabel(colKey, v)).toLowerCase().includes(q)
      )
    : sortedOptions;

  return (
    <div
      ref={wrapRef}
      className={`usr-th-filter-multi${visual ? ` ${visual}` : ''}`}
      data-col-key={colKey}
    >
      <button
        ref={btnRef}
        type="button"
        className={`usr-th-filter-multi-btn${visual === 'partial' ? ' is-filter-partial' : ''}${visual === 'none' ? ' is-filter-none' : ''}`}
        title={usrColFilterBtnTitle(selected, colKey, colLabel, btnLabel)}
        aria-label={`Filtrar por ${colLabel}`}
        aria-expanded={open}
        disabled={disabled}
        draggable={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        {btnLabel}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="usr-th-filter-multi-menu"
            role="dialog"
            aria-label={`Filtro ${colLabel}`}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              ['--usr-th-filter-w']: `${menuPos.minWidth}px`,
              zIndex: 10050,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="usr-th-filter-multi-head">
              <div className="usr-th-filter-multi-actions">
                <button
                  type="button"
                  className="usr-th-filter-multi-link"
                  onClick={toggleSort}
                >
                  {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
                </button>
                <span className="usr-th-filter-multi-sep">·</span>
                <button
                  type="button"
                  className="usr-th-filter-multi-link"
                  onClick={toggleAllChecks}
                >
                  {checkedCount >= sortedOptions.length && sortedOptions.length > 0
                    ? 'Desmarcar'
                    : 'Marcar'}
                </button>
              </div>
              <div className="usr-th-filter-multi-meta">
                <span className="usr-th-filter-multi-count">
                  {sortedOptions.length === 0
                    ? 'Sin opciones'
                    : `${checkedCount} de ${sortedOptions.length} seleccionados`}
                </span>
                <span
                  className="usr-th-filter-multi-hint"
                  title="Marcar/Desmarcar alterna todos los checks. Ascendente/Descendente ordena la lista."
                >
                  ?
                </span>
              </div>
              <input
                type="text"
                className="usr-th-filter-multi-search"
                placeholder="Buscar en lista…"
                value={menuSearch}
                autoComplete="off"
                onChange={(e) => setMenuSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="usr-th-filter-multi-list">
              {visibleOptions.length === 0 ? (
                <div className="usr-th-filter-multi-empty">Sin coincidencias</div>
              ) : (
                visibleOptions.map((v) => (
                  <label key={v} className="usr-th-filter-multi-item">
                    <input
                      type="checkbox"
                      checked={isChecked(v)}
                      onChange={() => toggleOne(v)}
                    />
                    <span>{colFilterOptionLabel(colKey, v)}</span>
                  </label>
                ))
              )}
            </div>
          </div>,
          typeof document !== 'undefined'
            ? document.querySelector('.cc-shell') || document.body
            : document.body
        )}
    </div>
  );
}

function userInitials(u) {
  const name = u.fullName || u.displayName || u.username || '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function userMetaLine(u) {
  const parts = [];
  if (u.grade) parts.push(u.grade);
  if (u.specialty && u.specialty !== u.grade) parts.push(u.specialty);
  const cargo = String(u.cargo || '').trim();
  if (cargo && cargo !== u.specialty && !String(u.displayName || '').includes(cargo)) {
    parts.push(cargo);
  }
  return parts.join(' · ');
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
          // Si el ancla es la zona (p. ej. zone_user sin unidad), no rellenar Unidad.
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

function UserCard({
  u,
  session,
  canManage,
  isRoot,
  onEdit,
  onChangeRole,
  onToggleActive,
  onUnlockLogin,
  onResetPassword,
  onTogglePanicPerm,
  onRemoveUser,
  onReload,
}) {
  const meta = userMetaLine(u);
  const { canEdit } = userEditFlags(session.user, u);
  const panicLabel =
    u.role === 'root' ||
    u.role === 'region_admin' ||
    u.role === 'zone_admin' ||
    u.role === 'unit_admin'
      ? 'Por rol'
      : u.canReceivePanic
        ? 'Sí'
        : 'No';

  const roleChoices = allowedRoleOptions(session.user?.role);

  return (
    <li className="cc-user-card">
      <div className="cc-user-card-main">
        <div className="cc-user-card-id">
          <span className="cc-user-avatar" aria-hidden="true">
            {userInitials(u)}
          </span>
          <div className="cc-user-card-head">
            <strong className="cc-user-callsign">{u.displayName}</strong>
            <span className="cc-user-fullname">{u.fullName || '—'}</span>
            {meta ? <span className="cc-user-meta">{meta}</span> : null}
          </div>
          <span className={`status-pill cc-user-status ${u.isActive ? 'on' : 'off'}`}>
            {u.isActive ? 'Activo' : 'Inactivo'}
          </span>
          {u.loginLocked ? (
            <span className="status-pill cc-user-status off" title={u.loginLockedReason || 'Bloqueo por intentos'}>
              Login bloqueado
            </span>
          ) : null}
        </div>

        <div className="cc-user-card-fields">
          <div className="cc-user-field">
            <span className="cc-user-field-label">Usuario</span>
            <code className="cc-mono cc-user-mono">{u.username}</code>
            {u.mustChangePassword ? (
              <span className="cc-user-tag" title="Debe cambiar contraseña al entrar">
                clave temporal
              </span>
            ) : null}
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Unidad</span>
            <span className="cc-user-field-value" title={u.zoneName || undefined}>
              {u.unitName || '—'}
              {u.zoneName ? (
                <span className="muted"> · {u.zoneName}</span>
              ) : null}
            </span>
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Matrícula</span>
            <code className="cc-mono cc-user-mono">{u.matricula || '—'}</code>
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Rol</span>
            {canEdit ? (
              <select
                className="cc-user-select"
                value={normalizeClientRole(u.role)}
                onChange={(e) => onChangeRole(u, e.target.value)}
                aria-label={`Rol de ${u.displayName}`}
              >
                {roleChoices.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="cc-user-field-value">{roleLabel(u.role)}</span>
            )}
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Visibilidad</span>
            <div className="cc-priv-row" title="Fijada por el rol (no editable)">
              {visibilityLevelsForRole(u.role).length ? (
                visibilityLevelsForRole(u.role).map((lvl) => {
                  const short =
                    lvl.key === 'canSeeRegion' ? 'R' : lvl.key === 'canSeeZones' ? 'Z' : 'U';
                return (
                    <span
                      key={lvl.key}
                      className="cc-priv-chip on"
                      title={`${lvl.name} (según rol)`}
                  >
                    {short}
                    </span>
                  );
                })
              ) : (
                <span className="muted" title="Alcance por adscripción del rol">
                  —
                </span>
              )}
            </div>
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Alerta</span>
            <span className="cc-user-field-value">{panicLabel}</span>
          </div>
        </div>
      </div>

      <footer className="cc-user-card-actions">
        <button
          type="button"
          className="cc-btn primary cc-btn-sm"
          onClick={() =>
            openPeerSheet({
              id: u.id,
              displayName: u.displayName || u.fullName || u.username,
            })
          }
        >
          Contactar
        </button>
        {canEdit && (
          <>
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onEdit(u)}>
            Editar
          </button>
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onToggleActive(u)}>
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>
          {u.loginLocked && (
            <button type="button" className="cc-btn primary cc-btn-sm" onClick={() => onUnlockLogin(u)}>
              Desbloquear login
            </button>
          )}
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onResetPassword(u)}>
            Restablecer clave
          </button>
          {['unit_user', 'zone_user', 'region_user'].includes(u.role) && (
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onTogglePanicPerm(u)}>
              {u.canReceivePanic ? 'Quitar alerta' : 'Dar alerta'}
            </button>
          )}
          {isRoot && (
            <button type="button" className="cc-btn danger cc-btn-sm" onClick={() => onRemoveUser(u)}>
              Eliminar
            </button>
          )}
          </>
        )}
      </footer>
    </li>
  );
}

export default function DispatchUsers({ session }) {
  const [users, setUsers] = useState([]);
  const [accessProfiles, setAccessProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgTree, setOrgTree] = useState([]);
  const [gradeGroups, setGradeGroups] = useState(EJERCITO_MEXICANO_GRADE_GROUPS);
  const [empleos, setEmpleos] = useState([]);
  const [servicios, setServicios] = useState([]);
  /** Datos extraídos de las coordenadas del servicio: { status, data }. */
  const [serviceGeo, setServiceGeo] = useState({ status: 'idle', data: null });
  /** Poblado / Mpio. / Estado vienen de las coordenadas (se apaga al corregirlos a mano). */
  const [placeAutoFilled, setPlaceAutoFilled] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const serviceCoordsInfo = useMemo(() => analyzeCoords(form.serviceCoords), [form.serviceCoords]);
  const [preview, setPreview] = useState({ username: '', displayName: '', fullName: '' });
  const [step, setStep] = useState('datos'); // 'datos' | 'efectivos' | 'grupos'
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  /** Edición: grupos a los que ya pertenece (null = cargando, false = no se pudo) para guardar solo altas/bajas. */
  const [initialGroupIds, setInitialGroupIds] = useState(null);
  const [efectivosItems, setEfectivosItems] = useState([]);
  const editGroupsForRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  /** null = alta; objeto usuario = edición */
  const [editingUser, setEditingUser] = useState(null);
  /** Edición de uno mismo: solo identidad (sin rol/alcance). Otros: edición completa. */
  const [editBasicsOnly, setEditBasicsOnly] = useState(false);
  const [search, setSearch] = useState('');
  /** Filtros por columna (undefined = todos; [] = ninguno; string[] = parcial). Estilo PV. */
  const [colFilters, setColFilters] = useState({});
  /** Mostrar/ocultar fila de filtros bajo cada th (estilo PV; default oculto). */
  const [filtersVisible, setFiltersVisible] = useState(false);
  /** Columna cuyo menú multi-filtro está abierto. */
  const [openFilterKey, setOpenFilterKey] = useState(null);
  /** Columna de orden (null = sin ordenar); sortDir 1=▲ asc, -1=▼ desc. */
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  /** Tras un drag de columna, el click de cierre no debe ordenar (estilo PV). */
  const thDidDragRef = useRef(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [colConfig, setColConfig] = useState(loadUserColConfig);
  const [exporting, setExporting] = useState(false);
  const colsWrapRef = useRef(null);
  const { toolbarRef, stickyPageStyle } = useAdminStickyToolbarHeight();
  const [colDragIdx, setColDragIdx] = useState(null);
  /** Clave de columna en drag desde `<th>` (null = idle). */
  const [thDragKey, setThDragKey] = useState(null);
  const [thDragOverKey, setThDragOverKey] = useState(null);
  const thDragKeyRef = useRef(null);
  const [moreUserId, setMoreUserId] = useState(null);
  /** Modal de credenciales temporales (alta / restablecer). */
  const [credModal, setCredModal] = useState(null);
  /** Modal solo lectura: grupos del usuario. */
  const [userGroupsModal, setUserGroupsModal] = useState(null);
  /** Confirmación in-app (restablecer / eliminar). */
  const [confirmModal, setConfirmModal] = useState(null);
  const [copied, setCopied] = useState(false);
  /** null | checking | ok | taken | invalid */
  const [matriculaStatus, setMatriculaStatus] = useState(null);
  const [matriculaTakenBy, setMatriculaTakenBy] = useState(null);
  /** Bump al cargar perfiles: refresca labels de columna/selects tras rename en Perfiles. */
  const [roleLabelsVersion, setRoleLabelsVersion] = useState(0);
  const canManage = canManageUsers(session.user) && canViewModule(session.user, 'usuarios');
  const canAddUser = canManage && canModuleAction(session.user, 'usuarios', 'agregar');
  const canEditUser = canManage && canModuleAction(session.user, 'usuarios', 'editar');
  const isRoot = isRootUser(session.user);
  const canExportCsv = canViewModule(session.user, 'usuarios');
  /** Admin de unidad: adscripción fijada a su unidad (no elige otra región/zona/unidad). */
  const isActingUnitAdmin = session.user?.role === 'unit_admin';
  const isActingZoneAdmin = session.user?.role === 'zone_admin';
  const myScopeUnitId =
    session.user?.adminScopeUnitId || session.user?.unitId || '';
  const roleSelectOptions = useMemo(
    () => allowedRoleOptions(session.user?.role),
    [session.user?.role, roleLabelsVersion]
  );
  const profileSelectOptions = useMemo(() => {
    const allowed = new Set(roleSelectOptions.map((r) => r.value));
    return (accessProfiles || []).filter((p) => allowed.has(roleFromAccessProfile(p)));
  }, [accessProfiles, roleSelectOptions]);

  const composedDisplayName = preview.displayName || '';

  const previewUnitId = useMemo(() => {
    if (form.unitChoice && form.unitChoice !== ALC_ALL_UNITS) return form.unitChoice;
    if (form.unitId) return form.unitId;
    return '';
  }, [form.unitChoice, form.unitId]);

  const previewKey = useMemo(
    () =>
      [
        form.grade,
        form.givenNames,
        form.paternalSurname,
        form.maternalSurname,
        form.cargo,
        form.serviceNombre,
        form.role,
        form.regionId,
        form.zoneChoice,
        form.unitChoice,
        previewUnitId,
      ]
        .map((s) => String(s || '').trim())
        .join('|'),
    [
      form.grade,
      form.givenNames,
      form.paternalSurname,
      form.maternalSurname,
      form.cargo,
      form.serviceNombre,
      form.role,
      form.regionId,
      form.zoneChoice,
      form.unitChoice,
      previewUnitId,
    ]
  );

  const orgRegions = useMemo(() => orgTree || [], [orgTree]);

  const orgZones = useMemo(() => {
    if (!form.regionId) return [];
    const region = orgRegions.find((r) => r.id === form.regionId);
    return region?.children || [];
  }, [orgRegions, form.regionId]);

  const selectedZoneId =
    form.zoneChoice && form.zoneChoice !== ALC_ALL_ZONES ? form.zoneChoice : '';

  const orgUnits = useMemo(() => {
    if (!selectedZoneId) return [];
    const zone = orgZones.find((z) => z.id === selectedZoneId);
    return zone?.children || [];
  }, [orgZones, selectedZoneId]);

  const roleNorm = normalizeClientRole(form.role);
  const showRegionAlcance = Boolean(form.role) && roleNorm !== 'root' && !isActingUnitAdmin;
  /** Alcance 3: region_* solo elige región; zona solo para zone_* / unit_*. */
  const regionOnlyRole = roleNorm === 'region_admin' || roleNorm === 'region_user';
  const allowAllZones = false;
  const showZoneStep =
    showRegionAlcance && Boolean(form.regionId) && !regionOnlyRole;
  /** Solo perfiles de unidad bajan a organismo; region_* y zone_* se quedan en zona. */
  const showUnitStep =
    (roleNorm === 'unit_admin' || roleNorm === 'unit_user') &&
    showZoneStep &&
    Boolean(form.zoneChoice) &&
    form.zoneChoice !== ALC_ALL_ZONES;
  const unitMustBeSpecific = roleNorm === 'unit_admin' || roleNorm === 'unit_user';
  const regionName = orgRegions.find((r) => r.id === form.regionId)?.name || 'la región';
  const zoneName = orgZones.find((z) => z.id === selectedZoneId)?.name || 'la zona';

  const activeGroups = useMemo(
    () => (groups || []).filter((g) => g.is_active !== false),
    [groups]
  );

  const colFilterOptions = useMemo(() => {
    const map = {};
    for (const col of USER_TABLE_COLS) {
      const set = new Set();
      for (const u of users) {
        const v = getUserColFilterVal(u, col.key);
        if (v != null && String(v).trim() !== '') set.add(v);
      }
      map[col.key] = [...set].sort((a, b) =>
        String(colFilterOptionLabel(col.key, a)).localeCompare(
          String(colFilterOptionLabel(col.key, b)),
          'es'
        )
      );
    }
    return map;
  }, [users, roleLabelsVersion]);

  const filteredUsers = useMemo(() => {
    let list = users;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.matricula || '').toLowerCase().includes(q) ||
          (u.phone || '').includes(q.replace(/[\s-]/g, '')) ||
          (u.cargo || '').toLowerCase().includes(q) ||
          (u.serviceNombre || '').toLowerCase().includes(q) ||
          (u.serviceGeoMunicipio || '').toLowerCase().includes(q) ||
          (u.serviceGeoEstado || '').toLowerCase().includes(q) ||
          (u.specialty || '').toLowerCase().includes(q) ||
          roleLabel(u.role).toLowerCase().includes(q)
      );
    }
    for (const [key, selected] of Object.entries(colFilters)) {
      if (!usrColFilterIsActive(selected)) continue;
      if (usrColFilterIsNone(selected)) {
        list = [];
        break;
      }
      const allow = new Set(selected);
      list = list.filter((u) => allow.has(getUserColFilterVal(u, key)));
    }
    if (sortCol) {
      list = [...list].sort((a, b) =>
        compareSortValues(getUserSortValue(a, sortCol), getUserSortValue(b, sortCol), sortDir)
      );
    }
    return list;
  }, [users, search, colFilters, roleLabelsVersion, sortCol, sortDir]);

  function toggleColSort(key) {
    /* Un solo camino: no anidar setSortDir dentro de setSortCol
       (Strict Mode ejecuta el updater 2× y el ×-1×-1 deja el mismo sentido). */
    if (sortCol === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortCol(key);
      setSortDir(1);
    }
    setPage(1);
  }

  /** Clic en título → ordenar. El ⠿ es lo único arrastrable (no bloquea el click). */
  function onThTitleSortClick(e, key) {
    if (e.target.closest('.th-drag-icon')) return;
    e.stopPropagation();
    toggleColSort(key);
  }

  const activeColFilterCount = useMemo(
    () => Object.values(colFilters).filter((v) => usrColFilterIsActive(v)).length,
    [colFilters]
  );

  function setColFilter(key, selected) {
    setColFilters((prev) => {
      if (!usrColFilterIsActive(selected)) {
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

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageUsers = filteredUsers.slice((safePage - 1) * USERS_PAGE_SIZE, safePage * USERS_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, colFilters]);

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

  useEffect(() => {
    if (moreUserId == null) return undefined;
    function onDocDown(e) {
      if (!e.target.closest?.('.usr-actions.is-more-open')) setMoreUserId(null);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMoreUserId(null);
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreUserId]);

  function commitColConfig(next) {
    setColConfig(next);
    saveUserColConfig(next);
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
    commitColConfig(defaultUserColConfig());
  }

  function onColDragStart(idx) {
    setColDragIdx(idx);
  }

  function onColDragOver(e, idx) {
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

  const userStats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      shown: filteredUsers.length,
    }),
    [users, filteredUsers]
  );

  async function reload(opts = {}) {
    const silent = opts.silent === true;
    if (!silent && users.length === 0) setLoading(true);
    else setRefreshing(true);
    try {
      const [usersData, groupsData, orgData, catData, profilesData, efectivosData] = await Promise.all([
        fetchAdminUsers(session.token),
        fetchAdminGroups(session.token),
        fetchOrgUnits(session.token).catch(() => ({ tree: [] })),
        fetchGradesEmpleos(session.token).catch(() => null),
        fetchAccessProfiles(session.token).catch(() => null),
        fetchEfectivosCatalog(session.token).catch(() => null),
      ]);
      if (efectivosData?.items) {
        liveEfectivosItems = efectivosData.items;
        setEfectivosItems(efectivosData.items);
      }
      setUsers(usersData.users || []);
      setOrgTree(orgData.tree || []);
      setGroups(groupsData.groups || []);
      if (profilesData?.profiles) {
        applyLiveRoleLabels(profilesData.profiles);
        setAccessProfiles(profilesData.profiles);
        setRoleLabelsVersion((v) => v + 1);
      }
      if (catData?.grades?.length) {
        const map = new Map();
        for (const g of catData.grades) {
          const key = g.category || 'Grados';
          if (!map.has(key)) map.set(key, []);
          map.get(key).push({ value: g.abbreviation, label: g.name });
        }
        const order = new Map((catData.jerarquias || []).map((j, i) => [j.name, i]));
        setGradeGroups(
          [...map.entries()]
            .sort((a, b) => {
              const ia = order.has(a[0]) ? order.get(a[0]) : 999;
              const ib = order.has(b[0]) ? order.get(b[0]) : 999;
              if (ia !== ib) return ia - ib;
              return a[0].localeCompare(b[0], 'es');
            })
            .map(([label, options]) => ({ label, options }))
        );
      }
      setEmpleos(catData?.empleos || []);
      setServicios(catData?.servicios || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    reload().catch(() => {});
  }, [session.token]);

  function unitAdminLockedPath(tree = orgTree) {
    if (!isActingUnitAdmin || !myScopeUnitId) {
      return { regionId: '', zoneId: '', unitId: '' };
    }
    const path = findOrgPath(tree, myScopeUnitId, myScopeUnitId);
    return {
      regionId: path.regionId || '',
      zoneId: path.zoneId || '',
      unitId: path.unitId || myScopeUnitId,
    };
  }

  function withUnitAdminOrgLock(base) {
    if (!isActingUnitAdmin) return base;
    const locked = unitAdminLockedPath();
    const unitUserProfile =
      accessProfiles.find((p) => String(p.code || '') === 'unit_user') || null;
    return {
      ...base,
      role: 'unit_user',
      profileId: unitUserProfile?.id || base.profileId || '',
      regionId: locked.regionId,
      zoneId: locked.zoneId,
      unitId: locked.unitId,
      zoneChoice: locked.zoneId || '',
      unitChoice: locked.unitId || '',
    };
  }

  function openCreateModal() {
    resetCreateFlow();
    setEditingUser(null);
    setEditBasicsOnly(false);
    setCreateOpen(true);
  }

  function openEditModal(u) {
    if (!canManage) return;
    const flags = userEditFlags(session.user, u);
    if (!flags.canEdit) return;
    const path = findOrgPath(orgTree, u.unitId, u.adminScopeUnitId);
    const alc = alcanceChoicesFromUser(u, orgTree);
    const role = normalizeClientRole(u.role) || 'unit_user';
    const profileId =
      u.profileId ||
      accessProfiles.find((p) => String(p.code || '') === role)?.id ||
      '';
    setEditingUser(u);
    setEditBasicsOnly(flags.basicsOnly);
    setForm(
      withUnitAdminOrgLock({
      grade: u.grade || '',
      specialty: u.specialty || '',
      cargo: u.cargo || '',
      serviceNombre: u.serviceNombre || '',
      serviceCoords: formatCoords(u.serviceLat, u.serviceLng),
      serviceLocalidad: u.serviceGeoLocalidad || '',
      serviceMunicipio: u.serviceGeoMunicipio || '',
      serviceEstado: u.serviceGeoEstado || '',
      serviceEfectivos: Object.fromEntries(
        Object.entries(u.serviceEfectivos || {}).map(([id, n]) => [id, String(n)])
      ),
      givenNames: u.givenNames || '',
      paternalSurname: u.paternalSurname || '',
      maternalSurname: u.maternalSurname || '',
      matricula: formatMatriculaInput(u.matricula || ''),
      phone: formatPhoneInput(u.phone || ''),
        role,
        profileId,
        regionId: alc.regionId || path.regionId || '',
        zoneChoice: alc.zoneChoice || '',
        unitChoice: alc.unitChoice || '',
      zoneId: path.zoneId || '',
      unitId: path.unitId || u.unitId || '',
      adminScopeUnitId: u.adminScopeUnitId || '',
        ...visibilityForRole(role),
      })
    );
    setPreview({
      username: u.username || '',
      displayName: u.displayName || '',
      fullName: u.fullName || '',
    });
    setStep('datos');
    setSelectedGroupIds([]);
    setInitialGroupIds(null);
    setPlaceAutoFilled(false);
    setError('');
    setCreateOpen(true);
    editGroupsForRef.current = u.id;
    if (!flags.basicsOnly) {
      fetchAdminUserGroups(session.token, u.id)
        .then((data) => {
          if (editGroupsForRef.current !== u.id) return;
          const ids = (data.groups || []).map((g) => g.id);
          setInitialGroupIds(ids);
          setSelectedGroupIds(ids);
        })
        .catch((err) => {
          if (editGroupsForRef.current === u.id) {
            setInitialGroupIds(false);
            setError(`No se pudieron cargar los grupos del usuario: ${err.message}`);
          }
        });
    }
  }

  function closeCreateModal() {
    if (busy) return;
    setCreateOpen(false);
    setEditingUser(null);
    setEditBasicsOnly(false);
    resetCreateFlow();
  }

  useEffect(() => {
    if (!createOpen) return undefined;
    const text = String(form.serviceCoords || '').trim();
    if (!text) {
      setServiceGeo({ status: 'idle', data: null });
      return undefined;
    }
    const c = parseCoords(text);
    if (!c) {
      setServiceGeo({ status: 'invalid', data: null });
      return undefined;
    }
    if (
      editingUser &&
      editingUser.serviceGeoEstado &&
      formatCoords(editingUser.serviceLat, editingUser.serviceLng) === formatCoords(c.lat, c.lng)
    ) {
      setServiceGeo({ status: 'ok', data: userServiceGeo(editingUser) });
      return undefined;
    }
    const ac = new AbortController();
    setServiceGeo({ status: 'loading', data: null });
    const t = setTimeout(() => {
      geoAdminAt(session.token, c.lat, c.lng, ac.signal)
        .then((data) => {
          setServiceGeo({ status: 'ok', data });
          if (data?.localidad || data?.municipio || data?.estado) {
            setForm((f) => ({
              ...f,
              serviceLocalidad: data.localidad || '',
              serviceMunicipio: data.municipio || '',
              serviceEstado: data.estado || '',
            }));
            setPlaceAutoFilled(true);
          }
        })
        .catch(() => {
          if (!ac.signal.aborted) setServiceGeo({ status: 'error', data: null });
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [form.serviceCoords, createOpen, editingUser, session.token]);

  useEffect(() => {
    if (!canManage || !createOpen) return;
    if (!form.grade.trim() || !form.givenNames.trim() || !form.paternalSurname.trim()) {
      if (!editingUser) {
        setPreview({ username: '', displayName: '', fullName: '' });
      }
      return;
    }
    let cancelled = false;
    const previewRole = isActingUnitAdmin ? 'unit_user' : form.role;
    const previewScope = orgScopeForSave(previewRole, form, {
      actingUnitAdmin: isActingUnitAdmin,
      myScopeUnitId,
    });
    const t = setTimeout(() => {
      previewAdminUsername(session.token, {
        grade: form.grade,
        givenNames: form.givenNames,
        paternalSurname: form.paternalSurname,
        maternalSurname: form.maternalSurname,
        cargo: form.cargo,
        serviceNombre: form.serviceNombre,
        role: previewScope.role || previewRole || undefined,
        unitId: previewScope.unitId || previewUnitId || undefined,
        adminScopeUnitId: previewScope.adminScopeUnitId || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          setPreview({
            username: editingUser?.username || data.username || '',
            displayName: data.displayName || data.callSign || '',
            fullName: data.fullName || '',
          });
        })
        .catch(() => {
          if (!cancelled && !editingUser) {
            setPreview({ username: '', displayName: '', fullName: '' });
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewKey, canManage, session.token, createOpen, editingUser]);

  function resetCreateFlow() {
    setForm(withUnitAdminOrgLock({ ...EMPTY_FORM }));
    setPreview({ username: '', displayName: '', fullName: '' });
    setStep('datos');
    setSelectedGroupIds([]);
    setInitialGroupIds(null);
    editGroupsForRef.current = null;
    setPlaceAutoFilled(false);
    setMatriculaStatus(null);
    setMatriculaTakenBy(null);
  }

  /** Cuando llega el árbol org, rellena la cascada fijada del admin de unidad. */
  useEffect(() => {
    if (!isActingUnitAdmin || !createOpen || !orgTree.length || !myScopeUnitId) return;
    const locked = unitAdminLockedPath(orgTree);
    if (!locked.regionId && !locked.unitId) return;
    const unitUserProfileId =
      accessProfiles.find((p) => String(p.code || '') === 'unit_user')?.id || '';
    setForm((prev) => {
      if (
        prev.regionId === locked.regionId &&
        prev.zoneId === locked.zoneId &&
        prev.unitId === locked.unitId &&
        prev.zoneChoice === locked.zoneId &&
        prev.unitChoice === locked.unitId &&
        prev.role === 'unit_user' &&
        (!unitUserProfileId || prev.profileId === unitUserProfileId)
      ) {
        return prev;
      }
      return {
        ...prev,
        role: 'unit_user',
        profileId: unitUserProfileId || prev.profileId,
        regionId: locked.regionId,
        zoneId: locked.zoneId,
        unitId: locked.unitId,
        zoneChoice: locked.zoneId || '',
        unitChoice: locked.unitId || '',
      };
    });
  }, [isActingUnitAdmin, createOpen, orgTree, myScopeUnitId, accessProfiles]);

  /** Edición: si el árbol llegó tarde, rehidratar cascada PV (zoneChoice/unitChoice). */
  useEffect(() => {
    if (!createOpen || !editingUser || !orgTree.length || isActingUnitAdmin) return;
    const alc = alcanceChoicesFromUser(editingUser, orgTree);
    if (!alc.regionId && !alc.zoneChoice && !alc.unitChoice) return;
    setForm((prev) => {
      if (prev.regionId && prev.zoneChoice) return prev;
      return {
        ...prev,
        regionId: prev.regionId || alc.regionId || '',
        zoneChoice: prev.zoneChoice || alc.zoneChoice || '',
        unitChoice: prev.unitChoice || alc.unitChoice || '',
      };
    });
  }, [createOpen, editingUser, orgTree, isActingUnitAdmin]);

  useEffect(() => {
    if (!createOpen || !canManage) return undefined;
    const raw = String(form.matricula || '').trim();
    if (!raw || raw.length < 3) {
      setMatriculaStatus(null);
      setMatriculaTakenBy(null);
      return undefined;
    }
    if (!isValidMatricula(raw)) {
      setMatriculaStatus('invalid');
      setMatriculaTakenBy(null);
      return undefined;
    }
    let cancelled = false;
    setMatriculaStatus('checking');
    const t = setTimeout(() => {
      checkAdminMatricula(session.token, {
        matricula: formatMatriculaInput(raw),
        excludeUserId: editingUser?.id || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          if (!data?.valid) {
            setMatriculaStatus('invalid');
            setMatriculaTakenBy(null);
            return;
          }
          if (data.taken) {
            setMatriculaStatus('taken');
            setMatriculaTakenBy(data.user || null);
          } else {
            setMatriculaStatus('ok');
            setMatriculaTakenBy(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMatriculaStatus(null);
            setMatriculaTakenBy(null);
          }
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.matricula, createOpen, canManage, session.token, editingUser?.id]);

  /** Generales → Efectivos: identidad, contacto y (salvo edición propia) perfil y organismo. */
  function goToEfectivosStep(e) {
    e.preventDefault();
    if (!form.grade.trim() || !form.matricula.trim()) {
      setError('Completa grado y matrícula.');
      return;
    }
    if (!isValidMatricula(form.matricula)) {
      const { letter } = splitMatricula(form.matricula);
      const max = matriculaDigitMax(letter || 'B');
      setError(
        `Matrícula inválida: A-/B-/C-/D- y ${max} números (ej. ${letter === 'A' ? 'A-12345678' : 'D-1412643'}).`,
      );
      return;
    }
    if (matriculaStatus === 'taken') {
      setError(
        matriculaTakenBy?.username
          ? `La matrícula ya está registrada (usuario ${matriculaTakenBy.username}).`
          : 'La matrícula ya está registrada.',
      );
      return;
    }
    if (matriculaStatus === 'checking') {
      setError('Espera a verificar la matrícula…');
      return;
    }
    if (!preview.username || !composedDisplayName) {
      setError('Completa grado, nombre y apellido paterno.');
      return;
    }
    const phoneErr = phoneValidationError(form.phone, Boolean(editingUser));
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (!serviceCoordsPayload(form.serviceCoords)) {
      setError('Ubicación: escribe las coordenadas como «latitud, longitud» (ej. 22.233100, -97.861100).');
      return;
    }
    if (!(editingUser && editBasicsOnly) && !adscripcionValid()) return;
    setError('');
    setStep('efectivos');
  }

  /** Perfil de acceso y organismo de pertenencia (sección de Generales). */
  function adscripcionValid() {
    if (isActingUnitAdmin && !myScopeUnitId) {
      setError('Tu cuenta no tiene unidad asignada; pide a un administrador que te asigne alcance.');
      return false;
    }
    if (!isActingUnitAdmin && (!String(form.role || '').trim() || !String(form.profileId || '').trim())) {
      setError('Selecciona el perfil de acceso.');
      return false;
    }
    const lockedRole = isActingUnitAdmin ? 'unit_user' : form.role;
    if (normalizeClientRole(lockedRole) !== 'root') {
      const probe = orgScopeForSave(lockedRole, form, {
        actingUnitAdmin: isActingUnitAdmin,
        myScopeUnitId,
      });
      if (probe.error) {
        setError(probe.error);
        return false;
      }
    }
    return true;
  }

  /** Efectivos → Grupos (edición propia: guarda aquí). */
  function goToGroupsStep(e) {
    e.preventDefault();
    setError('');
    if (editingUser && editBasicsOnly) {
      onSaveEdit();
      return;
    }
    setStep('grupos');
  }

  /** Anexa un concepto al grupo de efectivos (catálogo de la organización). */
  async function addEfectivoItem(grupo) {
    const label = efectivosGrupoLabel(grupo);
    const name = String(window.prompt(`Nuevo concepto en ${label}:`) || '').trim();
    if (!name) return;
    try {
      const { item } = await createEfectivoItem(session.token, grupo, name);
      const next = [...efectivosItems, item];
      liveEfectivosItems = next;
      setEfectivosItems(next);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  /** Quita un concepto del catálogo (deja de aparecer para todos los usuarios). */
  async function removeEfectivoItem(item) {
    const label = efectivosGrupoLabel(item.grupo);
    const ok = window.confirm(
      `¿Quitar «${item.name}» de ${label}?\n\nDeja de aparecer en el paso Efectivos de todos los usuarios, en la relación y en el Excel.`
    );
    if (!ok) return;
    try {
      await deleteEfectivoItem(session.token, item.id);
      const next = efectivosItems.filter((it) => it.id !== item.id);
      liveEfectivosItems = next;
      setEfectivosItems(next);
      setForm((prev) => {
        const { [item.id]: _removed, ...rest } = prev.serviceEfectivos || {};
        return { ...prev, serviceEfectivos: rest };
      });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  /** Edición: aplica solo las altas/bajas de grupos respecto a lo que ya tenía. */
  async function syncEditGroups(userId, role) {
    if (!initialGroupIds) return;
    const memberRole = /_user$/.test(normalizeClientRole(role)) ? 'member' : 'leader';
    const current = new Set(initialGroupIds);
    const wanted = new Set(selectedGroupIds);
    const groupName = (gid) => activeGroups.find((g) => g.id === gid)?.name || 'grupo';
    const run = async (gid, fn) => {
      try {
        await fn();
      } catch (err) {
        throw new Error(`Datos guardados, pero el grupo «${groupName(gid)}» no se actualizó: ${err.message}`);
      }
    };
    for (const gid of selectedGroupIds) {
      if (current.has(gid)) continue;
      await run(gid, () => addGroupMember(session.token, gid, userId, memberRole));
      current.add(gid);
      setInitialGroupIds([...current]);
    }
    const shown = new Set(activeGroups.map((g) => g.id));
    for (const gid of initialGroupIds) {
      if (wanted.has(gid) || !shown.has(gid)) continue;
      await run(gid, () => removeGroupMember(session.token, gid, userId));
      current.delete(gid);
      setInitialGroupIds([...current]);
    }
  }

  function toggleGroup(id) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSaveEdit() {
    if (!editingUser) return;
    if (!isValidMatricula(form.matricula)) {
      const { letter } = splitMatricula(form.matricula);
      const max = matriculaDigitMax(letter || 'B');
      setError(
        `Matrícula inválida: A-/B-/C-/D- y ${max} números (ej. ${letter === 'A' ? 'A-12345678' : 'D-1412643'}).`,
      );
      return;
    }
    if (matriculaStatus === 'taken') {
      setError(
        matriculaTakenBy?.username
          ? `La matrícula ya está registrada (usuario ${matriculaTakenBy.username}).`
          : 'La matrícula ya está registrada.',
      );
      return;
    }
    const phoneErr = phoneValidationError(form.phone, true);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    const coordsPayload = serviceCoordsPayload(form.serviceCoords);
    if (!coordsPayload) {
      setError(`Ubicación: ${analyzeCoords(form.serviceCoords).error || 'coordenadas no válidas.'}`);
      return;
    }
    setBusy(true);
    try {
      if (editBasicsOnly) {
      await patchAdminUser(session.token, editingUser.id, {
        grade: form.grade,
        specialty: form.specialty || null,
        cargo: form.cargo || null,
        serviceNombre: form.serviceNombre || null,
        ...coordsPayload,
        ...servicePlacePayload(form),
        ...efectivosPayload(form),
        givenNames: form.givenNames,
        paternalSurname: form.paternalSurname,
        maternalSurname: form.maternalSurname || null,
        matricula: formatMatriculaInput(form.matricula),
        phone: form.phone || null,
        });
      } else {
        const lockedRole = isActingUnitAdmin ? 'unit_user' : form.role;
        const scope = orgScopeForSave(lockedRole, form, {
          actingUnitAdmin: isActingUnitAdmin,
          myScopeUnitId,
        });
        if (scope.error) {
          setError(scope.error);
          setBusy(false);
          return;
        }
        if (!form.profileId && !isActingUnitAdmin) {
          setError('Selecciona el perfil de acceso.');
          setBusy(false);
          return;
        }
        await patchAdminUser(session.token, editingUser.id, {
          grade: form.grade,
          specialty: form.specialty || null,
          cargo: form.cargo || null,
          serviceNombre: form.serviceNombre || null,
          ...coordsPayload,
          ...servicePlacePayload(form),
          ...efectivosPayload(form),
          givenNames: form.givenNames,
          paternalSurname: form.paternalSurname,
          maternalSurname: form.maternalSurname || null,
          matricula: formatMatriculaInput(form.matricula),
          phone: form.phone || null,
          role: scope.role || lockedRole,
          profileId: form.profileId || undefined,
          unitId: scope.unitId ?? null,
          adminScopeUnitId: scope.adminScopeUnitId ?? null,
          ...visibilityForRole(scope.role || lockedRole),
        });
        await syncEditGroups(editingUser.id, scope.role || lockedRole);
      }
      setEditingUser(null);
      setEditBasicsOnly(false);
      setCreateOpen(false);
      resetCreateFlow();
      await reload({ silent: true });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const lockedRole = isActingUnitAdmin ? 'unit_user' : form.role;
      const scope = orgScopeForSave(lockedRole, form, {
        actingUnitAdmin: isActingUnitAdmin,
        myScopeUnitId,
      });
      if (scope.error) {
        setError(scope.error);
        setBusy(false);
        return;
      }
      if (!form.profileId && !isActingUnitAdmin) {
        setError('Selecciona el perfil de acceso.');
        setBusy(false);
        return;
      }
      const coordsPayload = serviceCoordsPayload(form.serviceCoords);
      if (!coordsPayload) {
        setError(`Ubicación: ${analyzeCoords(form.serviceCoords).error || 'coordenadas no válidas.'}`);
        setBusy(false);
        return;
      }
      const { serviceCoords: _coordsText, ...formFields } = form;
      const created = await createAdminUser(session.token, {
        ...formFields,
        ...coordsPayload,
        ...servicePlacePayload(form),
        ...efectivosPayload(form),
        role: scope.role || lockedRole,
        profileId: form.profileId || undefined,
        matricula: formatMatriculaInput(form.matricula),
        unitId: scope.unitId || undefined,
        adminScopeUnitId: scope.adminScopeUnitId || undefined,
        ...visibilityForRole(scope.role || lockedRole),
        groupIds: selectedGroupIds,
      });
      resetCreateFlow();
      setEditingUser(null);
      setCreateOpen(false);
      await reload({ silent: true });
      setError('');
      const gNames = (created.groups || []).map((g) => g.name).join(', ');
      setCredModal({
        title: 'Usuario creado',
        username: created.user?.username || '',
        temporaryPassword: created.temporaryPassword || '',
        hint: 'Debe cambiarla en el primer ingreso.',
        groups: gNames || 'Sin grupos',
      });
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    try {
      await patchAdminUser(session.token, u.id, { isActive: !u.isActive });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function unlockLogin(u) {
    try {
      await unlockAdminUserLogin(session.token, u.id);
      await reload({ silent: true });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function forceLogout(u) {
    const name = u.displayName || u.username || 'este usuario';
    if (!window.confirm(`¿Cerrar todas las sesiones de ${name} (web y app)?`)) return;
    try {
      await forceLogoutAdminUser(session.token, u.id);
      setError('');
      setMoreUserId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePanicPerm(u) {
    try {
      await patchAdminUser(session.token, u.id, { canReceivePanic: !u.canReceivePanic });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(u, role) {
    try {
      const vis = visibilityForRole(role);
      const path = findOrgPath(orgTree, u.unitId, u.adminScopeUnitId);
      let scopePatch = {};
      if (role === 'unit_admin') {
        const scopeUnit = u.unitId || u.adminScopeUnitId || path.unitId;
        if (!scopeUnit) {
          setError('Para Admin de unidad el usuario necesita Unidad. Ábrelo en Editar.');
          return;
        }
        scopePatch = { unitId: scopeUnit, adminScopeUnitId: scopeUnit };
      } else if (role === 'unit_user') {
        const scopeUnit = u.unitId || path.unitId;
        if (!scopeUnit) {
          setError('Para Usuario de unidad el usuario necesita Unidad. Ábrelo en Editar.');
          return;
        }
        scopePatch = { unitId: scopeUnit };
      } else if (role === 'zone_admin') {
        const zoneId = u.adminScopeUnitId || path.zoneId;
        if (!zoneId) {
          setError('Para Admin de zona elige Zona en Editar (alcance).');
          return;
        }
        scopePatch = { adminScopeUnitId: zoneId };
      } else if (role === 'zone_user') {
        const anchor = u.unitId || u.adminScopeUnitId || path.unitId || path.zoneId;
        if (!anchor) {
          setError('Para Usuario de zona elige Zona en Editar (adscripción).');
          return;
        }
        scopePatch = { unitId: anchor, adminScopeUnitId: null };
      } else if (role === 'region_admin' || role === 'root') {
        scopePatch = { adminScopeUnitId: null };
      }
      await patchAdminUser(session.token, u.id, { role, ...vis, ...scopePatch });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  function resetPassword(u) {
    setConfirmModal({
      title: 'Restablecer contraseña',
      message: `¿Generar contraseña temporal para ${u.displayName || u.username}? Deberá cambiarla al entrar.`,
      confirmLabel: 'Generar clave',
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const data = await patchAdminUser(session.token, u.id, { resetPassword: true });
          setError('');
          setCredModal({
            title: 'Contraseña restablecida',
            username: u.username,
            temporaryPassword: data.temporaryPassword || '',
            hint: 'Debe cambiarla en el próximo ingreso.',
            groups: null,
          });
          setCopied(false);
          await reload({ silent: true });
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function removeUser(u) {
    setConfirmModal({
      title: 'Eliminar usuario',
      message: `¿Eliminar a ${u.displayName || u.username}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteAdminUser(session.token, u.id);
          await reload({ silent: true });
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  async function openUserGroups(u) {
    setMoreUserId(null);
    setUserGroupsModal({
      userId: u.id,
      displayName: u.displayName || u.username,
      username: u.username,
      loading: true,
      error: null,
      groups: [],
    });
    try {
      const data = await fetchAdminUserGroups(session.token, u.id);
      setUserGroupsModal((prev) =>
        prev && prev.userId === u.id
          ? {
              ...prev,
              loading: false,
              groups: Array.isArray(data.groups) ? data.groups : [],
              displayName: data.displayName || prev.displayName,
              username: data.username || prev.username,
            }
          : prev
      );
    } catch (err) {
      setUserGroupsModal((prev) =>
        prev && prev.userId === u.id
          ? { ...prev, loading: false, error: err.message || 'No se pudieron cargar los grupos' }
          : prev
      );
    }
  }

  async function copyCredentials() {
    if (!credModal?.temporaryPassword) return;
    const text = [
      `Usuario: ${credModal.username}`,
      `Contraseña temporal: ${credModal.temporaryPassword}`,
      credModal.hint,
      credModal.groups ? `Grupos: ${credModal.groups}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  /** Exportar (estilo Parque Vehicular): columnas visibles en su orden, lista filtrada. */
  async function exportUsersExcel() {
    const visible = colConfig.filter((c) => c.visible !== false && USER_EXPORT_COLS[c.key]);
    if (!visible.length) {
      setError('No hay columnas visibles para exportar.');
      return;
    }
    if (!filteredUsers.length) {
      setError('No hay usuarios para exportar con los filtros actuales.');
      return;
    }
    const cols = visible.flatMap((c) => USER_EXPORT_COLS[c.key]);
    const filters = [];
    const q = search.trim();
    if (q) filters.push(`Búsqueda: ${q}`);
    for (const [key, selected] of Object.entries(colFilters)) {
      if (!usrColFilterIsActive(selected)) continue;
      const label = USER_TABLE_COLS.find((c) => c.key === key)?.label || key;
      filters.push(`${label}: ${usrColFilterIsNone(selected) ? 'ninguno' : selected.join(', ')}`);
    }
    const me = session.user || {};
    const meName = String(me.displayName || me.username || '').trim();
    const meRole = me.role ? roleLabel(me.role) : '';
    setExporting(true);
    try {
      await exportInstitutionalReport({
        sheetName: 'Usuarios',
        title: 'Reporte de Usuarios',
        module: 'Usuarios',
        exportedBy: meRole && meName ? `${meName} · ${meRole}` : meName || 'Usuario',
        filters,
        headers: cols.map(([label]) => label),
        rows: filteredUsers.map((u) => cols.map(([, get]) => get(u))),
        summary: buildUsersExportSummary(filteredUsers, visible.map((c) => c.key)),
      });
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo exportar a Excel.');
    } finally {
      setExporting(false);
    }
  }

  function downloadCsv() {
    fetch(usersCsvUrl(), {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo exportar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tacticalptx-usuarios.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e.message));
  }

  const datosChecklist = useMemo(
    () => [
      { label: 'Grado', ok: fieldFilled(form.grade) },
      { label: 'Nombre(s)', ok: fieldFilled(form.givenNames) },
      { label: 'Apellido paterno', ok: fieldFilled(form.paternalSurname) },
      { label: 'Matrícula', ok: isValidMatricula(form.matricula) && matriculaStatus !== 'taken' },
      {
        label: 'No. de teléfono',
        ok: editingUser && !fieldFilled(form.phone) ? true : isValidPhone(form.phone),
      },
      { label: 'Usuario generado', ok: fieldFilled(preview.username) },
      { label: 'Indicativo', ok: fieldFilled(composedDisplayName) },
    ],
    [form, preview, composedDisplayName, matriculaStatus, editingUser]
  );

  const adscripcionChecklist = useMemo(() => {
    const profileItem = {
      label: 'Perfil de acceso',
      ok: isActingUnitAdmin ? true : fieldFilled(form.profileId),
    };
    if (roleNorm === 'root') {
      return [profileItem, { label: 'Alcance: todas las regiones', ok: true }];
    }
    if (isActingUnitAdmin) {
      return [
        profileItem,
        { label: 'Unidad (fija)', ok: fieldFilled(form.unitChoice || form.unitId) },
      ];
    }
    const items = [profileItem, { label: 'Región', ok: fieldFilled(form.regionId) }];
    if (roleNorm === 'region_admin' || roleNorm === 'region_user') {
      return items;
    }
    if (showZoneStep) {
      items.push({
        label: 'Zona / C.G.',
        ok: fieldFilled(form.zoneChoice),
      });
    }
    if (showUnitStep) {
      items.push({
        label: unitMustBeSpecific ? 'Unidad *' : 'Unidad (o todos los org.)',
        ok: fieldFilled(form.unitChoice),
      });
    }
    return items;
  }, [
    form,
    isActingUnitAdmin,
    roleNorm,
    showZoneStep,
    showUnitStep,
    unitMustBeSpecific,
  ]);

  return (
    <div className="dispatch-page cc-users-page" style={stickyPageStyle}>
      <header ref={toolbarRef} className="cc-groups-toolbar">
        <div className="cc-groups-toolbar-start">
          <h1>Usuarios</h1>
        </div>
        <div className="cc-groups-toolbar-end">
          <label className="cc-groups-search">
            <span className="visually-hidden">Buscar usuario</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              disabled={loading}
            />
          </label>
          <div className="cc-groups-toolbar-actions">
            <div className="usr-table-tools">
              <button
                type="button"
                className="usr-btn-report"
                title="Exportar columnas visibles a Excel"
                disabled={loading || exporting || filteredUsers.length === 0}
                onClick={exportUsersExcel}
              >
                {USR_EXPORT_BTN_SVG}
                {exporting ? 'Exportando…' : 'Exportar'}
              </button>
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
                {USR_FILTER_BTN_SVG}
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
                  {USR_COLS_BTN_SVG}
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
                          onDragOver={(e) => onColDragOver(e, idx)}
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
            {canAddUser ? (
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
                  onClick={openCreateModal}
                >
                  {NEW_CHANNEL_BTN_SVG}
                  Nuevo usuario
                </button>
          </span>
            ) : null}
        </div>
      </div>
      </header>

      {error && !createOpen && <p className="error">{error}</p>}

      <div className={`cc-users-list-wrap${refreshing ? ' is-refreshing' : ''}`}>
        {loading ? (
          <ul className="cc-users-list" aria-busy="true" aria-label="Cargando usuarios">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="cc-user-card cc-user-card--skeleton">
                <div className="cc-user-card-main">
                  <div className="cc-user-card-id">
                    <span className="cc-user-avatar cc-skeleton-bar" />
                    <div className="cc-user-card-head" style={{ flex: 1 }}>
                      <span className="cc-skeleton-bar" style={{ width: '55%' }} />
                      <span className="cc-skeleton-bar" style={{ width: '75%', marginTop: 6 }} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : users.length === 0 ? (
          <div className="cc-users-empty">
            <p>Aún no hay usuarios registrados.</p>
            {canManage && (
              <button type="button" className="cc-btn primary" onClick={openCreateModal}>
                Crear primer usuario
              </button>
            )}
          </div>
        ) : (
          <div className="usr-table-wrap">
            <table className="usr-users-table">
              <thead>
                <tr>
                  {visibleOrderedCols.map((c) => (
                    <th
                      key={c.key}
                      className={[
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
                          <UsrThFilterMulti
                            colKey={c.key}
                            colLabel={c.label}
                            options={colFilterOptions[c.key] || []}
                            selected={colFilters[c.key]}
                            open={openFilterKey === c.key}
                            onOpenChange={(next) =>
                              setOpenFilterKey(next ? c.key : null)
                            }
                            onChange={(sel) => setColFilter(c.key, sel)}
                            disabled={loading}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="usr-actions-th">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.length === 0 ? (
                  <tr className="usr-empty-row">
                    <td colSpan={Math.max(1, visibleOrderedCols.length + 1)}>
                      Ningún usuario coincide con la búsqueda o filtros.
                    </td>
                  </tr>
                ) : null}
                {pageUsers.map((u) => {
                  const { canEdit, canDelete, basicsOnly } = userEditFlags(session.user, u);
                  return (
                    <tr key={u.id}>
                      {visibleOrderedCols.map((c) => (
                        <td key={c.key} className={c.key === 'name' ? 'usr-name' : undefined}>
                          {userTableCell(u, c.key)}
                        </td>
                      ))}
                      <td className={`usr-actions${moreUserId === u.id ? ' is-more-open' : ''}`}>
                        {canEdit && (
                          <button type="button" className="cc-btn primary cc-btn-sm" onClick={() => openEditModal(u)}>
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="cc-btn danger cc-btn-sm" onClick={() => removeUser(u)}>
                            Eliminar
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            className="cc-btn ghost cc-btn-sm"
                            onClick={() => setMoreUserId((id) => (id === u.id ? null : u.id))}
                          >
                            Más
                          </button>
                        )}
                        {moreUserId === u.id && (
                          <div className="usr-more">
                            {canManage && (
                              <button type="button" onClick={() => openUserGroups(u)}>
                                Ver grupos
                              </button>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => { setMoreUserId(null); resetPassword(u); }}>
                                Restablecer clave
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={() => { setMoreUserId(null); toggleActive(u); }}>
                                {u.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                            {u.loginLocked && (
                              <button type="button" onClick={() => { setMoreUserId(null); unlockLogin(u); }}>
                                Desbloquear
                              </button>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => forceLogout(u)}>
                                Cerrar sesiones
                              </button>
                            )}
                            {['unit_user', 'zone_user', 'region_user'].includes(u.role) && canEdit && (
                              <button type="button" onClick={() => { setMoreUserId(null); togglePanicPerm(u); }}>
                                {u.canReceivePanic ? 'Quitar alerta' : 'Dar alerta'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="usr-pager">
              <span className="usr-pager-info">
                Mostrando {pageUsers.length} de {filteredUsers.length} usuarios · Página {safePage} de {pageCount}
              </span>
              <div className="usr-pager-btns">
                <button
                  type="button"
                  className="usr-pg-btn usr-pg-btn-edge"
                  title="Primera página"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                >
                  «
                </button>
                <button
                  type="button"
                  className="usr-pg-btn"
                  title="Página anterior"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {usrPagerPages(safePage, pageCount).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`usr-pg-btn${n === safePage ? ' active' : ''}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="usr-pg-btn"
                  title="Página siguiente"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="usr-pg-btn usr-pg-btn-edge"
                  title="Última página"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(pageCount)}
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {createOpen && (editingUser ? canEditUser : canAddUser) && (
        <div
          className="sys-modal-backdrop"
          role="presentation"
        >
          <div
            className="sys-modal sys-modal--lg cc-users-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sys-modal-head">
              <h2 id="create-user-title">
                {editingUser
                  ? editBasicsOnly
                    ? 'Editar datos básicos'
                    : 'Editar usuario'
                  : 'Alta de usuario'}
              </h2>
              <button
                type="button"
                className="sys-modal-x"
                aria-label="Cerrar"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </header>
            <form
              className="admin-form cc-users-create-form"
              onSubmit={
                step === 'datos'
                  ? goToEfectivosStep
                  : step === 'efectivos'
                    ? goToGroupsStep
                    : editingUser
                      ? (e) => {
                          e.preventDefault();
                          onSaveEdit();
                        }
                      : onCreate
              }
            >
              <CreateStepIndicator
                step={step}
                editMode={Boolean(editingUser)}
                basicsOnly={editBasicsOnly}
              />
              {error ? (
                <p className="error" role="alert" style={{ margin: '0.5rem 0 0.75rem' }}>
                  {error}
                </p>
              ) : null}
              {editBasicsOnly && editingUser ? (
                <p className="cc-group-pick-hint" style={{ marginTop: 0 }}>
                  Estás editando tu propia cuenta: solo identidad (grado, nombres, matrícula,
                  cargo). Perfil y alcance no se modifican aquí.
                </p>
              ) : null}
          {step === 'datos' && (
            <>
              <UserFormFicha
                displayName={composedDisplayName}
                username={preview.username}
                fullName={preview.fullName}
                distintivo={formatDistintivo(form.cargo, form.serviceNombre)}
                initials={[form.givenNames, form.paternalSurname]
                  .map((s) => String(s || '').trim().charAt(0).toUpperCase())
                  .join('')}
              />
              <MissingFieldsList
                items={editBasicsOnly ? datosChecklist : [...datosChecklist, ...adscripcionChecklist]}
              />
              <section className="cc-form-section">
                <FormSectionTitle icon="identidad" hint="Grado, especialidad y matrícula">
                  Identidad militar
                </FormSectionTitle>
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field">
                    <span>Grado *</span>
                    <select
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      required
                    >
                      <option value="" disabled>
                        Selecciona grado
                      </option>
                      {gradeGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.value}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Especialidad / Empleo</span>
                    {empleos.length > 0 ? (
                      <select
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      >
                        <option value="">—</option>
                        {empleos.map((e) => (
                          <option key={e.id} value={e.name}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                        placeholder="TIC, Inf., Com…"
                      />
                    )}
                  </label>
                  <label className="field">
                    <span>
                      Matrícula *{' '}
                      <em className="cc-field-hint-inline">A=8 · B-/C-/D =7</em>
                    </span>
                    <input
                      value={form.matricula}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          matricula: formatMatriculaInput(e.target.value, {
                            prev: form.matricula,
                          }),
                        })
                      }
                      onBlur={(e) =>
                        setForm({
                          ...form,
                          matricula: formatMatriculaInput(e.target.value),
                        })
                      }
                      placeholder="D-"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      title="Primero letra A/B/C/D; el guion se inserta solo. Backspace borra letra+guion. A=8 / BCD=7"
                      required
                      aria-invalid={matriculaStatus === 'taken' || matriculaStatus === 'invalid'}
                      className={
                        matriculaStatus === 'taken' || matriculaStatus === 'invalid'
                          ? 'is-invalid'
                          : matriculaStatus === 'ok'
                            ? 'is-ok'
                            : undefined
                      }
                    />
                    {matriculaStatus === 'checking' && (
                      <span className="cc-field-hint">Verificando matrícula…</span>
                    )}
                    {matriculaStatus === 'ok' && (
                      <span className="cc-field-hint cc-field-hint--ok">Matrícula disponible</span>
                    )}
                    {matriculaStatus === 'taken' && (
                      <span className="cc-field-hint cc-field-hint--err" role="alert">
                        Ya registrada
                        {matriculaTakenBy?.username
                          ? ` · usuario ${matriculaTakenBy.username}`
                          : matriculaTakenBy?.displayName
                            ? ` · ${matriculaTakenBy.displayName}`
                            : ''}
                      </span>
                    )}
                    {matriculaStatus === 'invalid' && form.matricula.trim().length >= 3 && (
                      <span className="cc-field-hint cc-field-hint--err">Formato inválido</span>
                    )}
                  </label>
                </div>
              </section>

              <section className="cc-form-section">
                <FormSectionTitle icon="nombre" hint="Nombre(s) y apellidos; forman el indicativo y el usuario">
                  Nombre completo
                </FormSectionTitle>
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field">
                    <span>Nombre(s) *</span>
                    <input
                      value={form.givenNames}
                      onChange={(e) => setForm({ ...form, givenNames: e.target.value })}
                      placeholder="Juan Carlos"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellido paterno *</span>
                    <input
                      value={form.paternalSurname}
                      onChange={(e) => setForm({ ...form, paternalSurname: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellido materno</span>
                    <input
                      value={form.maternalSurname}
                      onChange={(e) => setForm({ ...form, maternalSurname: e.target.value })}
                      placeholder="De la Cruz"
                    />
                  </label>
                </div>
              </section>

              <section className="cc-form-section">
                <FormSectionTitle icon="servicio" hint="Teléfono, tipo de servicio y distintivo">
                  Contacto y servicio
                </FormSectionTitle>
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field">
                    <span>
                      No. de teléfono{editingUser ? '' : ' *'}{' '}
                      <em className="cc-field-hint-inline">10 dígitos</em>
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
                      placeholder="55 1234 5678"
                      inputMode="tel"
                      autoComplete="off"
                      required={!editingUser}
                      aria-invalid={fieldFilled(form.phone) && !isValidPhone(form.phone)}
                      className={
                        fieldFilled(form.phone)
                          ? isValidPhone(form.phone)
                            ? 'is-ok'
                            : 'is-invalid'
                          : undefined
                      }
                    />
                    {fieldFilled(form.phone) && !isValidPhone(form.phone) && (
                      <span className="cc-field-hint cc-field-hint--err">
                        10 dígitos, o + y lada internacional
                      </span>
                    )}
                  </label>
                  <label className="field">
                    <span>Tipo de servicio</span>
                    <select
                      value={form.cargo}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (v !== '__new__') {
                          setForm({ ...form, cargo: v });
                          return;
                        }
                        const name = String(
                          window.prompt('Nuevo tipo de servicio (ej. P.M.A.):') || ''
                        ).trim();
                        if (!name) return;
                        try {
                          const created = await createCatalogServicio(session.token, { name });
                          const row = created?.servicio || { name };
                          setServicios((prev) =>
                            prev.some((s) => s.name === row.name) ? prev : [...prev, row]
                          );
                          setForm((f) => ({ ...f, cargo: row.name }));
                        } catch (err) {
                          setError(err.message || 'No se pudo agregar el tipo de servicio');
                        }
                      }}
                    >
                      <option value="">— Selecciona tipo —</option>
                      {servicioTipoOptions(servicios, form.cargo).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="__new__">+ Agregar tipo…</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Distintivo o nombre del servicio</span>
                    <input
                      value={form.serviceNombre}
                      onChange={(e) =>
                        setForm({ ...form, serviceNombre: e.target.value })
                      }
                      placeholder="Ej. Sanchez"
                      maxLength={160}
                    />
                  </label>
                </div>
              </section>

              <section className="cc-form-section">
                <FormSectionTitle
                  icon="ubicacion"
                  hint="Para la relación y el Excel; no afecta la ubicación en tiempo real."
                >
                  Ubicación del servicio
                </FormSectionTitle>
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field cc-geo-coords">
                    <span>
                      Coordenadas{' '}
                      <em className="cc-field-hint-inline">decimales, DMS, cuadrícula o liga de Maps</em>
                    </span>
                    <input
                      value={form.serviceCoords}
                      onChange={(e) => setForm({ ...form, serviceCoords: e.target.value })}
                      placeholder={`25.712132, -100.329889 · 25°42'42.0"N 100°19'49.3"W · 14R LP 6657 4447`}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={serviceGeo.status === 'invalid'}
                      className={
                        serviceGeo.status === 'invalid'
                          ? 'is-invalid'
                          : serviceGeo.status === 'ok'
                            ? 'is-ok'
                            : undefined
                      }
                    />
                    {serviceCoordsInfo.coords && serviceCoordsInfo.coords.format !== 'DD' ? (
                      <small className="cc-geo-parsed">
                        {serviceCoordsInfo.coords.format} →{' '}
                        {formatCoords(serviceCoordsInfo.coords.lat, serviceCoordsInfo.coords.lng)}
                      </small>
                    ) : serviceCoordsInfo.error ? (
                      <small className="cc-geo-parsed cc-geo-parsed--error">{serviceCoordsInfo.error}</small>
                    ) : null}
                  </label>
                  <div className="field cc-geo-status-field">
                    <span>Estado de la consulta</span>
                    <div className={`cc-geo-status cc-geo-status--${serviceGeo.status}`} role="status">
                      {serviceGeo.status === 'idle' && 'Sin coordenadas'}
                      {serviceGeo.status === 'invalid' && 'Formato inválido'}
                      {serviceGeo.status === 'loading' && 'Buscando lugar…'}
                      {serviceGeo.status === 'error' && 'Sin datos; captura a mano'}
                      {serviceGeo.status === 'ok' &&
                        (serviceGeo.data?.approx ? 'Lugar aproximado' : 'Lugar encontrado')}
                      {serviceCoordsInfo.coords ? (
                        <a
                          className="cc-geo-maplink"
                          href={`https://www.google.com/maps?q=${serviceCoordsInfo.coords.lat},${serviceCoordsInfo.coords.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver mapa
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <label className="field">
                    <span>Poblado</span>
                    <input
                      value={form.serviceLocalidad}
                      onChange={(e) => {
                        setForm({ ...form, serviceLocalidad: e.target.value });
                        setPlaceAutoFilled(false);
                      }}
                      placeholder="Ej. Altamira"
                      maxLength={200}
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Mpio.</span>
                    <input
                      value={form.serviceMunicipio}
                      onChange={(e) => {
                        setForm({ ...form, serviceMunicipio: e.target.value });
                        setPlaceAutoFilled(false);
                      }}
                      placeholder="Ej. Altamira"
                      maxLength={160}
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <input
                      value={form.serviceEstado}
                      onChange={(e) => {
                        setForm({ ...form, serviceEstado: e.target.value });
                        setPlaceAutoFilled(false);
                      }}
                      placeholder="Ej. Tamaulipas"
                      list="cc-mx-estados"
                      maxLength={80}
                      autoComplete="off"
                    />
                    <datalist id="cc-mx-estados">
                      {MX_ESTADOS.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <p className="cc-geo-foot">
                  {placeAutoFilled
                    ? 'Poblado, Mpio. y Estado se rellenaron con las coordenadas; puedes corregirlos.'
                    : 'Pega coordenadas para rellenar Poblado, Mpio. y Estado, o escríbelos a mano.'}
                  {serviceGeo.status === 'ok' &&
                  (serviceGeo.data?.colonia || serviceGeo.data?.cp || serviceGeo.data?.ejido) ? (
                    <span className="cc-geo-extra">
                      {serviceGeoSummary({
                        colonia: serviceGeo.data.colonia,
                        cp: serviceGeo.data.cp,
                        ejido: serviceGeo.data.ejido,
                      })}
                    </span>
                  ) : null}
                </p>
              </section>

            </>
          )}

          {step === 'datos' && !editBasicsOnly && (
            <>
              <section className="cc-form-section">
                <FormSectionTitle icon="perfil" hint="Permisos por módulo y nivel jerárquico">
                  Perfil de acceso
                </FormSectionTitle>
                <div className="cc-form-grid">
                  <label className="field">
                    <span>Perfil *</span>
                    <select
                      value={form.profileId}
                      disabled={isActingUnitAdmin}
                      required={!isActingUnitAdmin}
                      onChange={(e) => {
                        const profileId = e.target.value;
                        const profile = accessProfiles.find((p) => p.id === profileId);
                        const role = profile
                          ? roleFromAccessProfile(profile)
                          : '';
                        setForm({
                          ...form,
                          profileId,
                          role,
                          zoneChoice: '',
                          unitChoice: '',
                          zoneId: '',
                          unitId: '',
                          ...visibilityForRole(role || 'unit_user'),
                        });
                      }}
                    >
                      {!isActingUnitAdmin ? (
                        <option value="">— Selecciona perfil —</option>
                      ) : null}
                      {profileSelectOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {profileOptionLabel(p)}
                        </option>
                      ))}
                    </select>
                    {form.role && ROLE_HELP[form.role] ? (
                      <span className="cc-field-hint-inline">{ROLE_HELP[form.role]}</span>
                    ) : (
                      <span className="cc-field-hint-inline">
                        Define permisos (módulos) y el nivel jerárquico. Se configura en
                        Administración → Perfiles.
                      </span>
                    )}
                  </label>
                </div>
              </section>
              <section className="cc-form-section">
                <FormSectionTitle icon="organismo" hint="Región, zona y unidad a la que pertenece">
                  Organismo Pert.
                </FormSectionTitle>
                <p className="cc-group-pick-hint">
                  {isActingUnitAdmin
                    ? myScopeUnitId
                      ? 'Adscripción fijada a tu unidad (solo servicios desplegados de esa unidad).'
                      : 'Tu cuenta de admin de unidad no tiene unidad asignada; contacta a un administrador.'
                    : roleNorm === 'root'
                      ? 'Administrador del sistema: ve todas las regiones.'
                      : regionOnlyRole
                      ? 'Solo la región. Ahí termina la pertenencia (zonas y unidades se eligen al crear canales).'
                      : roleNorm === 'zone_admin' || roleNorm === 'zone_user'
                        ? 'Región → Zona / C.G. (alcance = toda esa zona; sin elegir unidad).'
                        : unitMustBeSpecific
                          ? 'Región → Zona / C.G. → Unidad (obligatoria).'
                          : 'Elige el alcance según el rol.'}
                </p>
                {roleNorm === 'root' ? (
                  <p className="cc-field-hint-inline">Alcance: todas las regiones</p>
                ) : (
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field">
                    <span>Región *</span>
                    <select
                      value={form.regionId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          regionId: e.target.value,
                            zoneChoice: '',
                            unitChoice: '',
                          zoneId: '',
                          unitId: '',
                        })
                      }
                        required={showRegionAlcance || isActingUnitAdmin}
                        disabled={isActingUnitAdmin}
                    >
                      <option value="">— Selecciona —</option>
                      {orgRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </label>
                    {(showZoneStep || isActingUnitAdmin) && (
                  <label className="field">
                    <span>Zona / C.G. *</span>
                    <select
                          value={form.zoneChoice}
                      onChange={(e) =>
                        setForm({
                          ...form,
                              zoneChoice: e.target.value,
                              unitChoice: '',
                              zoneId:
                                e.target.value && e.target.value !== ALC_ALL_ZONES
                                  ? e.target.value
                                  : '',
                          unitId: '',
                        })
                      }
                      required
                          disabled={isActingUnitAdmin || !form.regionId}
                    >
                      <option value="">— Selecciona —</option>
                          {allowAllZones ? (
                            <option value={ALC_ALL_ZONES}>
                              Todas las zonas de {regionName}
                            </option>
                          ) : null}
                      {orgZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>
                    )}
                    {(showUnitStep || isActingUnitAdmin) && (
                  <label className="field">
                        <span>{unitMustBeSpecific || isActingUnitAdmin ? 'Unidad *' : 'Unidad'}</span>
                    <select
                          value={form.unitChoice}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              unitChoice: e.target.value,
                              unitId:
                                e.target.value && e.target.value !== ALC_ALL_UNITS
                                  ? e.target.value
                                  : '',
                            })
                          }
                          required={unitMustBeSpecific || isActingUnitAdmin || Boolean(form.zoneChoice)}
                          disabled={isActingUnitAdmin || !selectedZoneId}
                        >
                          <option value="">— Selecciona —</option>
                          {!unitMustBeSpecific && !isActingUnitAdmin ? (
                            <option value={ALC_ALL_UNITS}>
                              Todos los organismos de {zoneName}
                            </option>
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
                )}
              </section>
              <section className="cc-form-section">
                <FormSectionTitle
                  icon="mapa"
                  hint="Lo fija el perfil automáticamente; si cambias el perfil, cambia con él."
                >
                  Qué oye en radio y qué ve en el mapa
                </FormSectionTitle>
                <div className="cc-priv-fieldset">
                  <p className="cc-group-pick-hint">{radioMapScopeHelp(form.role)}</p>
                  {!normalizeClientRole(form.role) ? null : visibilityLevelsForRole(form.role).length ? (
                  <div className="cc-priv-check-list">
                      {visibilityLevelsForRole(form.role).map((lvl) => (
                        <div key={lvl.key} className="cc-priv-check on cc-priv-check--locked">
                      <span className="cc-priv-check-body">
                            <span className="cc-priv-check-name">{lvl.name}</span>
                            <span className="cc-priv-check-desc">({lvl.desc})</span>
                        </span>
                  </div>
                      ))}
                    </div>
                  ) : (
                    <p className="cc-group-pick-hint">{radioMapScopeEmptyHint(form.role)}</p>
                  )}
                </div>
              </section>
            </>
          )}

          {step === 'datos' && (
            <div className="field field-actions cc-form-actions">
              <button
                type="submit"
                className="cc-btn primary"
                disabled={
                  busy ||
                  !preview.username ||
                  !composedDisplayName ||
                  !isValidMatricula(form.matricula) ||
                  matriculaStatus === 'taken' ||
                  matriculaStatus === 'checking'
                }
              >
                Continuar a efectivos →
              </button>
            </div>
          )}

          {step === 'efectivos' && (
            <>
              <div className="cc-create-summary">
                <p>
                  <strong>{composedDisplayName || preview.displayName || 'Nuevo usuario'}</strong>
                  {preview.fullName ? (
                    <span className="muted"> · {preview.fullName}</span>
                  ) : null}
                </p>
                <p className="muted">
                  {formatDistintivo(form.cargo, form.serviceNombre) || 'Sin distintivo'}
                  {' · '}Matrícula: <code className="cc-mono">{form.matricula}</code>
                  {servicePlaceLabel(form) ? <> · {servicePlaceLabel(form)}</> : null}
                </p>
              </div>
              <section className="cc-form-section">
                <FormSectionTitle
                  icon="efectivos"
                  hint="Solo cantidades (opcional). «+» anexa un concepto para todos los usuarios; «×» lo quita."
                >
                  Efectivos del servicio
                </FormSectionTitle>
                <div className="cc-efectivos-table">
                  {EFECTIVOS_GRUPOS.map((g) => {
                    const items = efectivosItems.filter((it) => it.grupo === g.key);
                    const total = efectivosGrupoTotal(form, g.key);
                    return (
                      <div className="cc-efectivos-row" key={g.key}>
                        <div className="cc-efectivos-row-head">
                          <span className="cc-efectivos-row-name">{g.label}</span>
                          {total != null ? (
                            <span className="cc-efectivos-row-total">{total}</span>
                          ) : null}
                        </div>
                        <div className="cc-efectivos-row-items">
                          {items.map((it) => (
                            <div className="cc-efectivos-item" key={it.id}>
                              <div className="cc-efectivos-item-head">
                                <span className="cc-efectivos-item-name" title={it.name}>
                                  {it.name}
                                </span>
                                <button
                                  type="button"
                                  className="cc-efectivos-remove"
                                  onClick={() => removeEfectivoItem(it)}
                                  title={`Quitar ${it.name}`}
                                  aria-label={`Quitar ${it.name} de ${g.label}`}
                                >
                                  ×
                                </button>
                              </div>
                              <input
                                value={form.serviceEfectivos?.[it.id] ?? ''}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    serviceEfectivos: {
                                      ...form.serviceEfectivos,
                                      [it.id]: e.target.value.replace(/\D/g, '').slice(0, 5),
                                    },
                                  })
                                }
                                inputMode="numeric"
                                autoComplete="off"
                                aria-label={`${g.label}: ${it.name}`}
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            className="cc-efectivos-add"
                            onClick={() => addEfectivoItem(g.key)}
                            title={`Anexar concepto a ${g.label}`}
                            aria-label={`Anexar concepto a ${g.label}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <div className="field field-actions cc-form-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setStep('datos')}
                  disabled={busy}
                >
                  ← Atrás
                </button>
                <button type="submit" className="cc-btn primary" disabled={busy}>
                  {editingUser && editBasicsOnly
                    ? busy
                      ? 'Guardando…'
                      : 'Guardar cambios'
                    : 'Continuar a grupos →'}
                </button>
              </div>
            </>
          )}

          {step === 'grupos' && !editBasicsOnly && (
            <>
              <div className="cc-create-summary">
                <p>
                  <strong>{composedDisplayName || preview.displayName || 'Nuevo usuario'}</strong>
                  {preview.fullName ? (
                    <span className="muted"> · {preview.fullName}</span>
                  ) : null}
                </p>
                <p>
                  Usuario: <code className="cc-mono">{preview.username}</code>
                  {' · '}
                  Matrícula: <code className="cc-mono">{form.matricula}</code>
                  {form.phone ? (
                    <>
                      {' · '}
                      Tel.: <code className="cc-mono">{form.phone}</code>
                    </>
                  ) : null}
                  {' · '}
                  {roleLabel(form.role)}
                </p>
                <p className="muted">
                  {[form.grade, form.specialty, form.cargo].filter(Boolean).join(' · ')}
                  {form.unitChoice &&
                  form.unitChoice !== ALC_ALL_UNITS &&
                  orgUnits.find((u) => u.id === form.unitChoice)
                    ? ` · ${orgUnits.find((u) => u.id === form.unitChoice)?.name}`
                    : form.zoneChoice === ALC_ALL_ZONES
                      ? ` · Todas las zonas`
                      : form.unitChoice === ALC_ALL_UNITS
                        ? ` · Toda la zona`
                        : form.zoneChoice && orgZones.find((z) => z.id === form.zoneChoice)
                          ? ` · ${orgZones.find((z) => z.id === form.zoneChoice)?.name}`
                    : ''}
                </p>
              </div>

              <section className="cc-form-section">
                <FormSectionTitle
                  icon="grupos"
                  hint={
                    editingUser
                      ? 'Marcados = grupos actuales. Al guardar se ingresa a los nuevos y se retira de los desmarcados.'
                      : 'Opcional: marca varios o ninguno; también se asignan después desde Grupos.'
                  }
                >
                  {editingUser ? 'Grupos a los que pertenece' : '¿A qué grupos ingresa?'}
                </FormSectionTitle>
                {editingUser && initialGroupIds == null ? (
                  <p className="muted">Cargando grupos del usuario…</p>
                ) : editingUser && initialGroupIds === false ? (
                  <p className="muted">
                    No se pudieron cargar sus grupos; al guardar solo se actualizan los datos.
                  </p>
                ) : activeGroups.length === 0 ? (
                  <p className="muted">No hay grupos activos. Puedes crear el usuario sin canal.</p>
                ) : (
                  <>
                    <div className="cc-group-pick-toolbar">
                      <button
                        type="button"
                        className="cc-btn ghost cc-btn-sm"
                        onClick={() => setSelectedGroupIds(suggestedGroupIds(activeGroups))}
                      >
                        Marcar sugeridos
                      </button>
                      <button
                        type="button"
                        className="cc-btn ghost cc-btn-sm"
                        onClick={() => setSelectedGroupIds([])}
                        disabled={!selectedGroupIds.length}
                      >
                        Ninguno
                      </button>
                    </div>
                  <ul className="cc-group-check-list">
                    {activeGroups.map((g) => {
                      const suggested = suggestedGroupIds(activeGroups).includes(g.id);
                      const checked = selectedGroupIds.includes(g.id);
                      return (
                        <li key={g.id}>
                          <label className={`cc-group-check ${checked ? 'on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroup(g.id)}
                            />
                            <span className="cc-group-check-body">
                              <span className="cc-group-check-name">{g.name}</span>
                              {suggested && (
                                <span className="cc-group-suggest">sugerido</span>
                              )}
                              {g.description ? (
                                <span className="cc-group-check-desc">{g.description}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </section>

              <div className="field field-actions cc-form-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setStep('efectivos')}
                  disabled={busy}
                >
                  ← Atrás
                </button>
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={busy || (editingUser && initialGroupIds == null)}
                >
                  {editingUser
                    ? busy
                      ? 'Guardando…'
                      : 'Guardar cambios'
                    : busy
                      ? 'Creando…'
                      : selectedGroupIds.length
                        ? `Crear e ingresar a ${selectedGroupIds.length} grupo(s)`
                        : 'Crear sin grupos'}
                </button>
              </div>
            </>
          )}
            </form>
          </div>
        </div>
      )}

      {credModal && (
        <div className="sys-modal-backdrop" role="presentation" data-esc-close>
          <div
            className="sys-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cred-modal-title"
          >
            <header className="sys-modal-head">
              <h2 id="cred-modal-title">{credModal.title}</h2>
              <button
                type="button"
                className="sys-modal-x"
                data-esc-close-btn
                aria-label="Cerrar"
                onClick={() => setCredModal(null)}
              >
                ×
              </button>
            </header>
            <div className="sys-modal-body">
              <p className="sys-modal-lead">
                Entrega estas credenciales al operador. No se volverán a mostrar.
              </p>
              <dl className="sys-cred-list">
                <div>
                  <dt>Usuario</dt>
                  <dd>
                    <code>{credModal.username}</code>
                  </dd>
                </div>
                {credModal.temporaryPassword ? (
                  <div>
                    <dt>Contraseña temporal</dt>
                    <dd>
                      <code className="sys-cred-pass">{credModal.temporaryPassword}</code>
                    </dd>
                  </div>
                ) : null}
                {credModal.groups ? (
                  <div>
                    <dt>Grupos</dt>
                    <dd>{credModal.groups}</dd>
                  </div>
                ) : null}
              </dl>
              {credModal.hint ? <p className="sys-modal-hint">{credModal.hint}</p> : null}
            </div>
            <footer className="sys-modal-actions">
              {credModal.temporaryPassword ? (
                <button type="button" className="cc-btn ghost" onClick={copyCredentials}>
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              ) : null}
              <button type="button" className="cc-btn primary" onClick={() => setCredModal(null)}>
                Entendido
              </button>
            </footer>
          </div>
        </div>
      )}

      {userGroupsModal && (
        <div className="sys-modal-backdrop" role="presentation" data-esc-close>
          <div
            className="sys-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-groups-modal-title"
          >
            <header className="sys-modal-head">
              <h2 id="user-groups-modal-title">
                Grupos — {userGroupsModal.displayName || userGroupsModal.username}
              </h2>
              <button
                type="button"
                className="sys-modal-x"
                data-esc-close-btn
                aria-label="Cerrar"
                onClick={() => setUserGroupsModal(null)}
              >
                ×
              </button>
            </header>
            <div className="sys-modal-body">
              {userGroupsModal.loading ? (
                <p className="sys-modal-lead">Cargando…</p>
              ) : userGroupsModal.error ? (
                <p className="sys-modal-hint" role="alert">
                  {userGroupsModal.error}
                </p>
              ) : userGroupsModal.groups.length === 0 ? (
                <p className="sys-modal-lead">Sin grupos en tu alcance.</p>
              ) : (
                <ul className="usr-groups-list">
                  {userGroupsModal.groups.map((g) => (
                    <li key={g.id} className={!g.isActive ? 'is-inactive' : undefined}>
                      <span className="usr-groups-name">{g.name}</span>
                      <span className="usr-groups-meta">
                        {MEMBER_ROLE_LABEL[g.memberRole] || g.memberRole}
                        {g.unitName ? ` · ${g.unitName}` : ''}
                        {!g.isActive ? ' · inactivo' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="sys-modal-actions">
              <button type="button" className="cc-btn primary" onClick={() => setUserGroupsModal(null)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="sys-modal-backdrop" role="presentation" data-esc-close>
          <div
            className="sys-modal sys-modal--sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <header className="sys-modal-head">
              <h2 id="confirm-modal-title">{confirmModal.title}</h2>
              <button
                type="button"
                className="sys-modal-x"
                data-esc-close-btn
                aria-label="Cerrar"
                onClick={() => setConfirmModal(null)}
              >
                ×
              </button>
            </header>
            <div className="sys-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <footer className="sys-modal-actions">
              <button type="button" className="cc-btn ghost" onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={`cc-btn ${confirmModal.danger ? 'danger' : 'primary'}`}
                onClick={() => confirmModal.onConfirm?.()}
              >
                {confirmModal.confirmLabel || 'Confirmar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

